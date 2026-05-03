import { execa } from 'execa'

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
 * Retrieve the Tailscale IPv4 address via `tailscale ip -4`.
 * Throws TailscaleNotDetectedError when binary is absent or daemon is not running (D-17).
 * T-01-05-05: explicit timeout to prevent start hanging on subprocess.
 */
export async function getTailscaleIP(): Promise<string> {
  try {
    const { stdout } = await execa('tailscale', ['ip', '-4'], { timeout: 5_000 })
    const ip = stdout.trim()
    if (!ip) throw new TailscaleNotDetectedError()
    return ip
  } catch (e) {
    if (e instanceof TailscaleNotDetectedError) throw e
    throw new TailscaleNotDetectedError()
  }
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
    const { stdout } = await execa('tailscale', ['status', '--json'], { timeout: 5_000 })
    const status = JSON.parse(stdout) as {
      Self?: { DNSName?: string; TailscaleIPs?: string[] }
    }
    // Strip trailing dot per RESEARCH key finding 5 (Pitfall 5)
    const dnsName = status.Self?.DNSName?.replace(/\.$/, '')
    if (dnsName && dnsName.length > 0) return dnsName
  } catch {
    // Fall through to IP fallback (D-19)
  }
  return fallbackIp
}
