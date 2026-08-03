**TDD throughout.** Every test is proved to fail before its implementation
exists. Two fixtures last session passed while asserting nothing; reverting the
implementation to confirm RED is the check that catches that, and it is not
optional here.

**This change does not depend on `retire-v1-surfaces`.** It stands alone on the
current SPA alongside the v1 surfaces, and unblocks that change rather than
waiting for it.

## 1. Shared contract

- [ ] 1.1 Read upstream `agents-task-viewer` `src/openspec/types.ts`, `reader.ts`, `tracker.ts` **and ADR 0008** in full before writing the schema; record any field deliberately not carried. ADR 0004 is history — two rounds of this change argued from its prose against a classifier that had moved on
- [ ] 1.2 Write failing schema tests for the change card: required fields, the four stage values, the three source values, and rejection of an unknown stage — `ship` is not a stage and must be rejected
- [ ] 1.3 Add `packages/shared/src/schemas/changes.ts` — card and fleet-response zod schemas — and export from the barrel
- [ ] 1.4 Rebuild shared (`pnpm --filter @agenticapps/dashboard-shared build`) before running agent tests — the agent runs shared's built dist, and a clean typecheck with a runtime ZodError means a stale build

## 2. Stage classifier — pure, no I/O

- [ ] 2.1 Mirror upstream's `src/openspec/__fixtures__` into the agent test tree, recording provenance and the commit they were taken from
- [ ] 2.2 Write one failing test per ordered rule 1–5, plus a backlog entry classifying as `propose`
- [ ] 2.3 Write the failing veto test **against the real `retire-v1-surfaces/REVIEWS.md` shape** — two approvals from distinct reviewers plus two requests-for-changes from two *other* distinct reviewers classifies `validate`, not `execute`. This is the case that refuted the first draft of the rule; it is the one test that must exist
- [ ] 2.4 Write the failing tests for the rest of the reviewer rule: a reviewer whose rejection is followed by an approval in a later round no longer vetoes; unparseable verdicts count as absent and classify `validate`; a vendor approving twice counts once
- [ ] 2.5 Write the failing parse-grammar tests mirroring upstream's `parseReviewEvidence`: `## Reviewer: <vendor>` section bounds, `VERDICT: APPROVE|REQUEST-CHANGES` matched case-insensitively, vendor dedup on the lowercased name
- [ ] 2.6 Write the failing staleness test: a change directory holding `REVIEWS.md` plus `REVIEWS-round-1..3.md` classifies from round 3, and the card records multi-round evidence. `archive/2026-08-02-close-readiness-spec-gaps/` is the real fixture — copy it, do not invent one
- [ ] 2.7 Write the failing test that `design.md` presence never changes a stage
- [ ] 2.8 Write the failing test that both archive readings are distinguishable — a rule-1 card carries source `archive`, a rule-5 card carries source `active` with `ready`
- [ ] 2.9 **Conformance, not just agreement**: run upstream's mirrored fixtures through both `classifyActiveChange` (copied verbatim into the test as the oracle) and `stage.ts`, and assert identical stages for every fixture. This is the check that would have caught the phantom divergence
- [ ] 2.10 Implement `packages/agent/src/lib/changes/stage.ts` to green, citing `reader.ts` and ADR 0008 as the origin — **not ADR 0004** — and naming the one divergence in the module docblock: the absence of `ship`
- [ ] 2.11 Revert `stage.ts` and confirm every test in 2.2–2.9 goes RED, then restore

## 3. Repository reader

