/**
 * ChangeDrawer.test.tsx — the detail drawer and the address that opens it.
 *
 * The address is three separate search parameters and never one composite. A
 * composite would need a separator, a separator needs a parser, and a parser
 * over author-controlled change names is the shape that produced
 * `fix-readiness-sanitiser-colon-hazard`. The tests below include a change name
 * carrying every printable separator anyone would reach for, because the point
 * is that no parsing happens rather than that the parsing is careful.
 */
import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { cardKey, type ChangeCard, type ChangesFleetResponse } from '@agenticapps/dashboard-shared'

const routerState = vi.hoisted(() => ({
  search: {} as { repo?: string; source?: string; change?: string },
  navigate: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => routerState.navigate,
    useSearch: () => routerState.search,
  }
})

vi.mock('../../../lib/changesQueries.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/changesQueries.js')>()),
  useChangesFleet: vi.fn(),
}))

vi.mock('./boardLayout.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./boardLayout.js')>()),
  useFourColumnLayout: () => true,
}))

import { useChangesFleet } from '../../../lib/changesQueries.js'
import { ChangeBoardRoute } from './ChangeBoardRoute.js'

const mockUseChangesFleet = vi.mocked(useChangesFleet)

afterEach(cleanup)
beforeEach(() => {
  routerState.search = {}
  routerState.navigate = vi.fn()
})

function card(overrides: Partial<ChangeCard> = {}): ChangeCard {
  const source = overrides.source ?? 'active'
  const instance = overrides.sourceInstance ?? 'add-thing'
  const repositoryId = overrides.repositoryId ?? 'repo-1'
  return {
    id: cardKey(repositoryId, source, instance),
    repositoryId,
    repositoryName: 'agenticapps-dashboard',
    source,
    sourceInstance: instance,
    changeName: instance,
    title: instance,
    stage: 'execute',
    ready: false,
    artifacts: { proposal: 'ready', deltaSpecCount: 2, tasks: 'ready', design: 'optional' },
    reviewerVendors: ['gemini'],
    hasRequestChanges: true,
    reviewRecord: 'REVIEWS-round-3.md',
    checklist: [
      { text: 'read the upstream reader', completed: true },
      { text: 'write the failing test', completed: false },
    ],
    completedChecklist: 1,
    totalChecklist: 2,
    archiveDate: null,
    updatedAt: 1_754_000_000_000,
    evidenceLimited: false,
    ...overrides,
  }
}

