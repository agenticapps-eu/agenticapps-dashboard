/**
 * IPv6 bind classification — RED tests for decide-tailnet-ipv6-policy task 2.
 *
 * Today every IPv6 literal falls through runStart's "unknown string" branch and
 * is treated as loopback-equivalent, so a non-loopback IPv6 bind runs with NO
 * CIDR enforcement at all. That is the enforcement-selection gap.
 *
 * Closing it is not simply "enforce on IPv6 too": the admission boundary
 * accepts no raw IPv6, so an enforced specific IPv6 bind would start cleanly
 * and refuse every peer. The policy therefore splits three ways —
 *
 *   ::1                     loopback, no enforcement
 *   ::                      all-interfaces, enforced, warns; serves mapped
 *                           CGNAT IPv4 peers and refuses raw IPv6 ones
 *   any other IPv6 literal  fails BEFORE startup while enforcement is on;
 *                           the existing explicit opt-out still permits it
 */
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { createApp } from '../server/app.js'
import { ensureAuthFile, getActiveToken, setActiveToken } from '../lib/auth.js'
import { makeTmpHome } from '../lib/__fixtures__/tmpHome.js'
import { renderZeroBindWarning } from '../lib/banner.js'

import {
  classifyExplicitBind,
  shouldEnforceCidr,
  assertBindSupported,
  Ipv6BindNotSupportedError,
  UnsupportedBindError,
} from './start.js'

describe('IPv6 bind literals are classified, not swallowed', () => {
  it('treats ::1 as loopback, so no enforcement is installed', () => {
    const { host, bindMode } = classifyExplicitBind('::1')
    expect(host).toBe('::1')
    expect(bindMode).toBe('loopback')
    expect(shouldEnforceCidr(bindMode, true)).toBe(false)
  })

  it('treats :: as an all-interfaces bind, enforced by default', () => {
    const { host, bindMode } = classifyExplicitBind('::')
    expect(host).toBe('::')
    expect(bindMode).toBe('0.0.0.0')
    expect(shouldEnforceCidr(bindMode, true)).toBe(true)
  })

  it('treats a specific IPv6 literal as non-loopback rather than loopback-equivalent', () => {
    const { bindMode } = classifyExplicitBind('fd7a:115c:a1e0::1')
    expect(bindMode).not.toBe('loopback')
    expect(shouldEnforceCidr(bindMode, true)).toBe(true)
  })

  // This assertion was WRONG when first written. It pinned the old fallthrough
  // — an unrecognised value is treated as loopback — as though it were
  // deliberate, on the reasoning that input validation was out of scope.
  // Independent review showed that fallthrough is the same fail-open hole this
  // change exists to close, reached by a different door: `--bind 0` is not a
  // recognised literal, so it took this path, and Node's listen() resolves `0`
  // to 0.0.0.0. The result was every interface, no CIDR middleware, no warning.
  // Unrecognised values now fail closed; bindHardening.test.ts owns the detail.
  it('refuses a non-address string rather than treating it as loopback', () => {
    expect(() => classifyExplicitBind('not-an-address')).toThrow(UnsupportedBindError)
  })
})

describe('a specific non-loopback IPv6 bind fails before startup', () => {
  it('refuses to start while CIDR enforcement is enabled', () => {
    expect(() => assertBindSupported('fd7a:115c:a1e0::1', true)).toThrow(
      Ipv6BindNotSupportedError,
    )
    expect(() => assertBindSupported('2001:db8::1', true)).toThrow(Ipv6BindNotSupportedError)
  })

  it('explains the IPv4-only boundary and both ways forward', () => {
    let message = ''
    try {
      assertBindSupported('fd7a:115c:a1e0::1', true)
    } catch (e) {
      message = (e as Error).message
    }
    // The policy...
    expect(message).toMatch(/IPv4/)
    // ...the CGNAT IPv4 path...
    expect(message).toMatch(/100\.64\.0\.0\/10|CGNAT/)
    // ...and the explicit opt-out, named exactly as the CLI spells it.
    expect(message).toContain('--no-enforce-cidr')
  })

  // The deliberate escape hatch. Its default is untouched by this change.
  it('permits the same bind when enforcement is explicitly disabled', () => {
    expect(() => assertBindSupported('fd7a:115c:a1e0::1', false)).not.toThrow()
  })

  // The two IPv6 literals that are NOT specific non-loopback addresses.
  it('does not block :: or ::1', () => {
    expect(() => assertBindSupported('::', true)).not.toThrow()
    expect(() => assertBindSupported('::1', true)).not.toThrow()
  })

  it('does not block IPv4 binds', () => {
    expect(() => assertBindSupported('0.0.0.0', true)).not.toThrow()
    expect(() => assertBindSupported('127.0.0.1', true)).not.toThrow()
    expect(() => assertBindSupported('100.64.5.5', true)).not.toThrow()
  })
})

describe('the all-interfaces warning names the address actually bound', () => {
  it('says 0.0.0.0 by default, preserving the existing banner', () => {
    expect(renderZeroBindWarning(true)).toContain('WARNING: bound to 0.0.0.0')
  })

  it('says :: when that is what was bound', () => {
    const warning = renderZeroBindWarning(true, '::')
    expect(warning).toContain('WARNING: bound to ::')
    expect(warning).toContain('CIDR enforcement is ON.')
  })
})

describe('dual-stack :: serves mapped CGNAT IPv4 and refuses raw IPv6', () => {
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

  function request(app: ReturnType<typeof createApp>, remoteAddress: string, token: string) {
    return app.request(
      'http://127.0.0.1:5193/health',
      { headers: { Authorization: `Bearer ${token}` } },
      { incoming: { socket: { remoteAddress } } } as unknown as Record<string, unknown>,
    )
  }

  it('admits a mapped CGNAT IPv4 peer and refuses a raw IPv6 peer', async () => {
    const token = getActiveToken()
    const app = createApp({ enforceCIDR: true, bindMode: '0.0.0.0', authFile, registryFile })

    expect((await request(app, '::ffff:100.64.5.5', token)).status).toBe(200)
    expect((await request(app, 'fd7a:115c:a1e0::1', token)).status).toBe(403)
  })

  // "Disabling enforcement disables the whole check" — both the range rule and
  // the address-family rule, together. A partial disable would be a trap.
  it('admits both a raw IPv6 peer and an out-of-range IPv4 peer under the opt-out', async () => {
    const token = getActiveToken()
    const app = createApp({ enforceCIDR: false, bindMode: '0.0.0.0', authFile, registryFile })

    expect((await request(app, 'fd7a:115c:a1e0::1', token)).status).toBe(200)
    expect((await request(app, '8.8.8.8', token)).status).toBe(200)
  })
})
