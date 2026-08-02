# impeccable:critique — close-readiness-spec-gaps

Routes: `/fleet` and `/repos/{id}`, 1440×900, both appearances.
Register: **product**. Two assessments, run in isolation.

## Result: composite 67.5 — BELOW the ≥ 80 floor

Nielsen total **27 / 40**. Composite = (27 / 40) × 100.

| # | Heuristic | Score |
|---|---|---|
| 1 | Visibility of system status | 3 |
| 2 | Match with the real world | 3 |
| 3 | User control and freedom | 2 |
| 4 | Consistency and standards | 3 |
| 5 | Error prevention | 3 |
| 6 | Recognition rather than recall | 2 |
| 7 | Flexibility and efficiency | 3 |
| 8 | Aesthetic and minimalist design | 3 |
| 9 | Recognise / diagnose / recover | 3 |
| 10 | Help and documentation | 2 |

Cognitive load: **4 failures — critical**.

## Assessment B — deterministic detector

`npx impeccable detect --json packages/spa/src/components/panels/readiness/`
→ **0 findings, exit 0.** Clean on the changed surface.

Wider `components/` tree: 4 × `broken-image`, all in `.test.tsx` fixtures.
Pre-existing, none in files this change touched, false positives for the
detector's purpose.

**The reference file's CLI is stale.** It documents `npx impeccable --json` and
`npx impeccable live`; the installed CLI has neither. The bare-flag form returns
`[]` and exits 0, which reads as "clean" while having scanned nothing. Recorded
because a future run that trusts the reference will silently skip Assessment B.

## Assessment A — design review

**AI slop verdict: CLEAN.** Zero gradients, zero `backdrop-filter`, no
side-stripe borders, no dark glows, no hero-metric template, no emoji. Contrast
measured against composited backgrounds: disclosure text 5.08:1 light / 6.35:1
dark, verdict green 5.71:1 / 7.24:1 — all clear the body floor with margin.

### Fixed in this change

- **P1 — the advisory concept was stated once and never where it is asked
  about.** The verdict says "excludes pen test"; the obvious next click is the
  pen-test cell, which deep-linked correctly and then answered a different
  question. The words *advisory* / *does not block* appeared nowhere in the
  product. Remedy copy now says it outright, and the cell's accessible name
  carries `advisory: does not block readiness` — previously byte-identical on a
  repo it blocked and one it did not.
- **P3 — the two-line row broke the table's rhythm, and was a latent break.**
  Rows with a disclosure measured 55px against 43px. Worse, the rendered box is
  88px and the string measures 91.48px: it fit on one line by rounding luck, and
  `exclusionPhrase` already supports lists — a second advisory check produces a
  196px string and a three-line row. Fixed height on all rows: uniform 56px,
  measured, and a wrap no longer changes the rhythm.
- **P2 — "excludes" is disclaimer register and off-vocabulary.** Kept
  deliberately, on the reviewer's own condition: *"keep 'excludes' only if you
  can commit to the paired P1 sentence, which makes it self-explanatory in
  context."* P1 is done. The suggested alternative `pen test never run` was
  rejected on a ground the reviewer did not weigh — it restates the cell and so
  fails this change's own normative requirement, which demands the verdict name
  what it *excludes*, on the explicit ground that adjacency is not disclosure.

### Not fixed — recorded

- **P4 — the detail header renders the verdict at `text-sm`**, the same size as
  the timestamp beside it, fourth on a baseline row after a 24px `h1`. Real, and
  pre-existing: the verdict has always sat there. Promoting it is a design change
  to a surface this change only qualifies.
- **P5 — "Not ready" names no blocker** while "Ready" now explains itself. The
  asymmetry is backwards and the reviewer is right about it. It is also a change
  to the negative verdict, which is beyond this change's scope, and it needs the
  blocking-count vocabulary decided rather than invented in a fix.

### The floor gap is mostly not this change

Of the 13 points lost, the largest single contributors are pre-existing and
carried: **no legend for the six glyph columns** on `/fleet` (heuristic 6,
cognitive-load #6 — carried in the session handoff since before this change),
**`/help` is 11-of-12 stubs** (heuristic 10), **no filter on the readiness
predicate itself and no clear-all** (heuristic 3), and **nine undifferentiated
controls in the filter row with `sr-only` group labels** (cognitive-load #1).
None is introduced here and none is in scope.

This is the structural-debt case the CLAUDE.md floor clause anticipates. It is
recorded rather than self-waived: the waiver is the operator's to grant.

### Open questions worth carrying

The reviewer's sharpest, unanswered: *if nothing can ever derive a pen test and
the check now blocks nothing, what is the column for?* A permanent grey stripe
down the fleet whose only function is to make the verdict apologise for it. And:
*is "Ready" the right word once it can be true with a check that never ran?*
Both belong to the follow-up that narrows the readiness-file blast radius.

## Waiver — granted 2026-08-02

The operator waived the ≥ 80 floor under the CLAUDE.md structural-debt clause,
having been shown the score, what this change caused, and what it inherited.

Basis: both priority findings attributable to this change (P1, P3) are fixed and
verified. The residual gap is dominated by debt that predates the change and is
out of its scope — no glyph legend on `/fleet`, `/help` at 11-of-12 stubs, no
filter on the readiness predicate, and nine undifferentiated controls in the
filter row with `sr-only` group labels.

Not waived away, carried: **P4** (the detail header renders the verdict at
`text-sm`, level with the timestamp beside it) and **P5** ("Not ready" names no
blocker while "Ready" now explains itself). P5 is the sharper of the two — this
change established that a verdict states its own basis, then applied it only to
the passing case, which inverts what an operator opens the dashboard to triage.
