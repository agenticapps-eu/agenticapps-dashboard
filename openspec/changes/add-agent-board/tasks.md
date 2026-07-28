# Tasks

Independent of the readiness and workflow work. Stage 1 runs against a stub, so
this change is not blocked by the adapter extraction.

## 1. Wire shape · AGE-471

- [ ] `packages/shared/src/schemas/board.ts` in the dashboard's internal shared schema package, with strict runtime record schemas temporarily mirroring the upstream data model exactly (TDD)
- [ ] `.strict()` like every other schema — drift becomes a parse error
- [ ] Do **not** rename any identifier; the upstream model is frozen by explicit instruction
- [ ] Encode exact `Host`, `TaskStatus`, `Session`, and `Task` fields, including `Host = claude | codex | opencode | pi` and required `Session.updatedAt`; all timestamps are epoch milliseconds
- [ ] Add the strict response envelope with one state entry for each of the four hosts, safe-integer omission/window counts, `truncated`, and a required dashboard-owned `reason` on unreadable entries only, plus sessions and tasks
- [ ] Validate composite identity and task-to-session referential integrity; exclude all duplicate-identity participants and unresolved/dependent tasks while counting each omission
- [ ] Test: every schema is strict and missing required `Session.updatedAt` fails record parsing
- [ ] Test: the host-entry union requires an allowed reason for `unreadable` and rejects a reason on `present` or `absent`
- [ ] Test: equal session/task ids on different hosts remain distinct
- [ ] Test: every participant in a duplicate composite identity is excluded and counted
- [ ] Test: unresolved tasks and tasks dependent on an excluded session are excluded and counted
- [ ] Re-export from the shared barrel

## 2. Endpoint, stage 1 — fixture data · AGE-471

- [ ] `GET /api/v2/board` returning sessions and tasks from a four-host upstream skeleton fixture (TDD)
- [ ] **Mark the payload synthetic in the envelope** — the board must state it is not showing live sessions
- [ ] Response through the existing outbound schema-validation wrapper
- [ ] Confirm the route inherits bearer auth, CORS lock, and bind-mode restrictions with no separate access path
- [ ] Reduce working directories to repo-relative or symbolic form before they leave the daemon
- [ ] Use the existing project registry id for `repo:<id>` path references; introduce no second root-id namespace
- [ ] Test: the daemon logs and persists no board payload
- [ ] Enforce the specified session/task ordering, referentially coherent 200/2,000 caps, and Unicode-code-point field bounds; populate omission counts across validation, referential, and cap exclusions and compute the window count from the pre-cap readable inventory
- [ ] Test: sessions order by active, `updatedAt` descending, `createdAt` descending, id ascending and tasks order by status, maximum present task timestamp descending, id ascending
- [ ] Test: exactly 200 sessions and 2,000 tasks are retained, while the 201st/2,001st records are omitted and counted without referential breakage
- [ ] Test: the fixture response validates against the shared schema and is flagged synthetic
- [ ] Test: a session without required `updatedAt` is excluded, its dependent tasks are excluded, the host is unreadable, and both omission counts increase
- [ ] Test: a dedicated four-host `state: absent` synthetic fixture renders the explained empty state and names `claude`, `codex`, `opencode`, and `pi`
- [ ] Test: an unauthenticated request is refused like any other route
- [ ] Test: no home-directory path appears in any response field
- [ ] Test: outbound schema drift returns the existing `500 schema_drift` response and no board records

## 3. Board surface · AGE-472

- [ ] Route `/board`, four columns, card per task (TDD)
- [ ] Fixture stage uses neutral tokens and the fixed textual host names `claude`, `codex`, `opencode`, and `pi`; live stage adopts shared labels/semantic colours with design-system contrast adaptation
- [ ] Test: a live shared host colour below the SPA contrast floor is paired with a compliant design token while retaining its textual label
- [ ] Test: markup or script in a task title or note renders as inert literal text
- [ ] Grouping toggle: by session (default) and flat by status
- [ ] Test: session grouping remains exactly the same four status columns with no fifth column
- [ ] Completed column bounded to the previous 24 hours; state the bound and hidden count
- [ ] Surface per-host record-cap omission counts separately from the completed-window hidden count
- [ ] Filters: host, active sessions only — activity read from the model's own flag
- [ ] Test: the host filter offers exactly `claude`, `codex`, `opencode`, and `pi`
- [ ] Resolve blockers within `(host, sessionId)`; unresolved references render `Unknown task <short-id>`; no drawn edges
- [ ] Test: an absent blocker renders `Unknown task <short-id>` using the first eight Unicode code points
- [ ] Poll every 3 seconds, retain a paused snapshot while hidden, and mark the retained snapshot stale only on refresh failure
- [ ] Test: no control exists that would write to a host
- [ ] Test: the board opens no SSE or websocket connection
- [ ] Test: a status change is rendered within the defined 5-second measurement target
- [ ] Empty state names all four hosts that were looked for and not found
- [ ] Add `/board` to the shell's content-surface navigation

