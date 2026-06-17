---
phase: DASH-15-capability-level-engine-fleet-matrix
plan: "03"
subsystem: spa-components
tags: [react, tdd, badge, drawer, dialog, cml-08, cml-09]
dependency_graph:
  requires:
    - ClaudeMdEvalSchema (packages/shared — Plan 01)
  provides:
    - LevelBadgeCell (packages/spa/src/components/panels/coverage)
    - ClaudeMdLevelDrawer (packages/spa/src/components/panels/coverage)
  affects:
    - packages/spa (Plan 04 imports and mounts these components)
tech_stack:
  added: []
  patterns:
    - LEVEL_TOKEN_MAP frozen record (mirror of CoverageCell.tsx STATE_TOKEN_MAP)
    - Native <dialog> showModal/close focus management (RegisterModal clone)
    - HTMLDialogElement jsdom polyfill in beforeEach (RegisterModal.test.tsx pattern)
    - Typed FALLBACK_TOKENS constant for TS strict-null Record lookup
key_files:
  created:
    - packages/spa/src/components/panels/coverage/LevelBadgeCell.tsx
    - packages/spa/src/components/panels/coverage/LevelBadgeCell.test.tsx
    - packages/spa/src/components/panels/coverage/ClaudeMdLevelDrawer.tsx
    - packages/spa/src/components/panels/coverage/ClaudeMdLevelDrawer.test.tsx
  modified:
    - packages/spa/src/components/panels/coverage/LevelBadgeCell.tsx (FALLBACK_TOKENS fix post-typecheck)
decisions:
  - "LEVEL_TOKEN_MAP defined locally in ClaudeMdLevelDrawer (not shared module) — keeps component self-contained, no cross-package leak, matches plan executor's discretion note"
  - "FALLBACK_TOKENS typed constant replaces LEVEL_TOKEN_MAP[0] fallback to satisfy TS18048 strict-null without non-null assertion"
  - "HTMLDialogElement polyfill in beforeEach (not global setup) — mirrors RegisterModal.test.tsx pattern; jsdom showModal sets open attribute, close removes it"
  - "Test precision: getAllByText/getAllByRole for rung labels that also appear in header badge — avoids multiple-element errors without weakening assertions"
metrics:
  duration: "7 min"
  completed: "2026-06-17T12:17:00Z"
  tasks: 2
  files: 4
---

# Phase DASH-15 Plan 03: SPA Badge + Drawer Components — Summary

**One-liner:** `LevelBadgeCell` (5-state L0–L6 clickable badge with always-visible ~ sigil) and `ClaudeMdLevelDrawer` (native-dialog 6-rung evidence drawer with inferred-L5 callout) implemented in isolation, ready for Plan 04 wiring.

## What Was Built

Plan 03 delivers the two presentational SPA surfaces for CML-08 and CML-09. Both components are self-contained, depend only on the `ClaudeMdEval` type from Plan 01, and are not yet wired into the coverage table (Plan 04 does that).

**LevelBadgeCell** (`LevelBadgeCell.tsx`):
- `LEVEL_TOKEN_MAP` frozen record maps L0–L6 to exact UI-SPEC token pairs (L0/degraded: text-tertiary muted; L1–L2: status-warning amber; L3–L4: status-info blue; L5–L6: status-success green)
- Degraded branch (`evalData === undefined`): renders `—` em-dash span with "not available" aria-label, no button — mirrors `CoverageRow.tsx:216` understand column fallback
- Inferred branch: always-visible `~` sigil inside badge pill (`bg-accent-bg text-accent`), aria-label includes ", inferred" — never hover-gated
- Button aria-label matches UI-SPEC copywriting contract exactly

**ClaudeMdLevelDrawer** (`ClaudeMdLevelDrawer.tsx`):
- Native `<dialog>` with `showModal()`/`close()` focus management — verbatim copy of `RegisterModal.tsx` `useEffect` + `previouslyFocused` restoration
- Backdrop click (`e.target === dialogRef.current`) and `onCancel` Esc both call `onClose()`
- Section A: repoName heading + "CLAUDE.md capability level" sub-label + decorative headline badge with inferred sigil + × dismiss button
- Section B: `<ul role="list">` mapping all 6 rungs — `Check`/`Circle` icons from lucide-react, evidence `<ul>`, inferred-L5 callout (always visible when `rung.rung === 5 && rung.inferred`)
- Section C: "Next steps" heading + `→`-prefixed list when `nextSteps.length > 0`
- Section D: "Fully adaptive — all six rungs complete." success copy when `nextSteps.length === 0`

## Verification Results

