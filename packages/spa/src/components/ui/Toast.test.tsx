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
  })

  it('renders a success toast with role=status aria-live=polite after show()', () => {
    const toast = mount()
    act(() => {
      toast.show({ message: 'Copied', variant: 'success' })
    })
    const el = screen.getByRole('status')
    expect(el).toHaveTextContent('Copied')
    expect(el).toHaveAttribute('aria-live', 'polite')
  })

  it('renders an error toast with aria-live=assertive', () => {
    const toast = mount()
    act(() => {
      toast.show({ message: 'Copy failed', variant: 'error' })
    })
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'assertive')
  })

  it('defaults variant to success when omitted', () => {
    const toast = mount()
    act(() => {
      toast.show({ message: 'Hi' })
    })
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
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
    expect(screen.getByRole('status').textContent).toMatch(/✕/)
  })

  it('uses opacity-only transition (no bounce, no slide)', () => {
    const toast = mount()
    act(() => { toast.show({ message: 'X' }) })
    const el = screen.getByRole('status')
    expect(el.className).toMatch(/transition-opacity/)
    expect(el.className).not.toMatch(/animate-bounce/)
    expect(el.className).not.toMatch(/translate/)
  })

  it('throws a helpful error when useToast is called outside ToastProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestHarness onReady={() => {}} />)).toThrow(/ToastProvider/)
    consoleError.mockRestore()
  })
})
