---
phase: 12
plan: 02
subsystem: daemon-wire-surface
tags:
  - conformance
  - daemon
  - registry-mutation
  - tdd
  - threat-model
  - bearer-auth
  - cache
dependency_graph:
  requires:
    - "Wave 0 (12-00): ConformanceResponseSchema, PathDriftEntrySchema, RegistryFixPathRequestSchema, RETENTION_DAYS=90"
    - "Wave 1 (12-01): computeConformanceScores, readDailySeriesForFleet"
    - "Phase 10: scanCoverageInternal, COVERAGE_ROOTS, coverageCache, outbound() middleware"
    - "Phase 1: writeRegistry then atomicWriteFile, assertRegistrationAllowed, RegistrationPathBlocked, canonicaliseRoot, rateLimiter (consume + tokenHashOf)"
  provides:
    - "conformanceCache (30s TTL singleton — 5 named exports)"
    - "detectPathDrift(opts?) — defensive drift detector, NEVER raises"
    - "inferSuggestedPath(originUrl) — best-effort family-root scan via fs.readFile + regex (NO subprocess)"
    - "scanConformance(opts?) — Wave 2 orchestrator composing Wave 1 primitives + drift detector"
    - "GET /api/observability/conformance — bearer-auth + CORS + 30s cache + outbound() schema-drift defence"
    - "POST /api/admin/registry/fix-path — 11 threat mitigations, rate-limited, atomic write"
  affects:
    - "Wave 3 (12-03): FleetTrendChart consumes ConformanceResponse.series + delta14d"
    - "Wave 3 (12-04): FamilyCard consumes ConformanceResponse.today.{family} + delta14d.{family}"
    - "Wave 4 (12-06): PathDriftPanel POSTs to /api/admin/registry/fix-path"
tech-stack:
  added: []
  patterns:
    - "Sibling-endpoint discipline (D-11-11 / D-12-02) — /observability/conformance + /admin/registry/fix-path are new routes, NOT extensions of existing endpoints"
    - "30s TTL singleton cache (Phase 10 coverageCache pattern) — module-scoped let, 5 named exports verbatim"
    - "Defensive orchestrator — Promise.allSettled + try/catch isolation so partial failures never 500 the route"
    - "Threat-test-per-row — every row in plan §threat_model has at least one explicit fixture; 17 tests in registryFixPath.test.ts"
    - "Realpath-everywhere for symlink defence (Pitfall 7) — newPath canonicalised BEFORE blocklist + containment checks"
    - ".git/config remote.origin.url via fs.readFile + regex (NO subprocess) — RESEARCH §Environment availability fallback (T-12-SUPPLY-CHAIN)"
key-files:
  created:
    - "packages/agent/src/lib/conformanceCache.ts (72 lines) — 30s TTL singleton"
    - "packages/agent/src/lib/conformanceCache.test.ts (109 lines) — 10 cache-semantics tests"
    - "packages/agent/src/lib/registryPathDrift.ts (255 lines) — detector + inferSuggestedPath"
    - "packages/agent/src/lib/registryPathDrift.test.ts (284 lines) — 13 detector + inference tests"
    - "packages/agent/src/lib/conformanceScan.ts (192 lines) — Wave 2 orchestrator"
    - "packages/agent/src/lib/conformanceScan.test.ts (227 lines) — 11 composition + delta14d + failure-isolation tests"
    - "packages/agent/src/routes/conformance.ts (47 lines) — GET /api/observability/conformance"
    - "packages/agent/src/routes/conformance.test.ts (195 lines) — 9 route + auth + cache + CORS + schema-drift tests"
    - "packages/agent/src/routes/registryFixPath.ts (165 lines) — POST /api/admin/registry/fix-path"
    - "packages/agent/src/routes/registryFixPath.test.ts (510 lines) — 17 threat-model tests"
  modified:
    - "packages/agent/src/server/app.ts — imports + mounts conformanceRoute (/api) + registryFixPathRoute (/api/admin)"
