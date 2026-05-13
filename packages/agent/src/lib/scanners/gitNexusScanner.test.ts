/**
 * gitNexusScanner.test.ts — ~/.gitnexus/registry.json parsing and repo freshness rating.
 * Plan 02 implements; Plan 01 provided the it.todo placeholders.
 *
 * Pitfall 1: registry.json is a top-level array, NOT { repos: [] }.
 * Assumption A1: dual-form path matching (raw + realpath).
 * CODEX HIGH-3: resolve callback used for all reads.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs'
import { join, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { scanGitNexusGlobal, rateGitNexusRepo, GITNEXUS_STALE_DAYS } from './gitNexusScanner.js'
import { PathViolation } from '../coverageResolver.js'
import type { PathResolver } from '../coverageResolver.js'

let tmpHome: string

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), 'gitnexus-scanner-'))
})

afterEach(() => {
  rmSync(tmpHome, { recursive: true, force: true })
})

/** A permissive resolver that allows everything under any of the given roots. */
function makePermissiveResolver(...roots: string[]): PathResolver {
  return (candidatePath, _opts) => {
    let real: string
    try {
      real = realpathSync(candidatePath)
    } catch {
      throw new PathViolation(`not accessible: ${candidatePath}`)
    }
    const realRoots = roots.map((r) => {
      try {
        return realpathSync(r)
      } catch {
        return r
      }
    })
    const inRoot = realRoots.some((root) => real === root || real.startsWith(root + sep))
    if (!inRoot) throw new PathViolation(`outside allowed roots: ${real}`)
    return real
  }
}

/** Write a registry.json with the given entries array. */
function writeRegistry(homeDir: string, entries: unknown[]): void {
  const dir = join(homeDir, '.gitnexus')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'registry.json'), JSON.stringify(entries))
}

/** Create a minimal RegistryEntry for testing. */
function makeEntry(overrides: Partial<{
  name: string
  path: string
  storagePath: string
  indexedAt: string
  lastCommit: string
}>): Record<string, unknown> {
  return {
    name: 'test-repo',
    path: '/some/path/test-repo',
    storagePath: '/some/storage/test-repo',
    indexedAt: new Date().toISOString(),
    lastCommit: 'abc123',
    ...overrides,
  }
}

/** Return an ISO-8601 string N days ago. */
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

