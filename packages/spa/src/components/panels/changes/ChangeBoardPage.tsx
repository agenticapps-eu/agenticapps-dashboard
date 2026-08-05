/**
 * ChangeBoardPage.tsx — the fleet OpenSpec change board.
 *
 * Four lifecycle columns, one card per admitted change across every registered
 * repository. Kanban rather than a table because recognition across this board
 * and the terminal one that already has this job is worth more than the density
 * a table would buy — stage is a *place* here, not a value you scan a column
 * for (design decision 6).
 *
 * ## The three empty boards
 *
 * A board with no cards has three quite different causes, and the requirement
 * is that they must not look alike:
 *
 * - **empty** — every repository read, none has work in flight.
 * - **all-failed** — no repository could be read at all.
 * - **degraded** — some read, some did not; the cards shown are a partial fleet.
 *
 * `fleetReadState` is the single decision, in shared, so the daemon and the
 * board cannot disagree about which one this is. `repo-readiness` shipped a
 * surface where a dropped repository read as a clear fleet; this is that lesson
 * applied before rather than after.
 *
 * ## Ordering
 *
 * `compareChangeCards` is shared and is applied here as well as by the daemon.
 * Applying one total order twice is idempotent, so the two can never disagree —
 * which is the hazard the readiness fleet's client-only sort exists to avoid,
 * and it is avoided here differently rather than ignored.
 *
 * Constraints (D-5.1-10):
 * - NO cn()/clsx/CVA — inline className strings only
 * - NO hex literals — token names only
 */
import { useState, type ReactElement } from 'react'
import { AlertTriangle, LayoutGrid } from 'lucide-react'
import {
  CHANGE_STAGES,
  compareChangeCards,
  fleetReadState,
  type ChangeCard as ChangeCardData,
  type ChangeNotice,
  type ChangeRepositoryStatus,
  type ChangesFleetResponse,
  type ChangeStage,
} from '@agenticapps/dashboard-shared'

import { useChangesFleet } from '../../../lib/changesQueries.js'
import { ApiError } from '../../../lib/api.js'
import { SchemaDriftError } from '../../../lib/readinessQueries.js'
import { EmptyState } from '../../ui/EmptyState.js'
import { PageHeader } from '../../ui/PageHeader.js'
import { SchemaDriftState } from '../../SchemaDriftState.js'

import { useFourColumnLayout } from './boardLayout.js'
import { STAGE_LABELS, StageColumn } from './StageColumn.js'

/** Why a repository contributed nothing, in words a reader can act on. */
const FAILURE_PHRASES: Record<NonNullable<ChangeRepositoryStatus['reason']>, string> = {
  unreachable: 'unreachable',
  timeout: 'took too long to read',
  unreadable: 'could not be read',
}

/**
 * A notice in words. The wire vocabulary is symbolic and path-free by
 * construction, so this is where it becomes a sentence — and the sentence is
 * built here from the symbol rather than sent, which is what keeps a filesystem
 * path from ever having somewhere to travel.
 */
function noticePhrase(notice: ChangeNotice): string {
  const where = notice.changeName === undefined ? '' : ` (${notice.changeName})`
  switch (notice.kind) {
    case 'truncated':
      return `${notice.repositoryName}: showing ${notice.admitted ?? 0} of ${notice.observed ?? 0} ${notice.source} records.`
    case 'collision':
      return `${notice.repositoryName}: two ${notice.source} entries share one name${where}.`
    case 'empty-slug':
      return `${notice.repositoryName}: a ${notice.source} entry has no usable name.`
    case 'evidence-limited':
      return `${notice.repositoryName}: some evidence was too large to read${where}.`
    case 'malformed':
      return `${notice.repositoryName}: a ${notice.source} entry could not be read${where}.`
    case 'rejected':
      return `${notice.repositoryName}: a ${notice.source} entry was refused${where}.`
  }
}

