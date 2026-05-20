/**
 * conformanceQueries.test.ts — TDD tests for useConformance + useRegistryFixPath hooks.
 *
 * Plan 12-03: SPA query bindings for /api/observability/conformance and
 * /api/admin/registry/fix-path.
 *
 * Tests cover:
 * - useConformance: queryKey ['conformance'], staleTime 30_000 (Pitfall 11 —
 *   matches daemon cache TTL), refetchOnWindowFocus disabled, parseOrDrift
 *   schema-drift defence (INV-04).
 * - useRegistryFixPath: POST body shape { id, newPath }, onSuccess invalidates
 *   both ['conformance'] AND ['coverage'] (daemon cache invalidates both —
 *   mirror invariant), surfaces 422 daemon errors as ApiError.
 * - CONFORMANCE_STALE_TIME_MS export locked to 30_000.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import {
  useConformance,
  useRegistryFixPath,
  CONFORMANCE_STALE_TIME_MS,
} from './conformanceQueries.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'test-token-1234',
    pairedAt: '2026-01-01T00:00:00.000Z',
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
      mutations: { retry: false },
    },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}

function makeFetchResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
  })
}

function makeDriftResponse() {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ unexpected: 'drift-value' }),
    clone: () => ({ json: () => Promise.resolve({ unexpected: 'drift-value' }) }),
  })
}

// ── Valid fixture bodies ──────────────────────────────────────────────────────

const CONFORMANCE_RESPONSE_BODY = {
  schemaVersion: 1 as const,
  today: {
    asOf: '2026-05-20T00:00:00.000Z',
    fleet: 87,
    agenticapps: 92,
    factiv: 84,
    neuroflash: 85,
  },
  delta14d: {
    fleet: 3,
    agenticapps: 5,
    factiv: -1,
    neuroflash: 2,
  },
  series: [
    { date: '2026-02-19', fleet: 80, agenticapps: 85, factiv: 78, neuroflash: 77 },
    { date: '2026-02-20', fleet: 82, agenticapps: 86, factiv: 80, neuroflash: 80 },
  ],
  drifted: [],
}

const REGISTRY_ENTRY_BODY = {
  id: 'agenticapps/agenticapps-dashboard',
  name: 'agenticapps-dashboard',
  root: '/Users/test/Sourcecode/agenticapps/agenticapps-dashboard',
  client: null,
  addedAt: '2026-01-01T00:00:00.000Z',
  tags: [],
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetch.mockReset()
})

afterEach(() => {
  cleanup()
})

// ── CONFORMANCE_STALE_TIME_MS export ──────────────────────────────────────────

describe('CONFORMANCE_STALE_TIME_MS', () => {
  it('CON-01: === 30_000 (matches daemon conformanceCache TTL — Pitfall 11)', () => {
    expect(CONFORMANCE_STALE_TIME_MS).toBe(30_000)
  })
})

// ── useConformance ────────────────────────────────────────────────────────────

describe('useConformance', () => {
  it('C1: fetches /api/observability/conformance and parses the response', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(CONFORMANCE_RESPONSE_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useConformance(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(CONFORMANCE_RESPONSE_BODY)
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/observability/conformance')

    qc.clear()
  })

  it('C2: enters error state with schema_drift: prefix when parseOrDrift fails (INV-04)', async () => {
    mockFetch.mockReturnValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useConformance(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/^schema_drift:/)

    qc.clear()
  })

  it('C3: staleTime === 30_000 (Pitfall 11 — matches daemon cache TTL)', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useConformance(), { wrapper })

    const cache = qc.getQueryCache()
    const q = cache.getAll().find((q) => JSON.stringify(q.queryKey) === JSON.stringify(['conformance']))
    expect(q).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = q?.options as any
    expect(opts?.staleTime).toBe(30_000)

    qc.clear()
  })

  it('C4: refetchOnWindowFocus === false (daemon cache already handles freshness)', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useConformance(), { wrapper })

    const cache = qc.getQueryCache()
    const q = cache.getAll().find((q) => JSON.stringify(q.queryKey) === JSON.stringify(['conformance']))
    expect(q).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = q?.options as any
    expect(opts?.refetchOnWindowFocus).toBe(false)

    qc.clear()
  })

  it('C5: queryKey === ["conformance"]', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useConformance(), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['conformance'])

    qc.clear()
  })
})

// ── useRegistryFixPath ────────────────────────────────────────────────────────

describe('useRegistryFixPath', () => {
  it('M1: POSTs to /api/admin/registry/fix-path with body { id, newPath }', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(REGISTRY_ENTRY_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useRegistryFixPath(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: 'agenticapps/agenticapps-dashboard',
        newPath: '/Users/test/Sourcecode/agenticapps/agenticapps-dashboard',
      })
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [callUrl, callInit] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(callUrl).toContain('/api/admin/registry/fix-path')
    expect(callInit.method).toBe('POST')
    const sentBody = JSON.parse(callInit.body as string) as unknown
    expect(sentBody).toEqual({
      id: 'agenticapps/agenticapps-dashboard',
      newPath: '/Users/test/Sourcecode/agenticapps/agenticapps-dashboard',
    })
    // Content-Type header set
    const headers = new Headers(callInit.headers)
    expect(headers.get('Content-Type')).toBe('application/json')

    qc.clear()
  })

  it('M2: onSuccess invalidates BOTH ["conformance"] AND ["coverage"] queries', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(REGISTRY_ENTRY_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useRegistryFixPath(), { wrapper })

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    await act(async () => {
      await result.current.mutateAsync({
        id: 'agenticapps/agenticapps-dashboard',
        newPath: '/Users/test/Sourcecode/agenticapps/agenticapps-dashboard',
      })
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['conformance'] }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['coverage'] }),
    )

    qc.clear()
  })

  it('M3: surfaces 422 daemon errors as Error to onError handler (ApiError)', async () => {
    mockFetch.mockReturnValue(makeFetchResponse({ error: 'newPath_blocked' }, 422))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useRegistryFixPath(), { wrapper })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({
          id: 'x',
          newPath: '/etc/passwd',
        })
      } catch (err) {
        caught = err
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/HTTP 422/)

    qc.clear()
  })

  it('M4: on 200 + schema-drift response body, mutation enters error state via parseOrDrift', async () => {
    mockFetch.mockReturnValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useRegistryFixPath(), { wrapper })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({
          id: 'x',
          newPath: '/some/path',
        })
      } catch (err) {
        caught = err
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/schema_drift/)

    qc.clear()
  })
})
