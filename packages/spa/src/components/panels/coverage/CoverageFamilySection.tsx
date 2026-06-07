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
import type { CoverageRowProps } from './CoverageRow.js'
import { ScanPill } from './ScanPill.js'
import { CoverageFamilySectionMobile } from './CoverageFamilySectionMobile.js'
import { writeToClipboard } from '../../../lib/clipboardCompat.js'
import { COVERAGE_COL_WIDTHS } from './coverageColumns.js'
import { coverageColumnTooltips } from './coverageColumnTooltips.js'
import { useToast } from '../../ui/Toast.js'
import { Tooltip } from '../../ui/Tooltip.js'
import { useViewportBreakpoint } from '../../../lib/useViewportBreakpoint.js'

/**
 * Stable key for a row's in-flight refresh slot. Same convention used in
 * CoveragePage when adding/removing entries from the inFlightRefreshes Set.
 */
export function refreshKey(family: CoverageFamily, repo: string): string {
  return `${family}/${repo}`
}

export interface CoverageFamilySectionProps {
  family: CoverageFamily
  rows: ReadonlyArray<CoverageRowData>  // already filtered (parent applies filter+search)
  gitNexusInstallState: GitNexusInstallState  // 10.6: 3-state replaces boolean
  onRefresh?: CoverageRowProps['onRefresh']
  /**
   * Set of `${family}/${repo}` keys currently in-flight for a gitnexus-analyze
   * refresh. Replaces the prior `refreshIsPending`+`refreshVariables` pair so
   * concurrent row refreshes each retain their own pending+disabled state.
   * Phase 11.2 stage-1 /review cross-model finding (Claude F4 / Codex #1).
   */
  inFlightRefreshes?: ReadonlySet<string>
  /**
   * Phase 13 D-13-08 + D-13-11b: gitnexus health props for per-family ScanPill
   * and for passing down to each CoverageRow's per-repo ScanPill.
   * Sourced from GET /health response.gitnexus — passed down from CoveragePage.
   * Defaults to false when health data is unavailable (safe fallback: no Scan pill shown).
   */
  gitnexusInstalled?: boolean
  gitnexusCanScan?: boolean
  /**
   * Phase 14 D-14-03/06/07: per-row understand viewer URLs, keyed by `${family}/${repo}`.
   * Built by CoveragePage from `agentUrl/understand/{family}/{repo}/?token={viewerToken}`.
   * Absent for pre-Phase-14 daemons or when pairing is missing.
   */
  understandViewerUrls?: Readonly<Record<string, string>>
}

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
  inFlightRefreshes,
  gitnexusInstalled = false,
  gitnexusCanScan = false,
  understandViewerUrls,
}: CoverageFamilySectionProps): React.JSX.Element {
  // Phase 12 Plan 12-05 (D-12-23 + D-12-24): viewport branch — at xs (<640px
  // Tailwind 4) render the card-per-row sibling; otherwise the desktop
  // table + col-group render below is untouched (Phase 11.1 IMP-01 +
  // 11.2 D-11.2-11 invariants preserved).
  //
  // Rules of Hooks compliance: ALL hooks run unconditionally before the
  // viewport branch's early return. The breakpoint change therefore never
  // shortens the hook list across re-renders of the same instance — only
  // the JSX path diverges. The desktop branch's useState/useEffect still
  // initialise their localStorage-backed `collapsed` state even when mobile
  // renders, which is fine: that state is cheap and is consumed on a future
  // viewport crossing back to >= sm.
  const breakpoint = useViewportBreakpoint()
  const toast = useToast()
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

  // D-12-23 / Plan 12-05: "card-per-row layout under <768px". Tailwind's
  // `xs` is <640px and `sm` is 640–767px — the plan's "<768px" threshold
  // covers both. Previously this branched only on 'xs', leaving the 640–
  // 767px range (Android phones in landscape, small tablets, iPad portrait
  // at 768px is borderline) stuck on the desktop table.
  if (breakpoint === 'xs' || breakpoint === 'sm') {
    return (
      <CoverageFamilySectionMobile
        family={family}
        rows={rows}
        gitNexusInstallState={gitNexusInstallState}
        gitnexusInstalled={gitnexusInstalled}
        gitnexusCanScan={gitnexusCanScan}
        {...(onRefresh !== undefined ? { onRefresh } : {})}
        {...(inFlightRefreshes !== undefined ? { inFlightRefreshes } : {})}
        {...(understandViewerUrls !== undefined ? { understandViewerUrls } : {})}
      />
    )
  }

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
      <header className="sticky top-[calc(var(--ph-h)-1.5rem)] z-20 bg-card-bg border-b border-border-subtle px-4 py-3 rounded-t-card">
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

          {/* Phase 13 D-13-08: per-family ScanPill in header bar — next to aggregate chips.
              Gated on gitnexusInstalled (binary present). ScanPill handles canScan=false
              with a disabled+tooltip state (D-13-11b). Returns null when installed=false
              so the install hint below remains the only affordance in that case (D-13-07). */}
          {gitnexusInstalled && (
            <ScanPill
              scope="family"
              target={family}
              canScan={gitnexusCanScan}
              installed={gitnexusInstalled}
            />
          )}

          {/* CODEX HIGH-6 Option A: per-family GitNexus install hint (not page-level banner).
              10.6: only fires for 'not-installed' — when binary is present but registry
              isn't yet ('installed-no-registry'), the page-level "Index with GitNexus"
              CTA is the right prompt; this section stays quiet to avoid double-prompting. */}
          {gitNexusInstallState === 'not-installed' && (
            <span className="flex items-center gap-2 text-xs text-status-warning">
              GitNexus is not installed —{' '}
              <button
                type="button"
                onClick={async () => {
                  const ok = await writeToClipboard(buildGitnexusInstallClipboardString())
                  toast.show(
                    ok
                      ? { message: 'Copied — paste in terminal to install GitNexus', variant: 'success' }
                      : { message: 'Copy failed — open the help guide for the command.', variant: 'error' },
                  )
                }}
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
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className={COVERAGE_COL_WIDTHS.repo} />
              <col className={COVERAGE_COL_WIDTHS.claudeMd} />
              <col className={COVERAGE_COL_WIDTHS.gitNexus} />
              <col className={COVERAGE_COL_WIDTHS.wiki} />
              <col className={COVERAGE_COL_WIDTHS.workflow} />
              <col className={COVERAGE_COL_WIDTHS.understand} />
              <col className={COVERAGE_COL_WIDTHS.actions} />
            </colgroup>
            <thead>
              <tr className="text-xs text-text-tertiary border-b border-border-subtle">
                <th scope="col" className="sticky top-[calc(var(--ph-h)+1.5625rem)] z-10 bg-card-bg py-2 pr-3 px-4 font-medium">Repo</th>
                <th scope="col" className="sticky top-[calc(var(--ph-h)+1.5625rem)] z-10 bg-card-bg px-2 py-2 font-medium"><Tooltip content={coverageColumnTooltips.claudeMd}>CLAUDE.md</Tooltip></th>
                <th scope="col" className="sticky top-[calc(var(--ph-h)+1.5625rem)] z-10 bg-card-bg px-2 py-2 font-medium"><Tooltip content={coverageColumnTooltips.gitNexus}>GitNexus</Tooltip></th>
                <th scope="col" className="sticky top-[calc(var(--ph-h)+1.5625rem)] z-10 bg-card-bg px-2 py-2 font-medium"><Tooltip content={coverageColumnTooltips.wiki}>Wiki</Tooltip></th>
                <th scope="col" className="sticky top-[calc(var(--ph-h)+1.5625rem)] z-10 bg-card-bg px-2 py-2 font-medium"><Tooltip content={coverageColumnTooltips.workflowVersion}>Workflow</Tooltip></th>
                <th scope="col" className="sticky top-[calc(var(--ph-h)+1.5625rem)] z-10 bg-card-bg px-2 py-2 font-medium"><Tooltip content={coverageColumnTooltips.understand}>Understand</Tooltip></th>
                <th scope="col" className={`sticky top-[calc(var(--ph-h)+1.5625rem)] z-10 bg-card-bg pl-2 py-2 ${COVERAGE_COL_WIDTHS.actions}`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => {
                const pending = !!inFlightRefreshes?.has(refreshKey(row.family, row.repo))
                const repoKey = `${row.family}/${row.repo}`
                return (
                  <CoverageRow
                    key={`${row.family}-${row.repo}`}
                    row={row}
                    pending={pending}
                    gitnexusInstalled={gitnexusInstalled}
                    gitnexusCanScan={gitnexusCanScan}
                    {...(understandViewerUrls?.[repoKey] !== undefined ? { understandViewerUrl: understandViewerUrls[repoKey] } : {})}
                    {...(onRefresh !== undefined ? { onRefresh } : {})}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
