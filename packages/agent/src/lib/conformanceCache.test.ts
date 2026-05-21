/**
 * conformanceCache.test.ts — 30s TTL singleton memo for /api/observability/conformance.
 *
 * Plan 12-02 Task 1 (RED first). Mirrors coverageCache.test.ts structure verbatim —
 * type swap CoverageResponse → ConformanceResponse. D-12-17 / Pattern 2 in 12-RESEARCH.md.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getConformanceCache,
  setConformanceCache,
  invalidateConformanceCache,
  getOrComputeConformance,
  _resetConformanceCacheForTests,
  TTL_MS,
} from './conformanceCache.js'
import type { ConformanceResponse } from '@agenticapps/dashboard-shared'

/** Minimal valid ConformanceResponse — schemaVersion:1 + asOf ISO + zeros + empty arrays. */
function makeFakeResponse(): ConformanceResponse {
  return {
    schemaVersion: 1,
    today: {
      asOf: '2026-05-19T12:00:00.000Z',
      fleet: 50,
      agenticapps: 50,
      factiv: 50,
      neuroflash: 50,
    },
    delta14d: { fleet: 0, agenticapps: 0, factiv: 0, neuroflash: 0 },
    series: [],
    drifted: [],
  }
}

describe('conformanceCache', () => {
  beforeEach(() => {
    _resetConformanceCacheForTests()
  })

  it('TTL_MS is exactly 30_000 (D-12-17 — matches coverageCache cadence)', () => {
    expect(TTL_MS).toBe(30_000)
  })

  it('returns null on cold cache (no set yet)', () => {
    expect(getConformanceCache(Date.now())).toBeNull()
  })

  it('returns the stored value within TTL', () => {
    const value = makeFakeResponse()
    const t = Date.now()
    setConformanceCache(value, t)
    expect(getConformanceCache(t)).toBe(value)
  })

  it('returns the value at the edge of TTL (t + TTL_MS - 1)', () => {
    const value = makeFakeResponse()
    const t = 1000
    setConformanceCache(value, t)
    expect(getConformanceCache(t + TTL_MS - 1)).toBe(value)
  })

  it('returns null at the TTL boundary (t + TTL_MS)', () => {
    const value = makeFakeResponse()
    const t = 1000
    setConformanceCache(value, t)
    expect(getConformanceCache(t + TTL_MS)).toBeNull()
  })

  it('returns null after TTL expires (t + 30_001)', () => {
    const value = makeFakeResponse()
    const t = 1000
    setConformanceCache(value, t)
    expect(getConformanceCache(t + 30_001)).toBeNull()
  })

  it('invalidateConformanceCache clears the cache (caller: fix-path route)', () => {
    const value = makeFakeResponse()
    const t = Date.now()
    setConformanceCache(value, t)
    expect(getConformanceCache(t)).toBe(value)
    invalidateConformanceCache()
    expect(getConformanceCache(t)).toBeNull()
  })

  it('_resetConformanceCacheForTests clears the cache (test affordance)', () => {
    const value = makeFakeResponse()
    const t = Date.now()
    setConformanceCache(value, t)
    _resetConformanceCacheForTests()
    expect(getConformanceCache(t)).toBeNull()
  })

  it('setConformanceCache replaces the previous value on a second call', () => {
    const v1 = makeFakeResponse()
    const v2 = makeFakeResponse()
    const t = 1000
    setConformanceCache(v1, t)
    setConformanceCache(v2, t)
    expect(getConformanceCache(t)).toBe(v2)
  })

  it('setConformanceCache + getConformanceCache use Date.now() default for the now arg', () => {
    // Round-trip with omitted now — exercises the default-parameter path. We
    // call set then immediately get; even with clock skew the gap is << TTL_MS.
    const value = makeFakeResponse()
    setConformanceCache(value)
    expect(getConformanceCache()).toBe(value)
  })
})

describe('getOrComputeConformance (inflight singleton)', () => {
  beforeEach(() => {
    _resetConformanceCacheForTests()
  })

  it('cache hit short-circuits: compute is not invoked', async () => {
    const value = makeFakeResponse()
    const t = Date.now()
    setConformanceCache(value, t)
    const compute = vi.fn(async () => makeFakeResponse())
    const result = await getOrComputeConformance(compute, t)
    expect(result).toBe(value)
    expect(compute).not.toHaveBeenCalled()
  })

  it('cold cache: compute runs once and result is cached for subsequent calls', async () => {
    const value = makeFakeResponse()
    const compute = vi.fn(async () => value)
    const first = await getOrComputeConformance(compute)
    const second = await getOrComputeConformance(compute)
    expect(first).toBe(value)
    expect(second).toBe(value)
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it('concurrent cold-cache callers share a single compute promise', async () => {
    // Deferred promise so all N callers reach the inflight slot before resolve.
    let resolve!: (v: ConformanceResponse) => void
    const shared = new Promise<ConformanceResponse>((r) => {
      resolve = r
    })
    const compute = vi.fn(() => shared)
    const N = 4
    const inflightCalls = Array.from({ length: N }, () =>
      getOrComputeConformance(compute),
    )
    resolve(makeFakeResponse())
    const results = await Promise.all(inflightCalls)
    expect(compute).toHaveBeenCalledTimes(1)
    // All callers receive the same resolved value (referential equality).
    for (const r of results) expect(r).toBe(results[0])
  })

  it('failed compute does NOT cache the failure — next call retries with a fresh compute', async () => {
    const compute = vi
      .fn<() => Promise<ConformanceResponse>>()
      .mockRejectedValueOnce(new Error('compute exploded'))
      .mockResolvedValueOnce(makeFakeResponse())
    await expect(getOrComputeConformance(compute)).rejects.toThrow(
      'compute exploded',
    )
    // Without the `inflight = null` reset in finally{}, the second call would
    // get the SAME rejected promise instead of triggering a fresh compute.
    const second = await getOrComputeConformance(compute)
    expect(second).toMatchObject({ schemaVersion: 1 })
    expect(compute).toHaveBeenCalledTimes(2)
  })

  it('invalidateConformanceCache during inflight does not prevent the inflight from settling', async () => {
    // Mid-scan cache invalidation (e.g. fix-path route) must not kill the
    // currently-running compute. The inflight promise still resolves and
    // populates the next 30s window with fresh data.
    let resolve!: (v: ConformanceResponse) => void
    const compute = vi.fn(
      () =>
        new Promise<ConformanceResponse>((r) => {
          resolve = r
        }),
    )
    const pending = getOrComputeConformance(compute)
    invalidateConformanceCache()
    const fresh = makeFakeResponse()
    resolve(fresh)
    expect(await pending).toBe(fresh)
    expect(getConformanceCache(Date.now())).toBe(fresh)
  })
})
