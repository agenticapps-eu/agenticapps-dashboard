/**
 * PanelContainer.test.tsx — TDD tests for PanelContainer shared section wrapper.
 *
 * Tests PC1–PC7:
 * PC1: renders a <section> with aria-labelledby matching {panelId}-title
 * PC2: renders <h2 id="{panelId}-title"> with spec class string
 * PC3: <section> has spec class string
 * PC4: renders children after the title
 * PC5: stale prop renders 'Stale' pill
 * PC6: unreachable prop renders AlertTriangle + 'Agent unreachable — retrying...'
 * PC7: neither flag → no extra elements
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

import { PanelContainer } from './PanelContainer.js'

describe('PanelContainer', () => {
  it('PC1: renders a <section> with aria-labelledby matching {panelId}-title', () => {
    render(
      <PanelContainer panelId="test-panel" title="Test Panel">
        <p>content</p>
      </PanelContainer>,
    )
    const section = screen.getByRole('region', { name: 'Test Panel' })
    expect(section).toBeDefined()
    expect(section.getAttribute('aria-labelledby')).toBe('test-panel-title')
  })

  it('PC2: renders <h2> with spec class string including text-lg font-semibold leading-snug text-text-primary (Wave 3 repalette)', () => {
    render(
      <PanelContainer panelId="commitment" title="Commitment">
        <p>content</p>
      </PanelContainer>,
    )
    const heading = screen.getByRole('heading', { level: 2, name: 'Commitment' })
    expect(heading).toBeDefined()
    expect(heading.id).toBe('commitment-title')
    expect(heading.className).toContain('text-lg')
    expect(heading.className).toContain('font-semibold')
    expect(heading.className).toContain('leading-snug')
    expect(heading.className).toContain('text-text-primary')
  })

  it('PC3: <section> has new card chrome — rounded-card bg-card-bg shadow-card p-6 flex flex-col gap-4 (Wave 3 repalette, no border)', () => {
    render(
      <PanelContainer panelId="hook-firings" title="Hook Firings">
        <p>content</p>
      </PanelContainer>,
    )
    const section = screen.getByRole('region', { name: 'Hook Firings' })
    expect(section.className).toContain('rounded-card')
    expect(section.className).toContain('bg-card-bg')
    expect(section.className).toContain('shadow-card')
    expect(section.className).toContain('p-6')
    expect(section.className).toContain('flex')
    expect(section.className).toContain('flex-col')
    expect(section.className).toContain('gap-4')
  })

  it('PC4: renders children after the title', () => {
    render(
      <PanelContainer panelId="rationalization-fires" title="Rationalization Fires">
        <p data-testid="child-content">hello world</p>
      </PanelContainer>,
    )
    const child = screen.getByTestId('child-content')
    expect(child).toBeDefined()
    expect(child.textContent).toBe('hello world')
  })

  it('PC5: when stale=true, renders a "Stale" pill with warning styling', () => {
    render(
      <PanelContainer panelId="commitment" title="Commitment" stale>
        <p>content</p>
      </PanelContainer>,
    )
    const stalePill = screen.getByText('Stale')
    expect(stalePill).toBeDefined()
    expect(stalePill.tagName).toBe('SPAN')
    expect(stalePill.className).toContain('text-xs')
    expect(stalePill.className).toContain('font-semibold')
    expect(stalePill.className).toContain('rounded')
  })

  it('PC6: when unreachable=true, renders AlertTriangle + "Agent unreachable — retrying..." text', () => {
    render(
      <PanelContainer panelId="hook-firings" title="Hook Firings" unreachable>
        <p>content</p>
      </PanelContainer>,
    )
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('PC7: when neither stale nor unreachable, no stale/unreachable elements present', () => {
    render(
      <PanelContainer panelId="commitment" title="Commitment">
        <p>content</p>
      </PanelContainer>,
    )
    expect(screen.queryByText('Stale')).toBeNull()
    expect(screen.queryByText('Agent unreachable — retrying...')).toBeNull()
  })
})

describe('D-6.1-02 progressive disclosure', () => {
  it('D6102-a: renders body immediately when defaultCollapsed is omitted (back-compat default)', () => {
    render(
      <PanelContainer panelId="p1" title="X">
        <p>body</p>
      </PanelContainer>,
    )
    expect(screen.getByText('body')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('D6102-b: renders body immediately when defaultCollapsed=false', () => {
    render(
      <PanelContainer panelId="p1" title="X" defaultCollapsed={false}>
        <p>body</p>
      </PanelContainer>,
    )
    expect(screen.getByText('body')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('D6102-c: hides body when defaultCollapsed=true on initial mount', () => {
    render(
      <PanelContainer panelId="p1" title="X" defaultCollapsed>
        <p>body</p>
      </PanelContainer>,
    )
    expect(screen.queryByText('body')).toBeNull()
    expect(screen.getByRole('button', { name: /X/ })).toBeInTheDocument()
  })

  it('D6102-d: expands body when the disclosure header button is clicked', () => {
    render(
      <PanelContainer panelId="p1" title="X" defaultCollapsed>
        <p>body</p>
      </PanelContainer>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('D6102-e: header button carries correct aria-expanded and aria-controls', () => {
    render(
      <PanelContainer panelId="p1" title="X" defaultCollapsed>
        <p>body</p>
      </PanelContainer>,
    )
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(btn).toHaveAttribute('aria-controls', 'p1-body')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
  })

  it('D6102-f: does NOT read or write localStorage', () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem')
    const setSpy = vi.spyOn(Storage.prototype, 'setItem')
    render(
      <PanelContainer panelId="p1" title="X" defaultCollapsed>
        <p>body</p>
      </PanelContainer>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(getSpy).not.toHaveBeenCalled()
    expect(setSpy).not.toHaveBeenCalled()
    getSpy.mockRestore()
    setSpy.mockRestore()
  })

  it('D6102-g: Stale pill remains visible when collapsed', () => {
    render(
      <PanelContainer panelId="p1" title="X" defaultCollapsed stale>
        <p>body</p>
      </PanelContainer>,
    )
    expect(screen.getByText('Stale')).toBeInTheDocument()
  })

  it('D6102-h: chevron icon uses no transition or rotation utilities (anti-AI-slop)', () => {
    const { container } = render(
      <PanelContainer panelId="p1" title="X" defaultCollapsed>
        <p>body</p>
      </PanelContainer>,
    )
    // Inspect classes on every svg in the disclosure header (chevron is the only one)
    const svgs = Array.from(container.querySelectorAll('svg'))
    expect(svgs.length).toBeGreaterThan(0)
    svgs.forEach((svg) => {
      const c = svg.getAttribute('class') ?? ''
      expect(c).not.toMatch(/transition|rotate|animate-|motion-/)
    })
  })

  it('D6102-i: collapsedHint renders in the header when collapsed (state visible at a glance)', () => {
    render(
      <PanelContainer panelId="p1" title="X" defaultCollapsed collapsedHint="not configured">
        <p>body</p>
      </PanelContainer>,
    )
    // Body still hidden, but the state hint is visible without expanding
    expect(screen.queryByText('body')).toBeNull()
    expect(screen.getByText('not configured')).toBeInTheDocument()
  })

  it('D6102-j: collapsedHint is hidden once the panel is expanded (full content takes over)', () => {
    render(
      <PanelContainer panelId="p1" title="X" defaultCollapsed collapsedHint="not configured">
        <p>body</p>
      </PanelContainer>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('body')).toBeInTheDocument()
    expect(screen.queryByText('not configured')).toBeNull()
  })

  it('D6102-k: no collapsedHint → no hint text (back-compat)', () => {
    render(
      <PanelContainer panelId="p1" title="X" defaultCollapsed>
        <p>body</p>
      </PanelContainer>,
    )
    expect(screen.queryByText('not configured')).toBeNull()
  })
})
