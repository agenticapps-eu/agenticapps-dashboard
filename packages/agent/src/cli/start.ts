import {
  ensureAuthFile,
  shouldAutoRotate,
  rotateToken,
  assertSecurePermissions,
  InsecurePermissionsError,
} from '../lib/auth.js'
import { ensureRegistryFile } from '../lib/registry.js'
import { assertNoStaleDaemon, StaleDaemonError } from '../lib/pidfile.js'
import { createApp } from '../server/app.js'
import { bootDaemon } from '../server/boot.js'
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

  // TODO(Plan 05): Replace this block with full Tailscale resolution.
  // Plan 05 will replace this tailscale stub with:
  //   - execa('tailscale', ['ip', '-4']) for bind IP
  //   - execa('tailscale', ['status', '--json']) for MagicDNS pairHostname (D-19)
  //   - D-17: refuse with exact remediation message when tailscale not detected
  // For Plan 04 we support only loopback (127.0.0.1) and 0.0.0.0 binds.
  // --bind tailscale falls through to loopback with a warning (lands in Plan 05).
  let host = DEFAULT_HOST
  let bindMode: 'loopback' | 'tailscale' | '0.0.0.0' = 'loopback'

  if (opts.bind === 'tailscale') {
    // STUB: Plan 05 will replace this with real Tailscale integration (D-17, D-19)
    agentError(
      '--bind tailscale not yet wired (lands in Plan 05). Falling back to 127.0.0.1.',
    )
    host = DEFAULT_HOST
    bindMode = 'loopback'
  } else if (opts.bind === '0.0.0.0') {
    host = '0.0.0.0'
    bindMode = '0.0.0.0'
  } else {
    host = opts.bind
    bindMode = 'loopback'
  }

  const enforceCIDR = bindMode !== 'loopback' && opts.enforceCidr !== false

  const app = createApp({ enforceCIDR })
  await bootDaemon({
    app,
    host,
    port,
    pairHostname: `${host}:${port}`,
    bindMode,
  })
}
