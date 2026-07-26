---
phase: 13-gitnexus-scoped-scan-actions-coverage-matrix
plan: 05
subsystem: shared-schema + agent/coverage + spa/CoverageRow
tags: [gap-closure, shared-schema, coverage-scanner, spa-render-gate, registry-membership, d-13-ext-07]
gap_closure: true
requirements: []
dependency_graph:
  requires:
    - 13-00 (research)
    - 13-01 (gitnexus health + canScan)
    - 13-02 (POST /api/gitnexus/scan + per-repo lock)
    - 13-03 (ScanPill SPA wiring)
    - 13-04 (Stage-2 review + dispositions)
  provides:
    - "CoverageRow.inRegistry: boolean wire-contract field (D-13-EXT-07)"
    - "Scanner registry-intersection logic (single read per scan, O(1) per row)"
    - "SPA render-gate closure on row.inRegistry (Gap-1 UAT Test 4 ship-blocker fix)"
  affects:
    - "Every test fixture that constructs a CoverageRow object literal"
tech-stack:
  added: []
  patterns:
    - "Wire-contract additive change (new required field on shared schema)"
    - "Precompute-once-then-O(1)-lookup (ReadonlySet<string> built once per scan)"
    - "Inlined helper to avoid import-cycle risk (familyRepoIdFromRoot)"
key-files:
  created:
    - .planning/phases/13-gitnexus-scoped-scan-actions-coverage-matrix/13-05-SUMMARY.md
  modified:
    - packages/shared/src/schemas/coverage.ts
    - packages/shared/src/schemas/coverage.test.ts
    - packages/agent/src/lib/coverageScan.ts
    - packages/agent/src/lib/coverageScan.test.ts
    - packages/agent/src/lib/conformanceScan.test.ts
    - packages/agent/src/lib/conformanceScore.test.ts
    - packages/agent/src/lib/snapshots/snapshotWriter.test.ts
    - packages/agent/src/routes/coverage.test.ts
    - packages/agent/src/routes/coverageHistory.test.ts
    - packages/spa/src/components/panels/coverage/CoverageRow.tsx
    - packages/spa/src/components/panels/coverage/CoverageRow.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageFamilySection.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageFamilySectionMobile.test.tsx
    - packages/spa/src/components/panels/coverage/CoveragePage.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageUserJourney.test.tsx
    - packages/spa/src/components/panels/coverage/RefreshAllStaleButton.test.tsx
    - packages/spa/src/lib/coverageQueries.test.ts
    - .planning/phases/13-gitnexus-scoped-scan-actions-coverage-matrix/13-CONTEXT.md
decisions:
  - "D-13-EXT-07 — Registry-membership is part of the SPA-bound coverage row contract. CoverageRow.inRegistry: boolean is the load-bearing precondition for SPA affordances that trigger daemon-side scans (today ScanPill; future any per-row mutation that calls startScan-equivalent)."
metrics:
  duration: "~16 minutes"
  completed: "2026-05-25"
  tasks: 4
  commits: 7
---

# Phase 13 Plan 13-05: Gap-1 closure — `CoverageRow.inRegistry` registry-membership wire contract Summary

**One-liner:** Add required `inRegistry: boolean` to `CoverageRowSchema`, populate it daemon-side via single-read registry intersection, and gate `ScanPill` render on `row.inRegistry === true` — closes UAT Test 4 ship-blocker where unregistered rows showed a Scan affordance that produced an unrecoverable `REPO_NOT_REGISTERED` toast on click.

## Objective recap

UAT Test 4 surfaced that Plan 13-03's `ScanPill` render gate (`gitnexusInstalled && state ∈ {missing, not-applicable}`) was a strict subset of the daemon's prerequisite (path resolvable via registry-as-allowlist in `gitnexusScan.ts:151`). With ~22 filesystem-discovered repos but only 1 registry entry, every click on an unregistered row failed unrecoverably.

This plan implements **Option A** (extend the wire contract) — Options B (relax daemon allowlist) and C (auto-register on click) were rejected for security and UX-clarity reasons. The new `inRegistry` field tells the SPA whether a row's path is daemon-resolvable; the SPA's render gate now honours that precondition.

## Final wire contract

