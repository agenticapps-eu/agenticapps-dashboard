/**
 * coverageHistoryQueries.test.ts — TDD tests for the useCoverageHistory hook.
 *
 * Plan 11-04: bulk-per-repo SPA hook against GET /api/coverage/history?repoId=.
 *
 * Per PD-11-02 + REVIEWS.md action item 1 (Option C):
 * - Hook signature is `useCoverageHistory(repoId, opts?)` — NO `cell` parameter.
 * - One response carries drift for ALL FOUR cells of one repo.
 * - QueryKey is `['coverageHistory', repoId]` — TanStack dedup fans out across
 *   sibling mounts with the same repoId.
 *
 * Tests cover:
 *   1.  initial pending state
 *   2.  success path returns all four cells (bulk shape locked)
 *   3.  queryKey is ['coverageHistory', repoId] — no `cell` segment
 *   4.  staleTime === 1h (structural — REVIEWS action item 4)
 *   5.  401 surfaces as isError
 *   6.  Schema drift surfaces as isError with `schema_drift:` prefix
 *   7.  enabled:false → idle, no fetch
 *   8.  Two consecutive renderHook calls with the same repoId → 1 fetch
 *       (TanStack dedup — locks fan-out budget at the hook layer)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useCoverageHistory } from './coverageHistoryQueries.js'

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
    json: () =>
      Promise.resolve({
        // missing schemaVersion / repoId / windowDays / cells -- forces drift
        nope: 'totally-wrong-shape',
      }),
    clone: () => ({ json: () => Promise.resolve({ nope: 'wrong' }) }),
  })
}

function make401Response() {
  return Promise.resolve({
    ok: false,
    status: 401,
    json: () => Promise.resolve({ error: 'unauthorized', requestId: 'req-1' }),
    clone: () => ({
      json: () => Promise.resolve({ error: 'unauthorized', requestId: 'req-1' }),
    }),
  })
}

// ── Valid fixture body ────────────────────────────────────────────────────────

const HISTORY_RESPONSE_BODY = {
  schemaVersion: 1,
  repoId: 'agenticapps/agenticapps-dashboard',
  windowDays: 14,
  cells: {
    claudeMd: { direction: 'up', daysSince: 3 },
    gitNexus: { direction: null, daysSince: null },
    wiki: { direction: 'down', daysSince: 7 },
    workflowVersion: { direction: null, daysSince: null },
  },
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetch.mockReset()
})

afterEach(() => {
  cleanup()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useCoverageHistory', () => {
  it('H1: initial state is pending with data:undefined (before fetch resolves)', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useCoverageHistory('agenticapps/agenticapps-dashboard'),
      { wrapper },
    )

    expect(result.current.data).toBeUndefined()
    expect(result.current.isPending).toBe(true)

    qc.clear()
  })

  it('H2: success — returns CoverageHistoryResponse with all four cells (bulk shape locked)', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(HISTORY_RESPONSE_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useCoverageHistory('agenticapps/agenticapps-dashboard'),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.cells.claudeMd.direction).toBe('up')
    expect(result.current.data?.cells.claudeMd.daysSince).toBe(3)
    expect(result.current.data?.cells.gitNexus).toBeDefined()
    expect(result.current.data?.cells.wiki).toBeDefined()
    expect(result.current.data?.cells.workflowVersion).toBeDefined()
    expect(result.current.data?.windowDays).toBe(14)

    qc.clear()
  })

  it('H3: queryKey is ["coverageHistory", repoId] — no `cell` segment (Option C / PD-11-02)', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(HISTORY_RESPONSE_BODY))

    const { qc, wrapper } = makeWrapper()
    renderHook(() => useCoverageHistory('factiv/cparx'), { wrapper })
    renderHook(() => useCoverageHistory('neuroflash/backend'), { wrapper })

    // Wait for both queries to land in the cache.
    await waitFor(() => {
      const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
      expect(keys).toContainEqual(['coverageHistory', 'factiv/cparx'])
      expect(keys).toContainEqual(['coverageHistory', 'neuroflash/backend'])
    })

    // Verify NO three-segment key with a cell discriminator exists.
    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    for (const key of keys) {
      if (Array.isArray(key) && key[0] === 'coverageHistory') {
        expect(key.length).toBe(2) // ['coverageHistory', repoId]
      }
    }

    qc.clear()
  })

  it('H4: staleTime === 60*60*1000 (1h — REVIEWS action item 4 structural test)', () => {
    mockFetch.mockReturnValue(makeFetchResponse(HISTORY_RESPONSE_BODY))

    const { qc, wrapper } = makeWrapper()
    renderHook(() => useCoverageHistory('agenticapps/agenticapps-dashboard'), { wrapper })

    const cache = qc.getQueryCache()
    const q = cache
      .getAll()
      .find(
        (q) =>
          JSON.stringify(q.queryKey) ===
          JSON.stringify(['coverageHistory', 'agenticapps/agenticapps-dashboard']),
      )
    expect(q).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = q?.options as any
    expect(opts?.staleTime).toBe(60 * 60 * 1000)

    qc.clear()
  })

  it('H5: 401 from daemon surfaces as isError', async () => {
    mockFetch.mockReturnValue(make401Response())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useCoverageHistory('agenticapps/agenticapps-dashboard'),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeDefined()

    qc.clear()
  })

  it('H6: schema-drift response surfaces as isError with `schema_drift:` prefix', async () => {
    mockFetch.mockReturnValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(
      () => useCoverageHistory('agenticapps/agenticapps-dashboard'),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/^schema_drift:/)

    qc.clear()
  })

  it('H7: enabled:false → idle, no fetch', () => {
    mockFetch.mockReturnValue(makeFetchResponse(HISTORY_RESPONSE_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(
      () =>
        useCoverageHistory('agenticapps/agenticapps-dashboard', { enabled: false }),
      { wrapper },
    )

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()

    qc.clear()
  })

  it('H8: TanStack dedup — two sibling mounts with same repoId issue exactly 1 fetch', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(HISTORY_RESPONSE_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result: a } = renderHook(
      () => useCoverageHistory('agenticapps/agenticapps-dashboard'),
      { wrapper },
    )
    const { result: b } = renderHook(
      () => useCoverageHistory('agenticapps/agenticapps-dashboard'),
      { wrapper },
    )

    await waitFor(() => {
      expect(a.current.isSuccess).toBe(true)
      expect(b.current.isSuccess).toBe(true)
    })

    expect(mockFetch).toHaveBeenCalledOnce()

    qc.clear()
  })
})
