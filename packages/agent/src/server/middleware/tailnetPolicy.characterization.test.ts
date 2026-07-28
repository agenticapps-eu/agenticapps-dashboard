/**
 * Characterisation tests for the tailnet admission boundary.
 *
 * These are GREEN ON FIRST RUN by design — every behaviour asserted here
 * already exists. They exist to stop a later refactor silently changing the
 * accepted address set or the enforcement-selection rule, which is the risk the
 * `decide-tailnet-ipv6-policy` change introduces by touching this code.
 *
 * They deliberately carry no TDD flag. A test that cannot fail first is not a
 * red-green cycle, and labelling it as one would be the red flag it looks like.
 *
 * Covers task-1 items 1-4, 7, 9, 10, 11 of the change ledger. The bind-mode
 * selection items (5, 6, 8, 12) live in cli/bindPolicy.characterization.test.ts
 * because they characterise CLI-side logic.
 */
import { join } from 'node:path'

import { Hono } from 'hono'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { HttpBindings } from '@hono/node-server'

import { createApp } from '../app.js'
import { ensureAuthFile, getActiveToken, setActiveToken } from '../../lib/auth.js'
import { makeTmpHome } from '../../lib/__fixtures__/tmpHome.js'
import { renderZeroBindWarning } from '../../lib/banner.js'

import { isTailscaleCIDR, cidrMiddleware } from './cidr.js'

describe('characterisation: the accepted address set', () => {
  // Item 1 — pins the IPv6-mapped IPv4 strip. This is the single most
  // load-bearing assertion in the file: the change normalises mapped form
  // before range classification, and a bug there is how the boundary would
  // accidentally widen.
  it('accepts a CGNAT address presented in IPv6-mapped IPv4 form', () => {
    expect(isTailscaleCIDR('::ffff:100.64.5.5')).toBe(true)
  })

  // Item 2
  it('accepts a CGNAT address presented as a plain dotted quad', () => {
    expect(isTailscaleCIDR('100.64.5.5')).toBe(true)
  })

  // Item 3 — the policy decision this whole change exists to make explicit.
  it('refuses a tailnet IPv6 address', () => {
    expect(isTailscaleCIDR('fd7a:115c:a1e0::1')).toBe(false)
    expect(isTailscaleCIDR('fd7a:115c:a1e0:ab12:4843:cd96:6244:1a2b')).toBe(false)
  })

  // Item 4
  it('refuses a routable IPv4 address outside the accepted range', () => {
    expect(isTailscaleCIDR('8.8.8.8')).toBe(false)
    expect(isTailscaleCIDR('192.168.1.5')).toBe(false)
  })

  // The mapped-form strip must not become a way to smuggle a non-CGNAT IPv4
  // address past the range check. Pinned here because the change adds a
  // classifier in front of exactly this path.
  it('refuses a non-CGNAT IPv4 address even in IPv6-mapped form', () => {
    expect(isTailscaleCIDR('::ffff:8.8.8.8')).toBe(false)
  })

  // The /10 boundary itself. Pinned so "unchanged accepted set" is checkable.
  it('treats 100.64.0.0/10 as the exact boundary', () => {
    expect(isTailscaleCIDR('100.64.0.0')).toBe(true)
    expect(isTailscaleCIDR('100.127.255.255')).toBe(true)
    expect(isTailscaleCIDR('100.63.255.255')).toBe(false)
    expect(isTailscaleCIDR('100.128.0.0')).toBe(false)
  })
})

