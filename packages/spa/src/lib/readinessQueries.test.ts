/**
 * readinessQueries.test.ts — the evidence read, §10.
 *
 * `useFleet` and `useRepoDetail` landed in §9 without a test file of their own;
 * they are covered through the two page components. This file exists for
 * `useEvidence`, which has no component-independent coverage anywhere else and
 * carries the one thing worth pinning: the URL it builds.
 *
 * Evidence is fetched rather than linked because the daemon authenticates with
 * a bearer header. An `<a href>` cannot carry one, and putting the token in a
 * query string would write it into history and logs — so the affordance opens
 * the file through `apiFetch` against the existing read route, and introduces
 * no filesystem access path of its own.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CHECK_IDS } from '@agenticapps/dashboard-shared'

import {
  FLEET_QUERY_KEY,
  SchemaDriftError,
  useEvidence,
  useFleet,
  useOpenInEditor,
  useRepoDetail,
  useRescanRepo,
} from './readinessQueries.js'

vi.mock('./pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'test-token-1234',
    pairedAt: '2026-01-01T00:00:00.000Z',
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
  return React.createElement(QueryClientProvider, { client: qc }, children)
}

const FILE = {
  content: '# REVIEW\n\nApproved.\n',
  mtime: '2026-07-30T09:15:00.000Z',
  sha256: 'f'.repeat(64),
}

function ok(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
  })
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('schema drift', () => {
  it('carries the measured mismatch rather than a stringified path', async () => {
    // The drift screen renders `expected:` and `got:` rows. Those were being
    // filled with the literals 'see schema' and 'mismatch' because the real
    // values had been thrown away here — invented diagnostics presented as
    // measured ones, on the one screen whose whole job is to report a
    // measurement.
    mockFetch.mockReturnValue(ok({ generatedAt: 'not-a-number', repos: [] }))

    const { result } = renderHook(() => useFleet(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    const error = result.current.error as SchemaDriftError
    expect(error).toBeInstanceOf(SchemaDriftError)
    expect(error.drift.path).toBe('generatedAt')
    expect(error.drift.expected).not.toBe('see schema')
    expect(error.drift.got).not.toBe('mismatch')
    expect(error.drift.issues.length).toBeGreaterThan(0)
  })
})

describe('useOpenInEditor', () => {
  it('posts to the open route with an empty body, naming no path', () => {
    // No path means the project root, which is what "open in editor" on a repo
    // detail means. The daemon distinguishes the two by the field's absence, so
    // the body has to be an object and has to be empty.
    mockFetch.mockReturnValue(ok({ ok: true, requestId: 'req-1' }))

    const { result } = renderHook(() => useOpenInEditor('dashboard'), { wrapper })
    result.current.mutate()

    return waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
      expect(url).toContain('/api/projects/dashboard/open')
      expect(init.method).toBe('POST')
      expect(init.body).toBe('{}')
    })
  })
})

describe('useRescanRepo', () => {
  it('writes the fresh reading straight into the cache and stales the fleet', async () => {
    // The POST already returns the new detail, so refetching it would be a
    // second round trip for something in hand — and it deliberately bypasses
    // the daemon's memo, which is the whole reason the button exists. A wrong
    // cache key here silently no-ops.
    const fresh = {
      generatedAt: Date.UTC(2026, 7, 1),
      repo: {
        id: 'dashboard',
        name: 'agenticapps-dashboard',
        family: 'agenticapps' as const,
        ready: false,
        lastCommitAt: null,
        notice: null,
        checks: CHECK_IDS.map((id) => ({
          id,
          status: 'never' as const,
          source: 'derived' as const,
          at: null,
          value: null,
          threshold: null,
          summary: '',
          evidence: null,
          error: null,
          remedy: 'Do the thing.',
        })),
      },
    }
    mockFetch.mockReturnValue(ok(fresh))

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    })
    const wrap = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children)
    const invalidate = vi.spyOn(qc, 'invalidateQueries')

    const { result } = renderHook(() => useRescanRepo('dashboard'), { wrapper: wrap })
    result.current.mutate()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/v2/repos/dashboard/rescan')
    expect(init.method).toBe('POST')
    expect(qc.getQueryData(['readiness', 'repo', 'dashboard'])).toEqual(fresh)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: FLEET_QUERY_KEY })
  })
})

describe('useEvidence', () => {
  it('reads the file through the existing project read route', async () => {
    mockFetch.mockReturnValue(ok(FILE))

    const { result } = renderHook(
      () => useEvidence('dashboard', 'openspec/changes/add-repo-readiness/REVIEWS.md', true),
      { wrapper },
    )

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.content).toContain('Approved.')

    const url = mockFetch.mock.calls[0]?.[0] as string
    expect(url).toContain('/api/projects/dashboard/read?path=')
    // Encoded, so a path with a slash or a space cannot restructure the query.
    expect(url).toContain(
      encodeURIComponent('openspec/changes/add-repo-readiness/REVIEWS.md'),
    )
  })

  it('encodes a repo identifier into the path segment', async () => {
    mockFetch.mockReturnValue(ok(FILE))

    renderHook(() => useEvidence('a repo/../x', 'REVIEW.md', true), { wrapper })

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const url = mockFetch.mock.calls[0]?.[0] as string
    expect(url).toContain(`/api/projects/${encodeURIComponent('a repo/../x')}/read`)
    expect(url).not.toContain('/api/projects/a repo/../x/read')
  })

  it('does not read anything until the reader asks for it', async () => {
    // A detail page renders six blocks. Reading every evidence file on mount
    // would turn one page view into six file reads nobody requested.
    renderHook(() => useEvidence('dashboard', 'REVIEW.md', false), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not read when there is no evidence path', async () => {
    renderHook(() => useEvidence('dashboard', null, true), { wrapper })

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

/**
 * The cross-repo leakage guard.
 *
 * `/projects/:id` carried one of these and it was deleted with the surface, in
 * `projects-detail-e2e.test.tsx` — leaving the surviving `/repos/:id` with no
 * equivalent. The keys are correct today; what was lost is the thing that
 * notices if they stop being. A per-repo query keyed without its identifier
 * shows one repository's readiness under another repository's name, which is
 * both silent and the worst answer this product can give: every check on the
 * page is a claim about a named repo.
 *
 * One QueryClient across both reads, because a fresh client per read cannot
 * collide and so cannot fail.
 */
