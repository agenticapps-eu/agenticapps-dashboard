/**
 * CodeIntelligencePage.test.tsx — TDD tests for the /code-intelligence page.
 *
 * Phase 14 Plan 04 (D-14-06, D-14-07, D-14-02).
 *
 * Test 1: coverage rows with understand.state 'fresh' or 'stale' are listed;
 *         'missing'/'not-applicable'/undefined rows are excluded.
 * Test 2: each listed row with a viewerToken renders an "Open viewer" link
 *         with correct href and target="_blank" rel="noopener noreferrer".
 * Test 3: health.understand.viewerInstalled === false → install hint with exact
 *         string `agentic-dashboard install-understand-viewer`; viewer links suppressed.
 * Test 4: health.understand.updateAvailable === true → update hint with
 *         `agentic-dashboard install-understand-viewer` and both versions.
 * Test 5: zero analyzed repos → EmptyState mentioning /understand skill.
 * Test 6: loading and error states render skeleton/error patterns.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { CoverageResponse, HealthResponse } from '@agenticapps/dashboard-shared'
import type { UseQueryResult } from '@tanstack/react-query'

// ── Mock hooks ────────────────────────────────────────────────────────────────

vi.mock('../../../lib/coverageQueries.js', () => ({
  useCoverage: vi.fn(),
}))

vi.mock('../../../lib/healthQueries.js', () => ({
  useHealth: vi.fn(),
}))

vi.mock('../../../lib/pairing.js', () => ({
  getPairing: vi.fn(),
}))

import { useCoverage } from '../../../lib/coverageQueries.js'
import { useHealth } from '../../../lib/healthQueries.js'
import { getPairing } from '../../../lib/pairing.js'

import { CodeIntelligencePage } from './CodeIntelligencePage.js'

const mockUseCoverage = vi.mocked(useCoverage)
const mockUseHealth = vi.mocked(useHealth)
const mockGetPairing = vi.mocked(getPairing)

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AGENT_URL = 'http://127.0.0.1:5193'
const VIEWER_TOKEN = 'scoped-viewer-token-abc123'

function makeCoverageResponse(
  understands: Array<{ state: 'fresh' | 'stale' | 'missing' | 'not-applicable'; viewerToken?: string } | undefined>,
): CoverageResponse {
  return {
    schemaVersion: 1,
    generatedAtIso: '2026-06-07T09:00:00.000Z',
    gitNexusInstallState: 'installed-with-registry',
    workflowHeadVersion: '1.6.0',
    rows: understands.map((u, i) => ({
      family: 'agenticapps' as const,
      repo: `repo-${i + 1}`,
      claudeMd: { kind: 'basic' as const, state: 'fresh' as const },
      gitNexus: { kind: 'basic' as const, state: 'fresh' as const },
      wiki: { kind: 'basic' as const, state: 'fresh' as const },
      workflowVersion: { kind: 'workflow' as const, state: 'fresh' as const, installedVersion: '1.6.0', headVersion: '1.6.0' },
      overrideCount: 0,
      overrides: [],
      understand: u === undefined ? undefined : {
        kind: 'basic' as const,
        state: u.state,
        lastAnalyzedAt: u.state !== 'missing' ? '2026-06-01T10:00:00.000Z' : undefined,
        analyzedFiles: u.state !== 'missing' ? 42 : undefined,
        viewerToken: u.viewerToken,
      },
    })),
  }
}

function makeHealthResponse(overrides: Partial<{
  viewerInstalled: boolean
  viewerVersion: string | null
  pluginVersion: string | null
  updateAvailable: boolean
}> = {}): HealthResponse {
  return {
    ok: true,
    version: '1.0.0',
    uptime: 0,
    projectCount: 0,
    understand: {
      viewerInstalled: true,
      viewerVersion: '2.7.6',
      pluginVersion: '2.7.6',
      updateAvailable: false,
      ...overrides,
    },
  } as HealthResponse
}

function makeQueryResult<T>(data: T): UseQueryResult<T, Error> {
  return {
    data,
    isPending: false,
    isError: false,
    isSuccess: true,
    error: null,
  } as unknown as UseQueryResult<T, Error>
}

function makePendingResult<T>(): UseQueryResult<T, Error> {
  return {
    data: undefined,
    isPending: true,
    isError: false,
    isSuccess: false,
    error: null,
  } as unknown as UseQueryResult<T, Error>
}

function makeErrorResult<T>(message: string): UseQueryResult<T, Error> {
  return {
    data: undefined,
    isPending: false,
    isError: true,
    isSuccess: false,
    error: new Error(message),
    refetch: vi.fn(),
  } as unknown as UseQueryResult<T, Error>
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockGetPairing.mockReturnValue({
    agentUrl: AGENT_URL,
    token: 'bearer-token-should-not-appear-in-links',
    pairedAt: '2026-06-07T09:00:00.000Z',
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CodeIntelligencePage', () => {
  describe('Test 1: filtered project listing', () => {
    it('lists repos with understand.state fresh or stale; excludes missing/not-applicable/undefined', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'fresh', viewerToken: VIEWER_TOKEN },
        { state: 'stale' },
        { state: 'missing' },
        { state: 'not-applicable' },
        undefined,
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      render(<CodeIntelligencePage />)

      // fresh and stale repos are listed
      expect(screen.getByText('repo-1')).toBeDefined()
      expect(screen.getByText('repo-2')).toBeDefined()
      // missing/not-applicable/undefined are excluded
      expect(screen.queryByText('repo-3')).toBeNull()
      expect(screen.queryByText('repo-4')).toBeNull()
      expect(screen.queryByText('repo-5')).toBeNull()
    })

    it('renders staleness badge for stale repos', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'fresh', viewerToken: VIEWER_TOKEN },
        { state: 'stale', viewerToken: VIEWER_TOKEN },
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      render(<CodeIntelligencePage />)
      expect(screen.getByText('stale')).toBeDefined()
    })
  })

  describe('Test 2: viewer links', () => {
    it('renders "Open viewer" link with correct href, target=_blank, rel=noopener noreferrer', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'fresh', viewerToken: VIEWER_TOKEN },
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      render(<CodeIntelligencePage />)

      const link = screen.getByRole('link', { name: /open viewer/i })
      expect(link).toBeDefined()
      const expectedHref = `${AGENT_URL}/understand/agenticapps/repo-1/?token=${encodeURIComponent(VIEWER_TOKEN)}`
      expect(link.getAttribute('href')).toBe(expectedHref)
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    })

    it('negative: bearer token does NOT appear in any viewer href', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'fresh', viewerToken: VIEWER_TOKEN },
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      const { container } = render(<CodeIntelligencePage />)
      const html = container.innerHTML
      // Bearer token must never appear in any href
      expect(html).not.toContain('bearer-token-should-not-appear-in-links')
    })
  })

  describe('Test 3: viewer not installed', () => {
    it('shows install hint with agentic-dashboard install-understand-viewer when viewerInstalled=false', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'fresh', viewerToken: VIEWER_TOKEN },
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse({ viewerInstalled: false, viewerVersion: null })))

      render(<CodeIntelligencePage />)

      // Install hint present
      expect(screen.getByText(/agentic-dashboard install-understand-viewer/)).toBeDefined()
    })

    it('suppresses viewer links when viewer is not installed', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'fresh', viewerToken: VIEWER_TOKEN },
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse({ viewerInstalled: false, viewerVersion: null })))

      render(<CodeIntelligencePage />)

      // No "Open viewer" link rendered
      expect(screen.queryByRole('link', { name: /open viewer/i })).toBeNull()
    })
  })

  describe('Test 4: update available', () => {
    it('shows update hint with install command and both versions when updateAvailable=true', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'fresh', viewerToken: VIEWER_TOKEN },
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse({
        viewerInstalled: true,
        viewerVersion: '2.5.0',
        pluginVersion: '2.7.6',
        updateAvailable: true,
      })))

      render(<CodeIntelligencePage />)

      // Update hint present with command
      expect(screen.getByText(/agentic-dashboard install-understand-viewer/)).toBeDefined()
      // Both versions shown
      expect(screen.getByText(/2\.5\.0/)).toBeDefined()
      expect(screen.getByText(/2\.7\.6/)).toBeDefined()
    })
  })

  describe('Test 5: empty state', () => {
    it('renders EmptyState with /understand mention when no repos are analyzed', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'missing' },
        { state: 'not-applicable' },
        undefined,
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      render(<CodeIntelligencePage />)

      // EmptyState heading
      expect(screen.getByText(/no knowledge graphs/i)).toBeDefined()
      // Mentions /understand skill — at least one element contains /understand
      const understandEls = screen.getAllByText(/\/understand/)
      expect(understandEls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Test 2b: last-analyzed date rendering — Phase 14 review fix', () => {
    it('invalid lastAnalyzedAt renders an em dash, never "Invalid Date"', () => {
      const coverage = makeCoverageResponse([{ state: 'fresh', viewerToken: VIEWER_TOKEN }])
      coverage.rows[0]!.understand!.lastAnalyzedAt = 'not-a-date'
      mockUseCoverage.mockReturnValue(makeQueryResult(coverage))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      const { container } = render(<CodeIntelligencePage />)

      expect(container.innerHTML).not.toContain('Invalid Date')
      // The last-analyzed cell falls back to the em dash
      expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1)
    })

    it('valid lastAnalyzedAt renders as relative time (Phase 14.1: consistency + order visibility)', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'fresh', viewerToken: VIEWER_TOKEN },
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      const { container } = render(<CodeIntelligencePage />)

      // Phase 14.1 lift: the page now speaks relative time like the rest of the app
      // (formatRelativeTime), so ordering is visible and the locale is not hardcoded.
      // Fixture date is days in the past → "<n>d ago" (textContent concatenates the
      // next cell, so match the relative token directly rather than a trailing \b).
      expect(container.textContent).toMatch(/\d+d ago/)
      expect(container.innerHTML).not.toContain('Invalid Date')
      // No absolute locale date string leaking through.
      const localeDate = new Date('2026-06-01T10:00:00.000Z').toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      })
      expect(container.textContent).not.toContain(localeDate)
    })
  })

  describe('Test 3b: health unknown (errored / no data) — Phase 14 review fix', () => {
    it('health query error → NO install banner, NO update hint, viewer links stay rendered', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'fresh', viewerToken: VIEWER_TOKEN },
      ])))
      mockUseHealth.mockReturnValue(makeErrorResult('daemon unreachable'))

      render(<CodeIntelligencePage />)

      // No misleading 'Viewer not installed' banner when install state is unknown
      expect(screen.queryByText(/viewer not installed/i)).toBeNull()
      // No update hint either
      expect(screen.queryByText(/viewer update available/i)).toBeNull()
      // Viewer links remain rendered — the daemon route 503s gracefully if needed
      const link = screen.getByRole('link', { name: /open viewer/i })
      expect(link).toBeDefined()
      const expectedHref = `${AGENT_URL}/understand/agenticapps/repo-1/?token=${encodeURIComponent(VIEWER_TOKEN)}`
      expect(link.getAttribute('href')).toBe(expectedHref)
    })
  })

  describe('Test 6: loading and error states', () => {
    it('renders loading skeleton when coverage query is pending', () => {
      mockUseCoverage.mockReturnValue(makePendingResult())
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      render(<CodeIntelligencePage />)

      // Loading state — EmptyState with loading text
      expect(screen.getByText(/loading/i)).toBeDefined()
    })

    it('renders error state when coverage query fails', () => {
      mockUseCoverage.mockReturnValue(makeErrorResult('Daemon returned an error.'))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      render(<CodeIntelligencePage />)

      expect(screen.getByText(/failed to load/i)).toBeDefined()
    })

    it('renders loading state when health query is pending', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([])))
      mockUseHealth.mockReturnValue(makePendingResult())

      render(<CodeIntelligencePage />)

      expect(screen.getByText(/loading/i)).toBeDefined()
    })
  })

  // ── Phase 14.1 IMPECCABLE lift (composite 74 → ≥80): error recovery,
  //    communicative cells, action affordances, header consistency. ─────────────
  describe('Phase 14.1: error recovery + cell communication', () => {
    it('error state offers a Retry action and does NOT print the raw error message', () => {
      mockUseCoverage.mockReturnValue(makeErrorResult('ECONNREFUSED raw daemon stack 127.0.0.1:5193'))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      render(<CodeIntelligencePage />)

      expect(screen.getByText(/failed to load/i)).toBeDefined()
      // Retry affordance present (parity with CoveragePage onRetry)
      expect(screen.getByRole('button', { name: /retry/i })).toBeDefined()
      // Raw error string is never surfaced to the user
      expect(screen.queryByText(/ECONNREFUSED raw daemon stack/)).toBeNull()
    })

    it('fresh rows show a "current" status indicator (not a blank Status cell)', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'fresh', viewerToken: VIEWER_TOKEN },
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      render(<CodeIntelligencePage />)

      // The fresh row communicates its state rather than leaving Status empty,
      // using a real design token (not a non-existent one that renders transparent).
      const pill = screen.getByText('current')
      expect(pill.className).toContain('bg-status-success/10')
      expect(pill.className).toContain('text-status-success')
    })

    it('stale status pill uses the real status-warning token (not a transparent one)', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'stale', viewerToken: VIEWER_TOKEN },
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      render(<CodeIntelligencePage />)

      const pill = screen.getByText('stale')
      expect(pill.className).toContain('bg-status-warning/10')
      expect(pill.className).toContain('text-status-warning')
    })

    it('Actions cell explains itself when the viewer is not installed (no blank cell)', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'fresh', viewerToken: VIEWER_TOKEN },
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse({ viewerInstalled: false, viewerVersion: null })))

      render(<CodeIntelligencePage />)

      // No viewer link, but the Actions cell offers a recovery hint rather than blank.
      expect(screen.queryByRole('link', { name: /open viewer/i })).toBeNull()
      expect(screen.getAllByText(/install viewer/i).length).toBeGreaterThanOrEqual(1)
    })

    it('table headers follow app convention — no uppercase tracking-wider tic', () => {
      mockUseCoverage.mockReturnValue(makeQueryResult(makeCoverageResponse([
        { state: 'fresh', viewerToken: VIEWER_TOKEN },
      ])))
      mockUseHealth.mockReturnValue(makeQueryResult(makeHealthResponse()))

      const { container } = render(<CodeIntelligencePage />)

      const ths = Array.from(container.querySelectorAll('thead th'))
      expect(ths.length).toBeGreaterThanOrEqual(6)
      for (const th of ths) {
        expect(th.getAttribute('class') ?? '').not.toContain('uppercase')
      }
    })
  })
})
