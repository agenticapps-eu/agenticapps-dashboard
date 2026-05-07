/**
 * GET /api/projects/:id/observability — HEALTH-03 ObservabilityHealth data source.
 *
 * Returns ObservabilityResponseSchema payload with three tool states:
 *   - sentry: SDK deps + .sentryclirc + SENTRY_DSN env
 *   - spotlight: @spotlightjs/* deps + .spotlight/ directory
 *   - sentryCli: @sentry/cli dep + scripts + binary on PATH + CI YAML
 *
 * Inherits bearer-auth + CORS from app.ts middleware chain. No new auth code.
 * Cache: 5s per-projectId memo (mirrors Phase 3/4 pattern).
 * Schema drift: outbound() enforces ObservabilityResponseSchema.parse.
 */
import { Hono } from 'hono'
import { ObservabilityResponseSchema } from '@agenticapps/dashboard-shared'

import {
  parsePackageJsonForSentry,
  parsePackageJsonForSentryCli,
  parsePackageJsonForSpotlight,
  parseSentryClirc,
  detectSpotlightDir,
  detectSentryDsnEnv,
  detectSentryCliBinary,
  parseCiWorkflowsForSentry,
} from '../lib/projectMetadataScan.js'
import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const observabilityRoute = new Hono<Env>()

interface CacheEntry {
  value: unknown
  cachedAtMs: number
}

const cache = new Map<string, CacheEntry>()
const TTL_MS = 5_000

observabilityRoute.get('/:id/observability', async (c) => {
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
    return outbound(c, ObservabilityResponseSchema.parse.bind(ObservabilityResponseSchema), cached.value)
  }

  const root = entry.root

  const [sentryDeps, sentryClirc, sentryDsn, spotlightDeps, spotlightDir, sentryCliDeps, sentryCliBin, sentryCliCi] =
    await Promise.all([
      parsePackageJsonForSentry(root),
      parseSentryClirc(root),
      detectSentryDsnEnv(root),
      parsePackageJsonForSpotlight(root),
      detectSpotlightDir(root),
      parsePackageJsonForSentryCli(root),
      detectSentryCliBinary(),
      parseCiWorkflowsForSentry(root),
    ])

  const sentrySignals = [...sentryDeps, ...sentryClirc, ...sentryDsn]
  const spotlightSignals = [...spotlightDeps, ...spotlightDir]
  const sentryCliSignals = [...sentryCliDeps, ...sentryCliBin, ...sentryCliCi]

  const value = {
    sentry: { detected: sentrySignals.length > 0, signals: sentrySignals },
    spotlight: { detected: spotlightSignals.length > 0, signals: spotlightSignals },
    sentryCli: { detected: sentryCliSignals.length > 0, signals: sentryCliSignals },
  }

  cache.set(projectId, { value, cachedAtMs: now })
  return outbound(c, ObservabilityResponseSchema.parse.bind(ObservabilityResponseSchema), value)
})

/** Evict observability cache for a project (call on unregister). */
export function evictObservabilityCacheProject(id: string): void {
  cache.delete(id)
}
