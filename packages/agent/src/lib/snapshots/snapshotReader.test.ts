/**
 * snapshotReader.test.ts — bulk-per-repo drift computation across the 14d NDJSON window.
 *
 * Plan 11-02 Task 2 (RED first).
 *
 * Locked behaviour:
 *   - PD-11-02 bulk shape: readDriftForRepo(repoId) returns drift for all 4 cells
 *     in a single call. No per-cell helper exists.
 *   - RESOLVED Q2: most-recent transition within the window wins.
 *   - REVIEWS action item 4: same-day duplicates collapse with last-record-wins
 *     per (date, repo, cell).
 *   - 'not-applicable' transitions are NOT signal — direction stays null.
 *   - Malformed JSON / malformed filenames are skipped, not surfaced as 500s.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readDriftForRepo, CELL_KEYS } from './snapshotReader.js'

interface SnapshotRecord {
  ts: string
  family: string
  repo: string
  claudeMd: string
  gitNexus: string
  wiki: string
  workflowVersion: string
}

function writeRecord(dir: string, date: string, rec: SnapshotRecord): void {
  appendFileSync(join(dir, `${date}.ndjson`), JSON.stringify(rec) + '\n')
}

function baseRecord(overrides: Partial<SnapshotRecord> = {}): SnapshotRecord {
  return {
    ts: '2026-05-16T12:00:00.000Z',
    family: 'agenticapps',
    repo: 'dashboard',
    claudeMd: 'fresh',
    gitNexus: 'fresh',
    wiki: 'fresh',
    workflowVersion: 'fresh',
    ...overrides,
  }
}

describe('snapshotReader.readDriftForRepo', () => {
  let dir: string
  const now = new Date('2026-05-16T12:00:00.000Z')

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agentic-reader-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('Test 1: missing → fresh on claudeMd today returns { up, 0 } for that cell only', async () => {
    writeRecord(dir, '2026-05-15', baseRecord({ claudeMd: 'missing' }))
    writeRecord(dir, '2026-05-16', baseRecord({ claudeMd: 'fresh' }))

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(result.claudeMd).toEqual({ direction: 'up', daysSince: 0 })
    expect(result.gitNexus).toEqual({ direction: null, daysSince: null })
    expect(result.wiki).toEqual({ direction: null, daysSince: null })
    expect(result.workflowVersion).toEqual({ direction: null, daysSince: null })
  })

  it('Test 2: fresh → stale on gitNexus 3 days ago returns { down, 3 }', async () => {
    // Day -4: fresh; Day -3: stale (transition); subsequent days unchanged
    writeRecord(dir, '2026-05-12', baseRecord({ gitNexus: 'fresh' }))
    writeRecord(dir, '2026-05-13', baseRecord({ gitNexus: 'stale' }))
    writeRecord(dir, '2026-05-14', baseRecord({ gitNexus: 'stale' }))
    writeRecord(dir, '2026-05-15', baseRecord({ gitNexus: 'stale' }))
    writeRecord(dir, '2026-05-16', baseRecord({ gitNexus: 'stale' }))

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(result.gitNexus).toEqual({ direction: 'down', daysSince: 3 })
  })

  it('Test 3: no transition in window returns null for every cell', async () => {
    writeRecord(dir, '2026-05-15', baseRecord())
    writeRecord(dir, '2026-05-16', baseRecord())

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    for (const cell of CELL_KEYS) {
      expect(result[cell]).toEqual({ direction: null, daysSince: null })
    }
  })

  it('Test 4: multiple transitions in window — most-recent wins (RESOLVED Q2)', async () => {
    // claudeMd: fresh → stale 7d ago, then stale → fresh 2d ago
    writeRecord(dir, '2026-05-09', baseRecord({ claudeMd: 'fresh' }))
    writeRecord(dir, '2026-05-10', baseRecord({ claudeMd: 'stale' })) // 6d ago — direction: down
    writeRecord(dir, '2026-05-11', baseRecord({ claudeMd: 'stale' }))
    writeRecord(dir, '2026-05-12', baseRecord({ claudeMd: 'stale' }))
    writeRecord(dir, '2026-05-13', baseRecord({ claudeMd: 'stale' }))
    writeRecord(dir, '2026-05-14', baseRecord({ claudeMd: 'fresh' })) // 2d ago — direction: up
    writeRecord(dir, '2026-05-15', baseRecord({ claudeMd: 'fresh' }))
    writeRecord(dir, '2026-05-16', baseRecord({ claudeMd: 'fresh' }))

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(result.claudeMd).toEqual({ direction: 'up', daysSince: 2 })
  })

  it('Test 5: repoId not present in any NDJSON line returns null for every cell', async () => {
    writeRecord(dir, '2026-05-15', baseRecord({ claudeMd: 'missing' }))
    writeRecord(dir, '2026-05-16', baseRecord({ claudeMd: 'fresh' }))

    const result = await readDriftForRepo('unknown/repo', { dir, now })

    for (const cell of CELL_KEYS) {
      expect(result[cell]).toEqual({ direction: null, daysSince: null })
    }
  })

  it('Test 6: reader filters filenames through isSnapshotFilename — malformed filenames skipped', async () => {
    // A real transition lives in a malformed-name file → must be ignored.
    writeFileSync(
      join(dir, '2026-05-AA.ndjson'),
      JSON.stringify(baseRecord({ claudeMd: 'fresh' })) + '\n',
    )
    writeFileSync(
      join(dir, 'README'),
      JSON.stringify(baseRecord({ claudeMd: 'fresh' })) + '\n',
    )
    // No valid files at all → no transitions visible.
    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })
    for (const cell of CELL_KEYS) {
      expect(result[cell]).toEqual({ direction: null, daysSince: null })
    }
  })

  it('Test 7: malformed JSON line inside an otherwise-valid file is skipped (no throw)', async () => {
    writeRecord(dir, '2026-05-15', baseRecord({ claudeMd: 'missing' }))
    // Insert a garbage line then a valid record on the same file.
    appendFileSync(join(dir, '2026-05-16.ndjson'), '{not json at all\n')
    appendFileSync(
      join(dir, '2026-05-16.ndjson'),
      JSON.stringify(baseRecord({ claudeMd: 'fresh' })) + '\n',
    )

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    // missing → fresh transition still visible despite the malformed line.
    expect(result.claudeMd).toEqual({ direction: 'up', daysSince: 0 })
  })

  it('Test 8: not-applicable transitions are NOT counted as signal', async () => {
    // fresh → not-applicable → direction stays null
    writeRecord(dir, '2026-05-15', baseRecord({ claudeMd: 'fresh' }))
    writeRecord(dir, '2026-05-16', baseRecord({ claudeMd: 'not-applicable' }))

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(result.claudeMd).toEqual({ direction: null, daysSince: null })
  })

  it('Test 9: same-day duplicates collapse with last-record-wins (REVIEWS action item 4)', async () => {
    // Yesterday: missing. Today: TWO records — first stale, then fresh. The
    // collapsed view says "today's state is fresh", so missing → fresh = up.
    // If the reader instead processed both lines as separate transitions, we'd
    // see missing → stale → fresh (still up, but with a different daysSince
    // story for some other cases). This test pins the collapse semantics.
    writeRecord(dir, '2026-05-15', baseRecord({ claudeMd: 'missing' }))
    appendFileSync(
      join(dir, '2026-05-16.ndjson'),
      JSON.stringify(baseRecord({ claudeMd: 'stale' })) + '\n',
    )
    appendFileSync(
      join(dir, '2026-05-16.ndjson'),
      JSON.stringify(baseRecord({ claudeMd: 'fresh' })) + '\n',
    )

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    // Collapsed today-state is 'fresh' (last record). So missing → fresh = up.
    expect(result.claudeMd).toEqual({ direction: 'up', daysSince: 0 })
  })

  it('Test 10: graceful empty state when no NDJSON files exist at all', async () => {
    // Empty dir — readdir succeeds, just yields no snapshot files.
    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(Object.keys(result).sort()).toEqual(
      ['claudeMd', 'gitNexus', 'wiki', 'workflowVersion'].sort(),
    )
    for (const cell of CELL_KEYS) {
      expect(result[cell]).toEqual({ direction: null, daysSince: null })
    }
  })
})
