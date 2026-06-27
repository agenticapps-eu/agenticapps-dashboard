/**
 * understandScanner.ts — Pure FS scanner for .understand-anything/meta.json.
 *
 * Plan 14-06 Task 1 (D-14-08 staleness semantics).
 *
 * SECURITY: Phase 10.6 "detection without execution" discipline — NO subprocess.
 * T-14-06-01 (DoS): all reads wrapped in try/catch; allSettled degraded-row isolation.
 *
 * Vocabulary is aligned with CoverageStateSchema wire enum:
 *   'fresh'   — meta.json gitCommitHash strictly equals the current HEAD SHA
 *   'stale'   — meta.json present but hash differs (or HEAD SHA is unavailable)
 *   'missing' — .understand-anything/meta.json absent or unparseable
 *
 * Note: this module does NOT use execa/execSync/spawn — zero subprocess.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UnderstandScanResult {
  /** D-14-08 three-state vocabulary matching CoverageStateSchema. */
  state: 'fresh' | 'stale' | 'missing'
  /** meta.json.lastAnalyzedAt ISO string. Present when state is fresh or stale. */
  lastAnalyzedAt?: string
  /** meta.json.gitCommitHash sliced to 7 chars. Present when state is fresh or stale. */
  analyzedCommit?: string
  /** meta.json.analyzedFiles count. Present when state is fresh or stale. */
  analyzedFiles?: number
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolve the gitdir + common dir for a repo root, handling both layouts:
 *   - .git is a DIRECTORY (normal clone): gitDir === commonDir === <root>/.git
 *   - .git is a FILE (linked worktree / submodule): contains 'gitdir: <path>'
 *     (absolute, or relative to repoRoot). The linked gitdir holds HEAD; refs
 *     and packed-refs live in the parent repo's common dir, reachable via the
 *     'commondir' pointer file inside the linked gitdir.
 *
 * Returns null when .git is absent or the pointer is malformed/dangling.
 */
function resolveGitDirs(repoRoot: string): { gitDir: string; commonDir: string } | null {
  const dotGit = join(repoRoot, '.git')
  let stat: ReturnType<typeof statSync>
  try {
    stat = statSync(dotGit)
  } catch {
    return null
  }

  let gitDir: string
  if (stat.isDirectory()) {
    gitDir = dotGit
  } else {
    // .git FILE: 'gitdir: <path>' (worktree/submodule pointer)
    const content = readFileSync(dotGit, 'utf-8').trim()
    if (!content.startsWith('gitdir:')) return null
    const pointer = content.slice('gitdir:'.length).trim()
    if (!pointer) return null
    gitDir = isAbsolute(pointer) ? pointer : resolve(repoRoot, pointer)
    if (!existsSync(gitDir)) return null
  }

  // 'commondir' file (present in linked worktree gitdirs) points at the parent
  // repo's .git dir — that is where refs/ and packed-refs live.
  let commonDir = gitDir
  const commondirFile = join(gitDir, 'commondir')
  if (existsSync(commondirFile)) {
    const pointer = readFileSync(commondirFile, 'utf-8').trim()
    if (pointer) {
      commonDir = isAbsolute(pointer) ? pointer : resolve(gitDir, pointer)
    }
  }

  return { gitDir, commonDir }
}

/**
 * Read the current HEAD SHA for a repo using pure FS reads (no subprocess).
 *
 * Supports normal clones (.git directory) AND linked worktrees/submodules
 * (.git FILE with a 'gitdir:' pointer). Reads <gitDir>/HEAD:
 *   - If it starts with "ref: ", resolve the branch ref file (checking the
 *     linked gitdir first, then the common dir) or packed-refs fallback in
 *     the common dir.
 *   - Otherwise (detached HEAD) return the raw content trimmed as the SHA.
 *
 * Returns null on any I/O error or if .git is absent.
 */
export function readRepoHeadSha(repoRoot: string): string | null {
  try {
    const dirs = resolveGitDirs(repoRoot)
    if (!dirs) return null
    const { gitDir, commonDir } = dirs

    const headPath = join(gitDir, 'HEAD')
    if (!existsSync(headPath)) return null

    const headContent = readFileSync(headPath, 'utf-8').trim()

    // Detached HEAD: raw SHA in the HEAD file
    if (!headContent.startsWith('ref: ')) {
      return headContent || null
    }

    // Ref form: resolve the branch ref. Loose refs may live in the linked
    // gitdir (e.g. refs/bisect) or, more commonly, in the common dir.
    const refPath = headContent.slice(5).trim()  // e.g. 'refs/heads/main'
    for (const base of gitDir === commonDir ? [gitDir] : [gitDir, commonDir]) {
      const refFile = join(base, refPath)
      if (existsSync(refFile)) {
        return readFileSync(refFile, 'utf-8').trim() || null
      }
    }

    // packed-refs fallback — always lives in the common dir
    const packedRefsPath = join(commonDir, 'packed-refs')
    if (existsSync(packedRefsPath)) {
      const packedContent = readFileSync(packedRefsPath, 'utf-8')
      for (const line of packedContent.split('\n')) {
        // Lines starting with '#' or '^' are comments/peel markers — skip
        if (!line || line.startsWith('#') || line.startsWith('^')) continue
        // Format: "<sha> <ref>"
        if (line.endsWith(` ${refPath}`)) {
          const sha = line.split(' ')[0]
          return sha || null
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Scan a repo's .understand-anything/meta.json against the current HEAD SHA
 * and return the 3-state understand status (D-14-08).
 *
 * @param repoRoot       Absolute path to the repo root.
 * @param currentHeadSha Full 40-char SHA from readRepoHeadSha(), or null if unavailable.
 *                       A null head SHA is treated conservatively as stale (cannot prove freshness).
 */
export function scanUnderstandForRepo(
  repoRoot: string,
  currentHeadSha: string | null,
): UnderstandScanResult {
  const metaPath = join(repoRoot, '.understand-anything', 'meta.json')

  if (!existsSync(metaPath)) {
    return { state: 'missing' }
  }

  try {
    const raw = readFileSync(metaPath, 'utf-8')
    const meta = JSON.parse(raw) as {
      lastAnalyzedAt?: string
      gitCommitHash?: string
      analyzedFiles?: number
    }

    // D-14-08: strict full-SHA equality required; null head ⇒ stale (conservative)
    const isFresh =
      currentHeadSha !== null &&
      typeof meta.gitCommitHash === 'string' &&
      meta.gitCommitHash.length > 0 &&
      meta.gitCommitHash === currentHeadSha

    return {
      state: isFresh ? 'fresh' : 'stale',
      ...(meta.lastAnalyzedAt !== undefined ? { lastAnalyzedAt: meta.lastAnalyzedAt } : {}),
      ...(meta.gitCommitHash !== undefined ? { analyzedCommit: meta.gitCommitHash.slice(0, 7) } : {}),
      ...(meta.analyzedFiles !== undefined ? { analyzedFiles: meta.analyzedFiles } : {}),
    }
  } catch {
    // T-14-06-01: malformed JSON → 'missing', never throws
    return { state: 'missing' }
  }
}
