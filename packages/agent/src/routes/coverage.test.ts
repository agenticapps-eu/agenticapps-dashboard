import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoverageResponseSchema } from '@agenticapps/dashboard-shared'

vi.mock('../lib/coverageScan.js', () => ({
  scanCoverage: vi.fn(),
  scanCoverageInternal: vi.fn(),
}))

import { createApp } from '../server/app.js'
import { ensureAuthFile, setActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { _resetCoverageCacheForTests } from '../lib/coverageCache.js'
import { scanCoverage } from '../lib/coverageScan.js'

describe('coverage routes after integration removal', () => {
  let cleanup: () => void
  let token: string
  let authFile: string

  beforeEach(() => {
    vi.clearAllMocks()
    _resetCoverageCacheForTests()
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    token = ensureAuthFile(authFile).token
    setActiveToken(token)
    vi.mocked(scanCoverage).mockResolvedValue({
      schemaVersion: 2,
      generatedAtIso: '2026-07-28T00:00:00.000Z',
      workflowHeadVersion: '3.0.0',
      rows: [
        {
          family: 'agenticapps',
          repo: 'dashboard',
          claudeMd: { kind: 'basic', state: 'fresh' },
          workflowVersion: {
            kind: 'workflow',
            state: 'fresh',
            installedVersion: '3.0.0',
            headVersion: '3.0.0',
          },
          understand: { kind: 'basic', state: 'missing' },
          overrideCount: 0,
          overrides: [],
        },
      ],
    })
  })

  afterEach(() => cleanup())

  it('returns the strict version-2 coverage response', async () => {
    const app = createApp({ authFile })
    const response = await app.request('http://127.0.0.1/api/coverage', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(CoverageResponseSchema.safeParse(body).success).toBe(true)
    expect(body).not.toHaveProperty('gitNexusInstallState')
    expect((body as { rows: unknown[] }).rows[0]).not.toHaveProperty('gitNexus')
    expect((body as { rows: unknown[] }).rows[0]).not.toHaveProperty('wiki')
  })

  it('requires bearer authentication', async () => {
    const app = createApp({ authFile })
    const response = await app.request('http://127.0.0.1/api/coverage')

    expect(response.status).toBe(401)
  })

  it('uses the coverage cache within its TTL', async () => {
    const app = createApp({ authFile })
    const headers = { Authorization: `Bearer ${token}` }

    await app.request('http://127.0.0.1/api/coverage', { headers })
    await app.request('http://127.0.0.1/api/coverage', { headers })

    expect(scanCoverage).toHaveBeenCalledTimes(1)
  })

  it('never exposes an internal absPath', async () => {
    const app = createApp({ authFile })
    const response = await app.request('http://127.0.0.1/api/coverage', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(200)
    expect(await response.text()).not.toContain('absPath')
  })

  it('returns schema_drift when the scanner returns a malformed payload', async () => {
    vi.mocked(scanCoverage).mockResolvedValueOnce({
      schemaVersion: 3,
    } as unknown as Awaited<ReturnType<typeof scanCoverage>>)
    const app = createApp({ authFile })
    const response = await app.request('http://127.0.0.1/api/coverage', {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ ok: false, error: 'schema_drift' })
  })

  it.each([
    ['POST', '/api/coverage/refresh'],
    ['POST', '/api/gitnexus/scan'],
    ['GET', '/api/gitnexus/scan/old-job'],
  ] as const)('returns not-found for removed %s route %s', async (method, path) => {
    const app = createApp({ authFile })
    const response = await app.request(`http://127.0.0.1${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(response.status).toBe(404)
  })
})
