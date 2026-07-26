---
phase: 12-observability-conformance-surface
plan: "00"
subsystem: api,ui,foundation
tags: [zod, schemas, react, matchMedia, useSyncExternalStore, ndjson, retention]

# Dependency graph
requires:
  - phase: 11-coverage-trends-skill-drift
    provides: NDJSON snapshot store (coverage-history/<date>.ndjson), CoverageHistoryResponseSchema (Phase 11 windowDays:14 literal — semantically independent of retention)
  - phase: 11.1-impeccable-p1-polish-bundle
    provides: usePageHeaderHeight external-store hook template (mirrored by useViewportBreakpoint)
provides:
  - ConformanceResponseSchema + 6 sibling schemas (ConformanceTier, ConformanceDayPoint, PathDriftEntry, PathDriftReason, RegistryFixPathRequest)
  - tierOf(score) helper — single source of truth for D-12-04 threshold mapping
  - RETENTION_DAYS = 90 (was 14) — powers Plan 12-03's 90-day fleet trend chart
  - useViewportBreakpoint() hook — Tailwind 4 breakpoint via matchMedia + useSyncExternalStore
affects:
  - 12-01 (snapshotFleetReader — depends on RETENTION_DAYS=90 + conformance schema)
  - 12-02 (daemon route + cache — imports ConformanceResponseSchema)
  - 12-03 (fleet trend chart SPA — imports ConformanceResponse + ConformanceDayPoint)
  - 12-04 (family cards SPA — imports tierOf + ConformanceTier)
  - 12-05 (CoverageFamilySection responsive — imports useViewportBreakpoint)
  - 12-06 (RegistryFixPath — imports RegistryFixPathRequestSchema)

# Tech tracking
tech-stack:
  added: []  # no new deps; reuses zod + react 18 useSyncExternalStore
  patterns:
    - Sibling-schema per surface (D-12-15) — conformance.ts mirrors coverage.ts and coverageHistory.ts; index.ts barrel re-exports only
    - matchMedia + useSyncExternalStore as the React 18 idiomatic external-store primitive for viewport state (vs ResizeObserver — see §A6 deviation note)
    - z.literal(N) + .strict() on every nested object — three independent structural guardrails against silent wire-shape drift (inherited from Phase 11 INV-04)

key-files:
  created:
    - packages/shared/src/schemas/conformance.ts — Phase 12 wire shape (7 exports + 6 types)
    - packages/shared/src/schemas/conformance.test.ts — 31 Zod round-trip + boundary tests
    - packages/spa/src/lib/useViewportBreakpoint.ts — matchMedia + useSyncExternalStore hook
    - packages/spa/src/lib/useViewportBreakpoint.test.ts — 8 hook tests
  modified:
    - packages/shared/src/index.ts — barrel re-export 7 schemas + 6 types
    - packages/agent/src/lib/snapshots/snapshotPaths.ts — RETENTION_DAYS 14 → 90
    - packages/agent/src/lib/snapshots/snapshotPaths.test.ts — assertion updated to .toBe(90)

key-decisions:
  - "A1 ratified: NDJSON retention bump 14→90 is non-cascading. Only the snapshotPaths.test.ts assertion required updating; snapshotPruner/Writer/Reader picked up the new constant via import. Phase 11 CoverageHistoryResponseSchema.windowDays z.literal(14) UNTOUCHED — it is the drift-summary detection window, semantically independent of snapshot retention."
  - "A6 ratified: useViewportBreakpoint uses matchMedia + useSyncExternalStore (NOT ResizeObserver as CONTEXT D-12-22 proposed). matchMedia fires ~5 events / resize drag vs RO's ~5000; same regression class as Phase 11.1 usePageHeaderHeight. The --vp-bp CSS-var publish (CONTEXT D-12-22 defence-in-depth) is deferred to Plan 12-05's consumer — hook stays pure state."
  - "Conformance schema is a sibling file (D-12-15), NOT a widening of CoverageResponseSchema. Keeps /api/coverage hot path lean and respects Phase 11 D-11-12 per-feature schema-file boundary."

patterns-established:
  - "RED-first TDD per task — every hook/schema landed as a failing test commit (test:) followed by a passing implementation commit (feat:). 5 atomic commits total across 3 tasks."
  - "Documented architectural deviations inline in the implementation header (useViewportBreakpoint.ts rationale block cites D-12-22 + §A6 + Pitfall 10) — future readers see the load-bearing reasoning without re-reading 1500-line RESEARCH.md."

