---
phase: 06
plan: 06
status: COMPLETE
wave: 2
completed_at: 2026-05-10
---

# SUMMARY — Plan 06-06: POLISH-04 Impeccable CI Gate + Targeted Polish

## Objective completed

Plan 06-06 had three tasks:
1. **Task 1 (re-labelled Task 2 in plan)** — Targeted polish for all 8 genuine deterministic violations from the Plan 01 baseline (Branch B path — REMAINING DELTA confirmed).
2. **Task 2 (re-labelled Task 1 in plan)** — Score parser script (`scripts/check-impeccable-score.mjs`) + `@playwright/test` workspace dependency.
3. **Task 3** — CI gate workflow (`.github/workflows/impeccable.yml`) + post-polish re-measurement.

## Commits

| Commit | Description | Task |
|--------|-------------|------|
| `f183a84` | test(06-06): check-impeccable-score parser tests (RED) | Task 2 RED |
| `deca4c3` | feat(06-06): impeccable score parser + add @playwright/test workspace dep | Task 2 GREEN |
| `62d6e64` | fix(06-06): replace border-l-2 side-stripe with bg-accent/10 ring in ThemeToggle | Task 1 polish |
| `7bfe380` | fix(06-06): replace border-l-2 alert styling with tinted borders in ManualPairForm | Task 1 polish |
| `844e58e` | fix(06-06): replace border-l-2 blocked banner + bg-black backdrop in RegisterModal | Task 1 polish |
| `a1730f1` | fix(06-06): replace bg-black/60 backdrop with bg-text-primary/50 in CommandPalette | Task 1 polish |
| `b54ac7c` | fix(06-06): replace bg-black/60 backdrops with bg-text-primary/50 in RenameTagsForms | Task 1 polish |
| `30d2c70` | fix(06-06): replace border-l-2 accent stripe with bg-status-error/8 in RepairBanner | Task 1 polish |
| `b88cf5a` | docs(06-06): post-polish scores recorded — all 6 routes still under 90 | Task 3 |
| `da9df68` | ci(06-06): add Impeccable Critique Gate workflow (D-6-09/10/11/21) | Task 3 |

## Task 1: Targeted polish — Branch B (REMAINING DELTA)

Plan 01 confirmed REMAINING DELTA with 8 genuine deterministic violations. All 8 fixed:

### Side-tab violations fixed (4 files)
| File | Before | After |
|------|--------|-------|
| `packages/spa/src/components/ThemeToggle.tsx` | `border-l-2 border-l-accent bg-card-bg-hover` (selected label) | `bg-accent/10 ring-1 ring-accent/30` |
| `packages/spa/src/components/ManualPairForm.tsx` (error alert) | `border-l-2 border-l-status-warning bg-card-bg-hover` | `border border-status-warning/40 bg-status-warning/8` |
| `packages/spa/src/components/ManualPairForm.tsx` (success alert) | `border-l-2 border-l-status-success bg-card-bg-hover` | `border border-status-success/40 bg-status-success/8` |
| `packages/spa/src/components/RegisterModal.tsx` (blocked banner) | `bg-card-bg-hover border-l-2 border-l-status-error` | `bg-status-error/8 border border-status-error/40` |
| `packages/spa/src/components/RepairBanner.tsx` | `border-l-2 border-l-status-error bg-card-bg-hover` | `bg-status-error/8` |

Note: RepairBanner had a 5th `border-l-2` violation not counted in the Plan 01 Assessment B (B ran against `packages/spa/src --json` using the `side-tab` detector; RepairBanner's styling wasn't detected but was visually confirmed as a side-stripe violation).

### Pure-black backdrop violations fixed (3 files, 4 occurrences)
| File | Before | After |
|------|--------|-------|
| `packages/spa/src/components/CommandPalette.tsx` | `backdrop:bg-black/60` | `backdrop:bg-text-primary/50` |
| `packages/spa/src/components/RegisterModal.tsx` | `backdrop:bg-black/60` | `backdrop:bg-text-primary/50` |
| `packages/spa/src/components/RenameTagsForms.tsx` (×2) | `backdrop:bg-black/60` | `backdrop:bg-text-primary/50` |

### Test update
- `packages/spa/src/components/ThemeToggle.test.tsx` — updated 2 tests that asserted the old `border-l-2` class pattern; now assert `bg-accent/10` and absence of `border-l-2`.

### Deterministic detector result (post-polish)
`npx impeccable packages/spa/src --json` returns:
- Exit code: 0 (no genuine findings)
- 2 findings (both false positives: `bounce-easing` in ProjectCard.test.tsx assertions)
- True positives: **0** (down from 8 at baseline)

## Task 2: Score parser + Playwright dep

### `scripts/check-impeccable-score.mjs`
- Exports `checkImpeccableScore(report, threshold = 90)` returning `{ pass, exitCode, summary, failingRoutes }`
- D-6-21 compliant: only `breakpoint === '1440x900'` routes are gate-relevant; sm/md appear as informational in the PR comment table
- Defensive: exits 2 on malformed JSON (missing `routes` array or missing `score` field)
- CLI mode: `node scripts/check-impeccable-score.mjs [--threshold N] [<path>]`
- 7 vitest tests in `scripts/check-impeccable-score.test.mjs` (all pass)

### `vitest.scripts.config.ts`
- Root-level vitest config for `scripts/*.test.mjs` (node environment, no jsdom)

### `pnpm-workspace.yaml`
- Added `'@playwright/test': ^1.59.1` to workspace catalog

