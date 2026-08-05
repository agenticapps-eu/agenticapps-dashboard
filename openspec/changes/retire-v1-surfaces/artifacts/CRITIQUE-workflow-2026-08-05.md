# Design critique — the workflow conformance surface

**Route:** `/workflow` · **Viewport:** 1440×900, asserted `window.innerWidth === 1440`
**Appearances:** light and dark, both measured
**Method:** `impeccable:critique` — live page, real fleet data (four host
repositories, core spec 1.6.0), not mocks
**Date:** 2026-08-05 · **Ratified floor:** composite ≥ 80 (32/40)

**Deviation from the method, recorded rather than hidden.** The two assessments
ran sequentially in one head rather than in isolated sub-agents, because this
session carries a standing instruction not to spawn agents unless asked. The
deterministic scan cannot be anchored; the design assessment can be, and a
reader should discount it accordingly — which matters more here than on the
other three surfaces, because this is the one artifact of the four that fails
the floor. Every number below was measured in the browser.

**The eight harness buttons were not pressed.** "Run change gate" and "Run
reviewer CLI" execute processes on the operator's machine. Exercising them was
out of scope for a read-only critique and was not attempted; everything said
about them below is about their presented state, not their behaviour.

---

## Design health score

**Composite 57.5 (23/40). Below the ratified floor of 80.**

This is the only one of the four surfaces that fails. It is not a near miss —
it is 9 points of Nielsen score short, and the reasons are structural rather
than cosmetic.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 2 | No timestamp anywhere on a surface whose entire subject is whether things are *currently* in sync |
| 2 | Match system / real world | 3 | Correct for its audience, but "Offered 0034", "2 unknown" and "implements spec missing" are field names, not sentences |
| 3 | User control and freedom | 3 | Nothing traps the reader; the eight long-running actions offer no visible cancel |
| 4 | Consistency and standards | 2 | Rows measure up to 100px against the ratified 56px cap, in both appearances; host names are inert here and links on the fleet |
| 5 | Error prevention | 3 | Nothing destructive; the actions are the only risk and they are idempotent |
| 6 | Recognition rather than recall | 2 | 34 chips that all read "· Present"; migration numbers with no ledger to hand |
| 7 | Flexibility and efficiency | 2 | No filter, no sort, no deep link, nothing clickable, 1916px of scroll |
| 8 | Aesthetic and minimalist | 2 | One bit of information rendered as 34 chips; three unrelated comparison models stacked |
| 9 | Error recovery | 2 | The surface detects divergence and offers no route to resolving it |
| 10 | Help and documentation | 2 | Nothing explains the vocabulary it invents; no help page points here |

**Cognitive load: 6 of 8 failures — critical.**

| Check | Verdict |
|---|---|
| Single focus | **fail** — three unrelated comparison models on one page |
| Chunking (≤4 per group) | **fail** — one skill group holds 12 chips |
| Grouping | pass — sections, labelled regions and real tables |
| Visual hierarchy | **fail** — "Aligned" and "7 laggards" carry identical weight |
| One thing at a time | pass — the sections can be read in sequence |
| Minimal choices (≤4) | **fail** — 8 action buttons visible at once |
| Working memory | **fail** — five-column matrix, and "Offered 0034" needs a ledger held off-screen |
| Progressive disclosure | **fail** — everything expanded, always |

---

## Anti-patterns verdict

**Does this look AI-generated? No** — and this is worth stating plainly, because
a low score usually invites the assumption. The surface is not generic. It is
under-designed for the amount of information it carries, which is the opposite
failure.

**Deterministic scan.** `impeccable detect --json` over
`src/components/workflow/` returned `[]`, exit 0. The detector was proved capable
of firing earlier in the same session. No side-stripe borders, no gradient text,
no glassmorphism, no hero metric, no identical card grid.

**Design assessment.** Nothing here is decorative. The palette is the same
restrained warm neutral as the rest of the product, the tables are real tables
with real headers and labelled scroll regions, and every string on the page is a
fact the daemon computed. The problem is that it is a data dump wearing a table:
every fact the daemon produces is rendered, at equal weight, in source order.

---

## Overall impression

This surface knows more than any other in the product and communicates less. It
holds the answer to a genuinely useful question — *do my five workflow
repositories still agree with each other?* — and it answers it by printing
everything it knows and leaving the reader to do the reduction.

Three things would move it most, in order: say when the reading was taken; say
which of the divergences matters; and collapse the 34 chips that say "Present"
into the one sentence they amount to.

---

## What's working

