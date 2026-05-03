import { readFileSync, unlinkSync, existsSync } from 'node:fs'

import { PIDFILE } from '../constants.js'

import { atomicWriteFile } from './atomicWrite.js'

/**
 * Check if a process is alive by sending signal 0.
 * ESRCH = no such process (dead/stale)
 * EPERM = process exists but owned by different user (still alive)
 * No error = process is alive
 *
 * See CONTEXT.md D-07 and RESEARCH Pattern 10.
 */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'ESRCH') return false // process does not exist
    if (code === 'EPERM') return true // process exists, can't signal it
    return false
  }
}

export function writePidfile(pid: number = process.pid, file: string = PIDFILE): void {
  atomicWriteFile(file, String(pid), 0o600)
}

export function readPidfile(file: string = PIDFILE): number | null {
  if (!existsSync(file)) return null
  const raw = readFileSync(file, 'utf8').trim()
  const pid = Number.parseInt(raw, 10)
  return Number.isFinite(pid) ? pid : null
}

export function removePidfile(file: string = PIDFILE): void {
  if (existsSync(file)) unlinkSync(file)
}

export class StaleDaemonError extends Error {
  constructor(public pid: number) {
    super(
      `Daemon already running (pid ${pid}). Run \`agentic-dashboard stop\` or \`kill ${pid}\`.`,
    )
    this.name = 'StaleDaemonError'
  }
}

/**
 * Assert no daemon is already running. Throws StaleDaemonError if the pidfile
 * contains an alive pid. Silently removes stale pidfile when pid is dead.
 */
export function assertNoStaleDaemon(file: string = PIDFILE): void {
  const pid = readPidfile(file)
  if (pid === null) return
  if (isProcessAlive(pid)) throw new StaleDaemonError(pid)
  removePidfile(file) // stale — clean up silently
}
