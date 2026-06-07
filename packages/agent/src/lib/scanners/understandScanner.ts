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
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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
 * Read the current HEAD SHA for a repo using pure FS reads (no subprocess).
 *
 * Reads .git/HEAD:
 *   - If it starts with "ref: ", resolve the branch ref file or packed-refs fallback.
 *   - Otherwise (detached HEAD) return the raw content trimmed as the SHA.
 *
 * Returns null on any I/O error or if .git is absent.
 */
export function readRepoHeadSha(repoRoot: string): string | null {
  try {
    const headPath = join(repoRoot, '.git', 'HEAD')
    if (!existsSync(headPath)) return null

    const headContent = readFileSync(headPath, 'utf-8').trim()

    // Detached HEAD: raw SHA in the HEAD file
    if (!headContent.startsWith('ref: ')) {
      return headContent || null
    }

    // Ref form: resolve the branch ref
    const refPath = headContent.slice(5).trim()  // e.g. 'refs/heads/main'
    const refFile = join(repoRoot, '.git', refPath)
    if (existsSync(refFile)) {
      return readFileSync(refFile, 'utf-8').trim() || null
    }

    // packed-refs fallback
    const packedRefsPath = join(repoRoot, '.git', 'packed-refs')
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
