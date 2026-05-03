import type { MiddlewareHandler } from 'hono'
import type { HttpBindings } from '@hono/node-server'

import { TAILSCALE_CIDR_BASE, TAILSCALE_CIDR_PREFIX } from '../../constants.js'
import { generateRequestId } from '../../lib/logging.js'

/**
 * Test whether an IP address (IPv4 or IPv6-mapped IPv4) falls within the
 * Tailscale CGNAT range 100.64.0.0/10.
 *
 * RESEARCH Pitfall 3: Node.js surfaces IPv6-mapped IPv4 addresses as
 * `::ffff:100.64.x.x`. Strip the `::ffff:` prefix before numeric check.
 */
export function isTailscaleCIDR(ip: string): boolean {
  // Strip IPv6-mapped IPv4 prefix
  const clean = ip.replace(/^::ffff:/i, '')

  const parts = clean.split('.').map(Number)
  if (parts.length !== 4) return false
  if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false

  const num =
    (((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0)

  const mask = (~((1 << (32 - TAILSCALE_CIDR_PREFIX)) - 1)) >>> 0
  return (num & mask) === (TAILSCALE_CIDR_BASE & mask)
}

/**
 * D-18: Enforce Tailscale CGNAT CIDR (100.64.0.0/10) when daemon is bound to
 * Tailscale or 0.0.0.0. Reads from the raw TCP socket address — never from
 * X-Forwarded-For headers (T-01-03-07 anti-spoof).
 */
export function cidrMiddleware(): MiddlewareHandler<{
  Bindings: HttpBindings
  Variables: { requestId: string }
}> {
  return async (c, next) => {
    const ip = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)
      ?.incoming?.socket?.remoteAddress ?? ''
    if (!isTailscaleCIDR(ip)) {
      const requestId = c.get('requestId') ?? generateRequestId()
      return c.json({ ok: false, error: 'cidr_violation', requestId }, 403)
    }
    await next()
  }
}
