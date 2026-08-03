/**
 * ChangeBoardPage.test.tsx — the four columns, the paged fallback, and the
 * states that must not look like each other.
 *
 * The degradation cases carry the weight. A board that renders no cards because
 * nothing could be read must not look like a board that renders no cards
 * because there is no work in flight — `repo-readiness` shipped that confusion
 * once already.
 */
import React from 'react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cardKey,
  compareChangeCards,
  type ChangeCard,
  type ChangesFleetResponse,
  type ChangeStage,
} from '@agenticapps/dashboard-shared'

const routerState = vi.hoisted(() => ({
  search: {} as Record<string, unknown>,
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

/** The layout hook is matchMedia-backed; each test states which layout it wants. */
const layout = vi.hoisted(() => ({ fourColumn: true }))
vi.mock('./boardLayout.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./boardLayout.js')>()),
  useFourColumnLayout: () => layout.fourColumn,
}))

import { useChangesFleet } from '../../../lib/changesQueries.js'
import { ChangeBoardPage } from './ChangeBoardPage.js'

const mockUseChangesFleet = vi.mocked(useChangesFleet)

afterEach(cleanup)
beforeEach(() => {
  layout.fourColumn = true
  routerState.search = {}
  routerState.navigate = vi.fn()
})

let counter = 0

function card(overrides: Partial<ChangeCard> = {}): ChangeCard {
  counter += 1
  const source = overrides.source ?? 'active'
  const instance = overrides.sourceInstance ?? `change-${counter}`
  const repositoryId = overrides.repositoryId ?? 'repo-1'
  return {
    id: cardKey(repositoryId, source, instance),
    repositoryId,
    repositoryName: 'agenticapps-dashboard',
    source,
    sourceInstance: instance,
    changeName: instance,
    title: instance,
    stage: 'validate',
    ready: false,
    artifacts: { proposal: 'ready', deltaSpecCount: 1, tasks: 'ready', design: 'optional' },
    reviewerVendors: [],
    hasRequestChanges: false,
    reviewRecord: null,
    checklist: [{ text: 'a', completed: false }],
    completedChecklist: 0,
    totalChecklist: 1,
    archiveDate: null,
    updatedAt: 1_754_000_000_000,
    evidenceLimited: false,
    ...overrides,
    // Recomputed last so an overridden source/instance stays consistent with id.
    ...(overrides.id ? { id: overrides.id } : {}),
  }
}

function fleet(overrides: Partial<ChangesFleetResponse> = {}): ChangesFleetResponse {
  return {
    generatedAt: 1_754_000_000_000,
    cards: [],
    repositories: [{ id: 'repo-1', name: 'agenticapps-dashboard', read: 'ok', reason: null }],
    notices: [],
    ...overrides,
  }
}

function renderBoard(response: ChangesFleetResponse | null, state: 'ok' | 'pending' | 'error' = 'ok') {
  mockUseChangesFleet.mockReturnValue({
    data: state === 'ok' ? response : undefined,
    isPending: state === 'pending',
    isError: state === 'error',
    error: state === 'error' ? new Error('daemon unreachable') : null,
    refetch: vi.fn(),
  } as never)
  return render(<ChangeBoardPage />)
}

const column = (stage: ChangeStage) => screen.getByTestId(`stage-column-${stage}`)

// ── 5.1 four columns, headers, empty stages ─────────────────────────────────

