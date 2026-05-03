import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'

import { discoverProjects, registerInteractive, type DiscoveredMatch } from './discover.js'
import { readRegistry, ensureRegistryFile } from '../lib/registry.js'

let tmpDir: string | null = null

afterEach(() => {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true })
    tmpDir = null
  }
})

function makeTmpParent(): string {
  tmpDir = mkdtempSync(join(tmpdir(), 'discover-test-'))
  return tmpDir
}

/** Create a directory tree under parentDir */
function scaffold(
  parentDir: string,
  structure: Record<string, boolean>, // key = relative path, value = whether to create as dir (false = file)
): void {
  for (const [rel, isDir] of Object.entries(structure)) {
    const full = join(parentDir, rel)
    if (isDir) {
      mkdirSync(full, { recursive: true })
    } else {
      mkdirSync(join(full, '..'), { recursive: true })
      writeFileSync(full, '')
    }
  }
}

describe('discoverProjects', () => {
  it('returns exactly 2 matches from 2 marked + 2 unmarked direct children', () => {
    const parent = makeTmpParent()
    scaffold(parent, {
      // marked via agentic-apps-workflow/SKILL.md
      'marked-via-claude/.claude/skills/agentic-apps-workflow/SKILL.md': false,
      // marked via .planning/config.json
      'marked-via-planning/.planning/config.json': false,
      // unmarked: has a SKILL.md but NOT for the agentic-apps-workflow skill
      'unmarked-1/README.md': false,
      'unmarked-2/.claude/skills/something-else/SKILL.md': false,
    })
    const matches = discoverProjects(parent, { depth: 1 })
    expect(matches).toHaveLength(2)
    const names = matches.map((m) => m.name).sort()
    expect(names).toContain('marked-via-claude')
    expect(names).toContain('marked-via-planning')
  })

  it('respects depth=1 — does NOT recurse beyond direct children', () => {
    const parent = makeTmpParent()
    scaffold(parent, {
      // nested 2 levels deep — should NOT match
      'outer/inner/marked-too-deep/.claude/skills/agentic-apps-workflow/SKILL.md': false,
      // only direct child is 'outer' which has no marker
    })
    const matches = discoverProjects(parent, { depth: 1 })
    expect(matches).toHaveLength(0)
  })

  it('matches .claude/skills/agentic-apps-workflow/SKILL.md as a marker (D-08)', () => {
    const parent = makeTmpParent()
    scaffold(parent, {
      'myproject/.claude/skills/agentic-apps-workflow/SKILL.md': false,
    })
    const matches = discoverProjects(parent, { depth: 1 })
    expect(matches).toHaveLength(1)
    expect(matches[0]?.markers).toContain('agentic-apps-workflow/SKILL.md')
  })

  it('matches .planning/config.json as a marker (D-08)', () => {
    const parent = makeTmpParent()
    scaffold(parent, {
      'myproject/.planning/config.json': false,
    })
    const matches = discoverProjects(parent, { depth: 1 })
    expect(matches).toHaveLength(1)
    expect(matches[0]?.markers).toContain('.planning/config.json')
  })

  it('returns empty array for non-existent parentDir', () => {
    const matches = discoverProjects('/tmp/__nonexistent_parent__', { depth: 1 })
    expect(matches).toHaveLength(0)
  })
})

describe('registerInteractive', () => {
  it('with --yes registers all matches silently and returns per-match results', async () => {
    const parent = makeTmpParent()
    scaffold(parent, {
      'proj-a/.planning/config.json': false,
      'proj-b/.planning/config.json': false,
    })

    // Set up isolated registry for this test
    const regFile = join(parent, 'registry.json')
    ensureRegistryFile(regFile)

    const matches = discoverProjects(parent, { depth: 1 })
    expect(matches).toHaveLength(2)

    // Patch addProject to use isolated registry
    const { addProject } = await import('../lib/registry.js')
    const results = await registerInteractive(matches, {
      yes: true,
      registryFile: regFile,
    })
    expect(results).toHaveLength(2)
    const registered = results.filter((r) => r.reason === 'new')
    expect(registered).toHaveLength(2)
  })

  it('with --dry-run returns matches but does NOT call addProject (registry unchanged)', async () => {
    const parent = makeTmpParent()
    scaffold(parent, {
      'proj-a/.planning/config.json': false,
    })

    const regFile = join(parent, 'registry.json')
    ensureRegistryFile(regFile)

    const matches = discoverProjects(parent, { depth: 1 })
    expect(matches).toHaveLength(1)

    const results = await registerInteractive(matches, {
      dryRun: true,
      registryFile: regFile,
    })
    expect(results).toHaveLength(1)
    expect(results[0]?.reason).toBe('dry-run')
    expect(results[0]?.registered).toBe(false)

    // registry unchanged — no projects added
    const reg = readRegistry(regFile)
    expect(reg.projects).toHaveLength(0)
  })

  it('returns reason=already for a match that was already registered', async () => {
    const parent = makeTmpParent()
    scaffold(parent, {
      'proj-a/.planning/config.json': false,
    })
    const regFile = join(parent, 'registry.json')
    ensureRegistryFile(regFile)

    const matches = discoverProjects(parent, { depth: 1 })
    // Register first
    await registerInteractive(matches, { yes: true, registryFile: regFile })
    // Register again
    const results = await registerInteractive(matches, { yes: true, registryFile: regFile })
    expect(results[0]?.reason).toBe('already')
    expect(results[0]?.registered).toBe(false)
  })
})
