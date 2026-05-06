/**
 * GET /api/projects/:id/commitment — DISC-01.
 * Returns the latest `## Workflow commitment` block from
 * .planning/skill-observations/*.md (highest mtime).
 *
 * 5s daemon memo via phaseCache key `${id}:commitment`.
 * Bearer-token gated via app.ts middleware.
 */
import { Hono } from 'hono'
import { CommitmentBlockResponseSchema } from '@agenticapps/dashboard-shared'

import { readRegistry } from '../lib/registry.js'
import { parseCommitmentBlock } from '../lib/phaseDetail.js'
import { getPhaseCache, setPhaseCache } from '../lib/phaseCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const commitmentRoute = new Hono<Env>()

commitmentRoute.get('/:id/commitment', async (c) => {
  const id = c.req.param('id')
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === id)
  if (!entry) {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
  }
  const cacheKey = `${id}:commitment`
  const cached = getPhaseCache(cacheKey)
  if (cached !== null) {
    return outbound(c, CommitmentBlockResponseSchema.parse.bind(CommitmentBlockResponseSchema), cached)
  }
  const value = parseCommitmentBlock(entry.root)
  setPhaseCache(cacheKey, value)
  return outbound(c, CommitmentBlockResponseSchema.parse.bind(CommitmentBlockResponseSchema), value)
})
