import type { ProjectOverview } from '@agenticapps/dashboard-shared'

/** D-02: 5-second in-process memo cache for /api/projects/:id/overview. */
const CACHE_TTL_MS = 5_000

interface CacheEntry {
  value: ProjectOverview
  expiresAt: number
}

const store = new Map<string, CacheEntry>()

/**
 * Return the cached ProjectOverview for the given project id, or null if
 * absent or expired (lazy expiry — stale entries removed on miss).
 */
export function getCached(id: string, now: number = Date.now()): ProjectOverview | null {
  const entry = store.get(id)
  if (!entry) return null
  if (entry.expiresAt < now) {
    store.delete(id)
    return null
  }
  return entry.value
}

/**
 * Store a ProjectOverview in the cache with a 5-second TTL.
 */
export function setCached(id: string, value: ProjectOverview, now: number = Date.now()): void {
  store.set(id, { value, expiresAt: now + CACHE_TTL_MS })
}

/**
 * Evict a single project from the cache (called on unregister).
 */
export function evict(id: string): void {
  store.delete(id)
}

/** Test-only: reset the cache between tests. */
export function _resetForTests(): void {
  store.clear()
}
