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
import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { useLocation, useParams } from '@tanstack/react-router'
import { AlertTriangle, ChevronRight, PenLine, RefreshCw } from 'lucide-react'
import { isReadableProjectPath, type RepoDetail } from '@agenticapps/dashboard-shared'

import { ApiError } from '../../../lib/api.js'
import {
  useEvidence,
  useOpenInEditor,
  useRepoDetail,
  useRescanRepo,
} from '../../../lib/readinessQueries.js'
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

const ACTION_CLASS =
  'flex items-center gap-1.5 rounded-md border border-border-subtle px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-app-bg hover:text-text-primary disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg'

/**
 * Why an editor action can fail, said in the reader's terms. `$EDITOR` is the
 * user's own shell configuration, so the fix is theirs and naming the variable
 * is the whole instruction.
 */
function editorProblem(error: Error | null): string | null {
  if (!(error instanceof ApiError)) return error === null ? null : 'Could not open the editor.'
  if (error.code === 'editor_not_configured') {
    return 'No EDITOR is set on the machine running the daemon. Set it and try again.'
  }
  return 'Could not open the editor.'
}

function DetailHeader({
  repo,
  generatedAt,
}: {
  repo: RepoDetail
  generatedAt: number
}): ReactElement {
  const rescan = useRescanRepo(repo.id)
  const openInEditor = useOpenInEditor(repo.id)
  const editorError = openInEditor.isError ? editorProblem(openInEditor.error) : null

  return (
    <header className="flex flex-col gap-4 rounded-card bg-card-bg p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
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

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => openInEditor.mutate()}
            disabled={openInEditor.isPending}
            className={ACTION_CLASS}
          >
            <PenLine size={14} aria-hidden="true" />
            Open in editor
          </button>
          <button
            type="button"
            onClick={() => rescan.mutate()}
            disabled={rescan.isPending}
            className={ACTION_CLASS}
          >
            <RefreshCw
              size={14}
              aria-hidden="true"
              className={rescan.isPending ? 'animate-spin' : undefined}
            />
            {rescan.isPending ? 'Rescanning…' : 'Rescan'}
          </button>
        </div>
      </div>

      {/*
        When the reading was taken, not when it was served. The daemon replays a
        memoised response with its original time, so this is what tells a fresh
        answer from a cached one — and it is the only place on the page entitled
        to show it.
      */}
      <p className="text-xs text-text-tertiary">
        Readiness as of {formatCommitTime(generatedAt)}
      </p>

      {/*
        One live region, always mounted, whose *content* changes. A `role="status"`
        inserted into the DOM together with its text is routinely not announced —
        the region has to be there before the message arrives for the change to
        be a change. These two messages are the only feedback either button gives
        on failure, so silence here means the click appears to have done nothing.
      */}
      <div role="status" aria-live="polite" className="empty:hidden">
        {editorError !== null && (
          <p className="flex items-start gap-2 text-sm text-status-error">
            <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>{editorError}</span>
          </p>
        )}
        {rescan.isError && (
          <p className="flex items-start gap-2 text-sm text-status-error">
            <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>Could not rescan this repository. The reading below is the previous one.</span>
          </p>
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
function CheckBlock({
  check,
  repoId,
}: {
  check: DetailCheck
  repoId: string
}): ReactElement {
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
      // Focusable, not tabbable: a fleet cell moves focus here so the reader's
      // next Tab continues from the check they asked for, but the six blocks
      // must not each become a tab stop of their own.
      tabIndex={-1}
      className="scroll-mt-6 rounded-card bg-card-bg p-6 shadow-card focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
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
          {check.source === 'declared'
            ? `Declared in ${READINESS_FILE}`
            : check.evidence === null
              ? // Named, not shrugged at. Several derivers legitimately produce
                // no evidence file — the spec check has none for `ok` or
                // `warn`, which is every healthy repo — and a bare "Derived"
                // there answered "where did this come from?" with nothing.
                'Derived by the daemon from this repo, with no single file behind it'
              : 'Derived'}
        </Fact>
        <Fact term="Evidence">
          {check.evidence === null ? (
            <EmDash />
          ) : isReadableProjectPath(check.evidence.path) ? (
            <Evidence repoId={repoId} path={check.evidence.path} />
          ) : (
            // Named, not offered. The read route serves `.planning`, `.claude`
            // and `openspec` only, and a control over anything else would
            // promise a file the daemon answers with 422 — the coverage
            // artifact and most declared paths land here.
            <code className="font-mono text-xs">{check.evidence.path}</code>
          )}
        </Fact>
      </dl>

      <p className="mt-4 text-sm text-text-primary">{check.remedy}</p>
    </section>
  )
}

/**
 * The evidence file, opened in place. A control rather than a hyperlink because
 * the daemon authenticates with a bearer header: an `<a href>` cannot carry
 * one, and a token in the query string would write itself into browser history
 * and every log between here and the daemon. Opening it in place also keeps the
 * page the single scrollable surface the spec asks for.
 */
function Evidence({ repoId, path }: { repoId: string; path: string }): ReactElement {
  const [open, setOpen] = useState(false)
  const file = useEvidence(repoId, path, open)

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex items-center gap-1.5 rounded-md font-mono text-xs text-accent underline decoration-dotted underline-offset-2 hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
      >
        <ChevronRight
          size={12}
          aria-hidden="true"
          className={open ? 'rotate-90 transition-transform' : 'transition-transform'}
        />
        {path}
      </button>

      {open && (
        <div className="mt-2">
          {file.isPending ? (
            <p className="text-xs text-text-tertiary">Reading {path}…</p>
          ) : file.isError || !file.data ? (
            // Stated without a cause. The offer is made on the path's shape
            // alone, so a failure here can be a directory, a deleted file, or
            // a symlink out of the repo — naming one would be a guess, and
            // usually the wrong one.
            <p className="text-xs text-status-error">Could not read {path}.</p>
          ) : (
            // A capped, scrolling region. `tabIndex={0}` is what lets a
            // keyboard user reach the rest of a file taller than the cap —
            // without it the overflow is pointer-only. Named, so the focus
            // stop announces which file it is scrolling.
            <pre
              role="region"
              aria-label={path}
              tabIndex={0}
              className="max-h-80 overflow-auto rounded-md bg-app-bg p-3 font-mono text-xs whitespace-pre-wrap text-text-secondary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg"
            >
              {file.data.content}
            </pre>
          )}
        </div>
      )}
    </>
  )
}

/**
 * Land on the check the fleet cell named.
 *
 * The router does its own hash scrolling, but it does it once, on the route's
 * first commit — at which point this page is still rendering its loading
 * skeleton and no element carries that id yet. `getElementById` returns null,
 * nothing retries, and the reader arrives at the top of the page having asked
 * for one specific check. So the scroll has to happen when the data does.
 *
 * Focus moves too. Scrolling satisfies the eye; a keyboard user whose next Tab
 * resumes from the top of the document has been sent nowhere. `tabIndex={-1}`
 * on the block makes it a focus target without making it a tab stop.
 */
function useLandOnHashedCheck(ready: boolean): void {
  const { hash } = useLocation()
  const landed = useRef(false)

  useEffect(() => {
    if (!ready || landed.current) return
    const id = hash.replace(/^#/, '')
    if (id === '') return
    const target = document.getElementById(id)
    if (target === null) return

    landed.current = true
    target.scrollIntoView({ block: 'start' })
    target.focus({ preventScroll: true })
  }, [ready, hash])
}

export function RepoDetailPage(): ReactElement {
  const { repoId } = useParams({ strict: false }) as { repoId: string }
  const detail = useRepoDetail(repoId)
  useLandOnHashedCheck(detail.data !== undefined)

  if (detail.error?.message.startsWith('schema_drift:')) {
    return (
      <div>
        <SchemaDriftState
          firstIssue={{
            path: detail.error.message.slice('schema_drift:'.length),
            expected: 'see schema',
            got: 'mismatch',
          }}
          fullIssues={[]}
          onRetry={() => void detail.refetch()}
        />
      </div>
    )
  }
  if (detail.isPending) {
    return (
      <div>
        {/*
          `aria-label` on a bare div is ignored — an element with no role has
          nothing for the name to attach to. `role="status"` gives it one and
          makes the wait announceable rather than silent.
        */}
        <div
          role="status"
          aria-label="Loading repository readiness"
          className="h-40 animate-pulse rounded-card bg-card-bg"
        />
      </div>
    )
  }
  if (detail.error instanceof ApiError && detail.error.status === 404) {
    return (
      <div>
        <NotRegisteredState repoId={repoId} />
      </div>
    )
  }
  if (detail.isError || !detail.data) {
    return (
      <div>
        <ErrorState onRetry={() => void detail.refetch()} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <DetailHeader repo={detail.data.repo} generatedAt={detail.data.generatedAt} />
      {detail.data.repo.checks.map((check) => (
        <CheckBlock key={check.id} check={check} repoId={detail.data.repo.id} />
      ))}
    </div>
  )
}
