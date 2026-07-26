# Phase 06.1 — Post-Polish Impeccable Re-measurement (captured 2026-05-10)

**Captured against:** Live stack after Phase 06.1 Plans 01-05 shipped (D-6.1-01..04 all implemented).
**Branch:** phase-06-polish-service-install
**Methodology:** Assessment A (LLM heuristic scoring per route via Playwright MCP browser inspection) + Assessment B (`npx impeccable packages/spa/src --json` deterministic detector run once).
**Breakpoint audited:** 1440x900 (desktop only, per D-6-21)
**Pre-06.1 baseline:** `.planning/phases/06-polish-service-install-acceptance/refs/post-polish-impeccable.md`
**Stack:** agent on 127.0.0.1:5193 (auth-required, healthy), SPA on localhost:5174.

---

## Assessment B (deterministic detector)

Result of `npx impeccable packages/spa/src --json`:
- **Exit code:** 2 (findings present)
- **Total findings:** 2 (both false positives — same as 06-06 baseline)

| Anti-pattern | Count | Files | Verdict |
|---|---|---|---|
| `bounce-easing` | 2 | ProjectCard.test.tsx (lines 276, 292) | FALSE POSITIVE — test assertions confirm production code does NOT use animate-bounce |

**True positives: 0** (all 8 genuine violations closed by 06-06 are still closed)
**False positives: 2** (unchanged test assertions — same as 06-06 baseline)

No regressions introduced by Plans 01-05.

---

## Assessment A — Post-06.1 scores @ 1440x900

### Route 1: `/` @ 1440x900

**Polish applied:**
- D-6.1-04: `aria-current="page"` on active sidebar link (SidebarItem)
- D-6.1-04: `aria-live="polite"` in TopBar status area
- D-6.1-04: `aria-hidden="true"` on all decorative icons
- 06-06 fixes retained: command palette backdrop, RepairBanner fixed, POLISH-01 keyboard shortcuts button

**Sub-scores (post-06.1 vs post-06-06 vs delta):**

| Dimension | Post-06-06 | Post-06.1 | Δ |
|-----------|-----------|-----------|---|
| Color | 90 | 90 | 0 |
| Typography | 82 | 85 | +3 |
| Layout | 88 | 90 | +2 |
| Spacing | 86 | 87 | +1 |
| Hierarchy | 87 | 90 | +3 |
| Accessibility | 82 | 88 | +6 |

**Composite: 88** (was 86, +2)
**Pass (≥ 90):** No — composite held below 90 by Typography (85), Spacing (87), Accessibility (88)

Notes: D-6.1-01 (line-length cap) has limited impact on `/` because it's a card grid, not a prose page. D-6.1-04 ARIA improvements lifted Accessibility +6. Layout and Hierarchy both reached 90 individually.

---

### Route 2: `/projects/agenticapps-dashboard` @ 1440x900

**Polish applied:**
- D-6.1-02: `defaultCollapsed` on 5 empty-state panels (ObservabilityHealth, IntegrationsHealth when empty, SecurityStatus, VerificationStatus, SkillHealth)
- D-6.1-04: `aria-expanded` + `aria-controls` on collapse toggle buttons; `aria-current` in sidebar

**Sub-scores (post-06.1 vs post-06-06 vs delta):**

| Dimension | Post-06-06 | Post-06.1 | Δ |
|-----------|-----------|-----------|---|
| Color | 84 | 84 | 0 |
| Typography | 80 | 82 | +2 |
| Layout | 84 | 90 | +6 |
| Spacing | 80 | 82 | +2 |
| Hierarchy | 79 | 88 | +9 |
| Accessibility | 78 | 83 | +5 |

**Composite: 85** (was 81, +4)
**Pass (≥ 90):** No — composite held below 90 by Color (84), Typography (82), Spacing (82), Accessibility (83)

Notes: Layout +6 and Hierarchy +9 are confirmed: panel disclosure removes the "4 simultaneous empty states compete" verdict from 06-06. The right column is now much cleaner with collapsed empty panels. However Color, Typography and Spacing improvements require more work (verbose Integrations copy, monospace Commitment block line-wrapping).

---

### Route 3: `/settings` @ 1440x900

**Polish applied:**
- D-6.1-03: `<MaskedToken>` integrated — token displayed as "••••••••••••••••" with Reveal/Copy/Edit triplet; `aria-label="Token, masked"` / `aria-label="Token, revealed"`
- D-6.1-01: Helper prose `max-w-[75ch]`: "Token is masked. Click Reveal to see it, or Copy to copy without revealing. Click Edit to enter a new token." wraps cleanly
- 06-06 fixes retained: ThemeToggle selected-state uses bg-accent/10 ring; ManualPairForm alerts use tinted borders

**Sub-scores (post-06.1 vs post-06-06 vs delta):**

| Dimension | Post-06-06 | Post-06.1 | Δ |
|-----------|-----------|-----------|---|
| Color | 92 | 92 | 0 |
| Typography | 84 | 88 | +4 |
| Layout | 88 | 88 | 0 |
| Spacing | 87 | 87 | 0 |
| Hierarchy | 85 | 86 | +1 |
| Accessibility | 82 | 90 | +8 |

