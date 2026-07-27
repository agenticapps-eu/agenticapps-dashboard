/**
 * Pure-function reader that composes a ProjectOverview from a registered project's
 * filesystem artefacts (.git, .claude/skills).
 *
 * The `.planning/phases/` half of this reader is retired: the GSD phase engine
 * has been replaced by OpenSpec, and progress is now read by openspecReader.ts.
 * What remains here is only what git and the project root can still answer —
 * TDD pair counts, the branch, and marker presence.
 *
 * Read-only invariant: this module never writes to the project filesystem (INV-01).
 * All path construction uses join() over a canonical root that was already vetted
 * by assertRegistrationAllowed at registration time (T-03-01-05).
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { execa } from 'execa'
import { ProjectOverviewSchema, type ProjectOverview } from '@agenticapps/dashboard-shared'

import { GIT_SUBPROCESS_TIMEOUT_MS } from '../constants.js'

// ── Marker detection ──────────────────────────────────────────────────────────

/**
 * Detect which workflow markers are present in the project root (D-30).
 */
export function detectMarkers(root: string): {
  gitRepo: boolean
  planning: boolean
  claudeSkills: boolean
} {
  return {
    gitRepo: existsSync(join(root, '.git')),
    planning: existsSync(join(root, '.planning')),
    claudeSkills: existsSync(join(root, '.claude', 'skills')),
  }
}

// ── TDD pair counting ─────────────────────────────────────────────────────────

/**
 * Count RED/GREEN commit pairs in the git log of the project root.
 * Uses execa argv-array form (no shell injection); 5s timeout (T-03-01-06).
 */
export async function parseTddPairs(
  root: string
): Promise<{ greenPairs: number; totalTasks: number }> {
  const result = await execa('git', ['log', '--format=%s', '--no-merges'], {
    cwd: root,
    timeout: GIT_SUBPROCESS_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'ignore'],
    reject: false,
  })
  if (result.failed || !result.stdout.trim()) {
    return { greenPairs: 0, totalTasks: 0 }
  }
  const stdout = result.stdout
  const totalTasks = (stdout.match(/\bRED\b/gi) ?? []).length
  const greenPairs = (stdout.match(/\bGREEN\b/gi) ?? []).length
  return { greenPairs, totalTasks }
}

// ── Branch detection ──────────────────────────────────────────────────────────

/**
 * Return the current branch name or null on error/detached HEAD.
 * Uses execa argv-array form (T-03-01-06).
 */
export async function detectBranch(root: string): Promise<string | null> {
  const result = await execa('git', ['symbolic-ref', '--short', 'HEAD'], {
    cwd: root,
    timeout: GIT_SUBPROCESS_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'ignore'],
    reject: false,
  })
  const trimmed = result.stdout.trim()
  return trimmed || null
}

// ── Top-level reader ──────────────────────────────────────────────────────────

/**
 * Compose a ProjectOverview for the given registered project root.
 * Validates output against ProjectOverviewSchema (defense-in-depth: route returns
 * schema_drift via outbound() if this throws — D-07).
 */
export async function readOverview(root: string): Promise<ProjectOverview> {
  const markers = detectMarkers(root)

  // Parallel async reads
  const [tdd, branch] = await Promise.all([parseTddPairs(root), detectBranch(root)])

  const overview: ProjectOverview = { tdd, branch, markers }

  // Defense-in-depth: validate before returning so route can surface schema_drift (D-07)
  return ProjectOverviewSchema.parse(overview)
}
