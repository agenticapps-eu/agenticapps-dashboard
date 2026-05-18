import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'
import { ToastProvider, useToast } from './Toast.js'

function TestHarness({ onReady }: { onReady: (toast: ReturnType<typeof useToast>) => void }) {
  const toast = useToast()
  onReady(toast)
  return null
}

function mount(): ReturnType<typeof useToast> {
  let captured!: ReturnType<typeof useToast>
  render(
    <ToastProvider>
      <TestHarness onReady={(t) => { captured = t }} />
    </ToastProvider>,
  )
  return captured!
}

describe('Toast primitive', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('renders nothing initially (no toast container in DOM until show() is called)', () => {
    mount()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders a success toast with role=status (implicit aria-live=polite) after show()', () => {
    const toast = mount()
    act(() => {
      toast.show({ message: 'Copied', variant: 'success' })
    })
    const el = screen.getByRole('status')
    expect(el).toHaveTextContent('Copied')
    // role="status" implies aria-live="polite" per WAI-ARIA 1.2 §5.3.3 — we
    // intentionally do NOT also set aria-live on this element (Stage 2 review).
  })

  it('renders an error toast with role=alert (implicit aria-live=assertive)', () => {
    const toast = mount()
    act(() => {
      toast.show({ message: 'Copy failed', variant: 'error' })
    })
    // role="alert" implies aria-live="assertive" — preferred over role=status +
    // explicit aria-live=assertive which screen readers handle inconsistently.
    expect(screen.getByRole('alert')).toHaveTextContent('Copy failed')
  })

  it('defaults variant to success (role=status) when omitted', () => {
    const toast = mount()
    act(() => {
      toast.show({ message: 'Hi' })
    })
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('auto-dismisses after default duration (2400ms)', () => {
    const toast = mount()
    act(() => {
      toast.show({ message: 'X' })
    })
    expect(screen.queryByRole('status')).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(2400 + 250)
    })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('honors custom duration', () => {
    const toast = mount()
    act(() => {
      toast.show({ message: 'X', duration: 500 })
    })
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.queryByRole('status')).not.toBeNull()
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('replaces current toast on rapid second show()', () => {
    const toast = mount()
    act(() => { toast.show({ message: 'first' }) })
    expect(screen.getByRole('status')).toHaveTextContent('first')
    act(() => { toast.show({ message: 'second' }) })
    expect(screen.getByRole('status')).toHaveTextContent('second')
    expect(screen.queryAllByRole('status')).toHaveLength(1)
  })

  it('renders ✓ glyph for success', () => {
    const toast = mount()
    act(() => { toast.show({ message: 'X', variant: 'success' }) })
    expect(screen.getByRole('status').textContent).toMatch(/✓/)
  })

  it('renders ✕ glyph for error', () => {
    const toast = mount()
    act(() => { toast.show({ message: 'X', variant: 'error' }) })
    expect(screen.getByRole('alert').textContent).toMatch(/✕/)
  })

  it('uses opacity-only transition guarded by motion-safe (no bounce, no slide)', () => {
    const toast = mount()
    act(() => { toast.show({ message: 'X' }) })
    const el = screen.getByRole('status')
    expect(el.className).toMatch(/motion-safe:transition-opacity/)
    expect(el.className).not.toMatch(/animate-bounce/)
    expect(el.className).not.toMatch(/translate/)
  })

  it('throws a helpful error when useToast is called outside ToastProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestHarness onReady={() => {}} />)).toThrow(/ToastProvider/)
    consoleError.mockRestore()
  })
})
