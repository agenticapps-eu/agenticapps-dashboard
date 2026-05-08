/**
 * Tests for skillsScan.ts — SKILL.md frontmatter reader for global + local roots.
 *
 * 14 test cases covering:
 *   1. parseFrontmatter returns null for nonexistent file
 *   2. parseFrontmatter returns null for file without --- delimiters
 *   3. parseFrontmatter reads simple key: value
 *   4. parseFrontmatter handles description: | literal block
 *   5. parseFrontmatter preserves unknown frontmatter fields
 *   6. parseFrontmatter falls back to dirname when name absent
 *   7. readGlobalSkills(nonExistentRoot) returns { scope: 'global', skills: [] }
 *   8. readGlobalSkills reads canonical layout
 *   9. readGlobalSkills reads bundle layout
 *   10. readGlobalSkills skips entries with no SKILL.md
 *   11. readGlobalSkills returns entries sorted alphabetically by dir
 *   12. readGlobalSkills rejects symlinks escaping <root>
 *   13. readLocalSkills mirrors all of the above for local root
 *   14. readLocalSkills returns { scope: 'local', skills: [] } when .claude/skills absent
 */

import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

import { parseFrontmatter, readGlobalSkills, readLocalSkills } from './skillsScan.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpRoot(): { root: string; cleanup: () => void } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'agentic-skills-test-')))
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

/** Write a canonical-layout skill: <root>/<dir>/SKILL.md */
function writeCanonical(root: string, dir: string, content: string): string {
  const dirPath = join(root, dir)
  mkdirSync(dirPath, { recursive: true })
  const absPath = join(dirPath, 'SKILL.md')
  writeFileSync(absPath, content)
  return absPath
}

/** Write a bundle-layout skill: <root>/<dir>/skill/SKILL.md */
function writeBundle(root: string, dir: string, content: string): string {
  const dirPath = join(root, dir, 'skill')
  mkdirSync(dirPath, { recursive: true })
  const absPath = join(dirPath, 'SKILL.md')
  writeFileSync(absPath, content)
  return absPath
}

const MINIMAL_FM = `---
name: test-skill
description: A test skill
---

# Body
`

const LITERAL_BLOCK_FM = `---
name: workflow
description: |
  First line
  Second line
version: 1.0.0
---
`

// ── parseFrontmatter tests ───────────────────────────────────────────────────

describe('parseFrontmatter', () => {
  it('1. returns null for nonexistent file', () => {
    expect(parseFrontmatter('/nonexistent/path/SKILL.md')).toBeNull()
  })

  it('2. returns null for file without --- frontmatter delimiters', () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      const p = join(root, 'SKILL.md')
      writeFileSync(p, '# Just a heading\nNo frontmatter here.\n')
      expect(parseFrontmatter(p)).toBeNull()
    } finally {
      cleanup()
    }
  })

  it('3. reads simple key: value pairs', () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      const p = join(root, 'SKILL.md')
      writeFileSync(p, MINIMAL_FM)
      const fm = parseFrontmatter(p)
      expect(fm).not.toBeNull()
      expect(fm!.name).toBe('test-skill')
      expect(fm!.description).toBe('A test skill')
    } finally {
      cleanup()
    }
  })

  it('4a. handles description: | literal block (multi-line read)', () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      const p = join(root, 'SKILL.md')
      writeFileSync(p, LITERAL_BLOCK_FM)
      const fm = parseFrontmatter(p)
      expect(fm).not.toBeNull()
      // Multi-line literal block: joined with \n, trimEnd
      expect(fm!.description).toBe('First line\nSecond line')
    } finally {
      cleanup()
    }
  })

  it('4b. preserves version alongside literal block', () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      const p = join(root, 'SKILL.md')
      writeFileSync(p, LITERAL_BLOCK_FM)
      const fm = parseFrontmatter(p)
      expect(fm!.version).toBe('1.0.0')
    } finally {
      cleanup()
    }
  })

  it('5. preserves unknown frontmatter fields (passthrough)', () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      const p = join(root, 'SKILL.md')
      writeFileSync(p, `---\nname: foo\npaths: ['*']\n---\n`)
      const fm = parseFrontmatter(p)
      expect(fm).not.toBeNull()
      expect(fm!['paths']).toBeDefined()
    } finally {
      cleanup()
    }
  })

  it('6. falls back to dirname when name field absent (canonical layout)', () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      // Place it at <root>/my-skill/SKILL.md with no name field
      const dir = join(root, 'my-skill')
      mkdirSync(dir, { recursive: true })
      const p = join(dir, 'SKILL.md')
      writeFileSync(p, `---\ndescription: no name here\n---\n`)
      const fm = parseFrontmatter(p)
      expect(fm).not.toBeNull()
      expect(fm!.name).toBe('my-skill')
    } finally {
      cleanup()
    }
  })
})

// ── readGlobalSkills tests ───────────────────────────────────────────────────

