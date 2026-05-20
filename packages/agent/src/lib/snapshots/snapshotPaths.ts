/**
 * snapshotPaths.ts — pure helpers for coverage-trend snapshot dir + filename math.
 *
 * D-11-13: snapshot dir is daemon-private under ~/.agenticapps/dashboard/coverage-history/.
 * D-11-01: retention window is 14 days (RETENTION_DAYS).
 * Pitfall 4 (research §): filename uses UTC date everywhere — local-tz drift would
 *   produce two files per day at midnight crossings.
 *
 * No I/O here — these helpers are sync + pure so the rest of the snapshot module
 * stack (writer, pruner, reader, scheduler) can compose them without depending on
 * a particular HOME or wall-clock at module-load time.
 */
import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * D-12-09 (Phase 12): retention extended 14 → 90 to power the 90-day fleet
 * conformance trend chart. Phase 11 drift-summary window
 * (`CoverageHistoryResponseSchema.windowDays: z.literal(14)`) is semantically
 * independent — that literal is the drift-detection window, NOT retention.
 * Pruner picks up the new value automatically (snapshotWriter.ts:75 passes
 * RETENTION_DAYS; snapshotPruner.test.ts uses an explicit literal `14` arg
 * for its boundary semantics and remains unchanged).
 */
export const RETENTION_DAYS = 90

/**
 * Anchored regex: exactly YYYY-MM-DD.ndjson, no leading/trailing junk.
 * The anchors are intentional — without them, `../etc/passwd` would not match
 * but `../2026-05-16.ndjson` would. Combined with isSnapshotFilename's contract
 * of receiving bare `readdir()` entries (which never include path separators),
 * this defends against path-traversal in the pruner/reader walk loops.
 */
const SNAPSHOT_FILENAME_RE = /^\d{4}-\d{2}-\d{2}\.ndjson$/

/**
 * Absolute path to the snapshot dir. Daemon-private — INV-02 (mode 0o700 + 0o600
 * file children) is enforced by snapshotWriter at write time + by the symlink-escape
 * boot check in boot.ts.
 */
export function resolveSnapshotDir(): string {
  return join(homedir(), '.agenticapps', 'dashboard', 'coverage-history')
}

/**
 * UTC date string (YYYY-MM-DD) from a Date. Pitfall 4 — local-time formatting
 * would emit two files per day at midnight crossings.
 */
export function isoDateFromDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * True iff `name` is a bare snapshot filename matching `YYYY-MM-DD.ndjson`
 * exactly. Used as a defence-in-depth filter by the pruner + reader so a
 * stray `README` / `.DS_Store` / `../foo` entry cannot make it into the
 * processing path.
 */
export function isSnapshotFilename(name: string): boolean {
  return SNAPSHOT_FILENAME_RE.test(name)
}
