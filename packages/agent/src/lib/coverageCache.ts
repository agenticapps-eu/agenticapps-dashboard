/**
 * coverageCache.ts — Singleton 30s TTL memo for /api/coverage responses.
 *
 * COV-03: Single-key memo (not per-id like overviewCache.ts). First call computes,
 * subsequent calls within 30s return the same instance. POST refresh clears.
 *
 * T-10-03-05: invalidateCoverageCache() called on every POST /refresh → next GET re-scans.
 * Cache eviction policy is "clear all" (not row-level, per Claude's Discretion default).
 *
 * Pattern mirrors overviewCache.ts (single-key variant of the per-id Map pattern).
 */
import type { CoverageResponse } from '@agenticapps/dashboard-shared'

export interface CoverageCacheEntry {
  value: CoverageResponse
  expiresAt: number // Date.now() + TTL_MS
}

/** COV-03 threshold lock: 30-second TTL. */
export const TTL_MS = 30_000

let cache: CoverageCacheEntry | null = null

/**
 * Return the cached CoverageResponse if it exists and has not expired.
 * Returns null on cache miss or expiry — caller is responsible for recomputing.
 *
 * @param now  Injectable timestamp (default: Date.now()) for testability.
 */
export function getCoverageCache(now: number = Date.now()): CoverageResponse | null {
  if (!cache) return null
  if (now >= cache.expiresAt) return null
  return cache.value
}

/**
 * Store a CoverageResponse in the cache with a 30s TTL.
 *
 * @param value  The CoverageResponse to cache.
 * @param now    Injectable timestamp (default: Date.now()) for testability.
 */
export function setCoverageCache(value: CoverageResponse, now: number = Date.now()): void {
  cache = { value, expiresAt: now + TTL_MS }
}

/**
 * Clear the cache entry unconditionally.
 * Called by POST /api/coverage/refresh — clears the entire memo (clear-all policy per T-10-03-05).
 */
export function invalidateCoverageCache(): void {
  cache = null
}

/**
 * Test-only backdoor: reset module-scoped cache state.
 * Mirrors the _resetForTests() pattern in overviewCache.ts and agentLinterCache.ts.
 */
export function _resetCoverageCacheForTests(): void {
  cache = null
}
