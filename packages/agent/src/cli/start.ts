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
import { createApp } from '../server/app.js'
import { bootDaemon } from '../server/boot.js'
import { getTailscaleIP, getTailscaleHostname, TailscaleNotDetectedError } from '../lib/tailscale.js'
import { agentError } from '../lib/logging.js'
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
  let bindMode: 'loopback' | 'tailscale' | '0.0.0.0' = 'loopback'

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
      if (e instanceof TailscaleNotDetectedError) {
        agentError(e.message)
        process.exit(1)
      }
      throw e
    }
  } else if (opts.bind === '0.0.0.0') {
    // D-20: yellow warning banner BEFORE the daemon banner (printed in bootDaemon via bindMode)
    host = '0.0.0.0'
    pairHostname = `0.0.0.0:${port}`
    bindMode = '0.0.0.0'
  } else if (isIPv4(opts.bind)) {
    // Explicit IPv4: treat as loopback for 127.0.0.1, tailscale-class for anything else
    host = opts.bind
    pairHostname = `${host}:${port}`
    bindMode = host === '127.0.0.1' ? 'loopback' : 'tailscale'
  } else {
    // Unknown string — treat as loopback-equivalent
    host = opts.bind
    pairHostname = `${host}:${port}`
    bindMode = 'loopback'
  }

  // D-18: CIDR enforcement ON by default for non-loopback binds; opt-out via --no-enforce-cidr
  const enforceCIDR = bindMode !== 'loopback' && opts.enforceCidr !== false

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
