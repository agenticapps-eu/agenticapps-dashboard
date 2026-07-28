import React from 'react'
import type { CompatibleCoverageRow } from '@agenticapps/dashboard-shared'

import { CoverageCell } from './CoverageCell.js'
import { OverrideChip } from './OverrideChip.js'
import { UnderstandCopyPill } from './UnderstandCopyPill.js'
import { useCoverageHistory } from '../../../lib/coverageHistoryQueries.js'
import { formatRelativeTime } from '../../../lib/relativeTime.js'
import { COVERAGE_COL_WIDTHS } from './coverageColumns.js'

export interface CoverageRowProps {
  row: CompatibleCoverageRow
  understandViewerUrl?: string
}

export function CoverageRow({
  row,
  understandViewerUrl,
}: CoverageRowProps): React.JSX.Element {
  const repoId = `${row.family}/${row.repo}`
  const history = useCoverageHistory(repoId)
  const cellDrifts = history.data?.cells ?? null

  return (
    <tr className="group hover:bg-card-bg-hover">
      <td
        className={`${COVERAGE_COL_WIDTHS.repo} py-2 pl-4 pr-3 text-sm font-medium text-text-primary whitespace-nowrap`}
      >
        <div className="flex items-center gap-2">
          <span>{row.repo}</span>
          <OverrideChip
            count={row.overrideCount}
            overrides={row.overrides}
            repoName={row.repo}
          />
        </div>
      </td>

      <td className={`${COVERAGE_COL_WIDTHS.claudeMd} px-2 py-2`}>
        <CoverageCell
          column="claudeMd"
          state={row.claudeMd}
          repoName={row.repo}
          drift={cellDrifts?.claudeMd ?? null}
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

      <td
        className={`${COVERAGE_COL_WIDTHS.understand} px-2 py-2`}
        title={
          row.understand?.lastAnalyzedAt
            ? `Last analyzed: ${formatRelativeTime(row.understand.lastAnalyzedAt)}`
            : undefined
        }
      >
        {row.understand ? (
          <UnderstandCopyPill
            family={row.family}
            repo={row.repo}
            {...(understandViewerUrl !== undefined
              ? { viewerUrl: understandViewerUrl }
              : {})}
            state={row.understand.state}
          />
        ) : (
          <span className="text-xs text-text-tertiary">
            Unavailable from this daemon
          </span>
        )}
      </td>
    </tr>
  )
}
