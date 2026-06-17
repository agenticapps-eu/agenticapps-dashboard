/**
 * claudeMdLevelScanner.test.ts — per-rung + strict-cumulative + L5-inferred + degraded tests.
 *
 * TDD RED phase: tests written first, scanner not yet implemented.
 *
 * Harness mirrors overrideSentinelScanner.test.ts exactly:
 *   - mkdtempSync tmp repo in beforeEach, rmSync in afterEach
 *   - makePermissiveResolver (realpathSync-based, throws PathViolation outside root)
 *   - initGitRepoWithClaudeMd helper
 *
 * Test structure:
 *   describe L0 (absent)
 *   describe L1 (basic — git-tracked vs untracked)
 *   describe L2 (scoped — MUST/NEVER)
 *   describe L3 (structured — @import / multi-file)
 *   describe L4 (abstracted — .claude/rules/*.md with paths: frontmatter)
 *   describe L5 (maintained — mtime proxy / backbone-doc proxy)
 *   describe L6 (adaptive - .claude/skills/<skill>/SKILL.md + mcp.json)
 *   describe strict-cumulative capping
 *   describe nextSteps advice strings
 *   describe degraded / never-throws
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, realpathSync, utimesSync } from 'node:fs'
import { join, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { scanClaudeMdLevel } from './claudeMdLevelScanner.js'
import { PathViolation } from '../coverageResolver.js'
import type { PathResolver } from '../coverageResolver.js'

let tmpRepo: string

beforeEach(() => {
  tmpRepo = mkdtempSync(join(tmpdir(), 'claude-md-level-'))
})

afterEach(() => {
  rmSync(tmpRepo, { recursive: true, force: true })
})

// ── Test helpers ──────────────────────────────────────────────────────────────

/** A permissive resolver that allows everything under repoRoot. */
function makePermissiveResolver(repoRoot: string): PathResolver {
  return (candidatePath, _opts) => {
    let real: string
    try {
      real = realpathSync(candidatePath)
    } catch {
      throw new PathViolation(`not accessible: ${candidatePath}`)
    }
    let realRoot: string
    try {
      realRoot = realpathSync(repoRoot)
    } catch {
      realRoot = repoRoot
    }
    if (real !== realRoot && !real.startsWith(realRoot + sep)) {
      throw new PathViolation(`outside allowed roots: ${real}`)
    }
    return real
  }
}

/** Initialize a bare git repo and commit a CLAUDE.md. */
function initGitRepoWithClaudeMd(dir: string, content = '# Instructions\n\nMUST follow rules.\n'): void {
  execFileSync('git', ['init', '-b', 'main'], { cwd: dir, encoding: 'utf8' })
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir })
  writeFileSync(join(dir, 'CLAUDE.md'), content)
  execFileSync('git', ['add', 'CLAUDE.md'], { cwd: dir })
  execFileSync('git', ['commit', '-m', 'add CLAUDE.md'], { cwd: dir })
}

// ── L0: absent ────────────────────────────────────────────────────────────────

describe('L0: absent', () => {
  it('returns level 0 when no CLAUDE.md or AGENTS.md exists', () => {
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.level).toBe(0)
    expect(result.rungs).toHaveLength(6)
    expect(result.rungs.every(r => !r.passed)).toBe(true)
  })

  it('has levelLabel "Absent" when level is 0', () => {
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.levelLabel).toBe('Absent')
  })

  it('has all 6 rungs in order L1..L6', () => {
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[0]!.rung).toBe(1)
    expect(result.rungs[1]!.rung).toBe(2)
    expect(result.rungs[2]!.rung).toBe(3)
    expect(result.rungs[3]!.rung).toBe(4)
    expect(result.rungs[4]!.rung).toBe(5)
    expect(result.rungs[5]!.rung).toBe(6)
  })
})

// ── L1: basic — git-tracked check ────────────────────────────────────────────

