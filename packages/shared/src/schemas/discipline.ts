import { z } from 'zod'

/**
 * Single row in the agenticapps-workflow rationalization table.
 * D-4-07: labels parsed at request time from
 * .claude/skills/agenticapps-workflow/skill/SKILL.md.
 */
export const RationalizationRowSchema = z.object({
  label: z.string(),
  fires: z.number().int().nonnegative(),
})
export type RationalizationRow = z.infer<typeof RationalizationRowSchema>

/**
 * GET /api/projects/:id/discipline response.
 * skillInstalled mirrors observations: false → UI shows agenticapps-workflow
 * install hint (parallel to D-4-15 meta-observer hint).
 */
export const DisciplineResponseSchema = z.object({
  rationalization: z.object({
    rows: z.array(RationalizationRowSchema),
    skillInstalled: z.boolean(),
  }),
})
export type DisciplineResponse = z.infer<typeof DisciplineResponseSchema>
