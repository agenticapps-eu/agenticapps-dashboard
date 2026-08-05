# Backlog — work that is not a spec change

An OpenSpec change must carry a spec delta. Some real, tracked work has no
product-behaviour delta at all — it is process debt. That work is recorded here
so it is not lost between the phase tree and the change list.

Carried in from `docs/legacy-planning/STATE.md` §"Deferred Items" during the
OpenSpec migration (2026-07-26).

## Human verification backlog

**Status:** RETIRED

✅ Retired 2026-07-26 by explicit decision. All 10 `human_needed`
verifications and the residual UAT statuses are closed, not carried forward a
third time.

**The decision and its reasoning:** the phases below shipped in May 2026 and have
been in continuous production use since. Sustained real-world use is stronger
evidence than a retrospective sign-off performed months later by someone
reconstructing what the phase did. Re-running the ritual would have produced
paperwork, not information. The gate is therefore recorded as *superseded by
production use* for these specific phases — not waived, and not silently dropped.

This does **not** relax the gate going forward. New work still verifies before it
ships; this closes inherited debt from before the OpenSpec migration.

**Still to do:** update `docs/legacy-planning/STATE.md` §"Deferred Items" to
record the retirement, so a future audit does not re-open it. That file is
read-only history, so the note belongs alongside it rather than edited into it —
this entry is that record.

---

*Original entry, retained for provenance:*

Carried forward at both the v1.1 close (2026-06-08) and the v1.2 close
(2026-06-14) under proceed-and-acknowledge.

The v1.2 open-artifact audit found 22 items, all inherited from already-shipped
v1.0/v1.1 phases — none from v1.2 or Phase 8:

| Category | Detail | Status |
|---|---|---|
| verification | `VERIFICATION.md` for phases 00, 01, 02, 03, 04, 06, 05.1, 10, 11.1, 11.2 | `human_needed` (10 items) |
| uat | Phase 01 `HUMAN-UAT.md` | 2 genuinely-open scenarios |
| uat | Phases 03, 05, 07, 13, 05.1, 10, 11, 11.1 | partial/closed/resolved — 0 pending |

The implementations shipped and have been in production use since. What is
missing is the human confirmation, which is precisely the part that cannot be
delegated to an agent.

> This was briefly staged as an OpenSpec change during the migration and then
> withdrawn: it has no spec delta, and `openspec validate` correctly refuses a
> change without one. Process debt belongs here, not in `openspec/changes/`.

## [RESOLVED] Known stale artifact (✅ 2026-07-26)

`.claude/claude-md/workflow.md`, the GSD-era vendored workflow document, has been
**removed**. `CLAUDE.md` points at `docs/WORKFLOW.md` (workflow v3.0.0).

Removing it required a matching hook change. `normalize-claude-md.sh` treated the
file's *presence* as the signal to collapse CLAUDE.md's Workflow section, and its
*absence* as a reason to inject a `"Workflow defaults. Migration 0009 not yet
applied."` stub. Deleting the file alone would therefore have written a false and
stale notice into `CLAUDE.md` on the next PostToolUse fire. The hook now always
collapses, since `docs/WORKFLOW.md` is canonical. Verified: a hook run leaves
`CLAUDE.md` byte-identical.

**Side benefit.** That vendored copy carried its own 13-flag red-flag list under a
reworded heading, with four flags reworded from the canonical wording — the §04
divergence documented in `.claude/skills/agentic-apps-workflow/SKILL.md`. Since
that copy was "what agents read at runtime", removing it means agents in this repo
now read only the canonical list.

`SKILL.md` still describes that divergence in its §04 discussion. Left as-is
deliberately: it is a vendored file synced from the scaffolder, so editing it here
would create drift and be reverted on the next `/update-agenticapps-workflow`. The
statement remains true of freshly scaffolded projects generally — just no longer
of this one.

## [RESOLVED] Impeccable floor: three numbers on disk, and a CI gate that does not exist (✅ 2026-08-05)