function renderRoute(cards: ChangeCard[]): void {
  const response: ChangesFleetResponse = {
    generatedAt: 1_754_000_000_000,
    cards,
    repositories: [{ id: 'repo-1', name: 'agenticapps-dashboard', read: 'ok', reason: null }],
    notices: [],
  }
  mockUseChangesFleet.mockReturnValue({
    data: response,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never)
  render(<ChangeBoardRoute />)
}

const openCard = (testCard: ChangeCard) =>
  fireEvent.click(screen.getByTestId(`change-card-${testCard.id}`))

// ── 6.1 what the drawer carries ─────────────────────────────────────────────

describe('the drawer', () => {
  it('opens over the board, leaving the board rendered', () => {
    const subject = card()
    renderRoute([subject])
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([subject])

    expect(screen.getByTestId('change-drawer')).toBeTruthy()
    // The board is still there behind it, which is the point of a drawer.
    expect(screen.getAllByTestId('stage-column-execute').length).toBeGreaterThan(0)
  })

  it('carries the repository, stage and source', () => {
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([card()])

    const drawer = screen.getByTestId('change-drawer')
    expect(within(drawer).getByText('agenticapps-dashboard')).toBeTruthy()
    expect(within(drawer).getByTestId('drawer-stage').textContent).toMatch(/execute/iu)
    expect(within(drawer).getByTestId('drawer-source').textContent).toMatch(/active/iu)
  })

  it('carries artifact presence', () => {
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([card()])

    const artifacts = within(screen.getByTestId('change-drawer')).getByTestId('drawer-artifacts')
    expect(artifacts.textContent).toMatch(/proposal/iu)
    expect(artifacts.textContent).toMatch(/tasks/iu)
    // Two delta specs, stated as a count rather than as presence.
    expect(artifacts.textContent).toContain('2')
  })

  it('names design.md as optional rather than missing', () => {
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([card()])

    const artifacts = within(screen.getByTestId('change-drawer')).getByTestId('drawer-artifacts')
    // `design.md` never affects a stage, so calling its absence "missing" would
    // report a defect that does not exist.
    expect(artifacts.textContent).not.toMatch(/design.*missing/iu)
  })

  it('carries the reviewer verdicts and names the record they came from', () => {
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([card()])

    const reviewers = within(screen.getByTestId('change-drawer')).getByTestId('drawer-reviewers')
    expect(reviewers.textContent).toContain('gemini')
    expect(reviewers.textContent).toMatch(/changes requested/iu)
    // The card names the record it was classified from, not merely that several exist.
    expect(reviewers.textContent).toContain('REVIEWS-round-3.md')
  })

  it('states when a change carries no review record at all', () => {
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([card({ reviewerVendors: [], hasRequestChanges: false, reviewRecord: null })])

    const reviewers = within(screen.getByTestId('change-drawer')).getByTestId('drawer-reviewers')
    expect(reviewers.textContent).toMatch(/no review/iu)
  })

  it('carries the checklist rows and their completion', () => {
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([card()])

    const checklist = within(screen.getByTestId('change-drawer')).getByTestId('drawer-checklist')
    expect(within(checklist).getByText('read the upstream reader')).toBeTruthy()
    expect(within(checklist).getByText('write the failing test')).toBeTruthy()
    expect(within(checklist).getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows the full change name even when the card elides it', () => {
    const long = 'add-agent-change-board-with-a-deliberately-very-long-name-indeed'
    routerState.search = { repo: 'repo-1', source: 'active', change: long }
    renderRoute([card({ sourceInstance: long, changeName: long, title: long })])

    expect(within(screen.getByTestId('change-drawer')).getByTestId('drawer-title').textContent)
      .toBe(long)
  })

  it('closes back to the board', () => {
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([card()])

    fireEvent.click(screen.getByRole('button', { name: /close/iu }))
    // Closing clears all three parameters together: a half-cleared address
    // would be a location that names no card.
    expect(routerState.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: { repo: undefined, source: undefined, change: undefined },
      }),
    )
  })
})

// ── 6.2 three separate parameters, never a composite ────────────────────────

describe('the address', () => {
  it('carries repository, source and change as three separate parameters', () => {
    renderRoute([card()])
    openCard(card())

    expect(routerState.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: { repo: 'repo-1', source: 'active', change: 'add-thing' },
      }),
    )
  })

  it('parses no separator out of a change name that contains every likely one', () => {
    // A legal-ish name carrying `:`, `/`, `|` and `,`. With a composite
    // parameter each of these is an injection into the surrounding grammar;
    // with three parameters there is nothing to inject into.
    const hostile = 'a:b/c|d,e'
    const subject = card({ sourceInstance: hostile, changeName: hostile, title: hostile })
    renderRoute([subject])
    openCard(subject)

    expect(routerState.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: { repo: 'repo-1', source: 'active', change: hostile },
      }),
    )

    routerState.search = { repo: 'repo-1', source: 'active', change: hostile }
    renderRoute([subject])
    expect(within(screen.getByTestId('change-drawer')).getByTestId('drawer-title').textContent)
      .toBe(hostile)
  })

  it('addresses by the source instance, so a dated archive is distinguishable', () => {
    const filed = card({
      source: 'archive',
      sourceInstance: '2026-08-02-add-thing',
      changeName: 'add-thing',
      title: 'add-thing',
      stage: 'archive',
      archiveDate: '2026-08-02',
    })
    renderRoute([filed])
    openCard(filed)

    // The dated basename, not the slug: two archives of one slug must address
    // distinctly.
    expect(routerState.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        search: { repo: 'repo-1', source: 'archive', change: '2026-08-02-add-thing' },
      }),
    )
  })
})

// ── 6.3 same name, different sources ────────────────────────────────────────