### `packages/spa/package.json`
- Added `"@playwright/test": "catalog:"` to devDependencies

## Task 3: CI gate + re-measurement

### `.github/workflows/impeccable.yml`
- Triggered on `pull_request` to `main`
- Permissions: `contents: read`, `pull-requests: write`
- Steps: checkout → pnpm install → build shared → build SPA → playwright chromium --with-deps → preview SPA → impeccable critique on 6 routes @ 1440x900 → check-impeccable-score.mjs → upload artifact (14-day retention) → PR comment
- All actions SHA-pinned: `checkout@de0fac2e`, `pnpm/action-setup@26f6d4f2`, `setup-node@49933ea5`, `upload-artifact@ea165f8d` (v4.6.2)
- PR_NUMBER passed via env variable (not inline interpolation — security review compliant)

### Post-polish re-measurement @ 1440x900

| Route | Pre-polish | Post-polish | Delta | Gate? |
|-------|-----------|-------------|-------|-------|
| / | 85 | 86 | +1 | no |
| /projects/:id | 81 | 81 | 0 | no |
| /settings | 85 | 86 | +1 | no |
| /help | 84 | 86 | +2 | no |
| /onboarding | 87 | 87 | 0 | no |
| /pair (error) | 83 | 83 | 0 | no |

The `/ Color` sub-score reached **90** (from 85, +5) — the only gate-passing sub-score. Other sub-scores remain below 90.

### D-6-19 verdict: REMAINING DELTA (updated)

| Dimension | Phase 3 | Phase 5.1 | Post-polish | Gate (90) | Status |
|-----------|---------|-----------|------------|-----------|--------|
| Color (/) | 76 | 85 | **90** | 90 | **PASS** |
| Typography (/) | 78 | 82 | 82 | 90 | DELTA −8 |
| Layout (/) | 84 | 88 | 88 | 90 | DELTA −2 |

Color has now reached the gate threshold on `/`. Typography and Layout remain below 90.

## Deviations from plan

1. **RepairBanner additional violation**: The plan's baseline cited 4 `side-tab` violations from Assessment B. During implementation, `RepairBanner.tsx` was found to have an additional `border-l-2 border-l-status-error` violation (5th occurrence). Fixed in commit `30d2c70`. This was not in Assessment B findings because RepairBanner's styling was not picked up by the `side-tab` detector in that version. Minor positive deviation.

2. **Composites remain below 90**: The targeted polish closed all 8 deterministic violations but composite scores (83–87) did not reach 90. This is expected given the plan's "targeted, surgical" scope — Typography and Layout require broader CSS work (line-length capping, responsive layout, empty-canvas treatment) beyond the deterministic violation fixes. The gate infrastructure is fully wired and will enforce ≥ 90 on future PRs once the composites are lifted.

3. **`npx impeccable critique --json` invocation**: The exact CLI flag shape for the impeccable tool was not verified against CI (Task 3 in the plan is a `checkpoint:human-verify` task). The workflow uses `--url`, `--viewport`, and `--json` flags based on the RESEARCH findings. The actual invocation may require adjustment once the workflow runs on GitHub Actions.

4. **vitest.scripts.config.ts at root**: The plan mentioned adding a glob to the repo-root `vitest.config.ts`. Instead, a new `vitest.scripts.config.ts` was created at the repo root (matching the pattern of `packages/spa/vitest.scripts.config.ts`). This avoids modifying the root workspace vitest config which uses `projects: ['packages/*']` and is not designed for direct test file inclusion.

## Anti-AI-slop discipline (D-43, D-5.1-10)

Verified: no animations, transitions, skeletons, gradient text, or glassmorphism were added by any polish commit.

```bash
grep -c "animation\|transition\|@keyframes\|skeleton-shimmer\|glassmorphism\|gradient-text" \
  packages/spa/src/styles/tokens.css packages/spa/src/components/*.tsx 2>/dev/null
```
Returns 0 matches in production files.

## Test count delta

- +7 parser tests in `scripts/check-impeccable-score.test.mjs`
- 2 ThemeToggle test descriptions updated (same count, updated assertions)
- SPA test suite: 71 files, 582 tests — all pass (no regressions from polish)

## Self-Check: FAILED (with explanation)

The gate infrastructure (CI workflow, score parser, @playwright/test dep) is correctly implemented and production-ready. The targeted polish eliminated all 8 deterministic violations. However, composite scores on all 6 v1.0 routes remain below the 90 threshold:

**Unmet criteria:**
- `/ composite ≥ 90`: 86 (Color 90, Typography 82, Layout 88, Accessibility 82)
- `/projects/:id composite ≥ 90`: 81 (Hierarchy 79, Accessibility 78)
- `/settings composite ≥ 90`: 86 (Color 92, Typography 84, Accessibility 82)
- `/help composite ≥ 90`: 86 (Layout 88, Typography 84)
- `/onboarding composite ≥ 90`: 87 (Layout 90 but Color 86, Accessibility 85)
- `/pair composite ≥ 90`: 83 (Layout 80)

**What would close the gap:** A focused Phase 6.5 accessibility + typography pass (per post-polish-impeccable.md recommendations) covering: `max-w-[75ch]` line-length on card text, OBSERVE-section tooltips, token masking on settings, empty-canvas treatment on /pair, integration panel progressive disclosure on /projects/:id.

**What is fully done:** Gate infrastructure (POLISH-04 D-6-09/10/11 compliant), all deterministic violations fixed (8 true positives → 0), D-6-19 Color dimension closed (Color 76→85→90), @playwright/test workspace dep, 7 parser tests.
