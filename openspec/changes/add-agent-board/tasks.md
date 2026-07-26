# Tasks

Independent of the readiness and workflow work. Stage 1 runs against a stub, so
this change is not blocked by the adapter extraction.

## 1. Wire shape · AGE-471

- [ ] `packages/shared/src/schemas/board.ts` mirroring the upstream data model exactly (TDD)
- [ ] `.strict()` like every other schema — drift becomes a parse error
- [ ] Do **not** rename any identifier; the upstream model is frozen by explicit instruction
- [ ] Re-export from the shared barrel

## 2. Endpoint, stage 1 — stub · AGE-471

- [ ] `GET /api/v2/board` returning sessions and tasks from the upstream skeleton data (TDD)
- [ ] Response through the existing outbound schema-validation wrapper
- [ ] Test: the stub response validates against the shared schema

## 3. Board surface · AGE-472

- [ ] Route `/board`, four columns, card per task (TDD)
- [ ] Host identity from the shared colour definitions, not redefined locally
- [ ] Grouping toggle: by session (default) and flat by status
- [ ] Completed column bounded by default; the bound is stated on the surface
- [ ] Filters: host, active sessions only — activity read from the model's own flag
- [ ] Blocked cards list blocker titles as text; no drawn edges
- [ ] Polling on a short interval, paused while not visible
- [ ] Test: no control exists that would write to a host
- [ ] Test: a status change is visible within a few seconds
- [ ] Empty state names the hosts that were looked for and not found

## 4. Adapter extraction (other repo) · AGE-470

- [ ] In the viewer repo: move the model, store, and three adapters plus fixtures and tests into their own package
- [ ] Move the terminal frontend into its own package importing it
- [ ] Publish/resolve the package name used by this repo's dependency
- [ ] Test: the extracted package's tests are green; the terminal viewer starts unchanged
- [ ] Confirm no identifier in the data model was renamed by the move

## 5. Endpoint, stage 2 — real adapters · AGE-471

- [ ] Depend on the extracted package; remove the stub (TDD)
- [ ] Hold the normalised store in the daemon; serialise a snapshot per request
- [ ] Test: an absent host is omitted and the endpoint still succeeds
- [ ] Test: all hosts absent yields a valid empty response
- [ ] Confirm by grep that no host-parsing logic remains in this repo

## 6. Verify

- [ ] `openspec validate --all` green
- [ ] `pnpm lint` green; per-package tests green
- [ ] Design critique on `/board` at 1440×900, artifact committed
- [ ] Two-stage review

## Out of scope

- [ ] Do NOT copy the adapters into this repo
- [ ] Do NOT import across repo boundaries by relative path
- [ ] Do NOT rename anything in the upstream data model
- [ ] Do NOT add write actions, drag-and-drop, or task creation
- [ ] Do NOT add a push channel
- [ ] Do NOT replace or remove the terminal viewer