decisions:
  - "A4 ratified empirically (concurrent-write protection): NO proper-lockfile added. atomicWriteFile (POSIX rename + O_NOFOLLOW + O_EXCL) + rate-limiter (10/10s/token) bound concurrent fix-path races to last-write-wins semantics. The Test 16 idempotency assertion plus Test 11 atomic-write assertion together cover the threat surface; no in-process Mutex needed for v1.2.0."
  - "A7 ratified empirically (newPath validation reuse): assertRegistrationAllowed's existing blocklist (18 system roots + 9 secret dirs + CONFIG_DIR) is sufficient. Tests 4 + 5 cover system + secret cases respectively; no new blocklist entries required."
  - "Symlink-target-changed detection compares realpath(storedPath) vs storedPath itself (not vs canonicaliseRoot). Registration canonicalises before storing (registry.ts:addProject), so the stored root SHOULD equal its own realpath. Divergence means the symlink was re-pointed since registration OR the registry was tampered with — both are drift cases the SPA can repair via fix-path. Documented inline in registryPathDrift.ts header."
  - "pathToRepoId in conformanceScan uses '/' literal (not sep) for repo-ID construction. Repo IDs are wire-format strings (`${family}/${repo}`); they must be POSIX-style regardless of the host OS so they round-trip through NDJSON snapshots written on any platform. The realpath-side containment uses sep correctly."
  - "fix-path response includes the blocked-reason detail on T-12-PATH-TRAVERSAL hits. Mirrors Phase 1 register-prepare pattern: the reason describes the user-supplied input (which the user already knows), NOT a server internal. Test 15 verifies no FS-internal paths (registry.json, atomicWriteFile, /.agenticapps/dashboard) leak in errors."
metrics:
  duration: "~18 min"
  completed: "2026-05-20T06:06:06Z"
requirements_completed:
  - REQ-12-CON-04
  - REQ-12-CON-05
  - REQ-12-RPD-01
  - REQ-12-RPD-02
  - REQ-12-RPD-03
---

# Phase 12 Plan 02: Wave 2 daemon wire surface Summary

**Five new daemon files + one app.ts mount — GET /api/observability/conformance (bulk-per-family payload) and POST /api/admin/registry/fix-path (the Phase 12 threat surface) plus the cache + drift detector + orchestrator that compose Wave 1 into a fully working wire surface. 60 atomic tests, 11 threat mitigations, zero new runtime deps.**

## Performance

- **Duration:** ~18 min wall-clock
- **Started:** 2026-05-20T05:48:00Z
- **Completed:** 2026-05-20T06:06:06Z
- **Tasks:** 5 (all TDD red-green)
- **Files created:** 10 (5 source + 5 test)
- **Files modified:** 1 (app.ts — 2 imports + 2 mount lines)
- **Atomic commits:** 10 (exactly 2 per task)
- **Test budget delta:** +60 tests (838 total, +60 vs Wave 1 close at 778)

## Accomplishments

- **Locked the daemon wire surface for Phase 12.** Both routes are reachable and return wire-shape-valid payloads via the strict `ConformanceResponseSchema` / `RegistryEntrySchema` round-trip. Wave 3 SPA consumers (Plans 12-03 + 12-04) can `fetch('/api/observability/conformance', { headers: { Authorization: 'Bearer ...' }})` and trust the shape. Wave 4 SPA fix-path consumer (Plan 12-06) can POST to `/api/admin/registry/fix-path` and trust the 9 distinct error codes for UI branching.
- **Composed Wave 1 primitives into a working orchestrator (12-01 then 12-02 contract closed).** `scanConformance` calls `scanCoverageInternal` + `detectPathDrift` in parallel via `Promise.allSettled`, derives drifted repo IDs via family-root prefix matching, fans the drift set into `computeConformanceScores` for today's per-family + fleet scores, reads the 90-day NDJSON series via `readDailySeriesForFleet`, and computes `delta14d = today − series[length-15]` when the window has at least 15 entries.
- **17 threat tests cover every row in the plan's `<threat_model>`** — the `registryFixPath.test.ts` file is the inline `/cso` input (D-12-26). The fixture sandboxes `COVERAGE_ROOTS.agenticapps` so tests can exercise family-root containment without depending on the actual `~/Sourcecode/agenticapps` directory.
- **Zero new runtime deps (T-12-SUPPLY-CHAIN cleared).** `git diff -- packages/agent/package.json packages/shared/package.json` returns empty between f225ffe (Wave 1 close) and HEAD. All defences use `node:fs/promises` + `node:path` + existing workspace deps (`hono`, `zod`, `@hono/zod-validator`). Drift detection's `.git/config` parsing is `fs.readFile + regex` — no spawned subprocess, matching RESEARCH §Environment availability fallback.
- **Full agent suite stayed green** — 838/838 tests pass after Plan 12-02; 778/778 was the Wave 1 close baseline; delta is +60 new tests with zero regression on Phase 1 registry tests, Phase 10 coverage tests, or Phase 11 trends/skill-drift tests.

