---
phase: 10
plan: "07"
subsystem: spa/routing+sidebar+e2e
tags:
  - coverage-matrix
  - routing
  - sidebar
  - tdd
  - playwright
  - codex-med-16
dependency_graph:
  requires:
    - 10-06 (CoveragePage component — route body)
    - 10-05 (useCoverage + useCoverageRefresh hooks)
  provides:
    - /coverage route mounted under _appshell layout via createLazyRoute
    - CoverageSearchSchema validateSearch + pairErrorComponent (COV-06 URL round-trip + Phase 7 Pitfall 8 defense)
    - Sidebar Observability section with Coverage entry (COV-09 D-10-08)
    - Playwright e2e spec (local-only, 7 scenarios, CODEX MED-16)
    - CoverageUserJourney.test.tsx (deterministic mocked, CI-safe, 7 scenarios, CODEX MED-16)
  affects:
    - Any plan verifying the /coverage route is reachable from the sidebar
tech_stack:
  added: []
  patterns:
    - "createLazyRoute('/coverage') → CoveragePage: same pattern as projects.$projectId.lazy.tsx"
    - "zodValidator(CoverageSearchSchema) + pairErrorComponent: Phase 7 Pitfall 8 defense applied to /coverage"
    - "TDD RED-GREEN: Sidebar test updated first (S3/S6/S7/S8/S9 RED), then implementation updated (GREEN)"
    - "CODEX MED-16 local-only gate: process.env.CI !== 'true' guard on Playwright describe block"
    - "Deterministic mocked test: vi.mock('../../../lib/coverageQueries.js') avoids daemon dependency"
key_files:
  created:
    - packages/spa/src/routes/coverage.lazy.tsx
    - packages/spa/e2e/coverage.spec.ts
    - packages/spa/src/components/panels/coverage/CoverageUserJourney.test.tsx
  modified:
    - packages/spa/src/router.tsx (CoverageSearchSchema + coverageRoute + addChildren)
    - packages/spa/src/components/ui/Sidebar.tsx (OBSERVE → Observability+Coverage)
    - packages/spa/src/components/ui/Sidebar.test.tsx (S3/S6/S7/S8/S9 new assertions)
decisions:
  - "pairErrorComponent reused for /coverage errorComponent — Phase 7 Pitfall 8 defense; malformed ?status=&q= renders fallback instead of blank page"
  - "CODEX MED-16: Playwright spec gated with LOCAL_ONLY = process.env.CI !== 'true'; CoverageUserJourney.test.tsx provides CI coverage"
  - "TDD used for Sidebar task: test updated first (S3/S6/S7/S8/S9 fail), then Sidebar.tsx updated (all GREEN)"
  - "Override chip selector in CoverageUserJourney uses aria-controls^='overrides-list-' to distinguish from CoverageFamilySection collapse toggles"
  - "OverrideEntry fixture uses sinceIso + source fields matching OverrideEntrySchema (not sentinelSince)"
metrics:
  duration: ~15min
  completed: "2026-05-13"
  tasks_completed: 3
  files_changed: 6
---

# Phase 10 Plan 07: Route Wiring, Sidebar Observability Section, and E2E Tests

/coverage route mounted under _appshell; Sidebar OBSERVE replaced with Observability+Coverage; 7 Playwright e2e scenarios + 7 deterministic mocked CI-safe journey tests (CODEX MED-16). 794 tests GREEN.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | coverage.lazy.tsx + router.tsx wiring (validateSearch + errorComponent) | a11cab7 | coverage.lazy.tsx, router.tsx |
| 2 RED | Sidebar test update — S3/S6/S7/S8/S9 failing assertions | 67d5274 | Sidebar.test.tsx |
| 2 GREEN | Sidebar OBSERVE → Observability+Coverage implementation | 3e5123e | Sidebar.tsx |
| 3 | Playwright e2e + CoverageUserJourney.test.tsx (CODEX MED-16) | f42c0d8 | coverage.spec.ts, CoverageUserJourney.test.tsx |

## Route Wiring Details

| File | What was added |
|------|----------------|
| `coverage.lazy.tsx` | `createLazyRoute('/coverage')({ component: CoveragePage })` |
| `router.tsx` | `CoverageSearchSchema` (status, q optional), `coverageRoute` with `zodValidator` + `pairErrorComponent`, wired into `appShellLayoutRoute.addChildren` |
| Build | `dist/assets/coverage.lazy-*.js` chunk emitted — lazy split confirmed |

## Sidebar Change

| Before | After |
|--------|-------|
| `<SidebarSection label="OBSERVE">` with 3 `SidebarItemDisabled` stubs | `<SidebarSection label="Observability">` with single `SidebarItem to="/coverage" label="Coverage"` |
| Imports: Activity, ListChecks, ClipboardList, SidebarItemDisabled | Imports: Activity only (ListChecks, ClipboardList, SidebarItemDisabled removed) |

Section sits between WORKSPACE and ACCOUNT per D-10-08. Label is exactly "Observability" (COV-09).

## E2E and Deterministic Test Coverage

