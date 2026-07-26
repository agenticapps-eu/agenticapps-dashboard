/**
 * ChangeProgress — project-dashboard › Change Progress Column.
 *
 * Renders the work in flight: every open change with its real task ratio and
 * the capabilities its spec deltas touch. It replaces the five phase-artifact
 * panels retired with the GSD reader.
 *
 * Four states are kept deliberately distinct, because the spec delta forbids
 * inferring any of them from any other:
 *
 *   present:false        → the project has no `openspec/` tree at all
 *   no open changes      → it has one, and nothing is in flight
 *   !hasTaskArtifact     → the change has no task list; NOT zero of zero
 *   no affectedCapabilities → the change has no spec delta yet; still listed
 *
 * The no-task-artifact case renders no progress bar. A bar at 0% is visually
 * identical to a genuine 0/0, which would re-collapse the distinction the
 * daemon goes out of its way to preserve.
 */
import { FileQuestion, Inbox } from 'lucide-react'
import React from 'react'

import { useOpenspec } from '../../lib/projectQueries.js'
import { EmptyState } from '../ui/EmptyState.js'
import { Pill } from '../ui/Pill.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export interface ChangeProgressProps {
  projectId: string
}

const TITLE = 'Change Progress'

interface ChangeRowProps {
  change: {
    name: string
    completedTasks: number
    totalTasks: number
    hasTaskArtifact: boolean
    affectedCapabilities: string[]
  }
}

function ChangeRow({ change }: ChangeRowProps): React.JSX.Element {
  const { name, completedTasks, totalTasks, hasTaskArtifact, affectedCapabilities } = change
  const pct = hasTaskArtifact && totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
  const complete = hasTaskArtifact && totalTasks > 0 && completedTasks === totalTasks

  return (
    <li data-testid={`change-${name}`} className="flex flex-col gap-2 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-sm text-text-primary">{name}</span>
        {hasTaskArtifact ? (
          <span className="shrink-0 text-sm tabular-nums text-text-secondary">
            {completedTasks}/{totalTasks}
          </span>
        ) : (
          <span className="shrink-0 text-xs text-text-tertiary">no task list</span>
        )}
      </div>

      {hasTaskArtifact && totalTasks > 0 ? (
        <div
          role="progressbar"
          aria-label={`${name} task progress`}
          aria-valuenow={completedTasks}
          aria-valuemin={0}
          aria-valuemax={totalTasks}
          className="h-1 w-full overflow-hidden rounded-full bg-card-bg-hover"
        >
          <div
            className={`h-full rounded-full ${complete ? 'bg-status-success' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      {affectedCapabilities.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {affectedCapabilities.map((c) => (
            <Pill key={c} variant="accent">
              {c}
            </Pill>
          ))}
        </div>
      ) : (
        <span className="text-xs text-text-tertiary">no spec delta yet</span>
      )}
    </li>
  )
}

export function ChangeProgress({ projectId }: ChangeProgressProps): React.JSX.Element {
  const query = useOpenspec(projectId)

  if (query.error) {
    const msg = query.error.message
    if (msg.startsWith('schema_drift:')) {
      return (
        <InlineDrift
          panelId="change-progress"
          title={TITLE}
          path={msg.slice('schema_drift:'.length)}
          onRetry={() => void query.refetch()}
        />
      )
    }
    return (
      <PanelContainer panelId="change-progress" title={TITLE} unreachable>
        {null}
      </PanelContainer>
    )
  }

  if (query.isLoading || !query.data) {
    return (
      <PanelContainer panelId="change-progress" title={TITLE}>
        <p className="text-sm text-text-secondary">Loading...</p>
      </PanelContainer>
    )
  }

  const { present, openChanges } = query.data

  if (!present) {
    return (
      <PanelContainer panelId="change-progress" title={TITLE}>
        <EmptyState
          icon={<FileQuestion size={20} className="text-text-tertiary" />}
          title="Not on OpenSpec"
          body="This project has no openspec/ directory, so there is no change history to read. Progress data appears once it adopts the OpenSpec layout."
        />
      </PanelContainer>
    )
  }

  if (openChanges.length === 0) {
    return (
      <PanelContainer panelId="change-progress" title={TITLE}>
        <EmptyState
          icon={<Inbox size={20} className="text-text-tertiary" />}
          title="No change in flight"
          body="Every proposed change has been archived. Open one to start the next piece of work."
        />
      </PanelContainer>
    )
  }

  return (
    <PanelContainer panelId="change-progress" title={TITLE}>
      <ul className="divide-y divide-border-subtle">
        {openChanges.map((c) => (
          <ChangeRow key={c.name} change={c} />
        ))}
      </ul>
    </PanelContainer>
  )
}
