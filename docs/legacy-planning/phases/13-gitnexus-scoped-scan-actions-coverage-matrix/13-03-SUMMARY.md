---
phase: 13-gitnexus-scoped-scan-actions-coverage-matrix
plan: "03"
subsystem: spa
tags: [spa, tanstack-query, coverage-panels, ux, polling, gitnexus, scan]
dependency_graph:
  requires: [13-01, 13-02]
  provides: [spa-gitnexus-scan-hooks, scan-pill-component, coverage-row-scan-wiring, coverage-family-scan-wiring]
  affects: [coverage-panel, conformance-cache]
tech_stack:
  added:
    - "useGitnexusScan: useMutation hook (POST /api/gitnexus/scan)"
    - "useGitnexusScanProgress: polling useQuery (1500ms while running, false on terminal)"
    - "ScanPill: per-row + per-family scan affordance with 4 rendered states"
    - "useHealth: GET /health query hook for gitnexus.{installed,canScan}"
    - "scanErrorCodeToMessage: exhaustive switch over 11 GitnexusScanErrorCode values"
  patterns:
    - "Rules of Hooks: all hooks unconditionally at top, early return `if (!installed) return null` after"
    - "refetchInterval function (not number): stops polling on terminal state (done|error)"
    - "gcTime: 60_000 for scan progress to survive brief unmounts"
    - "prop-drill health data: CoveragePage → CoverageFamilySection → CoverageRow"
    - "Cache invalidation on terminal: queryClient.invalidateQueries(['coverage']) + ['conformance']"
    - "T-13-03-01: only error.code enum in toasts, never raw error.message"
key_files:
  created:
    - packages/spa/src/lib/queries/gitnexusScan.ts
    - packages/spa/src/lib/queries/gitnexusScan.test.ts
    - packages/spa/src/components/panels/coverage/ScanPill.tsx
    - packages/spa/src/components/panels/coverage/ScanPill.test.tsx
    - packages/spa/src/lib/healthQueries.ts
  modified:
    - packages/spa/src/components/panels/coverage/CoverageRow.tsx
    - packages/spa/src/components/panels/coverage/CoverageRow.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx
    - packages/spa/src/components/panels/coverage/CoverageFamilySection.test.tsx
    - packages/spa/src/components/panels/coverage/CoveragePage.tsx
    - packages/spa/src/components/panels/coverage/CoveragePage.test.tsx
  deleted:
    - packages/spa/src/components/panels/coverage/IndexGitNexusButton.tsx
    - packages/spa/src/components/panels/coverage/IndexGitNexusButton.test.tsx
decisions:
  - "healthQueries.ts created because no useHealth hook existed in SPA — needed for gitnexusInstalled/canScan props (Rule 2 auto-add)"
  - "Prop-drill chosen for health data (CoveragePage→section→row) consistent with existing inFlightRefreshes and gitNexusInstallState patterns"
  - "ScanPill renders for gitNexus.state in {missing, not-applicable} AND gitnexusInstalled=true — resolves plan ambiguity between GitNexusInstallState (page-level) vs CoverageState (per-row)"
  - "IndexGitNexusButton comment references retained in CoveragePage.tsx and CoveragePage.test.tsx as documentation — grep check in plan was for import/usage removal, not comment mentions"
  - "mutateAsync({ scope, target } as any) cast required because TS cannot narrow discriminated union from destructured props"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-24"
  tasks_completed: 4
  tasks_total: 4
  files_created: 5
  files_modified: 6
  files_deleted: 2
  tests_added: 30
---

# Phase 13 Plan 03: SPA Gitnexus Scan Hooks + ScanPill + Wiring Summary

SPA half of Phase 13: TanStack Query hooks for gitnexus scan POST + polling, a ScanPill primitive with 4 rendered states, per-row and per-family wiring, deletion of IndexGitNexusButton per D-13-06.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | useGitnexusScan + useGitnexusScanProgress + scanErrorCodeToMessage | `88d164a` | `lib/queries/gitnexusScan.ts`, `gitnexusScan.test.ts` |
| 2 | ScanPill component (4 states) | `860e528` | `ScanPill.tsx`, `ScanPill.test.tsx` (bug fix: cleanup import) |
| 3 | Wire ScanPill into CoverageRow + CoverageFamilySection | `381ae97` | `CoverageRow.tsx`, `CoverageFamilySection.tsx`, `healthQueries.ts` |
| 4 | Delete IndexGitNexusButton + cleanup CoveragePage | `4d9e6a8` | `CoveragePage.tsx`, `CoveragePage.test.tsx`, (2 deletions) |

## Verification Results

