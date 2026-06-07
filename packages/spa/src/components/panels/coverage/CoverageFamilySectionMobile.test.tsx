/**
 * CoverageFamilySectionMobile.test.tsx — Mobile (xs viewport) card-per-row
 * layout for the Coverage page. Activated by CoverageFamilySection when
 * useViewportBreakpoint() === 'xs' (<640px Tailwind 4 default).
 *
 * Phase 12 Plan 12-05 Task 1 (RED first).
 *
 * Invariants this layout preserves:
 * - All 4 column states render (claudeMd / gitNexus / wiki / workflowVersion).
 * - Refresh button preserves the Phase 11.2 D-11.2-11 44×44 touch-target spec.
 * - aria-busy + disabled mirror the in-flight refresh Set.
 * - OverrideChip surfaces when overrideCount > 0.
 * - NO <table> element rendered in the mobile branch.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CoverageRow as CoverageRowData } from '@agenticapps/dashboard-shared'
import { CoverageFamilySectionMobile } from './CoverageFamilySectionMobile.js'
import { ToastProvider } from '../../ui/Toast.js'

vi.mock('../../../lib/clipboardCompat.js', () => ({
  writeToClipboard: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../../lib/pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'test-token-1234',
    pairedAt: '2026-01-01T00:00:00.000Z',
  })),
}))

// Stage-2 I-3: mock ScanPill so mobile wiring tests assert prop forwarding +
// mutual-exclusion with refresh button, without exercising scan mutation/poll.
vi.mock('./ScanPill.js', () => ({
  ScanPill: ({
    scope,
    target,
    canScan,
    installed,
  }: {
    scope: string
    target: string
    canScan: boolean
    installed: boolean
  }) => {
    if (!installed) return null
    return React.createElement(
      'button',
      {
        'data-testid': 'scan-pill',
        'data-scope': scope,
        'data-target': target,
        'data-can-scan': String(canScan),
        disabled: !canScan || undefined,
      },
      'Scan',
    )
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeFetchResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
  })
}

function withQC(children: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
    },
  })
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
})

function makeRow(
  repo: string,
  states: {
    claudeMd?: 'fresh' | 'stale' | 'missing' | 'not-applicable'
    gitNexus?: 'fresh' | 'stale' | 'missing' | 'not-applicable'
    wiki?: 'fresh' | 'stale' | 'missing' | 'not-applicable'
    workflow?: 'fresh' | 'stale' | 'missing' | 'not-applicable'
  } = {},
  overrideCount: number = 0,
): CoverageRowData {
  return {
    family: 'agenticapps',
    repo,
    claudeMd: { kind: 'basic', state: states.claudeMd ?? 'fresh' },
    gitNexus: { kind: 'basic', state: states.gitNexus ?? 'fresh' },
    wiki: { kind: 'basic', state: states.wiki ?? 'fresh' },
    workflowVersion: {
      kind: 'workflow',
      state: states.workflow ?? 'fresh',
      installedVersion: '1.7.0',
      headVersion: '1.7.0',
      detail: 'equal',
    },
    overrideCount,
    overrides:
      overrideCount > 0
        ? [{ phaseSlug: 'phase-01', sinceIso: '2026-01-01', source: 'git-log' }]
        : [],
    inRegistry: true, // D-13-EXT-07: mobile fixture default — tests not exercising the gate
  }
}

beforeEach(() => {
  localStorage.clear()
  mockFetch.mockReset()
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/coverage/history')) {
      const m = url.match(/repoId=([^&]+)/)
      const repoId = m ? decodeURIComponent(m[1] ?? '') : 'unknown'
      return makeFetchResponse({
        schemaVersion: 1,
        repoId,
        windowDays: 14,
        cells: {
          claudeMd: { direction: null, daysSince: null },
          gitNexus: { direction: null, daysSince: null },
          wiki: { direction: null, daysSince: null },
          workflowVersion: { direction: null, daysSince: null },
        },
      })
    }
    return makeFetchResponse({}, 404)
  })
})

describe('CoverageFamilySectionMobile', () => {
  it('renders family header text identical to CoverageFamilySection (family name + repo count)', () => {
    const rows = [makeRow('repo-a'), makeRow('repo-b')]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    expect(screen.queryAllByText(/agenticapps/i).length).toBeGreaterThan(0)
    // 2 repos count rendered
    expect(screen.getByText(/2 repos/i)).toBeTruthy()
  })

  it('renders install hint when gitNexusInstallState === "not-installed"', () => {
    const rows = [makeRow('repo-a')]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="not-installed"
        />,
      ),
    )
    expect(screen.getByText(/GitNexus is not installed/i)).toBeTruthy()
  })

  it('does NOT render install hint when gitNexusInstallState === "installed-with-registry"', () => {
    const rows = [makeRow('repo-a')]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    expect(screen.queryByText(/GitNexus is not installed/i)).toBeNull()
  })

  it('renders one <article> card per row', () => {
    const rows = [makeRow('repo-a'), makeRow('repo-b'), makeRow('repo-c')]
    const { container } = render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    expect(container.querySelectorAll('article').length).toBe(3)
  })

  it('each card header shows the repo name', () => {
    const rows = [makeRow('repo-alpha'), makeRow('repo-beta')]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    expect(screen.getByText('repo-alpha')).toBeTruthy()
    expect(screen.getByText('repo-beta')).toBeTruthy()
  })

  it('each card body shows all 4 column states as <CoverageCell> figures', () => {
    const rows = [
      makeRow('repo-a', {
        claudeMd: 'fresh',
        gitNexus: 'stale',
        wiki: 'missing',
        workflow: 'fresh',
      }),
    ]
    const { container } = render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    // CoverageCell renders a <figure role="figure" aria-label="<column> for <repo>: ...">
    const cells = container.querySelectorAll('figure[role="figure"]')
    expect(cells.length).toBe(4)
    // aria-labels reflect each column name for this repo
    expect(screen.getByLabelText(/claudeMd for repo-a/)).toBeTruthy()
    expect(screen.getByLabelText(/gitNexus for repo-a/)).toBeTruthy()
    expect(screen.getByLabelText(/wiki for repo-a/)).toBeTruthy()
    expect(screen.getByLabelText(/workflowVersion for repo-a/)).toBeTruthy()
  })

  it('card body uses a 2-column grid layout for the 4 cells (grid-cols-2)', () => {
    const rows = [makeRow('repo-a')]
    const { container } = render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    const grid = container.querySelector('article div.grid')
    expect(grid).not.toBeNull()
    expect(grid?.className).toMatch(/grid-cols-2/)
  })

  it('refresh button has min-w-[44px] AND min-h-[44px] AND p-[15px] (Phase 11.2 D-11.2-11 invariant)', () => {
    const rows = [makeRow('repo-a')]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh.*repo-a/i })
    expect(refreshBtn.className).toMatch(/min-w-\[44px\]/)
    expect(refreshBtn.className).toMatch(/min-h-\[44px\]/)
    expect(refreshBtn.className).toMatch(/p-\[15px\]/)
  })

  it('refresh button is disabled + aria-busy when row is in inFlightRefreshes', () => {
    const rows = [makeRow('repo-a')]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
          inFlightRefreshes={new Set(['agenticapps/repo-a'])}
        />,
      ),
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh.*repo-a/i })
    expect(refreshBtn.getAttribute('aria-busy')).toBe('true')
    expect(refreshBtn).toHaveProperty('disabled', true)
  })

  it('refresh button is enabled and not aria-busy when row is NOT in inFlightRefreshes', () => {
    const rows = [makeRow('repo-a')]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
          inFlightRefreshes={new Set()}
        />,
      ),
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh.*repo-a/i })
    expect(refreshBtn.getAttribute('aria-busy')).toBeNull()
    expect(refreshBtn).toHaveProperty('disabled', false)
  })

  it('clicking refresh button invokes onRefresh with action gitnexus-analyze + correct context', () => {
    const onRefresh = vi.fn()
    const rows = [makeRow('repo-a')]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
          onRefresh={onRefresh}
        />,
      ),
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh.*repo-a/i })
    fireEvent.click(refreshBtn)
    expect(onRefresh).toHaveBeenCalledWith('gitnexus-analyze', {
      family: 'agenticapps',
      repo: 'repo-a',
    })
  })

  it('does NOT render any <table> element in the mobile layout', () => {
    const rows = [makeRow('repo-a'), makeRow('repo-b')]
    const { container } = render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    expect(container.querySelectorAll('table').length).toBe(0)
  })

  it('renders OverrideChip in card header when overrideCount > 0', () => {
    const rows = [makeRow('repo-a', {}, 2)]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    // OverrideChip surfaces as a button with aria-label including the count
    expect(
      screen.getByRole('button', { name: /2 phase reviews overridden in repo-a/i }),
    ).toBeTruthy()
  })

  it('does NOT render OverrideChip when overrideCount === 0 (Pitfall 5)', () => {
    const rows = [makeRow('repo-a', {}, 0)]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    expect(screen.queryByRole('button', { name: /overridden/i })).toBeNull()
  })
})

// ── Stage-2 I-3: ScanPill wiring on mobile ──────────────────────────────────

describe('I-3: mobile ScanPill wiring (D-13-08 parity with desktop)', () => {
  it("renders ScanPill (not refresh button) for state='missing' + gitnexusInstalled=true", () => {
    const rows = [makeRow('repo-a', { gitNexus: 'missing' })]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
          gitnexusInstalled={true}
          gitnexusCanScan={true}
        />,
      ),
    )
    const pill = screen.getByTestId('scan-pill')
    expect(pill).toBeTruthy()
    expect(pill.getAttribute('data-scope')).toBe('repo')
    expect(pill.getAttribute('data-target')).toBe('agenticapps/repo-a')
    expect(pill.getAttribute('data-can-scan')).toBe('true')
    // Mutual exclusion: the legacy refresh button must NOT render alongside the pill
    expect(screen.queryByRole('button', { name: /refresh.*repo-a/i })).toBeNull()
  })

  it("renders ScanPill (not refresh button) for state='not-applicable' + gitnexusInstalled=true", () => {
    const rows = [makeRow('repo-a', { gitNexus: 'not-applicable' })]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
          gitnexusInstalled={true}
          gitnexusCanScan={true}
        />,
      ),
    )
    expect(screen.getByTestId('scan-pill')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /refresh.*repo-a/i })).toBeNull()
  })

  it("renders ScanPill disabled when canScan=false (Tailscale D-13-11b)", () => {
    const rows = [makeRow('repo-a', { gitNexus: 'missing' })]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
          gitnexusInstalled={true}
          gitnexusCanScan={false}
        />,
      ),
    )
    const pill = screen.getByTestId('scan-pill')
    expect(pill).toBeDisabled()
    expect(pill.getAttribute('data-can-scan')).toBe('false')
  })

  it("does NOT render ScanPill when gitnexusInstalled=false — legacy refresh button still renders", () => {
    const rows = [makeRow('repo-a', { gitNexus: 'missing' })]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="not-installed"
          gitnexusInstalled={false}
          gitnexusCanScan={false}
        />,
      ),
    )
    expect(screen.queryByTestId('scan-pill')).toBeNull()
    expect(screen.getByRole('button', { name: /refresh.*repo-a/i })).toBeTruthy()
  })

  it("does NOT render ScanPill for state='stale' — refresh button still renders (mirrors desktop popover-only for stale)", () => {
    const rows = [makeRow('repo-a', { gitNexus: 'stale' })]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
          gitnexusInstalled={true}
          gitnexusCanScan={true}
        />,
      ),
    )
    expect(screen.queryByTestId('scan-pill')).toBeNull()
    expect(screen.getByRole('button', { name: /refresh.*repo-a/i })).toBeTruthy()
  })

  it("does NOT render ScanPill for state='fresh' — refresh button still renders", () => {
    const rows = [makeRow('repo-a', { gitNexus: 'fresh' })]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
          gitnexusInstalled={true}
          gitnexusCanScan={true}
        />,
      ),
    )
    expect(screen.queryByTestId('scan-pill')).toBeNull()
    expect(screen.getByRole('button', { name: /refresh.*repo-a/i })).toBeTruthy()
  })

  it('omitting gitnexusInstalled/gitnexusCanScan defaults to false (no ScanPill, refresh button stays)', () => {
    const rows = [makeRow('repo-a', { gitNexus: 'missing' })]
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    expect(screen.queryByTestId('scan-pill')).toBeNull()
    expect(screen.getByRole('button', { name: /refresh.*repo-a/i })).toBeTruthy()
  })
})

// ── Phase 14 D-14-06: understand column in mobile card layout ───────────────

// Mock UnderstandCopyPill for mobile wiring test (same pattern as CoverageRow.test.tsx)
vi.mock('./UnderstandCopyPill.js', () => ({
  UnderstandCopyPill: ({
    state,
    viewerUrl,
    repo,
  }: {
    family: string
    repo: string
    viewerUrl?: string
    state: string
  }) =>
    React.createElement(
      'div',
      {
        'data-testid': 'understand-pill',
        'data-state': state,
        'data-viewer-url': viewerUrl ?? '',
        'data-repo': repo,
      },
      state,
    ),
}))

describe('Phase 14 — understand cell in mobile card layout (D-14-06 Test-5)', () => {
  it('Test-5: mobile card renders understand cell with UnderstandCopyPill for understand.state=missing', () => {
    const rows = [makeRow('repo-a', {}, 0)]
    // Add understand field to the row. Object.assign preserves required field types
    // so exactOptionalPropertyTypes is satisfied (spread widens required fields to optional).
    const rowWithUnderstand: CoverageRowData = Object.assign({}, rows[0], {
      understand: { kind: 'basic' as const, state: 'missing' as const },
    })
    render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={[rowWithUnderstand]}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    const pill = screen.getByTestId('understand-pill')
    expect(pill).toBeTruthy()
    expect(pill.getAttribute('data-state')).toBe('missing')
  })

  it('Test-5b: mobile card renders em-dash for understand=undefined (back-compat)', () => {
    const rows = [makeRow('repo-a', {}, 0)]
    const { container } = render(
      withQC(
        <CoverageFamilySectionMobile
          family="agenticapps"
          rows={rows}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    // No understand pill should render when field is absent
    expect(screen.queryByTestId('understand-pill')).toBeNull()
    // em-dash placeholder visible
    expect(container.innerHTML).toContain('—')
  })
})
