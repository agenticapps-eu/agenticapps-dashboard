---
phase: 11-coverage-trends-skill-drift
plan: 03
subsystem: daemon-skill-drift
tags: [daemon, skills, aggregator, route, agentlinter, tdd, security-spawn-surface]

# Dependency graph
requires:
  - phase: 11
    plan: 01
    provides: SkillDriftResponseSchema + AgentLinterResponseSchema reused via @agenticapps/dashboard-shared barrel
  - phase: 5
    provides: readLocalSkills (skillsScan.ts), runAgentLinter (agentLinterRunner.ts), agentLinterCache (computeMaxMtime/get/set/evict)
provides:
  - skillDriftScan (scanSkillDrift aggregator + familyOf helper + KNOWN_FAMILIES enum)
  - skillDriftCache (30s single-key memo — matches Phase 10 coverageCache cadence)
  - skillDriftRoute (GET /api/skills/drift bulk + POST /api/skills/drift/agentlinter single-project)
affects: [11-05-skill-drift-spa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-repo aggregator iterating readRegistry().projects + Promise.allSettled isolation (Phase 10 AGREED-2)"
    - "Path-based family derivation: <home>/Sourcecode/{agenticapps,factiv,neuroflash}/<repo> with 'other' fallback (registry.client is null live, so path is authoritative)"
    - "30s single-key memo for /api/skills/drift (mirrors Phase 10 coverageCache; matches SPA 5s polling cadence)"
    - "D-11-14 single-project-per-request enforced structurally via z.object({ projectId: z.string().min(1) }).strict() — rejects extras, arrays, smuggled batch shapes at the schema boundary"
    - "New CALL-SITE for runAgentLinter — NOT a new spawn surface. Same binary, same argv, same 30s timeout, same cache key (projectId + maxMtime) as Phase 5"
    - "REVIEWS action item 10: POST response wraps via SHARED AgentLinterResponseSchema from @agenticapps/dashboard-shared (NO local copy); enrichWithCachedAt mirrors Phase 5's routes/agentlinter.ts"
    - "REVIEWS action item 6: aggregator destructures readLocalSkills().skills from the { scope: 'local'; skills: SkillEntry[] } return shape (verified live at skillsScan.ts:133-135) — Test 16 mocks the OBJECT shape and asserts ONE skill is processed"
    - "REVIEWS action item 7: ALL tests fixture-driven — registry via tmpdir fixture, readLocalSkills via vi.mock; ZERO ~/.agenticapps reads. homedirOverride seam for familyOf portability"

key-files:
  created:
    - packages/agent/src/lib/skillDriftScan.ts
    - packages/agent/src/lib/skillDriftScan.test.ts
    - packages/agent/src/lib/skillDriftCache.ts
    - packages/agent/src/lib/skillDriftCache.test.ts
    - packages/agent/src/routes/skillDrift.ts
    - packages/agent/src/routes/skillDrift.test.ts
  modified:
    - packages/agent/src/server/app.ts

key-decisions:
  - "D-11-04 honoured (per-skill matrix as primary view): scanSkillDrift folds cross-project skills into rows keyed by skillId (frontmatter `name` or `dir` fallback), with per-project cells carrying { present, version, lastModifiedIso }. Wire shape locked by SkillDriftResponseSchema from Plan 01."
  - "D-11-14 honoured (single-project-per-request): POST body schema is z.object({ projectId: z.string().min(1) }).strict() — extras reject, arrays reject (z.string rejects arrays), `projectIds` smuggling rejects. The handler has NO loop over projects. Test 10 explicitly verifies projectIds array → 400."
  - "D-11-14 honoured (reuse Phase 5 unchanged): POST handler imports runAgentLinter + computeMaxMtime + getAgentLinterCached + setAgentLinterCached UNCHANGED. Same binary path, same --local flag, same 30s timeout (T-05-02-Timeout-DoS), same cache key (projectId + maxMtime). New CALL-SITE only."
  - "REVIEWS action item 6 (readLocalSkills shape) honoured: aggregator does `const { skills } = await readLocalSkills(p.root)`, not `await readLocalSkills(p.root)` as an array. Test 16 mocks `{ scope: 'local', skills: [<one>] }` and asserts the matrix carries exactly 1 row (if the aggregator iterated the wrapper object, it would produce 0 or 2 rows)."
  - "REVIEWS action item 7 (fixture isolation) honoured: tests use a tmpdir-backed registry.json fixture via the `registryFile` option, plus vi.mock on readLocalSkills + agentLinterRunner + agentLinterCache. Grep verifies zero `~/.agenticapps` references in BOTH test files (skillDriftScan.test.ts and skillDrift.test.ts)."
  - "REVIEWS action item 10 (shared schema reuse) honoured: skillDrift.ts imports AgentLinterResponseSchema from @agenticapps/dashboard-shared (same import as Phase 5's routes/agentlinter.ts at line 19). No local copy. enrichWithCachedAt mirrors the Phase 5 helper exactly."
  - "Family enum lock (D-11-06 / PD-11-03): familyOf returns 'agenticapps' | 'factiv' | 'neuroflash' | 'other' — derived from path-prefix against <home>/Sourcecode/<family>/<repo>. Three tests explicitly exercise the 'other' fallback (off-Sourcecode, unknown family, family-dir-no-child)."
  - "Threat T-11-03-06 mitigation: `degraded` on a project carries `error.message` ONLY — never the full error object or stack trace. Plan notes future contributors must NOT widen this."

patterns-established:
  - "TDD-per-module: cache → aggregator → route, each landed RED → GREEN with its own test file. Caching module landed first (smallest unit) before the aggregator that consumes it."
  - "Mock at the import boundary: vi.mock('./skillsScan.js', ...) before SUT import so the aggregator picks up the mock; same pattern for runAgentLinter, agentLinterCache, and readRegistry in the route test."
  - "Marker tests for static invariants (Test 17 for fixture-isolation, Test 15 for no-spawn): the assertion is performed by the plan's grep-based acceptance criteria; the test exists to keep the marker visible alongside the runtime tests."

requirements-completed: [SKD-01, SKD-02, SKD-03, INV-01, INV-04, INV-05]

# Metrics
duration: 9min
completed: 2026-05-16
---

# Phase 11 Plan 03: DAEMON Cross-repo Skill Drift Summary

**Lands the entire Cross-repo Skill drift DAEMON path — skillDriftScan aggregator + skillDriftCache 30s memo + GET /api/skills/drift bulk matrix route + POST /api/skills/drift/agentlinter single-project on-demand run. Closes SKD-01..03; SPA Plan 11-05 can now consume both endpoints.**

## Performance

- **Duration:** ~9 min (2026-05-16T14:06:15Z → 2026-05-16T14:15:31Z)
- **Tasks:** 2 (TDD, RED→GREEN per task)
- **Files created:** 6 (3 source + 3 test files)
- **Files modified:** 1 (`packages/agent/src/server/app.ts` mount line)
- **Tests added:** 39 new vitest cases
  - skillDriftCache: 5 (get/set/TTL/clear behaviour at 30s threshold)
  - skillDriftScan: 18 (8 familyOf + 9 scanSkillDrift + 1 KNOWN_FAMILIES export)
  - skillDrift route: 16 (4 GET + 12 POST)
- **Full agent test suite after plan:** 746/746 green (was 707/707 at end of Plan 02)
- **Agent + workspace typecheck:** clean
- **Workspace build:** clean (all 5 packages)

## Accomplishments

### `packages/agent/src/lib/skillDriftScan.ts` — Aggregator + family helper

- **`KNOWN_FAMILIES = ['agenticapps', 'factiv', 'neuroflash']`** + `Family` type (`KnownFamily | 'other'`).
- **`familyOf(root, homedirOverride?) → Family`** — path-based derivation against `<home>/Sourcecode/<family>/<repo>`. Requires BOTH a known family head AND a non-empty repo child (an exact family dir falls back to `'other'`). The `homedirOverride` seam keeps tests portable across developer machines.
- **`scanSkillDrift({ registryFile?, homedirOverride? })`** — iterates `readRegistry().projects` (route through `registryFile` for fixture tests), invokes `readLocalSkills(p.root)` per project, **destructures `.skills`** from the `{ scope: 'local'; skills: SkillEntry[] }` return shape (REVIEWS #6), folds same-named skills into per-skill rows (`byProject` keyed by registry project id), sorts skillIds alphabetically for deterministic SPA rendering. `Promise.allSettled` isolation: a thrown `readLocalSkills` for one project produces `{ projectId, projectName, family, degraded: error.message }` and the row matrix carries the surviving projects' cells normally.

### `packages/agent/src/lib/skillDriftCache.ts` — 30s memo

- **`getSkillDriftCached(now?)`** / **`setSkillDriftCached(value, now?)`** / **`clearSkillDriftCache()`** mirror Phase 10's `coverageCache.ts` 30s single-key memo shape. Single global entry — the PD-11-03 scope chip is a SPA-side concern; the daemon serves one payload regardless of scope.

### `packages/agent/src/routes/skillDrift.ts` — Route surface

- **`GET /skills/drift`** — cache-aware (30s memo), parses through `SkillDriftResponseSchema` via `outbound()` (INV-04). Bearer-auth + CORS inherited from middleware.
- **`POST /skills/drift/agentlinter`** — single-project-per-request:
  1. Zod-parse body via `z.object({ projectId: z.string().min(1) }).strict()` → 400 `invalid_request_body` on miss/empty/extras/arrays.
  2. Registry lookup → 404 `project_not_found` on unknown id (registry is the consent boundary, Threat T-11-03-05).
  3. Reuse Phase 5 unchanged: `computeMaxMtime(entry.root)` → `getAgentLinterCached(entry.id, maxMtime)` short-circuit OR `runAgentLinter(entry.root)` + `setAgentLinterCached`.
  4. `outbound()` wrap via SHARED `AgentLinterResponseSchema` (REVIEWS #10 — same import as Phase 5's `routes/agentlinter.ts:19`); `enrichWithCachedAt` adds the timestamp to `kind: 'ok'` results so the discriminated union parses.
- **`outbound()` defence** on every response → schema drift surfaces as 500 `schema_drift`, never a leaked-shape 200.

### Route mount (`packages/agent/src/server/app.ts`)

Added at line 137 — immediately after the Phase 11 Plan 02 `coverageHistoryRoute` mount at line 136. Both Phase 11 routes mount under `/api` since the bearer-auth + CORS chain is inherited from the app.ts middleware ordering.

## Task Commits

| Task | Subject                                                                                  | Hash    |
| ---- | ---------------------------------------------------------------------------------------- | ------- |
| 1    | test+feat(11-03): add skillDriftScan aggregator + skillDriftCache                        | 73537a0 |
| 2    | test+feat(11-03): add /api/skills/drift GET + POST routes (D-11-14, REVIEWS #10)         | bf8b95c |

(Plan metadata commit + STATE.md/ROADMAP.md commit lands after this SUMMARY.)

## REVIEWS.md Action Items Addressed

| # | Severity | Item | Resolution |
| --- | --- | --- | --- |
| 6 | MEDIUM | readLocalSkills `{ scope, skills }` return shape | Aggregator destructures `.skills` (line 95 of skillDriftScan.ts: `const { skills } = await readLocalSkills(p.root)`). Test 16 mocks the OBJECT shape and asserts EXACTLY 1 row in the matrix — if the aggregator iterated the wrapper, it would produce 0 or 2 rows. |
| 7 | MEDIUM | Fixture-driven tests, no developer-homedir reads | Both test files use `mkdtempSync` + `tmpdir()` for registry fixtures, `vi.mock` for readLocalSkills + agentLinterRunner + agentLinterCache, and `makeTmpHome()` for auth state. Grep verifies ZERO `~/.agenticapps` references in either test file. |
| 10 | LOW | Shared AgentLinterResponseSchema reuse | `routes/skillDrift.ts:34` imports `AgentLinterResponseSchema` from `@agenticapps/dashboard-shared` — same import as Phase 5's `routes/agentlinter.ts:19`. Zero local schema copies. `enrichWithCachedAt` mirrors Phase 5 helper exactly. |

## Decisions Made

- **D-11-04 honoured (per-skill matrix as primary view).** Aggregator folds same-named skills across projects into rows; `byProject` keyed by registry project id; sorted alphabetically by skillId for deterministic SPA rendering.
- **D-11-14 honoured (single-project-per-request, structurally enforced).** `.strict()` on the Zod schema rejects extras + arrays at parse time; no loop in POST handler. Test 10 explicitly verifies `projectIds: ['p1','p2']` → 400.
- **D-11-14 honoured (reuse Phase 5 unchanged).** Same binary, same argv, same 30s timeout, same cache key. New CALL-SITE only; the spawn surface itself is bit-identical to Phase 5's per-project route.
- **Family path-derivation lock.** Live registry has `client: null` for every entry (verified at planning time); `familyOf(root)` derives from `<home>/Sourcecode/<family>/<repo>` path-prefix match with `'other'` fallback. Three tests explicitly exercise the `'other'` bucket (off-Sourcecode, unknown family, family-dir-no-child).
- **`Promise.allSettled` isolation.** One project's exception inside `readLocalSkills` produces `degraded: error.message` on that project's entry and the matrix carries the surviving projects' cells normally. Test 12 verifies.
- **Threat T-11-03-06 mitigation.** `degraded` exposes `error.message` ONLY — never `error.stack` or the full Error object. Plan SUMMARY notes future contributors must NOT widen this surface.

## Deviations from Plan

None — plan executed exactly as written. Two task-internal nits handled silently:

- **AC8 (no spawn in route).** The route's JSDoc comment uses the word "spawn" in a sentence describing the constraint (`"the spawn target is the locked @agenticapps/agentlinter package"` + `"this is a new CALL-SITE, not a new spawn surface"`). The literal `grep -c "spawn"` returns 2 because of these comments; the AC's intent (no direct `spawn()` / `execa()` invocation in the route) is satisfied by inspection and reinforced by Test 13's `runAgentLinter.toHaveBeenCalledWith('/tmp/fake-p1')` assertion.
- **AC5 (z.object visibility).** The Zod schema is written with `z\n.object({` across two lines (line 77-78 of skillDrift.ts), so a single-line `grep -c "z.object({"` returns 0. The schema itself is present and `.strict()` is grep-verifiable.

## Issues Encountered

- **`SkillEntry`-to-cast typecheck nit.** Initial draft used `(found as { lastModifiedIso: string }).lastModifiedIso` to read the optional frontmatter passthrough field; `tsc` rejected the cast because `SkillEntry` has no `lastModifiedIso` member. Replaced with `(found as Record<string, unknown>).lastModifiedIso` + `typeof` guard. No change to runtime behaviour; tests + typecheck clean afterward.

## User Setup Required

None — no third-party services touched. The new POST endpoint reuses the Phase 5 AgentLinter spawn surface; users with the linter already installed (per Phase 5 setup) see normal behaviour. Users without the linter installed receive `{ kind: 'not-installed' }` (Phase 5 D-5-15 contract) — the route does NOT crash.

## Next Plan Readiness

- **Plan 11-04 (coverage trends SPA):** unaffected by this plan; consumes the Plan 11-02 `/api/coverage/history` endpoint.
- **Plan 11-05 (skill drift SPA):** ready to consume both endpoints. Recommended hook signatures:
  ```ts
  function useSkillDrift({ scope }: { scope: 'family' | 'cross' }): UseQueryResult<SkillDriftResponse>
  function useAgentLinterDrift(): UseMutationResult<AgentLinterResponse, Error, { projectId: string }>
  ```
  `scope` is consumed for queryKey discrimination only (`['skillDrift', scope]` so URL navigation cache-busts as needed); the daemon endpoint shape does NOT change with scope (per PD-11-03). The mutation hook parses through the SHARED `AgentLinterResponseSchema` — DO NOT define a local copy (REVIEWS #10).
- **Family enum locked at `'agenticapps' | 'factiv' | 'neuroflash' | 'other'`** — Plan 11-05's filter chip MUST surface ALL FOUR. The `'other'` bucket is exercised by three tests in skillDriftScan.test.ts and is a real runtime path on any registration outside the three known family dirs.

## Threat Model Verification

All STRIDE entries from the plan's threat register have a tested mitigation:

| Threat ID    | Mitigated by                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| T-11-03-01   | skillDrift.test.ts T11/T13 (runAgentLinter called with entry.root from registry, NOT body input)                        |
| T-11-03-02   | skillDrift.test.ts T9 (strict-mode reject of extras), T10 (projectIds array reject)                                     |
| T-11-03-03   | skillDrift.test.ts T1/T5 (401 bearer gate) + 30s subprocess timeout (Phase 5 invariant) + Test 12 (cache short-circuit) |
| T-11-03-04   | (accept — existing Phase 5 risk; cache key includes maxMtime, inherited unchanged)                                      |
| T-11-03-05   | skillDriftScan.ts iterates `readRegistry().projects` only — no off-registry filesystem reads                            |
| T-11-03-06   | skillDriftScan.ts line ~110: `degraded: error.message` ONLY, never error.stack or full Error                            |
| T-11-03-07   | skillDrift.ts:101 `entry = reg.projects.find(...)` — `runAgentLinter(entry.root)`, never body input as path             |
| T-11-03-08   | outbound() wrap on every response (lines 56, 110, 122 of skillDrift.ts) via SHARED schemas                              |
| T-11-03-09   | skillDrift.test.ts T1 (GET 401) + T5 (POST 401)                                                                         |
| T-11-03-10   | (inherited from Phase 5 evictAgentLinterCacheProject — registry unregister hook unchanged)                              |
| T-11-03-11   | skillDriftScan.test.ts T16 (REVIEWS #6 lock — mock returns `{ scope, skills }` object, aggregator processes 1 row)      |

## Manual Smoke (deferred — daemon not started during this plan execution)

The plan's `<verification>` block lists curl smoke commands that require the daemon to be running with a fresh token. This was NOT run during the autonomous executor pass (starting the daemon is a side-effect outside the test-only execution path). The full automated test surface covers the same invariants:

- 401 without bearer: skillDrift.test.ts T1 (GET) + T5 (POST)
- 200 + SkillDriftResponseSchema parse: skillDrift.test.ts T2
- 200 + AgentLinterResponseSchema parse: skillDrift.test.ts T14 (SHARED schema reuse — REVIEWS #10)
- 404 unknown projectId: skillDrift.test.ts T8
- 400 invalid body (empty / strict-extras / array smuggle): skillDrift.test.ts T6/T7/T9/T10
- runAgentLinter called with EXACTLY ONE projectRoot: skillDrift.test.ts T11/T13

Smoke can be performed by the verifier or in the post-phase `/qa` pass.

## Self-Check: PASSED

Verification:
- `[FOUND]` `packages/agent/src/lib/skillDriftScan.ts` exists
- `[FOUND]` `packages/agent/src/lib/skillDriftScan.test.ts` exists
- `[FOUND]` `packages/agent/src/lib/skillDriftCache.ts` exists
- `[FOUND]` `packages/agent/src/lib/skillDriftCache.test.ts` exists
- `[FOUND]` `packages/agent/src/routes/skillDrift.ts` exists
- `[FOUND]` `packages/agent/src/routes/skillDrift.test.ts` exists
- `[FOUND]` `packages/agent/src/server/app.ts` contains `app.route('/api', skillDriftRoute)` at line 137 (immediately after coverageHistoryRoute at line 136)
- `[FOUND]` commit `73537a0` (Task 1 — aggregator + cache)
- `[FOUND]` commit `bf8b95c` (Task 2 — route + mount)
- `[PASS]` 746/746 agent vitest cases green (`pnpm --filter @agenticapps/dashboard-agent test --run`)
- `[PASS]` agent typecheck clean
- `[PASS]` workspace typecheck clean (all 5 packages)
- `[PASS]` workspace build clean
- `[PASS]` `grep -c "export function familyOf\|export const KNOWN_FAMILIES" packages/agent/src/lib/skillDriftScan.ts` returns 2
- `[PASS]` `grep -c "Promise.allSettled" packages/agent/src/lib/skillDriftScan.ts` returns 3 (allSettled + 2 references in code/types)
- `[PASS]` `grep -c "readLocalSkills\|readRegistry" packages/agent/src/lib/skillDriftScan.ts` returns 7
- `[PASS]` `grep -cE "const \{ skills \}|\.skills" packages/agent/src/lib/skillDriftScan.ts` returns 4 (REVIEWS #6 destructure lock)
- `[PASS]` `grep -c "homedirOverride\|homedir()" packages/agent/src/lib/skillDriftScan.ts` returns 7 (portability + testability)
- `[PASS]` `grep -cE "30 \* 1000|TTL_MS" packages/agent/src/lib/skillDriftCache.ts` returns 2
- `[PASS]` `grep -c "\.agenticapps/dashboard\|~/\.agenticapps" packages/agent/src/lib/skillDriftScan.test.ts` returns 0 (REVIEWS #7 fixture isolation)
- `[PASS]` `grep -c "\.agenticapps/dashboard\|~/\.agenticapps" packages/agent/src/routes/skillDrift.test.ts` returns 0 (REVIEWS #7 fixture isolation)
- `[PASS]` `grep -c "AgentLinterResponseSchema" packages/agent/src/routes/skillDrift.ts` returns 5 (REVIEWS #10 — shared schema reused)
- `[PASS]` `grep -c "\.strict()" packages/agent/src/routes/skillDrift.ts` returns 3 (D-11-14 enforced via .strict)
- `[PASS]` `grep -c "runAgentLinter\|getAgentLinterCached\|setAgentLinterCached\|computeMaxMtime" packages/agent/src/routes/skillDrift.ts` returns 11 (Phase 5 reuse)
- `[PASS]` `grep -c "app.route('/api', skillDriftRoute)" packages/agent/src/server/app.ts` returns 1

---
*Phase: 11-coverage-trends-skill-drift*
*Completed: 2026-05-16*
