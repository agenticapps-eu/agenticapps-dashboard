/**
 * conformanceScore.ts — pure score primitive for Phase 12 fleet conformance.
 *
 * Daemon-side, ZERO I/O. Consumed by Wave 2's `conformanceScan` aggregator +
 * `/api/observability/conformance` route. Mirrored on a per-day basis by
 * `snapshots/snapshotFleetReader.ts` — both files share the score formula but
 * operate on different input shapes (typed CoverageRow here vs raw NDJSON
 * record strings there).
 *
 * Implements:
 *   - D-12-03: equal-weighted % of green cells across the 4 Coverage columns
 *     (CLAUDE.md / GitNexus / Wiki / Workflow).
 *   - D-12-05: Math.round → integer 0..100 (no decimals).
 *   - D-12-06: 3 family cards + 1 fleet aggregate.
 *   - D-12-07: drifted repo IDs (`${family}/${repo}`) are pre-filtered out of
 *     per-family denominators before scoring.
 *   - Pitfall 2 (RESEARCH §): `not-applicable` cells are excluded from BOTH
 *     numerator AND denominator. The gitNexusInstallState=not-installed case
 *     would otherwise cap every family at 75% (3 of 4 columns green) and the
 *     ≥90% green gate would be structurally unreachable.
 *   - Pitfall 3 / A8 (ratified): fleet score = MEAN of 3 family scores
 *     (Math.round((aa + factiv + neuroflash) / 3)) — NOT the more-obvious
 *     sum-over-rows formula. With unequal repo counts (~30 / ~5 / ~5),
 *     sum-over-rows would let agenticapps dominate the fleet polyline;
 *     equal-weight families keep the headline honest.
 *
 * Fleet `green` / `amber` / `red` / `total` fields are SUMS across the 3
 * families — display-only roll-ups. The fleet `score` field is the mean-of-3,
 * NOT recomputed from the rolled-up totals.
 */
import type {
  CoverageFamily,
  CoverageResponse,
  CoverageRow,
} from '@agenticapps/dashboard-shared'

export interface FamilyScore {
  green: number
  amber: number
  red: number
  total: number
  /** Integer 0..100 — Math.round of green/total ratio per D-12-05. */
  score: number
}

/**
 * Equal-weighted % of green cells across the 4 Coverage columns for one
 * family's rows. `not-applicable` cells are skipped — they neither contribute
 * to the numerator (green count) nor the denominator (total count). This is
 * the Pitfall 2 defence that makes gitNexusInstallState=not-installed scores
 * meaningful instead of capped.
 */
function scoreRows(rows: CoverageRow[]): FamilyScore {
  let green = 0
  let amber = 0
  let red = 0
  let total = 0
  for (const row of rows) {
    const cells = [row.claudeMd, row.gitNexus, row.wiki, row.workflowVersion]
    for (const cell of cells) {
      if (cell.state === 'not-applicable') continue // Pitfall 2
      total += 1
      if (cell.state === 'fresh') green += 1
      else if (cell.state === 'stale') amber += 1
      else if (cell.state === 'missing') red += 1
    }
  }
  const score = total === 0 ? 0 : Math.round((green / total) * 100)
  return { green, amber, red, total, score }
}

/**
 * Exported ONLY for unit-test discrimination of the per-family helper.
 * Production callers use `computeConformanceScores`.
 */
export const _scoreRowsForTests = scoreRows

/**
 * Compute per-family + fleet conformance scores from a coverage response.
 *
 * @param coverage - latest CoverageResponse (typically from scanCoverageInternal).
 * @param driftedRepoIds - set of `${family}/${repo}` strings to exclude per D-12-07.
 *   Drifted entries cannot be scored (we cannot read what isn't where the
 *   registry says it is) — they're surfaced in the drift panel instead.
 *
 * @returns Per-family scores plus a fleet aggregate. Fleet score is the
 *   mean of the 3 family scores (Pitfall 3 / A8), NOT sum-over-rows.
 */
export function computeConformanceScores(
  coverage: CoverageResponse,
  driftedRepoIds: Set<string>,
): Record<CoverageFamily | 'fleet', FamilyScore> {
  const byFamily: Record<CoverageFamily, CoverageRow[]> = {
    agenticapps: [],
    factiv: [],
    neuroflash: [],
  }
  for (const row of coverage.rows) {
    const id = `${row.family}/${row.repo}`
    if (driftedRepoIds.has(id)) continue // D-12-07
    byFamily[row.family].push(row)
  }

  const agenticapps = scoreRows(byFamily.agenticapps)
  const factiv = scoreRows(byFamily.factiv)
  const neuroflash = scoreRows(byFamily.neuroflash)

  // Pitfall 3 + A8: fleet = mean of POPULATED family scores, NOT sum-over-rows
  // and NOT mean-of-3-including-zeros. A family with zero rows (single-family
  // install, or transient state during onboarding) was previously treated as
  // "0% conformance" and dragged the fleet aggregate down to ~33% when the
  // other two families were healthy — primary metric silently lying.
  // The correct semantic is "not-applicable": exclude empty families from
  // the divisor, same way Pitfall 2 excludes not-applicable cells.
  const populated = [agenticapps, factiv, neuroflash].filter((f) => f.total > 0)
  const fleetScore =
    populated.length === 0
      ? 0
      : Math.round(populated.reduce((s, f) => s + f.score, 0) / populated.length)

  const fleet: FamilyScore = {
    green: agenticapps.green + factiv.green + neuroflash.green,
    amber: agenticapps.amber + factiv.amber + neuroflash.amber,
    red: agenticapps.red + factiv.red + neuroflash.red,
    total: agenticapps.total + factiv.total + neuroflash.total,
    score: fleetScore, // mean over populated families, NOT mean-of-3
  }

  return { agenticapps, factiv, neuroflash, fleet }
}
