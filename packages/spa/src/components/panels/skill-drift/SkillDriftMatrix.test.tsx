/**
 * SkillDriftMatrix.test.tsx — TDD tests for scope-driven matrix rendering.
 *
 * Plan 11-05 Task 2 Step C.
 *
 * PD-11-03 locked behavior:
 * - scope='family': four family sections stacked vertically.
 *   Empty families hidden (not shown as empty placeholders).
 * - scope='cross': single flat block, all projects as columns, alphabetical by projectId.
 *
 * Per-cell "Run AgentLinter" button (D-11-14) fires useAgentLinterDrift().mutate({ projectId }).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { SkillDriftResponse } from '@agenticapps/dashboard-shared'

// Hoisted mock so vi.mock factory runs in module-init phase.
const mutate = vi.fn()
vi.mock('../../../lib/skillDriftQueries.js', () => ({
  useAgentLinterDrift: () => ({
    mutate,
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
    reset: vi.fn(),
  }),
}))

import { SkillDriftMatrix } from './SkillDriftMatrix.js'

afterEach(() => {
  cleanup()
  mutate.mockReset()
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const fixtureProjects: SkillDriftResponse['projects'] = [
  { projectId: 'p1-dash', projectName: 'agenticapps-dashboard', family: 'agenticapps' },
  { projectId: 'p2-core', projectName: 'agenticapps-workflow-core', family: 'agenticapps' },
  { projectId: 'p3-cparx', projectName: 'cparx', family: 'factiv' },
]

const fixtureRows: SkillDriftResponse['rows'] = [
  {
    skillId: 'agenticapps-workflow',
    byProject: {
      'p1-dash': { present: true, version: '1.2.3', lastModifiedIso: '2026-05-16T10:00:00.000Z' },
      'p2-core': { present: true, version: '1.2.3', lastModifiedIso: '2026-05-16T10:00:00.000Z' },
      'p3-cparx': { present: false, version: null, lastModifiedIso: null },
    },
  },
  {
    skillId: 'factiv-signal',
    byProject: {
      'p1-dash': { present: false, version: null, lastModifiedIso: null },
      'p2-core': { present: false, version: null, lastModifiedIso: null },
      'p3-cparx': { present: true, version: '0.9.0', lastModifiedIso: '2026-05-15T08:00:00.000Z' },
    },
  },
]

const fixtureData: SkillDriftResponse = {
  schemaVersion: 1,
  generatedAtIso: '2026-05-16T12:00:00.000Z',
  projects: fixtureProjects,
  rows: fixtureRows,
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SkillDriftMatrix', () => {
  it('SDM1: scope=family with 2 agenticapps + 1 factiv → renders 2 family section headers (and hides empty families)', () => {
    const { container } = render(<SkillDriftMatrix data={fixtureData} scope="family" />)
    // Each family section exposes aria-label="<family> family skill drift"
    expect(container.querySelector('[aria-label="agenticapps family skill drift"]')).not.toBeNull()
    expect(container.querySelector('[aria-label="factiv family skill drift"]')).not.toBeNull()
    // Empty families (neuroflash, other) are hidden, not shown as empty placeholders
    expect(container.querySelector('[aria-label="neuroflash family skill drift"]')).toBeNull()
    expect(container.querySelector('[aria-label="other family skill drift"]')).toBeNull()
  })

  it('SDM2: scope=cross renders ONE flat matrix block with all 3 projects as columns (alphabetical by projectId)', () => {
    render(<SkillDriftMatrix data={fixtureData} scope="cross" />)
    // All three project NAMES appear (rendered in column headers)
    expect(screen.getByText('agenticapps-dashboard')).toBeDefined()
    expect(screen.getByText('agenticapps-workflow-core')).toBeDefined()
    expect(screen.getByText('cparx')).toBeDefined()
    // No family section divider headers in cross mode
    expect(screen.queryByRole('region', { name: /agenticapps family/i })).toBeNull()
  })

  it('SDM3: scope=cross — column order is alphabetical by projectId', () => {
    const { container } = render(<SkillDriftMatrix data={fixtureData} scope="cross" />)
    const headers = Array.from(container.querySelectorAll('th[data-testid="project-col"]'))
    const ids = headers.map((th) => th.getAttribute('data-project-id'))
    expect(ids).toEqual(['p1-dash', 'p2-core', 'p3-cparx'])
  })

  it('SDM4: each cell exposes a "Run AgentLinter" button; click calls mutate({ projectId })', () => {
    render(<SkillDriftMatrix data={fixtureData} scope="cross" />)
    const buttons = screen.getAllByRole('button', { name: /run agentlinter/i })
    // 2 rows × 3 projects = 6 cells (each cell has one button)
    expect(buttons.length).toBe(6)
    fireEvent.click(buttons[0]!)
    expect(mutate).toHaveBeenCalledOnce()
    const arg = mutate.mock.calls[0]![0] as { projectId: string }
    expect(typeof arg.projectId).toBe('string')
    expect(arg.projectId.length).toBeGreaterThan(0)
  })

  it('SDM5: rows: [] renders an empty-state in family scope', () => {
    render(
      <SkillDriftMatrix
        data={{ ...fixtureData, rows: [] }}
        scope="family"
      />,
    )
    expect(screen.getByText(/no skills detected/i)).toBeDefined()
  })

  it('SDM6: rows: [] renders an empty-state in cross scope', () => {
    render(
      <SkillDriftMatrix
        data={{ ...fixtureData, rows: [] }}
        scope="cross"
      />,
    )
    expect(screen.getByText(/no skills detected/i)).toBeDefined()
  })

  it('SDM7: family enum surfaces all four values — neuroflash + other render their sections when populated', () => {
    const fourFamiliesProjects: SkillDriftResponse['projects'] = [
      { projectId: 'p-ag', projectName: 'dash', family: 'agenticapps' },
      { projectId: 'p-fa', projectName: 'cparx', family: 'factiv' },
      { projectId: 'p-ne', projectName: 'nf', family: 'neuroflash' },
      { projectId: 'p-ot', projectName: 'misc', family: 'other' },
    ]
    const fourFamiliesData: SkillDriftResponse = {
      ...fixtureData,
      projects: fourFamiliesProjects,
      rows: [
        {
          skillId: 'agenticapps-workflow',
          byProject: {
            'p-ag': { present: true, version: '1.0.0', lastModifiedIso: null },
            'p-fa': { present: false, version: null, lastModifiedIso: null },
            'p-ne': { present: false, version: null, lastModifiedIso: null },
            'p-ot': { present: false, version: null, lastModifiedIso: null },
          },
        },
      ],
    }
    render(<SkillDriftMatrix data={fourFamiliesData} scope="family" />)
    expect(screen.getByText('agenticapps')).toBeDefined()
    expect(screen.getByText('factiv')).toBeDefined()
    expect(screen.getByText('neuroflash')).toBeDefined()
    expect(screen.getByText('other')).toBeDefined()
  })

  it('SDM8: scope=family with empty family sections (e.g. no factiv project) hides those families', () => {
    const onlyAgenticappsProjects: SkillDriftResponse['projects'] = [
      { projectId: 'p1', projectName: 'dash', family: 'agenticapps' },
    ]
    const onlyAgenticappsData: SkillDriftResponse = {
      ...fixtureData,
      projects: onlyAgenticappsProjects,
      rows: [
        {
          skillId: 'agenticapps-workflow',
          byProject: { p1: { present: true, version: '1.0.0', lastModifiedIso: null } },
        },
      ],
    }
    render(<SkillDriftMatrix data={onlyAgenticappsData} scope="family" />)
    expect(screen.getByText('agenticapps')).toBeDefined()
    expect(screen.queryByText('factiv')).toBeNull()
    expect(screen.queryByText('neuroflash')).toBeNull()
    expect(screen.queryByText('other')).toBeNull()
  })

  it('SDM9: skill rows are rendered (skillId appears in row headers)', () => {
    render(<SkillDriftMatrix data={fixtureData} scope="cross" />)
    expect(screen.getByText('agenticapps-workflow')).toBeDefined()
    expect(screen.getByText('factiv-signal')).toBeDefined()
  })
})
