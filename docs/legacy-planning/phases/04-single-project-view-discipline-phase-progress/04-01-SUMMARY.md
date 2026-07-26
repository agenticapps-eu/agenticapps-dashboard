---
phase: 04-single-project-view-discipline-phase-progress
plan: "01"
subsystem: shared-schemas
tags:
  - zod
  - wire-schemas
  - tdd
  - phase-4
dependency_graph:
  requires:
    - packages/shared/src/schemas/overview.ts (FindingCountsSchema — read-only, not modified)
    - packages/shared/src/index.ts (barrel — extended)
  provides:
    - CommitmentBlockResponseSchema (wire contract for GET /api/projects/:id/commitment)
    - HookFiringSchema + ObservationsRecentResponseSchema (wire contract for GET /api/projects/:id/observations/recent)
    - RationalizationRowSchema + DisciplineResponseSchema (wire contract for GET /api/projects/:id/discipline)
    - PhaseFileStatusSchema + ExecutionTimelineEntrySchema + ReviewFindingCountsSchema + ReviewStatusPayloadSchema + VerificationStatusPayloadSchema + PhaseProgressResponseSchema (wire contract for GET /api/projects/:id/phase-progress)
    - CsoSummarySchema + DbSentinelSummarySchema + SecurityResponseSchema (wire contract for GET /api/projects/:id/security)
  affects:
    - packages/agent — downstream parsers and routes (Plans 02–03) import these schemas
    - packages/spa — SPA query hooks (Plan 04) import these schemas
tech_stack:
  added: []
  patterns:
    - z.object({...}).passthrough() for forward-compatible HookFiringSchema (D-4-06)
    - z.string().nullable() for optional wire fields (project convention)
    - ESM .js extension on relative imports (TypeScript ESM moduleResolution nodenext)
    - TDD red-green with paired test files next to source
key_files:
  created:
    - packages/shared/src/schemas/commitment.ts
    - packages/shared/src/schemas/commitment.test.ts
    - packages/shared/src/schemas/observations.ts
    - packages/shared/src/schemas/observations.test.ts
    - packages/shared/src/schemas/discipline.ts
    - packages/shared/src/schemas/discipline.test.ts
    - packages/shared/src/schemas/phaseDetail.ts
    - packages/shared/src/schemas/phaseDetail.test.ts
    - packages/shared/src/schemas/security.ts
    - packages/shared/src/schemas/security.test.ts
  modified:
    - packages/shared/src/index.ts (barrel re-exports — additive only)
decisions:
  - "HookFiringSchema uses .passthrough() to tolerate unknown meta-observer fields without dashboard release coupling (D-4-06)"
  - "ReviewFindingCountsSchema (4-bucket: critical/high/medium/low) is a distinct schema from FindingCountsSchema (3-bucket: red/yellow/green) — both coexist in the package; Test 2.5 enforces the boundary"
  - "CommitRef inner schema is not exported — implementation detail of ExecutionTimelineEntrySchema only"
  - "CsoSummarySchema.content has no length cap in schema — parser-side 4096-char cap tracked as Plan 02 acceptance criterion per RESEARCH §Pitfall / Resource exhaustion"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-06T07:10:01Z"
  tasks_completed: 3
  files_created: 10
  files_modified: 1
---

# Phase 04 Plan 01: Phase 4 Wire Schemas — Summary

Five new Zod schema files (with paired tests) added to `@agenticapps/dashboard-shared`, re-exported from `index.ts`. All Phase 4 daemon ↔ SPA wire contracts are now locked with `HookFiringSchema.passthrough()` enabling forward-compatible meta-observer event evolution (D-4-06) and a distinct four-bucket `ReviewFindingCountsSchema` coexisting safely alongside Phase 3's three-bucket `FindingCountsSchema`.

## Schema Files

