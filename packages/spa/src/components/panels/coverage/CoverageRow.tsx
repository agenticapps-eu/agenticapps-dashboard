/**
 * CoverageRow.tsx — Single repo row: 4 CoverageCells + OverrideChip + refresh popover.
 *
 * CODEX HIGH-1: NEVER renders row.absPath (it's daemon-internal only).
 * UI-SPEC §5: refresh action popover with row-specific options.
 *
 * Phase 13 D-13-08: renders ScanPill in the gitNexus cell when gitnexus is
 * installed and the row's gitNexus state is missing/not-applicable (not indexed yet).
 * ScanPill returns null when installed=false — InstallGitNexusButton remains at
 * the family-header level for that case (D-13-07 fallback preserved).
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 * - NO shadcn aliases
 */
import React, { useState, useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import type { CoverageRow as CoverageRowData, CoverageFamily } from '@agenticapps/dashboard-shared'
import { CoverageCell } from './CoverageCell.js'
import { OverrideChip } from './OverrideChip.js'
import { ScanPill } from './ScanPill.js'
import { useCoverageHistory } from '../../../lib/coverageHistoryQueries.js'
import { COVERAGE_COL_WIDTHS } from './coverageColumns.js'

export type CoverageRefreshAction =
  | 'gitnexus-analyze'
  | 'wiki-compile-clipboard'
  | 'workflow-update-clipboard'
  | 'claude-md-help'

export interface CoverageRowContext {
  family: CoverageFamily
  repo: string
}

export interface CoverageRowProps {
  row: CoverageRowData
  onRefresh?: (action: CoverageRefreshAction, context: CoverageRowContext) => void
  pending?: boolean       // NEW — default false; when true: spinner + aria-busy + disabled + opacity-100
  /**
   * Phase 13 D-13-08 + D-13-11b: gitnexus health props for ScanPill.
   * Sourced from GET /health response.gitnexus — passed down from CoveragePage.
   * Defaults to false when health data is unavailable (safe fallback: no Scan pill shown).
   */
  gitnexusInstalled?: boolean
  gitnexusCanScan?: boolean
}

// Derive popover options from the row's column states
function getRefreshOptions(row: CoverageRowData) {
  const opts: Array<{ label: string; action: CoverageRefreshAction }> = []
  // D-13-08 + I-4: missing rows use ScanPill; popover only for stale to avoid
  // duplicate dispatch surfaces for the same row+action.
  if (row.gitNexus.state === 'stale') {
    opts.push({ label: 'Run gitnexus analyze for this repo', action: 'gitnexus-analyze' })
  }
  if (row.wiki.state === 'stale' || row.wiki.state === 'missing') {
    opts.push({ label: 'Copy /wiki-compile command', action: 'wiki-compile-clipboard' })
  }
  if (
    row.workflowVersion.state === 'stale' &&
    row.workflowVersion.kind === 'workflow' &&
    row.workflowVersion.detail !== 'ahead'
  ) {
    opts.push({ label: 'Copy /update-agenticapps-workflow', action: 'workflow-update-clipboard' })
  }
  if (row.claudeMd.state === 'missing') {
    opts.push({ label: 'How to add CLAUDE.md', action: 'claude-md-help' })
  }
  return opts
}

export function CoverageRow({
  row,
  onRefresh,
  pending = false,
  gitnexusInstalled = false,
  gitnexusCanScan = false,
}: CoverageRowProps): React.JSX.Element {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const options = getRefreshOptions(row)

  // Phase 11-04 (PD-11-02 + REVIEWS action item 1 — Option C):
  // CoverageRow owns the SINGLE per-row history hook and fans the four cell
  // drifts out as props to its four CoverageCell children. CoverageCell stays
  // purely presentational.
  //
  // Performance budget (REVIEWS action item 2): TanStack dedup on
  // ['coverageHistory', repoId] guarantees ≤ 1 fetch per registered repo on
  // first paint of /coverage. isPending / isError → all four cells receive
  // null drift (no badge); the row never crashes on a degraded history
  // signal since drift is auxiliary, not core data.
  const repoId = `${row.family}/${row.repo}`
  const history = useCoverageHistory(repoId)
  const cellDrifts = history.data?.cells ?? null

  // Close popover on outside-click
  useEffect(() => {
    if (!popoverOpen) return
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [popoverOpen])

  // Close popover on Escape
  useEffect(() => {
    if (!popoverOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPopoverOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [popoverOpen])

  return (
    <tr {...(pending ? { 'aria-busy': true } : {})} className="group hover:bg-card-bg-hover">
      {/* Repo identity — NEVER renders absPath (CODEX HIGH-1).
          pl-4 matches the column header's px-4 left padding so body rows align
          with the "Repo" column label above. */}
      <td className={`${COVERAGE_COL_WIDTHS.repo} py-2 pl-4 pr-3 text-sm font-medium text-text-primary whitespace-nowrap`}>
        <div className="flex items-center gap-2">
          <span>{row.repo}</span>
          <OverrideChip
            count={row.overrideCount}
            overrides={row.overrides}
            repoName={row.repo}
          />
        </div>
      </td>

      {/* 4 coverage cells in fixed column order. drift={cellDrifts?.X ?? null}
          fans the four cell drifts out from the single useCoverageHistory hook
          (Option C — PD-11-02). */}
      <td className={`${COVERAGE_COL_WIDTHS.claudeMd} px-2 py-2`}>
        <CoverageCell
          column="claudeMd"
          state={row.claudeMd}
          repoName={row.repo}
          drift={cellDrifts?.claudeMd ?? null}
        />
      </td>
      <td className={`${COVERAGE_COL_WIDTHS.gitNexus} px-2 py-2`}>
        {/* Phase 13 D-13-08 + D-13-EXT-08 (Gap 1 fix): show ScanPill when gitnexus
            is installed AND the row is in a scannable state (missing/not-applicable).
            row.inRegistry is metadata only — D-13-EXT-08 supersedes D-13-EXT-07:
            the daemon resolves ~/Sourcecode/{family}/{repo} deterministically for
            repos not in the dashboard registry, so the SPA does not need to gate
            on registry membership. T-13-02-01 mitigation is preserved by the
            schema regex (/^[a-z0-9\-]+\/[a-z0-9\-_.]+$/) which blocks path
            traversal; gitnexus writes only to ~/.gitnexus/, not the target dir. */}
        {gitnexusInstalled
          && (row.gitNexus.state === 'missing' || row.gitNexus.state === 'not-applicable') ? (
          <ScanPill
            scope="repo"
            target={`${row.family}/${row.repo}`}
            canScan={gitnexusCanScan}
            installed={gitnexusInstalled}
          />
        ) : (
          <CoverageCell
            column="gitNexus"
            state={row.gitNexus}
            repoName={row.repo}
            drift={cellDrifts?.gitNexus ?? null}
          />
        )}
      </td>
      <td className={`${COVERAGE_COL_WIDTHS.wiki} px-2 py-2`}>
        <CoverageCell
          column="wiki"
          state={row.wiki}
          repoName={row.repo}
          drift={cellDrifts?.wiki ?? null}
        />
      </td>
      <td className={`${COVERAGE_COL_WIDTHS.workflow} px-2 py-2`}>
        <CoverageCell
          column="workflowVersion"
          state={row.workflowVersion}
          repoName={row.repo}
          drift={cellDrifts?.workflowVersion ?? null}
        />
      </td>

      {/* Refresh action — visible on hover/focus */}
      <td className={`${COVERAGE_COL_WIDTHS.actions} py-2 pl-2`}>
        <div ref={popoverRef} className="relative">
          <button
            type="button"
            aria-label={`Refresh actions for ${row.repo}`}
            onClick={() => setPopoverOpen((o) => !o)}
            disabled={pending}
            {...(pending ? { 'aria-busy': true } : {})}
            className={
              pending
                ? "text-text-tertiary hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md opacity-100 min-w-[44px] min-h-[44px] p-[15px]"
                : "text-text-tertiary hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md opacity-30 group-hover:opacity-100 focus-within:opacity-100 focus:opacity-100 min-w-[44px] min-h-[44px] p-[15px]"
            }
          >
            <RefreshCw size={14} aria-hidden="true" className={pending ? 'animate-spin' : ''} />
          </button>

          {popoverOpen && options.length > 0 && (
            <div className="absolute right-0 top-6 z-20 min-w-[220px] rounded-md bg-card-bg shadow-card border border-border-subtle p-1">
              {options.map((opt) => (
                <button
                  key={opt.action}
                  type="button"
                  onClick={() => {
                    onRefresh?.(opt.action, { family: row.family, repo: row.repo })
                    setPopoverOpen(false)
                  }}
                  className="block w-full rounded-md px-3 py-1.5 text-left text-sm text-text-primary hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
