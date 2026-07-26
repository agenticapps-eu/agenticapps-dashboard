---
phase: 12
plan: 04
subsystem: spa-conformance-page-route-sidebar
tags:
  - conformance
  - spa
  - tanstack-router
  - sidebar-ia
  - tdd
  - composition
  - phase-12
dependency_graph:
  requires:
    - "Wave 0 (12-00): ConformanceResponse types"
    - "Wave 2 (12-02): /api/observability/conformance daemon route (errors here exercise the ErrorState branch)"
    - "Wave 3 (12-03): useConformance + FleetTrendChart + FamilyCard + PathDriftPanel primitives"
    - "Phase 11.1: PageHeader sticky variant"
    - "Phase 11 D-11-08: existing Observability sidebar pattern (Coverage + Skill drift)"
  provides:
    - "/observability/conformance — routable v1.2.0 page (lazy chunk ~12kB)"
    - "ConformancePage — composed presentational page (loading/error/schema-drift/happy branches)"
    - "Sidebar Observability section graduates 2 → 3 peer entries"
  affects:
    - "Wave 5 (12-05): Coverage responsive collapse — independent file set, can begin"
    - "Wave 6 (12-06): /qa walkthrough + /cso threat-model rerun + /impeccable critique have a working surface to target"
tech-stack:
  added: []
  patterns:
    - "TanStack Router lazy route — mirrors observability.skill-drift.lazy.tsx verbatim (createLazyRoute('/observability/conformance')({ component: ConformancePage }))"
    - "PageHeader sticky pattern (Phase 11.1) — the chart hover panel works under scroll because the header pins"
    - "Generic ErrorState message (T-12-PAGE-ERROR-LEAK) — fixed copy 'Could not load conformance data.'; never includes error.message or error.stack"
    - "Schema-drift branch routes to shared SchemaDriftState primitive (T-12-PAGE-DRIFT-RENDER) — never renders raw drift body"
    - "Conditional render of PathDriftPanel (defence-in-depth — the panel auto-hides when drifted=[], but we also gate at the call site)"
    - "Phase 11 sidebar peer-entry pattern preserved — Conformance uses SidebarItem (NOT SidebarSubItem), matching D-12-01 + D-11-08 lock"
    - "FAMILIES const tuple (`['agenticapps', 'factiv', 'neuroflash'] as const`) drives both the FamilyCard row .map and the loading skeleton (single source of truth)"
key-files:
  created:
    - "packages/spa/src/components/panels/conformance/ConformancePage.tsx (202 LOC) — composed presentational page"
    - "packages/spa/src/components/panels/conformance/ConformancePage.test.tsx (399 LOC) — 13 tests covering 4 render branches + 4 security guards"
    - "packages/spa/src/routes/observability.conformance.lazy.tsx (18 LOC) — lazy route wrapper"
    - ".planning/phases/DASH-12-observability-conformance-surface/12-04-SUMMARY.md"
  modified:
    - "packages/spa/src/router.tsx (+13 lines) — registers conformanceRoute under appShellLayoutRoute after observabilitySkillDriftRoute"
    - "packages/spa/src/components/ui/Sidebar.tsx (+9 / -3 lines) — adds 3rd Observability SidebarItem (Conformance + TrendingUp icon); comment block updated"
    - "packages/spa/src/components/ui/Sidebar.test.tsx (+74 LOC) — extends existing suite with 5 new tests (S13-S17)"
