/**
 * SingleProjectView.test.tsx — TDD tests for SingleProjectView component.
 *
 * Updated by Plan 06: SV4 now asserts all 8 real panel regions are mounted
 * (all 5 phase-progress-column data-slot divs replaced by real components).
 *
 * Tests SV1–SV7:
 * SV1: renders ProjectHeader
 * SV2: renders 2-column grid with grid-cols-[1fr_1.5fr]
 * SV3: discipline-column renders CommitmentBlock + HookFirings + RationalizationFires panel regions
 * SV4: phase-progress-column renders all 5 real panel regions (Plan 06 filled these)
 * SV5: NO right-column DOM element (health-column absent)
 * SV6: document.title updates on mount
 * SV7: gap classes are correct (gap-6 on grid, flex flex-col gap-4 on columns)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock ProjectHeader to isolate SingleProjectView tests
vi.mock('./ProjectHeader.js', () => ({
  ProjectHeader: ({ projectId }: { projectId: string }) => (
    <div data-testid="project-header" data-project-id={projectId}>
      ProjectHeader({projectId})
    </div>
  ),
}))

// Mock registry (ProjectHeader might transitively need it in other tests, but we're mocking the component directly)
vi.mock('../lib/registry.js', () => ({
  useRegistryList: () => ({ data: undefined, isLoading: true }),
  useProjectOverview: () => ({ data: undefined, isLoading: true }),
}))

// Mock projectQueries so the 3 Discipline panels render their loading state
// (the cleanest assertion target — no network / QueryClient needed for content).
vi.mock('../lib/projectQueries.js', () => ({
  useCommitment: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useObservations: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useDiscipline: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  usePhaseProgress: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useSecurity: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
}))

import { SingleProjectView } from './SingleProjectView.js'

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children)
  }
  return Wrapper
}

beforeEach(() => {
  document.title = 'initial title'
})

afterEach(() => {
  cleanup()
})

describe('SingleProjectView', () => {
  it('SV1: renders ProjectHeader with correct projectId', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const header = screen.getByTestId('project-header')
    expect(header).toBeDefined()
    expect(header.getAttribute('data-project-id')).toBe('acme')
  })

  it('SV2: renders a 2-column grid with grid-cols-[1fr_1.5fr]', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const grid = screen.getByTestId('single-project-grid')
    expect(grid).toBeDefined()
    expect(grid.className).toContain('grid-cols-[1fr_1.5fr]')
  })

  it('SV3: discipline-column mounts CommitmentBlock + HookFirings + RationalizationFires panel regions', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    // PanelContainer makes each panel a region (aria-labelledby → role="region")
    expect(screen.getByRole('region', { name: 'Commitment' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Hook Firings' })).toBeDefined()
    expect(screen.getByRole('region', { name: 'Rationalization Fires' })).toBeDefined()

    // The old data-slot placeholder divs are gone (replaced by real components)
    const col = screen.getByTestId('discipline-column')
    expect(col.querySelector('[data-slot="commitment"]')).toBeNull()
    expect(col.querySelector('[data-slot="hook-firings"]')).toBeNull()
    expect(col.querySelector('[data-slot="rationalization-fires"]')).toBeNull()
  })

  it('SV4: phase-progress-column mounts all 5 real panel regions (Plan 06 filled)', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    // PanelContainer panels render <section aria-labelledby="{id}-title"> + <h2 id="{id}-title">
    // Use heading queries to confirm each panel is mounted (heading = panel title in PanelContainer)
    expect(screen.getByRole('heading', { level: 2, name: 'Phase Progress' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: 'Execution Timeline' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: 'Review Status' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: 'Security Status' })).toBeDefined()
    expect(screen.getByRole('heading', { level: 2, name: 'Verification Status' })).toBeDefined()

    // No old data-slot placeholder divs remain
    const col = screen.getByTestId('phase-progress-column')
    expect(col.querySelector('[data-slot="phase-progress"]')).toBeNull()
    expect(col.querySelector('[data-slot="execution-timeline"]')).toBeNull()
    expect(col.querySelector('[data-slot="review-status"]')).toBeNull()
    expect(col.querySelector('[data-slot="security-status"]')).toBeNull()
    expect(col.querySelector('[data-slot="verification-status"]')).toBeNull()
  })

  it('SV5: NO health-column DOM element (anti-stub guarantee, D-4-09)', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    expect(screen.queryByTestId('health-column')).toBeNull()
  })

  it('SV6: document.title is set to "<projectId> — AgenticApps Dashboard"', () => {
    render(<SingleProjectView projectId="my-project" />, { wrapper: makeWrapper() })

    expect(document.title).toBe('my-project — AgenticApps Dashboard')
  })

  it('SV7: grid has gap-6 class; discipline-column and phase-progress-column have flex flex-col gap-4', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const grid = screen.getByTestId('single-project-grid')
    expect(grid.className).toContain('gap-6')

    const disciplineCol = screen.getByTestId('discipline-column')
    expect(disciplineCol.className).toContain('flex')
    expect(disciplineCol.className).toContain('flex-col')
    expect(disciplineCol.className).toContain('gap-4')

    const phaseCol = screen.getByTestId('phase-progress-column')
    expect(phaseCol.className).toContain('flex')
    expect(phaseCol.className).toContain('flex-col')
    expect(phaseCol.className).toContain('gap-4')
  })
})
