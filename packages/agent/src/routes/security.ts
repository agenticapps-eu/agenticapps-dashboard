/**
 * GET /api/projects/:id/security — PHASE-04.
 * Returns /cso + database-sentinel summaries from the latest phase dir.
 *
 * 5s daemon memo via phaseCache key `${id}:security`.
 * Bearer-token gated via app.ts middleware.
 */
import { Hono } from 'hono'
import { SecurityResponseSchema } from '@agenticapps/dashboard-shared'

import { readRegistry } from '../lib/registry.js'
import { findLatestPhaseDir } from '../lib/projectOverview.js'
import { parseSecurityReports } from '../lib/phaseDetail.js'
import { getPhaseCache, setPhaseCache } from '../lib/phaseCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const securityRoute = new Hono<Env>()

securityRoute.get('/:id/security', async (c) => {
  const id = c.req.param('id')
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === id)
  if (!entry) {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
  }
  const cacheKey = `${id}:security`
  const cached = getPhaseCache(cacheKey)
  if (cached !== null) {
    return outbound(c, SecurityResponseSchema.parse.bind(SecurityResponseSchema), cached)
  }
  const phaseDir = findLatestPhaseDir(entry.root)
  const value = phaseDir
    ? parseSecurityReports(phaseDir)
    : { cso: null, dbSentinel: null }
  setPhaseCache(cacheKey, value)
  return outbound(c, SecurityResponseSchema.parse.bind(SecurityResponseSchema), value)
})
