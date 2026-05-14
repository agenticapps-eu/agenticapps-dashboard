/**
 * coverageCache.test.ts — 30s TTL singleton memo for coverage scan results.
 * Plan 03 implements; Plan 01 provided the it.todo placeholders (now replaced).
 *
 * COV-03: 30-second TTL memo with get, set, invalidate, and test-reset.
 * Pattern mirrors overviewCache.ts (single-key variant).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getCoverageCache,
  setCoverageCache,
  invalidateCoverageCache,
  _resetCoverageCacheForTests,
  TTL_MS,
} from './coverageCache.js'
import type { CoverageResponse } from '@agenticapps/dashboard-shared'

// Minimal valid CoverageResponse for test fixtures
function makeFakeResponse(_tag = 'test'): CoverageResponse {
  return {
    schemaVersion: 1,
    generatedAtIso: new Date().toISOString(),
    gitNexusInstallState: 'not-installed',
    workflowHeadVersion: null,
    rows: [],
  }
}

describe('coverageCache', () => {
  beforeEach(() => {
    _resetCoverageCacheForTests()
  })

  it('TTL_MS is exactly 30_000 (COV-03 threshold lock)', () => {
    expect(TTL_MS).toBe(30_000)
  })

  it('initial state: getCoverageCache returns null before any set', () => {
    const result = getCoverageCache(Date.now())
    expect(result).toBeNull()
  })

  it('cache hit within TTL: getCoverageCache returns the stored value', () => {
    const value = makeFakeResponse()
    const t = Date.now()
    setCoverageCache(value, t)
    const result = getCoverageCache(t)
    expect(result).toBe(value)
  })

  it('cache hit at edge of TTL (t + TTL_MS - 1): still returns value', () => {
    const value = makeFakeResponse()
    const t = 1000
    setCoverageCache(value, t)
    expect(getCoverageCache(t + TTL_MS - 1)).toBe(value)
  })

  it('cache miss at TTL boundary (t + TTL_MS): returns null (expiry exclusive)', () => {
    const value = makeFakeResponse()
    const t = 1000
    setCoverageCache(value, t)
    expect(getCoverageCache(t + TTL_MS)).toBeNull()
  })

  it('cache miss after TTL expires (t + 30_001ms): returns null', () => {
    const value = makeFakeResponse()
    const t = 1000
    setCoverageCache(value, t)
    expect(getCoverageCache(t + 30_001)).toBeNull()
  })

  it('invalidateCoverageCache clears entry: getCoverageCache returns null within TTL window', () => {
    const value = makeFakeResponse()
    const t = Date.now()
    setCoverageCache(value, t)
    expect(getCoverageCache(t)).toBe(value)
    invalidateCoverageCache()
    expect(getCoverageCache(t)).toBeNull()
  })

  it('_resetCoverageCacheForTests clears state (test isolation)', () => {
    const value = makeFakeResponse()
    const t = Date.now()
    setCoverageCache(value, t)
    _resetCoverageCacheForTests()
    expect(getCoverageCache(t)).toBeNull()
  })

  it('setCoverageCache replaces previous value on second call', () => {
    const v1 = makeFakeResponse('first')
    const v2 = makeFakeResponse('second')
    const t = 1000
    setCoverageCache(v1, t)
    setCoverageCache(v2, t)
    expect(getCoverageCache(t)).toBe(v2)
  })
})
