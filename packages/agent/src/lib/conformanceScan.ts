/**
 * conformanceScan.ts — Wave 2 orchestrator composing Wave 1 primitives into the
 * full ConformanceResponse wire payload.
 *
 * Composes:
 *   - scanCoverageInternal (Phase 10) → today's CoverageResponse
 *   - detectPathDrift (Plan 12-02 Task 2) → drifted entries + repo IDs
 *   - computeConformanceScores (Plan 12-01) → per-family + fleet today scores
 *   - readDailySeriesForFleet (Plan 12-01) → 90-day per-family per-day series
 *
 * delta14d computation:
 *   - When series has 15+ entries, delta = today − series[length - 15]
 *     (today vs the score from 14 days before the last series entry).
 *   - When series has fewer entries, delta = 0 (window not yet built;
 *     reading from a too-shallow series would yield misleading deltas).
 *
 * DEFENSIVE: the orchestrator NEVER raises. Partial failures yield a
 * defensive payload with whatever data is available:
 *   - scanCoverageInternal raise → today/delta zero, series=[], drifted=detector result
 *   - detectPathDrift raise → drifted=[], scoring proceeds with empty drift set
 *   - readDailySeriesForFleet raise → series=[], delta14d=0
 *
 * This file MUST NOT recompute scores per-day — readDailySeriesForFleet already
 * applies the same Pitfall 2 (not-applicable) + Pitfall 3 (mean-of-3) rules.
 * Today's scores come from computeConformanceScores on the live coverage
 * response; the series scores come from the NDJSON-record-equivalent path.
 *
 * D-12-16 / D-12-25.
 */
import type {
  ConformanceDayPoint,
  ConformanceResponse,
  CoverageFamily,
  PathDriftEntry,
} from '@agenticapps/dashboard-shared'

import { computeConformanceScores } from './conformanceScore.js'
import { scanCoverageInternal } from './coverageScan.js'
import { detectPathDrift } from './registryPathDrift.js'
import { readDailySeriesForFleet } from './snapshots/snapshotFleetReader.js'
import { COVERAGE_ROOTS } from './paths.js'

export interface ScanConformanceOptions {
  /** Wall-clock anchor (defaults to new Date()) for `today.asOf` + series window. */
  now?: Date
}

const SCANNED_FAMILIES = ['agenticapps', 'factiv', 'neuroflash'] as const
type ScannedFamily = (typeof SCANNED_FAMILIES)[number]

/**
 * Map a stored registry path to a `${family}/${repo}` ID by family-root prefix
 * matching. Returns null when the path is not under any family root (the
 * detector flagged it as 'git-remote-changed' or stranger).
 *
 * Used to translate drift entries (which carry storedPath) into repo IDs that
 * computeConformanceScores understands.
 */
function pathToRepoId(storedPath: string): string | null {
  for (const family of SCANNED_FAMILIES) {
    const root = COVERAGE_ROOTS[family]()
    // Exact match would mean the registry entry IS a family root — unlikely
    // for a real repo but cheap to handle.
    if (storedPath === root) return null
    if (storedPath.startsWith(root + '/')) {
      const tail = storedPath.slice(root.length + 1)
      const firstSegment = tail.split('/')[0]
      if (firstSegment) return `${family}/${firstSegment}`
    }
  }
  return null
}

/** Zero-valued delta14d for cold-start / failure paths. */
function zeroDelta(): ConformanceResponse['delta14d'] {
  return { fleet: 0, agenticapps: 0, factiv: 0, neuroflash: 0 }
}

/** Empty-payload constructor for catastrophic-failure paths. */
function defensivePayload(
  asOf: string,
  drifted: PathDriftEntry[],
): ConformanceResponse {
  return {
    schemaVersion: 1 as const,
    today: {
      asOf,
      fleet: 0,
      agenticapps: 0,
      factiv: 0,
      neuroflash: 0,
    },
    delta14d: zeroDelta(),
    series: [],
    drifted,
  }
}

/**
 * Compose today + delta + series + drifted into a ConformanceResponse.
 *
 * Failure isolation: each upstream call is independently allSettled or
 * try/catch-wrapped so a single sub-failure does not 500 the route.
 */
