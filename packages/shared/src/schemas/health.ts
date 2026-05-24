import { z } from 'zod'

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  message: z.string().optional(),
  // New in Phase 1 (optional for backward-compat with Phase 0 --version --json):
  daemonVersion: z.string().optional(),
  registryCount: z.number().int().nonnegative().optional(),
  paired: z.boolean().optional(),
  // Phase 13 D-13-11b: gitnexus composite field — SPA reads to render Scan pills
  // canScan = installed && bindMode === 'loopback' (loopback-only refusal per D-13-11)
  gitnexus: z.object({
    installed: z.boolean(),
    canScan: z.boolean(),
  }).strict().optional(),
})

export type HealthResponse = z.infer<typeof HealthResponseSchema>
