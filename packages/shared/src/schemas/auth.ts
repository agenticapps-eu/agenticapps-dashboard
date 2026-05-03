import { z } from 'zod'

export const AuthFileSchema = z.object({
  version: z.literal(1),
  token: z.string().min(1),
  rotatedAt: z.string().datetime(),
  agentVersion: z.string().min(1),
})

export type AuthFile = z.infer<typeof AuthFileSchema>
