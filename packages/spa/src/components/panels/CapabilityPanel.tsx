/**
 * CapabilityPanel — project-dashboard › Capability Panel.
 *
 * What the project currently promises, as distinct from what work is in
 * flight. That distinction is the whole reason this is a panel of its own
 * rather than a section inside Change Progress: one is standing truth, the
 * other is activity, and reading them as one surface is what made the old
 * phase column misleading.
 *
 * When the project has no `openspec/` tree the panel renders nothing at all.
 * Change Progress already says "Not on OpenSpec" directly above it, and saying
 * it twice in one column is noise rather than clarity.
 */
import { Library } from 'lucide-react'
import React from 'react'

import { useOpenspec } from '../../lib/projectQueries.js'
import { EmptyState } from '../ui/EmptyState.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export interface CapabilityPanelProps {
  projectId: string
}

const TITLE = 'Capabilities'

export function CapabilityPanel({ projectId }: CapabilityPanelProps): React.JSX.Element | null {
  const query = useOpenspec(projectId)

  if (query.error) {
    const msg = query.error.message
    if (msg.startsWith('schema_drift:')) {
      return (
        <InlineDrift
          panelId="capabilities"
          title={TITLE}
          path={msg.slice('schema_drift:'.length)}
          onRetry={() => void query.refetch()}
        />
      )
    }
    // Said once, by Change Progress, immediately above — the same reasoning
    // this panel already applies to `!present`. Two identical Retry buttons
    // 24px apart invite the reader to wonder whether they differ.
    return null
  }

  if (query.isLoading || !query.data) {
    return (
      <PanelContainer panelId="capabilities" title={TITLE}>
        <p className="text-sm text-text-secondary">Loading…</p>
      </PanelContainer>
    )
  }

  const { present, capabilities } = query.data

  // Said once, by Change Progress, immediately above.
  if (!present) return null

  if (capabilities.length === 0) {
    return (
      <PanelContainer panelId="capabilities" title={TITLE}>
        <EmptyState
          icon={<Library size={20} className="text-text-tertiary" />}
          title="No capabilities declared"
          body="This project has an openspec/ tree but no capability specifications yet. The first archived change writes one."
        />
      </PanelContainer>
    )
  }

  return (
    <PanelContainer panelId="capabilities" title={TITLE}>
      {/*
       * The unit is shown, not just announced. It previously existed only as
       * sr-only text, which left a sighted reader with a bare "9" and no way to
       * tell whether it counted requirements, changes or files — and gave the
       * screen-reader user strictly better information, the inverse of the
       * usual failure. A column header labels all twelve rows at once.
       */}
      <div
        data-testid="capability-header"
        className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2 text-xs font-medium text-text-tertiary"
      >
        <span>Capability</span>
        <span>Requirements</span>
      </div>
      <ul className="divide-y divide-border-subtle">
        {capabilities.map((c) => (
          <li
            key={c.id}
            data-testid={`capability-${c.id}`}
            className="flex items-baseline justify-between gap-3 py-2"
          >
            <span title={c.id} className="min-w-0 truncate font-mono text-sm text-text-primary">
              {c.id}
            </span>
            <span className="shrink-0 text-sm tabular-nums text-text-secondary">
              {c.requirementCount}
            </span>
          </li>
        ))}
      </ul>
    </PanelContainer>
  )
}
