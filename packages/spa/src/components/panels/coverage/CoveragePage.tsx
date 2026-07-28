import React, { useCallback, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  type CompatibleCoverageRow,
  type CoverageFamily,
} from '@agenticapps/dashboard-shared'

import { PageHeader } from '../../ui/PageHeader.js'
import { useCoverage } from '../../../lib/coverageQueries.js'
import { useHealth } from '../../../lib/healthQueries.js'
import { getPairing } from '../../../lib/pairing.js'
import { buildViewerUrl } from '../../../lib/understandViewerUrl.js'
import { SchemaDriftState } from '../../SchemaDriftState.js'
import { CoverageToolbar } from './CoverageToolbar.js'
import type { CoverageStatusFilter } from './CoverageToolbar.js'
import { CoverageFamilySection } from './CoverageFamilySection.js'
import { CoverageEmptyState } from './CoverageEmptyState.js'

const FAMILIES: CoverageFamily[] = ['agenticapps', 'factiv', 'neuroflash']

const DEFAULT_FILTER: CoverageStatusFilter = {
  all: true,
  missing: false,
  stale: false,
  fresh: false,
}

function filterFromStatus(status: string | undefined): CoverageStatusFilter {
  if (!status) return DEFAULT_FILTER
  const recognised = status
    .split(',')
    .filter((value): value is 'missing' | 'stale' | 'fresh' =>
      value === 'missing' || value === 'stale' || value === 'fresh',
    )
  if (recognised.length === 0) return DEFAULT_FILTER
  return {
    all: false,
    missing: recognised.includes('missing'),
    stale: recognised.includes('stale'),
    fresh: recognised.includes('fresh'),
  }
}

function statusFromFilter(filter: CoverageStatusFilter): string | undefined {
  if (filter.all) return undefined
  const parts: string[] = []
  if (filter.missing) parts.push('missing')
  if (filter.stale) parts.push('stale')
  if (filter.fresh) parts.push('fresh')
  return parts.length > 0 ? parts.join(',') : undefined
}

function rowMatchesFilter(
  row: CompatibleCoverageRow,
  filter: CoverageStatusFilter,
): boolean {
  if (filter.all) return true
  const states = [row.claudeMd.state, row.workflowVersion.state]
  if (row.understand) states.push(row.understand.state)
  return (
    (filter.missing && states.includes('missing')) ||
    (filter.stale && states.includes('stale')) ||
    (filter.fresh && states.every((state) => state === 'fresh'))
  )
}

export function CoveragePage(): React.JSX.Element {
  const query = useCoverage()
  const health = useHealth()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { status?: string; q?: string }
  const [filter, setFilter] = useState<CoverageStatusFilter>(() =>
    filterFromStatus(search.status),
  )
  const [searchText, setSearchText] = useState(search.q ?? '')

  const understandViewerInstalled =
    health.data === undefined ? true : health.data.understand?.viewerInstalled === true
  const pairing = getPairing()
  const understandViewerUrls = useMemo((): Readonly<Record<string, string>> => {
    if (!pairing || !understandViewerInstalled) return {}
    const urls: Record<string, string> = {}
    for (const row of query.data?.rows ?? []) {
      const viewerToken = row.understand?.viewerToken
      if (viewerToken) {
        urls[`${row.family}/${row.repo}`] = buildViewerUrl(
          pairing.agentUrl,
          row.family,
          row.repo,
          viewerToken,
        )
      }
    }
    return urls
  }, [query.data, pairing, understandViewerInstalled])

  const nav = navigate as unknown as (opts: {
    search: Record<string, unknown>
    replace: boolean
  }) => void

  const handleFilterChange = useCallback(
    (next: CoverageStatusFilter) => {
      setFilter(next)
      nav({
        search: { status: statusFromFilter(next), q: searchText || undefined },
        replace: true,
      })
    },
    [nav, searchText],
  )

  const handleSearchChange = useCallback(
    (next: string) => {
      setSearchText(next)
      nav({
        search: { status: statusFromFilter(filter), q: next || undefined },
        replace: true,
      })
    },
    [nav, filter],
  )

  const allRows = query.data?.rows ?? []
  const filtered = useMemo(() => {
    let rows = allRows
    if (searchText) {
      rows = rows.filter((row) =>
        row.repo.toLowerCase().includes(searchText.toLowerCase()),
      )
    }
    if (!filter.all) rows = rows.filter((row) => rowMatchesFilter(row, filter))
    return rows
  }, [allRows, filter, searchText])

  const byFamily = useMemo(() => {
    const map: Record<CoverageFamily, CompatibleCoverageRow[]> = {
      agenticapps: [],
      factiv: [],
      neuroflash: [],
    }
    for (const row of filtered) map[row.family].push(row)
    return map
  }, [filtered])

  if (query.error?.message.startsWith('schema_drift:')) {
    return (
      <SchemaDriftState
        firstIssue={{
          path: query.error.message.slice('schema_drift:'.length),
          expected: 'coverage schema version 1 or 2',
          got: 'mismatch',
        }}
        fullIssues={[]}
        onRetry={() => void query.refetch()}
      />
    )
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Coverage"
          helper="Per-repo knowledge-layer freshness across agenticapps, factiv, and neuroflash families"
          sticky={true}
        />
        <div className="flex flex-col gap-4">
          {FAMILIES.map((family) => (
            <div
              key={family}
              className="h-32 animate-pulse rounded-card bg-card-bg shadow-card"
              aria-label={`Loading ${family} coverage data`}
            />
          ))}
        </div>
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Coverage" sticky={true} />
        <CoverageEmptyState kind="scan-failed" onRetry={() => void query.refetch()} />
      </div>
    )
  }

  if (!query.data || query.data.rows.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Coverage" sticky={true} />
        <CoverageEmptyState kind="no-repos" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Coverage"
        helper="Per-repo knowledge-layer freshness across agenticapps, factiv, and neuroflash families"
        sticky={true}
      >
        <CoverageToolbar
          filter={filter}
          search={searchText}
          onFilterChange={handleFilterChange}
          onSearchChange={handleSearchChange}
        />
      </PageHeader>

      {filtered.length === 0 ? (
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
              understandViewerUrls={understandViewerUrls}
            />
          ))}
        </div>
      )}
    </div>
  )
}
