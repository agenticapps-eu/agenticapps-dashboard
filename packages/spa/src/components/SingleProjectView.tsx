/**
 * SingleProjectView — top-level shell for /projects/{id}.
 *
 * D-4-09: 2-column grid (left=Discipline, center=Phase Progress).
 * NO right-column DOM element — D-4-13 anti-skeleton policy.
 *
 * Plans 05 + 06 fill the panel slots below by replacing each
 * <div data-slot=".../> with the actual panel component import.
 *
 * Plan order:
 *  Plan 05 → CommitmentBlock, HookFirings, RationalizationFires
 *  Plan 06 → PhaseProgress, ExecutionTimeline, ReviewStatus, SecurityStatus, VerificationStatus
 *
 * document.title is set here (not in ProjectLayout — layout is generic; title is per-page).
 */
import { useEffect } from 'react'

import { ProjectHeader } from './ProjectHeader.js'

export type SingleProjectViewProps = { projectId: string }

export function SingleProjectView({ projectId }: SingleProjectViewProps): React.JSX.Element {
  useEffect(() => {
    document.title = `${projectId} — AgenticApps Dashboard`
  }, [projectId])

  return (
    <div>
      <ProjectHeader projectId={projectId} />
      <div
        data-testid="single-project-grid"
        className="grid grid-cols-[1fr_1.5fr] items-start gap-6"
      >
        <section
          data-testid="discipline-column"
          aria-label="Discipline"
          className="flex flex-col gap-4"
        >
          <div data-slot="commitment" />
          <div data-slot="hook-firings" />
          <div data-slot="rationalization-fires" />
        </section>
        <section
          data-testid="phase-progress-column"
          aria-label="Phase Progress"
          className="flex flex-col gap-4"
        >
          <div data-slot="phase-progress" />
          <div data-slot="execution-timeline" />
          <div data-slot="review-status" />
          <div data-slot="security-status" />
          <div data-slot="verification-status" />
        </section>
      </div>
    </div>
  )
}
