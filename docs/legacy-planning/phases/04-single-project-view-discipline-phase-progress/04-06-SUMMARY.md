---
phase: 04-single-project-view-discipline-phase-progress
plan: "06"
subsystem: spa-phase-progress-panels
tags:
  - react-components
  - tdd
  - spa
  - phase-4
  - phase-progress
dependency_graph:
  requires:
    - 04-05-SUMMARY (PanelContainer, formatRelativeTime, CommitmentBlock/HookFirings/RationalizationFires with local InlineDrift)
    - 04-04-SUMMARY (usePhaseProgress, useSecurity hooks; SingleProjectView shell with 5 data-slot placeholders)
    - 04-01-SUMMARY (PhaseProgressResponseSchema, SecurityResponseSchema, ReviewFindingCountsSchema)
  provides:
    - InlineDrift (shared component — extracted from 3 local Plan 05 copies; used by all 8 Phase 4 panels)
    - PhaseProgress (PHASE-01 — file-by-file checklist)
    - ExecutionTimeline (PHASE-02 — TDD RED/GREEN commit pairs grouped per task)
    - ReviewStatus (PHASE-03 — Stage 1/2 severity glyph rows)
    - SecurityStatus (PHASE-04 — /cso audit + Database Sentinel content)
    - VerificationStatus (PHASE-05 — must-haves count vs evidence rows)
    - SingleProjectView updated — all 8 panel slots replaced with real components
    - projects-detail-e2e.test.tsx — full route render asserting ROADMAP criteria 1-5
  affects:
    - Phase 5 (Skills + Health panels) — grid ready to widen to grid-cols-[1fr_1.5fr_1fr]
tech_stack:
  added: []
  patterns:
    - Shared InlineDrift component (panels/InlineDrift.tsx) — all 8 panels use shared import, no local duplication
    - usePhaseProgress deduplicated by TanStack Query — 4 panels share one 5s query
    - useSecurity separate cache key — SecurityStatus uses dedicated route per D-4-01
    - Severity glyphs as emoji literals (🔴🟠🟡⚪) with aria-label on parent container
    - sr-only RED:/GREEN: prefix on ExecutionTimeline commit rows for screen readers
key_files:
  created:
    - packages/spa/src/components/panels/InlineDrift.tsx
    - packages/spa/src/components/panels/InlineDrift.test.tsx
    - packages/spa/src/components/panels/PhaseProgress.tsx
    - packages/spa/src/components/panels/PhaseProgress.test.tsx
    - packages/spa/src/components/panels/ExecutionTimeline.tsx
    - packages/spa/src/components/panels/ExecutionTimeline.test.tsx
    - packages/spa/src/components/panels/ReviewStatus.tsx
    - packages/spa/src/components/panels/ReviewStatus.test.tsx
    - packages/spa/src/components/panels/SecurityStatus.tsx
    - packages/spa/src/components/panels/SecurityStatus.test.tsx
    - packages/spa/src/components/panels/VerificationStatus.tsx
    - packages/spa/src/components/panels/VerificationStatus.test.tsx
    - packages/spa/src/__tests__/projects-detail-e2e.test.tsx
  modified:
    - packages/spa/src/components/panels/CommitmentBlock.tsx (local InlineDrift removed, shared import added)
    - packages/spa/src/components/panels/HookFirings.tsx (local InlineDrift removed, shared import added)
    - packages/spa/src/components/panels/RationalizationFires.tsx (local InlineDrift removed, shared import added)
    - packages/spa/src/components/SingleProjectView.tsx (5 data-slot divs replaced with real panels)
    - packages/spa/src/components/SingleProjectView.test.tsx (SV4 updated for real panels)
decisions:
  - "SV4 test uses heading queries (not region) — phase-progress-column aria-label='Phase Progress' creates region name collision with PhaseProgress panel; headings are unambiguous"
  - "InlineDrift extracted NOW (not Phase 6 polish) — Plan 06 uses the shared component for all 5 new panels; deferring would require immediate re-extraction anyway"
  - "SecurityStatus uses useSecurity (not usePhaseProgress) — D-4-01 separate route per cache independence"
  - "e2e test uses mocked apiFetch (not MSW) — matches e2e-pair-flow.test.tsx established pattern"
