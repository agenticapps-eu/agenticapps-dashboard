---
phase: 04-single-project-view-discipline-phase-progress
plan: "05"
subsystem: spa-discipline-panels
tags:
  - react-components
  - tdd
  - spa
  - phase-4
  - discipline
dependency_graph:
  requires:
    - 04-04-SUMMARY (useCommitment, useObservations, useDiscipline hooks + SingleProjectView shell)
    - 04-01-SUMMARY (CommitmentBlockResponse, ObservationsRecentResponse, DisciplineResponse schemas)
    - packages/spa/src/components/CodeBlock.tsx (reused for install-hint in HookFirings + RationalizationFires)
  provides:
    - formatRelativeTime (pure utility: ISO → '30s ago' / '5m ago' / '2h ago' / '3d ago')
    - PanelContainer (shared section wrapper, aria-labelledby, stale pill, unreachable line)
    - CommitmentBlock (DISC-01 panel — verbatim commitment markdown + source filename)
    - HookFirings (DISC-02 + DISC-04 panel — hook event rows or install-hint)
    - RationalizationFires (DISC-03 panel — rationalization table rows with fire counts)
    - SingleProjectView updated: discipline column slots replaced with real panel components
  affects:
    - Plan 06 (Phase Progress panels) — replaces data-slot="phase-progress" etc. divs;
      must rebase on this plan's SingleProjectView changes
tech_stack:
  added: []
  patterns:
    - InlineDrift helper co-located in each panel file (3 copies in Plan 05 — Phase 6 polish: extract)
    - PanelContainer makes each panel a role="region" via aria-labelledby (accessible + testable)
    - Post-vi.mock import order generates import/order warnings (accepted project pattern — 0 errors)
    - formatRelativeTime uses opts.now injection for deterministic tests (no vi.useFakeTimers needed)
key_files:
  created:
    - packages/spa/src/lib/relativeTime.ts
    - packages/spa/src/lib/relativeTime.test.ts
    - packages/spa/src/components/panels/PanelContainer.tsx
    - packages/spa/src/components/panels/PanelContainer.test.tsx
    - packages/spa/src/components/panels/CommitmentBlock.tsx
    - packages/spa/src/components/panels/CommitmentBlock.test.tsx
    - packages/spa/src/components/panels/HookFirings.tsx
    - packages/spa/src/components/panels/HookFirings.test.tsx
    - packages/spa/src/components/panels/RationalizationFires.tsx
    - packages/spa/src/components/panels/RationalizationFires.test.tsx
  modified:
    - packages/spa/src/components/SingleProjectView.tsx (discipline-column slots replaced)
    - packages/spa/src/components/SingleProjectView.test.tsx (SV3 updated, projectQueries mock added)
decisions:
  - "InlineDrift co-located in 3 panel files (not extracted to shared) — plan calls for deliberate duplication; Phase 6 polish extracts it"
  - "--warning-surface token confirmed present in global.css (both light + dark themes) — no fallback needed"
  - "formatRelativeTime opts.now injection for determinism — avoids vi.useFakeTimers complexity"
  - "DISC-04 install command 'claude skill install meta-observer' is placeholder (D-4-15 deferred to Phase 6)"
  - "WORKFLOW_INSTALL_CMD 'claude skill install agenticapps-workflow' is placeholder (D-4-15 deferred to Phase 6)"
  - "0 fires rendered as '0 fires' not hidden — D-4-14: zero fires is a positive signal"
  - "fires === 1 renders '1 fire' (singular) for readability"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-06T10:32:00Z"
  tasks_completed: 3
  files_created: 10
  files_modified: 2
---

# Phase 04 Plan 05: Discipline-Column Panels — Summary

Three discipline-column SPA panels (CommitmentBlock, HookFirings, RationalizationFires) implemented with full TDD coverage, backed by a shared PanelContainer primitive and a pure formatRelativeTime utility. All 15 distinct render paths (5 states × 3 panels) are covered by tests. The SingleProjectView discipline-column placeholder slots are replaced by real components. Phase-progress-column slots remain as placeholders for Plan 06.

## Panel Render States (5 × 3 = 15 paths)

| Panel | loading | data | empty | install-hint | drift | unreachable |
|-------|---------|------|-------|--------------|-------|-------------|
| CommitmentBlock | Loading... | `<pre>` + Source line | "No commitment block found..." | — | InlineDrift | unreachable=true |
| HookFirings | Loading... | row list | "No hook firings yet..." | CodeBlock (DISC-04) | InlineDrift | unreachable=true |
| RationalizationFires | Loading... | row table (zeros shown) | "No rationalization rows..." | CodeBlock (placeholder cmd) | InlineDrift | unreachable=true |

Note: CommitmentBlock has no install-hint state (the endpoint always returns data or null).

## Empty-State Copy (verbatim from UI-SPEC Copywriting Contract)

| Panel | Empty-state copy |
|-------|-----------------|
| CommitmentBlock | `No commitment block found. The latest session may not have emitted one yet.` |
| HookFirings (skill missing) | `The meta-observer skill is not installed in this project.` |
| HookFirings (no events) | `No hook firings yet — try running /review or /cso.` |
| RationalizationFires (skill missing) | `agentic-apps-workflow skill not installed in this project.` |
| RationalizationFires (empty table) | `No rationalization rows found in SKILL.md.` |

All copy matches UI-SPEC verbatim — confirmed by test assertions.

## DISC-04 Install Hint

