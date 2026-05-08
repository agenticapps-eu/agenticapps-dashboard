import { z } from 'zod'

/**
 * A single observability detection signal.
 * D-5-17: 8 enumerated signal names covering Sentry SDK, sentry-cli, and Spotlight.
 */
export const ObservabilitySignalSchema = z.object({
  signal: z.enum([
    'sentry-sdk-dep',
    'sentry-cli-script',
    'sentryclirc',
    'sentry-dsn-env',
    'spotlight-dep',
    'spotlight-dir',
    'sentry-cli-binary',
    'sentry-cli-ci',
  ]),
  evidence: z.string(),
})
export type ObservabilitySignal = z.infer<typeof ObservabilitySignalSchema>

/**
 * Detection state for a single observability tool.
 * `detected` is true if any signal matched (ANY-OR logic per D-5-17).
 */
export const ObservabilityToolStateSchema = z.object({
  detected: z.boolean(),
  signals: z.array(ObservabilitySignalSchema),
})
export type ObservabilityToolState = z.infer<typeof ObservabilityToolStateSchema>

/**
 * GET /api/projects/:id/observability response.
 * Three top-level keys: sentry (SDK + DSN), spotlight, sentryCli (standalone binary).
 */
export const ObservabilityResponseSchema = z.object({
  sentry: ObservabilityToolStateSchema,
  spotlight: ObservabilityToolStateSchema,
  sentryCli: ObservabilityToolStateSchema,
})
export type ObservabilityResponse = z.infer<typeof ObservabilityResponseSchema>
