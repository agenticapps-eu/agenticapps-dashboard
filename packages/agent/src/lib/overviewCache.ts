import type { ProjectOverview } from '@agenticapps/dashboard-shared'

/** D-02: 5-second memo cache for /overview responses. */
const CACHE_TTL_MS = 5_000

interface CacheEntry {
  value: ProjectOverview
  expiresAt: number
}

const store = new Map<string, CacheEntry>()

/**
 * Return a cached ProjectOverview for the given project id, or null if missing/expired.
 * Lazy expiry: stale entry is deleted on read (RESEARCH Pattern 1).
 *
 * Note (T-03-01-04): Wave 1 must call evict(id) on unregister to prevent stale data
 * from a re-registered project with the same id but different root.
 */
export function getCached(id: string, now: number = Date.now()): ProjectOverview | null {
  const entry = store.get(id)
  if (!entry) return null
  if (entry.expiresAt <= now) {
    store.delete(id)
    return null
  }
  return entry.value
}

/**
 * Store a ProjectOverview in the cache with a 5s TTL.
 */
export function setCached(id: string, value: ProjectOverview, now: number = Date.now()): void {
  store.set(id, { value, expiresAt: now + CACHE_TTL_MS })
}

/**
 * Evict the cache entry for the given project id.
 * Must be called on unregister to prevent stale data (T-03-01-04).
 */
export function evict(id: string): void {
  store.delete(id)
}

/** Test-only backdoor: reset the cache store. */
export function _resetForTests(): void {
  store.clear()
}
