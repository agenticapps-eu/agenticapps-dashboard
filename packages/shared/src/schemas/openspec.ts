import { z } from 'zod'

import { OpenChangeSummarySchema } from './registry.js'

/**
 * The single-project OpenSpec state — project-dashboard › Change Progress
 * Column + Capability Panel.
 *
 * This is the home card's `OpenChangeSummary` widened with the one field the
 * detail view needs and the card does not: which capabilities the change's
 * spec deltas touch. Extending rather than redeclaring keeps the two shapes
 * from drifting — the card's fields have exactly one definition.
 */
export const OpenspecChangeDetailSchema = OpenChangeSummarySchema.extend({
  /**
   * Capability ids taken from the change's own `specs/` tree — one per
   * `specs/<capability>/`. Empty is a legitimate in-progress state, not an
   * error: a change with no spec delta yet affects no capability, and is still
   * listed.
   */
  affectedCapabilities: z.array(z.string().min(1)),
}).strict()
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
 * One archived change. `datePrefix` is the zero-padded ISO prefix that makes
 * lexicographic order chronological by construction, or null when the name
 * does not carry one — in which case no chronological claim is made for it.
 */
export const OpenspecArchivedChangeSchema = z
  .object({
    name: z.string().min(1),
    datePrefix: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  })
  .strict()
export type OpenspecArchivedChange = z.infer<typeof OpenspecArchivedChangeSchema>

/**
 * `present` is false when the project has no `openspec/` directory at all.
 * That is the "not migrated" floor, and it is distinct from a present tree
 * carrying no specs or no open changes — each drives a different empty state,
 * so none of the three may be inferred from an empty collection alone.
 *
 * Strict, following the registry and overview precedent: a silently stripped
 * key is a schema drift no panel ever sees.
 */
export const OpenspecProjectStateSchema = z
  .object({
    present: z.boolean(),
    openChanges: z.array(OpenspecChangeDetailSchema),
    capabilities: z.array(OpenspecCapabilitySchema),
    archived: z.array(OpenspecArchivedChangeSchema),
  })
  .strict()
export type OpenspecProjectState = z.infer<typeof OpenspecProjectStateSchema>