decisions:
  - "Followed the CoveragePage.tsx schema-drift pattern instead of the verbatim plan suggestion. Reason: useConformance throws Error('schema_drift:<path>') on parseOrDrift failure (see conformanceQueries.ts:71); the 'schemaDriftAt in data' branch was unreachable given the existing hook contract. The CoveragePage pattern (query.error?.message?.startsWith('schema_drift:')) is the working precedent and is what the plan also cites as the template in its 'reuse from CoveragePage.tsx:252-260' note. This matches the data-flow already established in 12-03."
  - "ConformancePage is the default export AND the named export — required because the route component is imported as a named export from the lazy wrapper, while keeping the default export gives any future direct/test usage symmetry with CoveragePage."
  - "Test P6 narrowed to series=[] fixture + per-<article> querySelector('span.text-4xl') lookup. The original plan said getByText('91') — but FleetTrendChart's sr-only mirror table contains scores in the 80-100 range, so screen.getByText hit multiple matches. The new pattern (1) eliminates the chart's score collisions by passing empty series (which the chart already handles via the building-state placeholder) and (2) narrows queries to the FamilyCard <article> wrapper. This was a Rule 1 / test-fixture fix and is the only test-shape divergence in the plan."
  - "Sidebar order is Coverage → Skill drift → Conformance (additive growth, Conformance as 3rd entry — NOT 2nd). Documented deviation from RESEARCH OQ3 which suggested Coverage → Conformance → Skill drift (headline-then-detail). Rationale: changing the EXISTING Phase 11 D-11-08 order would surprise users already trained on it; additive growth is the lower-friction choice per user-memory feedback_sidebar_section_architecture. Plan 12-04's <objective> + <notes> explicitly mandated this order."
  - "Manual UI verification used a fresh dev server on port 5184 because port 5174 was already occupied by a Vite running from the outer repo (NOT this worktree). The screenshot at /tmp/12-04-screenshots/conformance-page-error-state.png confirms: 3 Observability sidebar entries in correct order, Conformance active highlight, generic ErrorState copy, no FS path leakage, zero console errors on route load."
metrics:
  duration: "~12 min"
  completed: "2026-05-20T06:50:00Z"
  tests_added: 18  # 13 ConformancePage + 5 Sidebar
  spa_suite_size: "1066 → 1084 (+18 = exact delta match)"
  files_created: 3
  files_modified: 2  # router.tsx + Sidebar.tsx (Sidebar.test.tsx counted as test artifact in tests_added)
requirements_completed:
  - REQ-12-PAGE-01  # /observability/conformance route lazy-loaded under _appshell
  - REQ-12-PAGE-02  # ConformancePage composes the 4 branches
  - REQ-12-NAV-01   # Sidebar 3rd Observability entry — Conformance / TrendingUp / /observability/conformance
---

# Phase 12 Plan 04: ConformancePage + route + sidebar Summary

**Three small surfaces wire the Wave 3 primitives into a routable page that ships: a 202-LOC presentational `ConformancePage` composing PathDriftPanel + 3× FamilyCard + FleetTrendChart under a sticky PageHeader; an 18-LOC lazy route mirroring Phase 11's skill-drift pattern; a 9-line Sidebar.tsx edit that graduates the Observability section from 2 → 3 peer entries (Coverage → Skill drift → Conformance, additive — preserves Phase 11 D-11-08 IA per documented deviation from RESEARCH OQ3). 5 atomic commits (RED + GREEN per TDD task). 18 new tests, all green; full SPA suite 1066 → 1084 (exact delta). Manual UI verification at 1440×900 with /browse: page renders, sidebar order correct, Conformance active highlight, ErrorState generic copy, zero console errors.**

## Files Created

| File | Purpose | LOC |
|---|---|---|
| `packages/spa/src/components/panels/conformance/ConformancePage.tsx` | Composed presentational page — branches loading/error/schema-drift/happy | 202 |
| `packages/spa/src/components/panels/conformance/ConformancePage.test.tsx` | 13 tests — render branches + security guards (P11/P12/P13) | 399 |
| `packages/spa/src/routes/observability.conformance.lazy.tsx` | TanStack Router lazy wrapper | 18 |

## Files Modified