## Task-by-task

### Task 1: conformanceCache.ts (30s TTL singleton)

Mirrors `coverageCache.ts` verbatim (type swap `CoverageResponse` then `ConformanceResponse`). Five named exports: `TTL_MS = 30_000`, `getConformanceCache(now?)`, `setConformanceCache(value, now?)`, `invalidateConformanceCache()`, `_resetConformanceCacheForTests()`. 10 tests cover TTL boundary semantics (`t + TTL_MS - 1` then hit, `t + TTL_MS` then miss), replace-on-set, invalidate clearing, and the `Date.now()` default-arg round-trip.

Commits: `e887416` (test) + `8a85204` (feat).

### Task 2: registryPathDrift.ts (detector + suggested-path inference)

Detector emits three reasons:
- `missing` — `existsSync(storedPath) === false`
- `symlink-target-changed` — `realpath(storedPath) !== storedPath` (registration canonicalises before storing, so divergence means the symlink was re-pointed OR the registry was tampered with)
- `git-remote-changed` — stored path is not under any family root (the inverse of `assertRegistrationAllowed`'s allow check)

`inferSuggestedPath(originUrl)` walks each of the three family roots one level deep, reads each candidate's `.git/config` via `fs.readFile` (NOT a spawned subprocess), regex-parses `[remote "origin"] url`, and returns the first matching candidate's realpath. NEVER raises — all fs operations are try/catch-bounded; the verifiable grep `throw ` count is 0 in the source file.

13 tests cover all three drift reasons, registry-read-failure then `[]`, symlink-loop resilience, output strictly parses `PathDriftEntrySchema`, inference success/null cases, and a SECURITY test ensuring `.git/config` is only read inside family roots (an identical-URL candidate outside is not discoverable).

Commits: `0449373` (test) + `c544127` (feat).

### Task 3: conformanceScan.ts (Wave 2 orchestrator)

Composes Wave 1 + Task 2:

```
const [coverageResult, driftedResult] = await Promise.allSettled([scanCoverageInternal(), detectPathDrift()])
const driftedRepoIds = new Set()
for (const entry of driftedEntries) driftedRepoIds.add(pathToRepoId(entry.storedPath) ?? '')
const scores = computeConformanceScores(coverage, driftedRepoIds)
const series = await readDailySeriesForFleet({ driftedRepoIds, now })
const delta14d = series.length >= 15
  ? today − series[length-15]
  : zeros
```

11 tests cover the composition contract: today scores delegated correctly, series delegated correctly, drifted delegated correctly, `delta14d` math at the 15-entry threshold, partial-failure isolation (scan raise then defensive payload, reader raise then series=[]), and full `ConformanceResponseSchema.strict()` round-trip.

Commits: `0363403` (test) + `d4bffbd` (feat).

### Task 4: routes/conformance.ts (GET /api/observability/conformance)

Mirrors `coverageHistory.ts` pattern verbatim — bearer-auth + CORS inherited from app middleware, 30s cache short-circuit via `getConformanceCache`, `outbound()` schema-drift defence on the response. No query params (D-12-16 bulk-per-family is single-fetch). Mounted under `/api` so the final URL is `/api/observability/conformance`.

9 tests cover bearer-auth 401, 200 + `ConformanceResponseSchema.strict()` round-trip, cache hit (no re-scan within TTL), cache miss after TTL (re-scan), CORS preflight for both `PROD_ORIGIN` and `DEV_ORIGIN`, and schema-drift then 500.

Commits: `490c1a4` (test) + `ceb0744` (feat).

### Task 5: routes/registryFixPath.ts (POST /api/admin/registry/fix-path)

THE Phase 12 write surface. Nine-step validation pipeline (first failure short-circuits):

1. Zod `.strict()` parse → 422 `invalid_request`
2. Rate-limit per token-hash (10/10s) → 429 `rate_limited` + `Retry-After: 1`
3. `canonicaliseRoot(newPath)` realpath + abs → 422 `newPath_unresolvable`
4. `assertRegistrationAllowed(canonical)` blocklist (18 system + 9 secret + CONFIG_DIR) → 422 `newPath_blocked` + reason detail
5. Family-root containment via realpath of each `COVERAGE_ROOT` → 422 `newPath_outside_family_roots`
6. `readRegistry` + find by id → 404 `project_not_found`
7. `entry.root = canonical; writeRegistry(reg)` — atomic write via `atomicWriteFile` (O_NOFOLLOW + O_EXCL + 0o600)
8. `invalidateConformanceCache() + invalidateCoverageCache()` — T-12-CACHE-STALE
9. `outbound(RegistryEntrySchema.parse, entry)` → 500 `schema_drift` on parse failure

Mounted under `/api/admin` so the final URL is `/api/admin/registry/fix-path`.

17 threat tests cover every row in the plan's `<threat_model>`. The fixture sandboxes `COVERAGE_ROOTS.agenticapps` to point into an in-test family root so tests can exercise containment without touching `~/Sourcecode/agenticapps`. Test 16 verifies idempotency (T-12-IDEMPOTENT-FAIL); Test 15 verifies no FS-internal paths (registry.json / atomicWriteFile / /.agenticapps/dashboard) leak in error responses (T-12-INFO-DISCLOSURE).

Commits: `c1472a8` (test) + `bc5bce0` (feat).

## Threat-Model Verification (all 11 rows mitigated)

| Threat ID | Test ID | Status |
|-----------|---------|--------|
| T-12-PATH-TRAVERSAL | Tests 4, 5, 7 | green |
| T-12-SYMLINK-ESCAPE | Test 8 | green |
| T-12-CONCURRENT-WRITE | Test 11 (atomic) + Test 13 (rate) | green |
| T-12-CSRF | Tests 7-8 of conformance.test.ts (CORS) | green |
| T-12-AUTH | Test 1 (registryFixPath) + Test 1 (conformance) | green |
| T-12-INFO-DISCLOSURE | Test 15 | green |
| T-12-REGISTRY-CORRUPTION | Test 12 (mode 0o600) | green |
| T-12-DENIAL-OF-SERVICE | Test 13 (rate-limit 429 + Retry-After) | green |
| T-12-SUPPLY-CHAIN | `git diff -- package.json` returns empty | green |
| T-12-IDEMPOTENT-FAIL | Test 16 | green (accept per plan disposition) |
| T-12-CACHE-STALE | Test 14 | green |

**For /cso (Wave 6):** the threat model is captured inline as fixture tests. The audit should verify the implementation matches the test expectations — every error code in `registryFixPath.ts` has a corresponding test in `registryFixPath.test.ts`, and every step in the validation pipeline is exercised by at least one test.

## Decisions Made

- **A4 ratified empirically** — no `proper-lockfile`. `atomicWriteFile` + rate limiter handle concurrent fix-path races. Test 16 (idempotent) + Test 11 (atomic content) cover the threat surface.
- **A7 ratified empirically** — `assertRegistrationAllowed`'s existing blocklist is sufficient. Tests 4 + 5 confirm system + secret cases respectively.
- **Symlink-target-changed compares realpath(stored) vs stored itself** — not vs `canonicaliseRoot(stored)`, because `canonicaliseRoot` and `realpath` would always agree on a readable file. Registration canonicalises before storing, so divergence between stored and realpath means the symlink moved or the registry was tampered with. Documented inline in `registryPathDrift.ts:155-160`.
- **`pathToRepoId` uses literal `/`** — repo IDs are POSIX-style wire strings that round-trip through NDJSON snapshots written on any OS. The realpath-side containment correctly uses `sep`.
- **`newPath_blocked` echoes the blocked reason** — Phase 1 register-prepare pattern. The reason describes user input (which the user already knows), NOT a server internal. Test 15 confirms no server-internal paths leak.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `packages/shared/dist` was stale from before Wave 0**
- **Found during:** Task 2 first test run — `PathDriftEntrySchema.parse` was undefined at runtime.
- **Issue:** Wave 0 minted the conformance schema in source but had not republished the shared `dist/` bundle. The agent package consumes `@agenticapps/dashboard-shared` via its dist export, so all new schemas (PathDriftEntrySchema, ConformanceResponseSchema, RegistryFixPathRequestSchema) were absent at runtime even though they were present in source.
- **Fix:** Ran `pnpm --filter @agenticapps/dashboard-shared build` to republish `dist/index.js` with the Wave 0 schemas included.
- **Files modified:** None (dist is gitignored).
- **Out of scope for Plan 12-02 commit history:** the dist rebuild is a workspace-level housekeeping step. Future Wave 0 plans should include `pnpm --filter @agenticapps/dashboard-shared build` in the post-task verification step so consumers don't trip on stale dist.

**2. [Rule 1 - Bug] TypeScript exactOptionalPropertyTypes rejected mocked COVERAGE_ROOTS reassignment**
- **Found during:** Task 2 typecheck after RED test was committed.
- **Issue:** `COVERAGE_ROOTS` is `as const`; the test helper `pointFamilyRoot` tried to reassign one slot via `vi.mocked(COVERAGE_ROOTS)[family] = …`, which TypeScript correctly rejects as a readonly violation.
- **Fix:** Cast through `Record<string, () => string>` to bypass readonly at the test boundary only. Production code is unaffected — the production `COVERAGE_ROOTS` remains `as const`.
- **Files modified:** `packages/agent/src/lib/registryPathDrift.test.ts:71-75`.
- **Commit:** rolled into Task 2 GREEN commit `c544127`.

**3. [Rule 1 - Bug] Optional regex match index `match[1]` could be undefined under noUncheckedIndexedAccess**
- **Found during:** Task 2 typecheck.
- **Issue:** `REMOTE_ORIGIN_URL_RE.exec(text)[1]` is typed `string | undefined` under strict TS; the original `return match ? match[1].trim() : null` failed typecheck.
- **Fix:** Two-step guard: `if (!match || !match[1]) return null; return match[1].trim()`.
- **Files modified:** `packages/agent/src/lib/registryPathDrift.ts:61-65`.
- **Commit:** rolled into Task 2 GREEN commit `c544127`.

**4. [Rule 1 - Bug] Hono Context `.get('requestId')` typing inside `zValidator` callback**
- **Found during:** Task 5 typecheck after GREEN.
- **Issue:** The `zValidator` callback's `c` parameter is typed as `never`-keyed in some Hono versions; direct `c.get('requestId')` failed TS2769. Existing `registry.ts:55-59` uses the same `((c as any).get?.('requestId') as string | undefined) ?? 'unknown'` workaround.
- **Fix:** Mirror the existing pattern (cast through `any` + optional chaining + `?? 'unknown'` fallback).
- **Files modified:** `packages/agent/src/routes/registryFixPath.ts:98-101`.
- **Commit:** rolled into Task 5 GREEN commit `bc5bce0`.

## Issues Encountered

None blocking. The four auto-fixes above were anticipated boundary cases (one stale-dist, one TS-readonly, one TS-strict-index, one Hono-context typing). All rolled into their respective GREEN commits per TDD discipline — RED predecessors stayed RED for the right reason in each case.

Full workspace verification at plan close:
- `pnpm --filter @agenticapps/dashboard-agent test --run`: 838/838 passing (baseline 778 + 60 new — exact delta match per task budget)
- `pnpm -r typecheck`: clean across all 5 packages
- `pnpm --filter @agenticapps/dashboard-agent build`: green; `node packages/agent/dist/cli.js --help` returns the full command list
- `git diff f225ffe..HEAD -- packages/agent/package.json packages/shared/package.json`: empty (T-12-SUPPLY-CHAIN confirmed)

## What Wave 3 / Wave 4 Unblocks

Wave 3 SPA consumers (Plans 12-03 + 12-04):
- `useConformance()` query hook can `fetch('/api/observability/conformance', { headers })` and trust `ConformanceResponseSchema.parse` on the response
- `FleetTrendChart` consumes `response.series` (90-day per-family per-day) + `response.delta14d` for the headline tile
- `FamilyCard` consumes `response.today.{family}` + `response.delta14d.{family}` + `tierOf(score)` for color mapping
- `PathDriftPanel` consumes `response.drifted` for the collapsible panel above the family cards

Wave 4 SPA fix-path consumer (Plan 12-06):
- `PathDriftPanel` POSTs `{ id, newPath }` to `/api/admin/registry/fix-path` and branches on the 6 distinct error codes (`invalid_request`, `rate_limited`, `newPath_unresolvable`, `newPath_blocked`, `newPath_outside_family_roots`, `project_not_found`) for UI feedback via the Phase 11.1 `Toast` primitive
- On 200, the SPA invalidates `useConformance()` + `useCoverage()` queries (mirrors the daemon's cache invalidation step 8)

Wave 6 `/cso` audit (D-12-26):
- The threat-model rows + their fixture mappings (above) are the audit input. Every row in `<threat_model>` has at least one passing test in `registryFixPath.test.ts`.
- `/cso` should additionally verify: (a) `outbound()` is the ONLY response path on success; (b) `writeRegistry` is the ONLY mutation path; (c) `rlConsume` is called before any expensive validation work; (d) `realpath` is awaited BEFORE the family-root containment check (Pitfall 7).

## Self-Check: PASSED

- `packages/agent/src/lib/conformanceCache.ts`: FOUND
- `packages/agent/src/lib/conformanceCache.test.ts`: FOUND
- `packages/agent/src/lib/registryPathDrift.ts`: FOUND
- `packages/agent/src/lib/registryPathDrift.test.ts`: FOUND
- `packages/agent/src/lib/conformanceScan.ts`: FOUND
- `packages/agent/src/lib/conformanceScan.test.ts`: FOUND
- `packages/agent/src/routes/conformance.ts`: FOUND
- `packages/agent/src/routes/conformance.test.ts`: FOUND
- `packages/agent/src/routes/registryFixPath.ts`: FOUND
- `packages/agent/src/routes/registryFixPath.test.ts`: FOUND
- `packages/agent/src/server/app.ts`: FOUND (modified — `conformanceRoute` + `registryFixPathRoute` import + mount)
- Commit `e887416` (test conformanceCache RED): FOUND
- Commit `8a85204` (feat conformanceCache GREEN): FOUND
- Commit `0449373` (test registryPathDrift RED): FOUND
- Commit `c544127` (feat registryPathDrift GREEN): FOUND
- Commit `0363403` (test conformanceScan RED): FOUND
- Commit `d4bffbd` (feat conformanceScan GREEN): FOUND
- Commit `490c1a4` (test conformance route RED): FOUND
- Commit `ceb0744` (feat conformance route GREEN): FOUND
- Commit `c1472a8` (test registryFixPath threat coverage RED): FOUND
- Commit `bc5bce0` (feat registryFixPath GREEN): FOUND
- `grep -c "TTL_MS = 30_000" packages/agent/src/lib/conformanceCache.ts`: returns 1
- `grep -c "remote.*origin" packages/agent/src/lib/registryPathDrift.ts`: returns 5 (>=1 required)
- subprocess module references in registryPathDrift.ts: returns 0
- `grep -c "throw " packages/agent/src/lib/registryPathDrift.ts`: returns 0 (NEVER raises)
- `grep -c "ConformanceResponseSchema.parse" packages/agent/src/lib/conformanceScan.test.ts`: returns 3 (>=1 required)
- `grep -c "conformanceRoute" packages/agent/src/server/app.ts`: returns 2 (import + mount)
- `grep -c "registryFixPathRoute" packages/agent/src/server/app.ts`: returns 2 (import + mount)
- Error-code regex match count in registryFixPath.ts (newPath_outside_family_roots / newPath_blocked / newPath_unresolvable / project_not_found / rate_limited / invalid_request): returns 12 (>=6 required)
- `grep -c "writeRegistry" packages/agent/src/routes/registryFixPath.ts`: returns 4 (>=1 required)
- Full agent suite (`pnpm --filter @agenticapps/dashboard-agent test --run`): 838/838 green
- Workspace typecheck (`pnpm -r typecheck`): clean
- Agent build (`pnpm --filter @agenticapps/dashboard-agent build`): green; CLI loads
- Package.json diff vs Wave 1 close: empty (T-12-SUPPLY-CHAIN)

---

*Phase: 12-observability-conformance-surface*
*Plan: 02 — Wave 2 daemon wire surface*
*Completed: 2026-05-20*