| File | Exports | Lines |
|------|---------|-------|
| `commitment.ts` | `CommitmentBlockResponseSchema`, `CommitmentBlockResponse` | 13 |
| `observations.ts` | `HookFiringSchema`, `HookFiring`, `ObservationsRecentResponseSchema`, `ObservationsRecentResponse` | 26 |
| `discipline.ts` | `RationalizationRowSchema`, `RationalizationRow`, `DisciplineResponseSchema`, `DisciplineResponse` | 25 |
| `phaseDetail.ts` | `PhaseFileStatusSchema`, `PhaseFileStatus`, `ExecutionTimelineEntrySchema`, `ExecutionTimelineEntry`, `ReviewFindingCountsSchema`, `ReviewFindingCounts`, `ReviewStatusPayloadSchema`, `ReviewStatusPayload`, `VerificationStatusPayloadSchema`, `VerificationStatusPayload`, `PhaseProgressResponseSchema`, `PhaseProgressResponse` | 72 |
| `security.ts` | `CsoSummarySchema`, `CsoSummary`, `DbSentinelSummarySchema`, `DbSentinelSummary`, `SecurityResponseSchema`, `SecurityResponse` | 25 |

Total new source lines: 161. Total new test lines: 222.

## Test Coverage

Total new test cases: **25** (exceeds the plan's minimum of 22).

| Test file | Test cases |
|-----------|-----------|
| commitment.test.ts | 3 (happy path, null state, type rejection) |
| observations.test.ts | 4 (passthrough preservation, missing-field rejection, empty-skillInstalled, entries-with-skillInstalled) |
| discipline.test.ts | 4 (valid row, negative-fires rejection, with-row, empty-state) |
| phaseDetail.test.ts | 9 (present file, missing file, incomplete pair, no-commits, 4-bucket accept, 3-bucket reject, null/null review, stage1 present, verification, no-phase shape) |
| security.test.ts | 4 (CsoSummary, DbSentinelSummary, null/null, both present) |

Full test suite after plan: `packages/shared` 82 tests / 11 files, `packages/agent` 218 tests / 35 files, `packages/spa` 302 tests / 35 files — all green.

## Four-bucket vs Three-bucket Schema Coexistence

`FindingCountsSchema` in `overview.ts` (Phase 3, untouched):
```
{ red: number, yellow: number, green: number }
```

`ReviewFindingCountsSchema` in `phaseDetail.ts` (Phase 4, new):
```
{ critical: number, high: number, medium: number, low: number }
```

Test 2.5 explicitly asserts `ReviewFindingCountsSchema.parse({ red: 0, yellow: 0, green: 0 })` throws — proving the schemas are independent and cross-wiring would fail at parse time. TypeScript inferred types differ structurally so cross-wiring also fails at compile time.

## TDD Commit Pairs

| Task | RED commit | GREEN commit |
|------|-----------|-------------|
| Task 1 (commitment/observations/discipline) | `6026df8` — `test(04-01): add failing tests for commitment/observations/discipline schemas (RED)` | `255a1e8` — `feat(04-01): implement commitment/observations/discipline schemas (GREEN)` |
| Task 2 (phaseDetail/security) | `9d72e49` — `test(04-01): add failing tests for phaseDetail/security schemas (RED)` | `f559f42` — `feat(04-01): implement phaseDetail/security schemas (GREEN)` |
| Task 3 (barrel) | n/a — barrel re-exports are not TDD (no failing test possible) | `cfd0836` — `feat(04-01): re-export Phase 4 schemas from @agenticapps/dashboard-shared barrel` |

## Deviations from Plan

None — plan executed exactly as written. All five schema files match the verbatim shapes specified in the `<action>` blocks. No additions, no omissions.

## Known Stubs

None. This plan adds pure wire schema definitions with no UI rendering and no data sources. No stubs exist.

## Threat Flags

None. The plan's `<threat_model>` covered all new surfaces (T-04-01-01 through T-04-01-05). No new security-relevant surface was introduced beyond what the threat model analyzed.

## Self-Check: PASSED

- `packages/shared/src/schemas/commitment.ts` — FOUND
- `packages/shared/src/schemas/observations.ts` — FOUND
- `packages/shared/src/schemas/discipline.ts` — FOUND
- `packages/shared/src/schemas/phaseDetail.ts` — FOUND
- `packages/shared/src/schemas/security.ts` — FOUND
- `packages/shared/src/index.ts` updated with 5 new re-export blocks — FOUND
- Commits `6026df8`, `255a1e8`, `9d72e49`, `f559f42`, `cfd0836` — all confirmed in git log
- `pnpm --filter @agenticapps/dashboard-shared test --run` exits 0 (82 tests)
- `pnpm -r typecheck` exits 0
- `pnpm -r test --run` exits 0 (602 total tests across 3 packages)
