# Design critique — the agent change board

**Route:** `/changes` · **Viewport:** 1440×900, asserted `window.innerWidth === 1440`
**Appearances:** light and dark, both measured
**Method:** `impeccable:critique` — live page, real fleet data (63 changes across
three repositories, readings computed 2026-08-05 18:32 UTC), not mocks
**Date:** 2026-08-05 · **Ratified floor:** composite ≥ 80 (32/40)

**Deviation from the method, recorded rather than hidden.** The two assessments
ran sequentially in one head rather than in isolated sub-agents, because this
session carries a standing instruction not to spawn agents unless asked. The
deterministic scan cannot be anchored; the design assessment can be. Every
number below was measured in the browser.

---

## Design health score

**Composite 87.5 (35/40).** Above the ratified floor of 80.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | **4** | Generated-at line, per-stage counts, per-card progress, and the drawer names the record it classified from |
| 2 | Match system / real world | **4** | The four stage names are the operator's own lifecycle words; every badge is plain English |
| 3 | User control and freedom | 3 | Escape closes and cleans the URL, but focus lands on `BODY` rather than the card that opened |
| 4 | Consistency and standards | **4** | One card primitive across four columns; the badge slot differs in shape, not only in words |
| 5 | Error prevention | 3 | Near-vacuous — a read-only board with nothing to submit |
| 6 | Recognition rather than recall | **4** | The drawer carries stage, source, artifacts, verdict prose and checklist; nothing to hold in the head |
| 7 | Flexibility and efficiency | **4** | One tab stop per card, repo filter, and a card is a shareable deep link |
| 8 | Aesthetic and minimalist | 3 | Columns measure 218 / 1062 / 207 / 1047 and the page scrolls as one, so two columns are empty for most of the scroll |
| 9 | Error recovery | 3 | Nothing to recover from; the drawer's exit works |
| 10 | Help and documentation | 3 | The drawer is the documentation and it is very good; nothing explains what holds a change at a stage |

**Cognitive load: 1 of 8 failures — low.** The failure is visual hierarchy: with
four columns of radically different length there is no reading order, and the
eye starts wherever the tallest column is. Visible options at the top decision
point number 4 repository chips, at the threshold rather than over it.

---

## Anti-patterns verdict

**Does this look AI-generated? No.**

**Deterministic scan.** `impeccable detect --json` over
`src/components/panels/changes/` returned **one finding**, and it is a **false
positive**:

> `broken-image` — "Broken or placeholder image" — `ChecklistRow.tsx:8`, snippet
> `<img onerror=…>`

`ChecklistRow.tsx` contains no `<img>` element. Line 8 is inside the file's
docblock, which explains why checklist text is tokenised into React elements
rather than parsed as markup: *"A `<img onerror=…>` in a row therefore renders
as the characters someone typed."* The detector scans raw file text including
comments and matched the example in a comment describing the XSS defence. This
is the same class of false positive this repo has already hit twice — a scanner
reading a file's own explanatory prose as if it were code.

**No genuine findings.** No side-stripe borders, no gradient text, no
glassmorphism, no hero metric, no identical card grid — and worth noting
explicitly, because a kanban board is the one layout where "identical card grid"
is a live risk. It escapes because the cards are a list of real records with
variable content, not a decorative grid of features.

**Design assessment.** The card is a `<button>` carrying a name, a repository, a
count and at most one badge, on fill with no border (`border-width: 0px`,
`rgb(255,255,255)` on `rgb(250,250,247)` light; `rgb(34,30,43)` on
`rgb(26,23,33)` dark). It resists the two reflexes a change board invites: no
avatars, and no coloured left edge per repository.

---

## Overall impression

The best-engineered surface of the four. Every interaction that a board like this
usually gets wrong is right here: the archive is capped and *says* it is capped,
the card is one tab stop rather than five, the drawer is a real deep link, and
the review verdict quotes the reviewer's own sentence and names the file it came
from. The layout is the weak part, not the thinking.

---

## What's working

**The cap is disclosed, not silent.** Archive declares 48 in its heading and
renders 10 cards plus a "Show all 48 in Archive" control. Measured:
`renderedCards: 11` where the eleventh is the disclosure. A board that quietly
showed the first ten of 48 would look identical and be a lie; this one says the
number twice.

**The drawer earns being a drawer.** Opening `retire-v1-surfaces` produced
`?repo=agenticapps-dashboard&source=active&change=retire-v1-surfaces` — a link
that reopens exactly that card. It carries `role="dialog"`,
`aria-label="Detail for retire-v1-surfaces"`, moves focus inside on open, and
closes on Escape with the URL cleaned back to `/changes`. The close control is
icon-only but properly named (`aria-label="Close detail"`).

**It quotes the reviewer rather than summarising them.** The drawer shows
"Approved by gemini." and "Changes requested. This holds the change at Validate
however many others approve." followed by "Read from REVIEWS-round-3.md". That
last line is the spec's round-numbered-record rule made visible — the board
names the record it classified from rather than noting that several exist — and
it is the difference between a reader trusting the verdict and having to go
check.

**Completed work is collapsed by default.** The checklist opens showing the 28
open tasks with a "Show 28 completed" control. On a 56-task change that is the
right default, and it is the same progressive-disclosure instinct as the archive
cap.

**The badge slot differs in shape, not only in colour or wording.** "Ready to
archive" carries a `●`; "Filed 2026-08-04" does not. The comment at
`ChangeCard.tsx:40-45` explains why: both readings used to occupy the slot with
identical geometry, so a reader who only ever saw dates had no reason to expect
the other state existed.

