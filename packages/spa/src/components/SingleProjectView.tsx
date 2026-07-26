/**
 * SingleProjectView — top-level shell for /projects/{id}.
 *
 * Three columns: left = Discipline, centre = Change Progress, right = Health.
 * The centre column stacks below `xl` so the panels do not truncate to stubs on
 * a tablet, which is a stated viewing context.
 *
 * document.title is set here (not in ProjectLayout — layout is generic; title is per-page).
 */
import React, { useEffect } from 'react'

import { useRegistryList } from '../lib/registry.js'

import { PageHeader } from './ui/PageHeader.js'
import { CapabilityPanel } from './panels/CapabilityPanel.js'
import { ChangeProgress } from './panels/ChangeProgress.js'
import { MigrationNotice } from './panels/MigrationNotice.js'
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

  /*
   * The condition comes from the registry list, which the shell already polls —
   * no extra request. While it is loading the condition is undefined, which
   * falls through to the panels; each renders its own loading state, so the
   * column never flashes the migration notice at a migrated project.
   */
  const registry = useRegistryList()
  const entry = registry.data?.find((p) => p.id === projectId)
  const needsMigration = entry?.status.condition === 'needs-migration'

  return (
    <div>
      <PageHeader title={projectId} />
      <div
        data-testid="single-project-grid"
        className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_1.5fr_1fr]"
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
         * Group 5 retired the five phase-artifact panels that lived here, all of
         * which read `.planning/phases/`. Group 6 fills the column with the two
         * surfaces the same change ADDS: work in flight above, standing promise
         * below.
         *
         * A `needs-migration` project gets the notice instead of the panels.
         * Mounting them would put two permanent empty states in the column and
         * make an explained condition look like missing data.
         */}
        <section
          data-testid="change-progress-column"
          aria-label="Change Progress"
          className="flex min-w-0 flex-col gap-6"
        >
          {needsMigration ? (
            <MigrationNotice />
          ) : (
            <>
              <ChangeProgress projectId={projectId} />
              <CapabilityPanel projectId={projectId} />
            </>
          )}
        </section>
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
