import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { FleetResponseSchema, type FleetResponse } from '@agenticapps/dashboard-shared'

import { apiFetch } from './api.js'

export const FLEET_QUERY_KEY = ['readiness', 'fleet'] as const

/**
 * Read the readiness fleet. The response arrives in registry order and is sorted
 * by the client (design.md §6), so nothing here reorders it.
 *
 * `staleTime` matches the daemon's own five-second memo. Readiness depends on
 * the working tree as well as committed artefacts, which is why that memo is so
 * short — and a refetch inside the window would be answered from it anyway, so
 * a longer client stale time would only add a second layer of staleness the
 * daemon deliberately refused to keep.
 */
export function useFleet(): UseQueryResult<FleetResponse, Error> {
  return useQuery({
    queryKey: FLEET_QUERY_KEY,
    queryFn: async () => {
      const result = await apiFetch('/api/v2/fleet', FleetResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  })
}
