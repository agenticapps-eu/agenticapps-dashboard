/**
 * readiness.ts — the three v2 readiness endpoints.
 *
 * The routes are deliberately thin: identity, status code, and outbound
 * validation. Every decision about what readiness *is* belongs to the service,
 * and every decision about who may ask belongs to the app's middleware chain,
 * which these inherit — bearer auth, the CORS lock, and the CIDR gate all run
 * before anything here is entered, and there is no cookie path to any of them.
 *
 * An unknown repo is a 404 answered from the registry alone, so no identifier
 * from a request is ever joined to a path or opened.
 */
import { Hono } from 'hono'
import {
  FleetResponseSchema,
  RepoDetailResponseSchema,
  type RepoDetailResponse,
} from '@agenticapps/dashboard-shared'

import { DEV_ORIGIN, PROD_ORIGIN } from '../constants.js'
import {
  readFleet,
  readRepo,
  rescanRepo,
  type ReadinessScanOptions,
} from '../lib/readiness/service.js'
import type { Env } from '../server/app.js'
import { outbound } from '../server/middleware/errors.js'

export const readinessRoute = new Hono<Env>()

const parseFleet = FleetResponseSchema.parse.bind(FleetResponseSchema)
const parseDetail = RepoDetailResponseSchema.parse.bind(RepoDetailResponseSchema)

/** The registry override the test harness installs; undefined in production. */
function scanOptions(c: {
  get(key: string): unknown
}): ReadinessScanOptions {
  const registryFile = c.get('registryFile') as string | undefined
  return registryFile ? { registryFile } : {}
}

function notFound(c: {
  get(key: string): unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json(body: unknown, status: 404 | 403): any
}): Response {
  const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
  return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
}

readinessRoute.get('/fleet', async (c) => {
  return outbound(c, parseFleet, await readFleet(scanOptions(c)))
})

readinessRoute.get('/repos/:id', async (c) => {
  const detail = await readRepo(c.req.param('id'), scanOptions(c))
  if (!detail) return notFound(c)
  return outbound(c, parseDetail, detail)
})

readinessRoute.post(
  '/repos/:id/rescan',
  // A state-changing route checks Origin explicitly as well as through the CORS
  // middleware: the middleware governs what a browser will read, this governs
  // what the daemon will do. Mirrors the v2 workflow harness POST.
  async (c, next) => {
    const origin = c.req.header('Origin')
    if (origin && origin !== PROD_ORIGIN && origin !== DEV_ORIGIN) {
      const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
      return c.json({ ok: false, error: 'origin_not_allowed', requestId }, 403)
    }
    await next()
  },
  async (c) => {
    const detail: RepoDetailResponse | null = await rescanRepo(
      c.req.param('id'),
      scanOptions(c),
    )
    if (!detail) return notFound(c)
    return outbound(c, parseDetail, detail)
  },
)
