import { randomBytes } from 'node:crypto'

/** D-10: nonce TTL is 5 minutes. */
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
 * Issue a new single-use nonce for the given entry data.
 * Nonce = crypto.randomBytes(16).toString('hex') — 32 lowercase hex chars (D-10).
 * TTL: 5 minutes from now.
 */
export function issueNonce(
  entryWithoutExpiry: Omit<NonceEntry, 'expiresAt'>,
): { nonce: string; expiresAt: number } {
  const nonce = randomBytes(16).toString('hex')
  const expiresAt = Date.now() + NONCE_TTL_MS
  store.set(nonce, { ...entryWithoutExpiry, expiresAt })
  return { nonce, expiresAt }
}

/**
 * Consume a nonce atomically (single-use).
 * Deletes the entry on every call regardless of expiry — expired nonces also
 * return null, matching D-18 (both unknown and expired → 410).
 */
export function consumeNonce(nonce: string): NonceEntry | null {
  const entry = store.get(nonce)
  if (!entry) return null
  store.delete(nonce) // single-use: delete regardless of expiry
  if (entry.expiresAt < Date.now()) return null
  return entry
}

/**
 * Remove only expired entries from the store.
 * Called periodically by the sweep interval.
 */
export function cleanupExpired(now: number = Date.now()): void {
  for (const [nonce, entry] of store) {
    if (entry.expiresAt < now) {
      store.delete(nonce)
    }
  }
}

/** Test-only: reset the nonce store between tests. */
export function _resetForTests(): void {
  store.clear()
}

// Periodic sweep to prevent unbounded memory growth (Pitfall 3).
const sweepHandle = setInterval(() => cleanupExpired(), 60_000)
sweepHandle.unref?.()
