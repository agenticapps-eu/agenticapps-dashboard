/**
 * CoverageFamilySection.tsx — Sticky family header + per-repo rows + GitNexus install hint.
 *
 * CODEX HIGH-6 Option A: GitNexus install hint is inside the family header
 *   (not a separate page-level banner).
 *
 * 10.6 change: the install hint now fires ONLY when `gitNexusInstallState`
 *   is 'not-installed'. Under the prior boolean it also fired for the
 *   installed-but-never-indexed case, which was wrong advice ("install" when
 *   the binary was already present). For the `installed-no-registry` state
 *   the page-level CTA shows "Index with GitNexus"; this section stays quiet
 *   to avoid double-prompting.
 *
 * CODEX MED: worst-state-wins aggregate counts per row
 *   (missing > stale > fresh; not-applicable ignored).
 *   Each row counted ONCE in its highest-priority bucket.
 *   Totals: miss + stale + fresh ≤ rows.length always.
 * UI-SPEC §5: localStorage key format 'coverage:section-collapsed:<family>'.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 * - NO shadcn aliases
 */
import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type {
  CoverageRow as CoverageRowData,
  CoverageFamily,
  CoverageState,
  GitNexusInstallState,
} from '@agenticapps/dashboard-shared'
import { buildGitnexusInstallClipboardString } from '@agenticapps/dashboard-shared'
import { CoverageRow } from './CoverageRow.js'
import { writeToClipboard } from '../../../lib/clipboardCompat.js'

export interface CoverageFamilySectionProps {
  family: CoverageFamily
  rows: ReadonlyArray<CoverageRowData>  // already filtered (parent applies filter+search)
  gitNexusInstallState: GitNexusInstallState  // 10.6: 3-state replaces boolean
  onRefresh?: CoverageRowProps['onRefresh']
}

// We reference CoverageRowProps so import it
import type { CoverageRowProps } from './CoverageRow.js'

// UI-SPEC §5: localStorage key format (locked)
function storageKey(family: CoverageFamily): string {
  return `coverage:section-collapsed:${family}`
}

// CODEX MED: worst-state-wins per row
// Priority: missing > stale > fresh > not-applicable
// Returns the worst state across all 4 columns for a given row
function worstState(row: CoverageRowData): CoverageState | 'not-applicable' {
  const states: CoverageState[] = [
    row.claudeMd.state,
    row.gitNexus.state,
    row.wiki.state,
    row.workflowVersion.state,
  ]
  if (states.includes('missing')) return 'missing'
  if (states.includes('stale')) return 'stale'
  if (states.includes('fresh')) return 'fresh'
  return 'not-applicable'
}

// Compute aggregate counts from filtered rows using worst-state-wins
function computeCounts(rows: ReadonlyArray<CoverageRowData>) {
  // worst-state-wins: each row counted ONCE
  let miss = 0
  let stale = 0
  let fresh = 0
  for (const row of rows) {
    const ws = worstState(row)
    if (ws === 'missing') miss++
    else if (ws === 'stale') stale++
    else if (ws === 'fresh') fresh++
    // not-applicable: not counted in any bucket
  }
  return { miss, stale, fresh }
}

export function CoverageFamilySection({
  family,
  rows,
  gitNexusInstallState,
  onRefresh,
}: CoverageFamilySectionProps): React.JSX.Element {
  const key = storageKey(family)

  // Restore collapse state from localStorage on mount (UI-SPEC §5)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(key) === 'true'
    } catch {
      return false
    }
  })

  // Write collapse state to localStorage on toggle (UI-SPEC §5)
  useEffect(() => {
    try {
      localStorage.setItem(key, String(collapsed))
    } catch {
      // ignore localStorage errors (private browsing etc.)
    }
  }, [collapsed, key])

  const { miss, stale, fresh } = computeCounts(rows)
  const bodyId = `family-${family}-body`

  return (
    // P0 fix from 10-IMPECCABLE.md: `overflow-hidden` was neutering the sticky
    // family header — sticky positioning needs a scrolling ancestor that doesn't
    // clip the sticky element. With overflow-hidden, the section becomes its own
    // (non-scrolling) clipping context and sticky has nowhere to stick.
    // Rounded corners still render because the inner content shares bg-card-bg.
    <section className="rounded-card bg-card-bg shadow-card">
      {/* Sticky family header (UI-SPEC §3) */}
      <header className="sticky top-14 z-20 bg-card-bg border-b border-border-subtle px-4 py-3 rounded-t-card">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
          >
            {collapsed ? (
              <ChevronRight size={14} aria-hidden="true" className="text-text-secondary" />
            ) : (
              <ChevronDown size={14} aria-hidden="true" className="text-text-secondary" />
            )}
            <span className="font-semibold text-text-primary">{family}</span>
            <span className="text-text-tertiary text-sm">· {rows.length} repos</span>
            {/* Aggregate counts — worst-state-wins per row (CODEX MED) */}
            <span className="text-sm text-status-error">✕ {miss}</span>
            <span className="text-sm text-status-warning">⚠ {stale}</span>
            <span className="text-sm text-status-success">✓ {fresh}</span>
          </button>

          {/* CODEX HIGH-6 Option A: per-family GitNexus install hint (not page-level banner).
              10.6: only fires for 'not-installed' — when binary is present but registry
              isn't yet ('installed-no-registry'), the page-level "Index with GitNexus"
              CTA is the right prompt; this section stays quiet to avoid double-prompting. */}
          {gitNexusInstallState === 'not-installed' && (
            <span className="flex items-center gap-2 text-xs text-status-warning">
              GitNexus is not installed —{' '}
              <button
                type="button"
                onClick={() => void writeToClipboard(buildGitnexusInstallClipboardString())}
                className="underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
              >
                Copy npm install -g gitnexus
              </button>
            </span>
          )}
        </div>
      </header>

      {/* Body: rows visible when expanded */}
      {!collapsed && (
        <div id={bodyId} role="region" aria-label={`${family} repos`}>
          <table className="w-full text-left">
            {/* Column headers stick below the family header. Phase 11 PLI-03 stack:
                Phase 11 stacked PageHeader sticky at top-0 (~56px with helper) above the
                family header (now top-14 = 56px, height ~48px) — column headers slot
                directly under the family header at top-[6.5rem] (104px = 56 + 48).
                Applied per-<th> rather than on <tr> because tr-level sticky is unreliable
                across browsers. z-10 keeps them above scrolling rows but below the family
                header (z-20). */}
            <thead>
              <tr className="text-xs text-text-tertiary border-b border-border-subtle">
                <th scope="col" className="sticky top-[6.5rem] z-10 bg-card-bg py-2 pr-3 px-4 font-medium">Repo</th>
                <th scope="col" className="sticky top-[6.5rem] z-10 bg-card-bg px-2 py-2 font-medium">CLAUDE.md</th>
                <th scope="col" className="sticky top-[6.5rem] z-10 bg-card-bg px-2 py-2 font-medium">GitNexus</th>
                <th scope="col" className="sticky top-[6.5rem] z-10 bg-card-bg px-2 py-2 font-medium">Wiki</th>
                <th scope="col" className="sticky top-[6.5rem] z-10 bg-card-bg px-2 py-2 font-medium">Workflow</th>
                <th scope="col" className="sticky top-[6.5rem] z-10 bg-card-bg pl-2 py-2 w-8">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => (
                <CoverageRow
                  key={`${row.family}-${row.repo}`}
                  row={row}
                  {...(onRefresh !== undefined ? { onRefresh } : {})}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
