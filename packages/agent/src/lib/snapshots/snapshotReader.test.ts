import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CELL_KEYS, readDriftForRepo } from './snapshotReader.js'

interface SnapshotRecord {
  ts: string
  family: string
  repo: string
  claudeMd: string
  workflowVersion: string
  gitNexus?: string
  wiki?: string
}

describe('snapshotReader', () => {
  let dir: string
  const now = new Date('2026-07-28T12:00:00.000Z')

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'coverage-reader-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  function write(date: string, record: Partial<SnapshotRecord>) {
    const value: SnapshotRecord = {
      ts: `${date}T12:00:00.000Z`,
      family: 'agenticapps',
      repo: 'dashboard',
      claudeMd: 'fresh',
      workflowVersion: 'fresh',
      ...record,
    }
    appendFileSync(join(dir, `${date}.ndjson`), `${JSON.stringify(value)}\n`)
  }

  it('returns drift for exactly the two retained cells', async () => {
    write('2026-07-27', { claudeMd: 'missing' })
    write('2026-07-28', { claudeMd: 'fresh' })

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(CELL_KEYS).toEqual(['claudeMd', 'workflowVersion'])
    expect(result.claudeMd).toEqual({ direction: 'up', daysSince: 0 })
    expect(result.workflowVersion).toEqual({ direction: null, daysSince: null })
  })

  it('reads legacy records while ignoring retired fields', async () => {
    write('2026-07-27', {
      workflowVersion: 'fresh',
      gitNexus: 'missing',
      wiki: 'stale',
    })
    write('2026-07-28', {
      workflowVersion: 'stale',
      gitNexus: 'fresh',
      wiki: 'fresh',
    })

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(result.workflowVersion).toEqual({ direction: 'down', daysSince: 0 })
    expect(result).not.toHaveProperty('gitNexus')
    expect(result).not.toHaveProperty('wiki')
  })

  it('normalises retained legacy not-applicable to missing', async () => {
    write('2026-07-27', { claudeMd: 'fresh' })
    write('2026-07-28', { claudeMd: 'not-applicable' })

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(result.claudeMd).toEqual({ direction: 'down', daysSince: 0 })
  })

  it('uses the last record for duplicate repo/day entries', async () => {
    write('2026-07-27', { claudeMd: 'missing' })
    write('2026-07-28', { claudeMd: 'stale' })
    write('2026-07-28', { claudeMd: 'fresh' })

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(result.claudeMd).toEqual({ direction: 'up', daysSince: 0 })
  })

  it('uses the most recent transition within the retained window', async () => {
    write('2026-07-23', { claudeMd: 'fresh' })
    write('2026-07-24', { claudeMd: 'stale' })
    write('2026-07-26', { claudeMd: 'stale' })
    write('2026-07-27', { claudeMd: 'fresh' })
    write('2026-07-28', { claudeMd: 'fresh' })

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(result.claudeMd).toEqual({ direction: 'up', daysSince: 1 })
  })

  it('returns the complete empty drift shape for an absent repo', async () => {
    write('2026-07-27', { claudeMd: 'missing' })
    write('2026-07-28', { claudeMd: 'fresh' })

    const result = await readDriftForRepo('agenticapps/absent', { dir, now })

    expect(result).toEqual({
      claudeMd: { direction: null, daysSince: null },
      workflowVersion: { direction: null, daysSince: null },
    })
  })

  it('ignores malformed snapshot filenames', async () => {
    writeFileSync(
      join(dir, '2026-07-AA.ndjson'),
      `${JSON.stringify({
        ts: now.toISOString(),
        family: 'agenticapps',
        repo: 'dashboard',
        claudeMd: 'fresh',
        workflowVersion: 'fresh',
      })}\n`,
    )
    writeFileSync(join(dir, 'README'), 'not a snapshot\n')

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(result.claudeMd).toEqual({ direction: null, daysSince: null })
  })

  it('skips malformed JSON without losing valid records in the same file', async () => {
    write('2026-07-27', { claudeMd: 'missing' })
    appendFileSync(join(dir, '2026-07-28.ndjson'), '{not json\n')
    write('2026-07-28', { claudeMd: 'fresh' })

    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(result.claudeMd).toEqual({ direction: 'up', daysSince: 0 })
  })

  it('returns the complete empty drift shape when no snapshots exist', async () => {
    const result = await readDriftForRepo('agenticapps/dashboard', { dir, now })

    expect(Object.keys(result)).toEqual(['claudeMd', 'workflowVersion'])
    expect(result.claudeMd).toEqual({ direction: null, daysSince: null })
    expect(result.workflowVersion).toEqual({ direction: null, daysSince: null })
  })
})
