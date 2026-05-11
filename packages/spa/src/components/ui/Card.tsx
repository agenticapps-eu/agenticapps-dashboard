/**
 * Card — root surface primitive (Phase 5.1 Wave 0).
 *
 * UI-SPEC §8: bg-card-bg, shadow-card, rounded-card, p-6.
 * A11y: same aria-labelledby contract as PanelContainer (Pitfall 7 — enables wrapper-only
 * migration in Waves 2-3 without touching test assertions).
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 * - className prop is an escape hatch for grid-placement only
 */
import React from 'react'

export interface CardProps {
  children: React.ReactNode
  /** Escape hatch — grid-placement utilities only (e.g. col-span-2). Not for colors. */
  className?: string
  /** Wires to aria-labelledby; pairs with CardHeader titleId for accessible name. */
  ariaLabelledBy?: string
}

export function Card({ children, className = '', ariaLabelledBy }: CardProps): React.JSX.Element {
  return (
    <section
      {...(ariaLabelledBy ? { 'aria-labelledby': ariaLabelledBy } : {})}
      className={`rounded-card bg-card-bg p-6 shadow-card${className ? ` ${className}` : ''}`}
    >
      {children}
    </section>
  )
}
