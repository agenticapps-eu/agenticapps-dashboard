import { Hono } from 'hono'
import { HealthResponseSchema, type HealthResponse } from '@agenticapps/dashboard-shared'

import { AGENT_VERSION } from '../version.js'
import { readRegistry } from '../lib/registry.js'
import { getActiveToken } from '../lib/auth.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const healthRoute = new Hono<Env>()

healthRoute.get('/', (c) => {
  const registryFile = c.get('registryFile') as string | undefined
  const reg = readRegistry(registryFile)
  const payload: HealthResponse = {
    ok: true,
    version: AGENT_VERSION,
    daemonVersion: AGENT_VERSION,
    registryCount: reg.projects.length,
    paired: getActiveToken().length > 0,
  }
  // D-16: outbound parse before send
  return outbound(c, HealthResponseSchema.parse.bind(HealthResponseSchema), payload)
})
