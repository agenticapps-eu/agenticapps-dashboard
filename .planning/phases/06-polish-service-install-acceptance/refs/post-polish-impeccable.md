# Phase 6 — Post-polish impeccable scores (Plan 06-06 Task 2 closure)

**Measurement date:** 2026-05-10
**Branch:** phase-06-polish-service-install-acceptance (worktree agent-a11fd0c768ed8dcb3)
**Method:** Assessment A (LLM heuristic scoring via Playwright browser inspection) + Assessment B (deterministic detector)
**Breakpoint audited:** 1440x900 (desktop only, per D-6-21)
**Pre-polish baseline:** `.planning/phases/06-polish-service-install-acceptance/refs/baseline-impeccable.md`

---

## Assessment B (deterministic detector) — post-polish

Result of `npx impeccable packages/spa/src --json`:
- **Exit code:** 0 (no genuine findings)
- **Total findings:** 2 (both false positives)

| Anti-pattern | Count | Files | Verdict |
|---|---|---|---|
| `bounce-easing` | 2 | ProjectCard.test.tsx (lines 276, 292) | FALSE POSITIVE — test assertions confirm production code does NOT use animate-bounce |

**True positives: 0** (down from 8 at baseline)
**False positives: 2** (same as baseline — unchanged test assertions)

All 8 genuine violations are fixed:
- 4 `side-tab` (`border-l-2` as accent): ThemeToggle, ManualPairForm (×2 alerts), RegisterModal blocked banner, RepairBanner
- 4 `pure-black-white` (`bg-black` modal backdrops): CommandPalette, RegisterModal, RenameTagsForms (×2)

---

## Assessment A — Post-polish scores @ 1440x900

### Route 1: `/` @ 1440x900

**Polish applied:** RegisterModal backdrop fixed (`bg-black/60` → `bg-text-primary/50`), CommandPalette backdrop fixed. RepairBanner `border-l-2` removed.

**Sub-scores (post-polish):**
- Color: **90** — pure-black modal backdrops eliminated; all overlays now use OKLCH-tinted text-primary; warm paper palette discipline complete
- Typography: 82 — unchanged; body line-length may still exceed 75ch on wide cards at 1440px
- Layout: 88 — unchanged; 240px sidebar + 1fr content solid at desktop
- Spacing: 86 — unchanged
- Hierarchy: 87 — unchanged
- Accessibility: 82 — minor improvement from keyboard shortcut discoverability (POLISH-01 keyboard hints in TopBar tooltip)

**Composite: 86** (was 85 pre-polish, +1 from Color reaching gate)
**Pass (≥ 90):** No — composite held below 90 by Typography (82) and Accessibility (82)

---

### Route 2: `/projects/agenticapps-dashboard` @ 1440x900

**Polish applied:** RepairBanner `border-l-2 border-l-status-error` → `bg-status-error/8` (RepairBanner shows Agent-unreachable state for this project since skills endpoint returns warning)

**Sub-scores (post-polish):**
- Color: 84 — RepairBanner fixed; remaining issue: 4 integration empty states simultaneously visible creates visual noise
- Typography: 80 — unchanged; Commitment monospace column line-wrapping; integration copy verbose
- Layout: 84 — unchanged
- Spacing: 80 — unchanged
- Hierarchy: 79 — unchanged; 4 simultaneous empty states still compete
- Accessibility: 78 — unchanged; phase pill in TopBar verbose

**Composite: 81** (was 81 pre-polish, no change — RepairBanner is conditional on daemon state)
**Pass (≥ 90):** No

---

### Route 3: `/settings` @ 1440x900

**Polish applied:** ThemeToggle `border-l-2 border-l-accent` → `bg-accent/10 ring-1 ring-accent/30`. ManualPairForm both alert divs `border-l-2` → tinted full borders.

**Sub-scores (post-polish):**
- Color: **92** — ThemeToggle selected-state now uses proper background tint (no border-l accent). ManualPairForm alert divs use tinted borders. All AI-slop tells removed from settings page.
- Typography: 84 — unchanged
- Layout: 88 — unchanged; "Theme" section still lacks Card container (inconsistent sectioning vs "Manual pair")
- Spacing: 87 — unchanged
- Hierarchy: 85 — unchanged
- Accessibility: 82 — unchanged; token field still shows in plaintext

**Composite: 86** (was 85 pre-polish, +1)
**Pass (≥ 90):** No — composite held below 90 by Typography (84) and Accessibility (82)

---

### Route 4: `/help` @ 1440x900

**Improvement from POLISH-01 (not this plan):** The help page now renders a "Keyboard shortcuts" section (R, ?, /, Cmd+K) from the keyboard shortcut work in Wave 1. This substantially improves the page's content value vs the near-empty placeholder at baseline.

**Sub-scores (post-polish):**
- Color: 86 — unchanged
- Typography: 84 — keyboard shortcuts table is well-formatted; step descriptions are clear
- Layout: 88 — keyboard shortcut rows use a clean two-column layout; warm paper background consistent
- Spacing: 85 — unchanged
- Hierarchy: 84 — "Help" heading > "Keyboard shortcuts" heading hierarchy is clear
- Accessibility: 86 — keyboard key legend elements are visually distinctive

**Composite: 86** (was 84 pre-polish, +2 from POLISH-01 keyboard shortcuts content)
**Pass (≥ 90):** No

---

### Route 5: `/onboarding` @ 1440x900

**Polish applied:** None (no deterministic violations on this page)

