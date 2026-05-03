import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createApp } from '../app.js'
import { setActiveToken, ensureAuthFile, getActiveToken } from '../../lib/auth.js'
import { makeTmpHome, makeTmpProject } from '../../lib/__fixtures__/tmpHome.js'

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
})
