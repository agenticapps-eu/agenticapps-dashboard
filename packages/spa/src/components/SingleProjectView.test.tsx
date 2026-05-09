/**
 * SingleProjectView.test.tsx — TDD tests for SingleProjectView component.
 *
 * Updated by Plan 06 Task 1 (Phase 5): 3-col grid + health-column added.
 * - SV2 updated: now asserts grid-cols-[1fr_1.5fr_1fr] (3-col)
 * - SV5 updated: health-column IS present (was absent in Phase 4)
 * - SV8: health-column has correct attributes and class
 * - SV9: all 5 Phase 5 panel headings render inside health-column
 * - SV10: panel DOM order in health-column matches UI-SPEC (InstalledSkills first, IntegrationsHealth last)
 * - SV11: health-column has flex flex-col gap-4 classes
 *
 * Tests SV1–SV11:
 * SV1: renders ProjectHeader
 * SV2: renders 3-column grid with grid-cols-[1fr_1.5fr_1fr]  (UPDATED from 2-col)
 * SV3: discipline-column renders CommitmentBlock + HookFirings + RationalizationFires panel regions
 * SV4: phase-progress-column renders all 5 real panel regions (Plan 06 filled these)
 * SV5: health-column IS present (Phase 5 filled it)  (UPDATED from "absent")
 * SV6: document.title updates on mount
 * SV7: gap classes are correct (gap-6 on grid, flex flex-col gap-6 on columns)
 * SV8: health-column has data-testid="health-column" and aria-label="Health"
 * SV9: all 5 Phase 5 panel headings render inside health-column
 * SV10: panel DOM order matches UI-SPEC: InstalledSkills → SkillHealth → Observability → Secrets → Integrations
 * SV11: health-column has flex flex-col gap-6 class
 * SV12: when VITE_APPSHELL_V2=1, PageHeader renders with title equal to projectId
 * SV13: when VITE_APPSHELL_V2=1, ProjectHeader (legacy breadcrumb) is suppressed
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
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

// Mock projectQueries so all panels render their loading state
// (the cleanest assertion target — no network / QueryClient needed for content).
vi.mock('../lib/projectQueries.js', () => ({
  useCommitment: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useObservations: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useDiscipline: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  usePhaseProgress: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useSecurity: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useGlobalSkills: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useLocalSkills: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useAgentLinter: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useObservability: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useSecrets: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useIntegrations: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
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

  it('SV2: renders a 3-column grid with grid-cols-[1fr_1.5fr_1fr]', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const grid = screen.getByTestId('single-project-grid')
    expect(grid).toBeDefined()
    expect(grid.className).toContain('grid-cols-[1fr_1.5fr_1fr]')
    expect(grid.className).not.toContain('grid-cols-[1fr_1.5fr]')
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

  it('SV5: health-column IS present (Phase 5 added it)', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const healthCol = screen.getByTestId('health-column')
    expect(healthCol).toBeDefined()
  })

  it('SV6: document.title is set to "<projectId> — AgenticApps Dashboard"', () => {
    render(<SingleProjectView projectId="my-project" />, { wrapper: makeWrapper() })

    expect(document.title).toBe('my-project — AgenticApps Dashboard')
  })

  it('SV7: grid has gap-6 class; all 3 columns have flex flex-col gap-6 (Pitfall 8 — 24px rhythm)', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const grid = screen.getByTestId('single-project-grid')
    expect(grid.className).toContain('gap-6')

    const disciplineCol = screen.getByTestId('discipline-column')
    expect(disciplineCol.className).toContain('flex')
    expect(disciplineCol.className).toContain('flex-col')
    expect(disciplineCol.className).toContain('gap-6')

    const phaseCol = screen.getByTestId('phase-progress-column')
    expect(phaseCol.className).toContain('flex')
    expect(phaseCol.className).toContain('flex-col')
    expect(phaseCol.className).toContain('gap-6')
  })

  it('SV8: health-column has correct aria-label="Health" attribute', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const healthCol = screen.getByTestId('health-column')
    expect(healthCol.getAttribute('aria-label')).toBe('Health')
  })

  it('SV9: all 5 Phase 5 panel headings render inside health-column', () => {
    render(<SingleProjectView projectId="test-project" />, { wrapper: makeWrapper() })

    const healthCol = screen.getByTestId('health-column')
    const { getByRole } = within(healthCol)

    expect(getByRole('heading', { level: 2, name: 'Installed Skills' })).toBeDefined()
    expect(getByRole('heading', { level: 2, name: 'Skill Health' })).toBeDefined()
    expect(getByRole('heading', { level: 2, name: 'Observability' })).toBeDefined()
    expect(getByRole('heading', { level: 2, name: 'Secrets' })).toBeDefined()
    expect(getByRole('heading', { level: 2, name: 'Integrations' })).toBeDefined()
  })

  it('SV10: panel DOM order in health-column puts actionables first, InstalledSkills reference list last', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const healthCol = screen.getByTestId('health-column')
    const headings = Array.from(healthCol.querySelectorAll('h2')).map((h) => h.textContent)

    const skillHealthIdx = headings.findIndex((h) => h === 'Skill Health')
    const observabilityIdx = headings.findIndex((h) => h === 'Observability')
    const secretsIdx = headings.findIndex((h) => h === 'Secrets')
    const integrationsIdx = headings.findIndex((h) => h === 'Integrations')
    const installedIdx = headings.findIndex((h) => h === 'Installed Skills')

    expect(skillHealthIdx).toBeGreaterThanOrEqual(0)
    expect(installedIdx).toBeGreaterThanOrEqual(0)
    // Actionable health panels first, long reference list last
    expect(skillHealthIdx).toBeLessThan(observabilityIdx)
    expect(observabilityIdx).toBeLessThan(secretsIdx)
    expect(secretsIdx).toBeLessThan(integrationsIdx)
    expect(integrationsIdx).toBeLessThan(installedIdx)
  })

  it('SV11: health-column has flex flex-col gap-6 class (Pitfall 8 — gap normalized to 24px)', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const healthCol = screen.getByTestId('health-column')
    expect(healthCol.className).toContain('flex')
    expect(healthCol.className).toContain('flex-col')
    expect(healthCol.className).toContain('gap-6')
  })
})

describe('SingleProjectView — VITE_APPSHELL_V2 mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    cleanup()
  })

  it('SV12: when VITE_APPSHELL_V2=1, PageHeader renders with title equal to projectId', () => {
    vi.stubEnv('VITE_APPSHELL_V2', '1')
    render(<SingleProjectView projectId="my-project" />, { wrapper: makeWrapper() })

    // PageHeader renders an <h1> with the project ID as the title
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeDefined()
    expect(heading.textContent).toBe('my-project')
  })

  it('SV13: when VITE_APPSHELL_V2=1, ProjectHeader (legacy breadcrumb) is suppressed', () => {
    vi.stubEnv('VITE_APPSHELL_V2', '1')
    render(<SingleProjectView projectId="my-project" />, { wrapper: makeWrapper() })

    // The legacy project-header test-id should not be present in V2 mode
    expect(screen.queryByTestId('project-header')).toBeNull()
  })
})
