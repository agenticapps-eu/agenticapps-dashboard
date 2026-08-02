## Context

`add-repo-readiness` archived on 2026-08-02 with six checks, a six-value status
vocabulary, and a boolean verdict computed over all six. `computeReady`
(`packages/shared/src/schemas/readiness.ts:240`) blocks on any result whose status
is `fail`, `stale`, or `never`, or which carries an evaluation error.

Five of the six checks derive a real signal from the repo. `pen-test` does not:
`derivePenTest()` (`packages/agent/src/lib/readiness/reviewDeriver.ts:336`) is a
constant returning `never`, by design — the slot is declared-only and
tool-agnostic. The consequence was not designed: `never` blocks, nothing declares
a pen test, so `ready` is `false` for every repo in the fleet and cannot be
anything else. It was disclosed in the PR #90 body as an open product question and
carried into this change.

Four spec-completeness gaps were deferred from the same change, recorded in
`openspec/changes/archive/2026-08-02-add-repo-readiness/tasks.md` under
"Deferred, with reasons, to a follow-up change". Three came from the pre-code
reviewer round; the fourth was added after the CodeRabbit round found a Critical
defect in the exact area the spec was silent on.

Constraints inherited and not negotiable here:

- `filesystem-access-policy` is the security spine. Two distinct path guards live
  under it and must not be conflated: `resolveAllowed`
  (`packages/agent/src/lib/paths.ts:51`) admits only `.planning`, `.claude`, and
  `openspec` under a project root and governs the project read route, while
  `resolveAllowedNamed` (`:125`) takes explicit roots and permitted basenames and
  is what tier-B validation uses. `add-repo-readiness` made "do not widen the
  allow-list" an explicit non-goal, and nothing here needs to.
- Declared evidence is typed `RepoRelativePathSchema` at the schema layer — any
  repo-relative path, because a pen-test report's natural home is `docs/` or
  `SECURITY.md`. That is only the *shape* check. A second layer,
  `evidenceIsReadable` (`readinessFile.ts:134`), resolves, stats, and opens every
  citation, and invalidates the whole file when one fails. The schema type alone
  does not describe what tier B accepts.
- The two policies differ deliberately, and that has a visible consequence: a
  citation may be valid for tier B and still unservable by the read route.
- The readiness wire shape is strict and validated outbound. Adding or removing a
  field is a schema-drift event on the client.

## Goals / Non-Goals

**Goals:**

- The readiness verdict can vary. A repo that satisfies every check the daemon can
  actually measure is reportable as ready.
- Removing the watermark does not weaken the predicate: a repo that has asserted
  it never pen-tested is still not ready.
- The four deferred properties are stated in durable spec, at the level of detail
  that would have prevented the defect each one shadows.

**Non-Goals:**

- No new check, no change to the six identifiers or their order.
- No aggregate score. The predicate stays boolean; `Readiness Is Presented
  Without An Aggregate Score` is untouched.
- No widening of the filesystem allow-list, and no new read of any repo path.
- No change to the wire shape. `ready` already exists and is already a boolean;
  only its value and its presentation move.
- Not reopening the two `add-repo-readiness` findings recorded as reviewed and not
  accepted.

## Decisions

### D-1: Blocking keys on derivability, not on provenance alone

**Chosen.** A shared constant designates which checks have no derived signal.
`computeReady` exempts a `never` from blocking only when the check is in that set
*and* the result's `source` is `derived`:

```
ADVISORY_WHEN_UNDECLARED: readonly CheckId[] = ['pen-test']

// `notice` is the repo's readiness-file notice, already a sibling of `ready`
// and `checks` on the response object. Without it the exemption cannot be
// suspended, because an unusable file leaves every result byte-identical to
// the no-file case. `refineReady` must be given the same value.
exempt = (c) =>
  c.status === 'never' &&
  c.source === 'derived' &&
  ADVISORY_WHEN_UNDECLARED.includes(c.id) &&
  notice === null

blocked = checks.some(c =>
  c.error !== null || c.status === 'fail' || c.status === 'stale' ||
  (c.status === 'never' && !exempt(c)))
```

