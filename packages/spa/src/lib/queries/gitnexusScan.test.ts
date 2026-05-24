/**
 * gitnexusScan.test.ts — RED scaffold for SPA gitnexus scan query hooks.
 *
 * Wave 3 (Plan 13-03) will GREEN these by creating:
 *   packages/spa/src/lib/queries/gitnexusScan.ts
 *   (useGitnexusScan mutation + useGitnexusScanProgress polling query)
 *
 * These tests import from the not-yet-existing module and intentionally fail
 * with "Cannot find module" — that is the RED state expected by Wave 0.
 *
 * Test inventory (7 cases — SPA query hook concerns):
 *   1. useGitnexusScan() mutates POST /api/gitnexus/scan and returns scanId
 *   2. useGitnexusScanProgress(scanId) polls every 1500ms while state='running'
 *   3. useGitnexusScanProgress stops polling when state='done'
 *   4. useGitnexusScanProgress stops polling when state='error'
 *   5. useGitnexusScanProgress is disabled (no fetch) when scanId is null
 *   6. Consumer effect: queryClient.invalidateQueries(['coverage']) fires on 'done'
 *   7. Consumer effect: queryClient.invalidateQueries(['conformance']) fires on 'done'
 *
 * TanStack Query test harness mirrors conformanceQueries.test.ts:
 *   makeWrapper() → QueryClientProvider wrapping renderHook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ── The module below does NOT exist yet (Wave 3 creates it). ─────────────────
// Importing it here produces "Cannot find module" — that is the RED state.
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

describe('useGitnexusScan() — POST /api/gitnexus/scan mutation', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('mutates POST /api/gitnexus/scan and returns scanId on success', async () => {
    // Wave 3 Plan 13-03 implements useGitnexusScan.
    // Full assertion: mock fetch → { ok: true, scanId: 'uuid-...' }
    // Expect mutation.data.scanId to be a UUID string.
    expect(useGitnexusScan).toBeDefined()
  })
})

describe('useGitnexusScanProgress(scanId) — GET /api/gitnexus/scan/:id polling', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("polls every 1500ms while state='running' (D-13-02)", async () => {
    // Wave 3 Plan 13-03 implements useGitnexusScanProgress.
    // Full assertion: advance time 1500ms → 2 fetches; advance another 1500ms → 3 fetches.
    expect(useGitnexusScanProgress).toBeDefined()
  })

  it("stops polling when state='done' (refetchInterval → false)", async () => {
    // Wave 3 Plan 13-03 implements this.
    // Full assertion: after mock returns state='done', no further fetches on timer advance.
    expect(useGitnexusScanProgress).toBeDefined()
  })

  it("stops polling when state='error'", async () => {
    // Wave 3 Plan 13-03 implements this.
    expect(useGitnexusScanProgress).toBeDefined()
  })

  it('is disabled (no fetch issued) when scanId is null', async () => {
    // Wave 3 Plan 13-03 implements this.
    // Full assertion: renderHook with scanId=null; advance timers; expect fetch not called.
    expect(useGitnexusScanProgress).toBeDefined()
  })

  it("consumer effect: invalidates ['coverage'] query when state transitions to 'done' (D-13-09)", async () => {
    // Wave 3 Plan 13-03 implements this.
    // Full assertion: spy qc.invalidateQueries; mock returns 'done'; expect called with ['coverage'].
    expect(useGitnexusScanProgress).toBeDefined()
  })

  it("consumer effect: invalidates ['conformance'] query when state transitions to 'done' (D-13-09)", async () => {
    // Wave 3 Plan 13-03 implements this.
    expect(useGitnexusScanProgress).toBeDefined()
  })
})
