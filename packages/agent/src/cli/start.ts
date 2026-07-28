import { isIPv4, isIPv6 } from 'node:net'

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
import { formatUrlHost } from '../lib/banner.js'
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
 * Error thrown when `--bind` is given a value that is not a supported literal.
 *
 * This exists because the previous fallthrough FAILED OPEN: anything the
 * classifier did not recognise was called loopback, which silently means no
 * CIDR middleware and no all-interfaces warning. `--bind 0` is the sharp case —
 * the strict IPv4 test rejects it, but Node's listen() resolves `0` to
 * `0.0.0.0`, so the daemon bound every interface with no boundary and printed
 * nothing unusual. Hostnames behaved the same way and could resolve anywhere.
 */
export class UnsupportedBindError extends Error {
  constructor(bind: string) {
    super(
      `Unsupported --bind value ${JSON.stringify(bind)}. Use \`tailscale\`, or an ` +
        'explicit IPv4 or IPv6 literal such as `127.0.0.1`, `::1`, `0.0.0.0` or ' +
        '`::`. Hostnames and shorthand forms are refused because they can ' +
        'resolve to a public interface, which would start the daemon with no ' +
        'tailnet boundary and no warning.',
    )
    this.name = 'UnsupportedBindError'
  }
}

/**
 * Expand an IPv6 literal to its 16 bytes, or null when it is not valid IPv6.
 *
 * The unspecified address and loopback each have many legal spellings (`::`,
 * `::0`, `0:0:0:0:0:0:0:0`). Comparing the literal by string equality is what
 * let `--bind ::0` escape the all-interfaces path entirely, so the comparison
 * is done on bytes instead of on text.
 */
function ipv6Bytes(literal: string): number[] | null {
  if (!isIPv6(literal)) return null

  let text = literal
  const zone = text.indexOf('%')
  if (zone !== -1) text = text.slice(0, zone)

  // A trailing dotted quad (`::ffff:1.2.3.4`) stands in for the last two groups.
  const embedded = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text)
  if (embedded) {
    const octets = embedded[1]!.split('.').map(Number)
    if (octets.some((n) => n > 255)) return null
    text =
      text.slice(0, embedded.index) +
      (((octets[0]! << 8) | octets[1]!).toString(16)) +
      ':' +
      (((octets[2]! << 8) | octets[3]!).toString(16))
  }

  const halves = text.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const groups =
    halves.length === 2
      ? [...head, ...Array<string>(8 - head.length - tail.length).fill('0'), ...tail]
      : head
  if (groups.length !== 8) return null

  const bytes: number[] = []
  for (const group of groups) {
    const value = Number.parseInt(group, 16)
    if (!Number.isInteger(value) || value < 0 || value > 0xffff) return null
    bytes.push((value >> 8) & 0xff, value & 0xff)
  }
  return bytes
}

/** The unspecified address `::`, in any spelling. Binds every interface. */
function isUnspecifiedIPv6(host: string): boolean {
  const bytes = ipv6Bytes(host)
  return bytes !== null && bytes.every((b) => b === 0)
}

/** The loopback address `::1`, in any spelling. */
function isLoopbackIPv6(host: string): boolean {
  const bytes = ipv6Bytes(host)
  return bytes !== null && bytes[15] === 1 && bytes.slice(0, 15).every((b) => b === 0)
}

/**
 * An IPv6 literal that is neither loopback nor the wildcard. Those two are
 * excluded because they are usable: loopback is local, and the wildcard can
 * carry IPv6-mapped CGNAT IPv4 peers.
 */
function isSpecificNonLoopbackIPv6(host: string): boolean {
  return isIPv6(host) && !isUnspecifiedIPv6(host) && !isLoopbackIPv6(host)
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
 * A value that parses as neither family is REFUSED. It used to be treated as
 * loopback, which meant an unrecognised bind ran with no boundary and no
 * warning — the same failure this change exists to close, reached by a
 * different door.
 */
export function classifyExplicitBind(bind: string): { host: string; bindMode: BindMode } {
  if (isIPv4(bind)) {
    if (bind === '0.0.0.0') return { host: bind, bindMode: '0.0.0.0' }
    if (bind === '127.0.0.1') return { host: bind, bindMode: 'loopback' }
    return { host: bind, bindMode: 'tailscale' }
  }

  if (isIPv6(bind)) {
    if (isUnspecifiedIPv6(bind)) return { host: bind, bindMode: '0.0.0.0' }
    if (isLoopbackIPv6(bind)) return { host: bind, bindMode: 'loopback' }
    return { host: bind, bindMode: 'tailscale' }
  }

  // Fail closed. Anything else is refused rather than assumed harmless.
  throw new UnsupportedBindError(bind)
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
    // bindMode on this path is always 'tailscale', so enforcement is on unless
    // the operator opted out. That decision has to reach address validation:
    // refusing to start on a non-CGNAT address is the boundary talking, and
    // --no-enforce-cidr is the operator switching the boundary off.
    const enforcing = shouldEnforceCidr('tailscale', opts.enforceCidr)
    // D-17: resolve Tailscale IP; refuse with exact remediation message if absent
    try {
      const ip = await getTailscaleIP({ requireCgnat: enforcing })
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
    let plan: { host: string; bindMode: BindMode }
    try {
      plan = classifyExplicitBind(opts.bind)
    } catch (e) {
      if (e instanceof UnsupportedBindError) {
        agentError(e.message)
        process.exit(1)
      }
      throw e
    }
    host = plan.host
    // IPv6 literals must be bracketed inside a URL authority.
    pairHostname = `${formatUrlHost(host)}:${port}`
    bindMode = plan.bindMode
  }

  const enforceCIDR = shouldEnforceCidr(bindMode, opts.enforceCidr)

  // Fail before startup rather than serving nobody (ADR 0002).
  if (enforceCIDR && isSpecificNonLoopbackIPv6(host)) {
    agentError(new Ipv6BindNotSupportedError(host).message)
    process.exit(1)
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
