/**
 * coverageHistory.test.ts — GET /api/coverage/history?repoId=... (bulk-per-repo).
 *
 * Plan 11-02 Task 5 (RED first).
 *
 * Locked semantics (PD-11-02):
 *   - Single response carries drift for ALL FOUR cells of one repo
 *   - NO ?cell= query param
 *   - repoId validated against registry + coverage scan (REVIEWS action item 3
 *     — data-driven, not regex)
 *   - Bearer-auth inherited from middleware (401 without token)
 *   - 1h cache short-circuit keyed by repoId (PD-11-02)
 *   - outbound() schema-drift defence (INV-04)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'

// Mock coverageScan BEFORE importing the route so legal repo set has a fixed shape.
vi.mock('../lib/coverageScan.js', () => ({
  scanCoverage: vi.fn(),
  scanCoverageInternal: vi.fn(),
}))

// Mock registry to inject a known set of legal repoIds.
vi.mock('../lib/registry.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/registry.js')>(
    '../lib/registry.js',
  )
  return {
    ...actual,
    readRegistry: vi.fn(),
  }
})

// Mock the snapshot reader so we control drift output.
vi.mock('../lib/snapshots/snapshotReader.js', async () => {
  const actual = await vi.importActual<typeof import('../lib/snapshots/snapshotReader.js')>(
    '../lib/snapshots/snapshotReader.js',
  )
  return {
    ...actual,
    readDriftForRepo: vi.fn(),
  }
})

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { CoverageHistoryResponseSchema } from '@agenticapps/dashboard-shared'
import { scanCoverageInternal } from '../lib/coverageScan.js'
import { readRegistry } from '../lib/registry.js'
import { readDriftForRepo } from '../lib/snapshots/snapshotReader.js'
import { clearCoverageHistoryCache } from '../lib/coverageHistoryCache.js'

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

function makeScanRow(family: 'agenticapps' | 'factiv' | 'neuroflash', repo: string) {
  return {
    family,
    repo,
    claudeMd: { kind: 'basic' as const, state: 'fresh' as const },
    gitNexus: { kind: 'basic' as const, state: 'fresh' as const },
    wiki: { kind: 'basic' as const, state: 'fresh' as const },
    workflowVersion: {
      kind: 'workflow' as const,
      state: 'fresh' as const,
      installedVersion: '1.8.0',
      headVersion: '1.8.0',
    },
    overrideCount: 0,
    overrides: [],
  }
}

describe('GET /api/coverage/history?repoId=', () => {
  let cleanupHome: () => void
  let authFile: string
  let token: string

  beforeEach(async () => {
    vi.clearAllMocks()
    clearCoverageHistoryCache()

    const tmp = makeTmpHome()
    cleanupHome = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token

    // Default scan output: one known agenticapps/dashboard repo + one with
    // dots/underscores so Test 5 has a target.
    vi.mocked(scanCoverageInternal).mockResolvedValue({
      response: {
        schemaVersion: 1,
        generatedAtIso: new Date().toISOString(),
        gitNexusInstallState: 'not-installed',
        workflowHeadVersion: null,
        rows: [
          makeScanRow('agenticapps', 'agenticapps-dashboard'),
          makeScanRow('factiv', 'foo.with.dots'),
        ],
      },
      internalRows: [],
    })

    // Registry has one project id that doubles as a legal repoId.
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [
        {
          id: 'agenticapps-dashboard',
          name: 'Dashboard',
          root: '/tmp/fake/root',
          client: null,
          addedAt: new Date().toISOString(),
          tags: [],
        },
      ],
    })

    // Default drift: all-null
    vi.mocked(readDriftForRepo).mockResolvedValue({
      claudeMd: { direction: null, daysSince: null },
      gitNexus: { direction: null, daysSince: null },
      wiki: { direction: null, daysSince: null },
      workflowVersion: { direction: null, daysSince: null },
    })
  })

  afterEach(() => {
    cleanupHome()
    clearCoverageHistoryCache()
  })

  it('Test 1: GET without bearer token returns 401', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/coverage/history?repoId=agenticapps/agenticapps-dashboard',
    )
    expect(res.status).toBe(401)
  })

  it('Test 2: GET with valid bearer + known repoId returns 200 + CoverageHistoryResponseSchema-valid body', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/coverage/history?repoId=agenticapps/agenticapps-dashboard',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(() => CoverageHistoryResponseSchema.parse(body)).not.toThrow()
  })

  it('Test 3: response body has all four cell keys (PD-11-02 bulk shape)', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/coverage/history?repoId=agenticapps/agenticapps-dashboard',
      { headers: authHeaders(token) },
    )
    const body = (await res.json()) as { cells: Record<string, unknown> }
    expect(Object.keys(body.cells).sort()).toEqual(
      ['claudeMd', 'gitNexus', 'wiki', 'workflowVersion'].sort(),
    )
  })

  it('Test 4: repoId=../etc/passwd returns 404 repo_not_found', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/coverage/history?repoId=' +
        encodeURIComponent('../etc/passwd'),
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('repo_not_found')
  })

  it('Test 5: dotted+underscore repoId from scan output is accepted (REVIEWS action item 3 — data-driven, not regex)', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/coverage/history?repoId=' +
        encodeURIComponent('factiv/foo.with.dots'),
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
  })

  it('Test 6: missing repoId returns 400 invalid_query', async () => {
    const app = createApp({ authFile })
    const res = await app.request('http://127.0.0.1:5193/api/coverage/history', {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('invalid_query')
  })

  it('Test 7: empty repoId returns 400 invalid_query', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/coverage/history?repoId=',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('invalid_query')
  })

  it('Test 8: cache hit — two identical GETs within 1h call readDriftForRepo only once', async () => {
    const app = createApp({ authFile })

    await app.request(
      'http://127.0.0.1:5193/api/coverage/history?repoId=agenticapps/agenticapps-dashboard',
      { headers: authHeaders(token) },
    )
    await app.request(
      'http://127.0.0.1:5193/api/coverage/history?repoId=agenticapps/agenticapps-dashboard',
      { headers: authHeaders(token) },
    )

    expect(readDriftForRepo).toHaveBeenCalledTimes(1)
  })

  it('Test 9: outbound response matches CoverageHistoryResponseSchema (INV-04)', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/coverage/history?repoId=agenticapps/agenticapps-dashboard',
      { headers: authHeaders(token) },
    )
    const body = (await res.json()) as Record<string, unknown>
    // The wire shape locks: schemaVersion=1, windowDays=14, repoId, cells (strict 4-cell).
    expect(body.schemaVersion).toBe(1)
    expect(body.windowDays).toBe(14)
    expect(body.repoId).toBe('agenticapps/agenticapps-dashboard')
    expect(() => CoverageHistoryResponseSchema.parse(body)).not.toThrow()
  })

  it('Test 10: NO cell= query param is consumed — same bulk shape returned (PD-11-02)', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/coverage/history?repoId=agenticapps/agenticapps-dashboard&cell=claudeMd',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { cells: Record<string, unknown> }
    // All four cells still present — the cell param did NOT narrow the response.
    expect(Object.keys(body.cells).sort()).toEqual(
      ['claudeMd', 'gitNexus', 'wiki', 'workflowVersion'].sort(),
    )
  })
})
