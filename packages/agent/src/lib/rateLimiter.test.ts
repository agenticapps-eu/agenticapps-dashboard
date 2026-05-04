import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

import { tokenHashOf, consume, sweepOldTimestamps, _resetForTests } from './rateLimiter.js'

beforeEach(() => {
  _resetForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('tokenHashOf', () => {
  it('returns 8 lowercase hex chars', () => {
    const hash = tokenHashOf('my-secret-token')
    expect(hash).toMatch(/^[0-9a-f]{8}$/)
  })

  it('is deterministic for the same input', () => {
    const h1 = tokenHashOf('my-secret-token')
    const h2 = tokenHashOf('my-secret-token')
    expect(h1).toBe(h2)
  })
})

describe('consume', () => {
  it('allows first 10 consecutive calls', () => {
    const hash = 'abc12345'
    for (let i = 0; i < 10; i++) {
      const result = consume(hash)
      expect(result.allowed).toBe(true)
    }
  })

  it('blocks the 11th call with retryAfter: 1', () => {
    const hash = 'abc12345'
    for (let i = 0; i < 10; i++) consume(hash)
    const result = consume(hash)
    expect(result.allowed).toBe(false)
    if (!result.allowed) {
      expect(result.retryAfter).toBe(1)
    }
  })

  it('allows again after the window passes', () => {
    vi.useFakeTimers()
    const hash = 'abc12345'
    const start = Date.now()
    for (let i = 0; i < 10; i++) consume(hash, start)
    // advance past the 10s window
    vi.advanceTimersByTime(10_001)
    const result = consume(hash, start + 10_001)
    expect(result.allowed).toBe(true)
  })
})

describe('sweepOldTimestamps', () => {
  it('removes entries with no recent timestamps', () => {
    vi.useFakeTimers()
    const hash = 'abc12345'
    const start = Date.now()
    consume(hash, start)
    // Advance past window
    vi.advanceTimersByTime(10_001)
    sweepOldTimestamps(start + 10_001)
    // After sweep, the entry should be gone; a new consume starts fresh
    const result = consume(hash, start + 10_001)
    expect(result.allowed).toBe(true)
  })
})
