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
import { lstat, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { resolveAllowedNamed } from '../paths.js'

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

/** No key input is worth reading more of a file than this. */
const MAX_IDENTITY_BYTES = 512 * 1024

/**
 * The file's content hash, or a marker distinguishing absent from refused.
 *
 * The path is resolved through the daemon's contained-read primitive before it
 * is opened, exactly as the sibling reader in `readinessFile.ts` does. Hashing
 * a file is not a harmless read: the hash keys the memo, cache invalidation is
 * observable through `generatedAt`, and a candidate symlinked out of the repo
 * would turn that into a change oracle on a file the policy forbids opening.
 *
 * A refusal is its own identity value, so declining to follow an escaping
 * symlink still reads differently from finding no file at all.
 */
async function fileIdentity(path: string, root: string): Promise<string> {
  let absolute: string
  try {
    await lstat(path)
  } catch {
    return 'absent'
  }
  try {
    absolute = await resolveAllowedNamed(path, {
      roots: [root],
      allowedNames: [basename(path)],
    })
  } catch {
    return 'refused'
  }

  try {
    const info = await stat(absolute)
    if (info.size > MAX_IDENTITY_BYTES) return 'oversized'
    return createHash('sha256').update(await readFile(absolute)).digest('hex')
  } catch {
    return 'unreadable'
  }
}

/**
 * The inputs shared by every repo in one request. Registry order is part of the
 * signature because the fleet is served in that order, so a reorder changes the
 * response even when membership does not.
 */
export async function fleetSignature(
  entries: readonly RegistryIdentity[],
  // Accepts `undefined` values because the caller builds this from
  // `defaultMachineRoots()`, where a host that is not installed leaves its key
  // present and its value undefined. A host with no root contributes nothing:
  // dropping it here is what stops `join(undefined, ...)` throwing and taking
  // the whole fleet computation with it.
  machineSkillRoots: Readonly<Record<string, string | undefined>>,
): Promise<string> {
  const registry = entries.flatMap((entry) => [entry.id, entry.root])
  const rooted = Object.entries(machineSkillRoots).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  )
  const hosts = rooted.map(([host]) => host).sort()
  const roots = new Map(rooted)
  const identities = await Promise.all(
    hosts.map((host) => {
      const root = roots.get(host)!
      return fileIdentity(join(root, SKILL_RELATIVE_PATH), root)
    }),
  )
  const machine = hosts.flatMap((host, index) => [host, identities[index]!])
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
    await fileIdentity(join(root, READINESS_FILE_PATH), root),
  ])
}
