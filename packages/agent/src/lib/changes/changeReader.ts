/**
 * changeReader.ts — one repository's OpenSpec corpus, read bounded and
 * read-only.
 *
 * **The corpus rules are upstream's, mirrored, not invented here.**
 * `parseBacklog` (code-fence aware, with anchored closed-marker matchers),
 * `backlogSlug`, `archivedSlug`, the `occupiedSlugs` deduplication and
 * `MAX_SOURCE_RECORDS` all come from
 * `agents-task-viewer/src/openspec/reader.ts`. Three rounds of this change's
 * plan review were spent on the seams in hand-written substitutes for each of
 * them — a substring marker test that closed `Redone migration`, an identity of
 * heading-text-plus-index that reintroduced a separator hazard. When a
 * specification and a working implementation of the same behaviour both exist,
 * write against the implementation.
 *
 * This is deliberately **not** an extension of `openspecReader.ts`. That module
 * sits on the hot path for the `spec` readiness check and repo detail; widening
 * it would make every readiness scan pay for board data it never renders. The
 * duplicated directory listing is the price, and it is a decision rather than an
 * oversight — see design decision 3.
 *
 * ## What this module is allowed to touch
 *
 * `filesystem-access-policy` governs every read here, and the guard is three
 * things, not one:
 *
 * 1. `isReadableProjectPath` on the repo-relative path — lexical, and by its own
 *    docblock it answers "worth offering", never "will succeed".
 * 2. **Realpath containment scoped to `<root>/openspec`, not to `<root>`.** The
 *    narrower root is the point: a symlink under `openspec/` resolving to
 *    `.env` or `.git/config` passes a root-scoped check and fails this one. The
 *    board is entitled to a repository's OpenSpec tree, not to its repository.
 *    **The anchor itself is checked against the root's realpath first**, which
 *    this guard cannot do for itself: `openspec` *being* a symlink out of the
 *    repository redefines containment instead of violating it, so every
 *    per-path check below passes while the whole tree is somewhere else.
 * 3. A regular-file check and a **pre-read size cap** against
 *    `MAX_CHANGE_FILE_BYTES`, both made against **the open file descriptor**
 *    rather than re-resolved from the path. The cap is checked before the read,
 *    because the board reads three files per change in every registered
 *    repository on one fleet request — an oversized file is a whole-endpoint
 *    cost, not a per-card one. Every artifact is opened `O_NOFOLLOW`, so a
 *    symlinked artifact is refused outright wherever it points, which is
 *    upstream's rule too.
 *
 * It spawns no process. There is no git probe here and no `ship` stage to need
 * one.
 */
import { constants } from 'node:fs'
import { lstat, open, opendir, realpath } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

import {
  isReadableProjectPath,
  type ChangeArtifacts,
  type ChangeChecklistRow,
  type ChangeSource,
} from '@agenticapps/dashboard-shared'

import { parseChecklist, parseReviewEvidence, selectReviewRecord } from './stage.js'

/**
 * The pre-read size cap, in bytes. Upstream's `MAX_ARTIFACT_BYTES`.
 *
 * A module constant on purpose, like `OPENSPEC_MAX_OUTPUT_BYTES`: it is not
 * configurable, so it cannot be widened or disabled at runtime.
 */
export const MAX_CHANGE_FILE_BYTES = 1024 * 1024

/** Records admitted per source per repository. Upstream's `MAX_SOURCE_RECORDS`. */
export const MAX_SOURCE_RECORDS = 128

/** Immediate entries read from one directory before it is refused outright. */
const MAX_SOURCE_ENTRIES = 2048

/**
 * The repository's `openspec` anchor resolved outside its registered root.
 *
 * An error rather than a notice because it is repository-level: no source was
 * attempted, so there is no source to attach a notice to, and the service
 * already has a symbolic, path-free vocabulary for "this repository could not
 * be read". `filesystem-access-policy` › `A Containment Anchor Is Verified
 * Against Its Registered Root`.
 */
