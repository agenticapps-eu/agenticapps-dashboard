/**
 * Registry lib: registry.json CRUD, slug generation, project status.
 *
 * Subprocess discipline: only execa (argv array) for git invocation.
 * The project root is user-controlled; using a shell-based spawn would
 * interpret it as shell tokens. execa uses argv arrays — no shell injection. (T-01-02-10)
 */
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  readdirSync,
  unlinkSync,
  writeSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'

import { execa } from 'execa'
import {
  RegistryEntrySchema,
  RegistryFileSchema,
  RegistryListItemSchema,
  type RegistryEntry,
  type RegistryFile,
  type RegistryListItem,
} from '@agenticapps/dashboard-shared'

import { CONFIG_DIR, GIT_SUBPROCESS_TIMEOUT_MS, REGISTRY_FILE } from '../constants.js'

import { atomicWriteFile } from './atomicWrite.js'
import { invalidateConformanceCache } from './conformanceCache.js'
import { invalidateCoverageCache } from './coverageCache.js'
import { parseOrCorrupt } from './stateCorruption.js'

export type { RegistryEntry, RegistryFile, RegistryListItem }

/**
 * Normalize a string to a URL-safe slug.
 * Strips diacritics, lowercases, collapses non-alnum to dash.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function ensureConfigDir(dir: string = CONFIG_DIR): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
}

/**
 * Canonicalise a project root once at registration. realpath follows symlinks
 * so that a symlink later repointed to a different directory cannot silently
 * change which files the read endpoint resolves under. Falls back to resolve()
 * if the path doesn't exist on disk yet — registering a missing path stays
 * legal (it will surface as `reachable: false` in /api/registry).
 *
 * Exposed for /register-prepare in Phase 3 (D-09 prepare/confirm flow).
 */
export function canonicaliseRoot(pathArg: string): string {
  const resolved = resolve(pathArg)
  try {
    return realpathSync(resolved)
  } catch {
    return resolved
  }
}

/**
 * Thrown when a registration target falls inside a known-sensitive system
 * root or a user-secret dotfile dir. Stopgap defense against a confused-deputy
 * scenario where a token holder (compromised SPA, browser extension, leaked
 * pair URL) registers a high-value path and reads its `.planning` / `.claude`
 * subtrees via /api/projects/:id/read. Proper fix (SPA banner-confirmed nonce)
 * is deferred to Phase 2.
 */
export class RegistrationPathBlocked extends Error {
  constructor(public readonly target: string, public readonly reason: string) {
    super(`registration path is blocked: ${target} (${reason})`)
    this.name = 'RegistrationPathBlocked'
  }
}

/**
 * System roots whose subtrees are not legitimate AgenticApps project dirs.
 * Exact match OR child of (i.e. canonicalPath === root or starts with root+sep).
 */
const SYSTEM_ROOT_BLOCKLIST: readonly string[] = [
  '/',
  '/bin',
  '/boot',
  '/dev',
  '/etc',
  '/Library',
  '/proc',
  '/private/etc',
  '/private/var/db',
  '/private/var/root',
  '/sbin',
  '/sys',
  '/System',
  '/usr/bin',
  '/usr/include',
  '/usr/lib',
  '/usr/libexec',
  '/usr/sbin',
  '/usr/share',
  '/usr/local/bin',
  '/usr/local/etc',
  '/usr/local/sbin',
]

/**
 * Names of dotfile dirs in $HOME that hold credentials/secrets and must never
 * be registered. Combined with $HOME at check time so the list is OS-portable.
 */
const HOME_SECRET_DIR_NAMES: readonly string[] = [
  '.aws',
  '.azure',
  '.config',
  '.docker',
  '.gcloud',
  '.gnupg',
  '.kube',
  '.npm',
  '.pgpass',
  '.pki',
  '.ssh',
]

function pathEqualsOrIsUnder(canonical: string, root: string): boolean {
  return canonical === root || canonical.startsWith(root + sep)
}

/**
 * Reject canonicalRoots that point at system or user-secret directories.
 * No-op for normal project paths (anywhere under $HOME that isn't a secret dir,
 * or anywhere under /tmp / /var/folders for tests). Throws RegistrationPathBlocked
 * with a human-readable reason on hit.
 */
export function assertRegistrationAllowed(canonicalRoot: string): void {
  for (const sysRoot of SYSTEM_ROOT_BLOCKLIST) {
    if (pathEqualsOrIsUnder(canonicalRoot, sysRoot)) {
      throw new RegistrationPathBlocked(canonicalRoot, `${sysRoot} is a system path`)
    }
  }
  const home = homedir()
  for (const name of HOME_SECRET_DIR_NAMES) {
    const dir = join(home, name)
    if (pathEqualsOrIsUnder(canonicalRoot, dir)) {
      throw new RegistrationPathBlocked(
        canonicalRoot,
        `${join('~', name)} holds credentials/secrets`,
      )
    }
  }
  // Daemon's own state dir — registering it would expose auth.json / registry.json.
  if (pathEqualsOrIsUnder(canonicalRoot, CONFIG_DIR)) {
    throw new RegistrationPathBlocked(canonicalRoot, "daemon's own state directory")
  }
}