function LoadingState(): ReactElement {
  return (
    // `role="status"` because `aria-label` is prohibited on the implicit
    // `generic` role and is dropped from the accessibility tree — the name was
    // present in the markup and absent to a screen reader. The board's other
    // three states already carry it.
    <div role="status" aria-label="Loading the change board" className="grid gap-4" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
      {[1, 2, 3, 4].map((col) => (
        <div key={col} className="flex flex-col gap-2">
          {[1, 2, 3].map((row) => (
            <div key={row} className="h-20 animate-pulse motion-reduce:animate-none rounded-card bg-card-bg" />
          ))}
        </div>
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }): ReactElement {
  return (
    <section data-testid="board-error" role="status" className="rounded-card bg-card-bg p-6 shadow-card">
      <h2 className="text-lg font-semibold text-text-primary">Could not read the board.</h2>
      <p className="mt-2 max-w-prose text-sm text-text-tertiary">
        The daemon did not answer. Changes are read from your machine, so nothing
        is cached remotely to fall back on.
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
 * The daemon answered, and it does not know this route. Deliberately not the
 * error state: this dashboard ships from Pages and updates on deploy, while
 * the daemon it reads is installed locally and updates when its owner says
 * so — a build that knows the board talking to a daemon that does not is the
 * ordinary case. `ErrorState` would blame the connection and leave the one
 * action that fixes it unsaid.
 */
function DaemonOutdatedState(): ReactElement {
  return (
    <section
      data-testid="board-daemon-outdated"
      role="status"
      className="rounded-card bg-card-bg p-6 shadow-card"
    >
      <h2 className="text-lg font-semibold text-text-primary">
        This daemon does not have the change board.
      </h2>
      <p className="mt-2 max-w-prose text-sm text-text-tertiary">
        The dashboard reached your daemon, but it is older than this board and
        does not serve it. Update the daemon on this machine, then reload.
      </p>
    </section>
  )
}

/**
 * Every repository failed. Deliberately not the empty state: a fleet nobody
 * could read is not a fleet with nothing in it, and rendering the second for
 * the first tells the reader their work has disappeared.
 */
function AllFailedState({
  repositories,
}: {
  repositories: readonly ChangeRepositoryStatus[]
}): ReactElement {
  return (
    <section
      data-testid="board-all-failed"
      role="status"
      className="rounded-card bg-card-bg p-6 shadow-card"
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
        <AlertTriangle size={18} aria-hidden="true" className="text-status-warning" />
        No repository could be read.
      </h2>
      <p className="mt-2 max-w-prose text-sm text-text-tertiary">
        Every registered repository failed, so this board is not showing an empty
        fleet — it is showing nothing at all.
      </p>
      <ul className="mt-3 flex flex-col gap-1 text-sm text-text-secondary">
        {repositories.map((repo) => (
          <li key={repo.id}>
            {repo.name}: {repo.reason === null ? 'could not be read' : FAILURE_PHRASES[repo.reason]}
          </li>
        ))}
      </ul>
    </section>
  )
}

function EmptyBoardState(): ReactElement {
  return (
    <div data-testid="board-empty" className="rounded-card bg-card-bg p-6 shadow-card">
      <EmptyState
        icon={<LayoutGrid size={24} className="text-text-tertiary" />}
        title="No changes in flight."
        body={
          <>
            Every registered repository was read and none has an open change, a
            dated archive entry, or an unresolved backlog item.
          </>
        }
      />
    </div>
  )
}

/** Some repositories are missing from this board, and it says which. */
function DegradedNotice({
  repositories,
}: {
  repositories: readonly ChangeRepositoryStatus[]
}): ReactElement {
  const failed = repositories.filter((repo) => repo.read === 'failed')
  return (
    <section
      data-testid="board-degraded"
      role="status"
      className="rounded-card border border-status-warning/40 bg-card-bg px-4 py-3"
    >
      <p className="flex items-start gap-2 text-sm text-text-secondary">
        <AlertTriangle size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-status-warning" />
        <span>
          This board is incomplete.{' '}
          {failed
            .map((repo) => `${repo.name}: ${repo.reason === null ? 'could not be read' : FAILURE_PHRASES[repo.reason]}`)
            .join('; ')}
          .
        </span>
      </p>
    </section>
  )
}

/** What each repository lost inside an otherwise successful read. */
function NoticeList({ notices }: { notices: readonly ChangeNotice[] }): ReactElement {
  return (
    <section data-testid="board-notices" className="rounded-card bg-card-bg px-4 py-3">
      <ul className="flex flex-col gap-1 text-xs text-text-tertiary">
        {notices.map((notice, index) => (
          <li key={`${notice.repositoryId}-${notice.source}-${notice.kind}-${index}`}>
            {noticePhrase(notice)}
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The stage rail, shown only when four columns cannot fit.
 *
 * It names every stage and its count, so the stages that are not currently
 * displayed are still legible and still reachable — which is the property the
 * requirement protects, rather than the columns themselves.
 */
function StageRail({
  counts,
  selected,
  onSelect,
}: {
  counts: Record<ChangeStage, number>
  selected: ChangeStage
  onSelect: (stage: ChangeStage) => void
}): ReactElement {
  // A real tab widget, not the ARIA of one. The first draft declared
  // `role="tablist"` with no `aria-controls`, no `tabpanel` anywhere in the
  // document, every tab in the tab sequence, and no arrow-key handling — it
  // announced a pattern and behaved as four buttons, which is worse than
  // claiming nothing.
  function onKeyDown(event: React.KeyboardEvent, index: number): void {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    // Wraps at both ends rather than dead-ending, per the APG.
    const next = CHANGE_STAGES[(index + delta + CHANGE_STAGES.length) % CHANGE_STAGES.length]!
    onSelect(next)
    document.getElementById(`stage-tab-${next}`)?.focus()
  }

  return (
    <div
      data-testid="stage-rail"
      role="tablist"
      aria-label="Lifecycle stage"
      className="flex gap-1 overflow-x-auto rounded-card bg-card-bg p-1"
    >
      {CHANGE_STAGES.map((stage, index) => {
        const active = stage === selected
        return (
          <button
            key={stage}
            id={`stage-tab-${stage}`}
            type="button"
            role="tab"
            aria-selected={active}
            // Only on the selected tab: the other three panels are not in the
            // DOM, and a dangling IDREF is worse than an absent attribute.
            aria-controls={active ? `stage-panel-${stage}` : undefined}
            // Roving: one tab in the sequence, arrows move between them.
            tabIndex={active ? 0 : -1}
            onKeyDown={(event) => onKeyDown(event, index)}
            onClick={() => onSelect(stage)}
            className={
              active
                ? 'flex-1 whitespace-nowrap rounded-md bg-accent-bg px-3 py-2 text-xs font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
                : 'flex-1 whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium text-text-tertiary hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
            }
          >
            {STAGE_LABELS[stage]} <span className="tabular-nums">{counts[stage]}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Which repositories the board is showing.
 *
 * Three repositories plus "All" is four options, inside the visible-options
 * budget — and it is the difference between "what needs me in cparx" being a
 * question you answer and one you scroll for. Hidden below two repositories,
 * where it would only ever restate the board.
 */
function RepositoryFilter({
  repositories,
  selected,
  onSelect,
}: {
  repositories: readonly ChangeRepositoryStatus[]
  selected: string | null
  onSelect: (repositoryId: string | null) => void
}): ReactElement {
  // `py-1.5` clears the 24px AA tap-target floor, which `py-1` missed at 22.7px.
  // The selected chip carries a border as well as a tint: the tint alone is
  // 1.16:1 against the surrounding surface, so selection was signalled by hue
  // and font weight and nothing else.
  const chip = (active: boolean) =>
    active
      ? 'rounded-md border border-accent bg-accent-bg px-2.5 py-1.5 text-xs font-semibold text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
      : 'rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium text-text-tertiary hover:bg-card-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'

  return (
    <div
      data-testid="repository-filter"
      className="flex flex-wrap items-center gap-1 rounded-card bg-card-bg p-1"
    >
      <button
        type="button"
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
        className={chip(selected === null)}
      >
        All repositories
      </button>
      {repositories.map((repo) => (
        <button
          key={repo.id}
          type="button"
          aria-pressed={selected === repo.id}
          onClick={() => onSelect(repo.id)}
          className={chip(selected === repo.id)}
        >
          {repo.name}
        </button>
      ))}
    </div>
  )
}

/** When the readings were computed, to the minute, in UTC. */
function formatGeneratedAt(at: number): string {
  return `${new Date(at).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function groupByStage(cards: readonly ChangeCardData[]): Record<ChangeStage, ChangeCardData[]> {
  const grouped = {
    propose: [] as ChangeCardData[],
    validate: [] as ChangeCardData[],
    execute: [] as ChangeCardData[],
    archive: [] as ChangeCardData[],
  }
  // Sorted before grouping, so each column inherits one total order rather than
  // four independently-sorted ones.
  for (const card of [...cards].sort(compareChangeCards)) grouped[card.stage].push(card)
  return grouped
}

export function ChangeBoardPage({
  onOpenCard,
}: {
  /** Supplied by the route, which owns the drawer's address. */
  onOpenCard?: (card: ChangeCardData) => void
} = {}): ReactElement {
  const board = useChangesFleet()
  const fourColumn = useFourColumnLayout()
  const [stage, setStage] = useState<ChangeStage | null>(null)
  const [repositoryId, setRepositoryId] = useState<string | null>(null)

  const open = (card: ChangeCardData): void => onOpenCard?.(card)

  let content: ReactElement
  let response: ChangesFleetResponse | undefined

  if (board.error instanceof ApiError && board.error.status === 404) {
    // The route is absent, not the daemon. `GET` on this path can only 404 by
    // not being routed — the handler itself never answers 404.
    content = <DaemonOutdatedState />
  } else if (board.error instanceof SchemaDriftError) {
    // Checked before the general error branch, which would otherwise name the
    // wrong cause: the daemon answered, and it answered with a shape this
    // build cannot read. `FleetPage` fixed this same collapse once already.
    content = (
      <SchemaDriftState
        firstIssue={board.error.drift}
        fullIssues={board.error.drift.issues}
        onRetry={() => void board.refetch()}
      />
    )
  } else if (board.isPending) {
    content = <LoadingState />
  } else if (board.isError || !board.data) {
    content = <ErrorState onRetry={() => void board.refetch()} />
  } else {
    response = board.data
    const state = fleetReadState(response)
    const visibleCards =
      repositoryId === null
        ? response.cards
        : response.cards.filter((card) => card.repositoryId === repositoryId)
    const grouped = groupByStage(visibleCards)
    const counts = {
      propose: grouped.propose.length,
      validate: grouped.validate.length,
      execute: grouped.execute.length,
      archive: grouped.archive.length,
    }

    // The fullest stage that is not Archive — Archive is finished work, and
    // opening on it would answer a question nobody asked.
    //
    // This said "fullest" and did `.find(counts[c] > 0)`, which is *latest
    // non-empty*: on the live fleet it opened Execute (2 cards) over Validate
    // (12). The test that was meant to cover it had one non-empty stage, so
    // both readings agreed and it passed either way.
    const fallback = (['propose', 'validate', 'execute'] as const).reduce(
      (best, candidate) => (counts[candidate] > counts[best] ? candidate : best),
    )
    const selectedStage = stage ?? fallback

    if (state === 'all-failed') {
      content = <AllFailedState repositories={response.repositories} />
    } else if (state === 'empty') {
      content = <EmptyBoardState />
    } else {
      content = fourColumn ? (
        <div
          className="grid items-start gap-4"
          style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
        >
          {CHANGE_STAGES.map((each) => (
            <StageColumn key={each} stage={each} cards={grouped[each]} onOpen={open} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <StageRail counts={counts} selected={selectedStage} onSelect={setStage} />
          <StageColumn
            stage={selectedStage}
            cards={grouped[selectedStage]}
            onOpen={open}
            paged={true}
          />
        </div>
      )
    }
  }

  const degraded = response !== undefined && fleetReadState(response) === 'degraded'

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Changes"
        helper="Every OpenSpec change in flight across the fleet, by lifecycle stage."
        sticky={true}
      />
      {/* Above the board, not inside it: an incomplete board is a fact about
          the whole reading, not about any one column. */}
      {degraded && <DegradedNotice repositories={response!.repositories} />}
      {response !== undefined && response.repositories.length > 1 && (
        <RepositoryFilter
          repositories={response.repositories}
          selected={repositoryId}
          onSelect={setRepositoryId}
        />
      )}
      {response !== undefined && response.notices.length > 0 && (
        <NoticeList notices={response.notices} />
      )}
      {response !== undefined && (
        <p className="text-xs text-text-tertiary">
          Readings computed {formatGeneratedAt(response.generatedAt)}
        </p>
      )}
      {content}
    </div>
  )
}