**Sub-scores (post-polish):**
- Color: 86 — unchanged
- Typography: 86 — unchanged
- Layout: 90 — unchanged (this was already at gate)
- Spacing: 88 — unchanged
- Hierarchy: 88 — unchanged
- Accessibility: 85 — unchanged

**Composite: 87** (unchanged from baseline)
**Pass (≥ 90):** No (close — Layout meets 90 but composite held by Accessibility 85 and Color 86)

---

### Route 6: `/pair` (error state) @ 1440x900

**Polish applied:** None (no `bg-black` or `border-l-2` on this page)

**Sub-scores (post-polish):**
- Color: 85 — unchanged (warm paper background; error card uses border-subtle)
- Typography: 83 — unchanged
- Layout: 80 — unchanged; large empty canvas below centered error card
- Spacing: 84 — unchanged
- Hierarchy: 85 — unchanged
- Accessibility: 83 — unchanged

**Composite: 83** (unchanged from baseline)
**Pass (≥ 90):** No

---

## Post-polish composite scores @ 1440x900

| Route | Pre-polish | Post-polish | Delta | Pass (≥ 90)? |
|-------|-----------|-------------|-------|-------------|
| / | 85 | 86 | +1 | no |
| /projects/:id | 81 | 81 | 0 | no |
| /settings | 85 | 86 | +1 | no |
| /help | 84 | 86 | +2 | no |
| /onboarding | 87 | 87 | 0 | no |
| /pair (error) | 83 | 83 | 0 | no |

---

## Files touched by Task 2 polish

- `packages/spa/src/components/ThemeToggle.tsx` — selected-state radio label switched from `border-l-2 border-l-accent` to `bg-accent/10 ring-1 ring-accent/30`
- `packages/spa/src/components/ThemeToggle.test.tsx` — updated test assertions to match new styling pattern
- `packages/spa/src/components/ManualPairForm.tsx` — error alert `border-l-2 border-l-status-warning` → `border border-status-warning/40 bg-status-warning/8`; success alert `border-l-2 border-l-status-success` → `border border-status-success/40 bg-status-success/8`
- `packages/spa/src/components/RegisterModal.tsx` — blocked banner `border-l-2 border-l-status-error` → `bg-status-error/8 border border-status-error/40`; dialog `backdrop:bg-black/60` → `backdrop:bg-text-primary/50`
- `packages/spa/src/components/CommandPalette.tsx` — dialog `backdrop:bg-black/60` → `backdrop:bg-text-primary/50`
- `packages/spa/src/components/RenameTagsForms.tsx` — both dialogs `backdrop:bg-black/60` → `backdrop:bg-text-primary/50`
- `packages/spa/src/components/RepairBanner.tsx` — `border-l-2 border-l-status-error` → `bg-status-error/8`

---

## D-6-19 verdict (updated)

**Phase 3 baseline (against deleted dark-theme AppShell):** Color 76, Typography 78, Layout 84 on `/` @ desktop.
**Phase 5.1 baseline (Wave 0, 06-01):** Color 85, Typography 82, Layout 88.
**Phase 6 post-polish (this baseline):** Color **90**, Typography **82**, Layout **88**.

| Dimension | Phase 3 | Phase 5.1 | Post-polish | Gate (90) | Status |
|-----------|---------|-----------|------------|-----------|--------|
| Color (/) | 76 | 85 | **90** | 90 | PASS |
| Typography (/) | 78 | 82 | 82 | 90 | DELTA −8 |
| Layout (/) | 84 | 88 | 88 | 90 | DELTA −2 |

**D-6-19 verdict: REMAINING DELTA** — Color now at gate (90), but Typography (82, −8) and Layout (88, −2) still below 90 on `/` @ 1440x900.

---

## Gate result (D-6-09)

**Gate threshold:** 90 (composite score at 1440x900 per D-6-21)

**Result: FAIL** — No route reaches composite 90. The targeted deterministic polish pass (+8 true positive fixes) lifted Color scores but composites are anchored by Typography, Layout, Hierarchy, and Accessibility sub-scores that require broader changes beyond the 8 targeted fixes.

**Gate implementation:** `.github/workflows/impeccable.yml` and `scripts/check-impeccable-score.mjs` are committed and ready. The gate infrastructure is correct; the current scores would cause the gate to fail on the first PR.

### What would reach 90 on each route:

| Route | Composite | Gap | Primary blockers | Feasibility |
|-------|-----------|-----|-----------------|-------------|
| / | 86 | −4 | Typography +8 (line-length), Accessibility +8 (OBSERVE tooltips, icon-only settings) | Medium — needs CSS `max-w-[75ch]` on card text + ARIA improvements |
| /projects/:id | 81 | −9 | Hierarchy +11 (4 simultaneous integration empty states), Accessibility +12 | Hard — needs integration panel collapse/redesign |
| /settings | 86 | −4 | Typography +6 (form field labels), Accessibility +8 (token masking) | Medium — CSS + UX changes |
| /help | 86 | −4 | Layout +2 (empty lower half), Typography +6 (more content) | Easy — content additions |
| /onboarding | 87 | −3 | Accessibility +5 (step pairing status), Color +4 | Medium |
| /pair | 83 | −7 | Layout +10 (empty canvas), Typography +7 | Medium — visual treatment for empty space |

### Recommendation

The 8 deterministic fixes are the correct first pass per the plan's "targeted polish" scope. Lifting composites to 90 across all 6 routes requires a focused Phase 6.5 or v1.1 accessibility + typography pass. The gate itself is correctly wired and will enforce ≥ 90 on future PRs. The current composite scores (83–87) are a meaningful improvement over Phase 3 (76–84) and the gate infrastructure is production-ready.
