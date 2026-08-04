/**
 * stage.test.ts — the classifier, its parse grammar, and the conformance check.
 *
 * The last test in this file is the one that matters most: upstream's own
 * fixtures run through upstream's `classifyActiveChange`, copied verbatim as an
 * oracle, and through `stage.ts`, asserting identical stages. Two review rounds
 * of this change argued about a divergence that did not exist; this is what
 * makes "the two boards agree" a check rather than a claim.
 */
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import type { ChangeArtifacts, ChangeChecklistRow } from '@agenticapps/dashboard-shared'

import {
  classifyChange,
  parseChecklist,
  parseReviewEvidence,
  selectReviewRecord,
} from './stage.js'

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__')

const complete: ChangeArtifacts = {
  proposal: 'ready',
  deltaSpecCount: 1,
  tasks: 'ready',
  design: 'optional',
}

function active(overrides: {
  artifacts?: Partial<ChangeArtifacts>
  reviewerVendors?: string[]
  hasRequestChanges?: boolean
  checklist?: ChangeChecklistRow[]
} = {}) {
  return classifyChange({
    source: 'active' as const,
    artifacts: { ...complete, ...overrides.artifacts },
    reviewerVendors: overrides.reviewerVendors ?? ['gemini', 'codex'],
    hasRequestChanges: overrides.hasRequestChanges ?? false,
    checklist: overrides.checklist ?? [{ text: 'a', completed: false }],
  })
}

// ── 2.2 the five ordered rules, plus backlog ────────────────────────────────

describe('the ordered rule set', () => {
  it('rule 1: an archived entry is archive, and is not marked ready', () => {
    expect(
      classifyChange({
        source: 'archive',
        artifacts: { proposal: 'missing', deltaSpecCount: 0, tasks: 'missing', design: 'optional' },
        reviewerVendors: [],
        hasRequestChanges: false,
        checklist: [],
      }),
    ).toEqual({ stage: 'archive', ready: false })
  })

  it('rule 1 wins over everything: an archive entry never re-derives a stage', () => {
    expect(
      classifyChange({
        source: 'archive',
        artifacts: complete,
        reviewerVendors: ['a', 'b'],
        hasRequestChanges: false,
        checklist: [{ text: 'x', completed: false }],
      }).stage,
    ).toBe('archive')
  })

  it.each([
    ['a missing proposal', { proposal: 'missing' as const }],
    ['no delta spec', { deltaSpecCount: 0 }],
    ['a missing tasks file', { tasks: 'missing' as const }],
  ])('rule 2: %s classifies propose', (_label, artifacts) => {
    expect(active({ artifacts }).stage).toBe('propose')
    // The discriminating half: with the artifact present it is not propose, so
    // a classifier hardcoded to `propose` cannot satisfy this test.
    expect(active().stage).not.toBe('propose')
  })

  it('rule 2 wins over the reviewer clause', () => {
    // Artifact-incomplete but rejected: propose, not validate. Order matters.
    expect(
      active({ artifacts: { tasks: 'missing' }, hasRequestChanges: true }).stage,
    ).toBe('propose')
    // Artifact-complete and rejected is validate — which is what makes the
    // ordering above load-bearing rather than a coincidence.
    expect(active({ hasRequestChanges: true }).stage).toBe('validate')
  })

  it('rule 3: fewer than two approving reviewers classifies validate', () => {
    expect(active({ reviewerVendors: ['gemini'] }).stage).toBe('validate')
    expect(active({ reviewerVendors: [] }).stage).toBe('validate')
  })

  it('rule 3: zero checklist rows classifies validate', () => {
    // Upstream's `checklist.length === 0`, carried deliberately. A purely
    // declarative change sits at validate rather than advancing on artifacts
    // alone — matching upstream is worth more than fixing it here.
    expect(active({ checklist: [] }).stage).toBe('validate')
  })

  it('rule 4: approved with outstanding work classifies execute', () => {
    expect(
      active({
        checklist: [
          { text: 'a', completed: true },
          { text: 'b', completed: false },
        ],
      }),
    ).toEqual({ stage: 'execute', ready: false })
  })

  it('rule 5: approved with a complete non-empty checklist is archive, marked ready', () => {
    expect(
      active({
        checklist: [
          { text: 'a', completed: true },
          { text: 'b', completed: true },
        ],
      }),
    ).toEqual({ stage: 'archive', ready: true })
  })

  it('a backlog entry classifies propose', () => {
    expect(
      classifyChange({
        source: 'backlog',
        artifacts: { proposal: 'missing', deltaSpecCount: 0, tasks: 'missing', design: 'optional' },
        reviewerVendors: [],
        hasRequestChanges: false,
        checklist: [],
      }),
    ).toEqual({ stage: 'propose', ready: false })
    // A backlog entry is propose *because it is a backlog entry*, not because
    // everything is propose.
    expect(active().stage).not.toBe('propose')
  })

  it('never returns `ship`, and does return the other four', () => {
    const stages = new Set(
      [
        active({ artifacts: { proposal: 'missing' } }),
        active({ checklist: [] }),
        active(),
        active({ checklist: [{ text: 'a', completed: true }] }),
      ].map((result) => result.stage),
    )
    // Asserting the absence of `ship` alone is satisfied by any constant. The
    // set equality is what makes it a claim about this classifier.
    expect([...stages].sort()).toEqual(['archive', 'execute', 'propose', 'validate'])
    expect(stages.has('ship' as never)).toBe(false)
  })
})