describe('the four columns', () => {
  it('renders all four stage columns at the reference layout', () => {
    // One card, because a fleet with no cards at all renders the explicit
    // "no changes in flight" state rather than four empty columns — the two
    // are different answers and the empty-board tests below cover the other.
    renderBoard(fleet({ cards: [card({ stage: 'propose' })] }))
    for (const stage of ['propose', 'validate', 'execute', 'archive'] as const) {
      expect(column(stage)).toBeTruthy()
    }
  })

  it('names each column and states its count', () => {
    renderBoard(
      fleet({
        cards: [
          card({ stage: 'propose' }),
          card({ stage: 'validate' }),
          card({ stage: 'validate' }),
        ],
      }),
    )

    expect(within(column('propose')).getByTestId('stage-heading').textContent).toContain('Propose')
    expect(within(column('propose')).getByTestId('stage-heading').textContent).toContain('1')
    expect(within(column('validate')).getByTestId('stage-heading').textContent).toContain('2')
    expect(within(column('execute')).getByTestId('stage-heading').textContent).toContain('0')
  })

  it('renders the columns in pipeline order', () => {
    renderBoard(fleet({ cards: [card({ stage: 'execute' })] }))
    const headings = screen
      .getAllByTestId('stage-heading')
      .map((node) => node.textContent ?? '')
    expect(headings.map((text) => text.split('·')[0]!.trim())).toEqual([
      'Propose',
      'Validate',
      'Execute',
      'Archive',
    ])
  })

  it('states that an empty stage has no changes rather than rendering blank', () => {
    renderBoard(fleet({ cards: [card({ stage: 'propose' })] }))

    expect(within(column('validate')).getByText('No changes')).toBeTruthy()
    expect(within(column('propose')).queryByText('No changes')).toBeNull()
  })

  it('places each card in the column for its stage', () => {
    renderBoard(
      fleet({
        cards: [
          card({ stage: 'propose', sourceInstance: 'p', changeName: 'p', title: 'p' }),
          card({ stage: 'archive', sourceInstance: 'a', changeName: 'a', title: 'a' }),
        ],
      }),
    )
    expect(within(column('propose')).getByText('p')).toBeTruthy()
    expect(within(column('archive')).getByText('a')).toBeTruthy()
  })
})

// ── 5.2 the paged layout ────────────────────────────────────────────────────

describe('the paged layout', () => {
  beforeEach(() => {
    layout.fourColumn = false
  })

  it('shows one stage at a time behind a stage rail', () => {
    renderBoard(fleet({ cards: [card({ stage: 'propose' })] }))

    expect(screen.getByTestId('stage-rail')).toBeTruthy()
    expect(screen.getAllByTestId(/^stage-column-/u)).toHaveLength(1)
  })

  it('names every stage and its count on the rail', () => {
    renderBoard(
      fleet({
        cards: [card({ stage: 'propose' }), card({ stage: 'archive' }), card({ stage: 'archive' })],
      }),
    )

    const rail = screen.getByTestId('stage-rail')
    const expected: Array<[string, string]> = [
      ['Propose', '1'],
      ['Validate', '0'],
      ['Execute', '0'],
      ['Archive', '2'],
    ]
    for (const [label, count] of expected) {
      const button = within(rail).getByRole('tab', { name: new RegExp(label, 'u') })
      expect(button.textContent).toContain(count)
    }
  })

  it('keeps every stage reachable', () => {
    renderBoard(
      fleet({
        cards: [
          card({ stage: 'propose', sourceInstance: 'p', changeName: 'p', title: 'p' }),
          card({ stage: 'execute', sourceInstance: 'e', changeName: 'e', title: 'e' }),
        ],
      }),
    )

    const rail = screen.getByTestId('stage-rail')
    expect(within(column('propose')).getByText('p')).toBeTruthy()

    fireEvent.click(within(rail).getByRole('tab', { name: /Execute/u }))
    expect(within(column('execute')).getByText('e')).toBeTruthy()
    expect(screen.queryByTestId('stage-column-propose')).toBeNull()
  })

  it('still states that the selected stage is empty', () => {
    renderBoard(fleet({ cards: [card({ stage: 'archive' })] }))
    fireEvent.click(within(screen.getByTestId('stage-rail')).getByRole('tab', { name: /Validate/u }))
    expect(within(column('validate')).getByText('No changes')).toBeTruthy()
  })

  it('shows no rail when all four columns fit', () => {
    layout.fourColumn = true
    renderBoard(fleet({ cards: [card()] }))
    expect(screen.queryByTestId('stage-rail')).toBeNull()
  })
})

// ── 5.3 names wrap before they elide ────────────────────────────────────────

