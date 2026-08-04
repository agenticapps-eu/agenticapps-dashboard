import { describe, expect, it } from 'vitest'

import {
  CHANGE_SOURCES,
  CHANGE_STAGES,
  ChangeCardSchema,
  ChangeSourceSchema,
  ChangeStageSchema,
  ChangesFleetResponseSchema,
  cardKey,
  compareChangeCards,
  fleetReadState,
} from './changes.js'

/** A card that satisfies every required field, for tests that mutate one. */
function card(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1\u0000active\u0000add-agent-change-board',
    repositoryId: 'proj-1',
    repositoryName: 'agenticapps-dashboard',
    source: 'active',
    sourceInstance: 'add-agent-change-board',
    changeName: 'add-agent-change-board',
    title: 'add-agent-change-board',
    stage: 'execute',
    ready: false,
    artifacts: {
      proposal: 'ready',
      deltaSpecCount: 1,
      tasks: 'ready',
      design: 'ready',
    },
    reviewerVendors: ['gemini', 'codex'],
    hasRequestChanges: false,
    reviewRecord: 'REVIEWS.md',
    checklist: [{ text: 'do the thing', completed: true }],
    completedChecklist: 1,
    totalChecklist: 1,
    archiveDate: null,
    updatedAt: 1_754_000_000_000,
    evidenceLimited: false,
    ...overrides,
  }
}

describe('ChangeStageSchema', () => {
  it('admits exactly the four lifecycle stages', () => {
    expect(CHANGE_STAGES).toEqual(['propose', 'validate', 'execute', 'archive'])
    for (const stage of CHANGE_STAGES) {
      expect(ChangeStageSchema.parse(stage)).toBe(stage)
    }
  })

  // Decision 5: the ship stage is deferred to its own change. A producer that
  // emits one is wrong about this board, and must fail loudly rather than have
  // an unknown stage land in a column.
  it('rejects `ship`, which is not a stage on this board', () => {
    expect(ChangeStageSchema.safeParse('ship').success).toBe(false)
    expect(ChangeCardSchema.safeParse(card({ stage: 'ship' })).success).toBe(false)
  })

  it('rejects any other unknown stage', () => {
    expect(ChangeStageSchema.safeParse('review').success).toBe(false)
  })
})

describe('ChangeSourceSchema', () => {
  it('admits exactly the three sources', () => {
    expect(CHANGE_SOURCES).toEqual(['active', 'archive', 'backlog'])
    for (const source of CHANGE_SOURCES) {
      expect(ChangeSourceSchema.parse(source)).toBe(source)
    }
  })

  it('rejects an unknown source', () => {
    expect(ChangeSourceSchema.safeParse('spec').success).toBe(false)
  })
})

describe('ChangeCardSchema', () => {
  it('accepts a complete card', () => {
    expect(ChangeCardSchema.parse(card())).toMatchObject({ stage: 'execute' })
  })

  it.each([
    'id',
    'repositoryId',
    'repositoryName',
    'source',
    'sourceInstance',
    'changeName',
    'stage',
    'ready',
    'artifacts',
    'checklist',
    'updatedAt',
  ])('requires %s', (field) => {
    const incomplete = card()
    delete (incomplete as Record<string, unknown>)[field]
    expect(ChangeCardSchema.safeParse(incomplete).success).toBe(false)
  })

  // Strict, matching ProjectOverviewSchema: a producer still emitting a retired
  // field fails the parse rather than having it silently stripped.
  it('rejects an unknown field', () => {
    expect(ChangeCardSchema.safeParse(card({ activeSessionCount: 2 })).success).toBe(false)
  })

  it('requires the artifact readiness vocabulary', () => {
    expect(
      ChangeCardSchema.safeParse(card({
        artifacts: { proposal: 'present', deltaSpecCount: 1, tasks: 'ready', design: 'ready' },
      })).success,
    ).toBe(false)
    // `design` is optional-or-ready and never "missing" — its absence is not a defect.
    expect(
      ChangeCardSchema.safeParse(card({
        artifacts: { proposal: 'ready', deltaSpecCount: 1, tasks: 'ready', design: 'missing' },
      })).success,
    ).toBe(false)
  })

  it('rejects a negative or fractional delta spec count', () => {
    expect(
      ChangeCardSchema.safeParse(card({
        artifacts: { proposal: 'ready', deltaSpecCount: -1, tasks: 'ready', design: 'ready' },
      })).success,
    ).toBe(false)
  })

  it('allows a null review record and a null archive date', () => {
    expect(
      ChangeCardSchema.parse(card({ reviewRecord: null, archiveDate: null })),
    ).toMatchObject({ reviewRecord: null })
  })
})

