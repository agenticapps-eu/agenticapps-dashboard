import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { ProjectOverview } from '@agenticapps/dashboard-shared'

import { getCached, setCached, evict, _resetForTests } from './overviewCache.js'

const sampleOverview: ProjectOverview = {
  phaseStatus: 'In Progress',
  stage1: null,
  stage2: null,
  dbAudit: null,
  tdd: null,
  verification: null,
  branch: 'main',
  markers: { gitRepo: true, planning: true, claudeSkills: false },
}

beforeEach(() => {
  _resetForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getCached', () => {
  it('returns null for an unknown id', () => {
    expect(getCached('unknown')).toBeNull()
  })
})

describe('setCached + getCached', () => {
  it('returns the value immediately after set (within TTL)', () => {
    const now = Date.now()
    setCached('proj-1', sampleOverview, now)
    const result = getCached('proj-1', now + 100)
    expect(result).not.toBeNull()
    expect(result?.branch).toBe('main')
  })

  it('returns null and deletes entry after 5001ms (lazy expiry)', () => {
    vi.useFakeTimers()
    const now = Date.now()
    setCached('proj-1', sampleOverview, now)
    vi.advanceTimersByTime(5_001)
    const result = getCached('proj-1', now + 5_001)
    expect(result).toBeNull()
    // Entry should have been deleted (second getCached also returns null)
    expect(getCached('proj-1', now + 5_001)).toBeNull()
  })
})

describe('evict', () => {
  it('removes entry so getCached returns null', () => {
    const now = Date.now()
    setCached('proj-2', sampleOverview, now)
    evict('proj-2')
    expect(getCached('proj-2', now + 100)).toBeNull()
  })
})
