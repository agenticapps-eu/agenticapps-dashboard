## 1. Baseline before changing anything

- [x] 1.1 Characterisation tests that pass on `main` unmodified, covering each
  shape on **both** resolvers: an admitted path and a refused path for
  `resolveAllowedNamed` and for `PathResolver`. Include a `PathResolver` case
  that is admitted **only** by the family roots — that is the admission D2's
  first draft would have destroyed, and nothing currently pins it.
  → `packages/agent/src/lib/containmentAdmission.characterisation.test.ts`,
  9 tests, green on unmodified `main`.
- [x] 1.2 Include the `<real>/missing/..` root case from D2 as a
  characterisation test. It is admitted today via the lexical fallback; after
  this change it must still be admitted, because nothing moves to the anchored
  branch.
- [x] 1.3 **Prove the two critical tests can fail.** Both were mutated to the
  draft's design (`anchorTo` added to the call) and both went RED; reverting
  restored green. Without this step 1.2 would have shipped asserting nothing —
  see §5.

## 2. Enumerate before migrating

- [ ] 2.1 Re-confirm the corrected inventory on current `main`: 12
  `resolveAllowedNamed(` call sites, 12 `PathResolver` invocations with `roots:`,
  6 anchored (2 + 4). Record drift.
- [ ] 2.4 Verify D6's premise that no call today passes a heterogeneous `roots`
  array. If one exists, it is split before step 3 begins, not during.
- [ ] 2.5 Enumerate the helpers that relay a `PathResolver` (`readSkillVersions`
  is known; `resolveFile` and the `*.declare.ts` signatures are candidates) and
  confirm which serve more than one classification.

## 3. Implement in three commits, each of which builds (D3)

- [ ] 3.1 **Commit 1 — add.** Introduce the `containment` union alongside
  `anchorTo`, optional, on `ResolveAllowedNamedOpts` and `PathResolver`.
  `anchored` routes to the existing anchored branch; `repository-root` and
  `daemon-named` route to the existing **unanchored** branch byte-for-byte.
  Nothing changes; §1 tests stay green untouched.
- [ ] 3.2 **Commit 2 — migrate**, in three reviewable slices: the 6 `anchored`
  sites; the `repository-root` sites; the `daemon-named` sites with reasons
  drawn from D8's evidence (33 of 98, 13 of 14), one per machine root across all
  five (`agenticapps-bin`, `claude-skills`, `codex-skills`, `opencode-skills`,
  `pi-skills`). Thread `containment` through the relaying helpers found in 2.5
  as a parameter — helpers SHALL NOT synthesise one (D8).
- [ ] 3.3 **Commit 3 — require.** Delete `anchorTo`; make `containment`
  required. Capture the complete compiler-error list from the moment before the
  final site is migrated — that list is the authoritative enumeration (D3.3).
- [ ] 3.4 Diff the compiler's enumeration against §2.1's table. Record the result
  in §5 **either way**: this document's grep has produced two wrong tables
  already, so a corroboration is a result and a discrepancy is the finding.

## 4. Tests

- [ ] 4.1 RED first: a caller supplying roots without a `containment` declaration
  fails to compile. Prove it fails before the field is required.
- [ ] 4.2 **Regression guard on #100 (D5).** The six derived boundaries are
  `anchored`, and relabelling any of them fails. This is the enforceable half of
  the misdeclaration concern; the unenforceable half is stated in the spec.
- [ ] 4.3 A `daemon-named` site still resolves a machine root that anchoring
  would reject — D8's install-symlink case survives.
- [ ] 4.4 Admission is unchanged: §1's characterisation tests pass **unmodified**
  after commit 3. If any needed editing, admission moved and §5 must say where.
  This replaces the draft's 4.4, whose premise D2 disproved.
- [ ] 4.5 A helper that relays a resolver carries the caller's classification
  rather than choosing one (D8).
- [ ] 4.6 `daemon-named` naming a root that is not the one registered for its
  `rootId` is rejected, and a blank or whitespace `reason` is rejected. The
  escape hatch must be bounded by the type and the check, not by convention.
- [ ] 4.7 Supplying both `anchorTo` and `containment` during the migration
  window raises `PathViolation` rather than silently obeying one.
- [ ] 4.8 A `repository-root` read on `makeCoverageResolver` is still admitted
  under the standing family roots — the reach a declaration does not narrow.
  This is the admission round 2 found the spec misdescribing; pin it.

