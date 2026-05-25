/**
 * Tests for GET /api/coverage + POST /api/coverage/refresh.
 *
 * Security contracts:
 * - CODEX HIGH-1: absPath NEVER appears in GET /api/coverage response body
 * - CODEX HIGH-5: POST with action='wiki-compile' must return 400 (D-10-09 — clipboard-only)
 * - CODEX HIGH-5: updatedRow REQUIRED on kind='ok' response
 * - CODEX HIGH-3: TOCTOU mitigation — realpathSync re-canonicalisation before spawn
 * - CODEX MED-14: per-repo refresh lock — concurrent POSTs serialize
 * - AGREED-3: POST refresh uses discoverRepos() + realpath canonicalisation (NOT a full scanCoverage() re-run)
 */

import { join } from 'node:path'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock coverageSpawn BEFORE importing app (so app module sees the mock)
vi.mock('../lib/coverageSpawn.js', () => ({
  spawnGitNexusAnalyze: vi.fn().mockResolvedValue({ kind: 'ok', stdout: 'mocked ok' }),
  buildWikiCompileClipboardString: vi.fn(),
  buildWorkflowUpdateClipboardString: vi.fn(),
  buildClaudeMdHelpUrl: vi.fn(),
  buildGitnexusInstallClipboardString: vi.fn(),
}))

// Mock coverageScan BEFORE importing app — deterministic output
vi.mock('../lib/coverageScan.js', () => ({
  scanCoverage: vi.fn().mockResolvedValue({
    schemaVersion: 1,
    generatedAtIso: new Date().toISOString(),
    gitNexusInstallState: 'not-installed',
    workflowHeadVersion: null,
    rows: [],
  }),
  scanCoverageInternal: vi.fn().mockResolvedValue({
    response: {
      schemaVersion: 1,
      generatedAtIso: new Date().toISOString(),
      gitNexusInstallState: 'not-installed',
      workflowHeadVersion: null,
      rows: [
        {
          family: 'agenticapps',
          repo: 'dashboard',
          claudeMd: { kind: 'basic', state: 'fresh' },
          gitNexus: { kind: 'basic', state: 'fresh' },
          wiki: { kind: 'basic', state: 'fresh' },
          workflowVersion: {
            kind: 'workflow',
            state: 'fresh',
            installedVersion: '1.0.0',
            headVersion: '1.0.0',
          },
          overrideCount: 0,
          overrides: [],
          inRegistry: true, // D-13-EXT-07
        },
      ],
    },
    internalRows: [
      {
        family: 'agenticapps',
        repo: 'dashboard',
        // Module-level default — beforeEach overrides this with a real tmpdir path
        absPath: '<placeholder — overridden in beforeEach>',
        claudeMd: { kind: 'basic', state: 'fresh' },
        gitNexus: { kind: 'basic', state: 'fresh' },
        wiki: { kind: 'basic', state: 'fresh' },
        workflowVersion: {
          kind: 'workflow',
          state: 'fresh',
          installedVersion: '1.0.0',
          headVersion: '1.0.0',
        },
        overrideCount: 0,
        overrides: [],
        inRegistry: true, // D-13-EXT-07
      },
    ],
  }),
}))

// Mock repoDiscovery BEFORE importing app — initial value is overwritten in each
// beforeEach with a tmpdir-resident repo so realpathSync + family-root checks pass
// without touching the developer's actual ~/Sourcecode tree.
vi.mock('../lib/repoDiscovery.js', () => ({
  discoverRepos: vi.fn().mockReturnValue([]),
  FAMILIES: ['agenticapps', 'factiv', 'neuroflash'],
}))

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import {
  CoverageResponseSchema,
  CoverageRefreshResponseSchema,
} from '@agenticapps/dashboard-shared'
import { _resetCoverageCacheForTests } from '../lib/coverageCache.js'
import { _resetRefreshLocksForTests } from './coverage.js'
import * as coverageSpawnMod from '../lib/coverageSpawn.js'
import * as coverageScanMod from '../lib/coverageScan.js'
import * as repoDiscoveryMod from '../lib/repoDiscovery.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

