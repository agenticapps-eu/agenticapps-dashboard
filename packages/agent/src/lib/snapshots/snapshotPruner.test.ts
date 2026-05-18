/**
 * snapshotPruner.test.ts — 14d rolling cutoff pruner.
 *
 * Plan 11-02 Task 1 Step B (RED first).
 *
 * D-11-01: retention window is 14 days. The pruner is invoked lazily by the
 * writer before every tick — there is no second scheduler driving it.
 *
 * Hermeticity: every test uses an isolated tmpdir from mkdtempSync. Pruner accepts
 * `dir` + `now` so the cutoff is deterministic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { pruneSnapshotsOlderThan } from './snapshotPruner.js'

function isoDateNDaysAgo(now: Date, days: number): string {
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

describe('snapshotPruner', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'agentic-prune-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('unlinks files whose ISO date is strictly older than now-14d (15-day-old dropped, 14-day-old kept)', () => {
    const now = new Date('2026-05-16T12:00:00.000Z')
    // 15 days old → must be pruned
    const oldName = `${isoDateNDaysAgo(now, 15)}.ndjson`
    // exactly 14 days old → kept
    const edgeName = `${isoDateNDaysAgo(now, 14)}.ndjson`
    writeFileSync(join(dir, oldName), '{}\n')
    writeFileSync(join(dir, edgeName), '{}\n')

    const result = pruneSnapshotsOlderThan(dir, 14, now)

    expect(result.pruned).toBe(1)
    expect(result.kept).toBe(1)
    expect(existsSync(join(dir, oldName))).toBe(false)
    expect(existsSync(join(dir, edgeName))).toBe(true)
  })

  it('keeps files within the window untouched', () => {
    const now = new Date('2026-05-16T12:00:00.000Z')
    const inWindow = ['2026-05-15.ndjson', '2026-05-10.ndjson', '2026-05-03.ndjson']
    for (const name of inWindow) writeFileSync(join(dir, name), '{}\n')

    const result = pruneSnapshotsOlderThan(dir, 14, now)

    expect(result.pruned).toBe(0)
    expect(result.kept).toBe(3)
    for (const name of inWindow) {
      expect(existsSync(join(dir, name))).toBe(true)
    }
  })

  it('ignores non-snapshot filenames (README, .DS_Store, malformed) — does not unlink them', () => {
    const now = new Date('2026-05-16T12:00:00.000Z')
    writeFileSync(join(dir, 'README'), 'meta')
    writeFileSync(join(dir, '.DS_Store'), '')
    writeFileSync(join(dir, '2026-05-AA.ndjson'), '{}\n') // malformed date
    writeFileSync(join(dir, '2026-05-15.txt'), '{}\n') // wrong extension

    const result = pruneSnapshotsOlderThan(dir, 14, now)

    expect(result.pruned).toBe(0)
    expect(result.kept).toBe(0) // none of these match isSnapshotFilename
    // and none of these were unlinked
    const remaining = readdirSync(dir).sort()
    expect(remaining).toEqual(['.DS_Store', '2026-05-15.txt', '2026-05-AA.ndjson', 'README'])
  })

  it('is a no-op when the snapshot directory does not exist (does not throw)', () => {
    const missing = join(dir, 'nonexistent-subdir')
    expect(() => pruneSnapshotsOlderThan(missing, 14, new Date())).not.toThrow()
    const result = pruneSnapshotsOlderThan(missing, 14, new Date())
    expect(result).toEqual({ pruned: 0, kept: 0 })
  })

  it('returns { pruned, kept } counts', () => {
    const now = new Date('2026-05-16T12:00:00.000Z')
    writeFileSync(join(dir, `${isoDateNDaysAgo(now, 30)}.ndjson`), '{}\n') // pruned
    writeFileSync(join(dir, `${isoDateNDaysAgo(now, 20)}.ndjson`), '{}\n') // pruned
    writeFileSync(join(dir, `${isoDateNDaysAgo(now, 5)}.ndjson`), '{}\n') // kept
    writeFileSync(join(dir, `${isoDateNDaysAgo(now, 0)}.ndjson`), '{}\n') // kept

    const result = pruneSnapshotsOlderThan(dir, 14, now)

    expect(result.pruned).toBe(2)
    expect(result.kept).toBe(2)
  })
})
