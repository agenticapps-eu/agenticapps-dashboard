/**
 * Tests for GET /api/projects/:id/secrets
 *
 * S1: 200 + state:absent when .infisical.json missing
 * S2: 200 + state:present-valid when .infisical.json has workspaceId
 * S3: 200 + state:present-invalid when .infisical.json is malformed
 * S4: 401 without Authorization header
 * S5: 404 on unknown projectId
 * S6: CORS reject from non-allowed origin
 * S7: Schema round-trip via SecretsResponseSchema.parse
 */
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock execa to avoid real subprocess
vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({ exitCode: 1, stdout: '', stderr: '' }),
}))

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { makePhase4Fixture } from '../lib/__fixtures__/phase4-fixture.js'
import { SecretsResponseSchema } from '@agenticapps/dashboard-shared'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('GET /api/projects/:id/secrets', () => {
  let cleanupHome: () => void
  let cleanupFixture: () => void
  let token: string
  let registryFile: string
  let projectId: string
  let projectRoot: string

  beforeEach(async () => {
    vi.clearAllMocks()

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

    // Register
    const app = createApp({ registryFile })
    const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: projectRoot }),
    })
    const body = (await regRes.json()) as { id: string }
    projectId = body.id
  })

  afterEach(() => {
    vi.clearAllMocks()
    cleanupHome()
    cleanupFixture()
  })

  it('S1: 200 + state:absent when .infisical.json missing', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/secrets`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    const parsed = SecretsResponseSchema.parse(data)
    expect(parsed.state).toBe('absent')
  })

  it('S2: 200 + state:present-valid when .infisical.json has workspaceId', async () => {
    writeFileSync(
      join(projectRoot, '.infisical.json'),
      JSON.stringify({ workspaceId: 'ws-test-123', defaultEnvironment: 'dev' }),
    )
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/secrets`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    const parsed = SecretsResponseSchema.parse(data)
    expect(parsed.state).toBe('present-valid')
    if (parsed.state === 'present-valid') {
      expect(parsed.workspaceId).toBe('ws-test-123')
    }
  })

  it('S3: 200 + state:present-invalid when .infisical.json is malformed', async () => {
    writeFileSync(join(projectRoot, '.infisical.json'), '{ bad json }')
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/secrets`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    const parsed = SecretsResponseSchema.parse(data)
    expect(parsed.state).toBe('present-invalid')
  })

  it('S4: 401 without Authorization header', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/secrets`,
    )
    expect(res.status).toBe(401)
  })

  it('S5: 404 on unknown projectId', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/projects/nonexistent-id/secrets',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(404)
  })

  it('S6: CORS reject from non-allowed origin on OPTIONS preflight', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/secrets`,
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil.example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization',
        },
      },
    )
    const allowOrigin = res.headers.get('Access-Control-Allow-Origin')
    expect(allowOrigin).not.toBe('https://evil.example.com')
  })

  it('S7: response passes SecretsResponseSchema.parse (schema drift guard)', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/secrets`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(() => SecretsResponseSchema.parse(data)).not.toThrow()
  })
})
