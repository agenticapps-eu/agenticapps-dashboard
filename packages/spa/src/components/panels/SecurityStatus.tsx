/**
 * SecurityStatus — PHASE-04 panel.
 *
 * Renders the /cso audit content + Database Sentinel content from the daemon.
 * Data source: useSecurity(projectId) — separate route per D-4-01 to keep the
 * audit content cache key independent of the bulkier phase-progress payload.
 *
 * Threat model T-04-06-01: cso/dbSentinel content rendered in <pre> with React
 * text interpolation — HTML chars are auto-escaped. No XSS surface.
 *
 * Content is clamped to max-h-32 (128px) per UI-SPEC to prevent SecurityStatus
 * dominating the column when CSO reports are verbose.
 *
 * Wave 3 (Plan 05.1-04): repaletted from legacy [--*] aliases to Tailwind-4 namespaced tokens.
 */
import React from 'react'

import { useSecurity } from '../../lib/projectQueries.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export interface SecurityStatusProps {
  projectId: string
}

export function SecurityStatus({ projectId }: SecurityStatusProps): React.JSX.Element {
  const query = useSecurity(projectId)

  if (query.error) {
    const msg = query.error.message
    if (msg.startsWith('schema_drift:')) {
      return (
        <InlineDrift
          panelId="security-status"
          title="Security Status"
          path={msg.slice('schema_drift:'.length)}
          onRetry={() => void query.refetch()}
        />
      )
    }
    return (
      <PanelContainer panelId="security-status" title="Security Status" unreachable>
        {null}
      </PanelContainer>
    )
  }

  if (query.isLoading || !query.data) {
    return (
      <PanelContainer panelId="security-status" title="Security Status">
        <p className="text-sm text-text-secondary">Loading...</p>
      </PanelContainer>
    )
  }

  const { cso, dbSentinel } = query.data

  if (cso === null && dbSentinel === null) {
    return (
      <PanelContainer panelId="security-status" title="Security Status">
        <p className="text-base leading-relaxed text-text-secondary">
          No /cso audit yet for this phase.
        </p>
      </PanelContainer>
    )
  }

  return (
    <PanelContainer panelId="security-status" title="Security Status">
      <section className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-text-primary">
          /cso audit{cso ? ` (${cso.fileName})` : ''}
        </h3>
        {cso ? (
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-card-bg-hover p-3 font-mono text-xs leading-relaxed text-text-secondary">
            {cso.content}
          </pre>
        ) : (
          <p className="text-sm text-text-secondary">not detected</p>
        )}
      </section>
      <section className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-text-primary">Database Sentinel</h3>
        {dbSentinel ? (
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-card-bg-hover p-3 font-mono text-xs leading-relaxed text-text-secondary">
            {dbSentinel.content}
          </pre>
        ) : (
          <p className="text-sm text-text-secondary">not detected</p>
        )}
      </section>
    </PanelContainer>
  )
}
