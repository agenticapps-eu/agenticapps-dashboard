import { Hono } from 'hono'
import { HealthResponseSchema, type HealthResponse } from '@agenticapps/dashboard-shared'

import { AGENT_VERSION } from '../version.js'
import { readRegistry } from '../lib/registry.js'
import { getActiveToken } from '../lib/auth.js'
import { outbound } from '../server/middleware/errors.js'
import { detectGitNexusBinary } from '../lib/scanners/gitNexusScanner.js'
import type { Env } from '../server/app.js'

export const healthRoute = new Hono<Env>()

healthRoute.get('/', (c) => {
  const registryFile = c.get('registryFile') as string | undefined
  const bindMode = c.get('bindMode')
  const reg = readRegistry(registryFile)

  // Phase 13 D-13-11b: compute gitnexus composite
  // installed = stat-based probe (no shell-out, survives launchd minimal PATH per Phase 10.6 D-10.6-02)
  // canScan = installed && bindMode === 'loopback' (loopback-only refusal per D-13-11)
  const installed = detectGitNexusBinary()
  const canScan = installed && bindMode === 'loopback'

  const payload: HealthResponse = {
    ok: true,
    version: AGENT_VERSION,
    daemonVersion: AGENT_VERSION,
    registryCount: reg.projects.length,
    paired: getActiveToken().length > 0,
    gitnexus: { installed, canScan },
  }
  // D-16: outbound parse before send (INV-04)
  return outbound(c, HealthResponseSchema.parse.bind(HealthResponseSchema), payload)
})
