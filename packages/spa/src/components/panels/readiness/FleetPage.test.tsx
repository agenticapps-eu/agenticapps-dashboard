import React from 'react'
import { fireEvent, render, screen, cleanup, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHECK_IDS,
  computeReady,
  type CheckId,
  type CheckResult,
  type CheckStatus,
  type FleetResponse,
  type RepoFamily,
  type RepoSummary,
} from '@agenticapps/dashboard-shared'

/** The filter state lives in the URL, as it does on /coverage (COV-06). */
const routerState = vi.hoisted(() => ({
  search: {} as { family?: string; status?: string; q?: string },
  navigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => routerState.navigate,
    useSearch: () => routerState.search,
    Link: ({
      to,
      params,
      hash,
      children,
      ...rest
    }: {
      to: string
      params?: { repoId?: string }
      hash?: string
      children: React.ReactNode
    } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a
        href={`${to.replace('$repoId', params?.repoId ?? '')}${hash === undefined ? '' : `#${hash}`}`}
        {...rest}
      >
        {children}
      </a>
    ),
  }
})
vi.mock('../../../lib/readinessQueries.js', async (importOriginal) => ({
  // `useFleet` is mocked; `SchemaDriftError` is not. The page branches on
  // `instanceof`, so a stubbed class would make that branch untestable.
  ...(await importOriginal<typeof import('../../../lib/readinessQueries.js')>()),
  useFleet: vi.fn(),
}))

import { SchemaDriftError, useFleet } from '../../../lib/readinessQueries.js'

import { CHECK_LABELS } from './ReadinessIndicator.js'
import { FleetPage } from './FleetPage.js'

const mockUseFleet = vi.mocked(useFleet)

afterEach(cleanup)

beforeEach(() => {
  routerState.search = {}
  routerState.navigate = vi.fn()
})

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
    family?: RepoFamily
    statuses?: Partial<Record<CheckId, CheckStatus>>
    lastCommitAt?: number | null
    notice?: RepoSummary['notice']
  } = {},
): RepoSummary {
  const checks = CHECK_IDS.map((checkId) =>
    result(checkId, over.statuses?.[checkId] ?? 'ok'),
  ) as unknown as RepoSummary['checks']

  return {
    id,
    name: over.name ?? id,
    family: over.family ?? 'agenticapps',
    ready: computeReady(checks),
    lastCommitAt:
      over.lastCommitAt === undefined ? Date.UTC(2026, 6, 30, 9, 15) : over.lastCommitAt,
    checks,
    notice: over.notice ?? null,
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
      ).getAllByRole('link'),
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

  it('renders a repo with no coverage data as absence, never as zero', () => {
    // A coverage check that has never run carries a null value. Rendering that
    // as `0 %` would turn "we do not know" into the worst possible measurement,
    // and a repo that simply has not been measured would sort and read as the
    // one in the most trouble.
    fleet([repo('unmeasured', { statuses: { coverage: 'never' } })])
    render(<FleetPage />)

    const [row] = rows()
    const text = (row as HTMLElement).textContent ?? ''
    expect(text).not.toMatch(/\d\s*%/)
    expect(text).not.toMatch(/\b0\b/)
    expect(
      within(row as HTMLElement).getByRole('link', { name: /Coverage — never run/ }),
    ).toBeInTheDocument()
  })

  it('states readiness in words on every row', () => {
    fleet([
      repo('all-clear'),
      repo('blocked', { statuses: { 'pen-test': 'never' } }),
    ])
    render(<FleetPage />)

    const [first, second] = rows()
    expect(within(second as HTMLElement).getByText('Ready')).toBeInTheDocument()
    expect(within(first as HTMLElement).getByText('Not ready')).toBeInTheDocument()
  })

  it('shows the notice when a readiness file could not be used', () => {
    fleet([
      repo('bad-file', {
        notice: {
          code: 'readiness-file-invalid',
          message: 'declarations[0].observedAt is not an RFC 3339 time',
        },
      }),
    ])
    render(<FleetPage />)

    const [row] = rows()
    expect(
      within(row as HTMLElement).getByText(
        /declarations\[0\]\.observedAt is not an RFC 3339 time/,
      ),
    ).toBeInTheDocument()
  })

  it('opens the repo detail from the name', () => {
    fleet([repo('dashboard', { name: 'agenticapps-dashboard' })])
    render(<FleetPage />)

    expect(
      screen.getByRole('link', { name: 'agenticapps-dashboard' }).getAttribute('href'),
    ).toBe('/repos/dashboard')
  })

  it('opens the detail at the selected check from a cell', () => {
    fleet([repo('dashboard')])
    render(<FleetPage />)

    const [row] = rows()
    const cells = within(row as HTMLElement).getAllByRole('link')
    // The name link comes first; the six check cells follow, in fixed order.
    expect(cells.slice(1).map((cell) => cell.getAttribute('href'))).toEqual(
      CHECK_IDS.map((id) => `/repos/dashboard#${id}`),
    )
  })

  it('opens the detail when the row itself is selected', () => {
    fleet([repo('dashboard')])
    render(<FleetPage />)

    fireEvent.click(rows()[0] as HTMLElement)

    expect(routerState.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/repos/$repoId', params: { repoId: 'dashboard' } }),
    )
  })

  it('does not also open the repo when a check cell is selected', () => {
    // The cell carries a more specific destination than the row it sits in. If
    // the row handler ran too, the more specific one would be overwritten by
    // the less specific one and every cell would land at the top of the page.
    fleet([repo('dashboard')])
    render(<FleetPage />)

    const cell = within(rows()[0] as HTMLElement).getAllByRole('link')[1]
    fireEvent.click(cell as HTMLElement)

    expect(routerState.navigate).not.toHaveBeenCalled()
  })

  it('narrows the row set by family without splitting it into sections', () => {
    // Family is a filter, not a grouping level: grouping spends vertical space
    // separating exactly the repos someone wants to compare side by side
    // (design.md §5).
    routerState.search = { family: 'factiv' }
    fleet([
      repo('dashboard', { family: 'agenticapps' }),
      repo('cparx', { family: 'factiv' }),
      repo('fx-signal-agent', { family: 'factiv' }),
    ])
    render(<FleetPage />)

    expect(rows()).toHaveLength(2)
    expect(screen.getAllByRole('table')).toHaveLength(1)
    expect(screen.queryByRole('rowgroup', { name: /factiv/i })).not.toBeInTheDocument()
  })

  it('shows only rows satisfying every applied filter', () => {
    routerState.search = { family: 'agenticapps', status: 'fail', q: 'dash' }
    fleet([
      // Right family, right status, right name.
      repo('dashboard', { family: 'agenticapps', statuses: { coverage: 'fail' } }),
      // Right family and status, wrong name.
      repo('agentlinter', { family: 'agenticapps', statuses: { coverage: 'fail' } }),
      // Right name and status, wrong family.
      repo('dash-factiv', { family: 'factiv', statuses: { coverage: 'fail' } }),
      // Right family and name, nothing failing.
      repo('dashboard-docs', { family: 'agenticapps' }),
    ])
    render(<FleetPage />)

    const names = rows().map((row) => within(row).getAllByRole('cell')[0]?.textContent)
    expect(names).toEqual(['dashboard'])
  })

  it('treats several selections within one filter as alternatives', () => {
    routerState.search = { status: 'stale,never' }
    fleet([
      repo('stale-one', { statuses: { 'security-review': 'stale' } }),
      repo('never-one', { statuses: { 'pen-test': 'never' } }),
      repo('warned-one', { statuses: { 'pen-test': 'warn' } }),
    ])
    render(<FleetPage />)

    expect(rows()).toHaveLength(2)
  })

  it('puts a chosen filter in the URL so the view can be shared', () => {
    fleet([repo('dashboard', { family: 'agenticapps' })])
    render(<FleetPage />)

    fireEvent.click(screen.getByRole('button', { name: 'factiv' }))

    expect(routerState.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.objectContaining({ family: 'factiv' }) }),
    )
  })

  it('says the filters matched nothing rather than showing a clear fleet', () => {
    // An empty table under active filters reads as "every repo is fine", which
    // is the same failure the empty-registry rule exists to prevent.
    routerState.search = { q: 'nothing-matches-this' }
    fleet([repo('dashboard')])
    render(<FleetPage />)

    expect(screen.getByText(/no repositories match/i)).toBeInTheDocument()
    expect(screen.queryByText(/agentic-dashboard register/)).not.toBeInTheDocument()
  })

  it('says when the readings were computed', () => {
    // `generatedAt` means the time the snapshot was COMPUTED, not the time it
    // was served — the daemon takes the oldest of its per-repo memos precisely
    // so this number can be trusted. Never rendering it throws that away and
    // leaves every reading looking equally current.
    fleet([repo('dashboard')])
    render(<FleetPage />)

    expect(screen.getByText(/2026-07-31 12:00 UTC/)).toBeInTheDocument()
  })

  it('says how much of the fleet the filters are hiding', () => {
    routerState.search = { family: 'factiv' }
    fleet([
      repo('dashboard', { family: 'agenticapps' }),
      repo('cparx', { family: 'factiv' }),
      repo('fx-signal-agent', { family: 'factiv' }),
    ])
    render(<FleetPage />)

    expect(screen.getByText(/2 of 3/)).toBeInTheDocument()
  })

  it('offers one way out of every filter at once', () => {
    routerState.search = { family: 'factiv', status: 'fail', q: 'dash' }
    fleet([repo('dashboard', { family: 'agenticapps' })])
    render(<FleetPage />)

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))

    expect(routerState.navigate).toHaveBeenCalledWith(
      expect.objectContaining({ search: {} }),
    )
  })

  it('keeps the way out reachable when the filters match nothing', () => {
    // This is where an exit matters most: the table is gone, so the rows that
    // would otherwise show the filters are doing something cannot.
    routerState.search = { q: 'nothing-matches-this' }
    fleet([repo('dashboard')])
    render(<FleetPage />)

    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
  })

  it('does not offer to clear filters that are not applied', () => {
    fleet([repo('dashboard')])
    render(<FleetPage />)

    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument()
  })

  it('leads to onboarding rather than an empty table when nothing is registered', () => {
    fleet([])
    render(<FleetPage />)

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText(/agentic-dashboard register/)).toBeInTheDocument()
  })

  it('names the drifting field when the response does not match the schema', () => {
    mockUseFleet.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new SchemaDriftError({
        path: 'repos.0.checks.5.status',
        expected: "'ok' | 'warn' | 'fail' | 'stale' | 'never' | 'na'",
        got: 'unknown-status',
        issues: [],
      }),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useFleet>)
    render(<FleetPage />)

    expect(screen.getByText('Schema drift detected')).toBeInTheDocument()
    expect(screen.getByText('repos.0.checks.5.status')).toBeInTheDocument()
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
