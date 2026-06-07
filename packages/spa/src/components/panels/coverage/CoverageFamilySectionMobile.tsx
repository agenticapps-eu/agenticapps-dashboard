/**
 * CoverageFamilySectionMobile.tsx — Card-per-row layout for /coverage at xs
 * viewport (<640px Tailwind 4). Sibling to CoverageFamilySection.tsx
 * (desktop table + colgroup layout); the two render paths are mutually
 * exclusive — branched by useViewportBreakpoint() in CoverageFamilySection.
 *
 * Phase 12 Plan 12-05 Task 1 (D-12-23). Bounded scope (D-12-24): this layout
 * is consumed ONLY by /coverage; /observability/conformance remains
 * desktop-first for v1.2.0.
 *
 * Invariants:
 * - Phase 11.2 D-11.2-11: 44×44 touch target on refresh button (min-w/h-[44px] + p-[15px]).
 * - All 4 column states render via CoverageCell (reused verbatim — no divergent state-pill primitive).
 * - aria-busy + disabled mirror inFlightRefreshes Set membership.
 * - OverrideChip surfaces only when overrideCount > 0 (Pitfall 5).
 * - NO table element rendered in this branch (Phase 11.1 IMP-01 colgroup
 *   invariant applies only to the desktop branch — preserved by virtue of the
 *   early-return in CoverageFamilySection).
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 * - NO shadcn aliases
 */
import React from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import type {
  CoverageRow as CoverageRowData,
  CoverageFamily,
  GitNexusInstallState,
} from '@agenticapps/dashboard-shared'
import { buildGitnexusInstallClipboardString } from '@agenticapps/dashboard-shared'
import { CoverageCell } from './CoverageCell.js'
import { OverrideChip } from './OverrideChip.js'
import { ScanPill } from './ScanPill.js'
import { UnderstandCopyPill } from './UnderstandCopyPill.js'
import { coverageColumnTooltips } from './coverageColumnTooltips.js'
import { writeToClipboard } from '../../../lib/clipboardCompat.js'
import { useToast } from '../../ui/Toast.js'
import type { CoverageRefreshAction, CoverageRowContext } from './CoverageRow.js'
import { refreshKey } from './CoverageFamilySection.js'

export interface CoverageFamilySectionMobileProps {
  family: CoverageFamily
  rows: ReadonlyArray<CoverageRowData>
  gitNexusInstallState: GitNexusInstallState
  onRefresh?: (action: CoverageRefreshAction, context: CoverageRowContext) => void
  inFlightRefreshes?: ReadonlySet<string>
  /**
   * Phase 13 D-13-08 + Stage-2 I-3: gitnexus health props for per-row ScanPill
   * on mobile. Sourced from GET /health response.gitnexus, passed down from
   * CoverageFamilySection. Defaults to false when health data is unavailable
   * (safe fallback: ScanPill renders nothing, refresh button still shown).
   */
  gitnexusInstalled?: boolean
  gitnexusCanScan?: boolean
  /**
   * Phase 14 D-14-03/06/07: per-row understand viewer URLs, keyed by `${family}/${repo}`.
   * Passed down from CoverageFamilySection. Absent for pre-Phase-14 daemons.
   */
  understandViewerUrls?: Readonly<Record<string, string>>
}

// Display labels for the four column tiles. Lowercased to mirror the existing
// CoverageCell aria-label vocabulary ("claudeMd for repo-x: ...") so screen
// readers hear consistent column names across desktop + mobile branches.
const COLUMN_LABELS = {
  claudeMd: 'CLAUDE.md',
  gitNexus: 'GitNexus',
  wiki: 'Wiki',
  workflowVersion: 'Workflow',
} as const

const COLUMN_KEYS = ['claudeMd', 'gitNexus', 'wiki', 'workflowVersion'] as const

