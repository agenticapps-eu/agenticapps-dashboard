/**
 * changesQueries.test.ts — the board's one read, and the cadence it runs at.
 *
 * `daemon-runtime` → `Polling, Not Push` binds the client, not just the server:
 * the dashboard SHALL be driven by client polling on roughly a 5-second
 * cadence. Both this module's docblock and `service.ts` justify the daemon's
 * 5s memo *by* that client. A `staleTime` alone does not poll — it only decides
 * what a refetch would be answered from — so the two together left the board
 * frozen at whatever it read on mount while claiming otherwise.
 */
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'fixture-token',
    pairedAt: '2026-07-28T00:00:00Z',
  })),
}))

import { CHANGES_FLEET_QUERY_KEY, useChangesFleet } from './changesQueries.js'

describe('useChangesFleet', () => {
  it('polls on the 5s cadence the daemon memo is sized for', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const scoped = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client }, children)

    renderHook(() => useChangesFleet(), { wrapper: scoped })

    const query = client
      .getQueryCache()
      .getAll()
      .find(
        (q) => JSON.stringify(q.queryKey) === JSON.stringify(CHANGES_FLEET_QUERY_KEY),
      )
    expect(query).toBeDefined()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const opts = query?.options as any
    expect(opts?.refetchInterval).toBe(5_000)
    // Stale time matches, so a poll inside the window is answered from the
    // daemon's own memo rather than adding a second layer of staleness.
    expect(opts?.staleTime).toBe(5_000)

    client.clear()
  })
})
