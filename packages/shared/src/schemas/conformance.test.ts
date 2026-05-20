/**
 * conformance.test.ts — Phase 12 wire schema (D-12-14/15/16).
 *
 * RED-first: assertions describe the expected shape BEFORE conformance.ts is
 * written. Mirrors `coverageHistory.test.ts` structure (Zod round-trip +
 * boundary + reject-extra-keys). Source of truth for both daemon and SPA.
 */

import { describe, it, expect } from 'vitest'

import {
  ConformanceTierSchema,
  tierOf,
  ConformanceDayPointSchema,
  PathDriftEntrySchema,
  ConformanceResponseSchema,
  RegistryFixPathRequestSchema,
} from './conformance.js'

// Reusable valid day-point fixture — single source of truth for the suite.
const validDayPoint = {
  date: '2026-05-19',
  fleet: 87,
  agenticapps: 90,
  factiv: 80,
  neuroflash: 92,
}

const validToday = {
  asOf: '2026-05-19T12:00:00.000Z',
  fleet: 87,
  agenticapps: 90,
  factiv: 80,
  neuroflash: 92,
}

const validDelta14d = {
  fleet: 2,
  agenticapps: -3,
  factiv: 5,
  neuroflash: 0,
}

const validResponse = {
  schemaVersion: 1 as const,
  today: validToday,
  delta14d: validDelta14d,
  series: [validDayPoint],
  drifted: [],
}

describe('ConformanceTierSchema', () => {
  it('accepts each of the 3 tier values (green/amber/red)', () => {
    expect(ConformanceTierSchema.safeParse('green').success).toBe(true)
    expect(ConformanceTierSchema.safeParse('amber').success).toBe(true)
    expect(ConformanceTierSchema.safeParse('red').success).toBe(true)
  })

  it('rejects unknown tier values', () => {
    expect(ConformanceTierSchema.safeParse('gray').success).toBe(false)
    expect(ConformanceTierSchema.safeParse('yellow').success).toBe(false)
    expect(ConformanceTierSchema.safeParse('').success).toBe(false)
  })
})

describe('tierOf (D-12-04 boundary mapping)', () => {
  // 7 boundary assertions per plan behaviour spec.
  it('0 → red', () => {
    expect(tierOf(0)).toBe('red')
  })
  it('50 → red', () => {
    expect(tierOf(50)).toBe('red')
  })
  it('69 → red (below amber floor)', () => {
    expect(tierOf(69)).toBe('red')
  })
  it('70 → amber (amber floor inclusive)', () => {
    expect(tierOf(70)).toBe('amber')
  })
  it('89 → amber (below green floor)', () => {
    expect(tierOf(89)).toBe('amber')
  })
  it('90 → green (green floor inclusive)', () => {
    expect(tierOf(90)).toBe('green')
  })
  it('100 → green (top of range)', () => {
    expect(tierOf(100)).toBe('green')
  })
})

describe('ScoreSchema (inline via ConformanceDayPointSchema)', () => {
  it('accepts boundary scores 0 and 100', () => {
    expect(
      ConformanceDayPointSchema.safeParse({ ...validDayPoint, fleet: 0 }).success,
    ).toBe(true)
    expect(
      ConformanceDayPointSchema.safeParse({ ...validDayPoint, fleet: 100 }).success,
    ).toBe(true)
  })

  it('rejects scores outside 0-100', () => {
    expect(
      ConformanceDayPointSchema.safeParse({ ...validDayPoint, fleet: -1 }).success,
    ).toBe(false)
    expect(
      ConformanceDayPointSchema.safeParse({ ...validDayPoint, fleet: 101 }).success,
    ).toBe(false)
  })

  it('rejects non-integer scores (D-12-05)', () => {
    expect(
      ConformanceDayPointSchema.safeParse({ ...validDayPoint, fleet: 87.5 }).success,
    ).toBe(false)
  })

  it('rejects string scores', () => {
    expect(
      ConformanceDayPointSchema.safeParse({ ...validDayPoint, fleet: '87' }).success,
    ).toBe(false)
  })
})

