import { realpath } from 'node:fs/promises'
import { resolve, isAbsolute, sep } from 'node:path'

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
