---
phase: 10
plan: "04"
subsystem: agent/routes
tags:
  - coverage-matrix
  - hono-route
  - tdd
  - cache
  - spawn
  - security
dependency_graph:
  requires:
    - 10-01 (CoverageResponseSchema, CoverageRefreshRequestSchema, CoverageRefreshResponseSchema)
    - 10-02 (discoverRepos — synchronous path lookup for AGREED-3)
    - 10-03 (scanCoverage, scanCoverageInternal, coverageCache, coverageSpawn)
  provides:
    - GET /api/coverage (cached, schema-validated, absPath-free)
    - POST /api/coverage/refresh (gitnexus-analyze only, updatedRow required)
    - coverageRoute mounted in app.ts at /api prefix
  affects:
    - 10-05 (SPA apiFetch calls GET /api/coverage + POST /api/coverage/refresh)
tech_stack:
  added:
    - "coverageRoute: new Hono<Env>() — GET /coverage + POST /coverage/refresh"
    - "refreshLocks: Map<repoKey, Promise<CoverageRefreshResponse>> — CODEX MED-14 per-repo lock"
    - "_resetRefreshLocksForTests(): void — test-only Map reset to prevent cross-test bleed"
  patterns:
    - "CODEX HIGH-1: absPath never emitted — structural guarantee via CoverageRowSchema (no absPath field)"
    - "CODEX HIGH-3 TOCTOU: realpathSync + familyRoot + sep assertion immediately before spawn"
    - "CODEX HIGH-5: updatedRow REQUIRED on kind='ok' via post-spawn scanCoverageInternal() lookup"
    - "CODEX MED-14: per-repo refreshLocks Map serialises concurrent POST /refresh for same {family,repo}"
    - "AGREED-3: discoverRepos() synchronous lookup — NOT a full scanCoverage() call before spawn"
    - "D-10-09: wiki-compile rejected at CoverageRefreshRequestSchema.parse (enum only allows gitnexus-analyze)"
    - "outbound() schema-drift defense on both GET (CoverageResponseSchema) and POST (CoverageRefreshResponseSchema)"
key_files:
  created:
    - packages/agent/src/routes/coverage.ts
    - packages/agent/src/routes/coverage.test.ts
  modified:
    - packages/agent/src/server/app.ts (import + app.route — +2 lines, 0 deletions)
decisions:
  - "repo-not-found returns 400 (not 200 with ok:false) — better HTTP semantics for missing resource"
  - "spawnGitNexusAnalyze throw caught inside inflight async block — maps to {ok:false,kind:error} not 500"
  - "discoverRepos() called before lock acquisition so repo-not-found 400 returns without entering lock"
  - "_resetRefreshLocksForTests() exported to prevent module-level Map from bleeding between tests"
metrics:
  duration: ~45min
  completed: "2026-05-13"
  tasks_completed: 2
  files_changed: 3
---

# Phase 10 Plan 04: Coverage Route (GET /api/coverage + POST /api/coverage/refresh) Summary

Coverage route implemented and mounted. `GET /api/coverage` returns a 30s-TTL-cached `CoverageResponse` with no `absPath` fields (CODEX HIGH-1 structural guarantee). `POST /api/coverage/refresh` accepts only `gitnexus-analyze` (D-10-09 + CODEX HIGH-5), resolves the repo path via synchronous `discoverRepos()` (AGREED-3), re-canonicalises via `realpathSync` immediately before spawn (CODEX HIGH-3 TOCTOU), serialises concurrent same-repo POSTs via an in-memory lock (CODEX MED-14), and returns `updatedRow` REQUIRED on success (CODEX HIGH-5). The route is mounted at `/api` in `app.ts` alongside the 17 existing routes.

## Endpoint Summary

| Endpoint | Method | Auth | Response |
|----------|--------|------|----------|
| `/api/coverage` | GET | Bearer (inherited) | `CoverageResponse` — 200 (cache hit or fresh scan) |
| `/api/coverage/refresh` | POST | Bearer (inherited) | `CoverageRefreshResponse` — 200 ok/fail, 400 validation |

**Cache:** 30s TTL singleton (Plan 03 coverageCache). POST refresh invalidates synchronously so next GET re-scans.

**New routes mounted:** 1 (`coverageRoute` at `/api`).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | coverageRoute GET + POST handlers + 18 tests | 09fa824 | coverage.ts, coverage.test.ts |
| 2 | Mount coverageRoute in app.ts | 81e664a | app.ts (+2 lines) |

## Test Summary

| File | Tests | Green |
|------|-------|-------|
| coverage.test.ts | 18 | Yes |
| Full agent suite | 627 | Yes |

Tests cover: 401 without auth, schema-valid 200, cache-hit (spy called once), cache-invalidation (spy called twice), absPath-leak RED→GREEN (CODEX HIGH-1), wiki-compile 400 RED→GREEN (D-10-09), gitnexus-analyze success with updatedRow, not-installed graceful, spawn-throw caught, malformed body 400, repo-not-found 400, cache-invalidation-then-rescan, TOCTOU rejection (escapedPath outside family root), concurrent same-repo serialisation (spawn once), concurrent different-repo parallel (spawn twice), timeout, error with exitCode+stderr, schema-drift 500.

## Security Contracts Verified

