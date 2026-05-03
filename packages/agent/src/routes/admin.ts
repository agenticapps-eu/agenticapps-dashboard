import { Hono } from 'hono'

import { agentLog } from '../lib/logging.js'
import type { Env } from '../server/app.js'

export const adminRoute = new Hono<Env>()

adminRoute.post('/shutdown', (c) => {
  // Schedule shutdown after returning 204 so the response gets flushed first
  setImmediate(() => {
    agentLog('shutdown requested via /api/admin/shutdown')
    process.kill(process.pid, 'SIGTERM')
  })
  return c.body(null, 204)
})
