import { z } from 'zod'

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  message: z.string().optional(),
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>
