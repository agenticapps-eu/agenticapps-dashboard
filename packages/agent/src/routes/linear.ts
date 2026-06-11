/**
 * GET /api/projects/:id/linear/issues — LINEAR-01/02/03 + INV-05
 *
 * Returns up to 3 detected Linear issues for the project when LINEAR_API_KEY
 * is set. Returns 404 not_configured when unset.
 *
 * Issue detection (D-08-05 / LINEAR-02):
 *   1. Current branch name — runAllowedGit('branch', root) — bounded to current branch
 *   2. Recent commit messages — runAllowedGit('log', root) — bounded to -20 by ARGV_BY_CMD
 *   Both sources searched with /[A-Z]{2,}-\d+/g; results deduplicated; capped at 3 (D-08-07)
 *
 * API (Research Finding 3):
 *   - POST https://api.linear.app/graphql
 *   - Auth: RAW key, NO Bearer prefix → Authorization: ${LINEAR_API_KEY}
 *   - Human-readable identifier accepted directly in issue(id: "ACME-123")
 *   - data.issue null → issue not found (omitted, not an error)
 *   - HTTP 400 + errors[0].extensions.code === 'RATELIMITED' → rate-limited (Pitfall 1)
 *
 * Cache architecture:
 *   - Per-issue Map keyed `${projectId}:${issueId}` (Pitfall 7 — no cross-project leakage)
 *   - TTL 60 s + lastGood sub-entry for D-08-09 stale fallback
 *
 * Security (INV-05 / D-08-11 / T-08-19/20/21/22):
 *   - LINEAR_API_KEY never serialized into any JSON response
 *   - Errors collapsed to 3 categories via classifyError (never raw body)
 *   - Linear endpoint host hardcoded to api.linear.app (T-08-21 — no SSRF)
 *   - Cache keyed by ${projectId}:${issueId} (T-08-22 cross-project guard)
 *
 * Route MOUNTING into app.ts happens in Task 3 of this same Plan 08-05.
 */
import { Hono } from 'hono'
import {
  LinearIssuesResponseSchema,
  LinearIssueSchema,
  type LinearIssuesResponse,
  type LinearIssue,
} from '@agenticapps/dashboard-shared'

import { readRegistry } from '../lib/registry.js'
import { outbound } from '../server/middleware/errors.js'
import { fetchWithTimeout, classifyError, type CacheEntry } from '../lib/outboundFetch.js'
import { runAllowedGit } from '../lib/git.js'
import { agentError } from '../lib/logging.js'
import type { Env } from '../server/app.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TTL_MS = 60_000 // 60 s (D-08-06)
const MAX_ISSUES = 3  // D-08-07
const LINEAR_API = 'https://api.linear.app/graphql'

/** Matches typical Linear ticket format, e.g. ABC-123, ACME-456, donald/ABC-123-fix → ABC-123 */
const LINEAR_BRANCH_RE = /[A-Z]{2,}-\d+/g // /g required for matchAll across multi-line log

/** GraphQL query — accepts human-readable identifier directly (Research Finding 3, A3) */
const GET_ISSUE_QUERY = `
  query GetIssue($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      url
      state { name type }
      assignee { name }
    }
  }
`.trim()

// ---------------------------------------------------------------------------
// Module-level cache (keyed `${projectId}:${issueId}` — T-08-22 Pitfall 7)
// ---------------------------------------------------------------------------

const issueCache = new Map<string, CacheEntry<LinearIssue>>()

// ---------------------------------------------------------------------------
// detectIssueIds — branch + log detection (D-08-05, LINEAR-02)
// ---------------------------------------------------------------------------

/**
 * Extract Linear issue IDs from the current branch name AND recent commit
 * messages (last 20 commits — 20-commit cap already baked into ARGV_BY_CMD).
 *
 * Results are deduplicated (branch IDs first, then log IDs) and capped at 3.
 * Returns an empty array when no IDs are found.
 */
