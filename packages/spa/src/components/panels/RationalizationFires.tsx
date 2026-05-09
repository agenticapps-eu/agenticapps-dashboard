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
 *
 * Wave 3 (Plan 05.1-04): repaletted from legacy [--*] aliases to Tailwind-4 namespaced tokens.
 */
import React from 'react'

import { useDiscipline } from '../../lib/projectQueries.js'
import { CodeBlock } from '../CodeBlock.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export interface RationalizationFiresProps {
  projectId: string
}

/**
 * Placeholder install command (D-4-15 deferred — Phase 6 confirms canonical CLI invocation).
 */
const WORKFLOW_INSTALL_CMD = 'claude skill install agentic-apps-workflow'

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
        <p className="text-sm text-text-secondary">Loading...</p>
      </PanelContainer>
    )
  }

  const { rows, skillInstalled } = query.data.rationalization

  if (!skillInstalled) {
    return (
      <PanelContainer panelId="rationalization-fires" title="Rationalization Fires">
        <p className="text-sm text-text-primary">
          agentic-apps-workflow skill not installed in this project.
        </p>
        <CodeBlock command={WORKFLOW_INSTALL_CMD} copyLabel="Copy install command" />
      </PanelContainer>
    )
  }

  if (rows.length === 0) {
    return (
      <PanelContainer panelId="rationalization-fires" title="Rationalization Fires">
        <p className="text-base leading-relaxed text-text-secondary">
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
            <span className="text-sm text-text-primary">{r.label}</span>
            <span
              className={`font-mono text-sm ${r.fires > 0 ? 'text-text-primary' : 'text-text-secondary'}`}
            >
              {r.fires} {r.fires === 1 ? 'fire' : 'fires'}
            </span>
          </li>
        ))}
      </ul>
    </PanelContainer>
  )
}
