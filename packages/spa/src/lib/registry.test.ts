/**
 * registry.test.ts — TDD RED phase for registry.ts SPA lib
 *
 * Tests cover:
 * 1. filterAndSort pure function (7 cases)
 * 2. computeOverflowChips pure function (1 case)
 * 3. useRegisterConfirm onSuccess optimistic add (hook test)
 * 4. useRename onMutate optimistic update (hook test)
 * 5. useUnregister onMutate optimistic remove (hook test)
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { RegistryListItem, RegistryListResponse } from '@agenticapps/dashboard-shared'

// We import the functions under test — these will fail until registry.ts exists
import {
  filterAndSort,
  computeOverflowChips,
  useRegisterConfirm,
  useRename,
  useUnregister,
} from './registry.js'

// Mock api.ts and pairing.ts
vi.mock('./api.js', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly requestId: string | undefined,
      message: string,
    ) {
      super(message)
      this.name = 'ApiError'
    }
  },
}))

vi.mock('./pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'aabbccdd-11223344-aabbccdd-11223344-aabbccdd-11223344-aabbccdd-11223344',
    pairedAt: '2026-01-01T00:00:00.000Z',
  })),
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** A — active, reachable, earlier commit */
const ITEM_A: RegistryListItem = {
  id: 'proj-a',
  name: 'Alpha Project',
  root: '/home/user/alpha',
  client: null,
  addedAt: '2026-01-01T00:00:00.000Z',
  tags: ['active'],
  status: { reachable: true, currentPhase: '03-home', lastCommitAt: '2026-05-04T10:00:00.000Z' },
}

/** B — client, reachable, later commit */
const ITEM_B: RegistryListItem = {
  id: 'proj-b',
  name: 'Beta Project',
  root: '/home/user/beta',
  client: 'acme',
  addedAt: '2026-01-02T00:00:00.000Z',
  tags: ['client'],
  status: { reachable: true, currentPhase: '02-spa', lastCommitAt: '2026-05-04T11:00:00.000Z' },
}

/** C — internal, UNREACHABLE, latest commit (but sorted last due to unreachable) */
const ITEM_C: RegistryListItem = {
  id: 'proj-c',
  name: 'Client Project',
  root: '/home/user/client',
  client: null,
  addedAt: '2026-01-03T00:00:00.000Z',
  tags: ['internal'],
  status: { reachable: false, currentPhase: null, lastCommitAt: '2026-05-04T12:00:00.000Z' },
}

const ALL_ITEMS = [ITEM_A, ITEM_B, ITEM_C]

// ── filterAndSort tests ───────────────────────────────────────────────────────

describe('filterAndSort', () => {
  it('recommended sort: active > client > internal, unreachable always last', () => {
    const result = filterAndSort(ALL_ITEMS, {
      selectedChips: new Set(),
      searchText: '',
      sortKey: 'recommended',
    })
    expect(result.map((x) => x.id)).toEqual(['proj-a', 'proj-b', 'proj-c'])
  })

  it('lastCommit sort: desc by lastCommitAt, unreachable still last', () => {
    const result = filterAndSort(ALL_ITEMS, {
      selectedChips: new Set(),
      searchText: '',
      sortKey: 'lastCommit',
    })
    // B has latest commit (11:00), A has 10:00; C is unreachable → last
    expect(result.map((x) => x.id)).toEqual(['proj-b', 'proj-a', 'proj-c'])
  })

  it('name sort: alphabetical ascending, unreachable last', () => {
    const result = filterAndSort(ALL_ITEMS, {
      selectedChips: new Set(),
      searchText: '',
      sortKey: 'name',
    })
    // Alpha < Beta < Client; C is unreachable so last
    expect(result.map((x) => x.id)).toEqual(['proj-a', 'proj-b', 'proj-c'])
  })

  it('chip filter [active] returns only ITEM_A', () => {
    const result = filterAndSort(ALL_ITEMS, {
      selectedChips: new Set(['active']),
      searchText: '',
      sortKey: 'recommended',
    })
    expect(result.map((x) => x.id)).toEqual(['proj-a'])
  })

  it('search "client" matches ITEM_C by name (contains "Client")', () => {
    const result = filterAndSort(ALL_ITEMS, {
      selectedChips: new Set(),
      searchText: 'client',
      sortKey: 'recommended',
    })
    // "Client Project" matches; "acme" client field on B does not match "client"
    // B has client="acme" — does NOT contain "client"; C has name "Client Project" — matches
    expect(result.map((x) => x.id)).toContain('proj-c')
    // Also matches B because B has tag 'client'
    expect(result.map((x) => x.id)).toContain('proj-b')
    // A does not contain "client" in name/client/tags/phase
    expect(result.map((x) => x.id)).not.toContain('proj-a')
  })

  it('chip [all] returns all 3 items', () => {
    const result = filterAndSort(ALL_ITEMS, {
      selectedChips: new Set(['all']),
      searchText: '',
      sortKey: 'recommended',
    })
    expect(result).toHaveLength(3)
  })

  it('chip [active, client] returns A and B (OR semantics)', () => {
    const result = filterAndSort(ALL_ITEMS, {
      selectedChips: new Set(['active', 'client']),
      searchText: '',
      sortKey: 'recommended',
    })
    expect(result.map((x) => x.id)).toContain('proj-a')
    expect(result.map((x) => x.id)).toContain('proj-b')
    expect(result.map((x) => x.id)).not.toContain('proj-c')
  })
})

