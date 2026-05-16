/**
 * coverageHistoryCache.test.ts — 1h Map-keyed memo for /api/coverage/history.
 *
 * Plan 11-02 Task 3 (RED first). Keyed by repoId only (PD-11-02 bulk shape —
 * no cell discriminator since each response carries all four cells).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  getCoverageHistoryCached,
  setCoverageHistoryCached,
  clearCoverageHistoryCache,
} from './coverageHistoryCache.js'

describe('coverageHistoryCache', () => {
  beforeEach(() => {
    clearCoverageHistoryCache()
  })

  it('returns undefined when cache is empty', () => {
    expect(getCoverageHistoryCached('foo/bar')).toBeUndefined()
  })

  it('returns stored value after set', () => {
    const value = { hello: 'world' }
    setCoverageHistoryCached('foo/bar', value)
    expect(getCoverageHistoryCached('foo/bar')).toEqual(value)
  })

  it('different repoIds do not collide', () => {
    const a = { tag: 'a' }
    const b = { tag: 'b' }
    setCoverageHistoryCached('repo/a', a)
    setCoverageHistoryCached('repo/b', b)
    expect(getCoverageHistoryCached('repo/a')).toEqual(a)
    expect(getCoverageHistoryCached('repo/b')).toEqual(b)
  })

  it('TTL: value expires after 1h (3_600_000 ms)', () => {
    const t0 = 1_000_000
    setCoverageHistoryCached('foo', { v: 1 }, t0)
    // Just before expiry: hit
    expect(getCoverageHistoryCached('foo', t0 + 60 * 60 * 1000 - 1)).toEqual({ v: 1 })
    // At expiry: miss (exclusive — same as coverageCache.ts)
    expect(getCoverageHistoryCached('foo', t0 + 60 * 60 * 1000)).toBeUndefined()
    // Past expiry: miss
    expect(getCoverageHistoryCached('foo', t0 + 60 * 60 * 1000 + 1)).toBeUndefined()
  })

  it('clearCoverageHistoryCache empties the map', () => {
    setCoverageHistoryCached('foo', { v: 1 })
    setCoverageHistoryCached('bar', { v: 2 })
    clearCoverageHistoryCache()
    expect(getCoverageHistoryCached('foo')).toBeUndefined()
    expect(getCoverageHistoryCached('bar')).toBeUndefined()
  })
})
