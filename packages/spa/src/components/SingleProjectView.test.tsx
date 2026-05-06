/**
 * SingleProjectView.test.tsx — TDD tests for SingleProjectView component.
 *
 * Tests SV1–SV7:
 * SV1: renders ProjectHeader
 * SV2: renders 2-column grid with grid-cols-[1fr_1.5fr]
 * SV3: left column (discipline-column) has 3 placeholder slots
 * SV4: center column (phase-progress-column) has 5 placeholder slots
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

  it('SV3: discipline-column has 3 placeholder slots (commitment, hook-firings, rationalization-fires)', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const col = screen.getByTestId('discipline-column')
    expect(col).toBeDefined()

    const commitment = col.querySelector('[data-slot="commitment"]')
    const hookFirings = col.querySelector('[data-slot="hook-firings"]')
    const rationalization = col.querySelector('[data-slot="rationalization-fires"]')

    expect(commitment).toBeDefined()
    expect(hookFirings).toBeDefined()
    expect(rationalization).toBeDefined()
  })

  it('SV4: phase-progress-column has 5 placeholder slots', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const col = screen.getByTestId('phase-progress-column')
    expect(col).toBeDefined()

    const slots = [
      'phase-progress',
      'execution-timeline',
      'review-status',
      'security-status',
      'verification-status',
    ]
    for (const slot of slots) {
      expect(col.querySelector(`[data-slot="${slot}"]`)).not.toBeNull()
    }
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
