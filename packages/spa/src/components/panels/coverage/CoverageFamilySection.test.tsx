/**
 * CoverageFamilySection.test.tsx — Tests for sticky family header + rows + GitNexus install hint.
 *
 * CODEX HIGH-6 Option A: install hint inside each family header, not page-level banner.
 * CODEX MED: worst-state-wins per row (missing > stale > fresh > not-applicable).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CoverageRow as CoverageRowData } from '@agenticapps/dashboard-shared'
import { CoverageFamilySection } from './CoverageFamilySection.js'
import { COVERAGE_COL_WIDTHS } from './coverageColumns.js'
import { ToastProvider } from '../../ui/Toast.js'

vi.mock('../../../lib/clipboardCompat.js', () => ({
  writeToClipboard: vi.fn().mockResolvedValue(true),
}))

import { writeToClipboard } from '../../../lib/clipboardCompat.js'

// Phase 11-04: CoverageRow (rendered by CoverageFamilySection) now calls
// useCoverageHistory and therefore requires a QueryClientProvider. fetch is
// stubbed so the hook's network attempt does not flake. pairing is mocked so
// apiFetch can build a URL without a real daemon.

vi.mock('../../../lib/pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'test-token-1234',
    pairedAt: '2026-01-01T00:00:00.000Z',
  })),
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
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
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
    overrideCount: 0,
    overrides: [],
  }
}

beforeEach(() => {
  // Clear localStorage between tests
  localStorage.clear()
  mockFetch.mockReset()
  // Stub /api/coverage/history with empty drift so CoverageRow's hook resolves
  // cleanly. Tests in this file do NOT assert on drift behaviour — those live
  // in CoverageRow.test.tsx.
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

describe('CoverageFamilySection', () => {
  it('renders sticky family header with family name and aggregate counts', () => {
    const rows = [
      makeRow('repo-a', { claudeMd: 'fresh' }),
      makeRow('repo-b', { gitNexus: 'stale' }),
    ]
    render(
      withQC(
        <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstallState="installed-with-registry" />,
      ),
    )
    expect(screen.getByText(/agenticapps/i)).toBeTruthy()
    // Should show counts
    expect(screen.getByText(/✓/)).toBeTruthy()
  })

  it('aggregate counts reflect FILTERED rows using worst-state-wins per row', () => {
    // repo-a: worst = missing (one column missing)
    // repo-b: worst = stale (one column stale, rest fresh)
    // repo-c: worst = fresh (all fresh)
    const rows = [
      makeRow('repo-a', { claudeMd: 'missing', gitNexus: 'fresh', wiki: 'fresh', workflow: 'fresh' }),
      makeRow('repo-b', { claudeMd: 'fresh', gitNexus: 'stale', wiki: 'fresh', workflow: 'fresh' }),
      makeRow('repo-c', { claudeMd: 'fresh', gitNexus: 'fresh', wiki: 'fresh', workflow: 'fresh' }),
    ]
    render(
      withQC(
        <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstallState="installed-with-registry" />,
      ),
    )
    // ✕ 1 (missing), ⚠ 1 (stale), ✓ 1 (fresh)
    expect(screen.getByText(/✕\s*1/)).toBeTruthy()
    expect(screen.getByText(/⚠\s*1/)).toBeTruthy()
    expect(screen.getByText(/✓\s*1/)).toBeTruthy()
  })

  it('aggregate count semantics: each row counts ONCE in the highest-priority bucket only (CODEX MED)', () => {
    // repo-a has BOTH missing AND stale columns — must count only ONCE in missing bucket
    const rows = [
      makeRow('repo-a', { claudeMd: 'missing', gitNexus: 'stale', wiki: 'fresh', workflow: 'fresh' }),
    ]
    render(
      withQC(
        <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstallState="installed-with-registry" />,
      ),
    )
    // Must show ✕ 1 (not ✕ 1 ⚠ 1 — double counting is wrong)
    expect(screen.getByText(/✕\s*1/)).toBeTruthy()
    // ⚠ count must be 0 (repo-a already counted in missing)
    expect(screen.getByText(/⚠\s*0/)).toBeTruthy()
  })

  it('collapse toggle button hides the table body when clicked', () => {
    const rows = [makeRow('repo-a')]
    render(
      withQC(
        <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstallState="installed-with-registry" />,
      ),
    )
    // Rows visible initially
    expect(screen.getByText('repo-a')).toBeTruthy()
    const toggle = screen.getByRole('button', { name: /agenticapps/i })
    fireEvent.click(toggle)
    // Rows hidden after collapse
    expect(screen.queryByText('repo-a')).toBeNull()
  })

  it("localStorage 'coverage:section-collapsed:<family>' key is written on collapse/expand toggle", () => {
    const rows = [makeRow('repo-a')]
    render(
      withQC(
        <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstallState="installed-with-registry" />,
      ),
    )
    const toggle = screen.getByRole('button', { name: /agenticapps/i })
    fireEvent.click(toggle)
    expect(localStorage.getItem('coverage:section-collapsed:agenticapps')).toBe('true')
    fireEvent.click(toggle)
    expect(localStorage.getItem('coverage:section-collapsed:agenticapps')).toBe('false')
  })

  it("collapsed state is restored from localStorage 'coverage:section-collapsed:<family>' on mount", () => {
    localStorage.setItem('coverage:section-collapsed:factiv', 'true')
    const rows = [makeRow('repo-x')]
    render(
      withQC(
        <CoverageFamilySection family="factiv" rows={rows} gitNexusInstallState="installed-with-registry" />,
      ),
    )
    // repo-x should NOT be visible (section starts collapsed)
    expect(screen.queryByText('repo-x')).toBeNull()
  })

  it("renders GitNexus install hint inside family header when gitNexusInstallState='not-installed' (CODEX HIGH-6 Option A)", () => {
    const rows = [makeRow('repo-a')]
    render(
      withQC(
        <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstallState="not-installed" />,
      ),
    )
    expect(screen.getByText(/GitNexus is not installed/i)).toBeTruthy()
  })

  // 10.6: the install hint must NOT fire for the installed-but-never-indexed
  // state — the page-level "Index with GitNexus" CTA handles that case. Under
  // the prior boolean (`!gitNexusInstalled`) this section incorrectly told the
  // user to install when they already had the binary.
  it("does NOT render the install hint when gitNexusInstallState='installed-no-registry' (10.6)", () => {
    const rows = [makeRow('repo-a')]
    render(
      withQC(
        <CoverageFamilySection family="agenticapps" rows={rows} gitNexusInstallState="installed-no-registry" />,
      ),
    )
    expect(screen.queryByText(/GitNexus is not installed/i)).toBeNull()
  })
})

describe('CoverageFamilySection sticky stack consumes --ph-h (IMP-02)', () => {
  it('family-header sticky top uses calc(var(--ph-h) - 1.5rem)', () => {
    const { container } = render(
      withQC(
        <CoverageFamilySection
          family="agenticapps"
          rows={[makeRow('repo-a')]}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    const familyHeader = container.querySelector('header.sticky')
    expect(familyHeader?.className).toMatch(/top-\[calc\(var\(--ph-h\)-1\.5rem\)\]/)
    expect(familyHeader?.className).not.toMatch(/\btop-8\b/)
  })

  it('column-header sticky top uses calc(var(--ph-h) + 1.5625rem)', () => {
    const { container } = render(
      withQC(
        <CoverageFamilySection
          family="agenticapps"
          rows={[makeRow('repo-a')]}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    const ths = container.querySelectorAll('thead th.sticky')
    ths.forEach((th) => {
      expect(th.className).toMatch(/top-\[calc\(var\(--ph-h\)\+1\.5625rem\)\]/)
    })
  })
})

describe('column-width lock (IMP-01)', () => {
  it('renders <colgroup> with 6 <col> elements consuming COVERAGE_COL_WIDTHS', () => {
    const fixture: CoverageRowData[] = [
      makeRow('repo-a', { claudeMd: 'fresh', gitNexus: 'fresh', wiki: 'fresh', workflow: 'fresh' }),
      makeRow('repo-b', { claudeMd: 'stale', gitNexus: 'missing', wiki: 'fresh', workflow: 'fresh' }),
    ]
    const { container } = render(
      withQC(
        <CoverageFamilySection
          family="agenticapps"
          rows={fixture}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    const cols = container.querySelectorAll('colgroup > col')
    expect(cols).toHaveLength(6)
    expect(cols[0]?.className).toBe(COVERAGE_COL_WIDTHS.repo)
    expect(cols[1]?.className).toBe(COVERAGE_COL_WIDTHS.claudeMd)
    expect(cols[2]?.className).toBe(COVERAGE_COL_WIDTHS.gitNexus)
    expect(cols[3]?.className).toBe(COVERAGE_COL_WIDTHS.wiki)
    expect(cols[4]?.className).toBe(COVERAGE_COL_WIDTHS.workflow)
    expect(cols[5]?.className).toBe(COVERAGE_COL_WIDTHS.actions)
  })

  it('marks <table> as table-fixed', () => {
    const { container } = render(
      withQC(
        <CoverageFamilySection
          family="agenticapps"
          rows={[makeRow('repo-a')]}
          gitNexusInstallState="installed-with-registry"
        />,
      ),
    )
    const table = container.querySelector('table')
    expect(table?.className).toContain('table-fixed')
  })
})

describe('CoverageFamilySection family-hint toast (IMP-03)', () => {
  beforeEach(() => {
    vi.mocked(writeToClipboard).mockResolvedValue(true)
  })

  it('fires success toast when family install hint button is clicked and clipboard succeeds', async () => {
    const rows = [makeRow('repo-a')]
    render(
      withQC(
        <ToastProvider>
          <CoverageFamilySection
            family="agenticapps"
            rows={rows}
            gitNexusInstallState="not-installed"
          />
        </ToastProvider>,
      ),
    )
    await userEvent.click(screen.getByRole('button', { name: /copy npm install -g gitnexus/i }))
    const statusEls = screen.getAllByRole('status')
    const toastEl = statusEls.find((el) => el.textContent?.includes('Copied'))
    expect(toastEl).toBeDefined()
    expect(toastEl!.textContent).toContain('install GitNexus')
  })

  it('fires error toast when clipboard write fails', async () => {
    vi.mocked(writeToClipboard).mockResolvedValue(false)
    const rows = [makeRow('repo-a')]
    render(
      withQC(
        <ToastProvider>
          <CoverageFamilySection
            family="agenticapps"
            rows={rows}
            gitNexusInstallState="not-installed"
          />
        </ToastProvider>,
      ),
    )
    await userEvent.click(screen.getByRole('button', { name: /copy npm install -g gitnexus/i }))
    const statusEls = screen.getAllByRole('status')
    const toastEl = statusEls.find((el) => el.textContent?.includes('Copy failed'))
    expect(toastEl).toBeDefined()
    expect(toastEl!.textContent).toContain('open the help guide for the command')
  })
})
