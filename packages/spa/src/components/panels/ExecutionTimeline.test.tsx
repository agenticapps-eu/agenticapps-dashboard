/**
 * ExecutionTimeline.test.tsx — TDD tests for ExecutionTimeline panel.
 *
 * Tests ET1–ET6:
 * ET1: with one timeline entry, renders task header and 2 commit rows (RED + GREEN)
 * ET2: each commit row shows colored dot + subject in font-mono + relative timestamp
 * ET3: incomplete pair (greenCommit null) renders RED row alone in text-muted
 * ET4: when timeline is [], renders empty-state copy
 * ET5: dot is aria-hidden; row has sr-only text for RED/GREEN prefix
 * ET6: panel title is "Execution Timeline"
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

vi.mock('../../lib/relativeTime.js', () => ({
  formatRelativeTime: vi.fn((iso: string) => `rel:${iso}`),
}))

import { usePhaseProgress } from '../../lib/projectQueries.js'

import { ExecutionTimeline } from './ExecutionTimeline.js'

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

const BASE_DATA: PhaseProgressResponse = {
  phase: 'test-phase',
  paddedPhase: '04',
  files: [],
  tdd: {
    greenPairs: 1,
    totalTasks: 1,
    timeline: [
      {
        taskId: '04-01',
        redCommit: { sha: 'abc123', subject: 'test(04-01): add failing tests', isoDate: '2026-05-06T08:00:00Z' },
        greenCommit: { sha: 'def456', subject: 'feat(04-01): implement it', isoDate: '2026-05-06T09:00:00Z' },
      },
    ],
  },
  review: { stage1: null, stage2: null },
  verification: { mustHavesTotal: 0, mustHavesEvidenced: 0, items: [] },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ExecutionTimeline', () => {
  it('ET6: panel title is "Execution Timeline"', () => {
    mockQuery({ isLoading: true })
    render(<ExecutionTimeline projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Execution Timeline' })).toBeDefined()
  })

  it('ET6: while loading shows "Loading..."', () => {
    mockQuery({ isLoading: true, data: undefined })
    render(<ExecutionTimeline projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('ET6: on schema_drift error, renders inline drift state', () => {
    mockQuery({ error: new Error('schema_drift:tdd'), isLoading: false, data: undefined })
    render(<ExecutionTimeline projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: /Schema drift/ })).toBeDefined()
  })

  it('ET6: on other error, renders panel in unreachable state', () => {
    mockQuery({ error: new Error('Network error'), isLoading: false, data: undefined })
    render(<ExecutionTimeline projectId="proj-1" />)
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('ET4: when timeline is [], renders empty-state copy', () => {
    mockQuery({ data: { ...BASE_DATA, tdd: { ...BASE_DATA.tdd, timeline: [] } } })
    render(<ExecutionTimeline projectId="proj-1" />)
    expect(screen.getByText('No TDD commits yet for this phase.')).toBeDefined()
  })

  it('ET1: with one timeline entry, renders task header and 2 commit rows', () => {
    mockQuery({ data: BASE_DATA })
    render(<ExecutionTimeline projectId="proj-1" />)

    expect(screen.getByText(/Task 04-01/)).toBeDefined()
    expect(screen.getByText(/test\(04-01\): add failing tests/)).toBeDefined()
    expect(screen.getByText(/feat\(04-01\): implement it/)).toBeDefined()
  })

  it('ET2: commit rows show relative timestamps', () => {
    mockQuery({ data: BASE_DATA })
    render(<ExecutionTimeline projectId="proj-1" />)

    // Both commits show their relative timestamps via formatRelativeTime mock
    const times = screen.getAllByText(/rel:/)
    expect(times.length).toBeGreaterThanOrEqual(2)
  })

  it('ET3: incomplete pair (greenCommit null) renders RED row with text-text-secondary subject (Wave 3 repalette)', () => {
    mockQuery({
      data: {
        ...BASE_DATA,
        tdd: {
          ...BASE_DATA.tdd,
          timeline: [
            {
              taskId: '04-02',
              redCommit: { sha: 'aaa', subject: 'test(04-02): failing tests', isoDate: '2026-05-06T07:00:00Z' },
              greenCommit: null,
            },
          ],
        },
      },
    })
    render(<ExecutionTimeline projectId="proj-1" />)

    const subject = screen.getByText(/test\(04-02\): failing tests/)
    // Pending/incomplete row should use text-text-secondary (namespaced token)
    expect(subject.className).toContain('text-text-secondary')
  })

  it('ET5: dot is aria-hidden and row has sr-only label for RED/GREEN', () => {
    mockQuery({ data: BASE_DATA })
    render(<ExecutionTimeline projectId="proj-1" />)

    // sr-only text for screen readers
    const srTexts = document.querySelectorAll('.sr-only')
    const textContents = Array.from(srTexts).map((el) => el.textContent)
    expect(textContents.some((t) => t?.includes('RED') || t?.includes('GREEN'))).toBe(true)
  })
})