- [ ] 3.1 Write failing tests over temp directories: active changes, dated archive entries, unresolved `BACKLOG.md` entries, artifact presence, checklist rows, reviewer verdicts
- [ ] 3.2 Write the failing test that a repository with no `openspec/` yields no cards and is not reported as an error
- [ ] 3.3 Write failing tests for malformed input: an unparseable change directory and an unparseable backlog entry are skipped and counted, never fatal
- [ ] 3.4 Write the failing test that `openspec/changes/archive/` produces no card of its own, and that a non-change entry (a README, a directory holding none of the three artifacts) produces none either — this repo's own tree is the fixture
- [ ] 3.5 Write the failing tests for the backlog rule **against this repo's own `openspec/BACKLOG.md`** — of its three level-two headings, `## Human verification backlog` (body opens `**Status: ✅ RETIRED …**`) and `## Known stale artifact — ✅ RESOLVED 2026-07-26` must produce no card, and the third must. The first rule written for this shipped two of three wrong; a fixture that is not this file does not prove the rule
- [ ] 3.6 Write the failing tests for the malformed/absent split: an absent `BACKLOG.md`, an empty one, and a directory holding none of the three artifacts are silent; an unreadable file, an oversized file, and an `archive/` entry failing the date or artifact test are reported as skipped. Assert no input satisfies both
- [ ] 3.7 Write the failing identity tests: two dated archives of one slug are two cards; two identical backlog headings are two cards; a backlog entry and an active change of one name are two cards
- [ ] 3.8 Implement `packages/agent/src/lib/changes/changeReader.ts` to green
- [ ] 3.9 Confirm every path read passes `isReadableProjectPath`; add a test asserting it for the archive and backlog paths specifically
- [ ] 3.10 Add realpath containment on top of the lexical guard — resolve each path, confirm it lies under the registered project root, and read regular files only. Write the failing test first: a symlink under `openspec/` resolving outside the root yields no card and is reported skipped. `isReadableProjectPath` is lexical by its own docblock and does not cover this; `coverageResolver` and `conformanceScan` are the precedent to match
- [ ] 3.11 Add the pre-read size cap as a named constant, checked by `stat` before the read, with the oversized file skipped and reported. This was required by round-1 review alongside realpath and regular-file checks and was the one of the three silently dropped — round 2 caught the omission

## 4. Fleet service and route

- [ ] 4.1 Write the failing degradation test: one repository throws, the rest still render, and the thrower is named with a reason
- [ ] 4.2 Write the failing test that all-repositories-failed is distinguishable from no-open-changes
- [ ] 4.3 Implement `packages/agent/src/lib/changes/service.ts` using `withinBound` + `Promise.allSettled`, one bound — document why the readiness signature pre-pass is not copied
- [ ] 4.4 Cache the fleet aggregate server-side with explicit invalidation, per `daemon-runtime` → `Response Caching Cadences` ("derived fleet aggregates on their own cadence"). Write the failing tests first: a second request inside the cadence does not re-walk the repositories, and an invalidating action makes the next read reflect new state without waiting for expiry. **No delta is needed — that requirement already binds this endpoint; the change was non-compliant with it**
- [ ] 4.5 Write the failing route contract test for `GET /api/v2/changes/fleet` — 200 shape, degraded notice, auth required
- [ ] 4.6 Implement `packages/agent/src/routes/changes.ts` and register it
- [ ] 4.7 Measure the endpoint against the real registry and record the figure; if the archive walk dominates, record it rather than silently narrowing scope
- [ ] 4.8 Assert in test that the board spawns no process at all: `GIT_ALLOWED_CMDS` is unchanged and no new spawn site exists

## 5. Board surface

- [ ] 5.1 Write failing SPA tests: four columns at the reference viewport, header `Label · N`, `No changes` for an empty stage
- [ ] 5.2 Write the failing test that the board pages one stage at a time behind a stage rail below the 180px minimum column width, with every stage reachable
- [ ] 5.3 Write the failing test that a long change name renders across two lines rather than eliding at one
- [ ] 5.4 Write failing tests for the degraded and unreachable states, asserting a degraded read does not present as an ordinary empty board
- [ ] 5.5 Write the failing test that the Archive column distinguishes a filed archive card from an active card marked `ready`
- [ ] 5.6 Write the failing tests for the archive bound: a repository past the bound renders the most recently dated cards and states how many it withheld; one under the bound renders all and withholds nothing; ordering is date-descending with a name tie-break
- [ ] 5.7 Implement `ChangeBoardPage`, `StageColumn` and `ChangeCard` to green; the card must not assume a fixed row count, so the session row is additive later
- [ ] 5.8 Add the `/changes` route and one `Changes` sidebar entry in the product-content group

