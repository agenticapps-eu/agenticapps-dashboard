/**
 * snapshotWriter.ts — appends one NDJSON snapshot record per coverage row to
 * the day's `<UTC-date>.ndjson` file under the snapshot dir.
 *
 * D-11-13 / INV-02: directory mode 0o700, file mode 0o600.
 * Pitfall 2: fs.appendFile mode is only honoured on creation — we explicitly
 *   chmod after every write to defend against umask drift on subsequent appends.
 * REVIEWS.md action item 4 (writer side): the writer is APPEND-ONLY; same-day
 *   re-writes produce additional records per row. The reader (snapshotReader.ts)
 *   collapses with "last-record-wins per (date, repo, cell)".
 * D-11-01 + lazy-on-write: pruner runs BEFORE this writer's own append so the
 *   directory observes the 14-day window without a second scheduler.
 */
import { appendFile, chmod, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { scanCoverageInternal } from '../coverageScan.js'

import {
  isoDateFromDate,
  RETENTION_DAYS,
  resolveSnapshotDir,
} from './snapshotPaths.js'
import { pruneSnapshotsOlderThan } from './snapshotPruner.js'

/** Internal NDJSON record shape — distinct from the wire CoverageHistoryResponse. */
export interface SnapshotRecord {
  /** ISO timestamp of this write — distinct from the filename's UTC date. */
  ts: string
  family: string
  repo: string
  /** Coverage cell states — one per Phase 10 column. Values are 4-state enum strings. */
  claudeMd: string
  gitNexus: string
  wiki: string
  workflowVersion: string
}

export interface WriteOptions {
  /** Injected wall-clock for testability + scheduler ticks. Defaults to `new Date()`. */
  now?: Date
  /** Override snapshot dir for testability. Defaults to resolveSnapshotDir(). */
  dir?: string
}

export interface WriteResult {
  written: number
  path: string
}

/**
 * Append one NDJSON line per row in the latest coverage scan to the day's file.
 *
 * Side effects:
 *   - mkdir(dir, { mode: 0o700, recursive: true }) if missing
 *   - pruneSnapshotsOlderThan(dir) → unlinks files outside the 14d window
 *   - appendFile(<date>.ndjson) with mode 0o600 on first creation
 *   - chmod(<date>.ndjson, 0o600) after every append (Pitfall 2 defence)
 *
 * Returns the count of lines written + the resolved path.
 */
export async function writeDailySnapshot(opts: WriteOptions = {}): Promise<WriteResult> {
  const now = opts.now ?? new Date()
  const dir = opts.dir ?? resolveSnapshotDir()
  const isoDate = isoDateFromDate(now)
  const path = join(dir, `${isoDate}.ndjson`)

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true, mode: 0o700 })
  }

  // Lazy-on-write prune BEFORE the append so the directory observes the 14d
  // window without a second scheduler driving the pruner.
  pruneSnapshotsOlderThan(dir, RETENTION_DAYS, now)

  const { response } = await scanCoverageInternal()

  const records: SnapshotRecord[] = response.rows.map((row) => ({
    ts: now.toISOString(),
    family: row.family,
    repo: row.repo,
    claudeMd: row.claudeMd.state,
    gitNexus: row.gitNexus.state,
    wiki: row.wiki.state,
    workflowVersion: row.workflowVersion.state,
  }))

  const body = records.map((r) => JSON.stringify(r)).join('\n') + '\n'
  await appendFile(path, body, { flag: 'a', mode: 0o600, encoding: 'utf8' })

  // Pitfall 2 defence: chmod AFTER every append so umask drift / a previously
  // loosened mode cannot leak the snapshot file at 0o644. T-11-02-01 / T-11-02-04.
  await chmod(path, 0o600)

  return { written: records.length, path }
}
