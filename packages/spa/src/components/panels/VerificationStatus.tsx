/**
 * VerificationStatus — PHASE-05 panel.
 *
 * Renders the must_haves count vs evidence count and per-item rows.
 * Data source: usePhaseProgress(projectId) — reads .verification.
 *
 * When all must-haves are evidenced, the summary line turns green (text-[--success]).
 */
import { CheckCircle2, Minus } from 'lucide-react'
import React from 'react'

import { usePhaseProgress } from '../../lib/projectQueries.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export interface VerificationStatusProps {
  projectId: string
}

export function VerificationStatus({ projectId }: VerificationStatusProps): React.JSX.Element {
  const query = usePhaseProgress(projectId)

  if (query.error) {
    const msg = query.error.message
    if (msg.startsWith('schema_drift:')) {
      return (
        <InlineDrift
          panelId="verification-status"
          title="Verification Status"
          path={msg.slice('schema_drift:'.length)}
          onRetry={() => void query.refetch()}
        />
      )
    }
    return (
      <PanelContainer panelId="verification-status" title="Verification Status" unreachable>
        {null}
      </PanelContainer>
    )
  }

  if (query.isLoading || !query.data) {
    return (
      <PanelContainer panelId="verification-status" title="Verification Status">
        <p className="text-sm text-[--text-muted]">Loading...</p>
      </PanelContainer>
    )
  }

  const { mustHavesTotal, mustHavesEvidenced, items } = query.data.verification

  if (mustHavesTotal === 0) {
    return (
      <PanelContainer panelId="verification-status" title="Verification Status">
        <p className="text-base leading-relaxed text-[--text-muted]">
          No verification run yet — try /gsd-verify-work.
        </p>
      </PanelContainer>
    )
  }

  const allEvidenced = mustHavesEvidenced === mustHavesTotal
  const summaryClass = allEvidenced
    ? 'text-sm font-semibold text-[--success]'
    : 'text-sm text-[--text]'

  return (
    <PanelContainer panelId="verification-status" title="Verification Status">
      <p className={summaryClass}>
        {mustHavesEvidenced} / {mustHavesTotal} must-haves evidenced
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={`${item.text}-${i}`} className="flex items-baseline gap-2">
            {item.evidenced ? (
              <CheckCircle2 size={14} aria-hidden="true" className="text-[--success]" />
            ) : (
              <Minus size={14} aria-hidden="true" className="text-[--text-subtle]" />
            )}
            <span className={`text-sm ${item.evidenced ? 'text-[--text]' : 'text-[--text-muted]'}`}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </PanelContainer>
  )
}
