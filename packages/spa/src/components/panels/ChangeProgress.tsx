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
import { ChevronDown, ChevronRight, FileQuestion, Inbox } from 'lucide-react'
import React, { useState } from 'react'

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
        <span title={name} className="min-w-0 truncate font-mono text-sm text-text-primary">
          {name}
        </span>
        {hasTaskArtifact ? (
          <span className="shrink-0 text-sm tabular-nums text-text-secondary">
            {completedTasks}/{totalTasks}
            <span className="ml-1 text-xs text-text-tertiary">tasks</span>
          </span>
        ) : (
          <span className="shrink-0 text-xs text-text-tertiary">no task list</span>
        )}
      </div>

      {hasTaskArtifact && totalTasks > 0 && completedTasks > 0 ? (
        <div
          role="progressbar"
          aria-label={`${name} task progress`}
          aria-valuenow={completedTasks}
          aria-valuemin={0}
          aria-valuemax={totalTasks}
          aria-valuetext={`${completedTasks} of ${totalTasks} tasks complete`}
          className="h-1 w-full overflow-hidden rounded-full bg-border-subtle"
        >
          <div
            className={`h-full rounded-full ${complete ? 'bg-status-success' : 'bg-accent'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}

      {affectedCapabilities.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {affectedCapabilities.slice(0, MAX_PILLS).map((c) => (
            <Pill key={c} variant={isMoving(change) ? 'accent' : 'neutral'}>
              {c}
            </Pill>
          ))}
          {affectedCapabilities.length > MAX_PILLS ? (
            <Pill>+{affectedCapabilities.length - MAX_PILLS} more</Pill>
          ) : null}
        </div>
      ) : (
        <span className="text-xs text-text-tertiary">no spec delta yet</span>
      )}
    </li>
  )
}

/**
 * A change is "in flight" once any task is done. Everything else — untouched
 * task lists and changes with no task artifact at all — is proposed work.
 * Splitting on real progress rather than on artifact presence is what lets the
 * panel answer "what needs me" instead of listing nine slugs alphabetically.
 */
function isMoving(c: ChangeRowProps['change']): boolean {
  return c.hasTaskArtifact && c.completedTasks > 0
}

/**
 * Pill count tracks blast radius, not urgency, but it reads as emphasis: a
 * seven-capability change at 0/38 outweighed the only change with real
 * progress. Capping restores the ordering the eye should follow.
 */
const MAX_PILLS = 3

/** Past this many proposed changes, folding the queue buys more than it hides. */
const COLLAPSE_THRESHOLD = 3

export function ChangeProgress({ projectId }: ChangeProgressProps): React.JSX.Element {
  const query = useOpenspec(projectId)
  const [expanded, setExpanded] = useState(false)

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
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-text-secondary">
            The daemon did not answer. Open changes and capabilities resume as soon as it does.
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="rounded border border-border-subtle bg-card-bg-hover px-3 py-1 text-xs font-semibold hover:bg-card-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Retry
          </button>
        </div>
      </PanelContainer>
    )
  }

  if (query.isLoading || !query.data) {
    return (
      <PanelContainer panelId="change-progress" title={TITLE}>
        <p className="text-sm text-text-secondary">Loading…</p>
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

  const moving = openChanges.filter(isMoving)
  const proposed = openChanges.filter((c) => !isMoving(c))
  const collapseProposed = proposed.length > COLLAPSE_THRESHOLD
  const showProposed = !collapseProposed || expanded

  return (
    <PanelContainer panelId="change-progress" title={TITLE}>
      <p data-testid="change-summary" className="text-sm text-text-secondary">
        {moving.length} in flight
        <span aria-hidden="true"> · </span>
        {proposed.length} proposed
      </p>

      {moving.length > 0 ? (
        <ul className="divide-y divide-border-subtle">
          {moving.map((c) => (
            <ChangeRow key={c.name} change={c} />
          ))}
        </ul>
      ) : null}

      {/*
       * A short queue stays open: collapsing two rows hides data and saves no
       * meaningful height. Past the chunking threshold it is the reverse — nine
       * ungrouped rows are what turn a healthy backlog into a wall of zeros, so
       * the queue folds and the work actually in flight stays first.
       *
       * The toggle sits above the rows it reveals. Below them it scrolled out of
       * the viewport on the very click that expanded the list, so the control
       * the user had just pressed disappeared and collapsing again meant hunting
       * ~600px down the page for it.
       */}
      {collapseProposed ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls="change-progress-proposed"
          className="-my-1.5 flex items-center gap-1 self-start rounded-md py-1.5 text-sm text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {expanded ? (
            <ChevronDown size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
          {expanded ? 'Hide' : 'Show'} {proposed.length} proposed
        </button>
      ) : null}

      {showProposed && proposed.length > 0 ? (
        <div id="change-progress-proposed" className="flex flex-col gap-4">
          {/*
           * The group boundary lives in the DOM, not only in the summary line
           * at the top of the panel. Expanded, that line is hundreds of pixels
           * away, and without a label here the reader carries the in-flight /
           * proposed split in working memory across nine identical rows.
           */}
          {moving.length > 0 ? (
            <p
              data-testid="proposed-group-label"
              className="text-xs font-medium text-text-tertiary"
            >
              Proposed
            </p>
          ) : null}
          <ul className="divide-y divide-border-subtle">
            {proposed.map((c) => (
              <ChangeRow key={c.name} change={c} />
            ))}
          </ul>
        </div>
      ) : null}
    </PanelContainer>
  )
}
