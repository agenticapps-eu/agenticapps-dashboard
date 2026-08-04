# Withdraw what v2 stops promising

## Why

Twelve capabilities and one hundred requirements were ratified on 2026-07-26.
Dashboard v2 replaces most of what they describe. Deleting the code is not the
same act as withdrawing the promise, and only one of those two is visible in the
spec slot.

Without this change the slot ends up carrying two contradictory truths: one set
of requirements saying the product renders a coverage matrix, a conformance score
and a skill-drift page, and another saying it renders six checks per repo.
**`openspec validate` will not catch that** — it checks structure, not
consistency. A reader six months later has no way to tell which set is current.

So each withdrawal is written down with a reason. *"The code is gone"* is not a
reason. *"The product answers a different question now"* is.

Linear: AGE-483. Adjacent execution issues: AGE-473, AGE-474, AGE-475, AGE-476.

## What changes

**Withdrawn — 5 capabilities.** `code-intelligence`, `fleet-coverage`,
`fleet-conformance`, `skills-and-linting`, `optional-integrations`. Counted on
`main` on 2026-07-26 and re-counted at the time of writing: 7 + 10 + 9 + 5 + 11 =
**42 requirements**. Two of `code-intelligence`'s seven are withdrawn upstream by
`remove-gitnexus-integration`, so this change lists the remaining five of that
capability and all of the other four. Stated per delta so the aggregate cannot
be mistaken for the `code-intelligence` count: **5 code-intelligence + 10
fleet-coverage + 9 fleet-conformance + 5 skills-and-linting + 11
optional-integrations = 40 here; 40 + 2 upstream = 42 across the two changes**.
The upstream change says the knowledge-graph viewer is unaffected *by that
earlier GitNexus-only removal*. That is not a survival promise across this later
cutover: this change deliberately withdraws the viewer and the other four
remaining `code-intelligence` requirements, leaving the capability empty.

**Modified — 3 capabilities.** `project-dashboard` loses its projections to the
readiness surfaces and trims its reader to the fields v2 still consumes.
`design-system` gains compact density with tabular figures, bounded typography,
visible underlying values, and non-colour-dependence invariants. It also replaces
the underspecified shell grouping with exactly two groups — product content and
utilities such as help and settings — while preserving the shared authenticated
shell, navigation primitive, indentation, and peer order. Registered projects
belong on the fleet surface rather than in the sidebar. `help-docs` contracts to
match the smaller surface.

For `project-dashboard`, the delta categories are disjoint. Exactly eight
requirements are removed: `Multi-Project Home Renders A Card Per Project`,
`Card Data Comes From One Call Per Project`, `Filtering, Search, And Sort`,
`Single-Project Header Context`, `Discipline State Column`, `Change Progress
Column`, `Capability Panel`, and `Panels Degrade To Empty States`. `Register A
Project From The Home Page`, `Keyboard Shortcuts`, and `Hybrid OpenSpec Read
Strategy` are modified, not removed. `Schema Validation At Both Ends` is
unchanged and therefore does not appear in the delta body.

The registration and shortcut modifications are terminology-and-pruning changes,
not feature expansions. Registration keeps the baseline path, suggested name,
add/remove, and no-reload behaviour while replacing grid wording with the fleet
list. Keyboard shortcuts keep refresh, search focus, and help; the modification
only forbids references to withdrawn surfaces and leaves the unchanged
`help-docs` shortcut reference authoritative.

The hybrid reader continues to supply open-change names, task counts and
task-artifact presence to the `spec` readiness check, and capability names and
requirement counts to repo detail. Per-change affected-capability derivation and
archived-change ordering are deliberately dropped because no v2 surface renders
either value. The zero-padded archive-name rule was a display-order contract,
not a filesystem migration or archive-deletion rule.

