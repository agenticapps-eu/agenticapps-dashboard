/**
 * agentLinterCache.ts — Per-projectId in-memory cache for AgentLinter results.
 *
 * D-5-14: Cache key = (projectId, max-mtime across all SKILL.md files in
 * both <projectRoot>/.claude/skills and ~/.claude/skills). 1h hard ceiling on top.
 *
 * Cache is in-memory only (Claude's Discretion default per CONTEXT.md).
 * No on-disk persistence — 1h TTL aligns with typical daemon uptime.
 *
 * Security (T-05-02-Cache-Cross-Project): keyed by projectId; cross-project
 * leak prevented because `getAgentLinterCached(id, mtime)` returns null on
 * any id mismatch.
 *
 * Security (T-05-02-Cache-Stale-Lie): maxMtime invalidation forces re-scan
 * whenever ANY SKILL.md changes (project OR global root).
 */
import { existsSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

import type { AgentLinterResult } from './agentLinterRunner.js'

/** 1h hard ceiling per D-5-14. */
const CACHE_TTL_MS = 3_600_000

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentLinterCacheEntry {
  result: AgentLinterResult
  /** ISO timestamp when result was cached. */
  cachedAt: string
  /** max mtimeMs across all scanned SKILL.md files at cache time. */
  maxMtime: number
}

/** Internal row with epoch-ms cachedAt for fast TTL comparison. */
interface CachedRow extends AgentLinterCacheEntry {
  cachedAtMs: number
}

// ── In-memory store ───────────────────────────────────────────────────────────

const cache = new Map<string, CachedRow>()

// ── computeMaxMtime ───────────────────────────────────────────────────────────

/**
 * Walk `<projectRoot>/.claude/skills` and `globalRoot` (default: ~/.claude/skills),
 * check both canonical (`.../SKILL.md`) and bundle (`.../skill/SKILL.md`) layouts,
 * and return the maximum `mtimeMs` across all found files.
 *
 * Returns 0 if no SKILL.md files are found in either root.
 *
 * The `globalRoot` parameter is exposed for testability — callers can inject a
 * fake globalRoot rather than spying on os.homedir().
 */
export async function computeMaxMtime(
  projectRoot: string,
  globalRoot?: string,
): Promise<number> {
  const { homedir } = await import('node:os')
  const roots = [
    join(projectRoot, '.claude', 'skills'),
    globalRoot ?? join(homedir(), '.claude', 'skills'),
  ]

  let maxMtime = 0

  for (const root of roots) {
    if (!existsSync(root)) continue
    let dirs: string[]
    try {
      dirs = await readdir(root)
    } catch {
      continue
    }
    for (const dir of dirs) {
      const canonical = join(root, dir, 'SKILL.md')
      const bundle = join(root, dir, 'skill', 'SKILL.md')
      for (const candidate of [canonical, bundle]) {
        if (!existsSync(candidate)) continue
        try {
          const s = statSync(candidate)
          if (s.mtimeMs > maxMtime) maxMtime = s.mtimeMs
        } catch {
          /* skip unreadable files */
        }
      }
    }
  }

  return maxMtime
}

// ── Cache accessors ───────────────────────────────────────────────────────────

/**
 * Return the cached entry for `projectId` if:
 * 1. The entry exists.
 * 2. The cached maxMtime matches `currentMaxMtime` (no skill file was touched).
 * 3. The entry is within the 1h TTL.
 *
 * Returns null on any miss.
 */
export function getAgentLinterCached(
  projectId: string,
  currentMaxMtime: number,
): AgentLinterCacheEntry | null {
  const row = cache.get(projectId)
  if (!row) return null
  // TTL check
  if (Date.now() - row.cachedAtMs > CACHE_TTL_MS) return null
  // Mtime invalidation (T-05-02-Cache-Stale-Lie)
  if (row.maxMtime !== currentMaxMtime) return null
  return { result: row.result, cachedAt: row.cachedAt, maxMtime: row.maxMtime }
}

/**
 * Store an entry for `projectId`. The `cachedAtMs` is set to `Date.now()`.
 */
export function setAgentLinterCached(projectId: string, entry: AgentLinterCacheEntry): void {
  cache.set(projectId, { ...entry, cachedAtMs: Date.now() })
}

/**
 * Remove the cache entry for `projectId`.
 * Called when a project is unregistered so a re-registered project with
 * the same id cannot serve stale results.
 */
export function evictAgentLinterCacheProject(projectId: string): void {
  cache.delete(projectId)
}

/** Test-only backdoor — clears the entire cache. */
export function __resetCache(): void {
  cache.clear()
}
