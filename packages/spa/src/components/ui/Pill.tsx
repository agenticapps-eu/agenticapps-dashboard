/**
 * Pill — generic inline tag, two emphasis variants (Phase 5.1 Wave 0).
 *
 * UI-SPEC §8: rounded-md (6px, intentionally less than card 12px), text-xs, font-medium.
 * Variant colors come from Tailwind 4 namespaced utilities — NO hex literals.
 *
 * `success`, `warning` and `error` were removed by `retire-v1-surfaces` §3.
 * All three sat on the same `bg-card-bg-hover` as `neutral` and changed only
 * the text hue, which is what `design-system` → State Is Never Signalled By
 * Colour Alone forbids. Nothing rendered them — `neutral` in TopBar is the
 * only caller this component has ever had — so removing them changed no
 * pixel; it removed the ability to introduce the violation by typing one
 * word. A pill that carries a state needs a second channel, as ChangeCard's
 * badge has with its `●` and the readiness cells have with their six shapes.
 * Add the variant back with a glyph when something actually needs one.
 *
 * The two that remain are emphasis, not state: neither answers "how is it
 * going", so neither is a state to be told apart without colour.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO tabular-nums (Pill is text; MetricNumeric handles numbers)
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5 — inline VARIANT_CLASSES lookup)
 */
import React from 'react'

export type PillVariant = 'neutral' | 'accent'

export const VARIANT_CLASSES: Record<PillVariant, string> = {
  neutral: 'bg-card-bg-hover text-text-secondary',
  accent:  'bg-accent-bg text-accent',
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
