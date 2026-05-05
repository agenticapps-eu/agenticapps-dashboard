import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Import the hook under test — this will fail until lastRefresh.ts is created (TDD RED).
import { useLastRefresh, relativeSeconds } from './lastRefresh.js'

// ---------------------------------------------------------------------------
// relativeSeconds (pure function) tests
// ---------------------------------------------------------------------------
describe('relativeSeconds', () => {
  it('returns "Xs ago" for under 60s', () => {
    expect(relativeSeconds(5_000)).toBe('5s ago')
    expect(relativeSeconds(0)).toBe('0s ago')
    expect(relativeSeconds(59_000)).toBe('59s ago')
  })

  it('returns "Xm ago" for 60s–3599s', () => {
    expect(relativeSeconds(60_000)).toBe('1m ago')
    expect(relativeSeconds(90_000)).toBe('2m ago')
    expect(relativeSeconds(3_599_000)).toBe('60m ago')
  })

  it('returns "Xh ago" for 1h–23h', () => {
    expect(relativeSeconds(3_600_000)).toBe('1h ago')
    expect(relativeSeconds(7_200_000)).toBe('2h ago')
  })

  it('returns "Xd ago" for >= 24h', () => {
    expect(relativeSeconds(86_400_000)).toBe('1d ago')
    expect(relativeSeconds(172_800_000)).toBe('2d ago')
  })
})

// ---------------------------------------------------------------------------
// useLastRefresh hook tests
// ---------------------------------------------------------------------------

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
}

describe('useLastRefresh', () => {
  let qc: QueryClient

  beforeEach(() => {
    vi.useFakeTimers()
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
  })

  afterEach(() => {
    qc.clear()
    vi.useRealTimers()
  })

  it('returns { count: null, refreshLabel: "refreshing…" } when no queries have completed', () => {
    const wrapper = makeWrapper(qc)
    const { result } = renderHook(() => useLastRefresh(), { wrapper })

    expect(result.current.count).toBeNull()
    expect(result.current.refreshLabel).toBe('refreshing…')
  })

  it('returns count from registry query data seeded via setQueryData', () => {
    qc.setQueryData(['registry'], [{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    const wrapper = makeWrapper(qc)
    const { result } = renderHook(() => useLastRefresh(), { wrapper })

    expect(result.current.count).toBe(3)
  })

  it('returns count: null when registry data is not an array', () => {
    qc.setQueryData(['registry'], null)
    const wrapper = makeWrapper(qc)
    const { result } = renderHook(() => useLastRefresh(), { wrapper })

    expect(result.current.count).toBeNull()
  })

  it('returns refreshLabel using oldest dataUpdatedAt across tracked queries', () => {
    const now = Date.now()
    // Seed two queries with known dataUpdatedAt values by setting data and then
    // manually marking the query state (simulate dataUpdatedAt).
    // We use setQueryData to create the cache entry, then patch the query state.
    qc.setQueryData(['registry'], [{ id: 'a' }])
    qc.setQueryData(['overview', 'proj-1'], { phaseStatus: 'In Progress' })

    // Manually set dataUpdatedAt on each query to control the timestamp.
    const registryQuery = qc.getQueryCache().find({ queryKey: ['registry'] })
    const overviewQuery = qc.getQueryCache().find({ queryKey: ['overview', 'proj-1'] })

    if (registryQuery) {
      registryQuery.state.dataUpdatedAt = now - 10_000  // 10s ago
    }
    if (overviewQuery) {
      overviewQuery.state.dataUpdatedAt = now - 30_000  // 30s ago (oldest)
    }

    const wrapper = makeWrapper(qc)
    const { result } = renderHook(() => useLastRefresh(), { wrapper })

    // The oldest is 30s ago, so the label should reflect ~30s
    // Allow ±2s tolerance for timing
    expect(result.current.refreshLabel).toMatch(/^last refresh (2[89]|30|31)s ago$/)
  })

  it('refreshLabel updates when setInterval ticks (1s interval)', () => {
    const now = Date.now()
    qc.setQueryData(['registry'], [{ id: 'a' }])
    const registryQuery = qc.getQueryCache().find({ queryKey: ['registry'] })
    if (registryQuery) {
      registryQuery.state.dataUpdatedAt = now - 5_000  // 5s ago
    }

    const wrapper = makeWrapper(qc)
    const { result } = renderHook(() => useLastRefresh(), { wrapper })

    // Initial: ~5s ago
    expect(result.current.refreshLabel).toMatch(/^last refresh \d+s ago$/)

    // Advance 1 second — the label should update
    act(() => {
      vi.advanceTimersByTime(1_000)
    })

    // After 1 more second, it should be ~6s ago
    expect(result.current.refreshLabel).toMatch(/^last refresh \d+s ago$/)
  })

  it('ignores queries with dataUpdatedAt === 0 (never fetched)', () => {
    // Create a query entry but don't seed data (so dataUpdatedAt stays 0)
    // Seed registry data to get a count but with a tracked overview query at 0
    qc.setQueryData(['registry'], [{ id: 'a' }])
    const registryQuery = qc.getQueryCache().find({ queryKey: ['registry'] })
    if (registryQuery) {
      registryQuery.state.dataUpdatedAt = 0
    }

    const wrapper = makeWrapper(qc)
    const { result } = renderHook(() => useLastRefresh(), { wrapper })

    // No query has a valid timestamp, so should be "refreshing…"
    expect(result.current.refreshLabel).toBe('refreshing…')
  })

  it('cleans up setInterval on unmount (no timer leak)', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')
    const wrapper = makeWrapper(qc)
    const { unmount } = renderHook(() => useLastRefresh(), { wrapper })

    unmount()

    expect(clearIntervalSpy).toHaveBeenCalled()
    clearIntervalSpy.mockRestore()
  })
})
