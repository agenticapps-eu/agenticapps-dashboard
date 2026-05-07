import { z } from 'zod'

/**
 * Three-state integration configuration status.
 * D-5-19: `configured` = env var present, `present-but-not-configured` = signals
 * detected but no env var, `not-detected` = neither.
 */
export const IntegrationStateSchema = z.enum([
  'configured',
  'present-but-not-configured',
  'not-detected',
])
export type IntegrationState = z.infer<typeof IntegrationStateSchema>

/**
 * GET /api/projects/:id/integrations response.
 * Three integrations: Sentry, Linear, Infisical.
 */
export const IntegrationsResponseSchema = z.object({
  sentry: IntegrationStateSchema,
  linear: IntegrationStateSchema,
  infisical: IntegrationStateSchema,
})
export type IntegrationsResponse = z.infer<typeof IntegrationsResponseSchema>
