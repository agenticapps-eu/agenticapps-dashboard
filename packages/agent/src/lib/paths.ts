import { realpath } from 'node:fs/promises'
import { resolve, isAbsolute, sep, basename, join } from 'node:path'
import { homedir } from 'node:os'

import { ALLOWED_SUBDIRS } from '@agenticapps/dashboard-shared'

/**
 * Re-exported, not declared. The list itself now lives in shared so a client can
 * tell what this route will accept before offering to open a file; this module
 * remains the only place it is enforced.
 *
 * Why each entry stays:
 *
 * `.planning` stays after the GSD phase reader is retired and is load-bearing,
 * not residual. Two distinct readers keep it alive, and they read *different*
 * subtrees:
 *   - `.planning/skill-observations/` — phaseDetail.ts, reached by
 *     routes/commitment.ts, routes/observations.ts and routes/discipline.ts.
 *   - `.planning/phases/<slug>/multi-ai-review-skipped` — the override-sentinel
 *     scanner, which serves `fleet-coverage`'s Review-Override Visibility.
 * Relocate both before removing this entry.
 *
 * What stopped being read is the phase *artifacts* under `.planning/phases/` —
 * the plans, reviews and verification files. The directory itself is still read,
 * for the sentinel above. `.planning/config.json` is project-side workflow
 * config; no daemon code path reads it.
 *
 * `docs/legacy-planning` is deliberately absent — allow-listing `docs/` to reach
 * relocated GSD history would expose unrelated content, and that history is
 * archived under `openspec/changes/archive/` anyway.
 */
export { ALLOWED_SUBDIRS }

export class PathViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathViolation'
  }
}

/**
 * Whether an already-realpath'd containment boundary still lies at, or under,
 * an already-realpath'd repository root.
 *
 * PRECONDITION — both arguments MUST be canonical realpaths, obtained from
 * `realpath`/`realpathSync` on the same machine. This is pure string work and
 * verifies nothing itself: it cannot tell a canonical path from a lexically
 * normalised one, so passing an unresolved path silently weakens every caller.
 * Callers that cannot resolve a root must refuse, not pass what they have.
 *
 * Two consequences of that precondition:
 *  - The `+ sep` guard is only sound on a canonical root — it is what stops
 *    `/a/rootster` from counting as being under `/a/root`.
 *  - Comparison is exact and case-sensitive. On a case-insensitive volume
 *    (APFS by default) two spellings of one path are the same file but not the
 *    same string; `realpath` returns the on-disk spelling, which is why both
 *    sides must come from it rather than from user input.
 *
 * Shared with the synchronous resolver in coverageResolver.ts so the rule has
 * one implementation rather than one per resolver.
 *
 * See openspec/specs/filesystem-access-policy —
 * "A Containment Anchor Is Verified Against Its Registered Root".
 */
export function isAnchoredUnder(realBoundary: string, realRoot: string): boolean {
  return realBoundary === realRoot || realBoundary.startsWith(realRoot + sep)
}

/**
 * Resolve a relative path under a project root, asserting it stays within one of
 * ALLOWED_SUBDIRS. Defends against:
 *  - Absolute paths (isAbsolute check)
 *  - Path traversal via '..' components (pre-check before realpath)
 *  - Planted symlinks escaping allowed roots (realpath follow + prefix check)
 *  - Paths outside the allow-listed subdirs (e.g. .git/HEAD)
 *
 * See CONTEXT.md D-23.
 */
