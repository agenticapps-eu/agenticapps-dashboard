/**
 * SingleProjectView — top-level shell for /projects/{id}.
 *
 * D-4-09: 2-column grid (left=Discipline, center=Phase Progress).
 * NO right-column DOM element — D-4-13 anti-skeleton policy.
 *
 * Plan 05 filled: CommitmentBlock, HookFirings, RationalizationFires.
 * Plan 06 filled: PhaseProgress, ExecutionTimeline, ReviewStatus, SecurityStatus, VerificationStatus.
 *
 * document.title is set here (not in ProjectLayout — layout is generic; title is per-page).
 */
import React, { useEffect } from 'react'

import { ProjectHeader } from './ProjectHeader.js'
import { CommitmentBlock } from './panels/CommitmentBlock.js'
import { ExecutionTimeline } from './panels/ExecutionTimeline.js'
import { HookFirings } from './panels/HookFirings.js'
import { PhaseProgress } from './panels/PhaseProgress.js'
import { RationalizationFires } from './panels/RationalizationFires.js'
import { ReviewStatus } from './panels/ReviewStatus.js'
import { SecurityStatus } from './panels/SecurityStatus.js'
import { VerificationStatus } from './panels/VerificationStatus.js'

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
          <CommitmentBlock projectId={projectId} />
          <HookFirings projectId={projectId} />
          <RationalizationFires projectId={projectId} />
        </section>
        <section
          data-testid="phase-progress-column"
          aria-label="Phase Progress"
          className="flex flex-col gap-4"
        >
          <PhaseProgress projectId={projectId} />
          <ExecutionTimeline projectId={projectId} />
          <ReviewStatus projectId={projectId} />
          <SecurityStatus projectId={projectId} />
          <VerificationStatus projectId={projectId} />
        </section>
      </div>
    </div>
  )
}