describe('a change name', () => {
  const long = 'add-agent-change-board-with-a-deliberately-very-long-name-indeed'

  it('is allowed two lines rather than clamped to one', () => {
    renderBoard(
      fleet({ cards: [card({ changeName: long, title: long, sourceInstance: long })] }),
    )
    const name = screen.getByTestId('change-card-name')

    expect(name.textContent).toBe(long)
    expect(name.className).toContain('line-clamp-2')
    expect(name.className).not.toContain('truncate')
    expect(name.className).not.toContain('line-clamp-1')
  })

  it('carries its full value even when clamped', () => {
    renderBoard(
      fleet({ cards: [card({ changeName: long, title: long, sourceInstance: long })] }),
    )
    // The complete name is in the DOM, so the drawer and assistive technology
    // both have it whatever CSS does visually.
    expect(screen.getByTestId('change-card-name').textContent).toHaveLength(long.length)
  })

  it('renders counts with tabular figures so digits align between cards', () => {
    renderBoard(
      fleet({
        cards: [
          card({ completedChecklist: 1, totalChecklist: 9 }),
          card({ completedChecklist: 48, totalChecklist: 119 }),
        ],
      }),
    )
    for (const node of screen.getAllByTestId('change-card-counts')) {
      expect(node.className).toContain('tabular-nums')
    }
  })
})

// ── 5.4 degraded and unreachable ────────────────────────────────────────────

describe('degradation', () => {
  it('names a repository that could not be read, and still renders the rest', () => {
    renderBoard(
      fleet({
        cards: [card({ stage: 'propose', changeName: 'survivor', title: 'survivor' })],
        repositories: [
          { id: 'repo-1', name: 'agenticapps-dashboard', read: 'ok', reason: null },
          { id: 'repo-2', name: 'cparx', read: 'failed', reason: 'unreachable' },
        ],
      }),
    )

    expect(screen.getByText('survivor')).toBeTruthy()
    const notice = screen.getByTestId('board-degraded')
    expect(notice.textContent).toContain('cparx')
    expect(notice.textContent?.toLowerCase()).toContain('unreachable')
  })

  it('does not present a degraded read as an ordinary empty board', () => {
    renderBoard(
      fleet({
        cards: [],
        repositories: [
          { id: 'repo-1', name: 'a', read: 'ok', reason: null },
          { id: 'repo-2', name: 'b', read: 'failed', reason: 'timeout' },
        ],
      }),
    )
    expect(screen.getByTestId('board-degraded')).toBeTruthy()
  })

  it('states that no repository could be read, distinctly from an empty fleet', () => {
    renderBoard(
      fleet({
        cards: [],
        repositories: [
          { id: 'repo-1', name: 'a', read: 'failed', reason: 'unreachable' },
          { id: 'repo-2', name: 'b', read: 'failed', reason: 'unreadable' },
        ],
      }),
    )

    const allFailed = screen.getByTestId('board-all-failed')
    expect(allFailed.textContent).toMatch(/could not be read/iu)
    expect(screen.queryByTestId('board-empty')).toBeNull()
  })

  it('an empty fleet says the fleet is empty, not that it failed', () => {
    renderBoard(fleet({ cards: [] }))

    expect(screen.getByTestId('board-empty')).toBeTruthy()
    expect(screen.queryByTestId('board-all-failed')).toBeNull()
    expect(screen.queryByTestId('board-degraded')).toBeNull()
  })

  it('the empty and all-failed states are different text', () => {
    const { unmount } = renderBoard(fleet({ cards: [] }))
    const emptyText = screen.getByTestId('board-empty').textContent
    unmount()

    renderBoard(
      fleet({
        cards: [],
        repositories: [{ id: 'repo-1', name: 'a', read: 'failed', reason: 'unreachable' }],
      }),
    )
    expect(screen.getByTestId('board-all-failed').textContent).not.toBe(emptyText)
  })

  it('reports a truncated source rather than silently withholding cards', () => {
    renderBoard(
      fleet({
        cards: [card()],
        notices: [
          {
            repositoryId: 'repo-1',
            repositoryName: 'agenticapps-dashboard',
            source: 'archive',
            kind: 'truncated',
            admitted: 128,
            observed: 214,
          },
        ],
      }),
    )

    const notices = screen.getByTestId('board-notices')
    expect(notices.textContent).toContain('128')
    expect(notices.textContent).toContain('214')
  })

  it('says the daemon could not be reached when the query itself fails', () => {
    renderBoard(null, 'error')
    expect(screen.getByTestId('board-error')).toBeTruthy()
  })

  it('shows a loading state while the first read is in flight', () => {
    renderBoard(null, 'pending')
    expect(screen.getByLabelText('Loading the change board')).toBeTruthy()
  })
})

