/**
 * relativeTime.test.ts — TDD tests for formatRelativeTime utility.
 *
 * Tests RT1–RT7:
 * RT1: 30 seconds → '30s ago'
 * RT2: 5 minutes → '5m ago'
 * RT3: 2 hours → '2h ago'
 * RT4: 3 days → '3d ago'
 * RT5: 60+ days → '60d ago' (cap at days, no weeks/months)
 * RT6: future timestamp (clock skew) → 'just now'
 * RT7: invalid ISO string → 'unknown'
 */
import { describe, expect, it } from 'vitest'

import { formatRelativeTime } from './relativeTime.js'

describe('formatRelativeTime', () => {
  it('RT1: 30 seconds ago returns "30s ago"', () => {
    const now = new Date('2026-05-06T10:00:30Z')
    expect(formatRelativeTime('2026-05-06T10:00:00Z', { now })).toBe('30s ago')
  })

  it('RT2: 5 minutes ago returns "5m ago"', () => {
    const now = new Date('2026-05-06T10:05:00Z')
    expect(formatRelativeTime('2026-05-06T10:00:00Z', { now })).toBe('5m ago')
  })

  it('RT3: 2 hours ago returns "2h ago"', () => {
    const now = new Date('2026-05-06T12:00:00Z')
    expect(formatRelativeTime('2026-05-06T10:00:00Z', { now })).toBe('2h ago')
  })

  it('RT4: 3 days ago returns "3d ago"', () => {
    const now = new Date('2026-05-09T10:00:00Z')
    expect(formatRelativeTime('2026-05-06T10:00:00Z', { now })).toBe('3d ago')
  })

  it('RT5: 60+ days ago returns "60d ago" (cap at days — no weeks/months)', () => {
    const now = new Date('2026-07-05T10:00:00Z')
    expect(formatRelativeTime('2026-05-06T10:00:00Z', { now })).toBe('60d ago')
  })

  it('RT6: future timestamp (1s in the future) returns "just now" (clock skew defense)', () => {
    const now = new Date('2026-05-06T10:00:00Z')
    expect(formatRelativeTime('2026-05-06T10:00:01Z', { now })).toBe('just now')
  })

  it('RT7: invalid ISO string returns "unknown" (defensive — must not crash the panel)', () => {
    expect(formatRelativeTime('not-a-date')).toBe('unknown')
  })
})
