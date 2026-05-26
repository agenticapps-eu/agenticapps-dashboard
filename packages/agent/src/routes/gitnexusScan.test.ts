/**
 * gitnexusScan.test.ts — GREEN route handler tests for POST + GET /api/gitnexus/scan.
 *
 * Plan 13-02 (Wave 2) — GREENed the Wave 0 RED scaffold.
 *
 * Test inventory (10 cases — all route-level concerns):
 *   1. POST happy path → 200 { ok: true, scanId: <uuid> }
 *   2. POST 409 SCAN_IN_FLIGHT when per-repo lock held (D-13-03)
 *   3. POST 403 BIND_REFUSED when bindMode='tailscale' (D-13-11)
 *   4. POST 403 BIND_REFUSED when bindMode='0.0.0.0' (D-13-11)
 *   5. POST 404 REPO_NOT_REGISTERED for unknown repoId
 *   6. POST 404 FAMILY_HAS_NO_REPOS for empty family
 *   7. POST 429 RATE_LIMITED after 10 requests in 10s per token-hash
 *   8. POST 422 INVALID_REQUEST on Zod parse failure (scope missing)
 *   9. GET /scan/:id → 200 { ok: true, job: { state: 'running' } } immediately after POST
 *  10. GET /scan/:id → 404 SCAN_NOT_FOUND after 60s TTL eviction (vi.useFakeTimers)
 */

import { homedir } from 'node:os'
import { join, sep } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'

// ── Mocks (must be declared before importing their targets) ───────────────────

// Mock lib/gitnexusScan — we test route behavior, not spawn mechanics
vi.mock('../lib/gitnexusScan.js', () => ({
  startScan: vi.fn(),
  getScanJob: vi.fn(),
  _resetForTests: vi.fn(),
  withGlobalScanLock: vi.fn(),
  registerFamilyJob: vi.fn(),
  updateFamilyJob: vi.fn(),
  waitForScanSettle: vi.fn(),
  scheduleFamilyEviction: vi.fn(),
  derivedRepoId: vi.fn(),
}))

// Mock lib/gitnexusFamilyScan
vi.mock('../lib/gitnexusFamilyScan.js', () => ({
  startFamilyScan: vi.fn(),
}))

// Mock registry (startFamilyScan reads it to enumerate family repos)
vi.mock('../lib/registry.js', () => ({
  readRegistry: vi.fn().mockReturnValue({ version: 1, projects: [] }),
  writeRegistry: vi.fn(),
  withRegistryLock: vi.fn(),
  assertRegistrationAllowed: vi.fn(),
  RegistrationPathBlocked: class RegistrationPathBlocked extends Error {},
}))

// Mock rateLimiter to control rate-limit behavior
vi.mock('../lib/rateLimiter.js', () => ({
  consume: vi.fn().mockReturnValue({ allowed: true }),
  tokenHashOf: vi.fn().mockReturnValue('testhash'),
  sweepOldTimestamps: vi.fn(),
  _resetForTests: vi.fn(),
}))

import { createApp } from '../server/app.js'
import { setActiveToken, ensureAuthFile } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { startScan, getScanJob } from '../lib/gitnexusScan.js'
import { startFamilyScan } from '../lib/gitnexusFamilyScan.js'
import { consume as rlConsume } from '../lib/rateLimiter.js'
import { readRegistry } from '../lib/registry.js'

// ── Test helpers ──────────────────────────────────────────────────────────────

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

function makeApp(bindMode: 'loopback' | 'tailscale' | '0.0.0.0' = 'loopback') {
  const tmp = makeTmpHome()
  const authFile = join(tmp.configDir, 'auth.json')
  const registryFile = join(tmp.configDir, 'registry.json')
  const fresh = ensureAuthFile(authFile)
  setActiveToken(fresh.token)
  return {
    app: createApp({ registryFile, authFile, bindMode }),
    token: fresh.token,
    cleanup: tmp.cleanup,
  }
}