export async function scanConformance(
  opts: ScanConformanceOptions = {},
): Promise<ConformanceResponse> {
  const now = opts.now ?? new Date()
  const asOf = now.toISOString()

  // 1. Parallelise the two slowest reads (coverage scan + drift detection).
  //    Both are independent: drift only needs the registry; coverage scan
  //    fans out per-repo scanners that don't touch the registry directly.
  const [coverageResult, driftedResult] = await Promise.allSettled([
    scanCoverageInternal(),
    detectPathDrift(),
  ])

  const driftedEntries: PathDriftEntry[] =
    driftedResult.status === 'fulfilled' ? driftedResult.value : []

  // 2. Build drifted repo IDs Set for per-family denominator exclusion.
  const driftedRepoIds = new Set<string>()
  for (const entry of driftedEntries) {
    const id = pathToRepoId(entry.storedPath)
    if (id) driftedRepoIds.add(id)
  }

  // 3. Coverage scan failure → defensive payload (drifted entries still
  //    returned so the SPA can offer the fix-path affordance).
  if (coverageResult.status !== 'fulfilled') {
    return defensivePayload(asOf, driftedEntries)
  }
  const coverage = coverageResult.value.response

  // 4. Compute per-family + fleet scores from the live coverage response.
  //    computeConformanceScores excludes driftedRepoIds from per-family
  //    denominators (D-12-07) and applies the mean-of-3 fleet aggregation.
  const scores = computeConformanceScores(coverage, driftedRepoIds)

  const today: ConformanceResponse['today'] = {
    asOf,
    fleet: scores.fleet.score,
    agenticapps: scores.agenticapps.score,
    factiv: scores.factiv.score,
    neuroflash: scores.neuroflash.score,
  }

  // 5. 90-day series from NDJSON. Wrapped in try/catch so a reader failure
  //    (corrupted snapshot, missing dir mid-walk) yields series=[] rather
  //    than failing the whole scan.
  let series: ConformanceDayPoint[] = []
  try {
    const raw = await readDailySeriesForFleet({ driftedRepoIds, now })
    series = raw.map((day) => ({
      date: day.date,
      fleet: day.fleet,
      agenticapps: day.agenticapps,
      factiv: day.factiv,
      neuroflash: day.neuroflash,
    }))
  } catch {
    series = []
  }

  // 6. delta14d: today − the series entry dated closest to (now - 14d).
  //    Position-based indexing (series[length-15]) silently lied when the
  //    series had calendar gaps — after a daemon outage, "14d delta" would
  //    actually compare against ~28 days ago because there were fewer
  //    entries than calendar days. The wire field name is `delta14d`, so
  //    we resolve by date.
  //
  //    Algorithm: target = now - 14 days. Walk series backwards (newest
  //    first); the first entry with date <= targetDate is the baseline.
  //    Tolerate gaps — if the exact target date is missing we still
  //    return the closest older entry's delta.
  //
  //    Fallback to zero if no entry old enough exists yet (cold-start
  //    window still warming up). Matches the D-12-13 empty-state.
  let delta14d: ConformanceResponse['delta14d'] = zeroDelta()
  const targetMs = now.getTime() - 14 * 24 * 60 * 60 * 1000
  const targetDate = new Date(targetMs).toISOString().slice(0, 10)
  let baseline: ConformanceDayPoint | null = null
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const candidate = series[i] as ConformanceDayPoint
    if (candidate.date <= targetDate) {
      baseline = candidate
      break
    }
  }
  if (baseline) {
    delta14d = {
      fleet: today.fleet - baseline.fleet,
      agenticapps: today.agenticapps - baseline.agenticapps,
      factiv: today.factiv - baseline.factiv,
      neuroflash: today.neuroflash - baseline.neuroflash,
    }
  }

  return {
    schemaVersion: 1 as const,
    today,
    delta14d,
    series,
    drifted: driftedEntries,
  }
}

// Re-export the family list for downstream consumers (route logging, tests).
export { SCANNED_FAMILIES }
export type { ScannedFamily, CoverageFamily }