| Contract | Enforcement |
|----------|-------------|
| CODEX HIGH-1: absPath never in public response | `CoverageRowSchema` has no absPath field; `match.absPath` only used for `canonicalAbs` local variable before spawn |
| CODEX HIGH-3 TOCTOU: re-canonicalise before spawn | `realpathSync(match.absPath)` then `startsWith(familyRoot + sep)` assertion immediately before `spawnGitNexusAnalyze` |
| CODEX HIGH-5: updatedRow required on success | `scanCoverageInternal()` called after spawn; `fresh.rows.find(r => r.family === body.family && r.repo === body.repo)` must succeed or route returns error |
| CODEX MED-14: no concurrent double-spawn | `refreshLocks: Map<string, Promise<CoverageRefreshResponse>>` — second concurrent POST awaits first's in-flight promise |
| D-10-09: wiki-compile rejected at parse | `CoverageRefreshActionSchema = z.enum(['gitnexus-analyze'])` — any other value fails Zod parse → 400 |
| AGREED-3: no full re-scan before spawn | `discoverRepos()` synchronous lookup only; `scanCoverage()` NOT called before spawn; `scanCoverageInternal()` called only AFTER spawn to get updatedRow |
| T-10-04-01: bearer auth inherited | Route inside `createApp`'s middleware chain; no per-route auth code |
| T-10-04-02: request body validation | `CoverageRefreshRequestSchema.parse(await c.req.json())` — throws → 400 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] repo-not-found returns 400 not 200/ok:false**
- **Found during:** Task 1 test authoring
- **Issue:** Plan sketch showed `{ok:false,kind:'error'}` for repo-not-found, returned via `outbound()` with 200. The test specification required 400 for "repo not found in discovery set" (explicit in `<behavior>` list).
- **Fix:** `discoverRepos()` and repo match check moved BEFORE the lock acquisition block. When no match found, `c.json({ ok:false, error:'repo_not_found' }, 400)` returned immediately.
- **Files modified:** `packages/agent/src/routes/coverage.ts`
- **Commit:** 09fa824

**2. [Rule 1 - Bug] Module-level refreshLocks Map bleeds across tests**
- **Found during:** Task 1 test execution
- **Issue:** `refreshLocks` is module-level state. After the CODEX MED-14 concurrent test, subsequent tests that called `vi.clearAllMocks()` did not reset the Map. If the concurrent test left an in-flight promise (due to timing), later tests stalled waiting for the same `{family,repo}` lock.
- **Fix:** Exported `_resetRefreshLocksForTests()` from `coverage.ts`; called it in both `beforeEach` and `afterEach` across all test groups.
- **Files modified:** `packages/agent/src/routes/coverage.ts`, `packages/agent/src/routes/coverage.test.ts`
- **Commit:** 09fa824

**3. [Rule 1 - Bug] Concurrent test: resolveSpawn not yet assigned when called**
- **Found during:** Task 1 test execution (CODEX MED-14 test)
- **Issue:** Original test used `let resolveSpawn!: () => void` and `mockImplementationOnce(() => new Promise(resolve => { resolveSpawn = resolve }))` then called `resolveSpawn()` before both requests had entered the handler. `resolveSpawn` was still `undefined` at call time.
- **Fix:** Created the deferred promise BEFORE mocking: `const spawnPromise = new Promise(resolve => { resolveSpawn = resolve })`, then `mockImplementation(() => spawnPromise)`. Added `await new Promise(r => setTimeout(r, 10))` to allow both requests to enter their handlers before resolving.
- **Files modified:** `packages/agent/src/routes/coverage.test.ts`
- **Commit:** 09fa824

**4. [Rule 1 - Bug] TypeScript strict-mode: res.json() returns unknown — body properties inaccessible**
- **Found during:** Task 2 typecheck
- **Issue:** `pnpm typecheck` failed with 16 `TS18046: 'body' is of type 'unknown'` errors across all POST-response body assertions.
- **Fix:** Added `as Record<string, unknown>` casts to all `res.json()` calls that access body properties. Specific nested objects (e.g. `updatedRow`) cast to `Record<string, unknown>` inline.
- **Files modified:** `packages/agent/src/routes/coverage.test.ts`
- **Commit:** 09fa824

## Known Stubs

None. Both endpoints are fully implemented:
- `GET /api/coverage` — real cache + real scan orchestrator call
- `POST /api/coverage/refresh` — real Zod validation + real discoverRepos + real realpathSync + real spawn dispatch + real post-spawn re-scan

## Threat Flags

None. No new network endpoints beyond the two planned. Trust boundary is SPA ↔ daemon (bearer auth inherited). All STRIDE items from the plan's threat register are mitigated as designed.

## Self-Check: PASSED

Files created:
- `packages/agent/src/routes/coverage.ts` — exists (146 lines, coverageRoute exported)
- `packages/agent/src/routes/coverage.test.ts` — exists (18 tests, 0 todo)

Files modified:
- `packages/agent/src/server/app.ts` — `grep "coverageRoute"` returns 2 hits (import + mount)

Commits verified:
- 09fa824 — Task 1: coverage route + tests
- 81e664a — Task 2: app.ts mount

Test results:
- `coverage.test.ts` direct run: 18/18 passed
- Full agent suite: 627/627 passed (69 test files)
- Typecheck: exit 0
- Build: exit 0
