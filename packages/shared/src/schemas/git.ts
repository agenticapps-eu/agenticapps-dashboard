import { z } from 'zod'

export const GitResponseSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int(),
})
export type GitResponse = z.infer<typeof GitResponseSchema>
