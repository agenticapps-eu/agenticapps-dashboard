/**
 * changesQueries.ts — reading the fleet change board.
 *
 * One query, no mutations: the board is a read of durable repository state and
 * changes nothing. `staleTime` matches the daemon's own five-second memo, so a
 * refetch inside the window would be answered from that memo anyway — a longer
 * client stale time would only add a second layer of staleness the daemon
 * deliberately refused to keep.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import {
  ChangesFleetResponseSchema,
  type ChangesFleetResponse,
} from '@agenticapps/dashboard-shared'

import { apiFetch } from './api.js'
import { SchemaDriftError } from './readinessQueries.js'

export const CHANGES_FLEET_QUERY_KEY = ['changes', 'fleet'] as const

/**
 * The whole board. Degradation is carried inside a 200 rather than thrown: one
 * unreadable repository is a fact about that repository, and turning it into a
 * query error would withhold the other repositories' cards.
 */
export function useChangesFleet(): UseQueryResult<ChangesFleetResponse, Error> {
  return useQuery({
    queryKey: CHANGES_FLEET_QUERY_KEY,
    queryFn: async () => {
      const result = await apiFetch('/api/v2/changes/fleet', ChangesFleetResponseSchema)
      if (!result.ok) throw new SchemaDriftError(result.drift)
      return result.data
    },
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  })
}
