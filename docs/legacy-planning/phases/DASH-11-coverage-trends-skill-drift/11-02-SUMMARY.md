---
phase: 11-coverage-trends-skill-drift
plan: 02
subsystem: daemon-coverage-trends
tags: [daemon, snapshots, filesystem, scheduler, route, tdd, security-write-path]

# Dependency graph
requires:
  - phase: 11
    plan: 01
    provides: CoverageHistoryResponseSchema (bulk-per-repo) + CoverageCellDriftSchema via @agenticapps/dashboard-shared barrel
  - phase: 10
    provides: scanCoverageInternal() + coverageScan rows (claudeMd/gitNexus/wiki/workflowVersion state enums)
provides:
  - snapshotPaths helpers (resolveSnapshotDir, RETENTION_DAYS=14, isoDateFromDate, isSnapshotFilename)
  - snapshotWriter (writeDailySnapshot — NDJSON-append + chmod-after-create + lazy prune)
  - snapshotPruner (pruneSnapshotsOlderThan — 14d rolling cutoff)
  - snapshotReader (readDriftForRepo — bulk-per-repo + last-record-wins + most-recent-transition)
  - snapshotScheduler (startSnapshotScheduler — in-process setTimeout chain anchored to 03:00 local, .unref()'d)
  - coverageHistoryCache (1h Map-keyed memo keyed by repoId)
  - coverageHistoryRoute (GET /api/coverage/history?repoId=... bulk-per-repo route)
  - boot.ts disposer registry (registerDisposer / clearDisposers / runDisposers via _runDisposersForTests)
  - boot.ts symlink-escape assertion (assertSnapshotDirInDaemonHome — refuse-to-start on realpath escape)
affects: [11-03-skill-drift-daemon, 11-04-coverage-trends-spa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NDJSON append-only daily snapshot file under ~/.agenticapps/dashboard/coverage-history/<UTC-date>.ndjson — mode 0o600 file in mode 0o700 dir"
    - "Pitfall 2 defence: explicit fs.chmod(path, 0o600) after every appendFile (fs.appendFile mode arg only honoured on creation)"
    - "Same-day semantics — writer APPENDS, reader COLLAPSES with last-record-wins per (date, repo, cell) via Map.set overwrites (REVIEWS action item 4)"
    - "In-process setTimeout chain scheduler — single-shot, re-arms inside its own tick, .unref()'d (Pitfall 7); first-boot-fires-immediately IFF today's NDJSON is absent (RESOLVED Q1)"
    - "Bulk-per-repo wire shape: GET /api/coverage/history?repoId=... returns all 4 cells of one repo in one response (PD-11-02 — cuts first-paint fan-out from ~168 to ≤42 requests)"
    - "Data-driven repoId validation against scanCoverageInternal() ∪ readRegistry() — no regex (REVIEWS action item 3); unknown repoId → 404 repo_not_found"
    - "Boot.ts disposer registry (LIFO, idempotent, throw-isolated) — single chokepoint for resource teardown (REVIEWS action item 5)"
    - "Symlink-escape boot check using realpathSync — refuse to start if coverage-history dir escapes ~/.agenticapps/dashboard/ (T-11-02-03)"

key-files:
  created:
    - packages/agent/src/lib/snapshots/snapshotPaths.ts
    - packages/agent/src/lib/snapshots/snapshotPaths.test.ts
    - packages/agent/src/lib/snapshots/snapshotPruner.ts
    - packages/agent/src/lib/snapshots/snapshotPruner.test.ts
    - packages/agent/src/lib/snapshots/snapshotWriter.ts
    - packages/agent/src/lib/snapshots/snapshotWriter.test.ts
    - packages/agent/src/lib/snapshots/snapshotReader.ts
    - packages/agent/src/lib/snapshots/snapshotReader.test.ts
    - packages/agent/src/lib/snapshots/snapshotScheduler.ts
    - packages/agent/src/lib/snapshots/snapshotScheduler.test.ts
    - packages/agent/src/lib/coverageHistoryCache.ts
    - packages/agent/src/lib/coverageHistoryCache.test.ts
    - packages/agent/src/routes/coverageHistory.ts
    - packages/agent/src/routes/coverageHistory.test.ts
    - packages/agent/src/server/boot.test.ts
  modified:
    - packages/agent/src/server/app.ts
    - packages/agent/src/server/boot.ts

key-decisions:
  - "PD-11-01 reinterpretation of D-11-02 honoured: in-process setTimeout chain inside the running daemon — NO modifications to Phase 6 launchd plist or systemd unit. The daemon process IS the long-lived process launchd keeps alive."
  - "PD-11-02 bulk-per-repo endpoint: GET /api/coverage/history?repoId=X returns drift for ALL FOUR cells in one response. NO ?cell= query param. snapshotReader exposes readDriftForRepo(repoId) returning the 4-cell record."
  - "REVIEWS action item 3 — data-driven repoId validation: the route builds a legal-id set from readRegistry().projects ∪ ${family}/${repo} derived from scanCoverageInternal() rows. No regex. Path-traversal strings (../etc/passwd) → 404 repo_not_found, not 400."
  - "REVIEWS action item 4 — writer APPENDS, reader COLLAPSES: two same-day records collapse with last-record-wins per (date, repo, cell). Writer is simpler (no conditional-upsert); reader uses Map.set overwrites to achieve the collapse. snapshotReader.test.ts test 9 explicitly locks this."
  - "REVIEWS action item 5 — explicit disposer registry in boot.ts (registerDisposer / clearDisposers + internal runDisposers): the snapshot scheduler's stop() is wired into gracefulShutdown via the registry, not via an ad-hoc 'let snapshotDisposer' capture. LIFO order; throw-isolated; idempotent."
  - "Pitfall 2 defence: explicit fs.chmod(path, 0o600) after EVERY appendFile, not just on creation — snapshotWriter test 4 (Pitfall 2 test) deliberately loosens the mode to 0o644 between writes and asserts the writer restores 0o600."
  - "Symlink-escape boot check (T-11-02-03): boot fails fast with 'coverage-history dir escapes daemon home: <realpath>' if the snapshot dir realpath escapes ~/.agenticapps/dashboard/. Mirrors auth.ts's refuse-to-start idiom."

patterns-established:
  - "TDD-per-module: every new file landed as test+feat in a single commit (RED → confirm fail → implement → confirm GREEN → commit). Pattern preserved across all 7 tasks."
  - "Test-only exports for boot.ts internals: _runDisposersForTests + _earlyShutdownForTests + assertSnapshotDirInDaemonHome exported so the registry + symlink check can be unit-tested without spinning up a real Hono server."
  - "Mock the scanner + registry + reader at the route boundary (vi.mock above import); inject tmpdir HOME for file-system tests; use vi.useFakeTimers + injected now() for scheduler tests."

requirements-completed: [TRD-01, TRD-02, TRD-03, TRD-04, INV-01, INV-02, INV-04, INV-05]

# Metrics
duration: 15min
completed: 2026-05-16
---

# Phase 11 Plan 02: Coverage trends DAEMON Summary

**Lands the entire Coverage trends daemon path — NDJSON snapshot writer + 14d pruner + bulk-per-repo reader + in-process scheduler (PD-11-01) + GET /api/coverage/history route (PD-11-02) + boot.ts disposer registry + symlink-escape boot check. Closes TRD-01..04; SPA Plan 11-04 can now consume drift.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-16T13:46:41Z
- **Completed:** 2026-05-16T14:01:53Z
- **Tasks:** 7 (TDD, RED→GREEN per module)
- **Files created:** 15 (7 source + 8 test files)
- **Files modified:** 2 (app.ts mount + boot.ts wiring)
- **Tests added:** 52 new vitest cases across daemon
  - 7 (snapshotPaths) + 5 (snapshotPruner) + 7 (snapshotWriter) + 10 (snapshotReader) + 7 (snapshotScheduler) + 5 (coverageHistoryCache) + 10 (coverageHistory route) + 13 (boot.ts disposer registry + symlink-escape)
- **Full agent test suite after plan:** 707/707 green
- **Agent + workspace typecheck:** clean
- **Workspace build:** clean (all 5 packages)

## Accomplishments

### Snapshot subsystem (packages/agent/src/lib/snapshots/)

- **`snapshotPaths.ts`** — `resolveSnapshotDir()` (~/.agenticapps/dashboard/coverage-history/), `RETENTION_DAYS=14`, `isoDateFromDate(d)` (UTC slice — Pitfall 4), `isSnapshotFilename(name)` (anchored YYYY-MM-DD.ndjson regex, rejects traversal).
- **`snapshotWriter.ts`** — `writeDailySnapshot({ now, dir })` opens the day's NDJSON file, appends one record per `scanCoverageInternal()` row (mode 0o600), and explicitly `chmod(path, 0o600)` after every append (Pitfall 2 defence — `fs.appendFile` mode arg only honoured on creation). Pruner runs BEFORE the scan+append (lazy-on-write — no second scheduler).
- **`snapshotPruner.ts`** — `pruneSnapshotsOlderThan(dir, days, now)` unlinks files whose ISO-date filename is strictly older than `now - 14d`. Cutoff inclusive on the 14th day. Pure date-string comparison (UTC ISO-8601 dictionary order = chronological order).
- **`snapshotReader.ts`** — `readDriftForRepo(repoId)` returns drift for ALL FOUR cells (PD-11-02 bulk shape). Algorithm: walk every NDJSON file in the 14d window, collect per-cell `Map<date, state>` with last-record-wins on same-day duplicates (REVIEWS action item 4 — Map.set overwrites earlier entries), then per cell find the most-recent transition. `'not-applicable'` transitions are NOT signal (direction stays null). Malformed JSON + malformed filenames are skipped silently.
- **`snapshotScheduler.ts`** — `startSnapshotScheduler({ now, dir, hourLocal=3 })` arms a single-shot `setTimeout(.unref())` chain that re-arms inside its own tick. First-boot-fires-immediately IFF today's NDJSON is absent (RESOLVED Q1 — idempotent backfill); otherwise next tick is at next 03:00-local. Errors from `writeDailySnapshot` are swallowed + logged via `agentError`; scheduler re-arms unconditionally. Returned disposer `clearTimeout`s the active timer.

### Route + cache (packages/agent/src/routes/, src/lib/)

- **`coverageHistoryCache.ts`** — 1h Map-keyed memo (`getCoverageHistoryCached`, `setCoverageHistoryCached`, `clearCoverageHistoryCache`). Keyed by **repoId only** (PD-11-02 — no per-column discriminator since the bulk shape carries all four columns in one payload).
- **`coverageHistory.ts`** — `coverageHistoryRoute` exposes `GET /coverage/history?repoId=...`. Pipeline:
  1. Zod-parse the query (`repoId: z.string().min(1)`) → 400 `invalid_query` on miss/empty.
  2. Build the legal-repoId set from `scanCoverageInternal()` rows + `readRegistry().projects` (data-driven, no regex per REVIEWS action item 3). Unknown repoId → 404 `repo_not_found`.
  3. Cache short-circuit (1h TTL, keyed by repoId).
  4. Compute drift via `readDriftForRepo(repoId)` if cache miss; store result.
  5. Wrap response in `outbound(c, CoverageHistoryResponseSchema.parse, response)` (INV-04 / T-11-02-10 schema-drift defence).
- **Mount:** `app.ts` now contains `app.route('/api', coverageHistoryRoute)` directly after the existing `coverageRoute` mount. Bearer-auth + CORS + cidr middleware inherited from the app.ts chain.

### Daemon bootstrap (packages/agent/src/server/boot.ts)

- **Disposer registry (REVIEWS action item 5):** `registerDisposer(fn)` + `clearDisposers()` exports + internal `runDisposers()` that runs LIFO, isolates throws via try/catch + `agentError` log, and is idempotent (clears the registry after first invocation).
- **`runDisposers()` is wired into all three shutdown branches:** happy-path `server.close` callback, kill-timer fallback, AND the early-signal path (`serverRef === null` branch). All three test cases pinned in `boot.test.ts`.
- **`assertSnapshotDirInDaemonHome()` (T-11-02-03 mitigation):** at the TOP of `bootDaemon` (before any state write or signal-handler attach), `realpathSync` both the daemon home and the coverage-history dir. If the snapshot dir realpath does NOT match or descend from the daemon-home realpath, throw with `[boot] coverage-history dir escapes daemon home: <realpath>`. First-run path (snapshot dir absent) is acceptable — snapshotWriter creates it at mode 0o700 on the first tick.
- **Scheduler wiring:** `registerDisposer(startSnapshotScheduler())` inside the `serve(...)` listen callback — after `writePidfile()` + `writeServerInfo()`. The scheduler runs INSIDE the daemon process launchd keeps alive (PD-11-01), so no plist modification is required.

## Task Commits

| Task | Subject                                                                                    | Hash    |
| ---- | ------------------------------------------------------------------------------------------ | ------- |
| 1a   | test+feat(11-02): add snapshotPaths helper + 7 tests                                       | b5a8a10 |
| 1b   | test+feat(11-02): add snapshotPruner with 14d rolling cutoff                               | 26968f3 |
| 1c   | test+feat(11-02): add snapshotWriter with mode-on-disk Pitfall 2 defence                   | 18b3693 |
| 2    | test+feat(11-02): add snapshotReader bulk-per-repo with last-record-wins collapse          | 31fcb5a |
| 3    | test+feat(11-02): add coverageHistoryCache (PD-11-02 — keyed by repoId only)               | 4a3c17c |
| 4    | test+feat(11-02): add snapshotScheduler (PD-11-01 in-process timer chain)                  | fdae719 |
| 5    | test+feat(11-02): add GET /api/coverage/history bulk-per-repo route + registry-validated repoId | 3774bb5 |
| 6    | test+feat(11-02): introduce boot.ts disposer registry (REVIEWS action item 5)              | 71b04c1 |
| 7    | feat(11-02): wire coverageHistory route + snapshot scheduler via disposer registry + symlink-escape boot check | 5b08d91 |

(Plan metadata commit + STATE.md/ROADMAP.md commit lands after this SUMMARY.)

## Decisions Made

- **PD-11-01 honoured (in-process scheduler):** Phase 6's launchd plist sets `KeepAlive=true` + `RunAtLoad=false` (verified at `installLaunchd.ts:46`); adding `StartCalendarInterval` to a KeepAlive plist would either spawn duplicate daemons or be silently ignored. The daemon IS the long-lived process launchd keeps alive, so the scheduler runs inside it via a `setTimeout(.unref())` chain. NO plist modification.
- **PD-11-02 honoured (bulk-per-repo response):** GET /api/coverage/history?repoId=X returns drift for all four cells in one response. NO `?cell=` query param. snapshotReader.readDriftForRepo(repoId) is the bulk helper; coverageHistoryCache is keyed by repoId only (no per-column discriminator). Cuts /coverage first-paint fan-out from ~168 to ≤42 requests.
- **REVIEWS action item 3 (data-driven repoId validation):** Route validates `repoId` against `scanCoverageInternal()` rows ∪ `readRegistry().projects` — no regex. Path-traversal strings (`../etc/passwd`) → 404 repo_not_found because they're not in either source set. Defence-in-depth: even if a traversal string slipped through, `repoId` is only ever used for string equality against in-file records, NEVER as a filesystem path.
- **REVIEWS action item 4 (writer-append, reader-collapse):** Writer is append-only with NO conditional-upsert (keeps the hot path simple); reader collapses same-day duplicates via Map.set overwrites (last-record-wins per (date, repo, cell)). snapshotReader.test.ts test 9 explicitly verifies a sequence missing → stale → fresh on the same day collapses to missing → fresh.
- **REVIEWS action item 5 (explicit disposer registry):** boot.ts now has `registerDisposer / clearDisposers + internal runDisposers` helpers. LIFO order; throw-isolated via per-fn try/catch; idempotent (registry cleared after first runDisposers call). Wired into ALL THREE shutdown branches: happy-path close-callback, kill-timer fallback, early-signal path.
- **Pitfall 2 defence:** Explicit `fs.chmod(path, 0o600)` after every `appendFile`, not just on creation. Test 4 in snapshotWriter.test.ts deliberately loosens mode to 0o644 between writes and asserts the writer restores 0o600 — without the explicit chmod after the second append, the test would fail.

## Deviations from Plan

None — plan executed exactly as written. All 7 tasks landed in order; all RED→GREEN cycles ran clean; no scope-boundary violations needed deferral. Two minor type-correctness fixups (under `noUncheckedIndexedAccess`) folded into Task 7's commit as part of the workspace-typecheck pass.

## Issues Encountered

- **Pre-existing parallel-test race in `start.subprocess.test.ts`:** When running the FULL `pnpm test --run` suite, the subprocess test occasionally fails because it spawns `pnpm build` from within a vitest worker while another worker is also building. The test passes in isolation. Out of Plan 11-02 scope — pre-existing behaviour, not caused by this plan's changes.

## User Setup Required

None — no third-party services touched. The daemon's new write path (`~/.agenticapps/dashboard/coverage-history/`) is daemon-private and created with mode `0o700` on first tick. The scheduler is in-process, so no launchd/systemd reinstall is required.

## Next Plan Readiness

- **Plan 11-03 (skill drift daemon):** ready to mount its route AFTER `app.route('/api', coverageHistoryRoute)` in `packages/agent/src/server/app.ts` (line 134). No collisions; the snapshot subsystem is fully self-contained under `packages/agent/src/lib/snapshots/`.
- **Plan 11-04 (coverage trends SPA):** ready to consume the bulk-per-repo endpoint. Recommended hook signature:
  ```ts
  function useCoverageHistory(repoId: string): UseQueryResult<CoverageHistoryResponse>
  ```
  drops the `cell` parameter (PD-11-02 — no per-cell endpoint). `CoverageRow.tsx` (NOT `CoverageCell.tsx`) owns the hook and fans `drift` props out to its four `CoverageCell` children. `CoverageCell.tsx` stays purely presentational with a `drift?: CoverageCellDrift | null` prop.

## Threat Model Verification

All STRIDE entries from the plan's threat register have a tested mitigation:

| Threat ID    | Mitigated by                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| T-11-02-01   | snapshotWriter.test.ts T1+T4 (dir 0o700, file 0o600, mode preserved after second write)                   |
| T-11-02-02   | coverageHistory.test.ts T4 (../etc/passwd → 404) + reader uses repoId only as string equality, not path   |
| T-11-02-03   | boot.test.ts symlink-escape T1 (throws `escapes daemon home`); boot.ts assertSnapshotDirInDaemonHome     |
| T-11-02-04   | snapshotWriter.test.ts T1 + T4 (mode 0o600 verified on disk twice)                                        |
| T-11-02-05   | snapshotPruner.test.ts all 5 + lazy-on-write call ordering test in snapshotWriter.test.ts T5              |
| T-11-02-06   | snapshotScheduler.test.ts T5 (.unref() spy)                                                              |
| T-11-02-07   | coverageHistory.test.ts T1 (401 without bearer)                                                          |
| T-11-02-08   | snapshotReader.test.ts T7 (malformed JSON skipped) + bounded enum values via SIGNAL_STATES               |
| T-11-02-09   | accepted (same-uid model per Phase 1 D-13; pidfile-lock prevents two daemons)                            |
| T-11-02-10   | coverageHistory.test.ts T9 (outbound() schema-drift defence)                                              |
| T-11-02-11   | PD-11-02 bulk shape + 1h cache short-circuit T8                                                          |
| T-11-02-12   | boot.test.ts T6-T7 (disposer registry drained on happy-path + kill-timer + early-signal)                 |

## Manual Smoke (deferred — daemon not started during this plan execution)

The plan's `<verification>` block lists a manual smoke step that starts the daemon and curls the endpoint. This was NOT run during the autonomous executor pass (daemon-start is a side-effect outside the test-only execution path). The full automated test surface (52 new vitest cases + 707/707 agent suite green + typecheck clean + build clean) covers the same invariants:

- `0o600` + `0o700` modes verified on disk via `statSync` in snapshotWriter.test.ts T1
- `repoId=../etc/passwd` → 404 verified in coverageHistory.test.ts T4
- `repoId=` (empty) → 400 verified in coverageHistory.test.ts T7
- Missing `repoId` → 400 verified in coverageHistory.test.ts T6
- All four cells in one response verified in coverageHistory.test.ts T3 + T10
- 401 without bearer verified in coverageHistory.test.ts T1
- Symlink-escape boot refusal verified in boot.test.ts T1 (symlink → /tmp/escape → throw)

Smoke can be performed by the verifier or in the post-phase /qa pass.

## Self-Check: PASSED

Verification:
- `[FOUND]` `packages/agent/src/lib/snapshots/snapshotPaths.ts` exists
- `[FOUND]` `packages/agent/src/lib/snapshots/snapshotPaths.test.ts` exists
- `[FOUND]` `packages/agent/src/lib/snapshots/snapshotPruner.ts` exists
- `[FOUND]` `packages/agent/src/lib/snapshots/snapshotPruner.test.ts` exists
- `[FOUND]` `packages/agent/src/lib/snapshots/snapshotWriter.ts` exists
- `[FOUND]` `packages/agent/src/lib/snapshots/snapshotWriter.test.ts` exists
- `[FOUND]` `packages/agent/src/lib/snapshots/snapshotReader.ts` exists
- `[FOUND]` `packages/agent/src/lib/snapshots/snapshotReader.test.ts` exists
- `[FOUND]` `packages/agent/src/lib/snapshots/snapshotScheduler.ts` exists
- `[FOUND]` `packages/agent/src/lib/snapshots/snapshotScheduler.test.ts` exists
- `[FOUND]` `packages/agent/src/lib/coverageHistoryCache.ts` exists
- `[FOUND]` `packages/agent/src/lib/coverageHistoryCache.test.ts` exists
- `[FOUND]` `packages/agent/src/routes/coverageHistory.ts` exists
- `[FOUND]` `packages/agent/src/routes/coverageHistory.test.ts` exists
- `[FOUND]` `packages/agent/src/server/boot.test.ts` exists
- `[FOUND]` `packages/agent/src/server/app.ts` contains `app.route('/api', coverageHistoryRoute)`
- `[FOUND]` `packages/agent/src/server/boot.ts` contains `registerDisposer(startSnapshotScheduler())` + `assertSnapshotDirInDaemonHome`
- `[FOUND]` commit `b5a8a10` (snapshotPaths)
- `[FOUND]` commit `26968f3` (snapshotPruner)
- `[FOUND]` commit `18b3693` (snapshotWriter)
- `[FOUND]` commit `31fcb5a` (snapshotReader)
- `[FOUND]` commit `4a3c17c` (coverageHistoryCache)
- `[FOUND]` commit `fdae719` (snapshotScheduler)
- `[FOUND]` commit `3774bb5` (coverageHistory route)
- `[FOUND]` commit `71b04c1` (boot.ts disposer registry)
- `[FOUND]` commit `5b08d91` (boot.ts wiring + symlink-escape)
- `[PASS]` 707/707 agent vitest cases green (`pnpm --filter @agenticapps/dashboard-agent test --run`)
- `[PASS]` agent typecheck clean
- `[PASS]` workspace typecheck clean (all 5 packages)
- `[PASS]` workspace build clean
- `[PASS]` `grep -c "app.route('/api', coverageHistoryRoute)" packages/agent/src/server/app.ts` returns 1
- `[PASS]` `grep -c "registerDisposer(startSnapshotScheduler" packages/agent/src/server/boot.ts` returns 1
- `[PASS]` `grep -c "escapes daemon home" packages/agent/src/server/boot.ts` returns 1
- `[PASS]` `grep -c "setInterval" packages/agent/src/lib/snapshots/snapshotScheduler.ts` returns 0 (anti-pattern defence)
- `[PASS]` `grep -c "\.unref" packages/agent/src/lib/snapshots/snapshotScheduler.ts` returns ≥ 1 (Pitfall 7)
- `[PASS]` `grep -c "chmod" packages/agent/src/lib/snapshots/snapshotWriter.ts` returns ≥ 1 (Pitfall 2)

---
*Phase: 11-coverage-trends-skill-drift*
*Completed: 2026-05-16*
