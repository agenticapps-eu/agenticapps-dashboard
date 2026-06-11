/**
 * Tests for GET /api/projects/:id/linear/issues
 *
 * Task 1 — detectIssueIds (branch + log, deduped, capped 3):
 *   D-01: Branch only — single ID from branch name
 *   D-02: Log only — multiple IDs from commit messages
 *   D-03: Both branch + log — branch IDs appear before log IDs
 *   D-04: Dedup — same ID in branch AND log → appears only once
 *   D-05: Cap at 3 — >3 distinct IDs → first 3 preserved (branch before log)
 *   D-06: No matches → empty array
 *
 * Task 2 — linear/issues route:
 *   L-01: LINEAR_API_KEY unset → 404 not_configured
 *   L-02: Unknown project id → 404 project_not_found
 *   L-03: Key set + issues detected → fetches each, returns LinearIssuesResponseSchema
 *   L-04: Authorization header is raw key (NOT 'Bearer ' prefixed)
 *   L-05: 60s cache hit — same project + issueId → fetch NOT called again
 *   L-06: Cache key isolation — evictLinearCacheProject(projectId) only evicts that project
 *   L-07: Linear HTTP-400 + RATELIMITED → staleReason 'rate-limited'
 *   L-08: data.issue null (not found in Linear) → issue omitted from response
 *   L-09: Upstream failure NO prior last-good → 503 sanitized category
 *   L-10: INV-05 key safety — LINEAR_API_KEY never appears in any response body
 *   L-11: No detected issue IDs → 200 with empty issues array
 *   L-12: evictLinearCacheProject is exported and callable
 */
import { join } from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { makePhase4Fixture } from '../lib/__fixtures__/phase4-fixture.js'

// linearRoute is not yet mounted in createApp (mounting happens in Task 3 of this plan);
// tests mount it via a temporary wrapper so we test the route in isolation.
import { linearRoute, evictLinearCacheProject } from './linear.js'

/**
 * Create a test app that includes the linearRoute mounted at /api/projects.
 * Mirrors the structure that will be live after Task 3 mounts it.
 */
function createAppWithLinear(registryFile: string) {
  const app = createApp({ registryFile })
  app.route('/api/projects', linearRoute)
  return app
}

// ---------------------------------------------------------------------------
// Global fetch + git mocks
// ---------------------------------------------------------------------------
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

vi.mock('../lib/git.js', () => ({
  runAllowedGit: vi.fn(),
  GitNotAllowedError: class extends Error {},
}))
import { runAllowedGit } from '../lib/git.js'
const mockRunAllowedGit = vi.mocked(runAllowedGit)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

/** Build a LinearIssue GraphQL response data.issue object */
function makeLinearIssueData(id: string) {
  return {
    id: randomUUID(),
    identifier: id,
    title: `Fix bug ${id}`,
    url: `https://linear.app/team/issue/${id}`,
    state: { name: 'In Progress', type: 'started' },
    assignee: { name: 'Alice' },
  }
}

/** Wrap issue data in a GraphQL response envelope */
function makeGraphQLResponse(issueData: ReturnType<typeof makeLinearIssueData> | null) {
  return { data: { issue: issueData } }
}

/** Minimal git log output with issue IDs embedded */
function makeLogOutput(...ids: string[]) {
  return ids.map((id, i) => `abc${i}def ${id} fix some thing`).join('\n')
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

let cleanupHome: () => void
let cleanupFixture: () => void
let registryFile: string
let projectId: string
let projectRoot: string
let token: string

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

  // Register the project via the app so we get a real registry entry + project ID
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

  // Default git mocks: no matches
  mockRunAllowedGit.mockResolvedValue({
    stdout: '',
    stderr: '',
    exitCode: 0,
  })

  // Default fetch mock: success
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => makeGraphQLResponse(makeLinearIssueData('ACME-123')),
    headers: { get: () => null },
  })
})

afterEach(() => {
  cleanupFixture()
  cleanupHome()
  vi.unstubAllEnvs()
  evictLinearCacheProject(projectId)
  delete process.env.LINEAR_API_KEY
})