## 6. Drawer

- [ ] 6.1 Write failing tests: selecting a card opens a drawer over the board carrying repository, stage, source, artifact presence, reviewer verdicts and checklist rows
- [ ] 6.2 Write the failing test that the location carries repository, source and change as three separate parameters, and that no composite separator is parsed
- [ ] 6.3 Write the failing test that a backlog entry and an active change of the same name in one repository are two cards with two distinct addresses
- [ ] 6.4 Write the failing tests that a deep link restores the drawer, and that a deep link to an absent change renders the board with a not-found statement
- [ ] 6.5 Implement `ChangeDrawer` to green

## 7. Verify

- [ ] 7.1 `pnpm --filter @agenticapps/dashboard-shared test`, `pnpm --filter @agenticapps/dashboard-agent test`, and the SPA suite green — run per package, not `pnpm -r test`
- [ ] 7.2 `pnpm -r typecheck` clean and `pnpm lint` with zero errors
- [ ] 7.3 `impeccable:critique` at 1440×900 against `/changes`, composite ≥ 80, artifact committed
- [ ] 7.4 Verify the board against a live daemon and the real registry — not only against mocked responses, which have disagreed with the daemon's actual status codes before
- [ ] 7.5 `openspec validate --all` green
- [ ] 7.6 Two other-vendor plan reviews recorded in `REVIEWS.md`; findings verified against the code before being acted on, and refutations argued with the check rather than the opinion. **The first round is done and its disposition is §9** — re-run after these revisions, because the reviewed artifacts have changed materially
- [ ] 7.7 Two-stage review before merge

## 8. Hand back to `retire-v1-surfaces`

These are corrections to that change, made while it is still open. They are
listed here because this change is what makes them necessary, and they are cheap
now and a separate change once its delta is folded.

- [ ] 8.1 Correct its `project-dashboard` delta: archived-change ordering is no longer droppable, because this board renders archived changes in date order
- [ ] 8.2 Resolve the kanban question in its `design-system` delta — scope `Dense Rows And Aligned Figures` to list and table surfaces, or grant this board a stated exception
- [ ] 8.3 Append a dated note to `openspec/CAPABILITY-MAP.md` recording that the agent-board prerequisite is discharged — append only, never edit the ratified table

## 9. Plan-review disposition — round 1 (2026-08-03)

gemini REQUEST-CHANGES (4), codex REQUEST-CHANGES (6), opencode
REQUEST-CHANGES (7). Every finding was verified against the code before being
acted on; the refutations are argued with the check, not the opinion.

**Fixed — the two that falsified the change's own claims:**

- [x] 9.1 The reviewer rule did not do what all three artifacts said it did. Latest-verdict filtering leaves `retire-v1-surfaces` in Execute because its four verdicts are from four *distinct* reviewers. Replaced by a veto: two approvals **and** no standing rejection. Found independently by codex and opencode
- [x] 9.2 The ship probe is not implementable at the bounded-git site — fixed argv, no ref, no pathspec — and a project-tree string in an argument vector is what `filesystem-access-policy` forbids at spawn site 3. `git log` is also the wrong probe (history, not containment). `ship` dropped to its own change; the board now spawns nothing. Found by opencode, sharpened by codex

**Fixed — the rest of the confirmed set:**

