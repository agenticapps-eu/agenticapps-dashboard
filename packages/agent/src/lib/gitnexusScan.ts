/**
 * gitnexusScan.ts — in-memory scan job registry + per-repo lock + global scan-serialisation lock.
 *
 * THREAT MODEL (Plan 13-02):
 * ── T-13-02-01: Argument injection — spawn uses spawnGitNexusAnalyze (execa argv-array form).
 *    Repo path is resolved server-side from the registry — NEVER taken from POST body.
 * ── T-13-02-03: DoS — globalScanLock caps concurrency at 1; perRepoLocks guard same-repo races.
 * ── T-13-02-04: stderr leak — job error.message is mapped from fixed enum, NEVER raw stderr.
 *    spawnGitNexusAnalyze returns stderr in the SpawnResult, but we never propagate it
 *    into the job state or the GET response.
 * ── T-13-02-05: registry.json race — globalScanLock serialises ALL gitnexus subprocess
 *    invocations across all repos/families, preventing the verified gitnexus@1.6.4
 *    read-modify-write race on ~/.gitnexus/registry.json (13-RESEARCH.md §"Pitfall 1").
 *    Per-repo locks alone are insufficient because they only guard same-repo concurrency,
 *    not cross-family registry writes.
 * ── T-13-02-07: ~/.gitnexus/ carve-out — the daemon does NOT write there; the spawned
 *    gitnexus subprocess does. Explicit /cso-acknowledged exception per CLAUDE.md constraint
 *    "Daemon writes confined to ~/.agenticapps/dashboard/". User's home is gitnexus's
 *    legitimate destination by design. T-13-02-05 mitigates the concurrency hazard.
 * ── T-13-02-08: scanId forgery — randomUUID provides 122 bits of entropy + bearer auth required.
 *
 * D-13-EXT-04: Jobs retained 60s after settle so SPA's final poll succeeds.
 */
import { sep } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, realpathSync, statSync } from 'node:fs'

import { spawnGitNexusAnalyze } from './coverageSpawn.js'
import { readRegistry } from './registry.js'
import {
  buildGitnexusIndexClipboardString,
  type GitnexusScanErrorCode,
} from '@agenticapps/dashboard-shared'

// ── Types ─────────────────────────────────────────────────────────────────────

export type RepoScanJob = {
  kind: 'repo'
  scanId: string
  repoId: string
  state: 'running' | 'done' | 'error'
  startedAt: string
  completedAt?: string
  error?: { code: GitnexusScanErrorCode; message: string }
}

export type FamilyScanJob = {
  kind: 'family'
  scanId: string
  familyId: 'agenticapps' | 'factiv' | 'neuroflash'
  state: 'running' | 'done'   // family top-level never 'error' — partial-success per D-13-05
  startedAt: string
  completedAt?: string
  total: number
  completed: number
  failed: number
  currentRepoId: string | null
  currentScanId: string | null
  perRepoResults: Array<{
    repoId: string
    state: 'done' | 'error'
    error?: { code: GitnexusScanErrorCode; message: string }
  }>
}

export type ScanJob = RepoScanJob | FamilyScanJob

// ── Module-level state ────────────────────────────────────────────────────────

/** All active + recently-settled scan jobs (per-repo and family). */
const scans = new Map<string, ScanJob>()

/** Per-repo concurrency gate — keyed by `family/repo` string. D-13-03. */
const perRepoLocks = new Map<string, Promise<void>>()

/** Global single-writer lock — prevents concurrent gitnexus subprocesses from racing
 *  on ~/.gitnexus/registry.json (D-13-EXT-01). Held for the duration of each spawn. */
let globalScanLock: Promise<void> | null = null

/** D-13-EXT-13 (Codex WARNING #5) — Active execa subprocess handles tracked
 *  for shutdown disposal. Populated by _doSpawnAndSettle via the onSubprocess
 *  callback passed to spawnGitNexusAnalyze; entries removed on settle.
 *  disposeAllInflightScans() iterates + SIGTERMs each on daemon shutdown. */
