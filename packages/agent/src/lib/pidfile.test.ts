import { describe, it, expect, afterEach } from 'vitest'
import { join } from 'node:path'
import { makeTmpHome } from './__fixtures__/tmpHome.js'
import {
  isProcessAlive,
  writePidfile,
  readPidfile,
  removePidfile,
  assertNoStaleDaemon,
  StaleDaemonError,
} from './pidfile.js'

describe('pidfile utilities', () => {
  let cleanup: () => void

  afterEach(() => {
    cleanup?.()
  })

  it('isProcessAlive returns true for own pid', () => {
    expect(isProcessAlive(process.pid)).toBe(true)
  })

  it('isProcessAlive returns false for nonexistent pid', () => {
    expect(isProcessAlive(99999999)).toBe(false)
  })

  it('writePidfile + readPidfile round-trip', () => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    const pidfile = join(tmp.configDir, 'agent.pid')
    writePidfile(42, pidfile)
    expect(readPidfile(pidfile)).toBe(42)
  })

  it('assertNoStaleDaemon throws StaleDaemonError when pidfile contains alive pid', () => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    const pidfile = join(tmp.configDir, 'agent.pid')
    writePidfile(process.pid, pidfile) // own pid is alive
    expect(() => assertNoStaleDaemon(pidfile)).toThrow(StaleDaemonError)
  })

  it('assertNoStaleDaemon silently removes stale pidfile when pid is dead', () => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    const pidfile = join(tmp.configDir, 'agent.pid')
    writePidfile(99999999, pidfile) // dead pid
    expect(() => assertNoStaleDaemon(pidfile)).not.toThrow()
    expect(readPidfile(pidfile)).toBeNull()
  })

  it('removePidfile is idempotent (no throw when file missing)', () => {
    const tmp = makeTmpHome()
    cleanup = tmp.cleanup
    const pidfile = join(tmp.configDir, 'nonexistent.pid')
    expect(() => removePidfile(pidfile)).not.toThrow()
  })
})