export class ContainmentAnchorEscaped extends Error {
  constructor() {
    super('openspec anchor resolves outside the registered root')
    this.name = 'ContainmentAnchorEscaped'
  }
}

/** A notice before the service attaches the repository it came from. */
export interface RepositoryNotice {
  source: ChangeSource | 'evidence'
  kind: 'collision' | 'empty-slug' | 'evidence-limited' | 'malformed' | 'rejected' | 'truncated'
  admitted?: number
  observed?: number
  changeName?: string
}

/** One admitted record, before `stage.ts` decides what it means. */
export interface ChangeRecord {
  source: ChangeSource
  /** The entry's own on-disk name. Identity, and the address's third parameter. */
  sourceInstance: string
  changeName: string
  title: string
  artifacts: ChangeArtifacts
  reviewerVendors: string[]
  hasRequestChanges: boolean
  reviewRecord: string | null
  checklist: ChangeChecklistRow[]
  archiveDate: string | null
  updatedAt: number
  evidenceLimited: boolean
}

export interface ReadChangesResult {
  records: ChangeRecord[]
  notices: RepositoryNotice[]
  /** Every repo-relative path read, when `recordPaths` is set. Tests only. */
  paths: string[]
}

export interface ReadChangesOptions {
  /**
   * Collect the repo-relative path of every file read, so a test can assert
   * that each one satisfies the read allow-list. Off in production: it is an
   * assertion aid, not a feature.
   */
  recordPaths?: boolean
}

// ── upstream's parsers, mirrored ────────────────────────────────────────────

function stripClosingHeadingDecoration(value: string): string {
  return value.replace(/[ \t]+#+[ \t]*$/u, '').trim()
}

/**
 * Anchored, not a substring test. A heading merely *containing* a marker word —
 * `Redone migration`, `Add WITHDRAWN flag support` — is not closed by it. The
 * loosened rule that closed both of those is the defect this replaced.
 */
function closedHeading(value: string): boolean {
  return /^(?:\[(?:RESOLVED|RETIRED|DONE|CLOSED)\]|(?:RESOLVED|RETIRED|DONE|CLOSED):)(?:[ \t]|$)/iu
    .test(value.trim())
}

function closedBodyLine(value: string): boolean {
  return /^(?:Status:|\*\*Status:\*\*)[ \t]+(?:RESOLVED|RETIRED|DONE|CLOSED)[.!?]?$/iu
    .test(value.trim())
}

/** Upstream's `backlogSlug`: NFKD, combining marks stripped, non-alphanumerics hyphenated. */
export function backlogSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
}

/** The exact ASCII dated basename shape an archive entry must have (ADR 0008 §3). */
export function archivedSlug(directoryName: string): string | undefined {
  return /^\d{4}-\d{2}-\d{2}-([A-Za-z0-9][A-Za-z0-9._-]*)$/u.exec(directoryName)?.[1]
}

function fenceOpening(line: string): { character: '`' | '~'; length: number } | undefined {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/u.exec(line)
  if (!match) return undefined
  const run = match[2]!
  if (run[0] === '`' && match[3]!.includes('`')) return undefined
  return { character: run[0] as '`' | '~', length: run.length }
}

function closesFence(line: string, fence: { character: '`' | '~'; length: number }): boolean {
  const character = fence.character === '`' ? '`' : '~'
  return new RegExp(`^ {0,3}(${character}{${fence.length},})[ \\t]*$`, 'u').test(line)
}

export interface BacklogRecord {
  changeName: string
  title: string
}

/**
 * Upstream's `parseBacklog`. Level-two ATX headings outside fenced code blocks;
 * an entry is closed by an anchored heading marker or by its **first non-empty
 * body line** being a status marker.
 */