The fleet population also changes deliberately. `fleet-coverage` discovered
every git repository one level below configured family roots, whether registered
or not. v2 readiness is registry-scoped: only registered repos appear. Automatic
family-root discovery as a product surface is withdrawn with the coverage
scanner; an unregistered repo is added through the surviving home registration
affordance. The retained family-roots helper serves the separate workflow scanner
and does not repopulate the fleet.

### The full count is 50, not 42

The 42 figure counts only requirements lost to a *capability* withdrawal. It
omits `project-dashboard`, which survives as a capability while losing eight
requirements — the card grid, its fetch contract, its filters, the single-project
header, the discipline column, the change-progress column, the capability panel,
and the panel degradation contract.

Withdrawn in total: **50 requirements** — 42 by capability withdrawal (40 here,
2 upstream) and 8 more from `project-dashboard`. The no-integration guarantee is
restated as a new standing requirement in surviving `project-dashboard`; it does
not keep `optional-integrations` alive.

**Capability count, stated precisely.** This change alone takes the slot from
**12 to 7** — the figure a reader gets by checking it against the twelve
capabilities ratified on 2026-07-26, and the reason the earlier phrasing
"12 → 10" invited a number that does not follow from this change read in
isolation.

**Measured 2026-08-04: the slot holds 15, and this change takes it to 10.** All
three capabilities this paragraph once treated as pending have landed —
`add-repo-readiness` and `add-workflow-fleet-conformance` supplied two, and
`add-agent-change-board`, archived on 2026-08-04, supplied the agent-change
capability recorded here as unproposed after `add-agent-board` was withdrawn on
2026-07-28. 15 − 5 withdrawn = **10**, which is the figure this paragraph
predicted before any of them existed.

The distinction is worth keeping visible: a capability that ends and a capability
that is cut back are different statements about the product, and only the second
leaves something behind that must still be true.

**Untouched — 3 capabilities.** `daemon-runtime`, `auth-and-pairing`,
`project-registry`. v2 changes *what* is shown, not *how* the data is fetched.

**No longer untouched — `filesystem-access-policy`, for two separate reasons.**
The original plan listed four untouched capabilities. That was wrong, and the
correction is recorded rather than quietly applied.

The first amendment is a sibling's: `add-workflow-fleet-conformance` replaces the
process-spawn authorization with an exhaustive four-site list (editor, bounded
git, OpenSpec reader, workflow harness), thereby closing the retired
coverage/linter runner exceptions, and adds a machine-wide allowed root. That
spine change is made there, where the justification lives, not duplicated here;
that sibling delta applies before this teardown is verified.

**The second is this change's own, added 2026-08-04.** This change now carries a
`filesystem-access-policy` delta adding `Retained Credential Files Have A Bounded
Lifetime`. The rule existed already — a bounded, owned, dated retention window
for the withdrawn integrations' credential files — but it was written inside the
`optional-integrations` requirement this change *removes*, in a delta file whose
only heading is `## REMOVED Requirements`. A normative rule written into text
being deleted does not survive the fold. Two reviewers found that independently
in round 2. It lands in the security spine because that capability already fixes
these files' mode at `0600` and says nothing about their lifetime, and the two
halves belong together.

## Ordering: this change lands last

A withdrawal is only true once the replacement stands. Retire the coverage matrix
before the readiness surface ships and the spec slot states, for that interval,
that the product can do neither. So this change is written **now**, alongside the
v2 changes, and applied **at the cutover**.

Writing it now is the point. A change that adds the fleet surface without saying
in the same breath which requirements it supersedes is how two truths get into
one slot.

The baseline files under `openspec/specs/` intentionally continue to describe
the pre-cutover product while this change is open. They are review inputs, not
precomputed post-change output. Task 4 folds the delta into those baselines only
after the replacement surfaces stand; seeing the withdrawn requirements in a
baseline before that fold is therefore expected, not a count discrepancy.

## Review disposition (2026-08-02) — round 1

