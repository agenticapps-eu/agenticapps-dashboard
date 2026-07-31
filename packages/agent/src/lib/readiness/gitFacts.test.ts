import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  commitTimesFor,
  isAncestor,
  lastCommitTouching,
  readGitFacts,
} from './gitFacts.js'
import { resolveProductionScope, toPathspecs } from './productionScope.js'

const COVERAGE_PATH = 'coverage/coverage-summary.json'
const scope = () => resolveProductionScope({ coveragePath: COVERAGE_PATH })

let repo: string

function git(args: string[], date?: string): string {
  return execFileSync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@test.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    {
      cwd: repo,
      encoding: 'utf8',
      env: date
        ? { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }
        : process.env,
    },
  )
}

function write(file: string, body = 'x\n'): void {
  mkdirSync(join(repo, dirname(file)), { recursive: true })
  writeFileSync(join(repo, file), body)
}

function commit(files: string[], message: string, date: string): string {
  git(['add', ...files])
  git(['commit', '-m', message], date)
  return git(['rev-parse', 'HEAD']).trim()
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'readiness-git-'))
  execFileSync('git', ['init', '-b', 'main'], { cwd: repo })
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('readGitFacts', () => {
  it('reports a directory that is not a work tree as unavailable', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'readiness-nogit-'))
    try {
      const facts = await readGitFacts(bare)
      expect(facts.available).toBe(false)
      expect(facts.files).toEqual([])
      expect(facts.changed).toEqual([])
    } finally {
      rmSync(bare, { recursive: true, force: true })
    }
  })

  it('lists tracked and unignored-untracked files, never ignored ones', async () => {
    write('.gitignore', 'node_modules/\n')
    write('packages/agent/src/a.ts')
    commit(['.gitignore', 'packages/agent/src/a.ts'], 'init', '2026-01-01T00:00:00Z')
    write('packages/agent/src/b.ts')
    write('node_modules/dep/index.js')

    const facts = await readGitFacts(repo)
    expect(facts.available).toBe(true)
    expect(facts.files).toContain('packages/agent/src/a.ts')
    expect(facts.files).toContain('packages/agent/src/b.ts')
    expect(facts.files).not.toContain('node_modules/dep/index.js')
  })

  it('reports modified and untracked paths as changed, and ignored paths as clean', async () => {
    write('.gitignore', 'build/\n')
    write('packages/agent/src/a.ts')
    commit(['.gitignore', 'packages/agent/src/a.ts'], 'init', '2026-01-01T00:00:00Z')
    write('packages/agent/src/a.ts', 'changed\n')
    write('packages/agent/src/new.ts')
    write('build/out.js')

    const facts = await readGitFacts(repo)
    expect(facts.changed).toContain('packages/agent/src/a.ts')
    expect(facts.changed).toContain('packages/agent/src/new.ts')
    expect(facts.changed).not.toContain('build/out.js')
  })

  it('reports both sides of a staged rename', async () => {
    write('packages/agent/src/old.ts')
    commit(['packages/agent/src/old.ts'], 'init', '2026-01-01T00:00:00Z')
    git(['mv', 'packages/agent/src/old.ts', 'packages/agent/src/new.ts'])

    const facts = await readGitFacts(repo)
    expect(facts.changed).toContain('packages/agent/src/new.ts')
    expect(facts.changed).toContain('packages/agent/src/old.ts')
  })

  it('reports a repo with no commits as available and clean of history', async () => {
    write('packages/agent/src/a.ts')
    const facts = await readGitFacts(repo)
    expect(facts.available).toBe(true)
    expect(facts.files).toContain('packages/agent/src/a.ts')
  })
})

