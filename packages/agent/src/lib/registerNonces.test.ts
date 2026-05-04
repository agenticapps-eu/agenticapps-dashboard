import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import { issueNonce, consumeNonce, cleanupExpired, _resetForTests } from './registerNonces.js'

const baseEntry = {
  canonicalRoot: '/Users/x/acme',
  suggestedName: 'acme',
  suggestedSlug: 'acme',
  detectedMarkers: { gitRepo: true, planning: true, claudeSkills: false },
}

beforeEach(() => {
  _resetForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('issueNonce', () => {
  it('returns a 32-char lowercase hex string', () => {
    const { nonce } = issueNonce(baseEntry)
    expect(nonce).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('consumeNonce', () => {
  it('returns the entry on first consume and null on second (single-use)', () => {
    const { nonce } = issueNonce(baseEntry)
    const first = consumeNonce(nonce)
    expect(first).not.toBeNull()
    expect(first?.canonicalRoot).toBe('/Users/x/acme')
    const second = consumeNonce(nonce)
    expect(second).toBeNull()
  })

  it('returns null for an unknown nonce', () => {
    const fakeNonce = 'a'.repeat(32)
    expect(consumeNonce(fakeNonce)).toBeNull()
  })

  it('returns null for an expired nonce', () => {
    vi.useFakeTimers()
    const { nonce } = issueNonce(baseEntry)
    // Advance past the 5-minute TTL
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    expect(consumeNonce(nonce)).toBeNull()
  })
})

describe('cleanupExpired', () => {
  it('removes only expired entries, keeping non-expired ones', () => {
    vi.useFakeTimers()
    const now = Date.now()
    const { nonce: expiredNonce } = issueNonce(baseEntry)
    // Advance 3 minutes — expiredNonce not yet expired
    vi.advanceTimersByTime(3 * 60 * 1000)
    const { nonce: freshNonce } = issueNonce(baseEntry)
    // Advance another 3 minutes — expiredNonce is now past TTL, freshNonce is not
    vi.advanceTimersByTime(3 * 60 * 1000)
    cleanupExpired(now + 6 * 60 * 1000)
    // expired nonce should be gone
    expect(consumeNonce(expiredNonce)).toBeNull()
    // fresh nonce should still exist (cleanupExpired removed it only if truly expired)
    // We check via issueNonce store: if freshNonce was removed it returns null too
    // Since cleanupExpired ran with a time that is < freshNonce.expiresAt, fresh survives
    const freshResult = consumeNonce(freshNonce)
    expect(freshResult).not.toBeNull()
  })
})
