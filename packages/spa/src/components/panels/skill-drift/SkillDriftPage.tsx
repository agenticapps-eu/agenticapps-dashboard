/**
 * SkillDriftPage — Top-level /observability/skill-drift route (Plan 11-05 Task 3).
 *
 * Composes: PageHeader → SkillDriftToolbar → SkillDriftMatrix (or state).
 *
 * Scope flow (PD-11-03 single source of truth):
 *   URL ?scope= → useSkillDriftScopeFromUrl() → scope variable →
 *     - useSkillDrift({ scope })            (cache discrimination)
 *     - <SkillDriftMatrix scope={scope} />  (rendering branch)
 *     - <SkillDriftToolbar scope={scope} /> (active chip state)
 *
 * States: loading / error / empty / happy path.
 *
 * Plan 06 polish bundle (sticky PageHeader) is OPT-IN per route via the
 * sticky prop. Plan 05 deliberately does NOT enable it here — Plan 06 may
 * opt this route in once any sticky-specific scroll-behavior considerations
 * have been validated for the matrix surface.
 */
import React, { useState } from 'react'

import { PageHeader } from '../../ui/PageHeader.js'
import { EmptyState } from '../../ui/EmptyState.js'
import { useSkillDrift } from '../../../lib/skillDriftQueries.js'
import { SkillDriftMatrix } from './SkillDriftMatrix.js'
import {
  SkillDriftToolbar,
  useSkillDriftScopeFromUrl,
} from './SkillDriftToolbar.js'

export function SkillDriftPage(): React.JSX.Element {
  // Single source of truth for scope — drives BOTH the hook AND the matrix render.
  const scope = useSkillDriftScopeFromUrl()
  const query = useSkillDrift({ scope })

  // Local search state — toolbar already debounces 200ms; we hold the
  // last-confirmed value here for future filtering wiring. (The matrix
  // does not filter by search in Plan 05; that arrives in a polish plan.)
  const [search, setSearch] = useState('')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Skill drift"
        helper="Cross-project skill presence and version drift across registered families"
      />
      <SkillDriftToolbar
        scope={scope}
        search={search}
        onSearchChange={setSearch}
      />

      {query.isPending && (
        <EmptyState
          title="Loading skill drift…"
          body="Scanning skills across registered projects."
        />
      )}
      {query.isError && !query.isPending && (
        <EmptyState
          title="Failed to load skill drift"
          body={query.error?.message ?? 'Daemon returned an error.'}
        />
      )}
      {query.data && !query.isPending && !query.isError && (
        <SkillDriftMatrix data={query.data} scope={scope} />
      )}
    </div>
  )
}
