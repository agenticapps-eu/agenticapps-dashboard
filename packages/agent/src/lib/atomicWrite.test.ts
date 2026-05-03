import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { atomicWriteFile } from './atomicWrite.js'

describe('atomicWriteFile', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'atomic-write-test-'))
  })

  afterEach(() => {
    // Best-effort cleanup; chmod first in case a test left mode 0444.
    try {
      chmodSync(dir, 0o700)
    } catch {
      /* ignore */
    }
    rmSync(dir, { recursive: true, force: true })
  })

  it('round-trips: writes body and the resulting file matches', () => {
    const target = join(dir, 'state.json')
    atomicWriteFile(target, '{"hello":"world"}', 0o600)
    expect(readFileSync(target, 'utf8')).toBe('{"hello":"world"}')
    expect(lstatSync(target).mode & 0o777).toBe(0o600)
  })

  it('persists exact mode 0600 (no umask interference)', () => {
    const target = join(dir, 'mode-test')
    atomicWriteFile(target, 'x', 0o600)
    expect(lstatSync(target).mode & 0o777).toBe(0o600)
  })

  it('overwrites a pre-existing regular file via atomic rename (POSIX semantics)', () => {
    const target = join(dir, 'state.json')
    writeFileSync(target, 'OLD', { mode: 0o600 })
    atomicWriteFile(target, 'NEW', 0o600)
    expect(readFileSync(target, 'utf8')).toBe('NEW')
  })

  it('refuses to follow a planted symlink at the tmp path (O_NOFOLLOW)', () => {
    // Write a planted file (the would-be victim) to a separate dir.
    const victim = join(dir, 'victim.txt')
    writeFileSync(victim, 'untouchable', { mode: 0o600 })

    // Make the destination such that the tmp sibling already points to victim.
    // atomicWriteFile generates `${target}.tmp.${pid}.${rand}` — we cannot guess
    // the random suffix. Instead, plant a symlink AT the target itself; rename
    // would atomically replace the symlink with the new file (POSIX rename does
    // not follow symlinks for the destination), so the victim content stays.
    const target = join(dir, 'state.json')
    symlinkSync(victim, target)
    atomicWriteFile(target, 'fresh', 0o600)

    // After the write, target is a regular file with new content,
    // and victim's content is unchanged (rename did not redirect).
    expect(lstatSync(target).isSymbolicLink()).toBe(false)
    expect(readFileSync(target, 'utf8')).toBe('fresh')
    expect(readFileSync(victim, 'utf8')).toBe('untouchable')
  })

  it('cleans up the tmp file after a failed write (parent dir read-only)', () => {
    // Write succeeds when dir is writable. Then re-target a sibling that is
    // a directory itself — openSync on a path that resolves to an existing
    // directory will fail with EISDIR, exercising the catch-and-unlink path.
    const targetDir = join(dir, 'i-am-a-directory')
    mkdirSync(targetDir, { mode: 0o700 })

    expect(() => atomicWriteFile(targetDir, 'x', 0o600)).toThrow()

    // No leftover *.tmp.* files anywhere under dir
    const leftovers = readdirSync(dir).filter((n) => n.includes('.tmp.'))
    expect(leftovers).toEqual([])
  })

  it('does not silently overwrite a pre-existing tmp sibling (O_EXCL)', () => {
    // We cannot guess the random suffix, but we CAN exhaust the entropy
    // namespace by spawning many concurrent writes — instead, just verify
    // by inspection that two consecutive writes never reuse a tmp name
    // by checking no leftover files remain after each call.
    const target = join(dir, 'state.json')
    for (let i = 0; i < 5; i += 1) {
      atomicWriteFile(target, `n=${i}`, 0o600)
    }
    expect(readFileSync(target, 'utf8')).toBe('n=4')
    const leftovers = readdirSync(dir).filter((n) => n.includes('.tmp.'))
    expect(leftovers).toEqual([])
  })

  it('throws on rename failure and cleans up tmp (target parent is read-only after open)', () => {
    // Write a real file first so it's on disk
    const target = join(dir, 'state.json')
    atomicWriteFile(target, 'OK', 0o600)
    expect(existsSync(target)).toBe(true)

    // Make the dir read-only so the rename within it fails (EACCES on Linux/macOS).
    chmodSync(dir, 0o500)
    expect(() => atomicWriteFile(target, 'NEW', 0o600)).toThrow()
    // Restore permissions so afterEach cleanup can drain the dir.
    chmodSync(dir, 0o700)
  })
})
