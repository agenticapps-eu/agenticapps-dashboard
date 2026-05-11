import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { makePlist, runInstallLaunchd } from './installLaunchd.js'

describe('makePlist', () => {
  const sample = makePlist('/usr/local/bin/node', '/path/to/dist/cli.js', '/Users/x/.agenticapps/dashboard/logs')

  it('starts with the XML preamble + DOCTYPE', () => {
    expect(sample).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    expect(sample).toContain('<!DOCTYPE plist PUBLIC')
  })
  it('contains Label = eu.agenticapps.dashboard', () => {
    expect(sample).toContain('<key>Label</key>')
    expect(sample).toContain('<string>eu.agenticapps.dashboard</string>')
  })
  it('ProgramArguments has 3 entries: node, cli, start', () => {
    expect(sample).toContain('<string>/usr/local/bin/node</string>')
    expect(sample).toContain('<string>/path/to/dist/cli.js</string>')
    expect(sample).toContain('<string>start</string>')
  })
  it('KeepAlive is true (D-6-06 auto-restart)', () => {
    expect(sample).toMatch(/<key>KeepAlive<\/key>\s*<true\/>/)
  })
  it('RunAtLoad is false (D-6-06 no auto-load)', () => {
    expect(sample).toMatch(/<key>RunAtLoad<\/key>\s*<false\/>/)
  })
  it('PATH includes /opt/homebrew/bin and /usr/local/bin (Pitfall 1)', () => {
    expect(sample).toContain('/opt/homebrew/bin')
    expect(sample).toContain('/usr/local/bin')
  })
  it('StandardOutPath + StandardErrorPath point at the log dir', () => {
    expect(sample).toContain('<string>/Users/x/.agenticapps/dashboard/logs/daemon.log</string>')
    expect(sample).toContain('<string>/Users/x/.agenticapps/dashboard/logs/error.log</string>')
  })
})

// F-007: XML escape of interpolated values. Without escaping, a username
// or path containing `& < > " '` produces invalid XML that launchctl will
// refuse to load. Standard XML 1.0 5-character escape set.
describe('makePlist XML escaping (F-007)', () => {
  it('escapes & as &amp; in interpolated paths', () => {
    const plist = makePlist('/usr/local/bin/node', '/path/with&data/cli.js', '/x/logs')
    expect(plist).toContain('<string>/path/with&amp;data/cli.js</string>')
    expect(plist).not.toContain('<string>/path/with&data/cli.js</string>')
  })
  it('escapes < and > in interpolated paths', () => {
    const plist = makePlist('/usr/local/bin/node', '/path/cli.js', '/Users/<user>/logs')
    expect(plist).toContain('&lt;user&gt;')
    expect(plist).not.toContain('<string>/Users/<user>/logs/daemon.log</string>')
  })
  it('escapes " (double quote) as &quot; in interpolated paths', () => {
    const plist = makePlist('/path/"/node', '/x/cli.js', '/x/logs')
    expect(plist).toContain('&quot;')
    expect(plist).not.toContain('<string>/path/"/node</string>')
  })
  it("escapes ' (single quote) as &apos; in interpolated paths", () => {
    const plist = makePlist("/path/'/node", '/x/cli.js', '/x/logs')
    expect(plist).toContain('&apos;')
  })
  it('produces well-formed XML — no raw < or unescaped & inside <string> elements', () => {
    const plist = makePlist(
      '/path<>&"\'/node',
      '/another<>&"\'/cli.js',
      '/log<>&"\'/dir',
    )
    const stringContents = plist.match(/<string>([^]*?)<\/string>/g) ?? []
    for (const tag of stringContents) {
      const inner = tag.slice('<string>'.length, -'</string>'.length)
      // No raw `<` (would prematurely close the tag).
      expect(inner, `raw '<' in ${tag}`).not.toMatch(/</)
      // Every `&` must be the start of one of the 5 recognized entities.
      // Strip recognized entities, then assert no `&` survives.
      const stripped = inner.replace(/&(amp|lt|gt|quot|apos);/g, '')
      expect(stripped, `unrecognized entity in ${tag}`).not.toMatch(/&/)
    }
  })
  it('does not double-escape pre-escaped output (idempotency check on its own output)', () => {
    // makePlist's output already contains entity references like &amp; in
    // escaped fields. Calling makePlist twice on its own output would re-
    // encode the & in &amp; to &amp;amp; — verify we only escape inputs, not
    // the template literal itself.
    const plist = makePlist('/x/node', '/x/cli.js', '/x/logs')
    // The PATH_VALUE constant contains no metachars; the template's own
    // <true/> <false/> <key>...</key> tags must remain as raw XML.
    expect(plist).toContain('<true/>')
    expect(plist).toContain('<false/>')
    expect(plist).toContain('<key>Label</key>')
    expect(plist).not.toContain('&lt;true/&gt;')
  })
})

describe('runInstallLaunchd', () => {
  let tmpHome: string
  let originalHome: string | undefined

  beforeEach(() => {
    tmpHome = mkdtempSync(join(tmpdir(), 'dashboard-install-launchd-'))
    originalHome = process.env.HOME
    process.env.HOME = tmpHome
  })
  afterEach(() => {
    if (originalHome) process.env.HOME = originalHome
    rmSync(tmpHome, { recursive: true, force: true })
  })

  it('writes plist at the right path with mode 0644', async () => {
    await runInstallLaunchd({})
    const plistPath = join(tmpHome, 'Library', 'LaunchAgents', 'eu.agenticapps.dashboard.plist')
    expect(existsSync(plistPath)).toBe(true)
    expect(statSync(plistPath).mode & 0o777).toBe(0o644)
  })
  it('creates ~/.agenticapps/dashboard/logs at mode 0700', async () => {
    await runInstallLaunchd({})
    const logDir = join(tmpHome, '.agenticapps', 'dashboard', 'logs')
    expect(existsSync(logDir)).toBe(true)
    expect(statSync(logDir).mode & 0o777).toBe(0o700)
  })
  it('bakes process.execPath into ProgramArguments[0]', async () => {
    await runInstallLaunchd({})
    const plistPath = join(tmpHome, 'Library', 'LaunchAgents', 'eu.agenticapps.dashboard.plist')
    expect(readFileSync(plistPath, 'utf8')).toContain(`<string>${process.execPath}</string>`)
  })
  it('is idempotent (second call overwrites, no duplication)', async () => {
    await runInstallLaunchd({})
    await runInstallLaunchd({})
    const plistPath = join(tmpHome, 'Library', 'LaunchAgents', 'eu.agenticapps.dashboard.plist')
    const content = readFileSync(plistPath, 'utf8')
    const labelMatches = content.match(/<key>Label<\/key>/g)
    expect(labelMatches?.length).toBe(1)
  })
  it('--uninstall removes the plist', async () => {
    await runInstallLaunchd({})
    await runInstallLaunchd({ uninstall: true })
    const plistPath = join(tmpHome, 'Library', 'LaunchAgents', 'eu.agenticapps.dashboard.plist')
    expect(existsSync(plistPath)).toBe(false)
  })
  it('--uninstall on missing plist is a silent no-op', async () => {
    await expect(runInstallLaunchd({ uninstall: true })).resolves.toBeUndefined()
  })
  it('prints next-steps containing launchctl load on install', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runInstallLaunchd({})
    const logged = logSpy.mock.calls.flat().join('\n')
    expect(logged).toContain('launchctl load')
    logSpy.mockRestore()
  })
})
