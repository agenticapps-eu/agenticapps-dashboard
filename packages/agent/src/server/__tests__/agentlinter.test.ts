/**
 * Tests for agentlinter route:
 *   GET /api/projects/:id/agentlinter          — cache-aware
 *   GET /api/projects/:id/agentlinter?bypassCache=1 — bypass + no setCache
 *
 * Test cases:
 *   A1: 200 + valid AgentLinterResponseSchema when no cache (kind: 'not-installed' stub)
 *   A2: Cache hit — second call within 1h does NOT call runAgentLinter again
 *   A3: ?bypassCache=1 — skips cache lookup AND does NOT call setAgentLinterCached
 *   A4: Returns 404 when projectId not in registry
 *   A5: Bearer auth required (401 without header)
 *   A6: CORS reject from non-allowed origin
 *   A7: AgentLinterResponseSchema valid for kind: 'ok' shape
 */

import { join } from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock runAgentLinter to avoid live subprocess
vi.mock('../../lib/agentLinterRunner.js', () => ({
  runAgentLinter: vi.fn(),
}))

// Mock computeMaxMtime to return a stable value
vi.mock('../../lib/agentLinterCache.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/agentLinterCache.js')>()
  return {
    ...actual,
    computeMaxMtime: vi.fn().mockResolvedValue(1234567890),
  }
})

import { runAgentLinter } from '../../lib/agentLinterRunner.js'
import { __resetCache as resetAlCache, setAgentLinterCached } from '../../lib/agentLinterCache.js'
import { createApp } from '../app.js'
import { setActiveToken, ensureAuthFile } from '../../lib/auth.js'
import { makeTmpHome } from '../../lib/__fixtures__/tmpHome.js'
import { makePhase4Fixture } from '../../lib/__fixtures__/phase4-fixture.js'

const mockedRunAgentLinter = runAgentLinter as ReturnType<typeof vi.fn>

const NOT_INSTALLED_RESULT = { kind: 'not-installed' as const }
const OK_RESULT = {
  kind: 'ok' as const,
  report: {
    score: 87,
    categories: [],
    diagnostics: [],
    files: [],
    timestamp: '2026-05-07T12:00:00Z',
  },
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('GET /api/projects/:id/agentlinter', () => {
  let cleanupHome: () => void
  let cleanupFixture: () => void
  let token: string
  let registryFile: string
  let projectRoot: string
  let projectId: string

  beforeEach(async () => {
    vi.clearAllMocks()
    resetAlCache()

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
    const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectRoot }),
    })
    const body = (await regRes.json()) as { id: string }
    projectId = body.id
  })

  afterEach(() => {
    vi.clearAllMocks()
    resetAlCache()
    cleanupHome()
    cleanupFixture()
  })

  it('A1: 200 + valid AgentLinterResponseSchema for kind: not-installed', async () => {
    mockedRunAgentLinter.mockResolvedValue(NOT_INSTALLED_RESULT)

    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/agentlinter`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { kind: string }
    expect(data.kind).toBe('not-installed')
  })

  it('A2: cache hit — second call within 1h does NOT call runAgentLinter again', async () => {
    mockedRunAgentLinter.mockResolvedValue(NOT_INSTALLED_RESULT)

    const app = createApp({ registryFile })

    // First call — populates cache
    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/agentlinter`,
      { headers: authHeaders(token) },
    )
    expect(mockedRunAgentLinter).toHaveBeenCalledTimes(1)

    // Second call within TTL — should use cache
    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/agentlinter`,
      { headers: authHeaders(token) },
    )
    expect(mockedRunAgentLinter).toHaveBeenCalledTimes(1) // NOT called again
  })

  it('A3: ?bypassCache=1 skips cache AND does NOT call setAgentLinterCached', async () => {
    mockedRunAgentLinter.mockResolvedValue(OK_RESULT)

    // Manually seed the cache so we can verify bypass truly skips it
    setAgentLinterCached(projectId, {
      result: NOT_INSTALLED_RESULT,
      cachedAt: new Date().toISOString(),
      maxMtime: 1234567890,
    })

    const app = createApp({ registryFile })

    // First call: bypassCache=1 — must skip seeded cache and call runner
    const res1 = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/agentlinter?bypassCache=1`,
      { headers: authHeaders(token) },
    )
    expect(res1.status).toBe(200)
    const data1 = (await res1.json()) as { kind: string }
    // Should get fresh ok result (not the cached not-installed)
    expect(data1.kind).toBe('ok')
    expect(mockedRunAgentLinter).toHaveBeenCalledTimes(1)

    // Second call: WITHOUT bypassCache — should use cached not-installed (bypass did NOT store ok)
    vi.clearAllMocks()
    mockedRunAgentLinter.mockResolvedValue(OK_RESULT)

    const res2 = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/agentlinter`,
      { headers: authHeaders(token) },
    )
    const data2 = (await res2.json()) as { kind: string }
    // Should return the seeded not-installed (bypass didn't overwrite it)
    expect(data2.kind).toBe('not-installed')
    expect(mockedRunAgentLinter).not.toHaveBeenCalled()
  })

  it('A4: returns 404 when projectId not in registry', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/projects/nonexistent-id/agentlinter',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(404)
  })

  it('A5: bearer auth required (401 without Authorization header)', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/agentlinter`,
    )
    expect(res.status).toBe(401)
  })

  it('A6: CORS reject from non-allowed origin on OPTIONS preflight', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/agentlinter`,
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil.example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization',
        },
      },
    )
    const allowOrigin = res.headers.get('Access-Control-Allow-Origin')
    expect(allowOrigin).not.toBe('https://evil.example.com')
  })

  it('A7: AgentLinterResponseSchema valid for kind: ok shape', async () => {
    mockedRunAgentLinter.mockResolvedValue(OK_RESULT)

    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/agentlinter`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      kind: string
      report?: { score: number }
      cachedAt?: string
    }
    expect(data.kind).toBe('ok')
    expect(data.report?.score).toBe(87)
    expect(typeof data.cachedAt).toBe('string')
  })
})
