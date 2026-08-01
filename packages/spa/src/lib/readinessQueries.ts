import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  FleetResponseSchema,
  RepoDetailResponseSchema,
  type FleetResponse,
  type RepoDetailResponse,
} from '@agenticapps/dashboard-shared'

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

/**
 * Read one repo's readiness. An unregistered identifier is a 404 answered from
 * the registry alone, so the caller can say "not registered" without the daemon
 * ever having joined the identifier to a path.
 *
 * Not retried: a 404 will not become a 200 by asking again, and the five-second
 * memo means a genuine failure is cheap to retry by hand.
 */
export function useRepoDetail(repoId: string): UseQueryResult<RepoDetailResponse, Error> {
  return useQuery({
    queryKey: ['readiness', 'repo', repoId] as const,
    queryFn: async () => {
      const result = await apiFetch(
        `/api/v2/repos/${encodeURIComponent(repoId)}`,
        RepoDetailResponseSchema,
      )
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    staleTime: 5_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
