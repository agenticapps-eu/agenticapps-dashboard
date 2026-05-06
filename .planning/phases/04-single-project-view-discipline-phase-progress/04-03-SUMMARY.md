---
phase: 04-single-project-view-discipline-phase-progress
plan: "03"
subsystem: agent-routes
tags: [routes, hono, tdd, daemon, phase4, cache, discipline, phase-progress]
dependency_graph:
  requires:
    - 04-01-schemas (CommitmentBlockResponseSchema, ObservationsRecentResponseSchema, DisciplineResponseSchema, PhaseProgressResponseSchema, SecurityResponseSchema)
    - 04-02-parsers (parseCommitmentBlock, readSkillObservations, parseRationalizationRows, parsePhaseChecklist, parseExecutionTimeline, parseSecurityReports, parseReviewFindings4, parseVerificationDetail, phaseCache)
    - packages/agent/src/routes/overview.ts (pattern to mirror verbatim)
    - packages/agent/src/routes/registry.ts (unregister handler — extended)
  provides:
    - GET /api/projects/:id/commitment (DISC-01)
    - GET /api/projects/:id/observations/recent?limit=N (DISC-02 + DISC-04)
    - GET /api/projects/:id/discipline (DISC-03)
    - GET /api/projects/:id/phase-progress (PHASE-01 + PHASE-02 + PHASE-03 + PHASE-05)
    - GET /api/projects/:id/security (PHASE-04)
    - phaseCache eviction on unregister (T-04-03-07)
  affects:
    - packages/spa (Plans 04–06 — SPA query hooks consume these endpoints)
tech_stack:
  added: []
  patterns:
    - Hono route factory (new Hono<Env>()) mirrored from overview.ts verbatim
    - phaseCache key convention: ${id}:routeName (${id}:observations:${limit} for limit-aware)
    - outbound() Zod schema-drift defense on every response path (D-16)
    - Promise.all for concurrent parseTddPairs + parseExecutionTimeline in phase-progress
    - TDD red-green-refactor per task pair
key_files:
  created:
    - packages/agent/src/routes/commitment.ts
    - packages/agent/src/routes/observations.ts
    - packages/agent/src/routes/discipline.ts
    - packages/agent/src/routes/phaseProgress.ts
    - packages/agent/src/routes/security.ts
    - packages/agent/src/server/__tests__/commitment.test.ts
    - packages/agent/src/server/__tests__/observations.test.ts
    - packages/agent/src/server/__tests__/discipline.test.ts
    - packages/agent/src/server/__tests__/phaseProgress.test.ts
    - packages/agent/src/server/__tests__/security.test.ts
  modified:
    - packages/agent/src/server/app.ts (5 new imports + 5 app.route mounts)
    - packages/agent/src/routes/registry.ts (evictPhaseCacheProject on unregister)
    - packages/agent/src/server/__tests__/registry.test.ts (1 new eviction test)
decisions:
  - "observations cache key is ${id}:observations:${limit} (not just ${id}:observations) so different limit values don't collide — evictPhaseCacheProject still clears all via prefix match"
  - "discipline route uses FIRE_COUNT_LIMIT=200 for fire counting (broader than the HookFirings panel's 20-row display window — unrelated limits)"
  - "phase-progress uses Promise.all for parseTddPairs + parseExecutionTimeline concurrency to keep p95 latency under 1s on cold cache"
  - "lint fix: removed unused evictPhaseCacheProject import from phaseProgress.test.ts (Rule 1 - the function is tested indirectly via the spy approach in PP3/PP4)"
metrics:
  duration: "~11 minutes"
  completed: "2026-05-06T07:43:31Z"
  tasks_completed: 3
  files_created: 10
  files_modified: 3
---

# Phase 04 Plan 03: Wave 2 Daemon Routes — Summary

Five Hono panel routes (DISC-01..04, PHASE-01..05) fully implemented, TDD'd with 37 new tests across 5 route test files + 1 registry eviction test, wired into `app.ts`, and `registry.ts` unregister handler extended to evict phaseCache alongside the existing overviewCache (T-04-03-07).

## Route Files

| File | Route | Cache Key | Schema | Tests |
|------|-------|-----------|--------|-------|
| `commitment.ts` | `GET /:id/commitment` | `${id}:commitment` | `CommitmentBlockResponseSchema` | 7 (X1–X7) |
| `observations.ts` | `GET /:id/observations/recent?limit=N` | `${id}:observations:${limit}` | `ObservationsRecentResponseSchema` | 8 (X1–X8) |
| `discipline.ts` | `GET /:id/discipline` | `${id}:discipline` | `DisciplineResponseSchema` | 7 (X1–X7) |
| `phaseProgress.ts` | `GET /:id/phase-progress` | `${id}:phase-progress` | `PhaseProgressResponseSchema` | 7 (PP1–PP7) |
| `security.ts` | `GET /:id/security` | `${id}:security` | `SecurityResponseSchema` | 7 (S1–S7) |

