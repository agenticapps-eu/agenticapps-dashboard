/**
 * ChangeDrawer.tsx — one change's detail, over the board.
 *
 * Over rather than instead of: the board stays rendered behind it, so the
 * reader keeps the context they selected from. Everything here is already on
 * the card's wire record — the drawer performs no second read, so opening one
 * costs nothing and cannot fail on its own.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA — inline className strings only
 * - NO hex literals — token names only
 */
import type { ReactElement } from 'react'
import { X } from 'lucide-react'

import type { ChangeCard } from '@agenticapps/dashboard-shared'

import { STAGE_LABELS } from './StageColumn.js'

const SOURCE_LABELS: Record<ChangeCard['source'], string> = {
  active: 'Active change',
  archive: 'Archived',
  backlog: 'Backlog entry',
}

function Field({ label, children }: { label: string; children: React.ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-tertiary">{label}</span>
      <span className="text-sm text-text-primary">{children}</span>
    </div>
  )
}

/**
 * Artifact presence, in the vocabulary the classifier uses.
 *
 * `design.md` is reported as present or optional, never missing: it affects no
 * stage, so calling its absence "missing" would report a defect that does not
 * exist.
 */
function Artifacts({ card }: { card: ChangeCard }): ReactElement {
  const { artifacts } = card
  return (
    <ul data-testid="drawer-artifacts" className="flex flex-col gap-1 text-sm">
      <li className={artifacts.proposal === 'ready' ? 'text-text-primary' : 'text-status-warning'}>
        proposal.md — {artifacts.proposal === 'ready' ? 'present' : 'missing'}
      </li>
      <li className={artifacts.tasks === 'ready' ? 'text-text-primary' : 'text-status-warning'}>
        tasks.md — {artifacts.tasks === 'ready' ? 'present' : 'missing'}
      </li>
      <li className={artifacts.deltaSpecCount > 0 ? 'text-text-primary' : 'text-status-warning'}>
        delta specs — <span className="tabular-nums">{artifacts.deltaSpecCount}</span>
      </li>
      <li className="text-text-secondary">
        design.md — {artifacts.design === 'ready' ? 'present' : 'optional, not present'}
      </li>
    </ul>
  )
}

/**
 * Who reviewed, what they said, and which record it was read from.
 *
 * Naming the record matters because this fleet writes `REVIEWS-round-N.md`
 * beside `REVIEWS.md`: "two reviewers approved" is a different claim depending
 * on which file it came from, and a reader chasing a stage needs to know which
 * one to open.
 */
function Reviewers({ card }: { card: ChangeCard }): ReactElement {
  return (
    <div data-testid="drawer-reviewers" className="flex flex-col gap-1 text-sm">
      {card.reviewRecord === null ? (
        <span className="text-text-secondary">No review record on this change.</span>
      ) : (
        <>
          <span className="text-text-primary">
            {card.reviewerVendors.length === 0
              ? 'No approving reviewers.'
              : `Approved by ${card.reviewerVendors.join(', ')}.`}
          </span>
          {card.hasRequestChanges && (
            <span className="text-status-warning">
              Changes requested — this holds the change at Validate however many others approve.
            </span>
          )}
          <span className="text-xs text-text-tertiary">Read from {card.reviewRecord}</span>
        </>
      )}
    </div>
  )
}

export function ChangeDrawer({
  card,
  onClose,
}: {
  card: ChangeCard
  onClose: () => void
}): ReactElement {
  return (
    <aside
      data-testid="change-drawer"
      aria-label={`Detail for ${card.title}`}
      className="fixed right-0 top-0 flex h-screen w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-border-subtle bg-card-bg p-5 shadow-card"
      style={{ zIndex: 'var(--z-overlay)' }}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          {/* Never clamped: the card may elide a long name, and this is where
              the whole of it is recoverable. */}
          <h2 data-testid="drawer-title" className="text-base font-semibold break-words text-text-primary">
            {card.title}
          </h2>
          <span className="text-xs text-text-tertiary">{card.repositoryName}</span>
        </div>
        <button
          type="button"
          aria-label="Close detail"
          onClick={onClose}
          className="rounded-md p-1 text-text-tertiary hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Stage">
          <span data-testid="drawer-stage">
            {STAGE_LABELS[card.stage]}
            {card.ready && ' (ready to archive)'}
          </span>
        </Field>
        <Field label="Source">
          <span data-testid="drawer-source">
            {SOURCE_LABELS[card.source]}
            {card.archiveDate !== null && ` · ${card.archiveDate}`}
          </span>
        </Field>
      </div>

      <Field label="Artifacts">
        <Artifacts card={card} />
      </Field>

      <Field label="Review">
        <Reviewers card={card} />
      </Field>

      <Field label={`Checklist (${card.completedChecklist}/${card.totalChecklist})`}>
        {card.checklist.length === 0 ? (
          <span className="text-text-secondary">
            No checklist rows — which is why this change cannot leave Validate.
          </span>
        ) : (
          <ul data-testid="drawer-checklist" className="flex flex-col gap-1">
            {card.checklist.map((row, index) => (
              <li
                key={`${index}-${row.text}`}
                className={
                  row.completed
                    ? 'flex gap-2 text-sm text-text-tertiary line-through'
                    : 'flex gap-2 text-sm text-text-primary'
                }
              >
                <span aria-hidden="true">{row.completed ? '✓' : '·'}</span>
                {/* Rendered as text, never as markup: the row is prose from a
                    file this daemon does not control. */}
                <span>{row.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Field>

      {card.evidenceLimited && (
        <p className="text-xs text-status-warning">
          Some of this change&rsquo;s evidence was not read, so this detail is partial.
        </p>
      )}
    </aside>
  )
}
