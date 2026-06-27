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

/**
 * D-14-10: single source of truth for the /understand invocation.
 *
 * Returns both:
 * - `string`: human-readable form for clipboard / copy-pill UIs (SPA CoveragePage).
 * - `argv`:   argv form (without leading binary) reserved for the deferred
 *             daemon-scan phase (Phase 15) where the daemon headlessly invokes
 *             `claude argv` inside the repo directory.
 *
 * The `cd` string interpolates family/repo paths; the argv is constant
 * (['/understand']) with no user input interpolated (T-14-01-03 accepted).
 */
export interface UnderstandCommand {
  /** Human-readable form for clipboard / copy-pill UIs. */
  readonly string: string
  /** argv form (without leading binary) for future headless daemon invocation. */
  readonly argv: readonly string[]
}

/**
 * Phase 14 review Bundle B-4: conservative slug charset for the two segments
 * interpolated into the shell string — same charset as the daemon's
 * REPO_TARGET_RE (D-13-EXT-11). Must start with [a-z0-9]; no spaces, no shell
 * metacharacters, no leading dots (blocks `..` traversal segments).
 */
const UNDERSTAND_TARGET_SEGMENT_RE = /^[a-z0-9][a-z0-9\-_.]*$/

export function buildUnderstandCommand(family: string, repo: string): UnderstandCommand {
  // The SPA only calls this with daemon-validated coverage rows; a
  // non-conforming segment means corrupted input — failing loudly beats
  // emitting an injectable shell string onto the user's clipboard.
  if (!UNDERSTAND_TARGET_SEGMENT_RE.test(family) || !UNDERSTAND_TARGET_SEGMENT_RE.test(repo)) {
    throw new TypeError(
      `buildUnderstandCommand: family/repo must match ${String(UNDERSTAND_TARGET_SEGMENT_RE)}; ` +
        `got family=${JSON.stringify(family)} repo=${JSON.stringify(repo)}`,
    )
  }
  return {
    string: `cd ~/Sourcecode/${family}/${repo} && claude "/understand"`,
    argv: ['/understand'],
  } as const
}