describe('per-repo reads do not leak across repositories', () => {
  function detail(id: string) {
    return {
      generatedAt: Date.UTC(2026, 7, 1),
      repo: {
        id,
        name: id,
        family: 'agenticapps' as const,
        ready: false,
        lastCommitAt: null,
        notice: null,
        checks: CHECK_IDS.map((checkId) => ({
          id: checkId,
          status: 'never' as const,
          source: 'derived' as const,
          at: null,
          value: null,
          threshold: null,
          summary: '',
          evidence: null,
          error: null,
          remedy: 'Do the thing.',
        })),
      },
    }
  }

  /** One client, shared — a per-hook client could not collide. */
  function sharedClient() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    })
    return {
      qc,
      wrap: ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: qc }, children),
    }
  }

  it('gives each repo its own readiness entry, and gives the second reader the second repo', async () => {
    const { qc, wrap } = sharedClient()

    mockFetch.mockReturnValue(ok(detail('acme')))
    const acme = renderHook(() => useRepoDetail('acme'), { wrapper: wrap })
    await waitFor(() => expect(acme.result.current.data).toBeDefined())

    mockFetch.mockReturnValue(ok(detail('beta')))
    const beta = renderHook(() => useRepoDetail('beta'), { wrapper: wrap })
    await waitFor(() => expect(beta.result.current.data).toBeDefined())

    // What a reader would see. A shared key hands beta's page acme's checks.
    expect(beta.result.current.data?.repo.id).toBe('beta')
    expect(acme.result.current.data?.repo.id).toBe('acme')

    // And the cache underneath it, so a regression is named where it happens.
    expect(qc.getQueryData(['readiness', 'repo', 'acme'])).toEqual(detail('acme'))
    expect(qc.getQueryData(['readiness', 'repo', 'beta'])).toEqual(detail('beta'))
  })

  it('gives the same evidence path under two repos two entries, not one', async () => {
    // The path repeats across repositories — every repo has a REVIEWS.md — so
    // this is the key most likely to collide if the identifier is ever dropped.
    const { qc, wrap } = sharedClient()
    const PATH = 'openspec/changes/add-repo-readiness/REVIEWS.md'

    mockFetch.mockReturnValue(ok({ ...FILE, content: 'acme approved' }))
    const acme = renderHook(() => useEvidence('acme', PATH, true), { wrapper: wrap })
    await waitFor(() => expect(acme.result.current.data).toBeDefined())

    mockFetch.mockReturnValue(ok({ ...FILE, content: 'beta approved' }))
    const beta = renderHook(() => useEvidence('beta', PATH, true), { wrapper: wrap })
    await waitFor(() => expect(beta.result.current.data).toBeDefined())

    expect(beta.result.current.data?.content).toBe('beta approved')
    expect(acme.result.current.data?.content).toBe('acme approved')
    expect(qc.getQueryData(['readiness', 'evidence', 'acme', PATH])).toBeDefined()
    expect(qc.getQueryData(['readiness', 'evidence', 'beta', PATH])).toBeDefined()
  })
})
