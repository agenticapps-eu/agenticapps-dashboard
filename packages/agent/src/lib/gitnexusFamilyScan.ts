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
 * All shared state mutations (scans Map) go through helpers exported from
 * gitnexusScan.ts — this module does NOT directly touch the Map.
 */
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { basename, sep } from 'node:path'

import {
  startScan,
  registerFamilyJob,
  updateFamilyJob,
  waitForScanSettle,
  scheduleFamilyEviction,
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
 * Start a family scan — sequentially iterates all repos in the family
 * (alphabetical order by repo name) and awaits each per-repo scan before
 * starting the next. Partial-success: failures are recorded in perRepoResults
 * but never cause the family job itself to enter the 'error' state (D-13-05).
 *
 * @param familyScanId  Pre-generated UUID for the family job
 * @param familyId      One of the three known families
 * @param registry      Object with `entries` array (RegistryFile.projects shape)
 */
export async function startFamilyScan(
  familyScanId: string,
  familyId: KnownFamily,
  registry: { entries: ReadonlyArray<{ id: string; root: string; client: string | null }> },
): Promise<{ ok: true } | { ok: false; code: 'FAMILY_HAS_NO_REPOS' | 'BINARY_NOT_FOUND' }> {
  // 1. Derive repos in this family via path-prefix match (mirrors Phase 11 familyOf)
  //    Sort alphabetically by repo name (D-13-04).
  const repos = deriveRepos(registry.entries, familyId).sort((a, b) =>
    a.repo.localeCompare(b.repo),
  )

  if (repos.length === 0) {
    return { ok: false, code: 'FAMILY_HAS_NO_REPOS' }
  }

  // 2. Register the family job with initial counters in the shared scans Map.
  registerFamilyJob(familyScanId, familyId, repos)

  // 3. Sequential for-of loop — awaits each per-repo scan before moving to the next.
  //    D-13-04: NO Promise.all — parallel execution would race on ~/.gitnexus/registry.json.
  for (const repo of repos) {
    const childScanId = randomUUID()
    const repoId = `${familyId}/${repo.repo}`

    // Update family job: set currentRepoId + currentScanId to the active repo.
    updateFamilyJob(familyScanId, (s) => ({
      ...s,
      currentRepoId: repoId,
      currentScanId: childScanId,
    }))

    // Kick off the per-repo scan.
    const startResult = await startScan(childScanId, { scope: 'repo', target: repoId })

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

  // 4. Freeze family state to 'done' (family never reports 'error' at top-level — D-13-05).
  updateFamilyJob(familyScanId, (s) => ({
    ...s,
    state: 'done' as const,
    completedAt: new Date().toISOString(),
    currentRepoId: null,
    currentScanId: null,
  }))

  // 5. Schedule TTL eviction for the family job (60s — mirrors per-repo eviction).
  scheduleFamilyEviction(familyScanId)

  return { ok: true }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Derive the list of repos belonging to a family from registry entries.
 * Mirrors Phase 11's familyOf path-prefix logic:
 *   family root = ~/Sourcecode/{agenticapps|factiv|neuroflash}
 *   repo name   = basename of the entry's root path
 *
 * Returns an array of { repo: string (basename), root: string (abs path) }.
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
    // Need exactly one path component (the repo name) — not a deeper subdirectory.
    if (parts.length < 1 || !parts[0]) continue
    result.push({ repo: parts[0], root: entry.root })
  }
  return result
}
