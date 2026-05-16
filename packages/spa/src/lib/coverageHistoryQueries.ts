/**
 * coverageHistoryQueries.ts — TanStack Query hook for /api/coverage/history.
 *
 * Plan 11-04 (PD-11-02 + REVIEWS.md action item 1, Option C):
 *
 *   useCoverageHistory(repoId)  — wraps GET /api/coverage/history?repoId=
 *
 *   - One request returns drift for ALL FOUR cells of the named repo
 *     (bulk-per-repo shape locked at the wire layer by Plan 11-01's
 *     CoverageHistoryResponseSchema).
 *   - The hook signature INTENTIONALLY drops the `cell` parameter — there is
 *     no per-(repo, cell) endpoint. CoverageRow owns ONE call per row and
 *     fans the four cell drifts out as props to its four CoverageCell
 *     children (single-ownership model, REVIEWS action item 1).
 *
 * Performance budget (REVIEWS action item 2):
 *   ≤ 1 history request per registered repo on first paint of /coverage.
 *   TanStack Query dedup on `['coverageHistory', repoId]` enforces this
 *   structurally — sibling mounts that share a repoId share a single fetch.
 *
 * staleTime is 1 hour to mirror the daemon-side `coverageHistoryCache` TTL.
 * History changes once-per-day at most (daily cron), so a 1h client cache
 * sits comfortably within the data freshness budget.
 *
 * INV-04 (client-side schema check): the response is parsed through
 * `CoverageHistoryResponseSchema` via `apiFetch`'s `parseOrDrift` wrapper.
 * Schema drift surfaces as `Error('schema_drift:<path>')` so callers can
 * surface a degraded-cell or empty-badge fallback without crashing.
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  CoverageHistoryResponseSchema,
  type CoverageHistoryResponse,
} from '@agenticapps/dashboard-shared'

import { apiFetch } from './api.js'

/** Mirrors the daemon-side `coverageHistoryCache` 1h TTL. */
export const COVERAGE_HISTORY_STALE_TIME_MS = 60 * 60 * 1000

export interface UseCoverageHistoryOptions {
  /** Default true — set false when the row has no repoId yet (suspense / placeholder rows). */
  enabled?: boolean
}

export function useCoverageHistory(
  repoId: string,
  opts: UseCoverageHistoryOptions = {},
): UseQueryResult<CoverageHistoryResponse, Error> {
  return useQuery<CoverageHistoryResponse, Error>({
    queryKey: ['coverageHistory', repoId],
    queryFn: async (): Promise<CoverageHistoryResponse> => {
      const result = await apiFetch(
        `/api/coverage/history?repoId=${encodeURIComponent(repoId)}`,
        CoverageHistoryResponseSchema,
      )
      if (!result.ok) {
        throw new Error(`schema_drift:${result.drift.path}`)
      }
      return result.data
    },
    staleTime: COVERAGE_HISTORY_STALE_TIME_MS,
    enabled: opts.enabled ?? true,
  })
}
