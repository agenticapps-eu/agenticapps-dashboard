import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompatibleCoverageResponse } from '@agenticapps/dashboard-shared'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearch: () => ({}),
  }
})
vi.mock('../../../lib/coverageQueries.js', () => ({ useCoverage: vi.fn() }))
vi.mock('../../../lib/healthQueries.js', () => ({
  useHealth: vi.fn(() => ({ data: undefined })),
}))
vi.mock('../../../lib/pairing.js', () => ({
  getPairing: vi.fn(() => null),
}))
vi.mock('../../../lib/useViewportBreakpoint.js', () => ({
  useViewportBreakpoint: vi.fn(() => 'lg'),
}))
vi.mock('../../../lib/coverageHistoryQueries.js', () => ({
  useCoverageHistory: vi.fn(() => ({ data: undefined })),
}))

import { useCoverage } from '../../../lib/coverageQueries.js'
import { ToastProvider } from '../../ui/Toast.js'
import { CoveragePage } from './CoveragePage.js'

const fixture: CompatibleCoverageResponse = {
  schemaVersion: 2,
  generatedAtIso: '2026-07-28T00:00:00Z',
  workflowHeadVersion: '3.0.0',
  rows: [
    {
      family: 'agenticapps',
      repo: 'healthy-repo',
      claudeMd: { kind: 'basic', state: 'fresh' },
      workflowVersion: {
        kind: 'workflow',
        state: 'fresh',
        installedVersion: '3.0.0',
        headVersion: '3.0.0',
      },
      understand: { kind: 'basic', state: 'fresh' },
      overrideCount: 0,
      overrides: [],
    },
    {
      family: 'agenticapps',
      repo: 'needs-work',
      claudeMd: { kind: 'basic', state: 'fresh' },
      workflowVersion: {
        kind: 'workflow',
        state: 'missing',
        installedVersion: null,
        headVersion: '3.0.0',
      },
      understand: { kind: 'basic', state: 'missing' },
      overrideCount: 1,
      overrides: [
        {
          phaseSlug: 'phase-14',
          sinceIso: '2026-07-27T00:00:00Z',
          source: 'git-log',
        },
      ],
    },
  ],
}

function renderJourney() {
  vi.mocked(useCoverage).mockReturnValue({
    data: fixture,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCoverage>)

  return render(
    <ToastProvider>
      <CoveragePage />
    </ToastProvider>,
  )
}

describe('Coverage current-surface user journey', () => {
  beforeEach(() => localStorage.clear())

  it('shows the cold matrix with all families and current repos', () => {
    renderJourney()

    expect(screen.getByText('Coverage')).toBeTruthy()
    expect(screen.getByText('agenticapps')).toBeTruthy()
    expect(screen.getByText('factiv')).toBeTruthy()
    expect(screen.getByText('neuroflash')).toBeTruthy()
    expect(screen.getByText('healthy-repo')).toBeTruthy()
    expect(screen.getByText('needs-work')).toBeTruthy()
  })

  it('filters to rows with a missing current signal', async () => {
    renderJourney()

    fireEvent.click(screen.getByRole('button', { name: /missing/i }))

    await waitFor(() => expect(screen.queryByText('healthy-repo')).toBeNull())
    expect(screen.getByText('needs-work')).toBeTruthy()
  })

  it('searches repos by name', async () => {
    renderJourney()

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'healthy' },
    })

    expect(screen.getByText('healthy-repo')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('needs-work')).toBeNull())
  })

  it('expands and collapses a retained review override', () => {
    renderJourney()

    const override = screen.getByRole('button', { name: /1 phase review overridden/i })
    expect(override.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(override)
    expect(override.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/phase-14 — sentinel since/i)).toBeTruthy()

    fireEvent.click(override)
    expect(override.getAttribute('aria-expanded')).toBe('false')
  })

  it('keeps all interactive controls keyboard reachable', () => {
    renderJourney()

    expect(screen.getByRole('searchbox').getAttribute('tabindex')).not.toBe('-1')
    for (const button of screen.getAllByRole('button')) {
      expect(button.getAttribute('tabindex')).not.toBe('-1')
    }
  })
})
