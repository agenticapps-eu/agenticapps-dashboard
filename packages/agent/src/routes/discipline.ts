/**
 * GET /api/projects/:id/discipline — DISC-03.
 * Returns rationalization-table rows + per-row fire counts.
 * Composes readSkillObservations (last 200 lines for fire counting) +
 * parseRationalizationRows.
 *
 * 5s daemon memo via phaseCache key `${id}:discipline`.
 * Bearer-token gated via app.ts middleware.
 */
import { Hono } from 'hono'
import { DisciplineResponseSchema } from '@agenticapps/dashboard-shared'

import { readRegistry } from '../lib/registry.js'
import { readSkillObservations, parseRationalizationRows } from '../lib/phaseDetail.js'
import { getPhaseCache, setPhaseCache } from '../lib/phaseCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

/** Sample size for fire counting — broader than the HookFirings panel's 20-row window. */
const FIRE_COUNT_LIMIT = 200

export const disciplineRoute = new Hono<Env>()

disciplineRoute.get('/:id/discipline', async (c) => {
  const id = c.req.param('id')
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === id)
  if (!entry) {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
  }
  const cacheKey = `${id}:discipline`
  const cached = getPhaseCache(cacheKey)
  if (cached !== null) {
    return outbound(c, DisciplineResponseSchema.parse.bind(DisciplineResponseSchema), cached)
  }
  const { entries } = await readSkillObservations(entry.root, FIRE_COUNT_LIMIT)
  const rationalization = parseRationalizationRows(entry.root, entries)
  const value = { rationalization }
  setPhaseCache(cacheKey, value)
  return outbound(c, DisciplineResponseSchema.parse.bind(DisciplineResponseSchema), value)
})