```typescript
// packages/shared/src/schemas/coverage.ts:61-78
export const CoverageRowSchema = z.object({
  family: CoverageFamilySchema,
  repo: z.string(),
  claudeMd: CoverageBasicColumnSchema,
  gitNexus: CoverageBasicColumnSchema,
  wiki: CoverageBasicColumnSchema,
  workflowVersion: CoverageWorkflowColumnSchema,
  overrideCount: z.number().int().nonnegative(),
  overrides: z.array(OverrideEntrySchema),
  /** D-13-EXT-07: is this repo's absolute path in the dashboard project registry?
   *  Required precondition for SPA affordances that trigger a daemon-side scan
   *  (daemon's startScan resolves paths exclusively via the registry — coverage
   *  discovery is filesystem-driven under ~/Sourcecode/{family}/, so the set of
   *  rendered rows is a strict superset of the registered set). Gap-1 closure. */
  inRegistry: z.boolean(),
  degraded: z
    .object({
      reason: z.string(),
    })
    .optional(),
})
```

## Scanner registry-intersection logic

```typescript
// packages/agent/src/lib/coverageScan.ts (scanCoverageInternal body excerpt)

// D-13-EXT-07 Gap-1 closure: precompute registered repoIds once per scan.
const reg = readRegistry(opts.registryFileOverride)
const registeredRepoIds: ReadonlySet<string> = new Set(
  reg.projects
    .map((p) => familyRepoIdFromRoot(p.root, sourcecodeRoot))
    .filter((x): x is string => x !== null),
)

// ... per-row fan-out passes registeredRepoIds to buildRow ...
const internalRows = await Promise.all(
  repos.map((repo) =>
    buildRow(
      repo.absPath, repo.family, repo.name, sourcecodeRoot,
      gnGlobal, workflowHead, resolve,
      registeredRepoIds, // NEW 8th positional arg
    ),
  ),
)

// In buildRow, the publicRow literal between `overrides` and `degraded` gains:
inRegistry: registeredRepoIds.has(`${family}/${repoName}`),
```

`familyRepoIdFromRoot` (inlined at the bottom of `coverageScan.ts`) parses `~/Sourcecode/{family}/{repo}` shape and validates against the canonical 3-family enum. Kept in lockstep with `gitnexusScan.ts:367 derivedRepoId` manually (per JSDoc note) to avoid an import-cycle risk and to let coverage scanner tests run without pulling gitnexusScan's module-level state.

## CoverageRow.tsx gate — before/after

```tsx
// BEFORE — Plan 13-03 gate
{gitnexusInstalled && (row.gitNexus.state === 'missing' || row.gitNexus.state === 'not-applicable') ? (
  <ScanPill scope="repo" target={`${row.family}/${row.repo}`}
            canScan={gitnexusCanScan} installed={gitnexusInstalled} />
) : (
  <CoverageCell ... />
)}

// AFTER — Plan 13-05 gate (D-13-EXT-07)
{gitnexusInstalled
  && (row.gitNexus.state === 'missing' || row.gitNexus.state === 'not-applicable')
  && row.inRegistry ? (
  <ScanPill scope="repo" target={`${row.family}/${row.repo}`}
            canScan={gitnexusCanScan} installed={gitnexusInstalled} />
) : (
  <CoverageCell ... />
)}
```

JSDoc above the cell now explains why the gate is structural rather than merely cosmetic: unregistered rows would produce unrecoverable `REPO_NOT_REGISTERED` toasts on click because `startScan` resolves paths exclusively via the registry.

## D-13-EXT-07 as appended to 13-CONTEXT.md

> ### E. UAT Gap-closure extensions (post-UAT 2026-05-25)
>
> **D-13-EXT-07** — Registry-membership is part of the SPA-bound coverage row contract. The wire schema's `CoverageRow.inRegistry: boolean` flag tells the SPA whether a row's path can be resolved by the daemon's registry-as-allowlist. UI affordances that require daemon-resolvable paths (today: `ScanPill`; future: any per-row mutation that calls `startScan`/equivalent) MUST gate on it. Surfaced by UAT Test 4 — filesystem-discovery set is a strict superset of the registry-membership set; the load-bearing precondition for any daemon-write affordance attached to a Coverage row is membership. Rejected alternatives: (B) relax registry-as-allowlist on daemon — would require fresh /cso, breaks T-13-02-01; (C) auto-register filesystem-discovered repos — hides a registration side-effect inside the scan path. Implementation in Plan 13-05: shared schema gains required `inRegistry: z.boolean()`; `coverageScan.ts::scanCoverageInternal` reads registry ONCE per scan and intersects filesystem-discovered repos with `family/repo` ids derived from `registry.projects[].root` (O(1) per row via `ReadonlySet<string>`); `CoverageRow.tsx` gate at the gitNexus cell now requires `row.inRegistry === true` in addition to the existing conditions. Closes UAT Test 4 ship-blocker.

