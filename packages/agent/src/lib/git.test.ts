import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execa } from 'execa'

import { runAllowedGit, GitNotAllowedError } from './git.js'

describe('git lib — runAllowedGit', () => {
  let repoRoot: string
  let cleanup: () => void

  beforeAll(async () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'agentic-git-test-'))
    cleanup = () => rmSync(repoRoot, { recursive: true, force: true })
    // Init a git repo with two commits so diff-stat has HEAD~1..HEAD to compare
    await execa('git', ['init'], { cwd: repoRoot })
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: repoRoot })
    await execa('git', ['config', 'user.name', 'Test'], { cwd: repoRoot })
    await execa('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: repoRoot })
    await execa('git', ['commit', '--allow-empty', '-m', 'second'], { cwd: repoRoot })
  })

  afterAll(() => cleanup())

  it('runAllowedGit("log", repoRoot) returns GitResponseSchema-valid output', async () => {
    const result = await runAllowedGit('log', repoRoot)
    expect(result).toHaveProperty('stdout')
    expect(result).toHaveProperty('stderr')
    expect(result).toHaveProperty('exitCode')
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('init')
  })

  it('runAllowedGit("status", repoRoot) returns short status', async () => {
    const result = await runAllowedGit('status', repoRoot)
    expect(result.exitCode).toBe(0)
    expect(typeof result.stdout).toBe('string')
  })

  it('runAllowedGit("diff-stat", repoRoot) returns diff stat', async () => {
    const result = await runAllowedGit('diff-stat', repoRoot)
    expect(result.exitCode).toBe(0)
    expect(typeof result.stdout).toBe('string')
  })

  it('runAllowedGit("branch", repoRoot) returns current branch', async () => {
    const result = await runAllowedGit('branch', repoRoot)
    expect(result.exitCode).toBe(0)
    expect(typeof result.stdout).toBe('string')
  })

  it('runAllowedGit("rebase", repoRoot) throws GitNotAllowedError', async () => {
    await expect(runAllowedGit('rebase', repoRoot)).rejects.toThrow(GitNotAllowedError)
  })

  it('runAllowedGit("log; rm -rf", repoRoot) throws GitNotAllowedError before spawn', async () => {
    await expect(runAllowedGit('log; rm -rf', repoRoot)).rejects.toThrow(GitNotAllowedError)
  })

  it('runAllowedGit("log", "/nonexistent") resolves with non-zero exitCode', async () => {
    const result = await runAllowedGit('log', '/nonexistent/path/that/does/not/exist')
    expect(result.exitCode).not.toBe(0)
  })
})
