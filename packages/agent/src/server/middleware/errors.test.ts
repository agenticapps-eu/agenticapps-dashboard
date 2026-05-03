import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createApp } from '../app.js'
import { setActiveToken, ensureAuthFile, getActiveToken } from '../../lib/auth.js'
import { makeTmpHome } from '../../lib/__fixtures__/tmpHome.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('errorHandler — internal state corruption', () => {
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

  it('corrupt registry.json on disk surfaces as 500 schema_drift, not 422 invalid_request', async () => {
    // Write structurally-valid JSON that fails the RegistryFileSchema (version is a string)
    writeFileSync(
      registryFile,
      JSON.stringify({ version: 'not-a-number', projects: [] }, null, 2),
      { mode: 0o600 },
    )

    const app = createApp({ registryFile })
    const token = getActiveToken()
    const res = await app.request('http://127.0.0.1:5193/api/registry', {
      headers: authHeaders(token),
    })

    expect(res.status).toBe(500)
    const body = (await res.json()) as { ok: boolean; error: string; requestId: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('schema_drift')
    expect(typeof body.requestId).toBe('string')
  })

  it('client-supplied invalid request body still returns 422 invalid_request', async () => {
    const app = createApp({ registryFile })
    const token = getActiveToken()
    // POST /api/registry/register requires { path: string }; send wrong shape
    const res = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ wrongField: 123 }),
    })

    expect(res.status).toBe(422)
    const body = (await res.json()) as { ok: boolean; error: string }
    expect(body.error).toBe('invalid_request')
  })
})
