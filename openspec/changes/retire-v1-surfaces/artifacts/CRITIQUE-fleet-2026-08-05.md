# Design critique — the fleet surface

**Route:** `/fleet` · **Viewport:** 1440×900, asserted `window.innerWidth === 1440`
**Appearances:** light and dark, both measured
**Method:** `impeccable:critique` — live page, real registry data (3 registered
repositories, readings computed 2026-08-05 18:13 UTC), not mocks
**Date:** 2026-08-05 · **Ratified floor:** composite ≥ 80 (32/40)

**Deviation from the method, recorded rather than hidden.** The skill requires
the two assessments to run in isolated sub-agents so neither anchors to the
other. This session carries a standing instruction not to spawn agents unless
asked, so the design assessment and the deterministic scan ran sequentially in
one head. The scan is deterministic and cannot be anchored; the design
assessment can be, and a reader should discount it accordingly. Every number
below was measured in the browser, which is the part that does not depend on who
ran it.

**The detector was proved capable of failing before its clean result was
believed.** `impeccable detect --json` over the three fleet sources returned
`[]`. A `[]` from a scanner that never fires is worthless, so a fixture carrying
`border-l-4`, `bg-clip-text` + gradient, and a purple gradient palette was
scanned first: three findings, `side-tab` / `gradient-text` /
`ai-color-palette`. The clean result is a real clean result.

---

## Design health score

**Composite 82.5 (33/40).** Above the ratified floor of 80.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | `fail` and "could not be evaluated" render as the same ✕ in the same red; the distinction lives only in the disclosure prose |
| 2 | Match system / real world | 3 | Status words are plain English; `3.2.0 · spec 1.0.0` in a Workflow cell is not |
| 3 | User control and freedom | **4** | Filters are URL state, compose correctly, and "Clear filters" survives into the zero-row case |
| 4 | Consistency and standards | **4** | One indicator primitive across six columns, distinct glyph per status, real table semantics; detector clean |
| 5 | Error prevention | 3 | Near-vacuous on a read-only surface; the one input previews its path before committing |
| 6 | Recognition rather than recall | 3 | Glyph vocabulary must be learned or hovered; six columns share one `colspan=6` cell, so no per-column header association |
| 7 | Flexibility and efficiency | 3 | Seven tab stops per repository row with no skip — 105 at a fifteen-repo fleet |
| 8 | Aesthetic and minimalist | 3 | Restrained and unfashionable in the right way; alternating 32px/111px chips, and 362px of content in a 900px viewport |
| 9 | Error recovery | **4** | Three distinct recovery paths — retry, clear filters, register — each naming its own remedy |
| 10 | Help and documentation | 3 | Per-cell disclosure explains the state *and* where the number came from; it is reachable only by hover or focus |

**Cognitive load: 1 of 8 failures — low.** The only failure is the glyph
vocabulary: six shapes carrying six statuses, none labelled on screen. Visible
options at the single decision point (the toolbar) number 8 filter chips plus a
search field — over the flag-at-four threshold, but they are two labelled
`fieldset`s of 4, which is how the count stays readable.

---

## Anti-patterns verdict

**Does this look AI-generated? No.**

**Deterministic scan.** `impeccable detect --json` over `FleetPage.tsx`,
`ReadinessIndicator.tsx` and `FleetToolbar.tsx` returned `[]`, exit 0 — after the
detector was proved to fire (above). No side-stripe borders, no gradient text, no
glassmorphism, no hero-metric block, no identical card grid.

**Design assessment.** The category reflex for "developer fleet dashboard" is
dark navy, a neon accent, and a big green percentage at the top. This is warm
off-white `rgb(250, 250, 247)` in light and `rgb(26, 23, 33)` in dark, and it
refuses the score outright — the subhead says so in as many words: *"Six checks
per repository. Count the cells — there is no combined score."* Refusing the
hero metric is the single most anti-slop decision on the page, and it is a
product decision the design then honours rather than a style applied on top.

Second-order check also passes. Having avoided the neon-dark reflex, the next
trap is editorial-typographic-with-a-serif; this is neither. It is a dense
administrative table that looks like the thing it is.

**No visual overlay tab was produced.** `npx impeccable live` does not exist in
this toolchain (`detect` is the real subcommand). The overlay step is skipped for
that reason, not for cost.

