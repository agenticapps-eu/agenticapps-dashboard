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
 * (gitnexus home, 3 family roots, migrations dir). Mirrors the async `resolveAllowedNamed`
 * semantics from paths.ts but is sync so it can be used inside synchronous scanner code.
 *
 * Security: mirrors resolveAllowedNamed's realpath + root-prefix + basename-whitelist model.
 * Ref: CODEX HIGH-3, COV-02, INV-01.
 */
import { realpathSync } from 'node:fs'
import { resolve as pathResolve, sep, basename, join } from 'node:path'
import { homedir } from 'node:os'

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
  opts: { allowedNames?: string[]; extension?: string; roots: string[] },
) => string

// ── CoverageResolverOptions ───────────────────────────────────────────────────

export interface CoverageResolverOptions {
  /** Override for ~/Sourcecode root (tests only). Default: homedir()+'/Sourcecode'. */
  sourcecodeRoot?: string
  /** Override for ~/.gitnexus home (tests only). Default: homedir()+'/.gitnexus'. */
  gitnexusHome?: string
  /** Override for migrations directory (tests only). */
  migrationsDir?: string
}

// ── makeCoverageResolver ──────────────────────────────────────────────────────

/**
 * Produce a synchronous PathResolver bound to Phase 10's allowed roots:
 *  - ~/.gitnexus (gitnexus registry)
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
  const gitnexusHome = opts.gitnexusHome ?? join(homedir(), '.gitnexus')
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
    gitnexusHome,
    join(sourcecodeRoot, 'agenticapps'),
    join(sourcecodeRoot, 'factiv'),
    join(sourcecodeRoot, 'neuroflash'),
    migrationsDir,
  ].map(realpathSafe)

  return (
    candidatePath: string,
    resolverOpts: { allowedNames?: string[]; extension?: string; roots: string[] },
  ): string => {
    // Validate mutual exclusivity of allowedNames + extension
    if (resolverOpts.allowedNames && resolverOpts.extension) {
      throw new PathViolation('opts.allowedNames and opts.extension are mutually exclusive')
    }
    // Require at least one of allowedNames or extension (mirrors resolveAllowedNamed contract)
    if (!resolverOpts.allowedNames && !resolverOpts.extension) {
      throw new PathViolation('one of opts.allowedNames or opts.extension is required')
    }

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
    const callerRoots = resolverOpts.roots.map(realpathSafe)
    const mergedRoots = [...allowedRoots, ...callerRoots]

    // Assert real path falls under one of the allowed roots
    const inRoot = mergedRoots.some(
      (root) => real === root || real.startsWith(root + sep),
    )
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
