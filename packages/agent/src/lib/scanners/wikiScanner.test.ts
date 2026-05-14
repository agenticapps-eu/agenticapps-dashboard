/**
 * wikiScanner.test.ts — .wiki-compiler.json source-reference + .compile-state.json freshness.
 * Plan 02 implements; Plan 01 provided the it.todo placeholders.
 *
 * AGREED-1: exact-match-or-prefix-with-slash predicate:
 *   s.path === repoName || s.path.startsWith(repoName + '/')
 *   'app' matches source 'app' and 'app/sub' but NOT 'app-worker'.
 * Pitfall 2: distinguish 'wiki not linked' (no config) from 'never compiled' (config present but unrun).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { join, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { scanWikiForFamily, WIKI_STALE_DAYS } from './wikiScanner.js'
import { PathViolation } from '../coverageResolver.js'
import type { PathResolver } from '../coverageResolver.js'

let tmpFamily: string

beforeEach(() => {
  tmpFamily = mkdtempSync(join(tmpdir(), 'wiki-scanner-'))
})

afterEach(() => {
  rmSync(tmpFamily, { recursive: true, force: true })
})

/** A permissive resolver that allows everything under familyRoot. */
function makePermissiveResolver(familyRoot: string): PathResolver {
  return (candidatePath, _opts) => {
    let real: string
    try {
      real = realpathSync(candidatePath)
    } catch {
      throw new PathViolation(`not accessible: ${candidatePath}`)
    }
    let realRoot: string
    try {
      realRoot = realpathSync(familyRoot)
    } catch {
      realRoot = familyRoot
    }
    if (real !== realRoot && !real.startsWith(realRoot + sep)) {
      throw new PathViolation(`outside allowed roots: ${real}`)
    }
    return real
  }
}

/** Write .wiki-compiler.json with the given sources array. */
function writeWikiConfig(familyDir: string, sources: { path: string }[]): void {
  writeFileSync(join(familyDir, '.wiki-compiler.json'), JSON.stringify({ sources }))
}

/** Write .compile-state.json with the given last_compiled date. */
function writeCompileState(familyDir: string, lastCompiled: string): void {
  const stateDir = join(familyDir, '.knowledge', 'wiki')
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(join(stateDir, '.compile-state.json'), JSON.stringify({ last_compiled: lastCompiled }))
}

