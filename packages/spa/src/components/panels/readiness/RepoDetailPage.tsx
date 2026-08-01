/**
 * RepoDetailPage.tsx — where a fleet row or cell lands.
 *
 * This is the header only. The six evidence blocks, the remedies, open-in-editor
 * and rescan are §10; §9 needs the surface to exist because its rows and cells
 * open it, and a link to a route that does not resolve is not a feature.
 *
 * The indicator renders here WITHOUT a `repoId`, so its cells stay figures.
 * Every one of them already points at this page.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA — inline className strings only
 * - NO hex literals — token names only
 */
import type { ReactElement, ReactNode } from 'react'
import { useParams } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import type { RepoDetail } from '@agenticapps/dashboard-shared'

import { ApiError } from '../../../lib/api.js'
import { useRepoDetail } from '../../../lib/readinessQueries.js'
import { SchemaDriftState } from '../../SchemaDriftState.js'

import {
  CHECK_LABELS,
  ReadinessIndicator,
  STATUS_PRESENTATION,
} from './ReadinessIndicator.js'

/** One detail result — the summary shape plus the remedy the detail wire adds. */
type DetailCheck = RepoDetail['checks'][number]

/** Where a declared value comes from. Named once so the copy cannot drift. */
const READINESS_FILE = '.agenticapps/readiness.json'

/**
 * UTC to the minute, the same rendering the cells use. Every time in this
 * feature is a git committer time, and a local rendering would invite comparing
 * it against a UTC one. A null renders an em dash rather than a substitute.
 */
function formatCommitTime(at: number | null): string {
  if (at === null) return '—'
  return `${new Date(at).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function NotRegisteredState({ repoId }: { repoId: string }): ReactElement {
  return (
    <section role="status" className="rounded-card bg-card-bg p-6 shadow-card">
      <h2 className="text-lg font-semibold text-text-primary">
        {repoId} is not registered.
      </h2>
      <p className="mt-2 text-sm text-text-tertiary">
        Readiness is only reported for repositories in the registry. Register it
        with <code className="font-mono">agentic-dashboard register &lt;path&gt;</code>.
      </p>
    </section>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }): ReactElement {
  return (
    <section role="status" className="rounded-card bg-card-bg p-6 shadow-card">
      <h2 className="text-lg font-semibold text-text-primary">
        Could not read this repository.
      </h2>
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

function DetailHeader({ repo }: { repo: RepoDetail }): ReactElement {
  return (
    <header className="flex flex-col gap-4 rounded-card bg-card-bg p-6 shadow-card">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-2xl font-semibold text-text-primary">{repo.name}</h1>
        <span className="text-sm text-text-tertiary">{repo.family}</span>
        <span className="text-sm text-text-secondary">
          Last change {formatCommitTime(repo.lastCommitAt)}
        </span>
        {repo.ready ? (
          <span className="text-sm font-medium text-status-success">Ready</span>
        ) : (
          <span className="text-sm text-text-secondary">Not ready</span>
        )}
      </div>

      {repo.notice !== null && (
        <p className="flex items-start gap-2 text-sm text-status-warning">
          <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>{repo.notice.message}</span>
        </p>
      )}

      <ReadinessIndicator checks={repo.checks} repoName={repo.name} variant="full" />
    </header>
  )
}

/**
 * A missing fact, rendered as itself. Its own element rather than punctuation
 * inside a sentence, so "there is no timestamp" is as readable as a timestamp.
 */
function EmDash(): ReactElement {
  return <span className="text-text-tertiary">—</span>
}

function Fact({ term, children }: { term: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-24 shrink-0 text-text-tertiary">{term}</dt>
      <dd className="min-w-0 break-words text-text-secondary">{children}</dd>
    </div>
  )
}

/**
 * One check, as one block on the page. Anchored at the check id because that is
 * the hash `ReadinessIndicator` links to — a fleet cell selects this element,
 * not just this route.
 *
 * Provenance is two rows rather than one sentence: whether the value was
 * derived or declared is a different fact from which file it came out of, and
 * a derived check that has never run has the first without the second. Saying
 * "derived from —" would read as a path that failed to load rather than a
 * check that has not happened.
 */
function CheckBlock({ check }: { check: DetailCheck }): ReactElement {
  const presentation = STATUS_PRESENTATION[check.status]
  const Shape = presentation.icon
  const headingId = `${check.id}-heading`
  // An evaluation error explains the status better than a summary can; a
  // summary is what `na` and `warn` are required to keep visible.
  const why = check.error?.message ?? (check.summary.trim() || null)

  return (
    <section
      id={check.id}
      aria-labelledby={headingId}
      className="scroll-mt-6 rounded-card bg-card-bg p-6 shadow-card"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={headingId} className="text-lg font-semibold text-text-primary">
          {CHECK_LABELS[check.id]}
        </h2>
        <span
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${presentation.bg} ${presentation.text}`}
        >
          <Shape size={14} aria-hidden="true" />
          {presentation.word}
        </span>
      </div>

      {why !== null && <p className="mt-3 text-sm text-text-secondary">{why}</p>}

      <dl className="mt-4 flex flex-col gap-1.5">
        <Fact term="Observed">
          {check.at === null ? <EmDash /> : formatCommitTime(check.at)}
        </Fact>
        <Fact term="Provenance">
          {check.source === 'declared' ? `Declared in ${READINESS_FILE}` : 'Derived'}
        </Fact>
        <Fact term="Evidence">
          {check.evidence === null ? (
            <EmDash />
          ) : (
            <code className="font-mono text-xs">{check.evidence.path}</code>
          )}
        </Fact>
      </dl>

      <p className="mt-4 text-sm text-text-primary">{check.remedy}</p>
    </section>
  )
}

export function RepoDetailPage(): ReactElement {
  const { repoId } = useParams({ strict: false }) as { repoId: string }
  const detail = useRepoDetail(repoId)

  if (detail.error?.message.startsWith('schema_drift:')) {
    return (
      <main>
        <SchemaDriftState
          firstIssue={{
            path: detail.error.message.slice('schema_drift:'.length),
            expected: 'see schema',
            got: 'mismatch',
          }}
          fullIssues={[]}
          onRetry={() => void detail.refetch()}
        />
      </main>
    )
  }
  if (detail.isPending) {
    return (
      <main>
        <div
          aria-label="Loading repository readiness"
          className="h-40 animate-pulse rounded-card bg-card-bg"
        />
      </main>
    )
  }
  if (detail.error instanceof ApiError && detail.error.status === 404) {
    return (
      <main>
        <NotRegisteredState repoId={repoId} />
      </main>
    )
  }
  if (detail.isError || !detail.data) {
    return (
      <main>
        <ErrorState onRetry={() => void detail.refetch()} />
      </main>
    )
  }

  return (
    <main className="flex flex-col gap-6">
      <DetailHeader repo={detail.data.repo} />
      {detail.data.repo.checks.map((check) => (
        <CheckBlock key={check.id} check={check} />
      ))}
    </main>
  )
}
