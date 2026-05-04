/**
 * registry.ts — SPA data layer for Phase 3
 *
 * TanStack Query hooks for all 7 daemon endpoints + filter/sort pure functions.
 * Implements D-01..D-08 (polling, freshness, error surfaces), D-25 (optimistic
 * updates), D-38..D-40 (filter/sort/chip derivation).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  RegistryListResponseSchema,
  ProjectOverviewSchema,
  RegisterPrepareResponseSchema,
  RegisterConfirmResponseSchema,
  RegistryEntrySchema,
  type RegistryListItem,
  type RegistryListResponse,
  type ProjectOverview,
} from '@agenticapps/dashboard-shared'

import { apiFetch, ApiError } from './api.js'

// ── Query hooks ───────────────────────────────────────────────────────────────

/**
 * useRegistryList — polls GET /api/registry every 5s (D-01, D-03).
 * On schema drift, throws so QueryCache.onError can surface the drift panel.
 */
export function useRegistryList() {
  return useQuery({
    queryKey: ['registry'] as const,
    queryFn: async (): Promise<RegistryListResponse> => {
      const result = await apiFetch('/api/registry', RegistryListResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false, // D-03
  })
}

/**
 * useProjectOverview — polls GET /api/projects/{id}/overview every 5s (D-01, D-02, D-03).
 * Enabled only when id is non-null.
 */
export function useProjectOverview(id: string | null) {
  return useQuery({
    queryKey: ['overview', id] as const,
    queryFn: async (): Promise<ProjectOverview> => {
      const result = await apiFetch(`/api/projects/${id}/overview`, ProjectOverviewSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false, // D-03
  })
}

// ── Mutation hooks ────────────────────────────────────────────────────────────

/**
 * useRegisterPrepare — POST /api/registry/register-prepare (D-09..D-11).
 * Caller reads the returned shape to render modal step 2.
 */
export function useRegisterPrepare() {
  return useMutation({
    mutationFn: async (input: { path: string }) => {
      const result = await apiFetch('/api/registry/register-prepare', RegisterPrepareResponseSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
  })
}

/**
 * useRegisterConfirm — POST /api/registry/register-confirm (D-09, D-18, D-25).
 * On 201: optimistically pushes the new entry into ['registry'] cache + invalidates.
 * On 410: throws ApiError(410) so caller can auto re-prepare (D-18).
 */
export function useRegisterConfirm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      nonce: string
      name?: string
      client?: string | null
      tags?: string[]
    }) => {
      const result = await apiFetch('/api/registry/register-confirm', RegisterConfirmResponseSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    onSuccess: (newEntry) => {
      // D-25: optimistic add — push the entry into the cached registry list NOW.
      qc.setQueryData<RegistryListResponse>(['registry'], (old) => {
        if (!old) return old
        // Avoid duplicates if invalidation lands first.
        if (old.some((p) => p.id === newEntry.id)) return old
        const optimistic: RegistryListItem = {
          ...newEntry,
          status: { reachable: true, currentPhase: null, lastCommitAt: null },
        }
        return [...old, optimistic]
      })
      void qc.invalidateQueries({ queryKey: ['registry'] })
    },
  })
}

/**
 * useRename — POST /api/registry/{id}/rename (D-24, D-25).
 * Optimistic: name updated in cache immediately; rolls back on error.
 */
export function useRename(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const result = await apiFetch(`/api/registry/${id}/rename`, RegistryEntrySchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    onMutate: async (input) => {
      // D-25: cancel in-flight refetches, snapshot, update cache optimistically
      await qc.cancelQueries({ queryKey: ['registry'] })
      const previous = qc.getQueryData<RegistryListResponse>(['registry'])
      qc.setQueryData<RegistryListResponse>(['registry'], (old) =>
        old?.map((p) => (p.id === id ? { ...p, name: input.name } : p)),
      )
      return { previous }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(['registry'], ctx.previous)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['registry'] }),
  })
}

/**
 * useSetTags — POST /api/registry/{id}/tags (D-24, D-25).
 * Optimistic: tags updated in cache immediately; rolls back on error.
 */
export function useSetTags(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { tags: string[] }) => {
      const result = await apiFetch(`/api/registry/${id}/tags`, RegistryEntrySchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ['registry'] })
      const previous = qc.getQueryData<RegistryListResponse>(['registry'])
      qc.setQueryData<RegistryListResponse>(['registry'], (old) =>
        old?.map((p) => (p.id === id ? { ...p, tags: input.tags } : p)),
      )
      return { previous }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(['registry'], ctx.previous)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['registry'] }),
  })
}

/**
 * useUnregister — POST /api/registry/unregister (Phase 1, no body schema change).
 * Optimistic: entry removed from cache immediately; rolls back on error.
 * Note: /unregister returns 204 with no body, so we use raw fetch + pairing, not apiFetch.
 */
