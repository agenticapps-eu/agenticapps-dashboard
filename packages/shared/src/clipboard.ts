// Clipboard-string builders for D-10-09 SPA-side actions.
// Reused by SPA (CoveragePage) and asserted in daemon tests (coverageSpawn.test.ts).
// Daemon NEVER spawns these; the strings are user-pasted into a terminal.

import type { CoverageFamily } from './schemas/coverage.js'

/** D-10-09 wiki refresh clipboard string. */
export function buildWikiCompileClipboardString(family: CoverageFamily): string {
  return `cd ~/Sourcecode/${family} && claude /wiki-compile`
}

/** D-10-09 workflow-update clipboard string. */
export function buildWorkflowUpdateClipboardString(): string {
  return 'claude /update-agenticapps-workflow'
}

/** D-10-09 CLAUDE.md authoring — opens help doc (deep link, not clipboard). */
export function buildClaudeMdHelpUrl(): string {
  return '/help/operations/install#claude-md-bootstrap'
}

/** COV-10 install hint clipboard string. */
export function buildGitnexusInstallClipboardString(): string {
  return 'npm install -g gitnexus'
}

/**
 * D-13-10: single source of truth for the gitnexus invocation.
 *
 * Returns both:
 * - `string`: human-readable form for clipboard / install hint UIs.
 * - `argv`:   argv form (without leading binary) for `execa('gitnexus', argv, ...)`.
 *
 * Both daemon spawn sites (coverageSpawn.spawnGitNexusAnalyze and the test-override
 * path in gitnexusScan._spawnWithBinOverride) consume `argv` directly so any
 * future invocation change lands in one place. The `string` form is reserved
 * for any SPA clipboard fallback the user surfaces in the future.
 */
export interface GitnexusIndexCommand {
  /** Human-readable form for clipboard / install hint UIs. */
  readonly string: string
  /** argv form (without leading binary) for `execa('gitnexus', argv, ...)`. */
  readonly argv: readonly string[]
}

export function buildGitnexusIndexClipboardString(): GitnexusIndexCommand {
  return { string: 'gitnexus analyze', argv: ['analyze'] } as const
}
