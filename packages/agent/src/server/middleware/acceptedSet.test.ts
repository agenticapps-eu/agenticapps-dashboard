/**
 * Task-4 verification: the accepted address set is unchanged.
 *
 * decide-tailnet-ipv6-policy classifies refusals; it must not widen or narrow
 * the boundary. Spot assertions cannot show that, so this sweeps a few thousand
 * addresses and compares the shipping predicate against a reference written
 * straight from the requirement — "in 100.64.0.0/10, as a dotted quad or in
 * IPv6-mapped IPv4 form" — rather than copied from the implementation. Two
 * independent expressions of the same rule agreeing across the sweep is the
 * evidence; a single implementation agreeing with itself would not be.
 */
import { describe, it, expect } from 'vitest'

import { isTailscaleCIDR, classifyAddress } from './cidr.js'

/** Reference: strict dotted quad, each octet 0-255, no leading zeros. */
function referenceAccepts(input: string): boolean {
  const mapped = /^::ffff:/i.test(input)
  const candidate = mapped ? input.slice(7) : input

  const octets = candidate.split('.')
  if (octets.length !== 4) return false
  for (const o of octets) {
    if (!/^\d{1,3}$/.test(o)) return false
    if (o.length > 1 && o.startsWith('0')) return false
    if (Number(o) > 255) return false
  }

  // 100.64.0.0/10 == 100.64.0.0 through 100.127.255.255
  const [a, b] = [Number(octets[0]), Number(octets[1])]
  return a === 100 && b >= 64 && b <= 127
}

function* sweepAddresses(): Generator<string> {
  // Dense around every boundary that matters, sparse elsewhere.
  for (const a of [0, 9, 10, 99, 100, 101, 127, 172, 192, 255]) {
    for (const b of [0, 1, 63, 64, 65, 100, 126, 127, 128, 129, 255]) {
      for (const c of [0, 1, 255]) {
        for (const d of [0, 1, 254, 255]) {
          const quad = `${a}.${b}.${c}.${d}`
          yield quad
          yield `::ffff:${quad}`
          yield `::FFFF:${quad}`
        }
      }
    }
  }
}

describe('the accepted address set matches the requirement exactly', () => {
  it('agrees with an independent reference across the whole sweep', () => {
    const disagreements: string[] = []
    let count = 0
    let accepted = 0

    for (const address of sweepAddresses()) {
      count++
      const actual = isTailscaleCIDR(address)
      if (actual) accepted++
      if (actual !== referenceAccepts(address)) disagreements.push(address)
    }

    expect(disagreements).toEqual([])
    // Guard against the sweep silently collapsing to nothing.
    expect(count).toBeGreaterThan(3_000)
    expect(accepted).toBeGreaterThan(0)
  })

  it('accepts nothing outside 100.64.0.0/10 and nothing in another family', () => {
    const mustRefuse = [
      '100.63.255.255',
      '100.128.0.0',
      '99.64.0.0',
      '101.64.0.0',
      '10.0.0.1',
      '172.16.0.1',
      '192.168.1.1',
      '8.8.8.8',
      '0.0.0.0',
      '255.255.255.255',
      '127.0.0.1',
      '::1',
      '::',
      'fd7a:115c:a1e0::1',
      '2001:db8::1',
      '::ffff:8.8.8.8',
      '100.064.0.1',
      '0100.64.0.1',
      '100.64.0.1 ',
      ' 100.64.0.1',
      '100.64.0.1.',
      '100.64.0',
      '',
      'not-an-ip',
    ]
    for (const address of mustRefuse) {
      expect(isTailscaleCIDR(address), `${address} must be refused`).toBe(false)
    }
  })

  it('accepts the range endpoints in both presentations', () => {
    for (const address of [
      '100.64.0.0',
      '100.127.255.255',
      '::ffff:100.64.0.0',
      '::ffff:100.127.255.255',
    ]) {
      expect(isTailscaleCIDR(address), `${address} must be accepted`).toBe(true)
      expect(classifyAddress(address)).toBe('accepted')
    }
  })
})
