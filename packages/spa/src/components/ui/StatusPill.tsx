/**
 * StatusPill — "label · value" pill for TopBar status display (Phase 5.1 Wave 0).
 *
 * UI-SPEC §6: left segment = label, right segment = value, mid-dot separator aria-hidden.
 * Used for "Phase 5 · 87%" style breadcrumb status indicators.
 *
 * Constraints (D-5.1-10):
 * - NO transition utilities
 * - NO cn()/clsx/CVA (RESEARCH Pattern 5)
 */
import React from 'react'

export interface StatusPillProps {
  label: string
  value: string
  /** When true, applies bg-accent-bg + text-accent styling for the active/highlighted state. */
  accent?: boolean
}

export function StatusPill({ label, value, accent = false }: StatusPillProps): React.JSX.Element {
  const colorCls = accent
    ? 'bg-accent-bg text-accent'
    : 'bg-card-bg-hover text-text-secondary'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${colorCls}`}
    >
      <span>{label}</span>
      <span aria-hidden="true">·</span>
      <span>{value}</span>
    </span>
  )
}
