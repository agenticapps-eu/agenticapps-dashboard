/**
 * CardHeader — icon + label + helper/action header row (Phase 5.1 Wave 0).
 *
 * UI-SPEC §8: 16px lucide icon, semibold label, optional small helper text or action.
 * When both helper and action are provided, action wins (helper is hidden).
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'

export interface CardHeaderProps {
  /** 16px lucide-react icon ReactNode. */
  icon?: React.ReactNode
  /** Panel heading text — rendered as <h2>. */
  label: string
  /** Small right-aligned caption (e.g. "updated 3s ago"). Hidden when action is present. */
  helper?: string
  /** Right-aligned interactive element (takes priority over helper). */
  action?: React.ReactNode
  /** id for the <h2>; consumer pairs with Card ariaLabelledBy to form the a11y link. */
  titleId?: string
}

export function CardHeader({
  icon,
  label,
  helper,
  action,
  titleId,
}: CardHeaderProps): React.JSX.Element {
  return (
    <header className="mb-4 flex items-center gap-2">
      {icon}
      <h2
        id={titleId}
        className="text-lg font-semibold leading-snug text-text-primary"
      >
        {label}
      </h2>
      {action ? (
        <span className="ml-auto">{action}</span>
      ) : helper ? (
        <span className="ml-auto text-sm text-text-tertiary">{helper}</span>
      ) : null}
    </header>
  )
}
