import { describe, it, expect } from 'vitest'

import {
  SkillFrontmatterSchema,
  SkillEntrySchema,
  GlobalSkillsResponseSchema,
  LocalSkillsResponseSchema,
} from './skills.js'

describe('SkillFrontmatterSchema', () => {
  it('parses a minimal frontmatter with only name', () => {
    const input = { name: 'foo' }
    expect(SkillFrontmatterSchema.parse(input)).toEqual(input)
  })

  it('parses frontmatter with optional description and version', () => {
    const input = { name: 'bar', description: 'A skill', version: '1.0.0' }
    expect(SkillFrontmatterSchema.parse(input)).toEqual(input)
  })

  it('preserves unknown fields via passthrough (paths, disable-model-invocation, allowed-tools)', () => {
    const input = {
      name: 'baz',
      paths: ['/some/path'],
      'disable-model-invocation': true,
      'allowed-tools': ['Bash', 'Read'],
    }
    expect(SkillFrontmatterSchema.parse(input)).toEqual(input)
  })

  it('rejects frontmatter without name', () => {
    expect(() => SkillFrontmatterSchema.parse({ description: 'no name' })).toThrow()
  })
})

describe('SkillEntrySchema', () => {
  it('parses a valid global skill entry', () => {
    const input = { name: 'foo', dir: '/home/user/.claude/skills/foo', scope: 'global' as const }
    expect(SkillEntrySchema.parse(input)).toEqual(input)
  })

  it('parses a valid local skill entry', () => {
    const input = { name: 'foo', dir: '/project/.claude/skills/foo', scope: 'local' as const }
    expect(SkillEntrySchema.parse(input)).toEqual(input)
  })

  it('rejects an invalid scope value', () => {
    expect(() =>
      SkillEntrySchema.parse({ name: 'foo', dir: '/some/dir', scope: 'invalid' })
    ).toThrow()
  })

  it('rejects an entry without dir', () => {
    expect(() => SkillEntrySchema.parse({ name: 'foo', scope: 'global' })).toThrow()
  })
})

describe('GlobalSkillsResponseSchema', () => {
  it('parses a global skills response', () => {
    const input = {
      scope: 'global' as const,
      skills: [{ name: 'foo', dir: '/path/foo', scope: 'global' as const }],
    }
    expect(GlobalSkillsResponseSchema.parse(input)).toEqual(input)
  })

  it('rejects scope: local', () => {
    expect(() =>
      GlobalSkillsResponseSchema.parse({
        scope: 'local',
        skills: [],
      })
    ).toThrow()
  })

  it('round-trip stability: parse → serialize → re-parse equals input', () => {
    const input = {
      scope: 'global' as const,
      skills: [
        { name: 'workflow', dir: '/home/.claude/skills/workflow', scope: 'global' as const },
        { name: 'cso', dir: '/home/.claude/skills/cso', scope: 'global' as const },
      ],
    }
    const serialized = JSON.stringify(GlobalSkillsResponseSchema.parse(input))
    const reparsed = GlobalSkillsResponseSchema.parse(JSON.parse(serialized))
    expect(reparsed).toEqual(input)
  })
})

describe('LocalSkillsResponseSchema', () => {
  it('parses a local skills response', () => {
    const input = {
      scope: 'local' as const,
      skills: [{ name: 'meta-observer', dir: '/proj/.claude/skills/meta-observer', scope: 'local' as const }],
    }
    expect(LocalSkillsResponseSchema.parse(input)).toEqual(input)
  })

  it('rejects scope: global', () => {
    expect(() =>
      LocalSkillsResponseSchema.parse({
        scope: 'global',
        skills: [],
      })
    ).toThrow()
  })

  it('round-trip stability: parse → serialize → re-parse equals input', () => {
    const input = {
      scope: 'local' as const,
      skills: [{ name: 'meta-observer', dir: '/proj/.claude/skills/meta-observer', scope: 'local' as const }],
    }
    const serialized = JSON.stringify(LocalSkillsResponseSchema.parse(input))
    const reparsed = LocalSkillsResponseSchema.parse(JSON.parse(serialized))
    expect(reparsed).toEqual(input)
  })
})
