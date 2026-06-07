/**
 * CodeIntelligencePage — /code-intelligence route (Phase 14 Plan 04).
 *
 * D-14-06: dedicated discoverability surface for knowledge graphs.
 * D-14-07: viewer links open in new tab with scoped per-repo viewer token.
 * D-14-02: install/update hints sourced from health.understand block.
 *
 * Page anatomy (follows SkillDriftPage):
 *   PageHeader → hint banners (install / update) → analyzed-projects list → EmptyState
 *
 * Data:
 *   useCoverage — CoverageRow.understand column, filtered to state fresh/stale.
 *   useHealth   — understand block for install/update state + (no viewerToken per T-14-01-01).
 *   getPairing  — agentUrl for viewer URL construction.
 *
 * Viewer URL pattern (D-14-07):
 *   {agentUrl}/understand/{family}/{repo}/?token={encodeURIComponent(viewerToken)}
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 */
import React from 'react'

import { ExternalLink } from 'lucide-react'

import { PageHeader } from '../../ui/PageHeader.js'
import { EmptyState } from '../../ui/EmptyState.js'
import { useCoverage } from '../../../lib/coverageQueries.js'
import { useHealth } from '../../../lib/healthQueries.js'
import { getPairing } from '../../../lib/pairing.js'
import { buildViewerUrl } from '../../../lib/understandViewerUrl.js'

import type { CoverageRow } from '@agenticapps/dashboard-shared'

// ── Sub-components ────────────────────────────────────────────────────────────

interface AnalyzedRowProps {
  row: CoverageRow
  agentUrl: string | undefined
  viewerInstalled: boolean
}