**Total new tests: 37** (36 in 5 route test files + 1 in registry.test.ts)

## Test Coverage by Route

All routes cover the standard 7-case suite:
- **200 + valid response** for a populated fixture
- **Cache hit** — spy asserts parser not re-called within 5s
- **Cache miss** — `vi.advanceTimersByTime(5_001)` triggers re-invocation
- **404** for unknown project id
- **500 schema_drift** via malformed mock return value through `outbound()`
- **Cache eviction** via `evictPhaseCacheProject` (observations + discipline + security)
- **Empty / graceful state** (no skill, no phase dir, no security files)

Additional observations-specific test (X8): `?limit=5` and `?limit=999` — limit is honored and clamped to `[1, 100]`.

## Observations Route — Limit Behavior

```
?limit=N → parsed as int → clamped to min(N, 100), default 20 for non-numeric/missing
cache key: ${id}:observations:${limit}  (limit-aware, distinct entries per value)
evictPhaseCacheProject(id) evicts ALL ${id}:* entries including all limit variants
```

## Phase-Progress Route — Bulk Shape

For a fully populated test fixture (phase dir `04-single-project-view` with CONTEXT.md, RESEARCH.md, UI-SPEC.md, 04-01-PLAN.md, 04-01-SUMMARY.md):

```json
{
  "phase": "04-single-project-view",
  "paddedPhase": "04",
  "files": [<10+ PhaseFileStatus items in canonical order>],
  "tdd": { "greenPairs": 0, "totalTasks": 0, "timeline": [] },
  "review": { "stage1": null, "stage2": null },
  "verification": { "mustHavesTotal": 0, "mustHavesEvidenced": 0, "items": [] }
}
```

When no phase dir exists: all fields null/empty (PP2 graceful empty state).

## Unregister Cache-Hygiene Fix (T-04-03-07)

```typescript
// packages/agent/src/routes/registry.ts — unregister handler
evictOverviewCache(body.id)       // T-03-03-05 (Phase 3)
evictPhaseCacheProject(body.id)   // T-04-03-07 (Phase 4, new)
```

Without this fix, a re-registered project with the same id but a different root would serve stale Phase 4 panels for up to 5s. Test U1 in `registry.test.ts` verifies that `getPhaseCache(${id}:commitment)` returns null after unregister.

## TDD Commit Pairs

| Task | RED commit | GREEN commit |
|------|-----------|-------------|
| Task 1 (commitment + observations + discipline) | `453286d` test(04-03): add failing tests for commitment + observations + discipline routes (RED) | `47fc5af` feat(04-03): implement commitment + observations + discipline routes + wire into app (GREEN) |
| Task 2 (phase-progress + security) | `6d2d6e2` test(04-03): add failing tests for phase-progress + security routes (RED) | `f53c1d2` feat(04-03): implement phase-progress + security routes + wire into app (GREEN) |
| Task 3 (registry eviction) | `f0bc357` test(04-03): add failing test for phaseCache eviction on unregister (RED) | `12030fd` feat(04-03): evict phaseCache on unregister (GREEN) |

## app.ts Wiring (Final State)

```typescript
app.route('/api/projects', readRoute)
app.route('/api/projects', gitRoute)
app.route('/api/projects', overviewRoute)
app.route('/api/projects', commitmentRoute)      // NEW Phase 4
app.route('/api/projects', disciplineRoute)      // NEW Phase 4
app.route('/api/projects', observationsRoute)    // NEW Phase 4
app.route('/api/projects', phaseProgressRoute)   // NEW Phase 4
app.route('/api/projects', securityRoute)        // NEW Phase 4
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused import in phaseProgress.test.ts caused lint error**
- **Found during:** Final `pnpm lint` run
- **Issue:** `evictPhaseCacheProject` imported but not directly called in phaseProgress tests (eviction tested indirectly via spy approach in PP3/PP4; no explicit X6 eviction test was written for phaseProgress since PP3/PP4 already cover cache hit/miss)
- **Fix:** Removed the unused import — lint error eliminated
- **Files modified:** packages/agent/src/server/__tests__/phaseProgress.test.ts
- **Commit:** `82b5ccd`

## Known Stubs

None. All routes return real computed values via Plan 02 parsers from filesystem reads.

## Threat Flags

None. All five new routes are bearer-token gated by the existing `app.ts` middleware chain. CORS lock unchanged. No new path-resolution helpers introduced — parsers use hardcoded `join()` segments as documented in Plan 02.

## Self-Check: PASSED