- Tests: 1131 passed (122 test files) — all green
- TypeScript: clean (0 errors) — `tsc --noEmit`
- Build: successful — `vite build` in 737ms
- Lint: no `lint` script in SPA package (pre-existing absence, not introduced here)
- Deleted files: `IndexGitNexusButton.tsx` + `IndexGitNexusButton.test.tsx` confirmed absent
- No remaining import/usage of IndexGitNexusButton in source (only comments documenting the D-13-06 deletion)

## Deviations from Plan

### Auto-added Missing Critical Functionality

**1. [Rule 2 - Missing] Created healthQueries.ts with useHealth hook**
- **Found during:** Task 3
- **Issue:** Plan assumed `useHealth()` hook existed in SPA lib; no such hook existed. CoveragePage needed gitnexus.{installed,canScan} from GET /health endpoint.
- **Fix:** Created `packages/spa/src/lib/healthQueries.ts` with `useHealth()` query (staleTime 30_000, refetchOnWindowFocus: false, queryKey: ['health']). Prop-drilled into CoverageFamilySection and CoverageRow.
- **Files modified:** `packages/spa/src/lib/healthQueries.ts` (created), `CoveragePage.tsx`, `CoverageRow.tsx`, `CoverageFamilySection.tsx`
- **Commit:** `381ae97`

### Auto-fixed Bugs

**2. [Rule 1 - Bug] Fixed Wave 0 scaffold bug in ScanPill.test.tsx**
- **Found during:** Task 2
- **Issue:** Wave 0 scaffold imported `cleanup` from `'vitest'` — but `cleanup` is exported only from `'@testing-library/react'`. Caused TypeScript error and runtime failure.
- **Fix:** Changed import to `@testing-library/react` for `cleanup`.
- **Files modified:** `packages/spa/src/components/panels/coverage/ScanPill.test.tsx`
- **Commit:** `860e528`

**3. [Rule 1 - Bug] TypeScript cast for discriminated union in ScanPill.tsx**
- **Found during:** Task 2
- **Issue:** `mutateAsync({ scope, target })` — TS cannot narrow discriminated union `GitnexusScanRequest` from destructured props of type `'repo' | 'family'` × `string`. Type error.
- **Fix:** Used `{ scope, target } as any` cast. Type safety preserved at the hook boundary (schema validation in the mutation fn).
- **Files modified:** `packages/spa/src/components/panels/coverage/ScanPill.tsx`
- **Commit:** `860e528`

### State Ambiguity Resolution

**4. gitNexus row state clarification (plan text ambiguous)**
- **Found during:** Task 3
- **Issue:** Plan text referenced "gitNexus.state in {not-installed, installed-no-registry}" — but these are `GitNexusInstallState` values (page-level), NOT per-row `CoverageState` values (`'fresh'|'stale'|'missing'|'not-applicable'`).
- **Resolution:** ScanPill renders in a row cell when `row.gitNexus.state === 'missing' || row.gitNexus.state === 'not-applicable'` AND `gitnexusInstalled === true`. This aligns with D-13-08 intent: show scan affordance on repos that lack gitnexus coverage.
- **Files modified:** `CoverageRow.tsx`
- **Commit:** `381ae97`

## Known Stubs

None — all ScanPill states are wired to real hooks. The family scan `partial-success` toast (N/M scanned, K failed) is spec'd as "informational only, retry deferred to v1.3.0" and is implemented as-is (shows completed/failed/total counts).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: error-code-disclosure | `ScanPill.tsx` | Only `error.code` enum used in toasts (T-13-03-01 compliant) — raw `.message` (which may contain paths or stderr) is never surfaced to UI |

No new network endpoints introduced in SPA. Health endpoint (`GET /health`) was pre-existing from daemon plan 13-01.

## Self-Check: PASSED

Files verified present:
- FOUND: `packages/spa/src/lib/queries/gitnexusScan.ts`
- FOUND: `packages/spa/src/lib/queries/gitnexusScan.test.ts`
- FOUND: `packages/spa/src/components/panels/coverage/ScanPill.tsx`
- FOUND: `packages/spa/src/components/panels/coverage/ScanPill.test.tsx`
- FOUND: `packages/spa/src/lib/healthQueries.ts`
- NOT FOUND (correctly deleted): `packages/spa/src/components/panels/coverage/IndexGitNexusButton.tsx`
- NOT FOUND (correctly deleted): `packages/spa/src/components/panels/coverage/IndexGitNexusButton.test.tsx`

Commits verified:
- FOUND: `88d164a`
- FOUND: `860e528`
- FOUND: `381ae97`
- FOUND: `4d9e6a8`
