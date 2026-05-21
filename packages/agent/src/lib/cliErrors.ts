/**
 * cliErrors.ts — CLI-side translators for library errors that need a
 * user-facing message + exit code instead of a raw stack trace.
 *
 * Daemon parallel: the daemon's fix-path route (`routes/registryFixPath.ts`)
 * maps `registry_lock_timeout` to HTTP 503; CLI mirrors with stderr + exit 1.
 * Keeps the lock-contention story consistent across surfaces.
 */

import { agentError } from './logging.js'

/**
 * If `err` is a registry-lock-timeout Error (the well-known message thrown
 * by `withRegistryLock`), print a friendly stderr line and `process.exit(1)`.
 * Otherwise return — the caller is responsible for handling or rethrowing
 * any other error.
 *
 * Defensive on non-Error throws: anything that isn't an `Error` instance
 * (string, null, plain object) is treated as "not for us" and returns.
 */
export function exitOnRegistryLockTimeout(err: unknown): void {
  if (err instanceof Error && err.message.startsWith('registry_lock_timeout')) {
    agentError(
      'another agentic-dashboard process is holding the registry lock — try again in a moment',
    )
    process.exit(1)
  }
}
