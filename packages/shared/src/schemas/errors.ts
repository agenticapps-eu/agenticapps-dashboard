import { z } from 'zod'

export const ErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string().min(1),
  requestId: z.string().min(1),
  issues: z
    .array(
      z.object({
        path: z.array(z.string()),
        message: z.string(),
      }),
    )
    .optional(),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
