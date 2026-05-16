/**
 * coverageHistoryCache.ts — 1h Map-keyed memo for GET /api/coverage/history responses.
 *
 * PD-11-02: cache key is `repoId` ONLY (no per-column discriminator). The
 * bulk-per-repo response carries all four columns in one payload, so per-column
 * partitioning would just split a single coherent response across four cache
 * entries for no benefit.
 *
 * 1h TTL aligns with the daily-tick cadence — drift values can't change between
 * cron ticks (the underlying NDJSON is append-only), so 1h is the right window
 * to absorb refetches without serving stale state across day boundaries.
 *
 * Mirrors agentLinterCache.ts's Map<string, CachedRow> pattern. Pure JS — no
 * native deps (CLAUDE.md hard constraint).
 */

/** 1h hard TTL — aligns with the daily snapshot tick cadence. */
const TTL_MS = 60 * 60 * 1000

interface Entry {
  value: unknown
  expiresAt: number
}

const cache = new Map<string, Entry>()

/**
 * Return the cached value for `repoId` if it exists and has not expired.
 * Returns `undefined` on miss or expiry (mirrors `getAgentLinterCached`'s
 * null-on-miss semantic but uses undefined to match the typical async value
 * cache shape).
 *
 * @param now Injectable timestamp for testability (defaults to Date.now()).
 */
export function getCoverageHistoryCached<T>(
  repoId: string,
  now: number = Date.now(),
): T | undefined {
  const entry = cache.get(repoId)
  if (!entry) return undefined
  if (now >= entry.expiresAt) {
    cache.delete(repoId)
    return undefined
  }
  return entry.value as T
}

/**
 * Store `value` under `repoId` with a 1h TTL anchored to `now`.
 */
export function setCoverageHistoryCached<T>(
  repoId: string,
  value: T,
  now: number = Date.now(),
): void {
  cache.set(repoId, { value, expiresAt: now + TTL_MS })
}

/**
 * Clear the entire cache. Called by tests + by a future
 * unregister hook (mirrors agentLinterCache.evictAgentLinterCacheProject).
 */
export function clearCoverageHistoryCache(): void {
  cache.clear()
}