export function ensureRegistryFile(filePath: string = REGISTRY_FILE): void {
  ensureConfigDir(dirname(filePath))
  if (!existsSync(filePath)) {
    const empty: RegistryFile = { version: 1, projects: [] }
    atomicWriteFile(filePath, JSON.stringify(empty, null, 2), 0o600)
  }
}

export function readRegistry(filePath: string = REGISTRY_FILE): RegistryFile {
  ensureRegistryFile(filePath)
  return parseOrCorrupt(
    RegistryFileSchema,
    JSON.parse(readFileSync(filePath, 'utf8')),
    'registry.json',
  )
}

export function writeRegistry(reg: RegistryFile, filePath: string = REGISTRY_FILE): void {
  const validated = RegistryFileSchema.parse(reg)
  ensureConfigDir(dirname(filePath))
  atomicWriteFile(filePath, JSON.stringify(validated, null, 2), 0o600)
  // Every registry mutation can change the conformance + coverage view —
  // invalidate the per-process caches HERE so the next GET re-scans. Previously
  // only the fix-path route invalidated, leaving register/unregister/rename/tag
  // (CLI + /api/registry/register-confirm) able to serve stale data for up to
  // 30s. Cache modules are singletons per process; invalidation from the CLI
  // is a no-op (its cache instance is never populated), so this is safe.
  invalidateConformanceCache()
  invalidateCoverageCache()
}

/**
 * Cross-process advisory lock for the read-modify-write window over
 * registry.json. atomicWriteFile() guarantees each write is atomic, but a
 * concurrent CLI mutation (`agentic-dashboard register`) that lands between
 * the daemon's readRegistry and writeRegistry would clobber the daemon's
 * change. The plan's A4 ratification claimed POSIX-rename serialised
 * concurrent writes — that is wrong; rename is atomic per call, not across
 * RMW. This helper closes that window with an O_EXCL lock file.
 *
 * Implementation: open `<registry>.lock` with O_EXCL — fails with EEXIST
 * when another holder has it. Retry every 25ms up to maxWaitMs (default
 * 5s). On success, write the holder's PID into the lock file (best-effort
 * — write failure does not abort acquisition), run fn(), then unlink the
 * lock on the way out.
 *
 * Stale-lock detection (Followup #9): if a holder crashes between
 * O_EXCL+O_CREAT and unlinkSync, the lock file lingers and subsequent
 * acquirers would time out forever. On every EEXIST we therefore check
 * whether the existing lock is reclaimable via `tryEvictStaleLock`:
 *   1. lockfile mtime older than STALE_LOCK_MIN_AGE_MS (30s), AND
 *   2. EITHER the recorded PID is dead (process.kill(pid, 0) → ESRCH),
 *      OR the lock body is empty/unparseable (legacy locks pre-fix, or
 *      a holder that crashed before writing its PID).
 * Both conditions must hold — a live holder MUST NOT be evicted, and a
 * fresh lock MUST NOT be evicted (its holder may still be mid-fn).
 *
 * Cross-platform: `process.kill(pid, 0)` works on macOS, Linux, and
 * Windows (Node treats signal 0 as a no-op existence check). PID reuse
 * by an unrelated process is a known false-negative — we leave such a
 * lock alone and fall back to the 5s timeout.
 *
 * Usage: any read-modify-write over the registry should wrap its three
 * steps in this helper. All four mutation functions (addProject,
 * removeProject, renameProject, setTags) and the fix-path route route
 * through this lock per PR #40.
 */
const STALE_LOCK_MIN_AGE_MS = 30_000

/**
 * Decide whether an existing `<registry>.lock` is a crash-orphan and
 * reclaim it if so. Returns true iff the lock was evicted (caller should
 * immediately retry the O_EXCL open).
 */
