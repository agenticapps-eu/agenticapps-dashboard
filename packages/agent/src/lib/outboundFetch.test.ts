/**
 * Tests for outboundFetch.ts — timeout, no-retry, error classification, last-good cache shape.
 * Uses vi.stubGlobal to mock the global fetch; fake timers for abort path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  fetchWithTimeout,
  classifyError,
  type OutboundErrorCategory,
  type CacheEntry,
} from './outboundFetch.js'

// ---------------------------------------------------------------------------
// classifyError
// ---------------------------------------------------------------------------

describe('classifyError', () => {
  it('classifies AbortError as unreachable', () => {
    const err = new Error('aborted')
    err.name = 'AbortError'
    expect(classifyError(err)).toBe<OutboundErrorCategory>('unreachable')
  })

  it('classifies TypeError (fetch failed / DNS / ECONNREFUSED) as unreachable', () => {
    expect(classifyError(new TypeError('fetch failed'))).toBe<OutboundErrorCategory>('unreachable')
  })

  it('classifies status 401 as unauthorized', () => {
    expect(classifyError(null, 401)).toBe<OutboundErrorCategory>('unauthorized')
  })

  it('classifies status 403 as unauthorized', () => {
    expect(classifyError(null, 403)).toBe<OutboundErrorCategory>('unauthorized')
  })

  it('classifies status 429 as rate-limited', () => {
    expect(classifyError(null, 429)).toBe<OutboundErrorCategory>('rate-limited')
  })

  it('classifies Linear 400+RATELIMITED body as rate-limited (Pitfall 1)', () => {
    const body = { errors: [{ extensions: { code: 'RATELIMITED' } }] }
    expect(classifyError(null, 400, body)).toBe<OutboundErrorCategory>('rate-limited')
  })

  it('classifies status 400 without RATELIMITED body as unreachable', () => {
    expect(classifyError(null, 400, { errors: [{ message: 'bad request' }] })).toBe<OutboundErrorCategory>('unreachable')
  })

  it('classifies status 404 as unreachable', () => {
    expect(classifyError(null, 404)).toBe<OutboundErrorCategory>('unreachable')
  })

  it('classifies status 500 as unreachable', () => {
    expect(classifyError(null, 500)).toBe<OutboundErrorCategory>('unreachable')
  })

  it('classifies status 503 as unreachable', () => {
    expect(classifyError(null, 503)).toBe<OutboundErrorCategory>('unreachable')
  })

  it('classifies unknown error with no status as unreachable', () => {
    expect(classifyError(new Error('something random'))).toBe<OutboundErrorCategory>('unreachable')
  })

  it('classifies null error with no status as unreachable', () => {
    expect(classifyError(null)).toBe<OutboundErrorCategory>('unreachable')
  })
})

// ---------------------------------------------------------------------------
// fetchWithTimeout
// ---------------------------------------------------------------------------

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('resolves when fetch succeeds before timeout', async () => {
    const mockResponse = { status: 200, ok: true, json: vi.fn() } as unknown as Response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse))

    const resultPromise = fetchWithTimeout('https://example.com/api', {})
    // Advance time less than the default 5000ms
    vi.advanceTimersByTime(1000)
    const result = await resultPromise
    expect(result).toBe(mockResponse)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('aborts and rejects with AbortError when timeout fires', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          // Listen for the abort signal
          if (init.signal) {
            (init.signal as AbortSignal).addEventListener('abort', () => {
              const err = new Error('This operation was aborted')
              err.name = 'AbortError'
              reject(err)
            })
          }
        })
      }),
    )

    const resultPromise = fetchWithTimeout('https://example.com/api', {}, 5000)
    vi.advanceTimersByTime(5000)
    await expect(resultPromise).rejects.toMatchObject({ name: 'AbortError' })
    // fetch called exactly once — no retry (D-08-08)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('clears the timer even when fetch throws synchronously-resolved rejection', async () => {
    const err = new TypeError('fetch failed')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err))
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

    await expect(fetchWithTimeout('https://example.com/api', {})).rejects.toThrow(TypeError)
    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('passes custom timeoutMs to the abort boundary', async () => {
    const shortTimeout = 100
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          if (init.signal) {
            (init.signal as AbortSignal).addEventListener('abort', () => {
              const abortErr = new Error('aborted')
              abortErr.name = 'AbortError'
              reject(abortErr)
            })
          }
        })
      }),
    )

    const resultPromise = fetchWithTimeout('https://example.com/api', {}, shortTimeout)
    vi.advanceTimersByTime(shortTimeout)
    await expect(resultPromise).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('passes the signal through the init object to fetch', async () => {
    const mockResponse = { status: 200, ok: true } as unknown as Response
    let capturedInit: RequestInit | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        capturedInit = init
        return Promise.resolve(mockResponse)
      }),
    )

    await fetchWithTimeout('https://example.com/api', { headers: { Authorization: 'Bearer tok' } })
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal)
  })
})

// ---------------------------------------------------------------------------
// CacheEntry<T> type shape — last-good sub-entry (D-08-09)
// ---------------------------------------------------------------------------

describe('CacheEntry<T> shape', () => {
  it('carries lastGood when provided', () => {
    const entry: CacheEntry<{ issues: string[] }> = {
      value: { issues: ['new'] },
      cachedAtMs: Date.now(),
      lastGood: {
        value: { issues: ['old'] },
        cachedAtMs: Date.now() - 120_000,
      },
    }
    expect(entry.lastGood).toBeDefined()
    expect(entry.lastGood!.value.issues).toEqual(['old'])
  })

  it('lastGood is optional (absent when first cached)', () => {
    const entry: CacheEntry<number> = {
      value: 42,
      cachedAtMs: Date.now(),
    }
    expect(entry.lastGood).toBeUndefined()
  })

  it('stale: last-good survives TTL expiry — retains value after TTL passes', () => {
    const TTL_MS = 60_000
    const stalePastMs = Date.now() - TTL_MS - 1_000 // expired TTL
    const entry: CacheEntry<string[]> = {
      value: ['stale-value'],
      cachedAtMs: stalePastMs,
      lastGood: {
        value: ['last-good-value'],
        cachedAtMs: stalePastMs - 10_000,
      },
    }
    // Simulate a caller that checks TTL expiry and uses lastGood
    const isExpired = Date.now() - entry.cachedAtMs > TTL_MS
    expect(isExpired).toBe(true)
    // lastGood is still accessible — it survives TTL expiry (D-08-09)
    expect(entry.lastGood!.value).toEqual(['last-good-value'])
  })
})
