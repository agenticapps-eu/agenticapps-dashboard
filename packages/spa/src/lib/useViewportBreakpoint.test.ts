/**
 * useViewportBreakpoint.test.ts — matchMedia + useSyncExternalStore hook.
 *
 * RED-first (Phase 12 Plan 12-00 Task 3). Implementation lives in
 * useViewportBreakpoint.ts. Uses matchMedia mock pattern established by
 * theme.sync.test.tsx (vi.stubGlobal + fake MediaQueryList).
 *
 * Rationale for matchMedia over ResizeObserver: RESEARCH §Pitfall 10 — RO
 * on documentElement fires hundreds of setState calls per resize drag;
 * matchMedia fires only on threshold crossings (~5 events / drag).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useViewportBreakpoint } from './useViewportBreakpoint'

interface MockMQ {
  matches: boolean
  media: string
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
  // legacy variants — matchMedia returns both pairs
  addListener: ReturnType<typeof vi.fn>
  removeListener: ReturnType<typeof vi.fn>
  onchange: null
  dispatchEvent: ReturnType<typeof vi.fn>
  __listeners: Array<() => void>
}

const created: Map<string, MockMQ> = new Map()

/**
 * `match` predicate gives the test a single switchboard for what each query
 * should report. Re-invoked on every new matchMedia call, so subscribers see
 * up-to-date results before they fire.
 */
function installMatchMedia(match: (query: string) => boolean): void {
  created.clear()
  const factory = (query: string): MockMQ => {
    const existing = created.get(query)
    if (existing) {
      // refresh `matches` for hot-swapped predicates
      existing.matches = match(query)
      return existing
    }
    const mq: MockMQ = {
      get matches() {
        return match(query)
      },
      set matches(_: boolean) {
        /* getter-backed — no-op */
      },
      media: query,
      addEventListener: vi.fn((_evt: string, cb: () => void) => {
        mq.__listeners.push(cb)
      }),
      removeEventListener: vi.fn((_evt: string, cb: () => void) => {
        const i = mq.__listeners.indexOf(cb)
        if (i >= 0) mq.__listeners.splice(i, 1)
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
      __listeners: [],
    }
    created.set(query, mq)
    return mq
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn((q: string) => factory(q)),
  )
  // Also assign on window for jsdom paths that read window.matchMedia directly.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => factory(q),
  })
}

function fireChange(query: string): void {
  const mq = created.get(query)
  if (!mq) throw new Error(`matchMedia query never registered: ${query}`)
  for (const cb of mq.__listeners) cb()
}

beforeEach(() => {
  created.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useViewportBreakpoint', () => {
  it('returns xl when matchMedia(min-width: 1280px) matches', () => {
    installMatchMedia((q) => q === '(min-width: 1280px)')
    // Add lg + md + sm matches too — xl wins via largest-first iteration.
    installMatchMedia(
      (q) =>
        q === '(min-width: 1280px)' ||
        q === '(min-width: 1024px)' ||
        q === '(min-width: 768px)' ||
        q === '(min-width: 640px)',
    )
    const { result } = renderHook(() => useViewportBreakpoint())
    expect(result.current).toBe('xl')
  })

  it('returns lg when matchMedia(min-width: 1024px) matches but 1280px does not', () => {
    installMatchMedia(
      (q) =>
        q === '(min-width: 1024px)' ||
        q === '(min-width: 768px)' ||
        q === '(min-width: 640px)',
    )
    const { result } = renderHook(() => useViewportBreakpoint())
    expect(result.current).toBe('lg')
  })

  it('returns md when matchMedia(min-width: 768px) matches but 1024px does not', () => {
    installMatchMedia(
      (q) => q === '(min-width: 768px)' || q === '(min-width: 640px)',
    )
    const { result } = renderHook(() => useViewportBreakpoint())
    expect(result.current).toBe('md')
  })

  it('returns sm when matchMedia(min-width: 640px) matches but 768px does not', () => {
    installMatchMedia((q) => q === '(min-width: 640px)')
    const { result } = renderHook(() => useViewportBreakpoint())
    expect(result.current).toBe('sm')
  })

  it('returns xs when no min-width query matches', () => {
    installMatchMedia(() => false)
    const { result } = renderHook(() => useViewportBreakpoint())
    expect(result.current).toBe('xs')
  })

  it('subscribes to addEventListener("change", ...) on each breakpoint query', () => {
    installMatchMedia(() => false)
    renderHook(() => useViewportBreakpoint())
    // 4 min-width breakpoints (xl/lg/md/sm) should each have a subscription;
    // xs is fallback and not a query.
    expect(created.get('(min-width: 1280px)')?.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )
    expect(created.get('(min-width: 1024px)')?.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )
    expect(created.get('(min-width: 768px)')?.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )
    expect(created.get('(min-width: 640px)')?.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    )
  })

  it('unsubscribes (removeEventListener) on unmount', () => {
    installMatchMedia(() => false)
    const { unmount } = renderHook(() => useViewportBreakpoint())
    unmount()
    expect(
      created.get('(min-width: 1280px)')?.removeEventListener,
    ).toHaveBeenCalledWith('change', expect.any(Function))
    expect(
      created.get('(min-width: 1024px)')?.removeEventListener,
    ).toHaveBeenCalledWith('change', expect.any(Function))
    expect(
      created.get('(min-width: 768px)')?.removeEventListener,
    ).toHaveBeenCalledWith('change', expect.any(Function))
    expect(
      created.get('(min-width: 640px)')?.removeEventListener,
    ).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('re-renders when matchMedia fires "change"', () => {
    // Start at md (768px matches, 1024px does not).
    let widthGE1024 = false
    installMatchMedia((q) => {
      if (q === '(min-width: 1280px)') return false
      if (q === '(min-width: 1024px)') return widthGE1024
      if (q === '(min-width: 768px)') return true
      if (q === '(min-width: 640px)') return true
      return false
    })
    const { result } = renderHook(() => useViewportBreakpoint())
    expect(result.current).toBe('md')

    // Cross the lg threshold and fire change on the 1024px query.
    act(() => {
      widthGE1024 = true
      fireChange('(min-width: 1024px)')
    })
    expect(result.current).toBe('lg')
  })
})
