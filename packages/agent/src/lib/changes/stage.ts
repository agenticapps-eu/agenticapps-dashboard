/**
 * stage.ts — the lifecycle classifier, mirrored from the upstream board.
 *
 * The origin is `agents-task-viewer/src/openspec/reader.ts` — its current
 * `classifyActiveChange`, `parseReviewEvidence` and `parseChecklist` — together
 * with **ADR 0008**. Deliberately *not* ADR 0004: its prose ("two distinct
 * approved reviewer sections", counting approvals without subtracting
 * rejections) describes neither the current classifier nor ADR 0008, and two
 * rounds of this change's plan review were spent arguing for a divergence from
 * a rule upstream had already abandoned. Where an ADR and a working
 * implementation of the same behaviour disagree, the implementation is the
 * origin and the ADR is history.
 *
 * **One divergence, and it is a subtraction: there is no `ship` stage.**
 * Upstream distinguishes an archive entry present on a mainline ref from one
 * merely filed, by probing git. That probe needs a ref and a pathspec built
 * from a directory name read out of a project tree, and
 * `filesystem-access-policy` forbids project-tree strings reaching an argument
 * vector — so it is a change to the security spine, deferred to its own change.
 * Both readings collapse into `archive` here, and no card claims a change
 * shipped.
 *
 * The one *extension* is `selectReviewRecord`. Upstream reads `REVIEWS.md`
 * alone; this fleet's review producer writes `REVIEWS-round-N.md` beside it,
 * and with a rejection vetoing, reading a superseded record is the difference
 * between a cleared rejection clearing and a change stranded at `validate`.
 *
 * Pure. No I/O, no clock, no filesystem — `changeReader.ts` supplies the
 * evidence and this decides what it means.
 */
import type {
  ChangeArtifacts,
  ChangeChecklistRow,
  ChangeSource,
  ChangeStage,
} from '@agenticapps/dashboard-shared'

export interface StageInput {
  source: ChangeSource
  artifacts: ChangeArtifacts
  reviewerVendors: readonly string[]
  hasRequestChanges: boolean
  checklist: readonly ChangeChecklistRow[]
}

export interface StageResult {
  stage: ChangeStage
  /**
   * Rule 5 only: an active change complete enough to archive. A filed archive
   * entry is never `ready` — it is the thing already filed, not the thing
   * waiting to be.
   */
  ready: boolean
}

/**
 * The ordered rule set. First match wins.
 *
 * 1. Archived — `archive`
 * 2. Active, missing `proposal.md`, a delta spec, or `tasks.md` — `propose`
 * 3. Artifact-complete, and any of: fewer than two approving reviewers; any
 *    standing rejection; zero checklist rows — `validate`
 * 4. Approved, checklist incomplete — `execute`
 * 5. Approved, checklist complete and non-empty — `archive`, marked `ready`
 *
 * A backlog entry is `propose`. `design.md` is optional and appears in no rule.
 */
export function classifyChange(input: StageInput): StageResult {
  // Rule 1 — and it wins outright. An archived entry is not re-derived from its
  // artifacts: it is filed, whatever its tasks file says.
  if (input.source === 'archive') return { stage: 'archive', ready: false }
  if (input.source === 'backlog') return { stage: 'propose', ready: false }

  // Rule 2.
  if (
    input.artifacts.proposal === 'missing'
    || input.artifacts.deltaSpecCount === 0
    || input.artifacts.tasks === 'missing'
  ) {
    return { stage: 'propose', ready: false }
  }

  // Rule 3. `hasRequestChanges` is the veto: a standing rejection from any
  // reviewer holds the change however many others approve. The empty-checklist
  // clause is upstream's, carried deliberately — a purely declarative change
  // sits here rather than advancing on artifacts alone.
  const distinctReviewers = new Set(
    input.reviewerVendors.map((vendor) => vendor.toLocaleLowerCase()),
  )
  if (
    input.hasRequestChanges
    || distinctReviewers.size < 2
    || input.checklist.length === 0
  ) {
    return { stage: 'validate', ready: false }
  }

  // Rules 4 and 5.
  return input.checklist.some((row) => !row.completed)
    ? { stage: 'execute', ready: false }
    : { stage: 'archive', ready: true }
}