`REVIEWS.md` for this round is preserved as `REVIEWS-round-1.md`. It carried
claude APPROVE, opencode APPROVE, and **gemini + codex REQUEST-CHANGES**. The
findings below were verified against `main` before being acted on; two did not
survive that check, and transcribing them would have made the change worse.

**Correction (2026-08-04): the sentence above used to read "Every finding was
verified", and the table below covers gemini and codex only.** claude's four
findings and opencode's were never dispositioned. Round 2 confirmed three of
claude's were still unaddressed on disk a week later — the negative `MAY`, the
untestable `MUST NOT` in `A Bounded Type Scale`, and the self-contradictory
manifest bullet. A disposition table that silently omits two of four reviewers
reads as completeness and is not; all three are fixed in round 2 below.

| Finding | Disposition |
|---|---|
| codex — atomicity premise false | **Fixed.** True, but its consequence was not: `remove-gitnexus-integration` shipped independently *by design* and discharged the recomputation obligation at the source by re-scoring old snapshots. No gate is outstanding. design §9, tasks preamble. |
| codex — migration to a "declared check" is impossible | **Fixed.** Confirmed against `CHECK_IDS`: six identifiers, unknown ids silently discarded. Both migrations rewritten to stop offering a path that does not exist. |
| codex — removed daemon APIs defined circularly | **Fixed, and it was larger than reported.** ~60 endpoints across 11 route modules, none enumerated. The withdrawal is now normative over the retired modules, with an explicit rule that an endpoint missing from the list is an error in the list. |
| codex — credential files retained indefinitely | **Fixed.** Thirty-day window, owner is whoever ships the cutover, deletion is a dated task. `0600` governs access, not lifetime. |
| codex — hybrid reader cannot distinguish empty from absent | **Refuted.** The spec already says presence is read from the tree *because* the CLI collapses both to `0/0`, and the reader opens the artifact — empty reads present, missing reads absent. The real gap is narrower: the reader looks at one path, so an artifact under a non-default schema reads absent. Claim narrowed; behaviour unchanged. |
| codex — `No Reimplementation` silently relaxed | **Reframed.** Not silent: the withdrawal says outright that it is not restated. The genuine issue is the asymmetry with its preserved sibling, which design §7 justifies on reasoning that applies to both. The asymmetry is now argued on consequence rather than left to look like an oversight. |
| gemini — deep links lose repo context | **Fixed.** A retired location carrying an identifier resolves to `/repos/:id`. |
| gemini — path-drift repair UI regression | **Fixed as an explicit non-goal.** Accepted, unscheduled, and recorded for whoever proposes the registry surface. |
| gemini — degraded reads render silently | **Fixed.** Divergence is marked as compatibility mode and names the malformed spec. |
| gemini — fifteen-row density is brittle | **Fixed.** Density is a measured row height; the row count is retained as intent, not as the pass condition. |

## Review disposition (2026-08-04) — round 2

Round 2 ran against the artifacts as revised on 2026-08-02, after four dead
premises were corrected (see the capability count above and `tasks.md`). Three
counted reviewers, **all REQUEST-CHANGES**: gemini, codex, opencode. claude was
excluded as the declared implementing host. Every finding was checked against the
code before being acted on, and this time the table covers all three reviewers
plus one defect none of them raised.

