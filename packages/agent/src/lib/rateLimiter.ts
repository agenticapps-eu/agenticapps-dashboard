import { createHash } from 'node:crypto'

/** Sliding window duration in ms (D-14). */
const WINDOW_MS = 10_000

/** Maximum requests allowed within the window (D-14: 10-burst). */
const BURST_CAP = 10

/** Map from tokenHash to array of recent request timestamps. */
const store = new Map<string, number[]>()

/**
 * Returns the first 8 chars of sha256(token) as lowercase hex.
 * Used as a privacy-preserving key — bearer token is never logged.
 */
export function tokenHashOf(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 8)
}

/**
 * Consume one slot for tokenHash in the sliding window.
 * Returns { allowed: true } if under BURST_CAP, else { allowed: false, retryAfter: 1 }.
 */
export function consume(
  tokenHash: string,
  now: number = Date.now()
): { allowed: true } | { allowed: false; retryAfter: number } {
  const timestamps = store.get(tokenHash) ?? []
  // Remove timestamps outside the current window
  const recent = timestamps.filter((t) => t > now - WINDOW_MS)
  if (recent.length >= BURST_CAP) {
    store.set(tokenHash, recent)
    return { allowed: false, retryAfter: 1 }
  }
  recent.push(now)
  store.set(tokenHash, recent)
  return { allowed: true }
}

/**
 * Remove timestamps older than the current window; delete empty entries.
 * Called by the 60s sweep interval (T-03-01-03).
 */
export function sweepOldTimestamps(now: number = Date.now()): void {
  for (const [key, timestamps] of store) {
    const recent = timestamps.filter((t) => t > now - WINDOW_MS)
    if (recent.length === 0) {
      store.delete(key)
    } else {
      store.set(key, recent)
    }
  }
}

/** Test-only backdoor: reset the rate-limiter store. */
export function _resetForTests(): void {
  store.clear()
}

// Sweep every 60s; unref so the interval does not keep the process alive (Pitfall 3).
const sweepHandle = setInterval(() => sweepOldTimestamps(), 60_000)
sweepHandle.unref?.()
