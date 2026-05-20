/**
 * conformance.ts — Phase 12 observability conformance surface wire shape.
 *
 * Source of truth for both daemon (packages/agent) and SPA (packages/spa).
 * Schema drift surfaces as a Zod parse error at the route boundary (INV-04).
 *
 * D-12-14: sibling endpoint `GET /api/observability/conformance` — NOT a
 *   `conformance?: …` field on `CoverageResponse`. Keeps the matrix view
 *   path (`/api/coverage`) hot and tight.
 * D-12-15: separate `schemas/conformance.ts` file (sibling to `coverage.ts`
 *   and `coverageHistory.ts`). Barrel re-export from `index.ts`.
 * D-12-16: bulk-per-family response shape — one fetch per page load.
 * D-12-04: tier mapping ≥90 green / 70-89 amber / <70 red.
 * D-12-05: 0-100 integer score (no decimals).
 *
 * Phase 11 invariant inherited: every nested object is `.strict()` so extra
 * keys are rejected at the wire boundary (T-12-SCHEMA-DRIFT).
 */
import { z } from 'zod'

/**
 * Tier classification (D-12-04) — exported so SPA and daemon agree on the
 * threshold semantics rather than duplicating the magic numbers.
 */
export const ConformanceTierSchema = z.enum(['green', 'amber', 'red'])
export type ConformanceTier = z.infer<typeof ConformanceTierSchema>

/**
 * D-12-04 boundary mapping. ≥90 → green, 70-89 → amber, <70 → red.
 * Inclusive on the floor (90 maps to green, 70 maps to amber).
 */
export function tierOf(score: number): ConformanceTier {
  if (score >= 90) return 'green'
  if (score >= 70) return 'amber'
  return 'red'
}

/**
 * D-12-05: 0-100 integer score (no decimals). Refined at the wire layer so
 * that both the daemon's serializer and the SPA's parser reject `87.3` and
 * `'87'` identically.
 */
const ScoreSchema = z.number().int().min(0).max(100)

/**
 * Per-day point — one entry per day in the 90-day window (D-12-09).
 * Date format is YYYY-MM-DD in UTC (matches Phase 11's NDJSON filename
 * convention — Pitfall 4 in 11-RESEARCH.md). `.strict()` rejects extra keys
 * so a typo or smuggled column surfaces as a parse error rather than silent
 * acceptance.
 */
export const ConformanceDayPointSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD (UTC)
    fleet: ScoreSchema,
    agenticapps: ScoreSchema,
    factiv: ScoreSchema,
    neuroflash: ScoreSchema,
  })
  .strict()
export type ConformanceDayPoint = z.infer<typeof ConformanceDayPointSchema>

/**
 * Reason vocabulary for path drift detection (D-12-18).
 * - `missing` — `existsSync` returned false for the stored path
 * - `symlink-target-changed` — `realpath` resolves to a different location
 * - `git-remote-changed` — `.git/config` origin remote drifted vs the
 *   inferred-on-registration value
 */
export const PathDriftReasonSchema = z.enum([
  'missing',
  'symlink-target-changed',
  'git-remote-changed',
])
export type PathDriftReason = z.infer<typeof PathDriftReasonSchema>

/**
 * Drifted registry entry — surfaced on the conformance page (D-12-18..21).
 * `suggestedPath` is null when inference failed (D-12-21 — SPA prompts the
 * user to paste the corrected path; no auto-fix without confirmation).
 */
export const PathDriftEntrySchema = z
  .object({
    id: z.string(), // registry entry id
    storedPath: z.string(), // value currently in registry.json
    suggestedPath: z.string().nullable(), // null when inference failed
    reason: PathDriftReasonSchema,
  })
  .strict()
export type PathDriftEntry = z.infer<typeof PathDriftEntrySchema>

/**
 * Bulk-per-family response (D-12-16). One fetch per page load; ~9KB payload
 * at 90 days × 5 numbers per row — well within the 30s daemon-cache budget.
 *
 * `series` carries up to 90 entries when the window is full and fewer while
 * the NDJSON store is still building (cold-start empty state per D-12-13).
 * `delta14d` carries SIGNED score-point deltas (range -100..+100).
 */
export const ConformanceResponseSchema = z
  .object({
    schemaVersion: z.literal(1),
    today: z
      .object({
        asOf: z.string().datetime(),
        fleet: ScoreSchema,
        agenticapps: ScoreSchema,
        factiv: ScoreSchema,
        neuroflash: ScoreSchema,
      })
      .strict(),
    delta14d: z
      .object({
        fleet: z.number().int(), // signed delta in score points (-100..+100)
        agenticapps: z.number().int(),
        factiv: z.number().int(),
        neuroflash: z.number().int(),
      })
      .strict(),
    series: z.array(ConformanceDayPointSchema), // 90 entries steady-state; 0..89 while warming
    drifted: z.array(PathDriftEntrySchema),
    /**
     * Names of upstream sub-scans that rejected during this aggregation.
     * The orchestrator never raises (so a sub-failure does not 500 the
     * route), but the payload must distinguish "real zero scores" from
     * "scanner crashed". When non-empty, the SPA can surface a banner.
     *
     * Possible entries: 'coverage' (scanCoverageInternal failed),
     * 'drift' (detectPathDrift failed), 'series' (readDailySeriesForFleet
     * failed). Optional for back-compat with v1 clients that ignore it.
     */
    partialFailures: z.array(z.string()).optional(),
  })
  .strict()
export type ConformanceResponse = z.infer<typeof ConformanceResponseSchema>

/**
 * Fix-path request body (D-12-19). The daemon-side handler (Plan 12-02)
 * additionally enforces:
 * - `canonicaliseRoot(newPath)` for realpath-via-realpathSync resolution
 * - `assertRegistrationAllowed(canonical)` blocklist defence
 * - family-root containment check (Pitfall 7 — symlink escape guard)
 * - rate-limiting via `rlConsume(tokHash)` per Phase 1 A-01 pattern
 */
export const RegistryFixPathRequestSchema = z
  .object({
    id: z.string().min(1),
    newPath: z.string().min(1),
  })
  .strict()
export type RegistryFixPathRequest = z.infer<typeof RegistryFixPathRequestSchema>