**Provenance alone is not sufficient, and this is the subtle part.** An earlier
sketch of this rule exempted every derived `never`. That is wrong: `coverage`
reports a derived `never` when a repo has no coverage artifact, and under a
provenance-only rule a repo with no tests at all would compute as ready. The
difference is that `coverage` observed its repo and found nothing, while
`pen-test` has nothing to observe — `derivePenTest()` is a constant and never
consults the repo. "We looked and found nothing" is evidence; "there is nothing to
look at" is not. Only the second earns the exemption.

The `source === 'derived'` clause is still needed as the second half: it keeps a
*declared* status authoritative, so a repo that asserts a bad state is believed.
For `pen-test` specifically that half is currently vacuous — the ratified tier-B
schema already restricts declared `pen-test` to `ok`/`warn`/`fail`, so a declared
`never` cannot exist for it — but the clause is what makes the rule safe for any
future member of the advisory set, and it costs nothing.

The designation lives in a constant rather than an `if (id === 'pen-test')` so
the spec can state the general property while today it has one subject. A check
later given a derived signal leaves the set by being removed from it; a second
declared-only check joins without a second rule.

**Alternative — undeclared pen-test derives `na` instead of `never`.** `na` is
already excluded from the predicate, so this needs no change to `computeReady` and
is the smaller diff. Rejected because it overloads the vocabulary: `na` means "this
check does not apply to this repo" and carries a required reason, while an
undeclared pen test is very much applicable and simply unreported. The six-value
vocabulary was ratified deliberately and the spec already states that `na` must
carry a reason; there is no honest reason to write.

**Alternative — drop the boolean verdict.** Replace "Ready / Not ready" with "N of
6 clear". The most honest response to a constant verdict is to stop claiming one.
Rejected because `ready` is on the wire in the shared schema and consumed by the
fleet row's sort and the detail header, so removing it is a breaking surface
change to fix a data problem — and the fleet column exists precisely to give an
at-a-glance signal, which a count does less well.

**Alternative — declare pen-test per repo and change nothing.** The mechanism
already exists. Rejected because for almost every repo the honest declaration is
`never`, which blocks — the watermark returns, now with paperwork.

### D-2: An advisory check must be visible next to the verdict

Consequent on D-1 and not separable from it. A repo can now read "Ready" while its
pen-test check has never run, and a verdict that quietly excludes a check is worse
than one that is always false. The fleet row and the detail header therefore show
the undeclared advisory check's state alongside the verdict.

This is why D-1 is not purely a predicate change: shipping the predicate without
the presentation would trade a useless verdict for a misleading one.

### D-3: Citations are verified; the spec says so, because the code already does it

**Chosen.** State the shipped behaviour: every declared evidence path is resolved,
confirmed to be a regular file within the read bound, and opened during tier-B
validation, and any failure invalidates the whole readiness file.

**This decision reverses an earlier draft of this design, and the reversal is the
point.** The draft asserted that the daemon never touches a cited path and that
verifying one would require widening `ALLOWED_SUBDIRS`. Both claims were false, and
two of the three plan reviewers caught them independently:

- `readinessFile.ts:114` calls `evidenceIsReadable`, which at `:134-173` resolves
  each citation, rejects a non-regular file, enforces `MAX_EVIDENCE_BYTES`, and
  **opens** the file — with the comment that a path can stat cleanly and still be
  unreadable. Failure returns `unusable(...)`, discarding the file. Tests at
  `readinessFile.test.ts:65/81/92` pin absence, directories, and symlink escape.
- The allow-list claim conflated two functions. `resolveAllowed` enforces
  `ALLOWED_SUBDIRS` and governs the project read route. `resolveAllowedNamed`
  (`paths.ts:125`) takes explicit roots and permitted basenames, and
  `readinessFile.ts:130` calls it with `roots: [root]` and the author's own
  basename. Verification of an arbitrary repo-relative citation already happens
  and never required widening anything.

So the draft was not documenting the status quo; it was deleting a tested,
security-relevant control while claiming to record one. That is the precise
failure shape this repo fixed spec-side two days ago — shipped behaviour correct,
artifact describing it wrongly — and it is worth naming here so the archived
change carries the reason the delta says what it says.

