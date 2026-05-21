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
 * Inflight singleton for the cold-cache → scanConformance() compute path.
 * When set, every caller in the cache-miss window awaits the same promise
 * instead of fanning out N independent scanConformance() invocations.
 * Cleared on settle (success OR failure) so a rejected scan doesn't poison
 * the slot. See getOrComputeConformance() and its RED test (Test 10/11 in
 * conformance.test.ts) for the thundering-herd shape this prevents.
 */
let inflight: Promise<ConformanceResponse> | null = null

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
 * Resolve a ConformanceResponse via cache → inflight singleton → compute.
 *
 * Three branches:
 *   1. Fresh cache hit: return cached value (no compute, no inflight).
 *   2. Cache miss with inflight in progress: await the existing inflight
 *      promise — every concurrent caller in the cold window shares it.
 *   3. Cache miss with no inflight: kick off a new compute, store the
 *      inflight ref so subsequent callers in this tick share it, populate
 *      the cache on success, and ALWAYS clear the inflight ref on settle
 *      (try/finally) so a rejected scan doesn't poison the slot.
 *
 * The helper owns both cache reads and writes for the compute path so the
 * route handler doesn't have to coordinate inflight + cache + outbound. The
 * fix-path route's `invalidateConformanceCache()` still works as before —
 * it only clears `cache`, not `inflight`, so an in-progress scan finishes
 * and populates the next 30s window with fresh data.
 */
export async function getOrComputeConformance(
  compute: () => Promise<ConformanceResponse>,
  now: number = Date.now(),
): Promise<ConformanceResponse> {
  const cached = getConformanceCache(now)
  if (cached) return cached
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const value = await compute()
      setConformanceCache(value, Date.now())
      return value
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/**
 * Test-only backdoor: reset module-scoped cache state.
 * Mirrors the _resetForTests() pattern in coverageCache.ts.
 * Also clears the inflight ref so tests start from a clean slate.
 */
export function _resetConformanceCacheForTests(): void {
  cache = null
  inflight = null
}
