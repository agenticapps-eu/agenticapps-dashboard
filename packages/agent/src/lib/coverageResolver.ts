/**
 * coverageResolver.ts — Synchronous PathResolver wrapper for Phase 10 scanner code.
 *
 * CODEX HIGH-3: Every scanner in packages/agent/src/lib/scanners/ reads external
 * filesystem paths through this helper ONLY. Direct fs readFile/stat/readdir/existsSync
 * calls inside scanner code are FORBIDDEN.
 *
 * `PathResolver` is the CANONICAL type declaration. All scanners import from here:
 *   import type { PathResolver } from '../coverageResolver.js'
 *
 * `makeCoverageResolver()` produces a sync resolver bound to Phase 10's allowed roots
 * (3 family roots and the migrations dir). Mirrors the async `resolveAllowedNamed`
 * semantics from paths.ts but is sync so it can be used inside synchronous scanner code.
 *
 * Security: mirrors resolveAllowedNamed's realpath + root-prefix + basename-whitelist model.
 * Ref: CODEX HIGH-3, COV-02, INV-01.
 */
import { realpathSync } from 'node:fs'
import { resolve as pathResolve, basename, join } from 'node:path'
import { homedir } from 'node:os'

import { isAnchoredUnder } from './paths.js'
import { anchorOf, malformedContainment, CONTAINMENT_CONFLICT } from './containment.js'
import type { Containment } from './containment.js'

// ── PathViolation ─────────────────────────────────────────────────────────────

export class PathViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathViolation'
  }
}

// ── PathResolver ──────────────────────────────────────────────────────────────

/**
 * CANONICAL declaration of the PathResolver type — the CODEX HIGH-3 contract.
 * All Phase 10 scanners accept a `resolve: PathResolver` callback argument and
 * route every external filesystem read through it.
 *
 * Contract:
 *  - candidatePath: absolute path to resolve and validate.
 *  - opts.roots: allowed root directories (each will be realpath-resolved before checking).
 *  - opts.allowedNames: permitted basenames (mutually exclusive with opts.extension).
 *  - opts.extension: permitted file extension (mutually exclusive with opts.allowedNames).
 *  - Returns the realpath-resolved, access-validated absolute path.
 *  - Throws PathViolation if the path escapes roots, or fails the name/extension check.
 */
export type PathResolver = (
  candidatePath: string,
  opts: {
    allowedNames?: string[]
    extension?: string
    roots: string[]
    /**
     * The registered root that any DERIVED entry in `roots` must still lie
     * under — pass it whenever a root is built from a path inside a repository
     * (`<repo>/.claude/skills`, `<repo>/.github/workflows`) rather than being
     * the repository root itself. Derived roots that have left it are dropped
     * before the containment check.
     *
     * Applies to caller-supplied roots only; the family roots this resolver is
     * bound to are a deliberate cross-family allowance and are never narrowed.
     *
     * @deprecated Superseded by `containment`. Supplying both is a PathViolation.
     */
    anchorTo?: string
    /**
     * What the supplied `roots` ARE. See `containment.ts`.
     *
     * Note what `repository-root` does NOT mean here: this resolver merges its
     * standing family roots on the unanchored branch, so declaring
     * `repository-root` leaves that reach in place. Only `anchored` confines.
     */
    containment?: Containment
  },
) => string

// ── CoverageResolverOptions ───────────────────────────────────────────────────

export interface CoverageResolverOptions {
  /** Override for ~/Sourcecode root (tests only). Default: homedir()+'/Sourcecode'. */
  sourcecodeRoot?: string
  /** Override for migrations directory (tests only). */
  migrationsDir?: string
}

// ── makeCoverageResolver ──────────────────────────────────────────────────────

/**
 * Produce a synchronous PathResolver bound to Phase 10's allowed roots:
 *  - ~/Sourcecode/agenticapps
 *  - ~/Sourcecode/factiv
 *  - ~/Sourcecode/neuroflash
 *  - ~/Sourcecode/agenticapps/claude-workflow/migrations (workflow head detection)
 *
 * The resolver realpath-checks candidatePath, asserts it falls under one of the
 * allowed roots, and checks the basename against allowedNames or extension.
 *
 * Returns a sync function suitable for use inside scanner code (which is synchronous).
 */
