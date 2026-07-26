---
phase: 10
plan: "05"
subsystem: spa/lib
tags:
  - coverage-matrix
  - tanstack-query
  - tdd
  - hooks
  - schema-drift
dependency_graph:
  requires:
    - 10-01 (CoverageResponseSchema, CoverageRefreshRequestSchema, CoverageRefreshResponseSchema from shared)
    - 10-04 (GET /api/coverage + POST /api/coverage/refresh daemon endpoints)
  provides:
    - useCoverage() hook — GET /api/coverage, 30s stale+poll, schema-drift surface
    - useCoverageRefresh() hook — POST /api/coverage/refresh, client-side Zod validation, onSuccess invalidation
    - COVERAGE_QUERY_KEYS export (typed const tuple)
    - COVERAGE_STALE_TIME_MS export (30_000 — locked to daemon cache TTL)
  affects:
    - 10-06 (CoveragePage + panel components consume useCoverage + useCoverageRefresh without modification)
tech_stack:
  added: []
  patterns:
    - "useCoverage: useQuery with queryKey=COVERAGE_QUERY_KEYS.matrix, staleTime=refetchInterval=30_000"
    - "useCoverageRefresh: useMutation with client-side CoverageRefreshRequestSchema.parse() BEFORE network (CODEX HIGH-5)"
    - "parseOrDrift reused from api.ts (INV-04 — no new schema-drift primitive)"
    - "onSuccess: queryClient.invalidateQueries({ queryKey: COVERAGE_QUERY_KEYS.matrix })"
    - "ZodError thrown client-side for missing family or bad action enum — network never reached"
key_files:
  created:
    - packages/spa/src/lib/coverageQueries.ts
  modified:
    - packages/spa/src/lib/coverageQueries.test.ts (it.todo stubs replaced with 14 real tests)
decisions:
  - "retry omitted at per-query level — callers configure retry at queryClient level (matches all other project hooks; avoids test retry-delay timeouts)"
  - "client-side CoverageRefreshRequestSchema.parse() before apiFetch — ZodError thrown before network touch (T-10-05-01 defense-in-depth)"
  - "COVERAGE_STALE_TIME_MS = 30_000 locked as named constant — changing it without changing daemon TTL is explicitly dangerous (comment in code)"
metrics:
  duration: ~4min
  completed: "2026-05-13"
  tasks_completed: 1
  files_changed: 2
---

# Phase 10 Plan 05: useCoverage + useCoverageRefresh TanStack Query Hooks Summary

