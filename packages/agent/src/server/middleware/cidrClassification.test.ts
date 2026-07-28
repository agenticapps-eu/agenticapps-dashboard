/**
 * Refusal classification — the RED tests for decide-tailnet-ipv6-policy task 2.
 *
 * The daemon collapses three distinct admission failures into one
 * undifferentiated refusal today: an unsupported address family, an IPv4
 * address outside the accepted range, and socket peer data that is missing or
 * unparseable. An operator cannot tell malformed socket state from an
 * intentional policy refusal.
 *
 * These tests require the three to be distinguishable in the daemon's OWN
 * diagnostics while remaining completely invisible over HTTP — including to
 * authenticated callers, so that neither a rejected client nor a paired peer
 * can probe which rule refused a request.
 */
import { join } from 'node:path'

import { Hono } from 'hono'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { HttpBindings } from '@hono/node-server'

import { createApp } from '../app.js'
import { ensureAuthFile, getActiveToken, setActiveToken } from '../../lib/auth.js'
import { makeTmpHome } from '../../lib/__fixtures__/tmpHome.js'

import { classifyAddress, cidrMiddleware, type AdmissionClass } from './cidr.js'

describe('classifyAddress', () => {
  it('accepts a CGNAT address in either presentation', () => {
    expect(classifyAddress('100.64.5.5')).toBe<AdmissionClass>('accepted')
    expect(classifyAddress('::ffff:100.64.5.5')).toBe<AdmissionClass>('accepted')
  })

  it('classifies a raw IPv6 address as unsupported-family', () => {
    expect(classifyAddress('fd7a:115c:a1e0::1')).toBe<AdmissionClass>('unsupported-family')
    expect(classifyAddress('2001:4860:4860::8888')).toBe<AdmissionClass>('unsupported-family')
  })

  it('classifies an out-of-range IPv4 address as outside-range', () => {
    expect(classifyAddress('8.8.8.8')).toBe<AdmissionClass>('outside-range')
    expect(classifyAddress('192.168.1.5')).toBe<AdmissionClass>('outside-range')
  })

  // The specific test that catches an accidental widening through the mapping
  // strip: normalisation must happen BEFORE range classification, so a mapped
  // non-CGNAT address is a range failure and not a family failure.
  it('normalises IPv6-mapped IPv4 before classifying, so ::ffff:8.8.8.8 is outside-range', () => {
    expect(classifyAddress('::ffff:8.8.8.8')).toBe<AdmissionClass>('outside-range')
    expect(classifyAddress('::ffff:8.8.8.8')).not.toBe<AdmissionClass>('unsupported-family')
  })

  it('classifies missing or unparseable peer data as address-unavailable', () => {
    expect(classifyAddress('')).toBe<AdmissionClass>('address-unavailable')
    expect(classifyAddress('not-an-ip')).toBe<AdmissionClass>('address-unavailable')
  })

  // address-unavailable must not be guessed into either of the other two.
  it('does not fold address-unavailable into a family or range failure', () => {
    const cls = classifyAddress('')
    expect(cls).not.toBe<AdmissionClass>('unsupported-family')
    expect(cls).not.toBe<AdmissionClass>('outside-range')
  })

  // Defence-in-depth already present in the accepted set: leading-zero octets
  // must not reach the range check as a valid quad.
  it('does not admit leading-zero octet forms', () => {
    expect(classifyAddress('100.064.5.5')).not.toBe<AdmissionClass>('accepted')
  })
})

