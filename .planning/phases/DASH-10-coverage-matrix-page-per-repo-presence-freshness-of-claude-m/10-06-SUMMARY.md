---
phase: 10
plan: "06"
subsystem: spa/panels/coverage
tags:
  - coverage-matrix
  - ui-components
  - tdd
  - phase-05.1-tokens
  - codex-high-fixes
dependency_graph:
  requires:
    - 10-01 (Zod schemas, OverrideEntrySchema, clipboard builders from shared)
    - 10-05 (useCoverage + useCoverageRefresh hooks)
  provides:
    - CoverageCell: 4-state token rendering + CODEX HIGH-4 workflow sub-states
    - OverrideChip: conditional expand/collapse chip with ARIA
    - CoverageEmptyState: 4-branch empty state renderer
    - CoverageRow: 4-cell row + override chip + refresh popover; absPath never in DOM
    - CoverageFamilySection: sticky header + worst-state-wins aggregates + per-family GitNexus hint + localStorage collapse
    - CoverageToolbar: 4-chip multi-select + 200ms debounced search
    - CoveragePage: top-level route page composing all panels + useCoverage integration
    - RefreshAllStaleButton: extracted AGREED-4 sequential batch-refresh component
    - clipboardCompat: navigator.clipboard.writeText + textarea fallback
  affects:
    - 10-07 (route wiring — CoveragePage is the route body)
tech_stack:
  added: []
  patterns:
    - "Phase 05.1 token pattern: bg-status-success/10, bg-status-warning/10, bg-status-error/10, bg-text-tertiary/10 — state→token via STATE_TOKEN_MAP constant"
    - "CODEX HIGH-4 workflow discriminant: state.kind === 'workflow' → workflowSubtext() switch on detail enum"
    - "AGREED-4 sequential dispatch: for (const row of spawnable) { await onRefresh(...) } — NEVER Promise.all"
    - "BatchState: { status: 'idle'|'running', current, total } drives 'Refreshing N of M…' indicator"
    - "worst-state-wins: per-row bucket priority missing > stale > fresh; totals never exceed row count"
    - "localStorage persistence: 'coverage:section-collapsed:<family>' key format (UI-SPEC §5 locked)"
    - "clipboardCompat: navigator.clipboard.writeText + hidden textarea + execCommand fallback (CODEX LOW-18)"
    - "navigate double-cast (unknown) for pre-route-registration URL sync; Plan 07 wires validateSearch"
key_files:
  created:
    - packages/spa/src/components/panels/coverage/CoverageCell.tsx
    - packages/spa/src/components/panels/coverage/CoverageCell.test.tsx
    - packages/spa/src/components/panels/coverage/OverrideChip.tsx
    - packages/spa/src/components/panels/coverage/OverrideChip.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageEmptyState.tsx
    - packages/spa/src/components/panels/coverage/CoverageEmptyState.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageRow.tsx
    - packages/spa/src/components/panels/coverage/CoverageRow.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx
    - packages/spa/src/components/panels/coverage/CoverageFamilySection.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageToolbar.tsx
    - packages/spa/src/components/panels/coverage/CoverageToolbar.test.tsx
    - packages/spa/src/components/panels/coverage/CoveragePage.tsx
    - packages/spa/src/components/panels/coverage/CoveragePage.test.tsx
    - packages/spa/src/components/panels/coverage/RefreshAllStaleButton.tsx
    - packages/spa/src/components/panels/coverage/RefreshAllStaleButton.test.tsx
    - packages/spa/src/lib/clipboardCompat.ts
    - packages/spa/src/lib/clipboardCompat.test.ts
  modified:
    - packages/shared/src/schemas/coverage.ts (added OverrideEntry type export)
    - packages/shared/src/index.ts (added OverrideEntry to re-exports)
    - .gitignore (negation rule for panels/coverage/ source directory)
  deleted:
    - packages/spa/src/components/panels/coverage/CoverageGitNexusBanner.tsx (CODEX HIGH-6 Option A)
    - packages/spa/src/components/panels/coverage/CoverageGitNexusBanner.test.tsx (CODEX HIGH-6 Option A)
