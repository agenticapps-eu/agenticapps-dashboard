/**
 * Tooltip.test.tsx — Contract tests for the hand-rolled Tooltip primitive.
 *
 * All 8 cases below are RED until Tooltip.tsx is authored (Task 2).
 * Tests mirror the Toast.test.tsx ergonomics: vitest + @testing-library/react +
 * vi.useFakeTimers() for delay-sensitive assertions.
 *
 * Implements TDD RED step for D-11.2-01..04 (open/close timing, ARIA, animation).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
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

    fireEvent.mouseEnter(trigger)

    // At 50ms: still closed
    vi.advanceTimersByTime(50)
    expect(panel.className).toContain('opacity-0')

    // At 110ms total: should be open
    vi.advanceTimersByTime(60)
    expect(panel.className).not.toContain('opacity-0')
    expect(panel.className).toContain('opacity-100')
  })

  it('opens on focus after 100ms delay', () => {
    vi.useFakeTimers()
    render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]')!
    const panel = screen.getByRole('tooltip')

    fireEvent.focus(trigger)

    // At 50ms: still closed
    vi.advanceTimersByTime(50)
    expect(panel.className).toContain('opacity-0')

    // At 110ms total: should be open
    vi.advanceTimersByTime(60)
    expect(panel.className).not.toContain('opacity-0')
    expect(panel.className).toContain('opacity-100')
  })

  it('closes instantly on mouseleave', () => {
    vi.useFakeTimers()
    render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]')!
    const panel = screen.getByRole('tooltip')

    // Open the tooltip
    fireEvent.mouseEnter(trigger)
    vi.advanceTimersByTime(110)
    expect(panel.className).toContain('opacity-100')

    // Close instantly
    fireEvent.mouseLeave(trigger)
    expect(panel.className).toContain('opacity-0')
  })

  it('closes instantly on Escape key', () => {
    vi.useFakeTimers()
    render(<Tooltip content="hi">trigger</Tooltip>)
    const trigger = screen.getByText('trigger').closest('span[tabindex="0"]')!
    const panel = screen.getByRole('tooltip')

    // Open the tooltip
    fireEvent.mouseEnter(trigger)
    vi.advanceTimersByTime(110)
    expect(panel.className).toContain('opacity-100')

    // Escape key closes instantly
    fireEvent.keyDown(trigger, { key: 'Escape' })
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
})
