/**
 * ObservabilityHealth — HEALTH-03 panel.
 *
 * Renders multi-signal observability detection for 3 tools: Sentry, Spotlight, sentry-cli.
 * Each tool shows "detected via {evidence + evidence}" or "not detected" italic.
 * D-5-17: ANY-OR signal set per tool; panel surfaces which signals matched.
 *
 * States:
 *   1. schema_drift error → InlineDrift
 *   2. isLoading → 'Loading...'
 *   3. Other error / no data → PanelContainer unreachable=true
 *   4. All 3 tools not-detected → empty-state copy verbatim per UI-SPEC line 412
 *   5. Happy path → 3-row grid with provenance strings
 *
 * Threat mitigations:
 *   T-05-05-Cross-Project-Cache: useObservability(projectId) includes projectId in key.
 *   T-05-05-Schema-Drift: error.message.startsWith('schema_drift:') → InlineDrift.
 *
 * Wave 3 (Plan 05.1-04): repaletted from legacy [--*] aliases to Tailwind-4 namespaced tokens.
 */
import React from 'react'

import { useObservability } from '../../lib/projectQueries.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export type ObservabilityHealthProps = { projectId: string }

const PANEL_ID = 'observability-health'
const PANEL_TITLE = 'Observability'

export function ObservabilityHealth({ projectId }: ObservabilityHealthProps): React.JSX.Element {
  const query = useObservability(projectId)

  // Schema drift: surface inline
  if (query.error?.message?.startsWith('schema_drift:')) {
    const path = query.error.message.slice('schema_drift:'.length)
    return (
      <InlineDrift
        panelId={PANEL_ID}
        title={PANEL_TITLE}
        path={path}
        onRetry={() => void query.refetch()}
      />
    )
  }

  // Loading
  if (query.isLoading) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
        <p className="text-sm text-text-secondary">Loading...</p>
      </PanelContainer>
    )
  }

  // Non-drift error or missing data → unreachable
  if (query.error || !query.data) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE} unreachable>
        {null}
      </PanelContainer>
    )
  }

  const data = query.data

  // Tool rows: [label, toolState] pairs — order per UI-SPEC line 409
  const tools: Array<[string, typeof data.sentry]> = [
    ['Sentry', data.sentry],
    ['Spotlight', data.spotlight],
    ['sentry-cli', data.sentryCli],
  ]

  const allEmpty = tools.every(([, t]) => !t.detected)

  // Empty state: all tools not-detected — verbatim copy per UI-SPEC line 412
  // D-6.1-02: collapse by default in empty state; D-6.1-01: cap prose at 75ch
  if (allEmpty) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE} defaultCollapsed>
        <p className="max-w-[75ch] text-base leading-relaxed text-text-secondary">
          No observability tooling detected. (Configure to enable.)
        </p>
      </PanelContainer>
    )
  }

  // Happy path: 2-column grid per UI-SPEC line 277: grid-cols-[8rem_1fr] gap-3
  return (
    <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        {tools.map(([name, tool]) => (
          <React.Fragment key={name}>
            <span className="text-sm font-semibold text-text-primary">{name}</span>
            {tool.detected ? (
              <span>
                <span className="text-sm text-text-secondary">detected via </span>
                <span className="text-sm text-text-primary">
                  {tool.signals.map((s) => s.evidence).join(' + ')}
                </span>
              </span>
            ) : (
              <span className="text-sm italic text-text-secondary">not detected</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </PanelContainer>
  )
}
