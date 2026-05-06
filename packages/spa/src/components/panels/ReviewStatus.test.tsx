/**
 * ReviewStatus.test.tsx — TDD tests for ReviewStatus panel.
 *
 * Tests RS1–RS7:
 * RS1: with stage1 present+findings and stage2 null, renders 2 lines
 * RS2: Stage 1 line shows label + "present" status + severity glyphs
 * RS3: Stage 2 line shows label + "not run" status + no glyph row
 * RS4: glyph row's parent has aria-label with severity counts
 * RS5: when both stages null, renders empty-state copy
 * RS6: glyphs are emoji literals; count is font-mono text-sm text-[--text]
 * RS7: panel title is "Review Status"
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { PhaseProgressResponse } from '@agenticapps/dashboard-shared'

vi.mock('../../lib/projectQueries.js', () => ({
  useCommitment: vi.fn(),
  useObservations: vi.fn(),
  useDiscipline: vi.fn(),
  usePhaseProgress: vi.fn(),
  useSecurity: vi.fn(),
}))

import { usePhaseProgress } from '../../lib/projectQueries.js'
import { ReviewStatus } from './ReviewStatus.js'

type MockQueryResult = Partial<UseQueryResult<PhaseProgressResponse, Error>>

function mockQuery(overrides: MockQueryResult = {}) {
  vi.mocked(usePhaseProgress).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<PhaseProgressResponse, Error>)
}

const STAGE1_DATA: PhaseProgressResponse = {
  phase: 'test',
  paddedPhase: '04',
  files: [],
  tdd: { greenPairs: 0, totalTasks: 0, timeline: [] },
  review: {
    stage1: { present: true, findings: { critical: 2, high: 1, medium: 4, low: 7 } },
    stage2: null,
  },
  verification: { mustHavesTotal: 0, mustHavesEvidenced: 0, items: [] },
}

const BOTH_NULL_DATA: PhaseProgressResponse = {
  ...STAGE1_DATA,
  review: { stage1: null, stage2: null },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ReviewStatus', () => {
  it('RS7: panel title is "Review Status"', () => {
    mockQuery({ isLoading: true })
    render(<ReviewStatus projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Review Status' })).toBeDefined()
  })

  it('RS7: while loading shows "Loading..."', () => {
    mockQuery({ isLoading: true, data: undefined })
    render(<ReviewStatus projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('RS7: on schema_drift error, renders inline drift state', () => {
    mockQuery({ error: new Error('schema_drift:review'), isLoading: false, data: undefined })
    render(<ReviewStatus projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: /Schema drift/ })).toBeDefined()
  })

  it('RS7: on other error, renders panel in unreachable state', () => {
    mockQuery({ error: new Error('Network error'), isLoading: false, data: undefined })
    render(<ReviewStatus projectId="proj-1" />)
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('RS5: when both stages null, renders empty-state copy', () => {
    mockQuery({ data: BOTH_NULL_DATA })
    render(<ReviewStatus projectId="proj-1" />)
    expect(screen.getByText(/No review run yet — try \/review or \/gsd-code-review/)).toBeDefined()
  })

  it('RS1: with stage1 present and stage2 null, renders both Stage labels', () => {
    mockQuery({ data: STAGE1_DATA })
    render(<ReviewStatus projectId="proj-1" />)
    expect(screen.getAllByText(/Stage 1/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Stage 2/).length).toBeGreaterThan(0)
  })

  it('RS2: Stage 1 line shows "present" status and severity glyphs', () => {
    mockQuery({ data: STAGE1_DATA })
    render(<ReviewStatus projectId="proj-1" />)

    // "present" label for stage1
    expect(screen.getByText('present')).toBeDefined()

    // Severity glyphs rendered as emoji literals
    const container = document.body
    expect(container.textContent).toContain('🔴')
    expect(container.textContent).toContain('🟠')
    expect(container.textContent).toContain('🟡')
    expect(container.textContent).toContain('⚪')
  })

  it('RS3: Stage 2 line shows "not run" status when stage2 is null', () => {
    mockQuery({ data: STAGE1_DATA })
    render(<ReviewStatus projectId="proj-1" />)
    expect(screen.getByText('not run')).toBeDefined()
  })

  it('RS4: glyph container has aria-label with severity counts', () => {
    mockQuery({ data: STAGE1_DATA })
    render(<ReviewStatus projectId="proj-1" />)

    const ariaLabel = 'Stage 1 findings: 2 critical, 1 high, 4 medium, 7 low'
    const el = document.querySelector(`[aria-label="${ariaLabel}"]`)
    expect(el).not.toBeNull()
  })

  it('RS6: glyph counts are rendered in font-mono text-sm', () => {
    mockQuery({ data: STAGE1_DATA })
    render(<ReviewStatus projectId="proj-1" />)

    // The glyph inline-flex container contains font-mono text-sm
    const glyphContainer = document.querySelector('[aria-label*="Stage 1 findings"]')
    expect(glyphContainer).not.toBeNull()
    expect(glyphContainer!.className).toContain('font-mono')
    expect(glyphContainer!.className).toContain('text-sm')
  })
})
