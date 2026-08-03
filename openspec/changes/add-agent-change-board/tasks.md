**TDD throughout.** Every test is proved to fail before its implementation
exists. Two fixtures last session passed while asserting nothing; reverting the
implementation to confirm RED is the check that catches that, and it is not
optional here.

**This change does not depend on `retire-v1-surfaces`.** It stands alone on the
current SPA alongside the v1 surfaces, and unblocks that change rather than
waiting for it.

## 1. Shared contract

- [ ] 1.1 Read upstream `agents-task-viewer` `src/openspec/types.ts` and ADR 0004 in full before writing the schema; record any field deliberately not carried
- [ ] 1.2 Write failing schema tests for the change card: required fields, the four stage values, the three source values, and rejection of an unknown stage — `ship` is not a stage and must be rejected
- [ ] 1.3 Add `packages/shared/src/schemas/changes.ts` — card and fleet-response zod schemas — and export from the barrel
- [ ] 1.4 Rebuild shared (`pnpm --filter @agenticapps/dashboard-shared build`) before running agent tests — the agent runs shared's built dist, and a clean typecheck with a runtime ZodError means a stale build

## 2. Stage classifier — pure, no I/O

- [ ] 2.1 Mirror upstream's `src/openspec/__fixtures__` into the agent test tree, recording provenance and the commit they were taken from
- [ ] 2.2 Write one failing test per ordered rule 1–5, plus a backlog entry classifying as `propose`
- [ ] 2.3 Write the failing veto test **against the real `retire-v1-surfaces/REVIEWS.md` shape** — two approvals from distinct reviewers plus two requests-for-changes from two *other* distinct reviewers classifies `validate`, not `execute`. This is the case that refuted the first draft of the rule; it is the one test that must exist
- [ ] 2.4 Write the failing tests for the rest of the reviewer rule: a reviewer who approved then requested changes does not count; a reviewer whose rejection is followed by an approval no longer vetoes; unparseable verdicts count as absent and classify `validate`
- [ ] 2.5 Write the failing test that `design.md` presence never changes a stage
- [ ] 2.6 Write the failing test that both archive readings are distinguishable — a rule-1 card carries source `archive`, a rule-5 card carries source `active` with `ready`
- [ ] 2.7 Implement `packages/agent/src/lib/changes/stage.ts` to green, citing ADR 0004 and naming **both** divergences in the module docblock: the rejection veto, and the absence of `ship`
- [ ] 2.8 Revert `stage.ts` and confirm every test in 2.2–2.6 goes RED, then restore

## 3. Repository reader

- [ ] 3.1 Write failing tests over temp directories: active changes, dated archive entries, unresolved `BACKLOG.md` entries, artifact presence, checklist rows, reviewer verdicts
- [ ] 3.2 Write the failing test that a repository with no `openspec/` yields no cards and is not reported as an error
- [ ] 3.3 Write failing tests for malformed input: an unparseable change directory and an unparseable backlog entry are skipped and counted, never fatal
- [ ] 3.4 Write the failing test that `openspec/changes/archive/` produces no card of its own, and that a non-change entry (a README, a directory holding none of the three artifacts) produces none either — this repo's own tree is the fixture
- [ ] 3.5 Write the failing tests for the backlog rule as specified: a level-two heading with no checked checkbox and no strikethrough is a card; a checked or struck-through one is not; an absent or heading-free `BACKLOG.md` yields nothing and is not malformed
- [ ] 3.6 Implement `packages/agent/src/lib/changes/changeReader.ts` to green
- [ ] 3.7 Confirm every path read passes `isReadableProjectPath`; add a test asserting it for the archive and backlog paths specifically
- [ ] 3.8 Add realpath containment on top of the lexical guard — resolve each path, confirm it lies under the registered project root, and read regular files only. Write the failing test first: a symlink under `openspec/` resolving outside the root yields no card and is reported skipped. `isReadableProjectPath` is lexical by its own docblock and does not cover this; `coverageResolver` and `conformanceScan` are the precedent to match

## 4. Fleet service and route

- [ ] 4.1 Write the failing degradation test: one repository throws, the rest still render, and the thrower is named with a reason
- [ ] 4.2 Write the failing test that all-repositories-failed is distinguishable from no-open-changes
- [ ] 4.3 Implement `packages/agent/src/lib/changes/service.ts` using `withinBound` + `Promise.allSettled`, one bound — document why the readiness signature pre-pass is not copied
- [ ] 4.4 Write the failing route contract test for `GET /api/v2/changes/fleet` — 200 shape, degraded notice, auth required
- [ ] 4.5 Implement `packages/agent/src/routes/changes.ts` and register it
- [ ] 4.6 Measure the endpoint against the real registry and record the figure; if the archive walk dominates, record it rather than silently narrowing scope
- [ ] 4.7 Assert in test that the board spawns no process at all: `GIT_ALLOWED_CMDS` is unchanged and no new spawn site exists

## 5. Board surface

- [ ] 5.1 Write failing SPA tests: four columns at the reference viewport, header `Label · N`, `No changes` for an empty stage
- [ ] 5.2 Write the failing test that the board pages one stage at a time behind a stage rail below the 180px minimum column width, with every stage reachable
- [ ] 5.3 Write the failing test that a long change name renders across two lines rather than eliding at one
- [ ] 5.4 Write failing tests for the degraded and unreachable states, asserting a degraded read does not present as an ordinary empty board
- [ ] 5.5 Write the failing test that the Archive column distinguishes a filed archive card from an active card marked `ready`
- [ ] 5.6 Implement `ChangeBoardPage`, `StageColumn` and `ChangeCard` to green; the card must not assume a fixed row count, so the session row is additive later
- [ ] 5.7 Add the `/changes` route and one `Changes` sidebar entry in the product-content group

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

## Out of scope

- [ ] Do NOT render live agent-session counts, and do NOT add the host adapters
- [ ] Do NOT modify `agents-task-viewer`
- [ ] Do NOT build a `ship` stage or any git probe — deferred to its own change
- [ ] Do NOT widen `GIT_ALLOWED_CMDS` or add a fifth process-spawn site
- [ ] Do NOT extend `openspecReader.ts` — the board reads independently by design
- [ ] Do NOT run the `retire-v1-surfaces` cutover