// ── 5.5 the two archive readings ────────────────────────────────────────────

describe('the Archive column', () => {
  it('distinguishes a filed archive card from an active card marked ready', () => {
    renderBoard(
      fleet({
        cards: [
          card({
            stage: 'archive',
            source: 'archive',
            sourceInstance: '2026-07-04-filed',
            changeName: 'filed',
            title: 'filed',
            archiveDate: '2026-07-04',
          }),
          card({
            stage: 'archive',
            source: 'active',
            ready: true,
            sourceInstance: 'ready-to-file',
            changeName: 'ready-to-file',
            title: 'ready-to-file',
          }),
        ],
      }),
    )

    const archive = column('archive')
    const readyCard = within(archive).getByTestId(
      `change-card-${cardKey('repo-1', 'active', 'ready-to-file')}`,
    )
    const filedCard = within(archive).getByTestId(
      `change-card-${cardKey('repo-1', 'archive', '2026-07-04-filed')}`,
    )

    // The difference is legible without opening either card.
    expect(within(readyCard).getByText('Ready')).toBeTruthy()
    expect(within(filedCard).queryByText('Ready')).toBeNull()
    expect(within(filedCard).getByText(/2026-07-04/u)).toBeTruthy()
  })
})

// ── 5.6 ordering ────────────────────────────────────────────────────────────

