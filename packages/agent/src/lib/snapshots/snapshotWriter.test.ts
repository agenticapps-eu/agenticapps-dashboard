/**
 * snapshotWriter.test.ts — NDJSON-append snapshot writer.
 *
 * Plan 11-02 Task 1 Step C (RED first).
 *
 * Security tests of record (T-11-02-01):
 *   - First write creates dir 0o700 + file 0o600
 *   - Second same-day write APPENDS (writer-append, reader-collapse semantics
 *     per REVIEWS.md action item 4)
 *   - File mode REMAINS 0o600 after the second write (Pitfall 2 defence —
 *     fs.appendFile mode arg only applies on creation; we must chmod after
 *     each write to defend against umask drift)
 *   - Writer prunes BEFORE its own append (lazy-on-write — no second scheduler)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  mkdtempSync,
  rmSync,
  statSync,
  readFileSync,
  existsSync,
  chmodSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Mock coverageScan BEFORE importing the writer so the writer's `import { scanCoverageInternal }`
// resolves to our deterministic fixture.
vi.mock('../coverageScan.js', () => ({
  scanCoverageInternal: vi.fn(),
}))

// Spy on the pruner so we can assert ordering (writer prunes BEFORE its append).
vi.mock('./snapshotPruner.js', async () => {
  const actual = await vi.importActual<typeof import('./snapshotPruner.js')>(
    './snapshotPruner.js',
  )
  return {
    ...actual,
    pruneSnapshotsOlderThan: vi.fn(actual.pruneSnapshotsOlderThan),
  }
})

import { writeDailySnapshot } from './snapshotWriter.js'
import { scanCoverageInternal } from '../coverageScan.js'
import { pruneSnapshotsOlderThan } from './snapshotPruner.js'

const THREE_ROW_FIXTURE = {
  response: {
    schemaVersion: 1 as const,
    generatedAtIso: '2026-05-16T12:00:00.000Z',
    gitNexusInstallState: 'installed-with-registry' as const,
    workflowHeadVersion: '1.8.0',
    rows: [
      {
        family: 'agenticapps' as const,
        repo: 'agenticapps-dashboard',
        claudeMd: { kind: 'basic' as const, state: 'fresh' as const },
        gitNexus: { kind: 'basic' as const, state: 'fresh' as const },
        wiki: { kind: 'basic' as const, state: 'stale' as const },
        workflowVersion: {
          kind: 'workflow' as const,
          state: 'fresh' as const,
          installedVersion: '1.8.0',
          headVersion: '1.8.0',
        },
        overrideCount: 0,
        overrides: [],
      },
      {
        family: 'factiv' as const,
        repo: 'cparx',
        claudeMd: { kind: 'basic' as const, state: 'missing' as const },
        gitNexus: { kind: 'basic' as const, state: 'stale' as const },
        wiki: { kind: 'basic' as const, state: 'fresh' as const },
        workflowVersion: {
          kind: 'workflow' as const,
          state: 'missing' as const,
          installedVersion: null,
          headVersion: '1.8.0',
        },
        overrideCount: 0,
        overrides: [],
      },
      {
        family: 'neuroflash' as const,
        repo: 'backend',
        claudeMd: { kind: 'basic' as const, state: 'fresh' as const },
        gitNexus: { kind: 'basic' as const, state: 'fresh' as const },
        wiki: { kind: 'basic' as const, state: 'fresh' as const },
        workflowVersion: {
          kind: 'workflow' as const,
          state: 'fresh' as const,
          installedVersion: '1.8.0',
          headVersion: '1.8.0',
        },
        overrideCount: 0,
        overrides: [],
      },
    ],
  },
  internalRows: [],
}

describe('snapshotWriter', () => {
  let dir: string
  const now = new Date('2026-05-16T12:00:00.000Z')

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(scanCoverageInternal).mockResolvedValue(
      THREE_ROW_FIXTURE as unknown as Awaited<ReturnType<typeof scanCoverageInternal>>,
    )
    dir = mkdtempSync(join(tmpdir(), 'agentic-writer-'))
    // Remove the dir so the writer's mkdir path is exercised.
    rmSync(dir, { recursive: true, force: true })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('first call creates dir 0o700 + file 0o600 + one NDJSON line per row', async () => {
    const result = await writeDailySnapshot({ now, dir })
    expect(result.written).toBe(3)
    expect(result.path).toBe(join(dir, '2026-05-16.ndjson'))

    // Directory mode is 0o700 (mask off file-type bits).
    expect(statSync(dir).mode & 0o777).toBe(0o700)
    // File mode is 0o600.
    expect(statSync(result.path).mode & 0o777).toBe(0o600)

    // Three NDJSON lines.
    const raw = readFileSync(result.path, 'utf8')
    const lines = raw.split('\n').filter((l) => l.length > 0)
    expect(lines).toHaveLength(3)
  })

  it('each line parses as JSON containing the snapshot record fields', async () => {
    const { path } = await writeDailySnapshot({ now, dir })
    const raw = readFileSync(path, 'utf8')
    const lines = raw.split('\n').filter((l) => l.length > 0)
    for (const line of lines) {
      const parsed = JSON.parse(line) as Record<string, unknown>
      expect(parsed).toHaveProperty('ts')
      expect(parsed).toHaveProperty('family')
      expect(parsed).toHaveProperty('repo')
      expect(parsed).toHaveProperty('claudeMd')
      expect(parsed).toHaveProperty('gitNexus')
      expect(parsed).toHaveProperty('wiki')
      expect(parsed).toHaveProperty('workflowVersion')
    }
  })

  it('second same-day call APPENDS rather than overwriting (REVIEWS action item 4)', async () => {
    const r1 = await writeDailySnapshot({ now, dir })
    const r2 = await writeDailySnapshot({ now, dir })
    expect(r2.path).toBe(r1.path)

    const raw = readFileSync(r1.path, 'utf8')
    const lines = raw.split('\n').filter((l) => l.length > 0)
    expect(lines).toHaveLength(6) // 3 + 3
  })

  it('file mode REMAINS 0o600 after a second same-day write (Pitfall 2 defence)', async () => {
    await writeDailySnapshot({ now, dir })
    const path = join(dir, '2026-05-16.ndjson')
    // Simulate umask drift on append by manually loosening mode between writes —
    // the writer's chmod-after-append guard MUST restore 0o600.
    chmodSync(path, 0o644)
    expect(statSync(path).mode & 0o777).toBe(0o644)

    await writeDailySnapshot({ now, dir })

    expect(statSync(path).mode & 0o777).toBe(0o600)
  })

  it('writer calls pruneSnapshotsOlderThan BEFORE its own append (lazy-on-write)', async () => {
    const pruneSpy = vi.mocked(pruneSnapshotsOlderThan)
    const scanSpy = vi.mocked(scanCoverageInternal)

    await writeDailySnapshot({ now, dir })

    expect(pruneSpy).toHaveBeenCalledTimes(1)
    // Pruner called before scanCoverageInternal — the scan + append happens
    // AFTER the prune so the writer sees a fresh window.
    const pruneOrder = pruneSpy.mock.invocationCallOrder[0]!
    const scanOrder = scanSpy.mock.invocationCallOrder[0]!
    expect(pruneOrder).toBeLessThan(scanOrder)
  })

  it('returns { written, path } on success', async () => {
    const result = await writeDailySnapshot({ now, dir })
    expect(result).toEqual({
      written: 3,
      path: join(dir, '2026-05-16.ndjson'),
    })
  })

  it('mkdir is recursive — succeeds when parent dirs are also missing', async () => {
    rmSync(dir, { recursive: true, force: true })
    const nested = join(dir, 'parent-also-missing')
    const result = await writeDailySnapshot({ now, dir: nested })
    expect(existsSync(result.path)).toBe(true)
    expect(statSync(nested).mode & 0o777).toBe(0o700)
  })
})
