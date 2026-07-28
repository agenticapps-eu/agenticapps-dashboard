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
 * Classify an explicit `--bind` literal into a host + bind mode.
 *
 * Extracted verbatim from runStart so the enforcement-selection rule is
 * reachable as a unit and can be pinned by characterisation tests before
 * `decide-tailnet-ipv6-policy` changes it. Behaviour is unchanged by the
 * extraction itself.
 *
 * Note the `else` branch: today an unrecognised literal — which includes every
 * IPv6 literal — is treated as loopback-equivalent and therefore runs with NO
 * CIDR enforcement. That is the enforcement-selection gap the change closes.
 */
export function classifyExplicitBind(bind: string): { host: string; bindMode: BindMode } {
  if (bind === '0.0.0.0') return { host: '0.0.0.0', bindMode: '0.0.0.0' }
  if (isIPv4(bind)) {
    return { host: bind, bindMode: bind === '127.0.0.1' ? 'loopback' : 'tailscale' }
  }
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
