/**
 * Characterisation tests for CLI bind-mode selection.
 *
 * GREEN ON FIRST RUN by design, like the server-side companion file. They pin
 * which `--bind` inputs turn CIDR enforcement on, so `decide-tailnet-ipv6-policy`
 * cannot change the enforcement-selection rule by accident while changing it on
 * purpose for IPv6 literals.
 *
 * The functions under test were extracted verbatim from `runStart` in the
 * commit immediately preceding this one, because the rule was previously
 * reachable only by booting a real daemon. The extraction changed no behaviour;
 * these assertions describe the daemon as it shipped.
 *
 * Covers task-1 items 5, 6, 8 and the pair-URL half of item 12. Item 12's
 * hostname-resolution half is already covered by lib/tailscale.test.ts
 * (MagicDNS strip, *.ts.net validation, IP fallback).
 */
import { describe, it, expect } from 'vitest'

import { renderBanner } from '../lib/banner.js'

import { classifyExplicitBind, shouldEnforceCidr } from './start.js'

describe('characterisation: bind literal classification', () => {
  // Item 5 — the default. Loopback must not install the middleware.
  it('classifies the default 127.0.0.1 as loopback', () => {
    expect(classifyExplicitBind('127.0.0.1')).toEqual({
      host: '127.0.0.1',
      bindMode: 'loopback',
    })
  })

  // Item 6 (0.0.0.0 half)
  it('classifies 0.0.0.0 as the all-interfaces mode', () => {
    expect(classifyExplicitBind('0.0.0.0')).toEqual({
      host: '0.0.0.0',
      bindMode: '0.0.0.0',
    })
  })

  // Item 8 — an explicit non-loopback IPv4 literal is accepted as a bind input
  // and is NOT loopback, so enforcement applies.
  it('classifies an explicit non-loopback IPv4 literal as non-loopback', () => {
    expect(classifyExplicitBind('100.64.5.5')).toEqual({
      host: '100.64.5.5',
      bindMode: 'tailscale',
    })
    expect(classifyExplicitBind('192.168.1.5').bindMode).toBe('tailscale')
  })

  // 127.0.0.x other than 127.0.0.1 is non-loopback under the shipped rule.
  // Called out in the round-5 review as an asymmetry worth knowing about; pinned
  // here so the change does not alter it silently while reworking IPv6 literals.
  it('classifies 127.0.0.2 as non-loopback, not as loopback', () => {
    expect(classifyExplicitBind('127.0.0.2').bindMode).toBe('tailscale')
  })

  // This assertion CHANGED with decide-tailnet-ipv6-policy, by design. It was
  // written to pin the pre-change gap — every IPv6 literal, including :: and a
  // tailnet ULA, fell through to loopback-equivalent and ran with no CIDR
  // enforcement — precisely so that closing the gap would show up as a diff
  // here rather than passing unnoticed. The BEFORE state is preserved in git
  // history and in the commit that introduced it; ipv6Bind.test.ts now owns the
  // AFTER state in full.
  it('no longer treats every IPv6 literal as loopback-equivalent', () => {
    expect(classifyExplicitBind('::1').bindMode).toBe('loopback')
    expect(classifyExplicitBind('::').bindMode).toBe('0.0.0.0')
    expect(classifyExplicitBind('fd7a:115c:a1e0::1').bindMode).not.toBe('loopback')
  })
})

describe('characterisation: enforcement selection follows bind mode', () => {
  // Item 5 — loopback never enforces, flag or no flag.
  it('does not enforce CIDR in loopback mode', () => {
    expect(shouldEnforceCidr('loopback', true)).toBe(false)
    expect(shouldEnforceCidr('loopback', false)).toBe(false)
  })

  // Item 6 — tailscale and 0.0.0.0 enforce unless explicitly disabled.
  it('enforces CIDR for tailscale and 0.0.0.0 modes by default', () => {
    expect(shouldEnforceCidr('tailscale', true)).toBe(true)
    expect(shouldEnforceCidr('0.0.0.0', true)).toBe(true)
  })

  it('honours the explicit opt-out for both non-loopback modes', () => {
    expect(shouldEnforceCidr('tailscale', false)).toBe(false)
    expect(shouldEnforceCidr('0.0.0.0', false)).toBe(false)
  })

  // Item 8 — the composition that matters operationally: an explicit
  // non-loopback IPv4 bind gets enforcement without the operator asking.
  it('enforces CIDR for an explicit non-loopback IPv4 bind by default', () => {
    const { bindMode } = classifyExplicitBind('100.64.5.5')
    expect(shouldEnforceCidr(bindMode, true)).toBe(true)
  })
})

describe('characterisation: the pair URL uses the Tailscale hostname', () => {
  // Item 12 (pair-URL half). runStart composes pairHostname as
  // `${dns}:${port}` on the tailscale path, and the banner embeds it in the
  // pair link. Pinned so the hostname does not silently revert to the raw IP.
  it('embeds the supplied pair hostname in the pair URL and the manual agent URL', () => {
    const banner = renderBanner({
      bindUrl: 'http://100.64.5.5:5193',
      pairHostname: 'devbox.tailfa84dd.ts.net:5193',
      token: 'test-token',
      registryCount: 0,
      projectNames: [],
    })

    expect(banner).toContain('Agent URL: http://devbox.tailfa84dd.ts.net:5193')
    expect(banner).toContain(
      `agent=${encodeURIComponent('http://devbox.tailfa84dd.ts.net:5193')}`,
    )
    // The bound address still appears as the listen address...
    expect(banner).toContain('Listening on http://100.64.5.5:5193')
    // ...but the pair link must not fall back to it.
    expect(banner).not.toContain(`agent=${encodeURIComponent('http://100.64.5.5:5193')}`)
  })
})
