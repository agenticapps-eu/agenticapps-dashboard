import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { HealthResponseSchema, RegisterPrepareResponseSchema, RegisterConfirmResponseSchema } from '@agenticapps/dashboard-shared'

import { ApiError, apiFetch, parseOrDrift } from './api.js'

vi.mock('./pairing.js', () => ({
  getPairing: vi.fn(),
}))

const VALID_TOKEN = 'aabbccdd-11223344-aabbccdd-11223344-aabbccdd-11223344-aabbccdd-11223344'
const VALID_PAIRING = {
  agentUrl: 'http://127.0.0.1:5193',
  token: VALID_TOKEN,
  pairedAt: '2026-01-01T00:00:00.000Z',
}

import { getPairing } from './pairing.js'
const mockGetPairing = vi.mocked(getPairing)

describe('apiFetch', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch')
    mockGetPairing.mockReturnValue(VALID_PAIRING)
  })

  afterEach(() => {
    fetchSpy.mockRestore()
    vi.clearAllMocks()
  })

  it('injects Authorization: Bearer header from getPairing()', async () => {
    fetchSpy.mockResolvedValue(
      new Response('{"ok":true,"version":"1.0.0"}', { status: 200 }),
    )
    await apiFetch('/health', HealthResponseSchema)
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit & { headers: Headers }]
    expect(url).toBe('http://127.0.0.1:5193/health')
    expect(init.headers).toBeInstanceOf(Headers)
    expect((init.headers as Headers).get('Authorization')).toBe(`Bearer ${VALID_TOKEN}`)
  })

  it('401 throws ApiError(401) with requestId from ErrorResponseSchema body', async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: 'unauthorized', requestId: 'req-123' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await expect(apiFetch('/health', HealthResponseSchema)).rejects.toMatchObject({
      status: 401,
      requestId: 'req-123',
    })
    await expect(apiFetch('/health', HealthResponseSchema)).rejects.toBeInstanceOf(ApiError)
  })

  it('TypeError network failure propagates (NOT wrapped in ApiError)', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(apiFetch('/health', HealthResponseSchema)).rejects.toBeInstanceOf(TypeError)
    await expect(apiFetch('/health', HealthResponseSchema)).rejects.not.toBeInstanceOf(ApiError)
  })

  it('200 with valid HealthResponseSchema body returns { ok: true, data }', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, version: '1.0', daemonVersion: '1.0', registryCount: 0, paired: true }),
        { status: 200 },
      ),
    )
    const result = await apiFetch('/health', HealthResponseSchema)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.ok).toBe(true)
    }
  })

  it('unpaired (getPairing returns null) throws ApiError(401)', async () => {
    mockGetPairing.mockReturnValue(null)
    await expect(apiFetch('/health', HealthResponseSchema)).rejects.toBeInstanceOf(ApiError)
    await expect(apiFetch('/health', HealthResponseSchema)).rejects.toMatchObject({
      status: 401,
      requestId: undefined,
      message: 'unpaired',
    })
  })

  it('trailing-slash agent URL is normalized', async () => {
    mockGetPairing.mockReturnValue({ ...VALID_PAIRING, agentUrl: 'http://127.0.0.1:5193/' })
    fetchSpy.mockResolvedValue(
      new Response('{"ok":true,"version":"1.0"}', { status: 200 }),
    )
    await apiFetch('/health', HealthResponseSchema)
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:5193/health')
  })

  it('non-401 non-ok response throws ApiError with the HTTP status', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    )
    await expect(apiFetch('/health', HealthResponseSchema)).rejects.toMatchObject({
      status: 500,
    })
    await expect(apiFetch('/health', HealthResponseSchema)).rejects.toBeInstanceOf(ApiError)
  })

  // ── Testing #6 — apiFetch body parsing pins the daemon-supplied error code ───
  //
  // Strengthens the P9-* parameterised tests in PathDriftPanel.test.tsx:
  // those tests verify the FINAL toast text after the code propagates
  // through extractErrorCode → errorCodeToMessage. This test verifies the
  // code arrives at the boundary in the first place — apiFetch reads the
  // 422 body and lifts `error` onto ApiError.code. Without this, a
  // regression that silently drops `code` would only be caught by the
  // toast-text suite (slower + indirect).
  it('Testing #6 [apiFetch body parse]: 422 ErrorResponseSchema body propagates code + requestId onto ApiError', async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, error: 'newPath_blocked', requestId: 'req-xyz' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    let captured: ApiError | undefined
    try {
      await apiFetch('/health', HealthResponseSchema)
    } catch (err) {
      if (err instanceof ApiError) captured = err
    }
    expect(captured).toBeInstanceOf(ApiError)
    expect(captured?.status).toBe(422)
    expect(captured?.code).toBe('newPath_blocked')
    expect(captured?.requestId).toBe('req-xyz')
  })

  it('Testing #6 [apiFetch body parse]: non-JSON 422 body yields ApiError with code=undefined', async () => {
    // Defensive — when the daemon hands back garbage instead of JSON we must
    // still surface the HTTP status, with code undefined. The PathDriftPanel
    // mapper falls back to "Fix failed" in this case (errorCodeToMessage
    // default branch); we pin that the boundary still throws cleanly.
    fetchSpy.mockResolvedValue(
      new Response('totally not json', {
        status: 422,
        headers: { 'Content-Type': 'text/plain' },
      }),
    )
    let captured: ApiError | undefined
    try {
      await apiFetch('/health', HealthResponseSchema)
    } catch (err) {
      if (err instanceof ApiError) captured = err
    }
    expect(captured).toBeInstanceOf(ApiError)
    expect(captured?.status).toBe(422)
    expect(captured?.code).toBeUndefined()
  })

  // D-12: SPA must never call /api/registry/register directly (CLI-only route)
  it('D-12: apiFetch throws hard error for /api/registry/register before any fetch', async () => {
    await expect(apiFetch('/api/registry/register', z.object({}))).rejects.toThrow(/CLI-only/)
    // Guard must fire before fetch — fetch should never be called
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('D-12: apiFetch on /api/registry/register-prepare does NOT throw the D-12 guard error', async () => {
    const prepareShape = {
      canonicalRoot: '/home/user/project',
      suggestedName: 'project',
      suggestedSlug: 'project',
      alreadyRegistered: false,
      blocked: false,
      detectedMarkers: { gitRepo: true, planning: true, claudeSkills: false },
      nonce: 'aabbccddeeff00112233445566778899',
      expiresAt: Date.now() + 300_000,
    }
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(prepareShape), { status: 200 }),
    )
    // Should not throw a D-12 guard error — may throw other errors on schema parse but not the guard
    const resultPromise = apiFetch('/api/registry/register-prepare', RegisterPrepareResponseSchema, {
      method: 'POST',
      body: JSON.stringify({ path: '/home/user/project' }),
    })
    await expect(resultPromise).resolves.toBeDefined()
  })

  it('D-12: apiFetch on /api/registry/register-confirm does NOT throw the D-12 guard error', async () => {
    const confirmShape = {
      id: 'proj-001',
      name: 'project',
      root: '/home/user/project',
      client: null,
      addedAt: '2026-05-04T00:00:00.000Z',
      tags: [],
      alreadyRegistered: false,
    }
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(confirmShape), { status: 201 }),
    )
    const resultPromise = apiFetch('/api/registry/register-confirm', RegisterConfirmResponseSchema, {
      method: 'POST',
      body: JSON.stringify({ nonce: 'aabbccddeeff00112233445566778899' }),
    })
    await expect(resultPromise).resolves.toBeDefined()
  })
})

describe('parseOrDrift', () => {
  it('returns { ok: false, drift } on Zod failure with first issue path/expected/got', () => {
    const result = parseOrDrift(HealthResponseSchema, { wrong: true })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.drift.path.length).toBeGreaterThan(0)
      expect(result.drift.expected.length).toBeGreaterThan(0)
      expect(Array.isArray(result.drift.issues)).toBe(true)
    }
  })

  it('logs full issue tree to console.error (D-08)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    parseOrDrift(HealthResponseSchema, { wrong: true })
    expect(consoleSpy).toHaveBeenCalledWith('[schema-drift]', expect.any(Array))
    consoleSpy.mockRestore()
  })

  it('returns { ok: true, data } on valid input', () => {
    const result = parseOrDrift(HealthResponseSchema, { ok: true, version: '1.0.0' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.version).toBe('1.0.0')
    }
  })
})
