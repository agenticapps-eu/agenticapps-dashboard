import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { HealthResponseSchema } from '@agenticapps/dashboard-shared'
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
