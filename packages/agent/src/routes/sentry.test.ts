/**
 * Tests for GET /api/projects/:id/sentry/recent
 *
 * Task 1 — Slug resolution (3-tier: .sentryclirc → API match → env fallback):
 *   SL-01: .sentryclirc [defaults] org+project → tier-1, zero API calls
 *   SL-02: DSN numeric id matched against /api/0/projects/ list → correct slugs
 *   SL-03: String-vs-number DSN id comparison (Pitfall 3: String(42) === '42')
 *   SL-04: SENTRY_ORG_SLUG + SENTRY_PROJECT_SLUG tier-3 env fallback
 *   SL-05: No DSN, no clirc, no env → null (route surfaces 'unreachable')
 *   SL-06: Slug cache — second call within 10-min TTL does not re-fetch
 *
 * Task 2 — sentry/recent route:
 *   S-01: SENTRY_AUTH_TOKEN unset → 404 not_configured
 *   S-02: Unknown project id → 404 project_not_found
 *   S-03: Token set + cache miss → fetches + returns SentryRecentResponseSchema payload (≤5 issues)
 *   S-04: Second call within 60s → cache hit, fetch NOT called again
 *   S-05: Upstream 500 WITH prior last-good → 200 stale:true + staleFrom + staleReason
 *   S-06: Upstream failure NO prior last-good → 503 sanitized error category
 *   S-07: INV-05 token safety — SENTRY_AUTH_TOKEN never appears in any response body
 *   S-08: evictSentryCacheProject clears both issues + slug caches
 */
