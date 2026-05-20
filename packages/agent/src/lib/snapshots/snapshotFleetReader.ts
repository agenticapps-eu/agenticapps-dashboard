/**
 * snapshotFleetReader.ts — server-side per-day per-family conformance series
 * over the snapshot retention window.
 *
 * Phase 12 D-12-09: 90-day x-axis. Reads the SAME NDJSON store Phase 11
 * writes (snapshotWriter.ts); Phase 12 is a read-only consumer. NEVER writes.
 *
 * Pitfall 2 (RESEARCH §): not-applicable cells are excluded from BOTH the
 * numerator AND denominator on the daily score path. The contract MUST match
 * conformanceScore.ts on a per-family basis or the "Today" card and the
 * rightmost point of the trend chart would disagree for the same coverage
 * snapshot.
 *
 * Pitfall 3 / A8 (ratified): the fleet score per day is the MEAN of the 3
 * family scores, NOT sum-over-rows. With unequal repo counts the two
 * formulas diverge significantly (e.g. 30/5/5 distribution: mean = 67 vs
 * sum = 88 for the 100/0/100 discriminator).
 *
 * Same-day collapse (mirrors snapshotReader.ts:139): when multiple records
 * exist for the same (date, family, repo), the LAST record wins. Implemented
 * via Map.set semantics — later iterations overwrite earlier entries.
 *
 * Resilience (T-11-02-08 bounded defence — matches snapshotReader.ts:122):
 *   - Malformed JSON lines: try/catch around JSON.parse, silent skip.
 *   - Non-snapshot filenames: isSnapshotFilename regex filters at readdir.
 *   - Unknown family enum values: bucket lookup short-circuits to skip.
 *   - readFileSync ENOENT (pruner race): try/catch, silent skip.
 *
 * Threat boundaries (see plan §threat_model):
 *   - T-12-FILENAME-TRAVERSAL → isSnapshotFilename regex anchor (defence-in-depth
 *     alongside boot.ts symlink-escape guard).
 *   - T-12-MALFORMED-NDJSON → bounded JSON.parse with skip-on-throw.
 *   - T-12-RACE-PRUNER → file unlink mid-walk → readFileSync ENOENT → caught + skipped.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { CoverageFamily } from '@agenticapps/dashboard-shared'

import {
  RETENTION_DAYS,
  isSnapshotFilename,
  resolveSnapshotDir,
} from './snapshotPaths.js'

/** NDJSON record shape as written by snapshotWriter.ts:28-38. */
interface SnapshotLine {
  ts: string
  family: string
  repo: string
  claudeMd: string
  gitNexus: string
  wiki: string
  workflowVersion: string
}

/** The 4 Coverage cells contributing to the score (matches conformanceScore.ts). */
const CELL_KEYS = ['claudeMd', 'gitNexus', 'wiki', 'workflowVersion'] as const
type CellKey = (typeof CELL_KEYS)[number]

/** D-12-06: 3 family cards only. 'other' is excluded from per-family scoring. */
const FAMILY_KEYS: ReadonlyArray<Exclude<CoverageFamily, never>> = [
  'agenticapps',
  'factiv',
  'neuroflash',
]
type Family = (typeof FAMILY_KEYS)[number]
const FAMILY_SET: ReadonlySet<string> = new Set<string>(FAMILY_KEYS)

/**
 * The three "real" cell states. Anything outside this set (`not-applicable`
 * + any unknown enum value from an older snapshot) is silently excluded from
 * the score — Pitfall 2 + bounded-defence (T-11-02-08).
 */
const SIGNAL_STATES = new Set(['fresh', 'stale', 'missing'])
const GREEN_STATE = 'fresh'

export interface DailySeriesEntry {
  /** UTC date string YYYY-MM-DD — derived from the NDJSON filename. */
  date: string
  /** Integer 0..100 — mean of the 3 family scores per Pitfall 3 / A8. */
  fleet: number
  agenticapps: number
  factiv: number
  neuroflash: number
}

export interface ReadFleetSeriesOptions {
  /** Override snapshot dir for testability. Defaults to resolveSnapshotDir(). */
  dir?: string
  /** Window size; defaults to RETENTION_DAYS (90 post Wave 0). */
  windowDays?: number
  /** Wall-clock anchor for the window cutoff (defaults to new Date()). */
  now?: Date
  /** `${family}/${repo}` strings to exclude from per-family denominators (D-12-07). */
  driftedRepoIds?: Set<string>
}

