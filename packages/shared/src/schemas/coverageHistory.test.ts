import { describe, expect, it } from 'vitest'

import {
  CoverageCellDriftSchema,
  CoverageDriftDirectionSchema,
  CoverageHistoryResponseSchema,
} from './coverageHistory.js'

const validResponse = {
  schemaVersion: 2,
  repoId: 'agenticapps/agenticapps-dashboard',
  windowDays: 14,
  cells: {
    claudeMd: { direction: 'up', daysSince: 3 },
    workflowVersion: { direction: null, daysSince: null },
  },
}

describe('coverage drift schemas', () => {
  it.each(['up', 'down'])('accepts direction %s', (direction) => {
    expect(CoverageDriftDirectionSchema.safeParse(direction).success).toBe(true)
  })

  it('accepts transition and empty drift cells', () => {
    expect(
      CoverageCellDriftSchema.safeParse({ direction: 'down', daysSince: 0 }).success,
    ).toBe(true)
    expect(
      CoverageCellDriftSchema.safeParse({ direction: null, daysSince: null }).success,
    ).toBe(true)
  })
})

describe('CoverageHistoryResponseSchema', () => {
  it('accepts the strict version-2 two-cell response', () => {
    expect(CoverageHistoryResponseSchema.safeParse(validResponse).success).toBe(true)
  })

  it.each(['gitNexus', 'wiki'])('rejects retired cell %s', (cell) => {
    expect(
      CoverageHistoryResponseSchema.safeParse({
        ...validResponse,
        cells: {
          ...validResponse.cells,
          [cell]: { direction: null, daysSince: null },
        },
      }).success,
    ).toBe(false)
  })

  it('rejects schema version 1 and a non-14-day window', () => {
    expect(
      CoverageHistoryResponseSchema.safeParse({ ...validResponse, schemaVersion: 1 }).success,
    ).toBe(false)
    expect(
      CoverageHistoryResponseSchema.safeParse({ ...validResponse, windowDays: 30 }).success,
    ).toBe(false)
  })
})
