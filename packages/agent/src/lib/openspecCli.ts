/**
 * OpenSpec CLI reader — spawn site 3 of the enumeration in
 * `filesystem-access-policy` › Daemon Writes Confined To Its Own Directory.
 *
 * Unlike $EDITOR and the conformance harness, this binary is invoked without a
 * user gesture, on an ordinary card render. Its bounds are therefore the
 * daemon's responsibility on every request rather than a one-time consent, and
 * every failure mode degrades to the tree reader instead of surfacing.
 *
 * Surface verified against `openspec` 1.6.0 (2026-07-26):
 *   openspec list --json          -> { changes: [{ name, completedTasks, totalTasks, ... }] }
 *   openspec list --specs --json  -> { specs:   [{ id, requirementCount }] }
 * A CLI whose surface has moved does not fail the read; it falls back under the
 * shape-recognition rule below.
 */
import { stat, access, realpath } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { join, isAbsolute, delimiter } from 'node:path'

import { execa } from 'execa'
import { z } from 'zod'

import {
  OPENSPEC_SUBPROCESS_TIMEOUT_MS,
  OPENSPEC_MAX_OUTPUT_BYTES,
} from '../constants.js'

export { OPENSPEC_MAX_OUTPUT_BYTES, OPENSPEC_SUBPROCESS_TIMEOUT_MS }

/** The closed argv table. Nothing outside this may be passed to the binary. */
const ARGV_BY_KIND = {
  changes: ['list', '--json'],
  specs: ['list', '--specs', '--json'],
} as const

export type OpenspecListKind = keyof typeof ARGV_BY_KIND

/**
 * Shape recognition is a required-subset check that ignores unknown fields.
 * Zod strips unknown keys by default, so an upstream release that adds a field
 * stays recognised; a release that drops a field we consume does not parse and
 * falls back. An exact-set check would degrade to the tree on every CLI bump,
 * which would defeat the reason for having a CLI path at all.
 */
const ChangeListSchema = z.object({
  changes: z.array(
    z.object({
      name: z.string(),
      // Must match the wire schema's bound exactly. A looser check here lets a
      // malformed count through shape recognition and turns it into a ZodError
      // at the registry boundary, which is far from where it can be handled.
      completedTasks: z.number().int().nonnegative(),
      totalTasks: z.number().int().nonnegative(),
    }),
  ),
})

const SpecListSchema = z.object({
  specs: z.array(
    z.object({
      id: z.string(),
      requirementCount: z.number().int().nonnegative(),
    }),
  ),
})

export type OpenspecChange = z.infer<typeof ChangeListSchema>['changes'][number]
export type OpenspecSpec = z.infer<typeof SpecListSchema>['specs'][number]

export type OpenspecFallbackReason =
  | 'unavailable'
  | 'spawn-failed'
  | 'timeout'
  | 'exit'
  | 'oversized'
  | 'unparseable'
  | 'unrecognised'

export type OpenspecListResult<K extends OpenspecListKind> =
  | { ok: true; data: K extends 'changes' ? OpenspecChange[] : OpenspecSpec[] }
  | { ok: false; reason: OpenspecFallbackReason }

/**
 * Resolve the binary to an absolute path, once. Anything that is not an
 * existing regular executable file — absent, a directory, a broken symlink, or
 * missing the executable bit — is a resolution failure, identical in effect to
 * the binary being absent.
 */
export async function resolveOpenspecBinary(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  const pathVar = env.PATH
  if (!pathVar) return null

  for (const entry of pathVar.split(delimiter)) {
    // An empty PATH element means "cwd" on POSIX. Never search the cwd: the
    // daemon's cwd is not a trusted location for an executable.
    if (!entry) continue
    const candidate = isAbsolute(entry) ? join(entry, 'openspec') : null
    if (!candidate) continue

    try {
      // realpath first so a broken symlink fails here rather than at stat.
      const real = await realpath(candidate)
      const st = await stat(real)
      if (!st.isFile()) continue
      await access(real, fsConstants.X_OK)
      return candidate
    } catch {
      continue
    }
  }
  return null
}

/**
 * The resolve-once accessor every caller on a request path must use.
 *
 * `OpenSpec CLI Invocation Discipline` requires the binary be resolved once and
 * that "no PATH lookup and no process spawn is attempted on the request path".
 * That is a security bound, not only a cost one: a PATH walk per request means a
 * local attacker who can write to any writable PATH directory gets their binary
 * executed within one poll interval and without a daemon restart. Resolving once
 * narrows that window to daemon start, where a restart is at least observable.
 *
 * A resolution *failure* is memoised too. Re-walking on every request when the
 * binary is absent is the same defect, and it is also the case the spec names
 * explicitly: absence means the tree path "for the remainder of the daemon's
 * lifetime".
 *
 * The promise itself is cached rather than its value, so concurrent first
 * callers share one walk instead of racing several.
 */
let resolvedBinary: Promise<string | null> | undefined
let resolvedForPath: string | undefined

export function getOpenspecBinary(
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  // Keyed on PATH rather than memoised unconditionally: accepting an `env`
  // argument and then ignoring every value after the first is a loaded gun for
  // the next caller. In the daemon PATH never changes, so this is still exactly
  // one walk per lifetime.
  const key = env.PATH ?? ''
  if (resolvedBinary === undefined || resolvedForPath !== key) {
    resolvedForPath = key
    resolvedBinary = resolveOpenspecBinary(env)
  }
  return resolvedBinary
}

/** Test-only: drop the memoised resolution so each case starts clean. */
export function __resetOpenspecBinaryForTests(): void {
  resolvedBinary = undefined
  resolvedForPath = undefined
}

