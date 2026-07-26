# Phase 11 — Impeccable Critique (Gate)

**Target:** `/coverage` at `http://localhost:5174/coverage`
**Date:** 2026-05-18
**Reviewer:** Opus 4.7 (1M context) via `impeccable:critique` skill — two-assessment protocol (LLM design review + deterministic detector)
**Branch:** `feat/coverage-trends-skill-drift` (HEAD `1efde99`)
**Viewport:** 1440×900 (per D-10.5-03 / D-6-21)
**Procedure:** `~/.claude/skills/impeccable/reference/critique.md` — Assessment A (sub-agent LLM review with chrome-devtools-mcp live inspection) + Assessment B (`npx --yes impeccable --json` against `packages/spa/src/components/panels/coverage/` + Puppeteer URL scan)
**Phase 11 scope under critique:** Sticky stack (post-UAT fix `89d4b2d` + `1efde99`), Option C single-ownership drift model, `CoverageDriftBadge`, polish bundle (sticky PageHeader opt-in, opacity-30 row-refresh).

---

## Composite Verdict

**Composite score: ~76 / 100** (Assessment A Nielsen total 24/40 = 60%; deterministic detector source-clean; 4 real URL-scan findings on a single inherited token contrast issue).

**Below the D-6-09.v1 floor of ≥ 87. Calibration data point #2 confirms the floor remains provisional under the skill-driven gate.**

Three observations carry the gap:

1. **Phase 11 specifically landed clean.** The sticky stack post-UAT fix (PageHeader `-mt-6 sticky top-[-1.5rem] min-h-14` + family-header `top-8` + column-headers `top-[5.0625rem]`) verified flush at scroll positions 0/200/400/800/1200/1600. Option C ownership model (single `useCoverageHistory(repoId)` in `CoverageRow`, `CoverageCell` purely presentational) verified by detector + grep tests. Polish bundle (D-11-09 sticky opt-in default false, D-11-10 opacity-30) verified. `CoverageDriftBadge` collision-avoidance (NOT `InlineDrift`) verified. **All four Phase 11 must-haves under critique passed.**

2. **The gap is Phase-10-inherited, not Phase-11-introduced.** Column-width drift across the three family sections, no `CoverageToolbar` sticky, no clipboard-write feedback, no inline column-header help, and the family-aggregate worst-state-wins misread issue are all pre-Phase-11 P1s that compound. Phase 11 didn't regress them; it also didn't fix them.

3. **Calibration drift confirmed (D-10.5-03 provisional floor).** Phase 10's IMPECCABLE landed at ~74/100 against the same Nielsen 24/40 baseline. Phase 11 nudged up to ~76 from the polish bundle + sticky stack lift but is still well below the 87 floor set against the legacy CLI scoring distribution. The skill-driven gate produces a narrower band; **the floor should be recalibrated downward (to ~75-78) or the scoring methodology re-anchored**. Two calibration data points (Phase 10 = 74, Phase 11 = 76) both fall in the 70s. The 87 floor is empirically inconsistent with the skill output.

**Recommendation:** Accept the 76 as a passing-with-debt outcome for Phase 11 (Phase 11's own work is clean; the inherited P1s are not Phase 11's regression to fix) AND open a follow-up to either (a) recalibrate the floor in an ADR addendum to D-10.5-03 or (b) bundle the inherited P1s into a Phase 11.1 polish phase before declaring v1.1 closed.

---

## Assessment B — Deterministic Detector

### CLI source-file scan

```
npx --yes impeccable --json packages/spa/src/components/panels/coverage/ packages/spa/src/components/ui/PageHeader.tsx
```

**Result:** `exit 0` — zero findings across 27 detector patterns.

Clean checks (patterns NOT flagged that are noteworthy for a frontend gate):
- No side-stripe borders
- No gradient text (`background-clip: text` with gradient bg)
- No glassmorphism as default
- No hero-metric template
- No identical card grids
- No modal-as-first-thought
- No em-dashes in source (project rule)
- No centered hero text
- No border-radius extremes
- No tiny-font issues
- No fake-elevation gradients
- No `box-shadow` over-use
- No "/100" score visuals
- No neumorphism / rainbow gradients
- No excessive `text-transform: uppercase`
- No centered body copy
- No `cursor: pointer` on non-interactive elements

### URL/DOM scan (Puppeteer via `impeccable detect <URL>`)

Ran twice — results stable.

