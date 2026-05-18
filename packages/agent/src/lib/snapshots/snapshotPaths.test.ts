/**
 * snapshotPaths.test.ts — pure helpers for snapshot dir + filename math.
 *
 * Plan 11-02 Task 1 Step A (RED first). Implementation lives in snapshotPaths.ts.
 *
 * D-11-13: snapshot dir is daemon-private under ~/.agenticapps/dashboard/coverage-history/.
 * D-11-01: retention window is 14 days.
 * Pitfall 4 (research §): filename uses UTC date everywhere — local-tz drift would
 *   produce two files per day at midnight crossings.
 */

import { describe, it, expect } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  resolveSnapshotDir,
  RETENTION_DAYS,
  isoDateFromDate,
  isSnapshotFilename,
} from './snapshotPaths.js'

describe('snapshotPaths', () => {
  it('resolveSnapshotDir returns ~/.agenticapps/dashboard/coverage-history', () => {
    expect(resolveSnapshotDir()).toBe(
      join(homedir(), '.agenticapps', 'dashboard', 'coverage-history'),
    )
  })

  it('RETENTION_DAYS is exactly 14 (D-11-01 lock)', () => {
    expect(RETENTION_DAYS).toBe(14)
  })

  it('isoDateFromDate returns UTC date slice (not local) — Pitfall 4', () => {
    // 23:59 UTC on 2026-05-16 — local Berlin time is 2026-05-17 01:59,
    // but the filename MUST be the UTC date.
    const d = new Date('2026-05-16T23:59:00.000Z')
    expect(isoDateFromDate(d)).toBe('2026-05-16')
  })

  it('isSnapshotFilename accepts a well-formed ISO-date filename', () => {
    expect(isSnapshotFilename('2026-05-16.ndjson')).toBe(true)
  })

  it('isSnapshotFilename rejects non-date prefix', () => {
    expect(isSnapshotFilename('not-a-date.ndjson')).toBe(false)
  })

  it('isSnapshotFilename rejects wrong extension', () => {
    expect(isSnapshotFilename('2026-05-16.txt')).toBe(false)
  })

  it('isSnapshotFilename rejects path-traversal style names (defence-in-depth)', () => {
    expect(isSnapshotFilename('../etc/passwd')).toBe(false)
    expect(isSnapshotFilename('../2026-05-16.ndjson')).toBe(false)
    expect(isSnapshotFilename('/etc/2026-05-16.ndjson')).toBe(false)
  })
})