describe('lastCommitTouching', () => {
  it('finds the newest commit touching production code, ignoring documentation commits', async () => {
    write('packages/agent/src/a.ts')
    const code = commit(['packages/agent/src/a.ts'], 'code', '2026-01-01T00:00:00Z')
    write('docs/notes.md')
    write('README.md')
    commit(['docs/notes.md', 'README.md'], 'docs', '2026-02-01T00:00:00Z')

    const stamp = await lastCommitTouching(repo, toPathspecs(scope()))
    expect(stamp?.sha).toBe(code)
    expect(stamp?.at).toBe(Date.parse('2026-01-01T00:00:00Z'))
  })

  it('returns null when no commit touches the scope', async () => {
    write('docs/notes.md')
    commit(['docs/notes.md'], 'docs', '2026-01-01T00:00:00Z')

    expect(await lastCommitTouching(repo, toPathspecs(scope()))).toBeNull()
  })

  it('returns null in a repository with no commits at all', async () => {
    write('packages/agent/src/a.ts')
    expect(await lastCommitTouching(repo, toPathspecs(scope()))).toBeNull()
  })

  it('never ages production code against the coverage artifact', async () => {
    write('packages/agent/src/a.ts')
    const code = commit(['packages/agent/src/a.ts'], 'code', '2026-01-01T00:00:00Z')
    write(COVERAGE_PATH, '{}\n')
    commit([COVERAGE_PATH], 'coverage', '2026-03-01T00:00:00Z')

    expect((await lastCommitTouching(repo, toPathspecs(scope())))?.sha).toBe(code)
  })
})

describe('commitTimesFor', () => {
  it('maps each artifact to the newest commit that touched it', async () => {
    write('openspec/changes/one/REVIEW.md', 'first\n')
    const first = commit(['openspec/changes/one/REVIEW.md'], 'review', '2026-01-01T00:00:00Z')
    write('openspec/changes/one/REVIEW.md', 'second\n')
    const second = commit(
      ['openspec/changes/one/REVIEW.md'],
      'review again',
      '2026-02-01T00:00:00Z',
    )
    write('.planning/phases/01/CODE-REVIEW.md')
    const legacy = commit(
      ['.planning/phases/01/CODE-REVIEW.md'],
      'legacy review',
      '2026-01-15T00:00:00Z',
    )

    const times = await commitTimesFor(repo, ['openspec/changes', '.planning/phases'])
    expect(times.get('openspec/changes/one/REVIEW.md')?.sha).toBe(second)
    expect(times.get('openspec/changes/one/REVIEW.md')?.sha).not.toBe(first)
    expect(times.get('openspec/changes/one/REVIEW.md')?.at).toBe(
      Date.parse('2026-02-01T00:00:00Z'),
    )
    expect(times.get('.planning/phases/01/CODE-REVIEW.md')?.sha).toBe(legacy)
  })

  it('omits an artifact that has never been committed', async () => {
    write('openspec/changes/one/REVIEW.md')
    const times = await commitTimesFor(repo, ['openspec/changes'])
    expect(times.has('openspec/changes/one/REVIEW.md')).toBe(false)
  })

  it('returns an empty map for a directory with no history', async () => {
    write('packages/agent/src/a.ts')
    commit(['packages/agent/src/a.ts'], 'code', '2026-01-01T00:00:00Z')
    const times = await commitTimesFor(repo, ['openspec/changes'])
    expect(times.size).toBe(0)
  })
})

describe('isAncestor', () => {
  it('is true for an earlier commit and false the other way round', async () => {
    write('packages/agent/src/a.ts')
    const first = commit(['packages/agent/src/a.ts'], 'one', '2026-01-01T00:00:00Z')
    write('packages/agent/src/b.ts')
    const second = commit(['packages/agent/src/b.ts'], 'two', '2026-02-01T00:00:00Z')

    expect(await isAncestor(repo, first, second)).toBe(true)
    expect(await isAncestor(repo, second, first)).toBe(false)
  })

  it('is true for a commit against itself', async () => {
    write('packages/agent/src/a.ts')
    const only = commit(['packages/agent/src/a.ts'], 'one', '2026-01-01T00:00:00Z')
    expect(await isAncestor(repo, only, only)).toBe(true)
  })

  it('is false for an unknown commit rather than throwing', async () => {
    write('packages/agent/src/a.ts')
    const only = commit(['packages/agent/src/a.ts'], 'one', '2026-01-01T00:00:00Z')
    expect(await isAncestor(repo, 'f'.repeat(40), only)).toBe(false)
  })
})
