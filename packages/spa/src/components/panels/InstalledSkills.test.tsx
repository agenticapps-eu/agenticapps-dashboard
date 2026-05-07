/**
 * InstalledSkills.test.tsx — TDD tests for InstalledSkills panel (HEALTH-01).
 *
 * Tests IS1–IS10:
 * IS1: loading state (both hooks loading) → renders Loading...
 * IS2: schema drift from useGlobalSkills → renders InlineDrift
 * IS3: schema drift from useLocalSkills → renders InlineDrift
 * IS4: non-drift error → renders unreachable PanelContainer
 * IS5: empty state (both empty) → renders exact empty-state copy
 * IS6: 2 globals + 1 local → renders 3 rows
 * IS7: sort order: globals first alphabetical, then locals alphabetical
 * IS8: each row has scope-pill text and skill name
 * IS9: multi-line description → renders only first non-empty line; truncate class present
 * IS10: cross-project: render with different projectIds produces independent hook calls
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { GlobalSkillsResponse, LocalSkillsResponse } from '@agenticapps/dashboard-shared'

vi.mock('../../lib/projectQueries.js', () => ({
  useGlobalSkills: vi.fn(),
  useLocalSkills: vi.fn(),
}))

import { useGlobalSkills, useLocalSkills } from '../../lib/projectQueries.js'
import { InstalledSkills } from './InstalledSkills.js'

type GlobalMock = Partial<UseQueryResult<GlobalSkillsResponse, Error>>
type LocalMock = Partial<UseQueryResult<LocalSkillsResponse, Error>>

function mockGlobal(overrides: GlobalMock = {}) {
  vi.mocked(useGlobalSkills).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<GlobalSkillsResponse, Error>)
}

function mockLocal(overrides: LocalMock = {}) {
  vi.mocked(useLocalSkills).mockReturnValue({
    data: undefined,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
    ...overrides,
  } as UseQueryResult<LocalSkillsResponse, Error>)
}

const GLOBAL_EMPTY: GlobalSkillsResponse = { scope: 'global', skills: [] }
const LOCAL_EMPTY: LocalSkillsResponse = { scope: 'local', skills: [] }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('InstalledSkills', () => {
  it('IS1: loading state — both hooks loading → renders Loading...', () => {
    mockGlobal({ isLoading: true })
    mockLocal({ isLoading: true })
    render(<InstalledSkills projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('IS1b: loading state — only global loading → renders Loading...', () => {
    mockGlobal({ isLoading: true })
    mockLocal({ isLoading: false, data: LOCAL_EMPTY })
    render(<InstalledSkills projectId="proj-1" />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('IS2: schema drift from useGlobalSkills → renders InlineDrift with path from error message', () => {
    mockGlobal({ error: new Error('schema_drift:/api/skills/global') })
    mockLocal({ data: LOCAL_EMPTY })
    render(<InstalledSkills projectId="proj-1" />)
    // InlineDrift renders "Schema drift — {title}" as heading
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Schema drift')
    // Path from error message is shown
    expect(screen.getByText(/\/api\/skills\/global/)).toBeDefined()
  })

  it('IS3: schema drift from useLocalSkills → renders InlineDrift', () => {
    mockGlobal({ data: GLOBAL_EMPTY })
    mockLocal({ error: new Error('schema_drift:/api/projects/proj-1/skills/local') })
    render(<InstalledSkills projectId="proj-1" />)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toContain('Schema drift')
    expect(screen.getByText(/\/api\/projects\/proj-1\/skills\/local/)).toBeDefined()
  })

  it('IS4: non-drift error → renders unreachable PanelContainer', () => {
    mockGlobal({ error: new Error('Network Error') })
    mockLocal({ data: LOCAL_EMPTY })
    render(<InstalledSkills projectId="proj-1" />)
    // PanelContainer unreachable renders 'Agent unreachable — retrying...'
    expect(screen.getByText('Agent unreachable — retrying...')).toBeDefined()
  })

  it('IS5: empty state (both global + local skills empty) → renders exact copy', () => {
    mockGlobal({ data: GLOBAL_EMPTY })
    mockLocal({ data: LOCAL_EMPTY })
    render(<InstalledSkills projectId="proj-1" />)
    expect(screen.getByText(/No skills installed\./)).toBeDefined()
    expect(screen.getByText(/claude skill install/)).toBeDefined()
    expect(screen.getByText(/place a SKILL\.md under/)).toBeDefined()
  })

  it('IS6: 2 globals + 1 local → renders 3 rows', () => {
    mockGlobal({
      data: {
        scope: 'global',
        skills: [
          { name: 'meta-observer', dir: '/home/.claude/skills/meta-observer', scope: 'global', description: 'Observes sessions' },
          { name: 'careful', dir: '/home/.claude/skills/careful', scope: 'global', description: 'Care skill' },
        ],
      },
    })
    mockLocal({
      data: {
        scope: 'local',
        skills: [
          { name: 'project-skill', dir: '/project/.claude/skills/project-skill', scope: 'local', description: 'Local skill' },
        ],
      },
    })
    render(<InstalledSkills projectId="proj-1" />)
    expect(screen.getByText('meta-observer')).toBeDefined()
    expect(screen.getByText('careful')).toBeDefined()
    expect(screen.getByText('project-skill')).toBeDefined()
  })

  it('IS7: sort order — globals first alphabetical (aaa, zzz), then locals alphabetical (bbb)', () => {
    mockGlobal({
      data: {
        scope: 'global',
        skills: [
          { name: 'zzz-skill', dir: 'zzz-skill', scope: 'global', description: 'Z' },
          { name: 'aaa-skill', dir: 'aaa-skill', scope: 'global', description: 'A' },
        ],
      },
    })
    mockLocal({
      data: {
        scope: 'local',
        skills: [
          { name: 'bbb-skill', dir: 'bbb-skill', scope: 'local', description: 'B' },
        ],
      },
    })
    render(<InstalledSkills projectId="proj-1" />)
    const rows = screen.getAllByRole('listitem')
    // First row: aaa-skill (global, alphabetical first)
    expect(rows[0]?.textContent).toContain('aaa-skill')
    // Second row: zzz-skill (global, alphabetical second)
    expect(rows[1]?.textContent).toContain('zzz-skill')
    // Third row: bbb-skill (local, after all globals)
    expect(rows[2]?.textContent).toContain('bbb-skill')
  })

  it('IS8: each row has scope-pill text (global or local) and the skill name', () => {
    mockGlobal({
      data: {
        scope: 'global',
        skills: [{ name: 'meta-observer', dir: '/h/.claude/skills/meta-observer', scope: 'global', description: 'Desc' }],
      },
    })
    mockLocal({
      data: {
        scope: 'local',
        skills: [{ name: 'proj-skill', dir: '/p/.claude/skills/proj-skill', scope: 'local', description: 'Local' }],
      },
    })
    render(<InstalledSkills projectId="proj-1" />)
    // Scope pills
    expect(screen.getByText('global')).toBeDefined()
    expect(screen.getByText('local')).toBeDefined()
    // Skill names
    expect(screen.getByText('meta-observer')).toBeDefined()
    expect(screen.getByText('proj-skill')).toBeDefined()
  })

  it('IS9: multi-line description → only first non-empty line rendered; truncate class present', () => {
    const multiLineDesc = '\n\nFirst visible line\nSecond line hidden\nThird line hidden'
    mockGlobal({
      data: {
        scope: 'global',
        skills: [{ name: 'multi-skill', dir: '/h/multi-skill', scope: 'global', description: multiLineDesc }],
      },
    })
    mockLocal({ data: LOCAL_EMPTY })
    render(<InstalledSkills projectId="proj-1" />)
    // Only the first non-empty line should be rendered
    expect(screen.getByText('First visible line')).toBeDefined()
    // Second line must NOT be rendered as separate text
    expect(screen.queryByText('Second line hidden')).toBeNull()
    // The description span should have 'truncate' class
    const descEl = screen.getByText('First visible line')
    expect(descEl.className).toContain('truncate')
  })

  it('IS10: cross-project — renders with different projectIds calls useLocalSkills with those ids', () => {
    // First render
    mockGlobal({ data: GLOBAL_EMPTY })
    mockLocal({ data: LOCAL_EMPTY })
    const { unmount } = render(<InstalledSkills projectId="proj-alpha" />)
    expect(vi.mocked(useLocalSkills)).toHaveBeenCalledWith('proj-alpha')
    unmount()

    // Second render with different id
    vi.clearAllMocks()
    mockGlobal({ data: GLOBAL_EMPTY })
    mockLocal({ data: LOCAL_EMPTY })
    render(<InstalledSkills projectId="proj-beta" />)
    expect(vi.mocked(useLocalSkills)).toHaveBeenCalledWith('proj-beta')
  })
})