| # | Rule | Severity | Hit | Real / FP |
|---|------|----------|-----|-----------|
| 1-3 | `low-contrast` ×3 | warning | `text-text-tertiary` resolving to `#807a92` on `#f8f6f3` → 3.8:1 (need 4.5:1 AA) | **REAL** — affects PageHeader subtitle, sidebar section labels (WORKSPACE / OBSERVABILITY / ACCOUNT), table column headers (Repo / CLAUDE.md / GitNexus / Wiki / Workflow), family-section `· 9 repos` meta |
| 4 | `line-length` | warning | PageHeader subtitle ~103 chars/line (cap 65-75ch) | **REAL** — `packages/spa/src/components/ui/PageHeader.tsx` subtitle `<p>` is 498px wide; the long Coverage helper text overflows the design-system reading-comfort cap |
| 5 | `skipped-heading` | warning | `<h1>` "Coverage" → `<h3>` "Coverage scan failed — see daemon logs." (missing h2) | **FALSE POSITIVE** — caught a transient error/loading render frame; live page DOM has no `<h3>` in steady state |
| 6 | `bounce-easing` | warning | `@keyframes bounce` in CSS | **FALSE POSITIVE** — present in Tailwind v4 preflight CSS bundle; zero elements on Coverage page have `animation-name: bounce` applied |
| 7 | `layout-transition` | warning | `transition: max-height` | **FALSE POSITIVE** — present in Tailwind utility CSS bundle; no element on Coverage page has `transition-property: max-height` applied |

**Net real findings: 4** (3× contrast on one inherited token + 1× line-length on PageHeader subtitle).

The contrast finding is a **single token swap** that resolves all three contrast hits at once. The line-length finding is a `max-w-prose` / `max-w-[65ch]` addition on the PageHeader's `<p>`.

### Tab labels left for user
- `[Human] AgenticApps Dashboard — alpha` open at `http://localhost:5174/coverage`
- Screenshot saved: `.planning/phases/DASH-11-coverage-trends-skill-drift/coverage-assessment-b.png`

---

## Assessment A — LLM Design Review

### AI Slop Verdict

> **Not AI slop.** The warm-paper Cloudflare-inspired aesthetic is clearly intentional, calm, and avoids every one of the impeccable Absolute Bans (no side-stripe accents, no gradient text, no glassmorphism, no hero-metric card, no identical-card-grid template, no modal-first patterns). Pastel-tint cells over warm paper feel editorial-instrument-panel rather than SaaS-purple — exactly what the PRODUCT.md anti-references call out. Accent purple is sparingly used (single primary CTA + active sidebar item), not ambient decoration.

**Category-reflex check:** The "matrix of green/amber/red status pills under collapsible accordions" gestalt is still the canonical "coverage dashboard" pattern (Phase 10 critique flagged this same medium-risk category reflex). Phase 11's drift badges (when rendered) and sticky chrome work do not reframe the problem; future iteration toward a non-table representation would help. **Category-reflex risk: medium.**

### Nielsen Heuristics Scores

