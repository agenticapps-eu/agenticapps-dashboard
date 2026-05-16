/**
 * skillDriftQueries.ts — TanStack Query hooks for /api/skills/drift endpoints.
 *
 * Plan 11-05: SPA query bindings for the cross-repo Skill drift daemon routes.
 *
 * Design decisions:
 * - staleTime = 30s (matches Phase 10 cadence; daemon memo is 30s; SPA polling
 *   never outpaces the cache).
 * - refetchInterval = 5s (matches Phase 10; the matrix surface auto-polls so
 *   on-demand AgentLinter mutations land quickly).
 * - queryKey = ['skillDrift', scope] (PD-11-03) — scope is consumed for cache
 *   discrimination only. The daemon endpoint shape does NOT change with scope;
 *   the SPA groups/filters client-side. Distinct scopes produce distinct cache
 *   entries so URL navigation between scopes is cache-aware.
 * - useAgentLinterDrift parses through the SHARED AgentLinterResponseSchema
 *   from @agenticapps/dashboard-shared (REVIEWS #10 — single source of truth
 *   across daemon + SPA; no local schema copy can drift).
 * - Mutation body is EXACTLY { projectId } per D-11-14 — TypeScript prevents
 *   smuggling arrays; the daemon route has .strict() defense-in-depth.
 * - apiFetch is called positionally: apiFetch(path, schema, init?) — verified
 *   at api.ts:61-65; returns Promise<ParseOrDrift<T>>.
 * - onSuccess invalidates the ['skillDrift'] root key so BOTH scope cache
 *   entries refetch (TanStack invalidateQueries matches by prefix).
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  AgentLinterResponseSchema,
  SkillDriftResponseSchema,
  type AgentLinterResponse,
  type SkillDriftResponse,
} from '@agenticapps/dashboard-shared'

import { apiFetch } from './api.js'

// ── Constants ────────────────────────────────────────────────────────────────

/** 30s memo cadence — matches Phase 10 coverage cache + daemon skillDriftCache. */
const SKILL_DRIFT_STALE_TIME_MS = 30 * 1000

/** 5s poll cadence — matches Phase 10 matrix surface. */
const SKILL_DRIFT_REFETCH_INTERVAL_MS = 5_000

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * SkillDriftScope — toolbar scope chip selection (PD-11-03).
 * 'family' (default): matrix rendered as four family sections (per-family).
 * 'cross': matrix rendered as one flat block (cross-family).
 *
 * The daemon endpoint shape does NOT change with scope; the SPA groups/filters
 * client-side. Scope is consumed by the queryKey for cache discrimination only.
 */
export type SkillDriftScope = 'family' | 'cross'

export interface UseSkillDriftOptions {
  scope?: SkillDriftScope
}

// ── useSkillDrift ────────────────────────────────────────────────────────────

/**
 * useSkillDrift — wraps GET /api/skills/drift.
 *
 * Returns the SkillDriftResponse (matrix of skills × projects with presence,
 * version, lastModifiedIso per cell).
 *
 * scope (default 'family'): cache-key discriminator (PD-11-03). The same
 * payload is returned regardless of scope; SPA renders differently.
 *
 * Schema drift surfaces as isError with `schema_drift:<path>` prefix via the
 * parseOrDrift discriminator (INV-04).
 */
export function useSkillDrift(
  opts: UseSkillDriftOptions = {},
): UseQueryResult<SkillDriftResponse, Error> {
  const scope: SkillDriftScope = opts.scope ?? 'family'
  return useQuery<SkillDriftResponse, Error>({
    queryKey: ['skillDrift', scope],
    queryFn: async (): Promise<SkillDriftResponse> => {
      const result = await apiFetch('/api/skills/drift', SkillDriftResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    staleTime: SKILL_DRIFT_STALE_TIME_MS,
    refetchInterval: SKILL_DRIFT_REFETCH_INTERVAL_MS,
  })
}

// ── useAgentLinterDrift ──────────────────────────────────────────────────────

/**
 * UseAgentLinterDriftVariables — mutation input.
 *
 * D-11-14 single-project-per-request: exactly ONE projectId per call.
 * TypeScript prevents arrays at the source; daemon route .strict() rejects
 * extras as a second line of defense.
 */
export interface UseAgentLinterDriftVariables {
  projectId: string
}

/**
 * useAgentLinterDrift — wraps POST /api/skills/drift/agentlinter.
 *
 * Triggers an on-demand AgentLinter run for a single registered project.
 * Reuses the SHARED `AgentLinterResponseSchema` from @agenticapps/dashboard-shared
 * (REVIEWS #10) — same import as daemon-side; no local copy can drift.
 *
 * onSuccess invalidates the ['skillDrift'] root queryKey so BOTH scope cache
 * entries refetch.
 */
export function useAgentLinterDrift(): UseMutationResult<
  AgentLinterResponse,
  Error,
  UseAgentLinterDriftVariables
> {
  const queryClient = useQueryClient()
  return useMutation<AgentLinterResponse, Error, UseAgentLinterDriftVariables>({
    mutationFn: async ({ projectId }): Promise<AgentLinterResponse> => {
      // D-11-14 — body is EXACTLY { projectId }, no extras, no arrays.
      const result = await apiFetch(
        '/api/skills/drift/agentlinter',
        AgentLinterResponseSchema,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        },
      )
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['skillDrift'] })
    },
  })
}