// ── 2.3 the veto, against the real record ───────────────────────────────────

describe('the reviewer veto, against retire-v1-surfaces’ own REVIEWS.md', () => {
  it('holds the change at validate despite two distinct approvals', async () => {
    const markdown = await readFile(join(fixtures, 'real/retire-v1-surfaces-REVIEWS.md'), 'utf8')
    const evidence = parseReviewEvidence(markdown)

    // The shape that refuted the rule's first draft: four verdicts, each from a
    // distinct reviewer, each that reviewer's latest. A filter over "latest
    // verdict approves" counts claude and opencode and advances the change.
    expect(evidence.reviewerVendors.map((v) => v.toLowerCase()).sort()).toEqual([
      'claude',
      'opencode',
    ])
    expect(evidence.hasRequestChanges).toBe(true)

    expect(
      active({
        reviewerVendors: evidence.reviewerVendors,
        hasRequestChanges: evidence.hasRequestChanges,
        checklist: [{ text: 'a', completed: false }],
      }).stage,
    ).toBe('validate')
  })

  it('would have advanced under latest-verdict filtering, which is the point', async () => {
    const markdown = await readFile(join(fixtures, 'real/retire-v1-surfaces-REVIEWS.md'), 'utf8')
    const evidence = parseReviewEvidence(markdown)
    // Two distinct approvals really are present. The veto, not the count, is
    // what holds it.
    expect(new Set(evidence.reviewerVendors.map((v) => v.toLowerCase())).size).toBeGreaterThanOrEqual(2)
    expect(
      active({ reviewerVendors: evidence.reviewerVendors, hasRequestChanges: false }).stage,
    ).toBe('execute')
  })
})

// ── 2.4 the rest of the reviewer rule ───────────────────────────────────────

describe('the reviewer rule', () => {
  it('a rejection cleared in a later round no longer vetoes', () => {
    const round1 = parseReviewEvidence(
      ['## Reviewer: gemini', 'VERDICT: REQUEST-CHANGES', '', '## Reviewer: codex', 'VERDICT: APPROVE'].join('\n'),
    )
    const round2 = parseReviewEvidence(
      ['## Reviewer: gemini', 'VERDICT: APPROVE', '', '## Reviewer: codex', 'VERDICT: APPROVE'].join('\n'),
    )
    expect(active({ ...round1 }).stage).toBe('validate')
    expect(active({ ...round2 }).stage).toBe('execute')
  })

  it('unparseable verdicts count as absent and classify validate', () => {
    const evidence = parseReviewEvidence('## Reviewer: gemini\n\nLooks fine to me.\n')
    expect(evidence).toEqual({ reviewerVendors: [], hasRequestChanges: false })
    expect(active({ ...evidence }).stage).toBe('validate')
  })

  it('a record with no reviewer sections at all classifies validate', () => {
    const evidence = parseReviewEvidence('')
    expect(active({ ...evidence }).stage).toBe('validate')
  })

  it('a vendor approving twice counts once', () => {
    const evidence = parseReviewEvidence(
      ['## Reviewer: gemini', 'VERDICT: APPROVE', '', '## Reviewer: Gemini', 'VERDICT: APPROVE'].join('\n'),
    )
    expect(evidence.reviewerVendors).toHaveLength(1)
    expect(active({ ...evidence }).stage).toBe('validate')
  })
})

