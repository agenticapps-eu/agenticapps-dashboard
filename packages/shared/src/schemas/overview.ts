import { z } from 'zod'

export const MarkersSchema = z.object({
  gitRepo: z.boolean(),
  planning: z.boolean(),
  claudeSkills: z.boolean(),
})
export type Markers = z.infer<typeof MarkersSchema>

/**
 * What the daemon can still derive about a project once the GSD phase reader is
 * retired. `tdd` and `branch` come from git history, `markers` from the presence
 * of directories in the project root — none of them from `.planning/phases/`.
 *
 * The phase fields that used to live here (`phaseStatus`, `stage1`, `stage2`,
 * `dbAudit`, `verification`) were each parsed out of a phase directory's
 * artifacts. That directory is no longer read, so the fields are removed rather
 * than approximated: a field with no source renders a fabricated number.
 *
 * Strict, so a producer still emitting the old shape fails the parse loudly
 * instead of having its extra keys silently stripped.
 */
export const ProjectOverviewSchema = z
  .object({
    tdd: z
      .object({
        greenPairs: z.number().int().nonnegative(),
        totalTasks: z.number().int().nonnegative(),
      })
      .nullable(),
    branch: z.string().nullable(),
    markers: MarkersSchema,
  })
  .strict()
export type ProjectOverview = z.infer<typeof ProjectOverviewSchema>