describe('L1: basic — git-tracked', () => {
  it('returns level >= 1 when CLAUDE.md exists and is git-tracked', () => {
    initGitRepoWithClaudeMd(tmpRepo)
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.level).toBeGreaterThanOrEqual(1)
    expect(result.rungs[0]!.passed).toBe(true)
  })

  it('L1 rung label is "Basic"', () => {
    initGitRepoWithClaudeMd(tmpRepo)
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[0]!.label).toBe('Basic')
  })

  it('returns level 0 when CLAUDE.md exists but is NOT git-tracked (no git init)', () => {
    writeFileSync(join(tmpRepo, 'CLAUDE.md'), '# Instructions\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[0]!.passed).toBe(false)
    expect(result.level).toBe(0)
  })

  it('accepts AGENTS.md as the instruction file (L1 alternative)', () => {
    execFileSync('git', ['init', '-b', 'main'], { cwd: tmpRepo, encoding: 'utf8' })
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpRepo })
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpRepo })
    writeFileSync(join(tmpRepo, 'AGENTS.md'), '# AGENTS\n')
    execFileSync('git', ['add', 'AGENTS.md'], { cwd: tmpRepo })
    execFileSync('git', ['commit', '-m', 'add AGENTS.md'], { cwd: tmpRepo })
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[0]!.passed).toBe(true)
    expect(result.level).toBeGreaterThanOrEqual(1)
  })
})

// ── L2: scoped — MUST/MUST NOT/NEVER ─────────────────────────────────────────

describe('L2: scoped — MUST/NEVER constraints', () => {
  it('rungs[1].passed is true when content contains "MUST"', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[1]!.passed).toBe(true)
    expect(result.rungs[1]!.label).toBe('Scoped')
  })

  it('rungs[1].passed is true when content contains "NEVER"', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nNEVER do X.\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[1]!.passed).toBe(true)
  })

  it('rungs[1].passed is true when content contains "MUST NOT"', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST NOT do Y.\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[1]!.passed).toBe(true)
  })

  it('rungs[1].passed is false when content has no constraint keywords', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nDo something.\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[1]!.passed).toBe(false)
    // L1 still passes, but headline caps at 1
    expect(result.level).toBe(1)
  })
})

// ── L3: structured — @import / multi-file ─────────────────────────────────────

describe('L3: structured — @import or multi-file', () => {
  it('rungs[2].passed is true when content has @import reference', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[2]!.passed).toBe(true)
    expect(result.rungs[2]!.label).toBe('Structured')
  })

  it('rungs[2].passed is true via multi-file: CLAUDE.md + .md directly under .claude/', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n')
    // Add a .md file directly under .claude/ (not in rules/ or skills/)
    mkdirSync(join(tmpRepo, '.claude'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'STYLE.md'), '# Style\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[2]!.passed).toBe(true)
  })

  it('rungs[2].passed is false when content has no @import and only one instruction file', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[2]!.passed).toBe(false)
  })

  it('.md files inside .claude/rules/ do NOT count for multi-file L3', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n')
    mkdirSync(join(tmpRepo, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'rules', 'x.md'), '---\npaths: [/]\n---\n# Rule\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    // rules/ files excluded from L3 multi-file count
    expect(result.rungs[2]!.passed).toBe(false)
  })
})

// ── L4: abstracted — .claude/rules/*.md with paths: frontmatter ───────────────

describe('L4: abstracted — .claude/rules/*.md with paths: frontmatter', () => {
  it('rungs[3].passed is true when .claude/rules/x.md has paths: frontmatter', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    mkdirSync(join(tmpRepo, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'rules', 'x.md'), '---\npaths: [src/**]\n---\n# Rule\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[3]!.passed).toBe(true)
    expect(result.rungs[3]!.label).toBe('Abstracted')
  })

  it('rungs[3].passed is false when .claude/rules/x.md exists but lacks paths: frontmatter', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    mkdirSync(join(tmpRepo, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'rules', 'x.md'), '---\ntitle: X\n---\n# Rule\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[3]!.passed).toBe(false)
  })

  it('rungs[3].passed is false when .claude/rules/ directory does not exist', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[3]!.passed).toBe(false)
  })
})

// ── L5: maintained — mtime proxy / backbone-doc proxy ─────────────────────────

