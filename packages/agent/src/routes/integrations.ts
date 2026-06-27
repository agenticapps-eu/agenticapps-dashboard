/**
 * GET /api/projects/:id/integrations — HEALTH-05 IntegrationsHealth data source.
 *
 * Returns IntegrationsResponseSchema payload — three-state per integration:
 *   sentry, linear, infisical each → 'configured' | 'present-but-not-configured' | 'not-detected'
 *
 * Detection logic per D-5-19:
 *   Sentry:   envVarPresent = !!SENTRY_AUTH_TOKEN
 *             signalDetected = any sentry signal (SDK dep, .sentryclirc, DSN env)
 *   Linear:   envVarPresent = !!LINEAR_API_KEY
 *             signalDetected = branch name matches ^[A-Z]{2,}-\d+ (via runAllowedGit 'branch')
 *   Infisical:envVarPresent = !!(INFISICAL_TOKEN || INFISICAL_API_TOKEN)
 *             signalDetected = parseInfisicalConfig(...).state === 'present-valid'
 *
 * NEVER calls Sentry / Linear / Infisical APIs (T-5-NoCloudIO).
 * Inherits bearer-auth + CORS from app.ts middleware. No new auth code.
 * Cache: 5s per-projectId memo.
 */
import { Hono } from 'hono'
import { IntegrationsResponseSchema } from '@agenticapps/dashboard-shared'

import {
  parsePackageJsonForSentry,
  parseSentryClirc,
  detectSentryDsnEnv,
  parseInfisicalConfig,
} from '../lib/projectMetadataScan.js'
import { computeIntegrationState } from '../lib/integrationsState.js'
import { runAllowedGit } from '../lib/git.js'
import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const integrationsRoute = new Hono<Env>()

interface CacheEntry {
  value: unknown
  cachedAtMs: number
}

const cache = new Map<string, CacheEntry>()
const TTL_MS = 5_000

/** Linear branch regex: matches typical Linear ticket format e.g. ABC-123 or donald/ABC-123-fix-foo */
const LINEAR_BRANCH_RE = /[A-Z]{2,}-\d+/

integrationsRoute.get('/:id/integrations', async (c) => {
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
    return outbound(c, IntegrationsResponseSchema.parse.bind(IntegrationsResponseSchema), cached.value)
  }

  const root = entry.root

  // ── Sentry ────────────────────────────────────────────────────────────────
  const sentryEnvPresent = !!process.env.SENTRY_AUTH_TOKEN
  const [sentrySdkSignals, sentryClircSignals, sentryDsnSignals] = await Promise.all([
    parsePackageJsonForSentry(root),
    parseSentryClirc(root),
    detectSentryDsnEnv(root),
  ])
  const sentrySignalDetected =
    sentrySdkSignals.length > 0 || sentryClircSignals.length > 0 || sentryDsnSignals.length > 0

  // ── Linear ────────────────────────────────────────────────────────────────
  const linearEnvPresent = !!process.env.LINEAR_API_KEY
  let linearSignalDetected = false
  try {
    const branchResult = await runAllowedGit('branch', root)
    if (branchResult.exitCode === 0) {
      linearSignalDetected = LINEAR_BRANCH_RE.test(branchResult.stdout.trim())
    }
  } catch {
    // git failure → treat as not detected
    linearSignalDetected = false
  }

  // ── Infisical ─────────────────────────────────────────────────────────────
  const infisicalEnvPresent = !!(process.env.INFISICAL_TOKEN || process.env.INFISICAL_API_TOKEN)
  const infisicalConfig = await parseInfisicalConfig(root)
  const infisicalSignalDetected = infisicalConfig.state === 'present-valid'

  const value = {
    sentry: computeIntegrationState({ envVarPresent: sentryEnvPresent, signalDetected: sentrySignalDetected }),
    linear: computeIntegrationState({ envVarPresent: linearEnvPresent, signalDetected: linearSignalDetected }),
    infisical: computeIntegrationState({ envVarPresent: infisicalEnvPresent, signalDetected: infisicalSignalDetected }),
    // INFI-03: read-only scope metadata — safe config identifiers, not secrets (Research Finding 8)
    // Only present when .infisical.json is present-valid; absent otherwise (backward-compatible, INV-03)
    ...(infisicalConfig.state === 'present-valid' && {
      infisicalWorkspaceId: infisicalConfig.workspaceId,
      ...(infisicalConfig.defaultEnvironment !== undefined && {
        infisicalEnvironment: infisicalConfig.defaultEnvironment,
      }),
    }),
  }

  cache.set(projectId, { value, cachedAtMs: now })
  return outbound(c, IntegrationsResponseSchema.parse.bind(IntegrationsResponseSchema), value)
})

/** Evict integrations cache for a project (call on unregister). */
export function evictIntegrationsCacheProject(id: string): void {
  cache.delete(id)
}