export function useUnregister(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { getPairing } = await import('./pairing.js')
      const pairing = getPairing()
      if (!pairing) throw new ApiError(401, undefined, 'unpaired')
      const url = `${pairing.agentUrl.replace(/\/$/, '')}/api/registry/unregister`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pairing.token}`,
        },
        body: JSON.stringify({ id }),
      })
      if (res.status === 401) throw new ApiError(401, undefined, 'unauthorized')
      if (!res.ok) throw new ApiError(res.status, undefined, `HTTP ${res.status}`)
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['registry'] })
      const previous = qc.getQueryData<RegistryListResponse>(['registry'])
      qc.setQueryData<RegistryListResponse>(['registry'], (old) => old?.filter((p) => p.id !== id))
      return { previous }
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(['registry'], ctx.previous)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['registry'] }),
  })
}

// ── Filter / sort / chip derivation (pure functions) ─────────────────────────

export type SortKey = 'recommended' | 'lastCommit' | 'name' | 'phase' | 'client'

const FIXED_CHIPS = ['all', 'active', 'client', 'internal'] as const
const TAG_PRIORITY: Record<string, number> = { active: 0, client: 1, internal: 2 }

function tagPriorityOf(item: RegistryListItem): number {
  let best = 3
  for (const t of item.tags) {
    const p = TAG_PRIORITY[t]
    if (p !== undefined && p < best) best = p
  }
  return best
}

/**
 * filterAndSort — pure function combining D-38 (chip OR filter), D-39 (search AND),
 * and D-40 (sort key; unreachable always last).
 */
export function filterAndSort(
  items: RegistryListItem[],
  params: { selectedChips: Set<string>; searchText: string; sortKey: SortKey },
): RegistryListItem[] {
  const { selectedChips, searchText, sortKey } = params

  const filtered = items.filter((item) => {
    // D-38: chip filter — OR semantics; 'all' / empty = no filter
    const isAllOrEmpty = selectedChips.size === 0 || selectedChips.has('all')
    if (!isAllOrEmpty) {
      const matchesChip = item.tags.some((t) => selectedChips.has(t))
      if (!matchesChip) return false
    }
    // D-39: search — case-insensitive substring on name + client + tags + currentPhase
    if (searchText) {
      const needle = searchText.toLowerCase()
      const haystack = [
        item.name,
        item.client ?? '',
        item.tags.join(' '),
        item.status.currentPhase ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  // D-06: unreachable always last within any sort key
  const cmpUnreachable = (a: RegistryListItem, b: RegistryListItem): number => {
    if (a.status.reachable !== b.status.reachable) return a.status.reachable ? -1 : 1
    return 0
  }

  const cmpRecommended = (a: RegistryListItem, b: RegistryListItem): number => {
    const u = cmpUnreachable(a, b)
    if (u !== 0) return u
    const pa = tagPriorityOf(a)
    const pb = tagPriorityOf(b)
    if (pa !== pb) return pa - pb
    const ta = a.status.lastCommitAt ?? ''
    const tb = b.status.lastCommitAt ?? ''
    return tb.localeCompare(ta) // desc
  }

  const cmpLastCommit = (a: RegistryListItem, b: RegistryListItem): number => {
    const u = cmpUnreachable(a, b)
    if (u !== 0) return u
    const ta = a.status.lastCommitAt ?? ''
    const tb = b.status.lastCommitAt ?? ''
    return tb.localeCompare(ta) // desc
  }

  const cmpName = (a: RegistryListItem, b: RegistryListItem): number => {
    const u = cmpUnreachable(a, b)
    if (u !== 0) return u
    return a.name.localeCompare(b.name) // asc
  }

  const cmpPhase = (a: RegistryListItem, b: RegistryListItem): number => {
    const u = cmpUnreachable(a, b)
    if (u !== 0) return u
    const pa = a.status.currentPhase ?? ''
    const pb = b.status.currentPhase ?? ''
    return pb.localeCompare(pa) // desc
  }

  const cmpClient = (a: RegistryListItem, b: RegistryListItem): number => {
    const u = cmpUnreachable(a, b)
    if (u !== 0) return u
    const ca = a.client ?? ''
    const cb = b.client ?? ''
    return ca.localeCompare(cb) // asc
  }

  const cmp =
    sortKey === 'recommended'
      ? cmpRecommended
      : sortKey === 'lastCommit'
        ? cmpLastCommit
        : sortKey === 'name'
          ? cmpName
          : sortKey === 'phase'
            ? cmpPhase
            : cmpClient

  return [...filtered].sort(cmp)
}

/**
 * computeOverflowChips — derives non-fixed tags with occurrence counts (D-38).
 * Fixed chips: 'all', 'active', 'client', 'internal'.
 * Returns sorted alphabetically by tag name.
 */
export function computeOverflowChips(items: RegistryListItem[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const tag of item.tags) {
      if ((FIXED_CHIPS as readonly string[]).includes(tag)) continue
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag))
}
