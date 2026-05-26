/**
 * gitnexusFamilyScan.ts — sequential family-scan orchestrator.
 *
 * D-13-04: Repos are processed in alphabetical order by repo name.
 * D-13-05: Partial-success semantics — each repo ends with its own final state;
 *   the family job never reports 'error' at the top level.
 * D-13-EXT-01: Sequential processing (for-of, no Promise.all) ensures only ONE
 *   gitnexus subprocess runs at a time within a family; the global scan-serialisation
 *   lock in gitnexusScan.ts handles cross-family serialisation.
 *
 * D-13-02 short-poll contract (Gap 2 closure — Plan 13-06):
 *   `startFamilyScan` is SYNCHRONOUS — it registers the family job into the
 *   scans Map and returns within microseconds. The orchestration loop runs in
 *   the background via `void startFamilyScanBody(...)`. This mirrors the
 *   per-repo `startScan` fire-and-forget pattern at gitnexusScan.ts:154-186.
 *
 *   Previously startFamilyScan was `async` and awaited the entire sequential
 *   per-repo loop before returning — that broke the SPA's polling pipeline:
 *   mutateAsync only resolved after the family job had already reached
 *   state='done', so setScanId(r.scanId) ran too late, useGitnexusScanProgress
 *   never observed 'running', and the terminal effect never fired. See
 *   .planning/debug/family-scan-no-ui-feedback.md for the full diagnosis.
 *
 *   T-13-06-05 (UX regression accepted): The previous return union included
 *   'BINARY_NOT_FOUND' from an up-front resolveGitNexusBin probe. That probe
 *   was synchronous-impossible (resolveGitNexusBin is async). With the sync
 *   handshake, a binary-not-found condition surfaces as N entries of
 *   {code:'BINARY_NOT_FOUND'} in perRepoResults[].error rather than a single
 *   up-front 503. Defence-in-depth: /health.gitnexus.installed is checked by
 *   the SPA at panel-mount and gates the family-scan UI affordance entirely.
 *
 * All shared state mutations (scans Map) go through helpers exported from
 * gitnexusScan.ts — this module does NOT directly touch the Map.
 */
import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, sep } from 'node:path'

import {
  startScan,
  registerFamilyJob,
  updateFamilyJob,
  waitForScanSettle,
  scheduleFamilyEviction,
  deterministicRepoRoot,
} from './gitnexusScan.js'
import type { GitnexusScanErrorCode } from '@agenticapps/dashboard-shared'

// ── Types ─────────────────────────────────────────────────────────────────────

type KnownFamily = 'agenticapps' | 'factiv' | 'neuroflash'

interface RegistryEntry {
  id: string
  root: string
  client: string | null
  [key: string]: unknown
}

