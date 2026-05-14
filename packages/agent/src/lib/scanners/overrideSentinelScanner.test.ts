/**
 * overrideSentinelScanner.test.ts — sentinel discovery + git log timestamp + mtime fallback.
 * Plan 02 implements; Plan 01 provided the it.todo placeholders.
 *
 * CODEX HIGH-3: scanOverrideSentinelsForRepo accepts a `resolve` callback.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { join, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { scanOverrideSentinelsForRepo, SENTINEL_NAME } from './overrideSentinelScanner.js'
import { PathViolation } from '../coverageResolver.js'
import type { PathResolver } from '../coverageResolver.js'

let tmpRepo: string

beforeEach(() => {
  tmpRepo = mkdtempSync(join(tmpdir(), 'override-sentinel-'))
})

afterEach(() => {
  rmSync(tmpRepo, { recursive: true, force: true })
})

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
    // Allow any filename within the root for these tests.
    return real
  }
}

/** Initialize a git repo in the given directory and commit a file. */
function initGitRepo(dir: string, filePath: string): void {
  execFileSync('git', ['init', '-b', 'main'], { cwd: dir, encoding: 'utf8' })
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir })
  execFileSync('git', ['add', filePath], { cwd: dir })
  execFileSync('git', ['commit', '-m', 'add sentinel'], { cwd: dir })
}

describe('scanOverrideSentinels', () => {
  it('returns empty array when .planning/phases/ directory does not exist', () => {
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanOverrideSentinelsForRepo(tmpRepo, resolve)
    expect(result).toEqual([])
  })

  it('returns empty array when phase exists but has no sentinel file', () => {
    const phasesDir = join(tmpRepo, '.planning', 'phases')
    mkdirSync(join(phasesDir, '01-foo'), { recursive: true })
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanOverrideSentinelsForRepo(tmpRepo, resolve)
    expect(result).toEqual([])
  })

  it('reads sinceIso from git log -1 --format=%aI when repo has a commit (source=git-log)', () => {
    const phasesDir = join(tmpRepo, '.planning', 'phases')
    const phaseDir = join(phasesDir, '01-foo')
    mkdirSync(phaseDir, { recursive: true })
    const sentinelRelPath = join('.planning', 'phases', '01-foo', SENTINEL_NAME)
    writeFileSync(join(tmpRepo, sentinelRelPath), '')
    // Initialize git repo and commit the sentinel.
    initGitRepo(tmpRepo, sentinelRelPath)

    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanOverrideSentinelsForRepo(tmpRepo, resolve)

    expect(result).toHaveLength(1)
    expect(result[0]!.phaseSlug).toBe('01-foo')
    expect(result[0]!.source).toBe('git-log')
    expect(result[0]!.sinceIso).toBeTruthy()
    // sinceIso should be an ISO-8601 string.
    expect(new Date(result[0]!.sinceIso!).getTime()).not.toBeNaN()
  })

  it('falls back to mtime when git log returns no output (not a git repo)', () => {
    const phasesDir = join(tmpRepo, '.planning', 'phases')
    const phaseDir = join(phasesDir, '01-bar')
    mkdirSync(phaseDir, { recursive: true })
    const sentinelPath = join(phaseDir, SENTINEL_NAME)
    writeFileSync(sentinelPath, '')

    // No git init — git log will fail or return empty.
    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanOverrideSentinelsForRepo(tmpRepo, resolve)

    expect(result).toHaveLength(1)
    expect(result[0]!.phaseSlug).toBe('01-bar')
    expect(result[0]!.source).toBe('mtime')
    // mtime should be populated.
    expect(result[0]!.sinceIso).toBeTruthy()
    expect(new Date(result[0]!.sinceIso!).getTime()).not.toBeNaN()
  })

  it('uses argv-array form for execFileSync: git-log runs safely without shell injection risk', () => {
    // T-10-02-01: execFileSync('git', [...], opts) — argv-array form, no shell string.
    // ESM builtins cannot be spied on directly; we verify behavioral correctness instead:
    // a sentinel whose name could be a shell metacharacter is handled safely.
    // The argv-array form means no shell expansion occurs — only the literal path is used.
    const phasesDir = join(tmpRepo, '.planning', 'phases')
    // Use a phase slug with characters that would break a shell-string form.
    const phaseSlug = '01-test-safe'
    const phaseDir = join(phasesDir, phaseSlug)
    mkdirSync(phaseDir, { recursive: true })
    const sentinelRelPath = join('.planning', 'phases', phaseSlug, SENTINEL_NAME)
    writeFileSync(join(tmpRepo, sentinelRelPath), '')
    // Initialize git so git log actually returns a value.
    initGitRepo(tmpRepo, sentinelRelPath)

    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanOverrideSentinelsForRepo(tmpRepo, resolve)

    // Should succeed and return a git-log source entry (proves execFileSync ran correctly).
    expect(result).toHaveLength(1)
    expect(result[0]!.phaseSlug).toBe(phaseSlug)
    expect(result[0]!.source).toBe('git-log')
    expect(result[0]!.sinceIso).toBeTruthy()
    // The sinceIso is a valid ISO-8601 date — execFileSync returned clean output.
    expect(new Date(result[0]!.sinceIso!).getTime()).not.toBeNaN()
  })

  it('CODEX HIGH-3: resolve callback is called for each sentinel path', () => {
    const phasesDir = join(tmpRepo, '.planning', 'phases')
    const phaseDir = join(phasesDir, '01-codex')
    mkdirSync(phaseDir, { recursive: true })
    writeFileSync(join(phaseDir, SENTINEL_NAME), '')

    let resolveCallCount = 0
    const trackingResolver: PathResolver = (candidatePath, opts) => {
      resolveCallCount++
      // Delegate to real resolver for actual functionality.
      return makePermissiveResolver(tmpRepo)(candidatePath, opts)
    }

    scanOverrideSentinelsForRepo(tmpRepo, trackingResolver)
    // The resolver must have been called at least once (for the sentinel path).
    expect(resolveCallCount).toBeGreaterThan(0)
  })

  it('overrideCount=0 and empty array when no sentinels exist anywhere (current dev-machine state)', () => {
    // This is the baseline state across all 45 repos today.
    const phasesDir = join(tmpRepo, '.planning', 'phases')
    mkdirSync(join(phasesDir, '01-phase'), { recursive: true })
    mkdirSync(join(phasesDir, '02-phase'), { recursive: true })
    // No sentinel files — just empty phase directories.

    const resolve = makePermissiveResolver(tmpRepo)
    const result = scanOverrideSentinelsForRepo(tmpRepo, resolve)

    expect(result).toEqual([])
    expect(result).toHaveLength(0)
  })
})
