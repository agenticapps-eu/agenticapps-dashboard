/**
 * HookFirings.test.tsx — TDD tests for HookFirings panel.
 *
 * Tests HF1–HF7:
 * HF1: skillInstalled true + 3 entries → renders 3 rows
 * HF2: skillInstalled false → install-hint with CodeBlock
 * HF3: skillInstalled true + empty entries → empty-state copy
 * HF4: loading → 'Loading...'
 * HF5: 30 entries returned → renders all 30 (no client-side trim)
 * HF6: ts rendered via formatRelativeTime
 * HF7: panel title is 'Hook Firings'
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { ObservationsRecentResponse } from '@agenticapps/dashboard-shared'

vi.mock('../../lib/projectQueries.js', () => ({
  useCommitment: vi.fn(),
  useObservations: vi.fn(),
  useDiscipline: vi.fn(),
}))

// Mock relativeTime to control output in tests
vi.mock('../../lib/relativeTime.js', () => ({
  formatRelativeTime: vi.fn(() => '5m ago'),
}))

import { useObservations } from '../../lib/projectQueries.js'
import { formatRelativeTime } from '../../lib/relativeTime.js'
import { HookFirings } from './HookFirings.js'

type MockQueryResult = Partial<UseQueryResult<ObservationsRecentResponse, Error>>

function mockQuery(overrides: MockQueryResult = {}) {
  vi.mocked(useObservations).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<ObservationsRecentResponse, Error>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('HookFirings', () => {
  it('HF7: panel title is "Hook Firings"', () => {
    mockQuery({ isLoading: true })
    render(<HookFirings projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Hook Firings' })).toBeDefined()
  })

  it('HF4: while loading shows "Loading..."', () => {
    mockQuery({ isLoading: true, data: undefined })
    render(<HookFirings projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('HF1: skillInstalled true + 3 entries → renders 3 rows with time, skill (bold), hook (badge)', () => {
    mockQuery({
      data: {
        skillInstalled: true,
        entries: [
          { ts: '2026-05-06T10:00:00Z', skill: 'meta-observer', hook: 'PreToolUse' },
          { ts: '2026-05-06T09:00:00Z', skill: 'agenticapps-workflow', hook: 'PostToolUse' },
          { ts: '2026-05-06T08:00:00Z', skill: 'meta-observer', hook: 'Stop' },
        ],
      },
    })
    render(<HookFirings projectId="proj-1" />)

    // 3 skill names rendered
    expect(screen.getAllByText('meta-observer')).toHaveLength(2)
    expect(screen.getByText('agenticapps-workflow')).toBeDefined()

    // 3 hook badges
    expect(screen.getByText('PreToolUse')).toBeDefined()
    expect(screen.getByText('PostToolUse')).toBeDefined()
    expect(screen.getByText('Stop')).toBeDefined()

    // 3 timestamps via formatRelativeTime
    expect(vi.mocked(formatRelativeTime)).toHaveBeenCalledTimes(3)
  })

  it('HF2: skillInstalled false → install-hint with CodeBlock command and copy text', () => {
    mockQuery({
      data: { skillInstalled: false, entries: [] },
    })
    render(<HookFirings projectId="proj-1" />)

    expect(
      screen.getByText('The meta-observer skill is not installed in this project.'),
    ).toBeDefined()
    // The install command is rendered in CodeBlock
    expect(screen.getByText('claude skill install meta-observer')).toBeDefined()
  })

  it('HF3: skillInstalled true + empty entries → renders empty-state copy verbatim', () => {
    mockQuery({
      data: { skillInstalled: true, entries: [] },
    })
    render(<HookFirings projectId="proj-1" />)

    expect(
      screen.getByText('No hook firings yet — try running /review or /cso.'),
    ).toBeDefined()
  })

  it('HF5: 30 entries all rendered (no client-side trim — daemon is source of truth)', () => {
    const entries = Array.from({ length: 30 }, (_, i) => ({
      ts: `2026-05-06T${String(i).padStart(2, '0')}:00:00Z`,
      skill: `skill-${i}`,
      hook: 'PreToolUse',
    }))
    mockQuery({ data: { skillInstalled: true, entries } })
    render(<HookFirings projectId="proj-1" />)

    // All 30 unique skill names should be present
    for (let i = 0; i < 30; i++) {
      expect(screen.getByText(`skill-${i}`)).toBeDefined()
    }
  })

  it('HF6: ts is rendered via formatRelativeTime', () => {
    vi.mocked(formatRelativeTime).mockReturnValue('5m ago')
    mockQuery({
      data: {
        skillInstalled: true,
        entries: [{ ts: '2026-05-06T10:00:00Z', skill: 'meta-observer', hook: 'PreToolUse' }],
      },
    })
    render(<HookFirings projectId="proj-1" />)

    expect(vi.mocked(formatRelativeTime)).toHaveBeenCalledWith('2026-05-06T10:00:00Z')
    expect(screen.getByText('5m ago')).toBeDefined()
  })
})
