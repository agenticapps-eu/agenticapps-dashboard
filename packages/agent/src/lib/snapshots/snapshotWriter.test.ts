import {
  chmodSync,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  mkdtempSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../coverageScan.js', () => ({
  scanCoverageInternal: vi.fn(),
}))
vi.mock('./snapshotPruner.js', async () => {
  const actual = await vi.importActual<typeof import('./snapshotPruner.js')>(
    './snapshotPruner.js',
  )
  return {
    ...actual,
    pruneSnapshotsOlderThan: vi.fn(actual.pruneSnapshotsOlderThan),
  }
})

import { scanCoverageInternal } from '../coverageScan.js'
import { pruneSnapshotsOlderThan } from './snapshotPruner.js'
import { writeDailySnapshot } from './snapshotWriter.js'

describe('snapshotWriter', () => {
  let dir: string
  const now = new Date('2026-07-28T12:00:00.000Z')

  beforeEach(() => {
    vi.clearAllMocks()
    dir = mkdtempSync(join(tmpdir(), 'coverage-writer-'))
    rmSync(dir, { recursive: true, force: true })
    vi.mocked(scanCoverageInternal).mockResolvedValue({
      response: {
        schemaVersion: 2,
        generatedAtIso: now.toISOString(),
        workflowHeadVersion: '3.0.0',
        rows: [
          {
            family: 'agenticapps',
            repo: 'dashboard',
            claudeMd: { kind: 'basic', state: 'fresh' },
            workflowVersion: {
              kind: 'workflow',
              state: 'stale',
              installedVersion: '2.5.0',
              headVersion: '3.0.0',
            },
            understand: { kind: 'basic', state: 'fresh' },
            overrideCount: 0,
            overrides: [],
          },
        ],
      },
      internalRows: [],
    })
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('writes only the two retained conformance cells', async () => {
    const result = await writeDailySnapshot({ now, dir })
    const record = JSON.parse(readFileSync(result.path, 'utf8').trim()) as object

    expect(Object.keys(record)).toEqual([
      'ts',
      'family',
      'repo',
      'claudeMd',
      'workflowVersion',
    ])
    expect(record).not.toHaveProperty('gitNexus')
    expect(record).not.toHaveProperty('wiki')
  })

  it('keeps private directory/file modes and append semantics', async () => {
    const first = await writeDailySnapshot({ now, dir })
    chmodSync(first.path, 0o644)
    await writeDailySnapshot({ now, dir })

    expect(statSync(dir).mode & 0o777).toBe(0o700)
    expect(statSync(first.path).mode & 0o777).toBe(0o600)
    expect(readFileSync(first.path, 'utf8').trim().split('\n')).toHaveLength(2)
  })

  it('prunes before scanning and appending the current snapshot', async () => {
    await writeDailySnapshot({ now, dir })

    const pruneOrder = vi.mocked(pruneSnapshotsOlderThan).mock.invocationCallOrder[0]
    const scanOrder = vi.mocked(scanCoverageInternal).mock.invocationCallOrder[0]
    expect(pruneOrder).toBeDefined()
    expect(scanOrder).toBeDefined()
    expect(pruneOrder!).toBeLessThan(scanOrder!)
  })

  it('creates missing parent directories recursively', async () => {
    const nested = join(dir, 'parent-missing', 'snapshots')
    const result = await writeDailySnapshot({ now, dir: nested })

    expect(existsSync(result.path)).toBe(true)
    expect(statSync(nested).mode & 0o777).toBe(0o700)
  })

  it('returns the written count and deterministic daily path', async () => {
    const result = await writeDailySnapshot({ now, dir })

    expect(result).toEqual({
      written: 1,
      path: join(dir, '2026-07-28.ndjson'),
    })
  })
})
