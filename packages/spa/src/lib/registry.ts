/**
 * registry.ts — SPA data-layer stubs for plan 03-08 (wave 3).
 *
 * Plan 03-06 ships the canonical implementation in its own worktree.
 * These stubs provide enough structure for plan 03-08's components to
 * compile and be tested. The orchestrator will reconcile during the
 * post-wave merge.
 *
 * CONTRACT (kept in sync with 03-06-PLAN.md interfaces section):
 *   useRegistryList, useProjectOverview, useRegisterPrepare,
 *   useRegisterConfirm, useRename, useSetTags, useUnregister,
 *   filterAndSort, computeOverflowChips, SortKey
 */
import {
  type UseQueryResult,
  type UseMutationResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { RegistryListItem, RegistryListResponse } from '@agenticapps/dashboard-shared'
import { RegistryListResponseSchema } from '@agenticapps/dashboard-shared'

import { apiFetch } from './api.js'

// ─── Types exposed publicly ──────────────────────────────────────────────────

export type SortKey = 'recommended' | 'lastCommit' | 'name' | 'phase' | 'client'

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useRegistryList(): UseQueryResult<RegistryListResponse> {
  return useQuery({
    queryKey: ['registry'] as const,
    queryFn: async (): Promise<RegistryListResponse> => {
      const result = await apiFetch('/api/registry', RegistryListResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useProjectOverview(_id: string | null): UseQueryResult<any> {
  return useQuery({
    queryKey: ['overview', _id] as const,
    queryFn: async () => {
      // Stub: plan 03-06 will add ProjectOverviewSchema to shared
      const result = await apiFetch(`/api/projects/${_id}/overview`, RegistryListResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: _id !== null,
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRegisterPrepare(): UseMutationResult<any, Error, { path: string }> {
  return useMutation({
    mutationFn: async (input: { path: string }) => {
      const result = await apiFetch('/api/registry/register-prepare', RegistryListResponseSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRegisterConfirm(): UseMutationResult<any, Error, { nonce: string; name?: string; client?: string | null; tags?: string[] }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { nonce: string; name?: string; client?: string | null; tags?: string[] }) => {
      // Stub: plan 03-06 will use RegisterConfirmResponseSchema (single item).
      // We reuse RegistryListResponseSchema here so the module compiles without the real schema.
      const result = await apiFetch('/api/registry/register-confirm', RegistryListResponseSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result.data as any
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (newEntry: any) => {
      qc.setQueryData<RegistryListResponse>(['registry'], (old) => {
        if (!old) return old
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRename(id: string): UseMutationResult<any, Error, { name: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const result = await apiFetch(`/api/registry/${id}/rename`, RegistryListResponseSchema, {
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
        old?.map((p) => p.id === id ? { ...p, name: input.name } : p),
      )
      return { previous }
    },
    onError: (_err, _input, ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((ctx as any)?.previous) qc.setQueryData(['registry'], (ctx as any).previous)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['registry'] }),
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useSetTags(id: string): UseMutationResult<any, Error, { tags: string[] }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { tags: string[] }) => {
      const result = await apiFetch(`/api/registry/${id}/tags`, RegistryListResponseSchema, {
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
        old?.map((p) => p.id === id ? { ...p, tags: input.tags } : p),
      )
      return { previous }
    },
    onError: (_err, _input, ctx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((ctx as any)?.previous) qc.setQueryData(['registry'], (ctx as any).previous)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['registry'] }),
  })
}

export function useUnregister(id: string): UseMutationResult<void, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { getPairing } = await import('./pairing.js')
      const { ApiError } = await import('./api.js')
      const pairing = getPairing()
      if (!pairing) throw new ApiError(401, undefined, 'unpaired')
      const url = `${pairing.agentUrl.replace(/\/$/, '')}/api/registry/unregister`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pairing.token}` },
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((ctx as any)?.previous) qc.setQueryData(['registry'], (ctx as any).previous)
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ['registry'] }),
  })
}

// ─── Pure functions ───────────────────────────────────────────────────────────

const FIXED_CHIPS = ['all', 'active', 'client', 'internal'] as const
const PRIORITY: Record<string, number> = { active: 0, client: 1, internal: 2 }

function priorityOf(item: RegistryListItem): number {
  let best = 3
  for (const t of item.tags) {
    const p = PRIORITY[t]
    if (p !== undefined && p < best) best = p
  }
  return best
}

export function filterAndSort(
  items: RegistryListItem[],
  params: { selectedChips: Set<string>; searchText: string; sortKey: SortKey },
): RegistryListItem[] {
  const { selectedChips, searchText, sortKey } = params
  const filtered = items.filter((item) => {
    const isAllOrEmpty = selectedChips.size === 0 || selectedChips.has('all')
    if (!isAllOrEmpty) {
      const matchesChip = item.tags.some((t) => selectedChips.has(t))
      if (!matchesChip) return false
    }
    if (searchText) {
      const needle = searchText.toLowerCase()
      const haystack = [
        item.name,
        item.client ?? '',
        item.tags.join(' '),
        item.status.currentPhase ?? '',
      ].join(' ').toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  const cmpUnreachable = (a: RegistryListItem, b: RegistryListItem) => {
    if (a.status.reachable !== b.status.reachable) return a.status.reachable ? -1 : 1
    return 0
  }

  const cmpRecommended = (a: RegistryListItem, b: RegistryListItem) => {
    const u = cmpUnreachable(a, b)
    if (u !== 0) return u
    const pa = priorityOf(a), pb = priorityOf(b)
    if (pa !== pb) return pa - pb
    const ta = a.status.lastCommitAt ?? ''
    const tb = b.status.lastCommitAt ?? ''
    return tb.localeCompare(ta)
  }

  const cmpLastCommit = (a: RegistryListItem, b: RegistryListItem) => {
    const u = cmpUnreachable(a, b)
    if (u !== 0) return u
    const ta = a.status.lastCommitAt ?? ''
    const tb = b.status.lastCommitAt ?? ''
    return tb.localeCompare(ta)
  }

  const cmpName = (a: RegistryListItem, b: RegistryListItem) => {
    const u = cmpUnreachable(a, b)
    if (u !== 0) return u
    return a.name.localeCompare(b.name)
  }

  const cmpPhase = (a: RegistryListItem, b: RegistryListItem) => {
    const u = cmpUnreachable(a, b)
    if (u !== 0) return u
    const pa = a.status.currentPhase ?? ''
    const pb = b.status.currentPhase ?? ''
    return pb.localeCompare(pa)
  }

  const cmpClient = (a: RegistryListItem, b: RegistryListItem) => {
    const u = cmpUnreachable(a, b)
    if (u !== 0) return u
    const ca = a.client ?? ''
    const cb = b.client ?? ''
    return ca.localeCompare(cb)
  }

  const cmp =
    sortKey === 'recommended' ? cmpRecommended
    : sortKey === 'lastCommit' ? cmpLastCommit
    : sortKey === 'name' ? cmpName
    : sortKey === 'phase' ? cmpPhase
    : cmpClient

  return [...filtered].sort(cmp)
}

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
