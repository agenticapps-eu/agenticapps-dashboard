import { z } from 'zod'

/**
 * D-08-13: The only env keys the daemon is permitted to store in env.json.
 * Unknown keys are rejected at the schema boundary — env.json is not a general
 * secret dump ("deliberately minimal, not a secrets manager").
 *
 * IMPORTANT: This schema is daemon-only (lib/envFile.ts, cli/envCmd.ts).
 * It MUST NOT be re-exported from packages/shared/src/index.ts — a secrets-file
 * shape has no browser surface (T-08-01 / INV-05).
 */
export const ALLOWED_ENV_KEYS = ['SENTRY_AUTH_TOKEN', 'LINEAR_API_KEY', 'INFISICAL_TOKEN'] as const

export const AllowedEnvKeySchema = z.enum(ALLOWED_ENV_KEYS)
export type AllowedEnvKey = z.infer<typeof AllowedEnvKeySchema>

/**
 * Shape of ~/.agenticapps/dashboard/env.json (mode 0600).
 * Mirrors the auth.json pattern: version literal + payload object.
 * D-08-15: loaded at daemon boot, merged under process.env.
 */
export const EnvFileSchema = z.object({
  version: z.literal(1),
  vars: z.record(AllowedEnvKeySchema, z.string()),
})
export type EnvFile = z.infer<typeof EnvFileSchema>
