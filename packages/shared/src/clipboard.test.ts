/**
 * Tests for clipboard.ts — pure clipboard-string builders (CODEX MED-13 dedup).
 * Both daemon and SPA import from @agenticapps/dashboard-shared; no duplication.
 */

import { describe, it, expect } from 'vitest'

import {
  buildWikiCompileClipboardString,
  buildWorkflowUpdateClipboardString,
  buildClaudeMdHelpUrl,
  buildGitnexusInstallClipboardString,
  buildGitnexusIndexClipboardString,
  buildUnderstandCommand,
} from './clipboard.js'

describe('buildWikiCompileClipboardString', () => {
  it("returns correct string for 'agenticapps' family", () => {
    expect(buildWikiCompileClipboardString('agenticapps')).toBe(
      'cd ~/Sourcecode/agenticapps && claude /wiki-compile'
    )
  })

  it("returns correct string for 'factiv' family", () => {
    expect(buildWikiCompileClipboardString('factiv')).toBe(
      'cd ~/Sourcecode/factiv && claude /wiki-compile'
    )
  })

  it("returns correct string for 'neuroflash' family", () => {
    expect(buildWikiCompileClipboardString('neuroflash')).toBe(
      'cd ~/Sourcecode/neuroflash && claude /wiki-compile'
    )
  })
})

describe('buildWorkflowUpdateClipboardString', () => {
  it('returns the workflow update command', () => {
    expect(buildWorkflowUpdateClipboardString()).toBe('claude /update-agenticapps-workflow')
  })
})

describe('buildClaudeMdHelpUrl', () => {
  it('returns the deep link to the CLAUDE.md help doc', () => {
    expect(buildClaudeMdHelpUrl()).toBe('/help/operations/install#claude-md-bootstrap')
  })
})

describe('buildGitnexusInstallClipboardString', () => {
  it('returns the gitnexus install command', () => {
    expect(buildGitnexusInstallClipboardString()).toBe('npm install -g gitnexus')
  })
})

// Phase 14 D-14-10: buildUnderstandCommand — single source of truth for /understand invocation
describe('buildUnderstandCommand (D-14-10)', () => {
  it('(understand-cmd-1) exact string for agenticapps/claude-workflow matches D-14-10 spec', () => {
    const cmd = buildUnderstandCommand('agenticapps', 'claude-workflow')
    expect(cmd.string).toBe('cd ~/Sourcecode/agenticapps/claude-workflow && claude "/understand"')
  })

  it('(understand-cmd-2) argv deep-equals [\"/understand\"] (future daemon-spawn carrier, Phase 15)', () => {
    const cmd = buildUnderstandCommand('agenticapps', 'claude-workflow')
    expect(cmd.argv).toEqual(['/understand'])
  })

  it('(understand-cmd-3) return object has exactly { string, argv } — no extra keys', () => {
    const cmd = buildUnderstandCommand('factiv', 'cparx')
    const keys = Object.keys(cmd)
    expect(keys).toContain('string')
    expect(keys).toContain('argv')
    expect(keys.length).toBe(2)
  })

  it('(understand-cmd-bonus) interpolates family and repo correctly for another pair', () => {
    const cmd = buildUnderstandCommand('neuroflash', 'nx-backend')
    expect(cmd.string).toBe('cd ~/Sourcecode/neuroflash/nx-backend && claude "/understand"')
  })
})

describe('buildGitnexusIndexClipboardString (10.6 / 13-00)', () => {
  it('returns { string, argv } shape — D-13-10 single source of truth for gitnexus invocation', () => {
    expect(buildGitnexusIndexClipboardString()).toEqual({ string: 'gitnexus analyze', argv: ['analyze'] })
  })

  it('string field is a string', () => {
    const cmd = buildGitnexusIndexClipboardString()
    expect(typeof cmd.string).toBe('string')
  })

  it('argv field is an array of strings', () => {
    const cmd = buildGitnexusIndexClipboardString()
    expect(Array.isArray(cmd.argv)).toBe(true)
    expect(cmd.argv).toEqual(['analyze'])
  })
})