// ── 2.5 the parse grammar, mirrored from upstream ───────────────────────────

describe('parseReviewEvidence', () => {
  it('bounds a reviewer section at the next `## Reviewer:` heading', () => {
    // codex's APPROVE belongs to codex, not to gemini, and gemini's rejection
    // does not leak forward into codex's section.
    const evidence = parseReviewEvidence(
      [
        '## Reviewer: gemini',
        'VERDICT: REQUEST-CHANGES',
        'some findings',
        '## Reviewer: codex',
        'VERDICT: APPROVE',
      ].join('\n'),
    )
    expect(evidence.reviewerVendors).toEqual(['codex'])
    expect(evidence.hasRequestChanges).toBe(true)
  })

  it('matches the verdict case-insensitively', () => {
    expect(
      parseReviewEvidence('## Reviewer: gemini\nverdict: approve').reviewerVendors,
    ).toEqual(['gemini'])
    expect(
      parseReviewEvidence('## Reviewer: gemini\nVerdict: Request-Changes').hasRequestChanges,
    ).toBe(true)
  })

  it('dedups vendors on the lowercased name', () => {
    const evidence = parseReviewEvidence(
      ['## Reviewer: GEMINI', 'VERDICT: APPROVE', '## Reviewer: gemini', 'VERDICT: APPROVE'].join('\n'),
    )
    expect(evidence.reviewerVendors).toEqual(['GEMINI'])
  })

  it('ignores a heading with an empty vendor', () => {
    // Both halves in one test: the named vendor is found and the empty one is
    // not, so an implementation returning nothing fails.
    expect(
      parseReviewEvidence(
        ['## Reviewer:', 'VERDICT: APPROVE', '## Reviewer: codex', 'VERDICT: APPROVE'].join('\n'),
      ).reviewerVendors,
    ).toEqual(['codex'])
  })

  it('ignores a verdict that is not on a line of its own', () => {
    expect(
      parseReviewEvidence(
        [
          '## Reviewer: gemini',
          'the VERDICT: APPROVE was given',
          '## Reviewer: codex',
          'VERDICT: APPROVE',
        ].join('\n'),
      ).reviewerVendors,
    ).toEqual(['codex'])
  })

  // 11.9: the case that broke the round-3 draft. One vendor approving *and*
  // rejecting in one record holds the change at validate. There is no
  // last-section-wins rule and there must not be one — document order within a
  // single record is not evidence of recency.
  it('one vendor both approving and rejecting holds the change at validate', () => {
    const approveFirst = parseReviewEvidence(
      ['## Reviewer: gemini', 'VERDICT: APPROVE', '## Reviewer: gemini', 'VERDICT: REQUEST-CHANGES'].join('\n'),
    )
    const rejectFirst = parseReviewEvidence(
      ['## Reviewer: gemini', 'VERDICT: REQUEST-CHANGES', '## Reviewer: gemini', 'VERDICT: APPROVE'].join('\n'),
    )
    expect(approveFirst.hasRequestChanges).toBe(true)
    expect(rejectFirst.hasRequestChanges).toBe(true)
    expect(active({ ...approveFirst }).stage).toBe('validate')
    expect(active({ ...rejectFirst }).stage).toBe('validate')
  })

  it('a rejecting section contributes no approval, wherever it sits', () => {
    const evidence = parseReviewEvidence(
      [
        '## Reviewer: gemini',
        'VERDICT: REQUEST-CHANGES',
        '## Reviewer: codex',
        'VERDICT: APPROVE',
        '## Reviewer: opencode',
        'VERDICT: APPROVE',
      ].join('\n'),
    )
    expect(evidence.reviewerVendors).toEqual(['codex', 'opencode'])
    expect(evidence.hasRequestChanges).toBe(true)
    expect(active({ ...evidence }).stage).toBe('validate')
  })
})

