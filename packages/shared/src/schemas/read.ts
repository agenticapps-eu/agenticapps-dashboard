import { z } from 'zod'

export const ReadResponseSchema = z.object({
  content: z.string(),
  mtime: z.string().datetime(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
})
export type ReadResponse = z.infer<typeof ReadResponseSchema>
