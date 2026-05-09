/**
 * EmptyState — consolidated empty surface primitive (Phase 5.1 Wave 0).
 *
 * UI-SPEC §8 + Phase 4 D-4-14: each panel has a hand-written empty state.
 * This component provides the shared structural wrapper; content is always
 * panel-specific (no generic "no data" placeholder text).
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'

export interface EmptyStateProps {
  /** Decorative icon ReactNode (aria-hidden wrapper applied internally). */
  icon?: React.ReactNode
  /** Short heading — panel-specific, not generic. */
  title: string
  /** Explanatory body text or ReactNode. */
  body: string | React.ReactNode
  /** Optional call-to-action (e.g. Register button). */
  action?: React.ReactNode
}

export function EmptyState({ icon, title, body, action }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
      <p className="text-base text-text-secondary">{body}</p>
      {action ? action : null}
    </div>
  )
}