The originally deferred question — drop the entry, invalidate the file, or accept
the claim — turns out not to be open. The code chose "invalidate the file". The
gap was only ever that durable spec never stated it.

**Alternative — narrow the blast radius to the entry.** A bad citation would
invalidate only its own declaration, letting the check fall back to derived while
the file's other declarations stand. Genuinely better product behaviour: today one
stale path silently discards all six declarations. Rejected *for this change* as
scope — it is a behaviour change with real test churn, and this change's purpose
is to make durable spec state what ships. Recorded in Open Questions.

**Alternative — the draft's position, taken deliberately.** Accepting citations
unverified is defensible on the merits: existence is not content, and a present
file may be empty or unrelated. But it deletes the audit property that makes tier
B trustable at all, and it would have to be declared as a reversal with the
deleted tests named. Not worth it to buy nothing.

What survives from the draft, and is now in the delta, is the narrower true claim:
verification establishes that the citation is **real and reachable**, and nothing
about whether the artifact substantiates the declaration. No surface may imply
otherwise.

### D-4: The rescan contract is written as it ships

`readiness.ts:62-83` returns the full `RepoDetailResponse` with 200, 404
`project_not_found` for an unknown repo, and 403 `origin_not_allowed` for a
disallowed origin. This is written down rather than redesigned; nothing about the
shipped shape is wrong, it was simply never stated, and a client author reading
the spec today cannot tell whether rescan returns the new state or an
acknowledgement.

Returning the recomputed detail rather than 202/204 is worth stating as the
contract because it makes rescan a read-your-writes operation — the caller does
not have to follow with a GET and hope the cache agrees.

### D-5: Rescan-vs-read isolation is a named property

The PR #90 Critical defect: `snapshotFor` returned an in-flight promise before
consulting `force`, so a rescan overlapping a read joined the read's `force=false`
computation and answered 200 having done nothing. The spec specified
rescan-vs-rescan coalescing and was silent on rescan-vs-read, so the code was
wrong without contradicting anything written.

The code is now correct. The property is stated so that correctness is pinned
rather than incidental — this is the specific gap that let a Critical defect ship
past a spec review.

### D-6: Three decay models, stated — including the one that is a weakness

`ageDeclaration` (`assemble.ts:194`) has three branches, and the delta now names
all three rather than the two an earlier draft asserted:

- `pen-test` decays on the **calendar**, via `validUntil`. A pen test's result
  rots because the threat landscape moves under unchanged code.
- `code-review` and `security-review` decay by **ancestry**, against the commit
  each declaration carries.
- `workflow`, `spec`, and `coverage` **do not decay at all** — the function
  returns `null` for them. A declared value holds until the author changes it.

The draft claimed coverage aged by ancestry. It does not: *derived* coverage does,
a *declared* coverage value does not, and codex was right to call that out.

The third branch is the weakest guarantee in tier B, and the delta states it
plainly rather than dressing it as principle. It is not fixed here: an expiry
would make a declaration stale while both the code and the declared value were
unchanged, and ancestry decay would require these entries to carry a commit, which
changes what tier B asks of an author. Both are real changes to the trust model
and neither belongs in a change whose purpose is to make the spec match the code.
Stated so a later change tidying the schema cannot read the asymmetry as an
oversight and level it in the wrong direction.

## Risks / Trade-offs

- **A green row will imply a pen test to some readers.** → D-2 makes the
  undeclared advisory state visible next to the verdict; the spec states it as a
  requirement rather than leaving it to the component, so it cannot be dropped in
  a later redesign without failing a scenario.
- **Ready becomes easier to reach, so the verdict means less than a reader might
  assume.** → It now means exactly "clear on everything measurable that nobody has
  disclaimed", which is both statable and true. The previous meaning was "no",
  which was neither.
- **The advisory rule could be mistaken for a general softening of `never`.** →
  It is scoped to membership of the advisory set *and* `source: 'derived'`. Two
  scenarios pin the boundary: a derived `never` from a derivable check still
  blocks (the coverage case), and a declared `never` on a derivable check still
  blocks. An expired declaration ageing to `stale` also still blocks, through the
  existing `ageDeclaration` path.
