/**
 * Tooltip.test.tsx — Contract tests for the hand-rolled Tooltip primitive.
 *
 * All 8 cases below are RED until Tooltip.tsx is authored (Task 2).
 * Tests mirror the Toast.test.tsx ergonomics: vitest + @testing-library/react +
 * vi.useFakeTimers() for delay-sensitive assertions.
 *
 * Implements TDD RED step for D-11.2-01..04 (open/close timing, ARIA, animation).
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { Tooltip } from './Tooltip.js'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Tooltip primitive', () => {
  it('renders trigger wrapping children with tabIndex=0', () => {
    render(<Tooltip content="hi">CLAUDE.md</Tooltip>)
    const trigger = screen.getByText('CLAUDE.md').closest('span[tabindex="0"]')
    expect(trigger).not.toBeNull()
    expect(trigger!.getAttribute('tabindex')).toBe('0')
    expect(trigger!.textContent).toContain('CLAUDE.md')
    expect(trigger!.className).toContain('border-b')
    expect(trigger!.className).toContain('border-dotted')
    expect(trigger!.className).toContain('border-text-tertiary')
    expect(trigger!.className).toContain('cursor-default')
  })

  it('panel is hidden on initial render (opacity-0 pointer-events-none, not unmounted)', () => {
    render(<Tooltip content="Project AI instructions file.">CLAUDE.md</Tooltip>)
    const panel = screen.getByRole('tooltip')
    expect(panel).not.toBeNull()
    expect(panel.className).toContain('opacity-0')
    expect(panel.className).toContain('pointer-events-none')
    expect(panel.textContent).toBe('Project AI instructions file.')
  })

  it('aria-describedby on trigger matches id on panel', () => {
    render(<Tooltip content="hi">label</Tooltip>)
    const trigger = screen.getByText('label').closest('span[tabindex="0"]')
    const panel = screen.getByRole('tooltip')
    expect(trigger).not.toBeNull()
    const describedBy = trigger!.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(describedBy).not.toBe('undefined')
    expect(panel.getAttribute('id')).toBe(describedBy)
  })

  it('opens on mouseenter after 100ms delay', () => {
    vi.useFakeTimers()
    render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]')!
    const panel = screen.getByRole('tooltip')

    act(() => { fireEvent.mouseEnter(trigger) })

    // At 50ms: still closed
    act(() => { vi.advanceTimersByTime(50) })
    expect(panel.className).toContain('opacity-0')

    // At 110ms total: should be open
    act(() => { vi.advanceTimersByTime(60) })
    expect(panel.className).not.toContain('opacity-0')
    expect(panel.className).toContain('opacity-100')
  })

  it('opens on focus after 100ms delay', () => {
    vi.useFakeTimers()
    render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]')!
    const panel = screen.getByRole('tooltip')

    act(() => { fireEvent.focus(trigger) })

    // At 50ms: still closed
    act(() => { vi.advanceTimersByTime(50) })
    expect(panel.className).toContain('opacity-0')

    // At 110ms total: should be open
    act(() => { vi.advanceTimersByTime(60) })
    expect(panel.className).not.toContain('opacity-0')
    expect(panel.className).toContain('opacity-100')
  })

  it('closes instantly on mouseleave', () => {
    vi.useFakeTimers()
    render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]')!
    const panel = screen.getByRole('tooltip')

    // Open the tooltip
    act(() => { fireEvent.mouseEnter(trigger) })
    act(() => { vi.advanceTimersByTime(110) })
    expect(panel.className).toContain('opacity-100')

    // Close instantly
    act(() => { fireEvent.mouseLeave(trigger) })
    expect(panel.className).toContain('opacity-0')
  })

  it('closes instantly on Escape key', () => {
    vi.useFakeTimers()
    render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]')!
    const panel = screen.getByRole('tooltip')

    // Open the tooltip
    act(() => { fireEvent.mouseEnter(trigger) })
    act(() => { vi.advanceTimersByTime(110) })
    expect(panel.className).toContain('opacity-100')

    // Escape key closes instantly
    act(() => { fireEvent.keyDown(trigger, { key: 'Escape' }) })
    expect(panel.className).toContain('opacity-0')
  })

  it('tooltip panel uses tokens-only colors (no hex literals)', () => {
    render(<Tooltip content="hi">trigger</Tooltip>)
    const panel = screen.getByRole('tooltip')
    expect(panel.className).toContain('bg-card-bg')
    expect(panel.className).toContain('border-border-subtle')
    expect(panel.className).toContain('text-text-primary')
    expect(panel.className).not.toMatch(/#[0-9a-fA-F]/)
  })

  it('renders panel in document.body via portal (escapes table-fixed cell)', () => {
    render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]')!
    const panel = screen.getByRole('tooltip')
    // Panel is NOT a descendant of the trigger (it lives in the portal)
    expect(trigger.contains(panel)).toBe(false)
    // Panel IS mounted directly under document.body
    expect(panel.parentElement).toBe(document.body)
  })

  it('panel uses position: fixed (not absolute) so cell width does not constrain it', () => {
    render(<Tooltip content="hi">trigger</Tooltip>)
    const panel = screen.getByRole('tooltip')
    expect(panel.className).toContain('fixed')
    expect(panel.className).not.toContain('absolute')
    expect(panel.className).toContain('max-w-xs')
  })

  it('positions panel using viewport coords from getBoundingClientRect on open', () => {
    vi.useFakeTimers()
    render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]') as HTMLElement
    const panel = screen.getByRole('tooltip') as HTMLElement
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 120, left: 50, right: 90, width: 40, height: 20,
      x: 50, y: 100, toJSON() { return {} },
    } as DOMRect)

    act(() => { fireEvent.mouseEnter(trigger) })
    act(() => { vi.advanceTimersByTime(110) })

    // top = rect.bottom + 4 (mt-1 gap), left = rect.left
    expect(panel.style.top).toBe('124px')
    expect(panel.style.left).toBe('50px')
  })

  it('re-measures panel position on window scroll while open', () => {
    vi.useFakeTimers()
    render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]') as HTMLElement
    const panel = screen.getByRole('tooltip') as HTMLElement

    const rect = vi.spyOn(trigger, 'getBoundingClientRect')
    rect.mockReturnValue({
      top: 100, bottom: 120, left: 50, right: 90, width: 40, height: 20,
      x: 50, y: 100, toJSON() { return {} },
    } as DOMRect)

    act(() => { fireEvent.mouseEnter(trigger) })
    act(() => { vi.advanceTimersByTime(110) })
    expect(panel.style.top).toBe('124px')

    // Simulate scroll: trigger now 40px higher in viewport.
    rect.mockReturnValue({
      top: 60, bottom: 80, left: 50, right: 90, width: 40, height: 20,
      x: 50, y: 60, toJSON() { return {} },
    } as DOMRect)
    act(() => { window.dispatchEvent(new Event('scroll')) })

    expect(panel.style.top).toBe('84px')
  })

  it('re-measures panel position on window resize while open', () => {
    vi.useFakeTimers()
    render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]') as HTMLElement
    const panel = screen.getByRole('tooltip') as HTMLElement

    const rect = vi.spyOn(trigger, 'getBoundingClientRect')
    rect.mockReturnValue({
      top: 100, bottom: 120, left: 50, right: 90, width: 40, height: 20,
      x: 50, y: 100, toJSON() { return {} },
    } as DOMRect)

    act(() => { fireEvent.mouseEnter(trigger) })
    act(() => { vi.advanceTimersByTime(110) })
    expect(panel.style.top).toBe('124px')

    rect.mockReturnValue({
      top: 200, bottom: 220, left: 70, right: 110, width: 40, height: 20,
      x: 70, y: 200, toJSON() { return {} },
    } as DOMRect)
    act(() => { window.dispatchEvent(new Event('resize')) })

    expect(panel.style.top).toBe('224px')
    expect(panel.style.left).toBe('70px')
  })

  it('closes instantly on blur', () => {
    vi.useFakeTimers()
    render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]')!
    const panel = screen.getByRole('tooltip')

    act(() => { fireEvent.focus(trigger) })
    act(() => { vi.advanceTimersByTime(110) })
    expect(panel.className).toContain('opacity-100')

    act(() => { fireEvent.blur(trigger) })
    expect(panel.className).toContain('opacity-0')
  })

  it('clears the open timer on unmount (no setState after unmount)', () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]')!

    // Start the 100ms open timer, then unmount before it fires.
    act(() => { fireEvent.mouseEnter(trigger) })
    unmount()
    act(() => { vi.advanceTimersByTime(500) })

    // The cleanup must have cleared the timer — no "setState on unmounted" warning.
    expect(errorSpy).not.toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})
