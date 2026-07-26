/**
 * SingleProjectView.test.tsx — TDD tests for SingleProjectView component.
 *
 * Updated by Plan 05.1-06 Task 1 (Wave 5): ProjectHeader deleted, PageHeader unconditional.
 * - SV1 updated: no longer tests ProjectHeader (deleted in Wave 5)
 * - SV2: renders 3-column grid with grid-cols-[1fr_1.5fr_1fr]
 * - SV12: PageHeader unconditional (no flag needed)
 * - SV13: removed (ProjectHeader no longer exists)
 *
 * Tests SV1–SV12:
 * SV1: PageHeader renders with projectId as title (Wave 5: unconditional)
 * SV2: renders 3-column grid with grid-cols-[1fr_1.5fr_1fr]
 * SV3: discipline-column renders CommitmentBlock + HookFirings + RationalizationFires panel regions
 * SV4: the five retired phase panels no longer mount; the centre column awaits group 6
 * SV5: health-column IS present (Phase 5 filled it)
 * SV6: document.title updates on mount
 * SV7: gap classes are correct (gap-6 on grid, flex flex-col gap-6 on columns)
 * SV8: health-column has data-testid="health-column" and aria-label="Health"
 * SV9: all 5 Phase 5 panel headings render inside health-column
 * SV10: panel DOM order matches UI-SPEC: SkillHealth → Observability → Secrets → Integrations → InstalledSkills
 * SV11: health-column has flex flex-col gap-6 class
 * SV12: PageHeader always renders (no env stub needed — Wave 5 removed the flag)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock registry. useRegistryList is a vi.fn rather than a fixed arrow because
// group 6 drives the centre column off the project's `condition` — a
// needs-migration project renders the migration notice in place of the
// Change Progress and Capability panels.
vi.mock('../lib/registry.js', () => ({
  useRegistryList: vi.fn(() => ({ data: undefined, isLoading: true })),
  useProjectOverview: vi.fn(() => ({ data: undefined, isLoading: true })),
}))

// Mock projectQueries so all panels render their loading state
// (the cleanest assertion target — no network / QueryClient needed for content).
vi.mock('../lib/projectQueries.js', () => ({
  useCommitment: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useObservations: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useDiscipline: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useGlobalSkills: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useLocalSkills: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useAgentLinter: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useObservability: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useSecrets: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useIntegrations: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useSentryRecent: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useLinearIssues: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
  useOpenspec: vi.fn(() => ({ data: undefined, error: null, isLoading: true, refetch: vi.fn() })),
}))

import { useRegistryList } from '../lib/registry.js'

import { SingleProjectView } from './SingleProjectView.js'

/** Point useRegistryList at one project carrying the given condition. */
function mockCondition(condition: string, projectId = 'acme') {
  vi.mocked(useRegistryList).mockReturnValue({
    data: [
      {
        id: projectId,
        name: projectId,
        root: `/tmp/${projectId}`,
        client: null,
        addedAt: '2026-07-26T00:00:00.000Z',
        tags: [],
        status: {
          reachable: true,
          condition,
          openChanges: [],
          capabilityCount: 0,
          lastCommitAt: null,
        },
      },
    ],
    isLoading: false,
  } as unknown as ReturnType<typeof useRegistryList>)
}

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
  it('SV1: renders PageHeader with projectId as title (Wave 5 — unconditional)', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeDefined()
    expect(heading.textContent).toBe('acme')
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

  /*
   * SV4 inverted by task group 5: the five phase-artifact panels are retired
   * with the reader that fed them. Group 6 mounts Change Progress and the
   * Capability panel in the column they vacated.
   */
  it('SV4: the retired phase panels no longer mount', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    for (const name of [
      'Phase Progress',
      'Execution Timeline',
      'Review Status',
      'Security Status',
      'Verification Status',
    ]) {
      expect(screen.queryByRole('heading', { level: 2, name })).toBeNull()
    }

    expect(screen.getByTestId('change-progress-column')).toBeDefined()
  })

  it('SV14: the centre column mounts Change Progress above Capabilities', () => {
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const col = screen.getByTestId('change-progress-column')
    const headings = Array.from(col.querySelectorAll('h2')).map((h) => h.textContent)

    expect(headings).toContain('Change Progress')
    expect(headings).toContain('Capabilities')
    // Work in flight reads before the standing promise it changes.
    expect(headings.indexOf('Change Progress')).toBeLessThan(headings.indexOf('Capabilities'))
  })
})

describe('SingleProjectView — a needs-migration project', () => {
  afterEach(() => cleanup())

  it('SV15: renders the migration notice instead of the change panels', () => {
    mockCondition('needs-migration')
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    expect(screen.getByTestId('migration-notice')).toBeDefined()
    // The two OpenSpec panels have no source on a GSD-layout project, so they
    // do not mount at all rather than mounting into a permanent empty state.
    expect(screen.queryByRole('heading', { level: 2, name: 'Change Progress' })).toBeNull()
    expect(screen.queryByRole('heading', { level: 2, name: 'Capabilities' })).toBeNull()
  })

  it('SV16: header context still renders — neither a blank page nor an error', () => {
    mockCondition('needs-migration')
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('acme')
    // Discipline and health columns are git- and filesystem-derived, so they
    // keep working on a project that never migrated.
    expect(screen.getByTestId('discipline-column')).toBeDefined()
    expect(screen.getByTestId('health-column')).toBeDefined()
  })

  it('SV17: the notice explains the layout predates OpenSpec and does not read as an error', () => {
    mockCondition('needs-migration')
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    const notice = screen.getByTestId('migration-notice')
    expect(notice.textContent).toMatch(/OpenSpec/)
    expect(notice.textContent).toMatch(/migrat/i)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('SV18: a migrated project renders the panels and no migration notice', () => {
    mockCondition('migrated')
    render(<SingleProjectView projectId="acme" />, { wrapper: makeWrapper() })

    expect(screen.queryByTestId('migration-notice')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Change Progress' })).toBeDefined()
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

    const changeCol = screen.getByTestId('change-progress-column')
    expect(changeCol.className).toContain('flex')
    expect(changeCol.className).toContain('flex-col')
    expect(changeCol.className).toContain('gap-6')
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

describe('SingleProjectView — PageHeader always renders (Wave 5 — flag removed)', () => {
  afterEach(() => {
    cleanup()
  })

  it('SV12: PageHeader renders with title equal to projectId (no env stub needed)', () => {
    render(<SingleProjectView projectId="my-project" />, { wrapper: makeWrapper() })

    // PageHeader renders an <h1> with the project ID as the title — always, no flag
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeDefined()
    expect(heading.textContent).toBe('my-project')
  })
})
