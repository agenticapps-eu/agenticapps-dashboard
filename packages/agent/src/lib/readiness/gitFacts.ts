/**
 * gitFacts.ts — the read-only git plumbing readiness freshness needs.
 *
 * Freshness is an ancestry relation, never a filesystem timestamp: a fresh
 * clone stamps every file with the checkout time, which would make evidence
 * that does not descend from the last production commit look current. Committer
 * timestamps are carried for display and candidate selection only.
 *
 * Every call is argv-array execa with a fixed timeout, `reject: false`, and no
 * shell — a non-zero exit is data, not an exception, so one unreadable repo
 * degrades its own checks instead of the fleet response.
 */
import { execa } from 'execa'

import { GIT_SUBPROCESS_TIMEOUT_MS } from '../../constants.js'

export interface CommitStamp {
  sha: string
  /** Committer time in epoch milliseconds, UTC. */
  at: number
}

export interface GitFacts {
  /** False when the directory is not a git work tree, or git is unusable. */
  available: boolean
  /** Repo-relative tracked and unignored-untracked paths. */
  files: string[]
  /** Repo-relative paths that are modified, staged, deleted or untracked. */
  changed: string[]
}

export interface GitResult {
  ok: boolean
  stdout: string
  exitCode: number
}

/**
 * Exported as `runGit` for the cache fingerprint, which asks this repo two
 * further read-only questions and must inherit the same hardening — argv array,
 * fixed timeout, no shell, non-zero exit as data — rather than restate it.
 */
export async function runGit(root: string, args: string[]): Promise<GitResult> {
  try {
    const result = await execa('git', ['-c', 'core.quotePath=false', ...args], {
      cwd: root,
      reject: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: GIT_SUBPROCESS_TIMEOUT_MS,
    })
    const exitCode = result.exitCode ?? 128
    return { ok: exitCode === 0, stdout: result.stdout ?? '', exitCode }
  } catch {
    return { ok: false, stdout: '', exitCode: 128 }
  }
}

const splitNul = (raw: string): string[] => raw.split('\0').filter(Boolean)

export async function readGitFacts(root: string): Promise<GitFacts> {
  const listed = await runGit(root, [
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--exclude-standard',
  ])
  if (!listed.ok) return { available: false, files: [], changed: [] }

  const status = await runGit(root, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
  ])

  return {
    available: true,
    files: [...new Set(splitNul(listed.stdout))],
    changed: status.ok ? parseStatus(status.stdout) : [],
  }
}

/**
 * `status -z` emits one NUL-terminated `XY path` record per entry, and a rename
 * or copy follows its record with a second record holding the original path.
 * Both sides count: moving a production file changes production code.
 */
function parseStatus(raw: string): string[] {
  const records = splitNul(raw)
  const changed: string[] = []
  for (let i = 0; i < records.length; i++) {
    const record = records[i]!
    const flags = record.slice(0, 2)
    const path = record.slice(3)
    if (path) changed.push(path)
    if (flags.includes('R') || flags.includes('C')) {
      const original = records[++i]
      if (original) changed.push(original)
    }
  }
  return [...new Set(changed)]
}

/** The newest commit touching any path the pathspecs select, or null. */
export async function lastCommitTouching(
  root: string,
  pathspecs: readonly string[],
): Promise<CommitStamp | null> {
  const result = await runGit(root, [
    'log',
    '-1',
    '--format=%H\t%ct',
    '--',
    ...pathspecs,
  ])
  if (!result.ok) return null
  return parseStamp(result.stdout.trim())
}

function parseStamp(line: string): CommitStamp | null {
  const [sha, seconds] = line.split('\t')
  if (!sha || !seconds) return null
  const at = Number(seconds)
  return Number.isFinite(at) ? { sha, at: at * 1000 } : null
}

/**
 * Newest commit per path under the given directories, in one history walk —
 * candidate selection needs a timestamp for every artifact, and one subprocess
 * per candidate would multiply across the fleet. A path absent from the map has
 * never been committed.
 */
export async function commitTimesFor(
  root: string,
  dirs: readonly string[],
): Promise<Map<string, CommitStamp>> {
  const times = new Map<string, CommitStamp>()
  const result = await runGit(root, [
    'log',
    // %x01 marks a commit header, so a header is never mistaken for a path.
    '--format=%x01%H\t%ct',
    '--name-only',
    '--no-renames',
    '--',
    ...dirs,
  ])
  if (!result.ok) return times

  let current: CommitStamp | null = null
  for (const line of result.stdout.split('\n')) {
    if (line.charCodeAt(0) === 1) {
      current = parseStamp(line.slice(1))
      continue
    }
    if (!line || !current) continue
    // git logs newest first, so the first sighting of a path is its newest.
    if (!times.has(line)) times.set(line, current)
  }
  return times
}

/** True when `ancestor` is reachable from `descendant`; false if either is unknown. */
export async function isAncestor(
  root: string,
  ancestor: string,
  descendant: string,
): Promise<boolean> {
  const result = await runGit(root, ['merge-base', '--is-ancestor', ancestor, descendant])
  return result.exitCode === 0
}
