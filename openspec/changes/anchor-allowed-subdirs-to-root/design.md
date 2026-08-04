## Context

Two resolvers guard every project-scoped filesystem read in the daemon:

- `packages/agent/src/lib/paths.ts` — async. `resolveAllowed` (repo-relative
  reads under `ALLOWED_SUBDIRS`) and `resolveAllowedNamed` (absolute path,
  caller-supplied roots, basename/extension allow-list).
- `packages/agent/src/lib/coverageResolver.ts` — `makeCoverageResolver`, a
  synchronous mirror of `resolveAllowedNamed` used by the scanners, which are
  synchronous. It merges the caller's roots with the three family roots.

Both check a candidate against a set of roots. Neither checks that a root is
still inside the repository it was derived from. `resolveAllowed` derives its
roots from `ALLOWED_SUBDIRS` inside the project; the scanners derive theirs from
a subdirectory of a repository. Five such boundaries are fixed here: four found
by the initial enumeration, one more found in review round 2 after that
enumeration turned out to be unsound (D6a), and one candidate refuted outright
(D8). Escape is confirmed by repro for `resolveAllowed` and for the round-2
site; the rest follow by inspection.

Constraint: `filesystem-access-policy` is the security spine, so this change may
tighten and must not relax. Verified empirically before designing: **no
repository in `~/Sourcecode/{agenticapps,factiv,neuroflash}` currently symlinks
`.claude`, `.planning`, `openspec`, `.github` or `.claude/skills`**, so the
tightening refuses nothing that works today.

## Goals / Non-Goals

**Goals:**

- A containment boundary derived from inside a registered root is never used
  unless it is still under the realpath of that root.
- One implementation of the rule, shared by the async and sync resolvers.
- Each of the six fixed sites — `resolveAllowed` plus five scanner boundaries —
  gets a behavioural test that fails before the fix.
- Ordinary repositories are byte-for-byte unaffected — no new error shape, no
  wire-schema change, no SPA change.

**Non-Goals:**

- Unifying the two duplicate `PathViolation` classes (`paths.ts` and
  `coverageResolver.ts` each declare one). Real, and a separate change; touching
  `instanceof` behaviour across the daemon is not this change's risk to take.
- Changing what `ALLOWED_SUBDIRS` contains.
- Symlinks *under* an allow-listed directory. Already governed by
  `Per-Project Path Allow-List` and already correct.
- Retro-fitting the anchor to the ~25 call sites whose root already **is** the
  registered root. They are correct as written.

## Decisions

### D1 — Anchor inside the resolvers, not at the call sites

The resolver filters its roots to those anchored under the registered root.
Callers that derive a root declare what it was derived from.

Alternative considered: fix each call site by pre-resolving the derived root
against the repo root first, the way `coreSpecVersionScanner.ts:92` already
does. It works and needs no API change, but it is the same three lines written
once per site, and the next call site omits it — which is precisely how these
came to exist. Rejected in favour of one enforcement point.

### D2 — Express the anchor as an `anchorTo` option

`resolveAllowedNamed` and `PathResolver` gain an optional `anchorTo?: string`.
When present, roots not under `realpath(anchorTo)` are dropped before the
containment check.

`resolveAllowed` needs no signature change: its registered root is the
`projectRoot` argument it already takes, so it anchors implicitly.

Alternative considered: make `anchorTo` **required**, so the type system forces
every caller to name its registered root. It gives a compile-time guarantee
instead of an opt-in, which is genuinely stronger. Rejected for this change: it
touches ~30 call sites that are already correct, inflating a security diff that
needs to stay reviewable, and most would pass `anchorTo` equal to the root they
already pass — noise that obscures the sites that matter. Recorded as an
open question rather than silently dropped.

### D3 — Drop escaped roots; refuse only if none survive

Roots are alternatives, so an escaped root's only effect is to *widen* what is
admitted. Filtering it out preserves legitimate multi-root callers while
removing the widening. If no root survives the filter, the call raises
`PathViolation` — the same class and shape the resolver already raises, so
callers' `catch` blocks are unchanged.

This is what makes `workflowVersionScanner.ts:158` (`roots: [skillRoot,
repoAbsPath]`) behave: `skillRoot` is dropped when it escapes, `repoAbsPath`
survives, and a path that lay only under the escaped `skillRoot` is now refused.

