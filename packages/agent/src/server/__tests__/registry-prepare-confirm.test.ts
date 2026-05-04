/**
 * Tests for POST /api/registry/register-prepare and POST /api/registry/register-confirm.
 *
 * Covers plan 03-04 tasks 1 + 2: option C prepare/confirm flow (D-09..D-19).
 */
import { join } from 'node:path'
import { homedir } from 'node:os'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { createApp } from '../app.js'
import { setActiveToken, ensureAuthFile } from '../../lib/auth.js'
import { makeTmpHome, makeTmpProject } from '../../lib/__fixtures__/tmpHome.js'
import { _resetForTests as resetNonces } from '../../lib/registerNonces.js'
import { _resetForTests as resetRateLimiter } from '../../lib/rateLimiter.js'

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

function jsonHeaders(token: string) {
  return { ...authHeaders(token), 'Content-Type': 'application/json' }
}

describe('POST /api/registry/register-prepare', () => {
  let cleanup: () => void
  let projectCleanup: () => void
  let token: string
  let registryFile: string
  let projectRoot: string

  beforeEach(() => {
    resetNonces()
    resetRateLimiter()

    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token

    const proj = makeTmpProject()
    projectRoot = proj.root
    projectCleanup = proj.cleanup
  })

  afterEach(() => {
    cleanup()
    projectCleanup()
    vi.useRealTimers()
  })

  // ── allowed path ────────────────────────────────────────────────────────────

  it('returns 200 with nonce + canonical root for an allowed path', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/api/registry/register-prepare', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ path: projectRoot }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      canonicalRoot: string
      nonce: string
      expiresAt: number
      blocked: boolean
      alreadyRegistered: boolean
      suggestedName: string
      suggestedSlug: string
      detectedMarkers: { gitRepo: boolean; planning: boolean; claudeSkills: boolean }
    }
    expect(body.canonicalRoot).toBe(projectRoot)
    expect(body.blocked).toBe(false)
    expect(body.alreadyRegistered).toBe(false)
    expect(body.nonce).toMatch(/^[0-9a-f]{32}$/)
    expect(typeof body.expiresAt).toBe('number')
    expect(body.suggestedName).toBeTruthy()
    expect(body.suggestedSlug).toBeTruthy()
    expect(typeof body.detectedMarkers.gitRepo).toBe('boolean')
    expect(typeof body.detectedMarkers.planning).toBe('boolean')
    expect(typeof body.detectedMarkers.claudeSkills).toBe('boolean')
  })

  // ── blocked path ────────────────────────────────────────────────────────────

  it('returns 200 with blocked:true for ~/.ssh (D-11)', async () => {
    const app = createApp({ registryFile })
    const sshPath = join(homedir(), '.ssh')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await app.request('http://127.0.0.1:5193/api/registry/register-prepare', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ path: sshPath }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { blocked: boolean; blockedReason: string; canonicalRoot: string }
    expect(body.blocked).toBe(true)
    expect(body.blockedReason).toMatch(/credentials|secrets/)
    expect(typeof body.canonicalRoot).toBe('string')

    // D-15: logBlocked emits a BLOCKED log line
    expect(errSpy).toHaveBeenCalledOnce()
    expect(errSpy.mock.calls[0]?.[0]).toMatch(/\[agent\] BLOCKED register:/)

    errSpy.mockRestore()
  })

  // ── already registered ───────────────────────────────────────────────────────

  it('returns 200 with alreadyRegistered:true for a path already in the registry (D-17)', async () => {
    const app = createApp({ registryFile })

    // Register first via /register
    await app.request('http://127.0.0.1:5193/api/registry/register', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ path: projectRoot }),
    })

    // Prepare on the same path
    const res = await app.request('http://127.0.0.1:5193/api/registry/register-prepare', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ path: projectRoot }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { alreadyRegistered: boolean; existingEntry: { id: string } }
    expect(body.alreadyRegistered).toBe(true)
    expect(typeof body.existingEntry.id).toBe('string')
  })

  // ── rate limit ───────────────────────────────────────────────────────────────

  it('returns 429 on the 11th call within 10s (D-14)', async () => {
    const app = createApp({ registryFile })

    // Make 10 calls — all should not be 429
    for (let i = 0; i < 10; i++) {
      const r = await app.request('http://127.0.0.1:5193/api/registry/register-prepare', {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify({ path: projectRoot }),
      })
      expect(r.status).not.toBe(429)
    }

    // 11th call — must be 429 with Retry-After
    const res = await app.request('http://127.0.0.1:5193/api/registry/register-prepare', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ path: projectRoot }),
    })
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('1')
    const body = await res.json() as { ok: boolean; error: string }
    expect(body.error).toBe('rate_limited')
  })

  // ── validation ──────────────────────────────────────────────────────────────

  it('returns 422 for missing path field', async () => {
    const app = createApp({ registryFile })
    const res = await app.request('http://127.0.0.1:5193/api/registry/register-prepare', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })
})

