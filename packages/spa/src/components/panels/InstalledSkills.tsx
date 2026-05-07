/**
 * InstalledSkills — HEALTH-01 panel.
 *
 * Renders global + local skills merged client-side, tagged with scope: 'global' | 'local'.
 * Row layout: [scope-pill][skill-name][description-truncated]
 * Sort: globals first (alphabetical by dir), then locals (alphabetical by dir). D-5-12.
 *
 * States:
 *   1. schema_drift error → InlineDrift
 *   2. Either loading → 'Loading...'
 *   3. Other error / no data → PanelContainer unreachable=true
 *   4. Both empty → empty-state copy per UI-SPEC §Copywriting line 395
 *   5. Happy path → merged sorted list with scope pills
 *
 * Threat mitigations:
 *   T-05-04-Cross-Project-Cache: useLocalSkills(projectId) includes projectId in key.
 *   T-05-04-Schema-Drift: error.message.startsWith('schema_drift:') → InlineDrift.
 *   T-05-04-Markdown-Injection: all daemon strings rendered as React text children.
 */
import React from 'react'

import { useGlobalSkills, useLocalSkills } from '../../lib/projectQueries.js'

import { InlineDrift } from './InlineDrift.js'
import { PanelContainer } from './PanelContainer.js'

export type InstalledSkillsProps = { projectId: string }

const PANEL_ID = 'installed-skills'
const PANEL_TITLE = 'Installed Skills'

export function InstalledSkills({ projectId }: InstalledSkillsProps): React.JSX.Element {
  const globalQ = useGlobalSkills()
  const localQ = useLocalSkills(projectId)

  // Schema drift: surface inline (check both queries)
  for (const q of [globalQ, localQ]) {
    if (q.error?.message?.startsWith('schema_drift:')) {
      const path = q.error.message.slice('schema_drift:'.length)
      return (
        <InlineDrift
          panelId={PANEL_ID}
          title={PANEL_TITLE}
          path={path}
          onRetry={() => {
            void globalQ.refetch()
            void localQ.refetch()
          }}
        />
      )
    }
  }

  // Loading: either still in flight
  if (globalQ.isLoading || localQ.isLoading) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
        <p className="text-sm text-[--text-muted]">Loading...</p>
      </PanelContainer>
    )
  }

  // Non-drift error or missing data → unreachable
  if (globalQ.error || localQ.error || !globalQ.data || !localQ.data) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE} unreachable>
        {null}
      </PanelContainer>
    )
  }

  const merged = [
    ...globalQ.data.skills.slice().sort((a, b) => a.dir.localeCompare(b.dir)),
    ...localQ.data.skills.slice().sort((a, b) => a.dir.localeCompare(b.dir)),
  ]

  if (merged.length === 0) {
    return (
      <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
        <p className="text-base leading-relaxed text-[--text-muted]">
          No skills installed. Install with{' '}
          <code className="font-mono">claude skill install &lt;name&gt;</code>
          {' '}or place a SKILL.md under{' '}
          <code className="font-mono">~/.claude/skills/</code>.
        </p>
      </PanelContainer>
    )
  }

  return (
    <PanelContainer panelId={PANEL_ID} title={PANEL_TITLE}>
      <p className="-mt-2 text-xs text-[--text-muted]">{merged.length} skills</p>
      <div className="max-h-[480px] overflow-y-auto">
        <ul className="divide-y divide-[--border]">
          {merged.map((s) => {
            const firstLine =
              (s.description ?? '').split('\n').find((l) => l.trim().length > 0) ?? ''
            return (
              <li key={`${s.scope}:${s.dir}`} className="flex min-w-0 items-center gap-2 py-2">
                <span className="inline-flex shrink-0 items-center rounded bg-[--surface-elevated] px-1.5 py-0.5 text-xs uppercase tracking-wide text-[--text-muted]">
                  {s.scope}
                </span>
                <span className="shrink-0 font-mono text-sm text-[--text]">{s.name}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-[--text-muted]">{firstLine}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </PanelContainer>
  )
}