describe('cardKey', () => {
  // Decision 7 and the identity requirement: the triple, NUL-joined, because no
  // filesystem name and no heading can contain a NUL — so no author-controlled
  // string can forge one card's identity into another's.
  it('joins the address triple with NUL', () => {
    expect(cardKey('proj-1', 'active', 'add-thing')).toBe('proj-1\u0000active\u0000add-thing')
  })

  it('distinguishes two sources of one name in one repository', () => {
    expect(cardKey('proj-1', 'active', 'add-thing')).not.toBe(
      cardKey('proj-1', 'backlog', 'add-thing'),
    )
  })

  it('distinguishes two dated archives of one slug', () => {
    expect(cardKey('proj-1', 'archive', '2026-07-04-add-thing')).not.toBe(
      cardKey('proj-1', 'archive', '2026-08-02-add-thing'),
    )
  })

  // A separator a name *can* contain would let `repo:a` + `b` collide with
  // `repo` + `a:b`. NUL cannot appear in either, so the collision has no
  // preimage rather than being guarded against.
  it('cannot be forged by a name containing the printable separators', () => {
    expect(cardKey('proj-1', 'active', 'a:b/c')).not.toBe(cardKey('proj-1:active', 'active', 'a'))
  })
})

describe('ChangesFleetResponseSchema', () => {
  const fleet = (overrides: Record<string, unknown> = {}) => ({
    generatedAt: 1_754_000_000_000,
    cards: [card()],
    repositories: [{ id: 'proj-1', name: 'agenticapps-dashboard', read: 'ok', reason: null }],
    notices: [],
    ...overrides,
  })

  it('accepts a complete fleet response', () => {
    expect(ChangesFleetResponseSchema.parse(fleet()).cards).toHaveLength(1)
  })

  it('names a failed repository with a symbolic reason', () => {
    const parsed = ChangesFleetResponseSchema.parse(
      fleet({
        cards: [],
        repositories: [
          { id: 'proj-1', name: 'a', read: 'ok', reason: null },
          { id: 'proj-2', name: 'b', read: 'failed', reason: 'unreachable' },
        ],
      }),
    )
    expect(parsed.repositories[1]).toMatchObject({ read: 'failed', reason: 'unreachable' })
  })

  // 10.14 / 11.7: the reason vocabulary is symbolic and path-free by
  // construction, so a degradation message cannot carry a filesystem path or a
  // username off the machine.
  it('rejects a free-text failure reason', () => {
    expect(
      ChangesFleetResponseSchema.safeParse(
        fleet({
          repositories: [
            { id: 'p', name: 'b', read: 'failed', reason: 'ENOENT /Users/donald/Sourcecode/x' },
          ],
        }),
      ).success,
    ).toBe(false)
  })

  it('accepts upstream’s six notice kinds and rejects an invented one', () => {
    for (const kind of ['collision', 'empty-slug', 'evidence-limited', 'malformed', 'rejected', 'truncated']) {
      expect(
        ChangesFleetResponseSchema.safeParse(
          fleet({ notices: [{ repositoryId: 'p', repositoryName: 'b', source: 'active', kind }] }),
        ).success,
      ).toBe(true)
    }
    expect(
      ChangesFleetResponseSchema.safeParse(
        fleet({ notices: [{ repositoryId: 'p', repositoryName: 'b', source: 'active', kind: 'weird' }] }),
      ).success,
    ).toBe(false)
  })

  it('carries admitted and observed counts on a truncated notice', () => {
    const parsed = ChangesFleetResponseSchema.parse(
      fleet({
        notices: [
          {
            repositoryId: 'p',
            repositoryName: 'b',
            source: 'archive',
            kind: 'truncated',
            admitted: 128,
            observed: 214,
          },
        ],
      }),
    )
    expect(parsed.notices[0]).toMatchObject({ admitted: 128, observed: 214 })
  })

  it('admits `evidence` as a notice source, which is not a card source', () => {
    expect(
      ChangesFleetResponseSchema.safeParse(
        fleet({
          notices: [
            { repositoryId: 'p', repositoryName: 'b', source: 'evidence', kind: 'evidence-limited' },
          ],
        }),
      ).success,
    ).toBe(true)
    expect(ChangeSourceSchema.safeParse('evidence').success).toBe(false)
  })
})