## Tasks executed (7 atomic commits)

| Task | Type | Files touched | Commits |
|------|------|---------------|---------|
| 1: Schema strictening | TDD (RED + GREEN) | `packages/shared/src/schemas/coverage.{ts,test.ts}` | `ebc3492` (test) + `dd60309` (feat) |
| 2: Scanner populates inRegistry | TDD (RED + GREEN) | `packages/agent/src/lib/coverageScan.{ts,test.ts}` + 4 agent test fixture files | `d778d2d` (test) + `54551e3` (feat) |
| 3: SPA gate update | TDD (RED + GREEN) | `packages/spa/src/components/panels/coverage/CoverageRow.{tsx,test.tsx}` | `fef6c3c` (test) + `39a580e` (feat) |
| 4: SPA fixture sweep + D-13-EXT-07 docs | auto | 6 SPA test fixture files + `13-CONTEXT.md` | `36d7f89` (chore) |

7 commits in total — matches the plan's expected count.

## Test fixture sweep — full list

Every CoverageRow object literal across the repo now carries `inRegistry`. Sweep grouped by commit:

**Task 2 GREEN (`54551e3`) — agent-side fixtures (typecheck cascade precondition):**
- `packages/agent/src/lib/conformanceScan.test.ts` — `makeRow` helper
- `packages/agent/src/lib/conformanceScore.test.ts` — `row` helper
- `packages/agent/src/lib/snapshots/snapshotWriter.test.ts` — 3 inline rows in `THREE_ROW_FIXTURE`
- `packages/agent/src/routes/coverage.test.ts` — vi.mock + beforeEach + HIGH-1 test (5 sites)
- `packages/agent/src/routes/coverageHistory.test.ts` — `makeScanRow` helper

**Task 4 (`36d7f89`) — SPA-side fixtures:**
- `packages/spa/src/components/panels/coverage/CoverageFamilySection.test.tsx` — `makeRow` helper
- `packages/spa/src/components/panels/coverage/CoverageFamilySectionMobile.test.tsx` — `makeRow` helper
- `packages/spa/src/components/panels/coverage/CoveragePage.test.tsx` — `makeRow` helper
- `packages/spa/src/components/panels/coverage/CoverageUserJourney.test.tsx` — `makeRow` helper
- `packages/spa/src/components/panels/coverage/RefreshAllStaleButton.test.tsx` — `makeRow` helper
- `packages/spa/src/lib/coverageQueries.test.ts` — `COVERAGE_ROW` constant

**Task 1 RED (`ebc3492`) — shared fixtures:**
- `packages/shared/src/schemas/coverage.test.ts` — both `validRow` fixtures (line ~197 and line ~318) gained `inRegistry: true`

**Task 3 RED (`fef6c3c`) — CoverageRow test fixture:**
- `packages/spa/src/components/panels/coverage/CoverageRow.test.tsx` — `makeRow` helper

## Verification

| Gate | Command | Result |
|------|---------|--------|
| Shared schema RED | `pnpm --filter @agenticapps/dashboard-shared test -- coverage --run` | 54 passed (after GREEN); 52 passed + 2 failed (during RED, as designed) |
| Shared typecheck | `pnpm --filter @agenticapps/dashboard-shared typecheck` | exit 0 |
| Agent scanner GREEN | `pnpm --filter @agenticapps/dashboard-agent test -- coverageScan --run` | 15/15 pass |
| Agent typecheck | `pnpm --filter @agenticapps/dashboard-agent typecheck` | exit 0 |
| SPA CoverageRow GREEN | `pnpm --filter @agenticapps/dashboard-spa test -- CoverageRow --run` | 32/32 pass |
| SPA typecheck | `pnpm --filter @agenticapps/dashboard-spa typecheck` | exit 0 |
| Cross-package typecheck | `pnpm -r typecheck` | 5/5 packages exit 0 |
| Cross-package tests | `pnpm -r test --run` | 1142 SPA + 298 shared + 912 agent + 31 meta-observer = 2383 tests; all CoverageRow-related tests PASS |
| D-13-EXT-07 grep gate | `grep -q "D-13-EXT-07" .planning/phases/13-.../13-CONTEXT.md` | exit 0 |