describe('L5: maintained — inferred via proxies', () => {
  it('rungs[4].passed is true AND rungs[4].inferred is true for a fresh CLAUDE.md (mtime proxy)', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    mkdirSync(join(tmpRepo, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'rules', 'x.md'), '---\npaths: [/]\n---\n# Rule\n')
    // Fresh file: mtime is very recent (just written)
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[4]!.passed).toBe(true)
    expect(result.rungs[4]!.inferred).toBe(true)
    expect(result.rungs[4]!.label).toBe('Maintained')
  })

  it('rungs[4].passed is true AND rungs[4].inferred is true when backbone-doc .claude/INDEX.md present (even with old mtime)', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    mkdirSync(join(tmpRepo, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'rules', 'x.md'), '---\npaths: [/]\n---\n# Rule\n')
    // Set CLAUDE.md mtime to >90 days ago
    const oldDate = new Date(Date.now() - 100 * 24 * 3600 * 1000)
    utimesSync(join(tmpRepo, 'CLAUDE.md'), oldDate, oldDate)
    // Add backbone doc
    mkdirSync(join(tmpRepo, '.claude'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'INDEX.md'), '# Index\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[4]!.passed).toBe(true)
    expect(result.rungs[4]!.inferred).toBe(true)
  })

  it('rungs[4].passed is false when mtime is old (>90 days) and no backbone doc exists', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    mkdirSync(join(tmpRepo, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'rules', 'x.md'), '---\npaths: [/]\n---\n# Rule\n')
    // Set CLAUDE.md mtime to >90 days ago
    const oldDate = new Date(Date.now() - 100 * 24 * 3600 * 1000)
    utimesSync(join(tmpRepo, 'CLAUDE.md'), oldDate, oldDate)
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[4]!.passed).toBe(false)
    // L5 is always inferred:true even when it fails
    expect(result.rungs[4]!.inferred).toBe(true)
  })

  it('rungs[4].inferred is always true (invariant across pass/fail)', () => {
    // Even when L5 fails, the rung carries inferred:true
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    // L0 → L5 rung still present with inferred: true
    expect(result.rungs[4]!.inferred).toBe(true)
  })
})

// ── L6: adaptive — .claude/skills/*/SKILL.md + mcp.json ──────────────────────

describe('L6: adaptive — .claude/skills/*/SKILL.md + mcp.json', () => {
  it('rungs[5].passed is true when .claude/skills/foo/SKILL.md exists AND mcp.json at repo root', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    mkdirSync(join(tmpRepo, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'rules', 'x.md'), '---\npaths: [/]\n---\n# Rule\n')
    // Fresh mtime so L5 passes
    mkdirSync(join(tmpRepo, '.claude', 'skills', 'foo'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'skills', 'foo', 'SKILL.md'), '---\nname: foo\n---\n')
    writeFileSync(join(tmpRepo, 'mcp.json'), '{}')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[5]!.passed).toBe(true)
    expect(result.rungs[5]!.label).toBe('Adaptive')
  })

  it('rungs[5].passed is false when mcp.json is absent (even if .claude/skills/foo/SKILL.md exists)', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    mkdirSync(join(tmpRepo, '.claude', 'skills', 'foo'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'skills', 'foo', 'SKILL.md'), '---\nname: foo\n---\n')
    // No mcp.json
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[5]!.passed).toBe(false)
  })

  it('rungs[5].passed is false when .claude/skills/ has no SKILL.md (even if mcp.json exists)', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    mkdirSync(join(tmpRepo, '.claude', 'skills', 'foo'), { recursive: true })
    // No SKILL.md inside the skill dir
    writeFileSync(join(tmpRepo, 'mcp.json'), '{}')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.rungs[5]!.passed).toBe(false)
  })
})

// ── Strict-cumulative capping ─────────────────────────────────────────────────

