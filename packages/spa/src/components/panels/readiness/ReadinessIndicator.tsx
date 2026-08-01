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
import {
  AlertTriangle,
  Check,
  CircleDashed,
  Clock,
  Slash,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  CHECK_IDS,
  type CheckId,
  type CheckResult,
  type CheckStatus,
} from '@agenticapps/dashboard-shared'

export type ReadinessVariant = 'compact' | 'full'

export interface ReadinessIndicatorProps {
  /** Results in `CHECK_IDS` order. The daemon's tuple already guarantees this. */
  checks: readonly CheckResult[]
  /** Names the group so two rows in a list are tellable apart. */
  repoName: string
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
    icon: CircleDashed,
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
 * UTC to the minute, because every time in this feature is a git committer time
 * and a local rendering would invite comparing it against a UTC one. A null
 * time renders an em dash: the response generation time is a different fact and
 * must never stand in for an observation that did not happen.
 */
function formatObservedAt(at: number | null): string {
  if (at === null) return '—'
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
  const head = `${CHECK_LABELS[check.id]} — ${word}`
  const body = `${value === null ? '' : `${value}, `}${formatObservedAt(check.at)}, ${check.source}`
  const reason = check.summary.trim()
  return `${head}, ${body}${reason === '' ? '' : ` — ${reason}`}`
}

function ReadinessCell({
  check,
  variant,
}: {
  check: CheckResult
  variant: ReadinessVariant
}): React.JSX.Element {
  const presentation = STATUS_PRESENTATION[check.status]
  const Shape = presentation.icon
  const disclosure = disclose(check)
  const value = formatValue(check)
  const full = variant === 'full'

  return (
    <figure
      role="figure"
      aria-label={disclosure}
      title={disclosure}
      className={`flex items-center gap-1.5 rounded-md ${full ? 'px-2 py-1' : 'justify-center px-1.5 py-1'} ${presentation.bg} ${presentation.text}`}
    >
      <Shape size={full ? 16 : 14} aria-hidden="true" />
      {full && (
        <>
          <span className="text-xs whitespace-nowrap">
            {CHECK_LABELS[check.id]}
          </span>
          {value !== null && (
            <span className="text-xs text-text-secondary whitespace-nowrap">
              {value}
            </span>
          )}
        </>
      )}
    </figure>
  )
}

export function ReadinessIndicator({
  checks,
  repoName,
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
        <ReadinessCell key={check.id} check={check} variant={variant} />
      ))}
    </div>
  )
}

/** Re-exported so a caller can assert the order it renders in without guessing. */
export { CHECK_IDS }
