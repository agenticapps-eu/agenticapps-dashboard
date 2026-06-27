/**
 * viewerInstall.test.ts — Plan 14-02, Task 3.
 *
 * Pure stat/readdir detection for installed understand-anything viewer and plugin cache.
 * No subprocess invocation — Phase 10.6 "detection without execution" pattern.
 *
 * Tests cover all 4 behaviours from the plan:
 *   1. getInstalledViewerVersion returns highest semver dir containing index.html
 *      (semver sort: 2.10.0 > 2.9.9 — numeric segment compare, not lexicographic)
 *   2. getInstalledViewerPath returns absolute path of that version dir
 *   3. getNewestPluginCacheVersion returns highest semver dir under plugin cache root
 *   4. Non-semver dir names (e.g. 'tmp', '.DS_Store') are ignored
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  getInstalledViewerPath,
  getInstalledViewerVersion,
  getNewestPluginCacheVersion,
} from './viewerInstall.js'

// ── Test helpers ──────────────────────────────────────────────────────────────

let tmpDir: string

function setup(): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'vi-test-'))
}

function teardown(): void {
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* best-effort */ }
}

/** Create a versioned viewer dir with or without index.html */
function makeVersionDir(base: string, version: string, withIndex = true): string {
  const vDir = join(base, version)
  mkdirSync(vDir, { recursive: true })
  if (withIndex) {
    writeFileSync(join(vDir, 'index.html'), '<html></html>')
  }
  return vDir
}

// ── Test 1 + 4: getInstalledViewerVersion ────────────────────────────────────

describe('getInstalledViewerVersion', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('returns null when the viewer dir does not exist', () => {
    const missing = join(tmpDir, 'nonexistent')
    expect(getInstalledViewerVersion(missing)).toBeNull()
  })

  it('returns null when the viewer dir exists but is empty', () => {
    const emptyDir = join(tmpDir, 'viewer')
    mkdirSync(emptyDir)
    expect(getInstalledViewerVersion(emptyDir)).toBeNull()
  })

  it('returns null when version dirs exist but none have index.html', () => {
    const base = join(tmpDir, 'viewer')
    makeVersionDir(base, '1.0.0', false)
    makeVersionDir(base, '2.0.0', false)
    expect(getInstalledViewerVersion(base)).toBeNull()
  })

  it('returns the single version when only one exists with index.html', () => {
    const base = join(tmpDir, 'viewer')
    makeVersionDir(base, '1.5.0')
    expect(getInstalledViewerVersion(base)).toBe('1.5.0')
  })

  it('returns the highest semver (2.10.0 > 2.9.9 — numeric not lexicographic)', () => {
    const base = join(tmpDir, 'viewer')
    makeVersionDir(base, '2.9.9')
    makeVersionDir(base, '2.10.0')  // lexicographically LESS than 2.9.9 but numerically greater
    makeVersionDir(base, '1.0.0')
    expect(getInstalledViewerVersion(base)).toBe('2.10.0')
  })

  it('ignores non-semver dir names (tmp, .DS_Store, etc.) — Test 4', () => {
    const base = join(tmpDir, 'viewer')
    makeVersionDir(base, '1.2.3')
    // Non-semver dirs should be ignored
    mkdirSync(join(base, 'tmp'))
    mkdirSync(join(base, '.DS_Store'))
    mkdirSync(join(base, 'current'))
    writeFileSync(join(base, 'tmp', 'index.html'), '')
    expect(getInstalledViewerVersion(base)).toBe('1.2.3')
  })

  it('ignores dirs without index.html even if they match semver', () => {
    const base = join(tmpDir, 'viewer')
    makeVersionDir(base, '1.0.0', false)  // no index.html
    makeVersionDir(base, '0.9.0')         // has index.html but lower version
    expect(getInstalledViewerVersion(base)).toBe('0.9.0')
  })
})

// ── Test 2: getInstalledViewerPath ────────────────────────────────────────────

describe('getInstalledViewerPath', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('returns null when dir does not exist', () => {
    expect(getInstalledViewerPath(join(tmpDir, 'none'))).toBeNull()
  })

  it('returns the absolute path of the highest version dir with index.html', () => {
    const base = join(tmpDir, 'viewer')
    makeVersionDir(base, '1.0.0')
    makeVersionDir(base, '2.0.0')
    const result = getInstalledViewerPath(base)
    expect(result).toBe(join(base, '2.0.0'))
  })

  it('returns null when no version has index.html', () => {
    const base = join(tmpDir, 'viewer')
    makeVersionDir(base, '1.0.0', false)
    expect(getInstalledViewerPath(base)).toBeNull()
  })
})

// ── Test 3: getNewestPluginCacheVersion ───────────────────────────────────────

describe('getNewestPluginCacheVersion', () => {
  beforeEach(setup)
  afterEach(teardown)

  it('returns null when plugin cache dir does not exist', () => {
    const missing = join(tmpDir, 'plugin-cache', 'no-plugin')
    expect(getNewestPluginCacheVersion(missing)).toBeNull()
  })

  it('returns null when plugin cache dir is empty', () => {
    const emptyCache = join(tmpDir, 'plugin-cache')
    mkdirSync(emptyCache)
    expect(getNewestPluginCacheVersion(emptyCache)).toBeNull()
  })

  it('returns the highest semver version in the plugin cache', () => {
    const cacheDir = join(tmpDir, 'plugin-cache')
    mkdirSync(join(cacheDir, '2.7.5'), { recursive: true })
    mkdirSync(join(cacheDir, '2.7.6'), { recursive: true })
    mkdirSync(join(cacheDir, '2.6.0'), { recursive: true })
    expect(getNewestPluginCacheVersion(cacheDir)).toBe('2.7.6')
  })

  it('returns the single version when only one exists', () => {
    const cacheDir = join(tmpDir, 'plugin-cache')
    mkdirSync(join(cacheDir, '1.0.0'), { recursive: true })
    expect(getNewestPluginCacheVersion(cacheDir)).toBe('1.0.0')
  })

  it('ignores non-semver names in plugin cache', () => {
    const cacheDir = join(tmpDir, 'plugin-cache')
    mkdirSync(join(cacheDir, '2.7.6'), { recursive: true })
    mkdirSync(join(cacheDir, 'latest'), { recursive: true })
    mkdirSync(join(cacheDir, '.DS_Store'), { recursive: true })
    expect(getNewestPluginCacheVersion(cacheDir)).toBe('2.7.6')
  })

  it('correctly sorts 2.10.0 > 2.9.9 (numeric)', () => {
    const cacheDir = join(tmpDir, 'plugin-cache')
    mkdirSync(join(cacheDir, '2.9.9'), { recursive: true })
    mkdirSync(join(cacheDir, '2.10.0'), { recursive: true })
    expect(getNewestPluginCacheVersion(cacheDir)).toBe('2.10.0')
  })
})