export function makeCoverageResolver(opts: CoverageResolverOptions = {}): PathResolver {
  const sourcecodeRoot = opts.sourcecodeRoot ?? join(homedir(), 'Sourcecode')
  const migrationsDir =
    opts.migrationsDir ?? join(sourcecodeRoot, 'agenticapps', 'claude-workflow', 'migrations')

  // Pre-compute realpath of each allowed root (best-effort; if root doesn't exist yet,
  // fallback to resolve() so that scanners that check existsSync first still work).
  const realpathSafe = (p: string): string => {
    try {
      return realpathSync(p)
    } catch {
      return pathResolve(p)
    }
  }

  const allowedRoots = [
    join(sourcecodeRoot, 'agenticapps'),
    join(sourcecodeRoot, 'factiv'),
    join(sourcecodeRoot, 'neuroflash'),
    migrationsDir,
  ].map(realpathSafe)

  return (
    candidatePath: string,
    resolverOpts: {
      allowedNames?: string[]
      extension?: string
      roots: string[]
      anchorTo?: string
      containment?: Containment
    },
  ): string => {
    // Validate mutual exclusivity of allowedNames + extension
    if (resolverOpts.allowedNames && resolverOpts.extension) {
      throw new PathViolation('opts.allowedNames and opts.extension are mutually exclusive')
    }
    // Require at least one of allowedNames or extension (mirrors resolveAllowedNamed contract)
    if (!resolverOpts.allowedNames && !resolverOpts.extension) {
      throw new PathViolation('one of opts.allowedNames or opts.extension is required')
    }
    if (resolverOpts.anchorTo !== undefined && resolverOpts.containment !== undefined) {
      throw new PathViolation(CONTAINMENT_CONFLICT)
    }
    if (resolverOpts.containment) {
      const malformed = malformedContainment(resolverOpts.containment)
      if (malformed) throw new PathViolation(malformed)
    }

    // Only `anchored` anchors. The unanchored variants reach the same branch an
    // undeclared call reaches — including the standing family roots merged below.
    const effectiveAnchor = resolverOpts.containment
      ? anchorOf(resolverOpts.containment)
      : resolverOpts.anchorTo

    // Resolve candidate to realpath
    let real: string
    try {
      real = realpathSync(candidatePath)
    } catch {
      throw new PathViolation(`not accessible: ${candidatePath}`)
    }

    // Merge caller-supplied roots with the module-level allowed roots.
    // Caller supplies roots for the specific scanner's context (e.g. repo root);
    // the module-level roots provide the broader allow-list for cross-family reads.
    let callerRoots = resolverOpts.roots.map(realpathSafe)
    // Which of those actually resolved. An anchored call may only compare
    // canonical paths — isAnchoredUnder's precondition — so it uses this list
    // and drops the rest, rather than comparing against a lexical fallback.
    const resolvedCallerRoots = resolverOpts.roots
      .map((r) => {
        try {
          return realpathSync(r)
        } catch {
          return null
        }
      })
      .filter((r): r is string => r !== null)

    // Anchor check. A root derived from inside a repository stops being a
    // usable boundary once it has left that repository.
    //
    // An anchored call is an assertion that this read stays inside the named
    // repository, so the module-level family roots do NOT apply to it. They are
    // the cross-family allowance from `Named Allowed Roots For Fleet Scanners`,
    // and leaving them in the candidate set would defeat the anchor whenever a
    // single root survived the filter and the target sat under a family root —
    // which is true of every repository in the fleet. Unanchored calls keep the
    // allowance untouched.
    let mergedRoots: string[]
    if (effectiveAnchor !== undefined) {
      // Fail closed, exactly as resolveAllowedNamed does. realpathSafe's lexical
      // fallback is fine for candidate roots — an unresolvable root simply fails
      // to match — but it is not safe for the anchor: comparing against a
      // lexically-normalised path admits reads through an anchor that was never
      // verified, which is the whole failure this change exists to prevent.
      let realAnchor: string
      try {
        realAnchor = realpathSync(effectiveAnchor)
      } catch {
        throw new PathViolation(`anchor root not accessible: ${effectiveAnchor}`)
      }
      callerRoots = resolvedCallerRoots.filter((root) => isAnchoredUnder(root, realAnchor))
      if (callerRoots.length === 0) {
        throw new PathViolation(
          `no allowed root remains anchored to its registered root: ${realAnchor}`,
        )
      }
      mergedRoots = callerRoots
    } else {
      mergedRoots = [...allowedRoots, ...callerRoots]
    }

    // Assert real path falls under one of the allowed roots
    const inRoot = mergedRoots.some((root) => isAnchoredUnder(real, root))
    if (!inRoot) {
      throw new PathViolation(`outside allowed roots: ${real}`)
    }

    // Basename check
    const name = basename(real)
    if (resolverOpts.allowedNames && !resolverOpts.allowedNames.includes(name)) {
      throw new PathViolation(`name not in allow-list: ${name}`)
    }
    if (resolverOpts.extension && !name.endsWith(resolverOpts.extension)) {
      throw new PathViolation(`extension not allowed: ${name}`)
    }

    return real
  }
}
