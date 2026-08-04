# Design notes — withdrawing the v1 surfaces

## 1. Why a withdrawal change exists at all

**Rejected: delete the code and let the spec catch up later.**

This is what happens by default, and it is why the slot exists. Deleting a route
is a fact about the repository; withdrawing a requirement is a statement about the
product. Only the second one is legible to someone reading `openspec/specs/` in
six months.

The failure is concrete and silent: `openspec validate` checks structure, not
consistency. A slot containing both "the coverage matrix renders a card per repo
at the smallest breakpoint" and "the fleet surface is one row per repo" validates
green. Nothing in the tooling will ever object. The only defence is writing the
withdrawal down.

**Rejected: fold the withdrawals into the teardown change (AGE-474).**

Tempting, because that is where the deletions happen. But `fleet-coverage` has
ten requirements that somebody wrote, reviewed, and ratified. Losing their
withdrawal among thirty file deletions turns a product decision into a diff
line — which is exactly the history-of-handgriffs the spec slot was built to
replace.

## 2. Why it is written now and applied last

These are two separate decisions and they pull in opposite directions.

**Applied last**, because a withdrawal is only true once its replacement stands.
Apply it early and the slot says, for the length of the interval, that the
product does neither the old thing nor the new one. That is a worse lie than the
one it fixes.

**Written now**, because the alternative is a change that adds the fleet surface
while saying nothing about the ten requirements it supersedes. By the time
somebody writes the withdrawal afterwards, the reasoning has to be reconstructed
rather than recorded, and reconstruction is where "the code is gone" gets written
down as a reason.

## 3. Why capabilities end rather than being thinned

**Rejected: keep `code-intelligence` and `optional-integrations` as reduced
capabilities.**

Considered because it preserves continuity and avoids the appearance of throwing
work away. Rejected because after the withdrawals there is genuinely nothing
left. A capability with no requirements is not a smaller promise, it is a heading
— and a heading in `specs/` reads as something the product still does.

`project-dashboard` is the counter-case and is treated differently on purpose: it
loses eight requirements and keeps four. The hybrid read strategy survives but
is narrowed to the values v2 consumes: open changes, task counts and presence,
plus capability names and requirement counts. Per-change affected-capability
derivation and archive ordering belonged to the withdrawn progress projection,
so retaining them would preserve dead reader work rather than a product promise.
Ending the capability would still throw away the hybrid strategy that the
`spec` check depends on.

The distinction is stated in the proposal because it is the substantive part of
this change: five capabilities end, one is cut back, and those are different
claims.

Two surviving capabilities are modified rather than ended or cut back.
`design-system` gains four product invariants and substantively replaces its
shell requirement; `help-docs` narrows its content contract while preserving its
widget and topic-resolution mechanisms. These are not capability withdrawals.

## 4. Why the names are not recycled

**Rejected: call the new test-coverage capability `fleet-coverage`, and the new
version comparison `fleet-conformance`.**

Both names are free after this change, both are the obvious word for the new
thing, and both would be wrong.

The old `fleet-coverage` measured which repos had which tools wired up. The new
`coverage` measures how much of one repo's code its tests execute. The old
`fleet-conformance` was a weighted score over tracked columns with tiers and a
trend. The new one is a version comparison with byte-identity checks and no score
at all.

In each pair the *question* has a family resemblance and the *answer* has none.
Reusing the name puts two concepts under one word inside one slot, where the
archive still contains the old meaning — and the reader six months out has no
signal telling them which one they are looking at. The cost of the longer name
(`workflow-fleet-conformance`) is worth paying once.

## 5. Why the shell requirement changes

The baseline required a shared authenticated shell and sidebar sections but did
not say how many groups existed or where help and settings belonged. v2 removes
project entries from navigation because the fleet is the project list, and it
needs one stable home for the remaining non-content destinations.

**Chosen: exactly two labelled groups — product content and utilities.** The
utility group contains help plus settings/account destinations; help is not
misclassified as account-level content. Existing entries keep the same
navigation primitive, indentation, and peer order. The active entry gains a
non-colour-only current marker, and no registered project is added to either
group. This replacement is implemented and verified explicitly in task 3.

