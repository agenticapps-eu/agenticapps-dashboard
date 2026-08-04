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
      <span
        data-testid="change-card-source-badge"
        className="rounded-md bg-card-bg-hover px-1.5 py-0.5 text-xs font-medium text-text-tertiary"
      >
        Backlog
      </span>
    )
  }
  // The two archive readings, made legible without opening the card. Both used
  // to occupy this slot with identical geometry, so a bare date and a state
  // read the same — and a reader who only ever saw dates (every archive card in
  // the live fleet) had no reason to expect the other. `Filed` says what the
  // date is a date *of*, and `Ready` is given a dot so the two differ in shape
  // and not only in words.
  if (card.source === 'archive' && card.archiveDate !== null) {
    return (
      <span
        data-testid="change-card-source-badge"
        className="rounded-md bg-card-bg-hover px-1.5 py-0.5 text-xs font-medium text-text-tertiary"
      >
        Filed <span className="tabular-nums">{card.archiveDate}</span>
      </span>
    )
  }
  if (card.ready) {
    return (
      <span
        data-testid="change-card-source-badge"
        className="inline-flex items-center gap-1 rounded-md bg-status-success/10 px-1.5 py-0.5 text-xs font-medium text-status-success"
      >
        <span aria-hidden="true">●</span>
        Ready to archive
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

        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
          {/*
            Labelled, because the accessibility tree announced a bare "108/129"
            while every other datum on the card says what it is. Suppressed
            entirely at 0 of 0 — fifteen archive cards were rendering a ratio
            that counted nothing. Tabular figures so the numbers line up down a
            column, which is the only reason to put them on a card at all.
          */}
          {card.totalChecklist > 0 && (
            <span data-testid="change-card-counts">
              <span className="tabular-nums">
                {card.completedChecklist}/{card.totalChecklist}
              </span>{' '}
              tasks
            </span>
          )}
          {/*
            Never on an archived card. Rule 1 wins outright for an archive
            entry, so the reviewer clause never runs and nothing is being held
            anywhere — verified against the live registry, where 5 of 45
            archived cards carried the flag while being filed and complete. A
            warning that is false teaches the reader to ignore warnings.
          */}
          {card.hasRequestChanges && card.source !== 'archive' && (
            <span className="text-status-warning">Changes requested</span>
          )}
          {card.evidenceLimited && (
            // Glossed in the text rather than in a `title`, which is
            // mouse-only and invisible to keyboard and touch — and this fleet
            // is read from an iPad over Tailscale.
            <span data-testid="change-card-evidence-limited" className="text-text-tertiary">
              Partly read
            </span>
          )}
        </span>
      </div>
    </button>
  )
}