function tryEvictStaleLock(lockFile: string): boolean {
  let mtimeMs: number
  try {
    mtimeMs = statSync(lockFile).mtimeMs
  } catch {
    // Lock vanished between EEXIST and stat — a concurrent acquirer
    // released or evicted it. Tell the caller to retry the open.
    return true
  }
  if (Date.now() - mtimeMs < STALE_LOCK_MIN_AGE_MS) return false

  // Lock is old enough to be a candidate. Read the recorded PID.
  let pid: number | undefined
  try {
    const content = readFileSync(lockFile, 'utf8').trim()
    const n = Number.parseInt(content, 10)
    if (Number.isFinite(n) && n > 0) pid = n
  } catch {
    // Unreadable — fall through to "no parseable PID" branch below.
  }

  if (pid !== undefined) {
    try {
      process.kill(pid, 0) // signal 0 = existence check
      return false // holder is alive (or signalable) — do NOT evict
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      // ESRCH = no such process. Anything else (EPERM = exists but not
      // ours to signal, EINVAL = bad signal) means "don't evict".
      if (code !== 'ESRCH') return false
    }
  }
  // Old AND (dead PID OR no parseable PID) → safe to reclaim.
  try {
    unlinkSync(lockFile)
  } catch {
    // Lost the race to another evictor — fine, the O_EXCL retry will
    // either acquire or hit a fresh holder.
  }
  return true
}

export async function withRegistryLock<T>(
  fn: () => Promise<T> | T,
  opts: { lockFile?: string; maxWaitMs?: number } = {},
): Promise<T> {
  const lockFile = opts.lockFile ?? `${REGISTRY_FILE}.lock`
  const maxWaitMs = opts.maxWaitMs ?? 5000
  const start = Date.now()
  let fd: number | null = null
  while (true) {
    try {
      fd = openSync(
        lockFile,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL,
        0o600,
      )
      // Record our PID so future acquirers can detect a crash-orphan
      // lock via tryEvictStaleLock. Write failure is non-fatal — the
      // lock is already acquired and our identity is the only thing at
      // stake (next evictor will fall back to mtime-only).
      try {
        writeSync(fd, Buffer.from(`${process.pid}\n`))
      } catch {
        /* PID recording is best-effort — lock acquisition stands */
      }
      break
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
      // Try to reclaim a crash-orphan lock before counting this against
      // the timeout — successful eviction means the next loop iteration
      // can acquire immediately.
      if (tryEvictStaleLock(lockFile)) continue
      if (Date.now() - start > maxWaitMs) {
        throw new Error(`registry_lock_timeout: ${lockFile}`)
      }
      await new Promise((r) => setTimeout(r, 25))
    }
  }
  try {
    return await fn()
  } finally {
    if (fd !== null) {
      try { closeSync(fd) } catch { /* already closed */ }
    }
    try { unlinkSync(lockFile) } catch { /* best-effort cleanup */ }
  }
}

export interface AddResult {
  entry: RegistryEntry
  alreadyRegistered: boolean
}

export interface RegistryMutationLockOpts {
  /** Override the per-call lock timeout (ms). Defaults to withRegistryLock's
   *  5000ms ceiling. Exposed so callers under heavy contention — and tests —
   *  can pick a different ceiling. */
  maxWaitMs?: number
}

/**
 * Build the withRegistryLock opts for a given registry path + caller overrides.
 * Keeps the lockFile derivation in one place so it always tracks the registry
 * file (never the global REGISTRY_FILE constant when the caller passed a
 * fixture path).
 */
function lockOptsFor(
  filePath: string,
  lockOpts: RegistryMutationLockOpts,
): { lockFile: string; maxWaitMs?: number } {
  const out: { lockFile: string; maxWaitMs?: number } = {
    lockFile: `${filePath}.lock`,
  }
  if (lockOpts.maxWaitMs !== undefined) out.maxWaitMs = lockOpts.maxWaitMs
  return out
}

/**
 * Add a project to the registry. Idempotent on path collision (D-10).
 * Slug collisions get -2, -3 suffixes.
 *
 * Wraps the read-modify-write in withRegistryLock so a concurrent CLI or
 * daemon mutation cannot clobber this addition last-writer-wins. Path
 * validation (canonicaliseRoot + assertRegistrationAllowed) runs OUTSIDE the
 * lock — it is pure and benefits no one by serialising. Errors from those
 * (RegistrationPathBlocked) reach the caller without ever taking the lock.
 */
export async function addProject(
  pathArg: string,
  opts: { name?: string; client?: string | null; tags?: string[] } = {},
  filePath: string = REGISTRY_FILE,
  lockOpts: RegistryMutationLockOpts = {},
): Promise<AddResult> {
  const root = canonicaliseRoot(pathArg)
  assertRegistrationAllowed(root)
  return withRegistryLock(
    () => {
      const reg = readRegistry(filePath)
      const existing = reg.projects.find((p) => p.root === root)
      if (existing) return { entry: existing, alreadyRegistered: true }

      const baseSlug = slugify(opts.name ?? basename(root))
      let id = baseSlug
      let n = 2
      while (reg.projects.some((p) => p.id === id)) {
        id = `${baseSlug}-${n}`
        n += 1
      }
      const entry: RegistryEntry = RegistryEntrySchema.parse({
        id,
        name: opts.name ?? basename(root),
        root,
        client: opts.client ?? null,
        addedAt: new Date().toISOString(),
        tags: opts.tags ?? [],
      })
      reg.projects.push(entry)
      writeRegistry(reg, filePath)
      return { entry, alreadyRegistered: false }
    },
    lockOptsFor(filePath, lockOpts),
  )
}

