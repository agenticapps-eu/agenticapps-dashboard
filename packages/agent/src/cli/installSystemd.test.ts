import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { makeSystemdUnit, runInstallSystemd } from './installSystemd.js'

describe('makeSystemdUnit', () => {
  const sample = makeSystemdUnit('/usr/bin/node', '/path/to/dist/cli.js', '/home/x/.agenticapps/dashboard/logs')

  it('starts with [Unit] section', () => {
    expect(sample).toMatch(/^\[Unit\]/)
  })
  it('Description and After=network.target', () => {
    expect(sample).toContain('Description=AgenticApps Dashboard Daemon')
    expect(sample).toContain('After=network.target')
  })
  it('[Service] Type=simple + ExecStart with absolute paths', () => {
    expect(sample).toContain('[Service]')
    expect(sample).toContain('Type=simple')
    expect(sample).toContain('ExecStart=/usr/bin/node /path/to/dist/cli.js start')
  })
  it('Restart=on-failure + RestartSec=5 (D-6-06 + flap-protection)', () => {
    expect(sample).toContain('Restart=on-failure')
    expect(sample).toContain('RestartSec=5')
  })
  it('StandardOutput + StandardError use append: directive (Pitfall 6)', () => {
    expect(sample).toContain('StandardOutput=append:/home/x/.agenticapps/dashboard/logs/daemon.log')
    expect(sample).toContain('StandardError=append:/home/x/.agenticapps/dashboard/logs/error.log')
  })
  it('Environment PATH includes /usr/local/bin (Pitfall 1)', () => {
    expect(sample).toContain('Environment="PATH=/usr/local/bin:/usr/bin:/bin"')
  })
  it('[Install] WantedBy=default.target (user-scope unit)', () => {
    expect(sample).toContain('[Install]')
    expect(sample).toContain('WantedBy=default.target')
  })
})

// F-007: systemd's ExecStart= and StandardOutput= directives have fragile
// parsing (whitespace splits args; quoting is partial). Rather than try to
// auto-quote/escape and risk mangling, validate-and-throw with a clear
// remediation message — the only correct fix on a system with weird paths
// is to either use a saner path or hand-craft the unit file.
describe('makeSystemdUnit input validation (F-007)', () => {
  it('throws when nodeBinary contains whitespace', () => {
    expect(() =>
      makeSystemdUnit('/path with space/node', '/x/cli.js', '/x/logs'),
    ).toThrow(/whitespace/i)
  })
  it('throws when cliPath contains whitespace', () => {
    expect(() =>
      makeSystemdUnit('/x/node', '/path with space/cli.js', '/x/logs'),
    ).toThrow(/whitespace/i)
  })
  it('throws when logDir contains whitespace', () => {
    expect(() =>
      makeSystemdUnit('/x/node', '/x/cli.js', '/path with space/logs'),
    ).toThrow(/whitespace/i)
  })
  it('throws when any path contains " (double quote)', () => {
    expect(() => makeSystemdUnit('/x"y/node', '/x/cli.js', '/x/logs')).toThrow(/unsafe/i)
  })
  it('throws when any path contains backslash', () => {
    expect(() => makeSystemdUnit('/x/node', '/x\\y/cli.js', '/x/logs')).toThrow(/unsafe/i)
  })
  it('throws when any path contains newline', () => {
    expect(() => makeSystemdUnit('/x/node', '/x/cli.js', '/x\nlogs')).toThrow(/whitespace/i)
  })
  it('accepts normal absolute paths without error', () => {
    expect(() =>
      makeSystemdUnit('/usr/bin/node', '/path/to/cli.js', '/home/x/logs'),
    ).not.toThrow()
  })
  it('error message names the offending path (so user knows which to fix)', () => {
    expect(() => makeSystemdUnit('/x/node', '/path with space/cli.js', '/x/logs'))
      .toThrow(/cliPath/)
  })
})

describe('runInstallSystemd', () => {
  let tmpHome: string
  let originalHome: string | undefined

  beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), 'dashboard-install-systemd-'))
    originalHome = process.env.HOME
    process.env.HOME = tmpHome
  })
  afterEach(() => {
    if (originalHome) process.env.HOME = originalHome
    rmSync(tmpHome, { recursive: true, force: true })
  })

  it('writes unit file at the right path with mode 0644', async () => {
    await runInstallSystemd({})
    const unitPath = join(tmpHome, '.config', 'systemd', 'user', 'eu.agenticapps.dashboard.service')
    expect(existsSync(unitPath)).toBe(true)
    expect(statSync(unitPath).mode & 0o777).toBe(0o644)
  })
  it('creates ~/.agenticapps/dashboard/logs at mode 0700', async () => {
    await runInstallSystemd({})
    const logDir = join(tmpHome, '.agenticapps', 'dashboard', 'logs')
    expect(existsSync(logDir)).toBe(true)
    expect(statSync(logDir).mode & 0o777).toBe(0o700)
  })
  it('bakes process.execPath into ExecStart', async () => {
    await runInstallSystemd({})
    const unitPath = join(tmpHome, '.config', 'systemd', 'user', 'eu.agenticapps.dashboard.service')
    expect(readFileSync(unitPath, 'utf8')).toContain(`ExecStart=${process.execPath}`)
  })
  it('is idempotent (second call overwrites, no duplication)', async () => {
    await runInstallSystemd({})
    await runInstallSystemd({})
    const unitPath = join(tmpHome, '.config', 'systemd', 'user', 'eu.agenticapps.dashboard.service')
    const content = readFileSync(unitPath, 'utf8')
    const sectionMatches = content.match(/\[Service\]/g)
    expect(sectionMatches?.length).toBe(1)
  })
  it('--uninstall removes the unit file', async () => {
    await runInstallSystemd({})
    await runInstallSystemd({ uninstall: true })
    const unitPath = join(tmpHome, '.config', 'systemd', 'user', 'eu.agenticapps.dashboard.service')
    expect(existsSync(unitPath)).toBe(false)
  })
  it('--uninstall on missing unit is a silent no-op', async () => {
    await expect(runInstallSystemd({ uninstall: true })).resolves.toBeUndefined()
  })
  it('prints next-steps containing systemctl --user on install', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runInstallSystemd({})
    const logged = logSpy.mock.calls.flat().join('\n')
    expect(logged).toContain('systemctl --user')
    expect(logged).toContain('eu.agenticapps.dashboard')
    logSpy.mockRestore()
  })
  it('prints loginctl enable-linger tip for headless servers', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runInstallSystemd({})
    const logged = logSpy.mock.calls.flat().join('\n')
    expect(logged).toContain('loginctl enable-linger')
    logSpy.mockRestore()
  })
})