## 4. External package prerequisite · AGE-470

- [ ] Confirm the separately reviewed viewer change has released a declared package supporting Bun and Node.js 20 without native dependencies
- [ ] Confirm the package exports the current `claude`, `codex`, `opencode`, and `pi` adapters plus their shared host-style definitions
- [ ] Confirm its published evidence shows all four adapter/style fixture sets passing in both runtimes and no frozen model identifier renamed
- [ ] Record the released package name, version, and upstream viewer commit consumed by this repo

## 5. Endpoint, stage 2 — real adapters · AGE-471

- [ ] Depend on the extracted package; remove the stub (TDD)
- [ ] Publish the live store as one immutable snapshot replacement; adapter initialisation failure retains a wholly synthetic snapshot rather than mixing sources
- [ ] Add compile-time compatibility checks between the dashboard runtime schemas and imported upstream `Host`, `TaskStatus`, `Session`, and `Task` types
- [ ] Run all four upstream adapter fixture sets through the dashboard runtime validator so record-shape drift fails before release
- [ ] Hold the normalised store in the daemon; serialise a snapshot per request
- [ ] Read only fixed host roots with canonical/symlink containment and bounded file reads; open SQLite read-only without database/WAL/SHM mutation
- [ ] Cache host snapshots for at most 1 second and coalesce concurrent reads per host
- [ ] Test: each of the four hosts, including `pi`, can be absent while remaining in the envelope as `state: absent` and contributing no records
- [ ] Test: each host, including `pi`, can independently be unreadable without removing readable siblings
- [ ] Test: all hosts absent yields a valid empty response
- [ ] Test: one malformed record marks its host unreadable, returns readable siblings, sets `reason: invalid-records`, and increments the matching omission count
- [ ] Test: host state reasons distinguish a wholly inaccessible source from partial invalid records and the surface renders that reason
- [ ] Test: `unsafe-path` and `read-limit` both make the affected host unreadable; output record/field caps set `truncated` instead
- [ ] Test: unreadable reasons follow deterministic precedence `unsafe-path`, `read-limit`, `source-unreadable`, `invalid-records`
- [ ] Test: blocker arrays carry bare task ids resolved as `(task.host, task.sessionId, referencedId)`
- [ ] Test: `doneOutsideWindow` is zero for absent or wholly unreadable hosts, excludes done tasks without `completedAt`, and counts readable out-of-window tasks before caps even when the same task is also omitted by a cap
- [ ] Test: a done task with `completedAt` after `generatedAt` remains visible and does not contribute to `doneOutsideWindow`
- [ ] Test: a referentially invalid out-of-window task does not contribute to `doneOutsideWindow`, while a valid readable sibling on the same partially unreadable host does
- [ ] Test: an out-of-window done task whose session is removed by the session cap does not contribute to `doneOutsideWindow`, while a task-cap-excluded valid sibling does
- [ ] Test: a response is wholly synthetic or wholly observed during the Stage 2 cutover, including adapter initialisation failure
- [ ] Test: after live cutover, a runtime host read failure marks only that host unreadable and never reactivates synthetic data
- [ ] Test: all four hosts becoming unreadable after live cutover returns a live all-unreadable envelope and an explained failure state, not synthetic or empty data
- [ ] Test: live responses still fail as `500 schema_drift` with no board records when outbound validation fails
- [ ] Test: concurrent refreshes for one host coalesce to one source read within the one-second cache window
- [ ] Test: an unresolved blocker renders as unknown but does not increment a session or task omission count
- [ ] Test: `GET /api/v2/board` is the only board endpoint and no mutating sibling exists
- [ ] Test: the external adapters resolve through the declared package specifier and no relative cross-repository import exists
- [ ] Confirm by grep that no host-parsing logic remains in this repo

## 6. Verify

- [ ] `openspec validate --all` green
- [ ] Fresh independent OpenSpec change review approves the revised artifacts before implementation
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
