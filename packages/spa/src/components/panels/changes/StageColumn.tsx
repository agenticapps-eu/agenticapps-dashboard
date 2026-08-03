/**
 * StageColumn.tsx — one lifecycle stage and the cards sitting in it.
 *
 * An empty column states that it has no changes rather than rendering blank.
 * Blank is ambiguous between "nothing is here" and "something failed to load",
 * and the board already has a separate, louder answer for the second.
 */
import type { ReactElement } from 'react'

import type { ChangeCard as ChangeCardData, ChangeStage } from '@agenticapps/dashboard-shared'

import { ChangeCard } from './ChangeCard.js'

/** The four stages in pipeline order, with the words the column headers use. */
export const STAGE_LABELS: Record<ChangeStage, string> = {
  propose: 'Propose',
  validate: 'Validate',
  execute: 'Execute',
  archive: 'Archive',
}

export function StageColumn({
  stage,
  cards,
  onOpen,
}: {
  stage: ChangeStage
  cards: readonly ChangeCardData[]
  onOpen: (card: ChangeCardData) => void
}): ReactElement {
  return (
    <section
      data-testid={`stage-column-${stage}`}
      aria-label={`${STAGE_LABELS[stage]} stage`}
      className="flex min-w-0 flex-col gap-2"
    >
      <h2
        data-testid="stage-heading"
        className="flex items-baseline gap-2 px-1 text-xs font-medium text-text-tertiary"
      >
        <span>{STAGE_LABELS[stage]}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">{cards.length}</span>
      </h2>

      {cards.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-subtle px-3 py-6 text-center text-xs text-text-tertiary">
          No changes
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {cards.map((card) => (
            <ChangeCard key={card.id} card={card} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  )
}
