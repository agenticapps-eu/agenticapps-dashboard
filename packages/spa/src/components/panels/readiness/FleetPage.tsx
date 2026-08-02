/**
 * FleetPage.tsx — the readiness fleet, one row per registered repo.
 *
 * A row, not a card: a card costs roughly 200 px of height and a row costs 40,
 * which at fifteen repos is the difference between one screen and four scrolls
 * (design.md §5). The fleet only grows.
 *
 * The daemon returns registry order and does not sort. Ordering interacts with
 * the filters, and a sorting server plus a sorting client eventually disagree
 * in a way nobody notices — so the order is applied here, once, by
 * `compareRepoSeverity`.
 *
 * The six check columns are real column headers. The compact cell is a 14 px
 * glyph whose identity lives in its accessible name, so without them a sighted
 * reader has no way to tell which column is which. The header cells and the
 * indicator both lay out as `grid-cols-6` over the same six table columns, so
 * label k sits above cell k without either side hard-coding a width.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA — inline className strings only
 * - NO hex literals — token names only
 * - NO shadcn aliases
 */
import type { ReactElement } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { AlertTriangle, ShieldCheck } from 'lucide-react'
import { CHECK_IDS, type RepoSummary } from '@agenticapps/dashboard-shared'

import { useFleet } from '../../../lib/readinessQueries.js'
import { compareRepoSeverity } from '../../../lib/readinessOrder.js'
import { SchemaDriftState } from '../../SchemaDriftState.js'
import { EmptyState } from '../../ui/EmptyState.js'
import { PageHeader } from '../../ui/PageHeader.js'

import { CHECK_LABELS, ReadinessIndicator } from './ReadinessIndicator.js'
import { FleetToolbar } from './FleetToolbar.js'
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  matchesFleetFilters,
  parseFleetFilters,
  serialiseFleetFilters,
  type FleetFilters,
  type FleetSearch,
} from './fleetFilters.js'

/** "1 repositories" is the sort of thing a reader trusts a little less for. */
function plural(count: number): string {
  return count === 1 ? 'repository' : 'repositories'
}

/**
 * The date of the last change, in UTC. Every time in this feature is a git
 * committer time, and rendering one of them locally would invite comparing it
 * against a UTC one. A null time renders an em dash rather than a substitute:
 * the fleet's generation time is a different fact.
 *
 * `lastCommitAt` is bounded by the wire schema, so this cannot throw on a
 * corrupt committer date.
 */
function formatLastChange(at: number | null): string {
  if (at === null) return '—'
  return new Date(at).toISOString().slice(0, 10)
}

/**
 * When the readings were computed, to the minute, in UTC.
 *
 * The daemon dates a fleet response by its OLDEST per-repo snapshot rather than
 * by assembly time (design.md §8), so this number never overstates how current
 * the response is. Rendering it is the whole point of that decision: without it
 * a replayed memo and a fresh scan look identical.
 */
