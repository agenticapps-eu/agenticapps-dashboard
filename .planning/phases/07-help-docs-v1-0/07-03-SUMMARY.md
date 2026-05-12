---
phase: 07-help-docs-v1-0
plan: 03
subsystem: ui
tags: [react, mdx, tdd, widget-stubs, warm-paper, tailwind, vitest]

# Dependency graph
requires:
  - phase: 07-help-docs-v1-0
    provides: tokenSourceOfTruth invariant extended to src/help/** (Plan 07-01 Task 6); Tailwind v4 typography plugin loaded; MDXProvider chain wired in main.tsx
  - phase: 05.1-redesign
    provides: warm-paper tokens (bg-sidebar-bg, bg-accent-bg, text-accent, text-text-primary, text-text-secondary)
provides:
  - "WidgetStub primitive at packages/spa/src/help/widgets/_stub-pattern.tsx (named export `WidgetStub` + `WidgetStubProps`)"
  - "8 named widget stub default exports at packages/spa/src/help/widgets/<Name>.stub.tsx (lazy-import targets for Plan 07-02 HelpWidget)"
  - "Smoke test suite asserting all 8 stubs render with title + 'Coming v1.2' badge (table-driven, 8 it.each cases)"
  - "Primitive unit tests covering title/description/emoji/default-emoji/badge/not-prose (5 cases)"
affects:
  - 07-02 (HelpWidget lazy() dispatch table — these are the import targets)
  - 07-04 (MDX content references <HelpWidget name="..." /> for any of the 8 names)
  - 07-05 (Playwright "widget stubs lazy-render" assertion targets the "Coming v1.2" badge)
  - v1.2 backlog (each .stub.tsx is replaced by a real widget; primitive can be retained or removed per widget)

# Tech tracking
tech-stack:
  added: []   # no new dependencies — all warm-paper utilities + lucide Sparkles + @testing-library already in place
  patterns:
    - "Migration Step 5 close: ship `_stub-pattern.tsx` containing ONLY the primitive; split each concrete `<Name>Stub` into a sibling `<Name>.stub.tsx` default export"
    - "Warm-paper translation of v0-style gradient placeholders: `bg-gradient-to-br from-muted/30 to-muted/60` → flat `bg-sidebar-bg` (per 07-RESEARCH.md judgment)"
    - "Table-driven smoke pattern (`it.each(STUBS)`) for lazy-import dispatch tables — proves all targets resolve without crashing"

key-files:
  created:
    - packages/spa/src/help/widgets/_stub-pattern.tsx
    - packages/spa/src/help/widgets/_stub-pattern.test.tsx
    - packages/spa/src/help/widgets/RepoTopologyMap.stub.tsx
    - packages/spa/src/help/widgets/WorkflowStateMachine.stub.tsx
    - packages/spa/src/help/widgets/GatePicker.stub.tsx
    - packages/spa/src/help/widgets/TraceVisualizer.stub.tsx
    - packages/spa/src/help/widgets/ScanReportPlayground.stub.tsx
    - packages/spa/src/help/widgets/ApplyConsentSimulator.stub.tsx
    - packages/spa/src/help/widgets/MigrationDryRun.stub.tsx
    - packages/spa/src/help/widgets/SlashCommandCatalog.stub.tsx
    - packages/spa/src/help/widgets/__tests__/stubs-smoke.test.tsx
  modified: []   # this plan only creates files in the previously-empty packages/spa/src/help/widgets/ directory

key-decisions:
  - "Migration Step 5 close honoured: primitive file exports ONLY WidgetStub + WidgetStubProps; the 8 concrete stubs from the v0 source live in sibling files"
  - "Gradient placeholder flattened to bg-sidebar-bg (warm-paper) per 07-RESEARCH.md — preserves the visual quietness without introducing a gradient that fights the typography plugin"
  - "Smoke test uses table-driven it.each rather than 8 hand-written cases — keeps the test honest about treating all 8 stubs uniformly (no special-casing)"

patterns-established:
  - "Domain widgets live at packages/spa/src/help/widgets/<Name>.stub.tsx with .stub.tsx suffix; replace with .tsx when shipping the real widget in v1.2"
  - "Default export per stub file — required for React.lazy() dispatch from HelpWidget (Plan 07-02)"
  - "Smoke test for any lazy-import dispatch table: assert each default export renders the expected sentinel (title heading + 'Coming v1.2' badge here)"

requirements-completed:
  - HELP-04

# Metrics
duration: 8min
completed: 2026-05-11
---

# Phase 07 Plan 03: Wave 1 widget stubs Summary

**Pruned `_stub-pattern.tsx` primitive (WidgetStub + WidgetStubProps only, warm-paper tokens applied) and 8 named widget stub default exports at `packages/spa/src/help/widgets/<Name>.stub.tsx` — every import target Plan 07-02's HelpWidget lazy dispatch table expects, with a table-driven smoke test that proves all 8 resolve and render without crashing.**

## Performance

- **Duration:** ~8 min wall-clock (mechanical copy-and-tokenize per plan-checker estimate)
- **Started:** 2026-05-11T20:37Z
- **Completed:** 2026-05-11T20:45Z
- **Tasks:** 4 of 4
- **Commits:** 4 (RED+GREEN for T1 + atomic T2 + atomic T3; T4 is verification-only, no commit)
- **Files created:** 11 (1 primitive + 1 primitive test + 8 stubs + 1 smoke test)
- **Files modified:** 0 (previously-empty directory)
- **Test count delta:** 630 → 643 SPA tests (+13 from this plan: 5 primitive + 8 smoke)

## Accomplishments

- **WidgetStub primitive lives alone in `_stub-pattern.tsx`.** Exports only `WidgetStub` (function) + `WidgetStubProps` (interface). Migration Step 5 close honoured: the 8 concrete `<Name>Stub` functions from the v0 source are gone from this file and live in their own sibling files.
- **Warm-paper token translation applied.** Source gradient `bg-gradient-to-br from-muted/30 to-muted/60` flattened to `bg-sidebar-bg`; badge `bg-primary/10 + text-primary` → `bg-accent-bg + text-accent`; description `text-muted-foreground` → `text-text-secondary`; title gets explicit `text-text-primary`. Zero hex literals anywhere in the new directory.
- **8 widget stub default exports landed at the import paths Plan 07-02 expects:** `RepoTopologyMap.stub.tsx`, `WorkflowStateMachine.stub.tsx`, `GatePicker.stub.tsx`, `TraceVisualizer.stub.tsx`, `ScanReportPlayground.stub.tsx`, `ApplyConsentSimulator.stub.tsx`, `MigrationDryRun.stub.tsx`, `SlashCommandCatalog.stub.tsx`. Each is ~10 LOC: default-export function returning `<WidgetStub title="..." emoji="..." description="..." />`. Title/description/emoji copied verbatim from the migration source.
- **Smoke gate established.** Table-driven `it.each(STUBS)` (8 cases) imports each default export, renders, and asserts the title heading + "Coming v1.2" badge both appear. Proves Plan 07-02's `React.lazy()` dispatch table will resolve to renderable components for all 8 widget names — the R2 disjoint-set claim from plan-check 07-03 holds in practice once both worktrees merge back.
- **R2 disjoint-set confirmed.** This plan touched only `packages/spa/src/help/widgets/**` (zero file overlap with Plan 07-02's `packages/spa/src/help/components/**` + `mdxComponents.ts` + `topicToUrl.*`). Parallel-safe by construction.

## Token translation applied (verified in `_stub-pattern.tsx`)

```diff
- "not-prose rounded-md bg-gradient-to-br from-muted/30 to-muted/60 p-6 text-center"
+ "not-prose rounded-md bg-sidebar-bg p-6 text-center"

- "ml-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary"
+ "ml-1 inline-flex items-center gap-1 rounded-full bg-accent-bg px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent"

- "font-semibold text-base mb-1"
+ "font-semibold text-base mb-1 text-text-primary"

- "text-sm text-muted-foreground max-w-md mx-auto"
+ "text-sm text-text-secondary max-w-md mx-auto"
```

All four translations match 07-CONTEXT.md D-7-11 and 07-RESEARCH.md §"Complete token translation table". `pnpm --filter @agenticapps/dashboard-spa test src/styles/tokenSourceOfTruth.test.ts` → 3/3 pass (no hex literals leaked into `src/help/widgets/**`).

## Migration Step 5 close (concrete stubs split out)

Source `_stub-pattern.tsx` (136 lines) had the primitive AT TOP plus 8 named `<Name>Stub()` functions BELOW. This plan splits them:

| Source export | New home | Renamed to |
|---|---|---|
| `WidgetStub`, `WidgetStubProps` | `_stub-pattern.tsx` (kept) | unchanged |
| `RepoTopologyMapStub` | `RepoTopologyMap.stub.tsx` | `default export RepoTopologyMap` |
| `WorkflowStateMachineStub` | `WorkflowStateMachine.stub.tsx` | `default export WorkflowStateMachine` |
| `GatePickerStub` | `GatePicker.stub.tsx` | `default export GatePicker` |
| `TraceVisualizerStub` | `TraceVisualizer.stub.tsx` | `default export TraceVisualizer` |
| `ScanReportPlaygroundStub` | `ScanReportPlayground.stub.tsx` | `default export ScanReportPlayground` |
| `ApplyConsentSimulatorStub` | `ApplyConsentSimulator.stub.tsx` | `default export ApplyConsentSimulator` |
| `MigrationDryRunStub` | `MigrationDryRun.stub.tsx` | `default export MigrationDryRun` |
| `SlashCommandCatalogStub` | `SlashCommandCatalog.stub.tsx` | `default export SlashCommandCatalog` |

Verified by grep: `grep -E "RepoTopologyMapStub|GatePickerStub" packages/spa/src/help/widgets/_stub-pattern.tsx` → exit 1 (no concrete stubs leaked).

## Test counts

- `pnpm --filter @agenticapps/dashboard-spa test src/help/widgets --run` → **Test Files 2 passed (2)**, **Tests 13 passed (13)** (5 primitive + 8 smoke)
- `pnpm --filter @agenticapps/dashboard-spa test src/help --run` → **3 files**, **16 tests** (3 mdx-smoke from Plan 07-01 + 13 from this plan)
- `pnpm --filter @agenticapps/dashboard-spa test --run` → **77 files**, **643 tests passed** (was 630 before this plan → +13)
- `pnpm --filter @agenticapps/dashboard-spa test src/styles/tokenSourceOfTruth.test.ts --run` → 3/3 pass (hex-literal scan widened to `src/help/**` by Plan 07-01 Task 6 still clean)

## Task Commits

Each task committed atomically (`--no-verify` per parallel-execution protocol — orchestrator runs hooks once after merge-back):

1. **Task 1 RED: WidgetStub primitive failing tests** — `21823af` (test) — 5 cases written against not-yet-existing `_stub-pattern.tsx`
2. **Task 1 GREEN: WidgetStub primitive implementation** — `c861b79` (feat) — primitive lands, all 5 cases pass
3. **Task 2: 8 widget stub default exports** — `ff03bd5` (feat) — 8 sibling files, ~10 LOC each, atomic commit
4. **Task 3: stubs smoke test (8 cases pass)** — `21d3b52` (test) — table-driven `it.each(STUBS)` smoke

Task 4 is verification-only — no commit, evidence captured in this SUMMARY.

_HEAD at plan close: `21d3b52` on `worktree-agent-a07e26cefa7fd50b3` (rebased onto `8314f57` per worktree-branch-check)._

## Files Created/Modified

**Created (11):**

- `packages/spa/src/help/widgets/_stub-pattern.tsx` — WidgetStub primitive + WidgetStubProps interface (warm-paper tokens, Sparkles badge, default emoji ✨)
- `packages/spa/src/help/widgets/_stub-pattern.test.tsx` — 5 unit tests for the primitive (title/description, emoji+aria, default emoji, badge, not-prose)
- `packages/spa/src/help/widgets/RepoTopologyMap.stub.tsx` — default export, 🗺️
- `packages/spa/src/help/widgets/WorkflowStateMachine.stub.tsx` — default export, 🔄
- `packages/spa/src/help/widgets/GatePicker.stub.tsx` — default export, 🚪
- `packages/spa/src/help/widgets/TraceVisualizer.stub.tsx` — default export, 📡
- `packages/spa/src/help/widgets/ScanReportPlayground.stub.tsx` — default export, 🔍
- `packages/spa/src/help/widgets/ApplyConsentSimulator.stub.tsx` — default export, ✅
- `packages/spa/src/help/widgets/MigrationDryRun.stub.tsx` — default export, 🔄
- `packages/spa/src/help/widgets/SlashCommandCatalog.stub.tsx` — default export, ⚡
- `packages/spa/src/help/widgets/__tests__/stubs-smoke.test.tsx` — table-driven smoke test, 8 it.each cases

**Modified (0):** This plan only creates files inside the previously-empty `packages/spa/src/help/widgets/` directory.

## Decisions Made

- **Migration Step 5 close (primitive file kept clean).** The v0 source had primitive + 8 concrete stubs in one 136-line file for review convenience. Production code splits them so each stub can be `React.lazy()`-imported individually (HelpWidget's dispatch table needs default exports). The primitive file now stays under 40 lines and is easy to audit for token compliance.
- **Default emoji ✨ chosen.** Matches the migration source; signals "v1.0 placeholder, real widget coming v1.2" without leaking the v1.2 emoji vocabulary into v1.0.
- **All stubs are default exports.** Required for `React.lazy()` in Plan 07-02's HelpWidget — `lazy(() => import('./widgets/RepoTopologyMap.stub'))` only works if the file has a `default` export.
- **`React.JSX.Element` return-type annotation on every component.** Matches the codebase convention (verified across `packages/spa/src/components/ui/**` and Phase 7-01 files); avoids implicit-any/inference warnings in TS strict.

## Deviations from Plan

**None — plan executed exactly as written.**

The plan-checker had pre-flagged this as a "lean and disjoint, parallel-safe with 07-02" plan with no blocking flags, and all 8 emojis + token translations + smoke-test pattern were verified against the migration source before execution started. Every task hit its `<verify><automated>` command on first try.

## Authentication Gates

None — this plan touches no auth surfaces. Pure file-creation work in a previously-empty directory.

## Issues Encountered

**Worktree base correction.** The worktree branch was checked out at `26e78c7` (an older commit, Phase 6 docs) while the prompt's `<base_commit>` block declared `EXPECTED_BASE=8314f57`. First action per the prompt's `<worktree_branch_check>` was to `git reset --hard 8314f57` since the working tree was clean. Confirmed by `git rev-parse HEAD` → `8314f57…`. No work was lost (nothing was on the worktree branch yet); execution proceeded from the correct base.

## Coverage Matrix

| Decision / Refinement | Task | Status |
|---|---|---|
| D-7-11 (warm-paper token translation table applied to WidgetStub) | T1 | ✓ |
| D-7-14 (ship all 8 stubs, full v1.0 + v1.1 backlog coverage) | T2 | ✓ |
| Migration Step 5 close (primitive file kept clean) | T1 | ✓ |
| Plan-check 07-03 emoji verification (8/8 canonical) | T2 | ✓ |
| R2 disjoint-set with Plan 07-02 (zero file overlap) | T1..T3 | ✓ |
| HELP-04 stub-side evidence | T2 | ✓ |
| Wave 1 smoke gate (table-driven 8-case) | T3 | ✓ |
| tokenSourceOfTruth invariant maintained (src/help/** scan) | T4 | ✓ |
| SPA typecheck + build + workspace-wide typecheck/lint | T4 | ✓ |

## Threat Flags

None. All threat dispositions in the plan's `<threat_model>` (T-07-03-01..04) were honoured:

- **T-07-03-01** (Tampering — stub strings): Accepted; all titles/descriptions hardcoded from migration source, no runtime mutation surface.
- **T-07-03-02** (Information Disclosure — "Coming v1.2" leak): Accepted; v1.2 roadmap is publicly documented in `.planning/ROADMAP.md`.
- **T-07-03-03** (DoS — 8 lazy imports): Accepted; each stub <1 KB compiled, total <10 KB.
- **T-07-03-04** (Tampering — hex literal slip): Mitigated; `tokenSourceOfTruth.test.ts` widened to `src/help/**` by Plan 07-01 Task 6, re-run at Task 4 with 3/3 pass.

No new security-relevant surface introduced — these are pure render-time UI placeholders with no network/storage/auth touch.

## Next Phase Readiness

**Plan 07-04 unblocked.** MDX content can now reference `<HelpWidget name="..." />` for any of:

- `RepoTopologyMap`, `WorkflowStateMachine`, `GatePicker`, `TraceVisualizer`, `ScanReportPlayground`, `ApplyConsentSimulator`, `MigrationDryRun`, `SlashCommandCatalog`

**Plan 07-05 unblocked.** Playwright's "widget stubs lazy-render" assertion can target the "Coming v1.2" badge — every stub renders WidgetStub which includes that badge sentinel.

**R2 disjoint-set check (post-merge).** After both worktrees merge back to `feat/help-docs-v1`, Plan 07-02's HelpWidget test (which mocks the stub paths) and this plan's smoke test (which imports them for real) should BOTH pass on the merged tip — proving the lazy-import contract aligns in practice. The verifier will run this check.

## Self-Check: PASSED

**Files exist (`ls -la packages/spa/src/help/widgets/`):**

- `_stub-pattern.tsx` ✓
- `_stub-pattern.test.tsx` ✓
- `RepoTopologyMap.stub.tsx` ✓
- `WorkflowStateMachine.stub.tsx` ✓
- `GatePicker.stub.tsx` ✓
- `TraceVisualizer.stub.tsx` ✓
- `ScanReportPlayground.stub.tsx` ✓
- `ApplyConsentSimulator.stub.tsx` ✓
- `MigrationDryRun.stub.tsx` ✓
- `SlashCommandCatalog.stub.tsx` ✓
- `__tests__/stubs-smoke.test.tsx` ✓
- `.planning/phases/07-help-docs-v1-0/07-03-SUMMARY.md` ✓ (this file)

**Commits exist (`git log --oneline HEAD ^8314f57`):**

- `21823af` test(07-03): RED WidgetStub primitive tests ✓
- `c861b79` feat(07-03): GREEN WidgetStub primitive ✓
- `ff03bd5` feat(07-03): 8 widget stub default exports ✓
- `21d3b52` test(07-03): stubs smoke (8 cases pass) ✓

**Preflight gates:**

- `pnpm --filter @agenticapps/dashboard-spa test src/help/widgets --run` → 13/13 pass ✓
- `pnpm --filter @agenticapps/dashboard-spa test src/styles/tokenSourceOfTruth.test.ts --run` → 3/3 pass ✓
- `pnpm --filter @agenticapps/dashboard-spa typecheck` → exit 0 ✓
- `pnpm --filter @agenticapps/dashboard-spa build` → exit 0 (built in 298ms) ✓
- `pnpm --filter @agenticapps/dashboard-spa test --run` → 77 files, 643 tests pass (+13 from this plan) ✓
- `pnpm -r typecheck` → exit 0 ✓
- `pnpm lint` → 0 errors, 52 pre-existing warnings (none from this plan's new files) ✓

---
*Phase: 07-help-docs-v1-0*
*Plan: 03 — Wave 1 widget stubs*
*Completed: 2026-05-11*