---

## Overall impression

This is a table that knows what it is for, and its restraint is earned rather
than decorative. The surface answers one question — which of my repositories is
short of what — and it answers it by putting six independent verdicts in a row
and refusing to average them. What is working is structural, not cosmetic. What
is missing is the last increment of legibility in the cell itself: the design
put a value beside the glyph where a value exists, and stopped one step short of
distinguishing "this check failed" from "we could not tell".

Biggest single opportunity: give evaluation errors their own visual, so the
scanning reader can act on the row without hovering it.

---

## What's working

**The refusal to compute a composite score, honoured in the layout.** Six equal
columns, six equal chips, no summary column, no weighting. The verdict column
says "Not ready" and nothing else — it does not pretend to be a grade. Most
dashboards in this category would have shipped a 62/100 ring at the top; this one
argues against it in the subhead and then does not build it.

**Absence never renders as zero or green.** The `never` state is a grey `Minus`,
`na` is a `Slash`, and the two are distinct from each other and from everything
else. `fx-signal-agent` and `cparx` show four grey dashes each and read
immediately as "nothing has run here", not as "passing".

**Three different empty conditions, three different answers.** Nothing
registered → "No repositories registered yet." with the register CTA. Filtered
to nothing → "No repositories match these filters." / "Every registered
repository was excluded by the current selection." with "Clear filters" and the
toolbar still on screen. Fetch failed → retry. Measured live: filtering to
`?family=other` gives 0 rows, `0 of 3 repositories`, and a reachable escape.

**Contrast is comfortable in both appearances, not merely passing.** Measured
against the page background: column headers 4.86 light / 6.88 dark, the verdict
word 5.40 / 7.95, the repository link 16.01 / 15.81, the status value on its
tint 5.46 / 7.85. The floor for body text is 4.5; nothing is scraping it.

---

## Priority issues

### [P1] Two statuses are visually identical, and the code says so

`fail` and an evaluation error both render `X` in `text-status-error` on
`bg-status-error/10`. Measured on `agenticapps-dashboard`: the Code review cell
("could not be evaluated") and the Coverage cell ("failing") are byte-identical
in glyph and colour, in light (`rgb(181, 61, 61)`) and dark (`rgb(234, 129,
129)`) alike. The only difference is the `aria-label`, and
`ReadinessIndicator.tsx:201` concedes it: *"without this the two render
identically and read identically, while ordering differently."* The fix applied
there was to the prose; the visual channel was left collapsed.

**Why it matters.** These two states demand opposite responses. "Failing" means
fix the code. "Could not be evaluated" means fix the artifact — in this case a
review file with no frontmatter to read a verdict from. A reader scanning the
fleet cannot tell which repository needs engineering work and which needs a
one-line metadata fix, without hovering every red cell. On a fifteen-repo fleet
that is fifteen hovers to recover information the daemon already has structured
on the wire.

**Fix.** Give the error case its own shape. The status vocabulary has six
members and lucide has an obvious candidate the set does not yet use
(`CircleHelp`, `FileQuestion`, or `TriangleAlert` reserved differently) — the
requirement is only that it not be `X`. The status stays `fail` on the wire, as
`repo-readiness` requires; this is a presentation-layer distinction keyed on
`check.error !== null`, which `disclose()` already reads.

**Suggested command:** `$impeccable clarify`

### [P2] Seven tab stops per row, and nothing to skip them with

Measured: 31 focusable elements inside `<main>` for three repositories — one
repository link plus six check links per row, 21 of the 31. Every readiness cell
is a `Link` to the detail page anchor. At the fleet sizes this product is built
for, that is 105 tab stops between the toolbar and the bottom of the table, with
no skip link and no roving tabindex.

**Why it matters.** The primary persona operates his own tool by keyboard. The
cells are individually reachable, which is the right instinct, but the cost is
paid by everyone who wanted to reach the row *below*.

**Fix.** Either a roving tabindex within each row's readiness group (one stop
per row, arrow keys within), or a skip-to-end-of-table link. The former keeps
every cell reachable while cutting the table to 3 stops for 3 repos and 15 for
15.

**Suggested command:** `$impeccable adapt`

