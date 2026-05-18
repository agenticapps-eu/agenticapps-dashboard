/**
 * CoverageRow.test.tsx — Tests for single repo row: 4 cells + override chip + refresh popover.
 *
 * CODEX HIGH-1: absPath NEVER rendered in DOM.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CoverageRow as CoverageRowData } from '@agenticapps/dashboard-shared'
import { CoverageRow } from './CoverageRow.js'

function makeRow(overrides: Partial<CoverageRowData> = {}): CoverageRowData {
  return {
    family: 'agenticapps',
    repo: 'agenticapps-dashboard',
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
    ...overrides,
  }
}

// ── Test infrastructure for Phase 11-04 hook ownership tests ─────────────────
//
// CoverageRow now owns useCoverageHistory(repoId). Every render must run
// inside a QueryClientProvider. Existing tests that previously called
// render() bare are migrated to renderInQC().
//
// Pairing is stubbed so apiFetch can build a request URL without a real
// daemon. fetch is mocked so we can either control the response (perf
// tests 5+6) or mock useCoverageHistory directly (behaviour tests 1-4).

vi.mock('../../../lib/pairing.js', () => ({
  getPairing: vi.fn(() => ({
    agentUrl: 'http://127.0.0.1:5193',
    token: 'test-token-1234',
    pairedAt: '2026-01-01T00:00:00.000Z',
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function emptyHistoryBody(repoId: string) {
  return {
    schemaVersion: 1,
    repoId,
    windowDays: 14,
    cells: {
      claudeMd: { direction: null, daysSince: null },
      gitNexus: { direction: null, daysSince: null },
      wiki: { direction: null, daysSince: null },
      workflowVersion: { direction: null, daysSince: null },
    },
  }
}

function makeFetchResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    clone: () => ({ json: () => Promise.resolve(body) }),
  })
}

function makeQC() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
    },
  })
}

function renderInQC(ui: React.ReactElement, qc: QueryClient = makeQC()) {
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>,
    ),
  }
}

beforeEach(() => {
  mockFetch.mockReset()
  // Default: every coverage/history fetch returns empty drift, so the
  // existing tests (which don't care about drift) don't crash.
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/coverage/history')) {
      const m = url.match(/repoId=([^&]+)/)
      const repoId = m ? decodeURIComponent(m[1] ?? '') : 'unknown'
      return makeFetchResponse(emptyHistoryBody(repoId))
    }
    return makeFetchResponse({ error: 'unmocked' }, 404)
  })
})

afterEach(() => {
  cleanup()
})

describe('CoverageRow', () => {
  it('renders 4 cells in the correct order: claudeMd, gitNexus, wiki, workflowVersion', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} />
        </tbody>
      </table>,
    )
    // Each cell has an aria-label containing the column name
    expect(screen.getByLabelText(/claudeMd for/i)).toBeTruthy()
    expect(screen.getByLabelText(/gitNexus for/i)).toBeTruthy()
    expect(screen.getByLabelText(/wiki for/i)).toBeTruthy()
    expect(screen.getByLabelText(/workflowVersion for/i)).toBeTruthy()
  })

  it('renders OverrideChip component ONLY when overrideCount > 0 (not rendered when overrideCount === 0)', () => {
    const qc = makeQC()
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <table>
          <tbody>
            <CoverageRow row={makeRow({ overrideCount: 0 })} />
          </tbody>
        </table>
      </QueryClientProvider>,
    )
    expect(screen.queryByRole('button', { name: /override/i })).toBeNull()

    rerender(
      <QueryClientProvider client={qc}>
        <table>
          <tbody>
            <CoverageRow
              row={makeRow({
                overrideCount: 2,
                overrides: [
                  { phaseSlug: 'phase-10', sinceIso: '2026-04-01T00:00:00Z', source: 'mtime' },
                  { phaseSlug: 'phase-09', sinceIso: '2026-03-01T00:00:00Z', source: 'git-log' },
                ],
              })}
            />
          </tbody>
        </table>
      </QueryClientProvider>,
    )
    expect(screen.getByRole('button', { name: /2 phase reviews overridden/i })).toBeTruthy()
  })

  it('refresh button appears and triggers popover on click', () => {
    const onRefresh = vi.fn()
    renderInQC(
      <table>
        <tbody>
          <CoverageRow
            row={makeRow({ gitNexus: { kind: 'basic', state: 'stale' } })}
            onRefresh={onRefresh}
          />
        </tbody>
      </table>,
    )
    // Refresh button should be in DOM (visible on hover/focus)
    const refreshBtn = screen.getByRole('button', { name: /refresh actions/i })
    expect(refreshBtn).toBeTruthy()
    fireEvent.click(refreshBtn)
    // Popover options for stale gitNexus column
    expect(screen.getByText(/gitnexus analyze/i)).toBeTruthy()
  })

  it('refresh popover dismisses on Escape key press', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow({ gitNexus: { kind: 'basic', state: 'stale' } })} />
        </tbody>
      </table>,
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh actions/i })
    fireEvent.click(refreshBtn)
    expect(screen.getByText(/gitnexus analyze/i)).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText(/gitnexus analyze/i)).toBeNull()
  })

  it('absPath NEVER rendered in DOM (CODEX HIGH-1 SPA-side enforcement)', () => {
    const row = makeRow()
    const { container } = renderInQC(
      <table>
        <tbody>
          <CoverageRow row={row} />
        </tbody>
      </table>,
    )
    // absPath is not in CoverageRow's public schema, and must never appear in DOM
    expect(container.innerHTML).not.toContain('absPath')
    expect(container.innerHTML).not.toContain('/Users/')
  })

  // Phase 11 PLI-02 / D-11-10 — refresh button defaults to opacity-30 (was
  // opacity-0). Touchpad/keyboard discoverability per Phase 10.6 IMPECCABLE
  // triage. Hover/focus still bumps to opacity-100.

  it('PLI-02: per-row refresh button defaults to opacity-30 (not opacity-0)', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} />
        </tbody>
      </table>,
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh actions/i })
    expect(refreshBtn.className).toContain('opacity-30')
    expect(refreshBtn.className).not.toContain('opacity-0')
  })

  it('PLI-02: per-row refresh button still bumps to opacity-100 on hover (group-hover preserved)', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} />
        </tbody>
      </table>,
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh actions/i })
    // hover/group-hover variant preserved so the button reaches full opacity on
    // pointer hover (UI-SPEC §5).
    expect(refreshBtn.className).toMatch(/group-hover:opacity-100|hover:opacity-100/)
  })

  it('PLI-02: per-row refresh button still bumps to opacity-100 on focus (keyboard discoverability preserved)', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} />
        </tbody>
      </table>,
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh actions/i })
    // focus/focus-within variant preserved so keyboard users still see full
    // opacity when the button is the active element.
    expect(refreshBtn.className).toMatch(/focus:opacity-100|focus-within:opacity-100/)
  })

  // ── Phase 11-04 hook-ownership + performance budget (REVIEWS #1 + #2) ─────

  it('Drift-1: CoverageRow renders → ONE history fetch per row mount (single owner — Option C)', async () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} />
        </tbody>
      </table>,
    )
    await waitFor(() => {
      const historyCalls = mockFetch.mock.calls.filter((c) =>
        typeof c[0] === 'string' && c[0].includes('/api/coverage/history'),
      )
      expect(historyCalls.length).toBe(1)
    })
  })

  it('Drift-2: hook returns drift for claudeMd → that cell receives a ▲Nd badge', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/coverage/history')) {
        return makeFetchResponse({
          schemaVersion: 1,
          repoId: 'agenticapps/agenticapps-dashboard',
          windowDays: 14,
          cells: {
            claudeMd: { direction: 'up', daysSince: 3 },
            gitNexus: { direction: null, daysSince: null },
            wiki: { direction: null, daysSince: null },
            workflowVersion: { direction: null, daysSince: null },
          },
        })
      }
      return makeFetchResponse({}, 404)
    })

    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} />
        </tbody>
      </table>,
    )

    await waitFor(() => {
      expect(screen.getByText('▲3d')).toBeTruthy()
    })
    // Other three cells stay badge-less
    expect(screen.queryByText('▼')).toBeNull()
  })

  it('Drift-3: history isPending (network never resolves) → no badges on any cell, no crash', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // never resolves
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} />
        </tbody>
      </table>,
    )
    // Cells render with their existing 4-state content (regression guard)
    expect(screen.getByLabelText(/claudeMd for/i)).toBeTruthy()
    // No drift badges
    expect(screen.queryByText(/▲|▼/)).toBeNull()
  })

  it('Drift-4: history isError (500 response) → no badges on any cell, row does not crash', async () => {
    mockFetch.mockImplementation(() => makeFetchResponse({ error: 'boom' }, 500))
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} />
        </tbody>
      </table>,
    )
    // Wait for the query to settle (isError true)
    await waitFor(() => {
      const historyCalls = mockFetch.mock.calls.filter((c) =>
        typeof c[0] === 'string' && c[0].includes('/api/coverage/history'),
      )
      expect(historyCalls.length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.queryByText(/▲|▼/)).toBeNull()
  })

  it('Drift-5: REVIEWS action item 2 performance budget — N rows = N history fetches (≤ 1 per repo on first paint)', async () => {
    const rows: CoverageRowData[] = [
      makeRow({ repo: 'repo-a' }),
      makeRow({ repo: 'repo-b' }),
      makeRow({ repo: 'repo-c' }),
      makeRow({ repo: 'repo-d' }),
      makeRow({ repo: 'repo-e' }),
    ]
    renderInQC(
      <table>
        <tbody>
          {rows.map((r) => (
            <CoverageRow key={r.repo} row={r} />
          ))}
        </tbody>
      </table>,
    )
    await waitFor(() => {
      const historyCalls = mockFetch.mock.calls.filter((c) =>
        typeof c[0] === 'string' && c[0].includes('/api/coverage/history'),
      )
      expect(historyCalls.length).toBe(rows.length) // 5 rows → 5 fetches, not 20
    })
  })

  it('Drift-6: same-repoId TanStack dedup — two rows with the SAME repoId issue exactly 1 fetch', async () => {
    const sameRow = makeRow({ repo: 'agenticapps-dashboard' })
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={sameRow} />
          <CoverageRow row={sameRow} />
        </tbody>
      </table>,
    )
    await waitFor(() => {
      const historyCalls = mockFetch.mock.calls.filter((c) =>
        typeof c[0] === 'string' && c[0].includes('/api/coverage/history'),
      )
      expect(historyCalls.length).toBe(1)
    })
  })
})

describe('pending state', () => {
  it('when pending is omitted, the refresh button has no animate-spin and no aria-busy', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} />
        </tbody>
      </table>,
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh actions/i })
    expect(refreshBtn.getAttribute('aria-busy')).toBeNull()
    expect(refreshBtn).not.toHaveProperty('disabled', true)
    const svg = refreshBtn.querySelector('svg')
    // Use getAttribute('class') — SVG className is SVGAnimatedString, not a plain string
    expect(svg?.getAttribute('class') ?? '').not.toContain('animate-spin')
  })

  it('when pending is false, behaviour matches pending omitted', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} pending={false} />
        </tbody>
      </table>,
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh actions/i })
    expect(refreshBtn.getAttribute('aria-busy')).toBeNull()
    expect(refreshBtn).not.toHaveProperty('disabled', true)
    const svg = refreshBtn.querySelector('svg')
    expect(svg?.getAttribute('class') ?? '').not.toContain('animate-spin')
  })

  it('when pending is true, the refresh button shows the spinning icon', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} pending={true} />
        </tbody>
      </table>,
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh actions/i })
    const svg = refreshBtn.querySelector('svg')
    // Use getAttribute('class') — SVG className is SVGAnimatedString, not a plain string
    expect(svg?.getAttribute('class') ?? '').toContain('animate-spin')
  })

  it('when pending is true, the refresh button has aria-busy="true" and disabled', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} pending={true} />
        </tbody>
      </table>,
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh actions/i })
    expect(refreshBtn.getAttribute('aria-busy')).toBe('true')
    expect(refreshBtn).toHaveProperty('disabled', true)
  })

  it('when pending is true, the row <tr> has aria-busy="true"', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} pending={true} />
        </tbody>
      </table>,
    )
    const row = screen.getByRole('row')
    expect(row.getAttribute('aria-busy')).toBe('true')
  })

  it('when pending is true, the button className forces opacity-100 (no opacity-30)', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} pending={true} />
        </tbody>
      </table>,
    )
    const refreshBtn = screen.getByRole('button', { name: /refresh actions/i })
    expect(refreshBtn.className).toContain('opacity-100')
    expect(refreshBtn.className).not.toContain('opacity-30')
  })
})

describe('refresh button touch target (D-11.2-11)', () => {
  it('refresh button className contains min-w-[44px] and min-h-[44px] (idle state)', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} />
        </tbody>
      </table>,
    )
    const button = screen.getByRole('button', { name: /refresh actions/i })
    expect(button.className).toContain('min-w-[44px]')
    expect(button.className).toContain('min-h-[44px]')
  })

  it('refresh button className contains p-[15px] (idle state)', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} />
        </tbody>
      </table>,
    )
    const button = screen.getByRole('button', { name: /refresh actions/i })
    expect(button.className).toContain('p-[15px]')
    expect(button.className).not.toContain('p-0.5')
  })

  it('refresh button className keeps min-w/h 44px AND p-[15px] in pending state', () => {
    renderInQC(
      <table>
        <tbody>
          <CoverageRow row={makeRow()} pending={true} />
        </tbody>
      </table>,
    )
    const button = screen.getByRole('button', { name: /refresh actions/i })
    expect(button.className).toContain('min-w-[44px]')
    expect(button.className).toContain('min-h-[44px]')
    expect(button.className).toContain('p-[15px]')
    // Plan 02 contract preserved
    expect(button.className).toContain('opacity-100')
    // animate-spin on the icon SVG (Plan 02 contract)
    const svg = button.querySelector('svg')
    expect(svg?.getAttribute('class') ?? '').toContain('animate-spin')
  })
})
