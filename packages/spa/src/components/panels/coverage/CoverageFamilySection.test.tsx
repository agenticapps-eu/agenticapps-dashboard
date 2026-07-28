import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompatibleCoverageRow } from '@agenticapps/dashboard-shared'

vi.mock('../../../lib/useViewportBreakpoint.js', () => ({
  useViewportBreakpoint: vi.fn(() => 'lg'),
}))
vi.mock('../../../lib/coverageHistoryQueries.js', () => ({
  useCoverageHistory: vi.fn(() => ({ data: undefined })),
}))

import { ToastProvider } from '../../ui/Toast.js'
import { useViewportBreakpoint } from '../../../lib/useViewportBreakpoint.js'
import { CoverageFamilySection } from './CoverageFamilySection.js'

const rows: CompatibleCoverageRow[] = [
  {
    family: 'agenticapps',
    repo: 'dashboard',
    claudeMd: { kind: 'basic', state: 'fresh' },
    workflowVersion: {
      kind: 'workflow',
      state: 'stale',
      installedVersion: '2.5.0',
      headVersion: '3.0.0',
    },
    understand: { kind: 'basic', state: 'missing' },
    overrideCount: 0,
    overrides: [],
  },
]

describe('CoverageFamilySection desktop', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(useViewportBreakpoint).mockReturnValue('lg')
  })

  it('renders only current headers and cells', () => {
    render(
      <ToastProvider>
        <CoverageFamilySection family="agenticapps" rows={rows} />
      </ToastProvider>,
    )

    expect(screen.getByRole('columnheader', { name: 'Repo' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'CLAUDE.md' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Workflow' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Understand' })).toBeTruthy()
    expect(screen.queryByRole('columnheader', { name: /GitNexus/i })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: /Wiki/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /scan|refresh/i })).toBeNull()
  })

  it('uses the retained four-column fixed table layout', () => {
    const { container } = render(
      <ToastProvider>
        <CoverageFamilySection family="agenticapps" rows={rows} />
      </ToastProvider>,
    )

    expect(container.querySelector('table')?.className).toContain('table-fixed')
    expect(container.querySelectorAll('colgroup col')).toHaveLength(4)
  })

  it('restores and persists collapsed state per family', async () => {
    localStorage.setItem('coverage:section-collapsed:agenticapps', 'true')
    render(
      <ToastProvider>
        <CoverageFamilySection family="agenticapps" rows={rows} />
      </ToastProvider>,
    )

    const toggle = screen.getByRole('button', { name: /agenticapps/i })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('table')).toBeNull()

    fireEvent.click(toggle)
    expect(screen.getByRole('table')).toBeTruthy()
    await waitFor(() =>
      expect(localStorage.getItem('coverage:section-collapsed:agenticapps')).toBe('false'),
    )
  })

  it('counts each row by its worst current state', () => {
    render(
      <ToastProvider>
        <CoverageFamilySection family="agenticapps" rows={rows} />
      </ToastProvider>,
    )

    expect(screen.getByText('✕ 1')).toBeTruthy()
    expect(screen.getByText('⚠ 0')).toBeTruthy()
    expect(screen.getByText('✓ 0')).toBeTruthy()
  })

  it('switches to the mobile card layout at the smallest breakpoint', () => {
    vi.mocked(useViewportBreakpoint).mockReturnValue('xs')
    render(
      <ToastProvider>
        <CoverageFamilySection family="agenticapps" rows={rows} />
      </ToastProvider>,
    )

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('dashboard')).toBeTruthy()
  })
})