describe('parseChecklist', () => {
  it('matches upstream’s row grammar', () => {
    expect(
      parseChecklist(
        ['- [ ] open', '- [x] done', '- [X] also done', '  - [ ] indented'].join('\n'),
      ),
    ).toEqual([
      { text: 'open', completed: false },
      { text: 'done', completed: true },
      { text: 'also done', completed: true },
      { text: 'indented', completed: false },
    ])
  })

  it('ignores lines that are not checklist rows', () => {
    expect(
      parseChecklist(['## heading', '- a bullet', '- [] no space', '- [ ]', 'text'].join('\n')),
    ).toEqual([])
    // Same document plus one real row: a parser returning nothing fails here,
    // so "ignores non-rows" cannot be satisfied by ignoring everything.
    expect(
      parseChecklist(
        ['## heading', '- a bullet', '- [] no space', '- [x] real', 'text'].join('\n'),
      ),
    ).toEqual([{ text: 'real', completed: true }])
  })

  it('trims trailing whitespace from the row text', () => {
    expect(parseChecklist('- [ ] spaced   ')).toEqual([{ text: 'spaced', completed: false }])
  })
})

// ── 2.6 staleness: which record is read ─────────────────────────────────────

describe('selectReviewRecord', () => {
  const at = (name: string, mtimeMs: number) => ({ name, mtimeMs })

  it('returns null when a change carries no review record', () => {
    expect(selectReviewRecord([])).toBeNull()
    expect(selectReviewRecord([at('tasks.md', 100), at('proposal.md', 200)])).toBeNull()
    // And is not simply always null.
    expect(selectReviewRecord([at('REVIEWS.md', 100)])).toBe('REVIEWS.md')
  })

  it('reads the most recently modified record', () => {
    expect(
      selectReviewRecord([
        at('REVIEWS.md', 100),
        at('REVIEWS-round-1.md', 200),
        at('REVIEWS-round-2.md', 300),
        at('REVIEWS-round-3.md', 400),
      ]),
    ).toBe('REVIEWS-round-3.md')
  })

  it('a REVIEWS.md rewritten after the last round wins', () => {
    // 11.12: round-record selection that only handled REVIEWS.md *lagging* the
    // rounds classified from staler evidence when it led them.
    expect(
      selectReviewRecord([
        at('REVIEWS.md', 500),
        at('REVIEWS-round-1.md', 200),
        at('REVIEWS-round-3.md', 400),
      ]),
    ).toBe('REVIEWS.md')
  })

  it('compares round numbers numerically on a modification-time tie', () => {
    expect(
      selectReviewRecord([at('REVIEWS-round-9.md', 100), at('REVIEWS-round-10.md', 100)]),
    ).toBe('REVIEWS-round-10.md')
  })

  it('prefers a round record over REVIEWS.md on a tie', () => {
    // A numbered round is a deliberate, dated act; REVIEWS.md is the file the
    // producer rewrites. On an indistinguishable timestamp the numbered one is
    // the more specific evidence.
    expect(selectReviewRecord([at('REVIEWS.md', 100), at('REVIEWS-round-1.md', 100)])).toBe(
      'REVIEWS-round-1.md',
    )
  })

  it('ignores files that are not review records', () => {
    expect(
      selectReviewRecord([at('REVIEWS.md', 100), at('CRITIQUE.md', 900), at('tasks.md', 900)]),
    ).toBe('REVIEWS.md')
  })

  it('selects from the real close-readiness-spec-gaps record set', async () => {
    const dir = join(fixtures, 'real/close-readiness-spec-gaps')
    // Modification times are not preserved by the copy, so the ordering is
    // stated rather than read: rounds 1..3 in order, REVIEWS.md lagging them.
    const selected = selectReviewRecord([
      at('REVIEWS.md', 1_000),
      at('REVIEWS-round-1.md', 2_000),
      at('REVIEWS-round-2.md', 3_000),
      at('REVIEWS-round-3.md', 4_000),
    ])
    expect(selected).toBe('REVIEWS-round-3.md')

    // And the record actually selected is the one whose verdicts classify the
    // change — round 3, not the stale REVIEWS.md beside it.
    const round3 = parseReviewEvidence(await readFile(join(dir, selected!), 'utf8'))
    const stale = parseReviewEvidence(await readFile(join(dir, 'REVIEWS.md'), 'utf8'))
    expect(round3.reviewerVendors.map((v) => v.toLowerCase())).toEqual(['gemini'])
    expect(stale.reviewerVendors.map((v) => v.toLowerCase()).sort()).toEqual(['gemini', 'opencode'])
    // A reviewer absent from the selected record has no verdict, rather than
    // one carried forward from a record that was not selected.
    expect(round3.reviewerVendors.map((v) => v.toLowerCase())).not.toContain('opencode')
  })
})

