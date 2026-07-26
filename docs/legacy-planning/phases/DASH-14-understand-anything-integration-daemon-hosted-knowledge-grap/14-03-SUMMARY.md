---
phase: 14-understand-anything-integration-daemon-hosted-knowledge-grap
plan: "03"
subsystem: spa/coverage
tags: [understand-anything, coverage-matrix, viewer-url, copy-pill, tdd]
dependency_graph:
  requires: [14-01]
  provides: [UnderstandCopyPill, COVERAGE_COL_WIDTHS.understand, viewer-URL-plumbing]
  affects: [CoveragePage, CoverageFamilySection, CoverageRow, CoverageFamilySectionMobile]
tech_stack:
  added: []
  patterns: [conditional-spread-exactOptionalPropertyTypes, buildViewerUrl-helper]
key_files:
  created:
    - packages/spa/src/components/panels/coverage/UnderstandCopyPill.tsx
    - packages/spa/src/components/panels/coverage/UnderstandCopyPill.test.tsx
  modified:
    - packages/spa/src/components/panels/coverage/coverageColumns.ts
    - packages/spa/src/components/panels/coverage/coverageColumns.test.ts
    - packages/spa/src/components/panels/coverage/coverageColumnTooltips.ts
    - packages/spa/src/components/panels/coverage/CoverageRow.tsx
    - packages/spa/src/components/panels/coverage/CoverageRow.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx
    - packages/spa/src/components/panels/coverage/CoverageFamilySection.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageFamilySectionMobile.tsx
    - packages/spa/src/components/panels/coverage/CoverageFamilySectionMobile.test.tsx
    - packages/spa/src/components/panels/coverage/CoveragePage.tsx
    - packages/spa/src/components/panels/coverage/CoveragePage.test.tsx
decisions:
  - "buildViewerUrl kept local to the coverage panel (single consumer in this plan) — 14-04 executor must define its own or import from here; see SUMMARY note"
  - "Conditional spread used for optional props to satisfy exactOptionalPropertyTypes"
  - "Object.assign used in mobile test to preserve required CoverageRow field types"
metrics:
  duration: "~90 minutes (split across two sessions)"
  completed: "2026-06-07"
  tasks_completed: 3
  files_changed: 13
---

# Phase 14 Plan 03: Understand Column in Coverage Matrix Summary

## One-liner

Added the Understand column to the Coverage matrix with 3-state cell (fresh link / stale link+pill / missing pill), copy-command pill with toast feedback, and per-row viewer-URL construction from scoped viewerToken (bearer token provably excluded).

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 RED | Failing tests for UnderstandCopyPill | 7c177be | done |
| 1 GREEN | UnderstandCopyPill + column width + tooltip | 0685eb3 | done |
| 2 RED | Failing tests for understand column in row/section/mobile | 5b4b406 | done |
| 2 GREEN | Understand cell in CoverageRow, desktop, and mobile tables | 0a7175d | done |
| 3 RED | Failing tests for CoveragePage viewer-URL construction | 974257d | done |
| 3 GREEN | CoveragePage viewer-URL construction from per-row viewerToken | 80b76ec | done |

## What Was Built

### Task 1: UnderstandCopyPill Component

New composite cell component for the Understand column. Props: `{ family, repo, viewerUrl?, state }`.

Render rules:
- `state=fresh`: viewer link only (`<a target="_blank" rel="noopener noreferrer">`)
- `state=stale`: viewer link + copy pill (D-14-10: stale row keeps its link)
- `state=missing`: copy pill only

Copy pill writes `buildUnderstandCommand(family, repo).string` to clipboard via `writeToClipboard` with success/error toast (mirrors InstallGitNexusButton pattern). Viewer link is suppressed when `viewerUrl` is absent.

Column SoT updates:
- `COVERAGE_COL_WIDTHS.understand = 'w-36'` added to `coverageColumns.ts`
- Tooltip copy added to `coverageColumnTooltips.ts`
- Regression lock test added to `coverageColumns.test.ts`

### Task 2: Understand Cell in Desktop + Mobile Tables

