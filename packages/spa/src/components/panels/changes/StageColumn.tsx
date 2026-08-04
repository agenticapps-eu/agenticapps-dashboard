/**
 * StageColumn.tsx — one lifecycle stage and the cards sitting in it.
 *
 * An empty column states that it has no changes rather than rendering blank.
 * Blank is ambiguous between "nothing is here" and "something failed to load",
 * and the board already has a separate, louder answer for the second.
 *
 * ## Two roles, because there are two layouts
 *
 * With four columns on screen the heading is the only thing naming the stage,
 * so the column is a labelled `region` with a visible `h2`. In the paged layout
 * the stage rail names it instead, and the column becomes that rail's
 * `tabpanel` — the heading is dropped, because it repeated the rail's own label
 * and count eight pixels beneath it.
 *
 * ## The Archive column is bounded
 *
 * Archives grow monotonically and never move again: on this repository's own
 * fleet, 45 of 60 cards were archived, a 4,537px column beside a 128px one, and
 * all of it work that by definition is not in flight. It shows the most recent
 * entries and says how many it is holding back — the per-source bound in the
 * daemon reports what it withheld, and so does this.
 */
import { useState, type ReactElement } from 'react'

import type { ChangeCard as ChangeCardData, ChangeStage } from '@agenticapps/dashboard-shared'

import { ChangeCard } from './ChangeCard.js'

/** The four stages in pipeline order, with the words the column headers use. */
export const STAGE_LABELS: Record<ChangeStage, string> = {
  propose: 'Propose',
  validate: 'Validate',
  execute: 'Execute',
  archive: 'Archive',
}

/**
 * How many archive cards render before the rest go behind a control.
 *
 * Ten is roughly a screen at the reference viewport, and it is the number of
 * recently-filed changes anyone reads without looking for something specific.
 */
export const ARCHIVE_VISIBLE_LIMIT = 10

export function StageColumn({
  stage,
  cards,
  onOpen,
  paged = false,
}: {
  stage: ChangeStage
  cards: readonly ChangeCardData[]
  onOpen: (card: ChangeCardData) => void
  /** True when the stage rail is naming this column, so it owns no heading. */
  paged?: boolean
}): ReactElement {
  const [showAll, setShowAll] = useState(false)
  const bounded = stage === 'archive' && !showAll && cards.length > ARCHIVE_VISIBLE_LIMIT
  const visible = bounded ? cards.slice(0, ARCHIVE_VISIBLE_LIMIT) : cards

  const panel = paged
    ? { id: `stage-panel-${stage}`, role: 'tabpanel', 'aria-labelledby': `stage-tab-${stage}` }
    : { 'aria-label': `${STAGE_LABELS[stage]} stage` }

  return (
    <section
      data-testid={`stage-column-${stage}`}
      {...panel}
      className="flex min-w-0 flex-col gap-2"
    >
      {!paged && (
        <h2
          data-testid="stage-heading"
          className="flex items-baseline gap-2 px-1 text-xs font-medium text-text-tertiary"
        >
          <span>{STAGE_LABELS[stage]}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{cards.length}</span>
        </h2>
      )}

      {cards.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-subtle px-3 py-6 text-center text-xs text-text-tertiary">
          No changes
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((card) => (
            <ChangeCard key={card.id} card={card} onOpen={onOpen} />
          ))}
          {(bounded || showAll) && stage === 'archive' && cards.length > ARCHIVE_VISIBLE_LIMIT && (
            // Toggles. The first draft was `setShowAll(true)` — a one-way door
            // that undid the bounding permanently the moment anyone used it,
            // while the sibling checklist disclosure toggled correctly.
            <button
              type="button"
              onClick={() => setShowAll((open) => !open)}
              aria-expanded={showAll}
              className="rounded-md px-2 py-2 text-xs font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {showAll ? 'Show fewer' : `Show all ${cards.length} archived`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
