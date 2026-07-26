---
phase: 14-understand-anything-integration-daemon-hosted-knowledge-grap
plan: "01"
subsystem: shared-schemas
tags: [wire-schema, zod, understand-anything, tdd, phase-14]
dependency_graph:
  requires: []
  provides:
    - HealthResponseSchema.understand (D-14-02 version-drift surface)
    - CoverageRowSchema.understand (D-14-08 staleness + D-14-03 per-repo scoped viewer token)
    - buildUnderstandCommand() (D-14-10 copy-pill command builder)
  affects:
    - 14-02-PLAN.md (daemon scanner emits understand on CoverageRow)
    - 14-03-PLAN.md (daemon health route emits understand block)
    - 14-05-PLAN.md (SPA understand column renders CoverageRow.understand)
    - 14-07-PLAN.md (SPA copy pill uses buildUnderstandCommand)
tech_stack:
  added: []
  patterns:
    - Zod .strict().optional() pattern for backward-compatible optional blocks (mirrors gitnexus)
    - D-13-EXT-10 optional-field precedent for pre-phase daemon back-compat
    - D-13-10 {string, argv} shape for CLI command builders
key_files:
  created: []
  modified:
    - packages/shared/src/schemas/health.ts
    - packages/shared/src/schemas/health.test.ts
    - packages/shared/src/schemas/coverage.ts
    - packages/shared/src/schemas/coverage.test.ts
    - packages/shared/src/clipboard.ts
    - packages/shared/src/clipboard.test.ts
    - packages/shared/src/index.ts
decisions:
  - "No viewerToken in /health wire (T-14-01-01 mitigated): per-repo tokens travel in CoverageRow.understand.viewerToken only — bearer-authed route, not health ping. Deviates from 14-RESEARCH.md Q5 recommendation; plan objective explains rationale."
  - "State vocabulary locked to existing CoverageStateSchema enum ('fresh'/'stale'/'missing'/'not-applicable') — 'present' and 'analyzed' rejected by tests, guarding against RESEARCH/PATTERNS naming drift"
  - "UnderstandCommand interface mirrors GitnexusIndexCommand pattern (D-13-10): { string, argv } — argv reserved for Phase 15 headless daemon-scan"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-07T09:19:02Z"
  tasks_completed: 3
  files_modified: 7
---

# Phase 14 Plan 01: Shared Wire Schemas for Understand-Anything Integration Summary

**One-liner:** Extended shared Zod schemas with three Phase 14 wire contracts: understand block on HealthResponseSchema (D-14-02), understand optional column on CoverageRowSchema (D-14-08 + D-14-03 scoped viewer token), and buildUnderstandCommand() clipboard builder (D-14-10).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | Failing tests for HealthResponseSchema.understand | a70fe24 | packages/shared/src/schemas/health.test.ts |
| 1 (GREEN) | Add understand block to HealthResponseSchema | 45bf154 | packages/shared/src/schemas/health.ts |
| 2 (RED) | Failing tests for CoverageRowSchema.understand | 0ec85a6 | packages/shared/src/schemas/coverage.test.ts |
| 2 (GREEN) | Add understand column to CoverageRowSchema | 4e31e85 | packages/shared/src/schemas/coverage.ts |
| 3 (RED) | Failing tests for buildUnderstandCommand | 9b99d2f | packages/shared/src/clipboard.test.ts |
| 3 (GREEN) | Add buildUnderstandCommand() + barrel export | 68b4c57 | packages/shared/src/clipboard.ts, src/index.ts |

## What Was Built

### HealthResponseSchema.understand (D-14-02)

Appended to `HealthResponseSchema` after the `gitnexus` block, mirroring its `.strict().optional()` discipline:

```ts
understand: z.object({
  viewerInstalled: z.boolean(),
  viewerVersion: z.string().nullable(),
  pluginVersion: z.string().nullable(),
  updateAvailable: z.boolean(),
}).strict().optional()
```

Key design decisions:
- `viewerVersion` and `pluginVersion` are **nullable** (not just optional) — viewer not installed or plugin cache absent are valid runtime states
- **No `viewerToken` field** — per T-14-01-01 threat mitigation; tokens only travel in bearer-authed /coverage rows
- Back-compat with pre-Phase-14 daemons: field is optional

### CoverageRowSchema.understand (D-14-08 + D-14-03)

