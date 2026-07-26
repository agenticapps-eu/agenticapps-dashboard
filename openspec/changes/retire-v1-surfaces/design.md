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
loses eight requirements and keeps four, because the four describe how a project
is read, and v2 does not change that. Ending it would have thrown away the hybrid
read strategy that the `spec` check depends on.

The distinction is stated in the proposal because it is the substantive part of
this change: five capabilities end, one is cut back, and those are different
claims.

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

## 5. Why the Impeccable floor is not a requirement here

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
*can* encounter is a state distinguishable only by hue, or a table whose digits
do not line up. Those are the outcomes the ritual protects, and those are what
this change adds.

Raising the floor remains real work; it is tracked as AGE-476 and lands in
`CLAUDE.md`. The same issue computes from a superseded baseline and references a
CI gate that no longer exists — recorded in `openspec/BACKLOG.md` rather than
silently corrected here.

## 6. Why the withdrawn integrations guarantee is not restated

`optional-integrations` carried "The Dashboard Works Without Any Integration".
There is a reading under which that survives v2 as a standing constraint on
anything added later.

It is withdrawn instead, on the grounds that a guarantee about how optional
components degrade is vacuous when there are none — it constrains nothing and
would sit in the slot as a promise with no subject. The counter-reading is
recorded as an open question in the proposal rather than resolved silently,
because it is genuinely arguable and the cost of being wrong is that somebody
adds an integration later without re-deriving the constraint.
