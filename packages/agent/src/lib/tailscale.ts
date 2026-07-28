import { execa } from 'execa'

import { isTailscaleCIDR } from '../server/middleware/cidr.js'

import { TAILSCALE_SUBPROCESS_TIMEOUT_MS } from '../constants.js'

/**
 * Error thrown when the Tailscale binary is absent or daemon is not running.
 * D-17: exact remediation message per spec.
 */
export class TailscaleNotDetectedError extends Error {
  constructor() {
    super(
      'Tailscale not detected. Install from https://tailscale.com or use --bind 127.0.0.1.',
    )
    this.name = 'TailscaleNotDetectedError'
  }
}

/**
 * Error thrown when Tailscale IS available but this node has no CGNAT IPv4
 * address to bind — an IPv6-only tailnet, or IPv4 disabled on the node.
 *
 * Deliberately a separate type from TailscaleNotDetectedError. They are
 * different operator problems with different fixes, and collapsing them sends
 * someone to reinstall software that is already working. See ADR 0002.
 */
export class TailscaleNoCgnatIPv4Error extends Error {
  constructor() {
    super(
      'Tailscale is running, but this node has no CGNAT IPv4 address. The ' +
        "dashboard's tailnet boundary is IPv4-only — enable IPv4 on this node, " +
        'or use --bind 127.0.0.1.',
    )
    this.name = 'TailscaleNoCgnatIPv4Error'
  }
}

/**
 * Retrieve the Tailscale IPv4 address via `tailscale ip -4`.
 *
 * Two distinct failures (D-17, ADR 0002):
 *   - the command cannot run at all      → TailscaleNotDetectedError
 *   - it runs but yields no CGNAT IPv4   → TailscaleNoCgnatIPv4Error
 *
 * The address is validated against the admission boundary rather than merely
 * parsed. Binding an address the daemon's own CIDR check would refuse produces
 * a daemon that starts cleanly and serves nobody, which is exactly the outcome
 * the design rejects — better to fail before startup and say why.
 *
 * T-01-05-05: explicit timeout to prevent start hanging on subprocess.
 */
export async function getTailscaleIP(): Promise<string> {
  let stdout: string
  try {
    const result = await execa('tailscale', ['ip', '-4'], {
      timeout: TAILSCALE_SUBPROCESS_TIMEOUT_MS,
    })
    stdout = result.stdout
  } catch {
    // Binary absent, daemon down, non-zero exit, or timeout — in every case the
    // installation is unavailable and we learned nothing about its addresses.
    throw new TailscaleNotDetectedError()
  }

  // `tailscale ip -4` prints one address per line; take the first.
  const ip = stdout.trim().split('\n')[0]?.trim() ?? ''
  if (!isTailscaleCIDR(ip)) throw new TailscaleNoCgnatIPv4Error()
  return ip
}

/**
 * Return the MagicDNS hostname (trailing dot stripped per RESEARCH key finding 5)
 * or fallbackIp on any failure (D-19).
 *
 * `tailscale status --json` returns `Self.DNSName` as FQDN with trailing dot,
 * e.g. `devbox.tailfa84dd.ts.net.` — strip it before use in pair URL.
 * T-01-05-05: explicit timeout to prevent start hanging on subprocess.
 */
export async function getTailscaleHostname(fallbackIp: string): Promise<string> {
  try {
    const { stdout } = await execa('tailscale', ['status', '--json'], { timeout: TAILSCALE_SUBPROCESS_TIMEOUT_MS })
    const status = JSON.parse(stdout) as {
      Self?: { DNSName?: string; TailscaleIPs?: string[] }
    }
    // Strip trailing dot per RESEARCH key finding 5 (Pitfall 5)
    const dnsName = status.Self?.DNSName?.replace(/\.$/, '')
    // Defense-in-depth: only trust well-formed MagicDNS names ending in .ts.net.
    // A malformed/spoofed value (e.g. injected via crafted tailscale state) falls back to IP.
    if (dnsName && /^[a-zA-Z0-9.-]+\.ts\.net$/.test(dnsName)) return dnsName
  } catch {
    // Fall through to IP fallback (D-19)
  }
  return fallbackIp
}
