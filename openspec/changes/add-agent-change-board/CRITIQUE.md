# Design critique — `/changes`, the fleet OpenSpec change board

**Route:** `/changes` · **Viewports:** 1440×900 (reference), 390×844
**Method:** `impeccable:critique` — two isolated assessments, neither able to see
the other's output, synthesised here. Live page with real fleet data (60 cards,
3 registered repositories), not mocks.
**Date:** 2026-08-04 · **Ratified floor:** composite ≥ 80 (32/40)

---

## Round 1 — the score that sent this back

**Composite 55 (22/40).** Twenty-five points under floor.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Freshness stamp the quietest text on the page |
| 2 | Match system / real world | 2 | Literal markdown on screen; `0/24` on a card sitting in Execute |
| 3 | User control and freedom | 1 | Escape does nothing; no scrim; close button tab stop 79 of 80 |
| 4 | Consistency and standards | 2 | Drawer is a modal with none of the modal contract |
| 5 | Error prevention | 3 | Read-only surface; the stale-deep-link guard is genuinely good |
| 6 | Recognition over recall | 2 | `0/51` unlabelled; the date badge never says what the date is |
| 7 | Flexibility and efficiency | 1 | No filter, sort, search, scope, or Archive collapse |
| 8 | Aesthetic and minimalist | 2 | 4,537px of Archive against 128px of Propose; one phrase 17× |
| 9 | Error recovery | **4** | The three-way empty split is better than almost anything reviewed |
| 10 | Help and documentation | 2 | Nothing explains what the stages mean |

**Cognitive load: 6 of 8 failures — critical.**

### The two findings both assessments reached independently

**The drawer was a landmark pretending to be a dialog.** Measured: `role` null,
`aria-modal` null, computed role `complementary`; focus never moved in; no focus
trap, with 79 background tabbables still reachable; no `inert` or `aria-hidden`
on the background; **Escape did nothing**; no backdrop at any width; the close
control was the **79th of 80 tab stops**, because the panel is last in the DOM
and nothing moved the caret. A keyboard or screen-reader user had no exit short
of browser Back.

**The stage rail declared a pattern it did not implement.** `role="tablist"` and
`role="tab"` with `aria-controls` null on all four, **zero** `role="tabpanel"`
anywhere in the document, all four tabs in the tab sequence, and ArrowRight
producing byte-identical state. It announced itself as a tab widget and behaved
as four ordinary buttons — worse than claiming nothing.

### What the design assessment caught that measurement could not

