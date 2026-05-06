import { timingSafeEqual } from 'node:crypto'

import { Hono } from 'hono'
import type { HttpBindings } from '@hono/node-server'
import { cors } from 'hono/cors'
import { bearerAuth } from 'hono/bearer-auth'
import { logger } from 'hono/logger'

import { PROD_ORIGIN, DEV_ORIGIN, CORS_MAX_AGE_SECONDS } from '../constants.js'
import { getActiveToken } from '../lib/auth.js'
import { generateRequestId } from '../lib/logging.js'
import { healthRoute } from '../routes/health.js'
import { adminRoute } from '../routes/admin.js'
import { registryRoute } from '../routes/registry.js'
import { authRoute } from '../routes/auth.js'
import { readRoute } from '../routes/read.js'
import { gitRoute } from '../routes/git.js'
import { commitmentRoute } from '../routes/commitment.js'
import { disciplineRoute } from '../routes/discipline.js'
import { observationsRoute } from '../routes/observations.js'
import { overviewRoute } from '../routes/overview.js'

import { errorHandler } from './middleware/errors.js'
import { cidrMiddleware } from './middleware/cidr.js'

export type Variables = {
  requestId: string
  /** Override registry file path (for tests). Defaults to REGISTRY_FILE constant. */
  registryFile?: string
  /** Override auth file path (for tests). Defaults to AUTH_FILE constant. */
  authFile?: string
}
export type Env = { Bindings: HttpBindings; Variables: Variables }

export interface CreateAppOptions {
  enforceCIDR?: boolean
  /** Override registry file path (for isolated testing). */
  registryFile?: string
  /** Override auth file path (for isolated testing). */
  authFile?: string
}

/**
 * Factory function: creates a Hono app with the correct middleware chain.
 *
 * Middleware ordering:
 *   1. logger          — capture all requests including failed auth
 *   2. requestId       — inject per-request UUID for log correlation
 *   3. cidrMiddleware  — when enforceCIDR is true, refuse non-CGNAT IPs
 *                        BEFORE cors so OPTIONS preflight from outside the
 *                        Tailscale range cannot probe daemon presence (D-18)
 *   4. cors            — MUST precede bearerAuth so OPTIONS preflight from
 *                        an allowed-origin browser succeeds without an
 *                        Authorization header (RESEARCH Pitfall 1)
 *   5. bearerAuth      — verifyToken reads in-memory activeToken ref at
 *                        request entry (D-15)
 *   6. routes          — business logic
 *   7. onError         — errorHandler (D-06 NODE_ENV-gated verbosity)
 */
export function createApp(opts: CreateAppOptions = {}): Hono<Env> {
  const app = new Hono<Env>()

  // 1. Logger
  app.use(logger())

  // 2. requestId injection + optional file-path overrides (for isolated testing)
  app.use(async (c, next) => {
    c.set('requestId', generateRequestId())
    if (opts.registryFile) c.set('registryFile', opts.registryFile)
    if (opts.authFile) c.set('authFile', opts.authFile)
    await next()
  })

  // 3. CIDR enforcement (only when --bind tailscale or 0.0.0.0 from boot, per D-18)
  //    Runs BEFORE cors so an OPTIONS preflight from a non-CGNAT IP cannot
  //    leak daemon presence/origin policy via the 204 preflight short-circuit.
  if (opts.enforceCIDR) app.use(cidrMiddleware())

  // 4. CORS BEFORE bearerAuth (RESEARCH Pitfall 1: preflight has no Authorization header)
  app.use(
    cors({
      origin: [PROD_ORIGIN, DEV_ORIGIN],
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      maxAge: CORS_MAX_AGE_SECONDS,
      credentials: false,
    }),
  )

  // 5. Bearer auth — verifyToken reads in-memory ref at request entry (D-15)
  //    Uses timingSafeEqual to prevent string-equality timing leaks; refuses
  //    empty tokens explicitly so a request with `Authorization: Bearer ` (or
  //    a transient activeToken='' state during boot) cannot satisfy the check.
  app.use(
    bearerAuth({
      verifyToken: async (token) => {
        const active = getActiveToken()
        if (!token || !active) return false
        const a = Buffer.from(token)
        const b = Buffer.from(active)
        if (a.length !== b.length) return false
        return timingSafeEqual(a, b)
      },
    }),
  )

  // 6. Routes
  app.route('/health', healthRoute)
  app.route('/api/admin', adminRoute)
  app.route('/api/registry', registryRoute)
  app.route('/api/auth', authRoute)
  app.route('/api/projects', readRoute)
  app.route('/api/projects', gitRoute)
  app.route('/api/projects', overviewRoute)
  app.route('/api/projects', commitmentRoute)
  app.route('/api/projects', observationsRoute)
  app.route('/api/projects', disciplineRoute)

  // 7. Error handler (last — RESEARCH Pitfall 8: do NOT run error responses through D-16 outbound parse)
  app.onError(errorHandler)

  return app
}