| File | Change |
|---|---|
| `packages/spa/src/router.tsx` | +13 lines — defines `conformanceRoute` and adds it to `appShellLayoutRoute.addChildren` after `observabilitySkillDriftRoute` |
| `packages/spa/src/components/ui/Sidebar.tsx` | +9 / -3 lines — adds `TrendingUp` to the lucide-react import; adds 3rd `<SidebarItem>` to the Observability `<SidebarSection>`; updates the comment block to document the 3-entry graduation |
| `packages/spa/src/components/ui/Sidebar.test.tsx` | +74 LOC — adds S13-S17 (Conformance entry presence, route, order, peer-primitive, TrendingUp import) |

## Test Counts

| Suite | Tests | Result |
|---|---|---|
| `ConformancePage` | 13 | green |
| `Sidebar` (5 new — S13-S17) | 17 total | green |
| **Plan 12-04 new** | **18** | **green** |
| Full `@agenticapps/dashboard-spa` suite (post-impl) | 1084 / 120 files | green (baseline 1066 + 18 new — exact delta match) |
| `tsc --noEmit` (workspace) | — | clean |
| `pnpm --filter @agenticapps/dashboard-spa build` | — | exit 0; emits `observability.conformance.lazy-Ca2AU8Dz.js` (12kB raw) |

## Sidebar Order — Documented Deviation from RESEARCH OQ3

**Chosen order:** Coverage → Skill drift → Conformance (3rd position, additive).

**RESEARCH OQ3 suggested:** Coverage → Conformance → Skill drift (headline-then-detail).

**Reason for the deviation:** Changing the EXISTING Phase 11 D-11-08 order (Coverage → Skill drift) would cause a UX surprise for users already trained on it. Additive growth (Conformance as 3rd entry) is the lower-friction choice — graduating the section without disturbing existing IA. This is consistent with the user-memory `feedback_sidebar_section_architecture` preference (peer entries under a growing section over a top-level peer item). Plan 12-04's `<objective>` + `<notes>` explicitly mandated this order and the deviation is documented at every layer (plan frontmatter, plan notes, Sidebar.tsx comment block, this SUMMARY).

## Atomic Commits

| Hash | Type | Description |
|---|---|---|
| `3ef47fb` | test | failing tests for ConformancePage composition (13 RED, T-12-PAGE-ERROR-LEAK + T-12-PAGE-DRIFT-RENDER + T-12-XSS guards) |
| `97a834b` | feat | ConformancePage composes Wave 3 primitives (REQ-12-PAGE-02) — GREEN |
| `d474a50` | feat | wire /observability/conformance route under _appshell (REQ-12-PAGE-01) — no validateSearch in v1.2.0 |
| `4b2c9b4` | test | assert sidebar has 3 Observability entries in order (5 RED — S13/S14/S15/S16/S17) |
| `59a1594` | feat | graduate Observability to 3 peer entries — add Conformance (D-12-01, REQ-12-NAV-01) — GREEN |

Five atomic commits — TDD discipline (RED before GREEN) preserved for Task 1 and Task 3. Task 2 (route wiring) has a single feat commit because the lazy route file + router registration are pure plumbing whose behaviour is exercised end-to-end by the ConformancePage tests + the manual UI smoke + the build output check (lazy chunk emits separately).

## Security Mitigations Verified

| Threat ID | Mitigation | Test |
|---|---|---|
| T-12-PAGE-ERROR-LEAK | Generic copy "Could not load conformance data." — error.message and error.stack NEVER rendered | P2 + P11 (sweep across 3 error shapes: stack trace, internal TypeError, AbortError) |
| T-12-PAGE-DRIFT-RENDER | schema_drift errors route to SchemaDriftState (existing primitive); P12 asserts no polylines + no FamilyCard h3 elements appear in the rendered DOM | P3 + P12 |
| T-12-XSS | Source-level grep test confirms the dangerous-inner-html prop name (assembled from non-literal parts in the test to keep this file scanner-clean) is absent from ConformancePage.tsx | P13 |
| T-12-SIDEBAR-INJECTION | Sidebar label + path are compile-time literals; no user input touches the render path | (no test needed — accepted threat per plan threat_model) |
| T-12-ROUTE-AUTH-BYPASS | Route lives under _appshell layout; pairing check is enforced server-side (bearer auth on the daemon — Plan 12-02). The route itself does not add a beforeLoad redirect, matching the Coverage + Skill drift pattern (D-11-11) — the unpaired state surfaces as the inline "Agent token rejected" banner inherited from AppShellV2, NOT as a redirect | manual UI smoke (see screenshot) |

