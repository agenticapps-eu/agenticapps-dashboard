/**
 * env.json I/O — boot-time merge into process.env, 0600 atomic write, CLI read.
 *
 * Security discipline mirrors auth.ts exactly:
 * - assertSecurePermissions (lstat symlink rejection + 0600 check) before any read
 * - atomicWriteFile (tmp+rename, O_EXCL/O_NOFOLLOW) at mode 0o600 on every write
 * - ensureConfigDir (0700 dir creation) reused from auth.ts
 * - EnvFileSchema + parseOrCorrupt for schema validation on every read
 *
 * D-08-12: process.env wins — loadEnvFile only sets a key when !(key in process.env).
 * D-08-13: AllowedEnvKeySchema rejects unknown keys at parse time.
 * INV-03: env.json is optional — absent file is not an error.
 * Pitfall 4: parseOrCorrupt throws StateCorruptionError on invalid JSON/schema;
 *   caller (runStart) wraps in try/catch so boot is never blocked.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { EnvFileSchema, type EnvFile } from '@agenticapps/dashboard-shared/daemon'

import { ENV_FILE } from '../constants.js'

import { assertSecurePermissions, ensureConfigDir } from './auth.js'
import { atomicWriteFile } from './atomicWrite.js'
import { parseOrCorrupt } from './stateCorruption.js'

// ---------------------------------------------------------------------------
// loadEnvFile
// ---------------------------------------------------------------------------

/**
 * Load env.json and merge its vars into process.env (D-08-12 / D-08-15).
 *
 * Rules:
 * 1. If the file is absent, return immediately — env.json is optional (INV-03).
 * 2. Call assertSecurePermissions before reading — rejects symlinks + loose modes (T-08-06).
 * 3. Parse via parseOrCorrupt(EnvFileSchema, …) — throws StateCorruptionError on corruption.
 * 4. Set process.env[key] = value ONLY when !(key in process.env) — process.env wins (INFI-01).
 *
 * @param filePath Override for the env.json path (default: ENV_FILE). Used in tests.
 */
export function loadEnvFile(filePath: string = ENV_FILE): void {
  if (!existsSync(filePath)) return

  assertSecurePermissions(filePath)

  const raw = readFileSync(filePath, 'utf8')
  const data = parseOrCorrupt(EnvFileSchema, JSON.parse(raw), 'env.json')

  for (const [key, value] of Object.entries(data.vars)) {
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

// ---------------------------------------------------------------------------
// writeEnvFile
// ---------------------------------------------------------------------------

/**
 * Persist EnvFile to disk atomically at mode 0600.
 *
 * Steps:
 * 1. EnvFileSchema.parse(data) — validates version + allow-list before touching disk.
 * 2. ensureConfigDir(dirname(filePath)) — creates ~/.agenticapps/dashboard/ at 0700 if absent.
 * 3. atomicWriteFile(filePath, …, 0o600) — tmp+rename; no partial-write exposure (T-08-07).
 *
 * @param data     EnvFile object to persist.
 * @param filePath Override for the env.json path (default: ENV_FILE). Used in tests.
 */
export function writeEnvFile(data: EnvFile, filePath: string = ENV_FILE): void {
  const validated = EnvFileSchema.parse(data)
  ensureConfigDir(dirname(filePath))
  atomicWriteFile(filePath, JSON.stringify(validated, null, 2), 0o600)
}

// ---------------------------------------------------------------------------
// readEnvFile
// ---------------------------------------------------------------------------

/**
 * Read and parse env.json, returning null when the file is absent.
 * Used by the CLI `env list` command to display current stored keys.
 *
 * Calls assertSecurePermissions before reading (same guard as loadEnvFile).
 *
 * @param filePath Override for the env.json path (default: ENV_FILE). Used in tests.
 */
export function readEnvFile(filePath: string = ENV_FILE): EnvFile | null {
  if (!existsSync(filePath)) return null

  assertSecurePermissions(filePath)

  const raw = readFileSync(filePath, 'utf8')
  return parseOrCorrupt(EnvFileSchema, JSON.parse(raw), 'env.json')
}
