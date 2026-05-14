/**
 * OverrideChip.tsx — Conditional chip for phase-review override sentinels.
 *
 * Pitfall 5: returns null when count === 0 (no "0 overrides" pollution).
 * UI-SPEC §5: expand/collapse + ARIA per spec.
 *
 * Tokens (UI-SPEC §4):
 *   bg-status-warning/10 text-status-warning rounded-md px-2 py-0.5 text-xs
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 * - NO shadcn aliases
 */
import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { OverrideEntry } from '@agenticapps/dashboard-shared'

export interface OverrideChipProps {
  count: number
  overrides: ReadonlyArray<OverrideEntry>
  repoName: string // for ARIA label
}

export function OverrideChip({ count, overrides, repoName }: OverrideChipProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)

  // Pitfall 5: early null on count === 0 — no '0 overrides' pollution
  if (count === 0) return null

  const label = count === 1 ? 'override' : 'overrides'
  const listId = `overrides-list-${repoName.replace(/[^a-zA-Z0-9-]/g, '-')}`
  const ariaLabel = `${count} phase review${count === 1 ? '' : 's'} overridden in ${repoName}`

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setExpanded((v) => !v)
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={handleKeyDown}
        className="inline-flex items-center gap-1 bg-status-warning/10 text-status-warning rounded-md px-2 py-0.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <AlertTriangle size={12} aria-hidden="true" />
        {count} {label}
      </button>
      {expanded && (
        <ul
          id={listId}
          role="list"
          className="mt-1 flex flex-col gap-0.5 text-xs text-text-secondary pl-1"
        >
          {overrides.map((entry, i) => (
            <li key={`${entry.phaseSlug}-${i}`}>
              {entry.phaseSlug} — sentinel since {entry.sinceIso ?? 'unknown'}
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}
