import { z } from 'zod'

/**
 * Per-(skill, project) matrix cell. Captures presence + frontmatter version +
 * mtime. Null version when frontmatter exists but `version:` field is absent
 * (matches Phase 5 dual-state for skill version probing).
 *
 * Per D-11-04 — primary view is per-skill matrix (rows = skills,
 * columns = projects). This is the cell at the intersection.
 */
export const SkillDriftCellSchema = z.object({
  present: z.boolean(),
  version: z.string().nullable(),
  lastModifiedIso: z.string().datetime().nullable(),
})
export type SkillDriftCell = z.infer<typeof SkillDriftCellSchema>

/**
 * Per-skill row in the matrix. skillId is SKILL.md frontmatter `name` (or
 * dirname fallback when frontmatter missing). byProject keys are registry
 * project IDs (NOT family/repo — Skill drift extends per-project skills which
 * are already registered-project-scoped; matches Phase 5's API surface).
 */
export const SkillDriftRowSchema = z.object({
  skillId: z.string(),
  byProject: z.record(z.string(), SkillDriftCellSchema),
})
export type SkillDriftRow = z.infer<typeof SkillDriftRowSchema>

/**
 * Top-level response. Registered projects in matrix-column order, then
 * per-skill rows.
 *
 * Family enum locked to the three known families plus 'other' fallback
 * (per research finding: live registry has client: null for every entry,
 * so family MUST be derived from path-prefix match against
 * ~/Sourcecode/{agenticapps,factiv,neuroflash}/, with 'other' fallback
 * for off-family registrations).
 *
 * `degraded` carries per-project error context when readLocalSkills threw
 * inside Promise.allSettled (Phase 10 AGREED-2 isolation pattern).
 *
 * PD-11-03 — the daemon response does NOT change shape based on the SPA's
 * `scope` chip; SPA groups/filters client-side from the same payload.
 */
export const SkillDriftResponseSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAtIso: z.string().datetime(),
  projects: z.array(
    z.object({
      projectId: z.string(),
      projectName: z.string(),
      family: z.enum(['agenticapps', 'factiv', 'neuroflash', 'other']),
      degraded: z.string().optional(),
    })
  ),
  rows: z.array(SkillDriftRowSchema),
})
export type SkillDriftResponse = z.infer<typeof SkillDriftResponseSchema>
