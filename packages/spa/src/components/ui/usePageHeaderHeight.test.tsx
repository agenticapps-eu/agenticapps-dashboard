import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { useRef } from 'react'
import { usePageHeaderHeight } from './usePageHeaderHeight'
import { triggerLastResizeObserver, activeResizeObserverCount } from '../../vitest.setup'

function TestHost({ skip = false }: { skip?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null)
  usePageHeaderHeight(skip ? { current: null } : ref)
  return <div ref={skip ? undefined : ref} data-testid="host" />
}

beforeEach(() => {
  document.documentElement.style.removeProperty('--ph-h')
})

afterEach(() => {
  document.documentElement.style.removeProperty('--ph-h')
})

describe('usePageHeaderHeight (PD-11.1-03 revised harness)', () => {
  it('publishes --ph-h on first ResizeObserver callback', () => {
    render(<TestHost />)
    triggerLastResizeObserver(110)
    expect(document.documentElement.style.getPropertyValue('--ph-h')).toBe('110px')
  })

  it('rounds fractional heights to nearest pixel', () => {
    render(<TestHost />)
    triggerLastResizeObserver(112.4)
    expect(document.documentElement.style.getPropertyValue('--ph-h')).toBe('112px')
    triggerLastResizeObserver(112.6)
    expect(document.documentElement.style.getPropertyValue('--ph-h')).toBe('113px')
  })

  it('updates --ph-h on every subsequent resize tick', () => {
    render(<TestHost />)
    triggerLastResizeObserver(56)
    expect(document.documentElement.style.getPropertyValue('--ph-h')).toBe('56px')
    triggerLastResizeObserver(110)
    expect(document.documentElement.style.getPropertyValue('--ph-h')).toBe('110px')
  })

  it('is a no-op when ref.current is null at effect time', () => {
    render(<TestHost skip />)
    expect(activeResizeObserverCount()).toBe(0)
    expect(document.documentElement.style.getPropertyValue('--ph-h')).toBe('')
  })

  it('disconnects observer AND resets --ph-h to 56px default on unmount (PD-11.1-01)', () => {
    const { unmount } = render(<TestHost />)
    triggerLastResizeObserver(110)
    expect(document.documentElement.style.getPropertyValue('--ph-h')).toBe('110px')
    const before = activeResizeObserverCount()
    unmount()
    expect(activeResizeObserverCount()).toBeLessThan(before)
    expect(document.documentElement.style.getPropertyValue('--ph-h')).toBe('56px')
  })
})
