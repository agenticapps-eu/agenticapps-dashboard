import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

import { MaskedToken } from './MaskedToken.js'

const SAMPLE_TOKEN = 'a1b2c3d4-e5f6-7890-1234-5678-abcd-ef01-2345-6789'

describe('MaskedToken', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // jsdom does not implement navigator.clipboard.writeText — stub it.
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders the value masked by default (no actual token in DOM text)', () => {
    render(<MaskedToken value={SAMPLE_TOKEN} label="Bearer token" />)
    expect(screen.queryByText(SAMPLE_TOKEN)).toBeNull()
    // The mask region is present and conveys "masked" semantically.
    expect(screen.getByLabelText(/Bearer token, masked/i)).toBeInTheDocument()
  })

  it('reveals the actual token when the Reveal button is clicked', () => {
    render(<MaskedToken value={SAMPLE_TOKEN} label="Bearer token" />)
    fireEvent.click(screen.getByRole('button', { name: /Reveal/i }))
    expect(screen.getByText(SAMPLE_TOKEN)).toBeInTheDocument()
  })

  it('auto-re-masks after exactly 5 seconds', () => {
    render(<MaskedToken value={SAMPLE_TOKEN} label="Bearer token" />)
    fireEvent.click(screen.getByRole('button', { name: /Reveal/i }))
    expect(screen.getByText(SAMPLE_TOKEN)).toBeInTheDocument()
    // Just before 5s: still revealed.
    act(() => { vi.advanceTimersByTime(4999) })
    expect(screen.queryByText(SAMPLE_TOKEN)).toBeInTheDocument()
    // At 5s: masked again.
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.queryByText(SAMPLE_TOKEN)).toBeNull()
  })

  it('manual Hide click cancels the auto-hide timer and re-masks immediately', () => {
    render(<MaskedToken value={SAMPLE_TOKEN} label="Bearer token" />)
    fireEvent.click(screen.getByRole('button', { name: /Reveal/i }))
    fireEvent.click(screen.getByRole('button', { name: /Hide/i }))
    expect(screen.queryByText(SAMPLE_TOKEN)).toBeNull()
    // Advancing past 5s does NOT re-reveal (timer was cancelled).
    vi.advanceTimersByTime(10_000)
    expect(screen.queryByText(SAMPLE_TOKEN)).toBeNull()
  })

  it('copies the actual value while masked (Copy works without reveal)', async () => {
    render(<MaskedToken value={SAMPLE_TOKEN} label="Bearer token" />)
    fireEvent.click(screen.getByRole('button', { name: /Copy/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(SAMPLE_TOKEN)
    // Component remains masked (Copy did NOT trigger reveal).
    expect(screen.queryByText(SAMPLE_TOKEN)).toBeNull()
  })

  it('Copy button is always visible (rendered in both masked and revealed states)', () => {
    const { rerender } = render(<MaskedToken value={SAMPLE_TOKEN} label="Bearer token" />)
    expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Reveal/i }))
    expect(screen.getByRole('button', { name: /Copy/i })).toBeInTheDocument()
    rerender(<MaskedToken value={SAMPLE_TOKEN} label="Bearer token" />)
  })

  it('clears the timer on unmount (no setState-after-unmount warning)', () => {
    const { unmount } = render(<MaskedToken value={SAMPLE_TOKEN} label="Bearer token" />)
    fireEvent.click(screen.getByRole('button', { name: /Reveal/i }))
    unmount()
    // Advancing the timer past 5s after unmount must not throw or warn.
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow()
  })

  it('uses anti-AI-slop classes only (no transition/animation utilities present)', () => {
    const { container } = render(<MaskedToken value={SAMPLE_TOKEN} label="Bearer token" />)
    const html = container.innerHTML
    expect(html).not.toMatch(/transition/)
    expect(html).not.toMatch(/animate-/)
    expect(html).not.toMatch(/duration-/)
  })
})