| Finding | Disposition |
|---|---|
| codex + opencode — `fleet-conformance` still carries the live atomicity/recomputation conditional | **Fixed.** It was the only corrected passage in the change with no supersession marker, and it read as a live release gate contradicting design §9 and the tasks preamble. Now marked and retired in place. |
| codex — removed daemon APIs still not enumerated; "roughly sixty" against an actual 19 | **Fixed.** All nineteen are now enumerated as a method/path table in the delta. Sixty entered through a round-1 finding and was never counted; codex's 19 matches the count taken here independently. |
| codex + opencode — the 30-day credential window is written inside a REMOVED requirement and would not survive the fold | **Fixed, and it was the most serious finding of the round.** `optional-integrations/spec.md` has exactly one heading, `## REMOVED Requirements`, so the rule was normative text scheduled for deletion. Relocated to `filesystem-access-policy` beside the `0600` mode discipline it complements, and `tasks.md` §2 now carries the dated deletion instead of "separate cleanup". |
| opencode — the round-1 table omits claude's and opencode's findings while claiming every finding was verified | **Accepted.** The overclaim is corrected above, and the three unaddressed claude findings are fixed below. |
| claude (round 1, unaddressed) — `No integration MAY be a hard dependency` | **Fixed.** A negative `MAY` has no RFC 2119 meaning; now `MUST NOT`. |
| claude (round 1, unaddressed) — `A Bounded Type Scale` has no scenario for its `MUST NOT` | **Fixed.** Added the rejection scenario; the binding half was untestable. |
| claude (round 1, unaddressed) — manifest bullet says "unknown locations **and APIs listed there**" | **Fixed.** A listed API is not unknown. Note this contradiction was carried forward verbatim in this session's own first edit of that bullet. |
| opencode — installed viewer assets have neither a removal task nor a retention decision | **Fixed.** `grep -i viewer tasks.md` returned nothing; §2 now removes the install command and its versioned asset directory. |
| codex — "any other retired per-project path" is a wildcard conflicting with the not-found rule, and cites a path that does not exist | **Fixed.** The router serves `/projects/:id` and no per-project sub-paths. The rule is now enumerated, with a scenario asserting an invented sub-path returns not-found. |
| codex — `Dense Rows` declares a maximum with no number, and task 3 still verifies fifteen rows | **Fixed.** The maximum is `3.5rem`, the height the fleet table already ships, declared as a token. Task 3 now measures a row instead of counting rows — it had been asserting the exact pass condition the requirement forbids. |
| codex — the unconditional zoom/OS-scaling clause conflicts with accessible text reflow | **Fixed, and it changed the unit.** A cap in CSS pixels that must hold at a non-default font scale is an instruction to clip enlarged text. Expressed in `rem`, rows grow with the reader's text and the density stays a property of the design. |
| gemini — snapshot files have no bounded retention or owner, unlike credentials | **Fixed.** Same window, same owner, same dated task. Rollback evidence expires for the reason credentials do. |
| gemini — the "card surface" exemption is subjective and could excuse future regressions | **Fixed, narrowly.** The exemption is well-reasoned but was self-asserting. A surface must now record the claim in its own change, as the lifecycle board did; an unrecorded claim does not hold. |
| gemini — preserving `Optional Integrations Never Become Load-Bearing` while dropping `No Reimplementation` is not watertight | **Fixed by taking the delta's own escape hatch.** That entry conceded design §7's reasoning "applies word for word" to both and closed with "If that trade is wrong, the fix is to preserve this one too". Two vendors across two rounds judged it wrong. Both are now standing rules in `project-dashboard`, which rises to seven requirements. |
| opencode — `four host workflows` and `five workflow repos` in one document | **Fixed.** Stated as four hosts compared against core, five repositories in total. |
| opencode — `/projects/:id` unspecified when the id is no longer registered | **Fixed.** It still redirects; repo detail renders the 404 state it already implements. Resolving the registry inside a URL rewrite would give one stale bookmark two failure surfaces depending on timing. |
| codex — the hybrid reader has no fallback when the CLI is present but errors | **Narrowed.** The behaviour already exists: `openspecCli.ts:231` returns `{ ok: false, reason: 'exit' }` on a non-zero exit and parse failure is caught at 269. The delta's text was wrong, not the daemon — it made absence the only fallback trigger. Claim corrected to match the code. |
| codex — "every direct child" of `openspec/changes/` counts loose files as changes | **Narrowed.** `openspecReader.ts:62` already filters `e.isDirectory()`. Again the spec under-described working code; the word "directory" is now in the text. |
| codex — the delta calls OpenSpec-permitted alternate task locations "malformed" | **Fixed.** Attributing every divergence to a malformed spec sends a reader to correct a file that conforms. The surface now names the change the readers disagreed about. |
| gemini — the path-drift repair UI regression should get a concrete plan or tracking issue | **Held.** This repeats a round-1 finding already dispositioned as a deliberate, recorded non-goal. A repair affordance belongs on a v2 surface that shows drift, and none does; adding one would mean designing that surface inside a withdrawal change. |
| **Found here, raised by no reviewer** — the register affordance loses its only host | **Fixed.** `RegisterModal` and `RegisterButtonCard` are imported only by the withdrawn `MultiProjectHome`, and the fleet's empty state points at the CLI. Deleting "every component whose only consumer is a withdrawn location" would have deleted the UI a retained requirement depends on, and silently converted a preserved promise into a CLI-only operation — while the fleet-population argument leans on that same "surviving home registration affordance". |

