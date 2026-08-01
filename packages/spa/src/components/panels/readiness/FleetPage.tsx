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
import { CHECK_IDS, type RepoSummary } from '@agenticapps/dashboard-shared'

import { useFleet } from '../../../lib/readinessQueries.js'
import { compareRepoSeverity } from '../../../lib/readinessOrder.js'
import { PageHeader } from '../../ui/PageHeader.js'

import { CHECK_LABELS, ReadinessIndicator } from './ReadinessIndicator.js'

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
        className="mt-4 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        Retry
      </button>
    </section>
  )
}

function FleetRow({ repo }: { repo: RepoSummary }): ReactElement {
  return (
    <tr className="border-t border-border-subtle">
      <td className="px-3 py-2 text-sm text-text-primary truncate">{repo.name}</td>
      <td colSpan={CHECK_IDS.length} className="px-3 py-2">
        <ReadinessIndicator checks={repo.checks} repoName={repo.name} variant="compact" />
      </td>
      <td className="px-3 py-2 text-sm text-text-secondary whitespace-nowrap">
        {formatLastChange(repo.lastCommitAt)}
      </td>
    </tr>
  )
}

function FleetTable({ repos }: { repos: readonly RepoSummary[] }): ReactElement {
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
            <FleetRow key={repo.id} repo={repo} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function FleetPage(): ReactElement {
  const fleet = useFleet()

  let content: ReactElement
  if (fleet.isPending) {
    content = <LoadingState />
  } else if (fleet.isError || !fleet.data) {
    content = <ErrorState onRetry={() => void fleet.refetch()} />
  } else {
    content = <FleetTable repos={fleet.data.repos} />
  }

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Fleet readiness"
        helper="Six checks per repository. Count the cells — there is no combined score."
        sticky={true}
      />
      {content}
    </main>
  )
}
