/**
 * skillDriftCache.ts — 30s single-key memo for GET /api/skills/drift.
 *
 * Plan 11-03 cache surface — mirrors Phase 10's `coverageCache.ts` 30s
 * single-key memo cadence. The cross-repo aggregator (`scanSkillDrift`) is
 * expensive (reads `.claude/skills` per registered project + per-skill
 * matrix fold) so a short memo absorbs SPA polling without serving stale
 * cross-day data.
 *
 * Cache key model: single global entry (no per-scope keying). The PD-11-03
 * scope chip is a SPA-side group/filter; the daemon serves the same payload
 * regardless of scope.
 *
 * Pure JS — no native deps (CLAUDE.md hard constraint).
 */
import type { SkillDriftResponse } from '@agenticapps/dashboard-shared'

/** 30s TTL — matches Phase 10 coverageCache cadence (COV-03 threshold). */
const TTL_MS = 30 * 1000

interface Entry {
  value: SkillDriftResponse
  expiresAt: number
}

let entry: Entry | null = null

/**
 * Return the cached SkillDriftResponse if it exists and has not expired.
 * Returns undefined on miss or expiry — caller is responsible for recomputing.
 *
 * @param now Injectable timestamp for testability (defaults to Date.now()).
 */
export function getSkillDriftCached(now: number = Date.now()): SkillDriftResponse | undefined {
  if (!entry) return undefined
  if (now >= entry.expiresAt) {
    entry = null
    return undefined
  }
  return entry.value
}

/**
 * Store `value` with a 30s TTL anchored to `now`.
 *
 * @param now Injectable timestamp for testability (defaults to Date.now()).
 */
export function setSkillDriftCached(value: SkillDriftResponse, now: number = Date.now()): void {
  entry = { value, expiresAt: now + TTL_MS }
}

/**
 * Clear the cache entry unconditionally. Called by tests and by future
 * registry-mutation hooks (e.g. project unregister).
 */
export function clearSkillDriftCache(): void {
  entry = null
}