- **8,282px of checklist, completed items first.** 119 rows, 99 struck through;
  the first *incomplete* row sat at `offsetTop: 4760` — five viewport-heights of
  finished work before the first thing anyone still had to do. Rows showed
  literal `` ` `` and `**` because the text was rendered as text (correct for
  safety) and never tokenised (wrong for reading). Safety and legibility had
  been treated as one problem; they are two, and only the first was solved.
- **75% of the board was Archive.** 45 of 60 cards, a 4,537px column beside a
  128px one, page scroll 4,687px inside an 840px `<main>` — all of it work that
  by definition is *not in flight*, against a page whose own subtitle promises
  "every OpenSpec change in flight".
- **A docblock claim that the pixels contradicted.** The drawer's comment said
  the board "stays rendered behind it, so the reader keeps the context they
  selected from". At 1440 it covered the entire Archive column; at 390 it covered
  everything. That rationale was written from the source and never checked
  against a rendered page.

### What was already right

- The **three-way empty board** — `empty` / `all-failed` / `degraded` as separate
  components with separate copy. "Every registered repository failed, so this
  board is not showing an empty fleet — it is showing nothing at all" prevents a
  specific, expensive misreading that dashboards routinely allow.
- **Three-parameter deep linking with no parser.** A change name containing `:`
  or `/` is not a hazard because nothing splits it.
- **Contrast passed everywhere, both themes**, minimum measured 4.86:1 light and
  5.79:1 dark, against a 4.5 body floor. Heading structure, landmark labelling
  and focus-ring visibility were clean.
- **The deterministic detector found nothing real** — `[]` against the panel
  directory and the shell files. Its two URL-scan findings were disproved:
  `bounce-easing` is Tailwind v4 emitting unused `--animate-*` theme variables
  (`document.getAnimations()` returned 0 on the live page), and
  `layout-transition` belongs to a component this route does not render, which is
  already `motion-safe:`-guarded.

---

## What changed

| Finding | Fix |
|---|---|
| Drawer had no dialog contract | `role="dialog"`, `aria-modal`, focus in on open and restored on close, Tab trapped, Escape closes, dismissing scrim, close 24×24 → 32×32 and first in the panel's tab order |
| 119 checklist rows, completed first, raw markdown | Outstanding rows only by default (21, 1,206px), completed behind a disclosure; inline code and bold tokenised into real elements by a **recursive** tokeniser that never touches `innerHTML` |
| Fake tablist | Real tab widget: `aria-controls`, `role="tabpanel"`, `aria-labelledby`, roving tabindex, arrow keys with wrap |
| Rail duplicated the column heading 8px beneath it | Heading dropped in the paged layout, where the rail already names the stage and its count |
| Archive 45 of 60 cards, no filter | Bounded to 10 with "Show all N archived"; repository filter (All + one chip per repo, hidden below two repos) |
| Bare `108/129` in the a11y tree | "N/M tasks", suppressed entirely at 0 of 0 — 15 archive cards were rendering a ratio counting nothing |
| Bare date vs bare word, identical geometry | "Filed &lt;date&gt;" and "● Ready to archive" — the two archive readings now differ in shape, not only in wording |
| `Partial` glossed only in a `title` | "Partly read" in the text; `title` is mouse-only and this fleet is read from an iPad over Tailscale |
| Paged layout always opened on `propose` | Opens on the fullest non-Archive stage — `propose` was the emptiest column on the live fleet |
| `animate-pulse` unguarded | `motion-reduce:animate-none`, matching the convention `ManualPairForm` already ships |
| Nav toggle exposed no state | `aria-expanded` + `aria-controls`, label tracks state, Escape closes the panel |

**Measured on the live page after the fixes:** Archive 45 → 10 cards rendered ·
page scroll 4,687px → 900px · drawer checklist 129 → 21 rows, 8,282px → 1,206px
· literal backticks 0 · `<code>` elements 204, of which 6 nested inside `<strong>`
· `0/0` ratios 15 → 0 · drawer `role=dialog`, `aria-modal=true`, focus inside on
open, close control index 0 within the panel · Escape closes · horizontal
overflow 0 at both viewports.

### One literal `**` remains, and it is correct

Row 12.8 renders `…**review-record ordering by `mtime` is not` with an unclosed
bold. The cause is not the tokeniser: upstream's `parseChecklist` matches a
row's **first line only**, and that entry wraps in the source, so the closing
`**` is not in the text the parser produced. Rendering an unclosed marker
literally is the honest answer; inventing a close would be worse.

---

## Round 2 — 27/40 (67.5%), and a defect in round 1's own work

Still below floor, and it found things round 1's fixes had introduced or missed.

**The stage-selection fix did not do what its comment said.** The comment read
"the fullest stage that is not Archive"; the code was
`['execute','validate','propose'].find(c => counts[c] > 0)` — *latest
non-empty*. On the live fleet it opened the paged board on Execute (2 cards)
while Validate held 12. **The test written to cover it passed with the wrong
behaviour**, because its fixture had exactly one non-empty stage, so both
readings agreed. That is the same vacuity the §2.11 revert check exists to
catch, applied rigorously to three other files and missed here.

**"Changes requested" rendered on archived cards, where it is false.** Verified
against the live registry: 5 of 45 archived cards carry `hasRequestChanges`, so
`fix-readiness-sanitiser-colon-hazard` — filed, 40 of 40 complete — showed the
amber flag, and its drawer asserted "this holds the change at Validate however
many others approve". Rule 1 wins outright for an archived card and the reviewer
clause never runs, so the claim was not merely noisy but wrong.

**Two invented design tokens, both invisible in live data.**
`--color-status-success-bg` and `--color-status-warning-border` do not exist.
The first made the `● Ready to archive` badge compute to `rgba(0,0,0,0)` — no
fill; the second made the degraded banner fall back to `currentColor`, a
text-coloured hairline. Neither is reachable in the current fleet (0 of 60 cards
are `ready`, no repository is failing), which is exactly why they survived a
round of review and a browser pass. Both now use the house convention
(`bg-status-success/10`, `border-status-warning/40`), verified resolving to real
colours in the browser.

Also fixed: three of four tab `aria-controls` were dangling IDREFs, because only
the selected panel is in the DOM; "Show all N archived" was a one-way door while
its sibling disclosure toggled; filter chips were 22.7px against the 24px WCAG
2.5.8 floor and signalled selection by hue alone; and em dashes appeared in
rendered copy, which the design rules ban.

**Measured after:** Archive 10 rendered of 45 with the count stated · archived
cards flagged 5 → 0 · filter chips 22.7px → 29px · em dashes in `<main>` 0 ·
page scroll 900px · horizontal overflow 0.

## Carried, not fixed

- **No help layer.** Nothing on the page explains what the four stages mean or
  what advances a change between them. The drawer's one sentence — *"Changes
  requested — this holds the change at Validate however many others approve"* —
  is the best copy on the surface and is the only place any rule is stated.
- **"Changes requested" still appears on every Validate card** (12 of 12 on the
  live fleet). Honest at fleet level, near-zero discriminating information within
  the column where it matters most. The design assessment proposed inverting it —
  badge the *exception* — and rolling the aggregate into the column header. That
  is a product judgement about what the board is *for*, not a defect, and it is
  recorded rather than guessed at.
- **The 1056px four-to-one break** skips iPad landscape (1024), a device
  `PRODUCT.md` names for this persona. The arithmetic is right; the inputs treat
  the 240px sidebar as fixed when it already collapses below 640. Either raise
  the sidebar's threshold or add a 2×2 intermediate.
- **The drawer is a dead end.** Two focusables and no action, on a surface whose
  job is triage. `POST /open` already exists in this product; a footer action row
  is three links and no new data. It is a scope decision, not a defect.
- **The board cannot rank.** Twelve Validate cards are stuck for one identical
  reason and nothing says which to unstick first. Approvals, request counts and
  age are all already on the wire record and none of them is on the card.
- **~40% of the board is empty at 1440.** `repeat(4, minmax(0,1fr))` gives a
  one-card column the same quarter of the screen as a twelve-card one.
- **The scrim dims content but does not separate surfaces.** Background text
  drops 16.74:1 → 2.50:1, but the drawer panel against the scrimmed board behind
  it is 1.03:1 — the modal's edge is not distinguishable from what it covers.
  Same root cause as the badge pills reading as plain text: every "subtle
  surface" in this palette sits within ~1.1:1 of `card-bg`.

## The score, and what it would take

| Round | Composite | Against floor 80 |
|---|---|---|
| 1 | 55 (22/40) | −25 |
| 2 | 67.5 (27/40) | −12.5 |

Both rounds of fixes were behavioural and semantic: accessibility, correctness,
labelling, bounding. Heuristics 7 (flexibility and efficiency) and 8 (aesthetic
and minimalist) did not move, and they are what caps the total — the board still
cannot rank, cannot act, and spends 40% of its area on nothing.

**Closing that gap is a product decision about what this board is for**, not a
defect list. It is recorded here rather than guessed at.

---

## Provenance

Both rounds ran two assessments in isolation — an LLM design review reading
source and inspecting the rendered page, and an automated pass running the
deterministic detector plus browser-measured accessibility, contrast, overflow,
motion and tap-target checks. Neither saw the other's output before synthesis.
The re-score after the fixes was run the same way, against the same viewports
and the same live data.