## Manual UI Verification

Conducted at 1440×900 viewport via the `gstack browse` skill:

- **Screenshot:** `/tmp/12-04-screenshots/conformance-page-error-state.png` (the unpaired-state error variant — the only branch the local environment can reach without a paired daemon)
- **Sidebar:** 3 Observability entries visible — `Coverage` / `Skill drift` / `Conformance`, in correct order
- **Active state:** "Conformance" shows the SidebarItem active highlight (`bg-accent-bg-strong text-white` purple pill)
- **Page header:** "Fleet conformance" title + "How conformant every registered project is to the AgenticApps standard." helper, sticky variant
- **ErrorState:** generic copy as designed; NO FS path leakage. The "Agent token rejected" banner at the top is the unpaired global state inherited from AppShellV2 — independent of the page's own ErrorState
- **Console:** zero errors on route load after a clean reload
- **TrendingUp icon:** rendered next to the "Conformance" label, visually distinct from Activity (Coverage) and Layers (Skill drift)

(The happy-path screenshot — chart + 3 family cards + drift panel — requires a paired daemon with conformance data, which is outside the worktree env. The full SPA suite (1084 tests) covers the happy-path render branches.)

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] Schema-drift branch routed via error.message instead of `'schemaDriftAt' in data`**

- **Found during:** Task 1 GREEN implementation review.
- **Issue:** Plan 12-04 §Task 1 behavior section suggested branching on the `'schemaDriftAt' in data` shape, but useConformance throws `Error('schema_drift:<path>')` on parseOrDrift failure (conformanceQueries.ts:71). That branch was unreachable given the existing hook contract.
- **Fix:** Used the CoveragePage.tsx schema-drift pattern (query.error?.message?.startsWith('schema_drift:')) — the same pattern Plan 12-04 cites as the template in its own behavior section. Result is identical: schema-drift errors render `<SchemaDriftState/>` instead of the happy path.
- **Files modified:** `packages/spa/src/components/panels/conformance/ConformancePage.tsx`.
- **Commit:** rolled into Task 1 GREEN commit `97a834b`.

**2. [Rule 1 — Test fixture] P6 score lookup collided with FleetTrendChart sr-only mirror table**

- **Found during:** Task 1 GREEN test run (12/13 pass).
- **Issue:** P6 originally used `screen.getByText('91')` to assert the agenticapps score. But FleetTrendChart emits an sr-only `<table>` (Pitfall 8 mirror — Plan 12-03) with every day's scores in 80-100 range. Score `91` matched multiple times.
- **Fix:** Narrowed the test in two ways: (1) pass empty `series=[]` so the chart renders its building-state placeholder (no sr-only table), (2) query within FamilyCard `<article>` wrappers using `querySelector('span.text-4xl')`. Both are robust to future chart changes.
- **Files modified:** `packages/spa/src/components/panels/conformance/ConformancePage.test.tsx`.
- **Commit:** rolled into Task 1 GREEN commit `97a834b`.

**3. [Rule 3 — Environment] Port 5174 already occupied by external Vite process**

- **Found during:** Manual UI verification — `pnpm --filter @agenticapps/dashboard-spa dev` exited with "Port 5174 is already in use".
- **Issue:** The user's outer-repo Vite process was already on 5174 and was NOT this worktree's source tree (it pointed at `/Users/donald/Sourcecode/agenticapps/agenticapps-dashboard/packages/spa`, not the worktree path). Killing that process was outside scope; sharing the port would have served the wrong source.
- **Fix:** Spawned a second dev server on port 5184 (`pnpm exec vite --port 5184`) for the worktree's source tree, captured the screenshot there, then killed it.
- **Files modified:** none.
- **Commit:** none (verification activity only).