Found 2026-07-26 while merging the Dashboard v2 plan into this slot. No spec
delta — the composite floor is process, not product (see *Deliberate exclusions*
in `CAPABILITY-MAP.md` and the preamble of `openspec/specs/design-system/spec.md`).
It belongs here.

**Three different floors are recorded in this repo:**

| Source | Value |
|---|---|
| `CLAUDE.md:144` — ratified 2026-06-08 | **≥ 80** ← current truth |
| `CAPABILITY-MAP.md` traceability note | records 87 → 80 via D-10.5-03 |
| `README.md:57`, `README.md:107` | ≥ 87, plus "v1.1 commits to lifting the floor to ≥ 90" |
| `docs/spec/dashboard-prompt.md:554,594,696` | ≥ 87, "calibration pending" |

`README.md` is stale: it states a floor superseded in June 2026.
`dashboard-prompt.md` is historical reference material and correctly frozen —
it is not a defect there.

**The CI gate does not exist.** `README.md:57` and `README.md:107`, and
`docs/review-protocol.md:63`, all reference `.github/workflows/impeccable.yml`.
The workflows directory contains only `ci.yml` and `release.yml`. This is not an
accidental deletion: `dashboard-prompt.md:554` records that "Phase 6's CI gate
retired in favor of the per-phase artifact". The links were never updated when it
was retired.

**Consequence for the v2 plan.** Linear AGE-476 reads "the CI gate threshold
rises from ≥ 87 to ≥ 90". Both halves are wrong against the repo: the baseline is
80, and there is no CI gate to raise. The intent — hold a higher bar for the
rebuilt surfaces — is sound and unaffected.

**To do, with AGE-476:**

- Correct `README.md` to the ratified floor, and either remove the dead workflow
  links or restore an actual CI gate.
- Correct `docs/review-protocol.md:63` the same way.
- Decide explicitly whether the raised floor is enforced in CI or stays a
  per-change artifact gate. It is currently the latter, and the docs claim the
  former.

**Resolved 2026-08-05 under AGE-476 §3 — ADR-0003.**

- **The floor stays ≥ 80.** AGE-476's "raise ≥ 87 → ≥ 90" clause is void: both
  premises were false, and raising a ratified floor is its own ratification
  rather than a side effect of a ticket that misread the baseline. A second,
  higher floor for rebuilt surfaces was considered and deferred — it needs its
  own ratification and its own definition of "rebuilt".
- **Enforcement stays the per-change artifact gate**, now stated as such.
  Restoring a CI gate was rejected as not mechanizable today: the composite is
  an LLM-driven heuristic score from a skill driving a real browser at 1440×900,
  not a deterministic CLI.
- `README.md` FAQ 9 and the CI section rewritten; `docs/review-protocol.md:63`
  rewritten; both dead `impeccable.yml` links removed. `CLAUDE.md` keeps 80 and
  now records why the raise was declined.
- `docs/spec/dashboard-prompt.md` deliberately left at ≥ 87 — frozen historical
  reference, correct as a record of what was true then.
- A **fifth** floor the entry above did not list: `docs/spec/DASHBOARD-V2-SPEC.md`
  §550 and §591 said the threshold "bleibt CI-Gate" and rises to ≥ 90. That is
  the document AGE-476 was derived from, so leaving it would let the same wrong
  ticket be re-derived. Both passages corrected in place using the document's own
  ⚠ convention rather than rewritten.
- **Not fixed, and worth doing:** nothing detects a doc linking a workflow file
  that does not exist, which is why this survived June→August. A guard test over
  `.github/workflows/*.yml` references in docs would have caught it — and running
  that check by hand while closing this entry immediately turned up a second live
  instance: `docs/WORKFLOW.md:128` links `.github/workflows/openspec-gate.yml`,
  which does not exist either. Left unedited on purpose — `docs/WORKFLOW.md` is
  vendored from claude-workflow and a local fix would be reverted by the next
  `/update-agenticapps-workflow`. It belongs upstream, or in the guard test's
  allow-list.

