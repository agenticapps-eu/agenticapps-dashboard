/**
 * snapshotPruner.ts — drop NDJSON files outside the D-11-01 14-day window.
 *
 * Invoked lazily by snapshotWriter before every tick — there is no second
 * scheduler driving it. Sync + side-effecting (unlinkSync) so the writer's
 * single appendFile call observes a pre-pruned directory.
 *
 * Filenames are filtered through isSnapshotFilename so foreign entries
 * (README, .DS_Store, malformed-date.ndjson, …) survive untouched.
 *
 * Cutoff is INCLUSIVE: a file exactly N=retentionDays old is kept; only
 * files strictly older are unlinked.
 */
import { existsSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

import { isSnapshotFilename, RETENTION_DAYS } from './snapshotPaths.js'

export interface PruneResult {
  pruned: number
  kept: number
}

/**
 * Prune snapshot files older than `retentionDays`. Pure date-string comparison
 * — no Date.parse on the filename, no timezone math — because filenames are
 * UTC dates (Pitfall 4) and dictionary-order on ISO-8601 date strings is the
 * same as chronological order.
 */
export function pruneSnapshotsOlderThan(
  dir: string,
  retentionDays: number = RETENTION_DAYS,
  now: Date = new Date(),
): PruneResult {
  if (!existsSync(dir)) return { pruned: 0, kept: 0 }

  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
  const cutoffIso = cutoff.toISOString().slice(0, 10)

  let pruned = 0
  let kept = 0
  for (const name of readdirSync(dir)) {
    if (!isSnapshotFilename(name)) continue
    const dateStr = name.slice(0, 10)
    if (dateStr < cutoffIso) {
      unlinkSync(join(dir, name))
      pruned += 1
    } else {
      kept += 1
    }
  }
  return { pruned, kept }
}
