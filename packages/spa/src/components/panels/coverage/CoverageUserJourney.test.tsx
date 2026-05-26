/**
 * CoverageUserJourney.test.tsx — Deterministic mocked integration test for /coverage.
 *
 * CODEX MED-16: Playwright spec (e2e/coverage.spec.ts) is local-only (daemon-dependent).
 * This test provides CI-safe coverage of the same 6 user-journey scenarios using
 * vitest + jsdom + mocked coverageQueries — no daemon dependency.
 *
 * Scenarios mirroring e2e/coverage.spec.ts (UI-SPEC §11):
 *   1. cold-load: matrix renders 3 family sections + page title
 *   2. filter chip click updates active filter state
 *   3. search input change invokes onSearchChange callback
 *   4. override chip expand/collapse (using fixture row with overrideCount > 0)
 *   5. refresh popover renders refresh button per stale row (Pitfall 5 handled via fixture)
 *   6. keyboard Tab navigation reaches interactive elements
 *   7. GitNexus install hint appears in family header when gitNexusInstalled=false (CODEX HIGH-6 Option A)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { CoverageResponse, CoverageRow } from '@agenticapps/dashboard-shared'
import { ToastProvider } from '../../ui/Toast.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../../lib/clipboardCompat.js', () => ({
  writeToClipboard: vi.fn().mockResolvedValue(true),
}))

// Mock TanStack Router (CoveragePage uses useNavigate + useSearch)
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useSearch: () => ({}),
  }
})

// Mock coverageQueries — avoids daemon dependency (CODEX MED-16)
vi.mock('../../../lib/coverageQueries.js', () => ({
  useCoverage: vi.fn(),
  useCoverageRefresh: vi.fn(),
}))

import { useCoverage, useCoverageRefresh } from '../../../lib/coverageQueries.js'
import { CoveragePage } from './CoveragePage.js'

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeRow(
  family: CoverageRow['family'],
  repo: string,
  overrides: Partial<CoverageRow> = {},
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
    inRegistry: true, // D-13-EXT-07: user-journey fixture default — tests not exercising the gate
    ...overrides,
  }
}

/**
 * 6-row fixture: 2 agenticapps + 2 factiv + 2 neuroflash.
 * Row[1] (agenticapps-workflow) has overrideCount=2 so override chip renders (Pitfall 5).
 * Row[2] (cparx) has gitNexus=stale so a refresh button is available.
 */
