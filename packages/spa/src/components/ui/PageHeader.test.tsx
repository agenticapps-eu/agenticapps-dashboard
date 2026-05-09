/**
 * PageHeader.test.tsx — TDD tests for PageHeader (Plan 05.1-02 Task 1).
 *
 * PH1: renders title in <h1> with text-2xl + font-semibold
 * PH2: renders helper in <p> with text-sm + text-text-tertiary
 * PH3: renders actions slot on the right
 * PH4: bottom margin 24px (mb-6)
 * PH5: optional children render below the title row
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
})
