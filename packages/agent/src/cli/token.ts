import pc from 'picocolors'

import { agentLog } from '../lib/logging.js'
import { ensureAuthFile, rotateToken } from '../lib/auth.js'
import { PROD_ORIGIN, DEFAULT_HOST, DEFAULT_PORT } from '../constants.js'

export async function runRotateToken(): Promise<void> {
  ensureAuthFile() // D-01 lazy init
  const next = rotateToken()
  agentLog(pc.green('token rotated.'))
  agentLog(`new token: ${next.token}`)
  process.exit(0)
}

export async function runPair(): Promise<void> {
  const auth = ensureAuthFile() // D-01 lazy init
  const pairAgent = encodeURIComponent(`http://${DEFAULT_HOST}:${DEFAULT_PORT}`)
  agentLog(`Pair this device:`)
  agentLog(`  ${PROD_ORIGIN}/pair?agent=${pairAgent}&token=${auth.token}`)
  process.exit(0)
}
