# Design — OpenSpec project reader

Written 2026-07-26, after the first review round returned REQUEST-CHANGES from
all three reviewers. Several findings were not defects in the prose but design
questions the change had never actually decided. This note decides them and
records what was rejected, so the next reader does not re-litigate.

## 1. Why keep a CLI path at all

**Decided: hybrid, CLI preferred, tree as the guaranteed floor.**

The strongest alternative is **tree-only**: if the tree reader must exist anyway
as a fallback, the CLI path is a second implementation of the same thing and the
source of the entire parity problem. Deleting it removes a spawn site, a timeout
policy, a JSON-shape check, and a class of test.

Rejected, on one ground: the tree reader hardcodes a layout — top-level
`tasks.md`, `specs/<capability>/spec.md` — that OpenSpec does not promise to keep
as its only shape. When a project uses a task artifact the tree reader cannot
locate, tree-only reports a confidently wrong number, and it reports it silently.
The CLI is the only source that stays correct across a layout the dashboard does
not control.

So the CLI is preferred where it answers, and the tree is the floor that always
answers. The cost is the parity question, decided next.

**Alternative also rejected: CLI-only, with the binary as a hard dependency.**
The daemon runs on machines that may not have the fleet's tooling installed, and
a project the dashboard cannot read at all is worse than one it reads
approximately.

## 2. Parity is scoped, not universal

**Decided: pin a six-field set, and claim parity only over conformant changes.**

The original delta said "both paths MUST produce the same values." Two reviewers
independently rejected it, and they were right for different reasons: the field
set was never enumerated (so no test could be written against it), and the claim
is *false* for a change whose task artifact the tree reader cannot locate.

An invariant that cannot fail is not an invariant. The fix is to say what
"the same values" means — the table in the spec delta — and to say over what it
holds. For non-conformant changes the paths may differ and the CLI wins.

**Alternative rejected: make the tree reader fully general** so parity is
universal. That means reimplementing OpenSpec's artifact resolution inside the
daemon and keeping it in step with an upstream that is free to change. That is
the drift this change exists to avoid; it also makes the fallback the most
complex code in the reader.

Two values sit outside the parity question entirely because the CLI does not
report them — the archive and affected capabilities. Both always come from the
tree, on both paths. That is not a fallback, it is where they live.

## 3. The `openspec` binary is bounded like a route, not like a tool

**Decided: resolve once at start, fixed argv table, project root as the only
request-derived value, bounded, always falls back.**

The distinction that drove this: `$EDITOR` and the conformance harness spawn on
an explicit user gesture. This binary spawns on an ordinary card render, on every
project, unattended. A per-request `PATH` lookup would make the daemon's
behaviour depend on mutable machine state on the request path, so resolution
happens once and its failure is a permanent, quiet degradation to the tree.

The fallback list is deliberately broad — timeout, non-zero exit, oversized
output, unparseable JSON, unrecognised shape. Every one of them degrades to the
tree rather than surfacing. A reader whose failure mode is "the project looks
broken" would make the dashboard less trustworthy than one that quietly reports
slightly staler structure.

**Alternative rejected: require an absolute daemon-installed binary** (one
reviewer's suggestion). It is stricter, but it makes the dashboard's correctness
depend on an install step outside the dashboard, and the tree path already
provides the same safety with no install.

## 4. Dropping `.planning/config.json` as a discovery marker

**Decided: drop it. Two markers remain — `openspec/`, and the workflow skill.**

Keeping it would let a user auto-discover and register a project the dashboard
can show no planning state for, and then — under the original delta — tell them
to install a workflow they already have. That contradiction is what two
reviewers caught.

Dropping the marker is explicitly **not** an unregistration: existing entries
stay. The scan stops offering new ones; nothing is removed from anyone's
registry. This matters because the eight GSD-only repos are already registered.

The workflow-skill marker stays, and it is the one that makes the
`needs-migration` state reachable: a repo with the skill and no `openspec/` is
exactly the fleet's migration backlog, and the card now says so.

## 5. Review finding counts are removed, not approximated

**Decided: remove the field from the card.**

Its source was the GSD reader's artifact parsing. OpenSpec `REVIEWS.md` is
reviewer prose with no structured severity — the verdicts on this very change are
free text. Any count derived from it would be a regex over English.

**Alternative rejected: keep the field and parse severity headings.** That
invents a schema `run-plan-review.sh` does not produce and would show a number
that looks authoritative and is not. Re-adding the field is a change that first
specifies where severity comes from.

## 6. Exposing `openspec/` through `/read` is accepted

**Decided: accept, and say so in the spec.**

The two reviewers disagreed here — one called it an exposure of proposals and
review artifacts that may carry sensitive content, the other explicitly found no
regression. Both are looking at the same fact and weighting it differently, so
the change has to decide rather than record a tie.

Accepted, because `openspec/` is the same content class as `.planning/`, which
has been allow-listed since the first release and carried the GSD-era review and
security artifacts. The route's bounds — authenticated, project-scoped,
read-only, realpath-checked — are unchanged, and they are what actually contain
it. Adding a size cap or file allow-list here would be a new policy applied to
one of three allow-listed directories, which is harder to reason about than the
uniform rule.

**Alternative rejected: constrain readable files under `openspec/`.** Worth
revisiting as a policy for *all three* directories, which is its own change.

## 7. Not reopened: the GSD fallback

One reviewer proposed keeping the GSD reader behind a flag until the fleet
migrates. This is a ratified decision, not an open question — recorded in the
proposal's accepted consequence and in `CAPABILITY-MAP.md` GAP-05. Dual-path
readers were judged not worth carrying, and the blank column is the intended
signal: it makes the migration backlog visible, which a fallback would hide.

Recorded here as considered-and-declined so the next review round does not
surface it a third time.
