/**
 * RationalizationFires — DISC-03 panel.
 *
 * Renders a table of rationalization rows from the agenticapps-workflow SKILL.md,
 * showing each row's fire count. Zero fires are NOT hidden — zero is a positive
 * signal (D-4-14: "Show table with `0 fires` per row").
 *
 * Threat model T-04-05-03: rationalization labels rendered via React text children — auto-escaped.
 *
 * States:
 *   1. schema_drift error → InlineDrift
 *   2. Other error → PanelContainer unreachable=true
 *   3. isLoading / no data → 'Loading...'
 *   4. skillInstalled false → install-hint with placeholder command (D-4-15)
 *   5. skillInstalled true, rows empty → empty-state copy
 *   6. skillInstalled true, rows present → row list (zero fires shown)
 *
 * Note on install command: UI-SPEC defers the exact canonical command to Phase 6 polish
 * (D-4-15 deferred note for agenticapps-workflow skill specifically). v1 ships this
 * placeholder; Phase 6 confirms the canonical command.
 */
import { AlertTriangle } from 'lucide-react'
import React from 'react'

import { useDiscipline } from '../../lib/projectQueries.js'
import { CodeBlock } from '../CodeBlock.js'

import { PanelContainer } from './PanelContainer.js'

export interface RationalizationFiresProps {
  projectId: string
}

/**
 * Placeholder install command (D-4-15 deferred — Phase 6 confirms canonical CLI invocation).
 */
const WORKFLOW_INSTALL_CMD = 'claude skill install agenticapps-workflow'

export function RationalizationFires({ projectId }: RationalizationFiresProps): React.JSX.Element {
  const query = useDiscipline(projectId)

  if (query.error) {
    const msg = query.error.message
    if (msg.startsWith('schema_drift:')) {
      return (
        <InlineDrift
          panelId="rationalization-fires"
          title="Rationalization Fires"
          path={msg.slice('schema_drift:'.length)}
          onRetry={() => void query.refetch()}
        />
      )
    }
    return (
      <PanelContainer panelId="rationalization-fires" title="Rationalization Fires" unreachable>
        {null}
      </PanelContainer>
    )
  }

  if (query.isLoading || !query.data) {
    return (
      <PanelContainer panelId="rationalization-fires" title="Rationalization Fires">
        <p className="text-sm text-[--text-muted]">Loading...</p>
      </PanelContainer>
    )
  }

  const { rows, skillInstalled } = query.data.rationalization

  if (!skillInstalled) {
    return (
      <PanelContainer panelId="rationalization-fires" title="Rationalization Fires">
        <p className="text-sm text-[--text]">
          agentic-apps-workflow skill not installed in this project.
        </p>
        <CodeBlock command={WORKFLOW_INSTALL_CMD} copyLabel="Copy install command" />
      </PanelContainer>
    )
  }

  if (rows.length === 0) {
    return (
      <PanelContainer panelId="rationalization-fires" title="Rationalization Fires">
        <p className="text-base leading-relaxed text-[--text-muted]">
          No rationalization rows found in SKILL.md.
        </p>
      </PanelContainer>
    )
  }

  return (
    <PanelContainer panelId="rationalization-fires" title="Rationalization Fires">
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={`${r.label}-${i}`} className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-[--text]">{r.label}</span>
            <span
              className={`font-mono text-sm ${r.fires > 0 ? 'text-[--text]' : 'text-[--text-muted]'}`}
            >
              {r.fires} {r.fires === 1 ? 'fire' : 'fires'}
            </span>
          </li>
        ))}
      </ul>
    </PanelContainer>
  )
}

/**
 * InlineDrift — duplicate of CommitmentBlock.InlineDrift.
 * Phase 6 polish todo: extract to a shared file (currently 3 copies in Plan 05).
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
