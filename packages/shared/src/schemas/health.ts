import { z } from 'zod'

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  message: z.string().optional(),
  // New in Phase 1 (optional for backward-compat with Phase 0 --version --json):
  daemonVersion: z.string().optional(),
  registryCount: z.number().int().nonnegative().optional(),
  paired: z.boolean().optional(),
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>
