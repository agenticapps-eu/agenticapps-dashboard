import { writeFileSync, chmodSync, renameSync } from 'node:fs'

/**
 * Write JSON to filePath atomically: write to a sibling tmp file with the
 * desired mode, chmod (umask-safe), then rename. The rename is atomic on POSIX,
 * so a concurrent reader sees either the old file or the new file — never a
 * truncated/partial write.
 *
 * Used for ~/.agenticapps/dashboard/{auth,registry,server,agent.pid} so a CLI
 * mutation while the daemon is running can never corrupt a JSON state file.
 */
export function atomicWriteFile(filePath: string, body: string, mode: number): void {
  const tmp = `${filePath}.tmp.${process.pid}`
  writeFileSync(tmp, body, { mode })
  chmodSync(tmp, mode)
  renameSync(tmp, filePath)
}
