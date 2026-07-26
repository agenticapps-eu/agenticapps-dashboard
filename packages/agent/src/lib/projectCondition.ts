/**
 * Per-Project Computed Status — project-registry.
 *
 * Three conditions describe a reachable project, because they call for
 * different user action and collapsing them produces a card that tells someone
 * to install what they already have:
 *
 *   openspec/ present              -> migrated
 *   workflow skill, no openspec/   -> needs-migration
 *   neither                        -> no-workflow
 *
 * Reachability takes precedence over all three. An unreachable root reads as
 * both markers absent, so without this an unmounted volume or a moved directory
 * renders as no-workflow — an install hint for a path the daemon cannot see.
 */
import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

import type { ProjectCondition } from '@agenticapps/dashboard-shared'

/** `.claude/skills/agentic-apps-workflow/SKILL.md` — the workflow-skill marker. */
export function hasWorkflowSkill(root: string): boolean {
  return existsSync(join(root, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md'))
}

/** An `openspec/` directory — the marker that means the project is readable. */
function isDirectory(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

export function hasOpenspec(root: string): boolean {
  // Must be a directory. `existsSync` is true for a regular file or a socket
  // named `openspec`, which would report the project as migrated and then find
  // no changes and no capabilities in it — suppressing the migration notice
  // that would have explained the emptiness.
  return isDirectory(join(root, 'openspec'))
}

export function computeProjectCondition(root: string, reachable: boolean): ProjectCondition {
  if (!reachable) return 'unreachable'
  // openspec/ wins over a lingering .planning tree: a mid-migration project is
  // migrated, and nothing is read from .planning/phases/.
  if (hasOpenspec(root)) return 'migrated'
  if (hasWorkflowSkill(root)) return 'needs-migration'
  return 'no-workflow'
}
