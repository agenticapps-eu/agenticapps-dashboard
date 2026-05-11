/**
 * PhaseProgress — PHASE-01 panel.
 *
 * Renders the file-by-file checklist for the current phase directory.
 * Present files show CheckCircle2 + filename + relative mtime.
 * Missing files show Minus + filename in text-muted (no mtime).
 *
 * Data source: usePhaseProgress(projectId) — reads .files, .phase, .paddedPhase.
 *
 * Threat model T-04-06-01/02: filenames are React text children, auto-escaped.
 * T-04-06-04: no virtualisation — daemon-side bounded to < 30 files.
 *
 * Wave 3 (Plan 05.1-04): repaletted from legacy [--*] aliases to Tailwind-4 namespaced tokens.
 */
import { CheckCircle2, Minus } from 'lucide-react'
import React from 'react'

import { usePhaseProgress } from '../../lib/projectQueries.js'
import { formatRelativeTime } from '../../lib/relativeTime.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export interface PhaseProgressProps {
  projectId: string
}

export function PhaseProgress({ projectId }: PhaseProgressProps): React.JSX.Element {
  const query = usePhaseProgress(projectId)

  if (query.error) {
    const msg = query.error.message
    if (msg.startsWith('schema_drift:')) {
      return (
        <InlineDrift
          panelId="phase-progress"
          title="Phase Progress"
          path={msg.slice('schema_drift:'.length)}
          onRetry={() => void query.refetch()}
        />
      )
    }
    return (
      <PanelContainer panelId="phase-progress" title="Phase Progress" unreachable>
        {null}
      </PanelContainer>
    )
  }

  if (query.isLoading || !query.data) {
    return (
      <PanelContainer panelId="phase-progress" title="Phase Progress">
        <p className="text-sm text-text-secondary">Loading...</p>
      </PanelContainer>
    )
  }

  const { phase, paddedPhase, files } = query.data

  if (phase === null && files.length === 0) {
    return (
      <PanelContainer panelId="phase-progress" title="Phase Progress">
        <p className="text-base leading-relaxed text-text-secondary">
          No phase work yet. Run /gsd-discuss-phase or /gsd-plan-phase to start.
        </p>
      </PanelContainer>
    )
  }

  return (
    <PanelContainer panelId="phase-progress" title="Phase Progress">
      {phase && (
        <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">
          Phase {paddedPhase ?? '??'} — {phase}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {files.map((f) => (
          <li key={f.name} className="flex items-baseline gap-3">
            {f.present ? (
              <CheckCircle2 size={14} aria-hidden="true" className="text-status-success" />
            ) : (
              <Minus size={14} aria-hidden="true" className="text-text-tertiary" />
            )}
            <code
              className={`font-mono text-sm ${f.present ? 'text-text-primary' : 'text-text-secondary'}`}
            >
              {f.name}
            </code>
            {f.present && f.mtimeIso && (
              <time dateTime={f.mtimeIso} className="font-mono text-xs text-text-secondary">
                {formatRelativeTime(f.mtimeIso)}
              </time>
            )}
          </li>
        ))}
      </ul>
    </PanelContainer>
  )
}
