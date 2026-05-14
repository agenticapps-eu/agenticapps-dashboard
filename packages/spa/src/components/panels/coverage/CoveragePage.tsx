/**
 * CoveragePage.tsx — Top-level /coverage route page.
 *
 * Composes: PageHeader → CoverageToolbar → 3× CoverageFamilySection.
 * CODEX HIGH-6 Option A: NO CoverageGitNexusBanner; gitNexusInstalled passed to each section.
 * CODEX HIGH-1: absPath NEVER rendered anywhere.
 * CODEX MED-13: clipboard strings from @agenticapps/dashboard-shared (no local duplication).
 * CODEX LOW-18: writeToClipboard wrapper for browser-API fallback.
 * AGREED-4: RefreshAllStaleButton is its own component with batch-progress state.
 * INV-04: SchemaDriftState reused (no new schema-drift primitive).
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA
 * - NO hex literals
 * - NO shadcn aliases
 */
import React, { useState, useMemo, useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  buildWikiCompileClipboardString,
  buildWorkflowUpdateClipboardString,
  buildClaudeMdHelpUrl,
  type CoverageFamily,
  type CoverageRow,
} from '@agenticapps/dashboard-shared'

import { PageHeader } from '../../ui/PageHeader.js'
import { useCoverage, useCoverageRefresh } from '../../../lib/coverageQueries.js'
import { writeToClipboard } from '../../../lib/clipboardCompat.js'
import { SchemaDriftState } from '../../SchemaDriftState.js'
import { CoverageToolbar } from './CoverageToolbar.js'
import type { CoverageStatusFilter } from './CoverageToolbar.js'
import { CoverageFamilySection } from './CoverageFamilySection.js'
import { CoverageEmptyState } from './CoverageEmptyState.js'
import { RefreshAllStaleButton } from './RefreshAllStaleButton.js'
import { InstallGitNexusButton } from './InstallGitNexusButton.js'

const FAMILIES: CoverageFamily[] = ['agenticapps', 'factiv', 'neuroflash']

const DEFAULT_FILTER: CoverageStatusFilter = {
  all: true,
  missing: false,
  stale: false,
  fresh: false,
}

// Derive initial filter from URL ?status= param
function filterFromStatus(status: string | undefined): CoverageStatusFilter {
  if (!status) return DEFAULT_FILTER
  const parts = status.split(',')
  if (parts.includes('all') || parts.length === 0) return DEFAULT_FILTER
  return {
    all: false,
    missing: parts.includes('missing'),
    stale: parts.includes('stale'),
    fresh: parts.includes('fresh'),
  }
}

// Serialize filter to ?status= param
function statusFromFilter(filter: CoverageStatusFilter): string | undefined {
  if (filter.all) return undefined
  const parts: string[] = []
  if (filter.missing) parts.push('missing')
  if (filter.stale) parts.push('stale')
  if (filter.fresh) parts.push('fresh')
  return parts.length > 0 ? parts.join(',') : undefined
}

// Row matches filter (union of selected states across any column)
function rowMatchesFilter(row: CoverageRow, filter: CoverageStatusFilter): boolean {
  if (filter.all) return true
  const cols = [row.claudeMd.state, row.gitNexus.state, row.wiki.state, row.workflowVersion.state]
  return (
    (filter.missing && cols.includes('missing')) ||
    (filter.stale && cols.includes('stale')) ||
    (filter.fresh && cols.every((s) => s === 'fresh' || s === 'not-applicable'))
  )
}

