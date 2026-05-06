/**
 * HookFirings — DISC-02 + DISC-04 panel.
 *
 * Renders the last N hook firing events from the project's skill-observations log.
 * When meta-observer skill is not installed (DISC-04), shows an install-hint with
 * a copyable `claude skill install meta-observer` command.
 *
 * Threat model T-04-05-02: skill/hook fields rendered via React text children — auto-escaped.
 * Threat model T-04-05-06: key={`${e.ts}-${i}`} uses ts as primary discriminator (list is render-only).
 *
 * States:
 *   1. schema_drift error → InlineDrift
 *   2. Other error → PanelContainer unreachable=true
 *   3. isLoading / no data → 'Loading...'
 *   4. skillInstalled false → install-hint (DISC-04)
 *   5. skillInstalled true, entries empty → empty-state copy
 *   6. skillInstalled true, entries present → row list
 */
import { AlertTriangle } from 'lucide-react'
import React from 'react'

import { useObservations } from '../../lib/projectQueries.js'
import { formatRelativeTime } from '../../lib/relativeTime.js'
import { CodeBlock } from '../CodeBlock.js'

import { PanelContainer } from './PanelContainer.js'

export interface HookFiringsProps {
  projectId: string
}

/**
 * DISC-04 install command (placeholder pending Phase 6 copy confirmation per D-4-15).
 * Phase 6 polish: confirm canonical CLI invocation with meta-observer skill maintainer.
 */
const META_OBSERVER_INSTALL_CMD = 'claude skill install meta-observer'

export function HookFirings({ projectId }: HookFiringsProps): React.JSX.Element {
  const query = useObservations(projectId, 20)

  if (query.error) {
    const msg = query.error.message
    if (msg.startsWith('schema_drift:')) {
      return (
        <InlineDrift
          panelId="hook-firings"
          title="Hook Firings"
          path={msg.slice('schema_drift:'.length)}
          onRetry={() => void query.refetch()}
        />
      )
    }
    return (
      <PanelContainer panelId="hook-firings" title="Hook Firings" unreachable>
        {null}
      </PanelContainer>
    )
  }

  if (query.isLoading || !query.data) {
    return (
      <PanelContainer panelId="hook-firings" title="Hook Firings">
        <p className="text-sm text-[--text-muted]">Loading...</p>
      </PanelContainer>
    )
  }

  const { entries, skillInstalled } = query.data

  if (!skillInstalled) {
    return (
      <PanelContainer panelId="hook-firings" title="Hook Firings">
        <p className="text-sm text-[--text]">
          The meta-observer skill is not installed in this project.
        </p>
        <CodeBlock command={META_OBSERVER_INSTALL_CMD} copyLabel="Copy install command" />
      </PanelContainer>
    )
  }

  if (entries.length === 0) {
    return (
      <PanelContainer panelId="hook-firings" title="Hook Firings">
        <p className="text-base leading-relaxed text-[--text-muted]">
          No hook firings yet — try running /review or /cso.
        </p>
      </PanelContainer>
    )
  }

  return (
    <PanelContainer panelId="hook-firings" title="Hook Firings">
      <ol className="flex flex-col divide-y divide-[--border]">
        {entries.map((e, i) => (
          <li key={`${e.ts}-${i}`} className="flex items-baseline gap-3 py-2">
            <time
              dateTime={e.ts}
              className="font-mono text-xs tabular-nums text-[--text-muted]"
            >
              {formatRelativeTime(e.ts)}
            </time>
            <span className="text-sm font-semibold text-[--text]">{e.skill}</span>
            <span className="rounded bg-[--surface-elevated] px-1.5 py-0.5 text-xs uppercase tracking-wide text-[--text-muted]">
              {e.hook}
            </span>
          </li>
        ))}
      </ol>
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
