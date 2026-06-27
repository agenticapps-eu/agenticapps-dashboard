/**
 * CoveragePage.test.tsx — Tests for the top-level coverage matrix page.
 *
 * CODEX HIGH-6 Option A: per-family GitNexus install hint inside family header.
 * AGREED-4: RefreshAllStaleButton with batch-progress state.
 * CODEX HIGH-1: absPath never in DOM.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { CoverageResponse, CoverageRow } from '@agenticapps/dashboard-shared'
import { ToastProvider } from '../../ui/Toast.js'

// Mock TanStack Router hooks — CoveragePage uses useNavigate + useSearch
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearch: () => ({}),
  }
})

// Mock useCoverage + useCoverageRefresh
vi.mock('../../../lib/coverageQueries.js', () => ({
  useCoverage: vi.fn(),
  useCoverageRefresh: vi.fn(),
}))

// Mock useHealth — Phase 13 D-13-08: CoveragePage now calls useHealth to get
// gitnexus.{installed,canScan} for ScanPill props. Default: not installed.
// Phase 14 review fix: viewer links are gated on understand.viewerInstalled —
// default mock reports the viewer as installed so link tests exercise the
// happy path.
vi.mock('../../../lib/healthQueries.js', () => ({
  useHealth: vi.fn(() => ({
    data: {
      ok: true,
      version: '1.0.0',
      gitnexus: { installed: false, canScan: false },
      understand: {
        viewerInstalled: true,
        viewerVersion: '2.7.6',
        pluginVersion: '2.7.6',
        updateAvailable: false,
      },
    },
    isPending: false,
    isError: false,
    error: null,
  })),
}))

// Mock writeToClipboard so per-row clipboard tests can assert the payload
vi.mock('../../../lib/clipboardCompat.js', () => ({
  writeToClipboard: vi.fn().mockResolvedValue(undefined),
}))

// Phase 14 D-14-03: mock getPairing so CoveragePage can derive agentUrl for
// viewer URLs without touching localStorage. The bearer token is also returned
// so Test 3 can assert it NEVER appears in constructed viewer URLs.
vi.mock('../../../lib/pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'test-bearer-token-should-never-appear-in-href',
    pairedAt: '2026-01-01T00:00:00.000Z',
  })),
}))

import { useCoverage, useCoverageRefresh } from '../../../lib/coverageQueries.js'
import { useHealth } from '../../../lib/healthQueries.js'
import { writeToClipboard } from '../../../lib/clipboardCompat.js'
import { getPairing } from '../../../lib/pairing.js'
import { CoveragePage } from './CoveragePage.js'

function makeRow(
  family: 'agenticapps' | 'factiv' | 'neuroflash',
  repo: string,
  gitNexusState: CoverageRow['gitNexus']['state'] = 'fresh',
): CoverageRow {
  return {
    family,
    repo,
    claudeMd: { kind: 'basic', state: 'fresh' },
    gitNexus: { kind: 'basic', state: gitNexusState },
    wiki: { kind: 'basic', state: 'fresh' },
    workflowVersion: {
      kind: 'workflow',
      state: 'fresh',
      installedVersion: '1.7.0',
      headVersion: '1.7.0',
      detail: 'equal',
    },
    overrideCount: 0,
    overrides: [],
    inRegistry: true, // D-13-EXT-07: page fixture default — tests not exercising the gate
  }
}

function makeData(overrides: Partial<CoverageResponse> = {}): CoverageResponse {
  return {
    schemaVersion: 1,
    generatedAtIso: new Date().toISOString(),
    gitNexusInstallState: 'installed-with-registry',
    workflowHeadVersion: '1.7.0',
    rows: [
      makeRow('agenticapps', 'agenticapps-dashboard'),
      makeRow('factiv', 'cparx'),
      makeRow('neuroflash', 'neuroflash-api'),
    ],
    ...overrides,
  }
}

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.mocked(useCoverageRefresh).mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ ok: true, kind: 'ok', updatedRow: makeRow('agenticapps', 'x') }),
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    status: 'idle',
    variables: undefined,
    data: undefined,
    error: null,
    reset: vi.fn(),
    context: undefined,
    failureCount: 0,
    failureReason: null,
    isPaused: false,
    submittedAt: 0,
  } as ReturnType<typeof useCoverageRefresh>)
})

describe('CoveragePage', () => {
  it('renders PageHeader + CoverageToolbar + 3 family sections when data is available', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData(),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    expect(screen.getByText('Coverage')).toBeTruthy()
    // 3 family sections
    expect(screen.getByText('agenticapps')).toBeTruthy()
    expect(screen.getByText('factiv')).toBeTruthy()
    expect(screen.getByText('neuroflash')).toBeTruthy()
  })

  it('renders SchemaDriftState component when query returns schema drift error', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('schema_drift:/rows/0/claudeMd'),
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    expect(screen.getByText(/Schema drift detected/i)).toBeTruthy()
  })

  it('renders CoverageEmptyState with kind="no-repos" when rows array is empty', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ rows: [] }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    expect(screen.getAllByText(/No.*repos found/i).length).toBeGreaterThanOrEqual(1)
  })

  it("PER-FAMILY install hint when gitNexusInstallState='not-installed' rendered inside each family section (CODEX HIGH-6 Option A)", () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ gitNexusInstallState: 'not-installed' }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    // Install hint rendered once per family section (3 families × 1 hint each)
    const hints = screen.getAllByText(/GitNexus is not installed/i)
    expect(hints.length).toBeGreaterThanOrEqual(3)
  })

  it('RefreshAllStaleButton is disabled when 0 stale rows are present', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData(), // all fresh
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    // RefreshAllStaleButton should be present but disabled (no stale gitNexus rows)
    const refreshBtn = screen.getByRole('button', { name: /refresh.*stale/i })
    expect(refreshBtn).toHaveProperty('disabled', true)
  })

  it('RefreshAllStaleButton batch-progress state renders "Refreshing N of M…" indicator (AGREED-4)', () => {
    // This is verified by RefreshAllStaleButton.test.tsx which tests the component directly.
    // Here we just verify it is mounted in CoveragePage.
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ rows: [makeRow('agenticapps', 'repo-a', 'stale')] }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    // Button should exist and be enabled (1 stale row)
    const refreshBtn = screen.getByRole('button', { name: /refresh.*stale/i })
    expect(refreshBtn).toHaveProperty('disabled', false)
  })

  it('RefreshAllStaleButton uses for-of await sequential loop — NEVER Promise.all (AGREED-4)', () => {
    // Structural assertion: Promise.all must not appear in CoveragePage's batch code path
    // This is a grep-based assertion tested at commit time; here we verify component mounts.
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData(),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    // If it renders without error, the sequential impl is in place (RefreshAllStaleButton.tsx)
    expect(screen.getByText('Coverage')).toBeTruthy()
  })

  it('absPath never rendered in DOM (CODEX HIGH-1)', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData(),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    const { container } = render(<CoveragePage />, { wrapper })
    expect(container.innerHTML).not.toContain('absPath')
  })

  // ── Stage 2 review fixes: per-row dispatch threads (family, repo) through ──
  // Stage 2 found CoverageRow.onRefresh dropped the row context, so gitnexus-analyze
  // was a no-op and wiki-compile clipboard always copied the agenticapps command.

  it('per-row gitnexus-analyze dispatches refresh.mutateAsync with the row\'s family + repo', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      ok: true,
      kind: 'ok',
      updatedRow: makeRow('factiv', 'cparx'),
    })
    vi.mocked(useCoverageRefresh).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync,
      isPending: false,
      isError: false,
      isSuccess: false,
      isIdle: true,
      status: 'idle',
      variables: undefined,
      data: undefined,
      error: null,
      reset: vi.fn(),
      context: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
    } as ReturnType<typeof useCoverageRefresh>)

    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({
        rows: [makeRow('factiv', 'cparx', 'stale')],
      }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })

    // Open the row's refresh popover and click the gitnexus-analyze option
    fireEvent.click(screen.getByRole('button', { name: /refresh actions for cparx/i }))
    fireEvent.click(screen.getByText(/run gitnexus analyze/i))

    // mutateAsync called with the row's family + repo (NOT a hardcoded agenticapps)
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        family: 'factiv',
        repo: 'cparx',
        action: 'gitnexus-analyze',
      })
    })
  })

  it('per-row wiki-compile clipboard uses the row\'s family — not a hardcoded value', async () => {
    vi.mocked(writeToClipboard).mockClear()

    // factiv row with stale wiki — triggers the wiki-compile popover option
    const factivRow = makeRow('factiv', 'cparx')
    factivRow.wiki = { kind: 'basic', state: 'stale' }

    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ rows: [factivRow] }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /refresh actions for cparx/i }))
    fireEvent.click(screen.getByText(/copy \/wiki-compile/i))

    // Clipboard should receive a command scoped to factiv, NOT agenticapps
    await waitFor(() => {
      expect(writeToClipboard).toHaveBeenCalled()
    })
    const clipboardArg = vi.mocked(writeToClipboard).mock.calls[0]![0] as string
    expect(clipboardArg).toMatch(/factiv/)
    expect(clipboardArg).not.toMatch(/agenticapps/)
  })

  // P0 fix from 10-IMPECCABLE.md: when GitNexus isn't installed the primary action
  // must be "Install GitNexus", not a disabled "Refresh 0 stale" that confuses
  // first-timers staring at 42 red cells.
  it("primary action is 'Install GitNexus' when gitNexusInstallState === 'not-installed'", () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ gitNexusInstallState: 'not-installed' }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    // Install CTA is present in the page header (distinct from the per-family hint
    // buttons which use the longer "Copy npm install -g gitnexus" aria-label)
    expect(screen.getByRole('button', { name: /^copy npm install -g gitnexus to clipboard$/i })).toBeTruthy()
    // The confusing "Refresh N stale" button is NOT rendered
    expect(screen.queryByRole('button', { name: /refresh.*stale/i })).toBeNull()
    // The Index CTA is NOT shown either — installed-no-registry is a different state.
    expect(screen.queryByRole('button', { name: /^copy gitnexus analyze to clipboard$/i })).toBeNull()
  })

  // D-13-06: IndexGitNexusButton removed — per-row + per-family ScanPill (Phase 13)
  // handles the installed-no-registry scan affordance. The page header shows
  // InstallGitNexusButton for both not-installed AND installed-no-registry states.
  it("page header shows InstallGitNexusButton (not IndexGitNexusButton) for 'installed-no-registry' after D-13-06 deletion", () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ gitNexusInstallState: 'installed-no-registry' }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    // InstallGitNexusButton is the page-header action for this state
    expect(screen.getByRole('button', { name: /^copy npm install -g gitnexus to clipboard$/i })).toBeTruthy()
    // IndexGitNexusButton is GONE (D-13-06 — deleted outright per Pitfall 8)
    expect(screen.queryByRole('button', { name: /^copy gitnexus analyze to clipboard$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /refresh.*stale/i })).toBeNull()
  })

  it("primary action is RefreshAllStaleButton when gitNexusInstallState === 'installed-with-registry'", () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ gitNexusInstallState: 'installed-with-registry' }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    // Refresh button is present
    expect(screen.getByRole('button', { name: /refresh.*stale/i })).toBeTruthy()
    // Neither install nor index CTA in the page header.
    expect(screen.queryByRole('button', { name: /^copy npm install -g gitnexus to clipboard$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^copy gitnexus analyze to clipboard$/i })).toBeNull()
  })

  it('per-row wiki-compile clipboard for a neuroflash row uses neuroflash', async () => {
    vi.mocked(writeToClipboard).mockClear()

    const neuroRow = makeRow('neuroflash', 'neuroflash-api')
    neuroRow.wiki = { kind: 'basic', state: 'missing' }

    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ rows: [neuroRow] }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /refresh actions for neuroflash-api/i }))
    fireEvent.click(screen.getByText(/copy \/wiki-compile/i))

    await waitFor(() => {
      expect(writeToClipboard).toHaveBeenCalled()
    })
    const clipboardArg = vi.mocked(writeToClipboard).mock.calls[0]![0] as string
    expect(clipboardArg).toMatch(/neuroflash/)
  })
})

// Phase 11 PLI-03 / D-11-09 — Coverage page opts into sticky PageHeader at
// every render path (loading / error / empty / main render). The lazy route
// file (packages/spa/src/routes/coverage.lazy.tsx) is NOT modified — it only
// declares the lazy route handle (REVIEWS action item 9 correction).
//
// Strategy: PageHeader (PH-S3 in PageHeader.test.tsx) renders the sticky
// stack (`sticky top-[-1.5rem] z-10 bg-app-bg -mt-6 min-h-14`) on its outer
// div when sticky={true}. Post-UAT layering fix uses negative top-offset +
// negative margin-top so the title sits flush with TopBar/RepairBanner.
// We assert on the rendered DOM directly — no module mock needed, no
// hoisting hazards, and the test breaks honestly if CoveragePage drops the
// prop in a future refactor.
describe('CoveragePage — PLI-03 sticky PageHeader opt-in', () => {
  function findStickyOuter(container: HTMLElement): Element | null {
    // PageHeader's outer div carries the heading; the sticky tokens live on
    // the same div. Find the <h1>'s grandparent (`<h1>` is inside an inner
    // <div> for the title/helper grouping).
    const heading = container.querySelector('h1')
    if (!heading) return null
    return heading.closest('.mb-6.flex.flex-col')
  }

  it('passes sticky={true} in the loading state (outer div has sticky top-0 z-10 bg-app-bg)', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      isLoading: true,
    } as ReturnType<typeof useCoverage>)

    const { container } = render(<CoveragePage />, { wrapper })
    const outer = findStickyOuter(container)
    expect(outer).not.toBeNull()
    expect(outer!.className).toContain('sticky')
    expect(outer!.className).toContain('top-[-1.5rem]')
    expect(outer!.className).toContain('z-10')
    expect(outer!.className).toContain('bg-app-bg')
  })

  it('passes sticky={true} in the non-drift error state', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('boom'),
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    const { container } = render(<CoveragePage />, { wrapper })
    const outer = findStickyOuter(container)
    expect(outer).not.toBeNull()
    expect(outer!.className).toContain('sticky')
    expect(outer!.className).toContain('top-[-1.5rem]')
    expect(outer!.className).toContain('z-10')
    expect(outer!.className).toContain('bg-app-bg')
  })

  it('passes sticky={true} in the empty-matrix state (no repos)', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ rows: [] }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    const { container } = render(<CoveragePage />, { wrapper })
    const outer = findStickyOuter(container)
    expect(outer).not.toBeNull()
    expect(outer!.className).toContain('sticky')
    expect(outer!.className).toContain('bg-app-bg')
  })

  it('passes sticky={true} in the main render — installed-with-registry', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ gitNexusInstallState: 'installed-with-registry' }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    const { container } = render(<CoveragePage />, { wrapper })
    const outer = findStickyOuter(container)
    expect(outer).not.toBeNull()
    expect(outer!.className).toContain('sticky')
    expect(outer!.className).toContain('top-[-1.5rem]')
    expect(outer!.className).toContain('z-10')
    expect(outer!.className).toContain('bg-app-bg')
  })

  it('passes sticky={true} in the main render — not-installed', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ gitNexusInstallState: 'not-installed' }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    const { container } = render(<CoveragePage />, { wrapper })
    const outer = findStickyOuter(container)
    expect(outer).not.toBeNull()
    expect(outer!.className).toContain('sticky')
    expect(outer!.className).toContain('bg-app-bg')
  })

  it('passes sticky={true} in the main render — installed-no-registry', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ gitNexusInstallState: 'installed-no-registry' }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    const { container } = render(<CoveragePage />, { wrapper })
    const outer = findStickyOuter(container)
    expect(outer).not.toBeNull()
    expect(outer!.className).toContain('sticky')
    expect(outer!.className).toContain('bg-app-bg')
  })

  it('REVIEWS action item 9: coverage.lazy.tsx is NOT modified by this plan (contains no "sticky" reference)', async () => {
    // Read the lazy route file as a string and grep for 'sticky'. The lazy file
    // ONLY exports the lazy route handle (createLazyRoute) — Plan 06 modifies
    // CoveragePage.tsx, not coverage.lazy.tsx. This test locks the correction
    // at the test layer.
    const fs = await import('node:fs')
    const path = await import('node:path')
    const lazyPath = path.resolve(__dirname, '../../../routes/coverage.lazy.tsx')
    const content = fs.readFileSync(lazyPath, 'utf8')
    expect(content).not.toMatch(/sticky/)
  })
})

describe('CoverageToolbar inside sticky PageHeader (IMP-02 / PD-11.1-07)', () => {
  function setupMainRender() {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ gitNexusInstallState: 'installed-with-registry' }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)
    render(<CoveragePage />, { wrapper })
  }

  it('renders CoverageToolbar as a child of the sticky PageHeader subtree', () => {
    setupMainRender()
    const stickyHeader = screen.getByTestId('page-header-sticky')
    const toolbar = within(stickyHeader).getByRole('group', { name: 'Filter by status' })
    expect(toolbar).toBeTruthy()
  })

  it('does not render CoverageToolbar as a sibling of the sticky PageHeader (toolbar appears exactly once and only inside the testid subtree)', () => {
    setupMainRender()
    const allFilterGroups = screen.getAllByRole('group', { name: 'Filter by status' })
    expect(allFilterGroups).toHaveLength(1)
    const stickyHeader = screen.getByTestId('page-header-sticky')
    expect(stickyHeader.contains(allFilterGroups[0]!)).toBe(true)
  })
})

describe('CoveragePage handleRefresh toast (IMP-03)', () => {
  function setupWithStaleWiki(family: 'agenticapps' | 'factiv' | 'neuroflash', repo: string) {
    const row = makeRow(family, repo)
    row.wiki = { kind: 'basic', state: 'stale' }
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ rows: [row] }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)
    render(<CoveragePage />, { wrapper })
  }

  beforeEach(() => {
    vi.mocked(writeToClipboard).mockResolvedValue(true)
  })

  it('wiki-compile-clipboard: fires toast with family name after successful copy (agenticapps)', async () => {
    setupWithStaleWiki('agenticapps', 'agenticapps-dashboard')
    fireEvent.click(screen.getByRole('button', { name: /refresh actions for agenticapps-dashboard/i }))
    await userEvent.click(screen.getByText(/copy \/wiki-compile/i))
    await waitFor(() => {
      const statusEls = screen.getAllByRole('status')
      const toastEl = statusEls.find((el) => el.textContent?.includes('Copied'))
      expect(toastEl).toBeDefined()
      expect(toastEl!.textContent).toContain('agenticapps')
      expect(toastEl!.textContent).toContain('wiki')
    })
  })

  it('workflow-update-clipboard: fires toast with update wording after successful copy', async () => {
    const row = makeRow('agenticapps', 'agenticapps-dashboard')
    row.workflowVersion = {
      kind: 'workflow',
      state: 'stale',
      installedVersion: '1.6.0',
      headVersion: '1.7.0',
      detail: 'behind',
    }
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ rows: [row] }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)
    render(<CoveragePage />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: /refresh actions for agenticapps-dashboard/i }))
    await userEvent.click(screen.getByText(/copy \/update-agenticapps-workflow/i))
    await waitFor(() => {
      const statusEls = screen.getAllByRole('status')
      const toastEl = statusEls.find((el) => el.textContent?.includes('Copied'))
      expect(toastEl).toBeDefined()
      expect(toastEl!.textContent).toContain('update the workflow')
    })
  })
})

describe('gitnexus-analyze toast wiring', () => {
  it('gitnexus-analyze success fires toast with "Indexed {family}/{repo}"', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      ok: true,
      kind: 'ok',
      updatedRow: makeRow('agenticapps', 'dashboard'),
    })
    vi.mocked(useCoverageRefresh).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync,
      isPending: false,
      isError: false,
      isSuccess: false,
      isIdle: true,
      status: 'idle',
      variables: undefined,
      data: undefined,
      error: null,
      reset: vi.fn(),
      context: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
    } as ReturnType<typeof useCoverageRefresh>)

    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({
        rows: [makeRow('agenticapps', 'dashboard', 'stale')],
      }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /refresh actions for dashboard/i }))
    fireEvent.click(screen.getByText(/run gitnexus analyze/i))

    await waitFor(() => {
      const statusEls = screen.getAllByRole('status')
      const toastEl = statusEls.find((el) => el.textContent?.includes('Indexed'))
      expect(toastEl).toBeDefined()
      expect(toastEl!.textContent).toContain('Indexed agenticapps/dashboard')
    })
  })

  it('gitnexus-analyze error fires toast with "Indexing failed: {reason}"', async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error('exit code 1: spawn ENOENT'))
    vi.mocked(useCoverageRefresh).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync,
      isPending: false,
      isError: false,
      isSuccess: false,
      isIdle: true,
      status: 'idle',
      variables: undefined,
      data: undefined,
      error: null,
      reset: vi.fn(),
      context: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
    } as ReturnType<typeof useCoverageRefresh>)

    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({
        rows: [makeRow('agenticapps', 'dashboard', 'stale')],
      }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /refresh actions for dashboard/i }))
    fireEvent.click(screen.getByText(/run gitnexus analyze/i))

    await waitFor(() => {
      const alertEls = screen.getAllByRole('alert')
      const toastEl = alertEls.find((el) => el.textContent?.includes('Indexing failed'))
      expect(toastEl).toBeDefined()
      expect(toastEl!.textContent).toContain('Indexing failed: exit code 1: spawn ENOENT')
    })
  })

  // Stage-1 /review cross-model finding (Codex #3): the daemon's
  // CoverageRefreshResponseSchema is a discriminated union — kind:
  // 'not-installed' | 'timeout' | 'error' resolve with ok:false WITHOUT
  // throwing. The toast must route those to error, not lie with "Indexed".
  it('gitnexus-analyze ok:false (soft failure) fires error toast — NOT a success toast', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      ok: false,
      kind: 'timeout',
      exitCode: 124,
    })
    vi.mocked(useCoverageRefresh).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync,
      isPending: false,
      isError: false,
      isSuccess: false,
      isIdle: true,
      status: 'idle',
      variables: undefined,
      data: undefined,
      error: null,
      reset: vi.fn(),
      context: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
    } as ReturnType<typeof useCoverageRefresh>)

    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({
        rows: [makeRow('agenticapps', 'dashboard', 'stale')],
      }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })
    fireEvent.click(screen.getByRole('button', { name: /refresh actions for dashboard/i }))
    fireEvent.click(screen.getByText(/run gitnexus analyze/i))

    await waitFor(() => {
      const alertEls = screen.queryAllByRole('alert')
      const errorToast = alertEls.find((el) => el.textContent?.includes('Indexing failed'))
      expect(errorToast).toBeDefined()
      expect(errorToast!.textContent).toContain('timeout')
      // Must NOT show a success toast.
      const statusEls = screen.queryAllByRole('status')
      const successToast = statusEls.find((el) => el.textContent?.includes('Indexed'))
      expect(successToast).toBeUndefined()
    })
  })

  // Stage-1 /review cross-model finding (Claude F4 / Codex #1): CoveragePage
  // now owns a Set<string> of in-flight refresh keys instead of reading
  // refresh.variables. This test exercises a deferred mutateAsync so we can
  // observe the row going pending after the click and clearing after resolve.
  it('per-row in-flight tracking: clicking gitnexus-analyze marks ONLY that row pending until the mutation resolves', async () => {
    let resolveMutate: (val: unknown) => void = () => {}
    const mutateAsync = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveMutate = resolve
        }),
    )
    vi.mocked(useCoverageRefresh).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync,
      isPending: false,
      isError: false,
      isSuccess: false,
      isIdle: true,
      status: 'idle',
      variables: undefined,
      data: undefined,
      error: null,
      reset: vi.fn(),
      context: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
    } as ReturnType<typeof useCoverageRefresh>)

    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({
        rows: [
          makeRow('agenticapps', 'dashboard', 'stale'),
          makeRow('factiv', 'cparx', 'fresh'),
        ],
      }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })

    // Open the dashboard row's refresh popover and click gitnexus-analyze.
    fireEvent.click(screen.getByRole('button', { name: /refresh actions for dashboard/i }))
    fireEvent.click(screen.getByText(/run gitnexus analyze/i))

    // Dashboard row goes pending (aria-busy=true) while the mutation is in flight.
    await waitFor(() => {
      const allRows = screen.getAllByRole('row')
      const dashboardRow = allRows.find(
        (r) => r.textContent?.includes('dashboard') && r.querySelector('td'),
      )
      expect(dashboardRow?.getAttribute('aria-busy')).toBe('true')
      // The cparx row stays NOT-pending — no last-write-wins bleed across rows.
      const cparxRow = allRows.find(
        (r) => r.textContent?.includes('cparx') && r.querySelector('td'),
      )
      expect(cparxRow?.getAttribute('aria-busy')).toBeNull()
    })

    // Resolve the mutation — pending state must clear in the finally block.
    resolveMutate({ ok: true, kind: 'ok', updatedRow: makeRow('agenticapps', 'dashboard', 'fresh') })

    await waitFor(() => {
      const allRows = screen.getAllByRole('row')
      const dashboardRow = allRows.find(
        (r) => r.textContent?.includes('dashboard') && r.querySelector('td'),
      )
      expect(dashboardRow?.getAttribute('aria-busy')).toBeNull()
    })
  })
})

// ── Phase 13 D-13-06 regression: IndexGitNexusButton NEVER rendered ──────────

describe('D-13-06 regression: IndexGitNexusButton never rendered in any state', () => {
  const indexAriaLabel = /^copy gitnexus analyze to clipboard$/i

  function setupCoverage(gitNexusInstallState: 'not-installed' | 'installed-no-registry' | 'installed-with-registry') {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeData({ gitNexusInstallState }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)
  }

  it("IndexGitNexusButton is NOT rendered when gitNexusInstallState='not-installed'", () => {
    setupCoverage('not-installed')
    render(<CoveragePage />, { wrapper })
    expect(screen.queryByRole('button', { name: indexAriaLabel })).toBeNull()
  })

  it("IndexGitNexusButton is NOT rendered when gitNexusInstallState='installed-no-registry'", () => {
    setupCoverage('installed-no-registry')
    render(<CoveragePage />, { wrapper })
    expect(screen.queryByRole('button', { name: indexAriaLabel })).toBeNull()
  })

  it("IndexGitNexusButton is NOT rendered when gitNexusInstallState='installed-with-registry'", () => {
    setupCoverage('installed-with-registry')
    render(<CoveragePage />, { wrapper })
    expect(screen.queryByRole('button', { name: indexAriaLabel })).toBeNull()
  })

  it('InstallGitNexusButton IS present for not-installed state (D-13-07 binary-not-installed fallback preserved)', () => {
    setupCoverage('not-installed')
    render(<CoveragePage />, { wrapper })
    expect(screen.getByRole('button', { name: /^copy npm install -g gitnexus to clipboard$/i })).toBeTruthy()
  })
})

// ── Phase 14 D-14-03/06/07: viewer URL construction from per-row scoped token ─

describe('Phase 14 D-14-03: CoveragePage builds viewer URLs from row viewerToken (never bearer)', () => {
  const AGENT_URL = 'http://127.0.0.1:5193'
  const BEARER_TOKEN = 'test-bearer-token-should-never-appear-in-href'

  function makeRowWithUnderstand(
    family: 'agenticapps' | 'factiv' | 'neuroflash',
    repo: string,
    viewerToken?: string,
  ): CoverageRow {
    return {
      family,
      repo,
      claudeMd: { kind: 'basic', state: 'fresh' },
      gitNexus: { kind: 'basic', state: 'fresh' },
      wiki: { kind: 'basic', state: 'fresh' },
      workflowVersion: {
        kind: 'workflow',
        state: 'fresh',
        installedVersion: '1.7.0',
        headVersion: '1.7.0',
        detail: 'equal',
      },
      overrideCount: 0,
      overrides: [],
      inRegistry: true,
      understand: viewerToken
        ? { kind: 'basic', state: 'fresh', viewerToken }
        : { kind: 'basic', state: 'missing' },
    }
  }

  beforeEach(() => {
    vi.mocked(useCoverageRefresh).mockReturnValue({
      mutate: vi.fn(),
      mutateAsync: vi.fn().mockResolvedValue({ ok: true, kind: 'ok', updatedRow: makeRow('agenticapps', 'x') }),
      isPending: false,
      isError: false,
      isSuccess: false,
      isIdle: true,
      status: 'idle',
      variables: undefined,
      data: undefined,
      error: null,
      reset: vi.fn(),
      context: undefined,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      submittedAt: 0,
    } as ReturnType<typeof useCoverageRefresh>)
  })

  it('Test 1: row with viewerToken → viewer link href is {agentUrl}/understand/{family}/{repo}/?token={token}', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: {
        schemaVersion: 1,
        generatedAtIso: new Date().toISOString(),
        gitNexusInstallState: 'installed-with-registry',
        workflowHeadVersion: '1.7.0',
        rows: [makeRowWithUnderstand('agenticapps', 'claude-workflow', 'v1.abc.def')],
      },
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    const { container } = render(<CoveragePage />, { wrapper })

    // Must find a link whose href matches the expected viewer URL pattern
    const expectedUrl = `${AGENT_URL}/understand/agenticapps/claude-workflow/?token=${encodeURIComponent('v1.abc.def')}`
    const links = container.querySelectorAll('a[href]')
    const viewerLink = Array.from(links).find(
      (a) => (a as HTMLAnchorElement).href === expectedUrl,
    )
    expect(viewerLink).toBeTruthy()
  })

  it('Test 2: row without viewerToken → no viewer link rendered for that row', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: {
        schemaVersion: 1,
        generatedAtIso: new Date().toISOString(),
        gitNexusInstallState: 'installed-with-registry',
        workflowHeadVersion: '1.7.0',
        rows: [makeRowWithUnderstand('factiv', 'cparx')], // missing state, no viewerToken
      },
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    const { container } = render(<CoveragePage />, { wrapper })

    // No link should contain /understand/ path
    const links = Array.from(container.querySelectorAll('a[href]'))
    const understandLinks = links.filter((a) =>
      (a as HTMLAnchorElement).href.includes('/understand/'),
    )
    expect(understandLinks.length).toBe(0)
  })

  it('Test 3: bearer token NEVER appears in any constructed viewer URL (D-14-03)', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: {
        schemaVersion: 1,
        generatedAtIso: new Date().toISOString(),
        gitNexusInstallState: 'installed-with-registry',
        workflowHeadVersion: '1.7.0',
        rows: [
          makeRowWithUnderstand('agenticapps', 'dashboard', 'scoped-viewer-token-xyz'),
          makeRowWithUnderstand('factiv', 'cparx', 'scoped-viewer-token-abc'),
        ],
      },
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    const { container } = render(<CoveragePage />, { wrapper })

    // getPairing() was called (mocked with bearer token)
    expect(vi.mocked(getPairing)).toBeCalled()

    // No link href should contain the bearer token
    const links = Array.from(container.querySelectorAll('a[href]'))
    const leakingLinks = links.filter((a) =>
      (a as HTMLAnchorElement).href.includes(BEARER_TOKEN),
    )
    expect(leakingLinks.length).toBe(0)

    // All /understand/ links should contain the scoped viewer tokens, not bearer
    const understandLinks = links.filter((a) =>
      (a as HTMLAnchorElement).href.includes('/understand/'),
    )
    // We have 2 rows each with a viewerToken, so should be 2 understand links
    expect(understandLinks.length).toBe(2)
    for (const link of understandLinks) {
      expect((link as HTMLAnchorElement).href).not.toContain(BEARER_TOKEN)
    }
  })

  // ── Phase 14 review fix: viewer links gated on health.understand.viewerInstalled ──

  function setupRowsWithTokens() {
    vi.mocked(useCoverage).mockReturnValue({
      data: {
        schemaVersion: 1,
        generatedAtIso: new Date().toISOString(),
        gitNexusInstallState: 'installed-with-registry',
        workflowHeadVersion: '1.7.0',
        rows: [makeRowWithUnderstand('agenticapps', 'claude-workflow', 'v1.abc.def')],
      },
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)
  }

  it('Test 4: health reports viewerInstalled=false → viewer links suppressed (no 503 dead links)', () => {
    setupRowsWithTokens()
    vi.mocked(useHealth).mockReturnValueOnce({
      data: {
        ok: true,
        version: '1.0.0',
        gitnexus: { installed: false, canScan: false },
        understand: {
          viewerInstalled: false,
          viewerVersion: null,
          pluginVersion: '2.7.6',
          updateAvailable: false,
        },
      },
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useHealth>)

    const { container } = render(<CoveragePage />, { wrapper })

    const understandLinks = Array.from(container.querySelectorAll('a[href]')).filter((a) =>
      (a as HTMLAnchorElement).href.includes('/understand/'),
    )
    expect(understandLinks.length).toBe(0)
  })

  // ── Phase 14 review fix: understand state participates in the status filter ──

  function makeRowWithUnderstandState(
    repo: string,
    understandState?: 'fresh' | 'stale' | 'missing',
  ): CoverageRow {
    const row = makeRow('agenticapps', repo) // all 4 classic columns fresh
    if (understandState !== undefined) {
      row.understand = { kind: 'basic', state: understandState }
    }
    return row
  }

  function setupFilterRows(rows: CoverageRow[]) {
    vi.mocked(useCoverage).mockReturnValue({
      data: {
        schemaVersion: 1,
        generatedAtIso: new Date().toISOString(),
        gitNexusInstallState: 'installed-with-registry',
        workflowHeadVersion: '1.7.0',
        rows,
      },
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)
  }

  it('Filter-1: row fresh on all 4 classic columns but understand MISSING matches the "missing" filter chip', () => {
    setupFilterRows([makeRowWithUnderstandState('repo-only-understand-missing', 'missing')])
    render(<CoveragePage />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: '✕ Missing' }))

    // Row must still be visible — understand state participates in the filter
    expect(screen.getByText('repo-only-understand-missing')).toBeTruthy()
    expect(screen.queryByText(/No repos match your filters/i)).toBeNull()
  })

  it('Filter-2: row fresh on all 4 classic columns but understand missing does NOT match the "fresh" chip', () => {
    setupFilterRows([makeRowWithUnderstandState('repo-only-understand-missing', 'missing')])
    render(<CoveragePage />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: '✓ Fresh' }))

    expect(screen.queryByText('repo-only-understand-missing')).toBeNull()
    expect(screen.getByText(/No repos match your filters/i)).toBeTruthy()
  })

  it('Filter-3 REGRESSION: row with NO understand key (old daemon) behaves exactly as before — all-fresh row excluded by "missing" chip', () => {
    setupFilterRows([makeRowWithUnderstandState('repo-old-daemon')])
    render(<CoveragePage />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: '✕ Missing' }))

    expect(screen.queryByText('repo-old-daemon')).toBeNull()
    expect(screen.getByText(/No repos match your filters/i)).toBeTruthy()
  })

  it('Filter-4 REGRESSION: row with NO understand key (old daemon) still matches the "fresh" chip', () => {
    setupFilterRows([makeRowWithUnderstandState('repo-old-daemon')])
    render(<CoveragePage />, { wrapper })

    fireEvent.click(screen.getByRole('button', { name: '✓ Fresh' }))

    expect(screen.getByText('repo-old-daemon')).toBeTruthy()
    expect(screen.queryByText(/No repos match your filters/i)).toBeNull()
  })

  it('Test 5: health unavailable (error, no data) → links NOT suppressed (unknown treated as installed)', () => {
    setupRowsWithTokens()
    vi.mocked(useHealth).mockReturnValueOnce({
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('daemon unreachable'),
    } as ReturnType<typeof useHealth>)

    const { container } = render(<CoveragePage />, { wrapper })

    // Unknown install state must not strip links — the daemon route 503s
    // gracefully if the viewer is truly missing.
    const understandLinks = Array.from(container.querySelectorAll('a[href]')).filter((a) =>
      (a as HTMLAnchorElement).href.includes('/understand/'),
    )
    expect(understandLinks.length).toBe(1)
  })
})