// ── computeOverflowChips tests ────────────────────────────────────────────────

describe('computeOverflowChips', () => {
  it('returns overflow tags (non-fixed) sorted alphabetically with counts', () => {
    const items: RegistryListItem[] = [
      { ...ITEM_A, tags: ['active', 'wip'] },
      { ...ITEM_B, tags: ['client', 'archived'] },
      { ...ITEM_C, tags: ['internal'] },
    ]
    const result = computeOverflowChips(items)
    // 'active', 'client', 'internal' are fixed chips → excluded
    // 'wip' appears once, 'archived' appears once
    expect(result).toEqual([
      { tag: 'archived', count: 1 },
      { tag: 'wip', count: 1 },
    ])
  })
})

// ── Mutation hook tests ───────────────────────────────────────────────────────

/** Creates a test QueryClient wrapper with pre-seeded registry data. */
function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

describe('useRegisterConfirm', () => {
  it('onSuccess optimistically adds the new entry to the [registry] cache', async () => {
    const { apiFetch: mockApiFetch } = await import('./api.js')
    const mockedApiFetch = vi.mocked(mockApiFetch)

    const newEntry = {
      id: 'proj-new',
      name: 'New Project',
      root: '/home/user/new',
      client: null,
      addedAt: '2026-05-04T12:00:00.000Z',
      tags: [],
      alreadyRegistered: false,
    }
    mockedApiFetch.mockResolvedValueOnce({ ok: true, data: newEntry })

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    // Pre-seed registry cache with ITEM_A
    qc.setQueryData<RegistryListResponse>(['registry'], [ITEM_A])

    const { result } = renderHook(() => useRegisterConfirm(), { wrapper: makeWrapper(qc) })

    await act(async () => {
      result.current.mutate({ nonce: 'aabbccddeeff00112233445566778899' })
    })

    await waitFor(() => result.current.isSuccess)

    const cache = qc.getQueryData<RegistryListResponse>(['registry'])
    expect(cache?.some((p) => p.id === 'proj-new')).toBe(true)
  })
})

describe('useRename', () => {
  it('onMutate updates name in cache immediately (before fetch resolves)', async () => {
    const { apiFetch: mockApiFetch } = await import('./api.js')
    const mockedApiFetch = vi.mocked(mockApiFetch)

    // Use a never-resolving promise so we can check cache state before fetch completes
    let resolveRename: (v: unknown) => void = () => undefined
    mockedApiFetch.mockReturnValueOnce(
      new Promise((res) => {
        resolveRename = res
      }) as ReturnType<typeof mockedApiFetch>,
    )

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData<RegistryListResponse>(['registry'], [ITEM_A, ITEM_B])

    const { result } = renderHook(() => useRename('proj-a'), { wrapper: makeWrapper(qc) })

    act(() => {
      result.current.mutate({ name: 'Alpha Renamed' })
    })

    // onMutate is synchronous-ish — cache should be updated before the async fetch resolves
    await waitFor(() => {
      const cache = qc.getQueryData<RegistryListResponse>(['registry'])
      return cache?.find((p) => p.id === 'proj-a')?.name === 'Alpha Renamed'
    })

    // Verify optimistic update applied
    const cache = qc.getQueryData<RegistryListResponse>(['registry'])
    expect(cache?.find((p) => p.id === 'proj-a')?.name).toBe('Alpha Renamed')
    // B should be unchanged
    expect(cache?.find((p) => p.id === 'proj-b')?.name).toBe('Beta Project')

    // Clean up: resolve the pending promise
    resolveRename({ ok: true, data: { ...ITEM_A, name: 'Alpha Renamed' } })
  })
})

describe('useUnregister', () => {
  it('onMutate removes the entry from [registry] cache immediately', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    )

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData<RegistryListResponse>(['registry'], [ITEM_A, ITEM_B])

    const { result } = renderHook(() => useUnregister('proj-a'), { wrapper: makeWrapper(qc) })

    act(() => {
      result.current.mutate()
    })

    // onMutate should filter out 'proj-a' immediately
    await waitFor(() => {
      const cache = qc.getQueryData<RegistryListResponse>(['registry'])
      return cache?.every((p) => p.id !== 'proj-a')
    })

    const cache = qc.getQueryData<RegistryListResponse>(['registry'])
    expect(cache?.some((p) => p.id === 'proj-a')).toBe(false)
    expect(cache?.some((p) => p.id === 'proj-b')).toBe(true)

    fetchSpy.mockRestore()
  })
})