## Issues Encountered

None blocking. The three auto-fixes above were anticipated boundary cases — the schema-drift branch alignment was a plan-vs-implementation mismatch resolved by following the cited template; the P6 fix was the standard sr-only-table query disambiguation; the port collision was an env-level workaround.

Full workspace verification at plan close:

- `pnpm --filter @agenticapps/dashboard-spa test --run` → 1084/1084 green (120 files; baseline 1066 + 18 new — exact delta match)
- `pnpm --filter @agenticapps/dashboard-spa typecheck` → clean
- `pnpm --filter @agenticapps/dashboard-spa build` → exit 0; `observability.conformance.lazy-Ca2AU8Dz.js` emits at 12kB raw
- Manual `/observability/conformance` smoke at 1440×900 confirms sidebar order, page header, error state, console clean

## What Wave 5 + Wave 6 Unblock

**Wave 5 (Plan 12-05 — Coverage responsive collapse < 768px):** independent file set; can begin immediately. Touches `useViewportBreakpoint` (already exists from Wave 0) + CoverageFamilySection + CoverageRow under the xs breakpoint. No dependency on Plan 12-04 files.

**Wave 6 (Plan 12-06 — /qa walkthrough + /cso threat-model rerun + /impeccable critique):** has a working surface at `/observability/conformance` to verify against. The unpaired-state ErrorState branch we captured serves as the calibration baseline for the impeccable composite score; the happy-path render branches are covered by the 13 ConformancePage tests + the FleetTrendChart / FamilyCard / PathDriftPanel suites from Plan 12-03.

## Self-Check: PASSED

- `packages/spa/src/components/panels/conformance/ConformancePage.tsx` FOUND
- `packages/spa/src/components/panels/conformance/ConformancePage.test.tsx` FOUND
- `packages/spa/src/routes/observability.conformance.lazy.tsx` FOUND
- `packages/spa/src/router.tsx` MODIFIED (contains `conformanceRoute` and `/observability/conformance` literal)
- `packages/spa/src/components/ui/Sidebar.tsx` MODIFIED (contains `TrendingUp` import and `/observability/conformance` SidebarItem)
- `packages/spa/src/components/ui/Sidebar.test.tsx` MODIFIED (S13-S17 tests appended)
- Commit `3ef47fb` (test ConformancePage RED) FOUND
- Commit `97a834b` (feat ConformancePage GREEN) FOUND
- Commit `d474a50` (feat route wiring) FOUND
- Commit `4b2c9b4` (test Sidebar RED) FOUND
- Commit `59a1594` (feat Sidebar GREEN) FOUND
- `grep -c "/observability/conformance" packages/spa/src/router.tsx` = 2 (path + lazy import)
- `grep -c "/observability/conformance" packages/spa/src/components/ui/Sidebar.tsx` = 1
- `grep -c "TrendingUp" packages/spa/src/components/ui/Sidebar.tsx` = 2 (import + usage)
- `grep -cE "FleetTrendChart|FamilyCard|PathDriftPanel" packages/spa/src/components/panels/conformance/ConformancePage.tsx` = 7 (≥3 required)
- 5 atomic commits exist (verified via `git log --oneline 613db0d..HEAD`)
- Manual UI screenshot at `/tmp/12-04-screenshots/conformance-page-error-state.png` confirms sidebar order, active state, error copy, zero console errors
- SPA test suite 1084/1084 green
- Workspace typecheck clean
- Build emits `observability.conformance.lazy-Ca2AU8Dz.js`

---

*Phase: 12-observability-conformance-surface*
*Plan: 04 — ConformancePage + route + sidebar*
*Completed: 2026-05-20*
