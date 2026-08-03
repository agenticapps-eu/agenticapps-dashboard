**TDD throughout.** Every test is proved to fail before its implementation
exists. Two fixtures last session passed while asserting nothing; reverting the
implementation to confirm RED is the check that catches that, and it is not
optional here.

**This change does not depend on `retire-v1-surfaces`.** It stands alone on the
current SPA alongside the v1 surfaces, and unblocks that change rather than
waiting for it.

## 1. Shared contract

- [ ] 1.1 Read upstream `agents-task-viewer` `src/openspec/types.ts` and ADR 0004 in full before writing the schema; record any field deliberately not carried
- [ ] 1.2 Write failing schema tests for the change card: required fields, the five stage values, the three source values, and rejection of an unknown stage
- [ ] 1.3 Add `packages/shared/src/schemas/changes.ts` — card and fleet-response zod schemas — and export from the barrel
- [ ] 1.4 Rebuild shared (`pnpm --filter @agenticapps/dashboard-shared build`) before running agent tests — the agent runs shared's built dist, and a clean typecheck with a runtime ZodError means a stale build

## 2. Stage classifier — pure, no I/O

- [ ] 2.1 Mirror upstream's `src/openspec/__fixtures__` into the agent test tree, recording provenance and the commit they were taken from
- [ ] 2.2 Write one failing test per ordered rule 1–6, plus a backlog entry classifying as `propose`
- [ ] 2.3 Write the failing divergence test: two approvals plus two requests-for-changes from different reviewers classifies `validate`-eligible; a single reviewer who approved then requested changes does not count
- [ ] 2.4 Write the failing test that `design.md` presence never changes a stage
- [ ] 2.5 Implement `packages/agent/src/lib/changes/stage.ts` to green, citing ADR 0004 and naming the reviewer divergence in the module docblock
- [ ] 2.6 Revert `stage.ts` and confirm every test in 2.2–2.4 goes RED, then restore

## 3. Repository reader

- [ ] 3.1 Write failing tests over temp directories: active changes, dated archive entries, unresolved `BACKLOG.md` entries, artifact presence, checklist rows, reviewer verdicts
- [ ] 3.2 Write the failing test that a repository with no `openspec/` yields no cards and is not reported as an error
- [ ] 3.3 Write failing tests for malformed input: an unparseable change directory and an unparseable backlog entry are skipped and counted, never fatal
- [ ] 3.4 Implement `packages/agent/src/lib/changes/changeReader.ts` to green
- [ ] 3.5 Confirm every path read passes `isReadableProjectPath`; add a test asserting it for the archive and backlog paths specifically

## 4. Ship probe

- [ ] 4.1 Write the failing test that an archive entry present on `main` classifies `ship` and one absent classifies `archive`
- [ ] 4.2 Write the failing tests that a probe failure, a timeout, a missing ref, and a detached HEAD each resolve to `archive` and never to `ship`
- [ ] 4.3 Implement the probe as `git log <ref> -- openspec/changes/archive/<name>` through the existing bounded-git site
- [ ] 4.4 Assert in test that `GIT_ALLOWED_CMDS` is unchanged and no new spawn site was introduced

## 5. Fleet service and route

- [ ] 5.1 Write the failing degradation test: one repository throws, the rest still render, and the thrower is named with a reason
- [ ] 5.2 Write the failing test that all-repositories-failed is distinguishable from no-open-changes
- [ ] 5.3 Implement `packages/agent/src/lib/changes/service.ts` using `withinBound` + `Promise.allSettled`, one bound — document why the readiness signature pre-pass is not copied
- [ ] 5.4 Write the failing route contract test for `GET /api/v2/changes/fleet` — 200 shape, degraded notice, auth required
- [ ] 5.5 Implement `packages/agent/src/routes/changes.ts` and register it
- [ ] 5.6 Measure the endpoint against the real registry and record the figure; if the archive walk dominates, record it rather than silently narrowing scope

## 6. Board surface

- [ ] 6.1 Write failing SPA tests: five columns at the reference viewport, header `Label · N`, `No changes` for an empty stage
- [ ] 6.2 Write the failing test that the board pages one stage at a time behind a stage rail below the 180px minimum column width, with every stage reachable
- [ ] 6.3 Write the failing test that a long change name renders across two lines rather than eliding at one
- [ ] 6.4 Write failing tests for the degraded and unreachable states, asserting a degraded read does not present as an ordinary empty board
- [ ] 6.5 Implement `ChangeBoardPage`, `StageColumn` and `ChangeCard` to green; the card must not assume a fixed row count, so the session row is additive later
- [ ] 6.6 Add the `/changes` route and one `Changes` sidebar entry in the product-content group

## 7. Drawer

- [ ] 7.1 Write failing tests: selecting a card opens a drawer over the board carrying repository, stage, source, artifact presence, reviewer verdicts and checklist rows
- [ ] 7.2 Write the failing test that the location carries repository and change as two separate parameters, and that no composite separator is parsed
- [ ] 7.3 Write the failing tests that a deep link restores the drawer, and that a deep link to an absent change renders the board with a not-found statement
- [ ] 7.4 Implement `ChangeDrawer` to green

## 8. Verify

- [ ] 8.1 `pnpm --filter @agenticapps/dashboard-shared test`, `pnpm --filter @agenticapps/dashboard-agent test`, and the SPA suite green — run per package, not `pnpm -r test`
- [ ] 8.2 `pnpm -r typecheck` clean and `pnpm lint` with zero errors
- [ ] 8.3 `impeccable:critique` at 1440×900 against `/changes`, composite ≥ 80, artifact committed
- [ ] 8.4 Verify the board against a live daemon and the real registry — not only against mocked responses, which have disagreed with the daemon's actual status codes before
- [ ] 8.5 `openspec validate --all` green
- [ ] 8.6 Two other-vendor plan reviews recorded in `REVIEWS.md`; findings verified against the code before being acted on, and refutations argued with the check rather than the opinion
- [ ] 8.7 Two-stage review before merge

## 9. Hand back to `retire-v1-surfaces`

These are corrections to that change, made while it is still open. They are
listed here because this change is what makes them necessary, and they are cheap
now and a separate change once its delta is folded.

- [ ] 9.1 Correct its `project-dashboard` delta: archived-change ordering is no longer droppable, because this board renders archived changes in date order
- [ ] 9.2 Resolve the kanban question in its `design-system` delta — scope `Dense Rows And Aligned Figures` to list and table surfaces, or grant this board a stated exception
- [ ] 9.3 Append a dated note to `openspec/CAPABILITY-MAP.md` recording that the agent-board prerequisite is discharged — append only, never edit the ratified table

## Out of scope

- [ ] Do NOT render live agent-session counts, and do NOT add the host adapters
- [ ] Do NOT modify `agents-task-viewer`
- [ ] Do NOT widen `GIT_ALLOWED_CMDS` or add a fifth process-spawn site
- [ ] Do NOT extend `openspecReader.ts` — the board reads independently by design
- [ ] Do NOT run the `retire-v1-surfaces` cutover
