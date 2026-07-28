import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'fixture-token',
    pairedAt: '2026-07-28T00:00:00Z',
  })),
}))

import { useCoverage } from './coverageQueries.js'

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return React.createElement(QueryClientProvider, { client }, children)
}

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const row = {
  family: 'agenticapps',
  repo: 'dashboard',
  claudeMd: { kind: 'basic', state: 'fresh' },
  gitNexus: { kind: 'basic', state: 'missing' },
  wiki: { kind: 'basic', state: 'stale' },
  workflowVersion: {
    kind: 'workflow',
    state: 'not-applicable',
    installedVersion: null,
    headVersion: '3.0.0',
  },
  overrideCount: 0,
  overrides: [],
}

afterEach(() => vi.unstubAllGlobals())

describe('useCoverage compatibility', () => {
  it('normalises an old-daemon v1 response and discards retired fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          schemaVersion: 1,
          generatedAtIso: '2026-07-28T00:00:00Z',
          gitNexusInstallState: 'installed-with-registry',
          workflowHeadVersion: '3.0.0',
          rows: [row],
        }),
      ),
    )

    const { result } = renderHook(() => useCoverage(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.rows[0]?.workflowVersion.state).toBe('missing')
    expect(result.current.data?.rows[0]).not.toHaveProperty('gitNexus')
    expect(result.current.data?.rows[0]).not.toHaveProperty('wiki')
    expect(result.current.data?.rows[0]?.understand).toBeUndefined()
  })

  it('accepts a strict current-daemon v2 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          schemaVersion: 2,
          generatedAtIso: '2026-07-28T00:00:00Z',
          workflowHeadVersion: '3.0.0',
          rows: [
            {
              family: 'agenticapps',
              repo: 'dashboard',
              claudeMd: { kind: 'basic', state: 'fresh' },
              workflowVersion: {
                kind: 'workflow',
                state: 'fresh',
                installedVersion: '3.0.0',
                headVersion: '3.0.0',
              },
              understand: { kind: 'basic', state: 'missing' },
              overrideCount: 0,
              overrides: [],
            },
          ],
        }),
      ),
    )

    const { result } = renderHook(() => useCoverage(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.schemaVersion).toBe(2)
  })

  it.each([
    ['unsupported version', { schemaVersion: 3 }, 'schemaVersion'],
    [
      'malformed current row',
      {
        schemaVersion: 2,
        generatedAtIso: '2026-07-28T00:00:00Z',
        workflowHeadVersion: '3.0.0',
        rows: [
          {
            family: 'agenticapps',
            claudeMd: { kind: 'basic', state: 'fresh' },
            workflowVersion: {
              kind: 'workflow',
              state: 'fresh',
              installedVersion: '3.0.0',
              headVersion: '3.0.0',
            },
            understand: { kind: 'basic', state: 'missing' },
            overrideCount: 0,
            overrides: [],
          },
        ],
      },
      'rows.0.repo',
    ],
  ])('reports the first schema-drift path for %s', async (_label, body, path) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)))

    const { result } = renderHook(() => useCoverage(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error?.message).toBe(`schema_drift:${path}`)
  })
})
