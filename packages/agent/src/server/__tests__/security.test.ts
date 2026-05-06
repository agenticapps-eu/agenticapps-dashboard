/**
 * Tests for GET /api/projects/:id/security — PHASE-04
 *
 * 7 cases (S1–S7):
 *   S1: 200 + { cso: { fileName, content }, dbSentinel: null } when only CSO file exists
 *   S2: 200 + both cso and dbSentinel populated when both files exist
 *   S3: 200 + { cso: null, dbSentinel: null } when no security files in phase dir
 *   S4: 200 + { cso: null, dbSentinel: null } when no phase dir exists
 *   S5: cache hit — second call within 5s does NOT re-invoke parseSecurityReports
 *   S6: unknown id → 404 with project_not_found
 *   S7: schema drift → 500 schema_drift
 */
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'

import { createApp } from '../app.js'
import { setActiveToken, ensureAuthFile } from '../../lib/auth.js'
import { makeTmpHome } from '../../lib/__fixtures__/tmpHome.js'
import { makePhase4Fixture } from '../../lib/__fixtures__/phase4-fixture.js'
import { _resetForTests as resetPhaseCache, evictPhaseCacheProject } from '../../lib/phaseCache.js'
import { _resetForTests as resetOverviewCache } from '../../lib/overviewCache.js'
import * as phaseDetailLib from '../../lib/phaseDetail.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('GET /api/projects/:id/security', () => {
  let cleanupHome: () => void
  let cleanupFixture: () => void
  let token: string
  let registryFile: string
  let projectRoot: string
  let projectId: string
  let parseSecurityReportsSpy: MockInstance

  beforeEach(async () => {
    vi.useFakeTimers()
    resetPhaseCache()
    resetOverviewCache()

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

    // Write a phase dir with a CSO security file
    fixture.writeLatestPhaseDir('04-single-project-view', {
      '04-SECURITY.md': '# /cso Audit\n\nNo issues found.\n',
    })

    // Register the project
    const app = createApp({ registryFile })
    const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectRoot }),
    })
    const body = (await regRes.json()) as { id: string }
    projectId = body.id

    parseSecurityReportsSpy = vi.spyOn(phaseDetailLib, 'parseSecurityReports')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetPhaseCache()
    resetOverviewCache()
    cleanupHome()
    cleanupFixture()
  })

  it('S1: 200 + { cso populated, dbSentinel: null } when only CSO file exists', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/security`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      cso: { fileName: string; content: string } | null
      dbSentinel: unknown | null
    }
    expect(data.cso).not.toBeNull()
    expect(data.cso!.fileName).toBe('04-SECURITY.md')
    expect(typeof data.cso!.content).toBe('string')
    expect(data.dbSentinel).toBeNull()
  })

  it('S2: 200 + both cso and dbSentinel populated when both files exist', async () => {
    const fixture2 = makePhase4Fixture()
    try {
      fixture2.writeLatestPhaseDir('04-single-project-view', {
        '04-SECURITY.md': '# /cso Audit\n\nNo issues.\n',
        '04-DB-SENTINEL-REPORT.md': '# DB Sentinel\n\nNo drift.\n',
      })

      const app = createApp({ registryFile })
      const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: fixture2.root }),
      })
      const body = (await regRes.json()) as { id: string }
      const id2 = body.id

      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${id2}/security`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as {
        cso: { fileName: string; content: string } | null
        dbSentinel: { fileName: string; content: string } | null
      }
      expect(data.cso).not.toBeNull()
      expect(data.dbSentinel).not.toBeNull()
      expect(data.dbSentinel!.fileName).toContain('DB-SENTINEL')
    } finally {
      fixture2.cleanup()
    }
  })

  it('S3: 200 + { cso: null, dbSentinel: null } when no security files in phase dir', async () => {
    const noSecFixture = makePhase4Fixture()
    try {
      // Phase dir exists but no security files
      noSecFixture.writeLatestPhaseDir('04-single-project-view', {
        '04-CONTEXT.md': '# Context\n',
      })

      const app = createApp({ registryFile })
      const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: noSecFixture.root }),
      })
      const body = (await regRes.json()) as { id: string }
      const noSecId = body.id

      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${noSecId}/security`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as { cso: unknown; dbSentinel: unknown }
      expect(data.cso).toBeNull()
      expect(data.dbSentinel).toBeNull()
    } finally {
      noSecFixture.cleanup()
    }
  })

  it('S4: 200 + { cso: null, dbSentinel: null } when no phase dir exists at all', async () => {
    const noDirFixture = makePhase4Fixture()
    // No writeLatestPhaseDir call at all
    try {
      const app = createApp({ registryFile })
      const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: noDirFixture.root }),
      })
      const body = (await regRes.json()) as { id: string }
      const noDirId = body.id

      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${noDirId}/security`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as { cso: unknown; dbSentinel: unknown }
      expect(data.cso).toBeNull()
      expect(data.dbSentinel).toBeNull()
    } finally {
      noDirFixture.cleanup()
    }
  })

  it('S5: cache hit — second call within 5s does NOT re-invoke parseSecurityReports', async () => {
    const app = createApp({ registryFile })

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/security`,
      { headers: authHeaders(token) },
    )
    expect(parseSecurityReportsSpy).toHaveBeenCalledTimes(1)

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/security`,
      { headers: authHeaders(token) },
    )
    expect(parseSecurityReportsSpy).toHaveBeenCalledTimes(1)

    // Also verify eviction forces re-call
    evictPhaseCacheProject(projectId)
    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/security`,
      { headers: authHeaders(token) },
    )
    expect(parseSecurityReportsSpy).toHaveBeenCalledTimes(2)
  })

  it('S6: unknown id → 404 with project_not_found', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/projects/nonexistent-id/security',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('project_not_found')
  })

  it('S7: schema drift → 500 schema_drift', async () => {
    const app = createApp({ registryFile })

    // Return malformed data: cso should be object|null but return number
    parseSecurityReportsSpy.mockReturnValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { cso: 42, dbSentinel: null } as any,
    )

    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/security`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('schema_drift')
  })
})