requirements-completed:
  - REQ-12-CON-01
  - REQ-12-RVP-01
  - REQ-12-FOUNDATION-01

# Metrics
duration: ~5min
completed: 2026-05-20
---

# Phase 12 Plan 00: Wave 0 foundations Summary

**Shared conformance schema (7 exports + 6 types) + NDJSON retention bump 14→90d + matchMedia/useSyncExternalStore viewport breakpoint hook — three foundational deliverables that unblock every Phase 12 downstream wave.**

## Performance

- **Duration:** ~5 min wall-clock
- **Started:** 2026-05-20T07:30:00Z
- **Completed:** 2026-05-20T07:40:00Z
- **Tasks:** 3 (all TDD red-green)
- **Files modified:** 6 (3 new + 3 edited)

## Accomplishments

- **Locked the Phase 12 wire contract** — `ConformanceResponseSchema` (bulk-per-family, schemaVersion:1, .strict() throughout) + `tierOf` helper exported from `@agenticapps/dashboard-shared`. Both daemon (Plan 12-02) and SPA (Plans 12-03/04) now share a single source of truth; any future drift surfaces as a Zod parse error at the route boundary (T-12-SCHEMA-DRIFT mitigation).
- **Retention bumped 14d → 90d with zero cascading test failures (A1 ratified)** — only the single boundary assertion in `snapshotPaths.test.ts` required updating. `snapshotWriter.ts` and `snapshotReader.ts` import the constant, picking up the new value automatically; `snapshotPruner.test.ts` already used an explicit literal `14` arg per its boundary-semantics contract and remained untouched. Disk footprint now ~750KB (90 × 42 × ~200 bytes), trivially within budget.
- **`useViewportBreakpoint` hook published with matchMedia + useSyncExternalStore (A6 deviation from CONTEXT D-12-22)** — fires on threshold crossings only (~5 events / resize drag) vs ResizeObserver's ~5000 events. SSR-safe defensive fallback returns `'lg'` when `typeof window === 'undefined'`. 8 tests cover all 5 breakpoint returns, subscribe/unsubscribe, and re-render on `change`.

## Task Commits

Each task was committed atomically (TDD red-green pair):

1. **Task 1 RED: failing tests for conformance schema** — `a19964f` (test)
2. **Task 1 GREEN: conformance shared schema (D-12-14/15/16)** — `be2f122` (feat)
3. **Task 2: bump NDJSON retention 14d → 90d** — `880d20a` (feat)
4. **Task 3 RED: failing tests for useViewportBreakpoint** — `a72f1d3` (test)
5. **Task 3 GREEN: useViewportBreakpoint hook** — `adc89ab` (feat)

_Note: Task 2 is a single atomic commit because the test edit and implementation edit are inseparable (the assertion has to match the constant; running them as separate red→green commits would leave master red mid-sequence)._

## Files Created/Modified

- `packages/shared/src/schemas/conformance.ts` (NEW, 142 lines) — Phase 12 wire shape: ConformanceTierSchema, tierOf, ConformanceDayPointSchema (5-field strict), PathDriftReasonSchema, PathDriftEntrySchema, ConformanceResponseSchema (schemaVersion: z.literal(1) + .strict() throughout), RegistryFixPathRequestSchema
- `packages/shared/src/schemas/conformance.test.ts` (NEW, 271 lines) — 31 tests: 7 describe blocks covering tier enum, tierOf boundaries, score int 0-100, day-point strict + date regex, drift-entry 3 reasons + nullable suggestedPath, response 0/1/90-entry series + reject schemaVersion!=1 + datetime, fix-path req min(1)
- `packages/shared/src/index.ts` (MOD) — appended 7 schema re-exports + 6 type re-exports for Phase 12 conformance namespace
- `packages/agent/src/lib/snapshots/snapshotPaths.ts` (MOD) — RETENTION_DAYS 14 → 90; expanded comment cites D-12-09 and explicitly separates from Phase 11 windowDays literal
- `packages/agent/src/lib/snapshots/snapshotPaths.test.ts` (MOD) — single assertion updated from `.toBe(14)` to `.toBe(90)` with D-12-09 citation
- `packages/spa/src/lib/useViewportBreakpoint.ts` (NEW, 63 lines) — matchMedia + useSyncExternalStore hook with documented A6 deviation; type `Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'`
- `packages/spa/src/lib/useViewportBreakpoint.test.ts` (NEW, 203 lines) — 8 tests; uses bespoke matchMedia mock with per-query listener registry so dispatchEvent can be simulated (jsdom matchMedia is no-op by default)

