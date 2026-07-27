/**
 * GET /api/projects/:id/openspec — project-dashboard › Change Progress Column
 * + Capability Panel.
 *
 * The registry list already carries an open-change summary per project, but it
 * deliberately omits what only the single-project view renders: each change's
 * affected capabilities, the capability names with their requirement counts,
 * and the archive. Those belong on a per-project route rather than on the
 * fleet-wide list, which would otherwise carry detail for every home card that
 * exactly one view reads.
 *
 * The read goes through the hybrid reader, so the CLI is preferred where it
 * answers and the tree is the floor that always answers. A project with no
 * `openspec/` tree reads as `present:false` — an accepted state, not an error.
 *
 * 5s daemon memo via phaseCache key `${id}:openspec`. Bearer-token gated via
 * app.ts middleware.
 */
import { Hono } from 'hono'
import { OpenspecProjectStateSchema } from '@agenticapps/dashboard-shared'

import { readRegistry } from '../lib/registry.js'
import { readOpenspecProject } from '../lib/openspecReader.js'
import { getOpenspecBinary } from '../lib/openspecCli.js'
import { getPhaseCache, setPhaseCache } from '../lib/phaseCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const openspecRoute = new Hono<Env>()

openspecRoute.get('/:id/openspec', async (c) => {
  const id = c.req.param('id')
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === id)
  if (!entry) {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
  }

  const parse = OpenspecProjectStateSchema.parse.bind(OpenspecProjectStateSchema)
  const cacheKey = `${id}:openspec`
  const cached = getPhaseCache(cacheKey)
  if (cached !== null) return outbound(c, parse, cached)

  // Resolve-once accessor: the spec forbids a PATH lookup on the request path.
  const binary = await getOpenspecBinary()
  const state = await readOpenspecProject(entry.root, binary)
  setPhaseCache(cacheKey, state)
  return outbound(c, parse, state)
})