export async function resolveAllowed(
  projectRoot: string,
  relativePath: string,
): Promise<string> {
  if (isAbsolute(relativePath)) {
    throw new PathViolation('absolute path not allowed')
  }

  // Pre-check: reject any '..' path component before realpath
  const parts = relativePath.split(/[/\\]/)
  if (parts.some((p) => p === '..')) {
    throw new PathViolation('path traversal not allowed')
  }

  const candidate = resolve(projectRoot, relativePath)

  // realpath resolves symlinks — catches planted symlinks escaping allowed roots.
  // Also realpath the allowedRoots so that macOS /var -> /private/var doesn't
  // cause false negatives when the project root is under /tmp or /var.
  let real: string
  try {
    real = await realpath(candidate)
  } catch {
    throw new PathViolation('path does not exist or is not accessible')
  }

  // The registered root and the allow-listed roots, resolved together. The
  // project root shares this Promise.all rather than being awaited before it so
  // the anchor costs no extra round trip per read — every read already waits on
  // the allow-listed roots, and this rides along with them.
  const [realProjectRoot, ...allowedRoots] = await Promise.all([
    realpath(projectRoot).catch(() => null),
    // Build realpath-resolved allowed roots for accurate prefix matching
    ...ALLOWED_SUBDIRS.map(async (d) => {
      try {
        return await realpath(resolve(projectRoot, d))
      } catch {
        return resolve(projectRoot, d)
      }
    }),
  ])

  if (realProjectRoot === null) {
    throw new PathViolation('project root does not exist or is not accessible')
  }

  // Drop any allow-listed root that has itself left the project — an entry that
  // is a symlink out of the root would otherwise become the boundary, and every
  // per-path check below would pass against it. Dropping rather than throwing
  // keeps the remaining entries usable; a path reachable only through the
  // escaped one then falls through to the refusal below.
  const anchoredRoots = allowedRoots.filter((root) => isAnchoredUnder(root, realProjectRoot))

  const isAllowed = anchoredRoots.some((root) => isAnchoredUnder(real, root))
  if (!isAllowed) {
    throw new PathViolation('path outside allowed directories')
  }

  return real
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveAllowedNamed — name-restricted variant per D-5-13
// Used for top-level metadata reads (package.json, .infisical.json, .sentryclirc)
// and CI YAML files (.github/workflows/*.yml).
// The existing resolveAllowed / ALLOWED_SUBDIRS are UNTOUCHED.
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolveAllowedNamedOpts {
  /** Allowed root directories (each will be realpath'd). */
  roots: string[]
  /** Permitted basenames. Mutually exclusive with extension. */
  allowedNames?: string[]
  /** Permitted file extension (e.g. '.yml'). Mutually exclusive with allowedNames. */
  extension?: string
  /**
   * The registered root any derived entry in `roots` must still lie under.
   *
   * Pass this whenever a root is DERIVED from a path inside a repository —
   * `<repo>/.claude/skills`, `<repo>/.github/workflows` — rather than being the
   * repository root itself. Roots that have left `anchorTo` are dropped before
   * the containment check, so a symlinked directory cannot become the boundary.
   *
   * Roots are alternatives, so an escaped root only ever widens what is
   * admitted: pairing one with a correctly-anchored root does not mitigate it.
   * Omitting `anchorTo` preserves the previous behaviour exactly.
   */
  anchorTo?: string
}

/**
 * Resolve an absolute candidate path asserting:
 *  1. Its realpath falls under one of opts.roots (prevents symlink escape + traversal).
 *  2. Its basename is in opts.allowedNames OR ends with opts.extension.
 *
 * opts.allowedNames and opts.extension are mutually exclusive — providing both throws PathViolation.
 * Providing neither also throws PathViolation.
 *
 * Callers pass absolute paths (e.g. join(projectRoot, 'package.json')) — they are NOT
 * user-supplied path segments and therefore absolute-path rejection does not apply here.
 */
export async function resolveAllowedNamed(
  candidatePath: string,
  opts: ResolveAllowedNamedOpts,
): Promise<string> {
  if (opts.allowedNames && opts.extension) {
    throw new PathViolation('opts.allowedNames and opts.extension are mutually exclusive')
  }
  if (!opts.allowedNames && !opts.extension) {
    throw new PathViolation('one of opts.allowedNames or opts.extension is required')
  }

  let real: string
  try {
    real = await realpath(candidatePath)
  } catch {
    throw new PathViolation('not accessible')
  }

  // `resolved` is null when the root could not be realpath'd. The distinction
  // matters: an anchored call may only compare canonical paths (isAnchoredUnder's
  // precondition), so it drops unresolved roots rather than falling back to the
  // lexical form. Unanchored calls keep the original fallback exactly.
  const realRoots = await Promise.all(
    opts.roots.map(async (r) => {
      try {
        return { resolved: await realpath(r), lexical: resolve(r) }
      } catch {
        return { resolved: null, lexical: resolve(r) }
      }
    }),
  )

  // Anchor check: a root derived from inside a repository is only usable while
  // it is still inside that repository. See ResolveAllowedNamedOpts.anchorTo.
  let candidateRoots = realRoots.map(({ resolved, lexical }) => resolved ?? lexical)
  if (opts.anchorTo !== undefined) {
    let realAnchor: string
    try {
      realAnchor = await realpath(opts.anchorTo)
    } catch {
      throw new PathViolation('anchor root not accessible')
    }
    candidateRoots = realRoots
      .map(({ resolved }) => resolved)
      .filter((root): root is string => root !== null && isAnchoredUnder(root, realAnchor))
    if (candidateRoots.length === 0) {
      throw new PathViolation('no allowed root remains anchored to its registered root')
    }
  }

  const inRoot = candidateRoots.some((root) => isAnchoredUnder(real, root))
  if (!inRoot) throw new PathViolation('outside allowed roots')

  const name = basename(real)
  if (opts.allowedNames && !opts.allowedNames.includes(name)) {
    throw new PathViolation(`name not in allow-list: ${name}`)
  }
  if (opts.extension && !name.endsWith(opts.extension)) {
    throw new PathViolation(`extension not allowed: ${name}`)
  }

  return real
}

// ─────────────────────────────────────────────────────────────────────────────
// COVERAGE_ROOTS — Phase 10 D-10-NEW (extends D-5-13 pattern)
// Cross-family read roots for the /coverage page. Daemon-side scanners only —
// these are NEVER reachable via /api/projects/:id/read (INV-01 preserved).
// personal/, shared/, archive/ are explicitly excluded (D-10-05 lock).
// ─────────────────────────────────────────────────────────────────────────────

export const COVERAGE_ROOTS = {
  agenticapps: (): string => join(homedir(), 'Sourcecode', 'agenticapps'),
  factiv: (): string => join(homedir(), 'Sourcecode', 'factiv'),
  neuroflash: (): string => join(homedir(), 'Sourcecode', 'neuroflash'),
} as const