describe('ConformanceDayPointSchema', () => {
  it('accepts a valid 5-field day point', () => {
    const result = ConformanceDayPointSchema.safeParse(validDayPoint)
    expect(result.success).toBe(true)
  })

  it('rejects extra keys (.strict() wire-drift guard)', () => {
    const result = ConformanceDayPointSchema.safeParse({
      ...validDayPoint,
      foo: 'bar',
    })
    expect(result.success).toBe(false)
  })

  it('rejects malformed date strings', () => {
    expect(
      ConformanceDayPointSchema.safeParse({ ...validDayPoint, date: 'not-iso' }).success,
    ).toBe(false)
    expect(
      ConformanceDayPointSchema.safeParse({ ...validDayPoint, date: '2026-5-19' }).success,
    ).toBe(false)
    expect(
      ConformanceDayPointSchema.safeParse({ ...validDayPoint, date: '20260519' }).success,
    ).toBe(false)
  })
})

describe('PathDriftEntrySchema', () => {
  const validEntry = {
    id: 'foo',
    storedPath: '/abs/path',
    suggestedPath: '/abs/new-path',
    reason: 'missing' as const,
  }

  it('accepts each of the 3 reason enum values', () => {
    expect(
      PathDriftEntrySchema.safeParse({ ...validEntry, reason: 'missing' }).success,
    ).toBe(true)
    expect(
      PathDriftEntrySchema.safeParse({ ...validEntry, reason: 'symlink-target-changed' })
        .success,
    ).toBe(true)
    expect(
      PathDriftEntrySchema.safeParse({ ...validEntry, reason: 'git-remote-changed' }).success,
    ).toBe(true)
  })

  it('accepts suggestedPath null (D-12-21 inference failure)', () => {
    expect(
      PathDriftEntrySchema.safeParse({ ...validEntry, suggestedPath: null }).success,
    ).toBe(true)
  })

  it('rejects unknown reason values', () => {
    expect(
      PathDriftEntrySchema.safeParse({ ...validEntry, reason: 'something-else' }).success,
    ).toBe(false)
  })

  it('rejects extra keys (.strict() wire-drift guard)', () => {
    expect(
      PathDriftEntrySchema.safeParse({ ...validEntry, extra: 'nope' }).success,
    ).toBe(false)
  })
})

describe('ConformanceResponseSchema', () => {
  it('accepts a 1-entry-series payload (warm-up state)', () => {
    const result = ConformanceResponseSchema.safeParse(validResponse)
    expect(result.success).toBe(true)
  })

  it('accepts a full 90-entry-series payload (steady state)', () => {
    const series = Array.from({ length: 90 }, (_, i) => ({
      ...validDayPoint,
      // increment day-of-month label so each entry is structurally distinct
      date: `2026-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    }))
    const result = ConformanceResponseSchema.safeParse({
      ...validResponse,
      series,
    })
    expect(result.success).toBe(true)
  })

  it('accepts a 0-entry-series payload (cold-start, D-12-13 empty state)', () => {
    const result = ConformanceResponseSchema.safeParse({
      ...validResponse,
      series: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects schemaVersion !== 1', () => {
    const result = ConformanceResponseSchema.safeParse({
      ...validResponse,
      schemaVersion: 2,
    })
    expect(result.success).toBe(false)
  })

  it('rejects extra top-level keys (.strict() wire-drift guard)', () => {
    const result = ConformanceResponseSchema.safeParse({
      ...validResponse,
      extraField: 'unexpected',
    })
    expect(result.success).toBe(false)
  })

  it('rejects asOf that is not a datetime', () => {
    const result = ConformanceResponseSchema.safeParse({
      ...validResponse,
      today: { ...validToday, asOf: 'not-a-datetime' },
    })
    expect(result.success).toBe(false)
  })

  it('round-trips a valid payload through parse() preserving shape', () => {
    const parsed = ConformanceResponseSchema.parse(validResponse)
    expect(parsed).toEqual(validResponse)
  })
})

describe('RegistryFixPathRequestSchema', () => {
  const validReq = { id: 'project-x', newPath: '/abs/path' }

  it('accepts a valid request', () => {
    expect(RegistryFixPathRequestSchema.safeParse(validReq).success).toBe(true)
  })

  it('rejects empty id', () => {
    expect(
      RegistryFixPathRequestSchema.safeParse({ ...validReq, id: '' }).success,
    ).toBe(false)
  })

  it('rejects empty newPath', () => {
    expect(
      RegistryFixPathRequestSchema.safeParse({ ...validReq, newPath: '' }).success,
    ).toBe(false)
  })

  it('rejects extra keys (.strict() wire-drift guard)', () => {
    expect(
      RegistryFixPathRequestSchema.safeParse({ ...validReq, extra: 'foo' }).success,
    ).toBe(false)
  })
})
