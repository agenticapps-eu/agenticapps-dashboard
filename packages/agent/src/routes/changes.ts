/**
 * changes.ts — the fleet change board endpoint.
 *
 * Deliberately thin, matching `readiness.ts`: identity, status code, and
 * outbound validation. Every decision about what the board *is* belongs to the
 * service, and every decision about who may ask belongs to the app's middleware
 * chain, which this inherits — bearer auth, the CORS lock and the CIDR gate all
 * run before anything here, and there is no cookie path to any of them.
 *
 * The route takes no parameter at all. Nothing from a request is joined to a
 * path, opened, or passed to anything: the board's corpus is the registry, and
 * the registry is read from disk. It spawns no process.
 */
import { Hono } from 'hono'

import { ChangesFleetResponseSchema } from '@agenticapps/dashboard-shared'

import {
  readChangesFleet,
  type ChangesFleetOptions,
} from '../lib/changes/service.js'
import type { Env } from '../server/app.js'
import { outbound } from '../server/middleware/errors.js'

export const changesRoute = new Hono<Env>()

const parseFleet = ChangesFleetResponseSchema.parse.bind(ChangesFleetResponseSchema)

/** The registry override the test harness installs; undefined in production. */
function scanOptions(c: { get(key: string): unknown }): ChangesFleetOptions {
  const registryFile = c.get('registryFile') as string | undefined
  return registryFile ? { registryFile } : {}
}

changesRoute.get('/changes/fleet', async (c) => {
  return outbound(c, parseFleet, await readChangesFleet(scanOptions(c)))
})