### D4 — Share one pure predicate, keep the two realpath implementations

The async resolver realpaths with `fs/promises.realpath`; the sync one with
`realpathSync`. Only the comparison is common, and it is pure string work on
two already-resolved paths. So the shared unit is a small predicate —
`isAnchoredUnder(realBoundary, realRoot)`, the `=== root || startsWith(root +
sep)` test — and each resolver keeps its own realpath calls.

This avoids inventing an async/sync abstraction to share nine lines, and keeps
the sync resolver sync.

### D5 — Per-path refusal, not per-repository (settled with the user)

`resolveAllowed` refuses the offending path with the existing `PathViolation`;
`routes/read.ts` and `routes/open.ts` translate it into the response they
already produce for an out-of-allow-list path. No new whole-repository failure
mode, no new SPA state.

The requirement's original "the repository SHALL contribute nothing" wording was
written for a fleet scanner aggregating many repos, where per-path refusal has
no meaning. The delta makes refusal take the shape of the reader: aggregate
readers contribute nothing *read through the escaped boundary*, single-path
readers refuse the path.

The qualifier matters and was missing at first — "contributes nothing" read as
total omission, which contradicts what the code actually does. The scanners emit
a degraded record (`missing` skills, `state: 'missing'`) so the failure is
visible; a repository that vanished from the output entirely would be a silent
failure of exactly the kind this capability exists to prevent.

### D6 — Behavioural tests, not source-shape guards

Each site gets a test that builds a temp fixture with a real escaping symlink
and asserts nothing outside is read. A textual guard over the sources (grep for
`roots:` without `anchorTo`) was considered and rejected: it is brittle against
formatting and asserts what the code *says* rather than what it *does*.

Every test must be shown RED before the fix, per the hand-off's standing note
that two green fixtures once turned out to assert nothing.

### D6a — How the site list was produced

D6 rejects a textual guard, which leaves the enumeration itself as the only
thing standing between this change and a missed site. So the method is recorded
rather than left as "by inspection":

`grep -rn "roots:" packages/agent/src --include="*.ts"` over every call into
either resolver, then each hit classified by what its `roots` expression is
derived from — the repository root itself (correct as written, ~25 sites), a
path *inside* a repository (the sites fixed here), or a root the daemon names
directly (the family roots and the machine root refuted in D8).

**That method was unsound, and round 2 proved it.** Classifying a call by what
its `roots:` expression contains misses the case where a resolver's *return
value* is later adopted as a boundary. `workflowFleetScanner` resolves
`skills/` with `roots: [hostRepoRoot]` — correct-looking by the classification
above — and then uses the returned path both as a `readdir` target and as the
`roots` of later calls. The resolution itself was unanchored, so the family
roots admitted a `skills/` symlinked into a sibling repository, and enumerating
it put that repository's entry names into this one's output. Anchoring only the
child reads was too late.

The corrected method adds a second pass: for every resolver call, ask not just
what its roots contain but **what its return value becomes**. A returned path
that is later enumerated, or passed as a root, is itself a boundary and needs
its own anchor. That pass found the missed site, taking the fixed set to
`resolveAllowed` plus five scanner call sites.

Two limits remain, now stated plainly. The grep keys on the `roots:` property
name, so a call site building its options indirectly would not appear. And
nothing prevents a *future* site from omitting the anchor — the same gap D2's
optional `anchorTo` leaves open, and the reason the required-field alternative
is the named next change rather than a someday item.

### D7 — An anchored call does not fall back to the family roots

**Corrected during implementation.** This decision originally read "the anchor
filter applies to caller-supplied roots; the family roots are left alone". That
was written believing the filter alone was sufficient. It is not, and the
mistake was demonstrated rather than reasoned about:

