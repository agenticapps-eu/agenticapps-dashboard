/**
 * Daemon-only re-exports from @agenticapps/dashboard-shared.
 *
 * These schemas have no browser surface and are intentionally excluded from
 * the public index.ts (T-08-01 / INV-05 / D-08-13). They are available to
 * the agent package via the "./daemon" subpath export:
 *
 *   import { EnvFileSchema } from '@agenticapps/dashboard-shared/daemon'
 *
 * Never import this barrel from SPA code.
 */
export {
  ALLOWED_ENV_KEYS,
  AllowedEnvKeySchema,
  EnvFileSchema,
  type AllowedEnvKey,
  type EnvFile,
} from './schemas/env.js'
