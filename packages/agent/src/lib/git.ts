import { execa } from 'execa'

import { GitResponseSchema, type GitResponse } from '@agenticapps/dashboard-shared'

import { GIT_ALLOWED_CMDS, type GitAllowedCmd } from '../constants.js'

export class GitNotAllowedError extends Error {
  constructor(public cmd: string) {
    super(`git subcommand not allowed: ${cmd}. Allowed: ${GIT_ALLOWED_CMDS.join(', ')}.`)
    this.name = 'GitNotAllowedError'
  }
}

const ARGV_BY_CMD: Record<GitAllowedCmd, string[]> = {
  log: ['log', '--oneline', '-20'],
  status: ['status', '--short'],
  'diff-stat': ['diff', '--stat', 'HEAD~1..HEAD'],
  branch: ['branch', '--show-current'],
}

/**
 * Run a git subcommand from the allow-list using execa with an argv array (no shell).
 * Throws GitNotAllowedError if cmd is not in GIT_ALLOWED_CMDS — before any spawn.
 * On allowed cmds, resolves with GitResponse; non-zero exit codes are part of the response,
 * not thrown exceptions. Spawn failures (e.g. nonexistent cwd) surface as exitCode 128.
 */
export async function runAllowedGit(cmd: string, cwd: string): Promise<GitResponse> {
  if (!(GIT_ALLOWED_CMDS as readonly string[]).includes(cmd)) {
    throw new GitNotAllowedError(cmd)
  }
  const argv = ARGV_BY_CMD[cmd as GitAllowedCmd]
  try {
    // execa with argv array — no shell interpretation of cwd or args (T-01-03-05)
    const result = await execa('git', argv, {
      cwd,
      reject: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // execa returns exitCode: null on spawn errors (e.g. ENOENT cwd); treat as 128
    const exitCode = result.exitCode ?? 128
    return GitResponseSchema.parse({
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode,
    })
  } catch (err) {
    // Unexpected spawn failure — return non-zero response rather than throwing
    return GitResponseSchema.parse({
      stdout: '',
      stderr: String((err as Error).message ?? err),
      exitCode: 128,
    })
  }
}
