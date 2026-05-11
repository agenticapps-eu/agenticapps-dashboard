import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

// Resolve relative to this file (ESM-safe under workspace vitest, where
// process.cwd() can be either the repo root or a per-package dir).
// Symmetry with the 9f28cf3 fix in packages/spa/src/styles/{noOrange,tokenSourceOfTruth}.test.ts.
const here = dirname(fileURLToPath(import.meta.url))
const readme = readFileSync(resolve(here, '..', '..', 'README.md'), 'utf8')

describe('README structure (POLISH-06 / D-6-15)', () => {
  const required = [
    '## Install',
    '## Pair',
    '## FAQ',
    '## Troubleshooting',
    '## Architecture',
    '## License',
  ]

  it('contains all required H2 sections', () => {
    for (const section of required) {
      expect(readme, `missing section: ${section}`).toContain(section)
    }
  })

  it('H2 sections appear in the locked order', () => {
    const positions = required.map((s) => readme.indexOf(s))
    for (let i = 1; i < positions.length; i++) {
      expect(
        positions[i],
        `${required[i]} must come after ${required[i - 1]}`,
      ).toBeGreaterThan(positions[i - 1])
    }
  })

  it('FAQ has at least 8 numbered entries', () => {
    const faqStart = readme.indexOf('## FAQ')
    const faqEnd = readme.indexOf('## Troubleshooting')
    const faqSection = readme.slice(faqStart, faqEnd)
    const numbered = faqSection.match(/^\d+\./gm) ?? []
    expect(numbered.length).toBeGreaterThanOrEqual(8)
  })

  it('Troubleshooting has at least 6 numbered entries', () => {
    const trStart = readme.indexOf('## Troubleshooting')
    const trEnd = readme.indexOf('## Architecture')
    const trSection = readme.slice(trStart, trEnd)
    const numbered = trSection.match(/^\d+\./gm) ?? []
    expect(numbered.length).toBeGreaterThanOrEqual(6)
  })

  it('Install section references both install-launchd and install-systemd', () => {
    const installStart = readme.indexOf('## Install')
    const installEnd = readme.indexOf('## Pair')
    const installSection = readme.slice(installStart, installEnd)
    expect(installSection).toContain('install-launchd')
    expect(installSection).toContain('install-systemd')
  })

  it('Troubleshooting references PATH, Windows, and append:', () => {
    const trStart = readme.indexOf('## Troubleshooting')
    const trEnd = readme.indexOf('## Architecture')
    const trSection = readme.slice(trStart, trEnd)
    expect(trSection, 'Pitfall 1 LaunchAgent PATH').toContain('PATH')
    expect(trSection, 'D-6-08 Windows-not-supported').toContain('Windows')
    expect(trSection, 'Pitfall 6 systemd append:').toContain('append:')
  })

  it('License section mentions Phase 8 deferral', () => {
    const licStart = readme.indexOf('## License')
    const licSection = readme.slice(licStart)
    expect(licSection).toMatch(/Phase 8|deferred/i)
  })
})
