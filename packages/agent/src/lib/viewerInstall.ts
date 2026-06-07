/**
 * viewerInstall.ts — Installed viewer + plugin-cache version detection (Plan 14-02, D-14-01/02).
 *
 * Pure stat/readdir — NO subprocess invocation. Phase 10.6 "detection without execution" pattern.
 * This file is the single source for install-state detection used by:
 *   - 14-05 viewer route: serving the viewer static files
 *   - 14-06 health route: coverage status per repo
 *   - 14-07 CLI installer
 *
 * Layout conventions:
 *   UNDERSTAND_VIEWER_DIR/   (~/.agenticapps/dashboard/understand-viewer/)
 *     <semver>/              e.g. 2.7.6/
 *       index.html           required — half-copied installs are NOT reported
 *
 *   UNDERSTAND_PLUGIN_CACHE/   (~/.claude/plugins/cache/understand-anything/understand-anything/)
 *     <semver>/              each installed plugin version
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import {
  UNDERSTAND_VIEWER_DIR,
  UNDERSTAND_PLUGIN_CACHE,
} from '../constants.js'

// ── Semver helpers ────────────────────────────────────────────────────────────

/** Pattern for a valid semver directory name: MAJOR.MINOR.PATCH */
const SEMVER_RE = /^\d+\.\d+\.\d+$/

/**
 * Compare two semver strings numerically (not lexicographically).
 * Returns positive if a > b, negative if a < b, 0 if equal.
 *
 * Numeric comparison is critical: '2.10.0' > '2.9.9' numerically
 * but '2.10.0' < '2.9.9' lexicographically.
 */
function compareSemver(a: string, b: string): number {
  const aParts = a.split('.').map(Number)
  const bParts = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Return sorted semver versions (descending — highest first) from a list
 * of directory names, filtering out non-semver names.
 */
function sortedSemverDirs(entries: string[]): string[] {
  return entries
    .filter((e) => SEMVER_RE.test(e))
    .sort((a, b) => compareSemver(b, a))  // descending: highest first
}

/**
 * Safely list directory entries. Returns [] on any I/O error.
 */
function safeDirEntries(dir: string): string[] {
  try {
    if (!existsSync(dir)) return []
    return readdirSync(dir)
  } catch {
    return []
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the highest semver version installed under `baseDir` that contains
 * an `index.html` file. Returns null if the dir is absent, empty, or no
 * version has a valid `index.html`.
 *
 * The `index.html` check prevents reporting a half-copied installation.
 *
 * @param baseDir Defaults to UNDERSTAND_VIEWER_DIR (~/.agenticapps/dashboard/understand-viewer/).
 *                Pass a custom path in tests.
 */
export function getInstalledViewerVersion(baseDir: string = UNDERSTAND_VIEWER_DIR): string | null {
  const entries = safeDirEntries(baseDir)
  const sorted = sortedSemverDirs(entries)
  for (const version of sorted) {
    const indexPath = join(baseDir, version, 'index.html')
    if (existsSync(indexPath)) {
      return version
    }
  }
  return null
}

/**
 * Return the absolute path of the highest semver version dir under `baseDir`
 * that contains an `index.html` file. Returns null if none found.
 *
 * @param baseDir Defaults to UNDERSTAND_VIEWER_DIR.
 */
export function getInstalledViewerPath(baseDir: string = UNDERSTAND_VIEWER_DIR): string | null {
  const version = getInstalledViewerVersion(baseDir)
  if (!version) return null
  return join(baseDir, version)
}

/**
 * Return the highest semver version found under `cacheDir` (the plugin cache root
 * for the understand-anything plugin). Returns null if the dir is absent, empty,
 * or contains no valid semver entries.
 *
 * Note: unlike getInstalledViewerVersion, this does NOT require an `index.html`
 * — plugin cache dirs only need to exist (the full plugin bundle lives there).
 *
 * @param cacheDir Defaults to UNDERSTAND_PLUGIN_CACHE
 *                 (~/.claude/plugins/cache/understand-anything/understand-anything/).
 */
export function getNewestPluginCacheVersion(cacheDir: string = UNDERSTAND_PLUGIN_CACHE): string | null {
  const entries = safeDirEntries(cacheDir)
  const sorted = sortedSemverDirs(entries)
  return sorted[0] ?? null
}
