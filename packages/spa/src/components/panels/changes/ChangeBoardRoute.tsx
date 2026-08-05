/**
 * ChangeBoardRoute.tsx — the board plus the drawer it addresses.
 *
 * This component owns the address and nothing else: the board renders cards,
 * the drawer renders one card's detail, and this decides which card the
 * location names.
 *
 * **Three search parameters, never one composite.** `?repo=&source=&change=`
 * are matched by equality against the card's own three fields. Nothing is
 * split, joined, or unescaped, so a change name containing `:`, `/` or any
 * other separator is not a parsing problem — there is no parser for it to
 * confuse. That is the lesson of `fix-readiness-sanitiser-colon-hazard`,
 * applied by removing the failure mode rather than guarding it.
 *
 * `source` is in the address because it is in the identity: an active change
 * and an archived one of the same name are the ordinary case, since archiving
 * keeps the slug and only prefixes a date, and `(repo, change)` collides on
 * exactly that pair. Note it is *not* the backlog/active pair — `occupiedSlugs`
 * suppresses a backlog entry whose slug is already a change, so no reader can
 * emit that one. §12.2 corrected the spec scenario for the same reason.
 */
import type { ReactElement } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { ChangeCard } from '@agenticapps/dashboard-shared'

import { useChangesFleet } from '../../../lib/changesQueries.js'

import { ChangeBoardPage } from './ChangeBoardPage.js'
import { ChangeDrawer } from './ChangeDrawer.js'

interface ChangeSearch {
  // `| undefined` explicitly, not just optional: `exactOptionalPropertyTypes`
  // is on, and clearing the address means *writing* undefined to all three
  // rather than omitting them.
  repo?: string | undefined
  source?: string | undefined
  change?: string | undefined
}

/** The cleared address. All three together: a half-cleared one names no card. */
const CLOSED: ChangeSearch = { repo: undefined, source: undefined, change: undefined }

export function ChangeBoardRoute(): ReactElement {
  const board = useChangesFleet()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as ChangeSearch

  // `useNavigate()` without a `from` infers the root route, whose search type is
  // empty, so a concrete search object does not type-check against it. The
  // /fleet and /coverage pages cast for the same reason; the shape is
  // guaranteed by the route's own `validateSearch`.
  const nav = navigate as unknown as (opts: { search: ChangeSearch; replace: boolean }) => void

  const open = (card: ChangeCard): void => {
    nav({
      search: {
        repo: card.repositoryId,
        source: card.source,
        change: card.sourceInstance,
      },
      replace: false,
    })
  }

  const addressed =
    search.repo !== undefined && search.source !== undefined && search.change !== undefined

  // Equality on three fields. No split, no unescape, no separator.
  const selected = addressed
    ? board.data?.cards.find(
        (card) =>
          card.repositoryId === search.repo
          && card.source === search.source
          && card.sourceInstance === search.change,
      )
    : undefined

  // A location that names a change the board does not hold. Distinct from no
  // address at all, which is simply a board with nothing selected.
  const notFound = addressed && board.data !== undefined && selected === undefined

  return (
    <>
      {notFound && (
        <p
          data-testid="change-not-found"
          role="status"
          className="rounded-card border border-border-subtle bg-card-bg px-4 py-3 text-sm text-text-secondary"
        >
          That change was not found on this board. It may have been archived,
          renamed, or its repository unregistered.
        </p>
      )}
      <ChangeBoardPage onOpenCard={open} />
      {selected !== undefined && (
        <ChangeDrawer card={selected} onClose={() => nav({ search: CLOSED, replace: false })} />
      )}
    </>
  )
}
