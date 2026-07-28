/**
 * RED tests for the three defects independent review found in the first cut of
 * decide-tailnet-ipv6-policy. All three share one root cause: the bind
 * classifier's fallthrough FAILS OPEN — anything it does not recognise is
 * called loopback, which silently means "no boundary, no warning".
 *
 *   1. `--bind 0` (also `00`, `0000`) — the strict IPv4 regex rejects it, so it
 *      falls through to loopback. Node's listen() then resolves `0` to
 *      0.0.0.0. All interfaces, no CIDR middleware, no warning banner.
 *   2. `--bind ::0` / `0:0:0:0:0:0:0:0` — the wildcard was matched by string
 *      equality against '::', so every other spelling of the unspecified
 *      address escaped the all-interfaces path.
 *   3. `--bind ::1` / `::` — supported by this change, but the resulting URL
 *      is unbracketed (`http://::1:5193`), which z.string().url() rejects, so
 *      writeServerInfo throws after the listener is already up.
 *
 * The fix is to fail closed: canonicalise IPv6 rather than string-compare it,
 * bracket IPv6 in URLs, and reject a bind value that is not a supported
 * literal instead of quietly treating it as loopback.
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

import { formatUrlHost } from '../lib/banner.js'

import { classifyExplicitBind, shouldEnforceCidr, UnsupportedBindError } from './start.js'

describe('the unspecified address is all-interfaces in every spelling', () => {
  // Defect 2. `::` was matched by string equality, so these escaped.
  it.each(['::', '::0', '0:0:0:0:0:0:0:0', '0000:0000:0000:0000:0000:0000:0000:0000'])(
    'classifies %s as an all-interfaces bind',
    (literal) => {
      expect(classifyExplicitBind(literal).bindMode).toBe('0.0.0.0')
    },
  )

  it('enforces CIDR on every wildcard spelling by default', () => {
    for (const literal of ['::', '::0', '0:0:0:0:0:0:0:0']) {
      const { bindMode } = classifyExplicitBind(literal)
      expect(shouldEnforceCidr(bindMode, true), `${literal} must enforce`).toBe(true)
    }
  })
})

describe('IPv6 loopback is loopback in every spelling', () => {
  it.each(['::1', '0:0:0:0:0:0:0:1', '0000:0000:0000:0000:0000:0000:0000:0001'])(
    'classifies %s as loopback',
    (literal) => {
      expect(classifyExplicitBind(literal).bindMode).toBe('loopback')
    },
  )
})

describe('a specific IPv6 address is still non-loopback', () => {
  // The canonicalisation must not over-match and swallow real addresses.
  it.each(['fd7a:115c:a1e0::1', '2001:db8::1', 'fe80::1', '::2', '1::'])(
    'classifies %s as non-loopback',
    (literal) => {
      expect(classifyExplicitBind(literal).bindMode).not.toBe('loopback')
      expect(classifyExplicitBind(literal).bindMode).not.toBe('0.0.0.0')
    },
  )
})

describe('an unrecognised bind value is refused, not silently treated as loopback', () => {
  // Defect 1 — the critical one. Node resolves these to 0.0.0.0.
  it.each(['0', '00', '0000'])('refuses %s rather than binding all interfaces unguarded', (bind) => {
    expect(() => classifyExplicitBind(bind)).toThrow(UnsupportedBindError)
  })

  // A hostname is outside the documented --bind surface and previously bound
  // whatever it resolved to, with no boundary and no banner.
  it.each(['dev-box.lan', 'example.com', 'localhost'])('refuses the hostname %s', (bind) => {
    expect(() => classifyExplicitBind(bind)).toThrow(UnsupportedBindError)
  })

  it.each(['not-an-address', '999.999.999.999', '127.0.0.1.5', ''])(
    'refuses the malformed value %s',
    (bind) => {
      expect(() => classifyExplicitBind(bind)).toThrow(UnsupportedBindError)
    },
  )

  it('names the value and the supported forms', () => {
    let message = ''
    try {
      classifyExplicitBind('0')
    } catch (e) {
      message = (e as Error).message
    }
    expect(message).toContain('0')
    expect(message).toMatch(/tailscale/)
    expect(message).toMatch(/127\.0\.0\.1|literal/)
  })

  // Everything documented must still work.
  it.each([
    ['127.0.0.1', 'loopback'],
    ['0.0.0.0', '0.0.0.0'],
    ['100.64.5.5', 'tailscale'],
    ['192.168.1.5', 'tailscale'],
    ['127.0.0.2', 'tailscale'],
  ])('still accepts %s as %s', (bind, expected) => {
    expect(classifyExplicitBind(bind).bindMode).toBe(expected)
  })
})

describe('IPv6 hosts produce valid URLs', () => {
  // Defect 3. z.string().url() rejects an unbracketed IPv6 authority, and
  // writeServerInfo validates the bind URL with exactly that schema — so an
  // unbracketed URL takes the daemon down after the listener is already up.
  it.each(['::1', '::', 'fd7a:115c:a1e0::1'])('brackets %s', (host) => {
    expect(formatUrlHost(host)).toBe(`[${host}]`)
  })

  it.each(['127.0.0.1', '0.0.0.0', '100.64.5.5', 'devbox.tailfa84dd.ts.net'])(
    'leaves %s alone',
    (host) => {
      expect(formatUrlHost(host)).toBe(host)
    },
  )

  it('produces a URL that passes the serverInfo schema for every supported bind', () => {
    for (const host of ['127.0.0.1', '0.0.0.0', '100.64.5.5', '::1', '::', 'fd7a:115c:a1e0::1']) {
      const url = `http://${formatUrlHost(host)}:5193`
      expect(z.string().url().safeParse(url).success, `${url} must be a valid URL`).toBe(true)
    }
  })
})
