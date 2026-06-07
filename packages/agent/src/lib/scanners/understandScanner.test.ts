/**
 * understandScanner.test.ts — pure FS scanner for .understand-anything/meta.json
 *
 * Plan 14-06 Task 1 (TDD RED then GREEN)
 *
 * Behavior groups:
 *   Test 1 — readRepoHeadSha: ref form, detached HEAD, packed-refs, no .git
 *   Test 2 — scanUnderstandForRepo fresh: gitCommitHash === HEAD SHA → state 'fresh'
 *   Test 3 — scanUnderstandForRepo stale: hash differs → state 'stale'
 *   Test 4 — scanUnderstandForRepo missing / malformed / null-head cases
 *
 * All assertions use pure tmpdir fixtures — no subprocess, no real filesystem.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, afterEach } from 'vitest'

import {
  readRepoHeadSha,
  scanUnderstandForRepo,
} from './understandScanner.js'

// ── Fixture helpers ───────────────────────────────────────────────────────────

const FAKE_SHA = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'
const OTHER_SHA = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'

function makeTmpRepo(): { repoRoot: string; cleanup: () => void } {
  const repoRoot = mkdtempSync(join(tmpdir(), 'understand-scanner-test-'))
  return { repoRoot, cleanup: () => rmSync(repoRoot, { recursive: true, force: true }) }
}

/** Create a .git directory with HEAD referencing a branch + a refs file. */
function makeGitWithRef(repoRoot: string, sha: string, branch = 'main'): void {
  const gitDir = join(repoRoot, '.git')
  mkdirSync(join(gitDir, 'refs', 'heads'), { recursive: true })
  writeFileSync(join(gitDir, 'HEAD'), `ref: refs/heads/${branch}\n`)
  writeFileSync(join(gitDir, 'refs', 'heads', branch), `${sha}\n`)
}

/** Create a .git directory with a detached HEAD (raw SHA). */
function makeGitDetached(repoRoot: string, sha: string): void {
  const gitDir = join(repoRoot, '.git')
  mkdirSync(gitDir, { recursive: true })
  writeFileSync(join(gitDir, 'HEAD'), `${sha}\n`)
}

/** Create a .git directory where the ref only exists in packed-refs. */
function makeGitPackedRef(repoRoot: string, sha: string, branch = 'main'): void {
  const gitDir = join(repoRoot, '.git')
  mkdirSync(gitDir, { recursive: true })
  writeFileSync(join(gitDir, 'HEAD'), `ref: refs/heads/${branch}\n`)
  // packed-refs format: <sha> <ref>
  writeFileSync(join(gitDir, 'packed-refs'), `# pack-refs with: peeled fully-peeled sorted\n${sha} refs/heads/${branch}\n`)
}

/** Create .understand-anything/meta.json with a given gitCommitHash. */
function makeMetaJson(repoRoot: string, gitCommitHash: string, opts: {
  lastAnalyzedAt?: string
  analyzedFiles?: number
  version?: string
} = {}): void {
  const dir = join(repoRoot, '.understand-anything')
  mkdirSync(dir, { recursive: true })
  const meta = {
    lastAnalyzedAt: opts.lastAnalyzedAt ?? '2026-06-07T10:00:00.000Z',
    gitCommitHash,
    version: opts.version ?? '1.0.0',
    analyzedFiles: opts.analyzedFiles ?? 42,
  }
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta))
}

// ── Test 1: readRepoHeadSha ───────────────────────────────────────────────────

describe('readRepoHeadSha', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => { for (const c of cleanups) c(); cleanups.length = 0 })

  it('ref form: HEAD points to branch → reads SHA from refs/heads/<branch>', () => {
    const { repoRoot, cleanup } = makeTmpRepo()
    cleanups.push(cleanup)
    makeGitWithRef(repoRoot, FAKE_SHA)
    expect(readRepoHeadSha(repoRoot)).toBe(FAKE_SHA)
  })

  it('detached HEAD: HEAD contains raw SHA directly → returns it', () => {
    const { repoRoot, cleanup } = makeTmpRepo()
    cleanups.push(cleanup)
    makeGitDetached(repoRoot, OTHER_SHA)
    expect(readRepoHeadSha(repoRoot)).toBe(OTHER_SHA)
  })

  it('packed-refs fallback: ref absent in refs/heads/, present in packed-refs → returns packed SHA', () => {
    const { repoRoot, cleanup } = makeTmpRepo()
    cleanups.push(cleanup)
    makeGitPackedRef(repoRoot, FAKE_SHA)
    expect(readRepoHeadSha(repoRoot)).toBe(FAKE_SHA)
  })

  it('no .git directory → returns null', () => {
    const { repoRoot, cleanup } = makeTmpRepo()
    cleanups.push(cleanup)
    // No .git at all
    expect(readRepoHeadSha(repoRoot)).toBeNull()
  })
})

