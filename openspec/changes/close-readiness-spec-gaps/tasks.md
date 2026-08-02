# Tasks

TDD applies throughout. Every behavioural task lands as a `test(RED)` commit
whose failure was observed, then a `feat(GREEN)`. The verdict change is the kind
that passes vacuously if the test is written after the code — a fixture that
already declares nothing will report ready under both rules if the assertion is
written to match whatever ships — so RED is not a formality here.

## 1. Validate and review the plan before any code

- [x] 1.1 `openspec validate --all` green with this change present — 18/18
- [x] 1.2 `REVIEW_TIMEOUT=540 run-plan-review.sh close-readiness-spec-gaps --implementing-host claude` — **four rounds**, 3 other-vendor reviewers each. Verdicts by round: (gemini A, codex RC, opencode RC) → (all three RC) → (gemini A, codex RC, opencode RC) → **(gemini A, opencode A, codex RC)**. Rounds 1–3 preserved verbatim as `REVIEWS-round-N.md`
- [x] 1.3 Triage across four review rounds: **40 findings, 39 accepted and fixed, 1 recorded out of scope.** Rounds below

### 1.4 Round-1 triage record

The round found a defect in the plan of the exact shape this repo fixed spec-side
two days ago — shipped behaviour correct, artifact describing it wrongly — and
codex and opencode reached it independently from different starting points. It was
verified against the code before being accepted, and the verification is in
`design.md` D-3.

**The root defect.** The draft D-3 claimed the daemon never touches a declared
evidence path, and that verifying one would require widening `ALLOWED_SUBDIRS`.
Both false. `readinessFile.ts:114` → `evidenceIsReadable` (`:134-173`) resolves,
rejects non-regular files, bounds size, and **opens** every citation, discarding
the whole file on failure, pinned by `readinessFile.test.ts:65/81/92`. The
allow-list claim conflated `resolveAllowed` (fixed subdirs, read route) with
`resolveAllowedNamed` (explicit roots + basenames, what tier B actually uses).
The delta would have deleted a tested security control while claiming to record
one. Rewritten to state what ships; the operator was told the premise of their
earlier decision was wrong and re-decided on correct facts.

Five findings were consequences of that root defect and fell with it: codex's
impossible-as-written Tier-B requirement, its repo-detail link conflict, and
opencode's first three.

**The rest, each fixed:**

- Retained scenario "Missing or invalid assurance blocks readiness" said *any*
  `never` blocks, contradicting the new exemption inside the same requirement —
  found by both codex and opencode. Now "any non-exempt result".
- The MODIFIED Tier-B requirement had **dropped** the shared read-primitive
  paragraph — exactly the partial-content pitfall the artifact instructions warn
  about, and it would have silently deleted a guarantee at archive time. Restored,
  and extended to say why the two path policies differ.
- The `validUntil` rationale was factually wrong: it said coverage ages by
  ancestry. `ageDeclaration` (`assemble.ts:194`) returns `null` for `workflow`,
  `spec`, and `coverage` — declared values for those three never age. All three
  decay models are now stated, including that the third is the weakest guarantee
  in tier B, and it is flagged rather than justified.
- "A check leaves the advisory set by gaining a derived signal" was untrue of a
  hard-coded constant. An invariant test pinning the set against the derivers is
  now required by the spec and is task 2.6.
- No scenario pinned a declared `fail` on the advisory check — the most
  adversarially interesting case, and the tier-B vocabulary explicitly permits it.
  Added, plus task 2.5.
- The fleet disclosure scenario was vacuous: the row already renders six cells
  beside the verdict, so it would have passed without anything changing. Now
  requires explicit wording carried by the verdict and available to assistive
  technology, on the ground that adjacency is not disclosure.
- "A property of the check, not a condition on its identifier" promised a
  structure a `CheckId[]` does not deliver. Language now matches the mechanism.

One finding is recorded as **out of scope rather than rejected**: narrowing the
readiness-file blast radius so one bad citation invalidates only its own entry
instead of all six. It is probably right and it is a behaviour change, not a
documentation gap. In `design.md` Open Questions.

Gemini's APPROVE is not evidence the plan was sound — it reviewed the same draft
that contained the root defect and endorsed D-3's reasoning explicitly.

Round 1 preserved verbatim at `REVIEWS-round-1.md`.

### 1.5 Round-2 triage record

