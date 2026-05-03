import { agentError, agentLog } from '../lib/logging.js'
import { readServerInfo, removeServerInfo } from '../lib/serverInfo.js'
import { readPidfile, isProcessAlive, removePidfile } from '../lib/pidfile.js'
import { readAuthFile } from '../lib/auth.js'

export interface StopOpts {
  force?: boolean
}

export async function runStop(_opts: StopOpts): Promise<void> {
  const info = readServerInfo()
  const auth = (() => {
    try {
      return readAuthFile()
    } catch {
      return null
    }
  })()

  // Primary path (D-05): POST /api/admin/shutdown with bearer token
  if (info && auth) {
    try {
      const res = await fetch(`${info.bindUrl}/api/admin/shutdown`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.status === 204) {
        agentLog('shutdown requested via /api/admin/shutdown')
        // Wait briefly for the daemon to exit, then clean up
        await new Promise((r) => setTimeout(r, 500))
        removeServerInfo()
        removePidfile()
        process.exit(0)
      }
      agentError(
        `shutdown endpoint returned ${res.status}; falling back to SIGTERM`,
      )
    } catch (e) {
      agentError(
        `shutdown endpoint unreachable: ${(e as Error).message}; falling back to SIGTERM`,
      )
    }
  }

  // Fallback path (D-05): SIGTERM via pidfile
  const pid = readPidfile()
  if (pid && isProcessAlive(pid)) {
    process.kill(pid, 'SIGTERM')
    agentLog(`SIGTERM sent to pid ${pid}`)
    process.exit(0)
  }

  agentLog('no daemon running')
  removeServerInfo()
  removePidfile()
  process.exit(0)
}
