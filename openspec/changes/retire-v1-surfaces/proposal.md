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
capability and all of the other four: **40 here, 42 across the two changes**.

**Modified — 3 capabilities.** `project-dashboard` loses its projections to the
readiness surfaces but keeps the reading machinery underneath. `design-system`
gains the density and non-colour-dependence invariants. `help-docs` contracts to
match the smaller surface.

### The full count is 50, not 42

The 42 figure counts only requirements lost to a *capability* withdrawal. It
omits `project-dashboard`, which survives as a capability while losing eight
requirements — the card grid, its fetch contract, its filters, the single-project
header, the discipline column, the change-progress column, the capability panel,
and the panel degradation contract.

Withdrawn in total: **50 requirements** — 42 by capability withdrawal (40 here,
2 upstream) and 8 more from `project-dashboard`. One of the 42 is not withdrawn
after all: `The Dashboard Works Without Any Integration` is kept as a conditional,
so the net figure is **49 withdrawn, 1 rewritten**.

**Capability count, stated precisely.** This change alone takes the slot from
**12 to 7**. It reaches 10 only in combination with the three capabilities added
by `add-repo-readiness`, `add-workflow-fleet-conformance`, and `add-agent-board`.
The earlier phrasing "12 → 10" invited a reader checking this change in isolation
to find a number that does not follow from it.

The distinction is worth keeping visible: a capability that ends and a capability
that is cut back are different statements about the product, and only the second
leaves something behind that must still be true.

**Untouched — 3 capabilities.** `daemon-runtime`, `auth-and-pairing`,
`project-registry`. v2 changes *what* is shown, not *how* the data is fetched.

**No longer untouched — `filesystem-access-policy`.** The original plan listed
four untouched capabilities. That was wrong, and the correction is recorded
rather than quietly applied: `add-workflow-fleet-conformance` adds a second
process-spawning exception and a machine-wide allowed root, so the security spine
carries a delta after all. It is amended there, where the justification lives,
not here.

## Ordering: this change lands last

A withdrawal is only true once the replacement stands. Retire the coverage matrix
before the readiness surface ships and the spec slot states, for that interval,
that the product can do neither. So this change is written **now**, alongside the
v2 changes, and applied **at the cutover**.

Writing it now is the point. A change that adds the fleet surface without saying
in the same breath which requirements it supersedes is how two truths get into
one slot.

## What this change explicitly does not do

- **It does not tidy `openspec/CAPABILITY-MAP.md`.** That document is ratified
  and dated. Its capability table keeps saying twelve, because on the day it was
  ratified there were twelve. The change is appended as a supersession note, not
  edited in. Supersede, never delete.
- **It does not withdraw the Impeccable composite floor into a requirement.**
  Raising the floor is real work (AGE-476), but the ratified capability map and
  `design-system` itself both state that the critique ritual and its score are
  *process, not product*. Honouring that exclusion, the floor change belongs in
  `CLAUDE.md` and `README.md`; only the outcomes it protects — density, tabular
  figures, non-colour-dependence — become requirements here.
- **It does not delete history.** Nothing under `docs/legacy-planning/` or
  `openspec/changes/archive/` is touched.
- **It does not withdraw the security or infrastructure spine.**
- **It does not itself delete code.** The deletions are AGE-473 (cutover) and
  AGE-474 (daemon teardown). This change is the statement about the product that
  those deletions implement.

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

## Open questions

> [GAP: `optional-integrations` carries "The Dashboard Works Without Any
> Integration" — a guarantee that outlives the panels it was written for, since
> v2 has no integrations at all. Withdrawn here as vacuous rather than restated,
> on the grounds that a promise about optional components is meaningless when
> there are none. If integrations ever return, the guarantee returns with them
> and should be restated then. Flagged because the alternative reading — keep it
> as a standing constraint on any future integration — is also defensible.]
