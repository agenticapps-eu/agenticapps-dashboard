/**
 * ExecutionTimeline — PHASE-02 panel.
 *
 * Renders TDD red/green commit pairs grouped per task ID.
 * Data source: usePhaseProgress(projectId) — reads .tdd.timeline.
 *
 * Threat model T-04-06-02: commit subjects are React text children — auto-escaped.
 * T-04-06-05: phase prefix filter bounds timeline to ~100 tasks.
 *
 * Wave 3 (Plan 05.1-04): repaletted from legacy [--*] aliases to Tailwind-4 namespaced tokens.
 */
import React from 'react'

import { usePhaseProgress } from '../../lib/projectQueries.js'
import { formatRelativeTime } from '../../lib/relativeTime.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export interface ExecutionTimelineProps {
  projectId: string
}

export function ExecutionTimeline({ projectId }: ExecutionTimelineProps): React.JSX.Element {
  const query = usePhaseProgress(projectId)

  if (query.error) {
    const msg = query.error.message
    if (msg.startsWith('schema_drift:')) {
      return (
        <InlineDrift
          panelId="execution-timeline"
          title="Execution Timeline"
          path={msg.slice('schema_drift:'.length)}
          onRetry={() => void query.refetch()}
        />
      )
    }
    return (
      <PanelContainer panelId="execution-timeline" title="Execution Timeline" unreachable>
        {null}
      </PanelContainer>
    )
  }

  if (query.isLoading || !query.data) {
    return (
      <PanelContainer panelId="execution-timeline" title="Execution Timeline">
        <p className="text-sm text-text-secondary">Loading...</p>
      </PanelContainer>
    )
  }

  const { timeline } = query.data.tdd

  if (timeline.length === 0) {
    return (
      <PanelContainer panelId="execution-timeline" title="Execution Timeline">
        <p className="text-base leading-relaxed text-text-secondary">
          No TDD commits yet for this phase.
        </p>
      </PanelContainer>
    )
  }

  return (
    <PanelContainer panelId="execution-timeline" title="Execution Timeline">
      <ol className="flex flex-col gap-3">
        {timeline.map((t) => (
          <li key={t.taskId} className="flex flex-col gap-1">
            <p className="font-mono text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Task {t.taskId}
            </p>
            {t.redCommit && (
              <CommitRow
                kind="RED"
                sha={t.redCommit.sha}
                subject={t.redCommit.subject}
                isoDate={t.redCommit.isoDate}
                pending={t.greenCommit === null}
              />
            )}
            {t.greenCommit && (
              <CommitRow
                kind="GREEN"
                sha={t.greenCommit.sha}
                subject={t.greenCommit.subject}
                isoDate={t.greenCommit.isoDate}
                pending={false}
              />
            )}
          </li>
        ))}
      </ol>
    </PanelContainer>
  )
}

function CommitRow({
  kind,
  sha,
  subject,
  isoDate,
  pending,
}: {
  kind: 'RED' | 'GREEN'
  sha: string
  subject: string
  isoDate: string
  pending: boolean
}): React.JSX.Element {
  const dotClass = kind === 'RED' ? 'text-status-error' : 'text-status-success'
  const subjectClass = pending
    ? 'font-mono text-sm text-text-secondary'
    : 'font-mono text-sm text-text-primary'
  return (
    <div className="flex items-baseline gap-2 pl-3">
      <span aria-hidden="true" className={dotClass}>
        ●
      </span>
      <span className="sr-only">{kind}:</span>
      <code className={subjectClass} title={sha}>
        {subject}
      </code>
      <time dateTime={isoDate} className="font-mono text-xs text-text-secondary">
        {formatRelativeTime(isoDate)}
      </time>
    </div>
  )
}