## Decisions Made

- **A1 ratification (retention bump non-cascading) — confirmed empirically.** Plan PLAN.md notes block predicted this; execution confirmed it. Only one test assertion needed updating. All 5 snapshot test suites (36 tests) stayed green. Comments referencing "14d window" in `snapshotWriter.ts:12` + `snapshotReader.ts:2,87` are documentation only and left as-is for opportunistic Wave 6 cleanup per plan instruction.
- **A6 ratification (matchMedia over ResizeObserver) — landed verbatim from RESEARCH §A6.** Documented inline in the hook header so the deviation from CONTEXT D-12-22 is discoverable by anyone reading the code without bouncing back to the planning docs. The `--vp-bp` CSS-var publish that CONTEXT proposed is left to Plan 12-05's consumer (defence-in-depth there if it actually needs it; hook stays pure state).
- **Test mock pattern: bespoke matchMedia harness over reuse of `theme.sync.test.tsx`'s `makeMatchMedia`.** That helper only supports a single static `matches` boolean and stubs `addEventListener`/`removeEventListener` as bare `vi.fn()`s. The hook needs `dispatchEvent`-style re-render simulation (test "re-renders when matchMedia fires 'change'") which requires the listeners to be call-able. The test file's `installMatchMedia(match)` helper accepts a per-query predicate and keeps a per-query listener registry so `fireChange(query)` can drive the hook through threshold crossings. Pattern is reusable; future viewport tests can copy or extract it to a `vitest-setup-matchMedia.ts` helper.

## Deviations from Plan

None — plan executed exactly as written. Both pre-known deviations (A1 retention non-cascading; A6 matchMedia over ResizeObserver) were explicitly ratified in the plan notes block, so they are NOT deviations from THIS plan — they are deviations from the CONTEXT document already absorbed at planning time and documented inline in the implementation.

## Issues Encountered

None. All three tasks ran red→green in the predicted sequence:

- Task 1 RED: 0 tests run, file-not-found (expected); GREEN: 31 passing, 265 total shared green.
- Task 2: single-step constant change; all 36 snapshot tests green, no cascading per A1.
- Task 3 RED: 0 tests run, file-not-found (expected); GREEN: 8 passing, 1015 total SPA green.

Full workspace verification:

- `pnpm -r typecheck`: clean across all 5 packages (shared / agentlinter / agent / spa / meta-observer)
- `pnpm -r test --run`: 265 shared + 778 agent + 1015 spa + 31 meta-observer = **2089 tests, all passing**
- Test-count delta vs pre-Wave-0 baseline: +31 shared (Task 1) + 0 agent (Task 2 was 1 assertion edit, no test added) + 8 spa (Task 3) = +39 new tests; matches plan budget.

## Wave 1+ Unblocks

Wave 1+ (Plans 12-01..06) can now `import { ConformanceResponse, ConformanceDayPoint, PathDriftEntry, RegistryFixPathRequest, tierOf } from '@agenticapps/dashboard-shared'` without error. The 90-day NDJSON window is on disk (will populate over 90 calendar days of daemon uptime; D-12-13 empty state covers the warm-up). The viewport hook is ready for Plan 12-05's CoverageFamilySection responsive collapse.

## Self-Check: PASSED

- `packages/shared/src/schemas/conformance.ts`: FOUND
- `packages/shared/src/schemas/conformance.test.ts`: FOUND
- `packages/agent/src/lib/snapshots/snapshotPaths.ts`: FOUND (modified)
- `packages/agent/src/lib/snapshots/snapshotPaths.test.ts`: FOUND (modified)
- `packages/spa/src/lib/useViewportBreakpoint.ts`: FOUND
- `packages/spa/src/lib/useViewportBreakpoint.test.ts`: FOUND
- Commit `a19964f` (test 12-00 conformance): FOUND
- Commit `be2f122` (feat 12-00 conformance schema): FOUND
- Commit `880d20a` (feat 12-00 retention 14→90): FOUND
- Commit `a72f1d3` (test 12-00 useViewportBreakpoint): FOUND
- Commit `adc89ab` (feat 12-00 useViewportBreakpoint): FOUND

---
*Phase: 12-observability-conformance-surface*
*Plan: 00 — Wave 0 foundations*
*Completed: 2026-05-20*