describe('fleetReadState', () => {
  // Requirement: degradation is distinguishable from emptiness. Both render no
  // cards, and they must not render the same.
  it('reports `empty` when every repository read and none had changes', () => {
    expect(
      fleetReadState({
        cards: [],
        repositories: [
          { id: 'a', name: 'a', read: 'ok', reason: null },
          { id: 'b', name: 'b', read: 'ok', reason: null },
        ],
      }),
    ).toBe('empty')
  })

  it('reports `all-failed` when no repository could be read', () => {
    expect(
      fleetReadState({
        cards: [],
        repositories: [
          { id: 'a', name: 'a', read: 'failed', reason: 'unreachable' },
          { id: 'b', name: 'b', read: 'failed', reason: 'timeout' },
        ],
      }),
    ).toBe('all-failed')
  })

  it('reports `degraded` when some repositories read and some did not', () => {
    expect(
      fleetReadState({
        cards: [],
        repositories: [
          { id: 'a', name: 'a', read: 'ok', reason: null },
          { id: 'b', name: 'b', read: 'failed', reason: 'unreadable' },
        ],
      }),
    ).toBe('degraded')
  })

  it('reports `degraded` even when the readable repositories produced cards', () => {
    expect(
      fleetReadState({
        cards: [ChangeCardSchema.parse(card())],
        repositories: [
          { id: 'a', name: 'a', read: 'ok', reason: null },
          { id: 'b', name: 'b', read: 'failed', reason: 'unreachable' },
        ],
      }),
    ).toBe('degraded')
  })

  // An empty registry is not a failure, and must not claim one.
  it('reports `empty` for an empty registry', () => {
    expect(fleetReadState({ cards: [], repositories: [] })).toBe('empty')
  })

  it('reports `ok` when every repository read and cards exist', () => {
    expect(
      fleetReadState({
        cards: [ChangeCardSchema.parse(card())],
        repositories: [{ id: 'a', name: 'a', read: 'ok', reason: null }],
      }),
    ).toBe('ok')
  })
})

// ── the order both sides apply ──────────────────────────────────────────────

describe('compareChangeCards', () => {
  const at = (overrides: Record<string, unknown>) => ChangeCardSchema.parse(card(overrides))

  /**
   * The module claims one total order. A comparator that is not transitive is
   * not an order at all, and `Array.prototype.sort` over one produces a result
   * that depends on the input arrangement — so the daemon's ordered response
   * and the board's re-sort of a filtered subset can disagree, which is exactly
   * what the claim rules out.
   */
  it('is transitive across every triple of stages and archive shapes', () => {
    const cards = [
      at({ id: 'a', stage: 'archive', source: 'archive', archiveDate: null, updatedAt: 100 }),
      at({ id: 'b', stage: 'archive', source: 'archive', archiveDate: '2026-01-01', updatedAt: 300 }),
      at({ id: 'c', stage: 'propose', updatedAt: 200 }),
      at({ id: 'd', stage: 'validate', updatedAt: 400 }),
      at({ id: 'e', stage: 'archive', source: 'archive', archiveDate: '2026-03-03', updatedAt: 50 }),
    ]

    for (const left of cards) {
      for (const middle of cards) {
        for (const right of cards) {
          if (compareChangeCards(left, middle) < 0 && compareChangeCards(middle, right) < 0) {
            expect(compareChangeCards(left, right)).toBeLessThan(0)
          }
        }
      }
    }
  })

  it('is antisymmetric, and no two distinct cards compare equal', () => {
    const cards = [
      at({ id: 'a', stage: 'archive', source: 'archive', archiveDate: '2026-07-04', updatedAt: 1 }),
      at({ id: 'b', stage: 'archive', source: 'archive', archiveDate: '2026-07-04', updatedAt: 9 }),
      at({ id: 'c', stage: 'propose', updatedAt: 1 }),
    ]
    for (const left of cards) {
      for (const right of cards) {
        if (left.id === right.id) continue
        expect(Math.sign(compareChangeCards(left, right)))
          .toBe(-Math.sign(compareChangeCards(right, left)))
        expect(compareChangeCards(left, right)).not.toBe(0)
      }
    }
  })

  /**
   * The rule the module states in prose: a rule-5 `ready` card is the thing
   * waiting to be filed, so it sorts ahead of every dated entry. It has to hold
   * of the *rendered column*, which is the archive subsequence of a sort over
   * the whole fleet — not merely of the two cards compared in isolation.
   */
  it('keeps a ready card ahead of every dated one after a whole-fleet sort', () => {
    const ready = at({ id: 'c0', stage: 'archive', source: 'active', ready: true, archiveDate: null, updatedAt: 100 })
    const filed = at({ id: 'c2', stage: 'archive', source: 'archive', archiveDate: '2026-01-03', updatedAt: 300 })
    const open = at({ id: 'c1', stage: 'propose', updatedAt: 200 })

    const column = [ready, open, filed]
      .sort(compareChangeCards)
      .filter((entry) => entry.stage === 'archive')

    expect(column.map((entry) => entry.id)).toEqual(['c0', 'c2'])
  })

  it('orders the other three columns by modification time, most recent first', () => {
    const older = at({ id: 'a', stage: 'validate', updatedAt: 1_000 })
    const newer = at({ id: 'b', stage: 'validate', updatedAt: 9_000 })
    expect([older, newer].sort(compareChangeCards).map((entry) => entry.id)).toEqual(['b', 'a'])
  })
})
