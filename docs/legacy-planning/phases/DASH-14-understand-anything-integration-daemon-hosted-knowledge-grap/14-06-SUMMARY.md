---
phase: 14-understand-anything-integration-daemon-hosted-knowledge-grap
plan: "06"
subsystem: agent
tags: [understand-anything, scanner, coverage, health, tdd, d-14-08, d-14-03, d-14-02]
dependency_graph:
  requires: [14-01, 14-02]
  provides: [understand-column-in-coverage-rows, health-understand-block]
  affects: [packages/agent/src/lib/scanners/, packages/agent/src/lib/coverageScan.ts, packages/agent/src/routes/health.ts]
tech_stack:
  added: []
  patterns:
    - understandScanner: pure FS scanner (readRepoHeadSha + scanUnderstandForRepo) — Phase 10.6 detection-without-execution discipline
    - mintViewerToken: uses in-memory activeViewerSecret for per-call HMAC mint (no extra file I/O)
    - AGREED-2: Promise.allSettled 6th slot — scanner rejection yields degraded missing row
key_files:
  created:
    - packages/agent/src/lib/scanners/understandScanner.ts
    - packages/agent/src/lib/scanners/understandScanner.test.ts
  modified:
    - packages/agent/src/lib/coverageScan.ts
    - packages/agent/src/lib/coverageScan.test.ts
    - packages/agent/src/routes/health.ts
    - packages/agent/src/routes/health.test.ts
    - packages/agent/src/lib/viewerToken.ts
decisions:
  - mintViewerToken uses in-memory activeViewerSecret instead of re-reading file on every call (matches auth.ts pattern; avoids per-call file I/O)
  - viewerInstall mocks added as defaults in health.test.ts beforeEach (null = viewer not installed) to prevent schema drift on pre-existing tests after understand block addition
metrics:
  duration: ~13 minutes
  completed: 2026-06-07
  tasks: 3
  files: 7
---

# Phase 14 Plan 06: understand-anything Scanner Integration — Coverage Rows + Health Block Summary

**One-liner:** Pure FS staleness detection (fresh/stale/missing) wired into coverage rows via HMAC-bound per-repo viewer tokens, and viewer install/version detection exposed on /health, all TDD with 9+4+10=23 new tests.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | understandScanner.ts — readRepoHeadSha + scanUnderstandForRepo | 449d044 (RED) / ede1f1f (GREEN) | understandScanner.ts, understandScanner.test.ts |
| 2 | coverageScan.ts integration — understand column + viewerToken mint | e244fcd (RED) / 4384587 (GREEN) | coverageScan.ts, coverageScan.test.ts, viewerToken.ts |
| 3 | /health understand block | f125a25 (RED) / 48f03c6 (GREEN) | health.ts, health.test.ts, coverageScan.test.ts |

## What Was Built

### Task 1: understandScanner.ts

New `packages/agent/src/lib/scanners/understandScanner.ts` with:
- `readRepoHeadSha(repoRoot)` — pure FS reading of `.git/HEAD` → ref form + branch ref file + packed-refs fallback + detached HEAD. Returns `null` on any I/O error. No subprocess.
- `scanUnderstandForRepo(repoRoot, currentHeadSha)` — reads `.understand-anything/meta.json`; returns `{ state: 'fresh' | 'stale' | 'missing', lastAnalyzedAt?, analyzedCommit?, analyzedFiles? }`. Full SHA equality required for 'fresh'; null head SHA → 'stale' (conservative). Malformed JSON → 'missing', never throws (T-14-06-01).

Test coverage: 4 behavior groups, 9 tests (ref/detached/packed-refs/no-.git + fresh/stale/missing/malformed/null-head).

### Task 2: coverageScan.ts understand column

`buildRow()` extended with a 6th `Promise.allSettled` slot:
- `scanUnderstandForRepo(repoAbsPath, readRepoHeadSha(repoAbsPath))` — runs in parallel with the 5 existing scanners
- Fresh/stale rows get `viewerToken: mintViewerToken(repoId)` where `repoId = 'family/repo'` (HMAC-bound per D-14-03)
- Missing rows: `understand = { kind: 'basic', state: 'missing' }` — viewerToken key is ABSENT (not present)
- Scanner rejection: AGREED-2 degraded path — `{ kind: 'basic', state: 'missing', degraded: true, degradedReason }` + `rowDegraded` entry

`viewerToken.ts` change: `mintViewerToken` uses `activeViewerSecret` when loaded (avoids redundant file I/O per call; same pattern as auth.ts `getActiveToken()`).

Test coverage: 4 new tests (fresh+token roundtrip, stale+token, missing-no-token, degraded schema shape).

### Task 3: /health understand block

