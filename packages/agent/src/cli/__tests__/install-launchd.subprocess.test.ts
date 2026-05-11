import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execa } from 'execa'

const CLI = resolve(__dirname, '..', '..', '..', 'dist', 'cli.js')

describe('install-launchd subprocess', () => {
  let tmpHome: string
  beforeEach(() => { tmpHome = mkdtempSync(join(tmpdir(), 'dashboard-il-sub-')) })
  afterEach(() => { rmSync(tmpHome, { recursive: true, force: true }) })

  it('writes plist + log dir + prints next-steps when invoked through the built CLI', async () => {
    const result = await execa('node', [CLI, 'install-launchd'], {
      env: { ...process.env, HOME: tmpHome },
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('launchctl load')

    const plistPath = join(tmpHome, 'Library', 'LaunchAgents', 'eu.agenticapps.dashboard.plist')
    expect(existsSync(plistPath)).toBe(true)
    expect(statSync(plistPath).mode & 0o777).toBe(0o644)

    const content = readFileSync(plistPath, 'utf8')
    expect(content).toContain('eu.agenticapps.dashboard')
    expect(content).toContain(process.execPath)        // D-6-06: absolute Node binary
    expect(content).toContain('/opt/homebrew/bin')      // Pitfall 1: PATH

    const logDir = join(tmpHome, '.agenticapps', 'dashboard', 'logs')
    expect(existsSync(logDir)).toBe(true)
    expect(statSync(logDir).mode & 0o777).toBe(0o700)
  })

  it('install-launchd --uninstall removes the plist', async () => {
    await execa('node', [CLI, 'install-launchd'], { env: { ...process.env, HOME: tmpHome } })
    const plistPath = join(tmpHome, 'Library', 'LaunchAgents', 'eu.agenticapps.dashboard.plist')
    expect(existsSync(plistPath)).toBe(true)

    const result = await execa('node', [CLI, 'install-launchd', '--uninstall'], {
      env: { ...process.env, HOME: tmpHome },
    })
    expect(result.exitCode).toBe(0)
    expect(existsSync(plistPath)).toBe(false)
  })

  it('install-launchd is idempotent (two consecutive runs leave one plist)', async () => {
    await execa('node', [CLI, 'install-launchd'], { env: { ...process.env, HOME: tmpHome } })
    await execa('node', [CLI, 'install-launchd'], { env: { ...process.env, HOME: tmpHome } })
    const plistPath = join(tmpHome, 'Library', 'LaunchAgents', 'eu.agenticapps.dashboard.plist')
    const content = readFileSync(plistPath, 'utf8')
    const labelMatches = content.match(/<key>Label<\/key>/g)
    expect(labelMatches?.length).toBe(1)
  })
})
