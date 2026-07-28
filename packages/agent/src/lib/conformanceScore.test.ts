import { describe, expect, it } from 'vitest'
import type {
  CoverageFamily,
  CoverageResponse,
  CoverageRow,
  CoverageState,
} from '@agenticapps/dashboard-shared'

import { _scoreRowsForTests, computeConformanceScores } from './conformanceScore.js'

function row(
  family: CoverageFamily,
  repo: string,
  claudeMd: CoverageState,
  workflowVersion: CoverageState,
): CoverageRow {
  return {
    family,
    repo,
    claudeMd: { kind: 'basic', state: claudeMd },
    workflowVersion: {
      kind: 'workflow',
      state: workflowVersion,
      installedVersion: null,
      headVersion: null,
    },
    understand: { kind: 'basic', state: 'missing' },
    overrideCount: 0,
    overrides: [],
    inRegistry: true,
  }
}

function coverage(rows: CoverageRow[]): CoverageResponse {
  return {
    schemaVersion: 2,
    generatedAtIso: '2026-07-28T00:00:00.000Z',
    workflowHeadVersion: '3.0.0',
    rows,
  }
}

describe('two-field conformance scoring', () => {
  it('returns a stable zero shape for an empty fleet', () => {
    expect(_scoreRowsForTests([])).toEqual({
      green: 0,
      amber: 0,
      red: 0,
      total: 0,
      score: 0,
    })
  })

  it('counts exactly CLAUDE.md and workflow', () => {
    expect(
      _scoreRowsForTests([
        row('agenticapps', 'repo', 'fresh', 'missing'),
      ]),
    ).toEqual({
      green: 1,
      amber: 0,
      red: 1,
      total: 2,
      score: 50,
    })
  })

  it('counts stale as amber and rounds to an integer', () => {
    expect(
      _scoreRowsForTests([
        row('agenticapps', 'one', 'fresh', 'fresh'),
        row('agenticapps', 'two', 'stale', 'missing'),
      ]),
    ).toEqual({
      green: 2,
      amber: 1,
      red: 1,
      total: 4,
      score: 50,
    })
  })

  it('rounds fractional percentages to the nearest integer', () => {
    const result = _scoreRowsForTests([
      row('agenticapps', 'one', 'fresh', 'missing'),
      row('agenticapps', 'two', 'missing', 'missing'),
      row('agenticapps', 'three', 'missing', 'missing'),
    ])

    expect(result).toEqual({
      green: 1,
      amber: 0,
      red: 5,
      total: 6,
      score: 17,
    })
  })

  it('excludes drifted repos before scoring', () => {
    const result = computeConformanceScores(
      coverage([
        row('agenticapps', 'healthy', 'fresh', 'fresh'),
        row('agenticapps', 'drifted', 'missing', 'missing'),
      ]),
      new Set(['agenticapps/drifted']),
    )

    expect(result.agenticapps.score).toBe(100)
    expect(result.agenticapps.total).toBe(2)
  })

  it('uses the mean of populated family scores for the fleet', () => {
    const result = computeConformanceScores(
      coverage([
        row('agenticapps', 'aa', 'fresh', 'fresh'),
        row('factiv', 'fx', 'missing', 'missing'),
        row('neuroflash', 'nf', 'fresh', 'fresh'),
      ]),
      new Set(),
    )

    expect(result.fleet.score).toBe(67)
    expect(result.fleet.green).toBe(
      result.agenticapps.green + result.factiv.green + result.neuroflash.green,
    )
    expect(result.fleet.total).toBe(
      result.agenticapps.total + result.factiv.total + result.neuroflash.total,
    )
  })

  it('does not penalise families with no rows', () => {
    const result = computeConformanceScores(
      coverage([row('agenticapps', 'aa', 'fresh', 'fresh')]),
      new Set(),
    )

    expect(result.fleet.score).toBe(100)
  })
})