**Composite: 89** (was 86, +3)
**Pass (≥ 90):** No — composite held below 90 by Typography (88), Layout (88), Spacing (87), Hierarchy (86)

Notes: Accessibility +8 confirmed from MaskedToken (token NOT in plaintext, proper aria-labels on all 3 buttons). Typography +4 from prose cap. Main remaining blockers: Layout ("Theme" section still lacks Card container, inconsistent with "Manual pair" section) and Hierarchy (form label prominence).

---

### Route 4: `/help` @ 1440x900

**Polish applied:**
- D-6.1-04: `aria-current="page"` on active Help nav link
- KbdHint row descriptions are within 75ch naturally (short action descriptions)

**Sub-scores (post-06.1 vs post-06-06 vs delta):**

| Dimension | Post-06-06 | Post-06.1 | Δ |
|-----------|-----------|-----------|---|
| Color | 86 | 86 | 0 |
| Typography | 84 | 90 | +6 |
| Layout | 88 | 88 | 0 |
| Spacing | 85 | 85 | 0 |
| Hierarchy | 84 | 86 | +2 |
| Accessibility | 86 | 88 | +2 |

**Composite: 87** (was 86, +1)
**Pass (≥ 90):** No — composite held below 90 by Color (86), Layout (88), Spacing (85), Hierarchy (86), Accessibility (88)

Notes: Typography +6 confirmed — KbdHint descriptions are concise and render well. The large empty lower half of the page (below the 2 cards) continues to anchor Layout and Spacing at 88/85. More help content would push these scores over the gate.

---

### Route 5: `/onboarding` @ 1440x900

**Polish applied:**
- D-6.1-01: Step prose at 75ch — step 3 body "When the agent prints a pair URL like `https://...`, click it. You'll land back here, paired." wraps within container; subtitle "Nothing leaves your machine." is concise

**Sub-scores (post-06.1 vs post-06-06 vs delta):**

| Dimension | Post-06-06 | Post-06.1 | Δ |
|-----------|-----------|-----------|---|
| Color | 86 | 87 | +1 |
| Typography | 86 | 90 | +4 |
| Layout | 90 | 90 | 0 |
| Spacing | 88 | 88 | 0 |
| Hierarchy | 88 | 90 | +2 |
| Accessibility | 85 | 87 | +2 |

**Composite: 89** (was 87, +2)
**Pass (≥ 90):** No — composite held below 90 by Color (87), Spacing (88), Accessibility (87)

Notes: Typography +4 from prose cap — step descriptions and subtitle render cleanly. Layout and Hierarchy both at 90 (individually at gate). Color and Accessibility are the remaining blocking dimensions.

---

### Route 6: `/pair` (error state) @ 1440x900

**Polish applied:**
- D-6.1-04: `role="status"` + `aria-live="polite"` on the "Connecting to agent…" live region in pairing state
- D-6.1-01: `max-w-[75ch]` on numbered-step list items and body text in pairing state
- D-6.1-04: `role="status"` on the failed-state error section
- Pair URL shows "Pairing in progress" + numbered 3-step list when status.kind === 'pairing' (D-6.1-04)

**Sub-scores (post-06.1 vs post-06-06 vs delta):**

| Dimension | Post-06-06 | Post-06.1 | Δ |
|-----------|-----------|-----------|---|
| Color | 85 | 85 | 0 |
| Typography | 83 | 87 | +4 |
| Layout | 80 | 86 | +6 |
| Spacing | 84 | 85 | +1 |
| Hierarchy | 85 | 88 | +3 |
| Accessibility | 83 | 88 | +5 |

**Composite: 87** (was 83, +4)
**Pass (≥ 90):** No — composite held below 90 by Color (85), Typography (87), Layout (86), Spacing (85), Hierarchy (88), Accessibility (88)

Notes: Typography +4 from max-w-[75ch] on step items and error body. Layout +6 from numbered-steps canvas filling the empty space in the pairing state. Accessibility +5 from aria-live + role="status". Color and Layout remain the primary blockers.

---

## Composite scores @ 1440x900

| Route | Pre-06.1 (post-06-06) | Post-06.1 | Delta | Pass (≥ 90)? |
|-------|----------------------|-----------|-------|--------------|
| / | 86 | 88 | +2 | no |
| /projects/agenticapps-dashboard | 81 | 85 | +4 | no |
| /settings | 86 | 89 | +3 | no |
| /help | 86 | 87 | +1 | no |
| /onboarding | 87 | 89 | +2 | no |
| /pair | 83 | 87 | +4 | no |

---

## Sub-scores on `/` @ 1440x900 (canonical Phase 3 comparison)

| Dimension | Phase 3 baseline | Phase 5.1 baseline (06-01) | 06-06 post-polish | Post-06.1 | Gate |
|-----------|-----------------|----------------------------|-------------------|-----------|------|
| Color | 76 | 85 | 90 | 90 | 90 |
| Typography | 78 | 82 | 82 | 85 | 90 |
| Layout | 84 | 88 | 88 | 90 | 90 |
| Composite | — | 85 | 86 | 88 | 90 |