| Scenario | Playwright (local-only) | CoverageUserJourney.test.tsx (CI-safe) |
|----------|------------------------|----------------------------------------|
| cold-load: 3 family sections | test 1 | it 1 |
| filter chip click | test 2 | it 2 |
| search input | test 3 | it 3 |
| override chip expand/collapse | test 4 (conditional skip if no sentinels) | it 4 (fixture guarantees count=2) |
| refresh popover / button | test 5 (conditional skip if no stale rows) | it 5 (fixture has stale gitNexus row) |
| keyboard Tab navigation | test 6 | it 6 |
| GitNexus install hint (gitNexusInstalled=false) | test 7 (soft skip if installed) | it 7 (mocked false) |

## Security Contracts Verified

| Threat | Mitigation |
|--------|-----------|
| T-10-07-01: Malformed ?status=&q= | `zodValidator(CoverageSearchSchema)` + `pairErrorComponent` — blank-page failure mode prevented |
| T-10-07-02: absPath leaking via SPA bundle | `grep absPath packages/spa/dist/assets/coverage.lazy-*.js` returns 0 (absPath is daemon-only) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale file header comment in Sidebar.tsx referenced `SidebarItemDisabled`**
- **Found during:** Task 2 acceptance criteria check (grep SidebarItemDisabled returned 1 hit)
- **Issue:** The JSDoc header comment said "Rendered as SidebarItemDisabled" — stale after the implementation change
- **Fix:** Updated file header comment to reflect Phase 10 D-10-08 section architecture
- **Files modified:** `packages/spa/src/components/ui/Sidebar.tsx`
- **Commit:** 3e5123e

**2. [Rule 1 - Bug] OverrideEntry fixture used wrong field names (`sentinelSince` instead of `sinceIso`; missing `source`)**
- **Found during:** Task 3 typecheck
- **Issue:** `CoverageUserJourney.test.tsx` fixture used `sentinelSince` (non-existent) and omitted `source` (required) in OverrideEntry objects
- **Fix:** Changed to `sinceIso: string` and `source: 'git-log' | 'mtime'` matching `OverrideEntrySchema`
- **Files modified:** `packages/spa/src/components/panels/coverage/CoverageUserJourney.test.tsx`
- **Commit:** f42c0d8

**3. [Rule 1 - Bug] Override chip test selector matched CoverageFamilySection collapse button instead of OverrideChip**
- **Found during:** Task 3 first test run
- **Issue:** `getByRole('button', { name: /override/i })` — Testing Library's accessible name computation for the button (`aria-label="2 phase reviews overridden in agenticapps-workflow"`) was not matching the regex despite containing "overridden". Using `document.querySelector('button[aria-expanded]')` picked the CoverageFamilySection toggle (aria-expanded="true") first.
- **Fix:** Use `document.querySelector('button[aria-controls^="overrides-list-"]')` which uniquely identifies the OverrideChip via its `aria-controls` pattern
- **Files modified:** `packages/spa/src/components/panels/coverage/CoverageUserJourney.test.tsx`
- **Commit:** f42c0d8

## Known Stubs

None. Route is fully wired to CoveragePage (shipped in Plan 06). Sidebar entry links to /coverage. All test scenarios are deterministic.

## Threat Flags

None. No new network endpoints introduced. SPA routing change is internal (no new trust boundaries). Bearer auth continues to be handled inside `apiFetch` / `useCoverage`.

## Self-Check: PASSED

Files created/modified:
- packages/spa/src/routes/coverage.lazy.tsx: EXISTS
- packages/spa/src/router.tsx: modified (coverageRoute in addChildren)
- packages/spa/src/components/ui/Sidebar.tsx: modified (Observability section)
- packages/spa/src/components/ui/Sidebar.test.tsx: modified (S3/S6/S7/S8/S9)
- packages/spa/e2e/coverage.spec.ts: EXISTS
- packages/spa/src/components/panels/coverage/CoverageUserJourney.test.tsx: EXISTS

Commits verified:
- a11cab7 — feat(10-07): mount /coverage lazy route under _appshell with validateSearch + errorComponent
- 67d5274 — test(10-07): add failing Sidebar tests for Observability section (COV-09 RED phase)
- 3e5123e — feat(10-07): replace Sidebar OBSERVE section with Observability+Coverage (COV-09 D-10-08)
- f42c0d8 — feat(10-07): add Playwright e2e spec + deterministic mocked user journey test (CODEX MED-16)

Acceptance criteria:
- createLazyRoute('/coverage') in coverage.lazy.tsx ✓
- coverageRoute appears 3 times in router.tsx ✓
- CoverageSearchSchema appears 3 times in router.tsx ✓
- validateSearch: zodValidator(CoverageSearchSchema) in router.tsx ✓
- errorComponent: pairErrorComponent in router.tsx (2 hits: pair + coverage) ✓
- label="Observability" in Sidebar.tsx (1 hit) ✓
- label="OBSERVE" in Sidebar.tsx (0 hits) ✓
- SidebarItemDisabled in Sidebar.tsx (0 hits) ✓
- to="/coverage" in Sidebar.tsx (1 hit) ✓
- ListChecks/ClipboardList in Sidebar.tsx (0 hits) ✓
- 794 SPA tests GREEN ✓
- typecheck exits 0 ✓
- build emits coverage.lazy-*.js chunk ✓
- 7 Playwright e2e tests ✓
- 7 deterministic mocked tests ✓
- CODEX MED-16 CI gate present ✓
