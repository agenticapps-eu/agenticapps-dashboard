import { createHash } from 'node:crypto'

/** D-14: sliding-window rate limiter per bearer token hash. */
const WINDOW_MS = 10_000 // 10s window
const BURST_CAP = 10 // max 10 calls per window

/** tokenHash → array of recent call timestamps (ms epoch). */
const store = new Map<string, number[]>()

/**
 * Returns the first 8 hex chars of sha256(token) — used as a correlation key
 * in logs (D-15). One-way; not a security boundary.
 */
export function tokenHashOf(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 8)
}

/**
 * Attempt to consume one unit from the rate-limit bucket for the given tokenHash.
 * Returns `{ allowed: true }` if under the burst cap, `{ allowed: false, retryAfter: 1 }` if over.
 */
export function consume(
  tokenHash: string,
  now: number = Date.now(),
): { allowed: true } | { allowed: false; retryAfter: number } {
  const timestamps = (store.get(tokenHash) ?? []).filter((t) => t > now - WINDOW_MS)
  if (timestamps.length >= BURST_CAP) {
    store.set(tokenHash, timestamps) // update after filtering
    return { allowed: false, retryAfter: 1 }
  }
  timestamps.push(now)
  store.set(tokenHash, timestamps)
  return { allowed: true }
}

/**
 * Sweep old timestamps from the store to prevent unbounded memory growth.
 * Removes entries whose timestamp arrays are empty after the window filter.
 */
export function sweepOldTimestamps(now: number = Date.now()): void {
  for (const [key, timestamps] of store) {
    const fresh = timestamps.filter((t) => t > now - WINDOW_MS)
    if (fresh.length === 0) {
      store.delete(key)
    } else {
      store.set(key, fresh)
    }
  }
}

/** Test-only: reset state between tests. */
export function _resetForTests(): void {
  store.clear()
}

// Periodic sweep (Pitfall 3).
const sweepHandle = setInterval(() => sweepOldTimestamps(), 60_000)
sweepHandle.unref?.()
