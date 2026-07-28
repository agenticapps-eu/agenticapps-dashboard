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

import { useCoverageHistory } from './coverageHistoryQueries.js'

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

afterEach(() => vi.unstubAllGlobals())

describe('useCoverageHistory compatibility', () => {
  it.each([1, 2] as const)('accepts history schema version %s', async (schemaVersion) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        response({
          schemaVersion,
          repoId: 'agenticapps/dashboard',
          windowDays: 14,
          cells: {
            claudeMd: { direction: null, daysSince: null },
            ...(schemaVersion === 1
              ? {
                  gitNexus: { direction: 'up', daysSince: 1 },
                  wiki: { direction: 'down', daysSince: 2 },
                }
              : {}),
            workflowVersion: { direction: 'down', daysSince: 3 },
          },
        }),
      ),
    )

    const { result } = renderHook(
      () => useCoverageHistory('agenticapps/dashboard'),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(Object.keys(result.current.data?.cells ?? {})).toEqual([
      'claudeMd',
      'workflowVersion',
    ])
  })

  it.each([
    ['unsupported version', { schemaVersion: 3 }, 'schemaVersion'],
    [
      'malformed retained cell',
      {
        schemaVersion: 2,
        repoId: 'agenticapps/dashboard',
        windowDays: 14,
        cells: {
          claudeMd: { direction: 'sideways', daysSince: 1 },
          workflowVersion: { direction: null, daysSince: null },
        },
      },
      'cells.claudeMd.direction',
    ],
  ])('reports the first schema-drift path for %s', async (_label, body, path) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(body)))

    const { result } = renderHook(
      () => useCoverageHistory('agenticapps/dashboard'),
      { wrapper },
    )
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error?.message).toBe(`schema_drift:${path}`)
  })
})
