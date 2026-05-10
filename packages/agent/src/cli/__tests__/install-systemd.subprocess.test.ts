import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execa } from 'execa'

const CLI = resolve(__dirname, '..', '..', '..', 'dist', 'cli.js')

describe('install-systemd subprocess', () => {
  let tmpHome: string
  beforeEach(() => { tmpHome = mkdtempSync(join(tmpdir(), 'dashboard-is-sub-')) })
  afterEach(() => { rmSync(tmpHome, { recursive: true, force: true }) })

  it('writes unit file + log dir + prints next-steps when invoked through the built CLI', async () => {
    const result = await execa('node', [CLI, 'install-systemd'], {
      env: { ...process.env, HOME: tmpHome },
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('systemctl --user')
    expect(result.stdout).toContain('loginctl enable-linger')

    const unitPath = join(tmpHome, '.config', 'systemd', 'user', 'eu.agenticapps.dashboard.service')
    expect(existsSync(unitPath)).toBe(true)
    expect(statSync(unitPath).mode & 0o777).toBe(0o644)

    const content = readFileSync(unitPath, 'utf8')
    expect(content).toContain('[Service]')
    expect(content).toContain(process.execPath)
    expect(content).toContain('Restart=on-failure')
    expect(content).toContain('WantedBy=default.target')

    const logDir = join(tmpHome, '.agenticapps', 'dashboard', 'logs')
    expect(existsSync(logDir)).toBe(true)
    expect(statSync(logDir).mode & 0o777).toBe(0o700)
  })

  it('install-systemd --uninstall removes the unit file', async () => {
    await execa('node', [CLI, 'install-systemd'], { env: { ...process.env, HOME: tmpHome } })
    const unitPath = join(tmpHome, '.config', 'systemd', 'user', 'eu.agenticapps.dashboard.service')
    expect(existsSync(unitPath)).toBe(true)

    const result = await execa('node', [CLI, 'install-systemd', '--uninstall'], {
      env: { ...process.env, HOME: tmpHome },
    })
    expect(result.exitCode).toBe(0)
    expect(existsSync(unitPath)).toBe(false)
  })

  it('install-systemd is idempotent (two consecutive runs leave one unit)', async () => {
    await execa('node', [CLI, 'install-systemd'], { env: { ...process.env, HOME: tmpHome } })
    await execa('node', [CLI, 'install-systemd'], { env: { ...process.env, HOME: tmpHome } })
    const unitPath = join(tmpHome, '.config', 'systemd', 'user', 'eu.agenticapps.dashboard.service')
    const content = readFileSync(unitPath, 'utf8')
    const sectionMatches = content.match(/\[Service\]/g)
    expect(sectionMatches?.length).toBe(1)
  })
})