/**
 * Invoke the binary for one listing, bounded, and translate every failure into
 * a fallback reason. Never throws: the caller's contract is to read the tree
 * when this does not return ok.
 *
 * `binary` is passed explicitly rather than read from module state so the
 * caller owns the resolve-once lifetime and tests need no global mutation.
 */
export async function runOpenspecList<K extends OpenspecListKind>(
  kind: K,
  cwd: string,
  binary: string | null,
  opts: { timeoutMs?: number; maxOutputBytes?: number } = {},
): Promise<OpenspecListResult<K>> {
  if (!binary) return { ok: false, reason: 'unavailable' }

  const timeoutMs = opts.timeoutMs ?? OPENSPEC_SUBPROCESS_TIMEOUT_MS
  const maxOutputBytes = opts.maxOutputBytes ?? OPENSPEC_MAX_OUTPUT_BYTES

  let stdout: string
  let timedOut = false
  let settled = false
  let timer: NodeJS.Timeout | undefined
  // Declared out here so the finally block can reach it after a throw.
  let subprocessPid: number | undefined

  try {
    const subprocess = execa(binary, [...ARGV_BY_KIND[kind]], {
      cwd,
      // argv array + no shell: nothing in cwd can be interpreted as syntax.
      shell: false,
      reject: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Bytes, not characters: execa measures maxBuffer in UTF-16 code units
      // unless the encoding is 'buffer', so a 2 MiB cap would have admitted
      // several times that in memory for multi-byte output before the
      // post-check below could reject it.
      encoding: 'buffer',
      maxBuffer: maxOutputBytes,
      // Own process group so the timeout below can reach descendants.
      detached: true,
      // `cleanup` is a documented no-op when `detached` is set (execa skips it
      // for detached children), so it is not set here: relying on it would be a
      // false assurance. The finally block below does the work instead.
    })
    subprocessPid = subprocess.pid

    // The timeout is enforced here rather than via execa's `timeout` option.
    // execa signals the direct child only; a child that has itself forked (a
    // wrapper script calling the real binary) leaves a grandchild holding the
    // stdout pipe open, so the promise never settles and the read hangs
    // forever — the exact orphaning the process-group requirement forbids.
    // Signalling -pid reaches the whole group.
    timer = setTimeout(() => {
      // Never signal a group for a process that has already settled: the PGID
      // may have been recycled by then, and -pid would reach whatever now owns
      // it. The child is reaped before the promise finishes resolving, so this
      // window is real, not theoretical.
      if (settled) return
      timedOut = true
      killGroup(subprocess.pid)
    }, timeoutMs)

    const result = await subprocess
    settled = true

    if (timedOut) return { ok: false, reason: 'timeout' }
    if (isOversized(result)) return { ok: false, reason: 'oversized' }
    // With reject:false a spawn failure resolves rather than throws, and
    // reports a null exit code — it never ran, so it is not an exit status.
    if (result.exitCode === null || result.exitCode === undefined) {
      return { ok: false, reason: 'spawn-failed' }
    }
    if (result.exitCode !== 0) return { ok: false, reason: 'exit' }

    // With `encoding: 'buffer'` execa hands back a Uint8Array, which is what
    // lets maxBuffer bound real bytes. Decode here rather than earlier so the
    // cap is enforced on the wire size, not the decoded length.
    const raw: unknown = result.stdout
    stdout =
      raw instanceof Uint8Array
        ? Buffer.from(raw).toString('utf8')
        : typeof raw === 'string'
          ? raw
          : ''
    // Guard the cap again on the captured string: maxBuffer is a best-effort
    // bound and a child can emit exactly at the boundary.
    if (Buffer.byteLength(stdout, 'utf8') > maxOutputBytes) {
      return { ok: false, reason: 'oversized' }
    }
  } catch (err) {
    if (timedOut) return { ok: false, reason: 'timeout' }
    const e = err as NodeJS.ErrnoException & { timedOut?: boolean; pid?: number }
    if (e.timedOut) {
      killGroup(e.pid)
      return { ok: false, reason: 'timeout' }
    }
    if (isOversized(e)) return { ok: false, reason: 'oversized' }
    // ENOENT / EACCES / ENOTDIR — the binary resolved at start but is gone,
    // replaced, or no longer executable at invocation time.
    return { ok: false, reason: 'spawn-failed' }
  } finally {
    if (timer) clearTimeout(timer)
    // Belt and braces for every non-timeout failure path: execa signals only the
    // direct child, so a wrapper script that forked leaves a grandchild holding
    // stdout open. Harmless when the group is already gone.
    if (!settled) killGroup(subprocessPid)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return { ok: false, reason: 'unparseable' }
  }

  if (kind === 'changes') {
    const r = ChangeListSchema.safeParse(parsed)
    if (!r.success) return { ok: false, reason: 'unrecognised' }
    return { ok: true, data: r.data.changes } as OpenspecListResult<K>
  }

  const r = SpecListSchema.safeParse(parsed)
  if (!r.success) return { ok: false, reason: 'unrecognised' }
  return { ok: true, data: r.data.specs } as OpenspecListResult<K>
}

function isOversized(e: unknown): boolean {
  const err = e as { code?: string; isMaxBuffer?: boolean; message?: string }
  return (
    err?.isMaxBuffer === true ||
    err?.code === 'ENOBUFS' ||
    /maxBuffer/i.test(err?.message ?? '')
  )
}

/**
 * Signal the child's whole process group. `detached: true` makes the child a
 * group leader, so -pid reaches its descendants; execa's own timeout kill only
 * reaches the direct child.
 */
function killGroup(pid: number | undefined): void {
  if (!pid) return
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    // Already reaped, or never started. Nothing to clean up.
  }
}