decisions:
  - "CODEX HIGH-4 workflow variant: extracted workflowSubtext() helper switch on detail enum; CoverageCell discriminates on state.kind"
  - "CODEX HIGH-6 Option A: CoverageGitNexusBanner deleted; install hint rendered inside CoverageFamilySection header when gitNexusInstalled=false"
  - "AGREED-4: RefreshAllStaleButton extracted as separate component; sequential for-of await over spawnable rows; BatchState { status, current, total }"
  - "React hooks rules: useMemo calls moved before early returns in CoveragePage (allRows = query.data?.rows ?? [])"
  - "navigate URL sync: double-cast (as unknown as ...) for pre-route-registration use; Plan 07 wires proper validateSearch"
  - ".gitignore: added !**/panels/coverage/ negation to prevent catch-all coverage test-output rule from hiding source files"
  - "OverrideEntry type: added to coverage.ts schema and re-exported from shared/index.ts (was missing from original schema)"
metrics:
  duration: ~22min
  completed: "2026-05-13"
  tasks_completed: 4
  files_changed: 20
---

# Phase 10 Plan 06: SPA UI Layer — Coverage Matrix Panel Components

8 SPA panel components + clipboardCompat + RefreshAllStaleButton for the `/coverage` route. All Phase 05.1 tokens, no hex literals, no shadcn aliases. 783 tests GREEN (full suite), typecheck exits 0.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Leaf primitives: CoverageCell, OverrideChip, CoverageEmptyState, clipboardCompat | 5eb7ce8 | CoverageCell.tsx, OverrideChip.tsx, CoverageEmptyState.tsx, clipboardCompat.ts |
| 2 | Mid-level compositions: CoverageRow, CoverageFamilySection, CoverageToolbar | 48dbc2e | CoverageRow.tsx, CoverageFamilySection.tsx, CoverageToolbar.tsx |
| 3 | CoveragePage top-level | 9fce9ad | CoveragePage.tsx |
| 3a | RefreshAllStaleButton (AGREED-4) | 9fce9ad | RefreshAllStaleButton.tsx |

## Component Inventory

| Component | Tokens | ARIA | Tests |
|-----------|--------|------|-------|
| CoverageCell | bg-status-success/10, bg-status-warning/10, bg-status-error/10, bg-text-tertiary/10 | aria-label="col for repo: state — label" | 9 (incl. CODEX HIGH-4 sub-states) |
| OverrideChip | bg-status-warning/10 text-status-warning | aria-expanded, aria-controls, aria-label | 5 |
| CoverageEmptyState | Phase 05.1 EmptyState wrapper | n/a | 4 |
| CoverageRow | Phase 05.1 card-bg tokens | aria-label refresh button | 5 |
| CoverageFamilySection | sticky top-0 z-10 bg-card-bg | aria-expanded, aria-controls, role=region | 7 |
| CoverageToolbar | bg-accent/bg-card-bg chips | role=group aria-label="Filter by status", aria-pressed, role=searchbox | 7 (incl. real TanStack Router) |
| CoveragePage | Phase 05.1 throughout | composed from above | 8 |
| RefreshAllStaleButton | bg-accent text-card-bg | aria-busy | 5 |
| clipboardCompat | n/a | n/a | 3 |

**Total: 53 tests** (plan required ≥42)

## Security Contracts Verified

| Contract | Enforcement |
|----------|-------------|
| T-10-06-01: absPath never in DOM | absPath not in CoverageRow schema; grep confirms no JSX reference; CoveragePage.test.tsx asserts |
| T-10-06-02: URL params no XSS | React renders values, no innerHTML; filter values enum-bounded |
| T-10-06-03: localStorage origin-scoped | Key format: coverage:section-collapsed:<family> — only public family names |
| T-10-06-04: clipboard payloads | Strings from shared constants; family is CoverageFamily enum; no user input interpolated |
| T-10-06-05: DoS via polling | Inherited from Plan 05 hooks (30s staleTime = daemon cache TTL) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] React hooks rules violation — useMemo after early returns in CoveragePage**
- **Found during:** Task 3 typecheck
- **Issue:** `useMemo` calls for `filtered` and `byFamily` were placed after schema-drift/loading/error early returns, violating React's rules of hooks (hooks must be called unconditionally at top level)
- **Fix:** Moved `useMemo` calls before all early returns; used `query.data?.rows ?? []` as the base data to handle the undefined case
- **Files modified:** `packages/spa/src/components/panels/coverage/CoveragePage.tsx`
- **Commit:** 9fce9ad

**2. [Rule 1 - Bug] OverrideEntry type not exported from shared package**
- **Found during:** Task 3 typecheck
- **Issue:** `OverrideEntrySchema` was exported from coverage.ts but no `export type OverrideEntry` existed; SPA tests and components needed the type
- **Fix:** Added `export type OverrideEntry = z.infer<typeof OverrideEntrySchema>` to coverage.ts; added to index.ts re-exports
- **Files modified:** `packages/shared/src/schemas/coverage.ts`, `packages/shared/src/index.ts`
- **Commit:** 9fce9ad

