import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createApp } from '../app.js'
import { setActiveToken, ensureAuthFile, getActiveToken } from '../../lib/auth.js'
import { makeTmpHome } from '../../lib/__fixtures__/tmpHome.js'
import { AGENT_VERSION } from '../../version.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('GET /health', () => {
  let cleanup: () => void
  let registryFile: string

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
  })

  afterEach(() => cleanup())

  it('returns 200 with valid HealthResponseSchema body', async () => {
    const app = createApp({ registryFile })
    const token = getActiveToken()
    const res = await app.request('http://127.0.0.1:5193/health', {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      ok: boolean
      version: string
      daemonVersion: string
      registryCount: number
      paired: boolean
    }
    expect(body.ok).toBe(true)
    expect(body.version).toBe(AGENT_VERSION)
    expect(body.daemonVersion).toBe(AGENT_VERSION)
    expect(typeof body.registryCount).toBe('number')
    expect(body.registryCount).toBeGreaterThanOrEqual(0)
    expect(body.paired).toBe(true)
  })

  it('returns 401 without bearer token', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/health', {})
    expect(res.status).toBe(401)
  })

  it('D-16 schema drift: outbound parse failure returns 500 schema_drift', async () => {
    const app = createApp({ registryFile })
    const token = getActiveToken()

    // Spy on HealthResponseSchema.parse to simulate an outbound drift failure
    const shared = await import('@agenticapps/dashboard-shared')
    const spy = vi.spyOn(shared.HealthResponseSchema, 'parse').mockImplementation(() => {
      throw new Error('simulated schema drift')
    })

    try {
      const res = await app.request('http://127.0.0.1:5193/health', {
        headers: authHeaders(token),
      })
      // The outbound() helper in errors.ts catches the parse failure and returns 500 schema_drift
      expect(res.status).toBe(500)
      const body = await res.json() as { ok: boolean; error: string; requestId: string }
      expect(body.ok).toBe(false)
      expect(body.error).toBe('schema_drift')
      expect(typeof body.requestId).toBe('string')
    } finally {
      spy.mockRestore()
    }
  })
})