// ── Shared setup/teardown helpers ────────────────────────────────────────────

function makeTestSetup() {
  let cleanupHome: () => void
  let token: string
  let authFile: string
  let originalHome: string | undefined
  let tmpRepoPath: string

  beforeEach(async () => {
    vi.clearAllMocks()
    _resetCoverageCacheForTests()
    _resetRefreshLocksForTests()

    const tmp = makeTmpHome()
    cleanupHome = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token

    // Override $HOME so os.homedir() in the route resolves the family root under
    // our tmpdir, not the developer's actual ~/Sourcecode tree. Build a real repo
    // path inside it so realpathSync() succeeds.
    originalHome = process.env.HOME
    process.env.HOME = tmp.homeDir
    tmpRepoPath = join(tmp.homeDir, 'Sourcecode', 'agenticapps', 'dashboard')
    mkdirSync(tmpRepoPath, { recursive: true })

    // Reset mocks to defaults for each test
    vi.mocked(coverageSpawnMod.spawnGitNexusAnalyze).mockResolvedValue({
      kind: 'ok',
      stdout: 'ok',
    })
    vi.mocked(repoDiscoveryMod.discoverRepos).mockReturnValue([
      {
        family: 'agenticapps',
        name: 'dashboard',
        absPath: tmpRepoPath,
      },
    ])
    vi.mocked(coverageScanMod.scanCoverage).mockResolvedValue({
      schemaVersion: 1,
      generatedAtIso: new Date().toISOString(),
      gitNexusInstallState: 'not-installed',
      workflowHeadVersion: null,
      rows: [],
    })
    vi.mocked(coverageScanMod.scanCoverageInternal).mockResolvedValue({
      response: {
        schemaVersion: 1,
        generatedAtIso: new Date().toISOString(),
        gitNexusInstallState: 'not-installed',
        workflowHeadVersion: null,
        rows: [
          {
            family: 'agenticapps',
            repo: 'dashboard',
            claudeMd: { kind: 'basic', state: 'fresh' },
            gitNexus: { kind: 'basic', state: 'fresh' },
            wiki: { kind: 'basic', state: 'fresh' },
            workflowVersion: {
              kind: 'workflow',
              state: 'fresh',
              installedVersion: '1.0.0',
              headVersion: '1.0.0',
            },
            overrideCount: 0,
            overrides: [],
            inRegistry: true, // D-13-EXT-07
          },
        ],
      },
      internalRows: [
        {
          family: 'agenticapps',
          repo: 'dashboard',
          absPath: tmpRepoPath,
          claudeMd: { kind: 'basic', state: 'fresh' },
          gitNexus: { kind: 'basic', state: 'fresh' },
          wiki: { kind: 'basic', state: 'fresh' },
          workflowVersion: {
            kind: 'workflow',
            state: 'fresh',
            installedVersion: '1.0.0',
            headVersion: '1.0.0',
          },
          overrideCount: 0,
          overrides: [],
          inRegistry: true, // D-13-EXT-07
        },
      ],
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    _resetCoverageCacheForTests()
    _resetRefreshLocksForTests()
    if (originalHome === undefined) delete process.env.HOME
    else process.env.HOME = originalHome
    cleanupHome()
  })

  return {
    getToken: () => token,
    getAuthFile: () => authFile,
    getTmpRepoPath: () => tmpRepoPath,
  }
}

// ── GET /api/coverage ─────────────────────────────────────────────────────────

describe('GET /api/coverage', () => {
  const setup = makeTestSetup()

  it('returns 401 without Authorization header', async () => {
    const app = createApp({ authFile: setup.getAuthFile() })
    const res = await app.request('http://127.0.0.1:5193/api/coverage')
    expect(res.status).toBe(401)
  })

  it('returns schema-valid CoverageResponse on cache miss (200)', async () => {
    const app = createApp({ authFile: setup.getAuthFile() })
    const res = await app.request('http://127.0.0.1:5193/api/coverage', {
      headers: authHeaders(setup.getToken()),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(() => CoverageResponseSchema.parse(body)).not.toThrow()
  })

  it('returns cached response on second call within TTL — orchestrator NOT called again (COV-03)', async () => {
    const app = createApp({ authFile: setup.getAuthFile() })
    const spy = vi.mocked(coverageScanMod.scanCoverage)

    await app.request('http://127.0.0.1:5193/api/coverage', {
      headers: authHeaders(setup.getToken()),
    })
    await app.request('http://127.0.0.1:5193/api/coverage', {
      headers: authHeaders(setup.getToken()),
    })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('re-scans after cache is invalidated — orchestrator called twice', async () => {
    const app = createApp({ authFile: setup.getAuthFile() })
    const spy = vi.mocked(coverageScanMod.scanCoverage)

    const t1 = new Date(Date.now() - 1000).toISOString()
    const t2 = new Date().toISOString()
    spy
      .mockResolvedValueOnce({
        schemaVersion: 1,
        generatedAtIso: t1,
        gitNexusInstallState: 'not-installed',
        workflowHeadVersion: null,
        rows: [],
      })
      .mockResolvedValueOnce({
        schemaVersion: 1,
        generatedAtIso: t2,
        gitNexusInstallState: 'not-installed',
        workflowHeadVersion: null,
        rows: [],
      })

    const res1 = await app.request('http://127.0.0.1:5193/api/coverage', {
      headers: authHeaders(setup.getToken()),
    })
    const body1 = (await res1.json()) as { generatedAtIso: string }

    // Invalidate cache between calls
    const { invalidateCoverageCache } = await import('../lib/coverageCache.js')
    invalidateCoverageCache()

    const res2 = await app.request('http://127.0.0.1:5193/api/coverage', {
      headers: authHeaders(setup.getToken()),
    })
    const body2 = (await res2.json()) as { generatedAtIso: string }

    expect(spy).toHaveBeenCalledTimes(2)
    expect(body1.generatedAtIso).not.toBe(body2.generatedAtIso)
  })

  // GENUINELY-FAILING RED test from Plan 01 — now GREEN: CODEX HIGH-1
  it('GET /api/coverage response NEVER contains absPath (CODEX HIGH-1)', async () => {
    vi.mocked(coverageScanMod.scanCoverage).mockResolvedValueOnce({
      schemaVersion: 1,
      generatedAtIso: new Date().toISOString(),
      gitNexusInstallState: 'installed-with-registry',
      workflowHeadVersion: '1.0.0',
      rows: [
        {
          family: 'agenticapps',
          repo: 'dashboard',
          claudeMd: { kind: 'basic', state: 'fresh' },
          gitNexus: { kind: 'basic', state: 'stale', daysSince: 5 },
          wiki: { kind: 'basic', state: 'fresh' },
          workflowVersion: {
            kind: 'workflow',
            state: 'fresh',
            installedVersion: '1.0.0',
            headVersion: '1.0.0',
          },
          overrideCount: 0,
          overrides: [],
          inRegistry: true, // D-13-EXT-07
        },
      ],
    })

    const app = createApp({ authFile: setup.getAuthFile() })
    const res = await app.request('http://127.0.0.1:5193/api/coverage', {
      headers: authHeaders(setup.getToken()),
    })
    const text = await res.text()
    expect(text).not.toMatch(/absPath/)
    expect(res.status).toBe(200)
  })

  it('outbound schema-drift defense: malformed scan result yields schema_drift 500', async () => {
    // Return a value with wrong schemaVersion — Zod literal(1) will reject it.
    vi.mocked(coverageScanMod.scanCoverage).mockResolvedValueOnce(
      { schemaVersion: 999 as unknown as 1, generatedAtIso: '', gitNexusInstallState: 'not-installed', workflowHeadVersion: null, rows: [] },
    )
    _resetCoverageCacheForTests()

    const app = createApp({ authFile: setup.getAuthFile() })
    const res = await app.request('http://127.0.0.1:5193/api/coverage', {
      headers: authHeaders(setup.getToken()),
    })
    expect(res.status).toBe(500)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('schema_drift')
  })
})

// ── POST /api/coverage/refresh ────────────────────────────────────────────────

describe('POST /api/coverage/refresh', () => {
  const setup = makeTestSetup()

  // GENUINELY-FAILING RED test from Plan 01 — now GREEN: CODEX HIGH-5 + D-10-09
  it('POST /api/coverage/refresh with action=wiki-compile returns 400 (CODEX HIGH-5 + D-10-09)', async () => {
    const app = createApp({ authFile: setup.getAuthFile() })
    const res = await app.request('http://127.0.0.1:5193/api/coverage/refresh', {
      method: 'POST',
      headers: {
        ...authHeaders(setup.getToken()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ family: 'agenticapps', repo: 'foo', action: 'wiki-compile' }),
    })
    expect(res.status).toBe(400)
    // Spawn must NOT have been called
    expect(coverageSpawnMod.spawnGitNexusAnalyze).not.toHaveBeenCalled()
  })

  it('routes gitnexus-analyze to spawnGitNexusAnalyze and returns CoverageRefreshResponse (CODEX HIGH-5)', async () => {
    const app = createApp({ authFile: setup.getAuthFile() })
    const res = await app.request('http://127.0.0.1:5193/api/coverage/refresh', {
      method: 'POST',
      headers: {
        ...authHeaders(setup.getToken()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        family: 'agenticapps',
        repo: 'dashboard',
        action: 'gitnexus-analyze',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(() => CoverageRefreshResponseSchema.parse(body)).not.toThrow()
    expect(body.ok).toBe(true)
    expect(body.kind).toBe('ok')
    // CODEX HIGH-5: updatedRow REQUIRED on kind='ok'
    expect(body.updatedRow).toBeDefined()
    const updatedRow = body.updatedRow as Record<string, unknown>
    expect(updatedRow.family).toBe('agenticapps')
    expect(updatedRow.repo).toBe('dashboard')
  })

  it('returns ok:false kind:not-installed when binary absent — no 500 (graceful)', async () => {
    vi.mocked(coverageSpawnMod.spawnGitNexusAnalyze).mockResolvedValueOnce({
      kind: 'not-installed',
    })
    const app = createApp({ authFile: setup.getAuthFile() })
    const res = await app.request('http://127.0.0.1:5193/api/coverage/refresh', {
      method: 'POST',
      headers: {
        ...authHeaders(setup.getToken()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        family: 'agenticapps',
        repo: 'dashboard',
        action: 'gitnexus-analyze',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.ok).toBe(false)
    expect(body.kind).toBe('not-installed')
  })

  it('returns ok:false kind:error when spawnGitNexusAnalyze throws — caught and mapped', async () => {
    vi.mocked(coverageSpawnMod.spawnGitNexusAnalyze).mockRejectedValueOnce(
      new Error('spawn crash'),
    )
    const app = createApp({ authFile: setup.getAuthFile() })
    const res = await app.request('http://127.0.0.1:5193/api/coverage/refresh', {
      method: 'POST',
      headers: {
        ...authHeaders(setup.getToken()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        family: 'agenticapps',
        repo: 'dashboard',
        action: 'gitnexus-analyze',
      }),
    })
    // Caught inside the async block and returned as {ok:false,kind:'error'}
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.ok).toBe(false)
    expect(body.kind).toBe('error')
    expect(body.stderr as string).toContain('spawn crash')
  })

  it('returns 400 on malformed body (missing repo)', async () => {
    const app = createApp({ authFile: setup.getAuthFile() })
    const res = await app.request('http://127.0.0.1:5193/api/coverage/refresh', {
      method: 'POST',
      headers: {
        ...authHeaders(setup.getToken()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ family: 'agenticapps', action: 'gitnexus-analyze' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when repo not found in discovery set', async () => {
    vi.mocked(repoDiscoveryMod.discoverRepos).mockReturnValueOnce([])
    const app = createApp({ authFile: setup.getAuthFile() })
    const res = await app.request('http://127.0.0.1:5193/api/coverage/refresh', {
      method: 'POST',
      headers: {
        ...authHeaders(setup.getToken()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        family: 'agenticapps',
        repo: 'nonexistent',
        action: 'gitnexus-analyze',
      }),
    })
    expect(res.status).toBe(400)
  })

  it('succeeds → invalidates cache → subsequent GET re-scans (scan called twice)', async () => {
    const scanSpy = vi.mocked(coverageScanMod.scanCoverage)
    const app = createApp({ authFile: setup.getAuthFile() })

    // First GET populates cache
    await app.request('http://127.0.0.1:5193/api/coverage', {
      headers: authHeaders(setup.getToken()),
    })
    expect(scanSpy).toHaveBeenCalledTimes(1)

    // POST refresh — should invalidate cache
    await app.request('http://127.0.0.1:5193/api/coverage/refresh', {
      method: 'POST',
      headers: {
        ...authHeaders(setup.getToken()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        family: 'agenticapps',
        repo: 'dashboard',
        action: 'gitnexus-analyze',
      }),
    })

    // Second GET should re-scan because cache was invalidated
    await app.request('http://127.0.0.1:5193/api/coverage', {
      headers: authHeaders(setup.getToken()),
    })
    expect(scanSpy).toHaveBeenCalledTimes(2)
  })

  it('CODEX HIGH-3 TOCTOU: rejects when absPath escapes family root, spawn never called', async () => {
    // Simulate TOCTOU: discovery returns a tmpdir path that is outside ~/Sourcecode/agenticapps
    const escapedPath = mkdtempSync(join(tmpdir(), 'agentic-toctou-'))
    try {
      vi.mocked(repoDiscoveryMod.discoverRepos).mockReturnValueOnce([
        {
          family: 'agenticapps',
          name: 'dashboard',
          absPath: escapedPath, // outside ~/Sourcecode/agenticapps/
        },
      ])

      const app = createApp({ authFile: setup.getAuthFile() })
      const res = await app.request('http://127.0.0.1:5193/api/coverage/refresh', {
        method: 'POST',
        headers: {
          ...authHeaders(setup.getToken()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          family: 'agenticapps',
          repo: 'dashboard',
          action: 'gitnexus-analyze',
        }),
      })

      // Route detects escape and returns error (200 with ok:false)
      const body = await res.json() as Record<string, unknown>
      expect(body.ok).toBe(false)
      expect(body.kind).toBe('error')
      expect(body.stderr as string).toMatch(/escapes family root|TOCTOU/)
      // Spawn must NOT have been called
      expect(coverageSpawnMod.spawnGitNexusAnalyze).not.toHaveBeenCalled()
    } finally {
      rmSync(escapedPath, { recursive: true, force: true })
    }
  })

  it('CODEX MED-14: concurrent POSTs against the same {family,repo} serialize — spawn called ONCE', async () => {
    // Use a deferred promise to control spawn timing
    let resolveSpawn!: (v: { kind: 'ok'; stdout: string }) => void
    const spawnPromise = new Promise<{ kind: 'ok'; stdout: string }>((resolve) => {
      resolveSpawn = resolve
    })

    vi.mocked(coverageSpawnMod.spawnGitNexusAnalyze).mockImplementation(() => spawnPromise)

    const app = createApp({ authFile: setup.getAuthFile() })
    const body = JSON.stringify({
      family: 'agenticapps',
      repo: 'dashboard',
      action: 'gitnexus-analyze',
    })
    const headers = { ...authHeaders(setup.getToken()), 'Content-Type': 'application/json' }

    // Fire two concurrent POSTs — they should serialize via the lock
    const p1 = app.request('http://127.0.0.1:5193/api/coverage/refresh', {
      method: 'POST',
      headers,
      body,
    })
    const p2 = app.request('http://127.0.0.1:5193/api/coverage/refresh', {
      method: 'POST',
      headers,
      body,
    })

    // Allow a microtask tick so both requests enter the handler
    await new Promise((r) => setTimeout(r, 10))

    // Resolve the spawn — both requests should complete
    resolveSpawn({ kind: 'ok', stdout: 'ok' })

    const [res1, res2] = await Promise.all([p1, p2])
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)

    // Spawn called EXACTLY ONCE (second request awaited the first's in-flight promise)
    expect(coverageSpawnMod.spawnGitNexusAnalyze).toHaveBeenCalledTimes(1)
  }, 10000)

  it('CODEX MED-14: concurrent POSTs for DIFFERENT repos both spawn (no cross-repo blocking)', async () => {
    // Build a second tmp repo so the two POSTs target distinct lock keys.
    const secondRepo = join(setup.getTmpRepoPath(), '..', 'sibling-repo')
    mkdirSync(secondRepo, { recursive: true })

    vi.mocked(repoDiscoveryMod.discoverRepos).mockReturnValue([
      {
        family: 'agenticapps',
        name: 'dashboard',
        absPath: setup.getTmpRepoPath(),
      },
      {
        family: 'agenticapps',
        name: 'sibling-repo',
        absPath: secondRepo,
      },
    ])

    const app = createApp({ authFile: setup.getAuthFile() })
    const headers = { ...authHeaders(setup.getToken()), 'Content-Type': 'application/json' }

    const [res1, res2] = await Promise.all([
      app.request('http://127.0.0.1:5193/api/coverage/refresh', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          family: 'agenticapps',
          repo: 'dashboard',
          action: 'gitnexus-analyze',
        }),
      }),
      app.request('http://127.0.0.1:5193/api/coverage/refresh', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          family: 'agenticapps',
          repo: 'sibling-repo',
          action: 'gitnexus-analyze',
        }),
      }),
    ])

    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    // Both repos spawned — no cross-repo serialization
    expect(coverageSpawnMod.spawnGitNexusAnalyze).toHaveBeenCalledTimes(2)
  }, 10000)

  it('returns ok:false kind:timeout on spawn timeout', async () => {
    vi.mocked(coverageSpawnMod.spawnGitNexusAnalyze).mockResolvedValueOnce({ kind: 'timeout' })
    const app = createApp({ authFile: setup.getAuthFile() })
    const res = await app.request('http://127.0.0.1:5193/api/coverage/refresh', {
      method: 'POST',
      headers: {
        ...authHeaders(setup.getToken()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        family: 'agenticapps',
        repo: 'dashboard',
        action: 'gitnexus-analyze',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.ok).toBe(false)
    expect(body.kind).toBe('timeout')
  })

  it('returns ok:false kind:error with exitCode+stderr on spawn error', async () => {
    vi.mocked(coverageSpawnMod.spawnGitNexusAnalyze).mockResolvedValueOnce({
      kind: 'error',
      exitCode: 1,
      stderr: 'analyze failed',
    })
    const app = createApp({ authFile: setup.getAuthFile() })
    const res = await app.request('http://127.0.0.1:5193/api/coverage/refresh', {
      method: 'POST',
      headers: {
        ...authHeaders(setup.getToken()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        family: 'agenticapps',
        repo: 'dashboard',
        action: 'gitnexus-analyze',
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.ok).toBe(false)
    expect(body.kind).toBe('error')
    expect(body.exitCode).toBe(1)
    expect(body.stderr).toBe('analyze failed')
  })
})