## 5. Findings recorded during execution

**§1 — `join()` normalised the pathological path away, and the test asserted
nothing.** The `<real>/missing/..` characterisation test was first written as
`roots: [join(root, 'missing', '..')]`. `path.join` normalises internally, so
that argument *is* `root` — a plain resolvable directory. The test passed for
the wrong reason, and would have kept passing under the very design D2 rejects.

It was caught only by the mandatory mutation step (1.3): mutating it to the
draft's design failed to turn it RED, which is the signal that the fixture, not
the code, was wrong. The root is now built by string concatenation, and the test
asserts its own premise — `realpath` rejects, `resolve` returns `root` — before
asserting admission. Both critical tests then went RED under mutation as they
should.

The lesson is narrower than "prove a test can fail": a fixture built with path
helpers may not contain the pathology it names, because those helpers normalise.
Every path-escape fixture in this change is therefore built by concatenation,
not by `join`.

**§1 — two distinct `PathViolation` classes exist** (`paths.ts:34` and
`coverageResolver.ts:26`). An `instanceof` against the wrong one fails while the
value really is a path violation, which reads as a behaviour change but is an
import bug. Noted, not fixed — out of scope here.

<!-- 3.4's enumeration diff goes here. Any site whose classification departs
     from the table is named here with reasoning, never folded into the
     mechanical pass. -->

## 6. Verification

- [ ] 6.1 `pnpm --filter @agenticapps/dashboard-agent test` green, with §1
  unmodified.
- [ ] 6.2 `pnpm -r typecheck` and `pnpm lint` green.
- [ ] 6.3 `openspec validate --all` green.
- [ ] 6.4 No `impeccable:critique` — confirm `git diff --stat` is
  `packages/agent` only before claiming it.

## 7. Review

- [x] 7.1 **Round 1 run** — `run-plan-review.sh` 1.2.0,
  `--implementing-host claude`, `REVIEW_TIMEOUT=540`. Three reviewers counted:
  gemini APPROVE, codex REQUEST-CHANGES, opencode REQUEST-CHANGES. The raised
  timeout worked — opencode landed this time, having been lost at 540s in #100.
- [x] 7.2 **Round 2 run** — same producer and timeout. gemini APPROVE (reversing
  nothing: it had approved round 1 too, and its round-2 notes single out the D2
  reversal and the compiler-as-authority shift as the right lessons). codex
  REQUEST-CHANGES with six findings. opencode produced no verdict line and was
  correctly not counted — a different failure from the timeout that lost it in
  #100, and one the producer's 1.2.0 predicate caught rather than published.
- [ ] 7.3 Preserve prior rounds as `REVIEWS-round-N.md` before re-running.

### Round 2 dispositions

*Confirmed and fixed:*

- **`repository-root` is not an identity on `makeCoverageResolver`** (codex).
  Confirmed at `coverageResolver.ts:191` — the unanchored branch tests against
  `mergedRoots`, which includes the standing family roots. The spec's claim that
  daemon-named was "the only case that widens reach beyond a repository" was
  therefore false. The family roots have now falsified three separate claims in
  this change; the spec states plainly that a declaration names the boundary
  supplied and is not a claim of confinement, and task 4.8 pins the admission.
- **`daemon-named` accepted arbitrary roots** (codex). Real: `{ reason: string }`
  constrains nothing, so any root could skip anchoring given any non-empty
  string. Now carries `rootId: WorkflowMachineRootId` — the enumeration already
  exists at `workflowArtifactScanner.declare.ts:74-79`, and call sites already
  hold the id (`workflowScan.ts:194`). The resolver checks the supplied root
  against the root registered for that id.
- **A blank `reason` satisfied "records why"** (codex). Rejected now, and
  largely subsumed by the above: `reason` became a per-root rationale rather
  than free text.
- **The transitional API accepted `anchorTo` and `containment` together**
  (codex). Now a `PathViolation`, mirroring the existing
  `allowedNames`/`extension` exclusivity. Task 4.7.
- **The reclassification scenario promised more than the test delivers**
  (codex). Scoped to the boundaries the coverage names, plus a scenario putting
  the obligation on newly anchored boundaries to join that coverage.

*Confirmed in part, refuted in part:*

