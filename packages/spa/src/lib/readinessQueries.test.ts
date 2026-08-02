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
  useEvidence,
  useOpenInEditor,
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
