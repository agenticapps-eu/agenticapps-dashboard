import { Hono } from 'hono'
import { describe, it, expect } from 'vitest'
import type { HttpBindings } from '@hono/node-server'

import { isTailscaleCIDR, cidrMiddleware } from './cidr.js'

describe('isTailscaleCIDR', () => {
  it('100.64.0.1 is in the Tailscale CGNAT range', () => {
    expect(isTailscaleCIDR('100.64.0.1')).toBe(true)
  })

  it('100.127.255.255 is in the Tailscale CGNAT range (boundary)', () => {
    expect(isTailscaleCIDR('100.127.255.255')).toBe(true)
  })

  it('100.128.0.0 is just outside the /10 boundary', () => {
    expect(isTailscaleCIDR('100.128.0.0')).toBe(false)
  })

  it('127.0.0.1 is not in Tailscale range', () => {
    expect(isTailscaleCIDR('127.0.0.1')).toBe(false)
  })

  it('192.168.1.1 is not in Tailscale range', () => {
    expect(isTailscaleCIDR('192.168.1.1')).toBe(false)
  })

  it('::ffff:100.64.5.5 (IPv6-mapped IPv4) is recognized as Tailscale', () => {
    expect(isTailscaleCIDR('::ffff:100.64.5.5')).toBe(true)
  })

  it('not-an-ip returns false', () => {
    expect(isTailscaleCIDR('not-an-ip')).toBe(false)
  })
})

describe('cidrMiddleware', () => {
  type TestEnv = { Bindings: HttpBindings; Variables: { requestId: string } }

  function makeTestApp() {
    const app = new Hono<TestEnv>()
    app.use(async (c, next) => { c.set('requestId', 'test-id'); await next() })
    app.use(cidrMiddleware())
    app.get('/probe', (c) => c.json({ ok: true }, 200))
    return app
  }

  it('request from 192.168.1.5 (non-Tailscale) returns 403 with cidr_violation', async () => {
    const app = makeTestApp()
    const res = await app.request(
      '/probe',
      {},
      { incoming: { socket: { remoteAddress: '192.168.1.5' } } } as unknown as Record<string, unknown>,
    )
    expect(res.status).toBe(403)
    const body = await res.json() as { error: string }
    expect(body.error).toBe('cidr_violation')
  })

  it('request from 100.64.5.5 (Tailscale) passes through with 200', async () => {
    const app = makeTestApp()
    const res = await app.request(
      '/probe',
      {},
      { incoming: { socket: { remoteAddress: '100.64.5.5' } } } as unknown as Record<string, unknown>,
    )
    expect(res.status).toBe(200)
  })
})