- **The advisory set is a constant that a later change could extend carelessly**,
  which would silently shrink the predicate. → Membership is a spec-level
  designation with a stated test — the daemon must have nothing to observe for
  that check — not a convenience list. Adding a check that *does* observe its repo
  would contradict the requirement text, not merely change a constant.
- **Fixture and test churn.** Existing assertions encode `ready: false` for
  repos that will now be ready. → The churn is the evidence the change works;
  each updated assertion should be checked to confirm it flips for the intended
  reason and not because a fixture happened to declare something.
- **`computeReady`'s signature widens** from `Pick<CheckResult, 'status' |
  'error'>` to include `id` and `source`. → Both call sites already pass whole
  `CheckResult` objects, so no caller changes; the tests that construct partial
  objects are the only affected code, and they are in the package under change.

## Migration Plan

No data migration and no persisted state — readiness is computed in memory and
cached for at most five seconds. Deployment is the ordinary daemon + SPA release.
Rollback is a revert: the verdict returns to its constant `false`, which is the
current shipped behaviour, so a rollback degrades to today rather than to a
broken state.

The daemon and SPA should ship together. A new daemon with an old SPA would
report a varying verdict on a surface that does not show the advisory state —
exactly the misleading-verdict risk D-2 exists to prevent.

## Open Questions

- **One bad citation discards every declaration in the repo.** `evidenceIsReadable`
  invalidates the whole readiness file, so a single moved pen-test report silently
  drops the repo's code-review and security-review declarations too, and all six
  checks fall back to derived. Narrowing the blast radius to the offending entry
  is probably right and is deliberately not done here — it is a behaviour change,
  not a documentation gap. Worth its own change. Note that this change had to add
  a guard against it rather than merely record it: without suspending the advisory
  exemption while a file is unusable, breaking a citation would have been a way to
  reach ready.
- **Evidence validation has a TOCTOU window, and its worst case is availability,
  not disclosure.** `realpath`, `stat`, and `open` are separate calls with no
  `O_NOFOLLOW` and no post-open revalidation, so a citation replaced mid-validation
  can be opened after its predecessor was judged contained. The bytes are
  discarded, so nothing is disclosed through that path — but a substituted FIFO or
  device node can make the open **block indefinitely**, and `readFleet`
  (`service.ts:345`) awaits `Promise.allSettled` over every registered repo with no
  per-repo time bound. `allSettled` survives a rejection and is replaced by an
  unscannable result; it does not survive a hang. So one repo can withhold the
  entire fleet response, which is a real hole in the per-repo degradation
  guarantee. Recorded rather than fixed — a bounded open belongs to the shared read
  primitive — but the delta no longer claims isolation the code does not provide.
  **This is the strongest candidate for the next change out of this one.**
- **An author cannot honestly declare "we have never pen-tested this."** `never` is
  reserved for no-declaration and `fail` asserts a test ran, with mandatory
  evidence, commit, and expiry. Raised by codex and gemini across three rounds and
  now stated as a gap rather than answered with the `fail` workaround. Closing it
  is a tier-B vocabulary or entry-shape decision.
- **The three timeless declarations want a decay model.** Recommended shape, for
  whoever takes it: ancestry, matching the review checks, which would mean
  `workflow`, `spec`, and `coverage` declarations begin carrying a commit. That is
  a change to what tier B asks of an author and needs its own proposal — but
  "ancestry, like reviews" is the direction, not "add an expiry".
- Whether `pen-test` should eventually gain a derived signal (for example, reading
  a report artifact the way `coverage` reads a summary) is left open. It would
  make the check derivable, at which point it must be removed from the advisory
  set — the invariant test in the delta exists so that removal cannot be
  forgotten.
- Whether declared `workflow`, `spec`, and `coverage` should decay at all (D-6's
  third branch). Today they are permanent until edited.
- The fleet surface has no legend for the six status shapes — carried from
  `add-repo-readiness` and untouched here. It becomes slightly more pressing once
  a row can be ready with an advisory check showing, since that is a two-symbol
  state a reader has to interpret.
