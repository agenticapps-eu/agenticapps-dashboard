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
 * 10.6: the "Index with GitNexus" clipboard string.
 *
 * Used when the binary is installed but `~/.gitnexus/registry.json` does not
 * exist yet. Running `gitnexus analyze` in any git repo creates the registry,
 * which transitions the page to the normal stale/fresh matrix.
 */
export function buildGitnexusIndexClipboardString(): string {
  return 'gitnexus analyze'
}