### [P2] Six column headers, one cell

The `<thead>` declares nine `<th>`; each body row has four `<td>`, the third
carrying `colspan="6"` and a `grid-cols-6` group inside it. Alignment was
checked and it holds — header centres 657/772/887/1001/1116/1231 against grid
centres 656/771/886/1002/1117/1232, within 1px at every column. So this is not a
visual defect.

**Why it matters.** It is a semantic one. A screen reader user on the Coverage
chip is told the group label ("Readiness for agenticapps-dashboard") but has no
column header association to "Coverage" — the `aria-label` carries the column
name in prose instead, which works but duplicates what table semantics would
have given free.

**Fix.** Six real `<td>` cells with the same `w-8`/tint treatment would restore
header association and lose nothing visually; the grid exists to control track
width, which `<colgroup>` or fixed `<th>` widths already do.

**Suggested command:** `$impeccable audit`

### [P3] The row reads as alternating chip widths

Value-bearing cells render a 111px surface; valueless ones a 32px one. On row 1
that is wide/wide/narrow/narrow/narrow/wide. The reason is documented at
`ReadinessIndicator.tsx:237-247` and it is a good reason — a 111px tint holding
one 14px glyph is 8% ink and reads as a placeholder. But the result is a row
whose rhythm changes per repository, so the eye cannot use chip width as a cue
for anything.

**Fix.** Consider a single intermediate width for all six, sized to the widest
common value, accepting slightly more tint on the glyph-only cells in exchange
for a stable row rhythm. This is a trade, not a defect — it is P3 because the
current choice is defensible and was reasoned.

**Suggested command:** `$impeccable layout`

---

## Persona red flags

**Donald (primary — solo operator, power user of his own tool).** Gets what he
came for in one glance: three repositories, none ready, and the specific cells
that say why. Two frictions. He cannot tell the Code review ✕ from the Coverage
✕ without hovering, and those two need different afternoons. And tabbing from
the toolbar to the third repository costs 15 keystrokes.

**Jordan (first-timer).** Lands on a table of coloured chips with no legend. The
column headers are plain English and carry him a long way — "Pen test", "Code
review", "Coverage" need no explanation. The glyphs do: nothing on screen says
what `Minus` means versus `Slash`, and the hover disclosure is excellent but
undiscoverable. He will hover one cell, find the explanation, and be fine — but
only if he thinks to hover. No help link points at this surface at the moment of
confusion (§1's help-page bullets are still open).

**Alex (power user, not this product's user).** Wants to sort by column and
cannot — the headers are not controls. Wants to export, and cannot. Both are
out of scope for what this surface promises, and neither is a defect; recorded
because a fleet table sets the expectation whether or not it means to.

---

## Minor observations

- 362px of content in a 900px viewport at three repositories. The page does not
  attempt to fill the space, which is correct, but the table floats in the upper
  40% with nothing anchoring the lower 60%.
- The filter chips carry `aria-pressed` and their `fieldset`/`legend` grouping is
  real ("Filter by family", "Filter by check state"), both legends visually
  hidden at 1×1px. Correct, and worth keeping.
- Filter state lives in the URL (`?family=agenticapps&status=fail`), so the back
  button and a pasted link both work. Verified live with two sequential clicks.
- An earlier probe appeared to show a family filter being clobbered by a second
  filter click. It was an artifact of two synthetic clicks in the same tick
  racing the router; with realistic timing the two compose correctly and both
  land in the URL. Recorded so the next reader does not re-chase it.
- Console clean: no errors or warnings on load, in either appearance.
- Row heights measured `[56, 56, 56]` in both appearances, at the
  `--spacing-row-max` cap, and `scrollWidth === clientWidth === 1440` with no
  page-level horizontal scroll.

---

## Questions to consider

- The subhead argues against a composite score. Should the *verdict* column also
  stop being a single word? "Not ready" is itself a composite of six things, and
  it is the one place the surface does what the subhead forbids.
- If evaluation errors get their own glyph, does `na` still need one distinct
  from `never`? Six shapes is already at the edge of what an unlabelled
  vocabulary carries.
- The disclosure prose is the best writing on the surface and it is invisible
  until hover. What would it cost to put the reason for the *worst* check on the
  row, inline?