describe('refusal diagnostics', () => {
  type TestEnv = { Bindings: HttpBindings; Variables: { requestId: string } }

  function makeApp() {
    const app = new Hono<TestEnv>()
    app.use(async (c, next) => {
      c.set('requestId', 'pinned-request-id')
      await next()
    })
    app.use(cidrMiddleware())
    app.get('/probe', (c) => c.json({ ok: true }, 200))
    return app
  }

  function withSocket(remoteAddress: string) {
    return { incoming: { socket: { remoteAddress } } } as unknown as Record<string, unknown>
  }

  let stderr: ReturnType<typeof vi.spyOn>
  let written: string

  beforeEach(() => {
    written = ''
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      written += String(chunk)
      return true
    })
  })

  afterEach(() => stderr.mockRestore())

  it('records each refusal class distinctly, with the existing requestId', async () => {
    await makeApp().request('/probe', {}, withSocket('fd7a:115c:a1e0::1'))
    expect(written).toContain('unsupported-family')
    expect(written).toContain('pinned-request-id')

    written = ''
    await makeApp().request('/probe', {}, withSocket('8.8.8.8'))
    expect(written).toContain('outside-range')
    expect(written).toContain('pinned-request-id')

    written = ''
    await makeApp().request('/probe', {}, {} as unknown as Record<string, unknown>)
    expect(written).toContain('address-unavailable')
    expect(written).toContain('pinned-request-id')
  })

  // The privacy half of the requirement: the class is recorded, the peer is not
  // — in neither raw nor normalised form.
  it('records neither the raw nor the normalised client address', async () => {
    await makeApp().request('/probe', {}, withSocket('::ffff:8.8.8.8'))
    expect(written).toContain('outside-range')
    expect(written).not.toContain('::ffff:8.8.8.8')
    expect(written).not.toContain('8.8.8.8')
  })

  it('records nothing extra for an admitted peer', async () => {
    await makeApp().request('/probe', {}, withSocket('100.64.5.5'))
    expect(written).not.toContain('100.64.5.5')
  })
})

describe('the refusal class never leaves the daemon', () => {
  type TestEnv = { Bindings: HttpBindings; Variables: { requestId: string } }

  function makeApp() {
    const app = new Hono<TestEnv>()
    app.use(async (c, next) => {
      c.set('requestId', 'pinned-request-id')
      await next()
    })
    app.use(cidrMiddleware())
    app.get('/probe', (c) => c.json({ ok: true }, 200))
    return app
  }

  function withSocket(remoteAddress: string) {
    return { incoming: { socket: { remoteAddress } } } as unknown as Record<string, unknown>
  }

  const CLASS_NAMES = ['unsupported-family', 'outside-range', 'address-unavailable']

  it('returns an identical status, error code and field set for every class', async () => {
    const cases: Array<Record<string, unknown>> = [
      withSocket('fd7a:115c:a1e0::1'),
      withSocket('8.8.8.8'),
      {} as unknown as Record<string, unknown>,
    ]

    const shapes: string[] = []
    for (const env of cases) {
      const res = await makeApp().request('/probe', {}, env)
      expect(res.status).toBe(403)
      const body = (await res.json()) as Record<string, unknown>
      expect(body.error).toBe('cidr_violation')
      shapes.push(Object.keys(body).sort().join(','))
    }

    // Every refusal presents the same field set — no class-dependent extra key.
    expect(new Set(shapes).size).toBe(1)
  })

  it('leaks no class name in the body or headers of any refusal', async () => {
    const cases: Array<Record<string, unknown>> = [
      withSocket('fd7a:115c:a1e0::1'),
      withSocket('8.8.8.8'),
      {} as unknown as Record<string, unknown>,
    ]

    for (const env of cases) {
      const res = await makeApp().request('/probe', {}, env)
      const raw = await res.text()
      const headers = JSON.stringify([...res.headers.entries()])
      for (const name of CLASS_NAMES) {
        expect(raw).not.toContain(name)
        expect(headers).not.toContain(name)
      }
    }
  })
})

describe('the refusal class is hidden from authenticated callers too', () => {
  let authFile: string
  let registryFile: string
  let cleanup: () => void

  beforeEach(() => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    authFile = join(tmp.configDir, 'auth.json')
    registryFile = join(tmp.configDir, 'registry.json')
    const fresh = ensureAuthFile(authFile)
    setActiveToken(fresh.token)
  })

  afterEach(() => cleanup())

  it('reveals no class to a caller holding a valid bearer token', async () => {
    const token = getActiveToken()
    const app = createApp({ enforceCIDR: true, authFile, registryFile })

    for (const remoteAddress of ['fd7a:115c:a1e0::1', '8.8.8.8']) {
      const res = await app.request(
        'http://127.0.0.1:5193/health',
        { headers: { Authorization: `Bearer ${token}` } },
        { incoming: { socket: { remoteAddress } } } as unknown as Record<string, unknown>,
      )
      expect(res.status).toBe(403)
      const raw = await res.text()
      expect(raw).not.toContain('unsupported-family')
      expect(raw).not.toContain('outside-range')
      expect(raw).not.toContain('address-unavailable')
      expect(raw).toContain('cidr_violation')
    }
  })
})
