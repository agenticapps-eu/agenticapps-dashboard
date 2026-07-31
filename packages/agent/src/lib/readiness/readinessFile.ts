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
import { lstat, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

import {
  ReadinessFileSchema,
  type ReadinessFile,
  type ReadinessNotice,
} from '@agenticapps/dashboard-shared'

import { resolveAllowedNamed } from '../paths.js'

export const READINESS_FILE_PATH = '.agenticapps/readiness.json'
const MAX_FILE_BYTES = 64 * 1024

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

  let present: boolean
  try {
    await lstat(candidate)
    present = true
  } catch {
    present = false
  }
  if (!present) return { kind: 'absent' }

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
  return { kind: 'usable', file: result.data }
}
