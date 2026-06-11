/**
 * GET /api/projects/:id/sentry/recent — SENTRY-01/02/03 + INV-05
 *
 * Returns top-5 recent unresolved Sentry issues for the project when
 * SENTRY_AUTH_TOKEN is set. Returns 404 not_configured when unset.
 *
 * Slug resolution (3-tier, Research Finding 1):
 *   1. .sentryclirc [defaults] org= / project= lines — no API call
 *   2. SENTRY_DSN env var → parse numeric project id → GET /api/0/projects/
 *      list-and-match (cached 10 min, Pitfall 5)
 *   3. SENTRY_ORG_SLUG + SENTRY_PROJECT_SLUG env vars — explicit fallback
 *
 * Cache architecture (D-08-09):
 *   - issues: Map keyed by projectId, TTL 60 s
 *   - slugs:  Map keyed by projectId, TTL 10 min (Pitfall 5 — separate cache)
 *   - lastGood sub-entry survives TTL expiry for stale fallback
 *
 * Security (INV-05 / D-08-11 / T-08-09/10/11):
 *   - SENTRY_AUTH_TOKEN never serialized into any JSON response
 *   - Errors collapsed to 3 categories via classifyError (never raw body)
 *   - Sentry endpoint host hardcoded to sentry.io (T-08-11 — no SSRF)
 *   - Issues + slug caches keyed by projectId (T-08-12 cross-project guard)
 *
 * Route MOUNTING into app.ts happens in Plan 08-05.
 */
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

import { Hono } from 'hono'
import {
  SentryRecentResponseSchema,
  type SentryRecentResponse,
  type SentryIssue,
} from '@agenticapps/dashboard-shared'

import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'
import { fetchWithTimeout, classifyError, type CacheEntry } from '../lib/outboundFetch.js'
import { agentError } from '../lib/logging.js'
import type { Env } from '../server/app.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlugEntry {
  orgSlug: string
  projectSlug: string
  /** Numeric project id as string (for the issues endpoint ?project= param). */
  numericProjectId?: string
  cachedAtMs: number
}

// ---------------------------------------------------------------------------
// Module-level caches (keyed by daemon projectId — T-08-12)
// ---------------------------------------------------------------------------

const issuesCache = new Map<string, CacheEntry<SentryRecentResponse>>()
const slugCache = new Map<string, SlugEntry>()

const ISSUES_TTL_MS = 60_000       // 60 s (SENTRY-02)
const SLUG_TTL_MS = 10 * 60_000    // 10 min (Pitfall 5)

// Sentry API base — hardcoded, no user-supplied URLs (T-08-11)
const SENTRY_API = 'https://sentry.io/api/0'

// ---------------------------------------------------------------------------
// .sentryclirc minimal INI parser (tier-1, Open-Question 3 resolution)
// ---------------------------------------------------------------------------

/**
 * Parse .sentryclirc for [defaults] section org= and project= keys.
 * Accepts only [header] lines and `key = value` / `key=value` lines.
 * No includes, no code execution (security constraint).
 *
 * Returns { org, project } if both found in [defaults], else null.
 */
function parseSentryClircForSlugs(
  root: string,
): { org: string; project: string } | null {
  const clircPath = join(root, '.sentryclirc')
  if (!existsSync(clircPath)) return null

  let contents: string
  try {
    contents = readFileSync(clircPath, 'utf8')
  } catch {
    return null
  }

  let inDefaults = false
  let org: string | undefined
  let project: string | undefined

  for (const rawLine of contents.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith(';') || line.startsWith('#')) continue

    // Section header
    if (line.startsWith('[')) {
      inDefaults = line === '[defaults]'
      continue
    }

    if (!inDefaults) continue

    // key = value (with optional spaces around =)
    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue
    const key = line.slice(0, eqIdx).trim()
    const value = line.slice(eqIdx + 1).trim()

    if (key === 'org') org = value
    else if (key === 'project') project = value
  }

  if (org && project) return { org, project }
  return null
}

// ---------------------------------------------------------------------------
// DSN parser
// ---------------------------------------------------------------------------

/**
 * Parse the numeric project id from a Sentry DSN.
 * DSN format: https://<pubkey>@<host>/<numericProjectId>
 * Returns null if DSN is absent or unparseable.
 */