type ExecaResultPromise = ReturnType<typeof import('execa').execa>
const activeChildren = new Set<ExecaResultPromise>()

export function trackInflightScan(sp: ExecaResultPromise): void {
  activeChildren.add(sp)
}

export function untrackInflightScan(sp: ExecaResultPromise): void {
  activeChildren.delete(sp)
}

/**
 * D-13-EXT-16 — Standard onSubprocess factory used by every spawnGitNexusAnalyze
 * caller (scan jobs in _doSpawnAndSettle, coverage refresh in routes/coverage.ts).
 *
 * Tracks the subprocess so disposeAllInflightScans() can SIGTERM it on daemon
 * shutdown, and untracks it on settle.
 *
 * `sp` is awaited TWICE: once inside spawnGitNexusAnalyze (the primary await —
 * its result is mapped to SpawnResult and returned to the caller) and once
 * here via `sp.finally(...)` purely so we can untrack on settle. The tracking-
 * chain is a parallel observer; its `.catch(() => {})` swallows the rejection
 * only to suppress an unhandled-rejection report on the secondary chain. The
 * error is still observed (and surfaced) by the primary await — nothing is lost.
 */
export function makeTrackingOnSubprocess(): (sp: ExecaResultPromise) => void {
  return (sp) => {
    trackInflightScan(sp)
    sp.finally(() => untrackInflightScan(sp)).catch(() => { /* swallowed */ })
  }
}

/**
 * D-13-EXT-13 — Cancel every in-flight gitnexus child process. Called by the
 * shutdown disposer registered in server/boot.ts. SIGTERMs each tracked
 * subprocess; a 2s timer escalates to SIGKILL if the child has not exited.
 * The Set drains synchronously so the disposer completes quickly; the OS
 * reap is async. Escalation timers are .unref()'d so they cannot block
 * gracefulShutdown's exit.
 */
export function disposeAllInflightScans(): void {
  for (const sp of activeChildren) {
    try {
      sp.kill('SIGTERM')
    } catch {
      // best-effort; child may already be dead
    }
    // SIGKILL escalation if SIGTERM is ignored.
    setTimeout(() => {
      try { sp.kill('SIGKILL') } catch { /* best-effort */ }
    }, 2000).unref()
  }
  activeChildren.clear()
}

/** Test-only — expose the active child set. */
export function _activeChildrenForTests(): ReadonlyArray<ExecaResultPromise> {
  return Array.from(activeChildren)
}

/** D-13-EXT-12 (Codex WARNING #3) — Per-family concurrency gate.
 *  Prevents two overlapping family scans for the same family from racing each
 *  other (the loser's per-repo startScan calls would otherwise come back as
 *  permanent SCAN_IN_FLIGHT entries in perRepoResults). Released in
 *  startFamilyScanBody's finally so a thrown body cannot wedge the lock.
 *  Different families remain independent — the global scan lock still
 *  serialises gitnexus subprocesses across families. */
const familyInflight = new Map<'agenticapps' | 'factiv' | 'neuroflash', string>()

export function tryAcquireFamilyLock(
  family: 'agenticapps' | 'factiv' | 'neuroflash',
  scanId: string,
): boolean {
  if (familyInflight.has(family)) return false
  familyInflight.set(family, scanId)
  return true
}

export function releaseFamilyLock(family: 'agenticapps' | 'factiv' | 'neuroflash'): void {
  familyInflight.delete(family)
}

export function familyLockHeldBy(
  family: 'agenticapps' | 'factiv' | 'neuroflash',
): string | null {
  return familyInflight.get(family) ?? null
}

/**
 * Deferred-settle callbacks — registered when startScan fires a spawn,
 * consumed by waitForScanSettle() which needs event-driven notification
 * (not a polling loop) for when the spawn settles.
 */
const settleCallbacks = new Map<string, Array<(job: RepoScanJob) => void>>()