## Deviations from plan

**None substantive.**

Two minor adjustments documented in commit bodies, not deviations:

1. **Agent-side test fixtures moved from Task 4 → Task 2 GREEN.** The Task 2 done block requires `pnpm --filter @agenticapps/dashboard-agent typecheck` to exit 0. The schema strictening cascade from Task 1 broke agent typecheck across `conformanceScan.test.ts`, `conformanceScore.test.ts`, `snapshotWriter.test.ts`, `routes/coverage.test.ts`, `routes/coverageHistory.test.ts`. Moving these into Task 2's GREEN commit was the only way to satisfy Task 2's done block. Task 4 then handled the SPA-only sweep. The plan's `<files>` block listed both sets — only the commit boundaries shifted. Documented inline in commit `54551e3` body.

2. **`coverageHistoryQueries.test.ts` listed but not touched.** Its `claudeMd:` line is on the `CoverageHistoryResponse.cells` shape (drift data, not a CoverageRow). Inspection confirmed no CoverageRow object literals — no fix needed.

## Deferred Issues (pre-existing, out of scope per Rule SCOPE BOUNDARY)

When running `pnpm -r test --run` in a single sequential invocation, 2-3 pre-existing subprocess tests flake:

- `packages/agent/src/cli/__tests__/end-to-end.subprocess.test.ts` — token-rotation race (~1 in 3 runs)
- `packages/agent/src/cli/__tests__/install-launchd.subprocess.test.ts` — requires `dist/cli.js` (passes after `pnpm --filter agent build`)
- `packages/spa/src/__tests__/projects-detail-e2e.test.tsx` — jsdom-timing E2E timeout (~1 in 5 runs)

All three pass in isolation. Zero touches to `CoverageRow` or `inRegistry` in any of them. These are documented for visibility but are NOT caused by Plan 13-05.

## Manual UAT — deferred

Per plan's `<verification>`, the live manual smoke test requires running the daemon and visiting the SPA Coverage panel:

- Register `agenticapps-dashboard` only, open SPA Coverage panel
- `agenticapps-dashboard` row's gitNexus cell SHOULD show ScanPill (inRegistry=true)
- Any other family/repo row SHOULD show standard CoverageCell ✗ content (inRegistry=false)
- Click ScanPill on `agenticapps-dashboard` — scan should complete without REPO_NOT_REGISTERED

Deferred to the user for post-execute UAT; automated test coverage proves the same gate at the component level.

## Self-Check: PASSED

- All files modified exist on disk: VERIFIED
- All 7 commits exist in `git log --oneline`: VERIFIED
  - `ebc3492 test(13-05): assert CoverageRow.inRegistry is a required boolean (Gap 1)`
  - `dd60309 feat(13-05): add CoverageRow.inRegistry boolean per D-13-EXT-07 (Gap 1)`
  - `d778d2d test(13-05): scanCoverageInternal populates inRegistry from registry intersection (Gap 1)`
  - `54551e3 feat(13-05): scanner populates CoverageRow.inRegistry from registry intersection (Gap 1)`
  - `fef6c3c test(13-05): ScanPill render gate must honour row.inRegistry (Gap 1)`
  - `39a580e feat(13-05): gate ScanPill render on row.inRegistry — closes Gap 1 (UAT Test 4)`
  - `36d7f89 chore(13-05): repair CoverageRow fixtures + record D-13-EXT-07 (Gap 1)`
- D-13-EXT-07 in 13-CONTEXT.md: VERIFIED (`grep -q "D-13-EXT-07"` → exit 0)
- Cross-package typecheck: VERIFIED (5/5 packages green)
- All CoverageRow-related tests: VERIFIED (54 shared + 15 agent scanner + 32 SPA CoverageRow + 1142 full SPA)
