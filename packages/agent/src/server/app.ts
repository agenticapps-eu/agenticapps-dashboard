import { Hono } from 'hono'
import type { HttpBindings } from '@hono/node-server'
import { cors } from 'hono/cors'
import { bearerAuth } from 'hono/bearer-auth'
import { logger } from 'hono/logger'

import { PROD_ORIGIN, DEV_ORIGIN } from '../constants.js'
import { getActiveToken } from '../lib/auth.js'
import { generateRequestId } from '../lib/logging.js'
import { cidrMiddleware } from './middleware/cidr.js'
import { errorHandler } from './middleware/errors.js'
import { healthRoute } from '../routes/health.js'
import { adminRoute } from '../routes/admin.js'
import { registryRoute } from '../routes/registry.js'
import { authRoute } from '../routes/auth.js'
import { readRoute } from '../routes/read.js'
import { gitRoute } from '../routes/git.js'

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
 * Middleware ordering per RESEARCH key finding 3 (CORS BEFORE bearerAuth):
 *   1. logger        — capture all requests including failed auth
 *   2. requestId     — inject per-request UUID for log correlation
 *   3. cors          — MUST precede bearerAuth so OPTIONS preflight (no Authorization header) succeeds
 *   4. bearerAuth    — verifyToken reads in-memory activeToken ref at request entry (D-15)
 *   5. cidrMiddleware — optional; only mounted when enforceCIDR is true (D-18)
 *   6. routes        — business logic
 *   7. onError       — errorHandler (D-06 NODE_ENV-gated verbosity)
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

  // 3. CORS BEFORE bearerAuth (RESEARCH Pitfall 1: preflight has no Authorization header)
  app.use(
    cors({
      origin: [PROD_ORIGIN, DEV_ORIGIN],
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      maxAge: 86400,
      credentials: false,
    }),
  )

  // 4. Bearer auth — verifyToken reads in-memory ref at request entry (D-15)
  app.use(bearerAuth({ verifyToken: async (token) => token === getActiveToken() }))

  // 5. CIDR enforcement (only when --bind tailscale or 0.0.0.0 from boot, per D-18)
  if (opts.enforceCIDR) app.use(cidrMiddleware())

  // 6. Routes
  app.route('/health', healthRoute)
  app.route('/api/admin', adminRoute)
  app.route('/api/registry', registryRoute)
  app.route('/api/auth', authRoute)
  app.route('/api/projects', readRoute)
  app.route('/api/projects', gitRoute)

  // 7. Error handler (last — RESEARCH Pitfall 8: do NOT run error responses through D-16 outbound parse)
  app.onError(errorHandler)

  return app
}