// ---------------------------------------------------------------------------
// Task 1: detectIssueIds (branch + log, deduped, capped 3)
// ---------------------------------------------------------------------------

describe('detectIssueIds — issue ID detection from branch + log', () => {
  it('D-01: extracts single ID from branch name', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'donald/ACME-123-fix-bug', stderr: '', exitCode: 0 }) // branch
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 }) // log

    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => makeGraphQLResponse(makeLinearIssueData('ACME-123')),
      headers: { get: () => null },
    })

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledOnce()
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const requestBody = JSON.parse(init.body as string) as Record<string, unknown>
    expect((requestBody.variables as Record<string, unknown>).id).toBe('ACME-123')
  })

  it('D-02: extracts IDs from commit messages in log', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'main', stderr: '', exitCode: 0 }) // branch — no match
      .mockResolvedValueOnce({
        stdout: makeLogOutput('PROJ-100', 'PROJ-200'),
        stderr: '',
        exitCode: 0,
      }) // log

    mockFetch
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => makeGraphQLResponse(makeLinearIssueData('PROJ-100')),
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => makeGraphQLResponse(makeLinearIssueData('PROJ-200')),
        headers: { get: () => null },
      })

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const body = await res.json() as Record<string, unknown>
    const issues = body.issues as Array<Record<string, unknown>>
    expect(issues.length).toBe(2)
  })

  it('D-03: branch IDs come before log IDs in result', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'feature/ALPHA-10-my-feature', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: makeLogOutput('BETA-20', 'GAMMA-30'),
        stderr: '',
        exitCode: 0,
      })

    const ids = ['ALPHA-10', 'BETA-20', 'GAMMA-30']
    ids.forEach((id) => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => makeGraphQLResponse(makeLinearIssueData(id)),
        headers: { get: () => null },
      })
    })

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    const issues = body.issues as Array<Record<string, unknown>>
    // First issue should be the branch ID (ALPHA-10)
    expect(issues[0]?.identifier).toBe('ALPHA-10')
  })

  it('D-04: duplicate ID in branch AND log is deduplicated', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'donald/ACME-123-fix', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: makeLogOutput('ACME-123', 'EXTRA-999'),
        stderr: '',
        exitCode: 0,
      })

    mockFetch
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => makeGraphQLResponse(makeLinearIssueData('ACME-123')),
        headers: { get: () => null },
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => makeGraphQLResponse(makeLinearIssueData('EXTRA-999')),
        headers: { get: () => null },
      })

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res.status).toBe(200)
    // Only 2 fetches — ACME-123 deduped even though it's in both branch + log
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('D-05: caps at 3 IDs (branch before log)', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    // Branch has 2 IDs, log has 3 more → total 5, cap at 3
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'feature/ABC-1-and-ABC-2-combo', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: makeLogOutput('XYZ-10', 'XYZ-20', 'XYZ-30'),
        stderr: '',
        exitCode: 0,
      })

    // Only 3 fetches expected (cap at 3: ABC-1, ABC-2, XYZ-10)
    const ids = ['ABC-1', 'ABC-2', 'XYZ-10']
    ids.forEach((id) => {
      mockFetch.mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => makeGraphQLResponse(makeLinearIssueData(id)),
        headers: { get: () => null },
      })
    })

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledTimes(3) // capped at 3
    const body = await res.json() as Record<string, unknown>
    const issues = body.issues as Array<Record<string, unknown>>
    expect(issues.length).toBeLessThanOrEqual(3)
  })

  it('D-06: no issue IDs → empty issues array, no fetch calls', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'main', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'abc123 fix typo', stderr: '', exitCode: 0 })

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.issues).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Task 2: linear/issues route behaviors
// ---------------------------------------------------------------------------

