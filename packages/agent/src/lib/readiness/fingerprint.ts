/**
 * fingerprint.ts — the key the readiness memo is held under.
 *
 * The cache has two independent expiries. Five seconds is the ceiling; this key
 * is the floor, and it drops a snapshot the moment any input it was computed
 * from moves: HEAD, the working tree, the readiness file, registry membership,
 * or a machine-global workflow skill. Without it a five-second window would
 * happily serve a reading taken before the commit the user just made.
 *
 * Two of those inputs are fleet-wide rather than per-repo, so `fleetSignature`
 * is computed once per request and folded into every repo's key. The remaining
 * three cost two git subprocesses and one file read per repo — far less than
 * the derivation the hit avoids.
 *
 * The key is a hash, never a path: it is held in memory and never serialised to
 * a client, but hashing means an accidental exposure would leak nothing.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { runGit } from './gitFacts.js'
import { READINESS_FILE_PATH } from './readinessFile.js'

/** Registry identity as the fleet endpoint reads it: id, root, and order. */
export interface RegistryIdentity {
  id: string
  root: string
}

const SKILL_RELATIVE_PATH = join('agentic-apps-workflow', 'SKILL.md')

function hash(parts: readonly string[]): string {
  const digest = createHash('sha256')
  for (const part of parts) digest.update(part).update('\0')
  return digest.digest('hex')
}

/** The file's content hash, or a marker distinguishing absent from unreadable. */
function fileIdentity(path: string): string {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex')
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'ENOENT'
      ? 'absent'
      : 'unreadable'
  }
}

/**
 * The inputs shared by every repo in one request. Registry order is part of the
 * signature because the fleet is served in that order, so a reorder changes the
 * response even when membership does not.
 */
export function fleetSignature(
  entries: readonly RegistryIdentity[],
  machineSkillRoots: Readonly<Record<string, string>>,
): string {
  const registry = entries.flatMap((entry) => [entry.id, entry.root])
  const machine = Object.keys(machineSkillRoots)
    .sort()
    .flatMap((host) => [
      host,
      fileIdentity(join(machineSkillRoots[host]!, SKILL_RELATIVE_PATH)),
    ])
  return hash(['registry', ...registry, 'machine', ...machine])
}

/**
 * The whole dirty/untracked set is folded in, not just the production-code
 * subset the freshness rules care about. Narrowing it would need the readiness
 * file parsed first to know the configured scope, and the cost of that is worse
 * than the cost of recomputing when someone edits a doc. Over-invalidating is
 * safe in a direction that staleness is not.
 */
export async function repoFingerprint(
  root: string,
  fleet: string,
): Promise<string> {
  const head = await runGit(root, ['rev-parse', 'HEAD'])
  const status = await runGit(root, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
  ])

  return hash([
    fleet,
    'head',
    head.ok ? head.stdout.trim() : `unavailable:${head.exitCode}`,
    'status',
    status.ok ? status.stdout : `unavailable:${status.exitCode}`,
    'readiness',
    fileIdentity(join(root, READINESS_FILE_PATH)),
  ])
}