---

## Workflow surface: rows exceed the declared density budget

**Status:** OPEN. Found 2026-08-05 while closing `retire-v1-surfaces` §3's
row-height bullet. Filed here rather than as a change because it needs **no
spec delta** — the requirement already says what should happen and already
binds this surface. What is missing is conformance, not specification.

`design-system` → **Dense Rows And Aligned Figures** caps a row on a list or
table surface at `3.5rem` and requires uniform height, both scoped to the
1440×900 reference viewport. Measured on `/workflow` at that viewport against
the token-resolved cap of 56px:

| Table | Row heights (px) | Max | Within cap | Uniform |
|---|---|---|---|---|
| Spec conformance | 100, 75.5, 51, 99.5 | 100 | no | no |
| Shared artefacts | 71.5, 71.5, 51, 51, 51, 50.5 | 71.5 | no | no |

The fleet, measured in the same pass, is conformant: three rows at exactly 56px,
uniform, cap resolved from `--spacing-row-max`.

**Cause.** Cells carry list-valued content stacked vertically — "2 unknown ·
setup-agenticapps-workflow · implements spec missing", seven laggard skills in
one cell — so row height tracks the longest list rather than the row.

**Why the exemption does not apply.** The requirement exempts surfaces whose
unit of information is a *card*, and only when the claim and its trade-off are
recorded in that surface's own change; it says in as many words that a surface
which has not recorded the claim is bound. This is a real `<table>` of `<tr>`
rows and no such claim exists, so it is bound.

**Worth noting against the requirement's own text.** The delta justifies the
number with "`3.5rem` is the height the fleet table already ships, so the
constraint records the density that exists rather than imposing a restyling this
change does not otherwise call for." Measurement falsifies that as a general
claim: it holds for the fleet and not for the workflow surface, which the same
change retains. The number is still right — the rationale was written from one
surface and generalised without measuring the other.

**Not fixed here, deliberately.** The fix is a design decision, not a tidy-up:
collapsing a multi-item cell means choosing between a count plus a drawer, a
truncation with disclosure, or a secondary detail row. That wants its own
change, its own `impeccable:critique` artifact, and a re-measurement — which is
more than the bullet that found it was scoped to do. Re-scoping the requirement
to fit the code was considered and rejected: the recorded-claim clause exists
precisely so density does not decay into a preference.

---

## Type scale is declared in pixels, so text ignores the reader's font size

**Status:** OPEN. Found 2026-08-05 while producing `retire-v1-surfaces` §3's
design-critique artifact for the repository detail surface. Filed here rather
than as a change because the fix is a design-system decision that touches all
four surfaces and wants its own RED, its own measurement, and its own critique
— which is more than the bullet that found it was scoped to do.

`tokens.css:141-148` declares the eight-step scale in `px`:

```
--text-xs: 11px;  --text-sm: 12px;  --text-base: 13px;  --text-md: 14px;
--text-lg: 16px;  --text-xl: 20px;  --text-2xl: 24px;   --text-3xl: 32px;
```

Measured on `/repos/agenticapps-dashboard` at 1440×900, driving the root font
size from 16px to 24px:

| | root 16px | root 24px | moved |
|---|---|---|---|
| `h1` | 24px | 24px | no |
| check summary | 12px | 12px | no |
| fact term | 12px | 12px | no |
| `--spacing-row-max` | 3.5rem → 56px | 3.5rem → 84px | yes |

The row-height cap tracks the root correctly. Nothing it contains does.

**Why this is worth recording rather than shrugging at.** It sits in direct
tension with a decision this same change ratified. §3's row-height bullet argued
that a px cap "is a requirement to clip text when a reader enlarges it", made
`rem` "the substantive half" of the token, and proved the cap tracks 3.5× the
root exactly at 16 / 20 / 24px. That reasoning is right and the cap is right.
But the text the cap was protecting never enlarges through this channel, so the
proof demonstrated a mechanism whose input is currently always constant.

