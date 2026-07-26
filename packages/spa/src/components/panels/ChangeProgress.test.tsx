/**
 * ChangeProgress.test.tsx — project-dashboard › Change Progress Column.
 *
 * The four states this panel must keep distinct, because collapsing any pair
 * of them is what the spec delta forbids:
 *
 *   - no `openspec/` at all          → the project is not on OpenSpec
 *   - `openspec/` with no changes    → nothing in flight
 *   - a change with no task artifact → no task list, NOT 0/0
 *   - a change with no spec delta    → listed, with no capabilities
 *
 * CP1:  panel title is 'Change Progress'
 * CP2:  each open change renders with its name and real task ratio
 * CP3:  a change with no task artifact reads 'no task list', never '0/0'
 * CP4:  affected capabilities render per change
 * CP5:  a change with no spec delta is listed with an explicit state
 * CP6:  present + no open changes → nothing-in-flight empty state
 * CP7:  present:false → not-on-OpenSpec empty state, not an error
 * CP8:  loading state
 * CP9:  schema_drift → InlineDrift with the field path
 * CP10: other error → PanelContainer unreachable
 * CP11: progress bar reflects the ratio and is labelled for assistive tech
 * CP12: a change with no task artifact renders no progress bar
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { OpenspecProjectState } from '@agenticapps/dashboard-shared'

vi.mock('../../lib/projectQueries.js', () => ({
  useOpenspec: vi.fn(),
}))

import { useOpenspec } from '../../lib/projectQueries.js'

import { ChangeProgress } from './ChangeProgress.js'

type MockQueryResult = Partial<UseQueryResult<OpenspecProjectState, Error>>

function mockQuery(overrides: MockQueryResult = {}) {
  vi.mocked(useOpenspec).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<OpenspecProjectState, Error>)
}

const state = (over: Partial<OpenspecProjectState> = {}): OpenspecProjectState => ({
  present: true,
  openChanges: [],
  capabilities: [],
  archived: [],
  ...over,
})

beforeEach(() => vi.clearAllMocks())
afterEach(() => cleanup())

describe('ChangeProgress', () => {
  it('CP1: panel title is "Change Progress"', () => {
    mockQuery({ isLoading: true })
    render(<ChangeProgress projectId="p" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Change Progress' })).toBeDefined()
  })

  it('CP2: renders each open change with its name and real task ratio', () => {
    mockQuery({
      data: state({
        openChanges: [
          {
            name: 'add-openspec-project-reader',
            completedTasks: 59,
            totalTasks: 71,
            hasTaskArtifact: true,
            affectedCapabilities: ['project-dashboard'],
          },
          {
            name: 'retire-v1-surfaces',
            completedTasks: 0,
            totalTasks: 38,
            hasTaskArtifact: true,
            affectedCapabilities: [],
          },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    expect(screen.getByText('add-openspec-project-reader')).toBeDefined()
    expect(screen.getByText('59/71')).toBeDefined()
    expect(screen.getByText('retire-v1-surfaces')).toBeDefined()
    expect(screen.getByText('0/38')).toBeDefined()
  })

  it('CP3: a change with no task artifact reads "no task list" and never "0/0"', () => {
    mockQuery({
      data: state({
        openChanges: [
          {
            name: 'bare-change',
            completedTasks: 0,
            totalTasks: 0,
            hasTaskArtifact: false,
            affectedCapabilities: [],
          },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    expect(screen.getByText('bare-change')).toBeDefined()
    expect(screen.getByText('no task list')).toBeDefined()
    expect(screen.queryByText('0/0')).toBeNull()
  })

  it('CP4: renders the affected capabilities of each change', () => {
    mockQuery({
      data: state({
        openChanges: [
          {
            name: 'add-thing',
            completedTasks: 1,
            totalTasks: 2,
            hasTaskArtifact: true,
            affectedCapabilities: ['daemon-runtime', 'help-docs'],
          },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    const row = screen.getByTestId('change-add-thing')
    expect(within(row).getByText('daemon-runtime')).toBeDefined()
    expect(within(row).getByText('help-docs')).toBeDefined()
  })

  it('CP5: a change with no spec delta is still listed, with an explicit no-delta state', () => {
    mockQuery({
      data: state({
        openChanges: [
          {
            name: 'no-delta-yet',
            completedTasks: 0,
            totalTasks: 1,
            hasTaskArtifact: true,
            affectedCapabilities: [],
          },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    const row = screen.getByTestId('change-no-delta-yet')
    expect(row).toBeDefined()
    expect(within(row).getByText('no spec delta yet')).toBeDefined()
  })

  it('CP6: an openspec tree with no open changes says nothing is in flight', () => {
    mockQuery({ data: state({ capabilities: [{ id: 'a', requirementCount: 1 }] }) })
    render(<ChangeProgress projectId="p" />)

    expect(screen.getByText('No change in flight')).toBeDefined()
    // Not an error, and not the not-migrated state.
    expect(screen.queryByText('Not on OpenSpec')).toBeNull()
  })

  it('CP7: a project with no openspec/ directory says so rather than erroring', () => {
    mockQuery({ data: state({ present: false }) })
    render(<ChangeProgress projectId="p" />)

    expect(screen.getByText('Not on OpenSpec')).toBeDefined()
    expect(screen.queryByText('No change in flight')).toBeNull()
  })

  it('CP8: shows a loading line while the query is in flight', () => {
    mockQuery({ isLoading: true })
    render(<ChangeProgress projectId="p" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('CP9: schema drift renders the inline drift state with the field path', () => {
    mockQuery({ error: new Error('schema_drift:openChanges.0.name') })
    render(<ChangeProgress projectId="p" />)

    expect(screen.getByText(/schema drift/i)).toBeDefined()
    expect(screen.getByText(/openChanges\.0\.name/)).toBeDefined()
  })

  it('CP10: a non-drift error renders the panel in its unreachable state', () => {
    mockQuery({ error: new Error('network boom') })
    render(<ChangeProgress projectId="p" />)

    expect(screen.getByText(/Agent unreachable/i)).toBeDefined()
  })

  it('CP11: the progress bar carries the ratio as an accessible value', () => {
    mockQuery({
      data: state({
        openChanges: [
          {
            name: 'add-thing',
            completedTasks: 3,
            totalTasks: 4,
            hasTaskArtifact: true,
            affectedCapabilities: [],
          },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    const bar = screen.getByRole('progressbar', { name: /add-thing/ })
    expect(bar.getAttribute('aria-valuenow')).toBe('3')
    expect(bar.getAttribute('aria-valuemax')).toBe('4')
  })

  it('CP12: a change with no task artifact renders no progress bar at all', () => {
    mockQuery({
      data: state({
        openChanges: [
          {
            name: 'bare',
            completedTasks: 0,
            totalTasks: 0,
            hasTaskArtifact: false,
            affectedCapabilities: [],
          },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    // A zero-length bar would render exactly like a 0/0 ratio — the distinction
    // the spec delta insists on. No artifact means no bar.
    expect(screen.queryByRole('progressbar')).toBeNull()
  })
})