**3. [Rule 3 - Blocking] .gitignore catch-all coverage rule blocked git staging**
- **Found during:** Task 1 commit
- **Issue:** `.gitignore` had bare `coverage` entry (for vitest output directories) which matched the source path `panels/coverage/`, preventing `git add` of all panel files
- **Fix:** Added `!**/panels/coverage/` negation rule immediately after the `coverage` entry
- **Files modified:** `.gitignore`
- **Commit:** 5eb7ce8

**4. [Rule 1 - Bug] tokenSourceOfTruth test false-positive hex detection**
- **Found during:** Task 1 test run
- **Issue:** `~/Sourcecode/{agenticapps,factiv,neuroflash}` using HTML entities `&#123;` caused the hex literal scanner to match `#123` as a hex color
- **Fix:** Changed to JSX expression `{'~/Sourcecode/{agenticapps,factiv,neuroflash}'}` which avoids HTML entity expansion
- **Files modified:** `packages/spa/src/components/panels/coverage/CoverageEmptyState.tsx`
- **Commit:** 5eb7ce8

**5. [Rule 1 - Bug] TanStack Router navigate type incompatibility**
- **Found during:** Task 3 typecheck
- **Issue:** `useNavigate` result type is narrowly typed to registered routes; `/coverage` route not yet registered (Plan 07 does this), so `navigate({ search: fn })` failed type-check
- **Fix:** Double-cast `navigate as unknown as (opts: {...}) => void`; documented that Plan 07's `validateSearch` wiring will make this unnecessary
- **Files modified:** `packages/spa/src/components/panels/coverage/CoveragePage.tsx`
- **Commit:** 9fce9ad

**6. [Rule 2 - Missing] `act` imported from wrong module in toolbar test**
- **Found during:** Task 2 test run
- **Issue:** `act` was imported from `vitest` (not exported there) instead of `@testing-library/react`
- **Fix:** Moved `act` import to `@testing-library/react`
- **Files modified:** `packages/spa/src/components/panels/coverage/CoverageToolbar.test.tsx`
- **Commit:** 48dbc2e

## Known Stubs

None. All 8 components are fully implemented and wired to real hooks/data. CoveragePage integrates `useCoverage` and `useCoverageRefresh` from Plan 05. No placeholder data, no TODO comments in production files.

## Threat Flags

None. No new network endpoints introduced (SPA-side only). Trust boundary inherited from apiFetch + bearer auth. All STRIDE items from the plan's threat register are mitigated as designed.

## Self-Check: PASSED

Files created/modified: all 20 files exist (verified by bash check).

Commits verified:
- 5eb7ce8 — feat(10-06): Task 1 — leaf primitives
- 48dbc2e — feat(10-06): Task 2 — mid-level compositions
- 9fce9ad — feat(10-06): Tasks 3+3a — CoveragePage + RefreshAllStaleButton

Acceptance criteria:
- 783 SPA tests GREEN (plan required ≥42 coverage-specific + full suite GREEN) ✓
- 0 it.todo remaining across all 8 test files ✓
- typecheck exits 0 ✓
- bg-status-success/10, bg-status-warning/10, bg-status-error/10, bg-text-tertiary/10 in CoverageCell ✓
- CoverageGitNexusBanner.tsx deleted (CODEX HIGH-6 Option A) ✓
- CODEX HIGH-4 workflow sub-state strings present in CoverageCell.tsx ✓
- for (const row of spawnable) in RefreshAllStaleButton.tsx ✓
- Promise.all absent from RefreshAllStaleButton.tsx batch loop ✓
- aria-busy on RefreshAllStaleButton button ✓
- createRouter + RouterProvider in CoverageToolbar.test.tsx (CODEX MED-15) ✓
- localStorage key 'coverage:section-collapsed:<family>' in CoverageFamilySection.tsx ✓
- worst-state-wins aggregate counts in CoverageFamilySection.tsx ✓
- gitNexusInstalled={data.gitNexusInstalled} passed to CoverageFamilySection in CoveragePage.tsx ✓
- writeToClipboard + shared clipboard builders in CoveragePage.tsx ✓
- SchemaDriftState in CoveragePage.tsx ✓
- absPath absent from all component JSX ✓
