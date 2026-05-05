import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Convert a millisecond delta to a human-readable relative time string.
 * Exported for unit testing.
 */
export function relativeSeconds(deltaMs: number): string {
  const sec = Math.max(0, Math.round(deltaMs / 1000))
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`
  if (sec < 86400) return `${Math.round(sec / 3600)}h ago`
  return `${Math.round(sec / 86400)}d ago`
}

/**
 * useLastRefresh — derives the global header status line (D-05).
 *
 * Returns:
 *  - count: number of projects from ['registry'] query data, or null while loading.
 *  - refreshLabel: human-readable age of the oldest dataUpdatedAt across all
 *    ['registry'] and ['overview', *] queries; "refreshing…" when no query has
 *    completed yet (all dataUpdatedAt === 0).
 *
 * Updates every 1s via setInterval; interval is cleaned up on unmount.
 */
export function useLastRefresh(): { count: number | null; refreshLabel: string | null } {
  const qc = useQueryClient()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Scan the query cache for registry and overview queries.
  const queries = qc.getQueryCache().getAll()
  const tracked = queries.filter(q => {
    const k = q.queryKey
    return Array.isArray(k) && (k[0] === 'registry' || k[0] === 'overview')
  })

  // Collect all dataUpdatedAt values > 0 (queries that have completed at least once).
  const updateds = tracked
    .map(q => q.state.dataUpdatedAt)
    .filter((t): t is number => typeof t === 'number' && t > 0)

  let refreshLabel: string
  if (updateds.length > 0) {
    const oldest = Math.min(...updateds)
    refreshLabel = `last refresh ${relativeSeconds(now - oldest)}`
  } else {
    refreshLabel = 'refreshing…'
  }

  // Project count from ['registry'] cache entry.
  const registry = qc.getQueryData<unknown[]>(['registry'])
  const count = Array.isArray(registry) ? registry.length : null

  return { count, refreshLabel }
}
