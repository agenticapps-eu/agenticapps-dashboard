import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { ProjectOverview } from '@agenticapps/dashboard-shared'

import { createApp } from '../app.js'
import { setActiveToken, ensureAuthFile } from '../../lib/auth.js'
import { makeTmpHome, makeTmpProject } from '../../lib/__fixtures__/tmpHome.js'
import { setCached, getCached, _resetForTests as resetOverviewCache } from '../../lib/overviewCache.js'
import { setPhaseCache, getPhaseCache, _resetForTests as resetPhaseCache } from '../../lib/phaseCache.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('registry routes', () => {
  let cleanup: () => void
  let projectCleanup: () => void
  let token: string
  let registryFile: string

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token

    const proj = makeTmpProject()
    projectCleanup = proj.cleanup
  })

  afterEach(() => {
    cleanup()
    projectCleanup()
  })

  it('GET /api/registry returns [] when registry empty', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/api/registry', {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(0)
  })

  it('POST /api/registry/register { path } returns 201 with RegistryEntrySchema body', async () => {
    const app = createApp({ registryFile })
    const tmpProj = makeTmpProject()
    try {
      const res = await app.request('http://127.0.0.1:5193/api/registry/register', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmpProj.root }),
      })
      expect(res.status).toBe(201)
      const body = await res.json() as { id: string; name: string; root: string; alreadyRegistered: boolean }
      expect(typeof body.id).toBe('string')
      expect(typeof body.name).toBe('string')
      expect(body.root).toBe(tmpProj.root)
      expect(body.alreadyRegistered).toBe(false)
    } finally {
      tmpProj.cleanup()
    }
  })

  it('POST /api/registry/register again with same path returns 200 + alreadyRegistered (D-10 idempotent)', async () => {
    const app = createApp({ registryFile })
    const tmpProj = makeTmpProject()
    try {
      // First register
      await app.request('http://127.0.0.1:5193/api/registry/register', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmpProj.root }),
      })
      // Second register — same path
      const res = await app.request('http://127.0.0.1:5193/api/registry/register', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmpProj.root }),
      })
      expect(res.status).toBe(200)
      const body = await res.json() as { alreadyRegistered: boolean }
      expect(body.alreadyRegistered).toBe(true)
    } finally {
      tmpProj.cleanup()
    }
  })

  it('POST /api/registry/unregister { id } returns 204', async () => {
    const app = createApp({ registryFile })
    const tmpProj = makeTmpProject()
    try {
      // Register first
      const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tmpProj.root }),
      })
      const { id } = await regRes.json() as { id: string }

      // Unregister
      const unregRes = await app.request('http://127.0.0.1:5193/api/registry/unregister', {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      expect(unregRes.status).toBe(204)
    } finally {
      tmpProj.cleanup()
    }
  })

  it('POST /api/registry/register with malformed body returns 422', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* missing path */ }),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/registry/register with blocked system path returns 422 registration_path_blocked (B2)', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/etc' }),
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { ok: boolean; error: string; detail: string }
    expect(body.error).toBe('registration_path_blocked')
    expect(body.detail).toMatch(/system path/)
  })
})

// ─── Plan 05: rename / tags / eviction tests ─────────────────────────────────

describe('registry mutation routes (rename / tags / eviction)', () => {
  let cleanup: () => void
  let projectCleanup: () => void
  let token: string
  let registryFile: string
  let tmpProj: { root: string; cleanup: () => void }

  beforeEach(() => {
    resetOverviewCache()
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token

    tmpProj = makeTmpProject()
    projectCleanup = tmpProj.cleanup
  })

  afterEach(() => {
    cleanup()
    projectCleanup()
    resetOverviewCache()
  })

  /** Helper: register tmpProj and return the project id. */
  async function registerProject(app: ReturnType<typeof createApp>): Promise<string> {
    const res = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: tmpProj.root }),
    })
    const body = await res.json() as { id: string }
    return body.id
  }

  // ── rename ──────────────────────────────────────────────────────────────────

  it('POST /api/registry/:id/rename renames the project and returns 200 + updated entry', async () => {
    const app = createApp({ registryFile })
    const id = await registerProject(app)

    const res = await app.request(`http://127.0.0.1:5193/api/registry/${id}/rename`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Renamed Project' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { id: string; name: string }
    expect(body.id).toBe(id)
    expect(body.name).toBe('Renamed Project')
  })

  it('POST /api/registry/:id/rename for unknown id returns 404 project_not_found', async () => {
    const app = createApp({ registryFile })

    const res = await app.request('http://127.0.0.1:5193/api/registry/unknown-id/rename', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Whatever' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('project_not_found')
  })

  it('POST /api/registry/:id/rename with empty name returns 422 invalid_request', async () => {
    const app = createApp({ registryFile })
    const id = await registerProject(app)

    const res = await app.request(`http://127.0.0.1:5193/api/registry/${id}/rename`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('invalid_request')
  })

  // ── tags ─────────────────────────────────────────────────────────────────────

  it('POST /api/registry/:id/tags replaces tags and returns 200 + updated entry', async () => {
    const app = createApp({ registryFile })
    const id = await registerProject(app)

    const res = await app.request(`http://127.0.0.1:5193/api/registry/${id}/tags`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['active', 'client'] }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { id: string; tags: string[] }
    expect(body.id).toBe(id)
    expect(body.tags).toEqual(['active', 'client'])
  })

  it('POST /api/registry/:id/tags with non-array tags returns 422 invalid_request', async () => {
    const app = createApp({ registryFile })
    const id = await registerProject(app)

    const res = await app.request(`http://127.0.0.1:5193/api/registry/${id}/tags`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: 'not-an-array' }),
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('invalid_request')
  })

  // ── cache eviction ──────────────────────────────────────────────────────────

  it('POST /api/registry/unregister evicts the overview cache for the removed id (T-03-03-05)', async () => {
    const app = createApp({ registryFile })
    const id = await registerProject(app)

    // Populate cache with a fake overview entry
    const fakeOverview: ProjectOverview = {
      phaseStatus: 'Complete',
      stage1: null,
      stage2: null,
      dbAudit: null,
      tdd: null,
      verification: null,
      branch: 'main',
      markers: { gitRepo: true, planning: true, claudeSkills: false },
    }
    setCached(id, fakeOverview)
    expect(getCached(id)).not.toBeNull()

    // Unregister — should evict cache
    const res = await app.request('http://127.0.0.1:5193/api/registry/unregister', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    expect(res.status).toBe(204)
    expect(getCached(id)).toBeNull()
  })

  it('POST /api/registry/unregister evicts phaseCache entries for the removed id (T-04-03-07)', async () => {
    const app = createApp({ registryFile })
    const id = await registerProject(app)

    // Populate phaseCache with fake commitment + discipline entries for this project
    resetPhaseCache()
    setPhaseCache(`${id}:commitment`, { markdown: 'I commit.', sourceFile: 'obs.md' })
    setPhaseCache(`${id}:discipline`, { rationalization: { rows: [], skillInstalled: true } })
    expect(getPhaseCache(`${id}:commitment`)).not.toBeNull()
    expect(getPhaseCache(`${id}:discipline`)).not.toBeNull()

    // Unregister — should evict both overviewCache AND phaseCache entries
    const res = await app.request('http://127.0.0.1:5193/api/registry/unregister', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    expect(res.status).toBe(204)
    // phaseCache entries must be gone
    expect(getPhaseCache(`${id}:commitment`)).toBeNull()
    expect(getPhaseCache(`${id}:discipline`)).toBeNull()
  })
})
