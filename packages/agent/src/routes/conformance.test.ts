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

  it('Test 10: N concurrent cold-cache GETs invoke scanConformance exactly once (inflight dedup)', async () => {
    // RED: today's route does `cached ?? (await scanConformance())` with no
    // serialisation. On cold cache, N concurrent requests each see cached==null
    // and each invoke scanConformance. scanConformance fans out scanCoverage +
    // detectPathDrift + 90d series read — running it N times in parallel is the
    // pathology this test is built to prevent.
    //
    // Use ONE shared deferred so every mock invocation returns the SAME
    // pending promise. If we created a fresh promise per mock call, only the
    // last call's `resolveScan` ref would survive — earlier requests would
    // hang forever even after we resolve. Sharing the promise both lets us
    // measure invocation count cleanly AND mirrors what the inflight singleton
    // will do post-GREEN (one promise, N waiters).
    let resolveScan!: (v: ReturnType<typeof fakePayload>) => void
    const sharedScan = new Promise<ReturnType<typeof fakePayload>>((r) => {
      resolveScan = r
    })
    vi.mocked(scanConformance).mockImplementation(() => sharedScan)

    const app = createApp({ authFile })
    const N = 5
    const inflightRequests = Array.from({ length: N }, () =>
      app.request('http://127.0.0.1:5193/api/observability/conformance', {
        headers: authHeaders(token),
      }),
    )

    // Yield event-loop ticks so all N route handlers reach the
    // cache-miss → scan-call point. setImmediate twice — once for the
    // mock to run, once for awaits to settle. setTimeout(0) is a more
    // robust round-trip.
    await new Promise((r) => setTimeout(r, 0))

    resolveScan(fakePayload())
    const results = await Promise.all(inflightRequests)
    for (const res of results) expect(res.status).toBe(200)
    expect(scanConformance).toHaveBeenCalledTimes(1)
  })

  it('Test 11: failed scan does NOT cache failure — next call retries (inflight reset on reject)', async () => {
    // Regression guard for the inflight implementation: if the inflight
    // promise reference is stored without a `.finally(() => inflight = null)`
    // reset, a rejected scan would be returned to every future caller forever.
    // Verify rejection clears the inflight slot so the next call retries.
    vi.mocked(scanConformance)
      .mockRejectedValueOnce(new Error('first scan exploded'))
      .mockResolvedValueOnce(fakePayload())

    const app = createApp({ authFile })

    // First call: scan throws → route's outbound error path returns 500.
    const r1 = await app.request(
      'http://127.0.0.1:5193/api/observability/conformance',
      { headers: authHeaders(token) },
    )
    expect(r1.status).toBe(500)

    // Second call: inflight must have been cleared on rejection → fresh scan
    // runs and now succeeds.
    const r2 = await app.request(
      'http://127.0.0.1:5193/api/observability/conformance',
      { headers: authHeaders(token) },
    )
    expect(r2.status).toBe(200)
    expect(scanConformance).toHaveBeenCalledTimes(2)
  })

  it('Test 12: schema drift — malformed scanConformance return → 500 schema_drift', async () => {
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