`health.ts` extended with `understand: { viewerInstalled, viewerVersion, pluginVersion, updateAvailable }` per D-14-02:
- Calls `getInstalledViewerVersion()` + `getNewestPluginCacheVersion()` per-request (pure stat/readdir)
- `updateAvailable = viewerVersion !== null && pluginVersion !== null && viewerVersion !== pluginVersion`
- T-14-06-03 safety: no token in health block; negative assertion test verifies no `"viewerToken"` or `"token"` in serialized response

Test coverage: 4 new tests (same version → false, newer plugin → true, nothing installed, negative token assertion) + default mock setup for pre-existing 6 tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Auto-add] mintViewerToken uses in-memory activeViewerSecret**
- **Found during:** Task 2 implementation — mintViewerToken re-read the file on every call
- **Fix:** Modified mintViewerToken to use `activeViewerSecret` when loaded (set by `ensureViewerSecretFile` at startup), falling back to file read only when the in-memory ref is empty. This matches the auth.ts `getActiveToken()` pattern and avoids per-call I/O.
- **Files modified:** packages/agent/src/lib/viewerToken.ts
- **Commit:** 4384587

**2. [Rule 1 - Bug] health.test.ts: pre-existing tests broke after understand block addition**
- **Found during:** Task 3 GREEN — Tests 1, 4, 5, 6 returned 500 (schema drift) after adding the understand block
- **Issue:** `vi.resetAllMocks()` in `beforeEach` reset viewerInstall mocks to return `undefined`. The schema expects `viewerVersion: z.string().nullable()` (not undefined). The outbound parse then failed.
- **Fix:** Added default mock values (`mockReturnValue(null)`) for `getInstalledViewerVersion` and `getNewestPluginCacheVersion` in `beforeEach`.
- **Files modified:** packages/agent/src/routes/health.test.ts
- **Commit:** 48f03c6

**3. [Rule 1 - Bug] coverageScan.test.ts TypeScript strict access errors**
- **Found during:** Task 3 typecheck — `row` possibly undefined from `result.rows[0]`
- **Fix:** Added non-null assertion `result.rows[0]!` at 3 sites (guarded by preceding `expect(result.rows).toHaveLength(1)`)
- **Files modified:** packages/agent/src/lib/coverageScan.test.ts
- **Commit:** 48f03c6

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| Task 1 RED | 449d044 | Module not found — confirmed failing |
| Task 1 GREEN | ede1f1f | 9/9 tests pass |
| Task 2 RED | e244fcd | Tests 1-3 failing (understand column absent) |
| Task 2 GREEN | 4384587 | 18/18 tests pass |
| Task 3 RED | f125a25 | Tests 7-9 failing (understand block absent from health) |
| Task 3 GREEN | 48f03c6 | 10/10 tests pass |

## Threat Surface Scan

No new network endpoints or trust boundaries beyond what was in the plan's threat model. The `understand` block in `/health` carries versions only (no tokens) per T-14-06-03. Per-repo viewer tokens travel in `CoverageRow.understand.viewerToken` behind the existing bearer-auth coverage route.

## Verification Results

- `pnpm --filter @agenticapps/dashboard-agent test` — 104 test files, 1002 tests pass (1 skipped)
- `pnpm -r typecheck` — all packages pass (agent, shared, spa, agentlinter, meta-observer)
- `grep -cE "execa|execSync|spawn" understandScanner.ts` — 1 (in comment only; zero in executable code)
- D-14-08 family (fresh/stale/missing) fully covered: understandScanner.test.ts (9 tests) + coverageScan.test.ts (4 tests)
- D-14-03 token roundtrip: Test 1 verifies `verifyViewerToken(mintedToken, secretPath) === 'agenticapps/my-repo'`
- T-14-06-03 negative assertion: serialized /health response contains no `"viewerToken"` or `"token"`

## Self-Check

### Files Created/Modified

- [x] packages/agent/src/lib/scanners/understandScanner.ts — FOUND
- [x] packages/agent/src/lib/scanners/understandScanner.test.ts — FOUND
- [x] packages/agent/src/lib/coverageScan.ts — FOUND
- [x] packages/agent/src/lib/coverageScan.test.ts — FOUND
- [x] packages/agent/src/routes/health.ts — FOUND
- [x] packages/agent/src/routes/health.test.ts — FOUND
- [x] packages/agent/src/lib/viewerToken.ts — FOUND

### Commits

- 449d044 — test(14-06): RED understandScanner — FOUND
- ede1f1f — feat(14-06): GREEN understandScanner — FOUND
- e244fcd — test(14-06): RED coverageScan understand column — FOUND
- 4384587 — feat(14-06): GREEN coverageScan understand column — FOUND
- f125a25 — test(14-06): RED health understand block — FOUND
- 48f03c6 — feat(14-06): GREEN health understand block — FOUND

## Self-Check: PASSED
