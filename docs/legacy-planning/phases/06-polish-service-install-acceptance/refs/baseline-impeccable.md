# Phase 6 — Impeccable Baseline (captured 2026-05-10)

**Captured against:** Phase 5.1 sidebar shell (warm paper / aubergine / accent purple / Inter)
**Live stack:** agent on 127.0.0.1:5193 (auth-required, healthy), SPA on localhost:5174, paired with project `agenticapps-dashboard` (2 projects registered: agenticapps-dashboard, cparx)
**Methodology:** $impeccable critique per ~/.claude/skills/impeccable/SKILL.md — Assessment A (LLM heuristic scoring per route via Playwright browser inspection + source analysis) + Assessment B (`npx impeccable packages/spa/src --json` deterministic detector, exit code 2 = findings, run once)

---

## Assessment A — LLM Design Review (per route)

### Isolation note
Assessment A scoring below was performed before Assessment B detector results were consulted. B findings are introduced in the "Deterministic Detector" section and cross-referenced in the final composite.

---

### Route 1: `/` @ 1440x900

**Visual inspection:** Phase 5.1 sidebar shell fully visible. Warm paper background (#FAFAF7), aubergine sidebar with Inter Variable confirmed. Sidebar: 240px, 3 sections (WORKSPACE active, OBSERVE greyed-out, ACCOUNT). TopBar: breadcrumb "All Projects", Cmd+K search button, theme chip, settings link. Main area: PageHeader "Projects" with helper "2 projects · last refresh Ns ago". HomeToolbar: filter chips (all/active/client/internal) + search + sort. 2-col project card grid at 1440px with "Register project" dashed card as third slot. Cards show project name, phase, commit time. Font rendering sharp; spacing is generous.

**Nielsen's 10 Heuristics:**

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Last-refresh helper label visible; TanStack Query auto-refresh. No explicit loading spinner on first paint. |
| 2 | Match System / Real World | 4 | "Projects", "Register project", "last commit N ago" — developer-native language, correct for audience. |
| 3 | User Control and Freedom | 3 | No undo on register; context menu provides rename/tags/unregister escape. No keyboard shortcut to register. |
| 4 | Consistency and Standards | 3 | Sidebar active item uses accent-bg; TopBar uses same accent ring for focus. Minor: settings icon appears both in sidebar (labelled) and TopBar (icon-only). |
| 5 | Error Prevention | 3 | Filter chips + search prevent empty results with visible empty state copy. No constraint on tag input length. |
| 6 | Recognition Rather Than Recall | 3 | Filter chips and sort dropdown are visible. OBSERVE section labels disabled items but does not explain when they'll be active. |
| 7 | Flexibility and Efficiency | 2 | Cmd+K palette available (keyboard shortcut shown in topbar). No bulk actions. No keyboard shortcut to register project. Limited power-user path. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean; card grid uses only essential data. Large empty lower half of screen when only 2 projects exist. |
| 9 | Error Recovery | 3 | Daemon-unreachable error state implemented; schema drift state also implemented. Error messages use plain language. |
| 10 | Help and Documentation | 2 | OBSERVE section items are disabled with no tooltip explaining future availability. No inline hint for first-time users on the home page directing to /onboarding. |
| **Total** | | **29/40** | **Good — address weak areas** |

**Cognitive Load checklist (8 items):**
- [x] Single focus: home clearly focuses on project navigation
- [x] Chunking: sidebar sections are 3 discrete groups
- [x] Grouping: filter chips group, card grid group
- [x] Visual hierarchy: clear — Projects heading dominant
- [x] One thing at a time: filter/sort before card click is natural
- [x] Minimal choices: 4 filter chips + sort = within limits
- [ ] Working memory: user must remember disabled OBSERVE items are "coming soon" — no tooltip
- [x] Progressive disclosure: hover on card reveals expanded metrics

**Failures: 1** (low cognitive load — good)

**AI Slop verdict:** No. The warm paper palette, Inter Variable, and Cloudflare-inspired sidebar avoid common AI tells. The disabled OBSERVE items with text labels (not icon-only) show intentionality. Minor: the card design is functionally driven rather than decorative.

**Sub-scores:**
- Color: 85 — Warm paper / aubergine / accent purple well-chosen; border-subtle is appropriately quiet. Minor: green/red status dots on sidebar sub-items are small but sufficient.
- Typography: 82 — Inter Variable correctly loaded; scale is compact (13px body per spec). Heading hierarchy clear: "Projects" (text-2xl/semibold) > card name (text-xl/semibold) > helper (text-base/secondary). No gradient text. Line-length could exceed 75ch on wide cards at 1440px.
- Layout: 88 — 240px sidebar + 1fr content is solid. 3-col card grid at desktop works. Empty state at >2 projects will feel better. Large lower whitespace at 2 projects is acceptable.
- Spacing: 86 — PageHeader has good breathing room. HomeToolbar margins consistent. Card padding (p-4) consistent across grid.
- Hierarchy: 87 — Clear visual hierarchy from sidebar sections to content headings to cards. Disabled OBSERVE items visually recede (correct intent).
- Accessibility: 80 — Skip-to-main link present. Sidebar `aria-label="Primary navigation"`. Icon-only settings link in TopBar lacks visible label (text-only in sidebar). Focus ring uses accent color (good). ThemeChip button has aria label.

**Composite: 85**
**Pass (>=90):** No

**Priority issues:**
1. **Icon-only settings link in TopBar** — The gear icon in the TopBar has only `aria-label="Settings"`, no visible label. Users scanning visually need to hover/focus to confirm purpose. Fix: add a visible label or replace with labelled button. (P2)
2. **Disabled OBSERVE items have no tooltip** — "Skills", "Health", "Reviews" appear greyed but give no explanation. Fix: add `title` attribute or tooltip on hover indicating "Available in Phase 6". (P3)
3. **No route-level empty state hint to /onboarding** — If a new user lands at `/` without registering any projects, the DaemonUnreachableState shows a generic error rather than directing to /onboarding. (P2)

---

### Route 2: `/` @ 768x1024 (tablet)

**Visual inspection:** Sidebar stays at 240px. Content area ~530px. Filter chips row remains in one line. Cards switch to 2-col. Search field and sort dropdown both visible. "Register project" drops to full column-1 width. Logo and sidebar fully functional.

**Nielsen heuristic score (delta from desktop):** Same scores — the layout holds reasonably at 768px. The sidebar's fixed 240px column is a bit aggressive at tablet (31% of viewport) but usable.

**Sub-scores:**
- Color: 85 | Typography: 80 | Layout: 76 | Spacing: 82 | Hierarchy: 85 | Accessibility: 78

**Composite: 81** — Layout drops due to sidebar consuming 31% at tablet; search bar gets compressed.
**Pass (>=90):** No

**Priority issues:**
1. **Sidebar not collapsible at tablet** — 240px sidebar leaves only 530px content at 768px. Consider a narrow (60px icon-only) collapsed mode at <900px. (P2)
2. **Filter chips + search on same row gets compressed** — at 768px, the chips row on the toolbar wraps. Toolbar layout needs responsive adjustment. (P2)

---

### Route 3: `/` @ 390x844 (mobile)

**Visual inspection:** CRITICAL — Sidebar does NOT collapse. 240px sidebar occupies 62% of 390px viewport. Content area is only ~150px. TopBar breadcrumb "All Projects" wraps to two lines. Project cards are barely readable. Filter chips overflow off-screen. The layout is essentially broken at mobile.

**Nielsen heuristic scores (delta):** H8 drops to 0 (content is unusable), H3 drops to 1 (no way to hide sidebar).

**Sub-scores:**
- Color: 85 | Typography: 60 | Layout: 25 | Spacing: 40 | Hierarchy: 45 | Accessibility: 50

**Composite: 51** — Layout failure dominates.
**Pass (>=90):** No

**Priority issues:**
1. **[P1] No mobile sidebar collapse** — The 240px sidebar is hardcoded in the grid, making the app effectively unusable below ~600px. Requires a hamburger toggle or CSS media-query breakpoint to `display:none` or narrow the sidebar at <768px.
2. **[P1] TopBar wraps at mobile** — Breadcrumb text wraps; Cmd+K button and ThemeChip get pushed. TopBar needs responsive treatment.
3. **[P1] Filter chips overflow** — chip row doesn't wrap or scroll, chips are cut off.

---

### Route 4: `/projects/agenticapps-dashboard` @ 1440x900

**Visual inspection:** Rich single-project view. 3-column layout: Commitment (monospace text, phase 6 CLAUDE output), Phase Progress (file list with timestamps + colored status dots), and right column with Skill Health (warning banner), Observability (empty state), Secrets (no .infisical.json), Integrations (Sentry NOT DETECTED with long config instructions). Sidebar shows current project highlighted in aubergine. TopBar: breadcrumb "All Projects > agenticapps-dashboard", plus phase pill "Phase 06-polish-service-install-acceptance".

**Nielsen's 10 Heuristics:**

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "Agent unreachable — retrying..." visible in Skill Health with warning icon. File timestamps (3h ago, 24m ago) convey recency. |
| 2 | Match System / Real World | 3 | "Commitment" heading is developer-workflow language (appropriate). "No .infisical.json detected" is clear. Sentry setup instructions use code formatting. |
| 3 | User Control and Freedom | 2 | No way to collapse the right-column integration panels. Commitment text is read-only monospace (appropriate). Long right column requires scrolling to see all integrations. |
| 4 | Consistency and Standards | 3 | Panel heading style consistent across all 4 columns. Status dots use semantic colors. |
| 5 | Error Prevention | 3 | "Configure to enable" pattern prevents confusion about unconfigured integrations. Read-only view prevents accidental edits. |
| 6 | Recognition Rather Than Recall | 3 | Phase Progress file list shows all PLAN files with status. Skill Health prominently shows warning. |
| 7 | Flexibility and Efficiency | 2 | No way to jump to specific panel. Command palette accessible. |
| 8 | Aesthetic and Minimalist Design | 2 | Integrations right panel with lengthy Sentry setup copy is visually heavy. "No .infisical.json detected" and Observability empty states all on screen simultaneously creates clutter. Long Sentry instructions text is noisy. |
| 9 | Error Recovery | 3 | "Agent unreachable — retrying..." gives clear status. |
| 10 | Help and Documentation | 2 | Sentry integration shows actionable setup instructions inline (good). No link to actual docs. |
| **Total** | | **26/40** | **Acceptable** |

**Cognitive Load checklist:** 2 failures (Moderate)
- [ ] Single focus: 4 columns with different content types compete simultaneously
- [ ] Minimal choices: Right column has 4 different integration empty states at once

**AI Slop verdict:** No — the data density is functional and clearly serves developers monitoring project state. The Sentry integration description copy is generic SaaS placeholder text style.

**Sub-scores:**
- Color: 82 | Typography: 80 | Layout: 84 | Spacing: 80 | Hierarchy: 79 | Accessibility: 78

**Composite: 81**
**Pass (>=90):** No

**Priority issues:**
1. **Integrations right column is information-overloaded** — 4 empty states (Sentry verbose config, Observability, Secrets, Integrations) simultaneously visible creates noise. Consider collapsing unconfigured integrations to a single "Configure integrations" section. (P2)
2. **Phase pill in TopBar is verbose** — "Phase · 06-polish-service-install-acceptance" is 35+ characters and visually dominates the breadcrumb area. Consider showing only the phase number or a truncated name. (P3)
3. **Commitment column monospace text density** — The Claude CLAUDE output text in a narrow monospace column (with line wraps) is hard to scan. Consider a subtle `<details>` progressive disclosure. (P2)

---

### Route 5: `/settings` @ 1440x900

**Visual inspection:** PageHeader "Settings" with helper text. "Manual pair" section inside a Card component with Agent URL and Token text fields pre-populated (real token visible in plaintext). "Save & connect" button in accent purple. Theme section below with radio buttons using `border-l-2` active indicator (AI slop side-stripe).

**Nielsen's 10 Heuristics:**

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Form shows current values. No connection status indicator on the page. |
| 2 | Match System / Real World | 4 | "Agent URL", "Token", "Save & connect" — clear developer language. |
| 3 | User Control and Freedom | 3 | Can edit both fields; cancel by navigating away. |
| 4 | Consistency and Standards | 3 | Button style matches rest of app. Input border style consistent. |
| 5 | Error Prevention | 3 | Helper text "Loopback or *.ts.net only" and "71 characters, dash-separated" prevent invalid entries. |
| 6 | Recognition Rather Than Recall | 3 | Fields pre-populated with current values. |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcut to submit. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean two-section layout. Token visible in plaintext is a visual concern. ThemeToggle side-stripe is an AI-slop tell. |
| 9 | Error Recovery | 2 | Form submits and shows error/success alert inline (good). But no inline field validation before submit. |
| 10 | Help and Documentation | 2 | Helper text is inline (good). No link to full docs. |
| **Total** | | **28/40** | **Good** |

**Cognitive Load checklist:** 0 failures (low — good)

**AI Slop verdict:** Borderline — ThemeToggle uses `border-l-2` side-stripe accent which is listed in the absolute bans. Token field displaying full value in plaintext reads as an oversight.

**Sub-scores:**
- Color: 84 | Typography: 84 | Layout: 88 | Spacing: 87 | Hierarchy: 85 | Accessibility: 82

**Composite: 85**
**Pass (>=90):** No

**Priority issues:**
1. **[P2] ThemeToggle border-l-2 side-stripe is an absolute ban** — `border-l-2 border-l-accent` on the radio label is the canonical AI slop tell listed in the impeccable skill's absolute bans. Replace with a background tint or a full border. Detector also flagged this.
2. **[P2] Token visible in plaintext** — The bearer token is pre-populated in clear text. Consider masking with `type="password"` or a show/hide toggle. Security UX concern.
3. **[P3] Theme section lacks visual container** — "Manual pair" has a Card container; "Theme" does not. Inconsistent sectioning pattern.

---

### Route 6: `/help` @ 1440x900

**Visual inspection:** Sparse placeholder. PageHeader "Help" + helper "Reference and troubleshooting." One Card with heading "Help" and body "Detailed help arrives in Phase 6. For now, see the README at github.com/agenticapps-eu/agenticapps-dashboard." No additional content. Correct placeholder state per Phase 5.1 plan.

**Nielsen's 10 Heuristics:**

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Clear indication that this is a placeholder state. |
| 2 | Match System / Real World | 3 | Language is plain. |
| 3 | User Control and Freedom | 3 | Can navigate back via sidebar. |
| 4 | Consistency and Standards | 3 | Page structure matches other routes. |
| 5 | Error Prevention | 3 | No user input possible. |
| 6 | Recognition Rather Than Recall | 2 | Link to GitHub README is good. No way to search or find help inline. |
| 7 | Flexibility and Efficiency | 1 | One link. No search. |
| 8 | Aesthetic and Minimalist Design | 4 | Minimal — nothing unnecessary. |
| 9 | Error Recovery | 3 | N/A for placeholder. |
| 10 | Help and Documentation | 1 | The help page IS the documentation — it's empty. "Phase 6" placeholder is developer jargon. |
| **Total** | | **25/40** | **Acceptable** |

**Cognitive Load checklist:** 1 failure (low — acceptable for placeholder)

**AI Slop verdict:** No — the minimalism is honest and appropriate for a placeholder.

**Sub-scores:**
- Color: 85 | Typography: 82 | Layout: 87 | Spacing: 85 | Hierarchy: 80 | Accessibility: 84

**Composite: 84** (held down by lack of actual content — placeholder scored fairly)
**Pass (>=90):** No

**Priority issues:**
1. **[P2] Placeholder copy leaks internal development language** — "Detailed help arrives in Phase 6" exposes the internal phase numbering to users. Replace with "Comprehensive documentation is coming soon." (P3)
2. **[P3] No quick-links to key docs** — Even a bulleted list of 3-4 key GitHub links would substantially improve this page before Phase 6 content lands.

---

### Route 7: `/onboarding` @ 1440x900

**Visual inspection:** Renders without the AppShellV2 shell (correct per D-5.1-03). Full-width centered layout. H1 "One local daemon. Every device." (32px/semibold/tracking-tight) with subtitle "Nothing leaves your machine." Below: 3 numbered steps with CodeBlock components (monospace command display + copy button). `<details>` disclosure for "Why local-only". Warm paper background continues.

**Nielsen's 10 Heuristics:**

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No indication of current pairing status or progress through steps. |
| 2 | Match System / Real World | 4 | Commands are exact CLI commands; step 3 references the actual pair URL format. |
| 3 | User Control and Freedom | 3 | Back navigation via browser. Details element for disclosure. |
| 4 | Consistency and Standards | 3 | CodeBlock style consistent. Step numbering is a circle — slightly different from numbered list convention. |
| 5 | Error Prevention | 3 | Commands pre-filled with exact syntax prevents copy errors. |
| 6 | Recognition Rather Than Recall | 4 | All three commands visible in code blocks; no recall required. |
| 7 | Flexibility and Efficiency | 2 | Copy buttons on all code blocks. No "open terminal here" shortcut. |
| 8 | Aesthetic and Minimalist Design | 4 | Clean, focused, no distractions. Only necessary information. |
| 9 | Error Recovery | 2 | No inline help if installation fails. "Why local-only" disclosure is informational not recovery. |
| 10 | Help and Documentation | 3 | The page IS the onboarding doc — well-structured for the task. |
| **Total** | | **30/40** | **Good** |

**Cognitive Load checklist:** 0 failures (low — excellent)

**AI Slop verdict:** No — The "One local daemon. Every device." headline is distinctive and specific. The step numbering with filled circles is not the typical AI card-grid template.

**Sub-scores:**
- Color: 86 | Typography: 86 | Layout: 90 | Spacing: 88 | Hierarchy: 88 | Accessibility: 85

**Composite: 87**
**Pass (>=90):** No (close — layout meets 90, overall held back by sparse error recovery and status visibility)

**Priority issues:**
1. **[P2] Step h2 labels are undersized** — "Install the agent" (14px/semibold) is barely differentiated from the body copy at 13px. Consider 16px for step headings.
2. **[P3] No visual indicator that user is already paired** — If user visits /onboarding while already paired, there's no notification. A banner "You're already paired — go to dashboard" would prevent confusion.

---

### Route 8: `/pair?...` @ 1440x900 (error state)

**Visual inspection:** The token in the test URL fails format validation. The pair-error.tsx route renders without the shell (correct). Centered card: heading "This pair URL doesn't look right", body "The agent or token parameters didn't validate. Open /onboarding and click the pair URL printed by the agent." with "Open onboarding" button. Clean error card but occupies a tiny fraction of the 1440px viewport — vast empty space below.

**Nielsen's 10 Heuristics:**

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Clear error state with heading and explanation. |
| 2 | Match System / Real World | 3 | "pair URL" and "agent" are domain-appropriate terms. |
| 3 | User Control and Freedom | 3 | "Open onboarding" button provides escape. Browser back available. |
| 4 | Consistency and Standards | 3 | Warm paper background continues. Card style consistent. |
| 5 | Error Prevention | 3 | Error message diagnoses what went wrong. |
| 6 | Recognition Rather Than Recall | 3 | "Open onboarding" is a recognizable action. |
| 7 | Flexibility and Efficiency | 2 | Only one recovery action provided. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean card but the vast empty space below the card feels unintentional at desktop. |
| 9 | Error Recovery | 3 | Clear error heading + actionable button. |
| 10 | Help and Documentation | 2 | Only directs to /onboarding — no inline explanation of what a valid pair URL looks like. |
| **Total** | | **28/40** | **Good** |

**Cognitive Load checklist:** 0 failures (excellent — single focused error state)

**AI Slop verdict:** No — the error UX is functional and specific.

**Sub-scores:**
- Color: 84 | Typography: 83 | Layout: 80 | Spacing: 84 | Hierarchy: 85 | Accessibility: 83

**Composite: 83**
**Pass (>=90):** No

**Priority issues:**
1. **[P3] Large empty canvas below error card at desktop** — The error card is centered at max-w-2xl in a full 1440px viewport. Consider adding visual treatment (subtle decorative element or fuller centering with min-height) to prevent the vast empty space from feeling broken.
2. **[P3] No example of valid pair URL format** — The error message could include `Valid format: https://dashboard.agenticapps.eu/pair?agent=...&token=<71-char-token>` to help users diagnose their error.

---

## Composite scores

| Route | Breakpoint | Composite | Color | Typography | Layout | Spacing | Hierarchy | Accessibility | Pass (>= 90)? |
|-------|-----------|-----------|-------|------------|--------|---------|-----------|---------------|--------------|
| / | 1440x900 | 85 | 85 | 82 | 88 | 86 | 87 | 80 | no |
| / | 768x1024 | 81 | 85 | 80 | 76 | 82 | 85 | 78 | no |
| / | 390x844 | 51 | 85 | 60 | 25 | 40 | 45 | 50 | no |
| /projects/agenticapps-dashboard | 1440x900 | 81 | 82 | 80 | 84 | 80 | 79 | 78 | no |
| /settings | 1440x900 | 85 | 84 | 84 | 88 | 87 | 85 | 82 | no |
| /help | 1440x900 | 84 | 85 | 82 | 87 | 85 | 80 | 84 | no |
| /onboarding | 1440x900 | 87 | 86 | 86 | 90 | 88 | 88 | 85 | no |
| /pair (error) | 1440x900 | 83 | 84 | 83 | 80 | 84 | 85 | 83 | no |

**Cells at or above 90:** `/onboarding` Layout (90). All others below 90.

---

## Below-90 deltas (where polish is needed)

### Critical failures (score < 70)

**`/` @ 390x844 — Layout: 25, Spacing: 40, Hierarchy: 45, Typography: 60, Accessibility: 50**
- Issue: No mobile sidebar collapse. 240px sidebar occupies 62% of 390px viewport. Content unusable.
- Suggested command: `$impeccable adapt /` — responsive/adaptive layout fix

**`/` @ 768x1024 — Layout: 76**
- Issue: Sidebar still 31% of viewport at tablet; filter toolbar compressed.
- Suggested command: `$impeccable adapt /` — tablet sidebar treatment

### Moderate failures (score 76-89)

**`/` @ 1440x900 — Accessibility: 80**
- Issue: Icon-only TopBar settings link; no tooltip on disabled OBSERVE items.
- Suggested command: `$impeccable audit /` — accessibility pass

**`/` @ 1440x900 — Typography: 82**
- Issue: Body line-length may exceed 75ch on wide cards at 1440px.
- Suggested command: `$impeccable typeset /`

**`/projects/:id` @ 1440x900 — Hierarchy: 79, Accessibility: 78**
- Issue: 4 integration empty states simultaneously compete; Commitment column text density.
- Suggested command: `$impeccable distill /projects/:id`

**`/settings` @ 1440x900 — Accessibility: 82**
- Issue: Token in plaintext; ThemeToggle side-stripe (absolute ban).
- Suggested commands: `$impeccable polish /settings`, `$impeccable harden /settings`

**`/pair` @ 1440x900 — Layout: 80**
- Issue: Large empty canvas below centered error card at desktop.
- Suggested command: `$impeccable layout /pair`

---

## Deterministic detector findings (Assessment B)

Result of `npx impeccable packages/spa/src --json` (exit code 2 = findings detected):
- **Exit code:** 2
- **Total findings:** 10
- **By severity:** {medium: 10} (all 10 rated medium — no critical, no high, no low)
- **Top anti-patterns detected:**

| Anti-pattern | Count | Files |
|---|---|---|
| `side-tab` | 4 | ManualPairForm.tsx (×2 alert states), RegisterModal.tsx (×1), ThemeToggle.tsx (×1) |
| `pure-black-white` | 4 | CommandPalette.tsx (`bg-black` modal overlay), RegisterModal.tsx (`bg-black` backdrop), RenameTagsForms.tsx (×2 `bg-black` backdrop) |
| `bounce-easing` | 2 | ProjectCard.test.tsx (×2 — `animate-bounce` in test assertions, NOT in production code) |

**Notes:**
- `bounce-easing` findings are false positives: they appear in test files (ProjectCard.test.tsx lines 276, 292) asserting that `animate-bounce` is NOT present in production code. The production ProjectCard.tsx does not use bounce easing.
- `pure-black-white` findings for `bg-black` are modal backdrops (overlay scrim behind dialogs). These are intentionally dark — the spec's warm neutrals don't apply to transparent overlay scrims. However, per the impeccable absolute ban these should use `bg-app-bg/80` or similar tinted overlay rather than pure `bg-black`. Medium-priority fix.
- `side-tab` findings are genuine: `border-l-2` used as selected-state accent on ThemeToggle labels and as alert styling in ManualPairForm. The impeccable skill's absolute ban covers "border-left or border-right greater than 1px as a colored accent." All 4 occurrences are genuine violations.

**True positives:** 8 (4 side-tab + 4 pure-black-white)
**False positives:** 2 (bounce-easing in test files)

---

## D-6-19 verdict

**Phase 3 baseline (against deleted dark-theme AppShell):** Color 76, Typography 78, Layout 84 on `/` @ desktop.

**Phase 5.1 measured (this baseline) for `/` @ 1440x900:** Color **85**, Typography **82**, Layout **88**.

All three sub-scores have improved vs Phase 3:
- Color: 76 → 85 (+9) — warm paper palette is significantly more refined than the old dark AppShell
- Typography: 78 → 82 (+4) — Inter Variable + compact type scale is cleaner
- Layout: 84 → 88 (+4) — Cloudflare-inspired sidebar shell is structurally stronger

**Verdict:** REMAINING DELTA — all three sub-scores have improved beyond Phase 3, but none reach the Phase 6 gate of ≥ 90. Polish work required in 06-06:

| Dimension | Current | Gate | Delta needed |
|-----------|---------|------|-------------|
| Color (/) | 85 | 90 | +5 — primary: pure-black backdrop scrims, ensure all color uses OKLCH-tinted neutrals |
| Typography (/) | 82 | 90 | +8 — primary: body line-length cap, step heading size in onboarding, font-weight contrast at smaller sizes |
| Layout (/) | 88 | 90 | +2 — primary: mobile sidebar collapse (critical for overall score; mobile composite 51 drags below 90) |

The most urgent single fix is the **mobile sidebar collapse** (Layout @ 390x844: 25). This is a P1 issue that must be addressed before the ≥ 90 gate can be achieved on any mobile metric. The desktop Layout at 88 is close to the gate — a mobile-responsive sidebar would lift the overall Layout average above 90.

The 8 genuine detector findings (4 side-tab, 4 pure-black-white) are addressable in a single focused polish pass.

---

## What this enables

- **06-06 (POLISH-04 / impeccable CI gate)** has calibrated `>= 90` targets measured against Phase 5.1 — not the stale Phase 3 baseline. The dimensions needing lift: Color +5, Typography +8, Layout +2 (desktop), mobile Layout +65.
- **Phase 5.1 AC-08** (after-shell.png on /projects/:id) is closed via the third reference screenshot captured above.
- **The 3 PNGs in refs/** are diff baselines for any future redesign regression check:
  - `baseline-home.png` — `/` @ 1440x900 (canonical comparison point)
  - `baseline-project.png` — `/projects/agenticapps-dashboard` @ 1440x900
  - `../DASH-05.1-*/refs/after-shell.png` — single-project view @ 1440x900 (Phase 5.1 AC-08)