`Consistent Table Column Widths` remains unchanged. Its condition is generic to
any repeated table structure, including future or workflow matrices; it was not a
coverage-matrix-only promise even though the retired matrix exercised it. If no
post-cutover surface repeats one tabular structure across sections, the
requirement is intentionally dormant rather than an obligation to create such a
surface.

## 6. Why the Impeccable floor is not a requirement here

**Rejected: write the composite-score floor into `design-system` as AGE-483
proposes.**

The ratified capability map lists the critique ritual and its floor under
*deliberate exclusions*, and `design-system`'s own preamble repeats it: the
ritual and its score are process, not product, and live in `CLAUDE.md`. Writing
the floor into a requirement would overturn a ratified decision as a side effect
of an unrelated change.

The placement test settles it. A requirement is something whose violation is a
bug in the product. A UI scoring 88 instead of 90 on an internal critique is not
a bug a user can encounter — it is a verification threshold not met. What a user
*can* encounter is a state distinguishable only by hue, a table whose digits do
not line up, interface type that escapes the declared scale, or a status symbol
that hides an available version, percentage, or count. Those four product
outcomes — compact/aligned tables, bounded typography, visible values, and
non-colour-dependence — are what this change adds.

Raising the floor remains real work; it is tracked as AGE-476 and lands in
`CLAUDE.md`. The same issue computes from a superseded baseline and references a
CI gate that no longer exists — recorded in `openspec/BACKLOG.md` rather than
silently corrected here.

## 7. Why the no-integration guarantee survives

`optional-integrations` carried "The Dashboard Works Without Any Integration".
v2 has no integrations, so the requirement is vacuous in the literal present.
Withdrawing it would still be a semantic relaxation: the next integration could
become load-bearing unless its author rediscovered the old constraint.

**Chosen: preserve it by moving it to surviving `project-dashboard`.** It
constrains no v2 implementation, but it binds any future integration without
relying on archive archaeology, while `optional-integrations` can truthfully end.

## 8. Legacy locations redirect, removed APIs do not linger

Known v1 SPA locations may remain in bookmarks. They redirect to the fleet
surface so a user reaches a valid product surface rather than a blank shell.
The transition manifest maps the five retired legacy surface routes to fleet and
maps `/projects/:id` to `/repos/:id` so project context is retained. The fifth is
the root location `/`, added 2026-08-04: it rendered the withdrawn multi-project
home, so it is a retired location like the other four rather than a surviving
surface, and enumerating only the four named pages left the bare origin — the
product's most likely entry point — as the one URL with no specified behaviour.
Removed daemon APIs are different: keeping compatibility handlers would preserve
the withdrawn product surface. They return not-found and expose no stub payload.
That includes the daemon-hosted knowledge-graph viewer's asset and read URLs:
they are withdrawn daemon endpoints, not SPA locations, so bookmarked viewer URLs
deliberately return not-found rather than redirecting to an unrelated dashboard
surface.

## 9. Historical data becomes inert, not mysteriously abandoned

Snapshot and environment files under the daemon's own directory are retained at
cutover so rollback does not destroy evidence. "Inert" means v2 neither reads
nor writes them. Deletion or archival is separate cleanup work with an explicit
retention decision.

The reason history recomputation is dropped does not weaken the underlying
measurement principle: a future time series must version its measurement
definition or recompute history so a metric change is not displayed as a health
change.

**Superseded 2026-08-02: the atomic deployment this section assumed did not
happen, and did not need to.** `remove-gitnexus-integration` archived on
2026-07-28 and shipped **independently and deliberately** — its own proposal says
so — leaving `code-intelligence` at five requirements weeks before this change
could run.

The obligation that atomicity was standing in for was discharged upstream rather
than lost. What the clause protected against was a release exposing the old
conformance chart after the column set changed, which would put a step in the
90-day chart that reads as a change in fleet health but is really a change in
measurement. The upstream change solved that at the source: daily snapshots store
every per-column state inline, so old days were re-scored ignoring `gitNexus` and
`wiki`, and every point in the retained window is now interpreted using the same
post-cutover column set.

So recomputation did not "return as a release gate" — it was performed, which is
what the gate would have demanded. **This change therefore carries no outstanding
recomputation obligation and no atomicity requirement against GitNexus removal.**
The stale assertion is recorded as corrected rather than deleted, because a
reader who met the original clause needs to know it was satisfied upstream rather
than quietly dropped.