- [x] 9.3 "Five weeks" was six days (opencode)
- [x] 9.4 `archive/` is itself a directory under `openspec/changes/` and classified as a bogus Propose card; now excluded, with non-change entries (opencode)
- [x] 9.5 "Unresolved level-two entry" was undefined; now specified (gemini, opencode)
- [x] 9.6 Decision 2 asserted a project posture that gate 2.0.0 contradicts; the divergence is now stated as deliberately stricter than the gate, with its cost (opencode)
- [x] 9.7 Rules 2 and 6 both yielded `archive` with different meanings; now distinguished by source plus the `ready` marker, with a scenario (opencode)
- [x] 9.8 "A Change Name Is **Never** Silently Truncated" was contradicted by its own body; retitled (opencode)
- [x] 9.9 `(repo, change)` does not identify a card; identity and address are now the triple with `source` (codex, opencode)
- [x] 9.10 The lexical guard does not cover symlink escape; realpath containment and a regular-file check added, matching `coverageResolver` (codex, weakened from its original form)
- [x] 9.11 `archive (ready)` was an undocumented second divergence from ADR 0004; both divergences are now named (gemini)

**Refuted, with the check:**

- [x] 9.12 gemini: `../` in a change name traverses out. `isReadableProjectPath` (`packages/shared/src/schemas/read.ts:38`) rejects `.` and `..` segments, absolute paths, `~`, and drive letters
- [x] 9.13 opencode: the new route needs its own auth scenario. `auth-and-pairing` already carries "Bearer Token On Every Route" — "no anonymous access to any route"
- [x] 9.14 opencode: "latest verdict" ordering is undefined and load-bearing. Checked all twelve `REVIEWS.md` in the repo: none repeats a reviewer, because the producer rewrites the file per run. The invariant is specified instead of an ordering discipline
- [x] 9.15 gemini: the ship probe will not scale to thousands of archived changes. True of the original design and now moot — the probe is gone
- [x] 9.16 codex: "no fifth spawn site" is misleading. Half-refuted: the claim is sound because `integrations.ts` and `linear.ts` already call `runAllowedGit` outside the git route, so the function is the site by practice. The argv objection stands and is 9.2

**Carried, not fixed:**

- [ ] 9.17 codex: request coalescing, caching and corpus-size bounds beyond the single wall-clock bound. The bound-the-wait limitation is inherited knowingly from `readiness/service.ts` and is recorded in design decision 4; fixing it belongs to the shared read primitive, not to this board
- [ ] 9.18 codex: data minimisation for backlog titles, reviewer identities and task prose crossing the wire, and URL/referrer exposure of change names. The daemon is localhost-bound and already returns change names on existing routes, so this is not new exposure — but no requirement states the error-shape rule, and `repo-readiness` learned that lesson the hard way. Worth its own look before implementation

## 10. Plan-review disposition — round 2 (2026-08-03)

gemini, codex and opencode all REQUEST-CHANGES again, on almost entirely new
ground — round 1's findings were not re-raised. Two findings falsified claims
the round-1 revision had introduced, and both were verified against source
before being accepted.

**Fixed — the two that falsified round 1's own work:**

- [x] 10.1 **The reviewer divergence does not exist.** codex: the ADR 0004
      comparison is stale. Verified in
      `agents-task-viewer/src/openspec/reader.ts` — `classifyActiveChange`
      already returns `validate` on `hasRequestChanges`. Two rounds argued for a
      divergence from a rule the upstream implementation had already abandoned;
      ADR 0008 exists, is dated the same day as the change this design cites
      throughout, and had never been opened. The rule is unchanged in effect;
      its origin, framing and justification are rewritten. The parse grammar is
      now mirrored from upstream's `parseReviewEvidence` rather than invented,
      which also answers opencode 10.6
- [x] 10.2 **The "producer rewrites wholesale" invariant is false.** opencode:
      `archive/2026-08-02-close-readiness-spec-gaps/` holds `REVIEWS-round-1..3.md`
      beside a stale `REVIEWS.md`. The round-1 census that established the
      invariant ran `-name REVIEWS.md`, which structurally excluded the only
      counter-evidence in the repo. With a rejection now vetoing, a stale read
      strands a change whose rejection was cleared. Replaced by explicit
      staleness handling: classify from the highest-numbered round record and
      mark the card

**Fixed — the rest of the confirmed set:**

