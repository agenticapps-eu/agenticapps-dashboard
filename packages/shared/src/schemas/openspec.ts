import { z } from 'zod'

import { OpenChangeSummarySchema } from './registry.js'

/**
 * The single-project OpenSpec state — project-dashboard › Hybrid OpenSpec Read
 * Strategy.
 *
 * This is the fleet row's `OpenChangeSummary`, held strict. It used to widen
 * that shape with `affectedCapabilities`; the v2 cutover withdrew that field
 * along with the change-progress column that was its only reader. Nothing
 * extends the summary now, and this stays a named shape rather than collapsing
 * into it because strictness is the remaining difference between the two.
 */
export const OpenspecChangeDetailSchema = OpenChangeSummarySchema.strict()
export type OpenspecChangeDetail = z.infer<typeof OpenspecChangeDetailSchema>

/** One declared capability and the number of requirements it states. */
export const OpenspecCapabilitySchema = z
  .object({
    id: z.string().min(1),
    requirementCount: z.number().int().nonnegative(),
  })
  .strict()
export type OpenspecCapability = z.infer<typeof OpenspecCapabilitySchema>

/**
 * `present` is false when the project has no `openspec/` directory at all.
 * That is the "not migrated" floor, and it is distinct from a present tree
 * carrying no specs or no open changes — each drives a different empty state,
 * so none of the three may be inferred from an empty collection alone.
 *
 * There is deliberately no `archived` field. `Hybrid OpenSpec Read Strategy`
 * withdraws archived-change enumeration from this reader; the lifecycle change
 * board renders the archive and reads `openspec/changes/archive/`
 * independently, precisely so this reader — which sits on the `spec` check's
 * hot path — does not pay for board data.
 *
 * Strict, following the registry and overview precedent: a silently stripped
 * key is a schema drift no panel ever sees. Strictness is also what makes the
 * withdrawal enforceable rather than merely intended — a daemon that kept
 * emitting a withdrawn field fails its own outbound validation.
 */
export const OpenspecProjectStateSchema = z
  .object({
    present: z.boolean(),
    openChanges: z.array(OpenspecChangeDetailSchema),
    capabilities: z.array(OpenspecCapabilitySchema),
  })
  .strict()
export type OpenspecProjectState = z.infer<typeof OpenspecProjectStateSchema>
