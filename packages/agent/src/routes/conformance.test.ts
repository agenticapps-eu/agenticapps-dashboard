/**
 * conformance.test.ts — GET /api/observability/conformance route.
 *
 * Plan 12-02 Task 4 (RED first).
 *
 * Covers:
 *   - Bearer-auth (401 without token)
 *   - 200 + ConformanceResponseSchema-shaped JSON with token
 *   - 30s cache short-circuit (second call within TTL does not re-scan)
 *   - Cache miss after TTL: third call after 31s re-scans
 *   - CORS preflight returns headers for PROD_ORIGIN + DEV_ORIGIN
 *   - Schema drift surfaces as 500 (outbound() wrapper)
 */
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { ConformanceResponseSchema } from '@agenticapps/dashboard-shared'

// Mock conformanceScan so we can count call invocations + override behaviour.
vi.mock('../lib/conformanceScan.js', () => ({
  scanConformance: vi.fn(),
}))

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { scanConformance } from '../lib/conformanceScan.js'
import {
  setConformanceCache,
  _resetConformanceCacheForTests,
} from '../lib/conformanceCache.js'
import { DEV_ORIGIN, PROD_ORIGIN } from '../constants.js'

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

function fakePayload() {
  return {
    schemaVersion: 1 as const,
    today: {
      asOf: '2026-05-19T12:00:00.000Z',
      fleet: 90,
      agenticapps: 90,
      factiv: 90,
      neuroflash: 90,
    },
    delta14d: { fleet: 0, agenticapps: 0, factiv: 0, neuroflash: 0 },
    series: [],
    drifted: [],
  }
}

describe('GET /api/observability/conformance', () => {
  let cleanupHome: () => void
  let authFile: string
  let token: string

  beforeEach(() => {
    vi.clearAllMocks()
    _resetConformanceCacheForTests()

    const tmp = makeTmpHome()
    cleanupHome = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token

    vi.mocked(scanConformance).mockResolvedValue(fakePayload())
  })

  afterEach(() => {
    cleanupHome()
    _resetConformanceCacheForTests()
  })

  it('Test 1: GET without bearer token returns 401', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/observability/conformance',
    )
    expect(res.status).toBe(401)
  })

  it('Test 2: GET with valid bearer returns 200 + ConformanceResponse-shaped JSON', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/observability/conformance',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(() => ConformanceResponseSchema.parse(body)).not.toThrow()
  })

  it('Test 3: response parses ConformanceResponseSchema.strict() successfully', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/observability/conformance',
      { headers: authHeaders(token) },
    )
    const body = (await res.json()) as Record<string, unknown>
    // strict() — no extra keys allowed; the route MUST round-trip the payload
    // through ConformanceResponseSchema.parse via outbound().
    expect(() => ConformanceResponseSchema.parse(body)).not.toThrow()
    expect(body.schemaVersion).toBe(1)
  })

  it('Test 4: 30s cache — second call within TTL does NOT re-scan', async () => {
    const app = createApp({ authFile })
    await app.request('http://127.0.0.1:5193/api/observability/conformance', {
      headers: authHeaders(token),
    })
    await app.request('http://127.0.0.1:5193/api/observability/conformance', {
      headers: authHeaders(token),
    })
    expect(scanConformance).toHaveBeenCalledTimes(1)
  })

  it('Test 5: cache miss after TTL — third call after 31s re-scans', async () => {
    const app = createApp({ authFile })

    // Pre-populate cache with a synthetic expiresAt in the past so the next
    // call sees a stale entry and re-scans. We avoid timer mocking — the
    // cache module exposes setConformanceCache(value, now) so we can place
    // a value whose expiresAt has already elapsed.
    setConformanceCache(fakePayload(), Date.now() - 31_000)

    await app.request('http://127.0.0.1:5193/api/observability/conformance', {
      headers: authHeaders(token),
    })
    expect(scanConformance).toHaveBeenCalledTimes(1)
  })

  it('Test 6: CORS — missing Origin header still allowed (no preflight required for same-host)', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/observability/conformance',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(200)
  })

  it('Test 7: CORS preflight returns access-control headers for PROD_ORIGIN', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/observability/conformance',
      {
        method: 'OPTIONS',
        headers: {
          Origin: PROD_ORIGIN,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization',
        },
      },
    )
    // Allow-Origin echoed (CORS middleware lockdown).
    expect(res.headers.get('access-control-allow-origin')).toBe(PROD_ORIGIN)
  })

  it('Test 8: CORS preflight returns access-control headers for DEV_ORIGIN', async () => {
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/observability/conformance',
      {
        method: 'OPTIONS',
        headers: {
          Origin: DEV_ORIGIN,
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization',
        },
      },
    )
    expect(res.headers.get('access-control-allow-origin')).toBe(DEV_ORIGIN)
  })

  it('Test 9: schema drift — malformed scanConformance return → 500 schema_drift', async () => {
    // Return a payload that does NOT satisfy the strict schema (extra key).
    vi.mocked(scanConformance).mockResolvedValue({
      ...fakePayload(),
      // @ts-expect-error — intentional drift for the test
      extraneousKey: 'should be rejected by strict()',
    })
    const app = createApp({ authFile })
    const res = await app.request(
      'http://127.0.0.1:5193/api/observability/conformance',
      { headers: authHeaders(token) },
    )
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('schema_drift')
  })
})
