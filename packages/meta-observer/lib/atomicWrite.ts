import { mkdir, writeFile, rename, realpath } from 'node:fs/promises'
import { isAbsolute, dirname, sep } from 'node:path'

/**
 * Thrown when atomicWrite detects a path traversal or sandbox escape attempt.
 * Mirrors the `PathViolation` class pattern from `packages/agent/src/lib/paths.ts`.
 */
export class PathViolation extends Error {
  override name = 'PathViolation'

  constructor(message: string) {
    super(message)
  }
}

export interface AtomicWriteOptions {
  /**
   * Sandbox root: the target file's parent directory (after realpath resolution)
   * must be equal to sandboxRoot or a subdirectory of it.
   * Required — callers must always specify the sandbox to prevent path-escape bugs.
   */
  sandboxRoot: string
}

/**
 * Write `contents` to `targetPath` atomically using .tmp + rename.
 *
 * Steps:
 * 1. Validate targetPath is absolute.
 * 2. Reject any path segments containing `..`.
 * 3. Resolve sandboxRoot via realpath.
 * 4. Create parent directories recursively.
 * 5. Resolve parent directory via realpath to detect symlink escapes.
 * 6. Verify the resolved parent is within sandboxRoot.
 * 7. Write to `<targetPath>.tmp` then rename atomically.
 *
 * POSIX rename is atomic on the same filesystem, so concurrent readers see
 * either the previous file or the complete new file — never a partial write.
 *
 * T-05-01-Meta-Write-Path + T-05-01-Meta-AtomicWrite mitigations.
 */
export async function atomicWrite(
  targetPath: string,
  contents: string,
  opts: AtomicWriteOptions
): Promise<void> {
  if (!isAbsolute(targetPath)) {
    throw new PathViolation('targetPath must be absolute')
  }

  const segments = targetPath.split(sep)
  if (segments.includes('..')) {
    throw new PathViolation('path traversal not allowed: targetPath contains ".."')
  }

  // First-fire bootstrap: create sandboxRoot if it doesn't exist, so realpath resolves
  // even on the very first SessionEnd hook fire in a fresh project.
  await mkdir(opts.sandboxRoot, { recursive: true })
  const sandboxReal = await realpath(opts.sandboxRoot)

  const parentDir = dirname(targetPath)
  await mkdir(parentDir, { recursive: true })

  const parentReal = await realpath(parentDir)

  if (parentReal !== sandboxReal && !parentReal.startsWith(sandboxReal + sep)) {
    throw new PathViolation(
      `target outside sandbox root: resolved parent "${parentReal}" is not under "${sandboxReal}"`
    )
  }

  const tmp = targetPath + '.tmp'
  await writeFile(tmp, contents, { encoding: 'utf8', mode: 0o644 })
  await rename(tmp, targetPath)
}
