/**
 * snapshotFleetReader.test.ts — daily per-family conformance series over the
 * snapshot retention window (90d post Wave 0).
 *
 * Plan 12-01 Task 2 (RED first).
 *
 * Load-bearing correctness invariants pinned by this suite (mirror the
 * conformanceScore.test.ts contract for the per-day reader path):
 *   - Pitfall 2: `not-applicable` cells excluded from numerator AND denominator.
 *   - Pitfall 3 / A8: fleet score per day = mean of 3 family scores (NOT
 *     sum-over-rows). Discriminator: 100/0/100 → 67 (not 88).
 *   - Resilience: malformed JSON lines + non-snapshot filenames are skipped
 *     silently (matches snapshotReader.ts T-11-02-08 defence pattern).
 *   - Same-day collapse: last record wins per (date, family, repo) — mirrors
 *     snapshotReader.ts:139 Map.set semantics.
 *   - Window cutoff: files older than windowDays are not included in the series.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readDailySeriesForFleet } from './snapshotFleetReader.js'
import { RETENTION_DAYS } from './snapshotPaths.js'

interface SnapshotRecord {
  ts: string
  family: string
  repo: string
  claudeMd: string
  gitNexus: string
  wiki: string
  workflowVersion: string
}

function baseRecord(overrides: Partial<SnapshotRecord> = {}): SnapshotRecord {
  return {
    ts: '2026-05-20T12:00:00.000Z',
    family: 'agenticapps',
    repo: 'r1',
    claudeMd: 'fresh',
    gitNexus: 'fresh',
    wiki: 'fresh',
    workflowVersion: 'fresh',
    ...overrides,
  }
}

function writeSnapshot(
  dir: string,
  date: string,
  records: SnapshotRecord[],
): void {
  const body = records.map((r) => JSON.stringify(r)).join('\n') + '\n'
  writeFileSync(join(dir, `${date}.ndjson`), body)
}

describe('snapshotFleetReader.readDailySeriesForFleet', () => {
  let dir: string
  // Anchor `now` so the windowDays math is deterministic.
  const now = new Date('2026-05-20T12:00:00.000Z')

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agentic-fleet-reader-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns [] when snapshot dir does not exist', async () => {
    const missingDir = join(dir, 'does-not-exist')
    const result = await readDailySeriesForFleet({
      dir: missingDir,
      now,
      windowDays: 90,
    })
    expect(result).toEqual([])
  })

  it('returns 1 entry for 1 day with 1 record per family (all fresh) → fleet 100', async () => {
    writeSnapshot(dir, '2026-05-20', [
      baseRecord({ family: 'agenticapps', repo: 'a1' }),
      baseRecord({ family: 'factiv', repo: 'f1' }),
      baseRecord({ family: 'neuroflash', repo: 'n1' }),
    ])

    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      date: '2026-05-20',
      fleet: 100,
      agenticapps: 100,
      factiv: 100,
      neuroflash: 100,
    })
  })

  it('returns 3 entries sorted chronologically when 3 days of data exist', async () => {
    writeSnapshot(dir, '2026-05-18', [baseRecord({ family: 'agenticapps' })])
    writeSnapshot(dir, '2026-05-19', [baseRecord({ family: 'factiv' })])
    writeSnapshot(dir, '2026-05-20', [baseRecord({ family: 'neuroflash' })])

    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })

    expect(result.map((e) => e.date)).toEqual([
      '2026-05-18',
      '2026-05-19',
      '2026-05-20',
    ])
  })

  it('skips malformed JSON lines silently (no throw, no record)', async () => {
    // Day file: one garbage line, one valid record. The valid record alone
    // is what reaches the score computation; throwing would break the
    // T-11-02-08 bounded-defence contract.
    const validLine = JSON.stringify(
      baseRecord({ family: 'agenticapps', repo: 'a1' }),
    )
    writeFileSync(
      join(dir, '2026-05-20.ndjson'),
      '{not json at all\n' + validLine + '\n',
    )

    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })

    expect(result).toHaveLength(1)
    expect(result[0]?.agenticapps).toBe(100)
  })

  it('skips files outside the windowDays cutoff (older files not in series)', async () => {
    // Anchor: 2026-05-20. windowDays = 7 → cutoff 2026-05-13.
    writeSnapshot(dir, '2026-05-01', [baseRecord()])
    writeSnapshot(dir, '2026-05-19', [baseRecord()])
    writeSnapshot(dir, '2026-05-20', [baseRecord()])

    const result = await readDailySeriesForFleet({ dir, now, windowDays: 7 })

    expect(result.map((e) => e.date)).toEqual(['2026-05-19', '2026-05-20'])
  })

  it('skips filenames not matching isSnapshotFilename (.DS_Store / README / ..)', async () => {
    writeFileSync(join(dir, '.DS_Store'), 'binary garbage')
    writeFileSync(join(dir, 'README'), 'text file')
    writeFileSync(
      join(dir, '2026-05-AA.ndjson'),
      JSON.stringify(baseRecord()) + '\n',
    )
    // One valid file — proves the filter still lets real data through.
    writeSnapshot(dir, '2026-05-20', [
      baseRecord({ family: 'agenticapps', repo: 'a1' }),
    ])

    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })

    expect(result).toHaveLength(1)
    expect(result[0]?.date).toBe('2026-05-20')
  })

  it('last-record-wins per (date, family, repo) within same day file', async () => {
    // Two records for the same (family, repo). The SECOND record (all missing)
    // must win — if both lines were counted, score would be ~50 instead of 0.
    const firstFresh = JSON.stringify(
      baseRecord({ family: 'agenticapps', repo: 'a1' }),
    )
    const secondMissing = JSON.stringify(
      baseRecord({
        family: 'agenticapps',
        repo: 'a1',
        claudeMd: 'missing',
        gitNexus: 'missing',
        wiki: 'missing',
        workflowVersion: 'missing',
      }),
    )
    writeFileSync(
      join(dir, '2026-05-20.ndjson'),
      firstFresh + '\n' + secondMissing + '\n',
    )

    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })

    expect(result).toHaveLength(1)
    expect(result[0]?.agenticapps).toBe(0)
  })

  it('drifted repo IDs excluded from per-family score on each day', async () => {
    // 2 agenticapps repos: a1 fresh + a2 missing. If both count → 50.
    // If a2 drifts out → score 100.
    writeSnapshot(dir, '2026-05-20', [
      baseRecord({ family: 'agenticapps', repo: 'a1' }),
      baseRecord({
        family: 'agenticapps',
        repo: 'a2',
        claudeMd: 'missing',
        gitNexus: 'missing',
        wiki: 'missing',
        workflowVersion: 'missing',
      }),
    ])

    const result = await readDailySeriesForFleet({
      dir,
      now,
      windowDays: 90,
      driftedRepoIds: new Set(['agenticapps/a2']),
    })

    expect(result).toHaveLength(1)
    expect(result[0]?.agenticapps).toBe(100)
  })

  it("'other' family records excluded from scoring", async () => {
    // Only an 'other' record exists. Result should be all-zero scores —
    // 'other' must NOT contribute to any family bucket.
    writeSnapshot(dir, '2026-05-20', [
      baseRecord({ family: 'other', repo: 'misc' }),
    ])

    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      date: '2026-05-20',
      fleet: 0,
      agenticapps: 0,
      factiv: 0,
      neuroflash: 0,
    })
  })

  it('not-applicable cells excluded from numerator AND denominator (Pitfall 2 — daily)', async () => {
    // 3 cells fresh + 1 not-applicable → score 100 (not 75 — denominator must be 3).
    writeSnapshot(dir, '2026-05-20', [
      baseRecord({
        family: 'agenticapps',
        repo: 'a1',
        claudeMd: 'fresh',
        gitNexus: 'not-applicable',
        wiki: 'fresh',
        workflowVersion: 'fresh',
      }),
    ])

    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })

    expect(result).toHaveLength(1)
    expect(result[0]?.agenticapps).toBe(100)
  })

  it('fleet score = mean-of-3 (Pitfall 3 daily case — discriminator)', async () => {
    // Discriminator fixture (daily-series flavour):
    //   agenticapps: 30 repos all fresh → 100.
    //   factiv:       5 repos all missing → 0.
    //   neuroflash:   5 repos all fresh → 100.
    // Mean-of-3 → round((100+0+100)/3) = 67.
    // Sum-over-rows on 160 cells (140 green) → ~88. Different number.
    const records: SnapshotRecord[] = []
    for (let i = 0; i < 30; i += 1) {
      records.push(baseRecord({ family: 'agenticapps', repo: `a${i}` }))
    }
    for (let i = 0; i < 5; i += 1) {
      records.push(
        baseRecord({
          family: 'factiv',
          repo: `f${i}`,
          claudeMd: 'missing',
          gitNexus: 'missing',
          wiki: 'missing',
          workflowVersion: 'missing',
        }),
      )
    }
    for (let i = 0; i < 5; i += 1) {
      records.push(baseRecord({ family: 'neuroflash', repo: `n${i}` }))
    }
    writeSnapshot(dir, '2026-05-20', records)

    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })

    expect(result).toHaveLength(1)
    expect(result[0]?.agenticapps).toBe(100)
    expect(result[0]?.factiv).toBe(0)
    expect(result[0]?.neuroflash).toBe(100)
    expect(result[0]?.fleet).toBe(67)
    expect(result[0]?.fleet).not.toBe(88)
  })

  it('single-family snapshot: fleet = 100 when only agenticapps has records (NOT 33)', async () => {
    // Regression for daily-series fleet collapse. A snapshot with only
    // agenticapps records must NOT report fleet=round((100+0+0)/3)=33 —
    // factiv + neuroflash families with zero records that day are
    // not-applicable for the fleet roll-up, same as conformanceScore.ts.
    writeSnapshot(dir, '2026-05-20', [
      baseRecord({ family: 'agenticapps', repo: 'a1' }),
      baseRecord({ family: 'agenticapps', repo: 'a2' }),
    ])
    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })
    expect(result).toHaveLength(1)
    expect(result[0]?.agenticapps).toBe(100)
    expect(result[0]?.factiv).toBe(0)
    expect(result[0]?.neuroflash).toBe(0)
    // CRITICAL: fleet = mean over populated (1 family) = 100, NOT 33.
    expect(result[0]?.fleet).toBe(100)
    expect(result[0]?.fleet).not.toBe(33)
  })

  it('two-family snapshot: fleet = mean of two populated, not divided by 3', async () => {
    // agenticapps 100% + factiv 50% + neuroflash empty.
    // Old (broken): round((100 + 50 + 0) / 3) = 50.
    // New (fixed): round((100 + 50) / 2) = 75.
    writeSnapshot(dir, '2026-05-20', [
      baseRecord({ family: 'agenticapps', repo: 'a1' }),
      baseRecord({ family: 'factiv', repo: 'f1' }),
      baseRecord({
        family: 'factiv',
        repo: 'f2',
        claudeMd: 'missing',
        gitNexus: 'missing',
        wiki: 'missing',
        workflowVersion: 'missing',
      }),
    ])
    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })
    expect(result).toHaveLength(1)
    expect(result[0]?.agenticapps).toBe(100)
    expect(result[0]?.factiv).toBe(50)
    expect(result[0]?.neuroflash).toBe(0)
    expect(result[0]?.fleet).toBe(75)
  })

  it('returns integer scores per entry (D-12-05)', async () => {
    // 1/3 cells green → 33 per family (round of 33.333…). All integer.
    writeSnapshot(dir, '2026-05-20', [
      baseRecord({
        family: 'agenticapps',
        repo: 'a1',
        claudeMd: 'fresh',
        gitNexus: 'missing',
        wiki: 'missing',
        workflowVersion: 'not-applicable',
      }),
      baseRecord({
        family: 'factiv',
        repo: 'f1',
        claudeMd: 'fresh',
        gitNexus: 'missing',
        wiki: 'missing',
        workflowVersion: 'not-applicable',
      }),
      baseRecord({
        family: 'neuroflash',
        repo: 'n1',
        claudeMd: 'fresh',
        gitNexus: 'missing',
        wiki: 'missing',
        workflowVersion: 'not-applicable',
      }),
    ])

    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })

    expect(result).toHaveLength(1)
    const entry = result[0]!
    expect(Number.isInteger(entry.fleet)).toBe(true)
    expect(Number.isInteger(entry.agenticapps)).toBe(true)
    expect(Number.isInteger(entry.factiv)).toBe(true)
    expect(Number.isInteger(entry.neuroflash)).toBe(true)
    expect(entry.agenticapps).toBe(33)
    expect(entry.fleet).toBe(33)
  })

  it('default windowDays sourced from snapshotPaths.RETENTION_DAYS', async () => {
    // No windowDays override; reader must default to RETENTION_DAYS.
    // Verifies the default-arg wiring is intact regardless of the constant's
    // current value (14 pre-Wave-0, 90 post-Wave-0).
    expect(typeof RETENTION_DAYS).toBe('number')
    expect(RETENTION_DAYS).toBeGreaterThan(0)
    writeSnapshot(dir, '2026-05-20', [
      baseRecord({ family: 'agenticapps', repo: 'a1' }),
    ])

    const result = await readDailySeriesForFleet({ dir, now })

    expect(result).toHaveLength(1)
    expect(result[0]?.date).toBe('2026-05-20')
  })

  it('unknown family enum values are skipped (T-11-02-08 bounded defence)', async () => {
    // A record with a bogus family string must not crash and must not be
    // bucketed anywhere. Empty fleet, no NaN.
    writeSnapshot(dir, '2026-05-20', [
      baseRecord({ family: 'totally-bogus', repo: 'x' }),
    ])

    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })

    expect(result).toHaveLength(1)
    expect(result[0]?.fleet).toBe(0)
    expect(Number.isFinite(result[0]?.fleet)).toBe(true)
  })

  it('multi-day series computes per-day mean-of-3 independently', async () => {
    // Day A: all fresh across all 3 families → fleet 100.
    // Day B: factiv missing, others fresh → fleet round((100+0+100)/3) = 67.
    writeSnapshot(dir, '2026-05-19', [
      baseRecord({ family: 'agenticapps', repo: 'a1' }),
      baseRecord({ family: 'factiv', repo: 'f1' }),
      baseRecord({ family: 'neuroflash', repo: 'n1' }),
    ])
    writeSnapshot(dir, '2026-05-20', [
      baseRecord({ family: 'agenticapps', repo: 'a1' }),
      baseRecord({
        family: 'factiv',
        repo: 'f1',
        claudeMd: 'missing',
        gitNexus: 'missing',
        wiki: 'missing',
        workflowVersion: 'missing',
      }),
      baseRecord({ family: 'neuroflash', repo: 'n1' }),
    ])

    const result = await readDailySeriesForFleet({ dir, now, windowDays: 90 })

    expect(result).toHaveLength(2)
    expect(result[0]?.fleet).toBe(100)
    expect(result[1]?.fleet).toBe(67)
  })
})
