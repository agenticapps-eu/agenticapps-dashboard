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
import { useHealth } from '../../../lib/healthQueries.js'
import { getPairing } from '../../../lib/pairing.js'
import { writeToClipboard } from '../../../lib/clipboardCompat.js'
import { useToast } from '../../ui/Toast.js'
import { SchemaDriftState } from '../../SchemaDriftState.js'
import { CoverageToolbar } from './CoverageToolbar.js'
import type { CoverageStatusFilter } from './CoverageToolbar.js'
import { CoverageFamilySection, refreshKey } from './CoverageFamilySection.js'
import { CoverageEmptyState } from './CoverageEmptyState.js'
import { RefreshAllStaleButton } from './RefreshAllStaleButton.js'
import { InstallGitNexusButton } from './InstallGitNexusButton.js'
// IndexGitNexusButton DELETED — D-13-06. Per-row + per-family ScanPill replaced it.
// The binary-not-installed fallback (InstallGitNexusButton) is preserved (D-13-07).

/**
 * Phase 14 D-14-03/06/07: build a scoped viewer URL for a single repo row.
 * Uses ONLY the per-row viewerToken (lower-privilege, repo-bound) — the main
 * bearer token from getPairing() is NEVER included in viewer URLs (T-14-03-01).
 *
 * Returns undefined when:
 *  - pairing is absent (not yet paired)
 *  - row.understand is undefined (pre-Phase-14 daemon)
 *  - viewerToken is absent on the understand object
 */
function buildViewerUrl(
  agentUrl: string,
  family: string,
  repo: string,
  viewerToken: string,
): string {
  return `${agentUrl}/understand/${family}/${repo}/?token=${encodeURIComponent(viewerToken)}`
}

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
  const health = useHealth()
  const navigate = useNavigate()

  // Phase 13 D-13-08 + D-13-11b: extract gitnexus health data for ScanPill props.
  // Defaults to false when health data is unavailable — safe fallback (no Scan pill shown).
  const gitnexusInstalled = health.data?.gitnexus?.installed ?? false
  const gitnexusCanScan = health.data?.gitnexus?.canScan ?? false

  // Phase 14 D-14-03/06/07: build per-row understand viewer URLs from the scoped
  // viewerToken on each row (NOT the bearer token from getPairing).
  // Keyed by `${family}/${repo}` — matches refreshKey() convention.
  // Computed once at render top-level (not inside the filtered useMemo to avoid
  // URL loss when rows are filtered out; the URL map spans the full allRows set).
  // When unpaired, the empty map is passed and every cell shows no link.
  const pairing = getPairing()
  const understandViewerUrls = useMemo((): Readonly<Record<string, string>> => {
    if (!pairing) return {}
    const urls: Record<string, string> = {}
    for (const row of query.data?.rows ?? []) {
      const vt = row.understand?.viewerToken
      if (vt) {
        urls[`${row.family}/${row.repo}`] = buildViewerUrl(pairing.agentUrl, row.family, row.repo, vt)
      }
    }
    return urls
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, pairing?.agentUrl])

  const toast = useToast()
  // URL state (strict:false — /coverage route may not have validateSearch yet; Plan 07 wires it)
  const search = useSearch({ strict: false }) as { status?: string; q?: string }

  const [filter, setFilter] = useState<CoverageStatusFilter>(() =>
    filterFromStatus(search.status),
  )
  const [searchText, setSearchText] = useState(search.q ?? '')

  // Set of `${family}/${repo}` keys with a gitnexus-analyze refresh currently
  // in-flight. Replaces the prior last-write-wins read of `refresh.variables`
  // so two concurrent row clicks each keep their own spinner+disabled state
  // until their individual mutateAsync resolves (Phase 11.2 stage-1 /review
  // cross-model finding — Claude F4 / Codex #1).
  const [inFlightRefreshes, setInFlightRefreshes] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

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
          case 'gitnexus-analyze': {
            const key = refreshKey(context.family, context.repo)
            setInFlightRefreshes((prev) => {
              const next = new Set(prev)
              next.add(key)
              return next
            })
            try {
              // CoverageRefreshResponseSchema is a discriminated union: the
              // daemon can resolve with ok:false (kind: 'not-installed' |
              // 'timeout' | 'error') WITHOUT throwing. Route those to the
              // error toast — only ok:true is a success (Phase 11.2 stage-1
              // /review cross-model finding).
              const res = await refresh.mutateAsync({
                family: context.family,
                repo: context.repo,
                action: 'gitnexus-analyze',
              })
              if (res.ok) {
                toast.show({
                  message: `Indexed ${context.family}/${context.repo}`,
                  variant: 'success',
                })
              } else {
                toast.show({
                  message: `Indexing failed (${res.kind})`,
                  variant: 'error',
                })
              }
            } catch (err) {
              // Network/schema-drift errors still throw via mutateAsync.
              const reason = err instanceof Error ? err.message : String(err)
              toast.show({
                message: `Indexing failed: ${reason}`,
                variant: 'error',
              })
            } finally {
              setInFlightRefreshes((prev) => {
                const next = new Set(prev)
                next.delete(key)
                return next
              })
            }
            break
          }
          case 'wiki-compile-clipboard': {
            const ok = await writeToClipboard(buildWikiCompileClipboardString(context.family))
            toast.show(
              ok
                ? { message: `Copied — paste in terminal to compile the ${context.family} wiki`, variant: 'success' }
                : { message: 'Copy failed — open the help guide for the command.', variant: 'error' },
            )
            break
          }
          case 'workflow-update-clipboard': {
            const ok = await writeToClipboard(buildWorkflowUpdateClipboardString())
            toast.show(
              ok
                ? { message: 'Copied — paste in terminal to update the workflow', variant: 'success' }
                : { message: 'Copy failed — open the help guide for the command.', variant: 'error' },
            )
            break
          }
          case 'claude-md-help':
            void navigate({ to: buildClaudeMdHelpUrl() as '/' })
            break
        }
      })()
    },
    [navigate, refresh, toast],
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
          sticky={true}
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
        <PageHeader title="Coverage" sticky={true} />
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
        actions={
          data.gitNexusInstallState === 'installed-with-registry' ? (
            <RefreshAllStaleButton
              rows={filtered}
              onRefresh={(req) => refresh.mutateAsync(req)}
            />
          ) : (
            // D-13-06: IndexGitNexusButton removed. For both 'not-installed' and
            // 'installed-no-registry' states, the page header shows InstallGitNexusButton.
            // Per-row + per-family ScanPill (Phase 13) handles the installed-no-registry
            // scan affordance. D-13-07: InstallGitNexusButton is the binary-not-installed
            // fallback and remains unchanged.
            <InstallGitNexusButton />
          )
        }
      >
        <CoverageToolbar
          filter={filter}
          search={searchText}
          onFilterChange={handleFilterChange}
          onSearchChange={handleSearchChange}
        />
      </PageHeader>

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
              gitNexusInstallState={data.gitNexusInstallState}
              onRefresh={handleRefresh}
              inFlightRefreshes={inFlightRefreshes}
              gitnexusInstalled={gitnexusInstalled}
              gitnexusCanScan={gitnexusCanScan}
              understandViewerUrls={understandViewerUrls}
            />
          ))}
        </div>
      )}
    </div>
  )
}
