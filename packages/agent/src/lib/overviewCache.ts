/**
 * D-02: Daemon-side 5s in-process memo cache for /api/projects/:id/overview.
 *
 * Multiple SPA tabs polling at 5s coalesce into one filesystem read per 5s window.
 * Lazy expiry: stale entries are deleted on the next getCached() call for that id.
 * No background sweeper: cache is bounded by registry size (~5–50 entries).
 */
import type { ProjectOverview } from '@agenticapps/dashboard-shared'

const TTL_MS = 5_000

interface CacheEntry {
  value: ProjectOverview
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

/**
 * Return cached overview if still fresh, or null if absent/stale.
 * Stale entries are evicted eagerly on read.
 */
export function getCached(id: string, now: number = Date.now()): ProjectOverview | null {
  const entry = cache.get(id)
  if (!entry) return null
  if (now >= entry.expiresAt) {
    cache.delete(id)
    return null
  }
  return entry.value
}

/**
 * Store an overview in the cache with a TTL_MS expiry.
 */
export function setCached(id: string, value: ProjectOverview, now: number = Date.now()): void {
  cache.set(id, { value, expiresAt: now + TTL_MS })
}

/**
 * Remove a project's cached overview immediately.
 * Must be called by the unregister handler (plan 05) to prevent stale data
 * for a re-registered path with the same ID.
 */
export function evict(id: string): void {
  cache.delete(id)
}

/**
 * Reset the cache entirely. Only for test isolation — do not call in production code.
 */
export function _resetForTests(): void {
  cache.clear()
}