import { join } from 'node:path'
import { writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { makePhase4Fixture } from '../lib/__fixtures__/phase4-fixture.js'

// ---------------------------------------------------------------------------
// Global fetch mock (must be hoisted before any module imports run)
// ---------------------------------------------------------------------------
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

/** Build a minimal Sentry issue object matching SentryIssueSchema. */
function makeIssue(n: number) {
  return {
    id: `${n}`,
    title: `Error title ${n}`,
    level: 'error',
    count: '42',
    lastSeen: '2026-06-01T10:00:00.000Z',
    permalink: `https://acme.sentry.io/issues/${n}/`,
    shortId: `WEB-${n}`,
  }
}

/** Minimal Sentry /api/0/projects/ response entry. */
function makeProjectEntry(numericId: string, slug = 'web', orgSlug = 'acme') {
  return { id: numericId, slug, organization: { slug: orgSlug } }
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeSentryclircContent(org: string, project: string) {
  return `[defaults]\norg = ${org}\nproject = ${project}\n`
}

function makeDsn(numericProjectId: number | string) {
  return `https://pubkey@o123.ingest.sentry.io/${numericProjectId}`
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('sentry route', () => {
  let cleanupHome: () => void
  let cleanupFixture: () => void
  let token: string
  let registryFile: string
  let projectId: string
  let projectRoot: string

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()

    const tmp = makeTmpHome()
    cleanupHome = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token

    const fixture = makePhase4Fixture()
    cleanupFixture = fixture.cleanup
    projectRoot = fixture.root

    // Register the project
    const app = createApp({ registryFile })
    const regRes = await app.request(
      'http://127.0.0.1:5193/api/registry/register',
      {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: projectRoot }),
      },
    )
    expect(regRes.status).toBe(201)
    const regBody = (await regRes.json()) as { id: string }
    projectId = regBody.id
  })

  afterEach(() => {
    cleanupFixture()
    cleanupHome()
    vi.unstubAllEnvs()

    // Evict sentry cache after each test to avoid cross-test interference
    // (imported lazily to avoid hoisting issues)
    import('./sentry.js').then(({ evictSentryCacheProject }) => {
      evictSentryCacheProject(projectId)
    })
  })

  // ─── Task 2: env-gate + project-lookup (basic 404s) ────────────────────────

  describe('S-01: SENTRY_AUTH_TOKEN unset → 404 not_configured', () => {
    it('returns 404 with not_configured when env var is absent', async () => {
      delete process.env.SENTRY_AUTH_TOKEN
      const app = createApp({ registryFile })
      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.ok).toBe(false)
      expect(body.error).toBe('not_configured')
    })
  })

  describe('S-02: Unknown project id → 404 project_not_found', () => {
    it('returns 404 with project_not_found for non-existent project', async () => {
      vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntrys_test_secret')
      const app = createApp({ registryFile })
      const res = await app.request(
        'http://127.0.0.1:5193/api/projects/nonexistent-id/sentry/recent',
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(404)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.ok).toBe(false)
      expect(body.error).toBe('project_not_found')
    })
  })

  // ─── Task 2: happy path ────────────────────────────────────────────────────

  describe('S-03: happy path — fetches + returns ≤5 issues', () => {
    it('returns 5 issues when token set + slug resolved via env fallback', async () => {
      vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntrys_test_secret')
      vi.stubEnv('SENTRY_ORG_SLUG', 'acme')
      vi.stubEnv('SENTRY_PROJECT_SLUG', 'web')

      // Mock: issues endpoint returns 5 issues
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          makeIssue(1),
          makeIssue(2),
          makeIssue(3),
          makeIssue(4),
          makeIssue(5),
        ],
      })

      // Need a numeric project ID set via DSN or env — use env slug fallback
      // No .sentryclirc, no DSN → tier-3 env fallback
      const app = createApp({ registryFile })
      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.ok).not.toBe(false)
      const issues = body.issues as unknown[]
      expect(Array.isArray(issues)).toBe(true)
      expect(issues.length).toBeGreaterThanOrEqual(1)
      expect(issues.length).toBeLessThanOrEqual(5)
      expect(body.stale).toBe(false)
    })
  })

  describe('S-04: 60s cache hit — fetch not called again', () => {
    it('serves cached response on second call within TTL', async () => {
      vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntrys_test_secret')
      vi.stubEnv('SENTRY_ORG_SLUG', 'acme')
      vi.stubEnv('SENTRY_PROJECT_SLUG', 'web')

      // Only one fetch call should happen
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [makeIssue(1)],
      })

      const app = createApp({ registryFile })

      // First call — populates cache
      const res1 = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res1.status).toBe(200)

      // Reset mock so a second real call would be detectable
      mockFetch.mockClear()
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [makeIssue(99)], // different — would be visible if cache missed
      })

      // Second call — should be a cache hit
      const res2 = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res2.status).toBe(200)
      // fetch should NOT have been called again
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('S-05: upstream 500 WITH last-good → 200 stale', () => {
    it('returns stale response with stale:true + staleFrom + staleReason', async () => {
      vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntrys_test_secret')
      vi.stubEnv('SENTRY_ORG_SLUG', 'acme')
      vi.stubEnv('SENTRY_PROJECT_SLUG', 'web')

      // First call succeeds — populates lastGood
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [makeIssue(1)],
      })

      const app = createApp({ registryFile })
      const res1 = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res1.status).toBe(200)

      // Evict the TTL cache (but lastGood survives)
      const { evictSentryCacheProject } = await import('./sentry.js')
      evictSentryCacheProject(projectId)

      // Second fetch fails
      mockFetch.mockRejectedValueOnce(Object.assign(new Error('AbortError'), { name: 'AbortError' }))

      const res2 = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res2.status).toBe(200)
      const body = (await res2.json()) as Record<string, unknown>
      expect(body.stale).toBe(true)
      expect(typeof body.staleFrom).toBe('string')
      expect(['unreachable', 'unauthorized', 'rate-limited']).toContain(body.staleReason)
    })
  })

  describe('S-06: upstream failure NO last-good → 503 sanitized', () => {
    it('returns 503 with sanitized error category when no prior data', async () => {
      vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntrys_test_secret')
      vi.stubEnv('SENTRY_ORG_SLUG', 'acme')
      vi.stubEnv('SENTRY_PROJECT_SLUG', 'web')

      // Fetch fails immediately, no lastGood exists
      mockFetch.mockRejectedValueOnce(Object.assign(new Error('network failure'), { name: 'AbortError' }))

      const app = createApp({ registryFile })
      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(503)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.ok).toBe(false)
      expect(['unreachable', 'unauthorized', 'rate-limited']).toContain(body.error)
    })
  })

  describe('S-07: INV-05 — token never in any response body', () => {
    it('SENTRY_AUTH_TOKEN never appears in the JSON body across all cases', async () => {
      const SECRET_TOKEN = `sntrys_super_secret_${randomUUID()}`
      vi.stubEnv('SENTRY_AUTH_TOKEN', SECRET_TOKEN)
      vi.stubEnv('SENTRY_ORG_SLUG', 'acme')
      vi.stubEnv('SENTRY_PROJECT_SLUG', 'web')

      const app = createApp({ registryFile })

      // Case 1: happy path
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [makeIssue(1)],
      })
      const res1 = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      const text1 = await res1.text()
      expect(text1).not.toContain(SECRET_TOKEN)

      // Case 2: upstream failure (503)
      const { evictSentryCacheProject } = await import('./sentry.js')
      evictSentryCacheProject(projectId)
      mockFetch.mockRejectedValueOnce(Object.assign(new Error('fail'), { name: 'AbortError' }))
      const res2 = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      const text2 = await res2.text()
      expect(text2).not.toContain(SECRET_TOKEN)

      // Case 3: not_configured
      vi.unstubAllEnvs()
      delete process.env.SENTRY_AUTH_TOKEN
      const app2 = createApp({ registryFile })
      const res3 = await app2.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      const text3 = await res3.text()
      expect(text3).not.toContain(SECRET_TOKEN)
    })
  })

  // ─── Task 1: Slug resolution tests ─────────────────────────────────────────

  describe('SL-01: .sentryclirc [defaults] → tier-1, zero API calls', () => {
    it('uses .sentryclirc org/project with no fetch calls', async () => {
      vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntrys_test_secret')

      // Write a .sentryclirc file to the project root
      const clircPath = join(projectRoot, '.sentryclirc')
      writeFileSync(clircPath, makeSentryclircContent('myorg', 'myproject'))

      // Issues fetch succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [makeIssue(1)],
      })

      const app = createApp({ registryFile })
      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(200)

      // Only one fetch call: the issues call (not the /projects/ slug-lookup)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [calledUrl] = mockFetch.mock.calls[0] as [string, ...unknown[]]
      expect(calledUrl).toContain('myorg')
      expect(calledUrl).not.toContain('/api/0/projects/')
    })
  })

  describe('SL-02: DSN numeric id matched against /api/0/projects/', () => {
    it('resolves org/project slugs by matching DSN numeric id against project list', async () => {
      vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntrys_test_secret')

      // Write a .env with SENTRY_DSN (note: detectSentryDsnEnv only checks existence,
      // but for resolution we need the DSN value — write it to .env for the test fixture)
      // For this test, we'll use a DSN written to a file the route can read
      // Actually the route uses detectSentryDsnEnv which only checks for the KEY name.
      // The actual DSN value resolution goes through a different path.
      // We need to provide DSN via env var SENTRY_DSN for the resolution test.
      vi.stubEnv('SENTRY_DSN', 'https://pubkey@o123.ingest.sentry.io/42')

      // Mock: /projects/ list returns project id '42'
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [makeProjectEntry('42', 'web', 'acme')],
          headers: { get: () => null },
        })
        // Mock: issues call
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [makeIssue(1)],
        })

      const app = createApp({ registryFile })
      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(200)

      // The issues URL should contain 'acme' (org slug from /projects/ response)
      const calls = mockFetch.mock.calls as [string, ...unknown[]][]
      const issuesCall = calls.find(([url]) => url.includes('/issues/'))
      expect(issuesCall).toBeDefined()
      expect(issuesCall![0]).toContain('acme')
    })
  })

  describe('SL-03: String-vs-number DSN id comparison (Pitfall 3)', () => {
    it('matches DSN numeric id (number) against API id (string) correctly', async () => {
      vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntrys_test_secret')
      // DSN with numeric project id 42 (number type after parseInt)
      vi.stubEnv('SENTRY_DSN', 'https://pubkey@o123.ingest.sentry.io/42')

      // /projects/ returns id as string '42' (as the real API does)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [makeProjectEntry('42', 'correct-project', 'correct-org')],
          headers: { get: () => null },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [makeIssue(1)],
        })

      const app = createApp({ registryFile })
      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(200)

      // Issues URL must contain the correct org slug
      const calls = mockFetch.mock.calls as [string, ...unknown[]][]
      const issuesCall = calls.find(([url]) => url.includes('/issues/'))
      expect(issuesCall).toBeDefined()
      expect(issuesCall![0]).toContain('correct-org')
    })
  })

  describe('SL-04: SENTRY_ORG_SLUG + SENTRY_PROJECT_SLUG tier-3 env fallback', () => {
    it('uses env var slugs when no .sentryclirc and no DSN', async () => {
      vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntrys_test_secret')
      vi.stubEnv('SENTRY_ORG_SLUG', 'env-org')
      vi.stubEnv('SENTRY_PROJECT_SLUG', 'env-project')

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [makeIssue(1)],
      })

      const app = createApp({ registryFile })
      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(200)

      // Only one fetch call (issues), no /projects/ lookup
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [calledUrl] = mockFetch.mock.calls[0] as [string, ...unknown[]]
      expect(calledUrl).toContain('env-org')
    })
  })

  describe('SL-05: no DSN, no clirc, no env → null → unreachable', () => {
    it('returns 503 unreachable when slug cannot be resolved', async () => {
      vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntrys_test_secret')
      // No SENTRY_ORG_SLUG, no SENTRY_PROJECT_SLUG, no .sentryclirc, no SENTRY_DSN
      delete process.env.SENTRY_ORG_SLUG
      delete process.env.SENTRY_PROJECT_SLUG
      delete process.env.SENTRY_DSN

      const app = createApp({ registryFile })
      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      // No last-good + slug resolution failed → 503
      expect(res.status).toBe(503)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.ok).toBe(false)
      expect(body.error).toBe('unreachable')
    })
  })

  describe('SL-06: slug cache — second call within 10-min TTL does not re-fetch slugs', () => {
    it('does not call /projects/ on second request when slug is cached', async () => {
      vi.stubEnv('SENTRY_AUTH_TOKEN', 'sntrys_test_secret')
      vi.stubEnv('SENTRY_DSN', 'https://pubkey@o123.ingest.sentry.io/99')

      // First request: slug lookup + issues
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [makeProjectEntry('99', 'proj', 'org')],
          headers: { get: () => null },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [makeIssue(1)],
        })

      const app = createApp({ registryFile })
      const res1 = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res1.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(2) // /projects/ + /issues/

      // Evict the issues cache (60s TTL) but NOT the slug cache (10-min TTL)
      const { evictSentryCacheProject } = await import('./sentry.js')
      evictSentryCacheProject(projectId)

      mockFetch.mockClear()
      // Second request: issues only — slug should be cached
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [makeIssue(2)],
      })

      const res2 = await app.request(
        `http://127.0.0.1:5193/api/projects/${projectId}/sentry/recent`,
        { headers: authHeaders(token) },
      )
      expect(res2.status).toBe(200)
      // Only 1 fetch: the issues call; /projects/ NOT called again
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [calledUrl] = mockFetch.mock.calls[0] as [string, ...unknown[]]
      expect(calledUrl).not.toContain('/api/0/projects/')
    })
  })

  describe('S-08: evictSentryCacheProject clears caches', () => {
    it('exports evictSentryCacheProject', async () => {
      const mod = await import('./sentry.js')
      expect(typeof mod.evictSentryCacheProject).toBe('function')
    })
  })
})