**Contrast is comfortable in both appearances.** Change name on card 16.74 light
/ 14.58 dark, repository 5.08 / 6.35, status word 5.65 / 7.33, stage headings
4.86 / 6.88.

---

## Priority issues

### [P2] Closing the drawer drops focus to the top of the document

Measured: open a Validate card, press Escape. The drawer closes, the URL cleans
correctly — and `document.activeElement` is `BODY`. Focus is not returned to the
card that opened the drawer.

**Why it matters.** A keyboard user reading down the Validate column opens the
sixth card, reads it, and closes it — and is returned to the very top of the
document, needing to tab past the skip link, the sidebar, the four repository
filters and five cards to get back to where they were. Every card they inspect
costs them the whole journey again. This is the standard modal contract and it
is the one part of an otherwise careful dialog implementation that is missing.

**Fix.** Store the invoking element on open and `.focus()` it on close. The
open path already moves focus in, so the mechanism is half built.

**Suggested command:** `$impeccable harden`

### [P2] Four columns, two of them empty for most of the page

Measured heights: Propose 218, Validate 1062, Execute 207, Archive 1047 — all
272px wide, in a page that scrolls as a single unit (`main` 1269 vs 840) rather
than per column.

**Why it matters.** Reaching the bottom of Validate scrolls Propose and Execute
entirely off screen, so for roughly 800px of scroll the reader is looking at two
columns of content and two columns of nothing. The stage counts are in the
headings, which scroll away with them — so once you are scrolling, the surface
no longer tells you which stage you are in.

**Fix.** Either give each column its own bounded scroll with a sticky heading, or
cap the active columns the way Archive is already capped, with the same
disclosed "Show all N" control. The second reuses a pattern already on the page
and already proven.

**Suggested command:** `$impeccable layout`

### [P3] The close control is a 32×32 target

Measured 32×32px against a 44px recommended minimum. Everything else on the page
is comfortable — cards are full-width 272px buttons, filter chips are 31px tall
but wide. Escape works and is the likely path for the primary persona, which is
why this is P3 rather than P2.

**Suggested command:** `$impeccable adapt`

### [P3] Every card in Validate says the same thing

All 11 Validate cards carry "Changes requested"; none carries "Approved". At the
moment the label is perfectly correlated with the column, so it distinguishes
nothing within it and costs a line on every card.

This is arguably data rather than design — a change *sits* at Validate largely
because of its review state, so the correlation may be near-permanent by
construction. Recorded as a question rather than a defect: if the label can only
ever repeat the column, it belongs in the column heading, not on 11 cards.

**Suggested command:** `$impeccable distill`

---

## Persona red flags

**Donald (primary — solo operator, power user of his own tool).** Very well
served. He sees 63 changes across three repositories grouped by exactly the
lifecycle he works in, filters to one repository in a click, and opens a change
to find the reviewer's actual objection and the file it came from without
leaving the page. The two frictions are both keyboard-shaped: every drawer he
closes throws him to the top of the document, and the stage headings scroll away
so deep in the Validate column he has to scroll back up to confirm which stage
he is reading.

**Jordan (first-timer).** Understands the board immediately — four stages, cards
with names and progress — which is more than can be said for most of this
product. Where he stalls is *why*: nothing on the surface explains what moves a
change from Validate to Execute, and the one clue ("Changes requested") appears
on every card in the column, so it reads as decoration rather than as the
blocking condition it is.

**Alex (power user, not this product's user).** Expects to drag a card between
columns and cannot — correctly, since the board reports lifecycle state derived
from files rather than setting it, but nothing on screen says so, and a
kanban layout is a strong affordance for dragging. Would also want to filter by
stage, or collapse Archive entirely; the repository filter is the only one.

---

## Minor observations

- The board is reading this session's own work: both Propose cards are the
  backlog entries filed today, and the open drawer for `retire-v1-surfaces` lists
  "Four design-critique artifacts, one per surface" as an open task. The change
  board correctly reflects live disk state, which is the strongest evidence it is
  not mocked.
- Active cards carry no age; Archive cards carry "Filed 2026-08-04". This is
  **not** a spec gap — `agent-change-board`'s staleness rules govern which
  *review record* is selected, not card age, and that rule is surfaced correctly
  in the drawer ("Read from REVIEWS-round-3.md"). Noted only because a reader
  might expect an age on a board where a change can sit for weeks.
- 30 focusable elements for 26 cards: four repository chips plus one stop per
  card. Compare the fleet, which spends seven stops per row.
- Task counts use `tabular-nums` (`28/56`), consistent with the numeric-column
  requirement applied on the other surfaces.
- Console clean; `scrollWidth === clientWidth === 1440`, no page-level horizontal
  scroll.
- The px type-scale finding recorded against the repository detail surface
  applies here too and is not re-litigated. See `openspec/BACKLOG.md`.

---

## Questions to consider

- Archive holds 48 of the 63 changes and gets equal column width to Propose's 2.
  Should a stage the reader almost never acts on occupy a quarter of the board?
- The drawer quotes the reviewer's objection in full. That sentence is the single
  most useful string on the surface, and it is two clicks away. What would it
  cost to put the first clause on the card?
- If cards cannot be dragged, is a kanban layout the honest shape for this data,
  or would four labelled lists say the same thing without promising an
  interaction that does not exist?
