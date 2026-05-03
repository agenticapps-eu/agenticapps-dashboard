import {
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
  renameSync,
  unlinkSync,
  constants as fsConstants,
} from 'node:fs'
import { randomBytes } from 'node:crypto'

/**
 * Write data to filePath atomically: open a sibling tmp file with O_CREAT |
 * O_EXCL | O_NOFOLLOW (refuses to overwrite an existing tmp and refuses to
 * follow planted symlinks), write+fsync, then rename. Rename is atomic on
 * POSIX, so concurrent readers see either the old or new file — never a
 * truncated/partial write, and never a token leaked through a symlink-swap.
 *
 * Used for ~/.agenticapps/dashboard/{auth,registry,server,agent.pid} so a CLI
 * mutation while the daemon is running can never corrupt a JSON state file
 * and a same-uid attacker can never coerce auth-token contents through a
 * planted symlink at the tmp path.
 */
export function atomicWriteFile(filePath: string, body: string, mode: number): void {
  const tmp = `${filePath}.tmp.${process.pid}.${randomBytes(8).toString('hex')}`
  const flags =
    fsConstants.O_WRONLY |
    fsConstants.O_CREAT |
    fsConstants.O_EXCL |
    fsConstants.O_NOFOLLOW
  let fd: number | null = null
  try {
    fd = openSync(tmp, flags, mode)
    writeSync(fd, body)
    fsyncSync(fd)
  } catch (err) {
    if (fd !== null) {
      try {
        closeSync(fd)
      } catch {
        // already closed
      }
      fd = null
    }
    try {
      unlinkSync(tmp)
    } catch {
      // tmp may not exist
    }
    throw err
  }
  closeSync(fd)
  try {
    renameSync(tmp, filePath)
  } catch (err) {
    try {
      unlinkSync(tmp)
    } catch {
      // best-effort cleanup
    }
    throw err
  }
}
