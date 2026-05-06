import { describe, it, expect } from 'vitest'

import {
  PhaseFileStatusSchema,
  ExecutionTimelineEntrySchema,
  ReviewFindingCountsSchema,
  ReviewStatusPayloadSchema,
  VerificationStatusPayloadSchema,
  PhaseProgressResponseSchema,
} from './phaseDetail.js'

describe('PhaseFileStatusSchema', () => {
  it('parses a present file with mtime', () => {
    const input = { name: 'CONTEXT.md', present: true, mtimeIso: '2026-05-06T10:00:00.000Z' }
    expect(PhaseFileStatusSchema.parse(input)).toEqual(input)
  })

  it('parses a missing file with null mtime', () => {
    const input = { name: 'UI-SPEC.md', present: false, mtimeIso: null }
    expect(PhaseFileStatusSchema.parse(input)).toEqual(input)
  })
})

describe('ExecutionTimelineEntrySchema', () => {
  it('parses an incomplete pair with only redCommit', () => {
    const input = {
      taskId: '04-01',
      redCommit: { sha: 'abc123', subject: 'test(04-01): RED', isoDate: '2026-05-06T10:00:00Z' },
      greenCommit: null,
    }
    expect(ExecutionTimelineEntrySchema.parse(input)).toEqual(input)
  })

  it('parses a task with no commits at all (defensive shape)', () => {
    const input = { taskId: '04-01', redCommit: null, greenCommit: null }
    expect(ExecutionTimelineEntrySchema.parse(input)).toEqual(input)
  })
})

describe('ReviewFindingCountsSchema', () => {
  it('parses four-bucket finding counts (critical/high/medium/low)', () => {
    const input = { critical: 0, high: 0, medium: 0, low: 0 }
    expect(ReviewFindingCountsSchema.parse(input)).toEqual(input)
  })

  it('rejects three-bucket shape (red/yellow/green) — proves it is the FOUR-bucket schema', () => {
    expect(() =>
      ReviewFindingCountsSchema.parse({ red: 0, yellow: 0, green: 0 })
    ).toThrow()
  })
})

describe('ReviewStatusPayloadSchema', () => {
  it('parses null/null (no review yet)', () => {
    const input = { stage1: null, stage2: null }
    expect(ReviewStatusPayloadSchema.parse(input)).toEqual(input)
  })

  it('parses stage1 present with findings, stage2 null', () => {
    const input = {
      stage1: { present: true, findings: { critical: 2, high: 1, medium: 4, low: 7 } },
      stage2: null,
    }
    expect(ReviewStatusPayloadSchema.parse(input)).toEqual(input)
  })
})

describe('VerificationStatusPayloadSchema', () => {
  it('parses a verification status with items', () => {
    const input = {
      mustHavesTotal: 9,
      mustHavesEvidenced: 7,
      items: [{ text: 'CI passes', evidenced: true }],
    }
    expect(VerificationStatusPayloadSchema.parse(input)).toEqual(input)
  })
})

describe('PhaseProgressResponseSchema', () => {
  it('parses a no-phase-yet shape (all nulls / empty arrays)', () => {
    const input = {
      phase: null,
      paddedPhase: null,
      files: [],
      tdd: { greenPairs: 0, totalTasks: 0, timeline: [] },
      review: { stage1: null, stage2: null },
      verification: { mustHavesTotal: 0, mustHavesEvidenced: 0, items: [] },
    }
    expect(PhaseProgressResponseSchema.parse(input)).toEqual(input)
  })
})