/**
 * Compute one family's score from already-deduplicated daily records.
 * Mirrors conformanceScore.ts:scoreRows but operates on the raw NDJSON
 * `SnapshotLine` shape (string cell states) instead of typed `CoverageRow`
 * objects. The DUPLICATION is intentional — see file header.
 */
function scoreFamilyRecords(records: SnapshotLine[]): number {
  let green = 0
  let total = 0
  for (const rec of records) {
    for (const cellKey of CELL_KEYS) {
      const state = rec[cellKey as CellKey]
      if (!SIGNAL_STATES.has(state)) continue // Pitfall 2 + T-11-02-08
      total += 1
      if (state === GREEN_STATE) green += 1
    }
  }
  return total === 0 ? 0 : Math.round((green / total) * 100)
}

/**
 * Walk the NDJSON snapshot dir for the configured windowDays and return one
 * `DailySeriesEntry` per day with records. Days with no readable NDJSON file
 * are simply absent from the series (tolerant — the chart's empty-state
 * threshold per D-12-13 handles cold-start days).
 *
 * Returns an empty array when the snapshot dir does not exist (cold-start
 * daemon — no snapshots written yet).
 */
export async function readDailySeriesForFleet(
  opts: ReadFleetSeriesOptions = {},
): Promise<DailySeriesEntry[]> {
  const dir = opts.dir ?? resolveSnapshotDir()
  const windowDays = opts.windowDays ?? RETENTION_DAYS
  const now = opts.now ?? new Date()
  const driftedRepoIds = opts.driftedRepoIds ?? new Set<string>()

  if (!existsSync(dir)) return []

  // Cutoff date string (inclusive lower bound) — `YYYY-MM-DD` ordered
  // lexicographically matches chronological ordering for the ISO format.
  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
  const cutoffIso = cutoff.toISOString().slice(0, 10)

  const files = readdirSync(dir)
    .filter(isSnapshotFilename) // T-12-FILENAME-TRAVERSAL defence-in-depth
    .filter((name) => name.slice(0, 10) >= cutoffIso) // window cutoff
    .sort()

  const result: DailySeriesEntry[] = []

  for (const filename of files) {
    const date = filename.slice(0, 10)

    let raw: string
    try {
      raw = readFileSync(join(dir, filename), 'utf8')
    } catch {
      // T-12-RACE-PRUNER: file unlinked between readdir + readFile → skip day.
      continue
    }

    // Same-day collapse — last-record-wins per (family, repo).
    const byKey = new Map<string, SnapshotLine>()
    for (const line of raw.split('\n')) {
      if (!line) continue
      let rec: SnapshotLine
      try {
        rec = JSON.parse(line) as SnapshotLine
      } catch {
        continue // T-12-MALFORMED-NDJSON: skip garbage lines.
      }
      if (typeof rec.family !== 'string' || typeof rec.repo !== 'string') {
        continue
      }
      byKey.set(`${rec.family}/${rec.repo}`, rec)
    }

    // Bucket by family — skip drifted IDs (D-12-07) and unknown families.
    const byFamily: Record<Family, SnapshotLine[]> = {
      agenticapps: [],
      factiv: [],
      neuroflash: [],
    }
    for (const [id, rec] of byKey) {
      if (driftedRepoIds.has(id)) continue // D-12-07
      if (!FAMILY_SET.has(rec.family)) continue // 'other' + unknown enums skipped
      byFamily[rec.family as Family].push(rec)
    }

    // For the fleet roll-up we need (score, populated?) per family. Empty
    // families (zero records that day) MUST be excluded from the fleet
    // divisor — see conformanceScore.ts for the matching live-data formula.
    // Treating them as "0% conformance" would drag the daily fleet point
    // down to ~33% for single-family installs (silent metric distortion
    // visible in every point of the trend chart).
    const families = [
      { records: byFamily.agenticapps, score: scoreFamilyRecords(byFamily.agenticapps) },
      { records: byFamily.factiv, score: scoreFamilyRecords(byFamily.factiv) },
      { records: byFamily.neuroflash, score: scoreFamilyRecords(byFamily.neuroflash) },
    ]
    const agenticappsScore = families[0]!.score
    const factivScore = families[1]!.score
    const neuroflashScore = families[2]!.score
    const populated = families.filter((f) => f.records.length > 0)
    const fleetScore =
      populated.length === 0
        ? 0
        : Math.round(populated.reduce((s, f) => s + f.score, 0) / populated.length)

    result.push({
      date,
      fleet: fleetScore,
      agenticapps: agenticappsScore,
      factiv: factivScore,
      neuroflash: neuroflashScore,
    })
  }

  return result
}
