/**
 * conformanceCache.ts — Singleton 30s TTL memo for /api/observability/conformance.
 *
 * D-12-17: 30s TTL matches Phase 10 coverageCache + the broader fleet-cache
 * cadence convention. First call to the route computes the full conformance
 * payload (scanCoverageInternal + detectPathDrift + computeConformanceScores +
 * readDailySeriesForFleet); subsequent calls within 30s return the cached
 * instance. POST /api/admin/registry/fix-path clears the cache so the next
 * GET re-scans against the freshly-mutated registry.
 *
 * T-12-CACHE-STALE: invalidateConformanceCache() is called by the fix-path
 * route after writeRegistry success — see registryFixPath.ts.
 *
 * Pattern mirrors coverageCache.ts verbatim (D-12-17 + Pattern 2 in
 * 12-RESEARCH.md). Module-scoped `let cache` — single-key, not a Map.
 */
import type { ConformanceResponse } from '@agenticapps/dashboard-shared'

export interface ConformanceCacheEntry {
  value: ConformanceResponse
  expiresAt: number // Date.now() + TTL_MS
}

/** D-12-17 threshold lock: 30-second TTL. */
export const TTL_MS = 30_000

let cache: ConformanceCacheEntry | null = null

/**
 * Return the cached ConformanceResponse if it exists and has not expired.
 * Returns null on cache miss or expiry — caller is responsible for recomputing.
 *
 * Expiry is exclusive (`now >= expiresAt` → null) so `t + TTL_MS - 1` is still
 * a hit and `t + TTL_MS` is a miss. Matches coverageCache semantics.
 *
 * @param now  Injectable timestamp (default: Date.now()) for testability.
 */
export function getConformanceCache(now: number = Date.now()): ConformanceResponse | null {
  if (!cache) return null
  if (now >= cache.expiresAt) return null
  return cache.value
}

/**
 * Store a ConformanceResponse in the cache with a 30s TTL.
 *
 * @param value  The ConformanceResponse to cache.
 * @param now    Injectable timestamp (default: Date.now()) for testability.
 */
export function setConformanceCache(
  value: ConformanceResponse,
  now: number = Date.now(),
): void {
  cache = { value, expiresAt: now + TTL_MS }
}

/**
 * Clear the cache entry unconditionally.
 * Called by POST /api/admin/registry/fix-path after a successful registry
 * mutation — see registryFixPath.ts (T-12-CACHE-STALE mitigation).
 */
export function invalidateConformanceCache(): void {
  cache = null
}

/**
 * Test-only backdoor: reset module-scoped cache state.
 * Mirrors the _resetForTests() pattern in coverageCache.ts.
 */
export function _resetConformanceCacheForTests(): void {
  cache = null
}
