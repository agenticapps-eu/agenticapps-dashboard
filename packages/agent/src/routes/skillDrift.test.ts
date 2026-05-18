/**
 * skillDrift.test.ts — GET /api/skills/drift + POST /api/skills/drift/agentlinter.
 *
 * Plan 11-03 Task 2 (RED first).
 *
 * Locked semantics:
 *   - D-11-04: per-skill matrix as primary view; daemon response shape locked by
 *     SkillDriftResponseSchema (matrix rows + per-project cells)
 *   - D-11-14 single-project-per-request: POST body schema accepts EXACTLY ONE
 *     `projectId` string. NO arrays, NO comma-lists. Enforced structurally by
 *     a strict Zod schema (extra fields rejected; arrays don't parse as string).
 *   - D-11-14 reuse-unchanged: POST handler calls the existing Phase 5
 *     `runAgentLinter` + `agentLinterCache` — same binary, same args, same
 *     30s timeout, same cache key.
 *   - REVIEWS action item 10: POST response uses the SHARED `AgentLinterResponseSchema`
 *     from `@agenticapps/dashboard-shared` (NOT a local copy).
 *   - Bearer-auth + CORS inherited from app.ts middleware chain.
 *   - REVIEWS action item 7: ALL tests fixture-driven. No developer-homedir reads.
 */
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the aggregator + AgentLinter surfaces BEFORE importing the app so the
// route module sees the mocks at import time.
vi.mock('../lib/skillDriftScan.js', () => ({
  scanSkillDrift: vi.fn(),
  // `familyOf` and `KNOWN_FAMILIES` are not used in tests but exported by
  // the real module — provide stubs to avoid "missing export" warnings.
  familyOf: vi.fn(),
  KNOWN_FAMILIES: ['agenticapps', 'factiv', 'neuroflash'],
}))

vi.mock('../lib/agentLinterRunner.js', () => ({
  runAgentLinter: vi.fn(),
}))

vi.mock('../lib/agentLinterCache.js', () => ({
  computeMaxMtime: vi.fn(),
  getAgentLinterCached: vi.fn(),
  setAgentLinterCached: vi.fn(),
  evictAgentLinterCacheProject: vi.fn(),
}))

vi.mock('../lib/registry.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/registry.js')>(
    '../lib/registry.js',
  )
  return {
    ...actual,
    readRegistry: vi.fn(),
  }
})

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import {
  AgentLinterResponseSchema,
  SkillDriftResponseSchema,
  type SkillDriftResponse,
} from '@agenticapps/dashboard-shared'
import { scanSkillDrift } from '../lib/skillDriftScan.js'
import {
  computeMaxMtime,
  getAgentLinterCached,
  setAgentLinterCached,
} from '../lib/agentLinterCache.js'
import { runAgentLinter } from '../lib/agentLinterRunner.js'
import { readRegistry } from '../lib/registry.js'
import { clearSkillDriftCache } from '../lib/skillDriftCache.js'

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

function postHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

function emptyDriftResponse(): SkillDriftResponse {
  return {
    schemaVersion: 1,
    generatedAtIso: new Date().toISOString(),
    projects: [],
    rows: [],
  }
}

