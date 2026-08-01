import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import {
  FleetResponseSchema,
  ReadResponseSchema,
  RepoDetailResponseSchema,
  type FleetResponse,
  type ReadResponse,
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

/**
 * Read one evidence file through the existing project read route. Nothing new
 * is reachable through this: the route is the one the dashboard has always had,
 * the repo identifier is the registry id the readiness response already carries,
 * and the path is a repo-relative one the daemon itself produced and validated.
 *
 * Deliberately lazy. A detail page renders six blocks, and reading every
 * evidence file on mount would turn one page view into six file reads the
 * reader never asked for — so `enabled` is the disclosure's open state, and a
 * check without evidence never has a path to read.
 */
export function useEvidence(
  repoId: string,
  path: string | null,
  enabled: boolean,
): UseQueryResult<ReadResponse, Error> {
  return useQuery({
    queryKey: ['readiness', 'evidence', repoId, path] as const,
    queryFn: async () => {
      const url = `/api/projects/${encodeURIComponent(repoId)}/read?path=${encodeURIComponent(path ?? '')}`
      const result = await apiFetch(url, ReadResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: enabled && path !== null,
    staleTime: 5_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
