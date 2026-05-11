---
phase: 06
plan: 01
status: COMPLETE
wave: 0
completed_at: 2026-05-10
---

# SUMMARY — Plan 06-01: Impeccable Baseline Capture + screenshot.mjs Extension

## Objective completed

Plan 06-01 had two tasks:
1. **Task 1** — Extend `packages/spa/scripts/screenshot.mjs` with `--route`, `--viewport`, `--out`, `--base-url` flags (done in commit 5301c35, prior executor).
2. **Task 2** — Capture fresh impeccable baseline against the live Phase 5.1 sidebar shell and produce 4 artifacts. Done in commit dda823c.

## Commits

| Commit | Description | Task |
|--------|-------------|------|
| `5301c35` | feat(06-01): extend screenshot.mjs with --route/--viewport/--out/--base-url flags + vitest | Task 1 |
| `dda823c` | feat(06-01): capture Phase 6 impeccable baseline + Phase 5.1 after-shell | Task 2 |

## Artifacts produced

| Artifact | Size | Status |
|----------|------|--------|
| `.planning/phases/06-polish-service-install-acceptance/refs/baseline-impeccable.md` | 428 lines | Created |
| `.planning/phases/06-polish-service-install-acceptance/refs/baseline-home.png` | 50 KB | Created |
| `.planning/phases/06-polish-service-install-acceptance/refs/baseline-project.png` | 90 KB | Created |
| `.planning/phases/DASH-05.1-.../refs/after-shell.png` | 90 KB | Updated (replaces /onboarding capture with /projects/:id) |

## Key findings from baseline

**D-6-19 verdict: REMAINING DELTA**

Phase 5.1 sidebar shell lifted all three Phase 3 sub-scores on `/` @ 1440x900:
- Color: 76 → **85** (+9)
- Typography: 78 → **82** (+4)
- Layout: 84 → **88** (+4)

None have yet reached the ≥ 90 gate. Polish work required in 06-06 (POLISH-04).

**Composite scores by route:**

| Route | Breakpoint | Composite | Pass? |
|-------|-----------|-----------|-------|
| / | 1440x900 | 85 | no |
| / | 768x1024 | 81 | no |
| / | 390x844 | 51 | no — CRITICAL: mobile sidebar does not collapse |
| /projects/:id | 1440x900 | 81 | no |
| /settings | 1440x900 | 85 | no |
| /help | 1440x900 | 84 | no |
| /onboarding | 1440x900 | 87 | no (Layout 90 is the one cell at gate) |
| /pair (error) | 1440x900 | 83 | no |

**Assessment B (deterministic detector):** 10 findings, exit code 2.
- 4 genuine `side-tab` violations: `border-l-2` accent on ThemeToggle labels and ManualPairForm alert states.
- 4 genuine `pure-black-white`: modal backdrop `bg-black` classes should use tinted overlay.
- 2 false positives: `bounce-easing` in test file assertions (not production code).

## Deviations from plan

1. `playwright` was not in the SPA package.json — had to install it as a `devDependency` to execute `screenshot.mjs`. Added `packages/spa/package.json` and `pnpm-lock.yaml` to the commit. The plan assumed playwright was already available; this is a valid deviation given the script requires it.
2. The assessment ran all 8 route × breakpoint combinations specified in the capture matrix. The plan listed `/projects/agenticapps-dashboard` as the project route — this was the only registered project at capture time that also had a `/projects/:id` route that fully resolved. All 8 captures completed.

## Phase 5.1 AC-08 closure

The `after-shell.png` in the Phase 5.1 refs directory previously captured `/onboarding` (outside the shell). It has been replaced with a capture of `/projects/agenticapps-dashboard` @ 1440x900, which shows the full AppShellV2 grid: sidebar, TopBar, 3-column project view. AC-08 is closed.

## What 06-06 (POLISH-04) must target

Per `baseline-impeccable.md § D-6-19`:
- **Mobile responsive layout (P1 blocker):** `/` @ 390px has Composite 51 — no mobile sidebar collapse.
- **Color +5:** Replace `bg-black` modal backdrops with tinted overlays (`bg-text-primary/50` or similar using OKLCH).
- **Typography +8:** Increase step heading size in /onboarding; audit line-length caps at 1440px.
- **Layout +2 (desktop):** Minor — remove Integrations info overload on `/projects/:id`.
- **Side-stripe ban:** Fix 4 `border-l-2` occurrences in ThemeToggle and ManualPairForm.

## Self-Check: PASSED

- [x] All 4 artifacts exist and are non-empty (verified by `ls -la`)
- [x] Screenshots are non-empty PNGs (50 KB and 90 KB)
- [x] baseline-impeccable.md contains real numbers (not placeholders) across all 8 captures
- [x] D-6-19 verdict rendered with specific sub-score deltas and polish prescription
- [x] Both commits (5301c35 and dda823c) are in worktree branch history
- [x] Phase 5.1 AC-08 closed by updated after-shell.png at /projects/:id
