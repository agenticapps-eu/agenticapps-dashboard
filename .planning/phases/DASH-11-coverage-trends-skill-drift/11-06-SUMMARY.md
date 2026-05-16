---
phase: DASH-11-coverage-trends-skill-drift
plan: 06
subsystem: ui
tags: [spa, polish, sticky-header, opacity, page-header, coverage, react, tailwind, tdd]

# Dependency graph
requires:
  - phase: DASH-05.1-ui-redesign-cloudflare-sidebar
    provides: PageHeader primitive, AppShellV2 with overflow-y-auto <main> scroll container, design tokens (--color-app-bg, --z-sticky)
  - phase: DASH-10-coverage-matrix-page-per-repo-presence-freshness-of-claude-m
    provides: CoverageRow.tsx + CoveragePage.tsx surfaces being polished
  - phase: DASH-10.5-impeccable-skill-driven-gate
    provides: composite ≥ 87 floor that motivated the Phase 10.6 polish triage
provides:
  - PageHeader sticky?: boolean opt-in prop (default false — preserves all non-opted-in routes)
  - CoverageRow per-row refresh button opacity-30 default (touchpad/keyboard discoverability)
  - CoveragePage opted into sticky PageHeader at every render path (loading / error / empty / main)
affects:
  - Phase 11 plan 04 (Wave 2 SPA — will land drift badge wiring on CoverageRow.tsx on top of this post-polish version)
  - Phase 11 plan 05 (Wave 2 SPA — skill drift page may adopt sticky PageHeader opt-in)
  - Future routes adopting sticky PageHeader during their own gate cycles (other dashboard pages stay default-false)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opt-in prop with default-false backward compatibility (sticky?: boolean) — every existing call-site keeps its current behavior; opting in is a per-route choice"
    - "DOM-assertion test strategy for proving a wrapper component passes a prop through to a child — assert on the rendered DOM (the child's behavior under that prop) rather than mocking the child"
    - "Threading 'is this file untouched?' as a test invariant — fs.readFileSync + regex assertion to lock a REVIEWS correction at the test layer (coverage.lazy.tsx)"

key-files:
  created: []
  modified:
    - packages/spa/src/components/ui/PageHeader.tsx
    - packages/spa/src/components/ui/PageHeader.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageRow.tsx
    - packages/spa/src/components/panels/coverage/CoverageRow.test.tsx
    - packages/spa/src/components/panels/coverage/CoveragePage.tsx
    - packages/spa/src/components/panels/coverage/CoveragePage.test.tsx

key-decisions:
  - "Honored D-11-09: sticky?: boolean defaults to false (backward-compat opt-in pattern). Other dashboard routes (/help, /settings, /skills, /, /projects/:id, /pair, /onboarding) untouched and unregressed."
  - "Honored D-11-10: opacity-30 (not opacity-50, not opacity-100). Hover/focus still bumps to opacity-100 via group-hover, focus, focus-within."
  - "Honored PD-PLI-03 (REVIEWS action item 9): patched CoveragePage.tsx (the actual <PageHeader> render-site), NOT coverage.lazy.tsx (which only declares the lazy route handle)."
  - "DOM-assertion strategy for PLI-03 automated test instead of module-mocking PageHeader — avoids vi.mock hoisting hazards and breaks honestly if a future refactor drops sticky prop."

patterns-established:
  - "sticky-opt-in: optional sticky?: boolean prop with default false enables per-route opt-in without regressing un-audited routes. New routes adopt by passing sticky={true}; existing routes stay default."
  - "fs.readFileSync REVIEWS-lock: lock a 'this file should NOT be modified' correction at the test layer by reading the file and grep-asserting on its contents. Catches accidental future re-introductions."
  - "Test-layer invariant for prop pass-through: assert on the rendered DOM produced by the child under the prop (PageHeader renders sticky tokens when sticky=true ⇒ if outer div has the tokens, the parent passed the prop) — robust, doesn't require module mocking."

requirements-completed:
  - PLI-01
  - PLI-02
  - PLI-03

# Metrics
duration: ~10min
completed: 2026-05-16
---

# Phase 11 Plan 06: Phase 10.6 polish bundle (sticky PageHeader + CoverageRow opacity-30 + CoveragePage opt-in) Summary

