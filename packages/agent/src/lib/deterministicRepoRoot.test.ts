/**
 * deterministicRepoRoot.test.ts — D-13-EXT-09 corollary (Codex CRITICAL #2).
 *
 * Realpath-guarded symlink escape defence for `deterministicRepoRoot()`.
 * Each test uses a real tmpdir + HOME override so symlinks resolve genuinely.
 *
 * Mocks would obscure the realpath syscall behaviour we're testing — these
 * are intentionally integration-flavour unit tests against the file-system.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { deterministicRepoRoot } from './gitnexusScan.js'

describe('deterministicRepoRoot — D-13-EXT-09 corollary (Codex CRITICAL #2 symlink escape)', () => {
  let stashedHome: string | undefined
  let fakeHome: string
  let escapeTarget: string

  beforeEach(() => {
    stashedHome = process.env.HOME
    fakeHome = mkdtempSync(join(tmpdir(), 'dash-home-'))
    process.env.HOME = fakeHome
    escapeTarget = mkdtempSync(join(tmpdir(), 'escape-target-'))
  })

  afterEach(() => {
    if (stashedHome !== undefined) process.env.HOME = stashedHome
    else delete process.env.HOME
    try { rmSync(fakeHome, { recursive: true, force: true }) } catch { /* best-effort */ }
    try { rmSync(escapeTarget, { recursive: true, force: true }) } catch { /* best-effort */ }
  })

  it('returns null when the family/repo path is a symlink that resolves OUTSIDE the family root', () => {
    const familyRoot = join(fakeHome, 'Sourcecode', 'agenticapps')
    mkdirSync(familyRoot, { recursive: true })
    symlinkSync(escapeTarget, join(familyRoot, 'evil'), 'dir')

    expect(deterministicRepoRoot('agenticapps/evil')).toBeNull()
  })

  it('returns the path when the family/repo dir is a normal (non-symlink) directory', () => {
    const repoRoot = join(fakeHome, 'Sourcecode', 'agenticapps', 'good-repo')
    mkdirSync(repoRoot, { recursive: true })
    expect(deterministicRepoRoot('agenticapps/good-repo')).toBe(repoRoot)
  })

  it('returns the path when a symlink resolves BACK INTO the same family root (alias)', () => {
    const familyRoot = join(fakeHome, 'Sourcecode', 'agenticapps')
    mkdirSync(familyRoot, { recursive: true })
    const realRepo = join(familyRoot, 'real-repo')
    mkdirSync(realRepo)
    symlinkSync(realRepo, join(familyRoot, 'alias'), 'dir')

    expect(deterministicRepoRoot('agenticapps/alias')).toBe(join(familyRoot, 'alias'))
  })

  it('returns null when path is a regular file (not a directory)', () => {
    const familyRoot = join(fakeHome, 'Sourcecode', 'agenticapps')
    mkdirSync(familyRoot, { recursive: true })
    writeFileSync(join(familyRoot, 'file-not-dir'), 'x')
    expect(deterministicRepoRoot('agenticapps/file-not-dir')).toBeNull()
  })

  it('returns null for `.` and `..` repo segments at the helper level (defence-in-depth)', () => {
    const familyRoot = join(fakeHome, 'Sourcecode', 'agenticapps')
    mkdirSync(familyRoot, { recursive: true })
    expect(deterministicRepoRoot('agenticapps/..')).toBeNull()
    expect(deterministicRepoRoot('agenticapps/.')).toBeNull()
    expect(deterministicRepoRoot('agenticapps/foo..bar')).toBeNull()
  })

  it('returns null for an unknown family', () => {
    expect(deterministicRepoRoot('evil/anything')).toBeNull()
  })

  it('returns null when the family/repo dir does not exist on disk', () => {
    expect(deterministicRepoRoot('agenticapps/nonexistent')).toBeNull()
  })
})