// ── Test seam ─────────────────────────────────────────────────────────────────

/**
 * When set, the spawn in startScan uses this binary path instead of
 * spawnGitNexusAnalyze's PATH lookup. null = pretend binary not found.
 * Only set from integration tests via _setGitnexusBinForTests().
 */
type BinOverride = string | 'not-found' | null  // null = use real PATH lookup
let _gitnexusBinOverride: BinOverride = null  // null = use real lookup

/** Override the gitnexus binary path for integration tests.
 *  Pass 'not-found' to simulate binary absent from PATH.
 *  Pass null to restore real PATH lookup (default). */
export function _setGitnexusBinForTests(bin: string | null): void {
  _gitnexusBinOverride = bin === null ? null : bin
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * D-13-EXT-01 global scan-serialisation lock.
 *
 * Every gitnexus subprocess invocation MUST pass through this wrapper so that
 * at most one `gitnexus analyze` process runs at a time across all repos and
 * all families. The `while` loop (vs a single `await`) handles the case where
 * two callers wake up simultaneously after the holder releases — only one
 * acquires immediately; the other loops back and waits for the next release.
 */
export async function withGlobalScanLock<T>(fn: () => Promise<T>): Promise<T> {
  while (globalScanLock) {
    await globalScanLock
  }
  let release: () => void = () => {}
  globalScanLock = new Promise<void>((r) => {
    release = r
  })
  try {
    return await fn()
  } finally {
    release()
    globalScanLock = null
  }
}

/**
 * Start a per-repo scan (scope:'repo'). Fire-and-forget — returns immediately
 * after registering the job and launching the spawn.
 *
 * Path resolution (D-13-EXT-08 supersedes D-13-EXT-07):
 *   1. Dashboard project registry (uses opts.registryFile override when set).
 *   2. Fallback: ~/Sourcecode/{family}/{repo} if that directory exists on disk.
 *      Coverage discovery is filesystem-driven under ~/Sourcecode/, so this
 *      fallback covers the typical case where a repo is visible in the matrix
 *      but not explicitly `agentic-dashboard register`'d. T-13-02-01 mitigation
 *      is preserved by the schema regex /^[a-z0-9\-]+\/[a-z0-9\-_.]+$/ on
 *      req.target — path traversal is structurally impossible.
 *
 * Returns {ok:false} if:
 *   - repo not in registry AND ~/Sourcecode/{family}/{repo} missing → REPO_NOT_REGISTERED
 *   - per-repo lock held                → SCAN_IN_FLIGHT
 *   - gitnexus binary not on PATH       → BINARY_NOT_FOUND
 */
export async function startScan(
  scanId: string,
  req: { scope: 'repo' | 'family'; target: string },
  opts: { registryFile?: string } = {},
): Promise<
  | { ok: true }
  | { ok: false; code: GitnexusScanErrorCode; message?: string }
> {
  const repoId = req.target // for scope:'repo' this is 'family/repo'

  // (a) Resolve repo root — try registry first, then deterministic filesystem fallback.
  const reg = readRegistry(opts.registryFile)
  const entry = reg.projects.find((p) => derivedRepoId(p.root) === repoId)
  let repoRoot: string | null = entry ? entry.root : null
  if (!repoRoot) {
    const fallback = deterministicRepoRoot(repoId)
    if (fallback !== null) {
      repoRoot = fallback
    }
  }
  if (!repoRoot) {
    return { ok: false, code: 'REPO_NOT_REGISTERED' }
  }

  // (b) Per-repo lock check
  if (perRepoLocks.has(repoId)) {
    return { ok: false, code: 'SCAN_IN_FLIGHT' }
  }

  // (d) Register the job as 'running'
  const job: RepoScanJob = {
    kind: 'repo',
    scanId,
    repoId,
    state: 'running',
    startedAt: new Date().toISOString(),
  }
  scans.set(scanId, job)

  // (e) Fire-and-forget spawn — resolve and kick off without awaiting
  const spawnPromise = _doSpawnAndSettle(scanId, repoId, repoRoot, job)

  // Store the lock keyed by repoId; auto-release when spawn settles
  const lockPromise: Promise<void> = spawnPromise.then(
    () => {},
    () => {},
  )
  perRepoLocks.set(repoId, lockPromise)
  // Also clean up when done
  void spawnPromise.finally(() => {
    perRepoLocks.delete(repoId)
  })

  return { ok: true }
}

/** Retrieve a job by scanId. Returns null if unknown or already evicted. */
export function getScanJob(scanId: string): ScanJob | null {
  return scans.get(scanId) ?? null
}

// ── Family orchestration helpers (consumed by gitnexusFamilyScan.ts) ──────────

/**
 * Inserts a kind:'family' job into the scans Map with initial counters.
 * The scans Map is co-located here so all mutations stay in one module.
 */
export function registerFamilyJob(
  scanId: string,
  familyId: 'agenticapps' | 'factiv' | 'neuroflash',
  repos: ReadonlyArray<{ repo: string; root: string }>,
): void {
  const job: FamilyScanJob = {
    kind: 'family',
    scanId,
    familyId,
    state: 'running',
    startedAt: new Date().toISOString(),
    total: repos.length,
    completed: 0,
    failed: 0,
    currentRepoId: null,
    currentScanId: null,
    perRepoResults: [],
  }
  scans.set(scanId, job)
}

/**
 * Pure-functional mutator: applies mutator(prev) and writes back into the Map.
 * No-ops if scanId is not present (e.g. evicted) or is not a family job.
 */
export function updateFamilyJob(
  scanId: string,
  mutator: (prev: FamilyScanJob) => FamilyScanJob,
): void {
  const existing = scans.get(scanId)
  if (!existing || existing.kind !== 'family') return
  scans.set(scanId, mutator(existing))
}

/**
 * Awaits the child per-repo scan's terminal state and returns the final job.
 * Event-driven — resolves via a deferred promise registered when startScan's
 * fire-and-forget spawn settles. NOT a polling loop.
 */
export function waitForScanSettle(scanId: string): Promise<RepoScanJob> {
  return new Promise<RepoScanJob>((resolve) => {
    // Check if already settled
    const existing = scans.get(scanId)
    if (existing?.kind === 'repo' && existing.state !== 'running') {
      resolve(existing)
      return
    }

    // Register listener for when the spawn settles
    const listeners = settleCallbacks.get(scanId) ?? []
    listeners.push(resolve)
    settleCallbacks.set(scanId, listeners)
  })
}

/**
 * Schedules a 60s TTL eviction for a family job (mirrors per-repo scheduleEviction).
 * Timer is .unref()'d so it does not block daemon shutdown.
 */
export function scheduleFamilyEviction(scanId: string): void {
  setTimeout(() => scans.delete(scanId), 60_000).unref()
}

// ── Test utilities ────────────────────────────────────────────────────────────

/** Reset all module-level state. Called in beforeEach by tests. */
export function _resetForTests(): void {
  scans.clear()
  perRepoLocks.clear()
  familyInflight.clear()
  settleCallbacks.clear()
  activeChildren.clear()
  globalScanLock = null
  _gitnexusBinOverride = null // restore: use real PATH lookup
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Internal: run the spawn and update job state on settle.
 * Called fire-and-forget from startScan.
 */
async function _doSpawnAndSettle(
  scanId: string,
  repoId: string,
  repoAbsPath: string,
  fallbackJob: RepoScanJob,
): Promise<void> {
  let updated: RepoScanJob
  try {
    // D-13-EXT-13 / D-13-EXT-16 — Track the subprocess so
    // disposeAllInflightScans() can SIGTERM it on daemon shutdown.
    // See makeTrackingOnSubprocess() for the dual-await contract.
    const onSubprocess = makeTrackingOnSubprocess()

    const spawnFn =
      _gitnexusBinOverride !== null
        ? () => _spawnWithBinOverride(_gitnexusBinOverride as string, repoAbsPath, onSubprocess)
        : () => spawnGitNexusAnalyze(repoAbsPath, onSubprocess)

    // Wrap in globalScanLock to serialise registry.json writes (D-13-EXT-01 / T-13-02-05)
    const result = await withGlobalScanLock(spawnFn)

    const completedAt = new Date().toISOString()
    const current = scans.get(scanId)
    const base = current?.kind === 'repo' ? current : fallbackJob

    if (result.kind === 'ok') {
      updated = { ...base, state: 'done', completedAt }
    } else if (result.kind === 'not-installed') {
      updated = {
        ...base,
        state: 'error',
        completedAt,
        // T-13-02-04: no raw stderr in message
        error: { code: 'BINARY_NOT_FOUND', message: 'gitnexus binary not found' },
      }
    } else if (result.kind === 'timeout') {
      updated = {
        ...base,
        state: 'error',
        completedAt,
        // T-13-02-04: no raw stderr in message
        error: { code: 'SCAN_TIMEOUT', message: 'Scan timed out after 5 minutes' },
      }
    } else {
      // result.kind === 'error'
      // T-13-02-04: NEVER include raw stderr — map to fixed code only
      updated = {
        ...base,
        state: 'error',
        completedAt,
        error: {
          code: 'SCAN_FAILED',
          message: `gitnexus exited with code ${result.exitCode}`,
        },
      }
    }
  } catch {
    const completedAt = new Date().toISOString()
    const current = scans.get(scanId)
    const base = current?.kind === 'repo' ? current : fallbackJob
    updated = {
      ...base,
      state: 'error',
      completedAt,
      error: { code: 'INTERNAL_ERROR', message: 'Unexpected error during scan' },
    }
  }

  // Update the scans Map BEFORE scheduling eviction and BEFORE notifying listeners
  scans.set(scanId, updated)

  // Notify waitForScanSettle() listeners
  const listeners = settleCallbacks.get(scanId) ?? []
  settleCallbacks.delete(scanId)
  for (const cb of listeners) {
    cb(updated)
  }

  // D-13-EXT-04: evict 60s after settle (timer unref'd so daemon shutdown is not blocked)
  scheduleEviction(scanId)
}

/** TTL eviction: delete job 60s after settle. Timer is unref()'d. */
function scheduleEviction(scanId: string): void {
  setTimeout(() => scans.delete(scanId), 60_000).unref()
}

/**
 * D-13-EXT-08 — Deterministic forward resolver for `family/repo` → absolute path.
 * Inverse of `derivedRepoId`: given a `family/repo` repoId from the SPA, compute
 * the canonical absolute path under ~/Sourcecode/ and return it ONLY if the
 * directory exists on disk. Returns null otherwise.
 *
 * D-13-EXT-09 corollary (Codex CRITICAL #2) — Realpath-guarded.
 *   After existence + directory checks, realpath the candidate and refuse
 *   unless the resolved path equals the candidate OR lives under the family
 *   prefix. A symlink at ~/Sourcecode/agenticapps/evil → /etc would otherwise
 *   pass the directory check and let the daemon spawn gitnexus analyze with
 *   cwd=/etc. Mirrors assertSnapshotDirInDaemonHome (server/boot.ts:98-116).
 *
 * D-13-EXT-11 (Codex CRITICAL #1) — Defence-in-depth dot-segment rejection.
 *   The wire schema already rejects `.`, `..`, and `..` substrings, but the
 *   helper may be called from non-route paths in future. Re-check here so the
 *   safety invariant survives refactoring of the wire layer.
 *
 * Family allow-list is enforced (matches derivedRepoId).
 */
export function deterministicRepoRoot(repoId: string): string | null {
  const slash = repoId.indexOf('/')
  if (slash < 1 || slash === repoId.length - 1) return null
  const family = repoId.slice(0, slash)
  const repo = repoId.slice(slash + 1)
  const knownFamilies = ['agenticapps', 'factiv', 'neuroflash'] as const
  if (!(knownFamilies as readonly string[]).includes(family)) return null
  if (repo.includes('/') || repo.includes(sep)) return null
  // D-13-EXT-11 defence-in-depth
  if (repo === '.' || repo === '..' || repo.includes('..')) return null

  const familyPrefix = `${homedir()}${sep}Sourcecode${sep}${family}${sep}`
  const root = `${familyPrefix}${repo}`
  if (!existsSync(root)) return null
  try {
    if (!statSync(root).isDirectory()) return null
  } catch {
    return null
  }

  // D-13-EXT-09 corollary — symlink-escape defence (Codex CRITICAL #2).
  // Compare in canonical (realpath) form on both sides — macOS aliases
  // /var ↔ /private/var would otherwise produce false negatives when HOME
  // lives under /var/folders/ (mkdtemp default) but realpath returns /private.
  let realCandidate: string
  let realFamilyPrefix: string
  try {
    realCandidate = realpathSync.native(root)
    // realpath does not preserve trailing separator; add one back so the
    // startsWith check correctly enforces the prefix boundary (otherwise
    // /Sourcecode/agenticapps would match /Sourcecode/agenticapps-evil).
    realFamilyPrefix = realpathSync.native(familyPrefix.slice(0, -1)) + sep
  } catch {
    return null
  }
  // Only check startsWith — `realCandidate` is always {familyPrefix}{repo} so
  // it cannot equal the bare family root post-realpath. (Previously this had a
  // defence-in-depth `||` against equality with the family root; removed since
  // the candidate construction never produces that shape.)
  if (!realCandidate.startsWith(realFamilyPrefix)) return null
  return root
}

/**
 * Derive a canonical `family/repo` repoId from an absolute registry root path.
 * Mirrors the Phase 11 familyOf logic — family roots are ~/Sourcecode/{family}/{repo}.
 *
 * Returns null if the path doesn't match the expected ~/Sourcecode/{family}/{repo} shape.
 */
export function derivedRepoId(root: string): string | null {
  const home = homedir()
  const sourcecode = `${home}${sep}Sourcecode${sep}`
  if (!root.startsWith(sourcecode)) return null
  const rel = root.slice(sourcecode.length)
  const parts = rel.split(sep)
  if (parts.length < 2 || !parts[0] || !parts[1]) return null
  const family = parts[0]
  const repo = parts[1]
  const knownFamilies = ['agenticapps', 'factiv', 'neuroflash'] as const
  if (!(knownFamilies as readonly string[]).includes(family)) return null
  return `${family}/${repo}`
}

/**
 * Spawn gitnexus using the test binary override path.
 * Only called when _gitnexusBinOverride is a non-null string.
 */
async function _spawnWithBinOverride(
  binPath: string,
  repoAbsPath: string,
  onSubprocess?: (sp: ExecaResultPromise) => void,
): ReturnType<typeof spawnGitNexusAnalyze> {
  // Use execa directly with the override binary path (T-10-03-02: argv-array form)
  const { execa } = await import('execa')
  const SPAWN_TIMEOUT_MS = 5 * 60 * 1000
  // D-13-10: argv sourced from the shared helper so the test-override spawn
  // path and the production spawn (coverageSpawn.ts) stay in lockstep.
  const sp = execa(binPath, [...buildGitnexusIndexClipboardString().argv], {
    cwd: repoAbsPath,
    timeout: SPAWN_TIMEOUT_MS,
  })
  if (onSubprocess) onSubprocess(sp)
  try {
    const result = await sp
    return { kind: 'ok', stdout: result.stdout }
  } catch (e: unknown) {
    const err = e as { timedOut?: boolean; exitCode?: number; stderr?: string }
    if (err?.timedOut) return { kind: 'timeout' }
    return {
      kind: 'error',
      exitCode: err?.exitCode ?? -1,
      stderr: err?.stderr ?? '',
    }
  }
}