Re-run after the round-1 fixes, because those fixes were substantial enough to
deserve the scrutiny that caught the original defect. **All three reviewers
returned REQUEST-CHANGES, and most of what they found were defects introduced by
the round-1 fixes.** 12 findings, 12 accepted, 0 rejected.

**The serious one — a repo could get greener by breaking its own evidence file.**
codex's cross-property finding. An unusable readiness file discards every
declaration and falls back to derived; the advisory exemption then excuses the
resulting derived `never`; so a repo whose declared `pen-test: fail` was discarded
along with its unreadable file could report **ready**. Readiness would improve
because evidence became unreadable. This interaction did not exist before this
change created the exemption, and it would have shipped. The predicate now
suspends the exemption while a notice reports the file unusable, with a scenario.

**Contradictions I introduced in round 1:**

- "A rescan SHALL NOT observe a value computed before it was requested"
  contradicted the retained rescan-vs-rescan coalescing two paragraphs above.
  Found by codex and opencode independently, and verified against
  `service.ts:241` (`if (pending && (!force || pending.force))`) — two rescans do
  coalesce, so a later one does observe earlier work. The rule is now scoped by
  what a joined computation was permitted to do rather than by arrival time, with
  a scenario for each direction.
- The proposal claimed a declared `never` blocks "on any check", but the tier-B
  schema forbids declared `pen-test: never`. gemini and codex both caught it. The
  answer is that the assertion is expressible as `fail`; the proposal now says so,
  because otherwise the advisory rule reads as removing an owner's ability to fail
  their own repo.
- The Capabilities summary still described evidence paths as "unverified",
  contradicting the normative text I had just rewritten.

**opencode's requirement-text findings, all accepted:**

- The retained "wholly not-applicable repo" scenario is unreachable — `pen-test`
  can never be `na` (derived it is a constant `never`; declared `na` is
  schema-invalid per this same delta). Rewritten to the reachable boundary the
  exemption actually creates: every derivable check `na` plus the exempt `never`.
- No scenario pinned that an evaluation error on an advisory check still blocks.
  Added, and the requirement now states four limits rather than three.
- The presentation requirements said "that check", singular, while D-1 designs the
  advisory set to grow. Both surfaces now derive the wording from the set.
- The unservable-citation rule had no stated mechanism, and opencode reasoned the
  client would have to duplicate the daemon's allow-list. **Checked: it does not.**
  `ALLOWED_SUBDIRS` and `isReadableProjectPath` already live in
  `packages/shared/src/schemas/read.ts`, which the SPA depends on, so no wire field
  and no drift guard are needed. *(Corrected in round 3: I wrote here that the
  client "evaluates the same predicate the route applies", which is wrong — it is a
  conservative path-only mirror. See 1.6.)*
- Citations may name sensitive repo files (`.env`); contents are discarded and
  only the path is surfaced. One sentence, now stated.

**codex's symlink finding, accepted as a bounded disclosure.** Evidence validation
does `realpath`, `stat`, and `open` as separate calls with no `O_NOFOLLOW`, so the
inherited word "contained" overstates atomicity. I restored that paragraph in
round 1, so the overstatement is mine to carry. The spec now bounds the claim; the
fix belongs with the shared read primitive and is in Open Questions.

**gemini's two framing findings, accepted.** The whole-file blast radius is now
recorded as a known weakness rather than justified design — its own finding plus
codex's greener-repo interaction make that the honest framing. And Open Questions
now names a recommended direction for the timeless declarations (ancestry, as the
review checks do) rather than only documenting the gap.

**Not accepted as scope, recorded:** gemini's suggestion that a repo be able to
declare `pen-test: never` explicitly. The assertion is already expressible as
`fail`, and widening the declared vocabulary would collide with `never`'s reserved
meaning for that slot — which is the very asymmetry this change documents.
(Round 3 qualified this: the `fail` route is not friction-free — see 1.6.)

Round 2 preserved verbatim at `REVIEWS-round-2.md`.

### 1.6 Round-3 triage record

gemini APPROVE; codex and opencode REQUEST-CHANGES. **8 findings, 8 accepted, 0
rejected.** The pattern from round 2 repeated: the most serious finding was a
defect in the round-2 fix, and again two reviewers reached it independently.

