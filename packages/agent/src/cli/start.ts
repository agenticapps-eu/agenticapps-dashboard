import { isIPv6 } from 'node:net'

import {
  ensureAuthFile,
  shouldAutoRotate,
  rotateToken,
  assertSecurePermissions,
  InsecurePermissionsError,
} from '../lib/auth.js'
import { ensureViewerSecretFile } from '../lib/viewerToken.js'
import { ensureRegistryFile } from '../lib/registry.js'
import { assertNoStaleDaemon, StaleDaemonError } from '../lib/pidfile.js'
import { createApp, type BindMode } from '../server/app.js'
import { bootDaemon } from '../server/boot.js'
import {
  getTailscaleIP,
  getTailscaleHostname,
  TailscaleNotDetectedError,
  TailscaleNoCgnatIPv4Error,
} from '../lib/tailscale.js'
import { agentError } from '../lib/logging.js'
import { loadEnvFile } from '../lib/envFile.js'
import { AUTH_FILE, DEFAULT_HOST, DEFAULT_PORT } from '../constants.js'

export interface StartOpts {
  /** bind mode: '127.0.0.1' | 'tailscale' | '0.0.0.0' | explicit IP */
  bind: string
  /** port as string (commander stringifies numbers) */
  port: string
  /** CIDR enforcement — commander --no-enforce-cidr sets this to false */
  enforceCidr: boolean
}

/** Returns true for a dotted-quad IPv4 string */
function isIPv4(s: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(s)
}

/**
 * Error thrown when the operator asks for a specific non-loopback IPv6 bind
 * while CIDR enforcement is on.
 *
 * The admission boundary accepts no raw IPv6 (ADR 0002), so such a daemon would
 * start cleanly and then refuse every peer that reached it. Failing before
 * startup makes the policy and the remedy visible instead.
 */
export class Ipv6BindNotSupportedError extends Error {
  constructor(host: string) {
    super(
      `Cannot bind ${host}: the tailnet admission boundary is IPv4-only, so a ` +
        'daemon on a specific IPv6 address would refuse every peer. Bind this ' +
        "node's CGNAT IPv4 address (100.64.0.0/10) or `--bind tailscale` " +
        'instead. To bind it anyway, disable the boundary explicitly with ' +
        '`--no-enforce-cidr`.',
    )
    this.name = 'Ipv6BindNotSupportedError'
  }
}

/**
 * An IPv6 literal that is neither loopback (`::1`) nor the dual-stack wildcard
 * (`::`). Those two are excluded because they are usable: `::1` is loopback,
 * and `::` can carry IPv6-mapped CGNAT IPv4 peers.
 */
function isSpecificNonLoopbackIPv6(host: string): boolean {
  return isIPv6(host) && host !== '::1' && host !== '::'
}

/**
 * Refuse a bind that enforcement would render useless. Called before the
 * server starts; a no-op for every supported combination.
 */
export function assertBindSupported(host: string, enforceCIDR: boolean): void {
  if (enforceCIDR && isSpecificNonLoopbackIPv6(host)) {
    throw new Ipv6BindNotSupportedError(host)
  }
}

/**
 * Classify an explicit `--bind` literal into a host + bind mode.
 *
 * Extracted from runStart so the enforcement-selection rule is reachable as a
 * unit, then extended by decide-tailnet-ipv6-policy to stop swallowing IPv6.
 *
 * Previously every IPv6 literal fell through to the loopback-equivalent branch,
 * so a non-loopback IPv6 bind ran with NO CIDR enforcement. Now:
 *
 *   `::`  is an all-interfaces bind, classed with `0.0.0.0` — it warns, it
 *         enforces, and it can serve IPv6-mapped CGNAT IPv4 peers.
 *   `::1` is loopback, exactly like `127.0.0.1`.
 *   any other IPv6 literal is non-loopback, which means enforcement applies —
 *         and assertBindSupported then refuses it before startup unless the
 *         operator has explicitly opted out.
 *
 * A string that parses as neither family keeps its previous treatment; this
 * change is about addresses, not about tightening input validation.
 */
