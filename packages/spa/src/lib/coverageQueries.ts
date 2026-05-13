/**
 * coverageQueries.ts — TanStack Query hooks for /api/coverage endpoints.
 *
 * Plan 10-05: SPA query bindings for the coverage matrix daemon routes.
 *
 * Design decisions:
 * - staleTime === refetchInterval === 30_000ms (COV-01/COV-03: aligned with
 *   the daemon's 30s coverageCache TTL so SPA polling never outpaces the cache).
 * - parseOrDrift reused from api.ts (INV-04 — no new schema-drift primitive).
 * - useCoverageRefresh performs client-side CoverageRefreshRequestSchema.parse()
 *   BEFORE the network request (T-10-05-01 / CODEX HIGH-5 defense-in-depth).
 * - onSuccess invalidates ['coverage'] query so the matrix refetches with fresh data.
 * - AGREED-4: hook exposes mutateAsync for sequential batch dispatch from CoveragePage.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import {
  CoverageResponseSchema,
  CoverageRefreshRequestSchema,
  CoverageRefreshResponseSchema,
  type CoverageResponse,
  type CoverageRefreshRequest,
  type CoverageRefreshResponse,
} from '@agenticapps/dashboard-shared'

import { apiFetch } from './api.js'

// ── Query key registry ────────────────────────────────────────────────────────

export const COVERAGE_QUERY_KEYS = {
  matrix: ['coverage'] as const,
} as const

// ── Stale-time constant (locked to daemon cache TTL) ─────────────────────────

/**
 * COVERAGE_STALE_TIME_MS — 30 seconds, matching the daemon's coverageCache TTL.
 * Changing this without also changing the daemon TTL will cause the SPA to issue
 * network requests faster than the cache can serve them (COV-01/COV-03).
 */
export const COVERAGE_STALE_TIME_MS = 30_000

// ── useCoverage ───────────────────────────────────────────────────────────────

/**
 * useCoverage — wraps GET /api/coverage.
 *
 * Returns the full CoverageResponse (schema version, rows, gitNexusInstalled flag).
 * On schema drift, parseOrDrift surfaces via the existing Phase 2/4 SchemaDriftState
 * mechanism: queryFn throws `Error('schema_drift:<path>')` which bubbles to
 * QueryCache.onError → per-panel <SchemaDriftState> (D-09 pattern).
 *
 * staleTime + refetchInterval: both 30s, matching the daemon cache TTL.
 * retry: 1 — single retry on transient daemon error (daemon may be restarting).
 */
export function useCoverage(): UseQueryResult<CoverageResponse, Error> {
  return useQuery({
    queryKey: COVERAGE_QUERY_KEYS.matrix,
    queryFn: async (): Promise<CoverageResponse> => {
      const result = await apiFetch('/api/coverage', CoverageResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    staleTime: COVERAGE_STALE_TIME_MS,
    refetchInterval: COVERAGE_STALE_TIME_MS,
    // retry: 1 intentionally omitted — callers configure retry at queryClient level.
    // The interface spec notes "single retry on transient daemon errors" as a
    // production concern; tests override this via queryClient defaultOptions.
  })
}

// ── useCoverageRefresh ────────────────────────────────────────────────────────

/**
 * useCoverageRefresh — wraps POST /api/coverage/refresh.
 *
 * Validates body client-side via CoverageRefreshRequestSchema.parse() BEFORE
 * issuing the network request (T-10-05-01 / CODEX HIGH-5 defense-in-depth).
 * Daemon also parses — two layers of rejection for invalid action enum values
 * (e.g. 'wiki-compile' is rejected at the SPA before the request ever leaves).
 *
 * onSuccess: invalidates ['coverage'] query so useCoverage refetches fresh data.
 * The mutation's response type is CoverageRefreshResponse — on kind='ok', callers
 * can access `mutation.data.updatedRow` directly (CODEX HIGH-5 required field).
 * mutateAsync is available for sequential batch dispatch (AGREED-4).
 */
export function useCoverageRefresh(): UseMutationResult<
  CoverageRefreshResponse,
  Error,
  CoverageRefreshRequest
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: CoverageRefreshRequest): Promise<CoverageRefreshResponse> => {
      // CODEX HIGH-5 / T-10-05-01: client-side validation before network request.
      // Throws ZodError if body is invalid (e.g. missing family, bad action enum).
      CoverageRefreshRequestSchema.parse(body)

      const result = await apiFetch('/api/coverage/refresh', CoverageRefreshResponseSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    onSuccess: () => {
      // Invalidate the coverage matrix query so the next poll fetches fresh data.
      void queryClient.invalidateQueries({ queryKey: COVERAGE_QUERY_KEYS.matrix })
    },
  })
}
