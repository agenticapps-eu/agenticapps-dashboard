/**
 * health.test.ts — GET /health
 *
 * Phase 13 Plan 01 Task 2 (RED2 then GREEN2): gitnexus composite field.
 *
 * Coverage:
 *   - returns 200 with valid HealthResponseSchema body ............... Test 1
 *   - returns 401 without bearer token .............................. Test 2
 *   - D-16 schema drift: outbound parse failure returns 500 ......... Test 3
 *   - D-13-11b canScan=true when loopback + binary installed ........ Test 4
 *   - D-13-11b canScan=false when tailscale (even binary installed) . Test 5
 *   - D-13-11b installed=false when detectGitNexusBinary=false ....... Test 6
 */
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile, getActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { AGENT_VERSION } from '../version.js'

// Mock detectGitNexusBinary for controllable test scenarios
vi.mock('../lib/scanners/gitNexusScanner.js', () => ({
  detectGitNexusBinary: vi.fn(),
  scanGitNexus: vi.fn(),
}))

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

describe('GET /health', () => {
  let cleanup: () => void
  let registryFile: string

  beforeEach(async () => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)

    // Reset all mocks before each test so they don't bleed between cases
    vi.resetAllMocks()

    // Default: binary is installed
    const { detectGitNexusBinary } = await import('../lib/scanners/gitNexusScanner.js')
    vi.mocked(detectGitNexusBinary).mockReturnValue(true)
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

  // Phase 13 D-13-11b tests

  it("D-13-11b: health includes gitnexus.canScan=true when loopback + binary installed", async () => {
    const { detectGitNexusBinary } = await import('../lib/scanners/gitNexusScanner.js')
    vi.mocked(detectGitNexusBinary).mockReturnValue(true)

    const app = createApp({ registryFile, bindMode: 'loopback' })
    const token = getActiveToken()
    const res = await app.request('http://127.0.0.1:5193/health', {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { gitnexus: { installed: boolean; canScan: boolean } }
    expect(body.gitnexus).toBeDefined()
    expect(body.gitnexus.installed).toBe(true)
    expect(body.gitnexus.canScan).toBe(true)
  })

  it("D-13-11b: health includes gitnexus.canScan=false when bound to tailscale (even with binary installed)", async () => {
    const { detectGitNexusBinary } = await import('../lib/scanners/gitNexusScanner.js')
    vi.mocked(detectGitNexusBinary).mockReturnValue(true)

    const app = createApp({ registryFile, bindMode: 'tailscale' })
    const token = getActiveToken()
    const res = await app.request('http://127.0.0.1:5193/health', {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { gitnexus: { installed: boolean; canScan: boolean } }
    expect(body.gitnexus).toBeDefined()
    expect(body.gitnexus.installed).toBe(true)
    expect(body.gitnexus.canScan).toBe(false)
  })

  it("D-13-11b: health includes gitnexus.installed=false when detectGitNexusBinary returns false", async () => {
    const { detectGitNexusBinary } = await import('../lib/scanners/gitNexusScanner.js')
    vi.mocked(detectGitNexusBinary).mockReturnValue(false)

    const app = createApp({ registryFile, bindMode: 'loopback' })
    const token = getActiveToken()
    const res = await app.request('http://127.0.0.1:5193/health', {
      headers: authHeaders(token),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { gitnexus: { installed: boolean; canScan: boolean } }
    expect(body.gitnexus).toBeDefined()
    expect(body.gitnexus.installed).toBe(false)
    expect(body.gitnexus.canScan).toBe(false)
  })
})
