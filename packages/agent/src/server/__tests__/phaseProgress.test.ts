/**
 * Tests for GET /api/projects/:id/phase-progress — PHASE-01 + PHASE-02 + PHASE-03 + PHASE-05
 *
 * 7 cases (PP1–PP7):
 *   PP1: 200 + valid PhaseProgressResponse for project with .planning/phases/04-foo/
 *        containing CONTEXT.md, RESEARCH.md, 04-01-PLAN.md, 04-01-SUMMARY.md
 *   PP2: no phase dir → 200 with empty/null shape
 *   PP3: cache hit — second call within 5s does NOT re-invoke parsePhaseChecklist
 *   PP4: cache miss after 5s — second call invokes parsePhaseChecklist again
 *   PP5: unknown id → 404 with project_not_found
 *   PP6: schema drift → 500 schema_drift
 *   PP7: paddedPhase is leading 2 chars of phase dir name ("04" for 04-foo)
 */
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'

import { createApp } from '../app.js'
import { setActiveToken, ensureAuthFile } from '../../lib/auth.js'
import { makeTmpHome } from '../../lib/__fixtures__/tmpHome.js'
import { makePhase4Fixture } from '../../lib/__fixtures__/phase4-fixture.js'
import { _resetForTests as resetPhaseCache } from '../../lib/phaseCache.js'
import { _resetForTests as resetOverviewCache } from '../../lib/overviewCache.js'
import * as phaseDetailLib from '../../lib/phaseDetail.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('GET /api/projects/:id/phase-progress', () => {
  let cleanupHome: () => void
  let cleanupFixture: () => void
  let token: string
  let registryFile: string
  let projectRoot: string
  let projectId: string
  let parsePhaseChecklistSpy: MockInstance

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

    // Write a populated phase directory
    fixture.writeLatestPhaseDir('04-single-project-view', {
      '04-CONTEXT.md': '# Context\n',
      '04-RESEARCH.md': '# Research\n',
      '04-UI-SPEC.md': '# UI Spec\n',
      '04-01-PLAN.md': '# Plan\n',
      '04-01-SUMMARY.md': '# Summary\n',
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

    parsePhaseChecklistSpy = vi.spyOn(phaseDetailLib, 'parsePhaseChecklist')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetPhaseCache()
    resetOverviewCache()
    cleanupHome()
    cleanupFixture()
  })

  it('PP1: 200 + valid PhaseProgressResponse for a project with phase files', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/phase-progress`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      phase: string | null
      paddedPhase: string | null
      files: unknown[]
      tdd: { greenPairs: number; totalTasks: number; timeline: unknown[] }
      review: { stage1: unknown; stage2: unknown }
      verification: { mustHavesTotal: number; mustHavesEvidenced: number; items: unknown[] }
    }
    expect(typeof data.phase === 'string' || data.phase === null).toBe(true)
    expect(Array.isArray(data.files)).toBe(true)
    expect(typeof data.tdd.greenPairs).toBe('number')
    expect(typeof data.tdd.totalTasks).toBe('number')
    expect(Array.isArray(data.tdd.timeline)).toBe(true)
    expect(Array.isArray(data.verification.items)).toBe(true)
  })

  it('PP2: no phase dir → 200 with empty/null shape', async () => {
    const emptyFixture = makePhase4Fixture()
    // No writeLatestPhaseDir — no phase dirs at all
    try {
      const app = createApp({ registryFile })
      const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: emptyFixture.root }),
      })
      const body = (await regRes.json()) as { id: string }
      const emptyId = body.id

      const res = await app.request(
        `http://127.0.0.1:5193/api/projects/${emptyId}/phase-progress`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as {
        phase: unknown
        paddedPhase: unknown
        files: unknown[]
        tdd: { greenPairs: number; totalTasks: number; timeline: unknown[] }
        verification: { mustHavesTotal: number }
      }
      expect(data.phase).toBeNull()
      expect(data.paddedPhase).toBeNull()
      expect(data.files).toEqual([])
      expect(data.tdd.timeline).toEqual([])
      expect(data.verification.mustHavesTotal).toBe(0)
    } finally {
      emptyFixture.cleanup()
    }
  })

  it('PP3: cache hit — second call within 5s does NOT re-invoke parsePhaseChecklist', async () => {
    const app = createApp({ registryFile })

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/phase-progress`,
      { headers: authHeaders(token) },
    )
    expect(parsePhaseChecklistSpy).toHaveBeenCalledTimes(1)

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/phase-progress`,
      { headers: authHeaders(token) },
    )
    expect(parsePhaseChecklistSpy).toHaveBeenCalledTimes(1)
  })

  it('PP4: cache miss after 5s — second call invokes parsePhaseChecklist again', async () => {
    const app = createApp({ registryFile })

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/phase-progress`,
      { headers: authHeaders(token) },
    )
    expect(parsePhaseChecklistSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5_001)

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/phase-progress`,
      { headers: authHeaders(token) },
    )
    expect(parsePhaseChecklistSpy).toHaveBeenCalledTimes(2)
  })

  it('PP5: unknown id → 404 with project_not_found', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/projects/nonexistent-id/phase-progress',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('project_not_found')
  })

  it('PP6: schema drift → 500 schema_drift', async () => {
    const app = createApp({ registryFile })

    // Return invalid shape — files should be array but return string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parsePhaseChecklistSpy.mockReturnValue('not-an-array' as any)

    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/phase-progress`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('schema_drift')
  })

  it('PP7: paddedPhase is leading 2 chars of phase dir name', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/phase-progress`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { phase: string | null; paddedPhase: string | null }
    // phase dir is "04-single-project-view" → phase = "04-single-project-view", paddedPhase = "04"
    expect(data.phase).toBe('04-single-project-view')
    expect(data.paddedPhase).toBe('04')
  })
})
