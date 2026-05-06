/**
 * projectQueries.test.ts — TDD tests for Phase 4 SPA query hooks.
 *
 * Tests Q1–Q11 covering:
 * - URL construction per hook
 * - Schema drift error path
 * - observations limit in URL + queryKey
 * - queryKey shapes for all 5 hooks
 * - enabled: id !== null gate
 * - staleTime / refetchInterval / refetchIntervalInBackground config
 * - cross-project cache isolation
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Import hooks under test (fail until projectQueries.ts exists)
import {
  useCommitment,
  useObservations,
  useDiscipline,
  usePhaseProgress,
  useSecurity,
} from './projectQueries.js'

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
        // Disable automatic refetching in tests
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

function makeSuccessResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
  })
}

function makeDriftResponse() {
  // Returns a valid HTTP response but with schema-invalid body (missing required field)
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ unexpected: 'drift' }),
    clone: () => ({ json: () => Promise.resolve({ unexpected: 'drift' }) }),
  })
}

// ── Valid fixture bodies ──────────────────────────────────────────────────────

const COMMITMENT_BODY = { markdown: '## Workflow commitment\n\nI commit.', sourceFile: 'session-2026.md' }
const OBSERVATIONS_BODY = { entries: [{ ts: '2026-05-01T10:00:00Z', skill: 'meta-observer', hook: 'PostToolUse' }], skillInstalled: true }
const DISCIPLINE_BODY = { rows: [{ label: 'Workflow skill not followed', fires: 2 }], skillInstalled: true }
const PHASE_PROGRESS_BODY = {
  phase: '04-single-project-view',
  paddedPhase: '04',
  files: [],
  tdd: { greenPairs: 0, totalTasks: 0, timeline: [] },
  review: { stage1: null, stage2: null },
  verification: { mustHavesTotal: 0, mustHavesEvidenced: 0, items: [] },
}
const SECURITY_BODY = { cso: null, dbSentinel: null }

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetch.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('useCommitment', () => {
  it('Q1: fetches /api/projects/acme/commitment and returns data on 200 + valid body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(COMMITMENT_BODY),
      clone: () => ({ json: () => Promise.resolve(COMMITMENT_BODY) }),
    })

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCommitment('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual(COMMITMENT_BODY)
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/commitment')

    qc.clear()
  })

  it('Q2: on 200 + schema drift body, hook enters error state with schema_drift: prefix', async () => {
    mockFetch.mockResolvedValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCommitment('acme'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/^schema_drift:/)

    qc.clear()
  })

  it('Q9: when id is null, hook is idle (not triggered)', () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useCommitment(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()

    qc.clear()
  })

  it('Q10: staleTime is 5000, refetchInterval is 5000, refetchIntervalInBackground is false', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useCommitment('acme'), { wrapper })

    const cache = qc.getQueryCache()
    const queries = cache.getAll()
    const q = queries.find((q) => JSON.stringify(q.queryKey) === JSON.stringify(['commitment', 'acme']))
    expect(q).toBeDefined()
    expect(q?.options.staleTime).toBe(5_000)
    expect(q?.options.refetchInterval).toBe(5_000)
    expect(q?.options.refetchIntervalInBackground).toBe(false)

    qc.clear()
  })
})

describe('useObservations', () => {
  it('Q3: fetches with default limit=20 in URL', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(OBSERVATIONS_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useObservations('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/observations/recent?limit=20')

    qc.clear()
  })

  it('Q4: fetches with explicit limit=5 in URL', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(OBSERVATIONS_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useObservations('acme', 5), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/observations/recent?limit=5')

    qc.clear()
  })

  it('Q5: queryKey includes id AND limit (distinct cache slots)', () => {
    const { qc, wrapper } = makeWrapper()

    renderHook(() => useObservations('acme', 20), { wrapper })
    renderHook(() => useObservations('acme', 5), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['observations', 'acme', 20])
    expect(keys).toContainEqual(['observations', 'acme', 5])

    qc.clear()
  })

  it('Q9: when id is null, observations hook is idle', () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useObservations(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockFetch).not.toHaveBeenCalled()

    qc.clear()
  })
})

describe('useDiscipline', () => {
  it('Q6: queryKey is [discipline, id]', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useDiscipline('acme'), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['discipline', 'acme'])

    qc.clear()
  })

  it('Q9: when id is null, discipline hook is idle', () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useDiscipline(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    qc.clear()
  })
})

describe('usePhaseProgress', () => {
  it('Q7: queryKey is [phase-progress, id]', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => usePhaseProgress('acme'), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['phase-progress', 'acme'])

    qc.clear()
  })

  it('fetches /api/projects/acme/phase-progress and returns data on success', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(PHASE_PROGRESS_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => usePhaseProgress('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/phase-progress')

    qc.clear()
  })

  it('Q9: when id is null, phase-progress hook is idle', () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => usePhaseProgress(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    qc.clear()
  })
})

describe('useSecurity', () => {
  it('Q8: queryKey is [security, id]', () => {
    const { qc, wrapper } = makeWrapper()
    renderHook(() => useSecurity('acme'), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['security', 'acme'])

    qc.clear()
  })

  it('fetches /api/projects/acme/security and returns data on success', async () => {
    mockFetch.mockResolvedValue(makeSuccessResponse(SECURITY_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useSecurity('acme'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const callUrl = mockFetch.mock.calls[0]?.[0] as string
    expect(callUrl).toContain('/api/projects/acme/security')

    qc.clear()
  })

  it('Q9: when id is null, security hook is idle', () => {
    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useSecurity(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
    qc.clear()
  })
})

describe('cross-project cache isolation (Q11)', () => {
  it('useCommitment("acme") and useCommitment("beta") produce distinct cache entries', async () => {
    const acmeBody = { markdown: 'acme commitment', sourceFile: 'acme.md' }
    const betaBody = { markdown: 'beta commitment', sourceFile: 'beta.md' }

    let callCount = 0
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/acme/')) {
        callCount++
        return Promise.resolve(makeSuccessResponse(acmeBody))
      }
      if (url.includes('/beta/')) {
        callCount++
        return Promise.resolve(makeSuccessResponse(betaBody))
      }
      return Promise.reject(new Error('unexpected url'))
    })

    const { qc, wrapper } = makeWrapper()

    const { result: acmeResult } = renderHook(() => useCommitment('acme'), { wrapper })
    const { result: betaResult } = renderHook(() => useCommitment('beta'), { wrapper })

    await waitFor(() => expect(acmeResult.current.isSuccess).toBe(true))
    await waitFor(() => expect(betaResult.current.isSuccess).toBe(true))

    const acmeCacheData = qc.getQueryData(['commitment', 'acme'])
    const betaCacheData = qc.getQueryData(['commitment', 'beta'])

    expect(acmeCacheData).toEqual(acmeBody)
    expect(betaCacheData).toEqual(betaBody)
    // Critically: they are different objects (no leakage)
    expect(acmeCacheData).not.toEqual(betaCacheData)

    qc.clear()
  })
})
