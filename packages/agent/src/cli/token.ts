import pc from 'picocolors'

import type { ServerInfo } from '@agenticapps/dashboard-shared'

import { agentLog } from '../lib/logging.js'
import { ensureAuthFile, readAuthFile, rotateToken } from '../lib/auth.js'
import { readServerInfo as defaultReadServerInfo } from '../lib/serverInfo.js'
import { PROD_ORIGIN, DEFAULT_HOST, DEFAULT_PORT } from '../constants.js'

export interface RotateTokenSmartDeps {
  /** Override server.json reader (for tests). Defaults to readServerInfo(). */
  readServerInfo?: () => ServerInfo | null
  /** Override global fetch (for tests). Defaults to global fetch. */
  fetchFn?: typeof fetch
  /** Override auth file path (for tests). Defaults to AUTH_FILE constant. */
  authFile?: string
  /** Override viewer token file path (for tests). Defaults to VIEWER_TOKEN_FILE constant. */
  viewerTokenFile?: string
}

export type RotateTokenMethod = 'daemon' | 'direct'

export interface RotateTokenSmartResult {
  newToken: string
  method: RotateTokenMethod
  /** Non-fatal advisory message — e.g., "daemon unreachable, restart required". */
  warning?: string
}

/**
 * F-006: rotate the daemon's bearer token, coordinating with the running
 * daemon process when one is detected so the daemon's in-memory activeToken
 * flips along with the auth.json file on disk.
 *
 * Decision tree:
 *  - No server.json (daemon definitely not running per its bookkeeping)
 *      → direct rotation. Standard behavior. No warning.
 *  - server.json present + daemon reachable + 2xx
 *      → daemon-mediated rotation. The daemon's POST /api/auth/rotate handler
 *        writes auth.json BEFORE flipping its in-memory ref (D-15), so this
 *        path re-reads auth.json after the 204 to surface the new token.
 *  - server.json present + network error (ECONNREFUSED, timeout, etc.)
 *      → fall back to direct, warn loudly. The server.json may be stale
 *        (crashed daemon left it behind) so direct is correct; if a daemon
 *        IS running, the user needs to restart it to pick up the new token.
 *  - server.json present + daemon refuses (4xx/5xx)
 *      → THROW. Falling back would write a new token to auth.json while the
 *        daemon's in-memory still holds the old one → disk/memory divergence.
 *        Surface the refusal so the user can investigate (auth.json
 *        corruption, race with another rotation, etc.).
 */
export async function rotateTokenSmart(
  deps: RotateTokenSmartDeps = {},
): Promise<RotateTokenSmartResult> {
  const readServer = deps.readServerInfo ?? defaultReadServerInfo
  const doFetch = deps.fetchFn ?? fetch
  const authFile = deps.authFile
  const viewerTokenFile = deps.viewerTokenFile

  // Always lazy-init so the token file exists and we know its current value.
  const existing = authFile ? ensureAuthFile(authFile) : ensureAuthFile()

  const info = readServer()
  if (!info) {
    const next = rotateToken(authFile, viewerTokenFile)
    return { newToken: next.token, method: 'direct' }
  }

  // Daemon recorded as running — try the HTTP route.
  let res: Response
  try {
    res = await doFetch(`${info.bindUrl}/api/auth/rotate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${existing.token}` },
    })
  } catch (err) {
    // Network error — daemon likely down or server.json stale. Direct
    // rotation is safe (no in-memory token to diverge from a real daemon).
    const next = rotateToken(authFile, viewerTokenFile)
    return {
      newToken: next.token,
      method: 'direct',
      warning:
        `Could not reach daemon at ${info.bindUrl} (${(err as Error).message}). ` +
        `Rotated auth.json directly. If a daemon IS running, restart it so it picks up the new token.`,
    }
  }

  if (!res.ok) {
    // Daemon refused. Do NOT fall back — that would write a new token to
    // auth.json while the daemon's in-memory still holds the old. Surface
    // the refusal so the user can investigate.
    throw new Error(
      `Daemon at ${info.bindUrl} refused rotation with HTTP ${res.status}. ` +
        `auth.json is unchanged. Check if another rotation is in flight, ` +
        `if auth.json has been replaced out-of-band, or restart the daemon.`,
    )
  }

  // 2xx — daemon rotated. Re-read auth.json to get the new token (D-15
  // guarantees the file is written before /api/auth/rotate returns 204).
  const updated = authFile ? readAuthFile(authFile) : readAuthFile()
  return { newToken: updated.token, method: 'daemon' }
}

export async function runRotateToken(): Promise<void> {
  try {
    const result = await rotateTokenSmart()
    if (result.method === 'daemon') {
      agentLog(pc.green('token rotated (via running daemon).'))
    } else {
      agentLog(pc.green('token rotated.'))
      if (result.warning) agentLog(pc.yellow(result.warning))
    }
    agentLog(`new token: ${result.newToken}`)
    process.exit(0)
  } catch (err) {
    agentLog(pc.red(`rotate-token failed: ${(err as Error).message}`))
    process.exit(1)
  }
}

export async function runPair(): Promise<void> {
  const auth = ensureAuthFile() // D-01 lazy init
  const pairAgent = encodeURIComponent(`http://${DEFAULT_HOST}:${DEFAULT_PORT}`)
  agentLog(`Pair this device:`)
  agentLog(`  ${PROD_ORIGIN}/pair?agent=${pairAgent}&token=${auth.token}`)
  process.exit(0)
}
