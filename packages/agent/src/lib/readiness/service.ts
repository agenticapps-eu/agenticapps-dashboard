/**
 * service.ts — the readiness orchestrator behind the three v2 endpoints.
 *
 * Everything here composes and degrades. `assembleReadiness` already isolates
 * each check, so a broken deriver costs one cell; this layer adds the outer
 * ring, where a repo that cannot be read at all costs six cells and never the
 * rest of the fleet. Nothing it does throws: a fleet response with one visibly
 * broken repo is the product working, and a 500 is not.
 *
 * The cache is deliberately short and deliberately keyed. Five seconds is the
 * ceiling and the fingerprint is the floor, so an edit made a second ago is
 * visible on the next scan. Snapshots live in this module's memory and are
 * never written anywhere: readiness is derived on demand, including the
 * machine-global workflow state, which is context about the host and not this
 * repo's data to persist.
 */
import { homedir } from 'node:os'
import { join, relative, sep } from 'node:path'

import {
  CHECK_IDS,
  computeReady,
  type CheckResult,
  type FleetResponse,
  type RepoDetail,
  type RepoDetailResponse,
  type RepoFamily,
  type RepoSummary,
  type ReadinessNotice,
} from '@agenticapps/dashboard-shared'

import { makeCoverageResolver } from '../coverageResolver.js'
import { getOpenspecBinary } from '../openspecCli.js'
import { readOpenspecProject } from '../openspecReader.js'
import { isReachable, readRegistry } from '../registry.js'
import { defaultMachineRoots } from '../workflowScan.js'

import { assembleReadiness } from './assemble.js'
import { fleetSignature, repoFingerprint } from './fingerprint.js'
import { lastCommitTouching } from './gitFacts.js'
import { remedyFor } from './remedy.js'
import {
  detectHostId,
  type ReadinessHostId,
  type WorkflowSources,
} from './workflowDeriver.js'

/** The spec's ceiling on how long a computed reading may be replayed. */
export const MEMO_TTL_MS = 5_000

const FAMILIES: readonly RepoFamily[] = ['agenticapps', 'factiv', 'neuroflash']

/** Each host's own workflow repo, by directory name under the family root. */
const HOST_REPO_DIRS: Record<ReadinessHostId, string> = {
  claude: 'claude-workflow',
  codex: 'codex-workflow',
  opencode: 'opencode-workflow',
  pi: 'pi-agentic-apps-workflow',
}

export interface ReadinessScanOptions {
  /** Override the registry path (tests). */
  registryFile?: string
  /** Scan time, epoch milliseconds. Defaults to now. */
  now?: number
  /** Override the ~/Sourcecode root (tests). */
  sourcecodeRoot?: string
  /** Override the named machine-global skill roots (tests). */
  machineSkillRoots?: Partial<Record<ReadinessHostId, string>>
}

/**
 * One repo's computed readiness, held in memory only. `generatedAt` is stamped
 * when the snapshot is computed and travels with it, so a replayed reading
 * reports the time it was taken rather than the time it was served.
 */
interface RepoSnapshot {
  generatedAt: number
  fingerprint: string
  id: string
  name: string
  family: RepoFamily
  ready: boolean
  lastCommitAt: number | null
  checks: CheckResult[]
  notice: ReadinessNotice | null
  host: ReadinessHostId | null
}

const cache = new Map<string, RepoSnapshot>()
/** One in-flight computation per repo, so overlapping requests share it. */
/**
 * The `force` of the computation is carried alongside it, because whether a
 * newcomer may join depends on it: a forcing rescan that joins a non-forcing
 * read inherits that read's willingness to replay the cache, and rescans
 * nothing.
 */
interface InFlight {
  promise: Promise<RepoSnapshot>
  force: boolean
}

const inFlight = new Map<string, InFlight>()

export function _resetReadinessCacheForTests(): void {
  cache.clear()
  inFlight.clear()
}

function familyOf(root: string, sourcecodeRoot: string): RepoFamily {
  const rest = relative(sourcecodeRoot, root)
  if (!rest || rest.startsWith('..')) return 'other'
  const head = rest.split(sep)[0] as RepoFamily
  return FAMILIES.includes(head) ? head : 'other'
}

/**
 * Host repos come from the family-roots helper and machine-global skills from
 * the named scanner roots. Neither is ever supplied by a request or by a
 * repo's own readiness file.
 */
