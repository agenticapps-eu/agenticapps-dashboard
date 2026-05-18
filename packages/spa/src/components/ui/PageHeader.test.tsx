/**
 * PageHeader.test.tsx — TDD tests for PageHeader (Plan 05.1-02 Task 1).
 *
 * PH1: renders title in <h1> with text-2xl + font-semibold
 * PH2: renders helper in <p> with text-sm + text-text-tertiary
 * PH3: renders actions slot on the right
 * PH4: bottom margin 24px (mb-6)
 * PH5: optional children render below the title row
 *
 * Phase 11 PLI-01 / D-11-09 additions:
 * PH-S1..PH-S5: optional sticky?: boolean prop (default false — preserves
 * current behavior on every route that has not opted in).
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { PageHeader } from './PageHeader.js'

describe('PageHeader', () => {
  it('PH1: renders title in <h1> with text-2xl font-semibold', () => {
    render(<PageHeader title="All Projects" />)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toBeDefined()
    expect(h1.textContent).toBe('All Projects')
    expect(h1.className).toContain('text-2xl')
    expect(h1.className).toContain('font-semibold')
  })

  it('PH2: renders helper text in <p> with text-sm text-text-tertiary', () => {
    render(<PageHeader title="All Projects" helper="4 registered projects" />)
    const helper = screen.getByText('4 registered projects')
    expect(helper.tagName).toBe('P')
    expect(helper.className).toContain('text-sm')
    expect(helper.className).toContain('text-text-tertiary')
  })

  it('PH2b: does NOT render a <p> when helper is omitted', () => {
    const { container } = render(<PageHeader title="Settings" />)
    expect(container.querySelector('p')).toBeNull()
  })

  it('PH3: renders actions slot on the right', () => {
    render(
      <PageHeader
        title="All Projects"
        actions={<button type="button" data-testid="register-btn">Register</button>}
      />,
    )
    expect(screen.getByTestId('register-btn')).toBeDefined()
  })

  it('PH4: outer wrapper has mb-6 (24px bottom margin)', () => {
    const { container } = render(<PageHeader title="Settings" />)
    const outer = container.firstElementChild!
    expect(outer.className).toContain('mb-6')
  })

  it('PH5: optional children render below the title row', () => {
    render(
      <PageHeader title="All Projects">
        <div data-testid="filter-chips">Filter chips</div>
      </PageHeader>,
    )
    expect(screen.getByTestId('filter-chips')).toBeDefined()
  })

  // Phase 11 PLI-01 / D-11-09 — sticky?: boolean prop (default false).

  it('PH-S1: <PageHeader title="X" /> (no sticky prop) — outer div has mb-6 flex flex-col gap-1 AND does NOT contain "sticky"', () => {
    const { container } = render(<PageHeader title="All Projects" />)
    const outer = container.firstElementChild!
    expect(outer.className).toContain('mb-6')
    expect(outer.className).toContain('flex')
    expect(outer.className).toContain('flex-col')
    expect(outer.className).toContain('gap-1')
    // Backward-compat default — no sticky behaviour leaks in.
    expect(outer.className).not.toContain('sticky')
    expect(outer.className).not.toContain('top-0')
    expect(outer.className).not.toContain('z-10')
    expect(outer.className).not.toContain('bg-app-bg')
  })

  it('PH-S2: <PageHeader title="X" sticky={false} /> — explicit false matches default (regression guard for opt-in pattern)', () => {
    const { container } = render(<PageHeader title="All Projects" sticky={false} />)
    const outer = container.firstElementChild!
    expect(outer.className).toContain('mb-6')
    expect(outer.className).not.toContain('sticky')
    expect(outer.className).not.toContain('top-0')
    expect(outer.className).not.toContain('z-10')
    expect(outer.className).not.toContain('bg-app-bg')
  })

  it('PH-S3: <PageHeader title="X" sticky={true} /> — outer div has the sticky stack (sticky, negative top-offset, z-10, bg-app-bg, -mt-6 backstop)', () => {
    const { container } = render(<PageHeader title="All Projects" sticky={true} />)
    const outer = container.firstElementChild!
    // Sticky positioning + the four supporting tokens.
    // Post-UAT layering fix: the literal `top-0` token was replaced with
    // `top-[-1.5rem]` to lower the sticky-floor by 24px (cancelling
    // AppShellV2 <main>'s p-6 padding-top so the title sits flush with
    // TopBar/RepairBanner). `-mt-6` pulls natural-flow position to match
    // the new floor. `min-h-14` guarantees the bg-app-bg backstop covers
    // down to the family-header's stick-line at top-14.
    expect(outer.className).toContain('sticky')
    expect(outer.className).toContain('top-[-1.5rem]')
    expect(outer.className).toContain('z-10')
    expect(outer.className).toContain('bg-app-bg')
    expect(outer.className).toContain('-mt-6')
    expect(outer.className).toContain('min-h-14')
  })

  it('PH-S4: mb-6 24px bottom margin is preserved in BOTH sticky and non-sticky modes (CONTEXT §Specifics)', () => {
    const { container: nonSticky } = render(<PageHeader title="X" />)
    expect(nonSticky.firstElementChild!.className).toContain('mb-6')

    const { container: sticky } = render(<PageHeader title="X" sticky={true} />)
    expect(sticky.firstElementChild!.className).toContain('mb-6')
  })

  it('PH-S5: existing helper + actions + children render unchanged with sticky={true}', () => {
    render(
      <PageHeader
        title="Coverage"
        helper="Per-repo knowledge-layer freshness"
        actions={<button type="button" data-testid="refresh-btn">Refresh</button>}
        sticky={true}
      >
        <div data-testid="filter-chips">Filter chips</div>
      </PageHeader>,
    )
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Coverage')
    expect(screen.getByText('Per-repo knowledge-layer freshness')).toBeDefined()
    expect(screen.getByTestId('refresh-btn')).toBeDefined()
    expect(screen.getByTestId('filter-chips')).toBeDefined()
  })
})
