/**
 * healthQueries.ts — TanStack Query hook for GET /health.
 *
 * Phase 13 Plan 13-03 (Wave 3): SPA query binding for the daemon health endpoint,
 * added to expose `gitnexus.{installed, canScan}` to the coverage panel components.
 *
 * Design decisions:
 * - staleTime: 30_000ms (aligned with coverage query — health changes at human cadence)
 * - refetchOnWindowFocus: false (daemon health is stable; no need for focus-triggered refetch)
 * - The gitnexus field is optional in HealthResponseSchema (backward-compat with older
 *   daemon versions). When absent, defaults: installed=false, canScan=false.
 *
 * Consumed by: CoveragePage → CoverageRow + CoverageFamilySection (gitnexus scan affordances).
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { HealthResponseSchema, type HealthResponse } from '@agenticapps/dashboard-shared'
import { apiFetch } from './api.js'

// ── Query key ─────────────────────────────────────────────────────────────────

export const HEALTH_QUERY_KEYS = {
  health: ['health'] as const,
} as const

// ── Stale-time constant ───────────────────────────────────────────────────────

/**
 * HEALTH_STALE_TIME_MS — 30 seconds, matching the coverage query stale time.
 * Health (including gitnexus.canScan) changes at human cadence (daemon restart,
 * bind mode change), not second-by-second, so 30s polling is sufficient.
 */
export const HEALTH_STALE_TIME_MS = 30_000

// ── useHealth ─────────────────────────────────────────────────────────────────

/**
 * useHealth — wraps GET /health.
 *
 * Returns the HealthResponse. On schema drift, throws `Error('schema_drift:<path>')`
 * which callers can surface via SchemaDriftState if desired. In practice, coverage
 * components treat health.isError as "gitnexus not reachable" and fall back to
 * installed=false, canScan=false defaults.
 *
 * staleTime: 30s (daemon health changes at human cadence).
 * refetchOnWindowFocus: false (stable between focus events).
 */
export function useHealth(): UseQueryResult<HealthResponse, Error> {
  return useQuery({
    queryKey: HEALTH_QUERY_KEYS.health,
    queryFn: async (): Promise<HealthResponse> => {
      const result = await apiFetch('/health', HealthResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    staleTime: HEALTH_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  })
}
