/**
 * snapshotReader.ts — server-side drift computation across the 14d NDJSON window.
 *
 * PD-11-02 (bulk-per-repo): the public helper is readDriftForRepo(repoId) which
 * returns drift for ALL FOUR cells of one repo in one call. There is intentionally
 * NO per-cell helper — the bulk shape lets the route hand a single CoverageHistory
 * response back to the SPA per matrix row, cutting fan-out from O(rows × cells)
 * to O(rows).
 *
 * Same-day collapse (REVIEWS.md action item 4): when multiple records exist for
 * the same (date, repo, cell), the LATER record wins. Implemented as Map.set
 * per (date, cell) — later records simply overwrite earlier same-day entries.
 *
 * Most-recent transition only (RESOLVED Q2): for each cell independently, the
 * reader walks the date-ordered series back-to-front and emits the first
 * transition it finds. Older transitions are discarded.
 *
 * NA-state exclusion: transitions into/out of `not-applicable` are NOT drift
 * signal. Direction stays null for those edges.
 *
 * Resilience: malformed JSON lines and malformed filenames are skipped silently
 * (T-11-02-08 — bounded enum values + structural defence; no 500s on garbage).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { CoverageCellDrift, CoverageDriftDirection } from '@agenticapps/dashboard-shared'

import { isSnapshotFilename, resolveSnapshotDir } from './snapshotPaths.js'

export const CELL_KEYS = ['claudeMd', 'gitNexus', 'wiki', 'workflowVersion'] as const
export type CellKey = (typeof CELL_KEYS)[number]

export type RepoDriftSummary = Record<CellKey, CoverageCellDrift>

interface SnapshotLine {
  ts: string
  family: string
  repo: string
  claudeMd: string
  gitNexus: string
  wiki: string
  workflowVersion: string
}

/**
 * The three "real" cell states. Transitions into/out of these states are drift
 * signal; transitions involving 'not-applicable' are NOT signal (a column that
 * doesn't apply to a repo flipping on/off doesn't tell us anything about that
 * repo's coverage trajectory).
 */
const SIGNAL_STATES = new Set(['fresh', 'stale', 'missing'])

/**
 * 'up' = improvement (missing → stale → fresh ordering); 'down' = regression.
 * Returns null for same-state or for any edge involving 'not-applicable' /
 * an unknown enum value.
 */
function classifyTransition(prev: string, next: string): CoverageDriftDirection | null {
  if (!SIGNAL_STATES.has(prev) || !SIGNAL_STATES.has(next)) return null
  if (prev === next) return null
  const rank: Record<string, number> = { missing: 0, stale: 1, fresh: 2 }
  return rank[next]! > rank[prev]! ? 'up' : 'down'
}

function emptyDrift(): CoverageCellDrift {
  return { direction: null, daysSince: null }
}

function emptySummary(): RepoDriftSummary {
  return {
    claudeMd: emptyDrift(),
    gitNexus: emptyDrift(),
    wiki: emptyDrift(),
    workflowVersion: emptyDrift(),
  }
}

export interface ReadDriftOptions {
  /** Override snapshot dir for testability. */
  dir?: string
  /** Wall-clock anchor for daysSince math (defaults to new Date()). */
  now?: Date
}

/**
 * Bulk-per-repo drift summary across the rolling 14d window.
 *
 * Algorithm:
 *  1. Walk every snapshot file in the dir (isSnapshotFilename filter — defence
 *     against malformed entries).
 *  2. For each NDJSON line, parse defensively (skip on JSON.parse throw).
 *  3. For records matching this repoId (matched via `${family}/${repo}` string
 *     equality — NEVER used as a filesystem path), build a per-cell
 *     `Map<dateStr, stateStr>` where same-day duplicates collapse with
 *     last-record-wins (Map.set overwrites earlier same-day entries).
 *  4. Per cell, sort the date series and find the most-recent transition.
 *  5. Return a complete 4-cell record; cells with no transition return null/null.
 */
export async function readDriftForRepo(
  repoId: string,
  opts: ReadDriftOptions = {},
): Promise<RepoDriftSummary> {
  const dir = opts.dir ?? resolveSnapshotDir()
  const now = opts.now ?? new Date()
  const result = emptySummary()
  if (!existsSync(dir)) return result

  const files = readdirSync(dir).filter(isSnapshotFilename).sort()

  // Per cell: { date → state } with last-record-wins on same-day collapse.
  const perCellSeries: Record<CellKey, Map<string, string>> = {
    claudeMd: new Map(),
    gitNexus: new Map(),
    wiki: new Map(),
    workflowVersion: new Map(),
  }

  for (const f of files) {
    const date = f.slice(0, 10)
    let raw: string
    try {
      raw = readFileSync(join(dir, f), 'utf8')
    } catch {
      continue
    }
    for (const line of raw.split('\n')) {
      if (!line) continue
      let rec: SnapshotLine
      try {
        rec = JSON.parse(line) as SnapshotLine
      } catch {
        continue
      }
      // repoId is `${family}/${repo}` — string-equality match against the
      // composed id. NEVER used as a filesystem path (T-11-02-02 defence).
      const recRepoId = `${rec.family}/${rec.repo}`
      if (recRepoId !== repoId) continue
      // Last-record-wins per (date, cell) — Map.set overwrites prior entry.
      for (const cell of CELL_KEYS) {
        perCellSeries[cell].set(date, rec[cell])
      }
    }
  }

  // Compute most-recent transition per cell (RESOLVED Q2).
  for (const cell of CELL_KEYS) {
    const series = Array.from(perCellSeries[cell].entries()).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )
    for (let i = series.length - 1; i > 0; i -= 1) {
      const [, prevState] = series[i - 1]!
      const [date, nextState] = series[i]!
      const direction = classifyTransition(prevState, nextState)
      if (direction !== null) {
        const transitionDate = new Date(`${date}T00:00:00.000Z`)
        const daysSince = Math.max(
          0,
          Math.floor((now.getTime() - transitionDate.getTime()) / (24 * 60 * 60 * 1000)),
        )
        result[cell] = { direction, daysSince }
        break
      }
    }
  }

  return result
}
