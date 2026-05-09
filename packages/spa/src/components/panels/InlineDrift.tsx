/**
 * InlineDrift — shared inline schema-drift surface for all 8 Phase 4 panels.
 *
 * Simplified vs SchemaDriftState (which surfaces the full Zod issue tree)
 * because the query hook only exposes `Error('schema_drift:<path>')` — the full
 * issue array stays in console.error from parseOrDrift's debug log.
 *
 * Per-panel inline schema-drift state. Used by all 8 Phase 4 panels.
 *
 * Extracted from CommitmentBlock / HookFirings / RationalizationFires in Plan 06
 * (Plan 05 kept 3 copies deliberately until Plan 06 landed).
 *
 * Wave 3 (Plan 05.1-04): repaletted from legacy [--*] aliases to Tailwind-4 namespaced tokens.
 */
import { AlertTriangle } from 'lucide-react'
import React from 'react'

import { PanelContainer } from './PanelContainer.js'

export interface InlineDriftProps {
  panelId: string
  title: string
  path: string
  onRetry: () => void
}

export function InlineDrift({ panelId, title, path, onRetry }: InlineDriftProps): React.JSX.Element {
  return (
    <PanelContainer panelId={panelId} title={`Schema drift — ${title}`}>
      <div className="flex items-start gap-2 text-sm">
        <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 text-status-error" />
        <div>
          <p className="text-text-primary">The agent and dashboard disagree on the response shape.</p>
          <p className="mt-1 font-mono text-xs text-text-secondary">field: {path}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 rounded border border-border-subtle bg-card-bg-hover px-3 py-1 text-xs font-semibold hover:bg-card-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Retry
          </button>
        </div>
      </div>
    </PanelContainer>
  )
}
