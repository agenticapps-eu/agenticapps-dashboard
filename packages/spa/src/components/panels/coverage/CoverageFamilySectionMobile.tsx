import React from 'react'
import type {
  CompatibleCoverageRow,
  CoverageFamily,
} from '@agenticapps/dashboard-shared'

import { CoverageCell } from './CoverageCell.js'
import { OverrideChip } from './OverrideChip.js'
import { UnderstandCopyPill } from './UnderstandCopyPill.js'
import { coverageColumnTooltips } from './coverageColumnTooltips.js'

export interface CoverageFamilySectionMobileProps {
  family: CoverageFamily
  rows: ReadonlyArray<CompatibleCoverageRow>
  understandViewerUrls?: Readonly<Record<string, string>>
}

export function CoverageFamilySectionMobile({
  family,
  rows,
  understandViewerUrls,
}: CoverageFamilySectionMobileProps): React.JSX.Element {
  return (
    <section
      aria-labelledby={`mobile-family-${family}`}
      className="rounded-card bg-card-bg shadow-card"
    >
      <header className="bg-card-bg border-b border-border-subtle px-4 py-3 rounded-t-card">
        <span
          id={`mobile-family-${family}`}
          className="flex items-center gap-2 text-text-primary"
        >
          <span className="font-semibold">{family}</span>
          <span className="text-text-tertiary text-sm">· {rows.length} repos</span>
        </span>
      </header>

      <div className="flex flex-col gap-3 p-3" role="list" aria-label={`${family} repos`}>
        {rows.map((row) => {
          const id = `${row.family}/${row.repo}`
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

              <div className="grid grid-cols-2 gap-3" role="list" aria-label={`Coverage states for ${row.repo}`}>
                <div role="listitem" className="flex flex-col gap-1">
                  <span
                    title={coverageColumnTooltips.claudeMd}
                    className="text-xs uppercase tracking-wide text-text-tertiary"
                  >
                    CLAUDE.md
                  </span>
                  <CoverageCell
                    column="claudeMd"
                    state={row.claudeMd}
                    repoName={row.repo}
                    drift={null}
                  />
                </div>
                <div role="listitem" className="flex flex-col gap-1">
                  <span
                    title={coverageColumnTooltips.workflowVersion}
                    className="text-xs uppercase tracking-wide text-text-tertiary"
                  >
                    Workflow
                  </span>
                  <CoverageCell
                    column="workflowVersion"
                    state={row.workflowVersion}
                    repoName={row.repo}
                    drift={null}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span
                  title={coverageColumnTooltips.understand}
                  className="text-xs uppercase tracking-wide text-text-tertiary"
                >
                  Understand
                </span>
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
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