- [x] 10.3 The backlog rule failed on this repository's own `BACKLOG.md`: two of
      its three level-two headings are resolved via `**Status: ✅ RETIRED**` and
      an in-heading `✅ RESOLVED`, neither a checkbox nor strikethrough. Rule
      rewritten against that file, which is now the required fixture (codex,
      with opencode's over-collection point)
- [x] 10.4 The pre-read size cap required by round-1 review was silently dropped
      while its two companion checks were implemented. Restored as a named
      constant, checked before the read (opencode)
- [x] 10.5 The Archive column was unbounded — archives grow monotonically, so a
      mature repo rendered every change it ever archived. Bounded, ordered
      date-descending, with the withheld count stated (opencode, with codex's
      missing-ordering point)
- [x] 10.6 The verdict grammar, checklist-row syntax and archive-name validity
      were unspecified while stage classification hinged on them. Specified,
      mirroring upstream (opencode)
- [x] 10.7 "Not reported as malformed" (requirement 1) contradicted "cannot be
      parsed → reported" (requirement 5); an EACCES `proposal.md` satisfied both.
      Split explicitly: absent is silent, present-but-unreadable is reported
      (opencode)
- [x] 10.8 `(repo, source, name)` still collided for two dated archives of one
      slug and for duplicate backlog headings. Identity is now the entry's
      on-disk name — dated basename, or heading text plus index (codex, opencode)
- [x] 10.9 Corpus semantics were inconsistent: a design-only active directory was
      hidden while an empty dated archive directory became a card. The artifact
      test now applies to both, and a failing archive entry is reported rather
      than dropped (codex, with gemini's silent-malformed-archive point)

**Accepted as upstream's behaviour, not fixed:**

- [x] 10.10 gemini: a change with zero checklist rows is stuck at `validate`
      forever, which mishandles a purely declarative change. True, and it is
      upstream's rule (`checklist.length === 0`). Diverging would buy one
      better-classified card at the cost of the two boards disagreeing — the
      thing this change exists to avoid. Recorded as a stated consequence
- [x] 10.11 gemini: the board should not enforce a policy stricter than the
      ratified gate. Moot as of 10.1 — there is no stricter policy, and a board
      that displays a stage enforces nothing
- [x] 10.12 gemini: "Ready to Archive" should be its own column rather than
      sharing Archive. A fifth column contradicts the four-column layout just
      settled, and upstream shares the column too, distinguishing by a textual
      `ready`/`archived` state. Matching upstream wins; the `ready` marker and
      the source field already carry the distinction

**Carried, not fixed:**

- [x] 10.13 codex: caching, citing `daemon-runtime`. **Checked, and the citation
      holds.** `Response Caching Cadences` requires the daemon to cache expensive
      computations server-side, naming "derived fleet aggregates on their own
      cadence", with explicit invalidation. This board's endpoint is by its own
      design note the most expensive read the daemon performs. So the durable
      spec already binds it and needs no delta — the change was simply
      non-compliant with a requirement that already existed, the same shape as
      the sanitiser change's fleet-degradation gap. Now task 4.4. In-flight
      coalescing and aggregate-size bounds stay carried below
- [ ] 10.14 codex: disclosure rules for degradation reasons and drawer payloads —
      symbolic error codes, no absolute paths or usernames, plain-text rendering
      of author-controlled names. Carried from 9.18. `repo-readiness` shipped a
      leak of exactly this shape, so this is the one carried item with a
      demonstrated failure mode behind it
- [ ] 10.15 opencode: the "twelve files" census is self-referential and the count
      will drift. Moot for the spec text, which no longer cites a count — but the
      lesson is recorded rather than dropped

## Out of scope

- [ ] Do NOT render live agent-session counts, and do NOT add the host adapters
- [ ] Do NOT modify `agents-task-viewer`
- [ ] Do NOT build a `ship` stage or any git probe — deferred to its own change
- [ ] Do NOT widen `GIT_ALLOWED_CMDS` or add a fifth process-spawn site
- [ ] Do NOT extend `openspecReader.ts` — the board reads independently by design
- [ ] Do NOT run the `retire-v1-surfaces` cutover
