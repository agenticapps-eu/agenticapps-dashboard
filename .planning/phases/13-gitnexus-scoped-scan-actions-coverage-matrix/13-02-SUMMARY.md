---
phase: 13-gitnexus-scoped-scan-actions-coverage-matrix
plan: "02"
subsystem: daemon/gitnexus-scan
tags: [daemon, hono, subprocess, execa, in-memory-state, locks, threat-model, tdd]
dependency_graph:
  requires: ["13-00", "13-01"]
  provides: ["POST /api/gitnexus/scan", "GET /api/gitnexus/scan/:id", "gitnexusScan lib", "gitnexusFamilyScan lib"]
  affects: ["packages/agent/src/server/app.ts", "packages/agent/src/lib/coverageSpawn.ts (consumed)"]
tech_stack:
  added: []
  patterns:
    - "Global scan-serialisation lock (while-loop Promise pattern, D-13-EXT-01)"
    - "Event-driven scan settle via settleCallbacks Map (not polling)"
    - "Per-repo lock map keyed by family/repo string (D-13-03)"
    - "60s TTL eviction via setTimeout().unref() (D-13-EXT-04)"
    - "Fire-and-forget spawn with async state mutation (_doSpawnAndSettle)"
    - "Test binary override via _setGitnexusBinForTests (integration test seam)"
    - "exactOptionalPropertyTypes guard: only spread registryFile when defined"
key_files:
  created:
    - packages/agent/src/lib/gitnexusScan.ts
    - packages/agent/src/lib/gitnexusFamilyScan.ts
    - packages/agent/src/routes/gitnexusScan.ts
    - packages/agent/src/__tests__/gitnexusScan.integration.test.ts
  modified:
    - packages/agent/src/server/app.ts
    - packages/agent/src/lib/gitnexusScan.test.ts
    - packages/agent/src/lib/gitnexusFamilyScan.test.ts
    - packages/agent/src/routes/gitnexusScan.test.ts
decisions:
  - "D-13-EXT-01: global scan lock uses while-loop (not single await) to handle simultaneous wakeups"
  - "D-13-11: bindMode refusal returned BEFORE rate-limit check to minimise attack surface"
  - "registryFile isolation: startFamilyScan accepts opts.registryFile and passes to each child startScan"
  - "zValidator callback c.get cast via unknown to avoid TS2769 never error (Variables not in hook context)"
  - "exactOptionalPropertyTypes: scanOpts spread only when registryFile is defined"
metrics:
  duration: "~90 minutes (across two context windows)"
  completed: "2026-05-24"
  tasks_completed: 3
  files_created: 4
  files_modified: 4
  tests_added: 27
---

# Phase 13 Plan 02: Daemon gitnexus scan routes + in-memory job registry Summary

**One-liner:** Hono POST/GET scan routes backed by an in-memory job registry with per-repo locking, global scan-serialisation lock (D-13-EXT-01), and sequential family orchestration — all wired to `spawnGitNexusAnalyze` with no new execa surface.

## What Was Built

### Task 1 — `lib/gitnexusScan.ts`

Core scan state module:
- `scans: Map<string, ScanJob>` — in-memory registry of all active + recently-settled jobs
- `perRepoLocks: Map<string, Promise<void>>` — per-repo concurrency gate (D-13-03, → 409 SCAN_IN_FLIGHT)
- `globalScanLock: Promise<void> | null` — global single-writer lock (D-13-EXT-01) preventing concurrent `gitnexus analyze` subprocesses from racing on `~/.gitnexus/registry.json`
- `withGlobalScanLock<T>(fn)` — while-loop pattern (not single await) handles simultaneous wakeups
- `startScan(scanId, req, opts?)` — registers job, fires spawn, returns `{ok:true}` immediately
- `_doSpawnAndSettle` — wraps spawn in globalScanLock, maps SpawnResult to job state, T-13-02-04: NEVER copies raw stderr into job state
- `waitForScanSettle(scanId)` — event-driven via `settleCallbacks` Map (not polling)
- `registerFamilyJob`, `updateFamilyJob`, `scheduleFamilyEviction` — family orchestration helpers
- `_resetForTests()`, `_setGitnexusBinForTests(bin)` — test seams
- 60s TTL eviction via `setTimeout(...).unref()` (D-13-EXT-04)

### Task 2 — `lib/gitnexusFamilyScan.ts`

Sequential family orchestrator:
- `startFamilyScan(familyScanId, familyId, registry, opts?)` — for-of loop (no Promise.all, D-13-04)
- `deriveRepos(entries, familyId)` — path-prefix match against `~/Sourcecode/{family}/`, sorts alphabetically
- Partial-success semantics: family job never enters `state='error'` (D-13-05)
- `opts.registryFile` passed through to each child `startScan` call for test isolation

### Task 3 — Route + mount + integration tests

- `routes/gitnexusScan.ts`: POST `/scan` + GET `/scan/:id`
  - POST: bindMode refusal FIRST (D-13-11), rate-limit, zValidator 422 hook, repo/family dispatch, `outbound()` schema-drift guard (INV-04)
  - GET: bindMode refusal, SCAN_NOT_FOUND 404, `outbound()` schema guard
