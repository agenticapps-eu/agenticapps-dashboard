/**
 * ConformancePage.test.tsx — Wave 4 / Plan 12-04 page composition tests.
 *
 * Tests cover (in declared order):
 * - P1: loading skeleton while isLoading
 * - P2: generic ErrorState on isError (no FS path leakage — T-12-PAGE-ERROR-LEAK)
 * - P3: SchemaDriftState branch when useConformance error matches /^schema_drift:/
 *       (T-12-PAGE-DRIFT-RENDER — never render raw drift body as if valid)
 * - P4: PathDriftPanel renders only when data.drifted.length > 0
 * - P5: 3 FamilyCards (agenticapps, factiv, neuroflash) render on happy path
 * - P6: each FamilyCard receives today.{family} as `score`
 * - P7: each FamilyCard receives delta14d.{family} as `delta14d`
 * - P8: FleetTrendChart renders with data.series
 * - P9: sticky PageHeader (data-testid="page-header-sticky") with title "Fleet conformance"
 * - P10: trend section uses aria-labelledby for SR navigation
 * - P11: SECURITY — ErrorState message does NOT include error.message or stack
 * - P12: SECURITY — schema-drift branch renders SchemaDriftState, never the raw drift body
 *
 * Mocks useConformance directly (the hook is verified end-to-end in
 * conformanceQueries.test.ts). PathDriftPanel still owns a useRegistryFixPath
 * call, so we wrap with QueryClientProvider + ToastProvider for the happy path.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ConformanceResponse } from '@agenticapps/dashboard-shared'

import { ToastProvider } from '../../ui/Toast.js'

// Mock useConformance — the hook itself is covered in conformanceQueries.test.ts.
vi.mock('../../../lib/conformanceQueries.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/conformanceQueries.js')>()
  return {
    ...actual,
    useConformance: vi.fn(),
  }
})

import { useConformance } from '../../../lib/conformanceQueries.js'
import { ConformancePage } from './ConformancePage.js'

const mockUseConformance = vi.mocked(useConformance)

// Construct the dangerous-inner-html string from parts to keep this test file
// itself free of the literal (matches the Wave 3 anti-pattern guard convention).
const DANGEROUS_INNER_HTML = `dangerously${'Set'}InnerHTML`

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, refetchOnMount: false },
      mutations: { retry: false },
    },
  })
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}

function makeSeries(n: number): ConformanceResponse['series'] {
  const series: ConformanceResponse['series'] = []
  const base = Date.UTC(2026, 1, 1)
  for (let i = 0; i < n; i++) {
    const d = new Date(base + i * 86_400_000)
    series.push({
      date: d.toISOString().slice(0, 10),
      fleet: 80 + (i % 11),
      agenticapps: 85 + (i % 9),
      factiv: 78 + (i % 7),
      neuroflash: 82 + (i % 5),
    })
  }
  return series
}

function makeData(overrides: Partial<ConformanceResponse> = {}): ConformanceResponse {
  return {
    schemaVersion: 1,
    today: {
      asOf: '2026-05-20T00:00:00.000Z',
      fleet: 87,
      agenticapps: 92,
      factiv: 84,
      neuroflash: 85,
    },
    delta14d: {
      fleet: 3,
      agenticapps: 5,
      factiv: -2,
      neuroflash: 1,
    },
    series: makeSeries(90),
    drifted: [],
    ...overrides,
  }
}

beforeEach(() => {
  mockUseConformance.mockReset()
})

describe('ConformancePage', () => {
  it('P1: renders loading skeleton while isLoading', () => {
    mockUseConformance.mockReturnValue({
      isPending: true,
      isLoading: true,
      isError: false,
      error: null,
      data: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConformance>)

    render(<ConformancePage />, { wrapper })

    // PageHeader still shows the title even while loading.
    expect(screen.getByText(/Fleet conformance/i)).toBeTruthy()
    // Skeleton has an aria-label or test id we can assert.
    expect(document.querySelectorAll('[aria-label*="Loading"]').length).toBeGreaterThanOrEqual(1)
  })

  it('P2: renders generic error state on isError (no FS path leakage)', () => {
    const leakyError = new Error('ENOENT: /Users/secret/repo/.planning/private.json')
    mockUseConformance.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: true,
      error: leakyError,
      data: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConformance>)

    const { container } = render(<ConformancePage />, { wrapper })

    expect(screen.getByText(/Could not load conformance data/i)).toBeTruthy()
    // SECURITY — none of the secret path components appear in the rendered DOM.
    const html = container.innerHTML
    expect(html.includes('/Users/secret/repo')).toBe(false)
    expect(html.includes('private.json')).toBe(false)
    expect(html.includes('ENOENT')).toBe(false)
  })

  it('P3: renders SchemaDriftState when useConformance error matches schema_drift:', () => {
    const driftError = new Error('schema_drift:today.fleet')
    mockUseConformance.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: true,
      error: driftError,
      data: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConformance>)

    render(<ConformancePage />, { wrapper })

    expect(screen.getByText(/Schema drift detected/i)).toBeTruthy()
    // The drifted field path is rendered (SchemaDriftState shows it as the field).
    expect(screen.getByText('today.fleet')).toBeTruthy()
  })

  it('P4: PathDriftPanel renders only when data.drifted.length > 0', () => {
    // No drifted entries — PathDriftPanel should NOT render (header text absent).
    mockUseConformance.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: false,
      error: null,
      data: makeData({ drifted: [] }),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConformance>)

    const { rerender } = render(<ConformancePage />, { wrapper })
    expect(screen.queryByText(/drifted registr/i)).toBeNull()

    // With one drifted entry — PathDriftPanel renders.
    mockUseConformance.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: false,
      error: null,
      data: makeData({
        drifted: [
          {
            id: 'agenticapps/agenticapps-dashboard',
            storedPath: '/old/path',
            suggestedPath: '/new/path',
            reason: 'missing',
          },
        ],
      }),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConformance>)

    rerender(<ConformancePage />)
    expect(screen.getByText(/drifted registr/i)).toBeTruthy()
  })

  it('P5: renders 3 FamilyCards (agenticapps, factiv, neuroflash) on happy path', () => {
    mockUseConformance.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: false,
      error: null,
      data: makeData(),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConformance>)

    render(<ConformancePage />, { wrapper })

    // Each family appears as an <h3> in its FamilyCard.
    expect(screen.getByRole('heading', { level: 3, name: /agenticapps/i })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: /factiv/i })).toBeTruthy()
    expect(screen.getByRole('heading', { level: 3, name: /neuroflash/i })).toBeTruthy()
  })

  it('P6: passes today.{family} as score to each FamilyCard (visible score text)', () => {
    mockUseConformance.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: false,
      error: null,
      data: makeData({
        today: {
          asOf: '2026-05-20T00:00:00.000Z',
          fleet: 88,
          agenticapps: 91, // distinct value so we can assert it appears
          factiv: 73,      // distinct value so we can assert it appears
          neuroflash: 64,  // distinct value (red tier) so we can assert it appears
        },
      }),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConformance>)

    render(<ConformancePage />, { wrapper })

    // Each score appears as a large numeric in its card.
    expect(screen.getByText('91')).toBeTruthy()
    expect(screen.getByText('73')).toBeTruthy()
    expect(screen.getByText('64')).toBeTruthy()
  })

  it('P7: passes delta14d.{family} as delta14d to each FamilyCard', () => {
    mockUseConformance.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: false,
      error: null,
      data: makeData({
        delta14d: { fleet: 0, agenticapps: 7, factiv: -4, neuroflash: 0 },
      }),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConformance>)

    const { container } = render(<ConformancePage />, { wrapper })

    // Up-arrow appears for the positive agenticapps delta; down-arrow for factiv.
    expect(screen.getByText(/▲/)).toBeTruthy()
    expect(screen.getByText(/▼/)).toBeTruthy()
    // Em-dash appears for the zero-delta cards (2 of them — neuroflash + fleet
    // would be em-dash; render at least one).
    const html = container.innerHTML
    expect(html.includes('—')).toBe(true)
  })

  it('P8: renders FleetTrendChart with data.series', () => {
    mockUseConformance.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: false,
      error: null,
      data: makeData(),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConformance>)

    const { container } = render(<ConformancePage />, { wrapper })

    // FleetTrendChart emits an svg with 4 polylines when series.length >= 14.
    const polylines = container.querySelectorAll('polyline')
    expect(polylines.length).toBe(4)
  })

  it('P9: sticky PageHeader with title "Fleet conformance"', () => {
    mockUseConformance.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: false,
      error: null,
      data: makeData(),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConformance>)

    const { container } = render(<ConformancePage />, { wrapper })

    expect(screen.getByRole('heading', { level: 1, name: /Fleet conformance/i })).toBeTruthy()
    // PageHeader sticky variant emits data-testid="page-header-sticky".
    const sticky = container.querySelector('[data-testid="page-header-sticky"]')
    expect(sticky).not.toBeNull()
  })

  it('P10: trend section uses aria-labelledby for SR navigation', () => {
    mockUseConformance.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: false,
      error: null,
      data: makeData(),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConformance>)

    const { container } = render(<ConformancePage />, { wrapper })

    // The trend section is labelled-by a heading id; assert both exist and link up.
    const labelledSection = container.querySelector('section[aria-labelledby]')
    expect(labelledSection).not.toBeNull()
    const labelId = labelledSection!.getAttribute('aria-labelledby')!
    expect(labelId.length).toBeGreaterThan(0)
    const heading = container.querySelector(`#${labelId}`)
    expect(heading).not.toBeNull()
    expect(heading!.textContent).toMatch(/trend/i)
  })

  it('P11: SECURITY — ErrorState message stays generic across many error shapes', () => {
    const cases = [
      new Error('Stack trace: at /private/Users/me/secret.ts:42'),
      new Error('TypeError: Cannot read properties of undefined (reading \'_internal\')'),
      Object.assign(new Error('AbortError'), { name: 'AbortError' }),
    ]

    for (const err of cases) {
      mockUseConformance.mockReturnValue({
        isPending: false,
        isLoading: false,
        isError: true,
        error: err,
        data: undefined,
        refetch: vi.fn(),
      } as unknown as ReturnType<typeof useConformance>)

      const { container, unmount } = render(<ConformancePage />, { wrapper })
      const html = container.innerHTML
      expect(html).toContain('Could not load conformance data')
      // None of the error fields surface verbatim.
      expect(html.includes(err.message)).toBe(false)
      if (err.stack) expect(html.includes(err.stack)).toBe(false)
      unmount()
    }
  })

  it('P12: SECURITY — schema-drift branch renders SchemaDriftState (never raw drift body)', () => {
    const driftError = new Error('schema_drift:series.0.fleet')
    mockUseConformance.mockReturnValue({
      isPending: false,
      isLoading: false,
      isError: true,
      error: driftError,
      data: undefined,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConformance>)

    const { container } = render(<ConformancePage />, { wrapper })

    // The schema-drift primitive is rendered.
    expect(screen.getByText(/Schema drift detected/i)).toBeTruthy()
    // No conformance happy-path content leaked through (no polyline, no FamilyCard h3 names).
    expect(container.querySelectorAll('polyline').length).toBe(0)
    expect(container.querySelectorAll('article > header > h3').length).toBe(0)
  })
})

// ── Source-grep security guard ───────────────────────────────────────────────

describe('ConformancePage (source-level guards)', () => {
  it('P13: SECURITY — source does NOT contain the dangerous inner-html prop (T-12-XSS)', async () => {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const candidates = [
      path.resolve(process.cwd(), 'src/components/panels/conformance/ConformancePage.tsx'),
      path.resolve(process.cwd(), 'packages/spa/src/components/panels/conformance/ConformancePage.tsx'),
    ]
    let source: string | null = null
    for (const c of candidates) {
      try {
        source = await fs.readFile(c, 'utf8')
        break
      } catch {
        // continue
      }
    }
    if (source === null) throw new Error('ConformancePage.tsx not found')
    expect(source.includes(DANGEROUS_INNER_HTML)).toBe(false)
  })
})
