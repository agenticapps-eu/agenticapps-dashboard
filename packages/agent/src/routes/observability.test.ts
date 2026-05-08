/**
 * Tests for GET /api/projects/:id/observability
 *
 * O1: 200 + valid ObservabilityResponseSchema (no detections — graceful empty state)
 * O2: 200 + sentry signals detected when .sentryclirc exists
 * O3: 401 without Authorization header
 * O4: 404 on unknown projectId
 * O5: CORS reject from non-allowed origin
 * O6: Schema round-trip via ObservabilityResponseSchema.parse
 */
import { join } from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock execa (used by detectSentryCliBinary) to avoid real subprocess
vi.mock('execa', () => ({
  execa: vi.fn().mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'not found' }),
}))

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { makePhase4Fixture } from '../lib/__fixtures__/phase4-fixture.js'
import { ObservabilityResponseSchema } from '@agenticapps/dashboard-shared'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('GET /api/projects/:id/observability', () => {
  let cleanupHome: () => void
  let cleanupFixture: () => void
  let token: string
  let registryFile: string
  let projectId: string

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

    // Register the project
    const app = createApp({ registryFile })
    const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fixture.root }),
    })
    const body = (await regRes.json()) as { id: string }
    projectId = body.id
  })

  afterEach(() => {
    vi.clearAllMocks()
    cleanupHome()
    cleanupFixture()
  })

  it('O1: 200 + valid ObservabilityResponseSchema for project with no detections', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observability`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    // Schema round-trip must not throw
    const parsed = ObservabilityResponseSchema.parse(data)
    expect(parsed.sentry.detected).toBe(false)
    expect(parsed.spotlight.detected).toBe(false)
    expect(parsed.sentryCli.detected).toBe(false)
  })

  it('O2: 200 + sentry signal when .sentryclirc exists', async () => {
    const fixture = makePhase4Fixture()
    // Override — re-register with a new fixture that has .sentryclirc
    const { writeFileSync } = await import('node:fs')
    const { join: joinPath } = await import('node:path')
    writeFileSync(joinPath(fixture.root, '.sentryclirc'), '[auth]\ntoken=x\n')

    const app = createApp({ registryFile })
    const regRes = await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: fixture.root }),
    })
    const regBody = (await regRes.json()) as { id: string }
    const newProjectId = regBody.id

    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${newProjectId}/observability`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    const parsed = ObservabilityResponseSchema.parse(data)
    expect(parsed.sentry.detected).toBe(true)
    expect(parsed.sentry.signals.some((s) => s.signal === 'sentryclirc')).toBe(true)
    fixture.cleanup()
  })

  it('O3: 401 without Authorization header', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observability`,
    )
    expect(res.status).toBe(401)
  })

  it('O4: 404 on unknown projectId', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/projects/nonexistent-id/observability',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(404)
  })

  it('O5: CORS reject from non-allowed origin on OPTIONS preflight', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observability`,
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

  it('O6: response passes ObservabilityResponseSchema.parse (schema drift guard)', async () => {
    const app = createApp({ registryFile })
    const res = await app.request(
      `http://127.0.0.1:5193/api/projects/${projectId}/observability`,
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(() => ObservabilityResponseSchema.parse(data)).not.toThrow()
  })
})
