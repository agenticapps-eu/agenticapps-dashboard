/**
 * KbdHint — Cmd+K visual chip (Phase 5.1 Wave 0).
 *
 * UI-SPEC §6 + §5: decorative keyboard shortcut indicator.
 * Used in TopBar (next to search input) and CommandPalette trigger.
 * aria-hidden="true" — it is a visual affordance, not accessible text.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'

export interface KbdHintProps {
  /** Displayed key combination. Default: '⌘K'. */
  keys?: string
}

export function KbdHint({ keys = '⌘K' }: KbdHintProps): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="inline-flex items-center rounded border border-border-subtle bg-card-bg-hover px-2 py-0.5 font-mono text-xs text-text-secondary"
    >
      {keys}
    </span>
  )
}
