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
**12 to 7**. It reaches 9 in combination with the two capabilities added by
`add-repo-readiness` and `add-workflow-fleet-conformance`, and 10 once an
agent-change capability is proposed and added — `add-agent-board`, which was to
supply it, was withdrawn on 2026-07-28. The earlier phrasing "12 → 10" invited a
reader checking this change in isolation to find a number that does not follow
from it.

The distinction is worth keeping visible: a capability that ends and a capability
that is cut back are different statements about the product, and only the second
leaves something behind that must still be true.

**Untouched — 3 capabilities.** `daemon-runtime`, `auth-and-pairing`,
`project-registry`. v2 changes *what* is shown, not *how* the data is fetched.

**No longer untouched — `filesystem-access-policy`.** The original plan listed
four untouched capabilities. That was wrong, and the correction is recorded
rather than quietly applied: the sibling `add-workflow-fleet-conformance` delta
replaces the process-spawn authorization with an exhaustive four-site list
(editor, bounded git, OpenSpec reader, workflow harness), thereby closing the
retired coverage/linter runner exceptions, and adds a machine-wide allowed root.
The security spine is amended there, where the justification lives, not
duplicated here; that sibling delta applies before this teardown is verified.

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

## Review disposition (2026-08-02)

`REVIEWS.md` (2026-07-28) carried claude APPROVE, opencode APPROVE, and
**gemini + codex REQUEST-CHANGES**. Every finding was verified against `main`
before being acted on; two did not survive that check, and transcribing them
would have made the change worse.

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