describe('scanGitNexus', () => {
  it('returns installed=false with state=not-applicable when ~/.gitnexus directory absent', () => {
    const resolve = makePermissiveResolver(tmpHome)
    const global = scanGitNexusGlobal(tmpHome, resolve)
    expect(global.installed).toBe(false)
    expect(global.entries).toEqual([])

    const state = rateGitNexusRepo(global, '/any/path')
    expect(state.state).toBe('not-applicable')
  })

  it('returns installed=true with empty entries when registry.json absent but .gitnexus dir exists', () => {
    mkdirSync(join(tmpHome, '.gitnexus'), { recursive: true })
    const resolve = makePermissiveResolver(join(tmpHome, '.gitnexus'))
    const global = scanGitNexusGlobal(tmpHome, resolve)
    expect(global.installed).toBe(true)
    expect(global.entries).toEqual([])
  })

  it('parses RegistryEntry top-level array from registry.json (Pitfall 1 — array shape)', () => {
    const entry = makeEntry({ name: 'my-repo', path: '/repos/my-repo' })
    writeRegistry(tmpHome, [entry])
    const resolve = makePermissiveResolver(join(tmpHome, '.gitnexus'))
    const global = scanGitNexusGlobal(tmpHome, resolve)
    expect(global.installed).toBe(true)
    expect(global.entries).toHaveLength(1)
    expect(global.entries[0]!.name).toBe('my-repo')
    expect(global.entries[0]!.path).toBe('/repos/my-repo')
  })

  it('Pitfall 1 — registry.json with { repos: [] } shape is rejected gracefully (entries=[]) ', () => {
    // ADR 0020 / migration 0007 broken shape — must NOT be parsed as if it had .repos.
    mkdirSync(join(tmpHome, '.gitnexus'), { recursive: true })
    writeFileSync(
      join(tmpHome, '.gitnexus', 'registry.json'),
      JSON.stringify({ repos: [makeEntry({})] }),
    )
    const resolve = makePermissiveResolver(join(tmpHome, '.gitnexus'))
    const global = scanGitNexusGlobal(tmpHome, resolve)
    // The { repos: [] } shape fails z.array() parse → silent fallback.
    expect(global.installed).toBe(true)
    expect(global.entries).toEqual([])
  })

  it('rates repo fresh when last gitnexus scan <= 14 days ago', () => {
    const repoPath = join(tmpHome, 'my-repo')
    const entry = makeEntry({ path: repoPath, indexedAt: daysAgo(7) })
    writeRegistry(tmpHome, [entry])
    const resolve = makePermissiveResolver(join(tmpHome, '.gitnexus'))
    const global = scanGitNexusGlobal(tmpHome, resolve)
    const state = rateGitNexusRepo(global, repoPath)
    expect(state.state).toBe('fresh')
    expect(state.daysSinceIndex).toBe(7)
  })

  it('rates repo stale when last gitnexus scan > 14 days ago', () => {
    const repoPath = join(tmpHome, 'my-repo')
    const entry = makeEntry({ path: repoPath, indexedAt: daysAgo(22) })
    writeRegistry(tmpHome, [entry])
    const resolve = makePermissiveResolver(join(tmpHome, '.gitnexus'))
    const global = scanGitNexusGlobal(tmpHome, resolve)
    const state = rateGitNexusRepo(global, repoPath)
    expect(state.state).toBe('stale')
    expect(state.daysSinceIndex).toBe(22)
    expect(state.daysSinceIndex).toBeGreaterThan(GITNEXUS_STALE_DAYS)
  })

  it('rates repo missing when repo absPath not found in gitnexus entries', () => {
    const entry = makeEntry({ path: '/other/path' })
    writeRegistry(tmpHome, [entry])
    const resolve = makePermissiveResolver(join(tmpHome, '.gitnexus'))
    const global = scanGitNexusGlobal(tmpHome, resolve)
    const state = rateGitNexusRepo(global, join(tmpHome, 'unlisted-repo'))
    expect(state.state).toBe('missing')
  })

  it('tries realpath fallback when canonical path lookup misses (Assumption A1 — symlink-followed path)', () => {
    // Create a real directory and a symlink to it.
    const realDir = join(tmpHome, 'real-repo')
    mkdirSync(realDir, { recursive: true })
    const symlinkDir = join(tmpHome, 'link-repo')
    symlinkSync(realDir, symlinkDir)

    // Registry stores the realpath form.
    const realPath = realpathSync(realDir)
    const entry = makeEntry({ path: realPath, indexedAt: daysAgo(3) })
    writeRegistry(tmpHome, [entry])

    const resolve = makePermissiveResolver(join(tmpHome, '.gitnexus'))
    const global = scanGitNexusGlobal(tmpHome, resolve)

    // rateGitNexusRepo is called with the symlink form — should still match via realpath.
    const state = rateGitNexusRepo(global, symlinkDir)
    expect(state.state).toBe('fresh')
    expect(state.daysSinceIndex).toBe(3)
  })

  it('CODEX HIGH-3: resolve callback is used for reading registry.json', () => {
    writeRegistry(tmpHome, [])
    let resolveCallCount = 0
    const trackingResolver: PathResolver = (candidatePath, opts) => {
      resolveCallCount++
      return makePermissiveResolver(join(tmpHome, '.gitnexus'))(candidatePath, opts)
    }
    scanGitNexusGlobal(tmpHome, trackingResolver)
    expect(resolveCallCount).toBeGreaterThan(0)
  })

  it('rateGitNexusRepo returns only the 4 enumerated states (COV-11)', () => {
    const validStates = new Set(['fresh', 'stale', 'missing', 'not-applicable'])

    // not-applicable
    const notInstalled = scanGitNexusGlobal(tmpHome, makePermissiveResolver(tmpHome))
    expect(validStates.has(rateGitNexusRepo(notInstalled, '/any').state)).toBe(true)

    // missing
    writeRegistry(tmpHome, [])
    const installed = scanGitNexusGlobal(tmpHome, makePermissiveResolver(join(tmpHome, '.gitnexus')))
    expect(validStates.has(rateGitNexusRepo(installed, '/not-in-registry').state)).toBe(true)

    // fresh
    const freshEntry = makeEntry({ path: '/fresh-repo', indexedAt: daysAgo(1) })
    writeRegistry(tmpHome, [freshEntry])
    const withFresh = scanGitNexusGlobal(tmpHome, makePermissiveResolver(join(tmpHome, '.gitnexus')))
    expect(validStates.has(rateGitNexusRepo(withFresh, '/fresh-repo').state)).toBe(true)

    // stale
    const staleEntry = makeEntry({ path: '/stale-repo', indexedAt: daysAgo(30) })
    writeRegistry(tmpHome, [staleEntry])
    const withStale = scanGitNexusGlobal(tmpHome, makePermissiveResolver(join(tmpHome, '.gitnexus')))
    expect(validStates.has(rateGitNexusRepo(withStale, '/stale-repo').state)).toBe(true)
  })
})
