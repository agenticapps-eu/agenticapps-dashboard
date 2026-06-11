/**
 * CLI commands for env.json management — set / unset / list.
 *
 * Security invariants (D-08-13, D-08-14, INV-05):
 * - allow-list enforced at AllowedEnvKeySchema boundary (rejects unknown keys)
 * - full secret values NEVER printed (list shows key + set/unset + source + last-4 masked only)
 * - env.json written atomically at mode 0600 via writeEnvFile (mirrors auth.ts discipline)
 *
 * CLI conventions (mirrors registryCmd.ts + token.ts):
 * - error:   agentError(msg); throw process.exit(1)
 * - success: agentLog(pc.green(msg)); throw process.exit(0)
 * - tabular output: padEnd columns
 */
import pc from 'picocolors'

import { ALLOWED_ENV_KEYS, AllowedEnvKeySchema } from '@agenticapps/dashboard-shared/daemon'

import { ENV_FILE } from '../constants.js'
import { agentError, agentLog } from '../lib/logging.js'
import { readEnvFile, writeEnvFile } from '../lib/envFile.js'

// ---------------------------------------------------------------------------
// runEnvSet
// ---------------------------------------------------------------------------

/**
 * Validate key, merge into env.json, write at 0600, print restart hint.
 *
 * @param key      Env key to set (must be in ALLOWED_ENV_KEYS).
 * @param value    Value to store.
 * @param filePath Override env.json path (for tests).
 */
export async function runEnvSet(
  key: string,
  value: string,
  filePath: string = ENV_FILE,
): Promise<void> {
  // D-08-13: reject keys outside the allow-list
  const keyResult = AllowedEnvKeySchema.safeParse(key)
  if (!keyResult.success) {
    agentError(
      `unknown env key: ${key}. Allowed: ${ALLOWED_ENV_KEYS.join(', ')}`,
    )
    process.exit(1)
  }

  try {
    // Read existing (or seed empty) → merge → write
    const existing = readEnvFile(filePath) ?? { version: 1 as const, vars: {} }
    const merged = {
      version: 1 as const,
      vars: { ...existing.vars, [key]: value },
    }
    writeEnvFile(merged, filePath)
  } catch (err) {
    agentError(`env set failed: ${(err as Error).message}`)
    process.exit(1)
  }

  // CRITICAL: never log `value` — only the key name (INV-05 / D-08-14)
  agentLog(
    pc.green(`${key} saved. Restart the daemon to apply: agentic-dashboard start`),
  )
  process.exit(0)
}

// ---------------------------------------------------------------------------
// runEnvUnset
// ---------------------------------------------------------------------------

/**
 * Validate key, remove it from env.json, rewrite at 0600.
 *
 * @param key      Env key to remove (must be in ALLOWED_ENV_KEYS).
 * @param filePath Override env.json path (for tests).
 */
export async function runEnvUnset(
  key: string,
  filePath: string | undefined = ENV_FILE,
): Promise<void> {
  const keyResult = AllowedEnvKeySchema.safeParse(key)
  if (!keyResult.success) {
    agentError(
      `unknown env key: ${key}. Allowed: ${ALLOWED_ENV_KEYS.join(', ')}`,
    )
    process.exit(1)
  }

  try {
    const existing = readEnvFile(filePath ?? ENV_FILE) ?? { version: 1 as const, vars: {} }
    const updatedVars = { ...existing.vars }
    delete updatedVars[key as keyof typeof updatedVars]
    writeEnvFile({ version: 1 as const, vars: updatedVars }, filePath ?? ENV_FILE)
  } catch (err) {
    agentError(`env unset failed: ${(err as Error).message}`)
    process.exit(1)
  }

  agentLog(pc.green(`${key} removed from env.json.`))
  process.exit(0)
}

// ---------------------------------------------------------------------------
// runEnvList
// ---------------------------------------------------------------------------

/**
 * Print a table of all allowed env keys: key | set/unset | source | masked.
 *
 * D-08-14 redaction: only the last 4 chars of the value are shown (****xxxx).
 * Full token values are NEVER printed at any log level.
 *
 * @param filePath Override env.json path (for tests).
 */
export async function runEnvList(filePath: string = ENV_FILE): Promise<void> {
  const stored = readEnvFile(filePath)

  const KEY_W = 25
  const STATUS_W = 6
  const SOURCE_W = 12

  for (const key of ALLOWED_ENV_KEYS) {
    const fromEnv = key in process.env
    const fileVal = stored?.vars[key as keyof typeof stored.vars]
    const fromFile = fileVal != null

    const isSet = fromEnv || fromFile
    const source = fromEnv ? 'process.env' : fromFile ? 'env.json' : '—'
    const status = isSet ? 'set' : 'unset'

    // Masked: last 4 chars only when value is long enough (WR-04 — D-08-14).
    // For values ≤ 8 chars, revealing last-4 exposes most or all of the secret;
    // suppress the tail entirely so short values are fully masked.
    // NEVER the full value at any log level (INV-05 / D-08-14).
    let masked: string
    if (fromEnv && process.env[key]) {
      const value = process.env[key]!
      const tail = value.length > 8 ? value.slice(-4) : ''
      masked = '****' + tail
    } else if (fromFile && fileVal) {
      const tail = fileVal.length > 8 ? fileVal.slice(-4) : ''
      masked = '****' + tail
    } else {
      masked = '—'
    }

    agentLog(
      `${key.padEnd(KEY_W)}  ${status.padEnd(STATUS_W)}  ${source.padEnd(SOURCE_W)}  ${masked}`,
    )
  }

  process.exit(0)
}
