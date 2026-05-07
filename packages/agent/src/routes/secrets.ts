/**
 * GET /api/projects/:id/secrets — HEALTH-04 SecretsHealth data source.
 *
 * Returns SecretsResponseSchema payload — 3-state discriminated union:
 *   - state: 'present-valid'   when .infisical.json exists and has valid workspaceId
 *   - state: 'present-invalid' when .infisical.json exists but is malformed/missing workspaceId
 *   - state: 'absent'          when .infisical.json does not exist
 *
 * Informational only — no Infisical API calls (T-5-NoCloudIO).
 * Inherits bearer-auth + CORS from app.ts middleware chain. No new auth code.
 * Cache: 5s per-projectId memo.
 */
import { Hono } from 'hono'
import { SecretsResponseSchema } from '@agenticapps/dashboard-shared'

import { parseInfisicalConfig } from '../lib/projectMetadataScan.js'
import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const secretsRoute = new Hono<Env>()

interface CacheEntry {
  value: unknown
  cachedAtMs: number
}

const cache = new Map<string, CacheEntry>()
const TTL_MS = 5_000

secretsRoute.get('/:id/secrets', async (c) => {
  const projectId = c.req.param('id')

  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === projectId)
  if (!entry) {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
  }

  const now = Date.now()
  const cached = cache.get(projectId)
  if (cached && now - cached.cachedAtMs < TTL_MS) {
    return outbound(c, SecretsResponseSchema.parse.bind(SecretsResponseSchema), cached.value)
  }

  const value = await parseInfisicalConfig(entry.root)
  cache.set(projectId, { value, cachedAtMs: now })
  return outbound(c, SecretsResponseSchema.parse.bind(SecretsResponseSchema), value)
})

/** Evict secrets cache for a project (call on unregister). */
export function evictSecretsCacheProject(id: string): void {
  cache.delete(id)
}
