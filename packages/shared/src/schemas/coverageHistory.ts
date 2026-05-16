import { z } from 'zod'

/**
 * Direction of the most-recent cell-state transition within the 14-day window.
 * - 'up'   = improved (e.g., missing → fresh, stale → fresh)
 * - 'down' = regressed (e.g., fresh → stale, stale → missing)
 *
 * Per D-11-03 — CoverageDriftBadge.tsx renders ▲ for 'up', ▼ for 'down'.
 */
export const CoverageDriftDirectionSchema = z.enum(['up', 'down'])
export type CoverageDriftDirection = z.infer<typeof CoverageDriftDirectionSchema>

/**
 * Drift summary for a single cell. direction + daysSince co-vary in practice
 * (both null when no transition is found within the window; both non-null when
 * a transition exists), but the schema permits the cross-field combinations
 * independently so the reader (daemon snapshotReader.ts) is the single
 * enforcement point for the runtime contract. SPA treats a non-null/null
 * combination as "no badge" (purely presentational).
 */
export const CoverageCellDriftSchema = z.object({
  direction: CoverageDriftDirectionSchema.nullable(),
  daysSince: z.number().int().nonnegative().nullable(),
})
export type CoverageCellDrift = z.infer<typeof CoverageCellDriftSchema>

/**
 * Bulk-per-repo drift summary returned by GET /api/coverage/history?repoId=.
 *
 * PD-11-02 — Phase 11 chose the bulk-per-repo shape (one response carries
 * drift for ALL FOUR cells of one repo) over the per-(repo, cell) shape that
 * an earlier draft considered. Why: cuts first-paint fan-out on /coverage
 * from O(rows × cells) ≈ 168 requests to O(rows) ≈ 42 requests; lets
 * CoverageCell stay purely presentational with a `drift?` prop fanned out
 * from its parent CoverageRow which owns the single useCoverageHistory(repoId)
 * hook.
 *
 * windowDays is fixed at 14 (D-11-01 retention window). The literal type
 * forces a deliberate schema bump (`schemaVersion: 2`) before the window
 * can change — guards against silent contract drift.
 *
 * The four cell keys MUST match Phase 10's CoverageResponseSchema column
 * vocabulary exactly (claudeMd | gitNexus | wiki | workflowVersion). All
 * four are REQUIRED — the daemon always returns a complete row even when
 * three of the four have no transition (cells with no transition carry
 * { direction: null, daysSince: null }).
 *
 * `.strict()` rejects extra cell keys so a typo or smuggled column smell
 * surfaces as 400 / parse-error rather than silent acceptance.
 */
export const CoverageHistoryResponseSchema = z.object({
  schemaVersion: z.literal(1),
  repoId: z.string().min(1),
  windowDays: z.literal(14),
  cells: z
    .object({
      claudeMd: CoverageCellDriftSchema,
      gitNexus: CoverageCellDriftSchema,
      wiki: CoverageCellDriftSchema,
      workflowVersion: CoverageCellDriftSchema,
    })
    .strict(),
})
export type CoverageHistoryResponse = z.infer<typeof CoverageHistoryResponseSchema>
