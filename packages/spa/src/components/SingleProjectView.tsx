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
 * Wave 5 (Plan 05.1-06):
 *   - V2 is the only mode. PageHeader renders unconditionally. ProjectHeader deleted.
 *   - Column gap normalized gap-4 → gap-6 (Pitfall 8 — consistent 24px rhythm).
 *
 * document.title is set here (not in ProjectLayout — layout is generic; title is per-page).
 */
import React, { useEffect } from 'react'

import { PageHeader } from './ui/PageHeader.js'
import { CommitmentBlock } from './panels/CommitmentBlock.js'
import { HookFirings } from './panels/HookFirings.js'
import { InstalledSkills } from './panels/InstalledSkills.js'
import { IntegrationsHealth } from './panels/IntegrationsHealth.js'
import { LinearPanel } from './panels/LinearPanel.js'
import { ObservabilityHealth } from './panels/ObservabilityHealth.js'
import { RationalizationFires } from './panels/RationalizationFires.js'
import { SecretsHealth } from './panels/SecretsHealth.js'
import { SentryPanel } from './panels/SentryPanel.js'
import { SkillHealth } from './panels/SkillHealth.js'

export type SingleProjectViewProps = { projectId: string }

export function SingleProjectView({ projectId }: SingleProjectViewProps): React.JSX.Element {
  useEffect(() => {
    document.title = `${projectId} — AgenticApps Dashboard`
  }, [projectId])

  return (
    <div>
      <PageHeader title={projectId} />
      <div
        data-testid="single-project-grid"
        className="grid grid-cols-[1fr_1.5fr_1fr] items-start gap-6"
      >
        <section
          data-testid="discipline-column"
          aria-label="Discipline"
          className="flex min-w-0 flex-col gap-6"
        >
          <CommitmentBlock projectId={projectId} />
          <HookFirings projectId={projectId} />
          <RationalizationFires projectId={projectId} />
        </section>
        {/*
         * The centre column is empty between task groups 5 and 6 of
         * `add-openspec-project-reader`. Group 5 retired the five phase-artifact
         * panels that lived here — every one of them read `.planning/phases/`,
         * which the daemon no longer serves. Group 6 fills it with Change
         * Progress and the Capability panel, per the ADDED requirements of the
         * same change, and runs the design critique against the result.
         */}
        <section
          data-testid="change-progress-column"
          aria-label="Change Progress"
          className="flex min-w-0 flex-col gap-6"
        />
        <section
          data-testid="health-column"
          aria-label="Health"
          className="flex min-w-0 flex-col gap-6"
        >
          <SkillHealth projectId={projectId} />
          <ObservabilityHealth projectId={projectId} />
          <SecretsHealth projectId={projectId} />
          <IntegrationsHealth projectId={projectId} />
          <SentryPanel projectId={projectId} />
          <LinearPanel projectId={projectId} />
          <InstalledSkills projectId={projectId} />
        </section>
      </div>
    </div>
  )
}