export function parseBacklog(markdown: string): {
  records: BacklogRecord[]
  notices: RepositoryNotice[]
} {
  interface Section { title: string; firstBodyLine?: string }
  const sections: Section[] = []
  let current: Section | undefined
  let fence: { character: '`' | '~'; length: number } | undefined

  for (const line of markdown.split(/\r?\n/u)) {
    if (fence) {
      if (closesFence(line, fence)) fence = undefined
      continue
    }
    const opening = fenceOpening(line)
    if (opening) {
      fence = opening
      continue
    }

    const heading = /^##[ \t]+(.+?)\s*$/u.exec(line)
    if (heading) {
      current = { title: stripClosingHeadingDecoration(heading[1]!) }
      sections.push(current)
      continue
    }
    if (current && current.firstBodyLine === undefined && line.trim() !== '') {
      current.firstBodyLine = line.trim()
    }
  }

  const records: BacklogRecord[] = []
  const notices: RepositoryNotice[] = []
  const seen = new Set<string>()
  for (const section of sections) {
    if (closedHeading(section.title) || closedBodyLine(section.firstBodyLine ?? '')) continue
    const changeName = backlogSlug(section.title)
    if (!changeName) {
      notices.push({ source: 'backlog', kind: 'empty-slug' })
      continue
    }
    if (seen.has(changeName)) {
      notices.push({ source: 'backlog', kind: 'collision', changeName })
      continue
    }
    seen.add(changeName)
    records.push({ changeName, title: section.title })
  }
  return { records, notices }
}

// ── the guarded read ────────────────────────────────────────────────────────

type ReadOutcome =
  | { kind: 'ok'; text: string; updatedAt: number }
  /** Not there. Silent: absence is not a defect. */
  | { kind: 'absent' }
  /** Present, and the read was refused. Reported. */
  | { kind: 'limited'; updatedAt: number }
  /** Present, and not something we may read at all. Reported, and fatal to its change. */
  | { kind: 'rejected' }
  /** Present, and not readable as a regular UTF-8 file. Reported. */
  | { kind: 'malformed' }

interface ReadContext {
  /** The realpath of `<root>/openspec`, with a trailing separator. */
  openspecReal: string
  root: string
  paths: string[]
  recordPaths: boolean
}

/**
 * Whether a resolved path lies inside the OpenSpec tree.
 *
 * `startsWith(openspecReal)` alone would admit a sibling directory named
 * `openspec-notes`, so the prefix carries its separator.
 */
function contained(real: string, context: ReadContext): boolean {
  return real === context.openspecReal.slice(0, -1) || real.startsWith(context.openspecReal)
}

/**
 * One file, read only if every guard passes.
 *
 * **The mode, size and content checks are all made against one open file
 * descriptor**, not re-resolved from the path each time. An earlier draft did
 * `realpath` then `stat(path)` then `readFile(path)` — three separate
 * resolutions of the same name, so a path swapped between the stat and the read
 * would have been size-checked as one file and read as another. Round-4 review
 * caught it, and upstream's `readEvidenceText` already had the right shape:
 * open once, `fstat` the descriptor, read the descriptor.
 *
 * `O_NOFOLLOW` refuses a symlink at the final component outright, matching
 * upstream — there are no symlinked artifacts, in-tree or out, rather than a
 * rule about where a symlink is allowed to point. The realpath containment
 * check stays, because `O_NOFOLLOW` says nothing about a symlinked *parent*
 * directory.
 *
 * The residual window is between the containment check and the open, on
 * intermediate directories. It is the same one `coverageResolver` and upstream
 * both carry, and closing it needs `openat`-style descriptor-relative traversal
 * that Node does not expose.
 */