interface Registry {
  entries: ReadonlyArray<RegistryEntry>
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Start a family scan — D-13-02 short-poll contract (Gap 2).
 *
 * SYNCHRONOUS handshake: validates the family + registers the family job into
 * the scans Map, then kicks off `startFamilyScanBody(...)` as a fire-and-forget
 * background task and returns immediately. Returns within microseconds.
 *
 * Mirrors the per-repo `startScan` fire-and-forget pattern at gitnexusScan.ts:154-186.
 *
 * Partial-success: failures are recorded in perRepoResults but never cause the
 * family job itself to enter the 'error' state (D-13-05).
 *
 * NOTE: 'BINARY_NOT_FOUND' is intentionally NOT in this return union — the old
 * up-front resolve was synchronous-impossible (resolveGitNexusBin is async).
 * A mid-session binary-not-found surfaces as per-repo BINARY_NOT_FOUND entries
 * in perRepoResults. See T-13-06-05 (accepted with defence-in-depth at
 * /health.gitnexus.installed).
 *
 * @param familyScanId  Pre-generated UUID for the family job
 * @param familyId      One of the three known families
 * @param registry      Object with `entries` array (RegistryFile.projects shape)
 * @param opts          Optional overrides (registryFile for test isolation)
 */
export function startFamilyScan(
  familyScanId: string,
  familyId: KnownFamily,
  _registryDeprecated: { entries: ReadonlyArray<{ id: string; root: string; client: string | null }> } = { entries: [] },
  opts: { registryFile?: string } = {},
): { ok: true } | { ok: false; code: 'FAMILY_HAS_NO_REPOS' } {
  // D-13-EXT-09 (Codex WARNING #1) — source repos from the filesystem, not
  // the registry. The previous registry-driven walk silently skipped
  // unregistered-but-visible repos in the Coverage matrix — the family-level
  // twin of the D-13-EXT-08 defect. _registryDeprecated retained as a
  // positional-compat shim for one release; value ignored.
  //
  // deriveFamilyReposFromFs reads ~/Sourcecode/{family}/ and filters each
  // subdir through the realpath-guarded deterministicRepoRoot() (D-13-EXT-09
  // corollary), preserving D-13-04 alphabetical ordering.
  void _registryDeprecated // suppress unused-arg lint
  const repos = deriveFamilyReposFromFs(familyId)

  if (repos.length === 0) {
    return { ok: false, code: 'FAMILY_HAS_NO_REPOS' }
  }

  // 2. Register the family job with initial counters in the shared scans Map.
  registerFamilyJob(familyScanId, familyId, repos)

  // 3. Fire-and-forget — the body runs the sequential for-of loop + finalization.
  //    Wrapped in `void` + `.catch(...)` so unhandled errors don't leave the
  //    family job stuck in 'running' and don't crash the daemon (T-13-06-01).
  void startFamilyScanBody(familyScanId, familyId, repos, opts).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[gitnexusFamilyScan] unhandled body error', err)
    updateFamilyJob(familyScanId, (s) => ({
      ...s,
      state: 'done' as const,
      completedAt: new Date().toISOString(),
      currentRepoId: null,
      currentScanId: null,
    }))
    scheduleFamilyEviction(familyScanId)
  })

  return { ok: true }
}

/**
 * Fire-and-forget body of a family scan — sequentially iterates all repos
 * (in the pre-sorted order passed by `startFamilyScan`) and awaits each
 * per-repo scan before starting the next. Finalizes the family job to
 * state='done' and schedules 60s TTL eviction (D-13-05 / D-13-EXT-04).
 *
 * NOT to be called directly outside this module — callers should use
 * `startFamilyScan`, which handles the synchronous register + void invocation.
 * Exported for testability + so the route layer can verify the contract.
 */