/**
 * Remove a project by id or absolute path. Returns true if removed.
 *
 * Limit: when the registered root no longer exists on disk, canonicaliseRoot
 * falls back to plain resolve() and may not match the realpath we stored at
 * registration time (e.g. /tmp/X stored as /private/tmp/X on macOS). The
 * supported recovery path in that case is removal by id — `unregister <id>`
 * always works even when the filesystem path is gone. Walk-up canonicalisation
 * is a possible future improvement; not blocking the v1 ship.
 */
export async function removeProject(
  idOrPath: string,
  filePath: string = REGISTRY_FILE,
  lockOpts: RegistryMutationLockOpts = {},
): Promise<boolean> {
  // Try both the canonical (realpath-resolved when reachable) AND the plain
  // resolve() form, so the user can remove with the same path string they used
  // at registration even if it later became unreachable.
  const targetCanonical = canonicaliseRoot(idOrPath)
  const targetResolved = resolve(idOrPath)
  return withRegistryLock(
    () => {
      const reg = readRegistry(filePath)
      const before = reg.projects.length
      reg.projects = reg.projects.filter(
        (p) => p.id !== idOrPath && p.root !== targetCanonical && p.root !== targetResolved,
      )
      if (reg.projects.length === before) return false
      writeRegistry(reg, filePath)
      return true
    },
    lockOptsFor(filePath, lockOpts),
  )
}

export async function renameProject(
  id: string,
  newName: string,
  filePath: string = REGISTRY_FILE,
  lockOpts: RegistryMutationLockOpts = {},
): Promise<boolean> {
  return withRegistryLock(
    () => {
      const reg = readRegistry(filePath)
      const entry = reg.projects.find((p) => p.id === id)
      if (!entry) return false
      entry.name = newName
      writeRegistry(reg, filePath)
      return true
    },
    lockOptsFor(filePath, lockOpts),
  )
}

export async function setTags(
  id: string,
  tags: string[],
  filePath: string = REGISTRY_FILE,
  lockOpts: RegistryMutationLockOpts = {},
): Promise<boolean> {
  return withRegistryLock(
    () => {
      const reg = readRegistry(filePath)
      const entry = reg.projects.find((p) => p.id === id)
      if (!entry) return false
      entry.tags = tags
      writeRegistry(reg, filePath)
      return true
    },
    lockOptsFor(filePath, lockOpts),
  )
}

/**
 * Check if a project root is currently reachable on the filesystem.
 */
export function isReachable(root: string): boolean {
  try {
    return statSync(root).isDirectory()
  } catch {
    return false
  }
}

function detectCurrentPhase(root: string): string | null {
  try {
    const phasesDir = resolve(root, '.planning', 'phases')
    if (!existsSync(phasesDir)) return null
    const dirs = readdirSync(phasesDir)
      .filter((d) => /^\d{2}-/.test(d))
      .sort()
    return dirs.at(-1) ?? null
  } catch {
    return null
  }
}

/**
 * Invoke git using execa with an argv array (safe from shell injection).
 * The cwd is the project root, which is user-controlled — passing it as
 * a cwd option rather than a shell argument keeps it safe. (T-01-02-10)
 */
async function detectLastCommitAt(root: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['log', '-1', '--format=%cI'], {
      cwd: root,
      reject: false,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: GIT_SUBPROCESS_TIMEOUT_MS,
    })
    const trimmed = stdout.trim()
    if (!trimmed) return null
    // git's %cI emits ISO-8601 with offset (e.g. 2026-05-04T11:44:11+02:00).
    // Zod's z.string().datetime() requires UTC `Z` form, so normalise here.
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  } catch {
    return null
  }
}

/**
 * Return all registry entries enriched with live reachability + phase + git status.
 * Never throws on unreachable roots — marks reachable: false instead.
 */
export async function listProjectsWithStatus(
  filePath: string = REGISTRY_FILE,
): Promise<RegistryListItem[]> {
  const reg = readRegistry(filePath)
  return Promise.all(
    reg.projects.map(async (p) => {
      const reachable = isReachable(p.root)
      return RegistryListItemSchema.parse({
        ...p,
        status: {
          reachable,
          currentPhase: reachable ? detectCurrentPhase(p.root) : null,
          lastCommitAt: reachable ? await detectLastCommitAt(p.root) : null,
        },
      })
    }),
  )
}