Two findings were narrowed rather than fixed because the reviewers were reading
artifacts and the code already did the right thing. That is the expected failure
mode of a review that runs before implementation, not a reason to skip it: the
same round found a security guarantee scheduled for deletion.

## What this change explicitly does not do

- **It does not tidy `openspec/CAPABILITY-MAP.md`.** That document is ratified
  and dated. Its capability table keeps saying twelve, because on the day it was
  ratified there were twelve. The change is appended as a supersession note, not
  edited in. Supersede, never delete.
- **It does not withdraw the Impeccable composite floor into a requirement.**
  Raising the floor is real work (AGE-476), but the ratified capability map and
  `design-system` itself both state that the critique ritual and its score are
  *process, not product*. Honouring that exclusion, the enforceable floor belongs
  in `CLAUDE.md`; `README.md` and `docs/review-protocol.md` are documentation
  correction targets because they cite a stale floor and a nonexistent gate.
  Only the outcomes the ritual protects — compact density, tabular figures,
  bounded typography, visible underlying values, and non-colour-dependence —
  become requirements here.
- **It does not delete history.** Nothing under `docs/legacy-planning/` or
  `openspec/changes/archive/` is touched.
- **It does not withdraw the security or infrastructure spine.**
- **It does not itself delete code.** The deletions are AGE-473 (cutover) and
  AGE-474 (daemon teardown). This change is the statement about the product that
  those deletions implement.
- **It does not replace the path-drift repair UI, and that is a regression it
  accepts rather than one it overlooks.** The conformance page carried a panel
  for repairing a drifted repository path; the panel goes with the page. Drift
  *detection*, suggested-path discovery, and the strict atomic repair endpoint
  all survive in `project-registry`, so the capability remains — but an operator
  who previously fixed a drifted path by clicking must now call the endpoint.
  **This is deliberate and it is not scheduled.** A repair affordance belongs on
  a v2 surface that shows drift, and no v2 surface shows drift yet; adding one
  here would mean designing that surface inside a withdrawal change. Recorded as
  a known gap for whoever proposes the registry surface, not as future work this
  change commits to.

## A note on `coverage` and `conformance` as words

Both survive as questions and die as answers, under different names.

`fleet-coverage` measured *tooling* coverage across repos. In v2 `coverage` means
*test* coverage of one repo. Same word, different concept — which is why the
readiness capability is not called `fleet-coverage`.

`fleet-conformance` scored repos against tracked columns. In v2 conformance means
whether host workflow implementations match the core spec. Which is why the new
capability is `workflow-fleet-conformance` and not `fleet-conformance`.

Recycling either name would put two concepts under one word in one slot. That is
the most reliable way to misread a spec later.

## Resolved: the no-integration guarantee survives conditionally

`The Dashboard Works Without Any Integration` is withdrawn from the capability
that ends and restated as `Optional Integrations Never Become Load-Bearing` in
surviving `project-dashboard`. v2 has no integrations, so it binds nothing today,
but any future integration inherits the rule that every unrelated surface works
fully without it configured. Relocation preserves the promise without falsely
claiming `optional-integrations` is both gone and alive.