export function classifyExplicitBind(bind: string): { host: string; bindMode: BindMode } {
  if (bind === '0.0.0.0' || bind === '::') return { host: bind, bindMode: '0.0.0.0' }
  if (bind === '127.0.0.1' || bind === '::1') return { host: bind, bindMode: 'loopback' }
  if (isIPv4(bind)) return { host: bind, bindMode: 'tailscale' }
  if (isIPv6(bind)) return { host: bind, bindMode: 'tailscale' }
  return { host: bind, bindMode: 'loopback' }
}

/**
 * D-18: CIDR enforcement is ON by default for non-loopback binds; the operator
 * opts out explicitly with --no-enforce-cidr.
 */
export function shouldEnforceCidr(bindMode: BindMode, enforceCidrFlag: boolean): boolean {
  return bindMode !== 'loopback' && enforceCidrFlag !== false
}

export async function runStart(opts: StartOpts): Promise<void> {
  // D-04 / DAEMON-04: perms check BEFORE reading token
  try {
    // Check if auth file exists and has correct permissions
    try {
      assertSecurePermissions(AUTH_FILE)
    } catch (e) {
      if (e instanceof InsecurePermissionsError) {
        agentError(e.message)
        process.exit(1)
      }
      // File doesn't exist yet — ensureAuthFile will create it
    }

    ensureRegistryFile()
    let auth = ensureAuthFile()
    ensureViewerSecretFile() // D-14-03: viewer secret alongside bearer token

    // Phase 8 D-08-12/15: load env.json, merge under process.env (must not block start)
    try {
      loadEnvFile()
    } catch (e) {
      agentError(
        `env.json corrupt or unreadable — skipping env merge; run \`env set\` to reset: ${(e as Error).message}`,
      )
      // daemon continues — D-08-15 "never blocks boot" (Pitfall 4)
    }

    // D-14: auto-rotate on version mismatch or 30-day expiry
    if (shouldAutoRotate(auth)) {
      auth = rotateToken()
    }

    assertNoStaleDaemon()
  } catch (e) {
    if (e instanceof StaleDaemonError) {
      agentError(e.message)
      process.exit(1)
    }
    if (e instanceof InsecurePermissionsError) {
      agentError(e.message)
      process.exit(1)
    }
    agentError(`start failed: ${(e as Error).message}`)
    process.exit(1)
  }

  const port = Number.parseInt(opts.port, 10) || DEFAULT_PORT
  let host: string = DEFAULT_HOST
  let pairHostname: string
  let bindMode: BindMode = 'loopback'

  if (opts.bind === 'tailscale') {
    // D-17: resolve Tailscale IP; refuse with exact remediation message if absent
    try {
      const ip = await getTailscaleIP()
      host = ip
      // D-19: use MagicDNS hostname if available; fall back to raw IP
      const dns = await getTailscaleHostname(ip)
      pairHostname = `${dns}:${port}`
      bindMode = 'tailscale'
    } catch (e) {
      // Both are operator setup problems, reported before startup with their
      // own remediation: absent installation vs. a running node with no CGNAT
      // IPv4 address (ADR 0002).
      if (e instanceof TailscaleNotDetectedError || e instanceof TailscaleNoCgnatIPv4Error) {
        agentError(e.message)
        process.exit(1)
      }
      throw e
    }
  } else {
    const plan = classifyExplicitBind(opts.bind)
    host = plan.host
    pairHostname = `${host}:${port}`
    bindMode = plan.bindMode
  }

  const enforceCIDR = shouldEnforceCidr(bindMode, opts.enforceCidr)

  // Fail before startup rather than serving nobody (ADR 0002).
  try {
    assertBindSupported(host, enforceCIDR)
  } catch (e) {
    if (e instanceof Ipv6BindNotSupportedError) {
      agentError(e.message)
      process.exit(1)
    }
    throw e
  }

  const app = createApp({ enforceCIDR, bindMode })
  await bootDaemon({
    app,
    host,
    port,
    pairHostname,
    bindMode,
    enforceCIDR,
  })
}