`makeCoverageResolver` merges the three family roots into the candidate set
*after* the filter, so an anchor only bites when **every** caller root escapes.
When one root survives — `workflowVersionScanner`'s `roots: [skillRoot,
repoAbsPath]` — a target under `~/Sourcecode/{agenticapps,factiv,neuroflash}`
was still admitted:

```
admitted: …/Sourcecode/agenticapps/other-repo/skills/SKILL.md
threw   : null
```

Every scanned repository lives under a family root, so the anchor would have
been decorative in production while passing a test whose family roots were
empty. It also made the delta's "a boundary derived from an allow-listed
directory is anchored too" scenario false.

So: when `anchorTo` is present, the containment check uses **only** the anchored
caller roots. Passing an anchor asserts that this read stays inside that
repository, and the cross-family allowance is not part of that assertion.

Unanchored calls are completely unaffected — the family roots remain exactly as
permissive as before, which is what lets the fleet scanners read across
repositories at all. The narrowing reaches only the call sites this change
anchors, and `coverageResolver.test.ts` pins both halves.

### D8 — Machine roots are not anchored (a refutation of this change's own scope)

`workflowArtifactScanner.ts:414` was enumerated in the proposal as the fifth
site and is deliberately left alone.

Its `canonicalRoot` comes from `rootPath`, a machine root the daemon names
directly — `~/.claude/skills`, `~/.codex/skills`. Nothing registered sits above
it, so there is no root to anchor *to*; it belongs with the family roots, not
with boundaries derived from inside a repository. Anchoring it to itself would
be a no-op, and anchoring the entries beneath it would be actively wrong:
symlinking a skill directory into a repo checkout is how these are installed.
Measured on this machine — 13 of 14 entries under `~/.codex/skills`, 33 of 98
under `~/.claude/skills`, most pointing into `~/Sourcecode`.

The delta's scenario is written as "a reader derives a further boundary from a
directory **inside a registered repository**", so a machine root falls outside
it and no spec change is needed to accommodate this.

## Risks / Trade-offs

- **A repo that deliberately symlinks `.claude/skills` to a shared directory
  would stop being scanned.** → Verified that no repo in the three family roots
  does this today, so nothing regresses on this machine. If one appears, it
  degrades visibly per-repository rather than silently reading outside itself,
  which is the behaviour the spec asks for.
- **`anchorTo` is opt-in, so a future call site can omit it.** → Accepted, and
  the reason D2's required-field alternative is recorded as an open question
  rather than closed. The behavioural tests cover the six fixed sites; they do
  not prevent a seventh.
- **Extra realpath per call on the anchor.** → One `realpath` on a directory
  that is almost always already in the OS cache, against reads that already do
  several. `resolveAllowed` realpaths its roots on every call today, so the
  order of magnitude does not change.
- **An anchored call must not fall back to the family roots.** → See D7. The
  allowance itself is untouched for unanchored calls.

- **The anchor does not close the TOCTOU window, and does not claim to.** It is
  verified at realpath time; the symlink can be swapped between that check and
  the read. Per-call re-resolution narrows the window relative to a cached
  anchor but leaves it open. This is a pre-existing class rather than something
  this change introduces, and `routes/read.ts` already carries the mitigations
  that exist for it — `O_NOFOLLOW` on open, plus a re-`realpath` after open that
  refuses when the path moved. Stated here so a security-spine change does not
  leave the residual risk silent; closing it properly needs `openat()` chains
  Node does not expose portably.

## Migration Plan

No data migration, no config change, no rollout coordination. The daemon is
local and restarts on `agentic-dashboard stop && start`. Rollback is reverting
the commit.

## Open Questions

- **Making `anchorTo` required is the follow-on this change most needs, not an
  optional nicety.** All three reviewers landed on the same point: an opt-in
  security boundary is one a future call site forgets, and D6a's grep does not
  prevent that. Deferred here only to keep a security diff reviewable — it
  touches ~30 already-correct sites — and it should be the next change in this
  area rather than a someday item.
- Relatedly, nothing in the type system distinguishes a **machine root** (never
  anchored, per D8) from a **repository-derived root** (always anchored). Today
  that distinction lives in a caller's judgement, which is exactly the kind of
  implicit convention this change exists to remove. A required `anchorTo` whose
  type admits an explicit "this root is daemon-named" variant would close both
  questions at once.
- The reverse symlink direction — a registered repository's `.claude/skills`
  pointing *at* a machine root — is governed by the existing scenarios and needs
  no new rule: the anchor sees a boundary that has left the repository and
  refuses it, exactly as for any other outside target. Worth confirming in review
  rather than assuming, since D8 makes machine roots sound exempt in general when
  only the machine-root *reader* is.
- The two duplicate `PathViolation` classes mean `instanceof` depends on which
  module a caller imported. Not exercised by this change, but it is a trap.
