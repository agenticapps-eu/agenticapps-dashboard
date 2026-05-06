---
phase: 04-single-project-view-discipline-phase-progress
fixed_at: 2026-05-06T18:52:00Z
review_path: .planning/phases/04-single-project-view-discipline-phase-progress/04-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-05-06T18:52:00Z
**Source review:** `.planning/phases/04-single-project-view-discipline-phase-progress/04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 — fix_scope = `critical_warning`)
- Fixed: 3
- Skipped: 0
- Out of scope (excluded by `critical_warning`): IN-01, IN-02, IN-03, IN-04

## Fixed Issues

### WR-01: Orphaned SUMMARY files silently omitted from phase checklist

**Files modified:** `packages/agent/src/lib/phaseDetail.ts`
**Commit:** `adbfa44`
**Applied fix:** After the existing plan loop in `parsePhaseChecklist`, appended a second loop that pushes any `SUMMARY` files that were not already added by their paired `PLAN`. This ensures an orphaned `NN-NN-SUMMARY.md` (e.g. when its plan file was deleted post-completion) still appears in the PhaseProgress checklist instead of silently disappearing.

Behaviour change: tests `PC1`/`PC3` continue to pass unchanged because they never exercise the orphan-summary path. The new loop is additive and only fires when a summary has no paired plan.

### WR-02: Rationalization fire counter used full-JSON-blob substring match

**Files modified:** `packages/agent/src/lib/phaseDetail.ts`
**Commit:** `0e56061`
**Applied fix:** Replaced `JSON.stringify(e).includes(label)` with a structured payload-targeted match per D-4-07. The new logic inspects only the `payload` field on each `HookFiring` entry:
- string `payload` -> `payload.includes(label)`
- object `payload` -> any string-valued field includes the label

This matches the locked decision "events whose `payload.row` (or equivalent field per D-4-06 passthrough shape) matches a label" and eliminates false positives where a label string happened to appear in `skill`, `hook`, or other unrelated fields.

Test `R2` (the only test that exercises the fire counter) already used `payload: 'Row label two'`, so it continues to pass — the test fixture had the correct intent; the implementation strayed.

### WR-03: `readSkillObservations` returned populated entries when meta-observer skill absent

**Files modified:** `packages/agent/src/lib/phaseDetail.ts`, `packages/agent/src/lib/phaseDetail.test.ts`
**Commit:** `c677781`
**Applied fix (Option A per orchestrator directive):**
- Added an early return `if (!skillInstalled) return { entries: [], skillInstalled }` at the top of `readSkillObservations`, immediately after computing `skillInstalled`. This honours the D-4-15 contract `{ entries: [], skillInstalled: false }` for the uninstalled-skill case.
- Updated test `O3` so the assertion (`toHaveLength(0)`) matches the test title and the locked spec contract — the previous `toHaveLength(1)` contradicted both. Added a comment clarifying the intent.
- Updated tests `O4`, `O5`, `O6` to call `fix.writeMetaObserverSkill()` first. These tests exercise JSONL-parsing edge cases (malformed lines, sort/limit, missing required fields) which only run when the skill is installed. They previously relied on the old behaviour of unconditionally reading JSONL even when the skill was absent. Adding the skill-install step preserves test intent under the corrected contract.

Route test `X7` in `observations.test.ts` only asserts `Array.isArray(data.entries)` (which holds for both `[]` and a populated array), so it remains green without modification. IN-03 (which would tighten X7 to `toHaveLength(0)`) is out of scope for this iteration.

## Skipped Issues

None. All 3 in-scope warnings were fixed.

## Out-of-Scope (informational only — not addressed)

These were intentionally excluded by `fix_scope = "critical_warning"`:

- **IN-01:** Lexicographic timestamp sort — low-risk; meta-observer emits `Z` consistently today.
- **IN-02:** `endsWith('-REVIEW.md')` could collide with hypothetical future filenames — no active bug.
- **IN-03:** `observations.test.ts` X7 under-specifies the empty-entries contract — would tighten the test if WR-03 Option A was chosen (which it was). Leaving for a future hardening pass.
- **IN-04:** `SingleProjectView.tsx` style inconsistency (no explicit `import React`) — passes typecheck, cosmetic only.

## Verification

Performed after each commit and again after the final commit:

- `pnpm --filter @agenticapps/dashboard-agent test` — 307/307 passing
- `pnpm --filter @agenticapps/dashboard-agent typecheck` — clean
- `pnpm -r typecheck` — clean across `shared`, `agent`, `spa`
- `pnpm -r test` — 740/740 passing (one transient timing-sensitive flake in `MultiProjectHome.test.tsx` Phase 3, unrelated to Phase 4 changes; passes deterministically on re-run)
- `pnpm lint` — 0 errors, 3 pre-existing warnings (all in files outside my edit set)

## Notes for Verifier

- D-4-07 + D-4-15 amendments (2026-05-06) require dual-layout skill probing via `findSkillPath()`. This was preserved — none of the fixes regressed the canonical/bundle probe order.
- WR-02's behaviour change is observable to consumers: a fire counter that previously over-counted will now under-count by comparison. This is the intended correction. Verify by spot-checking the `RationalizationFires` panel in dev: install meta-observer, emit a hook event whose `payload` matches a row label, confirm count increments by exactly 1.
- WR-03's behaviour change is observable but UI-invisible: the `HookFirings` panel already renders the install-hint and ignores `entries` when `skillInstalled: false`, so end-users see no UI delta. A consumer reading the daemon endpoint directly will now reliably see `entries: []` in this state.

---

_Fixed: 2026-05-06T18:52:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
