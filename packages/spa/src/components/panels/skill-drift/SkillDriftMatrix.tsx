/**
 * SkillDriftMatrix — Scope-driven per-skill matrix (Plan 11-05 Task 2 Step C).
 *
 * Rendering (PD-11-03 locked):
 * - scope='family': four family sections (agenticapps / factiv / neuroflash /
 *   other) stacked vertically. Empty families are HIDDEN, not shown as empty
 *   placeholders.
 * - scope='cross': single flat block with ALL projects as columns, alphabetical
 *   by projectId.
 *
 * Each (skill, project) cell renders:
 * - SkillDriftCell (presence + version)
 * - "Run AgentLinter" button → useAgentLinterDrift().mutate({ projectId }) (D-11-14)
 *
 * Empty `rows: []` → "No skills detected" empty-state for BOTH scopes.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 */
import React from 'react'
import { Play } from 'lucide-react'
import type {
  SkillDriftResponse,
  SkillDriftCell as SkillDriftCellData,
} from '@agenticapps/dashboard-shared'

import { useAgentLinterDrift } from '../../../lib/skillDriftQueries.js'
import type { SkillDriftScope } from '../../../lib/skillDriftQueries.js'
import { EmptyState } from '../../ui/EmptyState.js'
import { SkillDriftCell } from './SkillDriftCell.js'

// Four-family lock (D-11-04 / D-11-06 / PD-11-03).
const FAMILIES = ['agenticapps', 'factiv', 'neuroflash', 'other'] as const
type Family = (typeof FAMILIES)[number]

type Project = SkillDriftResponse['projects'][number]
type Row = SkillDriftResponse['rows'][number]

export interface SkillDriftMatrixProps {
  data: SkillDriftResponse
  scope: SkillDriftScope
}

export function SkillDriftMatrix({
  data,
  scope,
}: SkillDriftMatrixProps): React.JSX.Element {
  if (data.rows.length === 0) {
    return (
      <EmptyState
        title="No skills detected"
        body="No SKILL.md files were found in any registered project's .claude/skills/ directory."
      />
    )
  }

  if (scope === 'cross') {
    const sortedProjects = [...data.projects].sort((a, b) =>
      a.projectId < b.projectId ? -1 : a.projectId > b.projectId ? 1 : 0,
    )
    return (
      <SkillDriftFlatBlock rows={data.rows} projects={sortedProjects} />
    )
  }

  // scope === 'family' — four-family fixed iteration order; hide empty families.
  return (
    <div className="flex flex-col gap-4">
      {FAMILIES.map((family) => {
        const familyProjects = data.projects.filter((p) => p.family === family)
        if (familyProjects.length === 0) return null
        return (
          <SkillDriftFamilySection
            key={family}
            family={family}
            rows={data.rows}
            projects={familyProjects}
          />
        )
      })}
    </div>
  )
}

// ── Family section ───────────────────────────────────────────────────────────

interface SkillDriftFamilySectionProps {
  family: Family
  rows: ReadonlyArray<Row>
  projects: ReadonlyArray<Project>
}

function SkillDriftFamilySection({
  family,
  rows,
  projects,
}: SkillDriftFamilySectionProps): React.JSX.Element {
  return (
    <section
      className="rounded-card bg-card-bg shadow-card"
      aria-label={`${family} family skill drift`}
    >
      <header className="px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-primary">{family}</span>
          <span className="text-text-tertiary text-sm">
            · {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </span>
        </div>
      </header>
      <SkillDriftTable rows={rows} projects={projects} />
    </section>
  )
}

// ── Cross-family flat block ──────────────────────────────────────────────────

interface SkillDriftFlatBlockProps {
  rows: ReadonlyArray<Row>
  projects: ReadonlyArray<Project>
}

function SkillDriftFlatBlock({
  rows,
  projects,
}: SkillDriftFlatBlockProps): React.JSX.Element {
  return (
    <section
      className="rounded-card bg-card-bg shadow-card"
      aria-label="Cross-family skill drift"
    >
      <SkillDriftTable rows={rows} projects={projects} />
    </section>
  )
}

// ── Shared table (rows × columns) ────────────────────────────────────────────

interface SkillDriftTableProps {
  rows: ReadonlyArray<Row>
  projects: ReadonlyArray<Project>
}

function SkillDriftTable({
  rows,
  projects,
}: SkillDriftTableProps): React.JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="text-xs text-text-tertiary border-b border-border-subtle">
            <th scope="col" className="py-2 pr-3 px-4 font-medium">
              Skill
            </th>
            {projects.map((p) => (
              <th
                key={p.projectId}
                scope="col"
                data-testid="project-col"
                data-project-id={p.projectId}
                className="px-2 py-2 font-medium"
              >
                {p.projectName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <SkillDriftRow key={row.skillId} row={row} projects={projects} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Single skill row ─────────────────────────────────────────────────────────

interface SkillDriftRowProps {
  row: Row
  projects: ReadonlyArray<Project>
}

function SkillDriftRow({ row, projects }: SkillDriftRowProps): React.JSX.Element {
  const linter = useAgentLinterDrift()

  return (
    <tr>
      <th scope="row" className="py-2 pr-3 px-4 font-medium text-sm text-text-primary">
        {row.skillId}
      </th>
      {projects.map((p) => {
        const cell: SkillDriftCellData = row.byProject[p.projectId] ?? {
          present: false,
          version: null,
          lastModifiedIso: null,
        }
        return (
          <td key={p.projectId} className="px-2 py-2 align-middle">
            <div className="flex items-center gap-2">
              <SkillDriftCell
                cell={cell}
                skillId={row.skillId}
                projectName={p.projectName}
              />
              <button
                type="button"
                aria-label={`Run AgentLinter for ${p.projectName}`}
                onClick={() => linter.mutate({ projectId: p.projectId })}
                className="text-text-tertiary hover:text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                <Play size={12} aria-hidden="true" />
              </button>
            </div>
          </td>
        )
      })}
    </tr>
  )
}
