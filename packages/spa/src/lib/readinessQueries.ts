import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { z } from 'zod'
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
 * All the open route returns. It answers once the spawn is issued and has
 * nothing to report about the editor, so there is nothing else to parse.
 */
const OpenAcceptedSchema = z.object({ ok: z.literal(true), requestId: z.string() })

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

/**
 * Rescan one repo. The POST deliberately bypasses the daemon's five-second
 * memo, which is the whole reason the button exists — a reader who has just
 * changed something on disk should not have to wait out a cache they cannot
 * see. The fresh detail comes back in the response, so it is written straight
 * into the cache rather than triggering a second round trip, and the fleet is
 * invalidated because this repo's row there is now behind.
 */
export function useRescanRepo(repoId: string): UseMutationResult<RepoDetailResponse, Error, void> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const result = await apiFetch(
        `/api/v2/repos/${encodeURIComponent(repoId)}/rescan`,
        RepoDetailResponseSchema,
        { method: 'POST' },
      )
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(['readiness', 'repo', repoId], fresh)
      void queryClient.invalidateQueries({ queryKey: FLEET_QUERY_KEY })
    },
  })
}

/**
 * Open this repo in the user's editor. No path: the daemon reads
 * `$EDITOR` and spawns it against the registered project root.
 *
 * Nothing is invalidated afterwards. The daemon returns as soon as the spawn is
 * issued and never learns what the editor does, so treating this as a reason to
 * refetch readiness would be inventing a causal link the daemon itself refuses
 * to claim.
 */
export function useOpenInEditor(repoId: string): UseMutationResult<unknown, Error, void> {
  return useMutation({
    mutationFn: async () => {
      const result = await apiFetch(
        `/api/projects/${encodeURIComponent(repoId)}/open`,
        OpenAcceptedSchema,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      )
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
  })
}
