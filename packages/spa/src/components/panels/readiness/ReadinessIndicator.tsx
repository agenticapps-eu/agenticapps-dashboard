/**
 * ReadinessIndicator.tsx — the six readiness checks as six cells.
 *
 * Order and identity come from `CHECK_IDS`, and the wire shape is a fixed
 * six-tuple in that order, so this component never sorts, never looks a check
 * up by id, and never drops one to close a gap. Position IS the check.
 *
 * Colour answers "is something wrong?", not "does this block readiness?".
 * `never` is therefore neutral rather than red: design.md §3 is explicit that a
 * check which has never run is a gap in process, not a defect in the product,
 * and `pen-test` is expected to sit at `never` across the whole fleet at
 * launch. Painting that red would make every young repo look broken — the exact
 * failure the six-value vocabulary exists to avoid. Blocking-ness is carried by
 * the boolean `ready`, which is computed from the results, not from the colour.
 *
 * Shape carries the status on its own, so the six states remain tellable apart
 * with colour unperceived.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA — inline className strings only
 * - NO hex literals — token names only
 * - NO shadcn aliases
 */
import React from 'react'
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  Check,
  Minus,
  Clock,
  Slash,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  CHECK_IDS,
  isAdvisoryCheck,
  type CheckId,
  type CheckResult,
  type CheckStatus,
} from '@agenticapps/dashboard-shared'

import { EM_DASH } from '../../ui/EmDash.js'
import { Tooltip } from '../../ui/Tooltip.js'

export type ReadinessVariant = 'compact' | 'full'

export interface ReadinessIndicatorProps {
  /** Results in `CHECK_IDS` order. The daemon's tuple already guarantees this. */
  checks: readonly CheckResult[]
  /** Names the group so two rows in a list are tellable apart. */
  repoName: string
  /**
   * The repo to open when a cell is selected. Given one, every cell becomes a
   * link to that repo's detail positioned at its own check; without one the
   * cells stay non-interactive, which is what the detail header wants.
   */
  repoId?: string
  variant?: ReadinessVariant
}

interface StatusPresentation {
  /** The status in words — what the disclosure says out loud. */
  word: string
  /** The shape. Distinct per status, so colour is never the only channel. */
  icon: LucideIcon
  bg: string
  text: string
}

export const STATUS_PRESENTATION: Record<CheckStatus, StatusPresentation> = {
  ok: {
    word: 'passing',
    icon: Check,
    bg: 'bg-status-success/10',
    text: 'text-status-success',
  },
  warn: {
    word: 'passing with caveats',
    icon: AlertTriangle,
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
  },
  stale: {
    word: 'stale evidence',
    icon: Clock,
    bg: 'bg-status-warning/10',
    text: 'text-status-warning',
  },
  fail: {
    word: 'failing',
    icon: X,
    bg: 'bg-status-error/10',
    text: 'text-status-error',
  },
  never: {
    word: 'never run',
    // `CircleDashed` is the lucide spinner silhouette, and `never` is the most
    // common status across a young fleet — so the healthy case rendered as a
    // field of things that look like they are still loading, next to a
    // LoadingState that is the same grey rounded bar minus the animation.
    // `Minus` says "nothing here" without saying "wait".
    icon: Minus,
    bg: 'bg-text-tertiary/10',
    text: 'text-text-secondary',
  },
  na: {
    word: 'not applicable',
    icon: Slash,
    bg: 'bg-text-tertiary/10',
    text: 'text-text-secondary',
  },
}

export const CHECK_LABELS: Record<CheckId, string> = {
  workflow: 'Workflow',
  spec: 'Spec',
  'code-review': 'Code review',
  'security-review': 'Security review',
  'pen-test': 'Pen test',
  coverage: 'Coverage',
}

/**
 * The checks a ready verdict passed over rather than satisfied: those the
 * daemon cannot derive and this repo has not declared.
 *
 * Membership comes from `isAdvisoryCheck`, the same predicate `computeReady`
 * applies, so the disclosure cannot name a different set than the one the
 * verdict exempted. A second declared-only check is disclosed by joining the
 * set rather than by someone remembering to widen a sentence.
 *
 * `computeReady` has one further clause this does not: the exemption is
 * suspended while the repo carries a readiness-file notice. Omitting it here is
 * safe only because of the `!ready` early return — a repo with a notice and a
 * derived-never advisory check cannot be ready, so this is never asked about
 * one. Stated because that is a two-hop argument guarding a disclosure, and the
 * next reader should not have to reconstruct it.
 */
export function excludedFromVerdict(
  ready: boolean,
  checks: readonly Pick<CheckResult, 'id' | 'status' | 'source'>[],
): CheckId[] {
  if (!ready) return []
  return checks
    .filter(
      (check) =>
        check.status === 'never' &&
        check.source === 'derived' &&
        isAdvisoryCheck(check.id),
    )
    .map((check) => check.id)
}