export async function startFamilyScanBody(
  familyScanId: string,
  familyId: KnownFamily,
  repos: ReadonlyArray<{ repo: string; root: string }>,
  opts: { registryFile?: string } = {},
): Promise<void> {
  // Sequential for-of loop — awaits each per-repo scan before moving to the next.
  // D-13-04: NO Promise.all — parallel execution would race on ~/.gitnexus/registry.json.
  for (const repo of repos) {
    const childScanId = randomUUID()
    const repoId = `${familyId}/${repo.repo}`

    // Update family job: set currentRepoId + currentScanId to the active repo.
    updateFamilyJob(familyScanId, (s) => ({
      ...s,
      currentRepoId: repoId,
      currentScanId: childScanId,
    }))

    // Kick off the per-repo scan (pass registryFile for test isolation).
    const startResult = await startScan(childScanId, { scope: 'repo', target: repoId }, opts)

    if (!startResult.ok) {
      // startScan failed synchronously (REPO_NOT_REGISTERED, SCAN_IN_FLIGHT, etc.)
      const code = startResult.code as GitnexusScanErrorCode
      const message = startResult.message ?? ''
      updateFamilyJob(familyScanId, (s) => ({
        ...s,
        failed: s.failed + 1,
        perRepoResults: [
          ...s.perRepoResults,
          { repoId, state: 'error' as const, error: { code, message } },
        ],
      }))
      continue
    }

    // Wait for the child scan to settle (event-driven, not a polling loop).
    const settled = await waitForScanSettle(childScanId)

    if (settled.state === 'done') {
      updateFamilyJob(familyScanId, (s) => ({
        ...s,
        completed: s.completed + 1,
        perRepoResults: [
          ...s.perRepoResults,
          { repoId, state: 'done' as const },
        ],
      }))
    } else {
      // state === 'error'
      updateFamilyJob(familyScanId, (s) => ({
        ...s,
        failed: s.failed + 1,
        perRepoResults: [
          ...s.perRepoResults,
          {
            repoId,
            state: 'error' as const,
            error: settled.error ?? { code: 'INTERNAL_ERROR' as GitnexusScanErrorCode, message: 'unknown' },
          },
        ],
      }))
    }
  }

  // Freeze family state to 'done' (family never reports 'error' at top-level — D-13-05).
  updateFamilyJob(familyScanId, (s) => ({
    ...s,
    state: 'done' as const,
    completedAt: new Date().toISOString(),
    currentRepoId: null,
    currentScanId: null,
  }))

  // Schedule TTL eviction for the family job (60s — mirrors per-repo eviction).
  scheduleFamilyEviction(familyScanId)
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * D-13-EXT-09 (Codex WARNING #1) — FS-aligned family repo derivation.
 *
 * Reads ~/Sourcecode/{family}/ directly and accepts each subdirectory that
 * passes deterministicRepoRoot() — which after the D-13-EXT-09 corollary
 * enforces family allow-list + directory existence + realpath stay-under-
 * family-prefix. Hidden dirs (".git", ".DS_Store", etc.) are skipped.
 *
 * Used by startFamilyScan instead of the older deriveRepos(registry.entries).
 * A family scan now covers every repo visible in the Coverage matrix, not
 * only the subset that happens to be in the dashboard registry — closing
 * the family-level twin of D-13-EXT-08.
 *
 * Returns alphabetically-sorted repos (preserves D-13-04 ordering).
 */
export function deriveFamilyReposFromFs(
  familyId: KnownFamily,
): Array<{ repo: string; root: string }> {
  const familyRoot = `${homedir()}${sep}Sourcecode${sep}${familyId}`
  if (!existsSync(familyRoot)) return []
  let entries: string[]
  try {
    entries = readdirSync(familyRoot)
  } catch {
    return []
  }
  const result: Array<{ repo: string; root: string }> = []
  for (const name of entries) {
    if (name.startsWith('.')) continue // skip .git, .DS_Store, etc.
    const resolved = deterministicRepoRoot(`${familyId}/${name}`)
    if (resolved !== null) {
      result.push({ repo: name, root: resolved })
    }
  }
  result.sort((a, b) => a.repo.localeCompare(b.repo))
  return result
}

/**
 * Legacy: registry-driven family repo derivation. Kept for one release for
 * grep history; no live callers post-D-13-EXT-09. Will be removed after
 * Plan 13-08 merges.
 *
 * @deprecated use {@link deriveFamilyReposFromFs} instead.
 */
function deriveRepos(
  entries: ReadonlyArray<{ root: string; [key: string]: unknown }>,
  familyId: KnownFamily,
): Array<{ repo: string; root: string }> {
  const home = homedir()
  const familyPrefix = `${home}${sep}Sourcecode${sep}${familyId}${sep}`

  const result: Array<{ repo: string; root: string }> = []
  for (const entry of entries) {
    if (!entry.root.startsWith(familyPrefix)) continue
    const rel = entry.root.slice(familyPrefix.length)
    const parts = rel.split(sep)
    if (parts.length < 1 || !parts[0]) continue
    result.push({ repo: parts[0], root: entry.root })
  }
  return result
}
// Suppress unused-warning while we keep deriveRepos around for one release.
void deriveRepos
