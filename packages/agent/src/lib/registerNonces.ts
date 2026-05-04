import { randomBytes } from 'node:crypto'

/** D-10: 5-minute nonce TTL. */
const NONCE_TTL_MS = 5 * 60 * 1000

export interface NonceEntry {
  canonicalRoot: string
  suggestedName: string
  suggestedSlug: string
  detectedMarkers: { gitRepo: boolean; planning: boolean; claudeSkills: boolean }
  expiresAt: number
}

const store = new Map<string, NonceEntry>()

/**
 * Issue a fresh 32-char lowercase hex nonce (crypto.randomBytes(16).toString('hex')).
 * Stores entry with a 5-minute TTL. Single-use: consumeNonce deletes on first call.
 */
export function issueNonce(
  entryWithoutExpiry: Omit<NonceEntry, 'expiresAt'>
): { nonce: string; expiresAt: number } {
  const nonce = randomBytes(16).toString('hex')
  const expiresAt = Date.now() + NONCE_TTL_MS
  store.set(nonce, { ...entryWithoutExpiry, expiresAt })
  return { nonce, expiresAt }
}

/**
 * Consume a nonce atomically: always deletes on call (single-use guarantee).
 * Returns null for unknown or expired nonces (410 Gone per D-18).
 */
export function consumeNonce(nonce: string): NonceEntry | null {
  const entry = store.get(nonce)
  // Delete unconditionally — ensures both unknown and expired return null.
  store.delete(nonce)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) return null
  return entry
}

/**
 * Remove all entries whose expiresAt is before `now`.
 * Called by the 60s sweep interval (T-03-01-03).
 */
export function cleanupExpired(now: number = Date.now()): void {
  for (const [nonce, entry] of store) {
    if (entry.expiresAt < now) {
      store.delete(nonce)
    }
  }
}

/** Test-only backdoor: reset the nonce store. */
export function _resetForTests(): void {
  store.clear()
}

// Sweep every 60s; unref so the interval does not keep the process alive (Pitfall 3).
const sweepHandle = setInterval(() => cleanupExpired(), 60_000)
sweepHandle.unref?.()