async function readGuarded(absolute: string, context: ReadContext): Promise<ReadOutcome> {
  const relativePath = relative(context.root, absolute)
  // Guard 1, lexical. A path whose *shape* the read allow-list would refuse is
  // not read whatever it resolves to.
  if (!isReadableProjectPath(relativePath)) return { kind: 'rejected' }

  let real: string
  try {
    real = await realpath(absolute)
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? { kind: 'absent' }
      : { kind: 'malformed' }
  }
  // Guard 2, containment — scoped to the OpenSpec tree, not the repository.
  if (!contained(real, context)) return { kind: 'rejected' }

  let file
  try {
    file = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return { kind: 'absent' }
    // ELOOP is a symlink at the final component. Refused, and reported: it is
    // present and deliberately not read.
    if (code === 'ELOOP') return { kind: 'rejected' }
    return { kind: 'malformed' }
  }

  try {
    const info = await file.stat()
    // Guard 3a, file mode — on the descriptor, so it describes what will be read.
    if (!info.isFile()) return { kind: 'malformed' }
    // Guard 3b, size — before any bytes are allocated, on that same descriptor.
    if (info.size > MAX_CHANGE_FILE_BYTES) return { kind: 'limited', updatedAt: info.mtimeMs }

    const text = await file.readFile({ encoding: 'utf8' })
    if (context.recordPaths) context.paths.push(relativePath)
    return { kind: 'ok', text, updatedAt: info.mtimeMs }
  } catch {
    return { kind: 'malformed' }
  } finally {
    await file.close()
  }
}

interface DirectoryListing {
  entries: { name: string; directory: boolean }[]
  missing: boolean
  /** Present and unusable: not a directory, unreadable, or past the entry bound. */
  invalid: boolean
}

async function listDirectory(absolute: string, context: ReadContext): Promise<DirectoryListing> {
  const relativePath = relative(context.root, absolute)
  if (relativePath !== 'openspec' && !isReadableProjectPath(relativePath)) {
    return { entries: [], missing: false, invalid: true }
  }

  let real: string
  try {
    real = await realpath(absolute)
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ENOENT'
      ? { entries: [], missing: true, invalid: false }
      : { entries: [], missing: false, invalid: true }
  }
  if (!contained(real, context)) return { entries: [], missing: false, invalid: true }

  try {
    if (!(await lstat(real)).isDirectory()) {
      return { entries: [], missing: false, invalid: true }
    }
  } catch {
    return { entries: [], missing: false, invalid: true }
  }

  const entries: { name: string; directory: boolean }[] = []
  let directory
  try {
    directory = await opendir(real)
  } catch {
    return { entries: [], missing: false, invalid: true }
  }
  try {
    for await (const entry of directory) {
      if (entries.length >= MAX_SOURCE_ENTRIES) {
        return { entries: [], missing: false, invalid: true }
      }
      // A `Dirent` is `lstat`-shaped, so a symlink to a directory reports
      // neither `isDirectory()` nor a usable kind. Admitting it as a candidate
      // is what lets containment *refuse and report* it: filtering it out here
      // instead made an escaping symlink vanish silently, which is exactly the
      // "no card and reported skipped" requirement not being met.
      entries.push({
        name: entry.name,
        directory: entry.isDirectory() || entry.isSymbolicLink(),
      })
    }
  } catch {
    return { entries: [], missing: false, invalid: true }
  }
  return { entries, missing: false, invalid: false }
}

/**
 * A change directory's evidence.
 *
 * Returns `null` when the directory is not a change at all — none of
 * `proposal.md`, `tasks.md`, `design.md` and no delta spec — which is an
 * absence and stays silent, and when any artifact path is refused outright,
 * which is reported and produces no card.
 */
async function readChangeEvidence(
  directory: string,
  context: ReadContext,
): Promise<
  | { kind: 'none' }
  | { kind: 'rejected' }
  | {
      kind: 'ok'
      artifacts: ChangeArtifacts
      reviewerVendors: string[]
      hasRequestChanges: boolean
      reviewRecord: string | null
      checklist: ChangeChecklistRow[]
      updatedAt: number
      evidenceLimited: boolean
      malformed: boolean
    }
