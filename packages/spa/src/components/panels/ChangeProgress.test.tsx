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
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
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
    expect(screen.getByText('Loading…')).toBeDefined()
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

  /*
   * CP13–CP17 close the impeccable critique's P0 and P2 findings. The P0 is the
   * sharpest kind of defect this change could ship: the daemon distinguishes
   * "no task artifact" from "0 of N", the component branches on it, and then the
   * track was painted card-bg-hover (#FAFAF7) on card-bg (#FFFFFF) — 1.05:1, and
   * therefore invisible. A 0% fill on an invisible track renders identically to
   * no bar, re-collapsing at the pixel level exactly the distinction the whole
   * change exists to preserve.
   */
  it('CP13: the progress track is not painted in the card background', () => {
    mockQuery({
      data: state({
        openChanges: [
          {
            name: 'add-thing',
            completedTasks: 12,
            totalTasks: 45,
            hasTaskArtifact: true,
            affectedCapabilities: [],
          },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    const track = screen.getByRole('progressbar', { name: /add-thing/ })
    // card-bg-hover is the card's own hover fill; against card-bg it is 1.05:1.
    expect(track.className).not.toContain('bg-card-bg-hover')
  })

  /*
   * CP19 extends the rule the component already states for `!hasTaskArtifact`.
   * The docstring's argument — a bar at 0% encodes nothing and is visually
   * identical to the absence of one — does not stop at artifact presence. A
   * genuine 0/45 gets a rail that is indistinguishable from the row divider
   * (both border-subtle, 20px apart) and carries no information the ratio text
   * does not already carry. The ratio is what distinguishes "0/45" from
   * "no task list"; the rail never was.
   */
  it('CP19: a change with zero completed tasks renders no bar — the ratio already says it', () => {
    mockQuery({
      data: state({
        openChanges: [
          {
            name: 'untouched',
            completedTasks: 0,
            totalTasks: 45,
            hasTaskArtifact: true,
            affectedCapabilities: [],
          },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    expect(screen.getByText('0/45')).toBeDefined()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  /*
   * CP21/CP22 close the re-critique's remaining P1s. Expanded, the summary line
   * that claims two groups had scrolled ~660px away, leaving nine rows at
   * identical weight and the boundary carried in working memory; and the toggle
   * jumped below the fold the moment it was clicked, so the control the user
   * had just used vanished and collapsing meant hunting for it.
   */
  it('CP21: the proposed group is labelled in the DOM, not just in the summary line', () => {
    mockQuery({
      data: state({
        openChanges: [
          { name: 'moving', completedTasks: 1, totalTasks: 4, hasTaskArtifact: true, affectedCapabilities: [] },
          ...['q1', 'q2', 'q3', 'q4'].map((name) => ({
            name,
            completedTasks: 0,
            totalTasks: 45,
            hasTaskArtifact: true,
            affectedCapabilities: [] as string[],
          })),
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)
    fireEvent.click(screen.getByRole('button', { name: /4 proposed/i }))

    expect(screen.getByTestId('proposed-group-label')).toBeDefined()
  })

  it('CP22: the disclosure stays above the rows it reveals', () => {
    mockQuery({
      data: state({
        openChanges: [
          { name: 'moving', completedTasks: 1, totalTasks: 4, hasTaskArtifact: true, affectedCapabilities: [] },
          ...['q1', 'q2', 'q3', 'q4'].map((name) => ({
            name,
            completedTasks: 0,
            totalTasks: 45,
            hasTaskArtifact: true,
            affectedCapabilities: [] as string[],
          })),
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)
    const toggle = screen.getByRole('button', { name: /4 proposed/i })
    fireEvent.click(toggle)

    const firstProposed = screen.getByTestId('change-q1')
    // DOCUMENT_POSITION_FOLLOWING === the toggle comes before the revealed rows.
    expect(toggle.compareDocumentPosition(firstProposed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('CP20: capability pills are capped so blast radius cannot outshout progress', () => {
    mockQuery({
      data: state({
        openChanges: [
          {
            name: 'wide-change',
            completedTasks: 1,
            totalTasks: 38,
            hasTaskArtifact: true,
            affectedCapabilities: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
          },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    const row = screen.getByTestId('change-wide-change')
    expect(within(row).getByText('a')).toBeDefined()
    expect(within(row).getByText('+4 more')).toBeDefined()
    expect(within(row).queryByText('g')).toBeNull()
  })

  it('CP14: changes with progress sort above those with none', () => {
    mockQuery({
      data: state({
        openChanges: [
          { name: 'aaa-not-started', completedTasks: 0, totalTasks: 45, hasTaskArtifact: true, affectedCapabilities: [] },
          { name: 'zzz-in-flight', completedTasks: 59, totalTasks: 71, hasTaskArtifact: true, affectedCapabilities: [] },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    // Alphabetical order would put the untouched change first. Triage order
    // puts the change that is actually moving at the top.
    // Rows only — the summary line shares the `change-` testid prefix.
    const names = Array.from(document.querySelectorAll('li[data-testid^="change-"]')).map((el) =>
      el.getAttribute('data-testid'),
    )
    expect(names[0]).toBe('change-zzz-in-flight')
  })

  it('CP15: the panel states how much is in flight versus merely proposed', () => {
    mockQuery({
      data: state({
        openChanges: [
          { name: 'moving', completedTasks: 59, totalTasks: 71, hasTaskArtifact: true, affectedCapabilities: [] },
          { name: 'queued-a', completedTasks: 0, totalTasks: 45, hasTaskArtifact: true, affectedCapabilities: [] },
          { name: 'queued-b', completedTasks: 0, totalTasks: 13, hasTaskArtifact: true, affectedCapabilities: [] },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    // Eight zeros stacked with no frame reads as debt. The count says which.
    expect(screen.getByTestId('change-summary').textContent).toMatch(/1 in flight/)
    expect(screen.getByTestId('change-summary').textContent).toMatch(/2 proposed/)
  })

  it('CP16: a long proposed queue collapses behind a disclosure the keyboard can reach', () => {
    mockQuery({
      data: state({
        openChanges: [
          { name: 'moving', completedTasks: 1, totalTasks: 4, hasTaskArtifact: true, affectedCapabilities: [] },
          ...['q1', 'q2', 'q3', 'q4'].map((name) => ({
            name,
            completedTasks: 0,
            totalTasks: 45,
            hasTaskArtifact: true,
            affectedCapabilities: [] as string[],
          })),
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    // In flight is always visible; proposed work is one keystroke away.
    expect(screen.getByTestId('change-moving')).toBeDefined()
    expect(screen.queryByTestId('change-q1')).toBeNull()

    const toggle = screen.getByRole('button', { name: /4 proposed/i })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)

    expect(screen.getByTestId('change-q1')).toBeDefined()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('CP18: a short proposed queue stays open — collapsing two rows hides data and saves nothing', () => {
    mockQuery({
      data: state({
        openChanges: [
          { name: 'moving', completedTasks: 1, totalTasks: 4, hasTaskArtifact: true, affectedCapabilities: [] },
          { name: 'queued', completedTasks: 0, totalTasks: 45, hasTaskArtifact: true, affectedCapabilities: [] },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    expect(screen.getByTestId('change-queued')).toBeDefined()
    expect(screen.queryByRole('button', { name: /proposed/i })).toBeNull()
  })

  it('CP17: a truncating change name stays recoverable via its title attribute', () => {
    mockQuery({
      data: state({
        openChanges: [
          {
            name: 'verify-tailscale-second-device-access',
            completedTasks: 1,
            totalTasks: 12,
            hasTaskArtifact: true,
            affectedCapabilities: [],
          },
        ],
      }),
    })
    render(<ChangeProgress projectId="p" />)

    const name = screen.getByText('verify-tailscale-second-device-access')
    expect(name.getAttribute('title')).toBe('verify-tailscale-second-device-access')
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