- **"Splitting heterogeneous root arrays is underspecified"** (codex). The
  narrow point is accepted: the delta now states the recombination rule — split
  resolutions recombine as alternatives, admitted if any admits. The
  accompanying claims that a split can *alter root priority* or change *which
  candidate is returned* are refuted by the implementation: both resolvers test
  `mergedRoots.some(...)`, which is order-independent, and both `return real`,
  the candidate's own realpath, which does not depend on the matching root
  (`paths.ts:230,241`; `coverageResolver.ts:191,205`). What does change is the
  caller's error handling — two `PathViolation`s rather than one — which is not
  an admission concern.

### Round 1 dispositions

Every finding was verified against the code before being acted on.

*Confirmed and fixed — behavioural:*

- **D2's "unreachable fallback" argument was false** (codex). Probed directly:
  with `root = <real>/missing/..`, `realpath(root)` throws ENOENT while
  `resolve(root)` normalises to `<real>`, under which the candidate resolves and
  is admitted **today**. The inherited round-1 claim from #100 holds only when
  unresolvability survives lexical normalisation, and `..` is exactly where it
  does not. The claim had been flagged as second-hand in the draft; it was
  wrong.
- **D2 ignored `makeCoverageResolver`'s family roots** (codex). Confirmed at
  `coverageResolver.ts:186` — anchored uses `callerRoots` alone, unanchored
  merges `[...allowedRoots, ...callerRoots]`. Sending `repository-root` down the
  anchored branch would have stripped the cross-family allowance.
- Both dissolve the same way: `repository-root` now maps to the **existing
  unanchored branch**, so no variant changes admission. The change became
  purely declarative, and smaller than the draft described.

*Confirmed and fixed — factual:*

- **The inventory was wrong** (opencode, codex). Worse than charged: the "28"
  counted imports, JSDoc mentions and the definition; 16 were not call sites.
  Real figures are 12 `resolveAllowedNamed` calls and 12 `PathResolver`
  invocations, and the scanner files hold 4 of the 6 anchored sites while
  calling `resolveAllowedNamed` zero times. The error is kept visible in
  design's Context rather than silently corrected, because the document's own
  method (D3.3) is what it violated.
- **Five machine roots, not two** (codex). Confirmed at
  `workflowArtifactScanner.declare.ts:74-79`.
- **The three-commit plan could not build** (opencode). Commit 1 made the field
  required while 18 sites still omitted it. Resequenced add → migrate → require.

*Confirmed and fixed — scope and honesty:*

- **The union enforces presence, not correctness** (opencode, codex). The draft
  conceded this and supplied no mechanism. The spec now says what is actually
  enforced, and task 4.2 pins #100's six sites as the enforceable half.
- **"Every resolution site" overclaimed** (codex). Scope narrowed in the spec
  text to caller-supplied boundaries, excluding `resolveAllowed` and the
  resolver's bound family roots.
- **Per-root heterogeneity was unaddressed** (opencode). Now a stated
  prohibition with a scenario; task 2.4 verifies no such call exists today.
- **The `reason` SHALL outran its scenario** (opencode). The spec no longer
  claims what is not checked.
- **Helper propagation was unaddressed** (codex). Confirmed:
  `readSkillVersions` is called with `[hostRepo]` at :184 and `[machineRoot]` at
  :287. New D8 requires relaying helpers to take the classification as a
  parameter.

*Refuted, with evidence:*

- **"Task 7.1 uses the obsolete plan-review producer and hard-codes Claude as
  implementing host; it does not match the repository's current gate"** (codex).
  The shared producer at `~/.agenticapps/bin/run-plan-review.sh` carries
  `run-plan-review-version: 1.2.0`, the current marked version, and pairs with
  gate 1.6.0. `--implementing-host` has been **required** since 1.1.0 —
  supplying it is migration, not hard-coding — and `claude` is factually the
  implementing host here. The round-1 review itself ran this way and produced a
  valid trailer with a matching digest, which is direct evidence against the
  claim.

*Accepted as non-blocking:*

- **A policy for adding *new* `daemon-named` sites** (gemini, explicitly
  non-blocking). Worth doing and deliberately not done here: a rule that a new
  reason must cite an approved design document is a change to the review
  process, not to this API, and folding it in would put a process rule inside a
  type change. Recorded as the natural follow-on.
- **Test-site classification guidance** (opencode, minor). The ~31 test call
  sites need a variant too, and `repository-root` is the path of least
  resistance. Task 4.2's regression guard is what stops that mattering for the
  six sites that count; a broader convention note belongs with the follow-on
  above.
