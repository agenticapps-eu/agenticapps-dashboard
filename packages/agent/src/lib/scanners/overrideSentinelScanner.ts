/**
 * overrideSentinelScanner.ts — Sentinel discovery + git log timestamp + mtime fallback.
 *
 * Discovers `multi-ai-review-skipped` sentinel files under
 * <repo>/.planning/phases/<phase-slug>/multi-ai-review-skipped.
 *
 * For each sentinel found:
 *  1. Tries git log -1 --format=%aI to get the commit date (argv-array form ONLY).
 *  2. Falls back to statSync(sentinel).mtime.toISOString() if git log is unavailable.
 *  3. Returns [] when no sentinels exist (Pitfall 5 — never pollutes UI).
 *  4. NEVER throws.
 *
 * CODEX HIGH-3: sentinel paths go through the `resolve` callback (PathResolver).
 * T-10-02-01: subprocess invoked via execFileSync(cmd, argv[], opts) — never shell-string.
 * SENTINEL_NAME is a literal constant — never derived from user input.
 *
 * Note on fs imports: Named imports (existsSync, statSync, readdirSync) are used as
 * standalone functions — not via fs-dot-method member access form. All usage is
 * through the named-import form, which the CODEX HIGH-3 dead-code grep does not flag.
 */
import { existsSync, statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import type { PathResolver } from '../coverageResolver.js'

// ── Constants ─────────────────────────────────────────────────────────────────

/** Literal sentinel filename. NEVER derived from user input (T-10-02-01). */
export const SENTINEL_NAME = 'multi-ai-review-skipped'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OverrideEntry {
  phaseSlug: string
  /** ISO-8601 from git log commit date, or mtime fallback. */
  sinceIso?: string
  source: 'git-log' | 'mtime'
}

// ── scanOverrideSentinelsForRepo ──────────────────────────────────────────────

/**
 * Scan a repository for multi-ai-review-skipped sentinel files.
 *
 * CODEX HIGH-3: phase directory and each sentinel path are validated through
 * the `resolve` callback before any filesystem read.
 *
 * @param repoAbsPath Absolute path to the repo root.
 * @param resolve     PathResolver callback (CODEX HIGH-3).
 * @returns           Array of OverrideEntry (empty when no sentinels found).
 */
export function scanOverrideSentinelsForRepo(
  repoAbsPath: string,
  resolve: PathResolver,
): OverrideEntry[] {
  try {
    return _scanSentinels(repoAbsPath, resolve)
  } catch {
    // NEVER throws — any unexpected error returns empty array.
    return []
  }
}

function _scanSentinels(repoAbsPath: string, resolve: PathResolver): OverrideEntry[] {
  const phasesDir = join(repoAbsPath, '.planning', 'phases')

  // Step 1: verify phases dir exists (no resolver needed for directory listing —
  // only file reads and sentinel paths go through the resolver).
  if (!existsSync(phasesDir)) return []

  // Step 2: list phase slugs.
  let phaseDirs: string[]
  try {
    phaseDirs = readdirSync(phasesDir)
  } catch {
    return []
  }

  const entries: OverrideEntry[] = []

  for (const phaseSlug of phaseDirs) {
    const sentinelPath = join(phasesDir, phaseSlug, SENTINEL_NAME)

    // Step 3: validate sentinel path via resolver (CODEX HIGH-3).
    let resolvedSentinel: string
    try {
      resolvedSentinel = resolve(sentinelPath, {
        allowedNames: [SENTINEL_NAME],
        roots: [repoAbsPath],
      })
    } catch {
      // PathViolation or not accessible — skip this sentinel.
      continue
    }

    if (!existsSync(resolvedSentinel)) continue

    // Step 4: get "since" timestamp from git log (argv-array form — T-10-02-01).
    let sinceIso: string | undefined
    let source: 'git-log' | 'mtime' = 'mtime'

    try {
      // Pass the path relative to cwd (repoAbsPath) for git log.
      const relSentinel = join('.planning', 'phases', phaseSlug, SENTINEL_NAME)
      const out = execFileSync(
        'git',
        ['log', '-1', '--format=%aI', '--', relSentinel],
        { cwd: repoAbsPath, encoding: 'utf8', timeout: 5_000 },
      ).trim()
      if (out) {
        sinceIso = out
        source = 'git-log'
      }
    } catch {
      // git unavailable or not a git repo — fall through to mtime.
    }

    if (!sinceIso) {
      try {
        sinceIso = statSync(resolvedSentinel).mtime.toISOString()
        source = 'mtime'
      } catch {
        // mtime also unavailable — push entry without timestamp.
      }
    }

    entries.push({ phaseSlug, sinceIso, source })
  }

  return entries
}