describe('POST /api/registry/register-confirm', () => {
  let cleanup: () => void
  let projectCleanup: () => void
  let token: string
  let registryFile: string
  let projectRoot: string

  beforeEach(() => {
    resetNonces()
    resetRateLimiter()

    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    registryFile = join(tmp.configDir, 'registry.json')
    const authFile = join(tmp.configDir, 'auth.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
    token = fresh.token

    const proj = makeTmpProject()
    projectRoot = proj.root
    projectCleanup = proj.cleanup
  })

  afterEach(() => {
    cleanup()
    projectCleanup()
    vi.useRealTimers()
  })

  // ── happy path ───────────────────────────────────────────────────────────────

  it('returns 201 with RegistryEntry after valid prepare → confirm', async () => {
    const app = createApp({ registryFile })

    // Prepare
    const prepRes = await app.request('http://127.0.0.1:5193/api/registry/register-prepare', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ path: projectRoot }),
    })
    expect(prepRes.status).toBe(200)
    const prep = await prepRes.json() as { nonce: string }

    // Confirm with custom name + tags
    const confRes = await app.request('http://127.0.0.1:5193/api/registry/register-confirm', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ nonce: prep.nonce, name: 'My Project', tags: ['active'] }),
    })
    expect(confRes.status).toBe(201)
    const entry = await confRes.json() as {
      id: string
      name: string
      root: string
      tags: string[]
      alreadyRegistered: boolean
    }
    expect(entry.name).toBe('My Project')
    expect(entry.tags).toEqual(['active'])
    expect(entry.root).toBe(projectRoot)
    expect(entry.alreadyRegistered).toBe(false)
  })

  it('uses suggestedName from nonce when no name provided in confirm', async () => {
    const app = createApp({ registryFile })
    const { basename: bsName } = await import('node:path')

    const prepRes = await app.request('http://127.0.0.1:5193/api/registry/register-prepare', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ path: projectRoot }),
    })
    const prep = await prepRes.json() as { nonce: string }

    const confRes = await app.request('http://127.0.0.1:5193/api/registry/register-confirm', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ nonce: prep.nonce }),
    })
    expect(confRes.status).toBe(201)
    const entry = await confRes.json() as { name: string }
    expect(entry.name).toBe(bsName(projectRoot))
  })

  // ── forged nonce → 410 ───────────────────────────────────────────────────────

  it('returns 410 for a forged nonce never issued (D-18)', async () => {
    const app = createApp({ registryFile })
    const forged = 'a'.repeat(32) // valid hex format but not in store

    const res = await app.request('http://127.0.0.1:5193/api/registry/register-confirm', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ nonce: forged }),
    })
    expect(res.status).toBe(410)
    const body = await res.json() as { ok: boolean; error: string }
    expect(body.ok).toBe(false)
    expect(body.error).toBe('nonce_expired')
  })

  // ── expired nonce → 410 ──────────────────────────────────────────────────────

  it('returns 410 for an expired nonce (D-10 TTL + D-18)', async () => {
    const app = createApp({ registryFile })

    vi.useFakeTimers()

    const prepRes = await app.request('http://127.0.0.1:5193/api/registry/register-prepare', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ path: projectRoot }),
    })
    const prep = await prepRes.json() as { nonce: string }

    // Advance past 5-minute TTL
    vi.advanceTimersByTime(5 * 60 * 1000 + 1)

    const confRes = await app.request('http://127.0.0.1:5193/api/registry/register-confirm', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ nonce: prep.nonce }),
    })
    expect(confRes.status).toBe(410)
    const body = await confRes.json() as { error: string }
    expect(body.error).toBe('nonce_expired')

    vi.useRealTimers()
  })

  // ── second confirm with same nonce → 410 (single-use) ───────────────────────

  it('returns 410 on second confirm with the same nonce (D-10 single-use)', async () => {
    const app = createApp({ registryFile })

    const prepRes = await app.request('http://127.0.0.1:5193/api/registry/register-prepare', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ path: projectRoot }),
    })
    const prep = await prepRes.json() as { nonce: string }

    // First confirm — should succeed
    const first = await app.request('http://127.0.0.1:5193/api/registry/register-confirm', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ nonce: prep.nonce }),
    })
    expect(first.status).toBe(201)

    // Second confirm — nonce already consumed
    const second = await app.request('http://127.0.0.1:5193/api/registry/register-confirm', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ nonce: prep.nonce }),
    })
    expect(second.status).toBe(410)
    const body = await second.json() as { error: string }
    expect(body.error).toBe('nonce_expired')
  })

  // ── D-33: no BLOCKED log on successful confirm ────────────────────────────────

  it('does NOT emit a BLOCKED log on successful confirm (D-33)', async () => {
    const app = createApp({ registryFile })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const prepRes = await app.request('http://127.0.0.1:5193/api/registry/register-prepare', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ path: projectRoot }),
    })
    const prep = await prepRes.json() as { nonce: string }

    await app.request('http://127.0.0.1:5193/api/registry/register-confirm', {
      method: 'POST',
      headers: jsonHeaders(token),
      body: JSON.stringify({ nonce: prep.nonce }),
    })

    // No BLOCKED log emitted during a successful confirm
    const blockedCalls = errSpy.mock.calls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('BLOCKED register:'),
    )
    expect(blockedCalls).toHaveLength(0)

    errSpy.mockRestore()
  })
})
