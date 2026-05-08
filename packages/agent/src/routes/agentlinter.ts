/**
 * AgentLinter route — HEALTH-02 SkillHealth data source.
 *
 * Route:
 *   GET /api/projects/:id/agentlinter           — cache-aware
 *   GET /api/projects/:id/agentlinter?bypassCache=1 — one-call bypass (D-5-15 retry button)
 *
 * Inherits bearer-auth + CORS from app.ts middleware chain. No new auth code.
 *
 * Cache: agentLinterCache — keyed by (projectId, maxMtime), 1h TTL (D-5-14).
 * bypassCache=1: skips cache lookup AND skips setAgentLinterCached for this call.
 * This is a one-call bypass — subsequent normal calls still use/build the cache.
 *
 * Privacy (T-05-02-AgentLinter-Local): runAgentLinter always uses --local.
 * Timeout (T-05-02-Timeout-DoS): 30s timeout enforced in agentLinterRunner.ts.
 * Schema drift (T-05-02-Schema-Drift): outbound() enforces AgentLinterResponseSchema.parse.
 */
import { Hono } from 'hono'
import { AgentLinterResponseSchema } from '@agenticapps/dashboard-shared'

import { runAgentLinter } from '../lib/agentLinterRunner.js'
import {
  computeMaxMtime,
  getAgentLinterCached,
  setAgentLinterCached,
} from '../lib/agentLinterCache.js'
import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const agentlinterRoute = new Hono<Env>()

agentlinterRoute.get('/:id/agentlinter', async (c) => {
  const projectId = c.req.param('id')
  const bypass = c.req.query('bypassCache') === '1'

  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === projectId)
  if (!entry) {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
  }

  const maxMtime = await computeMaxMtime(entry.root)

  // Cache lookup (skip when bypassCache=1)
  if (!bypass) {
    const cached = getAgentLinterCached(projectId, maxMtime)
    if (cached) {
      const payload = enrichWithCachedAt(cached.result, cached.cachedAt)
      return outbound(
        c,
        AgentLinterResponseSchema.parse.bind(AgentLinterResponseSchema),
        payload,
      )
    }
  }

  // Run fresh scan
  const fresh = await runAgentLinter(entry.root)
  const cachedAt = new Date().toISOString()

  // Store in cache ONLY when not bypassing (bypass = one-call skip)
  if (!bypass) {
    setAgentLinterCached(projectId, { result: fresh, cachedAt, maxMtime })
  }

  const payload = enrichWithCachedAt(fresh, cachedAt)
  return outbound(c, AgentLinterResponseSchema.parse.bind(AgentLinterResponseSchema), payload)
})

/**
 * Enrich the result with a `cachedAt` timestamp on the `ok` kind
 * (other kinds are returned as-is since they have no report to timestamp).
 */
function enrichWithCachedAt(
  result: Awaited<ReturnType<typeof runAgentLinter>>,
  cachedAt: string,
): unknown {
  if (result.kind === 'ok') return { ...result, cachedAt }
  return result
}
