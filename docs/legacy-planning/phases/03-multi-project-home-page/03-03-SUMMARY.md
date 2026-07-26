---
phase: 03-multi-project-home-page
plan: "03"
subsystem: daemon-routes
tags: [hono, route, cache, schema-drift, tdd, overview]
dependency_graph:
  requires:
    - "03-01 (ProjectOverviewSchema, projectOverview.ts, overviewCache.ts)"
    - "Phase 1 D-16 (outbound() schema-drift defense)"
    - "Phase 1 D-02 (registry readRegistry)"
  provides:
    - "GET /api/projects/:id/overview daemon endpoint"
    - "Wave 2 SPA useProjectOverview(id) hook contract"
  affects:
    - "packages/agent/src/server/app.ts (route wired)"
    - "packages/agent/src/lib/overviewCache.ts (eviction contract for plan 05)"
tech_stack:
  added: []
  patterns:
    - "Hono route with getCached/setCached D-02 5s memo cache"
    - "outbound() D-16 schema-drift defense on every success path"
    - "readOverview() pure-function filesystem reader with graceful fallback"
    - "vi.spyOn + vi.useFakeTimers for cache hit/miss/TTL testing"
key_files:
  created:
    - packages/agent/src/routes/overview.ts
    - packages/agent/src/server/__tests__/overview.test.ts
    - packages/agent/src/lib/overviewCache.ts
    - packages/agent/src/lib/projectOverview.ts
    - packages/shared/src/schemas/overview.ts
  modified:
    - packages/agent/src/server/app.ts
    - packages/shared/src/index.ts
decisions:
  - "Route mounts as app.route('/api/projects', overviewRoute) — same pattern as readRoute/gitRoute; :id param resolved inside the route handler"
  - "overviewCache _resetForTests() exported for test isolation — not for production use"
  - "projectOverview.ts created as Wave 0 dependency (plan 03-01 creates it in parallel; this worktree carries its own copy for independence)"
  - "Phase status = Pending when no PLAN.md found in phase dir; In Progress when VERIFICATION.md absent or evidence < mustHaves; Complete when evidence >= mustHaves > 0"
  - "tdd field is null when both greenPairs and totalTasks are 0 (avoids noisy zero rows in the card)"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-04"
  tasks: 1
  files: 7
---

# Phase 3 Plan 03: Overview Route (GET /api/projects/:id/overview) Summary

**One-liner:** Hono route wiring readOverview() + 5s memo cache + outbound() schema-drift defense for the daemon-side project overview endpoint.

## What Was Built

`GET /api/projects/:id/overview` — the daemon-side endpoint that Wave 2 SPA's `useProjectOverview(id)` hook consumes per project card (HOME-02).

### Route shape

```
GET /api/projects/:id/overview
Authorization: Bearer <token>

200: ProjectOverview (D-08 schema)
404: { ok: false, error: 'project_not_found', requestId }
500: { ok: false, error: 'schema_drift', requestId }  ← on schema parse failure
```

### Hono path mounting decision

Registered as `app.route('/api/projects', overviewRoute)` in `app.ts` — same pattern as `readRoute` and `gitRoute`. The `:id` prefix is part of the route handler (`overviewRoute.get('/:id/overview', ...)`), so multiple route files can share the `/api/projects` mount point cleanly.

### Cache integration (D-02)

- `getCached(id)` checked first; returns cached value if within 5s TTL (no filesystem reads)
- On cache miss: `readOverview(entry.root)` then `setCached(id, value)`
- `evict(id)` in `overviewCache.ts` is the cross-plan invariant: **plan 05 (rename/tags/unregister) MUST call `evict(id)` on unregister** to prevent stale data for a re-registered project with the same ID

### Eviction contract for plan 05

```typescript
// plan 05 unregister handler MUST include:
import { evict } from '../lib/overviewCache.js'
// ... after removeProject(id):
evict(id)
```

This is documented in the threat model as T-03-03-05.

## Tests Added

7 tests in `packages/agent/src/server/__tests__/overview.test.ts`:

| # | Test | Coverage |
|---|------|----------|
| 1 | Returns 200 + valid ProjectOverview for a known project | Happy path, schema parse |
| 2 | Cache hit — second call within 5s does NOT invoke readOverview | D-02 cache hit |
| 3 | Cache miss after 5s — second call invokes readOverview again | D-02 TTL expiry |
| 4 | Unknown id returns 404 project_not_found | 404 path |
| 5 | Unreachable root returns 200 phaseStatus=Pending, all sub-objects null | Graceful degradation |
| 6 | readOverview returning garbage causes 500 schema_drift | D-16 outbound() defense |
| 7 | Call, evict(id), call again → readOverview called twice | Cache eviction |

All 7 tests pass. Total agent test suite: 169 tests, 29 files — all green. No regressions.

## Dependency Files Created (Wave 0 bootstrap)

Since plan 03-01 runs in a parallel worktree, this plan created its own copies of the Wave 0 dependency files:

- **`packages/shared/src/schemas/overview.ts`** — `ProjectOverviewSchema` (D-08) with `FindingCountsSchema`, `DbAuditFindingsSchema`, `MarkersSchema`
- **`packages/shared/src/index.ts`** — barrel re-export of the new overview schemas
- **`packages/agent/src/lib/overviewCache.ts`** — `getCached/setCached/evict/_resetForTests` (D-02 5s memo)
- **`packages/agent/src/lib/projectOverview.ts`** — `readOverview()` pure-function reader + helper exports

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict-mode errors in projectOverview.ts**
- **Found during:** typecheck after GREEN implementation
- **Issue:** `dirs[dirs.length - 1]` typed as `string | undefined`; regex match group accesses (`fmMatch[1]`, `block.match()[1]`) typed as `string | undefined` under noUncheckedIndexedAccess
- **Fix:** Added null guards (`if (!lastDir) return null`) and nullish coalescing (`?? ''`, `m?.[1]`)
- **Files modified:** `packages/agent/src/lib/projectOverview.ts`
- **Commit:** 4380b9e (included in GREEN commit)

## Known Stubs

None — the route returns real ProjectOverview data from the filesystem. The `tdd` field returns `null` when both `greenPairs` and `totalTasks` are 0 (projects without git history or without RED/GREEN commits). This is correct behavior, not a stub.

## Threat Flags

No new threat surfaces beyond what the plan's threat model documents. The route is bearer-token gated; `:id` is matched via exact equality against the registry (no path traversal); `readOverview()` only reads paths under the registered `canonicalRoot`.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| packages/agent/src/routes/overview.ts | FOUND |
| packages/agent/src/server/__tests__/overview.test.ts | FOUND |
| packages/agent/src/lib/overviewCache.ts | FOUND |
| packages/agent/src/lib/projectOverview.ts | FOUND |
| packages/shared/src/schemas/overview.ts | FOUND |
| .planning/phases/03-multi-project-home-page/03-03-SUMMARY.md | FOUND |
| dd6e300 (RED test commit) | FOUND |
| 4380b9e (GREEN impl commit) | FOUND |
