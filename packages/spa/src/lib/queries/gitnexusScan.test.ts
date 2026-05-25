/**
 * gitnexusScan.test.ts — behavioural tests for SPA gitnexus scan query hooks.
 *
 * Plan 13-06 (Gap 2 closure): UPGRADED from Wave-3 structural placeholders
 * (`expect(useGitnexusScan).toBeDefined()`) to actual behavioural assertions
 * that mock `fetch` and exercise the undefined → running → done polling
 * pipeline. This file was the gap: the polling/invalidation pipeline was
 * never exercised end-to-end, which is why the family-scan regression
 * (UAT Test 5) escaped to UAT.
 *
 * Two commits per Task 3 TDD-honest split (per plan checker Issue-6):
 *   1. RED — mock returns 'running' forever; terminal-state assertions FAIL.
 *   2. GREEN — mock sequenced as {running, running, done}; assertions PASS.
 *
 * Test inventory (7 cases — all behavioural):
 *   useGitnexusScan() — POST mutation
 *     1. mutates POST /api/gitnexus/scan and returns scanId on success
 *     2. throws Error with .code property on ok:false response
 *   useGitnexusScanProgress(scanId) — GET /api/gitnexus/scan/:id polling
 *     3. polls every 1500ms while state='running' (D-13-02)
 *     4. stops polling when state='done' (RED until GREEN flips mock)
 *     5. stops polling when state='error'
 *     6. is disabled (no fetch issued) when scanId is null
 *     7. consumer effect: qc.invalidateQueries(['coverage']) AND
 *        ['conformance'] fire on running→done transition (RED until GREEN)
 *
 * TanStack Query test harness mirrors conformanceQueries.test.ts:
 *   makeWrapper() → QueryClientProvider wrapping renderHook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { useGitnexusScan, useGitnexusScanProgress } from './gitnexusScan.js'

// ── Test harness (mirrors conformanceQueries.test.ts makeWrapper pattern) ────

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

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('../pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'test-token-1234',
    pairedAt: '2026-01-01T00:00:00.000Z',
  })),
}))

// ── Fetch + job factories (mirrors conformanceQueries.test.ts makeFetchResponse) ──

function makeFetchResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
  })
}

function runningJob(scanId: string) {
  return {
    ok: true,
    job: {
      kind: 'repo',
      scanId,
      repoId: 'agenticapps/foo',
      state: 'running',
      startedAt: new Date().toISOString(),
    },
  }
}

function doneJob(scanId: string) {
  return {
    ok: true,
    job: {
      kind: 'repo',
      scanId,
      repoId: 'agenticapps/foo',
      state: 'done',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
  }
}

function errorJob(scanId: string) {
  return {
    ok: true,
    job: {
      kind: 'repo',
      scanId,
      repoId: 'agenticapps/foo',
      state: 'error',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: { code: 'SCAN_FAILED', message: 'gitnexus exited with code 1' },
    },
  }
}

// ── useGitnexusScan() — POST mutation ────────────────────────────────────────

describe('useGitnexusScan() — POST /api/gitnexus/scan mutation', () => {
  beforeEach(() => mockFetch.mockReset())

  it('mutates POST /api/gitnexus/scan and returns scanId on success', async () => {
    const fakeScanId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    mockFetch.mockReturnValueOnce(makeFetchResponse({ ok: true, scanId: fakeScanId }))

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGitnexusScan(), { wrapper })

    const r = await result.current.mutateAsync({ scope: 'repo', target: 'agenticapps/foo' })
    expect(r.scanId).toBe(fakeScanId)
    expect(mockFetch).toHaveBeenCalledOnce()
    expect(mockFetch.mock.calls[0]?.[0]).toMatch(/\/api\/gitnexus\/scan$/)
  })

  it('throws an Error with .code property on ok:false response', async () => {
    mockFetch.mockReturnValueOnce(
      makeFetchResponse({ ok: false, error: 'REPO_NOT_REGISTERED', requestId: 'r-1' }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGitnexusScan(), { wrapper })
    await expect(
      result.current.mutateAsync({ scope: 'repo', target: 'agenticapps/missing' }),
    ).rejects.toMatchObject({ code: 'REPO_NOT_REGISTERED' })
  })
})

// ── useGitnexusScanProgress(scanId) — polling ────────────────────────────────

describe('useGitnexusScanProgress(scanId) — GET /api/gitnexus/scan/:id polling', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    // `shouldAdvanceTime: true` lets `waitFor`'s internal setTimeout fire so
    // the testing-library polling layer can observe state transitions while
    // we still drive query refetch intervals via `vi.advanceTimersByTimeAsync`.
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  it("polls every 1500ms while state='running' (D-13-02)", async () => {
    const scanId = '11111111-2222-3333-4444-555555555555'
    // RED commit: mock returns 'running' on EVERY call — no terminal transition.
    // The polling-cadence assertion (>= 2 calls after 1500ms) is satisfied even
    // by this mock, so this test PASSES in RED. The terminal-transition test below
    // is the one that FAILS in RED.
    mockFetch.mockReturnValue(makeFetchResponse(runningJob(scanId)))

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGitnexusScanProgress(scanId), { wrapper })

    expect(result.current.data).toBeUndefined()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    await waitFor(() => {
      expect(result.current.data?.state).toBe('running')
    })

    const callsAfterFirst = mockFetch.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    await waitFor(() =>
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callsAfterFirst),
    )
  })

  it("stops polling when state='done' (RED: this MUST FAIL until GREEN flips mock to {running, running, done})", async () => {
    const scanId = '99999999-aaaa-bbbb-cccc-dddddddddddd'
    // RED commit: mock returns 'running' forever. The transition to 'done' never
    // happens, so the assertion below FAILS. GREEN commit will flip this to
    // {running, running, done} so the transition fires.
    mockFetch.mockReturnValue(makeFetchResponse(runningJob(scanId)))

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGitnexusScanProgress(scanId), { wrapper })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    // ← RED: this assertion fails because mock never transitions to 'done'.
    //   GREEN commit will change `mockReturnValue(running)` to
    //   `mockReturnValueOnce(running).mockReturnValueOnce(running).mockReturnValueOnce(done)`.
    await waitFor(() => expect(result.current.data?.state).toBe('done'), {
      timeout: 1000,
    })

    // After 'done', no further fetches should fire (polling halts on terminal state).
    const callCountAtDone = mockFetch.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })
    expect(mockFetch.mock.calls.length).toBe(callCountAtDone)
  })

  it("stops polling when state='error'", async () => {
    const scanId = '22222222-3333-4444-5555-666666666666'
    mockFetch.mockReturnValue(makeFetchResponse(errorJob(scanId)))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGitnexusScanProgress(scanId), { wrapper })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    await waitFor(() => expect(result.current.data?.state).toBe('error'))

    const callCountAtError = mockFetch.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(mockFetch.mock.calls.length).toBe(callCountAtError)
  })

  it('is disabled (no fetch issued) when scanId is null', async () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useGitnexusScanProgress(null), { wrapper })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("consumer effect (ScanPill-style): qc.invalidateQueries(['coverage']) AND ['conformance'] fire on running→done transition (RED: FAILS until GREEN flip)", async () => {
    const scanId = '33333333-4444-5555-6666-777777777777'
    // RED commit: mock returns 'running' forever — no transition, so the
    // ConsumerEffect never invokes invalidateQueries. The assertion FAILS.
    // GREEN commit flips to {running, done} sequence.
    mockFetch.mockReturnValue(makeFetchResponse(runningJob(scanId)))

    const { qc, wrapper } = makeWrapper()
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    function ConsumerEffect({ scanId }: { scanId: string | null }) {
      const progress = useGitnexusScanProgress(scanId)
      React.useEffect(() => {
        if (!progress.data) return
        if (progress.data.state === 'running') return
        void qc.invalidateQueries({ queryKey: ['coverage'] })
        void qc.invalidateQueries({ queryKey: ['conformance'] })
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [progress.data?.state])
      return null
    }

    renderHook(() => ConsumerEffect({ scanId }), { wrapper })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500)
    })

    // ← RED: this assertion fails because the mock never transitions out of 'running'.
    //   GREEN commit will sequence the mock so a 'done' frame arrives and the effect fires.
    await waitFor(
      () => {
        const coverageCalls = invalidateSpy.mock.calls.filter(
          (c) =>
            Array.isArray((c[0] as { queryKey?: unknown[] })?.queryKey) &&
            (c[0] as { queryKey: unknown[] }).queryKey[0] === 'coverage',
        )
        const conformanceCalls = invalidateSpy.mock.calls.filter(
          (c) =>
            Array.isArray((c[0] as { queryKey?: unknown[] })?.queryKey) &&
            (c[0] as { queryKey: unknown[] }).queryKey[0] === 'conformance',
        )
        expect(coverageCalls.length).toBeGreaterThanOrEqual(1)
        expect(conformanceCalls.length).toBeGreaterThanOrEqual(1)
      },
      { timeout: 1000 },
    )
  })
})