function workflowSources(opts: ReadinessScanOptions): WorkflowSources {
  const familyRoot = join(sourcecodeRootOf(opts), 'agenticapps')
  const named = defaultMachineRoots()
  const machineSkillRoots: Partial<Record<ReadinessHostId, string>> = {
    codex: named['codex-skills'],
    opencode: named['opencode-skills'],
    pi: named['pi-skills'],
    ...opts.machineSkillRoots,
  }
  return {
    hostRepos: {
      claude: join(familyRoot, HOST_REPO_DIRS.claude),
      codex: join(familyRoot, HOST_REPO_DIRS.codex),
      opencode: join(familyRoot, HOST_REPO_DIRS.opencode),
      pi: join(familyRoot, HOST_REPO_DIRS.pi),
    },
    machineSkillRoots,
  }
}

function sourcecodeRootOf(opts: ReadinessScanOptions): string {
  return opts.sourcecodeRoot ?? join(homeSourcecode())
}

function homeSourcecode(): string {
  // `process.env.HOME ?? ''` made this `Sourcecode` — a *relative* path — when
  // HOME was unset, so every family root resolved against the process working
  // directory instead. `homedir()` is what workflowScan.ts already uses, and it
  // is defined on Windows, where HOME usually is not.
  return join(homedir(), 'Sourcecode')
}

/** Six identical fails, for a repo whose root cannot be read at all. */
function sixFails(reason: string): CheckResult[] {
  return CHECK_IDS.map((id) => ({
    id,
    status: 'fail' as const,
    source: 'derived' as const,
    at: null,
    value: null,
    threshold: null,
    summary: `This repo could not be read, so no check could be evaluated: ${reason}.`,
    evidence: null,
    error: { code: 'repo-unreadable', message: reason },
  }))
}

async function computeSnapshot(
  entry: { id: string; name: string; root: string },
  fingerprint: string,
  opts: ReadinessScanOptions,
): Promise<RepoSnapshot> {
  const now = opts.now ?? Date.now()
  const base = {
    generatedAt: now,
    fingerprint,
    id: entry.id,
    name: entry.name,
    family: familyOf(entry.root, sourcecodeRootOf(opts)),
    host: null as ReadinessHostId | null,
  }

  if (!isReachable(entry.root)) {
    const checks = sixFails('the registered path is not a reachable directory')
    return { ...base, ready: false, lastCommitAt: null, checks, notice: null }
  }

  try {
    const binary = await getOpenspecBinary()
    const assembled = await assembleReadiness({
      root: entry.root,
      now,
      sources: workflowSources(opts),
      resolve: makeCoverageResolver({ sourcecodeRoot: sourcecodeRootOf(opts) }),
      readProject: (root) => readOpenspecProject(root, binary),
    })
    const head = await lastCommitTouching(entry.root, [])
    return {
      ...base,
      host: detectHostId(entry.root),
      ready: assembled.ready,
      lastCommitAt: head?.at ?? null,
      checks: assembled.checks,
      notice: assembled.notice,
    }
  } catch {
    // The assembler guards each check, so reaching here means the repo itself
    // came apart mid-scan. It degrades like an unreachable one rather than
    // taking the fleet response with it.
    const checks = sixFails('this repo could not be scanned')
    return { ...base, ready: false, lastCommitAt: null, checks, notice: null }
  }
}

/**
 * The snapshot for one repo: replayed while the memo holds, recomputed
 * otherwise, and shared with any computation already in flight for that repo —
 * which is what bounds concurrent rescans to one computation.
 *
 * "That repo" means the root and the fleet inputs, not the registry id alone.
 * An id is a label the registry can repoint; joining on the label handed a
 * caller an answer about the directory the repo used to live in.
 */
function snapshotFor(
  entry: { id: string; name: string; root: string },
  fleet: string,
  opts: ReadinessScanOptions,
  force = false,
): Promise<RepoSnapshot> {
  // Identity is the repo: its registry id and the root behind it. The fleet
  // signature is deliberately NOT part of this key — it already discriminates
  // the *cache* through `repoFingerprint`, and putting it here made an unrelated
  // repo joining the registry hand this repo a fresh key, so the same root was
  // scanned twice concurrently. NUL-separated because it cannot occur in an id
  // or a path, so no two distinct pairs collide onto one key.
  const key = [entry.id, entry.root].join('\0')
  const pending = inFlight.get(key)
  // Join only a computation that is at least as forcing as this request. Two
  // rescans still coalesce, and a read still joins anything; what may not happen
  // is a rescan inheriting a read's permission to replay the cache.
  if (pending && (!force || pending.force)) return pending.promise

  // A forcing request arriving over a non-forcing one waits for it rather than
  // racing it, so the repo is still computed one at a time. The rejection is
  // swallowed because that failure belongs to the read that owns it.
  const start = pending
    ? pending.promise.then(
        () => undefined,
        () => undefined,
      )
    : Promise.resolve()

  // Registered synchronously, before the first await inside resolveSnapshot.
  // Registering after it would let two overlapping rescans both get past this
  // check and compute the same repo twice.
  const computation = start
    .then(() => resolveSnapshot(entry, fleet, opts, force))
    .then((snapshot) => {
      cache.set(entry.id, snapshot)
      return snapshot
    })
    .finally(() => {
      // Only the current owner clears the slot. Without this, the read we
      // chained behind would delete the record this call just installed.
      if (inFlight.get(key) === record) inFlight.delete(key)
    })
  const record: InFlight = { promise: computation, force }
  inFlight.set(key, record)
  return computation
}