function formatGeneratedAt(at: number): string {
  return `${new Date(at).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function LoadingState(): ReactElement {
  return (
    <div aria-label="Loading fleet readiness" className="grid gap-2">
      {[1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="h-10 animate-pulse rounded-md bg-card-bg" />
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }): ReactElement {
  return (
    <section role="status" className="rounded-card bg-card-bg p-6 shadow-card">
      <h2 className="text-lg font-semibold text-text-primary">
        Could not read the fleet.
      </h2>
      <p className="mt-2 text-sm text-text-tertiary">
        The daemon did not answer. Readiness is read from your machine, so
        nothing is cached remotely to fall back on.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-md bg-accent-bg-strong px-3 py-2 text-sm font-semibold text-white hover:bg-accent-bg-strong-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
      >
        Retry
      </button>
    </section>
  )
}

/**
 * Readiness in words, so the verdict does not depend on reading a colour.
 *
 * "Not ready" is stated in the ordinary secondary text colour rather than in
 * red. Pen-test sits at `never` across the whole fleet until it is declared, so
 * at launch this reads false for almost every repo; painting each of those rows
 * red would say something about the repos that is not true, and it is the same
 * mistake §8.2 rejected for the cells. The six cells carry what is actually
 * wrong — this column only says whether anything is.
 */
function ReadyVerdict({ ready }: { ready: boolean }): ReactElement {
  return ready ? (
    <span className="text-sm font-medium text-status-success">Ready</span>
  ) : (
    <span className="text-sm text-text-secondary">Not ready</span>
  )
}

function FleetRow({
  repo,
  onOpen,
}: {
  repo: RepoSummary
  onOpen: (repoId: string) => void
}): ReactElement {
  return (
    <tr
      onClick={() => onOpen(repo.id)}
      className="cursor-pointer border-t border-border-subtle hover:bg-card-bg-hover"
    >
      <td className="px-3 py-2 align-middle">
        <Link
          to="/repos/$repoId"
          params={{ repoId: repo.id }}
          // The cells inside this row carry a more specific destination. Left
          // to bubble, the row's handler would run second and overwrite it, so
          // every cell would land at the top of the page instead of its check.
          onClick={(event) => event.stopPropagation()}
          className="block truncate text-sm text-text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {repo.name}
        </Link>
        {repo.notice !== null && (
          <span className="mt-1 flex items-start gap-1 text-xs text-status-warning">
            <AlertTriangle size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{repo.notice.message}</span>
          </span>
        )}
      </td>
      <td className="px-3 py-2 align-middle whitespace-nowrap">
        <ReadyVerdict ready={repo.ready} />
      </td>
      {/*
        No horizontal padding: the grid inside divides this cell into the same
        six fractions the header row divides into, so any padding here shifts
        every cell out from under its own label.
      */}
      <td
        colSpan={CHECK_IDS.length}
        className="py-2 align-middle"
        onClick={(event) => event.stopPropagation()}
      >
        <ReadinessIndicator
          checks={repo.checks}
          repoName={repo.name}
          repoId={repo.id}
          variant="compact"
        />
      </td>
      {/* Right, to match its own header. They disagreed until now. */}
      <td className="px-3 py-2 text-right align-middle text-sm text-text-secondary whitespace-nowrap">
        {formatLastChange(repo.lastCommitAt)}
      </td>
    </tr>
  )
}

function FleetTable({
  repos,
  onOpen,
}: {
  repos: readonly RepoSummary[]
  onOpen: (repoId: string) => void
}): ReactElement {
  const ordered = [...repos].sort(compareRepoSeverity)

  return (
    <div className="rounded-card bg-card-bg shadow-card">
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th
              scope="col"
              className="w-56 px-3 py-2 text-left text-xs font-medium text-text-tertiary"
            >
              Repository
            </th>
            <th
              scope="col"
              className="w-28 px-3 py-2 text-left text-xs font-medium text-text-tertiary"
            >
              Readiness
            </th>
            {CHECK_IDS.map((id) => (
              <th
                key={id}
                scope="col"
                className="px-1 py-2 text-center text-xs font-medium text-text-tertiary"
              >
                {CHECK_LABELS[id]}
              </th>
            ))}
            <th
              scope="col"
              className="w-32 px-3 py-2 text-right text-xs font-medium text-text-tertiary"
            >
              Last change (UTC)
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((repo) => (
            <FleetRow key={repo.id} repo={repo} onOpen={onOpen} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Nothing registered is not the same as nothing to show. An empty table would
 * state that the fleet is clear; this states that the fleet is empty, and says
 * how to change that.
 */
function NoReposState(): ReactElement {
  return (
    <div className="rounded-card bg-card-bg p-6 shadow-card">
      <EmptyState
        icon={<ShieldCheck size={24} className="text-text-tertiary" />}
        title="No repositories registered yet."
        body={
          <>
            Readiness is read from repositories on this machine. Run{' '}
            <code className="font-mono text-sm">agentic-dashboard register &lt;path&gt;</code>{' '}
            to add one.
          </>
        }
      />
    </div>
  )
}

/**
 * Filters can empty the table too, and an empty table says "the fleet is
 * clear" — the same misreading the empty-registry state exists to prevent. It
 * has a different cause and so a different sentence.
 */
/**
 * No action of its own. The toolbar is keyed off the registry being non-empty,
 * not off the visible rows, so it and its "Clear filters" button are still
 * directly above this — and two identical exits a few pixels apart is worse
 * than one.
 */
function NoMatchesState(): ReactElement {
  return (
    <div className="rounded-card bg-card-bg p-6 shadow-card">
      <EmptyState
        icon={<ShieldCheck size={24} className="text-text-tertiary" />}
        title="No repositories match these filters."
        body="Every registered repository was excluded by the current selection."
      />
    </div>
  )
}

export function FleetPage(): ReactElement {
  const fleet = useFleet()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as FleetSearch
  const filters = parseFleetFilters(search)

  // `useNavigate()` without a `from` infers the root route, whose search type is
  // empty, so a concrete search object does not type-check against it. The
  // /coverage page casts for the same reason; the shape is guaranteed by
  // `serialiseFleetFilters` and by the route's own `validateSearch`.
  const nav = navigate as unknown as (opts: {
    search: FleetSearch
    replace: boolean
  }) => void

  const applyFilters = (next: FleetFilters): void => {
    nav({ search: serialiseFleetFilters(next), replace: true })
  }

  const openRepo = (repoId: string): void => {
    void navigate({ to: '/repos/$repoId', params: { repoId } })
  }

  const all = fleet.data?.repos ?? []
  const visible = all.filter((repo) => matchesFleetFilters(repo, filters))

  let content: ReactElement
  if (fleet.error?.message.startsWith('schema_drift:')) {
    content = (
      <SchemaDriftState
        firstIssue={{
          path: fleet.error.message.slice('schema_drift:'.length),
          expected: 'see schema',
          got: 'mismatch',
        }}
        fullIssues={[]}
        onRetry={() => void fleet.refetch()}
      />
    )
  } else if (fleet.isPending) {
    content = <LoadingState />
  } else if (fleet.isError || !fleet.data) {
    content = <ErrorState onRetry={() => void fleet.refetch()} />
  } else if (fleet.data.repos.length === 0) {
    content = <NoReposState />
  } else {
    content =
      visible.length === 0 ? (
        <NoMatchesState />
      ) : (
        <FleetTable repos={visible} onOpen={openRepo} />
      )
  }

  // Nothing to filter is not the same as filtering to nothing: the toolbar
  // stays out of the way until there is a fleet for it to narrow.
  const filterable = fleet.data !== undefined && fleet.data.repos.length > 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Fleet readiness"
        helper="Six checks per repository. Count the cells — there is no combined score."
        sticky={true}
      />
      {filterable && (
        <div className="flex flex-col gap-3">
          <FleetToolbar filters={filters} onChange={applyFilters} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
            <span>
              {hasActiveFilters(filters)
                ? `${visible.length} of ${all.length} ${plural(all.length)}`
                : `${all.length} ${plural(all.length)}`}
            </span>
            {fleet.data !== undefined && (
              <span>Readings computed {formatGeneratedAt(fleet.data.generatedAt)}</span>
            )}
            {hasActiveFilters(filters) && (
              <button
                type="button"
                onClick={() => applyFilters(EMPTY_FILTERS)}
                className="rounded-md px-2 py-1 text-xs font-medium text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}
      {content}
    </div>
  )
}
