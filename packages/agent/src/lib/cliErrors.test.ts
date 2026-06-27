/**
 * cliErrors.test.ts — handlers that translate library errors into CLI
 * user-facing messages + exit codes. RED-first per the workflow contract.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { exitOnRegistryLockTimeout } from './cliErrors.js'

/**
 * process.exit() throws inside tests so we can:
 *   - assert exit was called with a specific code via the spy,
 *   - prevent vitest itself from being killed by a real exit.
 * Mirrors the pattern commonly used to test CLI handlers without spawning
 * subprocesses — keeps the test in-process and synchronous.
 */
function withExitMock() {
  const exitSpy = vi
    .spyOn(process, 'exit')
    .mockImplementation((code?: string | number | null | undefined) => {
      throw new Error(`process.exit(${code ?? 0})`)
    })
  const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
  return { exitSpy, errSpy }
}

describe('exitOnRegistryLockTimeout', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exits(1) with a user-facing stderr message when err is a registry_lock_timeout Error', () => {
    const { exitSpy, errSpy } = withExitMock()
    const err = new Error('registry_lock_timeout: /tmp/agentic/registry.json.lock')
    expect(() => exitOnRegistryLockTimeout(err)).toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
    // Stderr must mention the lock so the user knows what's blocked; must NOT
    // dump the raw stack trace (the daemon's 503 doesn't either).
    const stderr = errSpy.mock.calls.map((c) => String(c[0])).join('')
    expect(stderr.toLowerCase()).toContain('lock')
  })

  it('returns without exiting when err is an Error with a different message', () => {
    const { exitSpy } = withExitMock()
    const err = new Error('something else entirely')
    expect(() => exitOnRegistryLockTimeout(err)).not.toThrow()
    expect(exitSpy).not.toHaveBeenCalled()
  })

  it('returns without exiting when err is not an Error instance', () => {
    const { exitSpy } = withExitMock()
    // Throw a non-Error value (string, null, plain object) — defensive: the
    // helper should not try to call .message on a non-Error.
    expect(() => exitOnRegistryLockTimeout('registry_lock_timeout: nope')).not.toThrow()
    expect(() => exitOnRegistryLockTimeout(null)).not.toThrow()
    expect(() => exitOnRegistryLockTimeout({ message: 'registry_lock_timeout' })).not.toThrow()
    expect(exitSpy).not.toHaveBeenCalled()
  })
})
