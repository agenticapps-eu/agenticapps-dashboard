/**
 * SingleProjectView — top-level shell for /projects/{id}.
 *
 * D-5-01: 3-column grid (left=Discipline, center=Phase Progress, right=Health).
 * Phase 4 D-4-09 staged this widening — Phase 5 plan 06 executes it.
 *
 * Panels:
 *   - Plan 04 (Phase 4) filled left + center columns.
 *   - Plan 05/06 (Phase 5) filled the right column with HEALTH-01..05 panels.
 *
 * document.title is set here (not in ProjectLayout — layout is generic; title is per-page).
 */
import React, { useEffect } from 'react'

import { ProjectHeader } from './ProjectHeader.js'
import { CommitmentBlock } from './panels/CommitmentBlock.js'
import { ExecutionTimeline } from './panels/ExecutionTimeline.js'
import { HookFirings } from './panels/HookFirings.js'
import { InstalledSkills } from './panels/InstalledSkills.js'
import { IntegrationsHealth } from './panels/IntegrationsHealth.js'
import { ObservabilityHealth } from './panels/ObservabilityHealth.js'
import { PhaseProgress } from './panels/PhaseProgress.js'
import { RationalizationFires } from './panels/RationalizationFires.js'
import { ReviewStatus } from './panels/ReviewStatus.js'
import { SecretsHealth } from './panels/SecretsHealth.js'
import { SecurityStatus } from './panels/SecurityStatus.js'
import { SkillHealth } from './panels/SkillHealth.js'
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
        className="grid grid-cols-[1fr_1.5fr_1fr] items-start gap-6"
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
        <section
          data-testid="health-column"
          aria-label="Health"
          className="flex flex-col gap-4"
        >
          <InstalledSkills projectId={projectId} />
          <SkillHealth projectId={projectId} />
          <ObservabilityHealth projectId={projectId} />
          <SecretsHealth projectId={projectId} />
          <IntegrationsHealth projectId={projectId} />
        </section>
      </div>
    </div>
  )
}