metrics:
  duration: "~32 minutes"
  completed: "2026-05-06T11:12:00Z"
  tasks_completed: 4
  files_created: 13
  files_modified: 5
---

# Phase 04 Plan 06: Phase Progress Panels + InlineDrift Extraction — Summary

Five Phase Progress column panels (PhaseProgress, ExecutionTimeline, ReviewStatus, SecurityStatus, VerificationStatus) implemented with full TDD coverage, backed by a shared InlineDrift component extracted from the 3 Plan 05 copies. All 8 Phase 4 panels now use the shared component. SingleProjectView's 5 placeholder slots are replaced with real panel components. An end-to-end route test proves all 8 panels mount and asserts all 5 ROADMAP success criteria.

## Panel Render States (5 × 5 + 3 extracted = 25 new + 3 updated paths)

| Panel | loading | data | empty | drift | unreachable |
|-------|---------|------|-------|-------|-------------|
| PhaseProgress | Loading... | file checklist | "No phase work yet..." | InlineDrift | unreachable=true |
| ExecutionTimeline | Loading... | task+commit groups | "No TDD commits yet..." | InlineDrift | unreachable=true |
| ReviewStatus | Loading... | Stage 1/2 rows | "No review run yet..." | InlineDrift | unreachable=true |
| SecurityStatus | Loading... | /cso + DB Sentinel | "No /cso audit yet..." | InlineDrift | unreachable=true |
| VerificationStatus | Loading... | summary + item rows | "No verification run yet..." | InlineDrift | unreachable=true |

All 3 Plan 05 panels (CommitmentBlock, HookFirings, RationalizationFires) now use the shared InlineDrift instead of local copies.

## Empty-State Copy (verbatim from UI-SPEC Copywriting Contract)

| Panel | Empty-state copy |
|-------|-----------------|
| PhaseProgress | `No phase work yet. Run /gsd-discuss-phase or /gsd-plan-phase to start.` |
| ExecutionTimeline | `No TDD commits yet for this phase.` |
| ReviewStatus | `No review run yet — try /review or /gsd-code-review.` |
| SecurityStatus | `No /cso audit yet for this phase.` |
| VerificationStatus | `No verification run yet — try /gsd-verify-work.` |

All copy matches UI-SPEC verbatim — confirmed by test assertions.

## Shared InlineDrift Extraction

The `InlineDrift` helper previously co-located in 3 Plan 05 panel files is now a shared exported component at `packages/spa/src/components/panels/InlineDrift.tsx`.

Extraction approach:
1. `test(04-06)`: add failing tests for shared InlineDrift (RED)
2. `feat(04-06)`: extract shared InlineDrift (GREEN) — new file
3. `refactor(04-06)`: replace local InlineDrift with shared component — 3 Plan 05 panels updated, AlertTriangle import removed from each, `import { InlineDrift } from './InlineDrift.js'` added

After refactor:
- `grep -c "function InlineDrift" CommitmentBlock.tsx` = 0
- `grep -c "function InlineDrift" HookFirings.tsx` = 0
- `grep -c "function InlineDrift" RationalizationFires.tsx` = 0
- All Plan 05 panel tests still pass (behavior-preserving refactor)

## TDD Commit Pairs

| Task | RED commit | GREEN commit | Notes |
|------|-----------|-------------|-------|
| Task 1 (InlineDrift) | `d93b932` test(04-06): add failing tests for shared InlineDrift (RED) | `0ea37c5` feat(04-06): extract shared InlineDrift (GREEN) | + `40f930f` refactor(04-06): replace local InlineDrift |
| Task 2 (PhaseProgress + ExecutionTimeline + ReviewStatus) | `81af1ac` test(04-06): add failing tests for PhaseProgress + ExecutionTimeline + ReviewStatus (RED) | `da13318` feat(04-06): implement PhaseProgress + ExecutionTimeline + ReviewStatus (GREEN) | |
| Task 3 (SecurityStatus + VerificationStatus) | `e46603a` test(04-06): add failing tests for SecurityStatus + VerificationStatus (RED) | `76e0c49` feat(04-06): implement SecurityStatus + VerificationStatus (GREEN) | |
| Task 4 (mount + e2e — not TDD) | n/a | `8abf657` feat(04-06): mount Phase Progress panels in SingleProjectView + e2e route test | |

