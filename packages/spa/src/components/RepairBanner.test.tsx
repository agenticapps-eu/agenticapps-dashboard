import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, type ReactNode } from 'react'

import { RepairProvider, useRepair } from '../lib/repair.js'

import { RepairBanner } from './RepairBanner.js'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}))

function Wrapper({ children }: { children: ReactNode }) {
  return <RepairProvider>{children}</RepairProvider>
}

/** Helper: render RepairBanner inside RepairProvider; returns the hook result for manipulation */
function renderBanner() {
  // Use a mutable container (object property mutation, not variable reassignment)
  // so react-hooks/globals doesn't flag the capture as a render-time side effect.
  const captured: { repair?: ReturnType<typeof useRepair> } = {}

  function Inner() {
    const repair = useRepair()
    useEffect(() => {
      captured.repair = repair
    }, [repair])
    return <RepairBanner />
  }

  render(
    <Wrapper>
      <Inner />
    </Wrapper>,
  )

  return () => captured.repair!
}

describe('RepairBanner', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('renders nothing when needsRepair=false', () => {
    renderBanner()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it("renders banner with verbatim copy 'Agent token rejected.' when needsRepair=true and not dismissed", () => {
    const getHook = renderBanner()
    act(() => getHook().setNeedsRepair(true))
    expect(screen.getByText('Agent token rejected.')).toBeInTheDocument()
  })

  it("Re-pair button has verbatim aria-label 'Re-pair (open onboarding)'", () => {
    const getHook = renderBanner()
    act(() => getHook().setNeedsRepair(true))
    expect(
      screen.getByRole('button', { name: 'Re-pair (open onboarding)' }),
    ).toBeInTheDocument()
  })

  it('Re-pair button calls clear() and navigates to /onboarding', async () => {
    const user = userEvent.setup()
    const getHook = renderBanner()
    act(() => getHook().setNeedsRepair(true))
    await user.click(screen.getByRole('button', { name: 'Re-pair (open onboarding)' }))
    expect(getHook().needsRepair).toBe(false)
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/onboarding' })
  })

  it("Dismiss button has verbatim aria-label 'Dismiss banner (will return on next 401)'", () => {
    const getHook = renderBanner()
    act(() => getHook().setNeedsRepair(true))
    expect(
      screen.getByRole('button', { name: 'Dismiss banner (will return on next 401)' }),
    ).toBeInTheDocument()
  })

  it('Dismiss button click hides banner (sets dismissed=true)', async () => {
    const user = userEvent.setup()
    const getHook = renderBanner()
    act(() => getHook().setNeedsRepair(true))
    await user.click(
      screen.getByRole('button', { name: 'Dismiss banner (will return on next 401)' }),
    )
    expect(getHook().dismissed).toBe(true)
    expect(screen.queryByText('Agent token rejected.')).toBeNull()
  })

  it('Esc keypress while banner visible triggers dismiss', () => {
    const getHook = renderBanner()
    act(() => getHook().setNeedsRepair(true))
    expect(screen.getByText('Agent token rejected.')).toBeInTheDocument()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(getHook().dismissed).toBe(true)
  })

  it('Esc keypress while banner hidden does NOT trigger dismiss', () => {
    const getHook = renderBanner()
    // Banner is hidden (needsRepair=false), listener should not be attached
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    // dismissed should remain false — no listener was registered
    expect(getHook().dismissed).toBe(false)
  })

  it('icon uses status-error color (not status-warning)', () => {
    const getHook = renderBanner()
    act(() => getHook().setNeedsRepair(true))
    const dangerIcon = document.querySelector('.text-status-error')
    expect(dangerIcon).not.toBeNull()
    const warningIcon = document.querySelector('.text-status-warning')
    expect(warningIcon).toBeNull()
  })
})
