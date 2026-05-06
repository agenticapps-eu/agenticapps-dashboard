/**
 * PhaseProgress.test.tsx — TDD tests for PhaseProgress panel.
 *
 * Tests PP1–PP6:
 * PP1: with files array, renders 2 rows
 * PP2: present rows show CheckCircle2 icon + filename + relative mtime
 * PP3: missing rows show Minus icon + filename in text-muted (NO mtime)
 * PP4: when phase is null and files is [], renders empty-state copy
 * PP5: phase header shows "Phase {paddedPhase} — {phase}" in mono uppercase tracking-wide
 * PP6: panel title is "Phase Progress"; loading + drift + unreachable behave like CommitmentBlock
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

// Mock relativeTime to return deterministic output
vi.mock('../../lib/relativeTime.js', () => ({
  formatRelativeTime: vi.fn((iso: string) => `rel:${iso}`),
}))

import { usePhaseProgress } from '../../lib/projectQueries.js'
import { PhaseProgress } from './PhaseProgress.js'

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

const SAMPLE_DATA: PhaseProgressResponse = {
  phase: 'single-project-view',
  paddedPhase: '04',
  files: [
    { name: 'CONTEXT.md', present: true, mtimeIso: '2026-05-06T10:00:00Z' },
    { name: 'UI-SPEC.md', present: false, mtimeIso: null },
  ],
  tdd: { greenPairs: 0, totalTasks: 0, timeline: [] },
  review: { stage1: null, stage2: null },
  verification: { mustHavesTotal: 0, mustHavesEvidenced: 0, items: [] },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PhaseProgress', () => {
  it('PP6: panel title is "Phase Progress"', () => {
    mockQuery({ isLoading: true })
    render(<PhaseProgress projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Phase Progress' })).toBeDefined()
  })

  it('PP6: while loading shows "Loading..."', () => {
    mockQuery({ isLoading: true, data: undefined })
    render(<PhaseProgress projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('PP6: on schema_drift error, renders inline drift state', () => {
    mockQuery({ error: new Error('schema_drift:files'), isLoading: false, data: undefined })
    render(<PhaseProgress projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: /Schema drift/ })).toBeDefined()
  })

  it('PP6: on other error, renders panel in unreachable state', () => {
    mockQuery({ error: new Error('Network error'), isLoading: false, data: undefined })
    render(<PhaseProgress projectId="proj-1" />)
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('PP4: when phase is null and files is [], renders empty-state copy', () => {
    mockQuery({
      data: {
        ...SAMPLE_DATA,
        phase: null,
        paddedPhase: null,
        files: [],
      },
    })
    render(<PhaseProgress projectId="proj-1" />)
    expect(
      screen.getByText(
        'No phase work yet. Run /gsd-discuss-phase or /gsd-plan-phase to start.',
      ),
    ).toBeDefined()
  })

  it('PP1: with files array, renders 2 rows', () => {
    mockQuery({ data: SAMPLE_DATA })
    render(<PhaseProgress projectId="proj-1" />)

    expect(screen.getByText('CONTEXT.md')).toBeDefined()
    expect(screen.getByText('UI-SPEC.md')).toBeDefined()
  })

  it('PP2: present rows show filename in font-mono and relative mtime label', () => {
    mockQuery({ data: SAMPLE_DATA })
    render(<PhaseProgress projectId="proj-1" />)

    const filename = screen.getByText('CONTEXT.md')
    expect(filename.className).toContain('font-mono')

    // mtime rendered as relative time (formatRelativeTime mock returns 'rel:...')
    expect(screen.getByText('rel:2026-05-06T10:00:00Z')).toBeDefined()
  })

  it('PP3: missing rows show filename in text-muted and NO mtime', () => {
    mockQuery({ data: SAMPLE_DATA })
    render(<PhaseProgress projectId="proj-1" />)

    const missingFilename = screen.getByText('UI-SPEC.md')
    expect(missingFilename.className).toContain('text-[--text-muted]')

    // Should not show mtime for missing file
    expect(screen.queryByText('rel:null')).toBeNull()
  })

  it('PP5: shows phase header with paddedPhase and phase name', () => {
    mockQuery({ data: SAMPLE_DATA })
    render(<PhaseProgress projectId="proj-1" />)

    const header = screen.getByText(/Phase 04 — single-project-view/)
    expect(header).toBeDefined()
    expect(header.className).toContain('font-mono')
    expect(header.className).toContain('uppercase')
    expect(header.className).toContain('tracking-wide')
  })
})
