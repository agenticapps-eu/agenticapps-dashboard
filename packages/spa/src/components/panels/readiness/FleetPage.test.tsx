import { render, screen, cleanup, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHECK_IDS,
  computeReady,
  type CheckId,
  type CheckResult,
  type CheckStatus,
  type FleetResponse,
  type RepoSummary,
} from '@agenticapps/dashboard-shared'

vi.mock('../../../lib/readinessQueries.js', () => ({ useFleet: vi.fn() }))

import { useFleet } from '../../../lib/readinessQueries.js'

import { CHECK_LABELS } from './ReadinessIndicator.js'
import { FleetPage } from './FleetPage.js'

const mockUseFleet = vi.mocked(useFleet)

afterEach(cleanup)

function result(id: CheckId, status: CheckStatus): CheckResult {
  const timeless = status === 'never' || status === 'na'
  return {
    id,
    status,
    source: 'derived',
    at: timeless ? null : Date.UTC(2026, 6, 30, 9, 15),
    value: null,
    threshold: null,
    summary: status === 'na' ? 'no version to pin' : '',
    evidence: null,
    error: null,
  }
}

function repo(
  id: string,
  over: {
    name?: string
    statuses?: Partial<Record<CheckId, CheckStatus>>
    lastCommitAt?: number | null
  } = {},
): RepoSummary {
  const checks = CHECK_IDS.map((checkId) =>
    result(checkId, over.statuses?.[checkId] ?? 'ok'),
  ) as unknown as RepoSummary['checks']

  return {
    id,
    name: over.name ?? id,
    family: 'agenticapps',
    ready: computeReady(checks),
    lastCommitAt:
      over.lastCommitAt === undefined ? Date.UTC(2026, 6, 30, 9, 15) : over.lastCommitAt,
    checks,
    notice: null,
  }
}

/** The shape `useFleet` returns, narrowed to what the page reads. */
function fleet(repos: readonly RepoSummary[]): void {
  const data: FleetResponse = {
    generatedAt: Date.UTC(2026, 6, 31, 12, 0),
    repos: [...repos],
  }
  mockUseFleet.mockReturnValue({
    data,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useFleet>)
}

/** Body rows only — the header row is not a repo. */
function rows(): HTMLElement[] {
  return screen.getAllByRole('row').filter((row) => within(row).queryAllByRole('cell').length > 0)
}

describe('FleetPage', () => {
  it('renders one row per repo', () => {
    fleet([repo('dashboard'), repo('workflow-core'), repo('agentlinter')])
    render(<FleetPage />)

    expect(rows()).toHaveLength(3)
  })

  it('carries the repo name, six checks, and the last-change time in one row', () => {
    fleet([repo('dashboard', { name: 'agenticapps-dashboard' })])
    render(<FleetPage />)

    const [row] = rows()
    expect(row).toBeDefined()
    const cells = within(row as HTMLElement)

    expect(cells.getByText('agenticapps-dashboard')).toBeInTheDocument()
    expect(
      within(
        cells.getByRole('group', { name: 'Readiness for agenticapps-dashboard' }),
      ).getAllByRole('figure'),
    ).toHaveLength(CHECK_IDS.length)
    expect(cells.getByText('2026-07-30')).toBeInTheDocument()
  })

  it('names the six checks in the column headers', () => {
    // The compact cell is an unlabelled 14 px glyph: check identity lives only
    // in its accessible name, so the table owes a sighted reader the labels.
    fleet([repo('dashboard')])
    render(<FleetPage />)

    for (const id of CHECK_IDS) {
      expect(
        screen.getByRole('columnheader', { name: CHECK_LABELS[id] }),
      ).toBeInTheDocument()
    }
  })

  it('renders an em dash for a repo with no known last change', () => {
    fleet([repo('fresh-clone', { lastCommitAt: null })])
    render(<FleetPage />)

    const [row] = rows()
    expect(within(row as HTMLElement).getByText('—')).toBeInTheDocument()
  })

  it('orders rows by severity rather than registry order', () => {
    // Registry order here is the reverse of severity order, so a page that
    // simply rendered `repos` in the order the daemon returned them would pass
    // every other test in this file and fail only this one.
    fleet([
      repo('clean'),
      repo('warned', { statuses: { 'pen-test': 'warn' } }),
      repo('never-run', { statuses: { 'pen-test': 'never' } }),
      repo('failing', { statuses: { coverage: 'fail' } }),
    ])
    render(<FleetPage />)

    const names = rows().map((row) => within(row).getAllByRole('cell')[0]?.textContent)
    expect(names).toEqual(['failing', 'never-run', 'warned', 'clean'])
  })

  it('renders a loading state while the fleet is pending', () => {
    mockUseFleet.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useFleet>)
    render(<FleetPage />)

    expect(screen.getByLabelText('Loading fleet readiness')).toBeInTheDocument()
    expect(screen.queryAllByRole('row')).toHaveLength(0)
  })

  it('offers a retry when the fleet cannot be read', () => {
    const refetch = vi.fn()
    mockUseFleet.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('offline'),
      refetch,
    } as unknown as ReturnType<typeof useFleet>)
    render(<FleetPage />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    screen.getByRole('button', { name: /retry/i }).click()
    expect(refetch).toHaveBeenCalled()
  })
})
