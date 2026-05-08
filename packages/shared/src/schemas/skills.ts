import { z } from 'zod'

/**
 * Skill SKILL.md frontmatter schema.
 * Uses passthrough so fields like `paths`, `disable-model-invocation`,
 * `allowed-tools`, `triggers`, `hooks` survive validation untouched.
 */
export const SkillFrontmatterSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    version: z.string().optional(),
  })
  .passthrough()
export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>

/**
 * A single skill entry as served by the daemon skills routes.
 * Extends SkillFrontmatterSchema with `dir` (filesystem path to skill root)
 * and `scope` ('global' from ~/.claude/skills or 'local' from project).
 */
export const SkillEntrySchema = SkillFrontmatterSchema.extend({
  dir: z.string(),
  scope: z.enum(['global', 'local']),
})
export type SkillEntry = z.infer<typeof SkillEntrySchema>

/**
 * GET /api/skills/global response.
 * D-5-12: singleton route, daemon-side allow-list anchored at
 * os.homedir() + '/.claude/skills'.
 */
export const GlobalSkillsResponseSchema = z.object({
  scope: z.literal('global'),
  skills: z.array(SkillEntrySchema),
})
export type GlobalSkillsResponse = z.infer<typeof GlobalSkillsResponseSchema>

/**
 * GET /api/projects/:id/skills/local response.
 * Per-project local skills from <root>/.claude/skills.
 */
export const LocalSkillsResponseSchema = z.object({
  scope: z.literal('local'),
  skills: z.array(SkillEntrySchema),
})
export type LocalSkillsResponse = z.infer<typeof LocalSkillsResponseSchema>
