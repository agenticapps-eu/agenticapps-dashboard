---
phase: 13-gitnexus-scoped-scan-actions-coverage-matrix
plan: "00"
subsystem: shared-contracts + test-scaffold
tags: [daemon, subprocess, schema, fixtures, tdd, wave-0]
dependency_graph:
  requires: []
  provides:
    - GitnexusIndexCommand interface + buildGitnexusIndexClipboardString returning { string, argv }
    - GitnexusScanRequestSchema, GitnexusScanResponseSchema, GitnexusScanProgressSchema, GitnexusScanErrorCodeSchema
    - packages/agent/test-fixtures/stub-gitnexus.sh + stub-gitnexus-failing.sh (POSIX bash, chmod +x)
    - 5 RED-state test files (Wave 2 + Wave 3 will GREEN them)
  affects:
    - packages/spa (IndexGitNexusButton type error — expected, resolved in Plan 13-03)
tech_stack:
  added: []
  patterns:
    - TDD RED → GREEN per-task (two atomic commits per shared-package cycle)
    - .strict() on every Zod object (12 total) — INV-04 schema-drift defence
    - discriminatedUnion on scope + kind — no mixed-shape acceptance
    - POSIX bash stub binaries with env-knob API (no ~/.gitnexus writes)
key_files:
  created:
    - packages/shared/src/schemas/gitnexusScan.ts
    - packages/shared/src/schemas/gitnexusScan.test.ts
    - packages/agent/test-fixtures/stub-gitnexus.sh
    - packages/agent/test-fixtures/stub-gitnexus-failing.sh
    - packages/agent/src/routes/gitnexusScan.test.ts
    - packages/agent/src/lib/gitnexusScan.test.ts
    - packages/agent/src/lib/gitnexusFamilyScan.test.ts
    - packages/spa/src/lib/queries/gitnexusScan.test.ts
    - packages/spa/src/components/panels/coverage/ScanPill.test.tsx
  modified:
    - packages/shared/src/clipboard.ts
    - packages/shared/src/clipboard.test.ts
    - packages/shared/src/index.ts
decisions:
  - "GitnexusIndexCommand uses readonly fields (readonly string + readonly argv: readonly string[]) matching as const return"
  - "GitnexusScanErrorCodeSchema uses z.enum with 11 codes verbatim from D-13-EXT-06"
  - "Barrel export placed after Phase 12 conformance exports (alphabetical: g > c)"
  - "SPA queries tests placed in new packages/spa/src/lib/queries/ subdirectory (plan spec)"
  - "Agent RED tests use actual import failures (not it.todo) — preferred RED pattern per plan"
metrics:
  duration_minutes: 10
  completed_date: "2026-05-24"
  tasks_completed: 3
  files_created: 9
  files_modified: 3
  commits: 5
---

# Phase 13 Plan 00: Wave 0 Foundations — Shared Contracts + Test Scaffold Summary

**One-liner:** `GitnexusIndexCommand { string, argv }` + 4 Zod schemas (11-code enum, discriminated-union request/response/progress) + POSIX stub binaries + 36 RED scaffold tests covering all Wave 1-3 module surfaces.

## Tasks Completed

| Task | Name | Commits | Files |
|------|------|---------|-------|
| 1 | Extend buildGitnexusIndexClipboardString to return { string, argv } | 7499620 (RED), 49a30a0 (GREEN) | clipboard.ts, clipboard.test.ts, index.ts |
| 2 | Create shared Zod schemas for gitnexus scan wire contracts | f92e6eb (RED), bc0fe20 (GREEN) | schemas/gitnexusScan.ts, schemas/gitnexusScan.test.ts, index.ts |
| 3 | Create stub gitnexus binary fixtures + 6 RED-state test scaffolds | 1384fe8 | 7 new files |

## Clipboard Builder Extension (D-13-10)

**Final return shape:** `{ string: 'gitnexus analyze', argv: ['analyze'] } as const`

**Interface exported:**
```typescript
export interface GitnexusIndexCommand {
  readonly string: string
  readonly argv: readonly string[]
}
export function buildGitnexusIndexClipboardString(): GitnexusIndexCommand
```

Also exported from `packages/shared/src/index.ts` as `export type { GitnexusIndexCommand }`.

**Expected cross-package type error:** `IndexGitNexusButton.tsx` in `packages/spa` now receives `GitnexusIndexCommand` where it expected a `string`. This caller is being deleted in Plan 13-03 (D-13-06). The breakage is intentional and documented in the commit message.

## Shared Zod Schemas (packages/shared/src/schemas/gitnexusScan.ts)

All 4 schemas created verbatim from the `<interfaces>` block in 13-00-PLAN.md:

| Schema | Description |
|--------|-------------|
| `GitnexusScanErrorCodeSchema` | 11-code z.enum (BINARY_NOT_FOUND, REPO_NOT_REGISTERED, FAMILY_HAS_NO_REPOS, SCAN_IN_FLIGHT, BIND_REFUSED, RATE_LIMITED, SCAN_NOT_FOUND, SCAN_FAILED, SCAN_TIMEOUT, INVALID_REQUEST, INTERNAL_ERROR) |
| `GitnexusScanRequestSchema` | z.discriminatedUnion('scope') — repo (regex /^[a-z0-9\-]+\/[a-z0-9\-_.]+$/) + family (enum 3 families), .strict() on both |
| `GitnexusScanResponseSchema` | z.union — ok:true + scanId UUID, or ok:false + error code + requestId |
| `GitnexusScanProgressSchema` | z.union — ok:true + z.discriminatedUnion('kind': repo/family), or ok:false |

