/**
 * GET /api/projects/:id/overview — rich project overview for the home-page card.
 *
 * Composes:
 * - readOverview() filesystem reader (projectOverview.ts, Wave 0)
 * - getCached/setCached (overviewCache.ts, D-02 5s memo)
 * - outbound() schema-drift defense (Phase 1 D-16)
 *
 * Bearer-token gated via app.ts middleware (no per-route auth needed).
 */
import { Hono } from 'hono'
import { ProjectOverviewSchema } from '@agenticapps/dashboard-shared'

import { readRegistry } from '../lib/registry.js'
import { readOverview } from '../lib/projectOverview.js'
import { getCached, setCached } from '../lib/overviewCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const overviewRoute = new Hono<Env>()

overviewRoute.get('/:id/overview', async (c) => {
  const id = c.req.param('id')
  const registryFile = c.get('registryFile') as string | undefined
  const reg = readRegistry(registryFile)
  const entry = reg.projects.find((p) => p.id === id)

  if (!entry) {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
  }

  // D-02: Check 5s in-process memo cache first
  const cached = getCached(id)
  if (cached) {
    return outbound(c, ProjectOverviewSchema.parse.bind(ProjectOverviewSchema), cached)
  }

  // Cache miss: read from filesystem
  const value = await readOverview(entry.root)
  setCached(id, value)

  return outbound(c, ProjectOverviewSchema.parse.bind(ProjectOverviewSchema), value)
})