> {
  const listing = await listDirectory(directory, context)
  if (listing.invalid) return { kind: 'rejected' }

  let updatedAt = 0
  let limited = false
  let malformed = false

  const readArtifact = async (name: string): Promise<string | undefined> => {
    const outcome = await readGuarded(join(directory, name), context)
    if (outcome.kind === 'rejected') throw new RejectedPath()
    if (outcome.kind === 'limited') {
      limited = true
      updatedAt = Math.max(updatedAt, outcome.updatedAt)
      return undefined
    }
    if (outcome.kind === 'malformed') {
      malformed = true
      return undefined
    }
    if (outcome.kind === 'absent') return undefined
    updatedAt = Math.max(updatedAt, outcome.updatedAt)
    return outcome.text
  }

  let proposal: string | undefined
  let tasks: string | undefined
  let design: string | undefined
  let deltaSpecCount = 0
  let reviewRecord: string | null = null
  let reviews = ''

  try {
    proposal = await readArtifact('proposal.md')
    tasks = await readArtifact('tasks.md')
    design = await readArtifact('design.md')

    // Delta specs: `specs/<name>/spec.md`, per upstream's `deltaSpecCount`.
    const specs = await listDirectory(join(directory, 'specs'), context)
    if (specs.invalid) return { kind: 'rejected' }
    for (const entry of specs.entries.filter((candidate) => candidate.directory).sort(byName)) {
      if (await readArtifact(join('specs', entry.name, 'spec.md')) !== undefined) {
        deltaSpecCount += 1
      }
    }

    // The one extension to upstream's reader: round-numbered review records.
    const candidates: { name: string; mtimeMs: number }[] = []
    for (const entry of listing.entries) {
      if (entry.directory || !/^REVIEWS(?:-round-\d+)?\.md$/u.test(entry.name)) continue
      try {
        const real = await realpath(join(directory, entry.name))
        if (!contained(real, context)) return { kind: 'rejected' }
        candidates.push({ name: entry.name, mtimeMs: (await lstat(real)).mtimeMs })
      } catch {
        malformed = true
      }
    }
    reviewRecord = selectReviewRecord(candidates)
    if (reviewRecord) reviews = (await readArtifact(reviewRecord)) ?? ''
  } catch (error) {
    if (error instanceof RejectedPath) return { kind: 'rejected' }
    throw error
  }

  const isChange =
    proposal !== undefined || tasks !== undefined || design !== undefined || deltaSpecCount > 0
  if (!isChange && !limited && !malformed) return { kind: 'none' }

  return {
    kind: 'ok',
    artifacts: {
      proposal: proposal === undefined ? 'missing' : 'ready',
      deltaSpecCount,
      tasks: tasks === undefined ? 'missing' : 'ready',
      design: design === undefined ? 'optional' : 'ready',
    },
    ...parseReviewEvidence(reviews),
    reviewRecord,
    checklist: parseChecklist(tasks ?? ''),
    updatedAt,
    evidenceLimited: limited || malformed,
    malformed,
  }
}

/** Thrown across the artifact reads when one path is refused outright. */
class RejectedPath extends Error {}

const byName = (left: { name: string }, right: { name: string }) =>
  left.name < right.name ? -1 : left.name > right.name ? 1 : 0

// ── the repository read ─────────────────────────────────────────────────────

/**
 * One repository's admitted records and the notices explaining what it lost.
 *
 * Never throws for a repository's own *content*: an unreadable tree yields
 * notices, not a rejection. Two things remove a repository from the board
 * instead of degrading it — the service's own bound, and a containment anchor
 * that resolves outside the registered root, which is a refusal to read the
 * repository rather than a fact about what it holds.
 */