## ROADMAP Success Criteria → E2E Test Mapping

| ROADMAP Criterion | E2E Test | Assertion |
|-------------------|----------|-----------|
| 1: /projects/{id} renders header + left + center columns | E2E1 | `findByRole('navigation', { name: 'Project breadcrumb' })` |
| 2: CommitmentBlock surfaces latest `## Workflow commitment` block | E2E3 | `getByText(/Follow TDD discipline/)` |
| 3: ExecutionTimeline parses test(RED)/feat(GREEN) pairs per task | E2E4 | `getByText(/Task 04-01/)` + commit subject assertions |
| 4: ReviewStatus parses `<finding severity="...">` by severity | E2E5 | Stage 1 heading + `🟡` + `⚪` glyph assertions |
| 5: VerificationStatus shows must_haves count vs evidence count | E2E6 | `getByText('7 / 9 must-haves evidenced')` |

## Cross-Project Leakage Guard (E2E7)

Test E2E7 mounts at `/projects/acme` and waits for query resolution, then asserts:
- `queryClient.getQueryData(['commitment', 'acme'])` is defined
- `queryClient.getQueryData(['commitment', 'beta'])` is undefined
- `queryClient.getQueryData(['phase-progress', 'beta'])` is undefined

Result: PASSED — TanStack Query cache is keyed by projectId per D-4-01 / T-04-04-01.

## SingleProjectView Changes

Before (Plan 05 — 5 data-slot placeholders):
```tsx
<div data-slot="phase-progress" />
<div data-slot="execution-timeline" />
<div data-slot="review-status" />
<div data-slot="security-status" />
<div data-slot="verification-status" />
```

After (Plan 06 — real panel components):
```tsx
<PhaseProgress projectId={projectId} />
<ExecutionTimeline projectId={projectId} />
<ReviewStatus projectId={projectId} />
<SecurityStatus projectId={projectId} />
<VerificationStatus projectId={projectId} />
```

No `data-slot` attributes remain in SingleProjectView.tsx.

## Test Count

| Test file | Tests |
|-----------|-------|
| InlineDrift.test.tsx | 4 (ID1–ID4) |
| PhaseProgress.test.tsx | 9 (PP1–PP6 + loading/drift/error) |
| ExecutionTimeline.test.tsx | 9 (ET1–ET6 + loading/drift/error) |
| ReviewStatus.test.tsx | 10 (RS1–RS7 + loading/drift/error) |
| SecurityStatus.test.tsx | 9 (SS1–SS5 + loading/drift/error) |
| VerificationStatus.test.tsx | 9 (VS1–VS5 + loading/drift/error) |
| projects-detail-e2e.test.tsx | 7 (E2E1–E2E7) |
| SingleProjectView.test.tsx | 7 (SV1–SV7 — SV4 updated) |
| **Total new tests** | **57 new tests** |

Total SPA test suite: 433 tests / 51 files (was 376 / 44 before this plan — 57 new tests).

## Phase 4 Ship Checklist

- [x] All 6 plans land (Plans 01–06 complete)
- [x] Full workspace test green: `pnpm -r test` — 433 SPA + 304 agent + 82 shared (819 total)
- [x] Typecheck green: `pnpm -r typecheck` exits 0
- [x] Build green: `pnpm -r build` exits 0
- [x] Lint green: `pnpm lint` exits 0 errors (13 warnings — all import/order, accepted project pattern)
- [ ] /review (Stage 1) ran — post-phase orchestrator step
- [ ] superpowers:requesting-code-review (Stage 2) ran — post-phase orchestrator step
- [ ] /cso ran (5 new HTTP read route surfaces added) — post-phase orchestrator step
- [ ] /qa ran (dev server smoke) — post-phase orchestrator step
- [ ] HUMAN-UAT.md created and items 1-7 from RESEARCH §UAT acknowledged

## Phase 5 Prerequisites

