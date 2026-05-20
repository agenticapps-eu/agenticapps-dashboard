// PD-11.1-03 / REVIEWS-2 -- global ResizeObserver mock; jsdom does not ship one.
// Tests interact via `triggerLastResizeObserver(h)` and `activeResizeObserverCount()`.

type ResizeCallback = (entries: Array<{ contentRect: { height: number } }>) => void

const __activeObservers: Array<{
  callback: ResizeCallback
  target: Element | null
}> = []

class MockResizeObserver {
  private callback: ResizeCallback
  private target: Element | null = null

  constructor(callback: ResizeCallback) {
    this.callback = callback
  }

  observe(el: Element): void {
    this.target = el
    __activeObservers.push({ callback: this.callback, target: el })
  }

  unobserve(): void {
    const idx = __activeObservers.findIndex((o) => o.target === this.target)
    if (idx >= 0) __activeObservers.splice(idx, 1)
  }

  disconnect(): void {
    for (let i = __activeObservers.length - 1; i >= 0; i--) {
      const obs = __activeObservers[i]
      if (obs && obs.callback === this.callback) {
        __activeObservers.splice(i, 1)
      }
    }
  }
}

;(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
  MockResizeObserver as unknown as typeof ResizeObserver

// Phase 12 Plan 12-05: jsdom does not ship a matchMedia implementation, so the
// Phase 12 Wave 0 useViewportBreakpoint hook (matchMedia + useSyncExternalStore)
// always falls into the xs fallback under default jsdom — which makes
// CoverageFamilySection.tsx render the new mobile branch by default.
//
// To keep the >150 pre-existing tests on the desktop render path without
// per-file plumbing, install a global matchMedia stub that simulates a >=lg
// viewport (matches min-width: 640/768/1024px, not 1280px). Tests that need a
// different breakpoint (e.g. useViewportBreakpoint.test.ts, the 12-05
// viewport-branch tests in CoverageFamilySection.test.tsx) override this
// stub via Object.defineProperty(window, 'matchMedia', ...) in their own
// beforeEach. Each test file runs in its own jsdom context, so overrides are
// scoped to the file.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches:
        query === '(min-width: 1024px)' ||
        query === '(min-width: 768px)' ||
        query === '(min-width: 640px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }),
  })
}

export function triggerLastResizeObserver(height: number): void {
  const last = __activeObservers[__activeObservers.length - 1]
  if (!last) throw new Error('No active ResizeObserver to trigger')
  last.callback([{ contentRect: { height } as DOMRectReadOnly }])
}

export function activeResizeObserverCount(): number {
  return __activeObservers.length
}