describe('characterisation: refusal correlation and header non-trust', () => {
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

  // Item 9 — proves the ordering claim the change depends on: the requestId
  // the refusal diagnostic will correlate against is installed BEFORE the CIDR
  // middleware, so no new correlation identifier is needed.
  it('reads the requestId installed by upstream middleware rather than minting one', async () => {
    const res = await makeApp().request('/probe', {}, withSocket('8.8.8.8'))
    expect(res.status).toBe(403)
    const body = (await res.json()) as { requestId: string }
    expect(body.requestId).toBe('pinned-request-id')
  })

  // Item 10 — anti-spoof. The decision is taken on the raw socket address; a
  // forged header claiming a CGNAT source must not admit an outside peer.
  it('ignores forwarding headers asserting a different client address', async () => {
    const res = await makeApp().request(
      '/probe',
      {
        headers: {
          'X-Forwarded-For': '100.64.5.5',
          'X-Real-IP': '100.64.5.5',
        },
      },
      withSocket('8.8.8.8'),
    )
    expect(res.status).toBe(403)
  })

  // The mirror of the above: a forged header must not refuse an admitted peer
  // either. Pins that the header is ignored, not merely subordinate.
  it('admits a CGNAT socket peer despite a forwarding header claiming otherwise', async () => {
    const res = await makeApp().request(
      '/probe',
      { headers: { 'X-Forwarded-For': '8.8.8.8' } },
      withSocket('100.64.5.5'),
    )
    expect(res.status).toBe(200)
  })

  // A missing/unparseable peer address must fail closed. The change gives this
  // its own class; today it simply refuses, which is what is pinned here.
  it('refuses when no socket peer address is available', async () => {
    const app = makeApp()
    const res = await app.request('/probe', {}, {} as unknown as Record<string, unknown>)
    expect(res.status).toBe(403)
  })
})

describe('characterisation: enforcement follows bind configuration, not request source', () => {
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

  // Item 7 — the scenario an operator is most likely to be surprised by, and
  // the reason the change states the rule as "bind mode, not request source".
  it('refuses a loopback-source request when CIDR enforcement is on', async () => {
    const token = getActiveToken()
    const app = createApp({ enforceCIDR: true, authFile, registryFile })
    const res = await app.request(
      'http://127.0.0.1:5193/health',
      { headers: { Authorization: `Bearer ${token}` } },
      { incoming: { socket: { remoteAddress: '127.0.0.1' } } } as unknown as Record<string, unknown>,
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('cidr_violation')
  })

  // Item 5 (server half) — loopback mode does not install the middleware, so
  // the same request is served.
  it('serves a loopback-source request when CIDR enforcement is off', async () => {
    const token = getActiveToken()
    const app = createApp({ enforceCIDR: false, authFile, registryFile })
    const res = await app.request(
      'http://127.0.0.1:5193/health',
      { headers: { Authorization: `Bearer ${token}` } },
      { incoming: { socket: { remoteAddress: '127.0.0.1' } } } as unknown as Record<string, unknown>,
    )
    expect(res.status).toBe(200)
  })

  // CIDR runs before bearerAuth, so an off-tailnet peer is refused without the
  // boundary ever consulting the token. Pinned because the change asserts the
  // classification is unavailable to authenticated callers too — that claim
  // only means anything if the ordering is known.
  it('refuses an off-tailnet peer before authentication is considered', async () => {
    const app = createApp({ enforceCIDR: true, authFile, registryFile })
    const res = await app.request(
      'http://127.0.0.1:5193/health',
      { headers: { Authorization: 'Bearer definitely-not-the-token' } },
      { incoming: { socket: { remoteAddress: '8.8.8.8' } } } as unknown as Record<string, unknown>,
    )
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('cidr_violation')
  })
})

describe('characterisation: the all-interfaces warning banner', () => {
  // Item 11
  it('warns when bound to all interfaces and names CIDR enforcement when on', () => {
    const warning = renderZeroBindWarning(true)
    expect(warning).toContain('WARNING: bound to 0.0.0.0')
    expect(warning).toContain('CIDR enforcement is ON.')
  })

  it('omits the enforcement clause when enforcement is disabled', () => {
    const warning = renderZeroBindWarning(false)
    expect(warning).toContain('WARNING: bound to 0.0.0.0')
    expect(warning).not.toContain('CIDR enforcement is ON')
  })
})