describe('readGlobalSkills', () => {
  it('7. returns { scope: "global", skills: [] } when root does not exist', async () => {
    const result = await readGlobalSkills('/nonexistent/path/skills')
    expect(result.scope).toBe('global')
    expect(result.skills).toHaveLength(0)
  })

  it('8. reads canonical layout (<root>/<dir>/SKILL.md)', async () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      writeCanonical(root, 'workflow-skill', MINIMAL_FM)
      const result = await readGlobalSkills(root)
      expect(result.scope).toBe('global')
      expect(result.skills).toHaveLength(1)
      expect(result.skills[0]!.name).toBe('test-skill')
      expect(result.skills[0]!.scope).toBe('global')
      expect(result.skills[0]!.dir).toBe('workflow-skill')
    } finally {
      cleanup()
    }
  })

  it('9. reads bundle layout (<root>/<dir>/skill/SKILL.md)', async () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      writeBundle(root, 'my-bundle-skill', MINIMAL_FM)
      const result = await readGlobalSkills(root)
      expect(result.scope).toBe('global')
      expect(result.skills).toHaveLength(1)
      expect(result.skills[0]!.name).toBe('test-skill')
      expect(result.skills[0]!.scope).toBe('global')
    } finally {
      cleanup()
    }
  })

  it('10. skips entries with no SKILL.md at either layout', async () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      // A dir with no SKILL.md at all
      mkdirSync(join(root, 'empty-dir'), { recursive: true })
      // And one valid skill
      writeCanonical(root, 'valid-skill', MINIMAL_FM)
      const result = await readGlobalSkills(root)
      expect(result.skills).toHaveLength(1)
      expect(result.skills[0]!.dir).toBe('valid-skill')
    } finally {
      cleanup()
    }
  })

  it('11. returns entries sorted alphabetically by dir', async () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      writeCanonical(root, 'z-skill', `---\nname: z-skill\n---\n`)
      writeCanonical(root, 'a-skill', `---\nname: a-skill\n---\n`)
      writeCanonical(root, 'm-skill', `---\nname: m-skill\n---\n`)
      const result = await readGlobalSkills(root)
      expect(result.skills.map((s) => s.dir)).toEqual(['a-skill', 'm-skill', 'z-skill'])
    } finally {
      cleanup()
    }
  })

  it('12. rejects symlinks escaping <root> (planted symlink to /etc)', async () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      // Plant a symlink to /etc inside the root
      symlinkSync('/etc', join(root, 'evil'))
      // Also add a valid skill so we can verify the valid one is still returned
      writeCanonical(root, 'legit-skill', MINIMAL_FM)
      const result = await readGlobalSkills(root)
      const dirs = result.skills.map((s) => s.dir)
      expect(dirs).not.toContain('evil')
      expect(dirs).toContain('legit-skill')
    } finally {
      cleanup()
    }
  })
})

// ── readLocalSkills tests ────────────────────────────────────────────────────

describe('readLocalSkills', () => {
  it('13a. reads canonical layout from <projectRoot>/.claude/skills/', async () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      const skillsRoot = join(root, '.claude', 'skills')
      writeCanonical(skillsRoot, 'my-skill', MINIMAL_FM)
      const result = await readLocalSkills(root)
      expect(result.scope).toBe('local')
      expect(result.skills).toHaveLength(1)
      expect(result.skills[0]!.name).toBe('test-skill')
      expect(result.skills[0]!.scope).toBe('local')
    } finally {
      cleanup()
    }
  })

  it('13b. reads bundle layout from <projectRoot>/.claude/skills/', async () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      const skillsRoot = join(root, '.claude', 'skills')
      writeBundle(skillsRoot, 'bundle-skill', MINIMAL_FM)
      const result = await readLocalSkills(root)
      expect(result.scope).toBe('local')
      expect(result.skills).toHaveLength(1)
      expect(result.skills[0]!.scope).toBe('local')
    } finally {
      cleanup()
    }
  })

  it('13c. rejects symlinks escaping <projectRoot>/.claude/skills', async () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      const skillsRoot = join(root, '.claude', 'skills')
      mkdirSync(skillsRoot, { recursive: true })
      symlinkSync('/etc', join(skillsRoot, 'evil'))
      writeCanonical(skillsRoot, 'legit-skill', MINIMAL_FM)
      const result = await readLocalSkills(root)
      const dirs = result.skills.map((s) => s.dir)
      expect(dirs).not.toContain('evil')
      expect(dirs).toContain('legit-skill')
    } finally {
      cleanup()
    }
  })

  it('14. returns { scope: "local", skills: [] } when <projectRoot>/.claude/skills absent', async () => {
    const { root, cleanup } = makeTmpRoot()
    try {
      // Don't create .claude/skills
      const result = await readLocalSkills(root)
      expect(result.scope).toBe('local')
      expect(result.skills).toHaveLength(0)
    } finally {
      cleanup()
    }
  })
})
