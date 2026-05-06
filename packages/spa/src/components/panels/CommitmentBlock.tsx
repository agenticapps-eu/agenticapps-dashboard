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
 */
import { AlertTriangle } from 'lucide-react'
import React from 'react'

import { useCommitment } from '../../lib/projectQueries.js'

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
        <p className="text-sm text-[--text-muted]">Loading...</p>
      </PanelContainer>
    )
  }

  const { markdown, sourceFile } = query.data

  if (markdown === null) {
    return (
      <PanelContainer panelId="commitment" title="Commitment">
        <p className="text-base leading-relaxed text-[--text-muted]">
          No commitment block found. The latest session may not have emitted one yet.
        </p>
      </PanelContainer>
    )
  }

  return (
    <PanelContainer panelId="commitment" title="Commitment">
      <pre className="whitespace-pre-wrap rounded bg-[--surface-elevated] p-4 font-mono text-sm leading-relaxed text-[--text]">
        {markdown}
      </pre>
      {sourceFile !== null && (
        <p className="font-mono text-xs text-[--text-subtle]">Source: {sourceFile}</p>
      )}
    </PanelContainer>
  )
}

/**
 * InlineDrift — lightweight drift surface for panels that only have the drift path,
 * not the full ZodIssue array. Plans 05/06 each co-locate this helper.
 * Phase 6 polish todo: extract to a shared file (currently 3 copies in Plan 05 alone).
 */
function InlineDrift({
  panelId,
  title,
  path,
  onRetry,
}: {
  panelId: string
  title: string
  path: string
  onRetry: () => void
}): React.JSX.Element {
  return (
    <PanelContainer panelId={panelId} title={`Schema drift — ${title}`}>
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 text-[--danger]" />
        <div>
          <p className="text-[--text]">
            The agent and dashboard disagree on the response shape.
          </p>
          <p className="mt-1 font-mono text-xs text-[--text-muted]">field: {path}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded border border-[--border-strong] bg-[--surface-elevated] px-3 py-1 text-xs font-semibold hover:bg-[--border] focus:outline-none focus-visible:ring-2 focus-visible:ring-[--ring]"
          >
            Retry
          </button>
        </div>
      </div>
    </PanelContainer>
  )
}