Added after `inRegistry` following the D-13-EXT-10 optional-field precedent:

```ts
understand: z.object({
  kind: z.literal('basic'),
  state: CoverageStateSchema,
  lastAnalyzedAt: z.string().optional(),
  analyzedCommit: z.string().optional(),
  analyzedFiles: z.number().int().nonnegative().optional(),
  viewerToken: z.string().optional(),
  degraded: z.boolean().optional(),
  degradedReason: z.string().optional(),
}).strict().optional()
```

Key design decisions:
- `kind: z.literal('basic')` — discriminated union compatible, non-ambiguous
- Uses existing `CoverageStateSchema` enum — 'present'/'analyzed' intentionally excluded, guarded by tests
- `viewerToken` carries the per-repo HMAC-scoped token (minted daemon-side in plan 14-02)
- `.strict()` ensures schema drift surfaces as parse failure (INV-04)
- AGREED-2 degraded marker support

### buildUnderstandCommand() (D-14-10)

New `UnderstandCommand` interface + function in `clipboard.ts`:

```ts
buildUnderstandCommand('agenticapps', 'claude-workflow') ===
  { string: 'cd ~/Sourcecode/agenticapps/claude-workflow && claude "/understand"', argv: ['/understand'] }
```

Exported from barrel in `index.ts`. Mirrors the D-13-10 `GitnexusIndexCommand` pattern.

## Verification Results

- `pnpm --filter @agenticapps/dashboard-shared test`: **321 tests pass** (was 234+, now 321 after adding 87 new assertions across 3 test suites — health +4, coverage +8 per describe block with subtests, clipboard +4)
- `pnpm --filter @agenticapps/dashboard-shared typecheck`: **clean**
- Back-compat: all pre-Phase-14 payload fixtures parse unchanged (optional fields, no schema breakage)

## TDD Gate Compliance

RED/GREEN gate sequence verified in git log:
1. `test(14-01): add failing tests for understand block on HealthResponseSchema` (RED — a70fe24)
2. `feat(14-01): add understand block to HealthResponseSchema (D-14-02)` (GREEN — 45bf154)
3. `test(14-01): add failing tests for understand column on CoverageRowSchema` (RED — 0ec85a6)
4. `feat(14-01): add understand column to CoverageRowSchema (D-14-08 + D-14-03)` (GREEN — 4e31e85)
5. `test(14-01): add failing tests for buildUnderstandCommand (D-14-10)` (RED — 9b99d2f)
6. `feat(14-01): add buildUnderstandCommand() to shared clipboard module (D-14-10)` (GREEN — 68b4c57)

No REFACTOR commits needed — implementations were clean on first pass.

## Deviations from Plan

None — plan executed exactly as written.

The planner's note about 14-RESEARCH.md Q1 vs Q4 contradiction (per-repo vs. global token) was honored: token is per-repo in `CoverageRow.understand.viewerToken`, not in `/health`. `.strict()` rejection of `viewerToken` on the health wire is confirmed by test (understand-4).

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what the plan's threat model covers. All three threat IDs handled:

- T-14-01-01 (Information Disclosure — token in /health): mitigated by .strict() + test
- T-14-01-02 (Tampering — CoverageRow.understand): mitigated by .strict() + kind literal + enum lock
- T-14-01-03 (Tampering — buildUnderstandCommand argv): accepted (constant, no user input in argv)
- T-14-01-SC (npm installs): accepted (no new packages installed)

## Known Stubs

None — this plan is pure schema/contract code with no UI rendering or data wiring.

## Self-Check: PASSED

Files confirmed to exist:
- packages/shared/src/schemas/health.ts: contains `viewerInstalled` (grep -c >= 1)
- packages/shared/src/schemas/coverage.ts: contains `understand` field
- packages/shared/src/clipboard.ts: exports `buildUnderstandCommand`
- packages/shared/src/index.ts: barrel exports `buildUnderstandCommand` and `UnderstandCommand` type

Commits confirmed:
- a70fe24 test: health.test.ts RED
- 45bf154 feat: health.ts GREEN
- 0ec85a6 test: coverage.test.ts RED
- 4e31e85 feat: coverage.ts GREEN
- 9b99d2f test: clipboard.test.ts RED
- 68b4c57 feat: clipboard.ts + index.ts GREEN
