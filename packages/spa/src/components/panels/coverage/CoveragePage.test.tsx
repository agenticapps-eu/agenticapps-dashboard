import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompatibleCoverageResponse } from '@agenticapps/dashboard-shared'

const routerState = vi.hoisted(() => ({
  search: {} as { status?: string; q?: string },
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearch: () => routerState.search,
  }
})
vi.mock('../../../lib/coverageQueries.js', () => ({ useCoverage: vi.fn() }))
vi.mock('../../../lib/healthQueries.js', () => ({
  useHealth: vi.fn(),
}))
vi.mock('../../../lib/pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'bearer-token',
    pairedAt: '2026-07-28T00:00:00Z',
  })),
}))
vi.mock('../../../lib/useViewportBreakpoint.js', () => ({
  useViewportBreakpoint: vi.fn(() => 'lg'),
}))
vi.mock('../../../lib/coverageHistoryQueries.js', () => ({
  useCoverageHistory: vi.fn(() => ({ data: undefined })),
}))

import { ToastProvider } from '../../ui/Toast.js'
import { useCoverage } from '../../../lib/coverageQueries.js'
import { useHealth } from '../../../lib/healthQueries.js'
import { CoveragePage } from './CoveragePage.js'

function data(withUnderstand = true): CompatibleCoverageResponse {
  return {
    schemaVersion: withUnderstand ? 2 : 1,
    generatedAtIso: '2026-07-28T00:00:00Z',
    workflowHeadVersion: '3.0.0',
    rows: [
      {
        family: 'agenticapps',
        repo: 'agenticapps-dashboard',
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
                viewerToken: 'scoped-viewer-token',
              },
            }
          : {}),
        overrideCount: 0,
        overrides: [],
      },
    ],
  }
}

function renderPage(response = data()) {
  vi.mocked(useCoverage).mockReturnValue({
    data: response,
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

describe('CoveragePage', () => {
  beforeEach(() => {
    routerState.search = {}
    localStorage.clear()
    vi.mocked(useHealth).mockReturnValue({
      data: {
        understand: {
          viewerInstalled: true,
          viewerVersion: '2.7.6',
          pluginVersion: '2.7.6',
          updateAvailable: false,
        },
      },
    } as unknown as ReturnType<typeof useHealth>)
  })

  it('passes desktop UAT with both retired integrations absent', () => {
    renderPage()

    expect(screen.getAllByRole('columnheader', { name: 'CLAUDE.md' })).toHaveLength(3)
    expect(screen.getAllByRole('columnheader', { name: 'Workflow' })).toHaveLength(3)
    expect(screen.getAllByRole('columnheader', { name: 'Understand' })).toHaveLength(3)
    expect(screen.queryByText(/GitNexus/i)).toBeNull()
    expect(screen.queryByText(/^Wiki$/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /install|scan|refresh.*stale/i })).toBeNull()
  })

  it('keeps a valid v1 row visible and marks absent Understand as unavailable', () => {
    renderPage(data(false))
    expect(screen.getByText('agenticapps-dashboard')).toBeTruthy()
    expect(screen.getByText('Unavailable from this daemon')).toBeTruthy()
  })

  it('drops an obsolete not-applicable URL filter and defaults to all rows', () => {
    routerState.search = { status: 'not-applicable' }
    renderPage()
    expect(screen.getByText('agenticapps-dashboard')).toBeTruthy()
  })

  it('uses only the scoped viewer token in viewer links', () => {
    renderPage()
    const link = screen.getByRole('link', {
      name: /open knowledge graph for agenticapps-dashboard/i,
    })

    expect(link.getAttribute('href')).toContain('token=scoped-viewer-token')
    expect(link.getAttribute('href')).not.toContain('bearer-token')
  })

  it('suppresses viewer links when the viewer is known to be unavailable', () => {
    vi.mocked(useHealth).mockReturnValue({
      data: {
        understand: {
          viewerInstalled: false,
          viewerVersion: null,
          pluginVersion: null,
          updateAvailable: false,
        },
      },
    } as unknown as ReturnType<typeof useHealth>)

    renderPage()

    expect(screen.queryByRole('link', { name: /open knowledge graph/i })).toBeNull()
  })

  it('does not suppress viewer links while health is unavailable', () => {
    vi.mocked(useHealth).mockReturnValue({
      data: undefined,
    } as unknown as ReturnType<typeof useHealth>)

    renderPage()

    expect(screen.getByRole('link', { name: /open knowledge graph/i })).toBeTruthy()
  })

  it('renders SchemaDriftState with the failing field path', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('schema_drift:rows.0.repo'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useCoverage>)

    render(
      <ToastProvider>
        <CoveragePage />
      </ToastProvider>,
    )

    expect(screen.getByText('Schema drift detected')).toBeTruthy()
    expect(screen.getByText('rows.0.repo')).toBeTruthy()
  })
})