SPA query bindings for the coverage matrix daemon endpoints. `useCoverage()` wraps `GET /api/coverage` with 30s staleTime and refetchInterval (matching the daemon's coverageCache TTL — COV-01/COV-03). `useCoverageRefresh()` wraps `POST /api/coverage/refresh` with client-side `CoverageRefreshRequestSchema.parse()` before the network request (CODEX HIGH-5 defense-in-depth), invalidates `['coverage']` on success, and exposes `mutateAsync` for Plan 06's sequential batch dispatch (AGREED-4).

## Hook Signatures

```typescript
// packages/spa/src/lib/coverageQueries.ts

export const COVERAGE_QUERY_KEYS = { matrix: ['coverage'] as const } as const
export const COVERAGE_STALE_TIME_MS = 30_000  // locked to daemon cache TTL

export function useCoverage(): UseQueryResult<CoverageResponse, Error>
// queryKey: ['coverage']
// queryFn:  apiFetch('/api/coverage', CoverageResponseSchema) → parseOrDrift → throws schema_drift:<path>
// staleTime: 30_000  (COV-01/COV-03)
// refetchInterval: 30_000

export function useCoverageRefresh(): UseMutationResult<CoverageRefreshResponse, Error, CoverageRefreshRequest>
// mutationFn: CoverageRefreshRequestSchema.parse(body) → apiFetch POST → parseOrDrift
// onSuccess:  queryClient.invalidateQueries({ queryKey: ['coverage'] })
```

## TTL Alignment (COV-01/COV-03)

| Layer | TTL |
|-------|-----|
| Daemon coverageCache (Plan 03) | 30s |
| SPA staleTime | 30_000ms |
| SPA refetchInterval | 30_000ms |

Both SPA polling intervals match the daemon cache TTL. Every SPA poll either hits the cache (free) or triggers a fresh scan (sub-second). No poll outruns the cache.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | useCoverage + useCoverageRefresh hooks + 14 tests | 31a52a5 | coverageQueries.ts (created), coverageQueries.test.ts (updated) |

## Test Summary

| Suite | Tests | Result |
|-------|-------|--------|
| COVERAGE_STALE_TIME_MS | 1 | GREEN |
| COVERAGE_QUERY_KEYS | 1 | GREEN |
| useCoverage | 5 | GREEN |
| useCoverageRefresh | 7 | GREEN |
| Full SPA suite | 730 | GREEN |

Tests cover: staleTime lock (30_000), refetchInterval lock, queryKey shape, success path, schema drift → `schema_drift:<path>` error, POST body shape assertion, onSuccess invalidateQueries spy, CODEX HIGH-5 missing-family ZodError (network NOT called), CODEX HIGH-5 bad-action enum ZodError (network NOT called), CODEX HIGH-5 updatedRow accessible on `mutation.data`, not-installed response resolves without throwing, drift on refresh response.

## Security Contracts Verified

| Contract | Enforcement |
|----------|-------------|
| T-10-05-01: client-side action enum bypass | `CoverageRefreshRequestSchema.parse(body)` throws ZodError BEFORE fetch; test R3+R4 assert network NOT called |
| T-10-05-02: drift surface | `parseOrDrift` throws `Error('schema_drift:<path>')` — no parsed value exposed |
| T-10-05-03: DoS via polling | staleTime = refetchInterval = 30s = daemon cache TTL — no extra scans |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] retry:1 in per-query options caused drift-test timeout in test environment**
- **Found during:** Task 1 GREEN phase (first test run — C5 drift test failed with `isError` never becoming true)
- **Issue:** TanStack Query's per-query `retry: 1` overrides the test wrapper's `defaultOptions.queries.retry: false`. The drift test waited 1000ms per retry attempt, then timed out before `isError` became true.
- **Fix:** Removed `retry: 1` from the per-query `useQuery()` call. All other hooks in this project (projectQueries.ts, registry.ts) follow the same pattern — retry is configured at the queryClient level, not per-query. The comment in the hook documents the production intent.
- **Files modified:** `packages/spa/src/lib/coverageQueries.ts`
- **Commit:** 31a52a5

## Known Stubs

None. Both hooks are fully wired to real daemon endpoints via `apiFetch`. No placeholder data, no TODO comments.

## Threat Flags

None. No new network endpoints introduced (SPA-side only). Trust boundary is SPA ↔ daemon bearer auth (inherited from apiFetch). All STRIDE items from the plan's threat register are mitigated as designed.

## Self-Check: PASSED

Files created/modified:
- `packages/spa/src/lib/coverageQueries.ts` — exists (production hooks, 110 lines)
- `packages/spa/src/lib/coverageQueries.test.ts` — exists (14 real tests, 0 it.todo)

Commits verified:
- 31a52a5 — feat(10-05): useCoverage + useCoverageRefresh TanStack Query hooks

Acceptance criteria:
- `grep "CoverageRefreshRequestSchema.parse"` → 3 hits (≥1 required) ✓
- `grep "COVERAGE_STALE_TIME_MS = 30_000"` → 1 hit ✓
- `grep "COVERAGE_QUERY_KEYS"` → 3 hits (≥2 required) ✓
- `grep "CoverageResponseSchema"` → 2 hits (≥1 required) ✓
- `grep "CoverageRefreshRequestSchema"` → 4 hits (≥1 required) ✓
- `grep "CoverageRefreshResponseSchema"` → 2 hits (≥1 required) ✓
- `grep "queryClient.invalidateQueries"` → 1 hit ✓
- `grep "import.*apiFetch.*from.*api"` → 1 hit ✓
- `grep -c "it.todo" coverageQueries.test.ts` → 0 ✓
- All 14 tests GREEN; full SPA suite 730/730 ✓
- Typecheck: exit 0 ✓