// ── Test 2: scan fresh ────────────────────────────────────────────────────────

describe('scanUnderstandForRepo — fresh', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => { for (const c of cleanups) c(); cleanups.length = 0 })

  it('returns state=fresh when meta.json gitCommitHash === currentHeadSha', () => {
    const { repoRoot, cleanup } = makeTmpRepo()
    cleanups.push(cleanup)
    makeMetaJson(repoRoot, FAKE_SHA, { analyzedFiles: 110 })

    const result = scanUnderstandForRepo(repoRoot, FAKE_SHA)

    expect(result.state).toBe('fresh')
    expect(result.lastAnalyzedAt).toBe('2026-06-07T10:00:00.000Z')
    // analyzedCommit is the 7-char short hash
    expect(result.analyzedCommit).toBe(FAKE_SHA.slice(0, 7))
    expect(result.analyzedFiles).toBe(110)
  })
})

// ── Test 3: scan stale ────────────────────────────────────────────────────────

describe('scanUnderstandForRepo — stale', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => { for (const c of cleanups) c(); cleanups.length = 0 })

  it('returns state=stale when meta.json gitCommitHash differs from currentHeadSha', () => {
    const { repoRoot, cleanup } = makeTmpRepo()
    cleanups.push(cleanup)
    makeMetaJson(repoRoot, OTHER_SHA, { analyzedFiles: 55 })

    const result = scanUnderstandForRepo(repoRoot, FAKE_SHA)

    expect(result.state).toBe('stale')
    expect(result.lastAnalyzedAt).toBe('2026-06-07T10:00:00.000Z')
    expect(result.analyzedCommit).toBe(OTHER_SHA.slice(0, 7))
    expect(result.analyzedFiles).toBe(55)
  })
})

// ── Test 4: scan missing / malformed / null-head ──────────────────────────────

describe('scanUnderstandForRepo — missing and edge cases', () => {
  const cleanups: Array<() => void> = []
  afterEach(() => { for (const c of cleanups) c(); cleanups.length = 0 })

  it('returns state=missing when .understand-anything/meta.json is absent', () => {
    const { repoRoot, cleanup } = makeTmpRepo()
    cleanups.push(cleanup)
    // No .understand-anything directory at all

    const result = scanUnderstandForRepo(repoRoot, FAKE_SHA)

    expect(result.state).toBe('missing')
    expect(result.lastAnalyzedAt).toBeUndefined()
    expect(result.analyzedCommit).toBeUndefined()
    expect(result.analyzedFiles).toBeUndefined()
  })

  it('returns state=missing when meta.json contains malformed JSON — does NOT throw', () => {
    const { repoRoot, cleanup } = makeTmpRepo()
    cleanups.push(cleanup)
    const dir = join(repoRoot, '.understand-anything')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'meta.json'), '{ this is not json !!!')

    // Must not throw
    let result: ReturnType<typeof scanUnderstandForRepo> | undefined
    expect(() => {
      result = scanUnderstandForRepo(repoRoot, FAKE_SHA)
    }).not.toThrow()

    expect(result?.state).toBe('missing')
  })

  it('returns state=stale when currentHeadSha is null but meta.json is present (conservative: cannot prove freshness)', () => {
    const { repoRoot, cleanup } = makeTmpRepo()
    cleanups.push(cleanup)
    makeMetaJson(repoRoot, FAKE_SHA)

    const result = scanUnderstandForRepo(repoRoot, null)

    expect(result.state).toBe('stale')
  })
})