- **CoverageRow**: new `<td>` with `title={lastAnalyzedAt}` tooltip; renders `UnderstandCopyPill` for fresh/stale/missing states, em-dash for `undefined` or `not-applicable`
- **CoverageFamilySection**: new `<col>` in colgroup + Tooltip-wrapped `<th>Understand</th>`; threads `understandViewerUrl` per-row from `understandViewerUrls?.[repoKey]`
- **CoverageFamilySectionMobile**: understand card section with same 3-state + back-compat em-dash logic
- All column count assertions updated (6→7)

### Task 3: CoveragePage Viewer-URL Construction

Added `buildViewerUrl(agentUrl, family, repo, viewerToken)` local helper returning `${agentUrl}/understand/${family}/${repo}/?token=${encodeURIComponent(viewerToken)}`.

`CoveragePage` now:
1. Calls `getPairing()` to get `agentUrl` (NOT the bearer token)
2. Builds `understandViewerUrls: Record<string, string>` via `useMemo` over all rows, keyed by `${family}/${repo}`
3. Passes `understandViewerUrls` to each `CoverageFamilySection`

Test 3 asserts the bearer token fixture string (`test-bearer-token-should-never-appear-in-href`) is absent from every rendered `href`. T-14-03-01 mitigation enforced.

## TDD Gate Compliance

All three tasks followed strict RED → GREEN:

1. RED commits have `test(14-03):` prefix; failing tests confirmed before implementation
2. GREEN commits have `feat(14-03):` or `fix(14-03):` prefix; all tests pass after implementation
3. No RED test passed unexpectedly before implementation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] exactOptionalPropertyTypes violations in conditional prop passing**
- **Found during:** Task 3 typecheck
- **Issue:** Passing `viewerUrl={understandViewerUrl}` (where value can be `undefined`) to `viewerUrl?: string` prop fails with `exactOptionalPropertyTypes: true`. Same issue in `CoverageFamilySection` passing `understandViewerUrl={...}` to `CoverageRow`.
- **Fix:** Use conditional spread: `{...(value !== undefined ? { propName: value } : {})}` in CoverageRow, CoverageFamilySection, and CoverageFamilySectionMobile.
- **Files modified:** CoverageRow.tsx, CoverageFamilySection.tsx, CoverageFamilySectionMobile.tsx
- **Commit:** 80b76ec

**2. [Rule 1 - Bug] Mobile test type error with spread + required fields**
- **Found during:** Task 3 typecheck
- **Issue:** `{ ...rows[0], understand: {...} }` causes TypeScript to infer spread fields as optional, violating `CoverageRowData` shape.
- **Fix:** Use `Object.assign({}, rows[0], { understand: ... })` which preserves required field types.
- **Files modified:** CoverageFamilySectionMobile.test.tsx
- **Commit:** 80b76ec

## Key Decision: buildViewerUrl Locality

The `buildViewerUrl` helper is kept local to `CoveragePage.tsx` (single consumer in this plan). Plan 14-04 (Code Intelligence page) needs the same construction — options:
1. Import from `CoveragePage.tsx` (not ideal — cross-component coupling)
2. Lift to `packages/spa/src/lib/understandViewerUrl.ts` and import from both
3. Redefine in 14-04 (accepted in plan, avoids premature abstraction)

The plan approves option 2 or 3. If 14-04 redefines, it should use the same pattern. If 14-04 lifts, update the import in CoveragePage.tsx.

## Test Counts

- Before plan: 1159 tests (after tasks 1+2: 1168, after task 3: 1171)
- After plan: **1171 tests, all passing**
- Typecheck: clean

## Security Assertions

- T-14-03-01: `Test 3` in CoveragePage.test.tsx proves bearer token never in viewer URLs
- T-14-03-02: `grep -c "noopener noreferrer" UnderstandCopyPill.tsx` = 2 (link present twice in DOM variants)
- T-14-03-03: command string built only by `buildUnderstandCommand` from shared package

## Known Stubs

None. The Understand column renders correctly for all 3 states. Until plans 14-05/14-06 ship (daemon `understand` field), `row.understand` is `undefined` at runtime — the em-dash back-compat path renders in that case.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes beyond what was in the plan's threat model.

## Self-Check: PASSED

All 4 key files confirmed present. All 6 task commits confirmed in git log.
