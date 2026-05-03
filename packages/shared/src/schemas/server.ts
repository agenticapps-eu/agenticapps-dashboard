import { z } from 'zod'

export const ServerInfoSchema = z.object({
  bindUrl: z.string().url(),
  pid: z.number().int().positive(),
  startedAt: z.string().datetime(),
})
export type ServerInfo = z.infer<typeof ServerInfoSchema>
