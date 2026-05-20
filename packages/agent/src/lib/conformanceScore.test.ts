/**
 * conformanceScore.test.ts — pure score computation primitive (D-12-03/05/06/07).
 *
 * Plan 12-01 Task 1 (RED first).
 *
 * Load-bearing correctness invariants pinned by this suite:
 *   - Pitfall 2 (RESEARCH §): `not-applicable` cells are excluded from BOTH
 *     numerator AND denominator. GitNexus-not-installed must not pollute scores.
 *   - Pitfall 3 / A8: fleet aggregate is the MEAN of 3 family scores, NOT
 *     sum-over-rows. The discriminator fixture (100, 0, 100 → 67) proves this:
 *     sum-over-rows on a 30/5/5 layout would give ~88; mean-of-3 gives 67.
 *   - D-12-05: scores are integers (Math.round → 0..100).
 *   - D-12-07: drifted repo IDs are filtered from per-family denominators.
 *
 * Fixture helpers below construct CoverageRow objects in-place; no scanners
 * or filesystem touches — the primitive is pure.
 */

import { describe, expect, it } from 'vitest'

import type {
  CoverageBasicColumnSchema,
  CoverageRow,
  CoverageState,
  CoverageWorkflowColumnSchema,
} from '@agenticapps/dashboard-shared'
import type { z } from 'zod'

import { _scoreRowsForTests, computeConformanceScores } from './conformanceScore.js'

type BasicCol = z.infer<typeof CoverageBasicColumnSchema>
type WorkflowCol = z.infer<typeof CoverageWorkflowColumnSchema>

function basic(state: CoverageState): BasicCol {
  return { kind: 'basic', state }
}

function workflow(state: CoverageState): WorkflowCol {
  return {
    kind: 'workflow',
    state,
    installedVersion: null,
    headVersion: null,
  }
}

type Family = 'agenticapps' | 'factiv' | 'neuroflash'

interface RowSpec {
  family?: Family
  repo?: string
  claudeMd: CoverageState
  gitNexus: CoverageState
  wiki: CoverageState
  workflowVersion: CoverageState
}

function row(spec: RowSpec): CoverageRow {
  return {
    family: spec.family ?? 'agenticapps',
    repo: spec.repo ?? 'r1',
    claudeMd: basic(spec.claudeMd),
    gitNexus: basic(spec.gitNexus),
    wiki: basic(spec.wiki),
    workflowVersion: workflow(spec.workflowVersion),
    overrideCount: 0,
    overrides: [],
  }
}

function allFresh(family: Family, repo: string): CoverageRow {
  return row({
    family,
    repo,
    claudeMd: 'fresh',
    gitNexus: 'fresh',
    wiki: 'fresh',
    workflowVersion: 'fresh',
  })
}

function allMissing(family: Family, repo: string): CoverageRow {
  return row({
    family,
    repo,
    claudeMd: 'missing',
    gitNexus: 'missing',
    wiki: 'missing',
    workflowVersion: 'missing',
  })
}

function coverage(rows: CoverageRow[]) {
  return {
    schemaVersion: 1 as const,
    generatedAtIso: '2026-05-20T00:00:00.000Z',
    gitNexusInstallState: 'installed-with-registry' as const,
    workflowHeadVersion: '0.0.1',
    rows,
  }
}

