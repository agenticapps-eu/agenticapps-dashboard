/**
 * readinessFile.ts — the tier-B reader for <repo>/.agenticapps/readiness.json.
 *
 * Tier B is trusted author input: a repo may declare a state better than the one
 * the daemon would derive, because the file exists to report what the daemon
 * cannot see. Trust does not extend to accepting a file it cannot understand —
 * an unsupported version, unparsable JSON, a malformed known entry, an escaping
 * path or an oversized file discards the whole file and raises a visible notice.
 * Falling back to derived values silently would make a typo indistinguishable
 * from a repo that never declared anything.
 *
 * The one deliberate exception is an unrecognised check identifier, which the
 * schema discards entry by entry so a newer repo can declare a check this daemon
 * does not know without losing its whole file.
 */
import { lstat, open, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'

import {
  ReadinessFileSchema,
  type ReadinessFile,
  type ReadinessNotice,
} from '@agenticapps/dashboard-shared'

import { resolveAllowedNamed } from '../paths.js'

export const READINESS_FILE_PATH = '.agenticapps/readiness.json'
const MAX_FILE_BYTES = 64 * 1024
/** Evidence is prose or a report, not the 64 KB budget the declaration file gets. */
const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024

export type ReadinessFileOutcome =
  | { kind: 'absent' }
  | { kind: 'unusable'; notice: ReadinessNotice }
  | { kind: 'usable'; file: ReadinessFile }

const unusable = (
  code: ReadinessNotice['code'],
  message: string,
): ReadinessFileOutcome => ({ kind: 'unusable', notice: { code, message } })

export async function readReadinessFile(root: string): Promise<ReadinessFileOutcome> {
  const candidate = join(root, READINESS_FILE_PATH)

  // "There is no file" and "I could not look" are different facts, and only the
  // first is `absent`. The distinction became load-bearing when the readiness
  // predicate started suspending the advisory exemption on a notice: classify an
  // unreadable `.agenticapps/` as absent and a repo could reach ready by making
  // its own declarations unreachable — the same hole the notice guard closes for
  // every other unreadability mode, reopened through `lstat`.
  //
  // ENOENT and ENOTDIR mean the path genuinely is not there. EACCES, ELOOP and
  // anything else mean the answer is unknown, which is not the same as no.
  try {
    await lstat(candidate)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return { kind: 'absent' }
    return unusable(
      'readiness-file-invalid',
      `${READINESS_FILE_PATH} could not be read`,
    )
  }

  let absolute: string
  try {
    // Containment through the daemon's named-read primitive: a file that
    // resolves out of the repository is refused before any bytes are read.
    absolute = await resolveAllowedNamed(candidate, {
      roots: [root],
      allowedNames: ['readiness.json'],
    })
  } catch {
    return unusable(
      'readiness-file-invalid',
      `${READINESS_FILE_PATH} does not resolve inside the repository`,
    )
  }

  let raw: string
  try {
    const info = await stat(absolute)
    if (info.size > MAX_FILE_BYTES) {
      return unusable(
        'readiness-file-invalid',
        `${READINESS_FILE_PATH} is larger than the read bound`,
      )
    }
    raw = await readFile(absolute, 'utf8')
  } catch {
    return unusable(
      'readiness-file-invalid',
      `${READINESS_FILE_PATH} could not be read`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return unusable(
      'readiness-file-unparsable',
      `${READINESS_FILE_PATH} is not valid JSON`,
    )
  }

  // Version is checked before the schema so that a file written for a later
  // daemon reports "unsupported version" rather than a list of shape errors.
  const version = (parsed as { schemaVersion?: unknown })?.schemaVersion
  if (version !== 1) {
    return unusable(
      'readiness-file-unsupported-version',
      `${READINESS_FILE_PATH} declares a schemaVersion this daemon does not support`,
    )
  }

  const result = ReadinessFileSchema.safeParse(parsed)
  if (!result.success) {
    return unusable(
      'readiness-file-invalid',
      `${READINESS_FILE_PATH} does not match the readiness file schema`,
    )
  }

  return (await evidenceIsReadable(root, result.data)) ?? {
    kind: 'usable',
    file: result.data,
  }
}

/**
 * The schema checks the *shape* of an evidence path. It cannot check that the
 * file is there, and a declaration whose evidence cannot be opened is a claim
 * with nothing behind it — indistinguishable, to a reader, from one that is
 * fully substantiated. Tier B is trusted author input precisely because it is
 * auditable, so an unopenable citation is treated as a malformed entry and
 * discards the whole file, exactly as an escaping path or a bad shape does.
 *
 * Containment goes through the same named-read primitive the coverage artifact
 * uses, so a symlink out of the repository is refused before any bytes are read.
 * The basename is passed as the allow-list because evidence is author-named.
 *
 * Returns an outcome when the file must be refused, and undefined when every
 * cited path is present, contained and within the read bound.
 */
async function evidenceIsReadable(
  root: string,
  file: ReadinessFile,
): Promise<ReadinessFileOutcome | undefined> {
  for (const entry of file.checks ?? []) {
    const cited = 'evidence' in entry ? entry.evidence : undefined
    if (typeof cited !== 'string' || cited === '') continue

    let absolute: string
    try {
      absolute = await resolveAllowedNamed(join(root, cited), {
        roots: [root],
        allowedNames: [basename(cited)],
      })
    } catch {
      return unusable(
        'readiness-file-invalid',
        `${cited} does not resolve inside the repository`,
      )
    }

    try {
      const info = await stat(absolute)
      // `stat` succeeds on a directory, so existence alone does not establish
      // that the citation can be opened. Only a regular file is evidence.
      if (!info.isFile()) {
        return unusable('readiness-file-invalid', `${cited} is not a readable file`)
      }
      if (info.size > MAX_EVIDENCE_BYTES) {
        return unusable('readiness-file-invalid', `${cited} is larger than the read bound`)
      }
      // Opened, not merely described. A path can stat cleanly and still be
      // unreadable — wrong mode, a dangling mount — and the spec's bounded-read
      // requirement is about the read, not the metadata.
      await (await open(absolute, 'r')).close()
    } catch {
      return unusable('readiness-file-invalid', `${cited} could not be read`)
    }
  }
  return undefined
}