function parseDsnProjectId(dsn: string): number | null {
  try {
    const url = new URL(dsn)
    const segment = url.pathname.replace(/^\//, '')
    const n = parseInt(segment, 10)
    return isNaN(n) ? null : n
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// /projects/ list pagination helper (tier-2)
// ---------------------------------------------------------------------------

/**
 * Resolve org + project slugs by matching the DSN numeric project id against
 * GET /api/0/projects/ (paginated, max 10 pages).
 *
 * String comparison: `project.id === String(numericId)` (Pitfall 3).
 * Returns null when the project is not found or the API call fails.
 */
async function resolveSlugsByApiList(
  numericProjectId: number,
  token: string,
): Promise<{ orgSlug: string; projectSlug: string } | null> {
  let url: string | null = `${SENTRY_API}/projects/?per_page=100`
  let pagesLeft = 10

  while (url && pagesLeft > 0) {
    pagesLeft--
    let res: Response
    try {
      res = await fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      return null
    }

    if (!res.ok) return null

    let projects: unknown[]
    try {
      projects = (await res.json()) as unknown[]
    } catch {
      return null
    }

    if (!Array.isArray(projects)) return null

    for (const p of projects) {
      if (!p || typeof p !== 'object') continue
      const proj = p as Record<string, unknown>
      // Pitfall 3: compare as strings
      if (proj['id'] !== String(numericProjectId)) continue

      const org = proj['organization']
      if (!org || typeof org !== 'object') continue
      const orgSlug = (org as Record<string, unknown>)['slug']
      const projectSlug = proj['slug']
      if (typeof orgSlug !== 'string' || typeof projectSlug !== 'string') continue
      return { orgSlug, projectSlug }
    }

    // Cursor-based pagination: Link header
    const linkHeader = res.headers.get('Link') ?? ''
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
    url = nextMatch ? nextMatch[1]! : null
  }

  return null
}

// ---------------------------------------------------------------------------
// resolveSentrySlugs — 3-tier resolution (exported for evict)
// ---------------------------------------------------------------------------

/**
 * Resolve Sentry org + project slugs for a registered project root + projectId.
 *
 * Priority:
 *   1. .sentryclirc [defaults] org/project keys
 *   2. SENTRY_DSN env var → parse numeric id → GET /api/0/projects/ match
 *   3. SENTRY_ORG_SLUG + SENTRY_PROJECT_SLUG env vars
 *
 * Result cached with 10-min TTL keyed by projectId (Pitfall 5).
 * Returns null when no tier resolves — route surfaces 'unreachable'.
 */
async function resolveSentrySlugs(
  root: string,
  projectId: string,
  token: string,
): Promise<{ orgSlug: string; projectSlug: string; numericProjectId?: string } | null> {
  const now = Date.now()

  // Cache hit?
  const cached = slugCache.get(projectId)
  if (cached && now - cached.cachedAtMs < SLUG_TTL_MS) {
    const result: { orgSlug: string; projectSlug: string; numericProjectId?: string } = {
      orgSlug: cached.orgSlug,
      projectSlug: cached.projectSlug,
    }
    if (cached.numericProjectId !== undefined) {
      result.numericProjectId = cached.numericProjectId
    }
    return result
  }

  // ── Tier 1: .sentryclirc ──────────────────────────────────────────────────
  const clircSlugs = parseSentryClircForSlugs(root)
  if (clircSlugs) {
    slugCache.set(projectId, {
      orgSlug: clircSlugs.org,
      projectSlug: clircSlugs.project,
      cachedAtMs: now,
    })
    return { orgSlug: clircSlugs.org, projectSlug: clircSlugs.project }
  }

  // ── Tier 2: SENTRY_DSN → /api/0/projects/ match ──────────────────────────
  const dsn = process.env.SENTRY_DSN
  if (dsn) {
    const numericId = parseDsnProjectId(dsn)
    if (numericId !== null) {
      const apiSlugs = await resolveSlugsByApiList(numericId, token)
      if (apiSlugs) {
        slugCache.set(projectId, {
          orgSlug: apiSlugs.orgSlug,
          projectSlug: apiSlugs.projectSlug,
          numericProjectId: String(numericId),
          cachedAtMs: now,
        })
        return {
          orgSlug: apiSlugs.orgSlug,
          projectSlug: apiSlugs.projectSlug,
          numericProjectId: String(numericId),
        }
      }
    }
  }

  // ── Tier 3: explicit env vars ─────────────────────────────────────────────
  const orgSlug = process.env.SENTRY_ORG_SLUG
  const projectSlug = process.env.SENTRY_PROJECT_SLUG
  if (orgSlug && projectSlug) {
    slugCache.set(projectId, { orgSlug, projectSlug, cachedAtMs: now })
    return { orgSlug, projectSlug }
  }

  return null
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const sentryRoute = new Hono<Env>()

sentryRoute.get('/:id/sentry/recent', async (c) => {
  const token = process.env.SENTRY_AUTH_TOKEN
  if (!token) {
    return c.json(
      { ok: false, error: 'not_configured', requestId: c.get('requestId') },
      404,
    )
  }

  const projectId = c.req.param('id')
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === projectId)
  if (!entry) {
    return c.json(
      { ok: false, error: 'project_not_found', requestId: c.get('requestId') },
      404,
    )
  }

  const now = Date.now()

  // ── Cache hit (60s TTL) ───────────────────────────────────────────────────
  const cached = issuesCache.get(projectId)
  if (cached && now - cached.cachedAtMs < ISSUES_TTL_MS) {
    return outbound(
      c,
      SentryRecentResponseSchema.parse.bind(SentryRecentResponseSchema),
      cached.value,
    )
  }

  // ── Slug resolution ───────────────────────────────────────────────────────
  const slugs = await resolveSentrySlugs(entry.root, projectId, token)
  if (!slugs) {
    // Resolution failed — serve stale if available, else 503
    const prev = issuesCache.get(projectId)
    if (prev?.lastGood) {
      const stale: SentryRecentResponse = {
        ...prev.lastGood.value,
        stale: true,
        staleFrom: new Date(prev.lastGood.cachedAtMs).toISOString(),
        staleReason: 'unreachable',
      }
      issuesCache.set(projectId, { ...prev, value: stale, cachedAtMs: now })
      return outbound(
        c,
        SentryRecentResponseSchema.parse.bind(SentryRecentResponseSchema),
        stale,
      )
    }
    return c.json(
      { ok: false, error: 'unreachable', requestId: c.get('requestId') },
      503,
    )
  }

  // ── Fetch issues from Sentry ─────────────────────────────────────────────
  const projectParam = slugs.numericProjectId
    ? `&project=${slugs.numericProjectId}`
    : ''
  const issuesUrl =
    `${SENTRY_API}/organizations/${slugs.orgSlug}/issues/` +
    `?query=is:unresolved&sort=date&limit=5${projectParam}`

  try {
    const res = await fetchWithTimeout(issuesUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      // Non-2xx — parse body for Linear-style rate limit detection (Sentry uses 429)
      let body: unknown
      try {
        body = await res.json()
      } catch {
        body = undefined
      }
      throw Object.assign(new Error(`Sentry HTTP ${res.status}`), {
        _sentryStatus: res.status,
        _sentryBody: body,
      })
    }

    const raw = (await res.json()) as unknown[]
    if (!Array.isArray(raw)) {
      throw new Error('Sentry returned non-array issues response')
    }

    const issues: SentryIssue[] = raw.slice(0, 5).map((item) => {
      const i = item as Record<string, unknown>
      return {
        id: String(i['id'] ?? ''),
        title: String(i['title'] ?? ''),
        level: (i['level'] as SentryIssue['level']) ?? 'error',
        count: String(i['count'] ?? '0'),
        lastSeen: String(i['lastSeen'] ?? ''),
        permalink: String(i['permalink'] ?? ''),
        shortId: String(i['shortId'] ?? ''),
      }
    })

    const data: SentryRecentResponse = { issues, stale: false }
    const newEntry: CacheEntry<SentryRecentResponse> = {
      value: data,
      cachedAtMs: now,
      lastGood: { value: data, cachedAtMs: now },
    }
    issuesCache.set(projectId, newEntry)

    return outbound(
      c,
      SentryRecentResponseSchema.parse.bind(SentryRecentResponseSchema),
      data,
    )
  } catch (err) {
    // Classify error — never log/return the raw token or body (INV-05 / T-08-10)
    const status = (err as Record<string, unknown>)['_sentryStatus'] as number | undefined
    const body = (err as Record<string, unknown>)['_sentryBody']
    const category = classifyError(err, status, body)

    // Log status only — no token, no raw body (T-08-10)
    agentError(`sentry/recent requestId=${c.get('requestId')} status=${status ?? 'n/a'} category=${category}`)

    const prev = issuesCache.get(projectId)
    if (prev?.lastGood) {
      const stale: SentryRecentResponse = {
        ...prev.lastGood.value,
        stale: true,
        staleFrom: new Date(prev.lastGood.cachedAtMs).toISOString(),
        staleReason: category,
      }
      issuesCache.set(projectId, { ...prev, value: stale, cachedAtMs: now })
      return outbound(
        c,
        SentryRecentResponseSchema.parse.bind(SentryRecentResponseSchema),
        stale,
      )
    }

    return c.json(
      { ok: false, error: category, requestId: c.get('requestId') },
      503,
    )
  }
})

// ---------------------------------------------------------------------------
// Cache eviction (call on project unregister — wired in a follow-up plan)
// ---------------------------------------------------------------------------

/**
 * Evict both the issues cache and the slug cache for a project.
 * Mirrors evictIntegrationsCacheProject in integrations.ts.
 */
export function evictSentryCacheProject(id: string): void {
  issuesCache.delete(id)
  slugCache.delete(id)
}