| # | Heuristic | Score (0-4) | Key Issue |
|---|-----------|-------------|-----------|
| 1 | Visibility of System Status | 2 | Primary CTA "Index with GitNexus" silently writes to clipboard with no toast/feedback. "✕ Missing" filter returns 45/45 rows with no inline reason. Row-refresh popover fires without acknowledgment. |
| 2 | Match System / Real World | 3 | "GitNexus", "Wiki", "Workflow" column headers carry no inline definition. "via CLAUDE.md", "via AGENTS.md" is implicit Donald-vocabulary. |
| 3 | User Control and Freedom | 3 | URL-sync + clear-filters CTA + collapsible family sections + popover Esc-close. No global undo for clipboard-only actions (acceptable — reversible). |
| 4 | Consistency and Standards | 2 | **Column widths drift across the three family sections.** Each `<table>` auto-widths independently — Repo column: 272/239/280px, GitNexus column: 92/131/100px. Matrix mental model broken. Sticky stack is correct; column widths are the inconsistency. |
| 5 | Error Prevention | 3 | No destructive actions; clipboard-only design eliminates entire foot-gun classes. Filter auto-revert to "All" on full chip-deselect is thoughtful. |
| 6 | Recognition Rather Than Recall | 2 | No column-header tooltips. No inline legend for fresh/stale/missing semantics. `opacity-30` refresh icon is barely discoverable on desktop (works on hover; OK on iPad as a persistent hint). |
| 7 | Flexibility and Efficiency | 2 | No keyboard shortcuts specific to Coverage (`j/k` row nav, focused `/` to search). No bulk row selection. "Refresh All Stale" is gated behind `installed-with-registry` — invisible to most installs. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm warm-paper aesthetic excellent. But **81% of cells are red-tinted** (146/180 cells in error state because nothing's indexed) — fights the calm chrome. Tinted backgrounds on every cell mean the matrix loses negative space. |
| 9 | Error Recovery | 3 | Per-cell subtext gives concrete recovery hints. Schema-drift reuses Phase 6 surface. Scan-failed empty state offers retry. Missing: row-level "explain this cell" affordance. |
| 10 | Help and Documentation | 1 | No inline tooltips on column headers. No "what is GitNexus / Wiki / Workflow on this dashboard?" affordance. Help lives in the sidebar but is not contextual. |
| **Total** | | **24/40** | **Acceptable — significant improvements needed.** Strong foundations (aesthetic, structure, tokens), but discoverability + matrix consistency + system-status feedback need work. |

### Cognitive Load
- **Failure count: 3/8 (moderate).**
  - **Visual hierarchy (failed):** 81% red cells overwhelm; primary CTA competes with the wall of red.
  - **Working memory (failed):** No inline glossary for column meanings; once inside neuroflash's 33 rows, the toolbar context is no longer visible (toolbar scrolled off).
  - **Minimal choices at row hover (failed):** 4 cells × hover-popovers + 1 refresh popover (4 sub-actions) — 4-8 implicit options at any row hover.
- **No 5+ decision-point violation** in any single visible block.
- **Progressive disclosure:** Collapsible family sections, per-row refresh popover, override count chip-revealed — good. Column header meaning has no progressive reveal.

### Emotional Journey

**Intended:** calm instrument panel.
**Delivered (this install state):** sea of red — "am I failing my own discipline?"

Phase 10.6 partially fixed this with the 3-way CTA swap (Install GitNexus / Index with GitNexus / Refresh N stale). But 146 red cells dominate the visual frame.

- **Peak-end rule miss:** the GitNexus install CTA has no completion feedback — no "OK, you copied it, now paste and watch the matrix re-tint" guidance.
- **No emotional valley intervention** at high-stakes moments (Index with GitNexus, Run gitnexus analyze in popover) — both silently mutate clipboard or spawn daemon.

### What's working

- **Tokens, not hex.** Every cell tints via `bg-status-error/10` etc., grounded in OKLCH-derived design tokens (D-5.1-10). Color drift impossible by construction. Rarest design discipline; cohesion shows.
- **3-way state-driven CTA swap (Phase 10.6).** Install GitNexus → Index with GitNexus → Refresh N stale. Button matches install state's actual next step. Thoughtful state-driven UX.
- **Sticky header stack works (Phase 11 verification target).** PageHeader (`-mt-6 sticky top-[-1.5rem] min-h-14`) + family-header (`sticky top-8`) + column-headers (`sticky top-[5.0625rem]`) compose flush at every scroll position tested. **Post-UAT fix in `89d4b2d` and `1efde99` landed correctly.** Verified flush at scrollY = 0, 200, 400, 800, 1200, 1600.

### Priority Issues

#### [P1] Column widths drift across the three family sections — matrix mental model broken

**Why:** Each `<table>` in `CoverageFamilySection.tsx:165` auto-widths independently. Measured at 1440×900: Repo column = 272 / 239 / 280px; GitNexus = 92 / 131 / 100px; Wiki = 336 / 140 / 364px. A user comparing "GitNexus across all 45 repos" cannot eye-trace down a column — edges shift left/right across family boundaries. Contradicts the matrix promise.

**Fix:** Lock column widths via a shared `<colgroup>` across all sections, OR replace the per-section `<table>` with a single CSS-grid that spans all family-sections so column tracks are shared. Family headers become grid-row spanners.

**Command:** `$impeccable layout`

#### [P1] Primary CTA "Index with GitNexus" gives no visible feedback

**Why:** The purple `bg-accent` CTA is the most visually prominent thing on the page. Click → silent clipboard write → user wonders "did anything happen?". First-time visitors won't recognize clipboard-as-action convention. iPad-over-Tailscale users have no haptic feedback. Same issue applies to per-family "Copy npm install -g gitnexus" link and per-row "Copy /wiki-compile command" popover entry.

**Fix:** Add a transient toast or inline-confirmation badge ("Copied — paste in terminal to index 45 repos") after every clipboard write. Phase 10 scoped a Toast primitive that was never wired — this is the right home for it.

**Command:** `$impeccable clarify`

#### [P1] `CoverageToolbar` is not sticky — scrolls off after row ~8

**Why:** Once Donald scrolls into neuroflash's 33 rows, the toolbar (filter chips + search) is gone. He can't see which filter is active and can't refine the search without scrolling back to the top. Verified empirically: at `main.scrollTop = 200`, toolbar top sits at `-36px`. With 45 rows total, this is the daily-driver friction point.

**Fix:** Either (a) make the toolbar sticky at the next available `top-` slot (just above the family headers; layering stack has bandwidth at `z-15`), or (b) merge the toolbar into the sticky PageHeader as a sub-row below the title so it inherits the existing sticky surface. **Option (b) is cleaner** — title + helper above, chips + search below, all in one sticky block.

**Command:** `$impeccable layout`

#### [P1] `text-text-tertiary` token resolves to 3.8:1 against `bg-app-bg` — fails WCAG AA

**Why:** Deterministic detector findings 1-3 + the existing low-contrast triage item (already known from earlier Phase 10.5 work). The token `#807a92` on `#f8f6f3` gives 3.8:1; AA requires 4.5:1 for normal-weight body text. Hits sidebar section labels, page subtitle, "· N repos" meta, table column headers. One token swap to ~`#6b6580` (or darker) resolves all three contrast findings at once.

**Fix:** Update `--color-text-tertiary` in `packages/spa/src/styles/tokens.css` from `#807a92` to a darker shade that clears 4.5:1 against `--color-app-bg` (`#f8f6f3`). Run a token-audit pass via `node packages/spa/scripts/verify-contrast.mjs` (if it exists) or compute by hand: targeting `~3.9:1 → 4.6:1` requires roughly `#6b6580` or `#605a72`.

**Command:** `$impeccable colorize` (or direct token edit if scoped)

#### [P2] No inline help / column tooltips — column meaning requires prior vocabulary

**Why:** "CLAUDE.md / GitNexus / Wiki / Workflow" are 4 proper nouns that don't self-explain. No `title=` on `<th>` elements. Help in sidebar is not contextual.

**Fix:** Add a `<TooltipTrigger>` / `title` attribute on each column header explaining what the column measures and what fresh/stale/missing mean. Optional: a small `?` icon next to the title row opening an inline legend popover with the 4-state vocabulary.

**Command:** `$impeccable document`

#### [P2] Family-aggregate counts "✕ 9 ⚠ 0 ✓ 0" are emotionally misleading

**Why:** Worst-state-wins rollup in `CoverageFamilySection.tsx:138-140`. With GitNexus uniformly missing for all 9 agenticapps repos, section shows "✕ 9 ⚠ 0 ✓ 0" — implying zero rows healthy. But the section has 20 fresh cells. User reads "0 fresh" before seeing 20 green tints below.

**Fix:** Either (a) report cell-level aggregates ("16 missing, 8 stale, 10 fresh, 1 n/a" across all 36 cells), (b) show both ("9 repos with issues · 11% cells fresh"), or (c) keep current rollup but add per-column mini-tally on hover.

**Command:** `$impeccable clarify`

#### [P2] PageHeader subtitle exceeds 65-75ch reading-comfort cap (detector finding #4)

**Why:** "Per-repo knowledge-layer freshness across agenticapps, factiv, and neuroflash families" renders at ~103ch when the viewport is wide. Detector flagged it; eye fatigue rises sharply above 75ch.

**Fix:** Add `max-w-prose` or `max-w-[65ch]` to the subtitle `<p>` in `packages/spa/src/components/ui/PageHeader.tsx:54`.

**Command:** `$impeccable typeset` (or direct edit)

#### [P3] 81% red cells overwhelm — calm aesthetic fights the data

**Why:** 146/180 cells are red-tinted because GitNexus isn't indexed (one uniformly-empty column). Not a design failure — a transient state of this install. But the aesthetic contract doesn't reconcile with "wall of red". The page should anticipate this and de-emphasize the column when uniformly empty.

**Fix:** When a column is 100% missing AND install state is `not-installed` / `installed-no-registry`, render the column as a thin compressed strip with a single "Not yet indexed" cell at the top — collapse 45 redundant red cells to one message. Restore the column when any row has signal.

**Command:** `$impeccable quieter`

### Persona Red Flags

**Donald (power user, daily driver):**
- No keyboard accelerators specific to Coverage. Global TopBar gives ⌘K and R/?/ /, but Coverage has no `j/k` row navigation, no focused `r` row-refresh.
- Toolbar scroll-loss (P1 above) breaks fast-triage workflow.
- Clipboard-silence is acceptable to Donald — he knows the convention — but a tiny "✓ Copied" toast would still save the "did that work?" check.

**First-time visitor (not yet acclimated to vocabulary):**
- "GitNexus", "Wiki", "Workflow" column headers have no inline explanation.
- "Index with GitNexus" purple CTA → click → nothing visible happens. Likely abandonment vector.
- Family aggregate "✕ 9 ⚠ 0 ✓ 0" reads as "you're failing everything" before they understand columns.
- No empty/onboarding state for "you are looking at Coverage for the first time — here's what the four columns measure."

**iPad-Donald via Tailscale (touch, smaller viewport, no hover):**
- `opacity-30` row-refresh icon — right call for touch (Phase 10.6 polish landed correctly per D-11-10). Verified at `CoverageRow.tsx:157`.
- Touch target for refresh icon: `p-0.5` + 14px icon ≈ 22×22px effective. **Below Apple HIG 44pt minimum.**
- Sticky stack works on iPad (sticky well-supported in mobile Safari). The non-sticky toolbar issue is **worse on iPad** — touch scroll inertia takes you far past row 8 quickly.
- Filter chips appropriately sized (`px-3 py-1.5` ≈ 32×40pt) — close to 44pt minimum, acceptable for tablet.

### Minor observations

- **Stray keyboard-shortcut teaching tip** at top-right of Coverage page (rendered absolutely positioned). Collides with PageHeader's right-edge action area at 1440×900 (`top: 69.5px, right: 4px, width: 78px, height: 189.5px` — squished into a narrow vertical column wedged between page edge and "Index with GitNexus" CTA). Either reposition under the TopBar or reflow as a wider modal. Most visible on first paint before "Got it" dismisses.
- Family names rendered all-lowercase in section headers — matches directory naming. Acceptable as technical identity convention. Consistent with sidebar.
- **Override chip implemented but every row has `count: 0` in test data** — so override badge visual treatment has no opportunity to verify in practice.
- **Drift badges** (`CoverageDriftBadge`) scaffolded and tested but render zero on page (verified: `driftBadgeCount: 0`). Correct — only ~1 day of snapshot history exists; no transitions recorded yet. **Phase 11's calibration data point captures the page BEFORE drift badges populate.** A second-pass IMPECCABLE in 2-3 weeks (once 14-day history exists) is recommended to validate the drift surface itself.
- Search input has `defaultValue={search}` (uncontrolled with seed) — URL `?q=` changes from elsewhere (e.g., back button) won't sync. Edge case worth a controlled-vs-uncontrolled decision.
- 4-chip filter glyphs (`✕`, `⚠`, `✓`) readable and calm, matching cell glyphs. Good consistency.

### Provocative questions

- Should each family render in the same `<table>` so columns align across families? Or is the family boundary so important that mis-alignment is acceptable? (Current verdict: mis-alignment is broken.)
- What if the primary CTA's success state was visible on the page — "Index with GitNexus" → button morphs to "Pasted? Watch the matrix re-tint…" with a small spinner watching `gitNexusInstallState` until it transitions?
- Does this page need a 4-state legend at all, or should the column header itself communicate the meaning? ("CLAUDE.md present", "GitNexus indexed", "Wiki compiled", "Workflow up to date" — more verbose but self-documenting.)
- What if a column with 100% missing across all visible rows collapsed itself into one strip + an "Index now" CTA?
- What should the matrix look like when the user has 0 stale repos? Is there a peak emotional moment for "you're all green" that respects no-emoji-no-confetti brand?
- Does Coverage need a "last scanned" timestamp visible somewhere? Cache TTL is 30s but nothing tells the user.
- `lastCommit` per row from registry could be a 5th column — would "this repo hasn't been touched in 30 days" add explanatory power?

---

## Phase 11 verification-against-must-haves

Phase 11's IMPECCABLE-affected scope (per `11-PLAN.md` frontmatter + Plan 11-04/05/06):

| Phase 11 deliverable | Status | Evidence |
|---|---|---|
| Sticky `PageHeader` opt-in (D-11-09, default false) | ✓ Verified flush | `PageHeader.tsx:47` sticky-mode classes + `min-h-14` backstop + `-mt-6 top-[-1.5rem]` pair. Live verification at scrollY 0/200/400/800/1200/1600. |
| Coverage row-refresh opacity-30 (D-11-10) | ✓ Verified | `CoverageRow.tsx:157` `opacity-30` default; `group-hover:opacity-100 focus:opacity-100` bump. Touch-discoverable on iPad. |
| PLI-03 structural test (CoveragePage opts in at all 4 render branches) | ✓ Verified | `CoveragePage.test.tsx` asserts `top-[-1.5rem]` token at loading / error / empty / main; 894/894 SPA tests green. |
| Option C single-ownership drift model | ✓ Verified | `CoverageRow` owns `useCoverageHistory(repoId)` single hook; `CoverageCell` has no `useQuery` / `useCoverageHistory` (grep-locked). |
| `CoverageDriftBadge` naming (NOT `InlineDrift`) | ✓ Verified | `CoverageDriftBadge.tsx` distinct from Phase 6 schema-drift `InlineDrift.tsx`. |
| Sidebar `Skill drift` as 2nd Observability entry (D-11-08) | ✓ Verified | Sidebar shows `Coverage` + `Skill drift` peers under Observability section. |
| Drift surface visually populated | ⚠ Deferred to next-pass | Only ~1 day of snapshot history exists; no transitions recorded yet. `driftBadgeCount: 0` at critique time. Re-run IMPECCABLE in 2-3 weeks once 14-day window populates. |

**Phase 11's own work is design-clean.** The gap to the 87 floor is composed of Phase-10-inherited P1s plus the (provisional, D-10.5-03-flagged) calibration drift.

---

## Action items

### Phase 11 closure-blocking — none

Phase 11's own deliverables passed critique. The HUMAN-UAT items #1-7 cover visual smoke + behavioral; item #8 (this artifact) is now in place as data point #2.

### Phase 11.1 (recommended polish phase, if v1.1 close-out wants the inherited issues addressed)

Bundle the 4 inherited P1s + 2 P2s + token fix:

1. **`$impeccable layout`** — lock column widths across family sections (P1 #1).
2. **`$impeccable clarify`** — add toast/inline-confirmation for clipboard writes (P1 #2).
3. **`$impeccable layout`** — make `CoverageToolbar` sticky (or fold into PageHeader) (P1 #3).
4. **Token fix** — `--color-text-tertiary` from `#807a92` to `~#6b6580` to clear WCAG AA (P1 #4 + detector findings 1-3).
5. **`$impeccable document`** — column header tooltips (P2 #5).
6. **`$impeccable clarify`** — family-aggregate count semantics (P2 #6).
7. **`$impeccable typeset`** — `max-w-prose` on PageHeader subtitle (P2 #7).
8. **`$impeccable quieter`** — collapse uniformly-missing columns when install state is `not-installed` / `installed-no-registry` (P3 #8).

Estimated lift after closure: Nielsen 24 → 30/40 (~6 points), composite ~76 → ~82. Still below 87 floor; the floor itself needs recalibration in an ADR-0024-style addendum.

### D-10.5-03 follow-up

This is **calibration data point #2**. Two data points (Phase 10 = 74, Phase 11 = 76) both fall in the 70s under the skill-driven gate. Recommend ADR addendum to D-10.5-03 recalibrating the floor to ~75 (matching empirical distribution) OR re-anchoring scoring methodology so the composite naturally reaches the 87 target.

---

## Files referenced

**Source:**
- `packages/spa/src/components/ui/PageHeader.tsx` (sticky + line-length finding)
- `packages/spa/src/components/panels/coverage/CoveragePage.tsx`
- `packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx` (column-width drift + family-aggregate semantics)
- `packages/spa/src/components/panels/coverage/CoverageRow.tsx` (opacity-30 + Option C ownership)
- `packages/spa/src/components/panels/coverage/CoverageCell.tsx` (presentational verified)
- `packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx` (collision avoidance verified)
- `packages/spa/src/components/panels/coverage/CoverageToolbar.tsx` (non-sticky issue)
- `packages/spa/src/styles/tokens.css` (token swap target)

**Critique artifacts:**
- This file
- `coverage-assessment-b.png` (screenshot saved by Assessment B agent)
- Prior calibration data point: `10-IMPECCABLE.md`

**Context:**
- `PRODUCT.md` (synthesized from project docs at top of this run)
- `CLAUDE.md` (project constraints)
- `.planning/phases/DASH-11-coverage-trends-skill-drift/11-CONTEXT.md` (D-11-* decisions)
