/**
 * LinearPanel — Phase 8 LINEAR-01/02/03 panel.
 *
 * Renders the daemon-aggregated Linear issues feed for a single project.
 * Issues are detected from branch names and recent commit messages (D-08-05).
 * 4-state guard block copied verbatim from ObservabilityHealth.tsx.
 *
 * States:
 *   1. schema_drift error → InlineDrift (INV-04 at the browser boundary)
 *   2. isLoading → 'Loading...'
 *   3. Other error / no data → PanelContainer unreachable=true
 *   4a. data.issues.length === 0 / not-configured → static configure-to-enable JSX literal
 *       (T-05-05-Static-Copy-Trust — copy is a literal, never daemon-supplied), defaultCollapsed
 *   4b. Happy path → up to 3 issue rows with identifier, title, stateName, assignee, link-out
 *
 * Stale handling:
 *   When data.stale === true, PanelContainer shows a "Stale" pill and a verbatim banner
 *   "Linear API unreachable — using cached data from {staleFrom}".
 *
 * Link-out (D-08-07):
 *   Each issue row includes an <a href={issue.url} target="_blank" rel="noopener noreferrer">
 *   with identifier as link text and the ExternalLink icon.
 *
 * LINEAR-02 clause (b) / D-08-06:
 *   This panel (and useLinearIssues) is the ONLY consumer of /linear/issues.
 *   The pre-existing IntegrationsHealth panel stays API-free — it uses useIntegrations only
 *   and must never import useLinearIssues or reference the /linear/issues route.
 *
 * Threat mitigations:
 *   T-08-24: configure copy is a JSX literal — never interpolated from query.data
 *   T-08-25: only non-secret issue metadata rendered; React auto-escapes
 *   T-08-26: all link-outs use rel="noopener noreferrer" target="_blank"
 *   T-08-27: apiFetch parseOrDrift → schema_drift guard → InlineDrift (INV-04)
 *   T-08-28: IntegrationsHealth.tsx stays API-free (no useLinearIssues, no /linear/issues)
 */
import { ExternalLink } from 'lucide-react'
import React from 'react'

import { useLinearIssues } from '../../lib/projectQueries.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export type LinearPanelProps = { projectId: string }

const PANEL_ID = 'linear-panel'
const PANEL_TITLE = 'Linear'

export function LinearPanel({ projectId }: LinearPanelProps): React.JSX.Element {
  const query = useLinearIssues(projectId)

  // 1. Schema drift: surface inline (copied verbatim from ObservabilityHealth.tsx)
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

  // 2. Loading (copied verbatim from ObservabilityHealth.tsx)
  if (query.isLoading) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
        <p className="text-sm text-text-secondary">Loading...</p>
      </PanelContainer>
    )
  }

  // 3. Non-drift error or missing data → unreachable (copied verbatim from ObservabilityHealth.tsx)
  if (query.error || !query.data) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE} unreachable>
        {null}
      </PanelContainer>
    )
  }

  const data = query.data

  // 4a. Not-configured / empty — STATIC JSX literal (T-05-05-Static-Copy-Trust)
  // D-6.1-02: collapse by default in empty/not-configured state
  if (data.issues.length === 0) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE} defaultCollapsed>
        <p className="max-w-[75ch] text-base leading-relaxed text-text-secondary">
          Set <code className="font-mono">LINEAR_API_KEY</code> to enable the Linear panel.{' '}
          <a href="/help" className="text-accent underline-offset-2 hover:underline">
            Learn more
          </a>
        </p>
      </PanelContainer>
    )
  }

  // 4b. Happy path: issue list with link-out
  return (
    <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE} stale={data.stale}>
      {data.stale && data.staleFrom && (
        <p className="text-sm text-status-warning">
          Linear API unreachable — using cached data from {data.staleFrom}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {data.issues.map((issue) => (
          <li key={issue.identifier} className="flex flex-col gap-1">
            <span className="text-sm text-text-primary">{issue.title}</span>
            <div className="flex items-center gap-3 text-xs text-text-secondary">
              <span>{issue.stateName}</span>
              <span>{issue.assigneeName ?? 'Unassigned'}</span>
              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-accent underline-offset-2 hover:underline"
              >
                {issue.identifier}
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          </li>
        ))}
      </ul>
    </PanelContainer>
  )
}