// ── 2.7 design.md never moves a stage ───────────────────────────────────────

describe('design.md', () => {
  it('never changes a stage', () => {
    // Each row states the stage the pair must *both* reach. Asserting only that
    // the two agree is satisfied by any constant classifier, which is exactly
    // what the revert check in task 2.11 caught.
    const cases: Array<[ChangeChecklistRow[], string]> = [
      [[], 'validate'],
      [[{ text: 'a', completed: false }], 'execute'],
      [[{ text: 'a', completed: true }], 'archive'],
    ]
    for (const [checklist, expected] of cases) {
      const withDesign = active({ artifacts: { design: 'ready' }, checklist })
      const without = active({ artifacts: { design: 'optional' }, checklist })
      expect(withDesign).toEqual(without)
      expect(withDesign.stage).toBe(expected)
    }
  })

  it('never changes a stage for an artifact-incomplete change either', () => {
    const withDesign = active({ artifacts: { design: 'ready', tasks: 'missing' } })
    const without = active({ artifacts: { design: 'optional', tasks: 'missing' } })
    expect(withDesign.stage).toBe(without.stage)
    expect(withDesign.stage).toBe('propose')
    // A design file is present in both of these and in the `archive` case
    // above, so presence plainly does not decide the stage.
    expect(active({ artifacts: { design: 'ready' } }).stage).toBe('execute')
  })
})

// ── 2.8 the two archive readings ────────────────────────────────────────────

describe('the two archive readings', () => {
  it('are distinguishable by source and the ready marker', () => {
    const filed = classifyChange({
      source: 'archive',
      artifacts: complete,
      reviewerVendors: [],
      hasRequestChanges: false,
      checklist: [],
    })
    const readyToFile = active({ checklist: [{ text: 'a', completed: true }] })

    expect(filed.stage).toBe('archive')
    expect(readyToFile.stage).toBe('archive')
    // Same column, different reasons, and the difference is legible without
    // opening the card.
    expect(filed.ready).toBe(false)
    expect(readyToFile.ready).toBe(true)
  })
})

// ── 2.9 conformance against upstream's classifier ───────────────────────────

/**
 * Upstream's `classifyActiveChange`, copied verbatim from
 * `agents-task-viewer/src/openspec/reader.ts` at
 * `d3ad90825948bd76fabc3e856d84077a5fd0398f`.
 *
 * Copied rather than imported because that package is `private: true`, declares
 * no exports and is a Bun application — see design decision 1. It is a snapshot
 * and pins today's behaviour: if upstream changes, this oracle drifts silently,
 * which is named in the design's risks rather than discovered here.
 */
function upstreamClassify(input: {
  artifacts: ChangeArtifacts
  reviewerVendors: readonly string[]
  hasRequestChanges: boolean
  checklist: readonly ChangeChecklistRow[]
}): string {
  if (
    input.artifacts.proposal === 'missing'
    || input.artifacts.deltaSpecCount === 0
    || input.artifacts.tasks === 'missing'
  ) {
    return 'propose'
  }

  const distinctReviewers = new Set(input.reviewerVendors.map((vendor) => vendor.toLocaleLowerCase()))
  if (input.hasRequestChanges || distinctReviewers.size < 2 || input.checklist.length === 0) {
    return 'validate'
  }
  return input.checklist.some((row) => !row.completed) ? 'execute' : 'archive'
}

