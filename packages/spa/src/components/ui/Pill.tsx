/**
 * Pill — generic inline tag with 5 variants (Phase 5.1 Wave 0).
 *
 * UI-SPEC §8: rounded-md (6px, intentionally less than card 12px), text-xs, font-medium.
 * Variant colors come from Tailwind 4 namespaced utilities — NO hex literals.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO tabular-nums (Pill is text; MetricNumeric handles numbers)
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5 — inline VARIANT_CLASSES lookup)
 */
import React from 'react'

export type PillVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'error'

const VARIANT_CLASSES: Record<PillVariant, string> = {
  neutral: 'bg-card-bg-hover text-text-secondary',
  accent:  'bg-accent-bg text-accent',
  success: 'bg-card-bg-hover text-status-success',
  warning: 'bg-card-bg-hover text-status-warning',
  error:   'bg-card-bg-hover text-status-error',
}

export interface PillProps {
  variant?: PillVariant
  children: React.ReactNode
}

export function Pill({ variant = 'neutral', children }: PillProps): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  )
}
