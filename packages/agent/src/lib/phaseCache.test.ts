import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  getPhaseCache,
  setPhaseCache,
  evictPhaseCacheProject,
  _resetForTests,
} from './phaseCache.js'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  _resetForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getPhaseCache', () => {
  it('C3: returns null for an unknown key without throwing', () => {
    expect(getPhaseCache('unknown:key')).toBeNull()
  })
})

describe('setPhaseCache + getPhaseCache', () => {
  it('C1: returns the same value reference immediately after set (within TTL)', () => {
    const payload = { markdown: 'x', sourceFile: 'y' }
    setPhaseCache('acme:commitment', payload)
    const result = getPhaseCache('acme:commitment')
    expect(result).toBe(payload)
  })

  it('C2: returns null after 5001ms (lazy expiry) and deletes entry from store', () => {
    const payload = { markdown: 'x', sourceFile: 'y' }
    setPhaseCache('acme:commitment', payload)
    vi.advanceTimersByTime(5_001)
    const result = getPhaseCache('acme:commitment')
    expect(result).toBeNull()
    // Second read also returns null (entry was deleted on first stale read)
    expect(getPhaseCache('acme:commitment')).toBeNull()
  })

  it('C6: two distinct project IDs with the same route name do NOT collide', () => {
    const payloadA = { project: 'alpha' }
    const payloadB = { project: 'beta' }
    setPhaseCache('alpha:commitment', payloadA)
    setPhaseCache('beta:commitment', payloadB)
    expect(getPhaseCache('alpha:commitment')).toBe(payloadA)
    expect(getPhaseCache('beta:commitment')).toBe(payloadB)
  })
})

describe('evictPhaseCacheProject', () => {
  it('C4: removes all project:* keys while leaving other projects intact', () => {
    setPhaseCache('acme:commitment', { a: 1 })
    setPhaseCache('acme:phase-progress', { b: 2 })
    setPhaseCache('beta:commitment', { c: 3 })
    evictPhaseCacheProject('acme')
    expect(getPhaseCache('acme:commitment')).toBeNull()
    expect(getPhaseCache('acme:phase-progress')).toBeNull()
    expect(getPhaseCache('beta:commitment')).toEqual({ c: 3 })
  })
})

describe('_resetForTests', () => {
  it('C5: empties the store so all keys return null after reset', () => {
    setPhaseCache('acme:commitment', { a: 1 })
    setPhaseCache('beta:observations', { b: 2 })
    _resetForTests()
    expect(getPhaseCache('acme:commitment')).toBeNull()
    expect(getPhaseCache('beta:observations')).toBeNull()
  })
})
