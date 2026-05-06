/**
 * Tests for GET /api/projects/:id/discipline — DISC-03
 *
 * 7 cases:
 *   X1: 200 + valid DisciplineResponse with rationalization rows for a project with
 *       agenticapps-workflow skill + hook firings
 *   X2: cache hit — second call within 5s does NOT re-invoke readSkillObservations
 *   X3: cache miss after 5s — second call invokes readSkillObservations again
 *   X4: unknown id → 404 with { ok: false, error: 'project_not_found', requestId }
 *   X5: schema drift — malformed parser output → 500 schema_drift
 *   X6: cache eviction via evictPhaseCacheProject → parser called twice
 *   X7: no agenticapps-workflow SKILL.md → 200 with
 *       { rationalization: { rows: [], skillInstalled: false } }
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

/** Minimal rationalization table SKILL.md content */
const SKILL_MD_WITH_TABLE = `# AgenticApps Workflow Skill

## Rationalization Table — Check Before Skipping Anything

| If you think | Actually |
|---|---|
| "TDD is slow" | Not if you write the test first |
| "No review needed" | Review catches schema drift |
`

describe('GET /api/projects/:id/discipline', () => {
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

    // Write the workflow skill with rationalization table
    fixture.writeWorkflowSkill(SKILL_MD_WITH_TABLE)

    // Write JSONL events mentioning rationalization labels
    fixture.writeJsonl('events.jsonl', [
      { ts: '2026-05-06T10:00:00Z', skill: 'agenticapps-workflow', hook: 'pre-commit', note: 'TDD is slow' },
      { ts: '2026-05-06T09:00:00Z', skill: 'agenticapps-workflow', hook: 'pre-commit', note: 'Normal run' },
    ])

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

  it('X1: 200 + valid DisciplineResponse with rationalization rows', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/discipline`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      rationalization: { rows: { label: string; fires: number }[]; skillInstalled: boolean }
    }
    expect(data.rationalization).toBeDefined()
    expect(Array.isArray(data.rationalization.rows)).toBe(true)
    expect(typeof data.rationalization.skillInstalled).toBe('boolean')
    expect(data.rationalization.skillInstalled).toBe(true)
    // Should have 2 rows from the table ("TDD is slow" and "No review needed")
    expect(data.rationalization.rows.length).toBe(2)
  })

  it('X2: cache hit — second call within 5s does NOT re-invoke readSkillObservations', async () => {
    const app = createApp({ registryFile })

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/discipline`,
      { headers: authHeaders(token) },
    )
    expect(readSkillObservationsSpy).toHaveBeenCalledTimes(1)

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/discipline`,
      { headers: authHeaders(token) },
    )
    expect(readSkillObservationsSpy).toHaveBeenCalledTimes(1)
  })

  it('X3: cache miss after 5s — second call invokes readSkillObservations again', async () => {
    const app = createApp({ registryFile })

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/discipline`,
      { headers: authHeaders(token) },
    )
    expect(readSkillObservationsSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5_001)

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/discipline`,
      { headers: authHeaders(token) },
    )
    expect(readSkillObservationsSpy).toHaveBeenCalledTimes(2)
  })

  it('X4: unknown id → 404 with project_not_found', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/projects/nonexistent-id/discipline',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('project_not_found')
  })

  it('X5: schema drift — malformed parser output → 500 schema_drift', async () => {
    const app = createApp({ registryFile })

    // Cause schema_drift by returning a malformed rationalization (missing rows)
    readSkillObservationsSpy.mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { entries: [] as any[], skillInstalled: false },
    )
    const parseRationalizationRowsSpy = vi.spyOn(phaseDetailLib, 'parseRationalizationRows')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parseRationalizationRowsSpy.mockReturnValue({ rows: 'invalid', skillInstalled: true } as any)

    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/discipline`,
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
      `http://127.0.0.1:5193/api/projects/${projectId}/discipline`,
      { headers: authHeaders(token) },
    )
    expect(readSkillObservationsSpy).toHaveBeenCalledTimes(1)

    evictPhaseCacheProject(projectId)

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/discipline`,
      { headers: authHeaders(token) },
    )
    expect(readSkillObservationsSpy).toHaveBeenCalledTimes(2)
  })

  it('X7: no agenticapps-workflow SKILL.md → 200 with { rationalization: { rows: [], skillInstalled: false } }', async () => {
    const noSkillFixture = makePhase4Fixture()
    // No writeWorkflowSkill call
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
        `http://127.0.0.1:5193/api/projects/${noSkillId}/discipline`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as {
        rationalization: { rows: unknown[]; skillInstalled: boolean }
      }
      expect(data.rationalization.skillInstalled).toBe(false)
      expect(data.rationalization.rows).toEqual([])
    } finally {
      noSkillFixture.cleanup()
    }
  })
})