export function CoverageFamilySectionMobile({
  family,
  rows,
  gitNexusInstallState,
  onRefresh,
  inFlightRefreshes,
  gitnexusInstalled = false,
  gitnexusCanScan = false,
  understandViewerUrls,
}: CoverageFamilySectionMobileProps): React.JSX.Element {
  const toast = useToast()

  return (
    <section
      aria-labelledby={`mobile-family-${family}`}
      className="rounded-card bg-card-bg shadow-card"
    >
      {/* Family header (parallel structure to CoverageFamilySection — no
          sticky positioning on mobile because viewport height is the
          constraint, not horizontal scroll). */}
      <header className="bg-card-bg border-b border-border-subtle px-4 py-3 rounded-t-card flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span
            id={`mobile-family-${family}`}
            className="flex items-center gap-2 text-text-primary"
          >
            <span className="font-semibold">{family}</span>
            <span className="text-text-tertiary text-sm">· {rows.length} repos</span>
          </span>
        </div>

        {gitNexusInstallState === 'not-installed' && (
          <span className="flex items-center gap-2 text-xs text-status-warning">
            GitNexus is not installed —{' '}
            <button
              type="button"
              onClick={async () => {
                const ok = await writeToClipboard(buildGitnexusInstallClipboardString())
                toast.show(
                  ok
                    ? {
                        message:
                          'Copied — paste in terminal to install GitNexus',
                        variant: 'success',
                      }
                    : {
                        message:
                          'Copy failed — open the help guide for the command.',
                        variant: 'error',
                      },
                )
              }}
              className="underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
            >
              Copy npm install -g gitnexus
            </button>
          </span>
        )}
      </header>

      {/* Body: stacked cards, one per row */}
      <div
        className="flex flex-col gap-3 p-3"
        role="list"
        aria-label={`${family} repos`}
      >
        {rows.map((row) => {
          const id = refreshKey(row.family, row.repo)
          const isInFlight = !!inFlightRefreshes?.has(id)
          // Stage-2 I-3: mobile parity with desktop CoverageRow.tsx — ScanPill
          // is the canonical scan affordance for unscanned rows (D-13-08).
          // ScanPill and the legacy refresh button are mutually exclusive to
          // avoid the double-dispatch surface I-4 fixed on desktop.
          const showScanPill =
            gitnexusInstalled &&
            (row.gitNexus.state === 'missing' || row.gitNexus.state === 'not-applicable')
          const understandViewerUrl = understandViewerUrls?.[id]
          return (
            <article
              key={id}
              role="listitem"
              className="rounded-lg border border-border-subtle bg-card-bg p-4 flex flex-col gap-3"
            >
              <header className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-text-primary truncate">
                  {row.repo}
                </h3>
                <OverrideChip
                  count={row.overrideCount}
                  overrides={row.overrides}
                  repoName={row.repo}
                />
              </header>

              <div
                className="grid grid-cols-2 gap-3"
                role="list"
                aria-label={`Coverage states for ${row.repo}`}
              >
                {COLUMN_KEYS.map((col) => (
                  <div
                    key={col}
                    role="listitem"
                    className="flex flex-col gap-1"
                  >
                    <span
                      title={coverageColumnTooltips[col]}
                      className="text-xs uppercase tracking-wide text-text-tertiary"
                    >
                      {COLUMN_LABELS[col]}
                    </span>
                    <CoverageCell
                      column={col}
                      state={row[col]}
                      repoName={row.repo}
                      drift={null}
                    />
                  </div>
                ))}
              </div>

              {/* Phase 14 D-14-06/10: understand cell in mobile card.
                  Back-compat: row.understand undefined on pre-Phase-14 daemons → em-dash. */}
              <div className="flex flex-col gap-1">
                <span
                  title={coverageColumnTooltips.understand}
                  className="text-xs uppercase tracking-wide text-text-tertiary"
                >
                  Understand
                </span>
                {row.understand && (row.understand.state === 'fresh' || row.understand.state === 'stale' || row.understand.state === 'missing') ? (
                  <UnderstandCopyPill
                    family={row.family}
                    repo={row.repo}
                    viewerUrl={understandViewerUrl}
                    state={row.understand.state}
                  />
                ) : (
                  <span className="text-text-tertiary text-xs">—</span>
                )}
              </div>

              <div className="flex justify-end">
                {showScanPill ? (
                  <ScanPill
                    scope="repo"
                    target={`${row.family}/${row.repo}`}
                    canScan={gitnexusCanScan}
                    installed={gitnexusInstalled}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onRefresh?.('gitnexus-analyze', {
                        family: row.family,
                        repo: row.repo,
                      })
                    }}
                    disabled={isInFlight}
                    {...(isInFlight ? { 'aria-busy': true } : {})}
                    aria-label={`Refresh GitNexus index for ${row.repo}`}
                    className="min-w-[44px] min-h-[44px] p-[15px] rounded-md bg-card-bg border border-border-subtle text-text-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                  >
                    {isInFlight ? (
                      <Loader2
                        size={14}
                        aria-hidden="true"
                        className="animate-spin"
                      />
                    ) : (
                      <RefreshCw size={14} aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