- `app.ts`: `app.route('/api/gitnexus', gitnexusScanRoute)` at Phase 13 comment
- Route unit tests: 10 cases (all error paths + happy paths for both POST and GET)
- Integration tests: 4 cases using real stub binaries under `~/Sourcecode/{family}/_inttest-*` dirs:
  1. Happy path: stub exits 0 → poll until state='done'
  2. No-stderr-leak: stub exits 1 with secret on stderr → secret NOT in GET response body (T-13-02-04)
  3. Global lock serialisation: 2 cross-family slow stubs → total elapsed > 500ms (proves T-13-02-05)
  4. Family partial success: 3 repos, 2nd fails → completed=2, failed=1, perRepoResults[1].error.code='SCAN_FAILED'

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 RED | `7facc77` | test(13-02): GREEN gitnexusScan lib tests — 8 cases |
| 1 GREEN | `7c73028` | feat(13-02): implement lib/gitnexusScan.ts |
| 2 RED | `e71f218` | test(13-02): GREEN gitnexusFamilyScan tests — 5 cases |
| 2 GREEN | `b6ac71c` | feat(13-02): implement lib/gitnexusFamilyScan.ts |
| 3 | `31f82bb` | feat(13-02): add gitnexusScan route, app.ts mount, and integration tests |

## Verification

- `pnpm --filter @agenticapps/dashboard-agent typecheck` — exits 0
- `pnpm --filter @agenticapps/dashboard-agent exec vitest run` — 98 test files, 908 tests, all pass
- `pnpm -r test` — agent 908/908, shared 294/294, spa 1107/1107 (no regressions)
- `grep -rn "spawn("` outside coverageSpawn.ts returns zero implementation hits
- `bindMode` refusal uses `c.get('bindMode')` (D-13-11)
- `globalScanLock` present and used in `_doSpawnAndSettle` (D-13-EXT-01)
- GET response body never contains raw stderr text (T-13-02-04)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] `startFamilyScan` lacked `opts.registryFile` passthrough**
- **Found during:** Task 3 integration test debugging
- **Issue:** `startFamilyScan` called `startScan(childScanId, req)` without `opts`, so each child scan used the global `REGISTRY_FILE` constant instead of the test fixture. Result: all child `startScan` calls returned `REPO_NOT_REGISTERED` → `completed=0`.
- **Fix:** Added `opts: { registryFile?: string } = {}` parameter to `startFamilyScan` signature; passed `opts` to each `startScan(childScanId, req, opts)` call; route passes `scanOpts` to both `startScan` and `startFamilyScan`.
- **Files modified:** `lib/gitnexusFamilyScan.ts`, `routes/gitnexusScan.ts`
- **Commit:** `31f82bb`

**2. [Rule 1 - Bug] `exactOptionalPropertyTypes` TS2379 on `{ registryFile: string | undefined }`**
- **Found during:** Task 3 typecheck
- **Issue:** Route passed `{ registryFile }` where `registryFile: string | undefined`; TypeScript `exactOptionalPropertyTypes` rejects `undefined` for an optional property typed `string`.
- **Fix:** `const scanOpts = registryFile ? { registryFile } : {}` — only spreads when defined.
- **Files modified:** `routes/gitnexusScan.ts`
- **Commit:** `31f82bb`

**3. [Rule 1 - Bug] `zValidator` callback TS2769 — `c.get('requestId')` resolves to `never`**
- **Found during:** Task 3 typecheck
- **Issue:** The `zValidator` result hook receives a context typed without the `Env.Variables` generic, so `c.get('requestId')` fails with "argument not assignable to parameter of type never".
- **Fix:** `const ctx = c as unknown as { get(k: string): unknown }` inside the hook; the main handler's `c.get('requestId')` is unaffected.
- **Files modified:** `routes/gitnexusScan.ts`
- **Commit:** `31f82bb`

**4. [Rule 1 - Bug] `makeRepoScanJob` in route test typed `state: string` instead of literal union**
- **Found during:** Task 3 typecheck
- **Issue:** TS2345: the mock helper's return type couldn't be assigned to `ScanJob` because `state: string` is wider than `'running' | 'done' | 'error'`.
- **Fix:** Changed `state: string` to `state: 'running' | 'done' | 'error'` in the Partial overrides type; added `as 'running' | 'done' | 'error'` cast to the return value.
- **Files modified:** `routes/gitnexusScan.test.ts`
- **Commit:** `31f82bb`

**5. [Rule 1 - Bug] Integration test using `tmpdir()` paths — execa ENOENT + derivedRepoId mismatch**
- **Found during:** Task 3 integration test execution (cross-context)
- **Issue:** Test dirs under `/tmp/...` don't match `derivedRepoId`'s `~/Sourcecode/{family}/{repo}` prefix check, and the directories didn't exist on disk so execa threw ENOENT.
- **Fix:** Integration tests create real directories under `~/Sourcecode/{family}/_inttest-*` using `mkdirSync({ recursive: true })`; tracked in `createdDirs[]`; cleaned up in `afterEach` via `rmSync`.
- **Files modified:** `src/__tests__/gitnexusScan.integration.test.ts`
- **Commit:** `31f82bb`

## Known Stubs

None — all routes return real data from the in-memory scan registry.

## Threat Flags

None beyond what is already in the plan's threat model. No new network endpoints, auth paths, or schema changes at trust boundaries beyond those planned.

## Self-Check: PASSED

- `packages/agent/src/lib/gitnexusScan.ts` — FOUND
- `packages/agent/src/lib/gitnexusFamilyScan.ts` — FOUND
- `packages/agent/src/routes/gitnexusScan.ts` — FOUND
- `packages/agent/src/__tests__/gitnexusScan.integration.test.ts` — FOUND
- Commit `31f82bb` — FOUND (git log)
- Commit `b6ac71c` — FOUND (git log)
- Commit `7c73028` — FOUND (git log)
- All tests green: 908/908 agent, 294/294 shared, 1107/1107 spa