export async function detectIssueIds(root: string): Promise<string[]> {
  const seen = new Set<string>()
  const result: string[] = []

  // ── Tier 1: current branch name ─────────────────────────────────────────
  try {
    const branchResult = await runAllowedGit('branch', root)
    if (branchResult.exitCode === 0) {
      for (const match of branchResult.stdout.matchAll(LINEAR_BRANCH_RE)) {
        const id = match[0]
        if (!seen.has(id)) {
          seen.add(id)
          result.push(id)
        }
      }
    }
  } catch {
    // git failure → skip branch detection
  }

  // ── Tier 2: recent commit messages ──────────────────────────────────────
  try {
    const logResult = await runAllowedGit('log', root)
    if (logResult.exitCode === 0) {
      for (const match of logResult.stdout.matchAll(LINEAR_BRANCH_RE)) {
        const id = match[0]
        if (!seen.has(id)) {
          seen.add(id)
          result.push(id)
        }
      }
    }
  } catch {
    // git failure → skip log detection
  }

  // D-08-07: cap at 3 (branch IDs first)
  return result.slice(0, MAX_ISSUES)
}

// ---------------------------------------------------------------------------
// fetchLinearIssue — single issue GraphQL fetch
// ---------------------------------------------------------------------------

interface LinearIssueData {
  identifier: string
  title: string
  url: string
  state: { name: string; type: string }
  assignee: { name: string } | null
}

interface GraphQLResponse {
  data: { issue: LinearIssueData | null }
  errors?: Array<{ message: string; extensions?: { code: string } }>
}

/**
 * Fetch a single Linear issue by human-readable identifier (e.g. "ACME-123").
 *
 * Auth: RAW API key, no Bearer prefix (Research Finding 3).
 * Returns null when data.issue is null (issue not found in Linear).
 * Throws when the upstream call fails — caller handles classification.
 */
async function fetchLinearIssue(
  issueId: string,
  apiKey: string,
): Promise<LinearIssue | null> {
  const res = await fetchWithTimeout(LINEAR_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // RAW key — NO Bearer prefix (Research Finding 3)
      Authorization: apiKey,
    },
    body: JSON.stringify({
      query: GET_ISSUE_QUERY,
      variables: { id: issueId },
    }),
  })

  // Parse body before checking ok — needed for 400+RATELIMITED classification
  let responseBody: unknown
  try {
    responseBody = await res.json()
  } catch {
    responseBody = undefined
  }

  if (!res.ok) {
    // Create a structured error that carries status + body for classifyError
    const err = Object.assign(new Error(`Linear HTTP ${res.status}`), {
      _linearStatus: res.status,
      _linearBody: responseBody,
    })
    throw err
  }

  const gqlResponse = responseBody as GraphQLResponse

  // data.issue null → issue not found; return null (not an error for the whole panel)
  if (!gqlResponse.data?.issue) {
    return null
  }

  const raw = gqlResponse.data.issue
  return LinearIssueSchema.parse({
    identifier: raw.identifier,
    title: raw.title,
    url: raw.url,
    stateName: raw.state.name,
    stateType: raw.state.type,
    assigneeName: raw.assignee?.name ?? null,
    stale: false,
  })
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const linearRoute = new Hono<Env>()