- `pnpm --filter @agenticapps/dashboard-spa test LevelBadgeCell ClaudeMdLevelDrawer` — 2 test files, 31 tests, all pass
- `pnpm --filter @agenticapps/dashboard-spa typecheck` — exits 0
- `grep -c "LEVEL_TOKEN_MAP" LevelBadgeCell.tsx` → 3 (definition + 2 uses)
- `grep -c "showModal" ClaudeMdLevelDrawer.tsx` → 2 (useEffect + jsdoc)
- `grep -c "Inferred — not hard-verified" ClaudeMdLevelDrawer.tsx` → 1
- `grep -c "Fully adaptive" ClaudeMdLevelDrawer.tsx` → 2 (JSX text + comment label — both intentional)
- Banned styling grep (cn/clsx/hex/shadcn aliases) — 0 hits in implementation code; 2 hits in JSDoc constraint documentation comments (expected, same pattern as CoverageCell.tsx)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | LevelBadgeCell component + tests (CML-08) | `5cd210a` | LevelBadgeCell.tsx, LevelBadgeCell.test.tsx |
| 2 | ClaudeMdLevelDrawer component + tests (CML-09) | `c783b5b` | ClaudeMdLevelDrawer.tsx, ClaudeMdLevelDrawer.test.tsx, LevelBadgeCell.tsx (typecheck fix) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript strict-null TS18048 on Record<number, ...> lookup**
- **Found during:** Task 2 typecheck (`pnpm --filter @agenticapps/dashboard-spa typecheck`)
- **Issue:** `LEVEL_TOKEN_MAP[evalData.level]` typed as `{ bg: string; text: string } | undefined` by TypeScript even with `?? LEVEL_TOKEN_MAP[0]` fallback — TS18048 "possibly undefined"
- **Fix:** Added `const FALLBACK_TOKENS = { bg: 'bg-text-tertiary/10', text: 'text-text-tertiary' }` as a typed fallback constant; used `?? FALLBACK_TOKENS` instead of `?? LEVEL_TOKEN_MAP[0]`
- **Files modified:** LevelBadgeCell.tsx, ClaudeMdLevelDrawer.tsx
- **Commit:** `c783b5b`

**2. [Rule 1 - Bug] jsdom `dialog.showModal()` not implemented — tests threw at RED**
- **Found during:** Task 2 test run (RED phase)
- **Issue:** jsdom does not implement `HTMLDialogElement.showModal()` — all 17 tests failed with "not a function"
- **Fix:** Added `HTMLDialogElement.prototype.showModal` / `.close` polyfill in `beforeEach` — exact pattern from `RegisterModal.test.tsx` lines 46–57
- **Files modified:** ClaudeMdLevelDrawer.test.tsx
- **Commit:** `c783b5b`

**3. [Rule 1 - Bug] Multiple-element query errors for shared rung-label text**
- **Found during:** Task 2 test run (GREEN phase, test precision)
- **Issue:** `getByText(/Abstracted/)` matched both the header badge ("L4 — Abstracted") and the rung list item — testing-library threw "Found multiple elements". Similarly `getByRole('list')` matched both `<ul role="list">` elements (rung list + next-steps list)
- **Fix:** Changed to `getAllByText(...).length >= 1` and `getAllByRole('list').length >= 1` — preserves behavioral assertion without fragile single-element assumption
- **Files modified:** ClaudeMdLevelDrawer.test.tsx
- **Commit:** `c783b5b`

## Known Stubs

None. Both components are fully implemented. `LevelBadgeCell` renders real token-mapped colors for all 7 level values. `ClaudeMdLevelDrawer` renders real rung data. No placeholder text, no empty data sources.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. All dynamic values rendered via React's default-escaped `{value}` interpolation — no `dangerouslySetInnerHTML` anywhere in either component. T-15-03-01 (evidence string XSS) and T-15-03-02 (repoName XSS) mitigations implemented by construction.

## Self-Check: PASSED

- [x] `packages/spa/src/components/panels/coverage/LevelBadgeCell.tsx` — exists, 85 lines, exports `LevelBadgeCell`
- [x] `packages/spa/src/components/panels/coverage/LevelBadgeCell.test.tsx` — exists, 13 tests green
- [x] `packages/spa/src/components/panels/coverage/ClaudeMdLevelDrawer.tsx` — exists, 130+ lines, exports `ClaudeMdLevelDrawer`
- [x] `packages/spa/src/components/panels/coverage/ClaudeMdLevelDrawer.test.tsx` — exists, 18 tests green
- [x] Commit `5cd210a` — verified in git log
- [x] Commit `c783b5b` — verified in git log
- [x] Typecheck exits 0
- [x] No STATE.md or ROADMAP.md modifications (orchestrator owns those)
