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
      if (__activeObservers[i].callback === this.callback) {
        __activeObservers.splice(i, 1)
      }
    }
  }
}

;(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
  MockResizeObserver as unknown as typeof ResizeObserver

export function triggerLastResizeObserver(height: number): void {
  const last = __activeObservers[__activeObservers.length - 1]
  if (!last) throw new Error('No active ResizeObserver to trigger')
  last.callback([{ contentRect: { height } as DOMRectReadOnly }])
}

export function activeResizeObserverCount(): number {
  return __activeObservers.length
}