linearRoute.get('/:id/linear/issues', async (c) => {
  // ── Env gate (LINEAR-03) ─────────────────────────────────────────────────
  const apiKey = process.env.LINEAR_API_KEY
  if (!apiKey) {
    return c.json(
      { ok: false, error: 'not_configured', requestId: c.get('requestId') },
      404,
    )
  }

  // ── Project lookup ────────────────────────────────────────────────────────
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
  const root = entry.root

  // ── Issue ID detection (branch + log) ────────────────────────────────────
  const issueIds = await detectIssueIds(root)

  if (issueIds.length === 0) {
    // No issue IDs detected — return empty response (not an error)
    const emptyResponse: LinearIssuesResponse = { issues: [], stale: false }
    return outbound(
      c,
      LinearIssuesResponseSchema.parse.bind(LinearIssuesResponseSchema),
      emptyResponse,
    )
  }

  // ── Per-issue fetch with cache (keyed projectId:issueId — Pitfall 7) ────
  const issues: LinearIssue[] = []
  let anyFailure = false
  let overallStaleReason: LinearIssuesResponse['staleReason'] = undefined

  for (const issueId of issueIds) {
    const cacheKey = `${projectId}:${issueId}`
    const cached = issueCache.get(cacheKey)

    // Cache hit within TTL → use cached value
    if (cached && now - cached.cachedAtMs < TTL_MS) {
      issues.push(cached.value)
      continue
    }

    // Cache miss → fetch from Linear API
    try {
      const fetched = await fetchLinearIssue(issueId, apiKey)

      if (fetched === null) {
        // Issue not found in Linear → skip (omit from response, not an error)
        continue
      }

      const newEntry: CacheEntry<LinearIssue> = {
        value: fetched,
        cachedAtMs: now,
        lastGood: { value: fetched, cachedAtMs: now },
      }
      issueCache.set(cacheKey, newEntry)
      issues.push(fetched)
    } catch (err) {
      // Classify error — never log/return the raw token or body (INV-05 / T-08-20)
      const status = (err as Record<string, unknown>)['_linearStatus'] as number | undefined
      const body = (err as Record<string, unknown>)['_linearBody']
      const category = classifyError(err, status, body)

      // Log status only — no API key, no raw body (T-08-20)
      agentError(
        `linear/issues requestId=${c.get('requestId')} issueId=${issueId} status=${status ?? 'n/a'} category=${category}`,
      )

      // Try last-good fallback for this issue (D-08-09)
      const prev = issueCache.get(cacheKey)
      if (prev?.lastGood) {
        const staleIssue: LinearIssue = {
          ...prev.lastGood.value,
          stale: true,
          staleFrom: new Date(prev.lastGood.cachedAtMs).toISOString(),
          staleReason: category,
        }
        issueCache.set(cacheKey, { ...prev, value: staleIssue, cachedAtMs: now })
        issues.push(staleIssue)
      } else {
        anyFailure = true
        overallStaleReason = category
      }
    }
  }

  // ── Assemble response ─────────────────────────────────────────────────────
  if (anyFailure && issues.length === 0) {
    // All fetches failed, no last-good for any issue
    return c.json(
      { ok: false, error: overallStaleReason ?? 'unreachable', requestId: c.get('requestId') },
      503,
    )
  }

  const allStale = issues.length > 0 && issues.every((i) => i.stale)
  // WR-02: when all issues fell back to last-good, overallStaleReason was never
  // assigned in the last-good branch (only the no-last-good branch set it).
  // Derive it from the first stale issue's staleReason so the top-level contract
  // is fulfilled and the SPA stale banner shows the correct reason.
  const resolvedStaleReason: LinearIssuesResponse['staleReason'] = allStale
    ? (overallStaleReason ?? issues.find((i) => i.staleReason)?.staleReason)
    : undefined
  const response: LinearIssuesResponse = {
    issues,
    stale: allStale,
    staleFrom: allStale && issues[0]?.staleFrom ? issues[0].staleFrom : undefined,
    staleReason: resolvedStaleReason,
  }

  return outbound(
    c,
    LinearIssuesResponseSchema.parse.bind(LinearIssuesResponseSchema),
    response,
  )
})

// ---------------------------------------------------------------------------
// Cache eviction (call on project unregister — wired in a follow-up plan)
// ---------------------------------------------------------------------------

/**
 * Evict all cache entries for a project (deletes all `${id}:*` keys).
 * Mirrors evictSentryCacheProject / evictIntegrationsCacheProject pattern.
 */
export function evictLinearCacheProject(id: string): void {
  for (const key of issueCache.keys()) {
    if (key.startsWith(`${id}:`)) {
      issueCache.delete(key)
    }
  }
}