HookFirings renders install hint when `skillInstalled: false`:
- Copy: `The meta-observer skill is not installed in this project.`
- Command: `claude skill install meta-observer` (placeholder — Phase 6 confirms canonical invocation per D-4-15)
- Rendered via existing `<CodeBlock command={...} copyLabel="Copy install command" />` (Phase 3 re-use)

RationalizationFires install hint:
- Copy: `agentic-apps-workflow skill not installed in this project.`
- Command: `claude skill install agenticapps-workflow` (placeholder — Phase 6 confirms per D-4-15)

## InlineDrift Duplication (intentional)

The `InlineDrift` helper function is co-located in all 3 panel files. This is deliberate — the plan explicitly called for duplication to avoid creating a shared module before Plan 06 lands. There are now 3 identical copies:
1. `CommitmentBlock.tsx` — original
2. `HookFirings.tsx` — duplicate
3. `RationalizationFires.tsx` — duplicate

**Phase 6 polish todo:** Extract `InlineDrift` to `packages/spa/src/components/panels/InlineDrift.tsx` and update all 8 panel files (Plans 05 + 06).

## TDD Commit Pairs

| Task | RED commit | GREEN commit |
|------|-----------|-------------|
| Task 1 (formatRelativeTime + PanelContainer) | `46ad241` test(04-05): add failing tests for formatRelativeTime + PanelContainer (RED) | `691a841` feat(04-05): implement formatRelativeTime + PanelContainer (GREEN) |
| Task 2 (CommitmentBlock + HookFirings + RationalizationFires) | `97fbad4` test(04-05): add failing tests for CommitmentBlock + HookFirings + RationalizationFires (RED) | `6c43b04` feat(04-05): implement Discipline-column panels (GREEN) |
| Task 3 (SingleProjectView mount — not TDD) | n/a | `b05ee0d` feat(04-05): mount Discipline-column panels in SingleProjectView |

## SingleProjectView Changes

Before (Plan 04):
```tsx
<div data-slot="commitment" />
<div data-slot="hook-firings" />
<div data-slot="rationalization-fires" />
```

After (Plan 05):
```tsx
<CommitmentBlock projectId={projectId} />
<HookFirings projectId={projectId} />
<RationalizationFires projectId={projectId} />
```

The 5 phase-progress-column slots remain as `data-slot` placeholder divs for Plan 06:
`phase-progress`, `execution-timeline`, `review-status`, `security-status`, `verification-status`.

## Test Count

| Test file | Tests |
|-----------|-------|
| relativeTime.test.ts | 7 (RT1–RT7) |
| PanelContainer.test.tsx | 7 (PC1–PC7) |
| CommitmentBlock.test.tsx | 7 (CB1–CB7) |
| HookFirings.test.tsx | 7 (HF1–HF7) |
| RationalizationFires.test.tsx | 8 (RF1–RF6 + RF6b + RF6c) |
| SingleProjectView.test.tsx | 7 (SV1–SV7, SV3 updated) |
| **Total new tests** | **36 new tests** |

Total SPA test suite: 376 tests / 44 files (was 340 / 39 before this plan).

## Known Stubs

None that block plan goals. The DISC-04 install commands (`claude skill install meta-observer` and `claude skill install agenticapps-workflow`) are intentional placeholders per D-4-15. They are explicitly documented with source comments. Phase 6 confirms the canonical commands. No data is hardcoded empty that flows to UI rendering in a way that blocks DISC-01/02/03/04.

## Threat Flags

None. All threats in the plan's `<threat_model>` are mitigated:
- T-04-05-01/02/03: React text interpolation auto-escapes hostile content in `<pre>`, skill/hook fields, and rationalization labels — no XSS surface.
- T-04-05-04: Placeholder install commands are public CLI invocations — no security exposure.
- T-04-05-05/06/07: Daemon-side limits, render-only list with ts-based keys, clipboard write — all accepted as-is.

## Self-Check: PASSED

- `packages/spa/src/lib/relativeTime.ts` — FOUND
- `packages/spa/src/lib/relativeTime.test.ts` — FOUND (7 tests)
- `packages/spa/src/components/panels/PanelContainer.tsx` — FOUND
- `packages/spa/src/components/panels/PanelContainer.test.tsx` — FOUND (7 tests)
- `packages/spa/src/components/panels/CommitmentBlock.tsx` — FOUND
- `packages/spa/src/components/panels/CommitmentBlock.test.tsx` — FOUND (7 tests)
- `packages/spa/src/components/panels/HookFirings.tsx` — FOUND
- `packages/spa/src/components/panels/HookFirings.test.tsx` — FOUND (7 tests)
- `packages/spa/src/components/panels/RationalizationFires.tsx` — FOUND
- `packages/spa/src/components/panels/RationalizationFires.test.tsx` — FOUND (8 tests)
- `packages/spa/src/components/SingleProjectView.tsx` updated — FOUND
- `packages/spa/src/components/SingleProjectView.test.tsx` updated — FOUND (7 tests)
- Commits 46ad241, 691a841, 97fbad4, 6c43b04, b05ee0d — all confirmed in git log
- `pnpm --filter @agenticapps/dashboard-spa test --run` exits 0 (376 tests, 44 files)
- `pnpm -r typecheck` exits 0
- `pnpm -r build` exits 0
- `pnpm lint` exits 0 errors (7 warnings — 3 new import/order on post-mock imports, matching accepted project pattern)