**PageHeader gains optional sticky prop (default false), CoverageRow refresh button defaults to opacity-30, and CoveragePage opts in at every render path — three Phase 10.6 IMPECCABLE-triage polish items shipped in 10 minutes via one TDD task split into three commits.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-16T16:19:00Z
- **Completed:** 2026-05-16T16:25:30Z
- **Tasks:** 1 (split into 3 atomic commits per the plan's RED→GREEN×3 strategy)
- **Files modified:** 6 (3 source + 3 tests)

## Accomplishments

- **PLI-01 — PageHeader sticky prop:** Added optional `sticky?: boolean` (default `false`). When `true`, outer div gains `sticky top-0 z-10 bg-app-bg` (anchored to `<main id="main">` scroll container in AppShellV2). `mb-6` 24px bottom margin preserved in both modes. Opt-in per-route so no other dashboard route regresses.
- **PLI-02 — CoverageRow opacity polish:** Per-row refresh button default opacity bumped from `opacity-0` → `opacity-30` for touchpad/keyboard discoverability per Phase 10.6 IMPECCABLE triage. Hover/focus still bumps to `opacity-100` (group-hover, focus, focus-within preserved).
- **PLI-03 — Route opt-in:** `CoveragePage.tsx` passes `sticky={true}` on all four `<PageHeader>` render paths (loading skeleton, non-drift error, empty-matrix, main render). `coverage.lazy.tsx` confirmed untouched (REVIEWS action item 9 correction — earlier plan drafts incorrectly pointed at the lazy file, which only declares the route handle).
- **15 new tests added** (5 PageHeader + 3 CoverageRow + 7 CoveragePage); 816/816 SPA tests green, typecheck clean, build clean.

## Task Commits

Plan 06's single TDD task was split across three atomic commits, mirroring the three PLI items:

1. **Step A — PageHeader sticky prop** — `45c9999` (test+feat)
   `test+feat(11-06): add sticky prop to PageHeader (PLI-01 D-11-09)`
2. **Step B — CoverageRow opacity-30** — `ace1989` (test+feat)
   `test+feat(11-06): bump CoverageRow refresh button to opacity-30 (PLI-02 D-11-10)`
3. **Step C — CoveragePage opt-in** — `a099ce9` (test+feat)
   `test+feat(11-06): CoveragePage opts into sticky PageHeader at every render path (PLI-03)`

Each commit followed strict RED → GREEN:
- Step A: PH-S3 failed first (sticky tokens absent), then PageHeader.tsx gained the prop → all 11 PageHeader tests green.
- Step B: PLI-02 first test failed first (opacity-0 default), then one-token swap → all 8 CoverageRow tests green.
- Step C: All 6 new sticky-opt-in tests failed first (sticky token absent in CoveragePage's rendered DOM), then `sticky={true}` added to all 4 PageHeader invocations → all 21 CoveragePage tests green.

## Files Created/Modified

- `packages/spa/src/components/ui/PageHeader.tsx` — added `sticky?: boolean` (default `false`); when true, outer div className includes ` sticky top-0 z-10 bg-app-bg`. JSDoc explains token semantics (`bg-app-bg`, `z-10` ↔ `--z-sticky`, mb-6 preservation).
- `packages/spa/src/components/ui/PageHeader.test.tsx` — added PH-S1..PH-S5 (5 tests): no-prop default, explicit-false matches default, all four sticky tokens present together, mb-6 preserved in both modes, helper/actions/children unchanged with sticky.
- `packages/spa/src/components/panels/coverage/CoverageRow.tsx` — one-token swap on the refresh button's className: `opacity-0` → `opacity-30`. `group-hover:opacity-100`, `focus-within:opacity-100`, `focus:opacity-100` all unchanged.
- `packages/spa/src/components/panels/coverage/CoverageRow.test.tsx` — added 3 tests asserting opacity-30 default + group-hover + focus bumping preserved.
- `packages/spa/src/components/panels/coverage/CoveragePage.tsx` — `sticky={true}` added to all 4 `<PageHeader>` invocations (lines ~206 loading, ~227 error, ~242 empty, ~250 main render).
- `packages/spa/src/components/panels/coverage/CoveragePage.test.tsx` — added a second `describe` block "CoveragePage — PLI-03 sticky PageHeader opt-in" with 7 tests: 6 assert sticky tokens on outer div across all render paths (loading / error / empty / 3 install-state variants of main render); 1 locks the REVIEWS #9 correction via `fs.readFileSync` on coverage.lazy.tsx.

## Decisions Made

- **DOM-assertion vs module-mock for PLI-03:** Plan suggested mocking `PageHeader` to spy on props. Chose DOM-assertion instead because (a) the existing CoveragePage.test.tsx has no PageHeader mock and a hoisted `vi.mock` inside a second describe block would conflict globally with the first describe block's tests that use the real PageHeader, (b) DOM-assertion exercises the real wire (PageHeader receives `sticky={true}` → PageHeader renders sticky tokens) instead of asserting only on the prop boundary, and (c) the test breaks honestly if either side regresses (CoveragePage drops the prop OR PageHeader drops the className). The test reads PageHeader's `.mb-6.flex.flex-col` selector to find the outer div and asserts on its className.
- **`fs.readFileSync` lock on coverage.lazy.tsx:** Added a test that reads the lazy route file as a string and asserts no `sticky` reference exists. This locks the REVIEWS #9 correction at the test layer so a future refactor that re-introduces sticky into the wrong file is caught by CI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PageHeader.tsx JSDoc included `#FAFAF7` hex literal**
- **Found during:** Step A verification (full SPA suite run after PageHeader edit)
- **Issue:** I added a JSDoc comment to PageHeader.tsx that included the literal `#FAFAF7` to explain what `--color-app-bg` maps to. This violated the `tokenSourceOfTruth.test.ts` invariant (AC-05) which forbids hex literals anywhere under `packages/spa/src/components/**` — the test scans for the regex `#[0-9A-Fa-f]{6}` and fails if any production component file contains one. The CLAUDE.md token comments in tokens.css are the only canonical hex home.
- **Fix:** Removed the `(#FAFAF7 ...)` from the JSDoc, kept the descriptive "(warm paper)" qualifier. Token semantics still documented; hex literal removed.
- **Files modified:** `packages/spa/src/components/ui/PageHeader.tsx` (comment only)
- **Verification:** `tokenSourceOfTruth.test.ts` re-runs green; full SPA suite re-runs to 816/816.
- **Committed in:** `45c9999` (folded into Step A — RED→GREEN→fix-and-stay-green all in one commit cycle).

**2. [Rule 1 - Bug] Plan-time PageHeader count was 5; actual file has 4 distinct `<PageHeader>` elements**
- **Found during:** Step C planning (reading CoveragePage.tsx end-to-end before editing)
- **Issue:** The plan's `must_haves.truths` and acceptance criteria stated "all FIVE `<PageHeader>` invocations" and required `grep -c "sticky={true}" CoveragePage.tsx ≥ 5`. The verified live file has 4 distinct `<PageHeader>` elements: line 206 (loading skeleton), line 227 (non-drift error), line 242 (empty matrix), and line 250 (main render — with an actions ternary covering 3 install-state branches inside a single PageHeader element). The plan's "5" likely counted the ternary branches as separate elements, but they share one parent PageHeader.
- **Fix:** Added `sticky={true}` to all 4 actual `<PageHeader>` elements. The PLI-03 automated test exercises every render path (loading / error / empty / 3 main-render install-state variants — that's 6 distinct render paths, but they flow through 4 PageHeader elements). The intent of the acceptance criterion — "every PageHeader render path opts in" — is fully met.
- **Files modified:** Already covered in `a099ce9`.
- **Verification:** `grep -c "sticky={true}" CoveragePage.tsx` returns 4 (one per actual PageHeader element). The PLI-03 test asserts sticky tokens are present on the outer DOM in all 6 render-path test cases.
- **Committed in:** `a099ce9` (Step C).

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both auto-fixes essential — Rule 1 #1 unblocks CI; Rule 1 #2 reconciles a planning-time count error against the live file structure. The plan's spirit (every PageHeader render path opts in to sticky) is fully honored. No scope creep.

## Issues Encountered

None — the three steps were strict TDD cycles with no debugging detours. The token-source-of-truth invariant catching my hex-in-comment was the only iteration, and that's exactly what the invariant is for.

## REVIEWS Action Item 9 Resolution

The plan called out an earlier-draft error: a prior version of Plan 06 pointed at `packages/spa/src/routes/coverage.lazy.tsx` as the file that renders `<PageHeader>` and therefore the file to opt into sticky. Codex's cross-AI review caught the mismatch — `coverage.lazy.tsx` only declares the lazy route handle (`createLazyRoute('/coverage')({ component: CoveragePage })`); the actual `<PageHeader>` invocations live in `CoveragePage.tsx`.

This summary confirms the plan-time correction landed correctly at execution time:
- `git status packages/spa/src/routes/coverage.lazy.tsx` returns no changes.
- `grep -c "sticky" packages/spa/src/routes/coverage.lazy.tsx` returns 0.
- The CoveragePage.test.tsx test "REVIEWS action item 9: coverage.lazy.tsx is NOT modified by this plan" reads the file from disk and asserts on its contents — locked at the test layer so future drift is caught.

## Token Source of Truth Invariant

After the Rule 1 hex-in-comment fix, `tokenSourceOfTruth.test.ts` continues to pass:
- No hex literals introduced anywhere under `packages/spa/src/components/**`.
- All four sticky-mode tokens (`sticky`, `top-0`, `z-10`, `bg-app-bg`) are Tailwind utilities backed by `--color-app-bg` and `--z-sticky` in `packages/spa/src/styles/tokens.css`.
- 24px bottom margin (`mb-6`) preserved per CONTEXT §Specifics.

## Visual Smoke (Deferred to User — Not Blocking)

Plan's "Step D — visual smoke" is recommended but explicitly NOT blocking. Verification commands when the dev server is running locally:

1. `pnpm --filter @agenticapps/dashboard-spa dev` → navigate to `http://localhost:5174/coverage`.
2. Scroll the matrix; PageHeader should pin to the top of `<main>` (below the TopBar).
3. Scrolled content should NOT visibly pass behind the header (`bg-app-bg` opaque backstop).
4. Navigate to `/`, `/projects/:id`, `/help`, `/settings`, `/onboarding`, `/pair`; PageHeader should NOT be sticky (default-false preserved).
5. Hover the per-row refresh button on `/coverage`; opacity goes from 30% to 100% smoothly on hover/focus.

If any smoke check fails, debug Pitfall 8 from 11-RESEARCH.md (ancestor `overflow:hidden`) — but AppShellV2's `<main>` has `overflow-y-auto`, verified at execution time, so sticky should anchor correctly.

## Phase-level IMPECCABLE Re-critique Note

Per the plan's `<output>` directive: `/coverage` should be re-critiqued after this plan ships alongside Plan 11-04's drift-badge wiring. The composite delta will fold contributions from (a) the sticky PageHeader (this plan), (b) the opacity-30 row-refresh button (this plan), and (c) the inline drift badge (Plan 11-04). Phase 11 IMPECCABLE artifact lives at `.planning/phases/DASH-11-coverage-trends-skill-drift/11-IMPECCABLE.md` after Wave 2 closes.

## Next Phase Readiness

- **Plan 11-04 (Wave 2 SPA — coverage drift):** Will modify `CoverageRow.tsx` to wire the drift badge into the `CoverageCell` props. The opacity-30 change landed cleanly on the existing className without touching any other slots, so 11-04's executor starts from the post-polish version with no merge conflict.
- **Plan 11-05 (Wave 2 SPA — skill drift page):** New `/observability/skill-drift` route may adopt the sticky PageHeader by passing `sticky={true}` — the opt-in pattern is now established and documented in PageHeader's JSDoc.
- **Other dashboard routes:** Stay default-false. When future polish cycles audit a route (e.g. `/`, `/help`, `/settings`), they can opt in incrementally without coordination.

## Self-Check: PASSED

- Files modified exist on disk:
  - `packages/spa/src/components/ui/PageHeader.tsx` — FOUND
  - `packages/spa/src/components/ui/PageHeader.test.tsx` — FOUND
  - `packages/spa/src/components/panels/coverage/CoverageRow.tsx` — FOUND
  - `packages/spa/src/components/panels/coverage/CoverageRow.test.tsx` — FOUND
  - `packages/spa/src/components/panels/coverage/CoveragePage.tsx` — FOUND
  - `packages/spa/src/components/panels/coverage/CoveragePage.test.tsx` — FOUND
- Commits exist in git log:
  - `45c9999` — FOUND (Step A — PageHeader sticky prop)
  - `ace1989` — FOUND (Step B — CoverageRow opacity-30)
  - `a099ce9` — FOUND (Step C — CoveragePage opt-in)
- Acceptance grep checks all pass:
  - `sticky?: boolean` in PageHeader.tsx: 3 matches (interface + impl + JSDoc) ≥ 1 ✓
  - `sticky top-0 z-10 bg-app-bg` in PageHeader.tsx: 3 matches ≥ 1 ✓
  - `mb-6` in PageHeader.tsx: 3 matches ≥ 1 ✓
  - `opacity-0` in CoverageRow.tsx: 0 matches ✓
  - `opacity-30` in CoverageRow.tsx: 1 match ≥ 1 ✓
  - bumping selectors in CoverageRow.tsx: 1 line containing all three ≥ 1 ✓
  - `sticky={true}` in CoveragePage.tsx: 4 matches (one per actual PageHeader element — see Deviation #2)
  - `sticky` in coverage.lazy.tsx: 0 matches ✓
  - `CoveragePage.test.tsx` exists with PLI-03 describe block (7 tests) ✓
- Full test suite: 816/816 green ✓
- Typecheck: clean ✓
- Build: clean ✓

---

*Phase: DASH-11-coverage-trends-skill-drift*
*Completed: 2026-05-16*
