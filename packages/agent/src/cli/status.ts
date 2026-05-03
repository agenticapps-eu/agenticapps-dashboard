import { StatusResponseSchema } from '@agenticapps/dashboard-shared'

import { agentLog } from '../lib/logging.js'
import { ensureAuthFile, readAuthFile } from '../lib/auth.js'
import { readRegistry } from '../lib/registry.js'
import { readServerInfo } from '../lib/serverInfo.js'
import { isProcessAlive } from '../lib/pidfile.js'
import { AUTH_FILE, DEFAULT_HOST, DEFAULT_PORT } from '../constants.js'

export async function runStatus(opts: { json?: boolean }): Promise<void> {
  ensureAuthFile() // D-01 lazy init

  const reg = readRegistry()
  const serverInfo = readServerInfo()
  const reachable = serverInfo !== null && isProcessAlive(serverInfo.pid)
  const auth = readAuthFile(AUTH_FILE)

  const startedAt = serverInfo ? new Date(serverInfo.startedAt).getTime() : Date.now()
  const tokenAt = new Date(auth.rotatedAt).getTime()
  const now = Date.now()

  const status = StatusResponseSchema.parse({
    reachable,
    uptime: reachable ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0,
    bindUrl: serverInfo?.bindUrl ?? `http://${DEFAULT_HOST}:${DEFAULT_PORT}`,
    registryCount: reg.projects.length,
    pairedSince: reachable ? auth.rotatedAt : null,
    tokenAge: Math.max(0, Math.floor((now - tokenAt) / 1000)),
  })

  if (opts.json) {
    process.stdout.write(JSON.stringify(status, null, 2) + '\n')
    process.exit(0)
  }

  // Pretty table (D-04)
  agentLog(`reachable:     ${status.reachable ? 'yes' : 'no'}`)
  agentLog(`bindUrl:       ${status.bindUrl}`)
  agentLog(`uptime:        ${status.uptime}s`)
  agentLog(`registry:      ${status.registryCount} projects`)
  agentLog(`paired since:  ${status.pairedSince ?? '-'}`)
  agentLog(`token age:     ${status.tokenAge}s`)
  process.exit(0)
}
