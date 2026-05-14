/**
 * coverageQueries.test.ts — TDD tests for useCoverage + useCoverageRefresh hooks.
 *
 * Plan 10-05: SPA query bindings for /api/coverage and /api/coverage/refresh.
 *
 * Tests cover:
 * - useCoverage: GET /api/coverage queryKey, staleTime, refetchInterval, drift, success
 * - useCoverageRefresh: POST /api/coverage/refresh body shape, onSuccess invalidation,
 *   CODEX HIGH-5 client-side schema pin (missing family, bad action enum, updatedRow access)
 * - COVERAGE_STALE_TIME_MS export locked to 30_000 (COV-01/COV-03)
 * - COVERAGE_QUERY_KEYS.matrix === ['coverage'] (typed const tuple)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ZodError } from 'zod'

import {
  useCoverage,
  useCoverageRefresh,
  COVERAGE_QUERY_KEYS,
  COVERAGE_STALE_TIME_MS,
} from './coverageQueries.js'

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
        // Override retry to false in tests so drift/error paths settle immediately.
        // useCoverage sets retry:1 for production resilience — overriding at wrapper
        // level suppresses that so error-state assertions don't wait for retry delay.
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
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
    json: () => Promise.resolve({ unexpected: 'drift-value', missing: 'required-fields' }),
    clone: () => ({ json: () => Promise.resolve({ unexpected: 'drift' }) }),
  })
}

// ── Valid fixture bodies ──────────────────────────────────────────────────────

const COVERAGE_ROW = {
  family: 'agenticapps',
  repo: 'agenticapps-dashboard',
  claudeMd: { kind: 'basic', state: 'fresh' },
  gitNexus: { kind: 'basic', state: 'stale', daysSince: 7 },
  wiki: { kind: 'basic', state: 'missing' },
  workflowVersion: {
    kind: 'workflow',
    state: 'fresh',
    installedVersion: '1.0.0',
    headVersion: '1.0.0',
    detail: 'equal',
  },
  overrideCount: 0,
  overrides: [],
}

const COVERAGE_RESPONSE_BODY = {
  schemaVersion: 1,
  generatedAtIso: '2026-05-13T12:00:00.000Z',
  gitNexusInstallState: 'installed-with-registry',
  workflowHeadVersion: '1.0.0',
  rows: [COVERAGE_ROW],
}

const REFRESH_OK_BODY = {
  ok: true,
  kind: 'ok',
  updatedRow: COVERAGE_ROW,
}

const REFRESH_FAIL_BODY = {
  ok: false,
  kind: 'not-installed',
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetch.mockReset()
})

afterEach(() => {
  cleanup()
})

// ── COVERAGE_STALE_TIME_MS export ─────────────────────────────────────────────

describe('COVERAGE_STALE_TIME_MS', () => {
  it('COV-01: COVERAGE_STALE_TIME_MS === 30_000 (matches daemon cache TTL)', () => {
    expect(COVERAGE_STALE_TIME_MS).toBe(30_000)
  })
})

// ── COVERAGE_QUERY_KEYS ───────────────────────────────────────────────────────

describe('COVERAGE_QUERY_KEYS', () => {
  it('queryKey matrix is typed const tuple ["coverage"]', () => {
    expect(COVERAGE_QUERY_KEYS.matrix).toEqual(['coverage'])
  })
})

// ── useCoverage ───────────────────────────────────────────────────────────────

describe('useCoverage', () => {
  it('C1: fetches /api/coverage via apiFetch + returns CoverageResponse on success', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(COVERAGE_RESPONSE_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCoverage(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(COVERAGE_RESPONSE_BODY)
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/coverage')
    // Confirm it does NOT hit /api/coverage/refresh
    expect(callUrl).not.toContain('/refresh')

    qc.clear()
  })

  it('C2: staleTime === 30_000ms (COV-01/COV-03 — aligned with daemon 30s cache TTL)', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useCoverage(), { wrapper })

    const cache = qc.getQueryCache()
    const q = cache.getAll().find((q) => JSON.stringify(q.queryKey) === JSON.stringify(['coverage']))
    expect(q).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = q?.options as any
    expect(opts?.staleTime).toBe(30_000)

    qc.clear()
  })

  it('C3: refetchInterval === 30_000 (SPA auto-polls every 30s)', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useCoverage(), { wrapper })

    const cache = qc.getQueryCache()
    const q = cache.getAll().find((q) => JSON.stringify(q.queryKey) === JSON.stringify(['coverage']))
    expect(q).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = q?.options as any
    expect(opts?.refetchInterval).toBe(30_000)

    qc.clear()
  })

  it('C4: queryKey is ["coverage"] (COVERAGE_QUERY_KEYS.matrix as const tuple)', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useCoverage(), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['coverage'])

    qc.clear()
  })

  it('C5: on 200 + schema drift body, hook enters error state with schema_drift: prefix (parseOrDrift)', async () => {
    mockFetch.mockReturnValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCoverage(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/^schema_drift:/)

    qc.clear()
  })
})

// ── useCoverageRefresh ────────────────────────────────────────────────────────

describe('useCoverageRefresh', () => {
  it('R1: POSTs to /api/coverage/refresh with body { family, repo, action: "gitnexus-analyze" }', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(REFRESH_OK_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCoverageRefresh(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        family: 'agenticapps',
        repo: 'agenticapps-dashboard',
        action: 'gitnexus-analyze',
      })
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [callUrl, callInit] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(callUrl).toContain('/api/coverage/refresh')
    expect(callInit.method).toBe('POST')
    const sentBody = JSON.parse(callInit.body as string) as unknown
    expect(sentBody).toEqual({
      family: 'agenticapps',
      repo: 'agenticapps-dashboard',
      action: 'gitnexus-analyze',
    })

    qc.clear()
  })

  it('R2: onSuccess — invalidates useCoverage query key ["coverage"] to trigger refetch', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(REFRESH_OK_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCoverageRefresh(), { wrapper })

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    await act(async () => {
      await result.current.mutateAsync({
        family: 'agenticapps',
        repo: 'agenticapps-dashboard',
        action: 'gitnexus-analyze',
      })
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['coverage'] }),
    )

    qc.clear()
  })

  it('R3: CODEX HIGH-5 — missing family triggers client-side ZodError BEFORE network request', async () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCoverageRefresh(), { wrapper })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({
          // family is intentionally missing
          repo: 'agenticapps-dashboard',
          action: 'gitnexus-analyze',
        } as Parameters<typeof result.current.mutateAsync>[0])
      } catch (err) {
        caught = err
      }
    })

    expect(caught).toBeInstanceOf(ZodError)
    // Network must NOT have been called
    expect(mockFetch).not.toHaveBeenCalled()

    qc.clear()
  })

  it('R4: CODEX HIGH-5 — bad action enum "wiki-compile" triggers client-side ZodError BEFORE network', async () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCoverageRefresh(), { wrapper })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({
          family: 'agenticapps',
          repo: 'agenticapps-dashboard',
          action: 'wiki-compile' as Parameters<typeof result.current.mutateAsync>[0]['action'],
        })
      } catch (err) {
        caught = err
      }
    })

    expect(caught).toBeInstanceOf(ZodError)
    expect(mockFetch).not.toHaveBeenCalled()

    qc.clear()
  })

  it('R5: CODEX HIGH-5 — updatedRow available on mutation.data when daemon returns kind="ok"', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(REFRESH_OK_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCoverageRefresh(), { wrapper })

    let mutationResult: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      mutationResult = await result.current.mutateAsync({
        family: 'agenticapps',
        repo: 'agenticapps-dashboard',
        action: 'gitnexus-analyze',
      })
    })

    // Caller can access updatedRow directly from mutation.data (CODEX HIGH-5)
    expect(mutationResult).toBeDefined()
    expect(mutationResult!.ok).toBe(true)
    if (mutationResult!.ok) {
      expect(mutationResult!.updatedRow).toEqual(COVERAGE_ROW)
      expect(mutationResult!.updatedRow.repo).toBe('agenticapps-dashboard')
    }

    qc.clear()
  })

  it('R6: on 200 + schema drift response, mutation enters error state via parseOrDrift', async () => {
    mockFetch.mockReturnValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCoverageRefresh(), { wrapper })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({
          family: 'agenticapps',
          repo: 'agenticapps-dashboard',
          action: 'gitnexus-analyze',
        })
      } catch (err) {
        caught = err
      }
    })

    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/schema_drift/)

    qc.clear()
  })

  it('R7: not-installed response (ok:false, kind:not-installed) — mutation resolves without throwing', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(REFRESH_FAIL_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCoverageRefresh(), { wrapper })

    let mutationResult: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      mutationResult = await result.current.mutateAsync({
        family: 'agenticapps',
        repo: 'agenticapps-dashboard',
        action: 'gitnexus-analyze',
      })
    })

    expect(mutationResult).toBeDefined()
    expect(mutationResult!.ok).toBe(false)

    qc.clear()
  })
})
