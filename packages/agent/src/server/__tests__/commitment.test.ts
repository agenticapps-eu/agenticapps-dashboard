/**
 * Tests for GET /api/projects/:id/commitment — DISC-01
 *
 * 7 cases:
 *   X1: 200 + valid CommitmentBlockResponse for a registered project with a commitment block
 *   X2: cache hit — second call within 5s does NOT re-invoke parseCommitmentBlock
 *   X3: cache miss after 5s — second call invokes parseCommitmentBlock again
 *   X4: unknown id → 404 with { ok: false, error: 'project_not_found', requestId }
 *   X5: schema drift — malformed parser output → 500 schema_drift
 *   X6: cache eviction via evictPhaseCacheProject — parser called twice across eviction
 *   X7: registered project with NO .planning/skill-observations/ dir → 200 with { markdown: null, sourceFile: null }
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

describe('GET /api/projects/:id/commitment', () => {
  let cleanupHome: () => void
  let cleanupFixture: () => void
  let token: string
  let registryFile: string
  let projectRoot: string
  let projectId: string
  let parseCommitmentBlockSpy: MockInstance

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

    // Write a valid commitment block so Test X1 returns 200 real data
    fixture.writeObservation(
      'session-handoff.md',
      `# Session Handoff — 2026-05-06\n\n## Workflow commitment\n\nI commit to TDD and CLAUDE.md constraints.\n\n## Accomplished\n\nNothing yet.\n`,
    )

    // Register the project
    const app = createApp({ registryFile })
    const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectRoot }),
    })
    const body = (await regRes.json()) as { id: string }
    projectId = body.id

    parseCommitmentBlockSpy = vi.spyOn(phaseDetailLib, 'parseCommitmentBlock')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetPhaseCache()
    resetOverviewCache()
    cleanupHome()
    cleanupFixture()
  })

  it('X1: 200 + valid CommitmentBlockResponse for a registered project with a commitment block', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/commitment`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = (await res.json()) as { markdown: string | null; sourceFile: string | null }
    expect(typeof data.markdown === 'string' || data.markdown === null).toBe(true)
    expect(typeof data.sourceFile === 'string' || data.sourceFile === null).toBe(true)
    // Since we wrote a valid commitment block, it should be present
    expect(data.markdown).not.toBeNull()
    expect(data.sourceFile).toBe('session-handoff.md')
  })

  it('X2: cache hit — second call within 5s does NOT re-invoke parseCommitmentBlock', async () => {
    const app = createApp({ registryFile })

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/commitment`,
      { headers: authHeaders(token) },
    )
    expect(parseCommitmentBlockSpy).toHaveBeenCalledTimes(1)

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/commitment`,
      { headers: authHeaders(token) },
    )
    expect(parseCommitmentBlockSpy).toHaveBeenCalledTimes(1)
  })

  it('X3: cache miss after 5s — second call invokes parseCommitmentBlock again', async () => {
    const app = createApp({ registryFile })

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/commitment`,
      { headers: authHeaders(token) },
    )
    expect(parseCommitmentBlockSpy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(5_001)

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/commitment`,
      { headers: authHeaders(token) },
    )
    expect(parseCommitmentBlockSpy).toHaveBeenCalledTimes(2)
  })

  it('X4: unknown id → 404 with project_not_found', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/projects/nonexistent-id/commitment',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('project_not_found')
  })

  it('X5: schema drift — malformed parser output → 500 schema_drift', async () => {
    const app = createApp({ registryFile })

    // Return a number where string is expected — fails CommitmentBlockResponseSchema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parseCommitmentBlockSpy.mockReturnValue({ markdown: 42, sourceFile: null } as any)

    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/commitment`,
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
      `http://127.0.0.1:5193/api/projects/${projectId}/commitment`,
      { headers: authHeaders(token) },
    )
    expect(parseCommitmentBlockSpy).toHaveBeenCalledTimes(1)

    evictPhaseCacheProject(projectId)

    await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/commitment`,
      { headers: authHeaders(token) },
    )
    expect(parseCommitmentBlockSpy).toHaveBeenCalledTimes(2)
  })

  it('X7: no skill-observations dir → 200 with { markdown: null, sourceFile: null }', async () => {
    // Create a fresh fixture with no skill-observations content
    const emptyFixture = makePhase4Fixture()
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
        `http://127.0.0.1:5193/api/projects/${emptyId}/commitment`,
        { headers: authHeaders(token) },
      )
      expect(res.status).toBe(200)
      const data = (await res.json()) as { markdown: null; sourceFile: null }
      expect(data.markdown).toBeNull()
      expect(data.sourceFile).toBeNull()
    } finally {
      emptyFixture.cleanup()
    }
  })
})
