/**
 * RationalizationFires.test.tsx — TDD tests for RationalizationFires panel.
 *
 * Tests RF1–RF6:
 * RF1: skillInstalled true with rows → renders all rows (zero fires not hidden)
 * RF2: skillInstalled false → install-hint copy + CodeBlock with placeholder install command
 * RF3: skillInstalled true + rows empty → 'No rationalization rows found in SKILL.md.'
 * RF4: row label and fires count have spec classes (nonzero vs zero)
 * RF5: panel title is 'Rationalization Fires'
 * RF6: loading + drift + unreachable states consistent with CommitmentBlock pattern
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { DisciplineResponse } from '@agenticapps/dashboard-shared'

vi.mock('../../lib/projectQueries.js', () => ({
  useCommitment: vi.fn(),
  useObservations: vi.fn(),
  useDiscipline: vi.fn(),
}))

import { useDiscipline } from '../../lib/projectQueries.js'

import { RationalizationFires } from './RationalizationFires.js'

type MockQueryResult = Partial<UseQueryResult<DisciplineResponse, Error>>

function mockQuery(overrides: MockQueryResult = {}) {
  vi.mocked(useDiscipline).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<DisciplineResponse, Error>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RationalizationFires', () => {
  it('RF5: panel title is "Rationalization Fires"', () => {
    mockQuery({ isLoading: true })
    render(<RationalizationFires projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Rationalization Fires' })).toBeDefined()
  })

  it('RF6a: while loading shows "Loading..."', () => {
    mockQuery({ isLoading: true, data: undefined })
    render(<RationalizationFires projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('RF1: skillInstalled true — renders all rows, including zero fires (D-4-14: zero is positive signal)', () => {
    mockQuery({
      data: {
        rationalization: {
          skillInstalled: true,
          rows: [
            { label: 'Workflow skill not followed', fires: 3 },
            { label: 'Skipped TDD step', fires: 0 },
            { label: 'Committed directly to main', fires: 1 },
          ],
        },
      },
    })
    render(<RationalizationFires projectId="proj-1" />)

    expect(screen.getByText('Workflow skill not followed')).toBeDefined()
    expect(screen.getByText('3 fires')).toBeDefined()
    expect(screen.getByText('Skipped TDD step')).toBeDefined()
    expect(screen.getByText('0 fires')).toBeDefined()
    expect(screen.getByText('Committed directly to main')).toBeDefined()
    expect(screen.getByText('1 fire')).toBeDefined()
  })

  it('RF2: skillInstalled false → install-hint copy + CodeBlock', () => {
    mockQuery({
      data: {
        rationalization: { skillInstalled: false, rows: [] },
      },
    })
    render(<RationalizationFires projectId="proj-1" />)

    expect(
      screen.getByText('agentic-apps-workflow skill not installed in this project.'),
    ).toBeDefined()
    // Placeholder install command rendered in CodeBlock
    expect(screen.getByText('claude skill install agentic-apps-workflow')).toBeDefined()
  })

  it('RF3: skillInstalled true + rows empty → empty-state copy verbatim', () => {
    mockQuery({
      data: {
        rationalization: { skillInstalled: true, rows: [] },
      },
    })
    render(<RationalizationFires projectId="proj-1" />)

    expect(screen.getByText('No rationalization rows found in SKILL.md.')).toBeDefined()
  })

  it('RF4: nonzero fires uses text-[--text], zero fires uses text-[--text-muted]', () => {
    mockQuery({
      data: {
        rationalization: {
          skillInstalled: true,
          rows: [
            { label: 'Label A', fires: 5 },
            { label: 'Label B', fires: 0 },
          ],
        },
      },
    })
    render(<RationalizationFires projectId="proj-1" />)

    const nonzeroFires = screen.getByText('5 fires')
    expect(nonzeroFires.className).toContain('text-[--text]')

    const zeroFires = screen.getByText('0 fires')
    expect(zeroFires.className).toContain('text-[--text-muted]')
  })

  it('RF6b: schema_drift error → inline drift state with path visible', () => {
    mockQuery({
      error: new Error('schema_drift:rationalization'),
      isLoading: false,
      data: undefined,
    })
    render(<RationalizationFires projectId="proj-1" />)

    expect(screen.getByText(/rationalization/)).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: /Schema drift/ })).toBeDefined()
  })

  it('RF6c: other error → unreachable state', () => {
    mockQuery({
      error: new Error('Network error'),
      isLoading: false,
      data: undefined,
    })
    render(<RationalizationFires projectId="proj-1" />)

    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })
})
