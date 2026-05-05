import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

/**
 * TDD RED: Tests for appShellWidth.ts module.
 * These tests will fail until the module is implemented.
 */

// Reset module state between tests to avoid cross-test contamination.
// appShellWidth.ts uses module-level state; reimport each time.
describe('appShellWidth', () => {
  beforeEach(async () => {
    // Reset module state by re-importing (vitest module isolation)
    vi.resetModules()
  })

  it('getSnapshot returns the default max-w-3xl', async () => {
    const { getSnapshot } = await import('./appShellWidth.js')
    expect(getSnapshot()).toBe('max-w-3xl')
  })

  it('setAppShellWidth changes the current width', async () => {
    const { setAppShellWidth, getSnapshot } = await import('./appShellWidth.js')
    setAppShellWidth('max-w-5xl')
    expect(getSnapshot()).toBe('max-w-5xl')
  })

  it('setAppShellWidth notifies subscribers', async () => {
    const { setAppShellWidth, subscribeAppShellWidth } = await import('./appShellWidth.js')
    const cb = vi.fn()
    const unsub = subscribeAppShellWidth(cb)
    setAppShellWidth('max-w-5xl')
    expect(cb).toHaveBeenCalledOnce()
    unsub()
  })

  it('unsubscribe stops notifications', async () => {
    const { setAppShellWidth, subscribeAppShellWidth } = await import('./appShellWidth.js')
    const cb = vi.fn()
    const unsub = subscribeAppShellWidth(cb)
    unsub()
    setAppShellWidth('max-w-5xl')
    expect(cb).not.toHaveBeenCalled()
  })

  it('useAppShellWidth hook returns current width', async () => {
    const { useAppShellWidth, setAppShellWidth } = await import('./appShellWidth.js')
    setAppShellWidth('max-w-3xl')
    const { result } = renderHook(() => useAppShellWidth())
    expect(result.current).toBe('max-w-3xl')
  })

  it('useAppShellWidth hook updates when setAppShellWidth is called', async () => {
    const { useAppShellWidth, setAppShellWidth } = await import('./appShellWidth.js')
    setAppShellWidth('max-w-3xl')
    const { result } = renderHook(() => useAppShellWidth())
    expect(result.current).toBe('max-w-3xl')

    act(() => {
      setAppShellWidth('max-w-5xl')
    })
    expect(result.current).toBe('max-w-5xl')
  })
})
