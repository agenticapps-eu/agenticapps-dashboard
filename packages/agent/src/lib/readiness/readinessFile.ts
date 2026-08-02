/**
 * readinessFile.ts — the tier-B reader for <repo>/.agenticapps/readiness.json.
 *
 * Tier B is trusted author input: a repo may declare a state better than the one
 * the daemon would derive, because the file exists to report what the daemon
 * cannot see. Trust does not extend to accepting a file it cannot understand —
 * an unsupported version, unparsable JSON or a malformed known entry discards the
 * whole file and raises a visible notice. Falling back to derived values silently
 * would make a typo indistinguishable from a repo that never declared anything.
 *
 * Two failures are narrower than the file, because both have a trustworthy entry
 * boundary to narrow to:
 *
 * - An unrecognised check identifier, which the schema discards entry by entry so
 *   a newer repo can declare a check this daemon does not know.
 * - A citation that cannot be verified, which rejects the entry that cites it.
 *   The file stays usable and the caller reports that entry's check as an
 *   error-bearing `fail` — never as its derived value, which would make a refused
 *   declaration indistinguishable from one that was never made.
 *
 * Whole-file invalidation is kept for malformations that put the *structure* in
 * question, where there is no reliable notion of which entry to blame.
 */
import { lstat, open, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'

import {
  ReadinessFileSchema,
  type CheckId,
  type ReadinessFile,
  type ReadinessNotice,
} from '@agenticapps/dashboard-shared'

import { resolveAllowedNamed } from '../paths.js'

export const READINESS_FILE_PATH = '.agenticapps/readiness.json'
const MAX_FILE_BYTES = 64 * 1024
/** Evidence is prose or a report, not the 64 KB budget the declaration file gets. */
const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024

/** Why one declared entry's citation could not be verified. */
export interface RejectedCitation {
  /** The repo-relative path the entry cited. */
  cited: string
  /** Why it could not be verified. Safe to put on the wire. */
  reason: string
}

export type ReadinessFileOutcome =
  | { kind: 'absent' }
  | { kind: 'unusable'; notice: ReadinessNotice }
  | {
      kind: 'usable'
      file: ReadinessFile
      /**
       * Entries whose citation failed verification, by check id. The file is
       * still usable — every other declaration in it holds — but these entries
       * SHALL NOT be honoured and SHALL NOT fall back to a derived value. The
       * caller turns each into an error-bearing declared `fail`.
       */
      rejected: Map<CheckId, RejectedCitation>
      /** Raised while any entry is rejected, so the author sees there is a fix to make. */
      notice: ReadinessNotice | null
    }

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

  const rejected = await rejectedCitations(root, result.data)
  return {
    kind: 'usable',
    file: result.data,
    rejected,
    notice: citationNotice(rejected),
  }
}

/**
 * The schema checks the *shape* of an evidence path. It cannot check that the
 * file is there, and a declaration whose evidence cannot be opened is a claim
 * with nothing behind it — indistinguishable, to a reader, from one that is
 * fully substantiated. Tier B is trusted author input precisely because it is
 * auditable, so an unopenable citation is refused.
 *
 * The refusal is scoped to the entry that cites it. It used to discard the whole
 * file, which meant one moved artifact silently took every unrelated declaration
 * in the repo with it. What made the wider radius defensible was that partial
 * acceptance would report some declarations from a file already judged
 * malformed; that objection is answered by not accepting the rejected entry
 * either — the caller turns it into an error-bearing `fail` rather than letting
 * it fall back to a derived value.
 *
 * Every entry is checked, not just up to the first failure, so an author fixing
 * three broken citations learns about all three in one run.
 *
 * Containment goes through the same named-read primitive the coverage artifact
 * uses, so a symlink out of the repository is refused before any bytes are read.
 * The basename is passed as the allow-list because evidence is author-named.
 */
async function rejectedCitations(
  root: string,
  file: ReadinessFile,
): Promise<Map<CheckId, RejectedCitation>> {
  const rejected = new Map<CheckId, RejectedCitation>()

  for (const entry of file.checks ?? []) {
    const cited = 'evidence' in entry ? entry.evidence : undefined
    if (typeof cited !== 'string' || cited === '') continue

    const reason = await citationFailure(root, cited)
    if (reason) rejected.set(entry.id, { cited, reason })
  }
  return rejected
}

/** Why this citation cannot be verified, or null when it opens cleanly. */
async function citationFailure(root: string, cited: string): Promise<string | null> {
  let absolute: string
  try {
    absolute = await resolveAllowedNamed(join(root, cited), {
      roots: [root],
      allowedNames: [basename(cited)],
    })
  } catch {
    return `${cited} does not resolve inside the repository`
  }

  try {
    const info = await stat(absolute)
    // `stat` succeeds on a directory, so existence alone does not establish
    // that the citation can be opened. Only a regular file is evidence.
    if (!info.isFile()) return `${cited} is not a readable file`
    if (info.size > MAX_EVIDENCE_BYTES) return `${cited} is larger than the read bound`
    // Opened, not merely described. A path can stat cleanly and still be
    // unreadable — wrong mode, a dangling mount — and the spec's bounded-read
    // requirement is about the read, not the metadata.
    await (await open(absolute, 'r')).close()
  } catch {
    return `${cited} could not be read`
  }
  return null
}

/**
 * One notice for however many entries were rejected. Only the first is named:
 * six citations at the schema's 512-character path limit would blow the notice's
 * 600-character bound, and a notice truncated by the outbound validator is worse
 * than one that names a count. Each rejected check carries its own path in its
 * own error, which is where a reader fixing them will actually look.
 */
function citationNotice(
  rejected: ReadonlyMap<CheckId, RejectedCitation>,
): ReadinessNotice | null {
  const [first] = rejected.values()
  if (!first) return null

  const others = rejected.size - 1
  const suffix = others > 0 ? ` (and ${others} other declared check${others > 1 ? 's' : ''})` : ''
  return {
    code: 'readiness-file-invalid',
    message: `${READINESS_FILE_PATH} cites evidence that could not be verified: ${first.reason}${suffix}`,
  }
}
