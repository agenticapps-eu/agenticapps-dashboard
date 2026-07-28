import { isIPv4, isIPv6 } from 'node:net'

import type { MiddlewareHandler } from 'hono'
import type { HttpBindings } from '@hono/node-server'

import { TAILSCALE_CIDR_BASE, TAILSCALE_CIDR_PREFIX } from '../../constants.js'
import { generateRequestId, agentError } from '../../lib/logging.js'

/**
 * The outcome of classifying a socket peer address against the admission
 * boundary. Internal to the daemon: see cidrMiddleware for why no value here
 * may ever reach an HTTP response.
 *
 * - `accepted`            — in 100.64.0.0/10, dotted or IPv6-mapped
 * - `unsupported-family`  — a well-formed address in a family we do not admit
 *                           (i.e. raw IPv6, INCLUDING a tailnet's own ULA range)
 * - `outside-range`       — a well-formed IPv4 address outside the accepted range
 * - `address-unavailable` — no parseable socket peer address at all
 */
export type AdmissionClass =
  | 'accepted'
  | 'unsupported-family'
  | 'outside-range'
  | 'address-unavailable'

/** Numeric containment test for a validated dotted-quad IPv4 string. */
function inCgnatRange(dottedQuad: string): boolean {
  const parts = dottedQuad.split('.').map(Number)
  if (parts.length !== 4) return false
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false

  const num = (((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0)
  const mask = (~((1 << (32 - TAILSCALE_CIDR_PREFIX)) - 1)) >>> 0
  return (num & mask) === (TAILSCALE_CIDR_BASE & mask)
}

/**
 * Classify a socket peer address for admission.
 *
 * The accepted set is IPv4 CGNAT only and this function does not widen it —
 * see ADR 0002. Its purpose is to say WHY an address was refused, so an
 * operator can tell malformed socket state from an intentional policy refusal.
 *
 * Order matters. IPv6-mapped IPv4 is normalised BEFORE the range check, so
 * `::ffff:8.8.8.8` is `outside-range` rather than `unsupported-family` — it is
 * an IPv4 address wearing an IPv6 presentation, not a different family. Getting
 * this backwards is also how the boundary would accidentally widen, which is
 * why it carries its own test.
 *
 * RESEARCH Pitfall 3: Node surfaces mapped addresses as `::ffff:100.64.x.x`.
 * `isIPv4` is what rejects leading-zero octets (`100.064.5.5`) that some legacy
 * resolvers would read as octal — defence in depth against an octal form
 * sneaking into the range check.
 */
export function classifyAddress(ip: string): AdmissionClass {
  if (!ip) return 'address-unavailable'

  const normalised = ip.replace(/^::ffff:/i, '')

  if (isIPv4(normalised)) {
    return inCgnatRange(normalised) ? 'accepted' : 'outside-range'
  }

  // A well-formed address we do not admit. A tailnet's own IPv6 range lands
  // here deliberately: supported upstream, unsupported by this daemon.
  if (isIPv6(ip)) return 'unsupported-family'

  // Neither family parsed — malformed or absent socket data. Deliberately NOT
  // guessed into either of the classes above.
  return 'address-unavailable'
}

/**
 * Test whether an IP address (IPv4 or IPv6-mapped IPv4) falls within the
 * Tailscale CGNAT range 100.64.0.0/10.
 *
 * Retained as the accepted-set predicate. Defined in terms of classifyAddress
 * so there is exactly one description of the boundary; a second copy is how the
 * two would drift apart.
 */
export function isTailscaleCIDR(ip: string): boolean {
  return classifyAddress(ip) === 'accepted'
}

/**
 * D-18: Enforce Tailscale CGNAT CIDR (100.64.0.0/10) when daemon is bound to
 * Tailscale or 0.0.0.0. Reads from the raw TCP socket address — never from
 * X-Forwarded-For headers (T-01-03-07 anti-spoof).
 *
 * The refusal CLASS is daemon-internal and must stay that way. Every class maps
 * to one public response — same status, same error code, same fields — so that
 * neither a rejected client nor an authenticated peer can probe which rule
 * refused them. The class goes to stderr with the requestId the upstream
 * request-ID middleware already installed, and the peer address goes nowhere:
 * correlation without retention.
 */
export function cidrMiddleware(): MiddlewareHandler<{
  Bindings: HttpBindings
  Variables: { requestId: string }
}> {
  return async (c, next) => {
    const ip = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
      ?.incoming?.socket?.remoteAddress ?? ''

    const classification = classifyAddress(ip)
    if (classification !== 'accepted') {
      const requestId = c.get('requestId') ?? generateRequestId()
      // Class and correlation ID only — never the raw or normalised peer address.
      agentError(`cidr_refusal requestId=${requestId} class=${classification}`)
      return c.json({ ok: false, error: 'cidr_violation', requestId }, 403)
    }

    await next()
  }
}
