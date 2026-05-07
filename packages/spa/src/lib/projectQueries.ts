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
 *
 * Phase 5 additions (D-5-12, D-5-14, D-5-15):
 *   useGlobalSkills() — singleton, 60s TTL, no projectId in key.
 *   useLocalSkills(id) — per-project, 60s TTL, id in key (cross-project safety T-05-04-Cross-Project-Cache).
 *   useAgentLinter(id) — per-project, 1h TTL, no refetchInterval (manual retry only via refetch()).
 *
 * Phase 5 Plan 05 additions (D-5-17, D-5-18, D-5-19):
 *   useObservability(id) — per-project, 5s polling. T-05-05-Cross-Project-Cache.
 *   useSecrets(id) — per-project, 5s polling. T-05-05-NoSecretRead-SPA (never renders workspaceId).
 *   useIntegrations(id) — per-project, 5s polling. T-05-05-Static-Copy-Trust.
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
  GlobalSkillsResponseSchema,
  type GlobalSkillsResponse,
  LocalSkillsResponseSchema,
  type LocalSkillsResponse,
  AgentLinterResponseSchema,
  type AgentLinterResponse,
  ObservabilityResponseSchema,
  type ObservabilityResponse,
  SecretsResponseSchema,
  type SecretsResponse,
  IntegrationsResponseSchema,
  type IntegrationsResponse,
} from '@agenticapps/dashboard-shared'

import { apiFetch } from './api.js'

const POLL_MS = 5_000
const DEFAULT_OBS_LIMIT = 20
const SKILLS_TTL_MS = 60_000
const AGENTLINTER_TTL_MS = 3_600_000

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

/**
 * useGlobalSkills — polls GET /api/skills/global every 60s.
 * Singleton — no projectId in query key (global skills shared across all projects per D-5-12).
 * Cross-project cache safety: global skills are the same for all projects; per-project skills
 * use useLocalSkills(id) which includes id in the key.
 */
export function useGlobalSkills() {
  return useQuery({
    queryKey: ['skills', 'global'] as const,
    queryFn: async (): Promise<GlobalSkillsResponse> => {
      const result = await apiFetch('/api/skills/global', GlobalSkillsResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    staleTime: SKILLS_TTL_MS,
    refetchInterval: SKILLS_TTL_MS,
    refetchIntervalInBackground: false,
  })
}

/**
 * useLocalSkills — polls GET /api/projects/{id}/skills/local every 60s.
 * Per-project: id included in queryKey to prevent cross-project cache leakage
 * (T-05-04-Cross-Project-Cache).
 */
export function useLocalSkills(id: string | null) {
  return useQuery({
    queryKey: ['skills', 'local', id] as const,
    queryFn: async (): Promise<LocalSkillsResponse> => {
      const result = await apiFetch(`/api/projects/${id}/skills/local`, LocalSkillsResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: SKILLS_TTL_MS,
    refetchInterval: SKILLS_TTL_MS,
    refetchIntervalInBackground: false,
  })
}

/**
 * useAgentLinter — fetches GET /api/projects/{id}/agentlinter once, caches for 1h.
 * D-5-14: staleTime 1h hard ceiling; NO refetchInterval (manual retry only).
 * The SkillHealth panel's Retry button calls apiFetch with ?bypassCache=1 directly,
 * then uses queryClient.setQueryData to update the cache.
 * Per-project: id included in queryKey (T-05-04-Cross-Project-Cache).
 */
export function useAgentLinter(id: string | null) {
  return useQuery({
    queryKey: ['agentlinter', id] as const,
    queryFn: async (): Promise<AgentLinterResponse> => {
      const result = await apiFetch(`/api/projects/${id}/agentlinter`, AgentLinterResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: AGENTLINTER_TTL_MS,
    refetchIntervalInBackground: false,
  })
}

/**
 * useObservability — polls GET /api/projects/{id}/observability every 5s.
 * Returns multi-signal detection state for Sentry, Spotlight, sentry-cli (D-5-17).
 * Per-project: id in queryKey (T-05-05-Cross-Project-Cache).
 */
export function useObservability(id: string | null) {
  return useQuery({
    queryKey: ['observability', id] as const,
    queryFn: async (): Promise<ObservabilityResponse> => {
      const result = await apiFetch(`/api/projects/${id}/observability`, ObservabilityResponseSchema)
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
 * useSecrets — polls GET /api/projects/{id}/secrets every 5s.
 * Returns 3-state Infisical config presence (D-5-18).
 * NEVER renders workspaceId or defaultEnvironment — T-05-05-NoSecretRead-SPA.
 * Per-project: id in queryKey (T-05-05-Cross-Project-Cache).
 */
export function useSecrets(id: string | null) {
  return useQuery({
    queryKey: ['secrets', id] as const,
    queryFn: async (): Promise<SecretsResponse> => {
      const result = await apiFetch(`/api/projects/${id}/secrets`, SecretsResponseSchema)
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
 * useIntegrations — polls GET /api/projects/{id}/integrations every 5s.
 * Returns 3-state per integration (configured / present-but-not-configured / not-detected) (D-5-19).
 * Per-project: id in queryKey (T-05-05-Cross-Project-Cache).
 */
export function useIntegrations(id: string | null) {
  return useQuery({
    queryKey: ['integrations', id] as const,
    queryFn: async (): Promise<IntegrationsResponse> => {
      const result = await apiFetch(`/api/projects/${id}/integrations`, IntegrationsResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  })
}