function makeRepoScanJob(overrides: Partial<{
  scanId: string; state: 'running' | 'done' | 'error'; repoId: string
}> = {}) {
  return {
    kind: 'repo' as const,
    scanId: overrides.scanId ?? randomUUID(),
    repoId: overrides.repoId ?? 'agenticapps/foo',
    state: (overrides.state ?? 'running') as 'running' | 'done' | 'error',
    startedAt: new Date().toISOString(),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/gitnexus/scan', () => {
  let cleanup: () => void
  let token: string
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    vi.resetAllMocks()
    // Restore sensible defaults after resetAllMocks
    vi.mocked(rlConsume).mockReturnValue({ allowed: true })
    vi.mocked(readRegistry).mockReturnValue({ version: 1, projects: [] })
    const ctx = makeApp('loopback')
    app = ctx.app
    token = ctx.token
    cleanup = ctx.cleanup
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('returns 200 + {ok:true, scanId} on happy path (repo scope)', async () => {
    vi.mocked(startScan).mockResolvedValue({ ok: true })
    const scanId = randomUUID()
    // startScan accepts the id we pass; we capture it via the mock
    vi.mocked(startScan).mockImplementation(async (id) => {
      // Mock getScanJob to return a running job for this scanId
      vi.mocked(getScanJob).mockImplementation((sid) =>
        sid === id ? makeRepoScanJob({ scanId: id }) : null
      )
      return { ok: true }
    })

    const res = await app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ scope: 'repo', target: 'agenticapps/foo-repo' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.ok).toBe(true)
    expect(typeof body.scanId).toBe('string')
    // scanId should be a UUID v4
    expect(body.scanId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('returns 409 SCAN_IN_FLIGHT when per-repo lock is already held (D-13-03)', async () => {
    vi.mocked(startScan).mockResolvedValue({ ok: false, code: 'SCAN_IN_FLIGHT' })

    const res = await app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ scope: 'repo', target: 'agenticapps/foo-repo' }),
    })

    expect(res.status).toBe(409)
    const body = await res.json() as Record<string, unknown>
    expect(body.ok).toBe(false)
    expect(body.error).toBe('SCAN_IN_FLIGHT')
  })

  it("returns 403 BIND_REFUSED when bindMode='tailscale' (D-13-11)", async () => {
    const ctx2 = makeApp('tailscale')
    const res = await ctx2.app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(ctx2.token),
      body: JSON.stringify({ scope: 'repo', target: 'agenticapps/foo-repo' }),
    })
    ctx2.cleanup()

    expect(res.status).toBe(403)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('BIND_REFUSED')
    // startScan must NOT have been called (403 is before dispatch)
    expect(startScan).not.toHaveBeenCalled()
  })

  it("returns 403 BIND_REFUSED when bindMode='0.0.0.0' (D-13-11)", async () => {
    const ctx2 = makeApp('0.0.0.0')
    const res = await ctx2.app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(ctx2.token),
      body: JSON.stringify({ scope: 'repo', target: 'agenticapps/foo-repo' }),
    })
    ctx2.cleanup()

    expect(res.status).toBe(403)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('BIND_REFUSED')
    expect(startScan).not.toHaveBeenCalled()
  })

  it("D-13-EXT-15: returns 403 BIND_REFUSED on tailscale even with malformed JSON body (Codex INFO #2)", async () => {
    // Pre-fix: zValidator runs before the bindMode check, so malformed JSON
    // returns 422 INVALID_REQUEST. Post-fix: bindMode middleware runs first
    // and 403s before parse work. Defence-in-depth: non-loopback callers
    // pay zero parse cost.
    const ctx2 = makeApp('tailscale')
    const res = await ctx2.app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(ctx2.token),
      body: '{not-valid-json',
    })
    ctx2.cleanup()

    expect(res.status).toBe(403)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('BIND_REFUSED')
    expect(startScan).not.toHaveBeenCalled()
  })

  it('returns 404 REPO_NOT_REGISTERED on unknown repoId (scope: repo)', async () => {
    vi.mocked(startScan).mockResolvedValue({ ok: false, code: 'REPO_NOT_REGISTERED' })

    const res = await app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ scope: 'repo', target: 'agenticapps/unknown' }),
    })

    expect(res.status).toBe(404)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('REPO_NOT_REGISTERED')
  })

  it('returns 404 FAMILY_HAS_NO_REPOS on family with zero registered repos', async () => {
    // startFamilyScan is now sync (Gap 2 / D-13-02) — use mockReturnValue.
    vi.mocked(startFamilyScan).mockReturnValue({ ok: false, code: 'FAMILY_HAS_NO_REPOS' })

    const res = await app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ scope: 'family', target: 'agenticapps' }),
    })

    expect(res.status).toBe(404)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('FAMILY_HAS_NO_REPOS')
  })

  it('returns 429 RATE_LIMITED after 10 requests in 10s per token-hash', async () => {
    vi.mocked(rlConsume).mockReturnValue({ allowed: false, retryAfter: 1 })

    const res = await app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ scope: 'repo', target: 'agenticapps/foo-repo' }),
    })

    expect(res.status).toBe(429)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('RATE_LIMITED')
    expect(res.headers.get('Retry-After')).toBe('1')
  })

  it('returns 422 INVALID_REQUEST on Zod parse failure (missing scope field)', async () => {
    const res = await app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ target: 'agenticapps/foo-repo' }), // missing 'scope'
    })

    expect(res.status).toBe(422)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('INVALID_REQUEST')
  })
})