/** Return a YYYY-MM-DD date string N days ago (UTC). */
function daysAgoDate(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

describe('scanWiki', () => {
  it("returns state=missing with hint='wiki not linked' when .wiki-compiler.json is absent", () => {
    const resolve = makePermissiveResolver(tmpFamily)
    const result = scanWikiForFamily(tmpFamily, 'my-repo', resolve)
    expect(result.state).toBe('missing')
    expect(result.hint).toBe('wiki not linked')
  })

  it("returns state=missing with hint='repo not in .wiki-compiler.json sources' when config exists but no source matches the repo", () => {
    writeWikiConfig(tmpFamily, [{ path: 'other-repo' }, { path: 'another-repo/docs' }])
    const resolve = makePermissiveResolver(tmpFamily)
    const result = scanWikiForFamily(tmpFamily, 'my-repo', resolve)
    expect(result.state).toBe('missing')
    expect(result.hint).toBe('repo not in .wiki-compiler.json sources')
  })

  it("AGREED-1 false-positive guard: sources=['app-worker/docs'], repoName='app' → missing (NOT a match)", () => {
    // The OLD buggy s.path.startsWith(repoName) form would match 'app-worker/docs' for repoName='app'.
    // The AGREED-1 fix (s.path === repoName || s.path.startsWith(repoName + '/')) must NOT match.
    writeWikiConfig(tmpFamily, [{ path: 'app-worker/docs' }])
    const resolve = makePermissiveResolver(tmpFamily)
    const result = scanWikiForFamily(tmpFamily, 'app', resolve)
    expect(result.state).toBe('missing')
    expect(result.hint).toBe('repo not in .wiki-compiler.json sources')
  })

  it("AGREED-1 exact-match: sources=['app'], repoName='app' → matches → proceeds to compile-state check", () => {
    writeWikiConfig(tmpFamily, [{ path: 'app' }])
    writeCompileState(tmpFamily, daysAgoDate(0))
    const resolve = makePermissiveResolver(tmpFamily)
    const result = scanWikiForFamily(tmpFamily, 'app', resolve)
    // Matches exactly — proceeds to compile state (fresh today).
    expect(result.state).toBe('fresh')
    expect(result.daysSinceCompile).toBe(0)
  })

  it("AGREED-1 prefix-with-slash: sources=['app/docs/decisions'], repoName='app' → matches", () => {
    writeWikiConfig(tmpFamily, [{ path: 'app/docs/decisions' }])
    writeCompileState(tmpFamily, daysAgoDate(1))
    const resolve = makePermissiveResolver(tmpFamily)
    const result = scanWikiForFamily(tmpFamily, 'app', resolve)
    // 'app/docs/decisions'.startsWith('app/') is true → matches.
    expect(result.state).toBe('fresh')
  })

  it("AGREED-1 prefix without slash does NOT match: sources=['apparently-different'], repoName='app' → missing", () => {
    // 'apparently-different' does not equal 'app' and does not start with 'app/' → no match.
    writeWikiConfig(tmpFamily, [{ path: 'apparently-different' }])
    const resolve = makePermissiveResolver(tmpFamily)
    const result = scanWikiForFamily(tmpFamily, 'app', resolve)
    expect(result.state).toBe('missing')
    expect(result.hint).toBe('repo not in .wiki-compiler.json sources')
  })

  it("Pitfall 2 — returns state=stale with hint='never compiled' when config has repo source but .compile-state.json is absent", () => {
    // Config references the repo but the wiki has never been compiled.
    // This is AMBER (stale), NOT red (missing) — Pitfall 2 distinction.
    writeWikiConfig(tmpFamily, [{ path: 'my-repo' }])
    // No .compile-state.json written.
    const resolve = makePermissiveResolver(tmpFamily)
    const result = scanWikiForFamily(tmpFamily, 'my-repo', resolve)
    expect(result.state).toBe('stale')
    expect(result.hint).toBe('never compiled')
  })

  it('Pitfall 2 — distinguishes "wiki not linked" (no config) from "never compiled" (config exists but unrun)', () => {
    // No config → 'wiki not linked'.
    const resolve = makePermissiveResolver(tmpFamily)
    const noConfig = scanWikiForFamily(tmpFamily, 'my-repo', resolve)
    expect(noConfig.hint).toBe('wiki not linked')

    // Config exists but no compile state → 'never compiled'.
    writeWikiConfig(tmpFamily, [{ path: 'my-repo' }])
    const withConfig = scanWikiForFamily(tmpFamily, 'my-repo', resolve)
    expect(withConfig.hint).toBe('never compiled')
    // Both are different hints — the distinction is preserved.
    expect(noConfig.hint).not.toBe(withConfig.hint)
  })

  it('returns state=fresh when compile-state.json last_compiled is today (daysSinceCompile=0)', () => {
    writeWikiConfig(tmpFamily, [{ path: 'my-repo' }])
    writeCompileState(tmpFamily, daysAgoDate(0))
    const resolve = makePermissiveResolver(tmpFamily)
    const result = scanWikiForFamily(tmpFamily, 'my-repo', resolve)
    expect(result.state).toBe('fresh')
    expect(result.daysSinceCompile).toBe(0)
    expect(result.lastCompiledDate).toBe(daysAgoDate(0))
  })

  it('returns state=fresh when compile-state.json last_compiled is 5 days ago', () => {
    writeWikiConfig(tmpFamily, [{ path: 'my-repo' }])
    writeCompileState(tmpFamily, daysAgoDate(5))
    const resolve = makePermissiveResolver(tmpFamily)
    const result = scanWikiForFamily(tmpFamily, 'my-repo', resolve)
    expect(result.state).toBe('fresh')
    expect(result.daysSinceCompile).toBe(5)
    expect(5).toBeLessThanOrEqual(WIKI_STALE_DAYS)
  })

  it('returns state=stale when compile-state.json last_compiled is 10 days ago (> 7d threshold)', () => {
    writeWikiConfig(tmpFamily, [{ path: 'my-repo' }])
    writeCompileState(tmpFamily, daysAgoDate(10))
    const resolve = makePermissiveResolver(tmpFamily)
    const result = scanWikiForFamily(tmpFamily, 'my-repo', resolve)
    expect(result.state).toBe('stale')
    expect(result.daysSinceCompile).toBe(10)
    expect(10).toBeGreaterThan(WIKI_STALE_DAYS)
  })

  it("returns state=stale with hint='compile-state.json invalid' when state file is malformed JSON", () => {
    writeWikiConfig(tmpFamily, [{ path: 'my-repo' }])
    const stateDir = join(tmpFamily, '.knowledge', 'wiki')
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(join(stateDir, '.compile-state.json'), 'NOT_VALID_JSON{{{')
    const resolve = makePermissiveResolver(tmpFamily)
    const result = scanWikiForFamily(tmpFamily, 'my-repo', resolve)
    expect(result.state).toBe('stale')
    expect(result.hint).toBe('compile-state.json invalid')
  })

  it("returns state=stale with hint='last_compiled missing' when state file exists but has no last_compiled field", () => {
    writeWikiConfig(tmpFamily, [{ path: 'my-repo' }])
    const stateDir = join(tmpFamily, '.knowledge', 'wiki')
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(join(stateDir, '.compile-state.json'), JSON.stringify({ wiki_version: 1 }))
    const resolve = makePermissiveResolver(tmpFamily)
    const result = scanWikiForFamily(tmpFamily, 'my-repo', resolve)
    expect(result.state).toBe('stale')
    expect(result.hint).toBe('last_compiled missing')
  })

  it('CODEX HIGH-3: resolve callback is called for file reads', () => {
    writeWikiConfig(tmpFamily, [{ path: 'my-repo' }])
    let resolveCallCount = 0
    const trackingResolver: PathResolver = (candidatePath, opts) => {
      resolveCallCount++
      return makePermissiveResolver(tmpFamily)(candidatePath, opts)
    }
    scanWikiForFamily(tmpFamily, 'my-repo', trackingResolver)
    expect(resolveCallCount).toBeGreaterThan(0)
  })
})
