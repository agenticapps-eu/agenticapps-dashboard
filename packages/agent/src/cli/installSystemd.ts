/**
 * POLISH-03 install-systemd — writes ~/.config/systemd/user/eu.agenticapps.dashboard.service
 * Per D-6-04..07 + RESEARCH Pattern 3 + Pitfall 6 (append: requires systemd >= 240).
 */
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const UNIT_NAME = 'eu.agenticapps.dashboard.service'
const UNIT_RELATIVE = join('.config', 'systemd', 'user', UNIT_NAME)
const LOG_DIR_RELATIVE = join('.agenticapps', 'dashboard', 'logs')
// Pitfall 1: systemd does NOT inherit login shell PATH — must supply explicitly
// Linux does not have /opt/homebrew (that's macOS); snap bin included for Ubuntu.
const PATH_VALUE = '/usr/local/bin:/usr/bin:/bin'

export function makeSystemdUnit(nodeBinary: string, cliPath: string, logDir: string): string {
  return `[Unit]
Description=AgenticApps Dashboard Daemon
After=network.target

[Service]
Type=simple
ExecStart=${nodeBinary} ${cliPath} start
Restart=on-failure
RestartSec=5
StandardOutput=append:${logDir}/daemon.log
StandardError=append:${logDir}/error.log
Environment="PATH=${PATH_VALUE}"

[Install]
WantedBy=default.target
`
}

function resolveCliPath(): string {
  // tsup bundles dynamic imports as sibling chunks in dist/ (e.g. dist/installSystemd-XXXX.js),
  // so import.meta.url points to a file in dist/; cli.js is in that same directory.
  const here = dirname(fileURLToPath(import.meta.url))
  return resolve(here, 'cli.js')
}

export interface InstallSystemdOpts {
  uninstall?: boolean
}

export async function runInstallSystemd(opts: InstallSystemdOpts = {}): Promise<void> {
  const home = homedir()
  const unitPath = join(home, UNIT_RELATIVE)

  if (opts.uninstall) {
    if (existsSync(unitPath)) {
      unlinkSync(unitPath)
      console.log(`unit removed -> ${unitPath}`)
      console.log('(if enabled: systemctl --user disable --now eu.agenticapps.dashboard)')
      console.log('(then run: systemctl --user daemon-reload)')
    } else {
      console.log(`no unit installed at ${unitPath} (nothing to remove)`)
    }
    return
  }

  const nodeBinary = process.execPath
  const cliPath = resolveCliPath()
  const logDir = join(home, LOG_DIR_RELATIVE)
  const unitDir = dirname(unitPath)

  // Ensure ~/.config/systemd/user/ exists (may not exist on fresh Linux installs)
  mkdirSync(unitDir, { recursive: true })
  // D-6-06: logs dir mode 0700 — prevents other local users reading daemon stdout/stderr
  mkdirSync(logDir, { recursive: true, mode: 0o700 })
  // unit mode 0644 — systemd (separate process) must be able to read it; no secrets in unit
  writeFileSync(unitPath, makeSystemdUnit(nodeBinary, cliPath, logDir), { mode: 0o644 })

  console.log(`unit installed -> ${unitPath}`)
  console.log('')
  console.log('To start now:')
  console.log('  systemctl --user start eu.agenticapps.dashboard')
  console.log('')
  console.log('To enable at login:')
  console.log('  systemctl --user enable eu.agenticapps.dashboard')
  console.log('')
  console.log('To check status:')
  console.log('  systemctl --user status eu.agenticapps.dashboard')
  console.log('')
  console.log('Tip: if running on a headless server where your user session ends on logout,')
  console.log('enable lingering so user services start without an active login session:')
  console.log('  sudo loginctl enable-linger $USER')
  console.log('')
  console.log(`Logs: ${logDir}/daemon.log + ${logDir}/error.log`)
  console.log('')
  console.log('Note: StandardOutput=append: requires systemd >= 240 (Ubuntu 20.04+, Debian 10+).')
  console.log("On older systems, edit the unit file and change 'append:' to 'file:' (truncate mode).")
}
