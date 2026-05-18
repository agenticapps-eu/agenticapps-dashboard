/**
 * skillDriftQueries.test.ts — TDD tests for useSkillDrift + useAgentLinterDrift hooks.
 *
 * Plan 11-05 Task 1.
 *
 * Tests cover:
 * - useSkillDrift({scope}): queryKey discrimination on scope, default scope='family',
 *   staleTime, refetchInterval, schema-drift surface (PD-11-03).
 * - useAgentLinterDrift: POSTs {projectId} ONLY (D-11-14), uses SHARED
 *   AgentLinterResponseSchema (REVIEWS #10 — no local copy), positional
 *   apiFetch(path, schema, init?), onSuccess invalidates ['skillDrift'].
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import {
  useSkillDrift,
  useAgentLinterDrift,
  type SkillDriftScope,
} from './skillDriftQueries.js'

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
    json: () => Promise.resolve({ unexpected: 'drift', missing: 'required-fields' }),
    clone: () => ({ json: () => Promise.resolve({ unexpected: 'drift' }) }),
  })
}

// ── Fixture bodies ────────────────────────────────────────────────────────────

const SKILL_DRIFT_BODY = {
  schemaVersion: 1,
  generatedAtIso: '2026-05-16T12:00:00.000Z',
  projects: [
    {
      projectId: 'p1',
      projectName: 'agenticapps-dashboard',
      family: 'agenticapps',
    },
  ],
  rows: [
    {
      skillId: 'agenticapps-workflow',
      byProject: {
        p1: {
          present: true,
          version: '1.2.3',
          lastModifiedIso: '2026-05-15T10:00:00.000Z',
        },
      },
    },
  ],
}

// Bare AgentLinter "ok" response shape (matches AgentLinterResponseSchema kind: 'ok')
const AGENTLINTER_OK_BODY = {
  kind: 'ok',
  report: {
    score: 92,
    categories: [
      { name: 'structure', score: 95, weight: 1, issues: 0 },
    ],
    diagnostics: [],
    files: ['SKILL.md'],
    timestamp: '2026-05-16T12:01:00.000Z',
  },
  cachedAt: '2026-05-16T12:01:00.000Z',
}

const AGENTLINTER_NOT_INSTALLED_BODY = {
  kind: 'not-installed',
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetch.mockReset()
})

afterEach(() => {
  cleanup()
})

// ── useSkillDrift ─────────────────────────────────────────────────────────────

describe('useSkillDrift', () => {
  it('T1: initial state has data === undefined before resolve', () => {
    // Never-resolving fetch so the hook stays in pending state.
    mockFetch.mockReturnValue(new Promise(() => {}))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useSkillDrift({ scope: 'family' }), { wrapper })

    expect(result.current.data).toBeUndefined()
    qc.clear()
  })

  it('T2: after fetch resolves, data matches SkillDriftResponse shape', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(SKILL_DRIFT_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useSkillDrift({ scope: 'family' }), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(SKILL_DRIFT_BODY)
    qc.clear()
  })

  it('T3: queryKey is ["skillDrift", scope] — distinct scopes produce distinct cache entries (PD-11-03)', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    const { qc, wrapper } = makeWrapper()
    renderHook(() => useSkillDrift({ scope: 'family' }), { wrapper })
    renderHook(() => useSkillDrift({ scope: 'cross' }), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['skillDrift', 'family'])
    expect(keys).toContainEqual(['skillDrift', 'cross'])
    qc.clear()
  })

  it('T4: staleTime === 30_000ms', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    const { qc, wrapper } = makeWrapper()
    renderHook(() => useSkillDrift({ scope: 'family' }), { wrapper })

    const cache = qc.getQueryCache()
    const q = cache.getAll().find((q) => JSON.stringify(q.queryKey) === JSON.stringify(['skillDrift', 'family']))
    expect(q).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = q?.options as any
    expect(opts?.staleTime).toBe(30 * 1000)
    qc.clear()
  })

  it('T5: refetchInterval === 5000ms', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    const { qc, wrapper } = makeWrapper()
    renderHook(() => useSkillDrift({ scope: 'family' }), { wrapper })

    const cache = qc.getQueryCache()
    const q = cache.getAll().find((q) => JSON.stringify(q.queryKey) === JSON.stringify(['skillDrift', 'family']))
    expect(q).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = q?.options as any
    expect(opts?.refetchInterval).toBe(5_000)
    qc.clear()
  })

  it('T6: schema-drift response surfaces isError via ParseOrDrift discriminator', async () => {
    mockFetch.mockReturnValue(makeDriftResponse())

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useSkillDrift({ scope: 'family' }), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(/^schema_drift/)
    qc.clear()
  })

  it('T7: useSkillDrift() (no args) defaults to scope: family (PD-11-03)', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))

    const { qc, wrapper } = makeWrapper()
    renderHook(() => useSkillDrift(), { wrapper })

    const keys = qc.getQueryCache().getAll().map((q) => q.queryKey)
    expect(keys).toContainEqual(['skillDrift', 'family'])
    qc.clear()
  })
})

// ── useAgentLinterDrift ───────────────────────────────────────────────────────

describe('useAgentLinterDrift', () => {
  it('T8: POSTs to /api/skills/drift/agentlinter with body { projectId }', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(AGENTLINTER_OK_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useAgentLinterDrift(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ projectId: 'p1' })
    })

    expect(mockFetch).toHaveBeenCalledOnce()
    const [callUrl, callInit] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(callUrl).toContain('/api/skills/drift/agentlinter')
    expect(callInit.method).toBe('POST')
    const sentBody = JSON.parse(callInit.body as string) as unknown
    expect(sentBody).toEqual({ projectId: 'p1' })
    qc.clear()
  })

  it('T9: successful response sets mutation.data to the AgentLinter result body', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(AGENTLINTER_OK_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useAgentLinterDrift(), { wrapper })

    let mutationResult: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      mutationResult = await result.current.mutateAsync({ projectId: 'p1' })
    })

    expect(mutationResult).toBeDefined()
    expect(mutationResult!.kind).toBe('ok')
    qc.clear()
  })

  it('T10: 404 from daemon sets mutation.error', async () => {
    mockFetch.mockReturnValue(makeFetchResponse({ error: 'project_not_found' }, 404))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useAgentLinterDrift(), { wrapper })

    let caught: unknown
    await act(async () => {
      try {
        await result.current.mutateAsync({ projectId: 'unknown' })
      } catch (err) {
        caught = err
      }
    })

    expect(caught).toBeInstanceOf(Error)
    qc.clear()
  })

  it('T11: body sent is EXACTLY { projectId } — NO extra fields (D-11-14 defense-in-depth)', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(AGENTLINTER_OK_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useAgentLinterDrift(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ projectId: 'p1' })
    })

    const [, callInit] = mockFetch.mock.calls[0] as [string, RequestInit]
    const sentBody = JSON.parse(callInit.body as string) as Record<string, unknown>
    expect(Object.keys(sentBody)).toEqual(['projectId'])
    qc.clear()
  })

  it('T12: after successful mutation, queries with queryKey ["skillDrift"] are invalidated (both scopes refetch)', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(AGENTLINTER_OK_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useAgentLinterDrift(), { wrapper })

    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')

    await act(async () => {
      await result.current.mutateAsync({ projectId: 'p1' })
    })

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['skillDrift'] }),
    )
    qc.clear()
  })

  it('T13: REVIEWS #10 — response parses through SHARED AgentLinterResponseSchema (no local copy)', async () => {
    // The AgentLinter response shape is a discriminated union — non-'ok' kinds
    // (e.g. 'not-installed') still parse successfully if the shared schema is used.
    // A local schema definition that hard-coded {ok: literal(true)} would reject this.
    mockFetch.mockReturnValue(makeFetchResponse(AGENTLINTER_NOT_INSTALLED_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useAgentLinterDrift(), { wrapper })

    let mutationResult: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined
    await act(async () => {
      mutationResult = await result.current.mutateAsync({ projectId: 'p1' })
    })

    expect(mutationResult).toBeDefined()
    expect(mutationResult!.kind).toBe('not-installed')
    qc.clear()
  })

  it('T14: apiFetch is called POSITIONALLY: (path: string, schema, init?: RequestInit)', async () => {
    mockFetch.mockReturnValue(makeFetchResponse(AGENTLINTER_OK_BODY))

    const { qc, wrapper } = makeWrapper()
    const { result } = renderHook(() => useAgentLinterDrift(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ projectId: 'p1' })
    })

    // mockFetch is the underlying global fetch; apiFetch wraps it. Verifying
    // the fetch-level call shape proves apiFetch was invoked with a path string
    // (positional arg 1) and a RequestInit (positional arg 3) — NOT an options
    // object that would have produced a different URL/body shape.
    const [callUrl, callInit] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(typeof callUrl).toBe('string')
    expect(callUrl).toMatch(/\/api\/skills\/drift\/agentlinter$/)
    expect(callInit).toBeDefined()
    expect(callInit.method).toBe('POST')
    qc.clear()
  })
})

// ── SkillDriftScope type smoke (compile-time check via runtime assignment) ────

describe('SkillDriftScope type', () => {
  it('T15: type allows "family" and "cross" only (runtime smoke)', () => {
    const a: SkillDriftScope = 'family'
    const b: SkillDriftScope = 'cross'
    expect(a).toBe('family')
    expect(b).toBe('cross')
  })
})
