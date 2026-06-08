import { timingSafeEqual } from 'node:crypto'

import { Hono } from 'hono'
import type { HttpBindings } from '@hono/node-server'
import { cors } from 'hono/cors'
import { bearerAuth } from 'hono/bearer-auth'
import { logger } from 'hono/logger'

import { PROD_ORIGIN, DEV_ORIGIN, CORS_MAX_AGE_SECONDS } from '../constants.js'
import { getActiveToken } from '../lib/auth.js'
import { generateRequestId, redactTokens } from '../lib/logging.js'
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
import { phaseProgressRoute } from '../routes/phaseProgress.js'
import { securityRoute } from '../routes/security.js'
import { skillsRoute } from '../routes/skills.js'
import { agentlinterRoute } from '../routes/agentlinter.js'
import { observabilityRoute } from '../routes/observability.js'
import { secretsRoute } from '../routes/secrets.js'
import { integrationsRoute } from '../routes/integrations.js'
import { coverageRoute } from '../routes/coverage.js'
import { coverageHistoryRoute } from '../routes/coverageHistory.js'
import { skillDriftRoute } from '../routes/skillDrift.js'
import { conformanceRoute } from '../routes/conformance.js'
import { registryFixPathRoute } from '../routes/registryFixPath.js'
import { gitnexusScanRoute } from '../routes/gitnexusScan.js'
import { understandViewerRoute, understandDataRoute } from '../routes/understandViewer.js'

import { errorHandler } from './middleware/errors.js'
import { cidrMiddleware } from './middleware/cidr.js'

/** Daemon bind mode — set at startup via CLI --bind flag, immutable per daemon lifetime. */
export type BindMode = 'loopback' | 'tailscale' | '0.0.0.0'

export type Variables = {
  requestId: string
  /** Override registry file path (for tests). Defaults to REGISTRY_FILE constant. */
  registryFile?: string
  /** Override auth file path (for tests). Defaults to AUTH_FILE constant. */
  authFile?: string
  /** Daemon bind mode — loopback | tailscale | 0.0.0.0. Set from CLI --bind flag at startup. */
  bindMode: BindMode
  /** Override viewer token file path (for tests). Defaults to VIEWER_TOKEN_FILE constant. */
  viewerTokenFile?: string
  /**
   * Override repoId → root path resolution (for tests).
   * When set, understandViewer resolves repoIds from this map instead of registry + FS.
   */
  viewerRootOverrides?: Record<string, string>
  /**
   * Override the viewer install directory base path (for tests).
   * When set, getInstalledViewerPath() is called on this dir instead of UNDERSTAND_VIEWER_DIR.
   */
  viewerDirOverride?: string
}
export type Env = { Bindings: HttpBindings; Variables: Variables }

export interface CreateAppOptions {
  enforceCIDR?: boolean
  /** Override registry file path (for isolated testing). */
  registryFile?: string
  /** Override auth file path (for isolated testing). */
  authFile?: string
  /** Daemon bind mode — defaults to 'loopback' (safest; refuses scan routes). */
  bindMode?: BindMode
  /** Override viewer token file path (for isolated testing). */
  viewerTokenFile?: string
  /**
   * Override repoId → root path map (for isolated testing).
   * Bypasses registry + FS resolution in understandViewer routes.
   */
  viewerRootOverrides?: Record<string, string>
  /**
   * Override the viewer install directory base path (for isolated testing).
   * Passed to getInstalledViewerPath() instead of UNDERSTAND_VIEWER_DIR.
   */
  viewerDirOverride?: string
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
 *   4a. understandDataRoute  — Phase 14 D-14-03/D-14-04: scoped ?token= auth
 *                        (per-repo viewer tokens); mounted pre-bearerAuth by
 *                        design; static assets tokenless (no project data);
 *                        full Tailscale parity (read-only surface, contrast D-13-11)
 *   4b. understandViewerRoute — same rationale as 4a (static SPA serving)
 *   5. bearerAuth      — verifyToken reads in-memory activeToken ref at
 *                        request entry (D-15)
 *   6. routes          — business logic
 *   7. onError         — errorHandler (D-06 NODE_ENV-gated verbosity)
 */
export function createApp(opts: CreateAppOptions = {}): Hono<Env> {
  const bindMode: BindMode = opts.bindMode ?? 'loopback'
  const app = new Hono<Env>()

  // 1. Logger — print fn redacts ?token= viewer tokens before they hit stdout
  //    (CSO item 1; Hono's logger logs the full path including query string).
  app.use(logger((message: string, ...rest: string[]) => console.log(redactTokens(message), ...rest)))

  // 2. requestId injection + bindMode + optional file-path overrides (for isolated testing)
  app.use(async (c, next) => {
    c.set('requestId', generateRequestId())
    c.set('bindMode', bindMode)
    if (opts.registryFile) c.set('registryFile', opts.registryFile)
    if (opts.authFile) c.set('authFile', opts.authFile)
    if (opts.viewerTokenFile) c.set('viewerTokenFile', opts.viewerTokenFile)
    if (opts.viewerRootOverrides) c.set('viewerRootOverrides', opts.viewerRootOverrides)
    if (opts.viewerDirOverride) c.set('viewerDirOverride', opts.viewerDirOverride)
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

  // Phase 14 D-14-03/D-14-04: scoped ?token= viewer routes mounted BEFORE bearerAuth.
  // These routes use per-repo viewer tokens (verifyViewerToken, ?token= param), not
  // the main bearer token. Mounting here short-circuits the bearerAuth middleware so
  // the browser can reach data endpoints and static assets without an Authorization header.
  //
  // D-14-04: no bindMode check in understandViewer — full Tailscale parity (deliberate
  // contrast with D-13-11/gitnexusScan which refuses non-loopback because it spawns
  // processes; these routes are read-only data serving only).
  app.route('/understand', understandViewerRoute)  // Phase 14 D-14-03/D-14-04
  app.route('/', understandDataRoute)  // Phase 14 D-14-03/D-14-04: root-absolute data endpoints

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
  app.route('/api/projects', disciplineRoute)
  app.route('/api/projects', observationsRoute)
  app.route('/api/projects', phaseProgressRoute)
  app.route('/api/projects', securityRoute)
  app.route('/api', skillsRoute)
  app.route('/api/projects', agentlinterRoute)
  app.route('/api/projects', observabilityRoute)
  app.route('/api/projects', secretsRoute)
  app.route('/api/projects', integrationsRoute)
  app.route('/api', coverageRoute)
  app.route('/api', coverageHistoryRoute) // Phase 11 TRD-03 (PD-11-02 bulk-per-repo)
  app.route('/api', skillDriftRoute) // Phase 11 SKD-02, SKD-03 (D-11-14 single-project-per-request)
  app.route('/api', conformanceRoute) // Phase 12 D-12-14: GET /api/observability/conformance
  app.route('/api/admin', registryFixPathRoute) // Phase 12 D-12-19, D-12-26: POST /api/admin/registry/fix-path
  app.route('/api/gitnexus', gitnexusScanRoute) // Phase 13 D-13-11: POST /api/gitnexus/scan + GET /api/gitnexus/scan/:id

  // 7. Error handler (last — RESEARCH Pitfall 8: do NOT run error responses through D-16 outbound parse)
  app.onError(errorHandler)

  return app
}