describe('linear/issues route', () => {
  it('L-01: LINEAR_API_KEY unset → 404 not_configured', async () => {
    delete process.env.LINEAR_API_KEY

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res.status).toBe(404)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('not_configured')
    expect(body.ok).toBe(false)
  })

  it('L-02: unknown project id → 404 project_not_found', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/nonexistent-id-${randomUUID()}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res.status).toBe(404)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('project_not_found')
  })

  it('L-03: key set + issues detected → returns LinearIssuesResponseSchema payload', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'feature/ACME-123-fix', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })

    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => makeGraphQLResponse(makeLinearIssueData('ACME-123')),
      headers: { get: () => null },
    })

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    // outbound() returns the validated schema directly — no ok: true wrapper
    const issues = body.issues as Array<Record<string, unknown>>
    expect(issues).toHaveLength(1)
    const issue = issues[0] as Record<string, unknown>
    expect(issue.identifier).toBe('ACME-123')
    expect(issue.title).toBe('Fix bug ACME-123')
    expect(issue.stateName).toBe('In Progress')
    expect(issue.stateType).toBe('started')
    expect(issue.assigneeName).toBe('Alice')
    expect(typeof issue.url).toBe('string')
  })

  it('L-04: Authorization header is raw key — NOT "Bearer " prefixed', async () => {
    const apiKey = 'lin_api_secret_test_key_12345'
    process.env.LINEAR_API_KEY = apiKey

    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'feature/ACME-123', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })

    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => makeGraphQLResponse(makeLinearIssueData('ACME-123')),
      headers: { get: () => null },
    })

    const app = createAppWithLinear(registryFile)
    await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(mockFetch).toHaveBeenCalledOnce()
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const authHeader = (init.headers as Record<string, string>).Authorization
    expect(authHeader).toBe(apiKey) // raw key, no Bearer prefix
    expect(authHeader).not.toMatch(/^Bearer /)
  })

  it('L-05: 60s cache hit — same project + issueId → fetch NOT called again', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit.mockResolvedValue({ stdout: 'feature/ACME-123-fix', stderr: '', exitCode: 0 })
    mockFetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => makeGraphQLResponse(makeLinearIssueData('ACME-123')),
      headers: { get: () => null },
    })

    const app = createAppWithLinear(registryFile)

    // First request — populates cache
    await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    // Second request immediately — should hit cache for the issue
    const res2 = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res2.status).toBe(200)
    // Only one fetch call despite two requests (cache hit on second)
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('L-06: evictLinearCacheProject(idA) does not affect idB cache entries', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit.mockResolvedValue({ stdout: 'feature/ACME-123', stderr: '', exitCode: 0 })
    mockFetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => makeGraphQLResponse(makeLinearIssueData('ACME-123')),
      headers: { get: () => null },
    })

    const app = createAppWithLinear(registryFile)

    // Fetch for projectId → populates `${projectId}:ACME-123`
    await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )
    expect(mockFetch).toHaveBeenCalledOnce()

    // Evict a completely different project ID → projectId's cache is untouched
    evictLinearCacheProject(`other-project-${randomUUID()}`)

    // Second request for projectId → should still cache-hit (only 1 fetch total)
    const res2 = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )
    expect(res2.status).toBe(200)
    expect(mockFetch).toHaveBeenCalledOnce() // cache still warm for projectId
  })

  it('L-07: Linear HTTP-400 + RATELIMITED → 503 with rate-limited category', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'feature/ACME-123', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })

    const rateLimitedBody = {
      errors: [{ extensions: { code: 'RATELIMITED' }, message: 'Rate limit exceeded' }],
    }
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => rateLimitedBody,
      headers: { get: () => null },
    })

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    // No last-good → 503 with rate-limited category
    expect(res.status).toBe(503)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('rate-limited')
  })

  it('L-08: data.issue null → issue omitted from response (not an error)', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'feature/ACME-123', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })

    // Linear returns null for issue not found
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => makeGraphQLResponse(null),
      headers: { get: () => null },
    })

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    // Issue not found → omitted from issues array
    expect(body.issues).toEqual([])
  })

  it('L-09: upstream failure NO prior last-good → 503 sanitized category', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'feature/ACME-123', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })

    mockFetch.mockRejectedValueOnce(new TypeError('Network failure'))

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res.status).toBe(503)
    const body = await res.json() as Record<string, unknown>
    // Sanitized to fixed category — not raw error message
    expect(['unreachable', 'unauthorized', 'rate-limited']).toContain(body.error)
    expect(body.ok).toBe(false)
  })

  it('L-10: INV-05 — LINEAR_API_KEY never appears in any response body', async () => {
    const SECRET_KEY = `lin_api_very_secret_key_${randomUUID()}`

    // Test 1: not_configured (key unset)
    delete process.env.LINEAR_API_KEY
    const app = createAppWithLinear(registryFile)
    const resNotConfigured = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )
    const notConfiguredText = await resNotConfigured.text()
    expect(notConfiguredText).not.toContain(SECRET_KEY)

    // Test 2: key set, upstream failure
    process.env.LINEAR_API_KEY = SECRET_KEY
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'feature/ACME-123', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))

    const resError = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )
    const errorText = await resError.text()
    expect(errorText).not.toContain(SECRET_KEY)

    // Test 3: happy path
    evictLinearCacheProject(projectId)
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'feature/ACME-123', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => makeGraphQLResponse(makeLinearIssueData('ACME-123')),
      headers: { get: () => null },
    })

    const resHappy = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )
    const happyText = await resHappy.text()
    expect(happyText).not.toContain(SECRET_KEY)
  })

  it('L-11: no detected IDs → 200 with empty issues array', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'main', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'abc123 fix typo\nabc456 update docs', stderr: '', exitCode: 0 })

    const app = createAppWithLinear(registryFile)
    const res = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.issues).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('L-12: evictLinearCacheProject is exported and callable without throwing', () => {
    expect(() => evictLinearCacheProject(projectId)).not.toThrow()
    expect(() => evictLinearCacheProject('nonexistent-project')).not.toThrow()
  })

  // WR-02: top-level staleReason must be populated when all issues fall back to last-good
  it('WR-02: top-level staleReason is set when all issues use last-good fallback', async () => {
    process.env.LINEAR_API_KEY = 'lin_api_test_key'
    mockRunAllowedGit
      .mockResolvedValueOnce({ stdout: 'feature/ACME-123-fix', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'feature/ACME-123-fix', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: '', exitCode: 0 })

    const app = createAppWithLinear(registryFile)

    // First request: success → populates lastGood for ACME-123
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => makeGraphQLResponse(makeLinearIssueData('ACME-123')),
      headers: { get: () => null },
    })
    const res1 = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )
    expect(res1.status).toBe(200)

    // Advance time past the 60s TTL to force a cache miss on the second request
    // WITHOUT evicting the cache entry. evictLinearCacheProject would delete lastGood
    // too, making the stale fallback impossible. Time advancement keeps lastGood intact
    // while making the value stale.
    const originalNow = Date.now
    vi.spyOn(Date, 'now').mockReturnValue(originalNow() + 2 * 60 * 1000)

    // Second request: TTL expired → cache miss → fetch fails → falls back to lastGood
    mockFetch.mockRejectedValueOnce(new TypeError('Network failure'))

    const res2 = await app.request(
      `/api/projects/${projectId}/linear/issues`,
      { headers: authHeaders(token) },
    )

    vi.restoreAllMocks()

    expect(res2.status).toBe(200)
    const body = await res2.json() as Record<string, unknown>

    // All issues are stale — top-level staleReason must be set (WR-02)
    expect(body.stale).toBe(true)
    expect(body.staleReason).toBeDefined()
    expect(['unreachable', 'unauthorized', 'rate-limited']).toContain(body.staleReason)

    // staleFrom must also be set
    expect(typeof body.staleFrom).toBe('string')

    // The issue itself should be in the array (stale copy from lastGood)
    const issues = body.issues as Array<Record<string, unknown>>
    expect(issues.length).toBe(1)
    expect(issues[0]?.stale).toBe(true)
  })
})
