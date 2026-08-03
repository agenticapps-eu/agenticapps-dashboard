/**
 * changes.ts — the wire contract for the fleet OpenSpec change board.
 *
 * The card shape mirrors `agents-task-viewer/src/openspec/types.ts`
 * (`ChangeCard`, `RepositoryLimitNotice`) so the two boards describe the same
 * corpus in the same words. Four fields of upstream's card are deliberately not
 * carried, and one is deliberately re-based:
 *
 * - `activeSessionCount`, `activeByHost`, `supportingTasks` — live host-session
 *   evidence. Out of scope by the proposal: rendering them needs the host
 *   adapters, which need upstream converted to a consumable package.
 * - `repositoryRevision` — a monotonic counter upstream's tracker uses to pick
 *   between duplicate multi-host snapshots. This board has one producer, so
 *   there is nothing to arbitrate.
 * - `backlogDocumentIndex` — upstream's position of a backlog heading in its
 *   document. Identity here is `backlogSlug(title)`, which is stable under
 *   reordering, and ordering is by modification time; the index would only be a
 *   second, weaker key for the same thing.
 * - `id` is `cardKey(repositoryId, source, sourceInstance)` rather than
 *   upstream's `sourceIdentity(repositoryRoot, ...)`. Same NUL-joined triple,
 *   with this daemon's registry id in place of the absolute root: the registry
 *   id is what identifies a repository here and what the drawer's address
 *   carries, and it keeps an absolute filesystem path out of the response.
 *
 * `stage` carries four values, not upstream's five. `ship` is deferred to its
 * own change with its own `filesystem-access-policy` delta — see design
 * decision 5 — so the schema rejects it rather than tolerating a value no
 * producer here may emit.
 */
import { z } from 'zod'

/** The four lifecycle stages, in pipeline order. Column order follows this. */
export const CHANGE_STAGES = ['propose', 'validate', 'execute', 'archive'] as const
export const ChangeStageSchema = z.enum(CHANGE_STAGES)
export type ChangeStage = z.infer<typeof ChangeStageSchema>

/** The three corpus sources a card can come from. */
export const CHANGE_SOURCES = ['active', 'archive', 'backlog'] as const
export const ChangeSourceSchema = z.enum(CHANGE_SOURCES)
export type ChangeSource = z.infer<typeof ChangeSourceSchema>

/**
 * A card's identity and its address, which are the same triple.
 *
 * NUL is the separator because no filesystem name and no markdown heading can
 * contain one, so no author-controlled string can forge one card's identity
 * into another's. The address carries the three values as separate query
 * parameters for the same reason — a printable separator would need a parser,
 * and a parser over author-controlled names is the shape that produced
 * `fix-readiness-sanitiser-colon-hazard`.
 */
export function cardKey(
  repositoryId: string,
  source: ChangeSource,
  sourceInstance: string,
): string {
  return `${repositoryId}\u0000${source}\u0000${sourceInstance}`
}

export const ChangeArtifactsSchema = z
  .object({
    proposal: z.enum(['ready', 'missing']),
    /** How many `specs/<name>/spec.md` files under the change read successfully. */
    deltaSpecCount: z.number().int().nonnegative(),
    tasks: z.enum(['ready', 'missing']),
    // Never "missing": `design.md` is optional, and its absence is not a defect
    // — nor does it affect any stage.
    design: z.enum(['ready', 'optional']),
  })
  .strict()
export type ChangeArtifacts = z.infer<typeof ChangeArtifactsSchema>

export const ChangeChecklistRowSchema = z
  .object({ text: z.string(), completed: z.boolean() })
  .strict()
export type ChangeChecklistRow = z.infer<typeof ChangeChecklistRowSchema>

export const ChangeCardSchema = z
  .object({
    /** `cardKey(repositoryId, source, sourceInstance)`. Unique by construction. */
    id: z.string().min(1),
    repositoryId: z.string().min(1),
    repositoryName: z.string().min(1),
    source: ChangeSourceSchema,
    /**
     * The entry's own on-disk name: an active change's directory name, an
     * archived entry's full dated `YYYY-MM-DD-<slug>` basename, or a backlog
     * entry's `backlogSlug(title)`.
     */
    sourceInstance: z.string().min(1),
    /** The slug. Equal to `sourceInstance` except for a dated archive entry. */
    changeName: z.string().min(1),
    /** What to display. The raw heading text for a backlog entry, else the slug. */
    title: z.string().min(1),
    stage: ChangeStageSchema,
    /**
     * Rule 5: an active change complete enough to archive. The marker is what
     * makes the two archive readings legible without opening the card — a
     * filed archive carries `source: 'archive'`, this carries
     * `source: 'active'` and `ready: true`.
     */
    ready: z.boolean(),
    artifacts: ChangeArtifactsSchema,
    reviewerVendors: z.array(z.string()),
    hasRequestChanges: z.boolean(),
    /**
     * Which review record the stage was classified from — `REVIEWS.md` or a
     * `REVIEWS-round-N.md` — or null when the change carries none. The card
     * names the record rather than merely noting that several exist.
     */
    reviewRecord: z.string().nullable(),
    checklist: z.array(ChangeChecklistRowSchema),
    completedChecklist: z.number().int().nonnegative(),
    totalChecklist: z.number().int().nonnegative(),
    /** `YYYY-MM-DD` for a dated archive entry, null otherwise. Orders the Archive column. */
    archiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    /** Newest evidence modification time, epoch ms. Orders the other three columns. */
    updatedAt: z.number().int().nonnegative(),
    /** The read hit a bound, so this card's evidence is partial. */
    evidenceLimited: z.boolean(),
  })
  .strict()