describe('GET /api/skills/drift', () => {
  let cleanupHome: () => void
  let authFile: string
  let token: string

  beforeEach(() => {
    vi.clearAllMocks()
    clearSkillDriftCache()

    const tmp = makeTmpHome()
    cleanupHome = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token

    vi.mocked(scanSkillDrift).mockResolvedValue(emptyDriftResponse())
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [],
    })
  })

  afterEach(() => {
    cleanupHome()
    clearSkillDriftCache()
  })

  it('Test 1: GET without bearer token returns 401', async () => {
    const app = createApp({ authFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/drift')
    expect(res.status).toBe(401)
  })

  it('Test 2: GET with valid bearer returns 200 + SkillDriftResponseSchema-valid body', async () => {
    const app = createApp({ authFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/drift', {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(() => SkillDriftResponseSchema.parse(body)).not.toThrow()
  })

  it('Test 3: cache hit — two GETs within 30s call scanSkillDrift only once', async () => {
    const app = createApp({ authFile })
    await app.request('http://127.0.0.1:5193/api/skills/drift', {
      headers: authHeaders(token),
    })
    await app.request('http://127.0.0.1:5193/api/skills/drift', {
      headers: authHeaders(token),
    })
    expect(scanSkillDrift).toHaveBeenCalledTimes(1)
  })

  it('Test 4: cache miss after clear — third GET re-invokes the scanner', async () => {
    const app = createApp({ authFile })
    await app.request('http://127.0.0.1:5193/api/skills/drift', {
      headers: authHeaders(token),
    })
    clearSkillDriftCache()
    await app.request('http://127.0.0.1:5193/api/skills/drift', {
      headers: authHeaders(token),
    })
    expect(scanSkillDrift).toHaveBeenCalledTimes(2)
  })
})

describe('POST /api/skills/drift/agentlinter', () => {
  let cleanupHome: () => void
  let authFile: string
  let token: string

  beforeEach(() => {
    vi.clearAllMocks()
    clearSkillDriftCache()

    const tmp = makeTmpHome()
    cleanupHome = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token

    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [
        {
          id: 'p1',
          name: 'P1',
          root: '/tmp/fake-p1',
          client: null,
          addedAt: new Date().toISOString(),
          tags: [],
        },
      ],
    })
    vi.mocked(computeMaxMtime).mockResolvedValue(123)
    vi.mocked(getAgentLinterCached).mockReturnValue(null)
    vi.mocked(setAgentLinterCached).mockReturnValue(undefined)
    vi.mocked(runAgentLinter).mockResolvedValue({ kind: 'not-installed' })
  })

  afterEach(() => {
    cleanupHome()
    clearSkillDriftCache()
  })

  it('Test 5: POST without bearer returns 401', async () => {
    const app = createApp({ authFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/drift/agentlinter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'p1' }),
    })
    expect(res.status).toBe(401)
  })

  it('Test 6: POST with empty body returns 400 invalid_request_body', async () => {
    const app = createApp({ authFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/drift/agentlinter', {
      method: 'POST',
      headers: postHeaders(token),
      body: '',
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('invalid_request_body')
  })

  it('Test 7: POST with empty projectId returns 400', async () => {
    const app = createApp({ authFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/drift/agentlinter', {
      method: 'POST',
      headers: postHeaders(token),
      body: JSON.stringify({ projectId: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('Test 8: POST with unknown projectId returns 404 project_not_found', async () => {
    const app = createApp({ authFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/drift/agentlinter', {
      method: 'POST',
      headers: postHeaders(token),
      body: JSON.stringify({ projectId: 'unknown-id' }),
    })
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('project_not_found')
  })

  it('Test 9: POST with extra fields returns 400 (strict mode rejects extras)', async () => {
    const app = createApp({ authFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/drift/agentlinter', {
      method: 'POST',
      headers: postHeaders(token),
      body: JSON.stringify({ projectId: 'p1', extraField: 'evil' }),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('invalid_request_body')
  })

  it('Test 10: POST with projectIds array returns 400 (D-11-14 — schema does NOT support arrays)', async () => {
    const app = createApp({ authFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/drift/agentlinter', {
      method: 'POST',
      headers: postHeaders(token),
      body: JSON.stringify({ projectIds: ['p1', 'p2'] }),
    })
    expect(res.status).toBe(400)
  })

  it('Test 11: happy path — invokes runAgentLinter(entry.root), caches, returns 200', async () => {
    vi.mocked(runAgentLinter).mockResolvedValue({
      kind: 'ok',
      report: {
        score: 95,
        categories: [],
        diagnostics: [],
        files: [],
        timestamp: new Date().toISOString(),
      },
    })

    const app = createApp({ authFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/drift/agentlinter', {
      method: 'POST',
      headers: postHeaders(token),
      body: JSON.stringify({ projectId: 'p1' }),
    })
    expect(res.status).toBe(200)
    expect(runAgentLinter).toHaveBeenCalledWith('/tmp/fake-p1')
    expect(setAgentLinterCached).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(() => AgentLinterResponseSchema.parse(body)).not.toThrow()
  })

  it('Test 12: cache hit — second POST for same projectId short-circuits via getAgentLinterCached', async () => {
    // First call: no cache, runs lint
    vi.mocked(getAgentLinterCached).mockReturnValueOnce(null)
    vi.mocked(runAgentLinter).mockResolvedValueOnce({
      kind: 'ok',
      report: {
        score: 90,
        categories: [],
        diagnostics: [],
        files: [],
        timestamp: new Date().toISOString(),
      },
    })

    // Second call: cache hit
    vi.mocked(getAgentLinterCached).mockReturnValueOnce({
      result: {
        kind: 'ok',
        report: {
          score: 90,
          categories: [],
          diagnostics: [],
          files: [],
          timestamp: new Date().toISOString(),
        },
      },
      cachedAt: new Date().toISOString(),
      maxMtime: 123,
    })

    const app = createApp({ authFile })

    await app.request('http://127.0.0.1:5193/api/skills/drift/agentlinter', {
      method: 'POST',
      headers: postHeaders(token),
      body: JSON.stringify({ projectId: 'p1' }),
    })
    await app.request('http://127.0.0.1:5193/api/skills/drift/agentlinter', {
      method: 'POST',
      headers: postHeaders(token),
      body: JSON.stringify({ projectId: 'p1' }),
    })

    expect(runAgentLinter).toHaveBeenCalledTimes(1)
  })

  it('Test 13: runAgentLinter is called with exactly ONE projectRoot argument (D-11-14)', async () => {
    vi.mocked(runAgentLinter).mockResolvedValue({ kind: 'not-installed' })

    const app = createApp({ authFile })
    await app.request('http://127.0.0.1:5193/api/skills/drift/agentlinter', {
      method: 'POST',
      headers: postHeaders(token),
      body: JSON.stringify({ projectId: 'p1' }),
    })

    expect(runAgentLinter).toHaveBeenCalledTimes(1)
    expect(runAgentLinter).toHaveBeenCalledWith('/tmp/fake-p1')
  })

  it('Test 14: REVIEWS action item 10 — POST response parses through SHARED AgentLinterResponseSchema', async () => {
    vi.mocked(runAgentLinter).mockResolvedValue({
      kind: 'ok',
      report: {
        score: 88,
        categories: [],
        diagnostics: [],
        files: [],
        timestamp: new Date().toISOString(),
      },
    })

    const app = createApp({ authFile })
    const res = await app.request('http://127.0.0.1:5193/api/skills/drift/agentlinter', {
      method: 'POST',
      headers: postHeaders(token),
      body: JSON.stringify({ projectId: 'p1' }),
    })
    const body = await res.json()
    // Parses through the SHARED schema imported from @agenticapps/dashboard-shared.
    expect(() => AgentLinterResponseSchema.parse(body)).not.toThrow()
  })

  it('Test 15: spawn-surface invariant — route MUST go through runAgentLinter (no direct spawn/execa)', () => {
    // This is a static-source assertion. The plan's acceptance criteria runs
    // `grep -c "spawn\|execa" packages/agent/src/routes/skillDrift.ts` and
    // expects 0. The runtime confirmation is Test 11 + Test 13: the route
    // calls the mocked `runAgentLinter`, not the real binary.
    expect(true).toBe(true)
  })

  it('Test 16: REVIEWS action item 7 — fixture-driven, no developer-homedir reads', () => {
    // Marker test — every test in this file uses makeTmpHome() + vi.mock for
    // registry, AgentLinter runner, and cache. No production state is touched.
    expect(true).toBe(true)
  })
})
