/**
 * ReviewStatus — PHASE-03 panel.
 *
 * Renders Stage 1 / Stage 2 review status with 4-bucket severity glyphs.
 * Data source: usePhaseProgress(projectId) — reads .review.
 *
 * Severity glyph contract (UI-SPEC + D-4-16):
 *   critical → 🔴, high → 🟠, medium → 🟡, low → ⚪
 *
 * Glyphs are aria-hidden; the parent element carries aria-label for screen readers.
 */
import React from 'react'

import type { ReviewFindingCounts, ReviewStatusPayload } from '@agenticapps/dashboard-shared'

import { usePhaseProgress } from '../../lib/projectQueries.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export interface ReviewStatusProps {
  projectId: string
}

const SEVERITY_GLYPH: Record<keyof ReviewFindingCounts, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '⚪',
}

export function ReviewStatus({ projectId }: ReviewStatusProps): React.JSX.Element {
  const query = usePhaseProgress(projectId)

  if (query.error) {
    const msg = query.error.message
    if (msg.startsWith('schema_drift:')) {
      return (
        <InlineDrift
          panelId="review-status"
          title="Review Status"
          path={msg.slice('schema_drift:'.length)}
          onRetry={() => void query.refetch()}
        />
      )
    }
    return (
      <PanelContainer panelId="review-status" title="Review Status" unreachable>
        {null}
      </PanelContainer>
    )
  }

  if (query.isLoading || !query.data) {
    return (
      <PanelContainer panelId="review-status" title="Review Status">
        <p className="text-sm text-[--text-muted]">Loading...</p>
      </PanelContainer>
    )
  }

  const { stage1, stage2 } = query.data.review

  if (stage1 === null && stage2 === null) {
    return (
      <PanelContainer panelId="review-status" title="Review Status">
        <p className="text-base leading-relaxed text-[--text-muted]">
          No review run yet — try /review or /gsd-code-review.
        </p>
      </PanelContainer>
    )
  }

  return (
    <PanelContainer panelId="review-status" title="Review Status">
      <StageRow label="Stage 1" stage={stage1} />
      <StageRow label="Stage 2" stage={stage2} />
    </PanelContainer>
  )
}

function StageRow({
  label,
  stage,
}: {
  label: string
  stage: ReviewStatusPayload['stage1']
}): React.JSX.Element {
  if (stage === null) {
    return (
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-semibold text-[--text]">{label}</span>
        <span className="text-sm text-[--text-muted]">not run</span>
      </div>
    )
  }

  const f = stage.findings
  const ariaLabel = `${label} findings: ${f.critical} critical, ${f.high} high, ${f.medium} medium, ${f.low} low`

  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <span className="text-sm font-semibold text-[--text]">{label}</span>
      <span className="text-sm text-[--text-muted]">present</span>
      <span aria-label={ariaLabel} className="inline-flex items-baseline gap-2 font-mono text-sm">
        {(['critical', 'high', 'medium', 'low'] as const).map((sev) => (
          <span key={sev} className="inline-flex items-baseline gap-1">
            <span aria-hidden="true">{SEVERITY_GLYPH[sev]}</span>
            <span className="text-[--text]">{f[sev]}</span>
          </span>
        ))}
      </span>
    </div>
  )
}