**The blocker — my own greener-repo guard was not implementable as written.**
`computeReady` receives only check results, and when a readiness file is unusable
`assemble.ts` sets `file = null` and every check falls back to a derived value with
`error: null`. An advisory check's result is then byte-identical to the same check
in a repo that has no readiness file at all, so the guard's own first scenario
cannot be satisfied from the predicate's inputs. Worse, `refineReady`
(`readiness.ts:288-292`) independently recomputes `ready` from the results and
rejects a response where they disagree — so even a call-site override would have
been rejected on the way out, and the daemon would have failed outbound validation
on exactly the responses the guard exists to produce.

Verified, then fixed: `notice` is already carried in the same response object as
`ready` and the results (`readiness.ts:280-283`), so the predicate and the outbound
refinement both take it. No new wire field. The spec now states that the results
alone are insufficient input and that *every* recomputation must see the same
inputs, with a scenario; the Impact section is corrected, since an implementer
following its previous text would have built a predicate failing this change's own
first scenario; and task 2.6a-i pins the schema parse, not just the predicate.

**Contradictions carried in from earlier rounds, all fixed:**

- The predicate's opening rule still read "none of its six checks has status …
  `never`" while the same requirement then permitted an advisory `never`. I had
  fixed the scenario in round 2 and left the rule. Now "no non-exempt check".
- My round-2 TOCTOU paragraph contradicted the inherited sentence directly above
  it, which claimed a path that *changes* to an escaping symlink is refused.
  Reconciled: the inherited claim is narrowed to resolution-time containment, and
  the residual window is stated. codex also noted the bound was too generous —
  a raced FIFO or device node can block or carry an open-time side effect even
  though no bytes reach a client, so the exposure is availability, not only
  disclosure. Both now stated.
- The repo-detail requirement mandated linking *every* evidence path while my new
  rule mandated text for unservable ones. The inherited sentence now carries the
  conditional.

**A claim of mine that was wrong, and its consequence:** I told round 2 that the
client "evaluates the same predicate the read route applies". codex disputed it and
is right — `isReadableProjectPath` is a conservative path-only mirror of the same
allow-list, while the route also resolves symlinks and checks existence and mode,
so it may refuse what the mirror admits. The delta now says mirror rather than
same predicate, and adds a scenario that a link failing when followed changes no
status. A useful by-product of checking: `RepoDetailPage.tsx:314` shows the
unservable-citation rendering **already ships**, so that requirement documents
existing behaviour rather than commissioning work — the Impact section said
otherwise and is corrected.

**opencode on the `fail` escape hatch, accepted.** `PenTestDeclarationSchema`
requires `evidence`, `commit`, and `validUntil` for *any* declared status, `fail`
included. So "just declare `fail`" obliges an author to cite a real openable
artifact — or the whole file is invalidated — for an event that by assertion never
happened. Defensible for a failed pen test, which has a report; awkward for an
author who wants to say none was performed. Recorded as a cost in the requirement
rather than presented as clean, and not relaxed here: relaxing it means either an
optional-evidence entry variant or restoring `never` to the declared vocabulary,
and both change what tier B asks of an author.

**Two minors, both taken.** The shipped origin check passes a request with no
`Origin` header, which the delta never stated — a reader could have inferred
403-on-missing-origin; now a scenario. And the multi-member disclosure scenario is
unreachable while the advisory set has one member, so it is marked forward-pinning
rather than left to look untestable.

Round 3 preserved verbatim at `REVIEWS-round-3.md`.

### 1.7 Round-4 triage record

**gemini APPROVE, opencode APPROVE, codex REQUEST-CHANGES. 7 findings, 7
accepted.** opencode flipped after verifying the round-3 fix against the code —
confirming both summary and detail results carry `id` and `source`, and that
`notice` is a sibling of `ready`/`checks`, so the widened predicate is implementable
with no wire change. Per-round counts: 13 → 12 → 8 → 7, and for the first time no
finding was a regression introduced by the previous round's fixes.

**The new cross-property finding — one repo can withhold the whole fleet.** codex
reasoned from the TOCTOU window I documented in round 3: a substituted FIFO or
device node makes the validating `open` block indefinitely, and `readFleet`
(`service.ts:345`) awaits `Promise.allSettled` across every registered repo with no
per-repo time bound. Verified: `allSettled` converts a rejection into an
unscannable result, but a promise that never settles is never converted — it just
never resolves. So the endpoints requirement's "a failure for one repo MUST NOT
remove other repos" does not cover a hang, and my round-3 text calling the residual
exposure "bounded" was wrong. The delta now scopes per-repo degradation to failure
rather than blocking, and says plainly that the fleet does not answer at all in
that case. Not fixed here — a bounded open belongs to the shared read primitive —
and it is now named in `design.md` as the strongest candidate for the next change.

