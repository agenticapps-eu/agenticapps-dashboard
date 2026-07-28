// Clipboard-string builders for SPA-side actions.

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
