/**
 * Phase 4 SPA query hooks for the per-project detail panels.
 *
 * D-4-02: 5s polling cadence, 5s daemon memo, refetchIntervalInBackground:false
 * (verbatim from Phase 3 D-02/D-03 — established Phase 3 D-02 pattern).
 *
 * Schema drift: each hook calls apiFetch -> parseOrDrift. On drift it throws
 * `Error('schema_drift:<path>')`. The QueryCache.onError handler in
 * lib/queryClient.ts surfaces this as a per-panel <SchemaDriftState> via
 * the QueryBridge wired in main.tsx (Phase 2 D-09 pattern).
 *
 * All 5 hooks include the projectId in the queryKey (cross-project leakage
 * threat-model — query cache keyed by id). T-04-04-01.
 *
 * enabled: id !== null mirrors Phase 3's useProjectOverview. Even though the
 * route always provides a string projectId, this keeps the hook robust if a
 * future caller passes null (e.g. on transient route-mid-transition states).
 */
import { useQuery } from '@tanstack/react-query'
import {
  CommitmentBlockResponseSchema,
  type CommitmentBlockResponse,
  ObservationsRecentResponseSchema,
  type ObservationsRecentResponse,
  DisciplineResponseSchema,
  type DisciplineResponse,
  PhaseProgressResponseSchema,
  type PhaseProgressResponse,
  SecurityResponseSchema,
  type SecurityResponse,
} from '@agenticapps/dashboard-shared'

import { apiFetch } from './api.js'

const POLL_MS = 5_000
const DEFAULT_OBS_LIMIT = 20

/**
 * useCommitment — polls GET /api/projects/{id}/commitment every 5s.
 * Returns the latest `## Workflow commitment` block from skill-observations.
 */
export function useCommitment(id: string | null) {
  return useQuery({
    queryKey: ['commitment', id] as const,
    queryFn: async (): Promise<CommitmentBlockResponse> => {
      const result = await apiFetch(`/api/projects/${id}/commitment`, CommitmentBlockResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  })
}

/**
 * useObservations — polls GET /api/projects/{id}/observations/recent?limit=N every 5s.
 * limit defaults to 20 (D-4-15); included in queryKey so distinct limits don't share cache.
 */
export function useObservations(id: string | null, limit: number = DEFAULT_OBS_LIMIT) {
  return useQuery({
    queryKey: ['observations', id, limit] as const,
    queryFn: async (): Promise<ObservationsRecentResponse> => {
      const result = await apiFetch(
        `/api/projects/${id}/observations/recent?limit=${limit}`,
        ObservationsRecentResponseSchema,
      )
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  })
}

/**
 * useDiscipline — polls GET /api/projects/{id}/discipline every 5s.
 * Returns rationalization fire counts from the agenticapps-workflow SKILL.md.
 */
export function useDiscipline(id: string | null) {
  return useQuery({
    queryKey: ['discipline', id] as const,
    queryFn: async (): Promise<DisciplineResponse> => {
      const result = await apiFetch(`/api/projects/${id}/discipline`, DisciplineResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  })
}

/**
 * usePhaseProgress — polls GET /api/projects/{id}/phase-progress every 5s.
 * Returns the phase checklist, TDD timeline, review status, and verification status.
 */
export function usePhaseProgress(id: string | null) {
  return useQuery({
    queryKey: ['phase-progress', id] as const,
    queryFn: async (): Promise<PhaseProgressResponse> => {
      const result = await apiFetch(`/api/projects/${id}/phase-progress`, PhaseProgressResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  })
}

/**
 * useSecurity — polls GET /api/projects/{id}/security every 5s.
 * Returns the CSO audit summary and DB Sentinel findings.
 */
export function useSecurity(id: string | null) {
  return useQuery({
    queryKey: ['security', id] as const,
    queryFn: async (): Promise<SecurityResponse> => {
      const result = await apiFetch(`/api/projects/${id}/security`, SecurityResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  })
}
