---
phase: 04-single-project-view-discipline-phase-progress
fixed_at: 2026-05-06T19:30:00Z
review_path: .planning/phases/04-single-project-view-discipline-phase-progress/04-REVIEW.md
iteration: 2
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-05-06T19:30:00Z
**Source review:** `.planning/phases/04-single-project-view-discipline-phase-progress/04-REVIEW.md`
**Iteration:** 2 (cumulative — folds in Iteration 1 results)

**Summary:**
- Findings in scope: 7 (3 warnings + 4 info)
- Fixed: 7 (3 already fixed in Iteration 1; 4 fixed in this Iteration 2 pass)
- Skipped: 0

## Fixed Issues

### WR-01: Orphaned SUMMARY files silently omitted from phase checklist (already_fixed)

**Files modified:** `packages/agent/src/lib/phaseDetail.ts`
**Commit:** `adbfa44` (Iteration 1)
**Status:** already_fixed
**Applied fix:** After the existing plan loop in `parsePhaseChecklist`, appended a second loop that pushes any `SUMMARY` files that were not already added by their paired `PLAN`. This ensures an orphaned `NN-NN-SUMMARY.md` (e.g. when its plan file was deleted post-completion) still appears in the PhaseProgress checklist instead of silently disappearing.

### WR-02: Rationalization fire counter used full-JSON-blob substring match (already_fixed)

**Files modified:** `packages/agent/src/lib/phaseDetail.ts`
**Commit:** `0e56061` (Iteration 1)
**Status:** already_fixed
**Applied fix:** Replaced `JSON.stringify(e).includes(label)` with a structured payload-targeted match per D-4-07. The new logic inspects only the `payload` field on each `HookFiring` entry:
- string `payload` -> `payload.includes(label)`
- object `payload` -> any string-valued field includes the label

### WR-03: `readSkillObservations` returned populated entries when meta-observer skill absent (already_fixed)

**Files modified:** `packages/agent/src/lib/phaseDetail.ts`, `packages/agent/src/lib/phaseDetail.test.ts`
**Commit:** `c677781` (Iteration 1)
**Status:** already_fixed
**Applied fix (Option A):**
- Added an early return `if (!skillInstalled) return { entries: [], skillInstalled }` at the top of `readSkillObservations` so the daemon honours the D-4-15 contract `{ entries: [], skillInstalled: false }` when the meta-observer skill is uninstalled.
- Updated test `O3` so the assertion (`toHaveLength(0)`) matches the test title and the locked spec contract — the previous `toHaveLength(1)` contradicted both.
- Updated tests `O4`, `O5`, `O6` to call `fix.writeMetaObserverSkill()` first to preserve test intent under the corrected contract.

### IN-01: Lexicographic timestamp sort in `readSkillObservations`

**Files modified:** `packages/agent/src/lib/phaseDetail.ts`
**Commit:** `4497e4d`
**Status:** fixed
**Applied fix:** Replaced the lexicographic string comparator `b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0` with `new Date(b.ts).getTime() - new Date(a.ts).getTime()`. This sorts by actual instant rather than ASCII codepoint, so future JSONL emitters using `+00:00` offsets interleave correctly with `Z`-terminated timestamps. Added an inline comment citing the IN-01 finding.

Tests `O5` (sort/limit) continue to pass — fixture timestamps already use a single format so the corrected comparator returns the same order. The fix is robust to future format mixing.

### IN-02: Review file detection too permissive in `phaseProgress.ts`

**Files modified:** `packages/agent/src/routes/phaseProgress.ts`
**Commit:** `35ded0f`
**Status:** fixed
**Applied fix:** Narrowed `endsWith('-REVIEW.md')` to the regex `/\d{2}-REVIEW\.md$/`, and the `-REVIEW-FIX.md` exclusion from `endsWith` to `/\d{2}-REVIEW-FIX\.md$/`. Both Stage 1 review-file detection and the Stage 2 fix-file detection now require a two-digit phase prefix, so a hypothetical future file like `04-IMPECCABLE-REVIEW.md` cannot be misclassified as the Stage 1 artifact.

All 307 agent tests continue to pass — current Phase 0–4 review filenames already match the `NN-` prefix convention.

### IN-03: Test X7 under-specified the empty-entries contract

**Files modified:** `packages/agent/src/server/__tests__/observations.test.ts`
**Commit:** `95e207f`
**Status:** fixed
**Applied fix:** Added `expect(data.entries).toHaveLength(0)` to test X7 in addition to the existing `Array.isArray` check. This pins the D-4-15 empty-entries contract for the `skillInstalled: false` case. With WR-03 already fixed in Iteration 1 (route returns `entries: []` when the skill is absent), the assertion now reliably enforces the expected shape.

Test X7 still passes. All 8 observations.test.ts tests green.

### IN-04: Missing explicit `React` import in `SingleProjectView.tsx`

**Files modified:** `packages/spa/src/components/SingleProjectView.tsx`
**Commit:** `40dd99d`
**Status:** fixed
**Applied fix:** Changed `import { useEffect } from 'react'` to `import React, { useEffect } from 'react'`. This brings `SingleProjectView.tsx` in line with all sibling panel components (`CommitmentBlock.tsx`, `HookFirings.tsx`, etc.) and makes the existing `React.JSX.Element` return-type annotation explicit rather than relying on the modern JSX transform's implicit namespace.

Pure style consistency; no behaviour change. Typecheck remains clean across all 3 packages, all 433 SPA tests pass.

## Skipped Issues

None. All 7 in-scope findings (3 WR + 4 IN) are now fixed.

## Verification

Performed after each commit and again after the final commit in this iteration:

- `pnpm -r typecheck` — clean across `shared`, `agent`, `spa`
- `pnpm --filter @agenticapps/dashboard-agent test` — 307/307 passing
- `pnpm --filter @agenticapps/dashboard-spa test` — 433/433 passing
- `pnpm lint` — 0 errors, 3 pre-existing warnings (all in files outside my edit set: `tailscale.test.ts`, `RenameTagsForms.test.tsx`, `api.test.ts`)

## Notes for Verifier

- This file was overwritten in Iteration 2; commit `ccd63f0` (the original Iteration-1 REVIEW-FIX.md) is preserved in git history if a side-by-side diff is needed.
- Each of the 7 fix commits is self-contained and atomic. Running `git log --grep='fix(04)' --oneline` should list:
  - `adbfa44` fix(04): WR-01 …
  - `0e56061` fix(04): WR-02 …
  - `c677781` fix(04): WR-03 …
  - `4497e4d` fix(04): IN-01 …
  - `35ded0f` fix(04): IN-02 …
  - `95e207f` fix(04): IN-03 …
  - `40dd99d` fix(04): IN-04 …
- IN-01..IN-04 are all low-risk (logic-equivalent under current inputs, robustness/style improvements). No D-XX decision was relaxed by these fixes; D-4-07 and D-4-15 are reinforced by IN-02 (filename narrowing) and IN-03 (test contract).
- Behaviour observable to consumers from this iteration alone: none. All four IN fixes are equivalent in behaviour for current production inputs but harden the code against future format/filename drift.

---

_Fixed: 2026-05-06T19:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2 (cumulative)_
