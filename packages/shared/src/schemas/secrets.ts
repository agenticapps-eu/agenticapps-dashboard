import { z } from 'zod'

/**
 * GET /api/projects/:id/secrets response.
 * D-5-18: 3-state discriminated union on `state`.
 * Informational only — no Infisical API calls, no secret content read.
 */
export const SecretsResponseSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('present-valid'),
    workspaceId: z.string(),
    defaultEnvironment: z.string().optional(),
  }),
  z.object({
    state: z.literal('present-invalid'),
    reason: z.string(),
  }),
  z.object({
    state: z.literal('absent'),
  }),
])
export type SecretsResponse = z.infer<typeof SecretsResponseSchema>
