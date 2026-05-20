/**
 * conformanceQueries.ts — TanStack Query hooks for /api/observability/conformance
 * and /api/admin/registry/fix-path.
 *
 * Plan 12-03 (Wave 3): SPA query bindings for the Phase 12 conformance surface.
 *
 * Design decisions:
 * - staleTime === 30_000ms (Pitfall 11 / D-12-17 — aligned with the daemon's
 *   conformanceCache TTL so SPA polling never outpaces the cache).
 * - refetchOnWindowFocus disabled (daemon cache already handles freshness; the
 *   conformance page is consumed at human cadence, not real-time).
 * - parseOrDrift reused from api.ts (INV-04 — no new schema-drift primitive).
 * - useRegistryFixPath onSuccess invalidates BOTH ['conformance'] AND ['coverage']:
 *   the daemon does the same invalidation server-side (T-12-CACHE-STALE) — the
 *   SPA mirrors so users see the corrected path on next render.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query'
import {
  ConformanceResponseSchema,
  RegistryEntrySchema,
  type ConformanceResponse,
  type RegistryEntry,
  type RegistryFixPathRequest,
} from '@agenticapps/dashboard-shared'

import { apiFetch } from './api.js'

// ── Query key registry ────────────────────────────────────────────────────────

export const CONFORMANCE_QUERY_KEYS = {
  conformance: ['conformance'] as const,
  coverage: ['coverage'] as const,
} as const

// ── Stale-time constant (locked to daemon cache TTL — Pitfall 11) ────────────

/**
 * CONFORMANCE_STALE_TIME_MS — 30 seconds, matching the daemon's
 * conformanceCache TTL (D-12-17). Changing this without also changing the
 * daemon TTL will cause the SPA to issue network requests faster than the
 * cache can serve them (Pitfall 11).
 */
export const CONFORMANCE_STALE_TIME_MS = 30_000

// ── useConformance ────────────────────────────────────────────────────────────

/**
 * useConformance — wraps GET /api/observability/conformance.
 *
 * Returns the full ConformanceResponse (schemaVersion 1, today, delta14d,
 * 90-day series, drifted entries). On schema drift, parseOrDrift surfaces via
 * the existing Phase 2/4 SchemaDriftState mechanism: queryFn throws
 * `Error('schema_drift:<path>')` which bubbles to QueryCache.onError →
 * per-panel <SchemaDriftState> (D-09 pattern).
 *
 * staleTime: 30s (Pitfall 11 — matches daemon cache TTL).
 * refetchOnWindowFocus: false (daemon cache handles freshness).
 */
export function useConformance(): UseQueryResult<ConformanceResponse, Error> {
  return useQuery({
    queryKey: CONFORMANCE_QUERY_KEYS.conformance,
    queryFn: async (): Promise<ConformanceResponse> => {
      const result = await apiFetch('/api/observability/conformance', ConformanceResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    staleTime: CONFORMANCE_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  })
}

// ── useRegistryFixPath ────────────────────────────────────────────────────────

export interface UseRegistryFixPathVariables extends RegistryFixPathRequest {}

/**
 * useRegistryFixPath — wraps POST /api/admin/registry/fix-path.
 *
 * Returns the updated RegistryEntry on success (200). The daemon performs an
 * atomic write to ~/.agenticapps/dashboard/registry.json and invalidates both
 * conformanceCache and coverageCache server-side (T-12-CACHE-STALE). This
 * hook mirrors that invalidation on the SPA query cache so the user sees the
 * corrected path on next render without manual refresh.
 *
 * Errors:
 * - 422 invalid_request / newPath_unresolvable / newPath_blocked /
 *   newPath_outside_family_roots → caller-mapped to a Toast via
 *   errorCodeToMessage (see PathDriftPanel).
 * - 429 rate_limited → caller-mapped to "try again in a few seconds".
 * - 404 project_not_found → caller-mapped to "Project no longer in registry".
 * - 500 schema_drift → bubbled via parseOrDrift.
 */
export function useRegistryFixPath(): UseMutationResult<
  RegistryEntry,
  Error,
  UseRegistryFixPathVariables
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: UseRegistryFixPathVariables): Promise<RegistryEntry> => {
      const result = await apiFetch('/api/admin/registry/fix-path', RegistryEntrySchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    onSuccess: () => {
      // Daemon invalidates both caches server-side (T-12-CACHE-STALE) — mirror
      // on the SPA so the user sees the corrected path on next render.
      void queryClient.invalidateQueries({ queryKey: CONFORMANCE_QUERY_KEYS.conformance })
      void queryClient.invalidateQueries({ queryKey: CONFORMANCE_QUERY_KEYS.coverage })
    },
  })
}