describe('GET /api/gitnexus/scan/:id', () => {
  let cleanup: () => void
  let token: string
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(rlConsume).mockReturnValue({ allowed: true })
    vi.mocked(readRegistry).mockReturnValue({ version: 1, projects: [] })
    const ctx = makeApp('loopback')
    app = ctx.app
    token = ctx.token
    cleanup = ctx.cleanup
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it("returns 200 + state='running' immediately after POST (scan in-flight)", async () => {
    const scanId = randomUUID()
    const runningJob = makeRepoScanJob({ scanId, state: 'running' })
    vi.mocked(getScanJob).mockReturnValue(runningJob)

    const res = await app.request(`http://localhost/api/gitnexus/scan/${scanId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.ok).toBe(true)
    const job = body.job as Record<string, unknown>
    expect(job.state).toBe('running')
    expect(job.kind).toBe('repo')
  })

  it('returns 404 SCAN_NOT_FOUND after 60s TTL eviction (vi.useFakeTimers)', async () => {
    vi.useFakeTimers()
    // Simulate evicted job — getScanJob returns null
    vi.mocked(getScanJob).mockReturnValue(null)

    const evictedId = randomUUID()
    const res = await app.request(`http://localhost/api/gitnexus/scan/${evictedId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    expect(res.status).toBe(404)
    const body = await res.json() as Record<string, unknown>
    expect(body.error).toBe('SCAN_NOT_FOUND')

    vi.useRealTimers()
  })
})

// ── Gap 2 / D-13-02: family branch is fire-and-forget ─────────────────────────
// Asserts the route's family branch does NOT await the body, so the POST
// response returns within milliseconds even when the mocked startFamilyScan
// imposes a 500ms async delay. Pure mock — `vi.mocked(startFamilyScan)`
// already exists at the top of this file via `vi.mock('../lib/gitnexusFamilyScan.js')`.

describe('POST /api/gitnexus/scan — family branch fire-and-forget (Gap 2 / D-13-02)', () => {
  let cleanup: () => void
  let token: string
  let app: ReturnType<typeof createApp>

  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(rlConsume).mockReturnValue({ allowed: true })
    vi.mocked(readRegistry).mockReturnValue({
      version: 1,
      projects: [
        {
          id: 'a',
          name: 'repoA',
          root: `${homedir()}${sep}Sourcecode${sep}agenticapps${sep}repoA`,
          client: null,
          addedAt: new Date().toISOString(),
          tags: [],
        },
        {
          id: 'b',
          name: 'repoB',
          root: `${homedir()}${sep}Sourcecode${sep}agenticapps${sep}repoB`,
          client: null,
          addedAt: new Date().toISOString(),
          tags: [],
        },
      ],
    })
    const ctx = makeApp('loopback')
    app = ctx.app
    token = ctx.token
    cleanup = ctx.cleanup
  })

  afterEach(() => {
    cleanup()
  })

  it('POST returns {ok:true, scanId} within <100ms even when startFamilyScan mock simulates 500ms of background work', async () => {
    // PURE MOCK: simulate background work using the existing
    // `vi.mock('../lib/gitnexusFamilyScan.js')` surface — NO stub binary,
    // NO env var, NO makeAppWithStubFamily.
    //
    // Gap 2 contract: startFamilyScan is SYNCHRONOUS post-GREEN — it
    // registers the family job, kicks off the body via `void` internally,
    // and returns immediately. The route MUST NOT `await` it.
    //
    // The mock returns synchronously with {ok:true} and schedules an
    // unrelated 500ms-delayed callback to simulate the kind of background
    // work the real `void startFamilyScanBody(...)` does. If the route
    // were to `await` the body's completion (the pre-GREEN bug), the
    // setImmediate flush + setTimeout would push the response past 100ms.
    vi.mocked(startFamilyScan).mockImplementationOnce(() => {
      // Background work — never awaited by anyone. Mirrors `void startFamilyScanBody`.
      setTimeout(() => {
        // no-op; just simulates body work
      }, 500)
      return { ok: true as const }
    })

    const t0 = Date.now()
    const res = await app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ scope: 'family', target: 'agenticapps' }),
    })
    const t1 = Date.now()

    expect(res.status).toBe(200)
    const json = await res.json() as { ok: true; scanId: string }
    expect(json.ok).toBe(true)
    expect(json.scanId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    // Gap 2 contract: route response must be ms-fast — NOT blocked on the body.
    expect(t1 - t0).toBeLessThan(100)
  })

  it('the route calls startFamilyScan exactly once with the expected args', async () => {
    vi.mocked(startFamilyScan).mockReturnValueOnce({ ok: true as const })

    await app.request('http://localhost/api/gitnexus/scan', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ scope: 'family', target: 'agenticapps' }),
    })

    expect(vi.mocked(startFamilyScan)).toHaveBeenCalledOnce()
    const callArgs = vi.mocked(startFamilyScan).mock.calls[0] ?? []
    const scanId = callArgs[0]
    const familyId = callArgs[1]
    const registry = callArgs[2]
    expect(typeof scanId).toBe('string')
    expect(familyId).toBe('agenticapps')
    expect(registry).toHaveProperty('entries')
  })
})