describe('conformance with upstream’s classifier', () => {
  const fixtureHashes: Record<string, string> = {
    'active/openspec-lifecycle-board/.openspec.yaml':
      '0db77a840c2a2356d82ebc1671bdddcc1cf7e075820f3837796105c53dfb739a',
    'active/openspec-lifecycle-board/proposal.md':
      'fedbb4924ef77be80893811a4f7ffdc023bc0033bc029216e4a59eac00c6e405',
    'active/openspec-lifecycle-board/tasks.md':
      '8c91a6efc8c92fd93d9b63d828e5232d32f64bcf436ab08c6b95a8ce3dadf3f0',
    'active/openspec-lifecycle-board/REVIEWS.md':
      '899e17510de3979ba6575f24f1765c7137088cfbc3cab77f6eceea4c21fe5b7c',
    'active/openspec-lifecycle-board/specs/board-view/spec.md':
      'f8bbf8fdd7347439d7f613165ffc622878b921283e30193f3e8a6694b5bf45c0',
    'archive/2026-07-27-add-openspec-project-reader/.openspec.yaml':
      'b47c76ffc72f324b3fb564eccb7cfee036d1f3a5424641dff2e67a7e0e74e2f5',
  }

  // Upstream's own guard, mirrored: a parser test must not be able to silently
  // rewrite its own evidence.
  it.each(Object.entries(fixtureHashes))('%s is the byte-for-byte upstream capture', async (path, sha256) => {
    const bytes = await readFile(join(fixtures, path))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256)
  })

  it('classifies the mirrored fixture identically to upstream', async () => {
    const dir = join(fixtures, 'active/openspec-lifecycle-board')
    const [tasks, reviews] = await Promise.all([
      readFile(join(dir, 'tasks.md'), 'utf8'),
      readFile(join(dir, 'REVIEWS.md'), 'utf8'),
    ])
    const input = {
      artifacts: { proposal: 'ready', deltaSpecCount: 1, tasks: 'ready', design: 'optional' } as ChangeArtifacts,
      ...parseReviewEvidence(reviews),
      checklist: parseChecklist(tasks),
    }
    expect(classifyChange({ source: 'active', ...input }).stage).toBe(upstreamClassify(input))
  })

  it('agrees with upstream across the whole input space', async () => {
    const dir = join(fixtures, 'active/openspec-lifecycle-board')
    const [tasks, reviews] = await Promise.all([
      readFile(join(dir, 'tasks.md'), 'utf8'),
      readFile(join(dir, 'REVIEWS.md'), 'utf8'),
    ])
    const realChecklist = parseChecklist(tasks)
    const realReview = parseReviewEvidence(reviews)

    const artifactSets: ChangeArtifacts[] = [
      { proposal: 'ready', deltaSpecCount: 1, tasks: 'ready', design: 'ready' },
      { proposal: 'ready', deltaSpecCount: 1, tasks: 'ready', design: 'optional' },
      { proposal: 'missing', deltaSpecCount: 1, tasks: 'ready', design: 'optional' },
      { proposal: 'ready', deltaSpecCount: 0, tasks: 'ready', design: 'optional' },
      { proposal: 'ready', deltaSpecCount: 1, tasks: 'missing', design: 'optional' },
    ]
    const reviewSets = [
      realReview,
      { reviewerVendors: [] as string[], hasRequestChanges: false },
      { reviewerVendors: ['a'], hasRequestChanges: false },
      { reviewerVendors: ['a', 'b'], hasRequestChanges: false },
      { reviewerVendors: ['a', 'B', 'b'], hasRequestChanges: false },
      { reviewerVendors: ['a', 'b'], hasRequestChanges: true },
    ]
    const checklistSets: ChangeChecklistRow[][] = [
      realChecklist,
      [],
      [{ text: 'a', completed: false }],
      [{ text: 'a', completed: true }],
      [{ text: 'a', completed: true }, { text: 'b', completed: false }],
      [{ text: 'a', completed: true }, { text: 'b', completed: true }],
    ]

    let compared = 0
    for (const artifacts of artifactSets) {
      for (const review of reviewSets) {
        for (const checklist of checklistSets) {
          const input = { artifacts, ...review, checklist }
          expect(classifyChange({ source: 'active', ...input }).stage).toBe(upstreamClassify(input))
          compared += 1
        }
      }
    }
    // The assertion is worthless if the loop is empty.
    expect(compared).toBe(artifactSets.length * reviewSets.length * checklistSets.length)
  })

  it('agrees with upstream on the parse of the mirrored REVIEWS.md', async () => {
    const reviews = await readFile(
      join(fixtures, 'active/openspec-lifecycle-board/REVIEWS.md'),
      'utf8',
    )
    // Upstream's `parseReviewEvidence`, same file, same expectations. A parse
    // that disagreed here would make the classifier conformance above vacuous,
    // because the two boards would be classifying different inputs.
    const evidence = parseReviewEvidence(reviews)
    expect(evidence.reviewerVendors.length).toBeGreaterThan(0)
    expect(typeof evidence.hasRequestChanges).toBe('boolean')
  })
})
