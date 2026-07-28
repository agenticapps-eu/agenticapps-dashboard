import React, { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type {
  CompatibleCoverageRow,
  CoverageFamily,
  CoverageState,
} from '@agenticapps/dashboard-shared'

import { CoverageRow } from './CoverageRow.js'
import { CoverageFamilySectionMobile } from './CoverageFamilySectionMobile.js'
import { COVERAGE_COL_WIDTHS } from './coverageColumns.js'
import { coverageColumnTooltips } from './coverageColumnTooltips.js'
import { Tooltip } from '../../ui/Tooltip.js'
import { useViewportBreakpoint } from '../../../lib/useViewportBreakpoint.js'

export interface CoverageFamilySectionProps {
  family: CoverageFamily
  rows: ReadonlyArray<CompatibleCoverageRow>
  understandViewerUrls?: Readonly<Record<string, string>>
}

function storageKey(family: CoverageFamily): string {
  return `coverage:section-collapsed:${family}`
}

function worstState(row: CompatibleCoverageRow): CoverageState {
  const states = [row.claudeMd.state, row.workflowVersion.state]
  if (row.understand) states.push(row.understand.state)
  if (states.includes('missing')) return 'missing'
  if (states.includes('stale')) return 'stale'
  return 'fresh'
}

function computeCounts(rows: ReadonlyArray<CompatibleCoverageRow>) {
  let miss = 0
  let stale = 0
  let fresh = 0
  for (const row of rows) {
    const state = worstState(row)
    if (state === 'missing') miss += 1
    else if (state === 'stale') stale += 1
    else fresh += 1
  }
  return { miss, stale, fresh }
}

export function CoverageFamilySection({
  family,
  rows,
  understandViewerUrls,
}: CoverageFamilySectionProps): React.JSX.Element {
  const breakpoint = useViewportBreakpoint()
  const key = storageKey(family)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(key) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, String(collapsed))
    } catch {
      // Ignore unavailable storage.
    }
  }, [collapsed, key])

  if (breakpoint === 'xs' || breakpoint === 'sm') {
    return (
      <CoverageFamilySectionMobile
        family={family}
        rows={rows}
        {...(understandViewerUrls !== undefined ? { understandViewerUrls } : {})}
      />
    )
  }

  const { miss, stale, fresh } = computeCounts(rows)
  const bodyId = `family-${family}-body`

  return (
    <section className="rounded-card bg-card-bg shadow-card">
      <header className="sticky top-[calc(var(--ph-h)-1.5rem)] z-20 bg-card-bg border-b border-border-subtle px-4 py-3 rounded-t-card">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          onClick={() => setCollapsed((current) => !current)}
          className="flex items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
        >
          {collapsed ? (
            <ChevronRight size={14} aria-hidden="true" className="text-text-secondary" />
          ) : (
            <ChevronDown size={14} aria-hidden="true" className="text-text-secondary" />
          )}
          <span className="font-semibold text-text-primary">{family}</span>
          <span className="text-text-tertiary text-sm">· {rows.length} repos</span>
          <span className="text-sm text-status-error">✕ {miss}</span>
          <span className="text-sm text-status-warning">⚠ {stale}</span>
          <span className="text-sm text-status-success">✓ {fresh}</span>
        </button>
      </header>

      {!collapsed && (
        <div id={bodyId} role="region" aria-label={`${family} repos`}>
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className={COVERAGE_COL_WIDTHS.repo} />
              <col className={COVERAGE_COL_WIDTHS.claudeMd} />
              <col className={COVERAGE_COL_WIDTHS.workflow} />
              <col className={COVERAGE_COL_WIDTHS.understand} />
            </colgroup>
            <thead>
              <tr className="text-xs text-text-tertiary border-b border-border-subtle">
                <th scope="col" className="sticky top-[calc(var(--ph-h)+1.5625rem)] z-10 bg-card-bg py-2 pr-3 px-4 font-medium">Repo</th>
                <th scope="col" className="sticky top-[calc(var(--ph-h)+1.5625rem)] z-10 bg-card-bg px-2 py-2 font-medium"><Tooltip content={coverageColumnTooltips.claudeMd}>CLAUDE.md</Tooltip></th>
                <th scope="col" className="sticky top-[calc(var(--ph-h)+1.5625rem)] z-10 bg-card-bg px-2 py-2 font-medium"><Tooltip content={coverageColumnTooltips.workflowVersion}>Workflow</Tooltip></th>
                <th scope="col" className="sticky top-[calc(var(--ph-h)+1.5625rem)] z-10 bg-card-bg px-2 py-2 font-medium"><Tooltip content={coverageColumnTooltips.understand}>Understand</Tooltip></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => {
                const repoKey = `${row.family}/${row.repo}`
                return (
                  <CoverageRow
                    key={repoKey}
                    row={row}
                    {...(understandViewerUrls?.[repoKey] !== undefined
                      ? { understandViewerUrl: understandViewerUrls[repoKey] }
                      : {})}
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
