import { existsSync } from 'node:fs'

import { agentError, agentLog } from '../lib/logging.js'
import { readServerInfo, removeServerInfo } from '../lib/serverInfo.js'
import { readPidfile, isProcessAlive, removePidfile } from '../lib/pidfile.js'
import { readAuthFile } from '../lib/auth.js'
import { SHUTDOWN_TIMEOUT_MS, PIDFILE } from '../constants.js'

export interface StopOpts {
  force?: boolean
}

/**
 * Wait up to maxMs for the daemon's pidfile to disappear. The daemon's
 * gracefulShutdown removes the pidfile in both the normal-exit and the
 * timeout-killer paths, so pidfile-absence is the reliable cross-platform
 * "daemon is gone" signal — `kill(pid, 0)` would return success on zombie
 * children of the parent process even after the daemon exited (matters in
 * tests and any setup where stop is invoked from the daemon's parent).
 *
 * The CLI does NOT preemptively delete pidfile/server.json: doing so would
 * let a still-running daemon lose its state files and allow a duplicate
 * `start` to race the dying daemon for the port.
 */
async function waitForDaemonGone(maxMs: number, file: string = PIDFILE): Promise<boolean> {
  const start = Date.now()
  const intervalMs = 100
  while (Date.now() - start < maxMs) {
    if (!existsSync(file)) return true
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return !existsSync(file)
}

export async function runStop(opts: StopOpts): Promise<void> {
  void opts
  const info = readServerInfo()
  const auth = (() => {
    try {
      return readAuthFile()
    } catch {
      return null
    }
  })()
  const pidBefore = readPidfile()

  // Primary path (D-05): POST /api/admin/shutdown with bearer token
  if (info && auth) {
    try {
      const res = await fetch(`${info.bindUrl}/api/admin/shutdown`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
        signal: AbortSignal.timeout(5_000),
      })
      if (res.status === 204) {
        agentLog('shutdown requested via /api/admin/shutdown')
        // Wait for the daemon to actually exit (up to its own SHUTDOWN_TIMEOUT_MS
        // grace + a little extra). The daemon's normal-exit path AND the timeout
        // killer both remove pidfile and server.json on exit — we do NOT preempt.
        // If the wait times out we fall through to SIGTERM below.
        if (await waitForDaemonGone(SHUTDOWN_TIMEOUT_MS + 1_000)) {
          process.exit(0)
        }
        agentError('shutdown endpoint returned 204 but daemon did not exit; falling back to SIGTERM')
      } else {
        agentError(
          `shutdown endpoint returned ${res.status}; falling back to SIGTERM`,
        )
      }
    } catch (e) {
      agentError(
        `shutdown endpoint unreachable: ${(e as Error).message}; falling back to SIGTERM`,
      )
    }
  }

  // Fallback path (D-05): SIGTERM via pidfile
  const pid = pidBefore ?? readPidfile()
  if (pid && isProcessAlive(pid)) {
    process.kill(pid, 'SIGTERM')
    agentLog(`SIGTERM sent to pid ${pid}`)
    // Give the signaled daemon a chance to clean up its own state files.
    await waitForDaemonGone(SHUTDOWN_TIMEOUT_MS + 1_000)
    process.exit(0)
  }

  // No daemon running: nothing to stop. Clean up any orphaned state files
  // (these only exist if the previous daemon crashed before its handler ran).
  agentLog('no daemon running')
  removeServerInfo()
  removePidfile()
  process.exit(0)
}