describe('strict-cumulative: headline caps at highest N where rungs 1..N all pass', () => {
  it('level 4 when L1-L4 pass but L5 fails (even if L6 structure present)', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    mkdirSync(join(tmpRepo, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'rules', 'x.md'), '---\npaths: [/]\n---\n# Rule\n')
    // Old mtime → L5 fails
    const oldDate = new Date(Date.now() - 100 * 24 * 3600 * 1000)
    utimesSync(join(tmpRepo, 'CLAUDE.md'), oldDate, oldDate)
    // L6 structure present despite L5 failing
    mkdirSync(join(tmpRepo, '.claude', 'skills', 'foo'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'skills', 'foo', 'SKILL.md'), '---\nname: foo\n---\n')
    writeFileSync(join(tmpRepo, 'mcp.json'), '{}')

    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    // Strict-cumulative: stop at first failure (L5)
    expect(result.level).toBe(4)
    expect(result.rungs[4]!.passed).toBe(false) // L5 failed
    // L6 rung is still evaluated (evidence visible) but not counted in headline
    expect(result.rungs[5]!.rung).toBe(6)
  })

  it('level 1 when only L1 passes', () => {
    // Minimal: git-tracked CLAUDE.md with no constraint keywords
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nDo something.\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.level).toBe(1)
    expect(result.rungs[0]!.passed).toBe(true)
    expect(result.rungs[1]!.passed).toBe(false)
  })

  it('result.inferred is true when headline level was contributed by the inferred L5 rung', () => {
    // Full L1-L6 chain — L5 passes via fresh mtime (inferred), L6 present
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    mkdirSync(join(tmpRepo, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'rules', 'x.md'), '---\npaths: [/]\n---\n# Rule\n')
    mkdirSync(join(tmpRepo, '.claude', 'skills', 'foo'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'skills', 'foo', 'SKILL.md'), '---\nname: foo\n---\n')
    writeFileSync(join(tmpRepo, 'mcp.json'), '{}')

    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.level).toBe(6)
    expect(result.inferred).toBe(true)
  })

  it('result.inferred is false when L5 is not part of the headline chain', () => {
    // Only L1 in the chain — L5 fails, not in headline
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nDo something.\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.level).toBe(1)
    expect(result.inferred).toBe(false)
  })
})

// ── nextSteps advice strings ──────────────────────────────────────────────────

describe('nextSteps: advice strings for next unmet rung', () => {
  it('nextSteps contains L1 advice when level is 0 (no file)', () => {
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.nextSteps).toHaveLength(1)
    expect(result.nextSteps[0]).toBe(
      'Add a CLAUDE.md (or AGENTS.md) file at the repo root and commit it to git → reaches L1.',
    )
  })

  it('nextSteps contains L2 advice when level is 1', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nDo something.\n')
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.level).toBe(1)
    expect(result.nextSteps[0]).toBe(
      'Add a ## Constraints section with MUST / MUST NOT / NEVER rules → reaches L2.',
    )
  })

  it('nextSteps is empty array when level is 6 (all rungs pass)', () => {
    initGitRepoWithClaudeMd(tmpRepo, '# Instructions\n\nMUST follow rules.\n\n@docs/foo.md\n')
    mkdirSync(join(tmpRepo, '.claude', 'rules'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'rules', 'x.md'), '---\npaths: [/]\n---\n# Rule\n')
    mkdirSync(join(tmpRepo, '.claude', 'skills', 'foo'), { recursive: true })
    writeFileSync(join(tmpRepo, '.claude', 'skills', 'foo', 'SKILL.md'), '---\nname: foo\n---\n')
    writeFileSync(join(tmpRepo, 'mcp.json'), '{}')

    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve })
    expect(result.level).toBe(6)
    expect(result.nextSteps).toEqual([])
  })
})

// ── Degraded / never-throws ───────────────────────────────────────────────────

describe('degraded: scanner never throws, returns ABSENT_EVAL on inner failure', () => {
  it('returns level 0 and all-false rungs when resolver throws (inner failure)', () => {
    // A resolver that always throws (PathViolation for everything)
    const throwingResolver: PathResolver = () => {
      throw new PathViolation('test: always-throw resolver')
    }
    // Write a CLAUDE.md so the scanner would try to resolve
    writeFileSync(join(tmpRepo, 'CLAUDE.md'), '# Instructions\n\nMUST follow.\n')
    const result = scanClaudeMdLevel({ repoAbsPath: tmpRepo, resolve: throwingResolver })
    // The scanner catches the throw and returns a degraded L0 shape
    expect(result.level).toBe(0)
    expect(result.rungs).toHaveLength(6)
    expect(result.rungs.every(r => !r.passed)).toBe(true)
  })

  it('does not throw when repoAbsPath is a non-existent directory', () => {
    const resolve = makePermissiveResolver(tmpRepo)
    expect(() =>
      scanClaudeMdLevel({ repoAbsPath: '/nonexistent/repo/path', resolve }),
    ).not.toThrow()
  })
})