---

## D-6.1 implementation verification

| Decision | What it ships | Evidence in measurement |
|----------|---------------|------------------------|
| D-6.1-01 (max-w-[75ch] prose) | Applied to /help, /onboarding, panel empty-states, /settings, ManualPairForm helpers, /pair steps | Typography +3 on `/`, +6 on /help, +4 on /onboarding, +4 on /settings, +4 on /pair |
| D-6.1-02 (panel disclosure) | 5 right-column panels collapse when empty (`defaultCollapsed` on ObservabilityHealth, IntegrationsHealth-when-empty, SecurityStatus, VerificationStatus, SkillHealth) | Layout +6 and Hierarchy +9 on /projects/:id — confirmed in screenshot: panels show chevron-right initially, body hidden |
| D-6.1-03 (MaskedToken) | `<MaskedToken>` integrated into /settings ManualPairForm — token masked by default, Reveal/Copy/Edit triplet, aria-labels | Accessibility +8 on /settings (82→90); token no longer in plaintext |
| D-6.1-04 (ARIA + /pair) | `aria-current="page"` on sidebar items, `aria-live="polite"` in TopBar, `aria-hidden` on decorative icons, `role="status"` + `aria-live` on /pair states, numbered-steps canvas | Accessibility +6 on `/`, +5 on /pair, +5 on /projects/:id; Layout +6 on /pair from numbered-steps surface |

All 4 D-6.1 decisions are implemented and confirmed by measurement. The sub-scores moved in the predicted directions.

---

## Deterministic detector (Assessment B)

- **Exit code:** 2 (findings present)
- **Total findings:** 2 (both false positives — unchanged from 06-06)
- **True positives:** 0
- **False positives:** 2 (ProjectCard.test.tsx lines 276, 292 — `animate-bounce` in test assertions that CONFIRM no-bounce in production; same as 06-06 baseline)

No new violations introduced by Plans 01-05.

---

## Gate result

**REMAINING DELTA** — `node scripts/check-impeccable-score.mjs /tmp/imp-all-061.json` exited **1**.

Gate threshold: 90 (composite at 1440x900); Result: **FAIL** (exit code 1)

All 6 routes improved vs the 06-06 baseline (+1 to +4 composite points), but none cleared the 90 composite threshold. The closest routes are /settings (89) and /onboarding (89) — 1 point below gate.

### Routes still below 90 and their primary sub-score blockers:

| Route | Composite | Gap | Blocking sub-scores |
|-------|-----------|-----|---------------------|
| / | 88 | −2 | Typography 85, Spacing 87, Accessibility 88 |
| /projects/:id | 85 | −5 | Color 84, Typography 82, Spacing 82, Accessibility 83 |
| /settings | 89 | −1 | Layout 88 (Theme section Card), Spacing 87, Hierarchy 86 |
| /help | 87 | −3 | Empty lower half anchors Layout 88, Spacing 85, Color 86 |
| /onboarding | 89 | −1 | Color 87, Spacing 88, Accessibility 87 |
| /pair | 87 | −3 | Color 85, Layout 86, Spacing 85 |

### What remains to close the gap:

The two closest routes (/settings at 89, /onboarding at 89) could be closed with:
- `/settings`: Wrap "Theme" section in a Card container (consistent with "Manual pair" card) → Layout +2
- `/onboarding`: Color refinement on the hero section (slightly warmer accent on step numbers) → Color +3

The mid-range routes (/ at 88, /help at 87) need:
- `/`: Typography to 90 via ensuring card text is bounded (relatively minor tweak)
- `/help`: More help content to fill the empty lower half → Layout and Spacing improvement

The most challenging route remains /projects/:id (85), which needs:
- Integrations panel verbose Sentry copy shortened → Typography, Hierarchy
- Color improvements via accent polish

---

## Recommendation

**REMAINING DELTA** — Phase 06.1 improved all 6 routes (+1 to +4 composite) and validated that all 4 D-6.1 decisions implemented correctly. However, the ≥ 90 gate is not yet cleared.

Two options exist:

**Option A (extend):** Add a 06.1-07 closure plan targeting the 6 specific remaining gaps above. Estimated work:
- `/settings`: Card container for Theme section (~20 min)
- `/onboarding`: Hero color refinement (~15 min)
- `/`, `/help`: Typography bounded card text, additional help content (~30 min)
- `/pair`: Color and Layout refinement on error/pairing states (~20 min)
- `/projects/:id`: Integrations copy shortening, additional accent polish (~30 min)
Total: ~2-2.5h focused work; would unblock the 06-07 closing-ritual PR.

**Option B (accept):** Accept REMAINING DELTA with explicit override of D-6-09 (≥ 90 gate). Phase 06.1 improved scores meaningfully (83-87 → 85-89 range) and all D-6.1 implementation decisions are confirmed working. The gate infrastructure (.github/workflows/impeccable.yml + check-impeccable-score.mjs) is correctly wired and will enforce ≥ 90 on future PRs. Alpha audience may tolerate the known imperfection.

Phase 6's 06-07 closing-ritual PR decision depends on which option is chosen.
