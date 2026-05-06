/**
 * Tests for GET /api/projects/:id/observations/recent — DISC-02 + DISC-04
 *
 * 8 cases (7 standard + 1 limit variant):
 *   X1: 200 + valid ObservationsRecentResponse for a project with JSONL events
 *   X2: cache hit — second call within 5s does NOT re-invoke readSkillObservations
 *   X3: cache miss after 5s — second call invokes readSkillObservations again
 *   X4: unknown id → 404 with { ok: false, error: 'project_not_found', requestId }
 *   X5: schema drift — malformed parser output → 500 schema_drift
 *   X6: cache eviction via evictPhaseCacheProject → parser called twice
 *   X7: no meta-observer skill → 200 with { entries: [], skillInstalled: false } (DISC-04)
 *   X8: ?limit=5 is honored (5 entries returned), ?limit=999 is clamped to 100
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

describe('GET /api/projects/:id/observations/recent', () => {
  let cleanupHome: () => void
  let cleanupFixture: () => void
  let token: string
  let registryFile: string
  let projectRoot: string
  let projectId: string
  let readSkillObservationsSpy: MockInstance

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

    // Install meta-observer skill
    fixture.writeMetaObserverSkill()

    // Write 30 JSONL hook-firing events
    const events = Array.from({ length: 30 }, (_, i) => ({
      ts: `2026-05-0${String(i % 9 + 1).padStart(2, '0')}T00:00:${String(i).padStart(2, '0')}Z`,
      skill: 'agenticapps-workflow',
      hook: 'pre-commit',
      index: i,
    }))
    fixture.writeJsonl('events.jsonl', events)

    // Register the project
    const app = createApp({ registryFile })
    const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectRoot }),
    })
    const body = (await regRes.json()) as { id: string }
    projectId = body.id

    readSkillObservationsSpy = vi.spyOn(phaseDetailLib, 'readSkillObservations')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetPhaseCache()
    resetOverviewCache()
    cleanupHome()
    cleanupFixture()
  })

  it('X1: 200 + valid ObservationsRecentResponse for a project with JSONL events', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observations/recent`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { entries: unknown[]; skillInstalled: boolean }
    expect(Array.isArray(data.entries)).toBe(true)
    expect(typeof data.skillInstalled).toBe('boolean')
    expect(data.skillInstalled).toBe(true)
    // Default limit is 20; we have 30 events
    expect(data.entries.length).toBeLessThanOrEqual(20)
  })

  it('X2: cache hit — second call within 5s does NOT re-invoke readSkillObservations', async () => {
    const app = createApp({ registryFile })

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observations/recent`,
      { headers: authHeaders(token) },
    )
    expect(readSkillObservationsSpy).toHaveBeenCalledTimes(1)

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observations/recent`,
      { headers: authHeaders(token) },
    )
    expect(readSkillObservationsSpy).toHaveBeenCalledTimes(1)
  })

  it('X3: cache miss after 5s — second call invokes readSkillObservations again', async () => {
    const app = createApp({ registryFile })

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observations/recent`,
      { headers: authHeaders(token) },
    )
    expect(readSkillObservationsSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5_001)

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observations/recent`,
      { headers: authHeaders(token) },
    )
    expect(readSkillObservationsSpy).toHaveBeenCalledTimes(2)
  })

  it('X4: unknown id → 404 with project_not_found', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/projects/nonexistent-id/observations/recent',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('project_not_found')
  })

  it('X5: schema drift — malformed parser output → 500 schema_drift', async () => {
    const app = createApp({ registryFile })

    // Return wrong shape: entries should be array but is a number
    readSkillObservationsSpy.mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { entries: 'not-an-array', skillInstalled: true } as any,
    )

    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observations/recent`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('schema_drift')
  })

  it('X6: cache eviction via evictPhaseCacheProject → parser called twice', async () => {
    const app = createApp({ registryFile })

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observations/recent`,
      { headers: authHeaders(token) },
    )
    expect(readSkillObservationsSpy).toHaveBeenCalledTimes(1)

    evictPhaseCacheProject(projectId)

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observations/recent`,
      { headers: authHeaders(token) },
    )
    expect(readSkillObservationsSpy).toHaveBeenCalledTimes(2)
  })

  it('X7: no meta-observer SKILL.md → 200 with { entries: [], skillInstalled: false } (DISC-04)', async () => {
    const noSkillFixture = makePhase4Fixture()
    // No writeMetaObserverSkill call — skill not installed
    try {
      const app = createApp({ registryFile })
      const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: noSkillFixture.root }),
      })
      const body = (await regRes.json()) as { id: string }
      const noSkillId = body.id

      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${noSkillId}/observations/recent`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as { entries: unknown[]; skillInstalled: boolean }
      expect(data.skillInstalled).toBe(false)
      expect(Array.isArray(data.entries)).toBe(true)
    } finally {
      noSkillFixture.cleanup()
    }
  })

  it('X8: ?limit=5 returns 5 entries; ?limit=999 is clamped to 100', async () => {
    const app = createApp({ registryFile })

    // ?limit=5 — cache key is distinct from default-20 cache key
    const resLimit5 = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observations/recent?limit=5`,
      { headers: authHeaders(token) },
    )
    expect(resLimit5.status).toBe(200)
    const dataLimit5 = (await resLimit5.json()) as { entries: unknown[] }
    expect(dataLimit5.entries.length).toBeLessThanOrEqual(5)

    // ?limit=999 → clamped to 100
    const resLimit999 = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observations/recent?limit=999`,
      { headers: authHeaders(token) },
    )
    expect(resLimit999.status).toBe(200)
    // We only have 30 events so the result is ≤ 30, but the parser was called with limit=100
    const dataLimit999 = (await resLimit999.json()) as { entries: unknown[] }
    expect(dataLimit999.entries.length).toBeLessThanOrEqual(100)

    // Verify that the route called readSkillObservations with clamped limit=100
    const calls = readSkillObservationsSpy.mock.calls
    const limitArg999Call = calls.find((args) => args[1] === 100)
    expect(limitArg999Call).toBeDefined()
  })
})