**.strict() count:** 12 total (request union × 2, response union × 2, repo job shape, family job shape, perRepoResult items, error object inside job, error object in progress ok:false — INV-04 / T-13-00-01).

**Barrel re-export:** `packages/shared/src/index.ts` — schemas + types added after Phase 12 conformance exports.

**Typecheck:** `pnpm --filter @agenticapps/dashboard-shared typecheck` exits 0.

**Tests:** `pnpm --filter @agenticapps/dashboard-shared test --run` — 291 tests pass (22 test files, all GREEN).

## Stub Gitnexus Binary Fixtures

| File | Mode | Env knobs |
|------|------|-----------|
| `packages/agent/test-fixtures/stub-gitnexus.sh` | `chmod +x`, POSIX bash | STUB_GITNEXUS_EXIT_CODE (default 0), STUB_GITNEXUS_DELAY_MS (default 0), STUB_GITNEXUS_STDERR (default empty) |
| `packages/agent/test-fixtures/stub-gitnexus-failing.sh` | `chmod +x`, POSIX bash | STUB_FAIL_ON_INVOCATION (default 2), STUB_COUNTER_DIR (default $TMPDIR) |

Both pass `bash -n` syntax check. Neither writes to `~/.gitnexus`. Tests needing a writable home use the Phase 10 gitnexusHomeOverride pattern (tmpdir per test).

## RED-State Test Scaffolds

All 5 RED test files exist and fail at module-load time (expected — the modules under test don't exist yet):

| File | Wave to GREEN | Test count | Error type |
|------|---------------|------------|------------|
| `packages/agent/src/routes/gitnexusScan.test.ts` | Wave 2 (Plan 13-02) | 10 | Cannot find module '../routes/gitnexusScan.js' |
| `packages/agent/src/lib/gitnexusScan.test.ts` | Wave 2 (Plan 13-02) | 7 | Cannot find module '../lib/gitnexusScan.js' |
| `packages/agent/src/lib/gitnexusFamilyScan.test.ts` | Wave 2 (Plan 13-02) | 5 | Cannot find module '../lib/gitnexusFamilyScan.js' |
| `packages/spa/src/lib/queries/gitnexusScan.test.ts` | Wave 3 (Plan 13-03) | 7 | Failed to resolve import './gitnexusScan.js' |
| `packages/spa/src/components/panels/coverage/ScanPill.test.tsx` | Wave 3 (Plan 13-03) | 7 | Failed to resolve import './ScanPill.js' |

**Total:** 36 test declarations across 5 files (agent: 22, SPA: 14).

**Wave attribution comments:** All 5 files contain header comments specifying which plan GREENs them.

## Deviations from Plan

None — plan executed exactly as written.

The only noteworthy adaptation: the plan mentioned `packages/spa/src/lib/conformanceQueries.ts` as a donor for the `gitnexusScan.test.ts` harness, but the `queries/` subdirectory did not yet exist. It was created as part of this plan (per the plan's file list which specified `packages/spa/src/lib/queries/gitnexusScan.test.ts`).

## Verification Results

- `pnpm --filter @agenticapps/dashboard-shared test --run` → 291 tests, 22 files, all PASS
- `pnpm --filter @agenticapps/dashboard-shared typecheck` → exit 0
- `test -x packages/agent/test-fixtures/stub-gitnexus.sh` → 0
- `test -x packages/agent/test-fixtures/stub-gitnexus-failing.sh` → 0
- `bash -n packages/agent/test-fixtures/stub-gitnexus.sh` → exit 0
- `bash -n packages/agent/test-fixtures/stub-gitnexus-failing.sh` → exit 0
- All 5 RED test files fail at import time with "Cannot find module" / "Failed to resolve import"
- 5 atomic commits in this plan (2 per TDD cycle × 2 tasks + 1 scaffold task)

## Known Stubs

None — this plan creates foundational contracts and test scaffolds only. No UI components or data hooks were implemented; all stub status in downstream plans is tracked via the RED test files created here.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: subprocess-side-effect | packages/shared/src/schemas/gitnexusScan.ts | GitnexusScanErrorCodeSchema includes SCAN_FAILED/SCAN_TIMEOUT codes which are used in Wave 2 spawn path. The spawn path itself (where the actual threat surface lies) is not in this wave — flagged here for Wave 2 reviewer awareness. T-13-00-04 (gitnexus writes ~/.gitnexus outside daemon boundary) is pre-documented in the plan threat model and acknowledged as an explicit carve-out. |

## Self-Check: PASSED

All files found, all commits verified present.

| Item | Status |
|------|--------|
| packages/shared/src/clipboard.ts | FOUND |
| packages/shared/src/schemas/gitnexusScan.ts | FOUND |
| packages/agent/test-fixtures/stub-gitnexus.sh | FOUND |
| packages/agent/test-fixtures/stub-gitnexus-failing.sh | FOUND |
| packages/agent/src/routes/gitnexusScan.test.ts | FOUND |
| packages/agent/src/lib/gitnexusScan.test.ts | FOUND |
| packages/agent/src/lib/gitnexusFamilyScan.test.ts | FOUND |
| packages/spa/src/lib/queries/gitnexusScan.test.ts | FOUND |
| packages/spa/src/components/panels/coverage/ScanPill.test.tsx | FOUND |
| 13-00-SUMMARY.md | FOUND |
| commit 7499620 (RED clipboard test) | FOUND |
| commit 49a30a0 (GREEN clipboard impl) | FOUND |
| commit f92e6eb (RED schema test) | FOUND |
| commit bc0fe20 (GREEN schema impl) | FOUND |
| commit 1384fe8 (stubs + scaffold) | FOUND |