async function resolveSnapshot(
  entry: { id: string; name: string; root: string },
  fleet: string,
  opts: ReadinessScanOptions,
  force: boolean,
): Promise<RepoSnapshot> {
  const now = opts.now ?? Date.now()
  const fingerprint = await repoFingerprint(entry.root, fleet)
  const cached = cache.get(entry.id)
  if (
    !force &&
    cached &&
    cached.fingerprint === fingerprint &&
    now - cached.generatedAt < MEMO_TTL_MS
  ) {
    return cached
  }
  return computeSnapshot(entry, fingerprint, opts)
}

function toSummary(snapshot: RepoSnapshot): RepoSummary {
  return {
    id: snapshot.id,
    name: snapshot.name,
    family: snapshot.family,
    ready: computeReady(snapshot.checks),
    lastCommitAt: snapshot.lastCommitAt,
    checks: snapshot.checks as unknown as RepoSummary['checks'],
    notice: snapshot.notice,
  }
}

function toDetail(snapshot: RepoSnapshot): RepoDetail {
  return {
    ...toSummary(snapshot),
    checks: snapshot.checks.map((check) => ({
      ...check,
      remedy: remedyFor(check.id, check.status, snapshot.host),
    })) as unknown as RepoDetail['checks'],
  }
}

function registryEntries(
  opts: ReadinessScanOptions,
): { id: string; name: string; root: string }[] {
  try {
    return readRegistry(opts.registryFile).projects.map((project) => ({
      id: project.id,
      name: project.name,
      root: project.root,
    }))
  } catch {
    return []
  }
}

function signatureFor(
  entries: readonly { id: string; root: string }[],
  opts: ReadinessScanOptions,
): Promise<string> {
  const sources = workflowSources(opts)
  // No cast: `fleetSignature` now takes the Partial shape this actually is. The
  // cast was what let an undefined root through to a `join`.
  return fleetSignature(entries, sources.machineSkillRoots)
}

export async function readFleet(
  opts: ReadinessScanOptions = {},
): Promise<FleetResponse> {
  const entries = registryEntries(opts)
  const fleet = await signatureFor(entries, opts)

  const settled = await Promise.allSettled(
    entries.map((entry) => snapshotFor(entry, fleet, opts)),
  )
  const snapshots = settled.flatMap((result, index) =>
    result.status === 'fulfilled'
      ? [result.value]
      : [unscannable(entries[index]!, opts)],
  )

  // The fleet is only as fresh as its stalest part: dating it by the moment it
  // was served would claim a currency the replayed snapshots do not have.
  const generatedAt = snapshots.length
    ? Math.min(...snapshots.map((snapshot) => snapshot.generatedAt))
    : (opts.now ?? Date.now())

  return { generatedAt, repos: snapshots.map(toSummary) }
}

/** Last resort when even the guarded computation rejected. */
function unscannable(
  entry: { id: string; name: string; root: string },
  opts: ReadinessScanOptions,
): RepoSnapshot {
  return {
    generatedAt: opts.now ?? Date.now(),
    fingerprint: '',
    id: entry.id,
    name: entry.name,
    family: familyOf(entry.root, sourcecodeRootOf(opts)),
    ready: false,
    lastCommitAt: null,
    checks: sixFails('this repo could not be scanned'),
    notice: null,
    host: null,
  }
}

async function detailFor(
  id: string,
  opts: ReadinessScanOptions,
  force: boolean,
): Promise<RepoDetailResponse | null> {
  const entries = registryEntries(opts)
  const entry = entries.find((candidate) => candidate.id === id)
  // An unknown id is answered from the registry alone. No path from the request
  // is resolved, joined, or read.
  if (!entry) return null

  const snapshot = await snapshotFor(
    entry,
    await signatureFor(entries, opts),
    opts,
    force,
  )
  return { generatedAt: snapshot.generatedAt, repo: toDetail(snapshot) }
}

export function readRepo(
  id: string,
  opts: ReadinessScanOptions = {},
): Promise<RepoDetailResponse | null> {
  return detailFor(id, opts, false)
}

export function rescanRepo(
  id: string,
  opts: ReadinessScanOptions = {},
): Promise<RepoDetailResponse | null> {
  return detailFor(id, opts, true)
}
