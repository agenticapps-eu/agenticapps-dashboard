/**
 * OverrideChip.test.tsx — Tests for conditional override chip.
 *
 * Pitfall 5: count=0 must render nothing.
 * UI-SPEC §5: expand/collapse + ARIA.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import type { OverrideEntry } from '@agenticapps/dashboard-shared'
import { OverrideChip } from './OverrideChip.js'

const SAMPLE_OVERRIDES: OverrideEntry[] = [
  { phaseSlug: '10-coverage-matrix', sinceIso: '2026-04-01T00:00:00Z', source: 'mtime' },
  { phaseSlug: '09-help-docs', sinceIso: '2026-03-15T00:00:00Z', source: 'git-log' },
]

describe('OverrideChip', () => {
  it('renders nothing when overrideCount === 0 (conditional render guard)', () => {
    const { container } = render(
      <OverrideChip count={0} overrides={[]} repoName="my-repo" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders chip with count badge when overrideCount > 0', () => {
    render(
      <OverrideChip count={2} overrides={SAMPLE_OVERRIDES} repoName="my-repo" />,
    )
    expect(screen.getByRole('button')).toBeTruthy()
    expect(screen.getByText(/2 overrides/i)).toBeTruthy()
  })

  it('clicking the chip expands to show the list of override entries with phaseSlug + sinceIso', () => {
    render(
      <OverrideChip count={2} overrides={SAMPLE_OVERRIDES} repoName="my-repo" />,
    )
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/10-coverage-matrix/)).toBeTruthy()
    expect(screen.getByText(/09-help-docs/)).toBeTruthy()
  })

  it('clicking the chip again collapses the expanded list', () => {
    render(
      <OverrideChip count={2} overrides={SAMPLE_OVERRIDES} repoName="my-repo" />,
    )
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
  })

  it('has correct ARIA attributes: aria-expanded on toggle button, accessible list role on entries', () => {
    render(
      <OverrideChip count={1} overrides={[SAMPLE_OVERRIDES[0]]} repoName="agenticapps-dash" />,
    )
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('aria-expanded')).toBeTruthy()
    expect(btn.getAttribute('aria-label')).toContain('1 phase review')
    expect(btn.getAttribute('aria-label')).toContain('agenticapps-dash')
  })
})