**The `fail` workaround was worse than friction, and is withdrawn.** codex and
gemini pressed this across three rounds and were right: `fail` asserts that a test
ran and did not pass, and requires evidence, commit, and expiry. Telling an author
with no pen test to declare `fail` asks them to cite an artifact for an event that
did not occur. Round 3 recorded this as "not friction-free"; that still implied the
assertion was available. The delta now states the gap directly — an untested repo
leaves the slot undeclared, and under the advisory rule that does not block — and
names the two ways to close it without choosing between them. The proposal's
matching bullet is rewritten.

**Two contradictions of my own, fixed:**

- The evidence-disclosure paragraph said cited contents never reach clients and
  only paths are surfaced. That is true of tier-B validation and false of the
  surface: an allow-listed citation renders as a link and following it serves the
  file. Now stated as two distinct exposures, because conflating them understated
  one.
- `design.md` D-1's pseudocode still showed the round-2 formula without the
  unusable-file guard, contradicting the normative requirement and depicting the
  exact flaw the guard exists to prevent. Updated.

**The deriver invariant is now structural.** codex and opencode independently
observed that invoking a deriver and asserting `never` cannot establish that it
never returns anything else — a conditional branch satisfies any finite number of
calls. The requirement now demands the constraint live in the deriver's declared
return, with a behavioural test permitted alongside but not in place of it. Task
2.6 rewritten.

**opencode's fleet-summary scenario, taken.** The generic "every recomputation"
scenario covers both shapes, but the watermark's most visible surface is the fleet
row; there is now a scenario and a task naming the summary path explicitly.

## 2. The predicate

- [ ] 2.1 RED: `computeReady` — five derived `ok` plus a derived `never` on `pen-test` is ready
- [ ] 2.2 RED: `computeReady` — a derived `never` on `coverage` still blocks. This is the test that fails under a provenance-only rule, so confirm it fails for that reason and not because the fixture is malformed
- [ ] 2.3 RED: `computeReady` — a declared `never` on `workflow`, `spec`, or `coverage` still blocks
- [ ] 2.4 RED: `computeReady` — a declared `pen-test` aged to `stale` still blocks
- [ ] 2.5 RED: `computeReady` — a declared `pen-test` of `fail` still blocks
- [ ] 2.6 The advisory-set invariant, **structural not behavioural**: constrain a member's deriver so `never` is the only status its declared return admits, and let that declaration be the guard. Round 4 established that invoking a deriver and asserting `never` proves nothing about a branch not taken — a behavioural test may accompany it but must not stand in for it
- [ ] 2.6a RED: **the greener-repo guard** — a repo with an unusable readiness file and five derived `ok` is NOT ready. Write this one before 2.7; it is the finding that would have shipped, and a test written after the implementation will pass whatever the implementation does
- [ ] 2.6a-i RED: `refineReady` accepts that same response. Round 3 established the guard is not expressible from the results alone — pass the notice into **both** `computeReady` and `refineReady`, or outbound validation rejects exactly the responses the guard produces. Assert on the schema parse, not only on the predicate, or this passes while the daemon 500s
- [ ] 2.6a-ii RED: the same, through the **fleet summary** shape and not only the repo detail. Both go through `refineReady`; the fleet row is where the verdict is actually read
- [ ] 2.6b RED: an advisory check carrying an evaluation error still blocks
- [ ] 2.6c RED: every derivable check `na` plus the exempt derived `never` is not ready — the boundary the exemption creates, replacing the unreachable all-six-`na` case
- [ ] 2.7 GREEN: export `ADVISORY_WHEN_UNDECLARED` from shared and implement the rule; widen the parameter to carry `id` and `source`
- [ ] 2.8 Rebuild shared (`pnpm --filter @agenticapps/dashboard-shared build`) before running agent tests — the agent runs shared's built dist, and a stale dist reads as a logic failure
- [ ] 2.9 Confirm no call site changed: both already pass whole `CheckResult` objects

## 3. The surfaces

