# Tasks

Independent of the readiness and workflow work. Stage 1 runs against a stub, so
this change is not blocked by the adapter extraction.

## 1. Wire shape · AGE-471

- [ ] `packages/shared/src/schemas/board.ts` mirroring the upstream data model exactly (TDD)
- [ ] `.strict()` like every other schema — drift becomes a parse error
- [ ] Do **not** rename any identifier; the upstream model is frozen by explicit instruction
- [ ] Add the response envelope (per-host present/absent/unreadable + a synthetic-data flag) as a wrapper around the frozen record shapes, not as a change to them
- [ ] Re-export from the shared barrel

## 2. Endpoint, stage 1 — fixture data · AGE-471

- [ ] `GET /api/v2/board` returning sessions and tasks from the upstream skeleton data (TDD)
- [ ] **Mark the payload synthetic in the envelope** — the board must state it is not showing live sessions
- [ ] Response through the existing outbound schema-validation wrapper
- [ ] Confirm the route inherits bearer auth, CORS lock, and bind-mode restrictions with no separate access path
- [ ] Reduce working directories to repo-relative or symbolic form before they leave the daemon
- [ ] Confirm the daemon logs and persists no board payload
- [ ] Test: the fixture response validates against the shared schema and is flagged synthetic
- [ ] Test: an unauthenticated request is refused like any other route
- [ ] Test: no home-directory path appears in any response field

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
- [ ] **Also move `src/lib/host-style.ts` and its test** — the colour requirement mandates importing it, and it is not part of the model/store/adapters set. Verified 2026-07-26: it lives at `src/lib/host-style.ts`, outside the paths this block originally listed
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
