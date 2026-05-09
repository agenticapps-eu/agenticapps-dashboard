/**
 * CommitmentBlock — DISC-01 panel.
 *
 * Renders the most recent `## Workflow commitment` block from the project's
 * skill-observations log, verbatim in a <pre> block. Source filename shown below.
 *
 * Threat model T-04-05-01: commitment markdown rendered via React text interpolation
 * inside a <pre> element. React auto-escapes `<`, `>`, `&` — no XSS surface.
 *
 * States:
 *   1. schema_drift error → InlineDrift (simplified — no full ZodIssue array available)
 *   2. Other error → PanelContainer unreachable=true
 *   3. isLoading / no data → 'Loading...'
 *   4. markdown null → empty-state copy (verbatim from UI-SPEC Copywriting Contract)
 *   5. markdown present → <pre> + Source line
 *
 * Wave 3 (Plan 05.1-04): repaletted from legacy [--*] aliases to Tailwind-4 namespaced tokens.
 */
import React from 'react'

import { useCommitment } from '../../lib/projectQueries.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export interface CommitmentBlockProps {
  projectId: string
}

export function CommitmentBlock({ projectId }: CommitmentBlockProps): React.JSX.Element {
  const query = useCommitment(projectId)

  if (query.error) {
    const msg = query.error.message
    if (msg.startsWith('schema_drift:')) {
      return (
        <InlineDrift
          panelId="commitment"
          title="Commitment"
          path={msg.slice('schema_drift:'.length)}
          onRetry={() => void query.refetch()}
        />
      )
    }
    return (
      <PanelContainer panelId="commitment" title="Commitment" unreachable>
        {null}
      </PanelContainer>
    )
  }

  if (query.isLoading || !query.data) {
    return (
      <PanelContainer panelId="commitment" title="Commitment">
        <p className="text-sm text-text-secondary">Loading...</p>
      </PanelContainer>
    )
  }

  const { markdown, sourceFile } = query.data

  if (markdown === null) {
    return (
      <PanelContainer panelId="commitment" title="Commitment">
        <p className="text-base leading-relaxed text-text-secondary">
          No commitment block found. The latest session may not have emitted one yet.
        </p>
      </PanelContainer>
    )
  }

  return (
    <PanelContainer panelId="commitment" title="Commitment">
      <pre className="whitespace-pre-wrap rounded bg-card-bg-hover p-4 font-mono text-sm leading-relaxed text-text-primary">
        {markdown}
      </pre>
      {sourceFile !== null && (
        <p className="font-mono text-xs text-text-tertiary">Source: {sourceFile}</p>
      )}
    </PanelContainer>
  )
}
