/**
 * D-4-04: Per-route 5s memo cache for Phase 4 detail-view routes.
 *
 * Keyed by `${projectId}:${routeName}` so a single project's panels each
 * have an independent cache slot. Lazy expiry on read (mirrors overviewCache).
 *
 * NOTE: This cache is INDEPENDENT from packages/agent/src/lib/overviewCache.ts.
 * The Phase 3 /overview route uses overviewCache. The Phase 4 routes
 * (commitment, observations, phase-progress, security, discipline) use
 * phaseCache. Plan 03 will already evict overviewCache on unregister;
 * Phase 4 must additionally evict phaseCache via evictPhaseCacheProject.
 *
 * Cache key separator is a colon (`:`); IDs do not contain colons (registry
 * slugs are `[a-z0-9-]+` per Phase 1 slugify), so prefix-match for eviction
 * is unambiguous (T-04-02-08).
 */
const CACHE_TTL_MS = 5_000

interface PhaseCacheEntry {
  value: unknown
  expiresAt: number
}

const store = new Map<string, PhaseCacheEntry>()

/**
 * Return the cached value for the given `${projectId}:${routeName}` key,
 * or null if missing or expired. Lazy expiry: stale entry is deleted on read.
 */
export function getPhaseCache(key: string, now: number = Date.now()): unknown | null {
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expiresAt <= now) {
    store.delete(key)
    return null
  }
  return entry.value
}

/**
 * Store a value in the cache with a 5s TTL.
 * The value type is `unknown` — each route knows its own shape and validates
 * via Zod's `outbound()` parse on the route side.
 */
export function setPhaseCache(key: string, value: unknown, now: number = Date.now()): void {
  store.set(key, { value, expiresAt: now + CACHE_TTL_MS })
}

/**
 * Evict every cache entry whose key starts with `${projectId}:`.
 * Called from the registry unregister handler so a re-registered project
 * with the same id but a different root cannot serve stale Phase 4 panels.
 */
export function evictPhaseCacheProject(projectId: string): void {
  const prefix = `${projectId}:`
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

/** Test-only backdoor — same convention as overviewCache._resetForTests. */
export function _resetForTests(): void {
  store.clear()
}
