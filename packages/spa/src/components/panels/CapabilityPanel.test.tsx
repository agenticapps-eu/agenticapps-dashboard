/**
 * CapabilityPanel.test.tsx — project-dashboard › Capability Panel.
 *
 * This panel states what the project currently promises, as distinct from what
 * work is in flight. That distinction is the reason it is a separate panel from
 * Change Progress rather than a section inside it.
 *
 * CA1: panel title is 'Capabilities'
 * CA2: each capability renders with its requirement count
 * CA3: present + no capabilities → explicit empty state, not an error
 * CA4: present:false → renders nothing (Change Progress already says it once)
 * CA5: loading state
 * CA6: schema_drift → InlineDrift
 * CA7: other error → unreachable
 * CA8: a capability declaring zero requirements still lists
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

import { CapabilityPanel } from './CapabilityPanel.js'

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

describe('CapabilityPanel', () => {
  it('CA1: panel title is "Capabilities"', () => {
    mockQuery({ isLoading: true })
    render(<CapabilityPanel projectId="p" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Capabilities' })).toBeDefined()
  })

  it('CA2: lists each capability with its requirement count', () => {
    mockQuery({
      data: state({
        capabilities: [
          { id: 'project-dashboard', requirementCount: 8 },
          { id: 'daemon-runtime', requirementCount: 9 },
        ],
      }),
    })
    render(<CapabilityPanel projectId="p" />)

    const dashboard = screen.getByTestId('capability-project-dashboard')
    expect(within(dashboard).getByText('project-dashboard')).toBeDefined()
    expect(within(dashboard).getByText('8')).toBeDefined()

    const daemon = screen.getByTestId('capability-daemon-runtime')
    expect(within(daemon).getByText('9')).toBeDefined()
  })

  it('CA8: a capability declaring zero requirements is still listed', () => {
    mockQuery({ data: state({ capabilities: [{ id: 'brand-new', requirementCount: 0 }] }) })
    render(<CapabilityPanel projectId="p" />)

    const row = screen.getByTestId('capability-brand-new')
    expect(within(row).getByText('0')).toBeDefined()
  })

  /*
   * CA9/CA10 close the critique's P2. The unit existed only as sr-only text, so
   * a sighted user read a bare "9" with no way to tell whether it counted
   * requirements, changes or files — and a screen-reader user got strictly
   * better information than they did, which is the inverse of the usual failure
   * and a sign the unit was treated as an accessibility patch, not as content.
   */
  it('CA9: the requirement count carries a visible unit, not just an sr-only one', () => {
    mockQuery({ data: state({ capabilities: [{ id: 'auth-and-pairing', requirementCount: 9 }] }) })
    render(<CapabilityPanel projectId="p" />)

    const header = screen.getByTestId('capability-header')
    expect(header.textContent).toMatch(/requirements/i)

    // And the sr-only crutch is gone now that the column is labelled.
    expect(document.querySelector('.sr-only')).toBeNull()
  })

  it('CA10: a truncating capability id stays recoverable via its title attribute', () => {
    mockQuery({ data: state({ capabilities: [{ id: 'filesystem-access-policy', requirementCount: 7 }] }) })
    render(<CapabilityPanel projectId="p" />)

    const name = screen.getByText('filesystem-access-policy')
    expect(name.getAttribute('title')).toBe('filesystem-access-policy')
  })

  it('CA3: an openspec tree with no capabilities says so rather than erroring', () => {
    mockQuery({ data: state({ capabilities: [] }) })
    render(<CapabilityPanel projectId="p" />)

    expect(screen.getByText('No capabilities declared')).toBeDefined()
  })

  it('CA4: a project with no openspec/ tree renders nothing — Change Progress says it once', () => {
    mockQuery({ data: state({ present: false }) })
    const { container } = render(<CapabilityPanel projectId="p" />)

    expect(container.firstChild).toBeNull()
  })

  it('CA5: shows a loading line while the query is in flight', () => {
    mockQuery({ isLoading: true })
    render(<CapabilityPanel projectId="p" />)
    expect(screen.getByText('Loading…')).toBeDefined()
  })

  it('CA6: schema drift renders the inline drift state', () => {
    mockQuery({ error: new Error('schema_drift:capabilities.0.id') })
    render(<CapabilityPanel projectId="p" />)

    expect(screen.getByText(/schema drift/i)).toBeDefined()
    expect(screen.getByText(/capabilities\.0\.id/)).toBeDefined()
  })

  it('CA7: a non-drift error renders nothing — Change Progress reports it once', () => {
    mockQuery({ error: new Error('network boom') })
    const { container } = render(<CapabilityPanel projectId="p" />)

    /*
     * Both panels read the same `useOpenspec` query, so an unreachable daemon
     * previously rendered the identical paragraph and an identical Retry button
     * twice, 24px apart — inviting the reader to wonder whether the two buttons
     * did different things. This is the same reasoning the panel already
     * applies to `!present`, extended to the path where the duplication is
     * loudest. Schema drift still renders here: InlineDrift names the offending
     * field path, which differs per panel and is worth saying twice.
     */
    expect(container.firstChild).toBeNull()
  })
})