function AnalyzedRow({ row, agentUrl, viewerInstalled }: AnalyzedRowProps): React.JSX.Element {
  const understand = row.understand
  if (!understand) return <></>

  const isStale = understand.state === 'stale'
  const viewerToken = understand.viewerToken
  const viewerUrl =
    agentUrl && viewerToken && viewerInstalled
      ? buildViewerUrl(agentUrl, row.family, row.repo, viewerToken)
      : undefined

  const lastAnalyzedAt = understand.lastAnalyzedAt
    ? new Date(understand.lastAnalyzedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : undefined

  return (
    <tr className="border-b border-border-subtle last:border-0">
      <td className="py-3 pr-4 text-sm font-medium text-text-primary">{row.repo}</td>
      <td className="py-3 pr-4 text-sm text-text-secondary">{row.family}</td>
      <td className="py-3 pr-4 text-sm text-text-secondary">
        {understand.analyzedFiles !== undefined ? `${understand.analyzedFiles} files` : '—'}
      </td>
      <td className="py-3 pr-4 text-sm text-text-secondary">{lastAnalyzedAt ?? '—'}</td>
      <td className="py-3 pr-4">
        {isStale && (
          <span className="inline-flex items-center rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-text">
            stale
          </span>
        )}
      </td>
      <td className="py-3">
        {viewerUrl ? (
          <a
            href={viewerUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open viewer for ${row.repo}`}
            className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded"
          >
            Open viewer
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function CodeIntelligencePage(): React.JSX.Element {
  const coverageQuery = useCoverage()
  const healthQuery = useHealth()
  const pairing = getPairing()
  const agentUrl = pairing?.agentUrl

  // Loading state — either query pending
  if (coverageQuery.isPending || healthQuery.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Knowledge graphs"
          helper="Knowledge graph analysis status across registered projects"
        />
        <EmptyState
          title="Loading knowledge graphs…"
          body="Scanning understand-anything analysis across registered projects."
        />
      </div>
    )
  }

  // Error state — coverage query failed
  if (coverageQuery.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Knowledge graphs"
          helper="Knowledge graph analysis status across registered projects"
        />
        <EmptyState
          title="Failed to load knowledge graphs"
          body={coverageQuery.error?.message ?? 'Daemon returned an error.'}
        />
      </div>
    )
  }

  // Derive understand state from health.
  // Phase 14 review fix: when the health query errored (or schema-drifted —
  // no data either way), the install state is UNKNOWN: show neither the
  // install banner nor the update hint, and keep viewer links rendered (the
  // daemon route 503s gracefully if the viewer is truly missing). Only a
  // successful health response may claim 'Viewer not installed'.
  const healthUnknown = healthQuery.isError || healthQuery.data === undefined
  const understandHealth = healthQuery.data?.understand
  // Treat missing understand block (old daemon) as viewer not installed
  const viewerInstalled = healthUnknown ? true : (understandHealth?.viewerInstalled ?? false)
  const showInstallHint = !healthUnknown && !(understandHealth?.viewerInstalled ?? false)
  const updateAvailable = !healthUnknown && (understandHealth?.updateAvailable ?? false)
  const viewerVersion = understandHealth?.viewerVersion ?? null
  const pluginVersion = understandHealth?.pluginVersion ?? null

  // Filter rows to those with understand fresh or stale
  const rows = coverageQuery.data?.rows ?? []
  const analyzedRows = rows.filter(
    (row) => row.understand?.state === 'fresh' || row.understand?.state === 'stale',
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Knowledge graphs"
        helper="Knowledge graph analysis status across registered projects. Use the /understand skill to analyze a project."
      />

      {/* Install hint — viewer not installed (D-14-02). role="status" (polite),
          not "alert": this is a static hint present at render, not an interruption.
          Suppressed when health is unknown (errored/no data) — see healthUnknown. */}
      {showInstallHint && (
        <div
          role="status"
          className="rounded-lg border border-border-subtle bg-card-bg p-4 text-sm text-text-secondary"
        >
          <p className="font-medium text-text-primary">Viewer not installed</p>
          <p className="mt-1">
            Install the understand-anything viewer to browse knowledge graphs:{' '}
            <code className="rounded bg-card-bg-hover px-1 py-0.5 font-mono text-xs">
              agentic-dashboard install-understand-viewer
            </code>
          </p>
        </div>
      )}

      {/* Update hint — viewer update available (D-14-02) */}
      {viewerInstalled && updateAvailable && (
        <div
          role="status"
          className="rounded-lg border border-border-subtle bg-card-bg p-4 text-sm text-text-secondary"
        >
          <p className="font-medium text-text-primary">Viewer update available</p>
          <p className="mt-1">
            Update from{' '}
            <code className="rounded bg-card-bg-hover px-1 py-0.5 font-mono text-xs">
              {viewerVersion}
            </code>{' '}
            to{' '}
            <code className="rounded bg-card-bg-hover px-1 py-0.5 font-mono text-xs">
              {pluginVersion}
            </code>
            :{' '}
            <code className="rounded bg-card-bg-hover px-1 py-0.5 font-mono text-xs">
              agentic-dashboard install-understand-viewer
            </code>
          </p>
        </div>
      )}

      {/* Empty state — no analyzed repos */}
      {analyzedRows.length === 0 && (
        <EmptyState
          title="No knowledge graphs yet"
          body={
            <span>
              No projects have been analyzed. Run the{' '}
              <code className="rounded bg-card-bg-hover px-1 py-0.5 font-mono text-xs">
                /understand
              </code>{' '}
              skill in a project to generate a knowledge graph.
            </span>
          }
        />
      )}

      {/* Analyzed projects table */}
      {analyzedRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="pb-3 pr-4 text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Repository
                </th>
                <th className="pb-3 pr-4 text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Family
                </th>
                <th className="pb-3 pr-4 text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Analyzed
                </th>
                <th className="pb-3 pr-4 text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Last analyzed
                </th>
                <th className="pb-3 pr-4 text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Status
                </th>
                <th className="pb-3 text-xs font-medium text-text-tertiary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {analyzedRows.map((row) => (
                <AnalyzedRow
                  key={`${row.family}/${row.repo}`}
                  row={row}
                  agentUrl={agentUrl}
                  viewerInstalled={viewerInstalled}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
