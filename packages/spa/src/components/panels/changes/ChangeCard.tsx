/**
 * ChangeCard.tsx — one OpenSpec change, as a card.
 *
 * **The rows are additive, not a fixed set.** The terminal board's card carries
 * three rows and this one carries two, because the `N active` session count is
 * designed out of this change rather than designed around: rendering it needs
 * the host adapters. A fixed row count or a fixed card height here would make
 * adding that row a rewrite instead of an insertion, so the card is a column
 * flex that grows.
 *
 * A long name wraps to two lines before eliding. The terminal board elides at
 * one because a cell grid forces it; nothing forces it here, and every change
 * name in the current fleet that exceeds one line fits whole in two. The full
 * name is always in the DOM, so an elided one is still recoverable — by the
 * drawer, and by anything reading the accessibility tree.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA — inline className strings only
 * - NO hex literals — token names only
 */
import type { ReactElement } from 'react'

import type { ChangeCard as ChangeCardData } from '@agenticapps/dashboard-shared'

/**
 * What a card says about where it came from. `active` is the unmarked case and
 * says nothing — most cards are active changes, and labelling every one of them
 * would be noise rather than information.
 */
function SourceBadge({ card }: { card: ChangeCardData }): ReactElement | null {
  if (card.source === 'backlog') {
    return (
      <span className="rounded-md bg-card-bg-hover px-1.5 py-0.5 text-[11px] font-medium text-text-tertiary">
        Backlog
      </span>
    )
  }
  // The two archive readings, made legible without opening the card: a filed
  // entry shows the date it was filed, and an active change complete enough to
  // archive shows that it is only ready to be.
  if (card.source === 'archive' && card.archiveDate !== null) {
    return (
      <span className="rounded-md bg-card-bg-hover px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-text-tertiary">
        {card.archiveDate}
      </span>
    )
  }
  if (card.ready) {
    return (
      <span className="rounded-md bg-status-success-bg px-1.5 py-0.5 text-[11px] font-medium text-status-success">
        Ready
      </span>
    )
  }
  return null
}

export function ChangeCard({
  card,
  onOpen,
}: {
  card: ChangeCardData
  onOpen: (card: ChangeCardData) => void
}): ReactElement {
  return (
    <button
      type="button"
      data-testid={`change-card-${card.id}`}
      onClick={() => onOpen(card)}
      className="w-full rounded-card bg-card-bg p-3 text-left shadow-card hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
    >
      {/*
        A column flex with a gap, deliberately: no height, no row template. The
        session row lands here later without touching anything above it.
      */}
      <div data-testid="change-card-rows" className="flex flex-col gap-1.5">
        <span
          data-testid="change-card-name"
          // Two lines, then elide. `truncate` and `line-clamp-1` are both wrong
          // here and the test asserts their absence.
          className="line-clamp-2 text-sm font-medium text-text-primary"
        >
          {card.title}
        </span>

        <span className="flex items-center gap-2">
          <span className="truncate text-xs text-text-tertiary">{card.repositoryName}</span>
          <SourceBadge card={card} />
        </span>

        <span className="flex items-center gap-2 text-xs text-text-secondary">
          {/*
            Tabular figures so 48/119 and 1/9 line their digits up between
            cards — the counts are meant to be compared down a column.
          */}
          <span data-testid="change-card-counts" className="tabular-nums">
            {card.completedChecklist}/{card.totalChecklist}
          </span>
          {card.hasRequestChanges && (
            <span className="text-status-warning">Changes requested</span>
          )}
          {card.evidenceLimited && (
            <span
              data-testid="change-card-evidence-limited"
              className="text-text-tertiary"
              // Said in words as well as marked, because a card whose evidence
              // was bounded is showing a partial reading and should say so.
              title="Some of this change's evidence was not read"
            >
              Partial
            </span>
          )}
        </span>
      </div>
    </button>
  )
}