/** "excludes pen test", "excludes pen test and threat model", … */
export function exclusionPhrase(excluded: readonly CheckId[]): string | null {
  if (excluded.length === 0) return null
  const names = excluded.map((id) => CHECK_LABELS[id].toLowerCase())
  const list =
    names.length === 1
      ? names[0]!
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`
  return `excludes ${list}`
}

/**
 * UTC to the minute, because every time in this feature is a git committer time
 * and a local rendering would invite comparing it against a UTC one. A null
 * time renders an em dash: the response generation time is a different fact and
 * must never stand in for an observation that did not happen.
 */
function formatObservedAt(at: number | null): string {
  if (at === null) return EM_DASH
  return `${new Date(at).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

/**
 * The value, read against the threshold that decided its status where there is
 * one. A bare `76` says nothing about why the cell is amber; `76 of 80` says it
 * outright, and the threshold is already on the wire for exactly this reason.
 */
function formatValue(check: CheckResult): string | null {
  if (check.value === null) return null
  if (check.threshold === null) return `${check.value}`
  return `${check.value} of ${check.threshold}`
}

/**
 * What the cell says when inspected. `aria-label` REPLACES the visible text for
 * assistive tech rather than adding to it, so anything rendered in the cell has
 * to appear here too or it becomes unreachable — and in the compact variant
 * this is the only place the value appears at all.
 *
 * The summary is carried for the same reason the schema forces the daemon to
 * supply one: spec.md requires `na` to render its reason "rather than an
 * unexplained grey cell", and warnings to keep their reason visible.
 */
function disclose(check: CheckResult): string {
  const { word } = STATUS_PRESENTATION[check.status]
  const value = formatValue(check)
  // An evaluation error is a strictly higher sort key than a merits-based
  // failure, but the schema forces it to carry status `fail` — so without this
  // the two render identically and read identically, while ordering
  // differently. readinessOrder.ts promises "a reader can reconstruct any
  // pairwise result by counting cells"; this is what makes that true.
  // An advisory check's `never` renders as the same grey dash as a blocking
  // one, so without this the cell that a "Ready, excludes X" verdict points at
  // is byte-identical on a repo it blocked and one it did not.
  const advisory =
    check.status === 'never' && check.source === 'derived' && isAdvisoryCheck(check.id)
      ? ', advisory: does not block readiness'
      : ''
  const head =
    check.error !== null
      ? `${CHECK_LABELS[check.id]} — could not be evaluated`
      : `${CHECK_LABELS[check.id]} — ${word}${advisory}`
  const body = `${value === null ? '' : `${value}, `}${formatObservedAt(check.at)}, ${check.source}`
  const reason = check.error?.message ?? check.summary.trim()
  return `${head}, ${body}${reason === '' ? '' : ` — ${reason}`}`
}

function ReadinessCell({
  check,
  variant,
  repoId,
}: {
  check: CheckResult
  variant: ReadinessVariant
  repoId: string | undefined
}): React.JSX.Element {
  const presentation = STATUS_PRESENTATION[check.status]
  const Shape = presentation.icon
  const disclosure = disclose(check)
  const value = formatValue(check)
  const full = variant === 'full'

  // Compact cells sit in a six-track grid, so an unconstrained surface stretched
  // to the full column — a 111px tinted bar carrying one 14px glyph, an 8% ink
  // ratio that read as a placeholder rather than a value. `w-8 mx-auto` caps the
  // tint at its content and leaves the grid track, and therefore the alignment
  // with the column header above it, untouched.
  //
  // A compact cell CARRYING a value drops `w-8` and pads instead: 32px cannot
  // hold "66.42 of 80", and forcing it to would either clip the number or
  // wrap the row past its height cap. The tint still ends at its content, so
  // the valueless cells either side keep the shape this comment describes.
  const compactSurface = value === null ? 'mx-auto w-8 justify-center py-1.5' : 'mx-auto justify-center px-1.5 py-1.5'
  const surface = `flex items-center gap-1.5 rounded-md ${full ? 'px-2 py-1' : compactSurface} ${presentation.bg} ${presentation.text}`
  const body = (
    <>
      <Shape size={full ? 16 : 14} aria-hidden="true" />
      {full && (
        <span className="text-xs whitespace-nowrap">
          {CHECK_LABELS[check.id]}
        </span>
      )}
      {/*
        Both variants now. `design-system` → A Value Is Shown Where One Exists:
        colour and shape summarise, they do not substitute for the number, and
        the fleet is the surface where that mattered most — it was the one
        place the value existed on the wire and never reached the screen.

        Compact inherits the status colour from the surface; full overrides it
        to secondary, because there the check label sits beside the value and
        two status-coloured strings would compete.
      */}
      {value !== null && (
        <span
          className={`whitespace-nowrap text-xs tabular-nums ${full ? 'text-text-secondary' : ''}`}
        >
          {value}
        </span>
      )}
    </>
  )

  // No repo to open means no control: the detail header renders these same six
  // checks, and linking each of them to the page they are already on would be
  // noise. There the pointer-only `title` is still the right trade, because
  // nothing is focusable to reach in the first place.
  if (repoId === undefined) {
    return (
      <figure role="figure" aria-label={disclosure} title={disclosure} className={surface}>
        {body}
      </figure>
    )
  }

  // The hash is the check id, which is what positions the detail at this block.
  // The disclosure moves from `title` to the tooltip: a title never reaches a
  // sighted keyboard user, and now there is one to reach.
  return (
    <Tooltip content={disclosure} interactiveChild={true}>
      <Link
        to="/repos/$repoId"
        params={{ repoId }}
        hash={check.id}
        aria-label={disclosure}
        className={`${surface} focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-app-bg`}
      >
        {body}
      </Link>
    </Tooltip>
  )
}

export function ReadinessIndicator({
  checks,
  repoName,
  repoId,
  variant = 'compact',
}: ReadinessIndicatorProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={`Readiness for ${repoName}`}
      className={
        variant === 'full'
          ? 'flex flex-wrap items-center gap-2'
          : // Six equal columns so a table can put a header above each cell.
            // The strip fills its column and divides it the same way the header
            // row does, which is what keeps label k over cell k without either
            // side stating a width.
            'grid grid-cols-6 items-center gap-1'
      }
    >
      {checks.map((check) => (
        <ReadinessCell key={check.id} check={check} variant={variant} repoId={repoId} />
      ))}
    </div>
  )
}

/** Re-exported so a caller can assert the order it renders in without guessing. */
export { CHECK_IDS }
