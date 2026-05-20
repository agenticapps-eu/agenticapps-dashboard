/**
 * conformanceCache.test.ts — 30s TTL singleton memo for /api/observability/conformance.
 *
 * Plan 12-02 Task 1 (RED first). Mirrors coverageCache.test.ts structure verbatim —
 * type swap CoverageResponse → ConformanceResponse. D-12-17 / Pattern 2 in 12-RESEARCH.md.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getConformanceCache,
  setConformanceCache,
  invalidateConformanceCache,
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