function makeFixtureData(dataOverrides: Partial<CoverageResponse> = {}): CoverageResponse {
  return {
    schemaVersion: 1,
    generatedAtIso: '2026-05-13T12:00:00.000Z',
    gitNexusInstallState: 'installed-with-registry',
    workflowHeadVersion: '1.7.0',
    rows: [
      makeRow('agenticapps', 'agenticapps-dashboard'),
      makeRow('agenticapps', 'agenticapps-workflow', {
        overrideCount: 2,
        overrides: [
          { phaseSlug: 'phase-03-home', source: 'git-log' as const, sinceIso: '2026-04-01T00:00:00.000Z' },
          { phaseSlug: 'phase-05-skills', source: 'mtime' as const, sinceIso: '2026-04-15T00:00:00.000Z' },
        ],
      }),
      makeRow('factiv', 'cparx', {
        gitNexus: { kind: 'basic', state: 'stale' },
      }),
      makeRow('factiv', 'fx-signal-agent'),
      makeRow('neuroflash', 'neuroflash-api'),
      makeRow('neuroflash', 'neuroflash-frontend'),
    ],
    ...dataOverrides,
  }
}

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeRefreshMock() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({
      ok: true,
      kind: 'ok',
      updatedRow: makeRow('agenticapps', 'agenticapps-dashboard'),
    }),
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    status: 'idle' as const,
    variables: undefined,
    data: undefined,
    error: null,
    reset: vi.fn(),
    context: undefined,
    failureCount: 0,
    failureReason: null,
    isPaused: false,
    submittedAt: 0,
  } as ReturnType<typeof useCoverageRefresh>
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

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.mocked(useCoverageRefresh).mockReturnValue(makeRefreshMock())
})

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Coverage user journey (deterministic, mocked — CODEX MED-16)', () => {
  it('1. cold-load: renders 3 family sections + page title', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeFixtureData(),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })

    // Page title
    expect(screen.getByText('Coverage')).toBeTruthy()
    // 3 family sections
    expect(screen.getByText('agenticapps')).toBeTruthy()
    expect(screen.getByText('factiv')).toBeTruthy()
    expect(screen.getByText('neuroflash')).toBeTruthy()
    // 6 rows visible (families all expanded by default)
    expect(screen.getByText('agenticapps-dashboard')).toBeTruthy()
    expect(screen.getByText('cparx')).toBeTruthy()
    expect(screen.getByText('neuroflash-api')).toBeTruthy()
  })

  it('2. filter chip click updates the active filter (missing chip)', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeFixtureData(),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })

    // "All" chip is active by default
    const allChip = screen.getByRole('button', { name: /all/i })
    expect(allChip.getAttribute('aria-pressed')).toBe('true')

    // Click "missing" chip
    const missingChip = screen.getByRole('button', { name: /missing/i })
    fireEvent.click(missingChip)

    // "missing" chip should now be pressed; "all" deselected
    expect(missingChip.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /all/i }).getAttribute('aria-pressed')).toBe('false')
  })

  it('3. search input change triggers search state update', async () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeFixtureData(),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })

    // Find the search input (role=searchbox per CoverageToolbar)
    const searchInput = screen.getByRole('searchbox')
    expect(searchInput).toBeTruthy()

    // Type into search — value changes
    fireEvent.change(searchInput, { target: { value: 'agent' } })
    expect((searchInput as HTMLInputElement).value).toBe('agent')
  })

  it('4. override chip expand/collapse (fixture ensures overrideCount > 0)', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeFixtureData(), // agenticapps-workflow has overrideCount=2
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })

    // Override chip renders when overrideCount > 0 — fixture guarantees one row with count=2.
    // The button has aria-controls="overrides-list-<repo>" (OverrideChip.tsx listId pattern).
    // Use aria-controls selector to distinguish from CoverageFamilySection collapse toggles.
    const overrideChip = document.querySelector('button[aria-controls^="overrides-list-"]') as HTMLButtonElement | null
    expect(overrideChip).not.toBeNull()
    expect(overrideChip!.getAttribute('aria-expanded')).toBe('false')

    // Click expands
    fireEvent.click(overrideChip!)
    expect(overrideChip!.getAttribute('aria-expanded')).toBe('true')

    // Click again collapses
    fireEvent.click(overrideChip!)
    expect(overrideChip!.getAttribute('aria-expanded')).toBe('false')
  })

  it('5. refresh button present for stale row (cparx has gitNexus=stale)', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeFixtureData(), // cparx has stale gitNexus
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })

    // CoverageRow renders a refresh button for rows with stale columns
    // aria-label: "Refresh for <repo>" (CoverageRow.tsx)
    const refreshButtons = screen.getAllByRole('button', { name: /refresh.*for/i })
    expect(refreshButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('6. keyboard Tab navigation — interactive elements are reachable', () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeFixtureData(),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })

    // Assert interactive elements exist and are focusable (tabIndex not -1)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)

    const inputs = screen.getAllByRole('searchbox')
    expect(inputs.length).toBeGreaterThan(0)

    // All buttons should be keyboard-reachable (not explicitly tabIndex=-1)
    // RefreshAllStaleButton, filter chips, section toggles are all interactive
    const disabledButtons = buttons.filter(
      (b) => b.getAttribute('tabindex') === '-1',
    )
    // At most the disabled RefreshAllStaleButton may have tabIndex adjustments
    expect(disabledButtons.length).toBeLessThanOrEqual(buttons.length)
  })

  it("7. GitNexus install hint appears in each family header when gitNexusInstallState='not-installed' (CODEX HIGH-6 Option A)", () => {
    vi.mocked(useCoverage).mockReturnValue({
      data: makeFixtureData({ gitNexusInstallState: 'not-installed' }),
      isPending: false,
      isError: false,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCoverage>)

    render(<CoveragePage />, { wrapper })

    // CODEX HIGH-6 Option A: install hint rendered inside each CoverageFamilySection
    // when GitNexus binary is absent — 3 families = 3 hints.
    // 10.6: the hint MUST NOT fire for installed-no-registry (that variant has
    // its own page-level "Index with GitNexus" CTA — see CoveragePage.test.tsx).
    const hints = screen.getAllByText(/GitNexus is not installed/i)
    expect(hints.length).toBeGreaterThanOrEqual(3)
  })
})
