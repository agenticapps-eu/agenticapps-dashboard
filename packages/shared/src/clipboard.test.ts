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
