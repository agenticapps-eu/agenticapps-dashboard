# Design critique — the repository detail surface

**Route:** `/repos/agenticapps-dashboard` · **Viewport:** 1440×900, asserted
`window.innerWidth === 1440`
**Appearances:** light and dark, both measured
**Method:** `impeccable:critique` — live page, real readiness data (readings
computed 2026-08-05 18:21 UTC, refreshed live to 18:24 by exercising Rescan),
not mocks
**Date:** 2026-08-05 · **Ratified floor:** composite ≥ 80 (32/40)

**Deviation from the method, recorded rather than hidden.** The two assessments
ran sequentially in one head rather than in isolated sub-agents, because this
session carries a standing instruction not to spawn agents unless asked. The
deterministic scan cannot be anchored; the design assessment can be. Every
number below was measured in the browser.

---

## Design health score

**Composite 87.5 (35/40).** Above the ratified floor of 80, and the strongest of
the four surfaces.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | The Code review block reports two different statuses about itself in adjacent lines |
| 2 | Match system / real world | **4** | Remedies name the actual file and the actual command; provenance is written in plain English |
| 3 | User control and freedom | **4** | Two idempotent actions, expandable evidence, nothing destructive, nothing modal |
| 4 | Consistency and standards | 3 | Evidence is an expandable control in three blocks and inert text in a fourth, with no on-screen rule |
| 5 | Error prevention | 3 | Near-vacuous — a read-only page whose two controls are both safe to repeat |
| 6 | Recognition rather than recall | **4** | Status appears as a word beside every heading, not as a glyph to decode |
| 7 | Flexibility and efficiency | **4** | 11 tab stops; six anchor chips jump to their section; `#coverage` deep-links from the fleet |
| 8 | Aesthetic and minimalist | 3 | Six near-identical cards at 219–237px; nothing on the page points at the check that needs attention |
| 9 | Error recovery | 3 | The remedy is the point of the page, and one of the six is wrong for the state it accompanies |
| 10 | Help and documentation | **4** | The evidence disclosure shows the real file, bounded at 320px with its own scroll |

**Cognitive load: 1 of 8 failures — low.** The failure is uniformity: six blocks
of identical shape mean the reader must read all six to find the one that
matters. Visible options at the only decision point (the header) number 2.

---

## Anti-patterns verdict

**Does this look AI-generated? No.**

**Deterministic scan.** `impeccable detect --json` over `RepoDetailPage.tsx` and
`ReadinessIndicator.tsx` returned `[]`, exit 0. The detector was proved capable
of firing during the fleet critique earlier the same session (a fixture with
`border-l-4`, gradient text and a purple palette returns three findings), so the
clean result is a real one.

**Design assessment.** The page is built out of `<section>` + `<h2>` + `<dl>`,
which is what the content actually is, and the cards carry fill without borders
(`rgb(255,255,255)` on `rgb(250,250,247)` light; `rgb(34,30,43)` on
`rgb(26,23,33)` dark) rather than the shadow-and-ring treatment the category
reflexes toward. No hero metric — and this is the surface where one would have
been most tempting, since a per-repo page is exactly where products put a big
score ring. There is no score at all, which is consistent with the fleet's
refusal and is the strongest evidence that the refusal is a real product
position rather than a layout accident.

Second-order check passes: having avoided the dark-neon reflex, the page does not
land in the editorial-typographic trap either. It reads as an administrative
record.

---

## Overall impression

This is the best-written surface in the product. Every check states what it
found, where it read it, when, and what to do about it, in plain sentences that
name real paths and real commands. The evidence disclosure — one click from the
claim to the bytes the claim was made from, bounded so it never runs away with
the page — is a genuinely excellent piece of interaction design and the thing
most worth protecting in any future rework.

Two things hold it back, and they are unrelated to each other. One is a state
the presentation layer does not model, which makes a block contradict itself and
hand the reader the wrong instruction. The other is that the type scale is
declared in pixels, so a reader who enlarges text gets nothing.

---

## What's working

**The remedy is the payload, and it is specific.** "Production code has moved
past the reviewed commit. Re-run the security review against the current tree and
commit an updated SECURITY.md." That sentence names the cause, the effect, and
the fix, in that order, and it is generated rather than authored per repo.

**Evidence goes from claim to file in one click, bounded.** Measured: the
Workflow block's disclosure expands the section 237px → 563px, revealing a
`<pre>` capped at `max-height: 320px` with `overflow-y: auto` around a 5585px,
17682-character file. Progressive disclosure with a bound, which is the half
most implementations skip.