- [ ] 3.1 RED: fleet row — a ready repo with an undeclared advisory check carries wording on the verdict naming what it excludes, derived from the set rather than hardcoded to one name
- [ ] 3.2 RED: repo detail header — same, and the wording is exposed to assistive technology as part of the verdict, not by adjacency
- [ ] 3.3 RED: the advisory check's block still carries its never-run instruction while the repo is ready
- [ ] 3.4 GREEN: implement both surfaces
- [ ] 3.5 Boot the dev server and screenshot the fleet at 1440×900 in both appearances — a ready row next to an undeclared advisory check is a two-symbol state that has never rendered before, and its legibility is the thing the requirement exists to protect

## 4. Rescan contract and read isolation

- [ ] 4.1 RED: rescan returns 200 carrying the same detail shape as `GET /repos/:id`
- [ ] 4.2 RED: rescan overlapping an in-flight read recomputes rather than joining it. Drive it through the real coalescing path, not a mocked one — the PR #90 defect was invisible to every mock-level test in place at the time
- [ ] 4.2a RED: rescan overlapping an in-flight **rescan** does share that computation. The complement of 4.2, and the pair is what stops a future change "fixing" one into a regression of the other
- [ ] 4.3 RED: rescan answers 404 for an unknown id and 403 for a disallowed origin, neither carrying a detail body
- [ ] 4.4 GREEN where a test fails. Where the shipped code is already correct, record that the test pins existing behaviour rather than driving new behaviour, and mutation-check it: break the property deliberately, confirm the test fails, revert

## 5. Evidence citations are verified

The delta here **describes shipped behaviour**; `evidenceIsReadable` is not being
modified. Expect every test in this section to pin rather than drive, and
mutation-check each one — a test that passes against unchanged code is worthless
until you have seen it fail.

- [ ] 5.1 Confirm the existing coverage at `readinessFile.test.ts:65/81/92` (absent, directory, symlink escape) and note which delta scenario each pins
- [ ] 5.2 Add whatever of the delta's citation scenarios is not already covered — oversized citation, and a path that stats but cannot be opened
- [ ] 5.3 RED: a repo whose file is invalidated by one bad citation falls back to derived on **all six** checks, not just the citing one. This is the blast radius the delta states; it is also the behaviour flagged in `design.md` Open Questions, so pin it as-is and do not narrow it here
- [ ] 5.4 Mutation-check 5.1–5.3: remove the `open` call, and separately the `isFile` check, and confirm the right tests fail
- [ ] 5.5 RED/GREEN: repo detail renders a citation outside the read route's allow-list as text rather than a link

## 6. Fixture and assertion churn

- [ ] 6.1 Find every test and fixture asserting `ready: false` and classify each: flips to `true` (and why), or stays `false` (and why)
- [ ] 6.2 Update the flipping ones. Any assertion that flips for a reason not on the 6.1 list is a signal the rule is wrong, not that the fixture is stale
- [ ] 6.3 `pnpm --filter @agenticapps/dashboard-shared test`, `--filter @agenticapps/dashboard-agent test`, `--filter @agenticapps/dashboard-spa test` — per package, not `pnpm -r test`

## 7. Gates

- [ ] 7.1 `pnpm -r typecheck` clean
- [ ] 7.2 `pnpm lint` — 0 errors, warnings at or below the 207 baseline
- [ ] 7.3 `impeccable:critique` on the fleet and repo-detail routes at 1440×900, composite ≥ 80, artifact committed
- [ ] 7.4 `superpowers:requesting-code-review` in an independent context (Stage 2). `openspec validate` does not discharge it
- [ ] 7.5 Triage that review the same way as 1.3

## 8. Archive, then ship

- [ ] 8.1 Fold the delta into `openspec/specs/repo-readiness/spec.md`; confirm the folded body is diff-identical to the reviewed delta
- [ ] 8.2 `openspec archive close-readiness-spec-gaps -y`, then `openspec validate --all` still green
- [ ] 8.3 `superpowers:finishing-a-development-branch` for the PR. Disclose the verdict change in the PR body: rows that read "Not ready" since 2026-08-02 will begin reading "Ready", and that is the change working

## Out of scope

- [ ] Do NOT reopen codex's "the Tier-B schema is not specified" — reviewed and not accepted on 2026-08-02
- [ ] Do NOT reopen gemini's submodule case or the `workflow` fail/warn polarity argument — product judgements taken deliberately
- [ ] Do NOT widen `ALLOWED_SUBDIRS` or add any filesystem read
- [ ] Do NOT add, remove, or rename a wire field
- [ ] Do NOT give `pen-test` a derived signal — noted as an open question in `design.md`, not work for this change
- [ ] Do NOT introduce an aggregate score or replace the boolean verdict