describe('ordering', () => {
  /** The rendered order of a column, by card name. */
  const namesIn = (stage: ChangeStage) =>
    within(column(stage))
      .getAllByTestId('change-card-name')
      .map((node) => node.textContent)

  it('orders the archive column date-descending', () => {
    const dated = (date: string, name: string) =>
      card({
        stage: 'archive',
        source: 'archive',
        archiveDate: date,
        sourceInstance: `${date}-${name}`,
        changeName: name,
        title: name,
      })

    renderBoard(
      // Deliberately shuffled on the wire: the board's own order is what is
      // under test, not the daemon's.
      fleet({ cards: [dated('2026-07-04', 'older'), dated('2026-08-02', 'newer'), dated('2026-07-30', 'middle')] }),
    )
    expect(namesIn('archive')).toEqual(['newer', 'middle', 'older'])
  })

  it('sorts a ready card ahead of every dated archive card', () => {
    renderBoard(
      fleet({
        cards: [
          card({
            stage: 'archive',
            source: 'archive',
            archiveDate: '2026-12-31',
            sourceInstance: '2026-12-31-latest',
            changeName: 'latest',
            title: 'latest',
          }),
          card({
            stage: 'archive',
            source: 'active',
            ready: true,
            sourceInstance: 'waiting',
            changeName: 'waiting',
            title: 'waiting',
          }),
        ],
      }),
    )
    // Ahead of even the most recent dated card: it is not filed at all.
    expect(namesIn('archive')).toEqual(['waiting', 'latest'])
  })

  it('orders propose, validate and execute by modification time descending', () => {
    const at = (updatedAt: number, name: string, stage: ChangeStage) =>
      card({ stage, updatedAt, sourceInstance: name, changeName: name, title: name })

    renderBoard(
      fleet({
        cards: [
          at(1_000, 'old', 'validate'),
          at(3_000, 'new', 'validate'),
          at(2_000, 'mid', 'validate'),
          at(1_000, 'p-old', 'propose'),
          at(2_000, 'p-new', 'propose'),
          at(1_000, 'e-old', 'execute'),
          at(2_000, 'e-new', 'execute'),
        ],
      }),
    )

    expect(namesIn('validate')).toEqual(['new', 'mid', 'old'])
    expect(namesIn('propose')).toEqual(['p-new', 'p-old'])
    expect(namesIn('execute')).toEqual(['e-new', 'e-old'])
  })

  it('breaks ties on identity so no repository decides another’s order', () => {
    const tied = (repositoryId: string) =>
      card({
        stage: 'validate',
        repositoryId,
        updatedAt: 5_000,
        sourceInstance: 'same-name',
        changeName: `${repositoryId}/same-name`,
        title: `${repositoryId}/same-name`,
      })

    renderBoard(fleet({ cards: [tied('zeta'), tied('alpha')] }))
    expect(namesIn('validate')).toEqual(['alpha/same-name', 'zeta/same-name'])
  })

  it('is stable across two renders of an unchanged fleet', () => {
    const cards = [
      card({ stage: 'validate', updatedAt: 2_000, sourceInstance: 'b', changeName: 'b', title: 'b' }),
      card({ stage: 'validate', updatedAt: 2_000, sourceInstance: 'a', changeName: 'a', title: 'a' }),
      card({ stage: 'validate', updatedAt: 3_000, sourceInstance: 'c', changeName: 'c', title: 'c' }),
    ]

    const { unmount } = renderBoard(fleet({ cards }))
    const first = namesIn('validate')
    unmount()

    // The same cards, delivered in a different order.
    renderBoard(fleet({ cards: [...cards].reverse() }))
    expect(namesIn('validate')).toEqual(first)
  })

  it('renders in the order the shared comparator defines', () => {
    // The board and the daemon apply the same total order, so a rendered column
    // is exactly the comparator's output. Asserted rather than assumed, because
    // a board that sorted differently would disagree with the wire silently.
    const cards = [
      card({ stage: 'validate', updatedAt: 1_000, sourceInstance: 'x', changeName: 'x', title: 'x' }),
      card({ stage: 'validate', updatedAt: 9_000, sourceInstance: 'y', changeName: 'y', title: 'y' }),
      card({ stage: 'validate', updatedAt: 5_000, sourceInstance: 'z', changeName: 'z', title: 'z' }),
    ]
    renderBoard(fleet({ cards }))

    expect(namesIn('validate')).toEqual(
      [...cards].sort(compareChangeCards).map((entry) => entry.changeName),
    )
  })
})

// ── 5.7 the card does not assume a fixed row count ──────────────────────────

describe('the card', () => {
  it('states its repository, checklist counts and stage-relevant detail', () => {
    renderBoard(
      fleet({
        cards: [
          card({
            changeName: 'add-thing',
            title: 'add-thing',
            sourceInstance: 'add-thing',
            completedChecklist: 48,
            totalChecklist: 119,
          }),
        ],
      }),
    )

    const node = screen.getByTestId(`change-card-${cardKey('repo-1', 'active', 'add-thing')}`)
    expect(within(node).getByText('agenticapps-dashboard')).toBeTruthy()
    expect(within(node).getByTestId('change-card-counts').textContent).toContain('48')
    expect(within(node).getByTestId('change-card-counts').textContent).toContain('119')
  })

  it('lays its rows out additively rather than at a fixed count', () => {
    // The `N active` session row is designed out, not designed around: adding it
    // later must be additive. A fixed row count or a fixed height here is what
    // would make that a rewrite.
    renderBoard(fleet({ cards: [card()] }))
    const rows = screen.getByTestId('change-card-rows')

    expect(rows.className).toContain('flex-col')
    expect(rows.className).not.toMatch(/\bh-\d/u)
    expect(rows.className).not.toMatch(/grid-rows-/u)
  })

  it('marks a card whose evidence was bounded', () => {
    renderBoard(fleet({ cards: [card({ evidenceLimited: true })] }))
    expect(screen.getByTestId('change-card-evidence-limited')).toBeTruthy()
  })

  it('does not mark an ordinary card', () => {
    renderBoard(fleet({ cards: [card()] }))
    expect(screen.queryByTestId('change-card-evidence-limited')).toBeNull()
  })
})