Phase 5 (Skills + Health column) prerequisites confirmed:
- `SingleProjectView.tsx` grid uses `grid-cols-[1fr_1.5fr]` — Phase 5 changes one class to `grid-cols-[1fr_1.5fr_1fr]` and inserts right-column components
- All 8 panels and shared `PanelContainer` + `InlineDrift` are reusable primitives for Phase 5 panels
- `usePhaseProgress`, `useSecurity` hooks in `projectQueries.ts` — Phase 5 adds `useSkillHealth`, `useAgentLinter` hooks to the same file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SV4 test used `getByRole('region', { name: 'Phase Progress' })` which matched 2 elements**
- **Found during:** Running SingleProjectView.test.tsx after updating SV4
- **Issue:** `<section aria-label="Phase Progress">` (the column) creates a region named "Phase Progress" that conflicts with the PhaseProgress panel's `aria-labelledby` region
- **Fix:** Changed SV4 assertions to use `getByRole('heading', { level: 2, name: '...' })` — unambiguous since each panel has exactly one h2
- **Files modified:** `packages/spa/src/components/SingleProjectView.test.tsx`

## Known Stubs

None that block plan goals. The 5 phase-progress panels render real data from the daemon. All empty states are intentional and match UI-SPEC copy verbatim.

## Threat Flags

None. All threats in the plan's `<threat_model>` are mitigated:
- T-04-06-01: React text interpolation in `<pre>` auto-escapes HTML — no XSS surface.
- T-04-06-02: Commit subjects rendered as React text children — auto-escaped.
- T-04-06-03: E2E7 asserts independent cache entries per projectId — cross-project leakage prevented.
- T-04-06-04/05: Accepted (no virtualisation needed — daemon bounds entries).
- T-04-06-06: Plan 05 panel tests run after InlineDrift refactor — all pass (behavior-preserving).
- T-04-06-07: document.title is browser-local — no network exposure.

## Self-Check: PASSED

Files created — all FOUND:
- `packages/spa/src/components/panels/InlineDrift.tsx` — FOUND
- `packages/spa/src/components/panels/InlineDrift.test.tsx` — FOUND (4 tests)
- `packages/spa/src/components/panels/PhaseProgress.tsx` — FOUND
- `packages/spa/src/components/panels/PhaseProgress.test.tsx` — FOUND (9 tests)
- `packages/spa/src/components/panels/ExecutionTimeline.tsx` — FOUND
- `packages/spa/src/components/panels/ExecutionTimeline.test.tsx` — FOUND (9 tests)
- `packages/spa/src/components/panels/ReviewStatus.tsx` — FOUND
- `packages/spa/src/components/panels/ReviewStatus.test.tsx` — FOUND (10 tests)
- `packages/spa/src/components/panels/SecurityStatus.tsx` — FOUND
- `packages/spa/src/components/panels/SecurityStatus.test.tsx` — FOUND (9 tests)
- `packages/spa/src/components/panels/VerificationStatus.tsx` — FOUND
- `packages/spa/src/components/panels/VerificationStatus.test.tsx` — FOUND (9 tests)
- `packages/spa/src/__tests__/projects-detail-e2e.test.tsx` — FOUND (7 tests)
- `packages/spa/src/components/SingleProjectView.tsx` updated — FOUND
- `packages/spa/src/components/SingleProjectView.test.tsx` updated — FOUND (7 tests)
- Commits d93b932, 0ea37c5, 40f930f, 81af1ac, da13318, e46603a, 76e0c49, 8abf657 — all confirmed in git log
- `pnpm --filter @agenticapps/dashboard-spa test --run` exits 0 (433 tests, 51 files)
- `pnpm -r typecheck` exits 0
- `pnpm -r build` exits 0
- `pnpm lint` exits 0 errors (13 warnings — all import/order, accepted project pattern)
- `grep -c "function InlineDrift" CommitmentBlock.tsx` = 0 — CONFIRMED
- `grep -c "function InlineDrift" HookFirings.tsx` = 0 — CONFIRMED
- `grep -c "function InlineDrift" RationalizationFires.tsx` = 0 — CONFIRMED
- `grep -c "data-slot=" SingleProjectView.tsx` = 0 — CONFIRMED (all 8 slots replaced)
