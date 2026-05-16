/**
 * CoverageDriftBadge — inline ▲Nd / ▼Nd drift indicator on a CoverageCell.
 *
 * Plan 11-04 / D-11-03 — Phase 11 chose inline text over a sparkline / SVG
 * primitive to preserve the matrix's calm aesthetic post Phase-6/10.5 polish,
 * and to work on touch (Tailscale-from-iPad use case rejects hover-only
 * surfaces).
 *
 * Tokens (D-5.1-10): text-status-success for direction="up" (improvement);
 * text-status-error for direction="down" (regression). NO new hex literals.
 *
 * Name choice (D-11-03 footnote / CONTEXT canonical_refs):
 * MUST NOT be named `InlineDrift` — that is the Phase 6 schema-drift panel
 * at packages/spa/src/components/panels/InlineDrift.tsx.
 *
 * Aria-label is singular/plural correct: "Improved 1 day ago" vs
 * "Improved 3 days ago" so screen readers narrate naturally.
 */

import type { ReactElement } from 'react'

export interface CoverageDriftBadgeProps {
  direction: 'up' | 'down'
  daysSince: number
}

export function CoverageDriftBadge({
  direction,
  daysSince,
}: CoverageDriftBadgeProps): ReactElement {
  const arrow = direction === 'up' ? '▲' : '▼'
  const colorClass =
    direction === 'up' ? 'text-status-success' : 'text-status-error'
  const verb = direction === 'up' ? 'Improved' : 'Regressed'
  const dayWord = daysSince === 1 ? 'day' : 'days'
  return (
    <span
      className={`text-xs font-semibold ${colorClass}`}
      aria-label={`${verb} ${daysSince} ${dayWord} ago`}
    >
      {arrow}
      {daysSince}d
    </span>
  )
}
