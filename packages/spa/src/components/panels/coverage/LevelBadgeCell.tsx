/**
 * LevelBadgeCell.tsx — Clickable L-level badge for the Coverage Matrix level column.
 *
 * CML-08: renders the ClaudeMdEval headline level as a colored pill.
 *
 * 5 render states:
 *   L0         — muted (text-tertiary) pill; button enabled
 *   L1–L2      — amber (status-warning) pill; button enabled
 *   L3–L4      — blue (status-info) pill; button enabled
 *   L5–L6      — green (status-success) pill; button enabled
 *   Inferred   — same as above + always-visible ~ sigil (never hover-only)
 *   Degraded   — em-dash span only, NO button
 *
 * Constraints (D-5.1-10 — non-negotiable):
 * - NO cn()/clsx/CVA — inline className strings with LEVEL_TOKEN_MAP lookup
 * - NO hex literals — Phase 05.1 token names only
 * - NO shadcn aliases (bg-background, text-foreground, etc.)
 */
import React from 'react'
import type { ClaudeMdEval } from '@agenticapps/dashboard-shared'

export interface LevelBadgeCellProps {
  /** undefined = pre-DASH-15 daemon or scanner degraded */
  evalData: ClaudeMdEval | undefined
  /** for aria-label construction */
  repoName: string
  /** triggers drawer open (not called when degraded) */
  onClick: () => void
}

// Level → {bg, text} token mapping (UI-SPEC §L-level Badge Color Mapping — locked)
const LEVEL_TOKEN_MAP: Record<number, { bg: string; text: string }> = Object.freeze({
  0: { bg: 'bg-text-tertiary/10', text: 'text-text-tertiary' }, // Absent — muted
  1: { bg: 'bg-status-warning/10', text: 'text-status-warning' }, // Basic — amber
  2: { bg: 'bg-status-warning/10', text: 'text-status-warning' }, // Scoped — amber
  3: { bg: 'bg-status-info/10', text: 'text-status-info' }, // Structured — blue
  4: { bg: 'bg-status-info/10', text: 'text-status-info' }, // Abstracted — blue
  5: { bg: 'bg-status-success/10', text: 'text-status-success' }, // Maintained — green
  6: { bg: 'bg-status-success/10', text: 'text-status-success' }, // Adaptive — green
})

export function LevelBadgeCell({
  evalData,
  repoName,
  onClick,
}: LevelBadgeCellProps): React.JSX.Element {
  // Degraded / undefined: render em-dash, no button (mirrors understand column)
  if (evalData === undefined) {
    return (
      <span
        className="text-text-tertiary text-xs"
        aria-label={`CLAUDE.md level for ${repoName}: not available`}
      >
        —
      </span>
    )
  }

  const tokens = LEVEL_TOKEN_MAP[evalData.level] ?? LEVEL_TOKEN_MAP[0]

  // aria-label includes ", inferred" when eval.inferred is true (UI-SPEC §Copywriting)
  const ariaLabel = evalData.inferred
    ? `CLAUDE.md level for ${repoName}: ${evalData.levelLabel}, inferred. Click for details.`
    : `CLAUDE.md level for ${repoName}: ${evalData.levelLabel}. Click for details.`

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="w-full h-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
    >
      <span
        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${tokens.bg} ${tokens.text}`}
      >
        L{evalData.level}
        {evalData.inferred && (
          // Always-visible inferred sigil — never hover-only (UI-SPEC §2)
          <span className="ml-1 text-[10px] font-semibold bg-accent-bg text-accent rounded px-1">
            ~
          </span>
        )}
      </span>
    </button>
  )
}
