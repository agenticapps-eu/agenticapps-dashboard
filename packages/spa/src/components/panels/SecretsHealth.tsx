/**
 * SecretsHealth — HEALTH-04 panel.
 *
 * Renders the .infisical.json file presence + validity state.
 * D-5-18: 3-state panel (present-valid / present-invalid / absent).
 *
 * PRIVACY INVARIANT (T-05-05-NoSecretRead-SPA):
 *   This panel NEVER renders data.workspaceId or data.defaultEnvironment.
 *   Only file presence + validity is surfaced. Even though the daemon returns
 *   these fields for schema completeness, the SPA intentionally ignores them.
 *
 * States:
 *   1. schema_drift error → InlineDrift
 *   2. isLoading → 'Loading...'
 *   3. Other error / no data → PanelContainer unreachable=true
 *   4. present-valid → CheckCircle2 icon + body + 'valid' pill
 *   5. present-invalid → AlertTriangle icon + body + 'invalid' pill
 *   6. absent → Minus icon + body + NO pill (quiet empty state)
 *
 * Icon colors per UI-SPEC §Color:
 *   present-valid: text-status-success
 *   present-invalid: text-status-error
 *   absent: text-text-tertiary
 *
 * Wave 3 (Plan 05.1-04): repaletted from legacy [--*] aliases to Tailwind-4 namespaced tokens.
 */
import React from 'react'
import { CheckCircle2, AlertTriangle, Minus } from 'lucide-react'

import { useSecrets } from '../../lib/projectQueries.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export type SecretsHealthProps = { projectId: string }

const PANEL_ID = 'secrets-health'
const PANEL_TITLE = 'Secrets'

export function SecretsHealth({ projectId }: SecretsHealthProps): React.JSX.Element {
  const query = useSecrets(projectId)

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

  const { state } = query.data
  // PRIVACY: intentionally destructure only `state` — workspaceId and defaultEnvironment
  // are never extracted or rendered (T-05-05-NoSecretRead-SPA).

  return (
    <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
      {state === 'present-valid' && (
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-status-success" aria-hidden="true" />
          <span className="text-sm text-text-primary">
            <code className="font-mono">.infisical.json</code> present and valid.
          </span>
          <span className="ml-auto inline-flex items-center rounded bg-card-bg-hover px-1.5 py-0.5 text-xs uppercase tracking-wide text-status-success">
            valid
          </span>
        </div>
      )}
      {state === 'present-invalid' && (
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-status-error" aria-hidden="true" />
          <span className="text-sm text-text-primary">
            <code className="font-mono">.infisical.json</code> found but not parseable.
          </span>
          <span className="ml-auto inline-flex items-center rounded bg-card-bg-hover px-1.5 py-0.5 text-xs uppercase tracking-wide text-status-error">
            invalid
          </span>
        </div>
      )}
      {state === 'absent' && (
        <div className="flex items-center gap-2">
          <Minus size={16} className="text-text-tertiary" aria-hidden="true" />
          <span className="text-sm text-text-secondary">
            No <code className="font-mono">.infisical.json</code> detected.
          </span>
        </div>
      )}
    </PanelContainer>
  )
}