/**
 * Reviewer sections and their verdicts. Mirrors upstream's
 * `parseReviewEvidence` line for line.
 *
 * Sections are `## Reviewer: <vendor>` headings bounded by the next such
 * heading. A section matching `VERDICT: REQUEST-CHANGES` sets the flag and
 * contributes no approval; one matching `VERDICT: APPROVE` contributes its
 * vendor, deduplicated case-insensitively. Both match case-insensitively and
 * only on a line of their own.
 *
 * **Order does not decide a duplicate vendor — rejection does.** Any rejecting
 * section sets the flag regardless of position, so a vendor that both approves
 * and rejects within one record holds the change at `validate`. There is
 * deliberately no last-section-wins rule: document order inside a single record
 * is not evidence of recency. Recency between *records* is
 * `selectReviewRecord`'s job.
 */
export function parseReviewEvidence(markdown: string): {
  reviewerVendors: string[]
  hasRequestChanges: boolean
} {
  const headings = [...markdown.matchAll(/^## Reviewer:\s*(.*?)\s*$/gimu)]
  const reviewerVendors: string[] = []
  const seen = new Set<string>()
  let hasRequestChanges = false

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]!
    const vendor = heading[1]!.trim()
    if (!vendor) continue
    const start = (heading.index ?? 0) + heading[0].length
    const end = headings[index + 1]?.index ?? markdown.length
    const section = markdown.slice(start, end)
    if (/^VERDICT:\s*REQUEST-CHANGES\s*$/imu.test(section)) {
      hasRequestChanges = true
      continue
    }
    if (!/^VERDICT:\s*APPROVE\s*$/imu.test(section)) continue
    const normalized = vendor.toLocaleLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    reviewerVendors.push(vendor)
  }

  return { reviewerVendors, hasRequestChanges }
}

/** Checklist rows. Mirrors upstream's `parseChecklist`. */
export function parseChecklist(markdown: string): ChangeChecklistRow[] {
  const rows: ChangeChecklistRow[] = []
  for (const line of markdown.split(/\r?\n/u)) {
    const match = /^\s*-\s+\[([ xX])\]\s+(.+?)\s*$/u.exec(line)
    if (!match) continue
    rows.push({ text: match[2]!, completed: match[1]!.toLowerCase() === 'x' })
  }
  return rows
}

/** `REVIEWS.md`, or `REVIEWS-round-<N>.md` for a positive integer N. */
const REVIEW_RECORD = /^REVIEWS(?:-round-(\d+))?\.md$/u

export interface ReviewRecordCandidate {
  name: string
  mtimeMs: number
}

/**
 * Which review record a change is classified from.
 *
 * **Most recently modified wins.** Not highest-numbered: a `REVIEWS.md`
 * rewritten after the last round is the newer evidence, and an earlier draft of
 * this rule that only handled `REVIEWS.md` *lagging* the rounds classified from
 * staler evidence whenever it led them.
 *
 * Ties break on the round number, compared **numerically**, so
 * `REVIEWS-round-10.md` beats `REVIEWS-round-9.md` rather than losing a
 * lexicographic comparison. A numbered round beats an unnumbered `REVIEWS.md`
 * on a tie: the round is a deliberate, dated act, where `REVIEWS.md` is the
 * file the producer rewrites in place.
 *
 * Returns null when the change carries no review record at all — which
 * classifies as `validate` for want of evidence, not as an approval.
 */
export function selectReviewRecord(
  candidates: readonly ReviewRecordCandidate[],
): string | null {
  let best: { name: string; mtimeMs: number; round: number } | null = null

  for (const candidate of candidates) {
    const match = REVIEW_RECORD.exec(candidate.name)
    if (!match) continue
    // An unnumbered REVIEWS.md sorts below every numbered round on a tie.
    const round = match[1] === undefined ? -1 : Number(match[1])
    if (
      !best
      || candidate.mtimeMs > best.mtimeMs
      || (candidate.mtimeMs === best.mtimeMs && round > best.round)
    ) {
      best = { name: candidate.name, mtimeMs: candidate.mtimeMs, round }
    }
  }

  return best?.name ?? null
}