describe('scoreRows — internal helper', () => {
  it('empty rows array → {green:0, amber:0, red:0, total:0, score:0}', () => {
    expect(_scoreRowsForTests([])).toEqual({
      green: 0,
      amber: 0,
      red: 0,
      total: 0,
      score: 0,
    })
  })

  it('all 4 cells fresh → score 100', () => {
    const result = _scoreRowsForTests([allFresh('agenticapps', 'r1')])
    expect(result).toEqual({
      green: 4,
      amber: 0,
      red: 0,
      total: 4,
      score: 100,
    })
  })

  it('all 4 cells missing → score 0', () => {
    const result = _scoreRowsForTests([allMissing('agenticapps', 'r1')])
    expect(result).toEqual({
      green: 0,
      amber: 0,
      red: 4,
      total: 4,
      score: 0,
    })
  })

  it('2 fresh + 2 missing → score 50', () => {
    const result = _scoreRowsForTests([
      row({
        claudeMd: 'fresh',
        gitNexus: 'fresh',
        wiki: 'missing',
        workflowVersion: 'missing',
      }),
    ])
    expect(result.score).toBe(50)
    expect(result).toEqual({ green: 2, amber: 0, red: 2, total: 4, score: 50 })
  })

  it('3 fresh + 1 stale → score 75', () => {
    const result = _scoreRowsForTests([
      row({
        claudeMd: 'fresh',
        gitNexus: 'fresh',
        wiki: 'fresh',
        workflowVersion: 'stale',
      }),
    ])
    expect(result).toEqual({ green: 3, amber: 1, red: 0, total: 4, score: 75 })
  })

  it('not-applicable cells excluded from numerator AND denominator (Pitfall 2)', () => {
    // 2 not-applicable + 2 fresh → score 100 (not 50). Denominator = 2, not 4.
    const result = _scoreRowsForTests([
      row({
        claudeMd: 'not-applicable',
        gitNexus: 'not-applicable',
        wiki: 'fresh',
        workflowVersion: 'fresh',
      }),
    ])
    expect(result).toEqual({
      green: 2,
      amber: 0,
      red: 0,
      total: 2,
      score: 100,
    })
  })

  it('GitNexus column all not-applicable + others all fresh → score 100 (Pitfall 2 fleet case)', () => {
    // Simulates the gitNexusInstallState=not-installed case: every row has
    // gitNexus not-applicable while the other 3 columns are fresh. Score
    // must be 100 (3/3 of the applicable cells), not 75 (which would be the
    // bug if not-applicable counted as missing in the denominator).
    const rows = [
      row({
        repo: 'r1',
        claudeMd: 'fresh',
        gitNexus: 'not-applicable',
        wiki: 'fresh',
        workflowVersion: 'fresh',
      }),
      row({
        repo: 'r2',
        claudeMd: 'fresh',
        gitNexus: 'not-applicable',
        wiki: 'fresh',
        workflowVersion: 'fresh',
      }),
    ]
    const result = _scoreRowsForTests(rows)
    expect(result).toEqual({
      green: 6,
      amber: 0,
      red: 0,
      total: 6,
      score: 100,
    })
  })

  it('1 of 10 green → score 10', () => {
    // 10 cells: 1 fresh + 9 missing across ~3 rows
    const rows = [
      row({
        claudeMd: 'fresh',
        gitNexus: 'missing',
        wiki: 'missing',
        workflowVersion: 'missing',
      }),
      row({
        claudeMd: 'missing',
        gitNexus: 'missing',
        wiki: 'missing',
        workflowVersion: 'missing',
      }),
      // Need 2 more cells to land on 10 total — use not-applicable to pad
      // the row but only count 2 of its cells.
      row({
        claudeMd: 'missing',
        gitNexus: 'missing',
        wiki: 'not-applicable',
        workflowVersion: 'not-applicable',
      }),
    ]
    const result = _scoreRowsForTests(rows)
    expect(result.total).toBe(10)
    expect(result.green).toBe(1)
    expect(result.score).toBe(10)
  })

  it('7 of 10 green → score 70', () => {
    const rows = [
      row({
        claudeMd: 'fresh',
        gitNexus: 'fresh',
        wiki: 'fresh',
        workflowVersion: 'fresh',
      }),
      row({
        claudeMd: 'fresh',
        gitNexus: 'fresh',
        wiki: 'fresh',
        workflowVersion: 'missing',
      }),
      row({
        claudeMd: 'missing',
        gitNexus: 'missing',
        wiki: 'not-applicable',
        workflowVersion: 'not-applicable',
      }),
    ]
    const result = _scoreRowsForTests(rows)
    expect(result.total).toBe(10)
    expect(result.green).toBe(7)
    expect(result.score).toBe(70)
  })
})