**Scope of the gap.** Browser page zoom scales everything, including px, so this
is not a total failure — a reader who zooms is served. A reader who instead
raises their browser's default font size, which is the setting people who need
larger text actually use, gets no change at all on any surface.

**Shape of the fix, not a decision to adopt it.** Redeclaring the eight tokens
in `rem` at the same rendered sizes (`0.6875rem` … `2rem`) changes unit, not
appearance, at the default root size. `typographyTokens.test.ts` parses the
enumeration out of `tokens.css` rather than restating it, so it would follow the
values automatically; its unit assertion would need the same treatment
`rowHeightToken.test.ts` gives the row cap. Whether the *scale itself* should
also change — 11px base type is small — is a separate question and deliberately
not bundled here.

**Not fixed in `retire-v1-surfaces`, deliberately.** The change's §3 is scoped to
implementing and verifying named product-quality invariants; "the type scale
responds to the reader" is not among them, and adding it mid-change would repeat
the mistake of ratifying a design-system decision as a side effect of a ticket
scoped to something else.

---

## An evaluation error is presented as an ordinary failure

**Status:** OPEN. Found 2026-08-05 by the `retire-v1-surfaces` §3 design-critique
artifacts for the fleet and repository detail surfaces. Filed here rather than
fixed in `retire-v1-surfaces` because no §3 bullet names this invariant, and
widening §3 to cover defects it happens to find is the mistake the density
decision deliberately avoided. Recorded with its root cause so the change that
picks it up does not have to re-derive it.

**The defect, as it appears on screen.** On `/repos/agenticapps-dashboard`, the
Code review block currently renders three lines that describe two different
worlds:

| Element | Text |
|---|---|
| badge | failing |
| summary | Could not evaluate this check: the artifact carries no frontmatter to read a verdict from |
| remedy | The latest REVIEW.md records a failing verdict or an open blocker. Resolve it and commit the corrected code review. |

There is no failing verdict in that file. There is no frontmatter at all, which
is exactly what the summary says. A reader who follows the remedy goes looking
for something that does not exist.

On `/fleet` the same state is worse in a different way: the Code review cell
("could not be evaluated") and the Coverage cell ("failing") are identical in
glyph and colour, in light (`rgb(181, 61, 61)`) and dark (`rgb(234, 129, 129)`)
alike. The distinction survives only in the `aria-label`.

**Root cause.** `repo-readiness` requires every error-bearing result to carry
status `fail` and to distinguish itself by a structured error marker rather than
by prose (`spec.md:203`). That contract is honoured on the wire. The
presentation layer then discards it in two places:

- `remedyFor(id, status, host, source)` — `packages/agent/src/lib/readiness/remedy.ts:149`
  — never receives `check.error`, so an evaluation error takes the `fail` branch.
- `STATUS_PRESENTATION[check.status]` — `packages/spa/src/components/panels/readiness/ReadinessIndicator.tsx:71`
  — is keyed on status alone, so the word and the glyph are the `fail` ones.

`disclose()` at `ReadinessIndicator.tsx:214` already branches on
`check.error !== null` for the accessible label, and its comment at line 201
concedes the rest: *"without this the two render identically and read
identically, while ordering differently."* The branch exists; nothing else
consumes it.

**Why it is worth more than a polish note.** The two states demand opposite
responses — fix the code, versus fix the artifact's frontmatter. On the fleet a
reader cannot tell which repository needs an afternoon from which needs a
one-line metadata edit without hovering every red cell. On the detail page they
are actively instructed to do the wrong thing.

**Shape of the fix, not a decision to adopt it.** A presentation-layer branch on
`check.error !== null` in both places: a distinct glyph in `STATUS_PRESENTATION`
(the vocabulary has six members and `X` is taken by `fail`), a word other than
"failing", and an error-aware remedy. The status stays `fail` on the wire, so no
spec delta is implied — this is conformance to what the spec already separates.