describe('a backlog entry and an active change of the same name', () => {
  const active = card({ source: 'active', sourceInstance: 'add-thing' })
  const backlog = card({
    source: 'backlog',
    sourceInstance: 'add-thing',
    changeName: 'add-thing',
    title: 'Add thing',
    stage: 'propose',
    checklist: [],
    completedChecklist: 0,
    totalChecklist: 0,
    reviewerVendors: [],
    hasRequestChanges: false,
    reviewRecord: null,
  })

  it('render as two cards', () => {
    renderRoute([active, backlog])
    expect(screen.getByTestId(`change-card-${active.id}`)).toBeTruthy()
    expect(screen.getByTestId(`change-card-${backlog.id}`)).toBeTruthy()
    expect(active.id).not.toBe(backlog.id)
  })

  it('address distinctly, differing only in the source parameter', () => {
    renderRoute([active, backlog])

    openCard(active)
    const activeCall = routerState.navigate.mock.calls.at(-1)![0] as { search: unknown }
    openCard(backlog)
    const backlogCall = routerState.navigate.mock.calls.at(-1)![0] as { search: unknown }

    expect(activeCall.search).toEqual({ repo: 'repo-1', source: 'active', change: 'add-thing' })
    expect(backlogCall.search).toEqual({ repo: 'repo-1', source: 'backlog', change: 'add-thing' })
  })

  it('open the right one of the two', () => {
    routerState.search = { repo: 'repo-1', source: 'backlog', change: 'add-thing' }
    renderRoute([active, backlog])

    const drawer = screen.getByTestId('change-drawer')
    expect(within(drawer).getByTestId('drawer-source').textContent).toMatch(/backlog/iu)
    expect(within(drawer).getByTestId('drawer-title').textContent).toBe('Add thing')
  })
})

// ── 6.4 deep links ──────────────────────────────────────────────────────────

describe('a deep link', () => {
  it('restores the drawer', () => {
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([card()])
    expect(screen.getByTestId('change-drawer')).toBeTruthy()
  })

  it('to a change that is not on the board renders the board and says so', () => {
    routerState.search = { repo: 'repo-1', source: 'active', change: 'no-such-change' }
    renderRoute([card()])

    expect(screen.queryByTestId('change-drawer')).toBeNull()
    expect(screen.getByTestId('change-not-found').textContent).toMatch(/not found/iu)
    // The board still renders: a bad link is not a blank page.
    expect(screen.getByTestId('stage-column-execute')).toBeTruthy()

    // The discriminating half: the *same* board with a good address does open a
    // drawer and reports nothing missing. Without this, a route that never
    // resolves any card satisfies the assertions above.
    cleanup()
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([card()])
    expect(screen.getByTestId('change-drawer')).toBeTruthy()
    expect(screen.queryByTestId('change-not-found')).toBeNull()
  })

  it('to a change in an unknown repository says the same', () => {
    routerState.search = { repo: 'repo-999', source: 'active', change: 'add-thing' }
    renderRoute([card()])
    expect(screen.getByTestId('change-not-found')).toBeTruthy()

    // Only the repository differs from an address that resolves.
    cleanup()
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([card()])
    expect(screen.queryByTestId('change-not-found')).toBeNull()
  })

  it('with only some parameters opens no drawer and reports nothing', () => {
    // A partial address names no card and is not a failed lookup either.
    routerState.search = { repo: 'repo-1' }
    renderRoute([card()])

    expect(screen.queryByTestId('change-drawer')).toBeNull()
    expect(screen.queryByTestId('change-not-found')).toBeNull()

    // Completing the address opens the drawer, so "no drawer" above is caused
    // by the partial address rather than by nothing ever opening.
    cleanup()
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([card()])
    expect(screen.getByTestId('change-drawer')).toBeTruthy()
  })

  it('opens no drawer when there is no address at all', () => {
    renderRoute([card()])
    expect(screen.queryByTestId('change-drawer')).toBeNull()
    expect(screen.queryByTestId('change-not-found')).toBeNull()
    // The board itself is present, so this is a board with nothing selected
    // rather than a board that failed to render.
    expect(screen.getByTestId('stage-column-execute')).toBeTruthy()

    cleanup()
    routerState.search = { repo: 'repo-1', source: 'active', change: 'add-thing' }
    renderRoute([card()])
    expect(screen.getByTestId('change-drawer')).toBeTruthy()
  })
})
