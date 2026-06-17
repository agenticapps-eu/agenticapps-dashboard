import { z } from 'zod'

/**
 * CLAUDE.md capability level (L0–L6).
 * L0 = Absent, L1 = Basic, L2 = Scoped, L3 = Structured,
 * L4 = Abstracted, L5 = Maintained, L6 = Adaptive.
 * Uses strict-cumulative semantics: headline level = highest N where
 * all rungs 1..N have passed (CML-04).
 */
export const ClaudeMdLevelSchema = z.number().int().min(0).max(6)
export type ClaudeMdLevel = z.infer<typeof ClaudeMdLevelSchema>

/**
 * Per-rung evaluation result. One entry per rung L1..L6 in the rungs array.
 * The `inferred` field is only meaningful (and only set to true) for L5
 * when awarded via proxy signals rather than hard-verified criteria (CML-03).
 */
export const RungCheckSchema = z.object({
  rung: ClaudeMdLevelSchema, // 1..6
  label: z.string(), // "Basic" | "Scoped" | "Structured" | "Abstracted" | "Maintained" | "Adaptive"
  passed: z.boolean(),
  inferred: z.boolean().optional(), // true ONLY for L5 when awarded via proxy
  evidence: z.array(z.string()), // human-readable pass/fail reasons
})
export type RungCheck = z.infer<typeof RungCheckSchema>

/**
 * Full CLAUDE.md capability-level evaluation result.
 * This is the CML-07 wire contract — shared between daemon and SPA.
 * Mismatch between daemon output and this schema surfaces as a Zod parse
 * failure (schema drift), not a silent TypeScript-only divergence.
 *
 * `level` — headline, strict-cumulative (highest N where L1..N all passed)
 * `levelLabel` — human-readable label for `level`
 * `rungs` — all six rung evaluations (L1..L6), in order
 * `nextSteps` — advice strings for the next unmet rung
 * `inferred` — true if headline level relied on the inferred L5 rung
 */
export const ClaudeMdEvalSchema = z.object({
  level: ClaudeMdLevelSchema,
  levelLabel: z.string(),
  rungs: z.array(RungCheckSchema),
  nextSteps: z.array(z.string()),
  inferred: z.boolean(),
})
export type ClaudeMdEval = z.infer<typeof ClaudeMdEvalSchema>