describe('computeConformanceScores — D-12-06 / D-12-07 + Pitfall 3 fleet aggregation', () => {
  it('empty CoverageResponse → all families 0/0/0/0/0', () => {
    const result = computeConformanceScores(coverage([]), new Set())
    expect(result.agenticapps).toEqual({
      green: 0,
      amber: 0,
      red: 0,
      total: 0,
      score: 0,
    })
    expect(result.factiv).toEqual({
      green: 0,
      amber: 0,
      red: 0,
      total: 0,
      score: 0,
    })
    expect(result.neuroflash).toEqual({
      green: 0,
      amber: 0,
      red: 0,
      total: 0,
      score: 0,
    })
    expect(result.fleet).toEqual({
      green: 0,
      amber: 0,
      red: 0,
      total: 0,
      score: 0,
    })
  })

  it('fleet = mean of 3 family scores (Pitfall 3 / A8 — NOT sum-over-rows)', () => {
    // Discriminator fixture: 30 agenticapps fresh + 5 factiv missing + 5 neuroflash fresh.
    // Per-family scores:  agenticapps 100, factiv 0, neuroflash 100.
    // Mean-of-3 → round((100 + 0 + 100) / 3) = round(66.67) = 67.
    // Sum-over-rows would be: green = 30*4 + 0 + 5*4 = 140 of 160 cells = 87.5 → 88.
    // The expected value 67 (NOT 88) proves the mean-of-3 contract.
    const rows: CoverageRow[] = []
    for (let i = 0; i < 30; i += 1) {
      rows.push(allFresh('agenticapps', `aa-${i}`))
    }
    for (let i = 0; i < 5; i += 1) {
      rows.push(allMissing('factiv', `fv-${i}`))
    }
    for (let i = 0; i < 5; i += 1) {
      rows.push(allFresh('neuroflash', `nf-${i}`))
    }

    const result = computeConformanceScores(coverage(rows), new Set())

    expect(result.agenticapps.score).toBe(100)
    expect(result.factiv.score).toBe(0)
    expect(result.neuroflash.score).toBe(100)
    // CRITICAL: 67 (mean-of-3), NOT 88 (sum-over-rows).
    expect(result.fleet.score).toBe(67)
    expect(result.fleet.score).not.toBe(88)
  })

  it('drifted repo IDs excluded from per-family denominator (D-12-07)', () => {
    // 2 agenticapps repos: r1 all fresh, r2 all missing.
    // If both counted: score = 4/8 = 50.
    // If r2 is in driftedSet: score = 4/4 = 100.
    const rows = [
      allFresh('agenticapps', 'r1'),
      allMissing('agenticapps', 'r2'),
    ]
    const drifted = new Set(['agenticapps/r2'])

    const result = computeConformanceScores(coverage(rows), drifted)

    expect(result.agenticapps.total).toBe(4)
    expect(result.agenticapps.green).toBe(4)
    expect(result.agenticapps.score).toBe(100)
  })

  it('fleet.green/amber/red are sum across 3 families (display fields)', () => {
    const rows = [
      row({
        family: 'agenticapps',
        repo: 'r1',
        claudeMd: 'fresh',
        gitNexus: 'stale',
        wiki: 'missing',
        workflowVersion: 'fresh',
      }),
      row({
        family: 'factiv',
        repo: 'r1',
        claudeMd: 'fresh',
        gitNexus: 'fresh',
        wiki: 'stale',
        workflowVersion: 'missing',
      }),
      row({
        family: 'neuroflash',
        repo: 'r1',
        claudeMd: 'missing',
        gitNexus: 'stale',
        wiki: 'fresh',
        workflowVersion: 'fresh',
      }),
    ]

    const result = computeConformanceScores(coverage(rows), new Set())

    // Per-family: aa = 2g/1a/1r, factiv = 2g/1a/1r, neuroflash = 2g/1a/1r.
    expect(result.fleet.green).toBe(
      result.agenticapps.green + result.factiv.green + result.neuroflash.green,
    )
    expect(result.fleet.amber).toBe(
      result.agenticapps.amber + result.factiv.amber + result.neuroflash.amber,
    )
    expect(result.fleet.red).toBe(
      result.agenticapps.red + result.factiv.red + result.neuroflash.red,
    )
    expect(result.fleet.total).toBe(
      result.agenticapps.total + result.factiv.total + result.neuroflash.total,
    )
  })

  it('returns integer score (no decimals — D-12-05)', () => {
    // 1 of 3 green per family → score 33 (not 33.333…).
    const rows = [
      row({
        family: 'agenticapps',
        repo: 'r1',
        claudeMd: 'fresh',
        gitNexus: 'missing',
        wiki: 'missing',
        workflowVersion: 'not-applicable',
      }),
      row({
        family: 'factiv',
        repo: 'r1',
        claudeMd: 'fresh',
        gitNexus: 'missing',
        wiki: 'missing',
        workflowVersion: 'not-applicable',
      }),
      row({
        family: 'neuroflash',
        repo: 'r1',
        claudeMd: 'fresh',
        gitNexus: 'missing',
        wiki: 'missing',
        workflowVersion: 'not-applicable',
      }),
    ]

    const result = computeConformanceScores(coverage(rows), new Set())

    expect(Number.isInteger(result.agenticapps.score)).toBe(true)
    expect(Number.isInteger(result.factiv.score)).toBe(true)
    expect(Number.isInteger(result.neuroflash.score)).toBe(true)
    expect(Number.isInteger(result.fleet.score)).toBe(true)
    expect(result.agenticapps.score).toBe(33)
    expect(result.fleet.score).toBe(33)
  })

  it('single-family install: empty families excluded from fleet divisor (NOT (X+0+0)/3)', () => {
    // Regression for the fleet-score collapse. A user with only agenticapps
    // registered (no factiv, no neuroflash repos) should see fleet === 100
    // when agenticapps is 100, NOT round((100+0+0)/3) = 33.
    // factiv + neuroflash families have ZERO rows; they are not-applicable
    // for the fleet roll-up.
    const rows = [allFresh('agenticapps', 'r1')]
    const result = computeConformanceScores(coverage(rows), new Set())
    expect(result.agenticapps.score).toBe(100)
    expect(result.factiv.total).toBe(0)
    expect(result.neuroflash.total).toBe(0)
    // CRITICAL: fleet = mean over POPULATED families (1) = 100.
    expect(result.fleet.score).toBe(100)
    expect(result.fleet.score).not.toBe(33)
  })

  it('two populated families: fleet = mean of the two, not divided by 3', () => {
    // agenticapps 100% + factiv 50%, neuroflash empty.
    // Old (broken): round((100 + 50 + 0) / 3) = 50.
    // New (fixed): round((100 + 50) / 2) = 75.
    const rows = [
      allFresh('agenticapps', 'r1'),
      allFresh('factiv', 'r1'),
      allMissing('factiv', 'r2'),
    ]
    const result = computeConformanceScores(coverage(rows), new Set())
    expect(result.agenticapps.score).toBe(100)
    expect(result.factiv.score).toBe(50)
    expect(result.neuroflash.total).toBe(0)
    expect(result.fleet.score).toBe(75)
  })

  it('all rows drifted → fleet score 0 (no applicable rows)', () => {
    const rows = [
      allFresh('agenticapps', 'r1'),
      allFresh('factiv', 'r1'),
      allFresh('neuroflash', 'r1'),
    ]
    const drifted = new Set([
      'agenticapps/r1',
      'factiv/r1',
      'neuroflash/r1',
    ])

    const result = computeConformanceScores(coverage(rows), drifted)

    expect(result.agenticapps.total).toBe(0)
    expect(result.factiv.total).toBe(0)
    expect(result.neuroflash.total).toBe(0)
    expect(result.fleet.score).toBe(0)
  })

  it('all cells not-applicable across the fleet → all scores 0, no NaN', () => {
    const rows = [
      row({
        family: 'agenticapps',
        repo: 'r1',
        claudeMd: 'not-applicable',
        gitNexus: 'not-applicable',
        wiki: 'not-applicable',
        workflowVersion: 'not-applicable',
      }),
    ]

    const result = computeConformanceScores(coverage(rows), new Set())

    expect(result.agenticapps).toEqual({
      green: 0,
      amber: 0,
      red: 0,
      total: 0,
      score: 0,
    })
    expect(result.fleet.score).toBe(0)
    expect(Number.isFinite(result.fleet.score)).toBe(true)
  })

  it('per-family aggregation respects family field (no cross-contamination)', () => {
    const rows = [
      allFresh('agenticapps', 'r1'),
      allMissing('factiv', 'r1'),
      allFresh('neuroflash', 'r1'),
    ]

    const result = computeConformanceScores(coverage(rows), new Set())

    expect(result.agenticapps.score).toBe(100)
    expect(result.factiv.score).toBe(0)
    expect(result.neuroflash.score).toBe(100)
  })
})
