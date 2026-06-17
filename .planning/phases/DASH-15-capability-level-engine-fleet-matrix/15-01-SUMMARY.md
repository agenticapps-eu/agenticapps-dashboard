---
phase: DASH-15-capability-level-engine-fleet-matrix
plan: "01"
subsystem: shared-schemas
tags: [zod, schema, wire-contract, cml-07, tdd]
dependency_graph:
  requires: []
  provides:
    - ClaudeMdEvalSchema (packages/shared)
    - CoverageRowSchema.eval optional field
  affects:
    - packages/agent (Plan 02 imports ClaudeMdEval)
    - packages/spa (Plans 03–04 import ClaudeMdEval)
tech_stack:
  added: []
  patterns:
    - Zod nested object schema (agentlinter.ts analog)
    - Optional field back-compat (Phase 14 understand precedent)
    - TDD red-green cycle (17 tests, strict boundary + round-trip)
key_files:
  created:
    - packages/shared/src/schemas/claudeMdLevel.ts
    - packages/shared/src/schemas/claudeMdLevel.test.ts
  modified:
    - packages/shared/src/schemas/coverage.ts
    - packages/shared/src/index.ts
decisions:
  - "ClaudeMdLevelSchema uses z.number().int().min(0).max(6) — no enum, plain integer for strict-cumulative arithmetic"
  - "No .strict() on ClaudeMdEvalSchema — matches CoverageRow back-compat policy (future fields passthrough)"
  - "eval field placed after understand, before degraded — follows Phase 14 ordering convention"
  - "Barrel export block appended after clipboard.js block — consistent with end-of-file extension pattern"
metrics:
  duration: "2 min"
  completed: "2026-06-17T12:05:35Z"
  tasks: 2
  files: 4
---

# Phase DASH-15 Plan 01: ClaudeMdEval Shared Schema — Summary

**One-liner:** Zod `ClaudeMdEval` schema with strict-cumulative L0–L6 level + per-rung checks wired as optional `eval` field on `CoverageRowSchema` and barrel-exported from `@agenticapps/dashboard-shared`.

## What Was Built

Plan 01 establishes the Wave 1 foundation for DASH-15: the `ClaudeMdEval` shared Zod schema that all downstream plans (scanner in Plan 02, SPA badge+drawer in Plans 03–04) depend on. Three schemas were created in `packages/shared/src/schemas/claudeMdLevel.ts`:

- `ClaudeMdLevelSchema` — `z.number().int().min(0).max(6)` for the L0–L6 headline level
- `RungCheckSchema` — per-rung evaluation object with `rung/label/passed/inferred?/evidence[]`
- `ClaudeMdEvalSchema` — top-level wire contract with `level/levelLabel/rungs[]/nextSteps[]/inferred`

`CoverageRowSchema` in `coverage.ts` gained `eval: ClaudeMdEvalSchema.optional()` positioned after the `understand` field, following the Phase 14 back-compat pattern. All three schemas and their inferred types are re-exported from `packages/shared/src/index.ts`.

## Verification Results

- `pnpm --filter @agenticapps/dashboard-shared test` — 26 test files, 393 tests, all pass
- `pnpm --filter @agenticapps/dashboard-shared typecheck` — exits 0
- `ClaudeMdEvalSchema` importable as both value-schema and type from `@agenticapps/dashboard-shared`
- Round-trip stability verified: `parse(JSON.parse(JSON.stringify(parsed)))` deepEquals `parsed`

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ClaudeMdEval schema file + round-trip tests | `2be0404` | claudeMdLevel.ts, claudeMdLevel.test.ts |
| 2 | Wire eval field into CoverageRowSchema + barrel exports | `083cd74` | coverage.ts, index.ts |

## Deviations from Plan

None — plan executed exactly as written.

TDD cycle completed correctly:
- RED: test file written first, failed with "Cannot find module './claudeMdLevel.js'"
- GREEN: schema file implemented, all 17 tests passed immediately

## Known Stubs

None. The schema is fully implemented with no placeholder values.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what the plan's threat model covers. `ClaudeMdEvalSchema` validates the `eval` field on both daemon and SPA sides per T-15-01-01. The `.optional()` disposition implements T-15-01-02 (pre-DASH-15 daemons omit the field without breaking the SPA).

## Self-Check: PASSED

- [x] `packages/shared/src/schemas/claudeMdLevel.ts` — exists, 46 lines, exports 3 schemas + 3 types
- [x] `packages/shared/src/schemas/claudeMdLevel.test.ts` — exists, 17 tests green
- [x] `packages/shared/src/schemas/coverage.ts` — `eval: ClaudeMdEvalSchema.optional()` present
- [x] `packages/shared/src/index.ts` — `claudeMdLevel` referenced 2x (schema export + type export)
- [x] Commit `2be0404` — verified in git log
- [x] Commit `083cd74` — verified in git log