export type ChangeCard = z.infer<typeof ChangeCardSchema>

/**
 * Upstream's notice vocabulary, unchanged. It is symbolic and path-free by
 * construction, which is what answers the disclosure finding carried through
 * three review rounds: a notice cannot carry a filesystem path or a username
 * because there is nowhere in the shape to put one.
 */
export const CHANGE_NOTICE_KINDS = [
  'collision',
  'empty-slug',
  'evidence-limited',
  'malformed',
  'rejected',
  'truncated',
] as const
export const ChangeNoticeKindSchema = z.enum(CHANGE_NOTICE_KINDS)
export type ChangeNoticeKind = z.infer<typeof ChangeNoticeKindSchema>

export const ChangeNoticeSchema = z
  .object({
    repositoryId: z.string().min(1),
    repositoryName: z.string().min(1),
    // `evidence` is a notice source but never a card source: it reports a
    // bounded read of a change's artifacts, not a place a card came from.
    source: z.enum([...CHANGE_SOURCES, 'evidence']),
    kind: ChangeNoticeKindSchema,
    admitted: z.number().int().nonnegative().optional(),
    observed: z.number().int().nonnegative().optional(),
    /** The slug the notice concerns, where it concerns one. Never a path. */
    changeName: z.string().optional(),
  })
  .strict()
export type ChangeNotice = z.infer<typeof ChangeNoticeSchema>

/**
 * Why a repository contributed nothing. A closed vocabulary rather than an
 * error string: `unreachable` is a registered path that is not a directory,
 * `timeout` is a read that exceeded the endpoint's bound, `unreadable` is
 * anything else that threw. None of the three can carry a path off the machine.
 */
export const CHANGE_READ_FAILURES = ['unreachable', 'timeout', 'unreadable'] as const
export const ChangeReadFailureSchema = z.enum(CHANGE_READ_FAILURES)
export type ChangeReadFailure = z.infer<typeof ChangeReadFailureSchema>

export const ChangeRepositoryStatusSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    read: z.enum(['ok', 'failed']),
    reason: ChangeReadFailureSchema.nullable(),
  })
  .strict()
export type ChangeRepositoryStatus = z.infer<typeof ChangeRepositoryStatusSchema>

export const ChangesFleetResponseSchema = z
  .object({
    generatedAt: z.number().int().nonnegative(),
    cards: z.array(ChangeCardSchema),
    /** Every registered repository, read or not. Absence from this list is a bug. */
    repositories: z.array(ChangeRepositoryStatusSchema),
    notices: z.array(ChangeNoticeSchema),
  })
  .strict()
export type ChangesFleetResponse = z.infer<typeof ChangesFleetResponseSchema>

/**
 * Every column's order, in one definition.
 *
 * Archive orders by entry date, most recent first, with a rule-5 `ready` card
 * ahead of every dated one — it is the thing waiting to be filed, not a thing
 * already filed, and giving it a synthetic date would file it. The other three
 * columns order by the record's most recent modification time, most recent
 * first.
 *
 * Every comparison ends on the card's identity, which is unique by
 * construction, so no two cards compare equal and no repository's name can
 * decide another repository's order.
 *
 * It lives in shared, and both the daemon and the board apply it. The readiness
 * fleet deliberately sorts only on the client, on the reasoning that a sorting
 * server plus a sorting client eventually disagree — that hazard is two
 * *different* orderings, not one applied twice. This is one total order and it
 * is idempotent, so the daemon can ship an ordered response and the board can
 * still order what it renders without the two ever being able to disagree.
 *
 * The four stage groups never interleave on screen, so a comparison across two
 * stages is only ever a tie-break to keep the order total.
 */
export function compareChangeCards(left: ChangeCard, right: ChangeCard): number {
  if (left.stage === 'archive' && right.stage === 'archive') {
    // A ready card has no entry date and sorts ahead of every dated card.
    if (left.archiveDate === null && right.archiveDate !== null) return -1
    if (left.archiveDate !== null && right.archiveDate === null) return 1
    if (
      left.archiveDate !== null
      && right.archiveDate !== null
      && left.archiveDate !== right.archiveDate
    ) {
      return left.archiveDate < right.archiveDate ? 1 : -1
    }
  } else if (left.updatedAt !== right.updatedAt) {
    return right.updatedAt - left.updatedAt
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

/**
 * How the surface should read the response.
 *
 * `empty` and `all-failed` both render no cards, and the requirement is that
 * they must not render the same: a fleet nobody could read is not a fleet with
 * no work in flight. `degraded` is the partial case, which also must not
 * present as an ordinary board — some repositories' cards are simply missing.
 *
 * An empty registry is `empty`, not `all-failed`: nothing failed.
 */
export function fleetReadState(
  response: Pick<ChangesFleetResponse, 'cards' | 'repositories'>,
): 'ok' | 'empty' | 'degraded' | 'all-failed' {
  const failed = response.repositories.filter((repo) => repo.read === 'failed')
  if (failed.length > 0) {
    return failed.length === response.repositories.length ? 'all-failed' : 'degraded'
  }
  return response.cards.length > 0 ? 'ok' : 'empty'
}