export async function readRepositoryChanges(
  root: string,
  options: ReadChangesOptions = {},
): Promise<ReadChangesResult> {
  const notices: RepositoryNotice[] = []
  const records: ChangeRecord[] = []
  const paths: string[] = []

  let openspecReal: string
  try {
    openspecReal = await realpath(join(root, 'openspec'))
    // The anchor is checked against the root's own realpath, because every
    // other guard here is made *against* this anchor and so cannot catch it
    // being wrong. `openspec` being a symlink out of the repository redefines
    // containment rather than violating it: each path really does lie under the
    // boundary, and the boundary is another tree. `filesystem-access-policy` ›
    // `A Containment Anchor Is Verified Against Its Registered Root`.
    const rootReal = await realpath(root)
    if (openspecReal !== rootReal && !openspecReal.startsWith(rootReal + sep)) {
      // Thrown, not returned empty. An escaped anchor is a refusal to read the
      // repository at all, and returning `{ records: [], notices: [] }` would
      // make it byte-identical to a repository that simply has no `openspec/` —
      // silence where the requirement asks for a report. It is not a per-source
      // notice either: no source was attempted, so `a active entry was refused`
      // would name a thing that never happened. The repository-level vocabulary
      // is what fits, and the service maps this to `read: 'failed'`.
      throw new ContainmentAnchorEscaped()
    }
  } catch (error) {
    if (error instanceof ContainmentAnchorEscaped) throw error
    // No `openspec/` — or one we cannot resolve. Silent, per the requirement:
    // a repository without OpenSpec contributes nothing and is not an error.
    return { records, notices, paths }
  }

  const context: ReadContext = {
    openspecReal: openspecReal.endsWith(sep) ? openspecReal : openspecReal + sep,
    root,
    paths,
    recordPaths: options.recordPaths ?? false,
  }

  const changesRoot = join(root, 'openspec', 'changes')
  const archiveRoot = join(changesRoot, 'archive')
  const occupiedSlugs = new Set<string>()

  // ── active ────────────────────────────────────────────────────────────────
  const activeListing = await listDirectory(changesRoot, context)
  if (activeListing.invalid) {
    notices.push({ source: 'active', kind: 'rejected', admitted: 0 })
  }
  // `archive` is a directory under `changes/` and is not itself a change.
  const activeCandidates = activeListing.entries
    .filter((entry) => entry.directory && entry.name !== 'archive')
    .sort(byName)

  const admittedActive = activeCandidates.slice(0, MAX_SOURCE_RECORDS)
  if (activeCandidates.length > admittedActive.length) {
    notices.push({
      source: 'active',
      kind: 'truncated',
      admitted: admittedActive.length,
      observed: activeCandidates.length,
    })
  }

  for (const entry of admittedActive) {
    const evidence = await readChangeEvidence(join(changesRoot, entry.name), context)
    if (evidence.kind === 'rejected') {
      notices.push({ source: 'active', kind: 'rejected', changeName: entry.name })
      continue
    }
    // Not a change directory at all. Silent — an absence, not a defect.
    if (evidence.kind === 'none') continue
    if (evidence.malformed) {
      notices.push({ source: 'active', kind: 'malformed', changeName: entry.name })
    }
    if (evidence.evidenceLimited && !evidence.malformed) {
      notices.push({ source: 'evidence', kind: 'evidence-limited', changeName: entry.name })
    }
    // Occupied here rather than over every candidate directory: deduplication
    // is "a backlog entry whose slug is already an active or archived
    // *change*", and a directory that holds no artifacts is not one. Marking it
    // earlier let a scratch directory under `changes/` silently delete a real
    // backlog card while contributing none of its own.
    occupiedSlugs.add(backlogSlug(entry.name))
    records.push({
      source: 'active',
      sourceInstance: entry.name,
      changeName: entry.name,
      title: entry.name,
      archiveDate: null,
      ...pick(evidence),
    })
  }

  // ── archive ───────────────────────────────────────────────────────────────
  const archiveListing = await listDirectory(archiveRoot, context)
  if (archiveListing.invalid) {
    notices.push({ source: 'archive', kind: 'rejected', admitted: 0 })
  }
  const validArchives: { name: string; slug: string }[] = []
  for (const entry of archiveListing.entries) {
    if (!entry.directory) continue
    const slug = archivedSlug(entry.name)
    if (!slug) {
      notices.push({ source: 'archive', kind: 'malformed', changeName: entry.name })
      continue
    }
    validArchives.push({ name: entry.name, slug })
  }
  // Date-descending, which is the order the Archive column renders.
  validArchives.sort((left, right) => (right.name < left.name ? -1 : right.name > left.name ? 1 : 0))

  const admittedArchives = validArchives.slice(0, MAX_SOURCE_RECORDS)
  if (validArchives.length > admittedArchives.length) {
    notices.push({
      source: 'archive',
      kind: 'truncated',
      admitted: admittedArchives.length,
      observed: validArchives.length,
    })
  }

  for (const entry of admittedArchives) {
    const evidence = await readChangeEvidence(join(archiveRoot, entry.name), context)
    if (evidence.kind === 'rejected') {
      notices.push({ source: 'archive', kind: 'rejected', changeName: entry.slug })
      continue
    }
    // A dated archive entry holding no artifacts is reported, not dropped: it
    // is shaped like a change and is not one, which is a defect in the tree.
    if (evidence.kind === 'none') {
      notices.push({ source: 'archive', kind: 'malformed', changeName: entry.slug })
      continue
    }
    if (evidence.malformed) {
      notices.push({ source: 'archive', kind: 'malformed', changeName: entry.slug })
    }
    if (evidence.evidenceLimited && !evidence.malformed) {
      notices.push({ source: 'evidence', kind: 'evidence-limited', changeName: entry.slug })
    }
    // Same rule as the active side: a dated directory holding no artifacts is
    // reported above and does not occupy its slug, because it is not a change.
    occupiedSlugs.add(entry.slug)
    records.push({
      source: 'archive',
      sourceInstance: entry.name,
      changeName: entry.slug,
      title: entry.slug,
      archiveDate: entry.name.slice(0, 10),
      ...pick(evidence),
    })
  }

  // ── backlog ───────────────────────────────────────────────────────────────
  const backlog = await readGuarded(join(root, 'openspec', 'BACKLOG.md'), context)
  if (backlog.kind === 'rejected' || backlog.kind === 'limited' || backlog.kind === 'malformed') {
    notices.push({ source: 'backlog', kind: 'rejected', admitted: 0 })
  } else if (backlog.kind === 'ok') {
    const parsed = parseBacklog(backlog.text)
    notices.push(...parsed.notices)
    // A backlog item that has become a change is one piece of work, not two.
    const available = parsed.records.filter((record) => !occupiedSlugs.has(record.changeName))
    const admitted = available.slice(0, MAX_SOURCE_RECORDS)
    if (available.length > admitted.length) {
      notices.push({
        source: 'backlog',
        kind: 'truncated',
        admitted: admitted.length,
        observed: available.length,
      })
    }
    for (const record of admitted) {
      records.push({
        source: 'backlog',
        // The slug, never the raw heading: an identity built from
        // author-controlled text is the hazard decision 7 exists to prevent.
        sourceInstance: record.changeName,
        changeName: record.changeName,
        title: record.title,
        archiveDate: null,
        artifacts: { proposal: 'missing', deltaSpecCount: 0, tasks: 'missing', design: 'optional' },
        reviewerVendors: [],
        hasRequestChanges: false,
        reviewRecord: null,
        checklist: [],
        updatedAt: backlog.updatedAt,
        evidenceLimited: false,
      })
    }
  }

  return { records, notices, paths }
}

/** The evidence fields a record carries, without the reader's own bookkeeping. */
function pick(evidence: {
  artifacts: ChangeArtifacts
  reviewerVendors: string[]
  hasRequestChanges: boolean
  reviewRecord: string | null
  checklist: ChangeChecklistRow[]
  updatedAt: number
  evidenceLimited: boolean
}) {
  return {
    artifacts: evidence.artifacts,
    reviewerVendors: evidence.reviewerVendors,
    hasRequestChanges: evidence.hasRequestChanges,
    reviewRecord: evidence.reviewRecord,
    checklist: evidence.checklist,
    updatedAt: evidence.updatedAt,
    evidenceLimited: evidence.evidenceLimited,
  }
}
