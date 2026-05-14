/**
 * repoDiscovery.test.ts — one-level-deep walk of 3 family roots.
 *
 * Plan 02 implements; Plan 01 provided the it.todo placeholders.
 *
 * CODEX HIGH-2: symlink escape rejection — symlinks pointing outside the family root
 * must be excluded AND must emit a `safety` warn log. Realpath canonicalisation prevents
 * path traversal attacks via symlinked directories.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverRepos, FAMILIES } from './repoDiscovery.js'

/** Create a minimal git repo (just a .git directory) in the given path. */
function makeGitRepo(dir: string): void {
  mkdirSync(join(dir, '.git'), { recursive: true })
}

/** Create a git worktree marker (.git file, not directory) in the given path. */
function makeGitWorktree(dir: string): void {
  writeFileSync(join(dir, '.git'), 'gitdir: ../real-repo/.git')
}

let tmpRoot: string

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'repo-discovery-'))
  // Create the 3 family directories.
  for (const family of FAMILIES) {
    mkdirSync(join(tmpRoot, family), { recursive: true })
  }
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe('discoverRepos', () => {
  it('walks 3 family roots (agenticapps, factiv, neuroflash) one level deep', () => {
    // Create one repo per family.
    mkdirSync(join(tmpRoot, 'agenticapps', 'my-app'), { recursive: true })
    makeGitRepo(join(tmpRoot, 'agenticapps', 'my-app'))

    mkdirSync(join(tmpRoot, 'factiv', 'cparx'), { recursive: true })
    makeGitRepo(join(tmpRoot, 'factiv', 'cparx'))

    mkdirSync(join(tmpRoot, 'neuroflash', 'nf-api'), { recursive: true })
    makeGitRepo(join(tmpRoot, 'neuroflash', 'nf-api'))

    const repos = discoverRepos(tmpRoot)
    expect(repos).toHaveLength(3)
    expect(repos.map((r) => r.family)).toContain('agenticapps')
    expect(repos.map((r) => r.family)).toContain('factiv')
    expect(repos.map((r) => r.family)).toContain('neuroflash')
  })

  it('skips missing family directories gracefully (not an error)', () => {
    // Remove factiv to simulate a missing family.
    rmSync(join(tmpRoot, 'factiv'), { recursive: true, force: true })

    mkdirSync(join(tmpRoot, 'agenticapps', 'my-app'), { recursive: true })
    makeGitRepo(join(tmpRoot, 'agenticapps', 'my-app'))

    const repos = discoverRepos(tmpRoot)
    expect(repos).toHaveLength(1)
    expect(repos[0]!.family).toBe('agenticapps')
    // No throw even though factiv and neuroflash are empty / missing.
  })

  it('skips dotfiles (entries starting with .) and node_modules directories', () => {
    const family = join(tmpRoot, 'agenticapps')
    // dotfile — should be skipped.
    mkdirSync(join(family, '.hidden-repo'), { recursive: true })
    makeGitRepo(join(family, '.hidden-repo'))
    // node_modules — should be skipped.
    mkdirSync(join(family, 'node_modules'), { recursive: true })
    makeGitRepo(join(family, 'node_modules'))
    // Normal repo — should be included.
    mkdirSync(join(family, 'real-app'), { recursive: true })
    makeGitRepo(join(family, 'real-app'))

    const repos = discoverRepos(tmpRoot)
    expect(repos).toHaveLength(1)
    expect(repos[0]!.name).toBe('real-app')
  })

  it('includes .git directories and .git files (worktree markers) — only dotfile names are skipped', () => {
    const family = join(tmpRoot, 'agenticapps')
    // Normal repo: .git directory.
    mkdirSync(join(family, 'normal-repo'), { recursive: true })
    makeGitRepo(join(family, 'normal-repo'))
    // Worktree: .git file.
    mkdirSync(join(family, 'worktree-repo'), { recursive: true })
    makeGitWorktree(join(family, 'worktree-repo'))

    const repos = discoverRepos(tmpRoot)
    expect(repos).toHaveLength(2)
    const names = repos.map((r) => r.name).sort()
    expect(names).toEqual(['normal-repo', 'worktree-repo'])
  })

  it('REALPATH escape rejection (CODEX HIGH-2): a symlink pointing outside the family root is excluded AND emits a `safety` warn log', () => {
    const family = join(tmpRoot, 'agenticapps')
    // Normal repo — should be included.
    mkdirSync(join(family, 'real-app'), { recursive: true })
    makeGitRepo(join(family, 'real-app'))
    // Symlink pointing to /tmp (outside family root) — should be rejected.
    const outsideDir = mkdtempSync(join(tmpdir(), 'escape-target-'))
    try {
      makeGitRepo(outsideDir) // make it look like a repo so only realpath check stops it
      symlinkSync(outsideDir, join(family, 'escape'))

      // Capture stderr to verify the warn log is emitted.
      const stderrLines: string[] = []
      const origStderr = process.stderr.write.bind(process.stderr)
      vi.spyOn(process.stderr, 'write').mockImplementation((chunk, ...args) => {
        stderrLines.push(String(chunk))
        return origStderr(chunk, ...args)
      })

      const repos = discoverRepos(tmpRoot)

      vi.restoreAllMocks()

      // escape must not appear in results.
      expect(repos.find((r) => r.name === 'escape')).toBeUndefined()
      // real-app is still included.
      expect(repos.find((r) => r.name === 'real-app')).toBeDefined()
      // Warn log emitted with 'safety.symlink-escape'.
      const warnLine = stderrLines.find((l) => l.includes('safety.symlink-escape'))
      expect(warnLine).toBeTruthy()
      // The log line contains the repo name and the structured event fields.
      expect(warnLine).toContain('escape')
      expect(warnLine).toContain('familyRoot')
    } finally {
      rmSync(outsideDir, { recursive: true, force: true })
    }
  })

  it('legitimate symlink within the family root is accepted', () => {
    const family = join(tmpRoot, 'agenticapps')
    // Real repo inside the family.
    mkdirSync(join(family, 'real-repo'), { recursive: true })
    makeGitRepo(join(family, 'real-repo'))
    // Symlink pointing to sibling within the family — realpath stays under familyRoot.
    symlinkSync(join(family, 'real-repo'), join(family, 'symlinked-repo'))

    const repos = discoverRepos(tmpRoot)
    // Both real-repo and symlinked-repo (which resolves to real-repo) are accepted.
    const names = repos.map((r) => r.name)
    expect(names).toContain('real-repo')
    // symlinked-repo realpath is inside the family → accepted too.
    expect(names).toContain('symlinked-repo')
  })

  it('returns {family, name, absPath} tuples sorted by (family, name) for deterministic output', () => {
    // Add repos out of order.
    mkdirSync(join(tmpRoot, 'neuroflash', 'z-last'), { recursive: true })
    makeGitRepo(join(tmpRoot, 'neuroflash', 'z-last'))
    mkdirSync(join(tmpRoot, 'agenticapps', 'b-repo'), { recursive: true })
    makeGitRepo(join(tmpRoot, 'agenticapps', 'b-repo'))
    mkdirSync(join(tmpRoot, 'agenticapps', 'a-repo'), { recursive: true })
    makeGitRepo(join(tmpRoot, 'agenticapps', 'a-repo'))
    mkdirSync(join(tmpRoot, 'factiv', 'cparx'), { recursive: true })
    makeGitRepo(join(tmpRoot, 'factiv', 'cparx'))

    const repos = discoverRepos(tmpRoot)

    expect(repos[0]!.family).toBe('agenticapps')
    expect(repos[0]!.name).toBe('a-repo')
    expect(repos[1]!.family).toBe('agenticapps')
    expect(repos[1]!.name).toBe('b-repo')
    expect(repos[2]!.family).toBe('factiv')
    expect(repos[2]!.name).toBe('cparx')
    expect(repos[3]!.family).toBe('neuroflash')
    expect(repos[3]!.name).toBe('z-last')

    // Verify absPath is populated.
    for (const repo of repos) {
      expect(repo.absPath).toBeTruthy()
      expect(repo.absPath).toContain(repo.name)
    }
  })

  it('does NOT walk into sub-directories of repos (.claude/worktrees/ etc.) — discovery is one-level deep', () => {
    // Pitfall 6: worktrees inside repos must not be counted as top-level repos.
    const family = join(tmpRoot, 'agenticapps')
    mkdirSync(join(family, 'outer-repo'), { recursive: true })
    makeGitRepo(join(family, 'outer-repo'))
    // Add a nested "worktree" inside the repo — should NOT be discovered.
    mkdirSync(join(family, 'outer-repo', '.claude', 'worktrees', 'inner-wt'), { recursive: true })
    makeGitRepo(join(family, 'outer-repo', '.claude', 'worktrees', 'inner-wt'))

    const repos = discoverRepos(tmpRoot)
    // Only the top-level outer-repo should appear.
    expect(repos).toHaveLength(1)
    expect(repos[0]!.name).toBe('outer-repo')
  })
})
