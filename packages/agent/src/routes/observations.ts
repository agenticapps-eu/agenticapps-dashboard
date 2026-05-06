/**
 * GET /api/projects/:id/observations/recent — DISC-02 + DISC-04.
 * Returns top-N hook firings + skillInstalled flag.
 * Query: ?limit=N (default 20, capped 100).
 *
 * Cache key includes limit so ?limit=5 and ?limit=20 are distinct entries.
 * evictPhaseCacheProject(id) still evicts all of them via prefix match.
 *
 * 5s daemon memo via phaseCache key `${id}:observations:${limit}`.
 * Bearer-token gated via app.ts middleware.
 */
import { Hono } from 'hono'
import { ObservationsRecentResponseSchema } from '@agenticapps/dashboard-shared'

import { readRegistry } from '../lib/registry.js'
import { readSkillObservations } from '../lib/phaseDetail.js'
import { getPhaseCache, setPhaseCache } from '../lib/phaseCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export const observationsRoute = new Hono<Env>()

observationsRoute.get('/:id/observations/recent', async (c) => {
  const id = c.req.param('id')
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === id)
  if (!entry) {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
  }
  // Parse limit param: default 20, clamp to [1, 100]. Non-numeric → default.
  const rawLimit = c.req.query('limit')
  const parsed = rawLimit ? parseInt(rawLimit, 10) : DEFAULT_LIMIT
  const limit = Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, MAX_LIMIT)
    : DEFAULT_LIMIT
  // Cache key includes limit so /observations?limit=5 doesn't serve a /observations?limit=20 cached payload.
  const cacheKey = `${id}:observations:${limit}`
  const cached = getPhaseCache(cacheKey)
  if (cached !== null) {
    return outbound(c, ObservationsRecentResponseSchema.parse.bind(ObservationsRecentResponseSchema), cached)
  }
  const value = await readSkillObservations(entry.root, limit)
  setPhaseCache(cacheKey, value)
  return outbound(c, ObservationsRecentResponseSchema.parse.bind(ObservationsRecentResponseSchema), value)
})