**Absent values render the canonical em dash, and absence is never dressed up.**
Spec and Pen test show `—` for Evidence; Pen test shows `—` for Observed and
"Nothing observed yet" for Provenance. Nothing is rendered as zero, blank, or
green.

**The status word is on screen, not encoded in a glyph.** Unlike the fleet, every
heading carries its status in words — "passing", "passing with caveats", "stale
evidence", "never run", "failing". A first-time reader needs no legend here.

**Rescan reports itself.** Measured: label "Rescan" → "Rescanning…", button
disabled during the request, both restored on completion, and the header
timestamp moved 18:21 → 18:24 UTC. The failure path has a dedicated always-mounted
`role="status"` region whose message preserves the prior reading ("The reading
below is the previous one") — and the comment at `RepoDetailPage.tsx:192`
explains why the region is mounted empty rather than inserted with its text,
which is the detail that makes it actually announce.

**Contrast is comfortable in both appearances.** Term labels 4.86 light / 6.88
dark, summaries 5.40 / 7.95, remedies and the page title 16.01 / 15.81.

---

## Priority issues

### [P1] The Code review block contradicts itself, and its instruction is wrong

Measured on screen, in this order, within one card:

- badge: **failing**
- summary: **"Could not evaluate this check: the artifact carries no frontmatter
  to read a verdict from"**
- remedy: **"The latest REVIEW.md records a failing verdict or an open blocker.
  Resolve it and commit the corrected code review."**

The summary and the remedy describe different worlds. There is no failing
verdict in that REVIEW.md — there is no frontmatter at all, which is precisely
what the summary says. A reader who follows the remedy goes looking for a
verdict that does not exist.

**Root cause, confirmed in source.** `remedyFor(id, status, host, source)` in
`packages/agent/src/lib/readiness/remedy.ts:149` never receives `check.error`.
`repo-readiness` requires every error-bearing result to carry status `fail`
(spec.md:203), so an evaluation error is indistinguishable from a merits-based
failure by the time the remedy is chosen, and it gets the `fail` branch. The
badge word comes from `STATUS_PRESENTATION[check.status].word` and is wrong for
the same reason; only the summary, which is built from `check.error.message`,
knows the truth.

**Why it matters.** This is the surface a reader arrives at *to find out what to
do*. Of six blocks, five tell them correctly and one tells them to fix a thing
that is not broken. It is also the same underlying gap as the fleet's P1, where
the two states render as an identical red ✕ — one missing branch, surfacing
twice.

**Fix.** Thread `error` into the remedy selection and into the presentation word.
The status stays `fail` on the wire, as the spec requires; this is a
presentation-layer distinction keyed on `check.error !== null`, which
`disclose()` in `ReadinessIndicator.tsx:214` already performs for the accessible
label and which nothing else consumes.

**Suggested command:** `$impeccable clarify`

### [P1] Text does not respond to the reader's font size

Measured on this page, root font size driven from 16px to 24px:

| | root 16px | root 24px |
|---|---|---|
| `h1` | 24px | **24px** |
| check summary | 12px | **12px** |
| fact term | 12px | **12px** |
| `--spacing-row-max` | 3.5rem | 3.5rem |

Nothing moved. The type scale in `tokens.css:141-148` is declared in pixels
(`--text-xs: 11px` … `--text-3xl: 32px`), so it is inert against the root size.

**Why it matters here specifically.** This is the most text-dense surface in the
product — six summaries, six remedies, eighteen facts, and a 332-line file behind
a disclosure at 11px. It is the page where a reader most needs to enlarge the
text, and the one where enlarging does the least.

**It also sits in direct tension with a decision this same change ratified.**
§3's row-height bullet argued that a px cap "is a requirement to clip text when a
reader enlarges it" and made `rem` "the substantive half" of the token. That
reasoning is correct and the cap is correctly `rem` — but the text it was
protecting never enlarges, so the protection has nothing to protect against
through this channel. Browser page zoom still scales everything, so this is a
gap rather than a total failure; the root-font-size channel, which is what users
who need larger text actually set, does nothing.

**Fix.** Redeclare the eight `--text-*` tokens in `rem` at the same rendered
sizes (`0.6875rem` … `2rem`). The generated CSS changes unit, not appearance, at
the default root size — the existing `typographyTokens.test.ts` enumeration
parse would need its unit assertion updated alongside, the same shape as the
`rowHeightToken.test.ts` unit case.

**This is a design-system change, not a repo-detail change,** and it is recorded
here rather than fixed. It affects all four surfaces and wants its own change,
its own RED, and its own measurement.

**Suggested command:** `$impeccable typeset`

### [P2] Six cards of the same size, and none of them is the one that matters

Section heights measured: 237, 219, 219, 219, 237, 219 — a 18px spread across
six blocks, in fixed check order, over 1697px of scroll in an 840px viewport.
The verdict at the top says "Not ready", but nothing below routes the eye to
*why*. The status badge colour is the only differentiator, and it is doing that
work alone at 25px tall against a 219px card.

**Why it matters.** The page's whole value is the remedy, and finding the remedy
that applies means reading six cards in an order chosen by the check registry
rather than by urgency.

**Fix.** Either order the blocks worst-first (the fleet already has an ordering
comparator in `readinessOrder.ts` that ranks evaluation errors above ordinary
failures), or give the blocking checks a visual weight the passing ones do not
have. Ordering is the cheaper of the two and reuses a decision already made.

**Suggested command:** `$impeccable layout`

### [P3] Evidence is a control in three blocks and plain text in a fourth

Workflow, Code review and Security review render Evidence as a
dotted-underline accent `<button aria-expanded="false">`. Coverage renders
`coverage/coverage-summary.json` as inert `<code>`. Spec and Pen test render
`—`.

The rule is correct and documented at `RepoDetailPage.tsx:346-350`: the read
route serves `.planning`, `.claude` and `openspec` only, so a control over
anything else would promise a file the daemon answers with 422. Naming the path
without offering to open it is the right call.

**What is missing is that the reader cannot see the rule.** Two paths sit four
inches apart, one clickable and one not, with nothing saying why.

**Fix.** A short trailing note on the inert case — "not readable from here" — or
a consistent affordance with a disabled state carrying the reason.

**Suggested command:** `$impeccable clarify`

### [P3] A successful rescan is silent for assistive technology

The `role="status"` region is scoped to failures by design, and the design is
right — it is always mounted so its content change is a change. On success it
stays empty, and the only success signals are the button's accessible name
returning to "Rescan" and a timestamp 157px away that nothing announces. A
screen-reader user whose focus has left the button gets nothing.

**Fix.** Emit one polite message on success naming the new reading time. The
region already exists and is already correctly mounted.

**Suggested command:** `$impeccable harden`

---

## Persona red flags

**Donald (primary — solo operator, power user of his own tool).** This page does
its job. He arrives from a fleet cell, lands on the right anchor, reads the
remedy, and acts. The one thing that costs him is the Code review block: he is
told to resolve a failing verdict in a file that has no verdict in it, and he
will open the file, find nothing, and have to work out that the check errored.
The information he needed was one line above, in the summary.

**Jordan (first-timer).** Better served here than anywhere else in the product.
Status is in words, provenance is in words, and every block ends with a sentence
telling him what to do. Two frictions: "Provenance: Derived" is a term he has to
infer, and he will click the Coverage evidence path expecting it to open,
because the three above it did.

**Alex (power user, not this product's user).** Wants to collapse the passing
checks and see only what blocks. Cannot — all six are always expanded, and
1697px of scroll for a repo with one real problem is four scroll gestures to
confirm nothing else is wrong. Would also want the six anchor chips to indicate
which sections are in view; they are jump links with no current-position
feedback.

---

## Minor observations

- The six header chips duplicate the six sections below them. That is defensible
  as a summary-plus-anchor bar, and the chips are real links to `#workflow`
  through `#coverage`, so the duplication buys navigation. Worth naming because
  it is the one place the page says the same thing twice.
- `--text-xs: 11px` is a declared token, not an arbitrary value, so the 11px
  `<pre>` is conformant with the type-scale requirement. Checked because §3
  removed four arbitrary sizes including `text-[11px]`, and a computed 11px looks
  like a survivor until you check the token.
- Tabular figures are on the Observed values and not on the shared `<dd>`, which
  is correct — Provenance and Evidence share that element and are prose.
- Console clean: no errors or warnings on load or across a rescan, in either
  appearance.
- `scrollWidth === clientWidth === 1440`; the page scrolls inside `<main>`
  (`overflow-y: auto`, 1697 vs 840) rather than at the document, so the shell
  stays fixed.

---

## Questions to consider

- If the blocks were ordered worst-first, would the six header chips still be
  worth their vertical space, or do they exist mainly to compensate for the fixed
  order?
- The remedy sentences are the best writing in the product and they are
  generated in the daemon, not the SPA. Is there a reason the fleet cannot show
  the worst check's remedy inline, rather than only in a hover disclosure?
- What would this page look like if a passing check collapsed to one line? Four
  of six are usually passing on a healthy repo, and the page is built as if all
  six always deserve equal room.
