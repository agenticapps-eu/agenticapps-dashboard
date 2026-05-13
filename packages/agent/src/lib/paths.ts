import { realpath } from 'node:fs/promises'
import { resolve, isAbsolute, sep, basename, join } from 'node:path'
import { homedir } from 'node:os'

export const ALLOWED_SUBDIRS = ['.planning', '.claude'] as const

export class PathViolation extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PathViolation'
  }
}

/**
 * Resolve a relative path under a project root, asserting it stays within
 * .planning/ or .claude/. Defends against:
 *  - Absolute paths (isAbsolute check)
 *  - Path traversal via '..' components (pre-check before realpath)
 *  - Planted symlinks escaping allowed roots (realpath follow + prefix check)
 *  - Paths outside .planning or .claude (e.g. .git/HEAD)
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

  // Build realpath-resolved allowed roots for accurate prefix matching
  const allowedRoots = await Promise.all(
    ALLOWED_SUBDIRS.map(async (d) => {
      try {
        return await realpath(resolve(projectRoot, d))
      } catch {
        return resolve(projectRoot, d)
      }
    }),
  )

  const isAllowed = allowedRoots.some(
    (root) => real === root || real.startsWith(root + sep),
  )
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

  const realRoots = await Promise.all(
    opts.roots.map(async (r) => {
      try {
        return await realpath(r)
      } catch {
        return resolve(r)
      }
    }),
  )

  const inRoot = realRoots.some((root) => real === root || real.startsWith(root + sep))
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
  gitnexus: (): string => join(homedir(), '.gitnexus'),
  agenticapps: (): string => join(homedir(), 'Sourcecode', 'agenticapps'),
  factiv: (): string => join(homedir(), 'Sourcecode', 'factiv'),
  neuroflash: (): string => join(homedir(), 'Sourcecode', 'neuroflash'),
} as const
