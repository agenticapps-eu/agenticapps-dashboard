# Design notes — repo readiness

The rejected alternatives, and why. Both of the first two are recorded in the
design spec and the Linear project; they are reproduced rather than reinvented.

## 1. Why two tiers and not one

**Rejected: Tier B only** — every repo writes `.agenticapps/readiness.json`, the
daemon just reads it.

Clean, uniform, and worthless until the rollout finishes. Nothing is visible
before every repo has been touched, which means the dashboard has no value during
exactly the period when someone would be deciding whether to keep building it.
It also makes the dashboard's usefulness a function of discipline in fifteen
other repos.

**Rejected: Tier A only** — derive everything, never read a declared file.

Works on day one and needs no rollout, but caps the product permanently at what
can be grepped out of markdown. An externally run penetration test, a coverage
number produced in CI, a deliberate `n/a` with a reason — none of these are
derivable, and under a Tier-A-only model none of them can ever be shown. The
`pen-test` check would be frozen at `never` forever, which turns a real signal
into decoration.

**Chosen: both, with per-check precedence.** Tier A gives a real answer
immediately for every repo. Tier B raises the ceiling for any repo that opts in,
one check at a time. Precedence is per check rather than per file so that a repo
reporting only `pen-test` keeps five derived values instead of blanking them.

The cost is two code paths for the same field and a `source` marker on every
result so the detail page can say which one won. That cost is paid deliberately.

## 2. Why no aggregate score

**Rejected: a per-repo percentage, or a fleet score.**

The existing conformance page already ran this experiment. Equal-weight scoring
over tracked columns produces a number that moves for reasons nobody can
reconstruct, and that nobody can map back onto an action. Worse, it invites the
failure the GitNexus removal exposed: change the input set and every historical
score changes, so a measurement change reads as a health change.

Six cells that a reader counts themselves have none of those properties. A repo
with two blocking cells is worse than one with none, and the reason is legible
without a formula. The explicit boolean predicate answers the product question:
`fail`, `stale`, `never`, and evaluation errors block readiness; `warn` is a
non-blocking caveat; `na` is excluded and at least one applicable check must
remain. Pen-test intentionally stays `never` until declared, so the launch
boolean is expected to be false for repos without that evidence; the cells, not
the boolean, carry the useful rollout information. A fixed severity sort recovers the one
thing a score was actually used for, which is ordering the list.

The honest consequence: there is no single number to put in a status report. That
is accepted.

## 3. Why the status vocabulary has six values and not three

`ok` / `warn` / `fail` is the obvious set. It cannot express the two states that
carry the most information here.

`never` is not `fail`. A check that has never run is a gap in process; a check
that ran and failed is a defect in the product. Collapsing them either makes
every young repo look broken or makes an unrun security review look acceptable.

`stale` is the state most likely to be implemented wrong. A green security review
from forty commits ago is not an assurance. Both sides of the comparison use git
commit identity and committer time — never filesystem mtime — and the evidence
must descend from the last commit touching production code. Dirty or untracked
production-code changes also make committed review evidence stale.

The default production-code set is every tracked or unignored-untracked
repo-relative path except `docs/**`, `.planning/**`, `openspec/**`, root-level
`*.md`, and the configured coverage artifact. Repos may
replace the included paths and extend the ignored paths in
`.agenticapps/readiness.json`. This explicit boundary is part of the requirement,
not an implementation detail.

`na` exists so that "not applicable" is sayable with a reason, instead of being
smuggled in as `ok`.

## 4. Why the `workflow` check has four resolution strategies

Measured 2026-07-26: the four hosts do not install skills the same way. claude
puts a versioned `SKILL.md` in the repo; codex and opencode put only a scaffolder
version in the repo and the actual `implements_spec` in a **machine-global**
directory; pi has no per-repo version artifact at all.

**Rejected: assume one path.** It would produce a correct answer for claude and
nonsense for the other three.

**Rejected: synthesise a version for pi.** There is nothing to derive it from.
The check returns `na` with a reason until the question of what to pin it to is
answered. An honest gap beats an invented number.

For codex and opencode the check reports *both* values and the detail page states
plainly that the machine-global one is not repo-specific. Reporting a single
number there would fake a granularity that does not exist.

**Known limitation, deliberately not solved here:** there is no migration ledger
anywhere in a scaffolded project. The frontmatter comparison is the most accurate
*available* signal, not the most accurate *conceivable* one. A ledger belongs in
the core spec and the four installers (AGE-477), not in the dashboard. The
check's `summary` text says so, so nobody mistakes the number for more than it is.

For machine-global hosts, the status is `fail` when the global
`implements_spec` trails, `warn` when only the per-repo scaffolder trails, and
`ok` only when both match. The machine-global result is display-only and is
never persisted into a repo readiness file or exported as repo-owned evidence.

## 5. Why a table and not cards

A card costs roughly 200 px of height; a row costs 40. At fifteen repos that is
the difference between one screen and four scrolls, and the fleet grows. Family
becomes a filter chip rather than a grouping level, because grouping spends
vertical space separating repos that one wants to compare side by side.

## 6. Why the daemon does not sort

The fleet response comes back in registry order. Sorting by `fail` count is the
client's job because it interacts with the filter chips. A sorting server and a
sorting client eventually disagree, and the disagreement is invisible until
someone notices the list is wrong.

The client comparison is fixed: evaluation errors, `fail`, `stale`, `never`,
then `warn`, followed by most recent git committer time in UTC and stable repo
identifier. This ordering does not produce or display a score.

## 7. Why declarations carry evidence

Tier B is trusted author input, not a second derivation engine. Trust does not
mean accepting an unauditable green cell. Declared review and pen-test results
therefore carry a repo-relative evidence path, `observedAt`, the reviewed commit,
and for pen tests a `validUntil`. Review declarations become stale when the last
production-code commit is not an ancestor of the declared reviewed commit or
when relevant dirty or unignored-untracked production-code paths exist. Expired
pen-test declarations are stale.

An unknown check identifier is ignored entry-by-entry for forwards
compatibility. Any other malformed known entry invalidates the whole file, so a
partial typo cannot silently combine trusted and fallback results.

## 8. Why the cache is deliberately short

Readiness depends on the working tree as well as committed artifacts. The daemon
therefore caches a repo result for at most five seconds and keys it by registry
membership, repo id, HEAD, relevant dirty/untracked state, readiness-file identity, and the
machine-global workflow identity. Concurrent rescans for the same repo coalesce;
an unknown repo is a 404. This keeps a rescan deterministic without spawning
work or turning the cache into persisted state.
