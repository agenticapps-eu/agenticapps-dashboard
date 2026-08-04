/**
 * ChangeDrawer.tsx — one change's detail, over the board.
 *
 * Everything here is already on the card's wire record — the drawer performs no
 * second read, so opening one costs nothing and cannot fail on its own.
 *
 * ## It is a dialog, and now says so
 *
 * The first draft was an `<aside>` with an `aria-label`, positioned fixed: a
 * *landmark* that behaved like a modal. Measured, it had no `role`, no
 * `aria-modal`, no scrim, no Escape handler, it never moved focus, and its close
 * control was the 79th of 80 tab stops because the panel is last in the DOM. A
 * keyboard or screen-reader user had no exit short of browser Back.
 *
 * It now declares `role="dialog"` and `aria-modal`, moves focus to the close
 * control on open and returns it to the card that opened it, traps Tab, closes
 * on Escape, and has a scrim that dismisses on click. The docblock used to claim
 * the board "stays visible behind it" — that was written from the source rather
 * than from a rendered page, and at 390px the panel covered everything. The
 * scrim is what makes the sentence true rather than aspirational.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA — inline className strings only
 * - NO hex literals — token names only
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { X } from 'lucide-react'

import type { ChangeCard } from '@agenticapps/dashboard-shared'

import { ChecklistRow } from './ChecklistRow.js'
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
        proposal.md: {artifacts.proposal === 'ready' ? 'present' : 'missing'}
      </li>
      <li className={artifacts.tasks === 'ready' ? 'text-text-primary' : 'text-status-warning'}>
        tasks.md: {artifacts.tasks === 'ready' ? 'present' : 'missing'}
      </li>
      <li className={artifacts.deltaSpecCount > 0 ? 'text-text-primary' : 'text-status-warning'}>
        delta specs: <span className="tabular-nums">{artifacts.deltaSpecCount}</span>
      </li>
      <li className="text-text-secondary">
        design.md: {artifacts.design === 'ready' ? 'present' : 'optional, not present'}
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
          {/*
            The card suppresses this on an archived change, because "holds the
            change at Validate" is false once it is filed. Suppressing it *here*
            too was an over-correction: that a reviewer objected and the change
            was archived anyway is audit-relevant, and the drawer is where it
            belongs. Past tense, so it records rather than claims.
          */}
          {card.hasRequestChanges && (
            <span className="text-status-warning">
              {card.source === 'archive'
                ? 'Changes were requested by a reviewer, and this change was archived anyway.'
                : 'Changes requested. This holds the change at Validate however many others approve.'}
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
  const panel = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const outstanding = card.checklist.filter((row) => !row.completed)
  const done = card.checklist.filter((row) => row.completed)

  // Focus moves in on open and returns to whatever opened it on close. Without
  // this the close control was the 79th of 80 tab stops, because the drawer is
  // last in the DOM and nothing had moved the caret.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeButton.current?.focus()
    return () => opener?.focus?.()
  }, [card.id])

  // Escape closes, and Tab is kept inside the panel while it is open — the two
  // halves of the dialog contract this was missing.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || panel.current === null) return
      const focusable = [
        ...panel.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => node.offsetParent !== null || node === closeButton.current)
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <>
    {/*
      A scrim, which the first draft had none of at any width. It also makes the
      docblock's claim honest: the board is visible *behind* the drawer rather
      than merely still mounted.
    */}
    <div
      data-testid="change-drawer-backdrop"
      onClick={onClose}
      aria-hidden="true"
      className="fixed inset-0 bg-app-bg opacity-60"
      style={{ zIndex: 'var(--z-overlay)' }}
    />
    <div
      ref={panel}
      data-testid="change-drawer"
      role="dialog"
      aria-modal="true"
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
        {/*
          First in the panel's tab order and 32px square. It was 24x24 — exactly
          the WCAG 2.5.8 minimum with no margin — and the last tab stop on the
          page.
        */}
        <button
          ref={closeButton}
          type="button"
          aria-label="Close detail"
          onClick={onClose}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

      <Field label={`Checklist (${card.completedChecklist} of ${card.totalChecklist} done)`}>
        {card.checklist.length === 0 ? (
          <span className="text-text-secondary">
            No checklist rows — which is why this change cannot leave Validate.
          </span>
        ) : (
          <div className="flex flex-col gap-2">
            {/*
              What is left, not what is finished. The unfiltered list ran to
              8,282px on this repository's own change, with the first incomplete
              row 4,760px down — five screens of struck-through text before the
              first thing anyone still has to do.
            */}
            {outstanding.length === 0 ? (
              <p data-testid="drawer-checklist-all-done" className="text-sm text-status-success">
                Every checklist row is complete.
              </p>
            ) : null}
            <ul data-testid="drawer-checklist" className="flex flex-col gap-1">
              {(showCompleted ? card.checklist : outstanding).map((row, index) => (
                <ChecklistRow key={`${index}-${row.text}`} text={row.text} completed={row.completed} />
              ))}
            </ul>
            {done.length > 0 && (
              <button
                type="button"
                onClick={() => setShowCompleted((open) => !open)}
                aria-expanded={showCompleted}
                className="self-start rounded-md px-2 py-1.5 text-xs font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {showCompleted ? 'Hide' : 'Show'} {done.length} completed
              </button>
            )}
          </div>
        )}
      </Field>

      {card.evidenceLimited && (
        <p className="text-xs text-status-warning">
          Some of this change&rsquo;s evidence was not read, so this detail is partial.
        </p>
      )}
    </div>
    </>
  )
}
