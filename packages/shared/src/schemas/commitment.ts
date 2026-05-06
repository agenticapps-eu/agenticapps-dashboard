import { z } from 'zod'

/**
 * GET /api/projects/:id/commitment response.
 * D-4-05: latest `## Workflow commitment` block parsed from
 * .planning/skill-observations/*.md (highest mtime). Both fields are null
 * when the block cannot be located (triggers UI-SPEC empty state).
 */
export const CommitmentBlockResponseSchema = z.object({
  markdown: z.string().nullable(),
  sourceFile: z.string().nullable(),
})
export type CommitmentBlockResponse = z.infer<typeof CommitmentBlockResponseSchema>