export function CoveragePage(): React.JSX.Element {
  const query = useCoverage()
  const refresh = useCoverageRefresh()
  const navigate = useNavigate()
  // URL state (strict:false — /coverage route may not have validateSearch yet; Plan 07 wires it)
  const search = useSearch({ strict: false }) as { status?: string; q?: string }

  const [filter, setFilter] = useState<CoverageStatusFilter>(() =>
    filterFromStatus(search.status),
  )
  const [searchText, setSearchText] = useState(search.q ?? '')

  // Sync filter to URL
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigate as unknown as (opts: { search: Record<string, unknown>; replace: boolean }) => void

  const handleFilterChange = useCallback(
    (next: CoverageStatusFilter) => {
      setFilter(next)
      nav({
        search: {
          status: statusFromFilter(next),
          q: searchText || undefined,
        },
        replace: true,
      })
    },
    [nav, searchText],
  )

  // Sync search to URL (already debounced by CoverageToolbar)
  const handleSearchChange = useCallback(
    (next: string) => {
      setSearchText(next)
      nav({
        search: {
          status: statusFromFilter(filter),
          q: next || undefined,
        },
        replace: true,
      })
    },
    [nav, filter],
  )

  // Refresh action dispatcher (D-10-09: only gitnexus-analyze hits daemon).
  // CoverageRow → CoverageFamilySection → here passes {family, repo} so per-row
  // gitnexus dispatch and per-family clipboard strings both use the correct context.
  const handleRefresh = useCallback(
    (
      action: 'gitnexus-analyze' | 'wiki-compile-clipboard' | 'workflow-update-clipboard' | 'claude-md-help',
      context: { family: CoverageFamily; repo: string },
    ) => {
      void (async () => {
        switch (action) {
          case 'gitnexus-analyze':
            await refresh.mutateAsync({
              family: context.family,
              repo: context.repo,
              action: 'gitnexus-analyze',
            })
            break
          case 'wiki-compile-clipboard':
            await writeToClipboard(buildWikiCompileClipboardString(context.family))
            break
          case 'workflow-update-clipboard':
            await writeToClipboard(buildWorkflowUpdateClipboardString())
            break
          case 'claude-md-help':
            void navigate({ to: buildClaudeMdHelpUrl() as '/' })
            break
        }
      })()
    },
    [navigate, refresh],
  )

  // useMemo hooks must be called unconditionally (React rules of hooks)
  // They depend on query.data — use empty array when data not yet available
  const allRows = query.data?.rows ?? []

  // Filter + search rows
  const filtered = useMemo(() => {
    let rows = allRows
    if (searchText) {
      rows = rows.filter((r) => r.repo.toLowerCase().includes(searchText.toLowerCase()))
    }
    if (!filter.all) {
      rows = rows.filter((r) => rowMatchesFilter(r, filter))
    }
    return rows
  }, [allRows, filter, searchText])

  // Group by family
  const byFamily = useMemo(() => {
    const map: Record<CoverageFamily, CoverageRow[]> = {
      agenticapps: [],
      factiv: [],
      neuroflash: [],
    }
    for (const row of filtered) {
      map[row.family].push(row)
    }
    return map
  }, [filtered])

  const noResults = filtered.length === 0

  // Schema drift surface (INV-04: reuse existing pattern)
  if (query.error?.message?.startsWith('schema_drift:')) {
    const path = query.error.message.slice('schema_drift:'.length)
    return (
      <SchemaDriftState
        firstIssue={{ path, expected: 'see schema', got: 'mismatch' }}
        fullIssues={[]}
        onRetry={() => void query.refetch()}
      />
    )
  }

  // Loading skeleton
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Coverage"
          helper="Per-repo knowledge-layer freshness across agenticapps, factiv, and neuroflash families"
        />
        <div className="flex flex-col gap-4">
          {FAMILIES.map((fam) => (
            <div
              key={fam}
              className="h-32 animate-pulse rounded-card bg-card-bg shadow-card"
              aria-label={`Loading ${fam} coverage data`}
            />
          ))}
        </div>
      </div>
    )
  }

  // Non-drift error
  if (query.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Coverage" />
        <CoverageEmptyState
          kind="scan-failed"
          onRetry={() => void query.refetch()}
        />
      </div>
    )
  }

  const data = query.data

  // Truly empty matrix (no repos at all)
  if (!data || data.rows.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Coverage" />
        <CoverageEmptyState kind="no-repos" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Coverage"
        helper="Per-repo knowledge-layer freshness across agenticapps, factiv, and neuroflash families"
        actions={
          // Primary action depends on whether GitNexus can actually be invoked.
          // P0 fix from 10-IMPECCABLE.md: "Refresh 0 stale" was a confidence-killer
          // when GitNexus wasn't installed — the button labelled itself "0" while
          // 42 cells were red. Now swap to the actionable CTA in that state.
          data.gitNexusInstalled ? (
            <RefreshAllStaleButton
              rows={filtered}
              onRefresh={(req) => refresh.mutateAsync(req)}
            />
          ) : (
            <InstallGitNexusButton />
          )
        }
      />

      <CoverageToolbar
        filter={filter}
        search={searchText}
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
      />

      {noResults ? (
        <CoverageEmptyState
          kind="no-results"
          onClearFilters={() => {
            setFilter(DEFAULT_FILTER)
            setSearchText('')
            nav({ search: {}, replace: true })
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {FAMILIES.map((family) => (
            <CoverageFamilySection
              key={family}
              family={family}
              rows={byFamily[family]}
              gitNexusInstalled={data.gitNexusInstalled}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}
