/**
 * SkillDriftCell — Per-(skill, project) matrix cell (Plan 11-05 Task 2 Step A).
 *
 * Purely presentational: rows = skills, columns = projects (D-11-04). This
 * cell sits at the intersection and renders presence + version drift.
 *
 * Three visual states:
 * - present + version: ✓ + version string
 * - present + version unknown: ✓ + dim "version unknown" placeholder
 * - absent: dim ✕
 *
 * Tokens (D-5.1-10 — NO hex literals):
 * - text-text-secondary: present cell foreground
 * - text-text-tertiary: dim "version unknown" + absent ✕
 *
 * Aria-label format: "<skillId> <state> <projectName>[, version <v>]" — read
 * by Sidebar/keyboard users in the dense matrix surface.
 */
import type { ReactElement } from 'react'
import type { SkillDriftCell as SkillDriftCellData } from '@agenticapps/dashboard-shared'

export interface SkillDriftCellProps {
  cell: SkillDriftCellData
  skillId: string
  projectName: string
}

export function SkillDriftCell({
  cell,
  skillId,
  projectName,
}: SkillDriftCellProps): ReactElement {
  if (!cell.present) {
    return (
      <span
        className="text-text-tertiary text-xs"
        aria-label={`${skillId} absent in ${projectName}`}
      >
        ✕
      </span>
    )
  }

  if (cell.version === null) {
    return (
      <span
        className="text-text-secondary text-xs"
        aria-label={`${skillId} present in ${projectName}, version unknown`}
      >
        ✓ <span className="text-text-tertiary">version unknown</span>
      </span>
    )
  }

  return (
    <span
      className="text-text-secondary text-xs"
      aria-label={`${skillId} present in ${projectName}, version ${cell.version}`}
    >
      ✓ {cell.version}
    </span>
  )
}
