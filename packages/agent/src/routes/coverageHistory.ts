/**
 * coverageHistory.ts — Hono route exposing GET /api/coverage/history?repoId=...
 *
 * PD-11-02: bulk-per-repo shape. ONE response carries drift for all four cells
 * of the named repo. There is intentionally NO ?cell= query param — the SPA's
 * CoverageRow.tsx owns the single useCoverageHistory(repoId) hook and fans
 * drift props out to its four CoverageCell children.
 *
 * REVIEWS.md action item 3: repoId is validated against the registry +
 * coverage scan output (data-driven), NOT a hardcoded regex. Unknown repoId
 * → 404 repo_not_found. This works for any future ID shape and removes
 * regex-bypass surface.
 *
 * Trust boundary T-11-02-02: even if a traversal string slipped through Zod,
 * `repoId` is only ever used for STRING EQUALITY against in-file NDJSON
 * records — never as a filesystem path. NDJSON filenames are separately
 * regex-validated via `isSnapshotFilename`.
 *
 * Caching: 1h memo keyed by repoId only (PD-11-02 — bulk shape means no
 * per-cell partitioning needed).
 *
 * Security contracts:
 *   - T-10-04-01 / T-11-02-07: bearer-auth inherited from app.ts middleware.
 *     Route handlers never check tokens themselves.
 *   - T-11-02-10: every response wrapped in outbound() so schema drift
 *     surfaces as 500 schema_drift rather than a leaked-shape 200.
 */
import { Hono } from 'hono'
import { z } from 'zod'

import {
  CoverageHistoryResponseSchema,
  type CoverageCellDrift,
} from '@agenticapps/dashboard-shared'

import {
  getCoverageHistoryCached,
  setCoverageHistoryCached,
} from '../lib/coverageHistoryCache.js'
import { scanCoverageInternal } from '../lib/coverageScan.js'
import { readDriftForRepo } from '../lib/snapshots/snapshotReader.js'
import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const coverageHistoryRoute = new Hono<Env>()

/**
 * Query schema — PD-11-02 leaves ONLY repoId. The `cell` param is not
 * accepted; any callers that send it have it silently ignored (the bulk
 * response carries all four cells regardless).
 */
const QuerySchema = z.object({
  repoId: z.string().min(1),
})

/**
 * REVIEWS.md action item 3 — build the set of legal repoIds the daemon will
 * respond for. The set is the UNION of:
 *
 *   (a) `${family}/${repo}` derived from `scanCoverageInternal()` rows — the
 *       canonical shape used by snapshot NDJSON records.
 *   (b) `entry.id` from `readRegistry().projects` — so future registry-id-keyed
 *       lookups continue to work without a schema break.
 *
 * Any repoId outside this set → 404 `repo_not_found`. No regex bypass surface.
 * Both sources are failure-tolerant: if either throws (e.g., registry file
 * missing during a race), the other still populates the set.
 */
async function buildLegalRepoIdSet(): Promise<Set<string>> {
  const ids = new Set<string>()

  try {
    const { response } = await scanCoverageInternal()
    for (const row of response.rows) {
      ids.add(`${row.family}/${row.repo}`)
    }
  } catch {
    // Scanner failure: fall through to registry-only validation. The reader
    // would return empty drift for any repoId not present in NDJSON anyway.
  }

  try {
    const reg = readRegistry()
    for (const p of reg.projects) ids.add(p.id)
  } catch {
    /* registry unreadable is a daemon-wide failure surfaced elsewhere */
  }

  return ids
}

/** The bulk drift shape — matches CoverageHistoryResponseSchema's `cells`. */
type DriftCells = {
  claudeMd: CoverageCellDrift
  gitNexus: CoverageCellDrift
  wiki: CoverageCellDrift
  workflowVersion: CoverageCellDrift
}

coverageHistoryRoute.get('/coverage/history', async (c) => {
  // 1. Validate query — repoId is required, must be non-empty.
  const parsed = QuerySchema.safeParse({ repoId: c.req.query('repoId') })
  if (!parsed.success) {
    return c.json({ ok: false, error: 'invalid_query' }, 400)
  }
  const { repoId } = parsed.data

  // 2. Data-driven existence check (REVIEWS action item 3).
  const legal = await buildLegalRepoIdSet()
  if (!legal.has(repoId)) {
    return c.json({ ok: false, error: 'repo_not_found' }, 404)
  }

  // 3. Cache short-circuit (1h TTL, keyed by repoId only per PD-11-02).
  const cached = getCoverageHistoryCached<DriftCells>(repoId)
  const cells = cached ?? (await readDriftForRepo(repoId))
  if (!cached) setCoverageHistoryCached(repoId, cells)

  // 4. Build response in the bulk-per-repo shape (PD-11-02).
  const response = {
    schemaVersion: 1 as const,
    repoId,
    windowDays: 14 as const,
    cells,
  }

  return outbound(
    c,
    CoverageHistoryResponseSchema.parse.bind(CoverageHistoryResponseSchema),
    response,
  )
})
