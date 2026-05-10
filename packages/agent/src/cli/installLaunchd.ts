/**
 * POLISH-02 install-launchd — writes ~/Library/LaunchAgents/eu.agenticapps.dashboard.plist
 * Per D-6-04..07 + RESEARCH Pattern 2 + Pitfalls 1, 4, 5.
 */
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const LABEL = 'eu.agenticapps.dashboard'
const PLIST_RELATIVE = join('Library', 'LaunchAgents', `${LABEL}.plist`)
const LOG_DIR_RELATIVE = join('.agenticapps', 'dashboard', 'logs')
// Pitfall 1: launchd does NOT inherit login shell PATH — must supply explicitly
const PATH_VALUE = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'

export function makePlist(nodeBinary: string, cliPath: string, logDir: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodeBinary}</string>
    <string>${cliPath}</string>
    <string>start</string>
  </array>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>${logDir}/daemon.log</string>
  <key>StandardErrorPath</key>
  <string>${logDir}/error.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${PATH_VALUE}</string>
  </dict>
</dict>
</plist>
`
}

function resolveCliPath(): string {
  // Pitfall 5: resolve via import.meta.url, not process.argv[1] (which is source path in dev).
  // tsup bundles dynamic imports into a sibling chunk in dist/ (e.g. dist/installLaunchd-XXXX.js),
  // so import.meta.url points to a file in the dist/ directory; cli.js is in that same dir.
  const here = dirname(fileURLToPath(import.meta.url))
  return resolve(here, 'cli.js')
}

export interface InstallLaunchdOpts {
  uninstall?: boolean
}

export async function runInstallLaunchd(opts: InstallLaunchdOpts = {}): Promise<void> {
  const home = homedir()
  const plistPath = join(home, PLIST_RELATIVE)

  if (opts.uninstall) {
    if (existsSync(plistPath)) {
      unlinkSync(plistPath)
      console.log(`plist removed -> ${plistPath}`)
      console.log(`(if loaded: launchctl unload ${plistPath})`)
    } else {
      console.log(`no plist installed at ${plistPath} (nothing to remove)`)
    }
    return
  }

  const nodeBinary = process.execPath
  const cliPath = resolveCliPath()
  const logDir = join(home, LOG_DIR_RELATIVE)
  const launchAgentsDir = join(home, 'Library', 'LaunchAgents')

  // Pitfall 4: ~/Library/LaunchAgents/ may not exist on fresh macOS accounts
  mkdirSync(launchAgentsDir, { recursive: true })
  // D-6-06: logs dir mode 0700 — prevents other local users reading daemon stdout/stderr
  mkdirSync(logDir, { recursive: true, mode: 0o700 })
  // plist mode 0644 — launchctl (separate process) must be able to read it; no secrets in plist
  writeFileSync(plistPath, makePlist(nodeBinary, cliPath, logDir), { mode: 0o644 })

  console.log(`plist installed -> ${plistPath}`)
  console.log('')
  console.log('To start now:')
  console.log(`  launchctl load ${plistPath}`)
  console.log('')
  console.log('To start at login (persistent):')
  console.log(`  launchctl enable gui/$(id -u)/${LABEL}`)
  console.log('')
  console.log('To stop:')
  console.log(`  launchctl unload ${plistPath}`)
  console.log('')
  console.log(`Logs: ${logDir}/daemon.log + ${logDir}/error.log`)
}
