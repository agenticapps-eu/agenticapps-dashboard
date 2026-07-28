import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompatibleCoverageRow } from '@agenticapps/dashboard-shared'

vi.mock('../../../lib/coverageHistoryQueries.js', () => ({
  useCoverageHistory: vi.fn(() => ({ data: undefined })),
}))

import { ToastProvider } from '../../ui/Toast.js'
import { CoverageRow } from './CoverageRow.js'

function row(withUnderstand = true): CompatibleCoverageRow {
  return {
    family: 'agenticapps',
    repo: 'dashboard',
    claudeMd: { kind: 'basic', state: 'fresh' },
    workflowVersion: {
      kind: 'workflow',
      state: 'fresh',
      installedVersion: '3.0.0',
      headVersion: '3.0.0',
    },
    ...(withUnderstand
      ? {
          understand: {
            kind: 'basic' as const,
            state: 'fresh' as const,
            viewerToken: 'fixture-token',
          },
        }
      : {}),
    overrideCount: 1,
    overrides: [{ phaseSlug: 'phase-one', source: 'mtime' }],
  }
}

describe('CoverageRow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders only retained coverage cells and Understand actions', () => {
    render(
      <ToastProvider>
        <table>
          <tbody>
            <CoverageRow
              row={row()}
              understandViewerUrl="http://127.0.0.1/understand/agenticapps/dashboard/"
            />
          </tbody>
        </table>
      </ToastProvider>,
    )

    expect(screen.getByText('dashboard')).toBeTruthy()
    expect(screen.getByLabelText(/claudeMd for dashboard: fresh/i)).toBeTruthy()
    expect(screen.getByLabelText(/workflowVersion for dashboard: fresh/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /open knowledge graph/i })).toBeTruthy()
    expect(screen.queryByText(/GitNexus/i)).toBeNull()
    expect(screen.queryByText(/^Wiki$/i)).toBeNull()
  })

  it('presents absent v1 Understand data as unavailable', () => {
    render(
      <ToastProvider>
        <table>
          <tbody>
            <CoverageRow row={row(false)} />
          </tbody>
        </table>
      </ToastProvider>,
    )
    expect(screen.getByText('Unavailable from this daemon')).toBeTruthy()
  })
})