**The table semantics are real.** Two `<table>`s with proper `<thead>` and
`<th scope>`, each wrapped in a `div[role="region"]` with a genuine
`aria-label` ("Workflow spec conformance matrix", "Shared workflow artefact
matrix") and `tabindex="0"` so a keyboard user can reach and scroll them. The
last artefact row is honest about not being per-host: `<th>Machine-wide
tools</th>` with a `colspan="4"` cell rather than four repeated copies.

**Every state is a word, never a colour alone.** "Behind", "Aligned",
"Identical", "Pinned", "Valid", "Present", "No current result". Nothing on this
surface requires a legend, which is more than the fleet can say.

**The buttons are properly labelled for assistive tech.** "Run change gate for
claude-workflow", not "Run" — eight buttons that would otherwise be eight
identical accessible names.

**Contrast is comfortable in both appearances.** Column headers 4.86 light /
6.88 dark, chips 5.40 / 7.95, subhead 4.86 / 6.88.

**Touch targets are honest.** The action buttons measure 131×44px.

---

## Priority issues

### [P1] Rows exceed the ratified density cap — already recorded, restated here

Measured at 1440×900 against the token-resolved cap of 56px, **identically in
light and dark**:

| Table | Row heights (px) | Max | Within cap | Uniform |
|---|---|---|---|---|
| Spec conformance | 100, 75.5, 51, 99.5 | 100 | no | no |
| Shared artefacts | 71.5, 71.5, 51, 51, 51, 50.5 | 71.5 | no | no |

This reproduces the measurement taken while closing §3's row-height bullet, and
is already filed as an OPEN entry in `openspec/BACKLOG.md` ("Workflow surface:
rows exceed the declared density budget"). It is restated here because a
critique artifact that omitted it would misrepresent the surface, not because
it is new.

**Suggested command:** `$impeccable layout`

### [P1] The surface never says when it was read

Verified: no occurrence of "UTC", "as of", "computed", or any relative time
anywhere in `<main>`'s rendered text. The fleet carries "Readings computed
2026-08-05 18:13 UTC"; the repository detail carries "Readiness as of
2026-08-05 18:21 UTC" and a Rescan control that updates it. This surface carries
nothing.

**Why it matters more here than anywhere else.** Every other surface reports a
*state*; this one reports an *agreement*, and agreement is a claim about a
moment. "codex-workflow: 7 laggards" is actionable if it is true now and
misleading if it was true an hour ago. The reader has no way to tell, and no
control to refresh.

**Fix.** A generated-at line in the header, and a Rescan equivalent. The
repository detail already has both, including the always-mounted `role="status"`
region pattern that makes the refresh announceable.

**Suggested command:** `$impeccable harden`

### [P1] Thirty-four chips that all say "Present"

Counted on screen: 34 chips under "Machine skill roots", every single one
matching `· Present`. Four groups — Claude (4), Codex (11), OpenCode (11), Pi
(3) — each led by a group chip that also reads "· Present".

**Why it matters.** The information content is one bit: *nothing is missing*.
It is rendered as 34 elements across 260px, and because every chip is identical
in form and wording, a reader scanning for the one that says something else has
to read all 34 to be sure there isn't one. The design makes the common case
expensive and the exceptional case invisible.

**Fix.** Collapse to the exception. "All 34 skills present across four hosts"
as one line, expanding to the full list on demand — and when something *is*
missing, show only what is missing. The absent case is the only one worth 260px.

**Suggested command:** `$impeccable distill`

### [P2] Zero links: the surface is a navigational dead end

Measured: `main.querySelectorAll('a').length === 0`. Four host repositories are
named in the spec table, four more as `<h3>`s in the harness section, and 34
skills are named in chips. None of them is clickable, and there is no route from
"codex-workflow has 7 laggards" to anywhere that would help.

This is also a cross-surface inconsistency: on the fleet, a repository name is a
link to its detail page. Here the same kind of name is inert text.

**Why it matters.** Every other surface in the product ends in an action or a
destination. This one ends in a fact. The reader who learns something here has
to leave the product to act on it.

**Fix.** At minimum, link host names to their registry entry or detail page
where one exists. Better, give each divergence the remedy sentence treatment the
repository detail already generates daemon-side.

**Suggested command:** `$impeccable clarify`

### [P2] Nothing on the page says which divergence matters

All four hosts read "1.0.0 Behind" in Primary skill. Three of four carry unknown
or laggard skills; one is "Aligned". Every one of these is rendered at the same
weight in the same order, in a table sorted by nothing. "Offered 0034" and
"Offered 0011" sit in the same column with no indication that one is 23
migrations further along than the other.

**Fix.** Order by distance from core, or mark the worst row. The repo detail's
`readinessOrder.ts` comparator is the precedent for ranking rather than listing.

**Suggested command:** `$impeccable layout`

### [P3] The stated count cannot be reconciled with the visible one

The subhead says "the five workflow repositories". Four hosts appear in the spec
table, four columns in the artefact matrix, four `<h3>`s in the harness section.
The fifth — `agenticapps-workflow-core` — appears only as the badge "Core spec
1.6.0" beside a heading.

**The copy is correct.** `workflow-fleet-conformance` fixes the fleet at exactly
five: core plus the four named hosts. So this is not an error. But the spec's own
scenario says "the core and all four named host implementations appear in fixed
order", and a reader counting rows counts four, with no way to see that the
fifth is the thing everything else is being measured *against*.

**Fix.** Give core a row or a column of its own, even a degenerate one — it is
the reference, and showing it as the reference is more informative than a badge.

**Suggested command:** `$impeccable layout`

---

## Persona red flags

**Donald (primary — solo operator, power user of his own tool).** This is his
surface and it is written in his vocabulary, which is why the jargon does not
cost him what it would cost anyone else. What costs him is everything else: he
cannot tell how fresh the reading is, cannot click from a laggard skill to the
repository that carries it, and has to scroll 1916px past 34 chips saying
"Present" to reach the harness section. The information he came for — which host
is furthest from core — is on the page and he has to compute it himself.

**Jordan (first-timer).** Bounces. "Offered 0034", "2 unknown",
"implements spec missing", "1 laggard" and "Pinned" versus "Identical" versus
"Valid" are five distinct vocabularies with nothing on screen defining any of
them, no tooltips (`[title]` and `[aria-describedby]` both count zero), and no
help page pointing here. He will not know whether the page is telling him
something is wrong.

**Alex (power user, not this product's user).** Wants to sort the matrix, filter
to divergences only, and link out to each repo. Gets none of the three. Would
also expect the eight action buttons to report when they last ran; all eight say
"No current result" with no indication whether that means never, or not since
some point.

---

## Minor observations

- The two scroll regions carry `tabindex="0"` correctly, but at this viewport
  neither actually overflows (`scrollWidth === clientWidth === 1089`), so they
  are two focus stops with nothing to do. Correct per the pattern; worth knowing
  they are the first two stops a keyboard user hits.
- Total interactive elements: 10 — two scroll regions and eight buttons. For a
  1916px page, that is a very low interaction density, which is the P2 above
  seen from the other side.
- The harness section is 523px of "No current result" repeated eight times
  across four identical 211px blocks. As an empty state it is honest; as a
  quarter of the page's height it is expensive.
- Cell text runs together when read as a string ("1.0.0Behind",
  "2.0.0Identical") because value and state are adjacent elements. Visually they
  are stacked and legible; noted only so a future reader of a text dump does not
  mistake it for a rendering fault.
- Console clean; `scrollWidth === clientWidth === 1440`, no page-level
  horizontal scroll; the page scrolls inside `<main>` (1916 vs 840).
- The px type-scale finding recorded against the repository detail surface
  applies here too and is not re-litigated: text does not respond to the
  reader's root font size on any surface. See `openspec/BACKLOG.md`.

---

## Verdict against the floor

**57.5 against a ratified floor of 80.** Recorded, not waived — the
structural-debt waiver clause (D-10.5-03.calibration-2, ratified 2026-06-08) is
the operator's to invoke, and the precedent for it is `/code-intelligence`,
which was waived at 74 to a named follow-up bundle and later lifted to 81 to
retire the waiver.

Two things are worth weighing in that decision. First, the largest single
contributor to this score — the density violation — is already OPEN in the
backlog with its fix described as needing its own change, so the surface is
already known to be carrying structural debt that `retire-v1-surfaces` did not
scope. Second, three of the P1s (timestamp, chip collapse, links) are
independently small and would move the score materially without touching the
density question at all.

---

## Questions to consider

- Should this surface exist as one page? Spec conformance, byte-identity of
  shared artefacts, and a harness runner are three jobs; the only thing they
  share is the word "workflow".
- If the harness results section were removed until a result exists, would
  anything be lost other than the buttons — and could the buttons live in the
  header instead?
- The repository detail generates a remedy sentence per finding, daemon-side, and
  it is the best writing in the product. What stops the same treatment applying
  to "7 laggards"?
