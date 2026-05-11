/**
 * VerificationStatus.test.tsx — TDD tests for VerificationStatus panel.
 *
 * Tests VS1–VS5:
 * VS1: with partial evidence, renders summary "7 / 9 must-haves evidenced"
 * VS2: evidenced rows get CheckCircle2; unevidenced get Minus
 * VS3: when all evidenced, summary has text-[--success] font-semibold
 * VS4: when mustHavesTotal === 0, renders empty-state copy
 * VS5: panel title is "Verification Status"
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

import { VerificationStatus } from './VerificationStatus.js'

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

const PARTIAL_DATA: PhaseProgressResponse = {
  phase: 'test',
  paddedPhase: '04',
  files: [],
  tdd: { greenPairs: 0, totalTasks: 0, timeline: [] },
  review: { stage1: null, stage2: null },
  verification: {
    mustHavesTotal: 9,
    mustHavesEvidenced: 7,
    items: [
      { text: 'CI passes on the feature branch', evidenced: true },
      { text: 'All new routes return validated JSON', evidenced: true },
      { text: 'HUMAN-UAT.md complete', evidenced: false },
    ],
  },
}

const ALL_EVIDENCED_DATA: PhaseProgressResponse = {
  ...PARTIAL_DATA,
  verification: {
    mustHavesTotal: 3,
    mustHavesEvidenced: 3,
    items: [
      { text: 'Item 1', evidenced: true },
      { text: 'Item 2', evidenced: true },
      { text: 'Item 3', evidenced: true },
    ],
  },
}

const ZERO_DATA: PhaseProgressResponse = {
  ...PARTIAL_DATA,
  verification: { mustHavesTotal: 0, mustHavesEvidenced: 0, items: [] },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('VerificationStatus', () => {
  it('VS5: panel title is "Verification Status"', () => {
    mockQuery({ isLoading: true })
    render(<VerificationStatus projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Verification Status' })).toBeDefined()
  })

  it('VS5: while loading shows "Loading..."', () => {
    mockQuery({ isLoading: true, data: undefined })
    render(<VerificationStatus projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('VS5: on schema_drift error, renders inline drift state', () => {
    mockQuery({ error: new Error('schema_drift:verification'), isLoading: false, data: undefined })
    render(<VerificationStatus projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: /Schema drift/ })).toBeDefined()
  })

  it('VS5: on other error, renders panel in unreachable state', () => {
    mockQuery({ error: new Error('Network error'), isLoading: false, data: undefined })
    render(<VerificationStatus projectId="proj-1" />)
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('VS4: when mustHavesTotal is 0, renders empty-state copy', () => {
    mockQuery({ data: ZERO_DATA })
    render(<VerificationStatus projectId="proj-1" />)
    // D-6.1-02: empty-state panel collapses by default — expand to inspect body
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('No verification run yet — try /gsd-verify-work.')).toBeDefined()
  })

  it('VS1: renders summary "7 / 9 must-haves evidenced"', () => {
    mockQuery({ data: PARTIAL_DATA })
    render(<VerificationStatus projectId="proj-1" />)
    expect(screen.getByText('7 / 9 must-haves evidenced')).toBeDefined()
  })

  it('VS2: renders 3 item rows with evidenced/unevidenced styling', () => {
    mockQuery({ data: PARTIAL_DATA })
    render(<VerificationStatus projectId="proj-1" />)

    expect(screen.getByText('CI passes on the feature branch')).toBeDefined()
    expect(screen.getByText('All new routes return validated JSON')).toBeDefined()
    expect(screen.getByText('HUMAN-UAT.md complete')).toBeDefined()
  })

  it('VS2: unevidenced item text is styled text-text-secondary (Wave 3 repalette)', () => {
    mockQuery({ data: PARTIAL_DATA })
    render(<VerificationStatus projectId="proj-1" />)

    const unevidenced = screen.getByText('HUMAN-UAT.md complete')
    expect(unevidenced.className).toContain('text-text-secondary')
  })

  it('VS3: when all evidenced, summary has text-status-success font-semibold (Wave 3 repalette)', () => {
    mockQuery({ data: ALL_EVIDENCED_DATA })
    render(<VerificationStatus projectId="proj-1" />)

    const summary = screen.getByText('3 / 3 must-haves evidenced')
    expect(summary.className).toContain('text-status-success')
    expect(summary.className).toContain('font-semibold')
  })
})
