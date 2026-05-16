/**
 * skillDriftCache.test.ts — 30s single-key memo for /api/skills/drift.
 *
 * Plan 11-03 Task 1 (RED first).
 *
 * Mirrors Phase 10's coverageCache 30s cadence + the get/set/clear pattern.
 */
import { afterEach, describe, expect, it } from 'vitest'

import {
  clearSkillDriftCache,
  getSkillDriftCached,
  setSkillDriftCached,
} from './skillDriftCache.js'

import type { SkillDriftResponse } from '@agenticapps/dashboard-shared'

function sample(): SkillDriftResponse {
  return {
    schemaVersion: 1,
    generatedAtIso: new Date().toISOString(),
    projects: [],
    rows: [],
  }
}

describe('skillDriftCache', () => {
  afterEach(() => {
    clearSkillDriftCache()
  })

  it('Test 18: getSkillDriftCached(now) returns undefined initially', () => {
    expect(getSkillDriftCached(0)).toBeUndefined()
  })

  it('Test 19: after setSkillDriftCached(value, now), getSkillDriftCached(now) returns the value', () => {
    const value = sample()
    setSkillDriftCached(value, 0)
    expect(getSkillDriftCached(0)).toEqual(value)
  })

  it('Test 20: TTL — setting at t=0, getting at t=30s+1ms returns undefined', () => {
    const value = sample()
    setSkillDriftCached(value, 0)
    expect(getSkillDriftCached(30_001)).toBeUndefined()
  })

  it('Test 21: TTL — setting at t=0, getting at t=29s returns the value', () => {
    const value = sample()
    setSkillDriftCached(value, 0)
    expect(getSkillDriftCached(29_000)).toEqual(value)
  })

  it('Test 22: clearSkillDriftCache() empties the memo', () => {
    const value = sample()
    setSkillDriftCached(value, 0)
    expect(getSkillDriftCached(0)).toEqual(value)
    clearSkillDriftCache()
    expect(getSkillDriftCached(0)).toBeUndefined()
  })
})
