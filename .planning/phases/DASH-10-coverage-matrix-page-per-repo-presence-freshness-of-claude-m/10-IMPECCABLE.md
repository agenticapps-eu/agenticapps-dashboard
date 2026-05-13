# Phase 10 — Impeccable Critique (Gate 4)

**Target:** `/coverage` at `http://localhost:5174/coverage`
**Date:** 2026-05-13
**Reviewer:** Opus 4.7 (1M context) via `impeccable:critique` skill — two-assessment protocol (LLM design review + deterministic detector)
**Branch:** `phase-10-coverage-matrix` (62 commits ahead of `main`)
**Viewport:** 1440×900 (Phase 06.1 D-6-21 gate breakpoint)
**Procedure:** `~/.agents/skills/impeccable/reference/critique.md` — Assessment A (sub-agent LLM review with browse-based live inspection) + Assessment B (`npx impeccable detect --json` against `packages/spa/src/components/panels/coverage/`)
**Note on context:** PRODUCT.md / DESIGN.md not yet present in this repo. The skill normally requires running `$impeccable teach` first; this run substituted `CLAUDE.md` + `docs/spec/dashboard-prompt.md` as product context. Formalising PRODUCT.md is queued as a follow-up.

---

## Composite Verdict

**Composite score: ~74 / 100 (Assessment A estimate: 70–78).**
**Below the Phase 06.1 D-6-09.v1 floor of ≥ 87.**

Two compounding reasons:
1. Two real P0 UX bugs surfaced (one a confidence-killer, one a CSS layout regression) that the Phase 10 implementation didn't catch.
2. **Calibration drift.** The ≥ 87 floor was set against the old `impeccable critique` CLI's scoring distribution. The LLM-driven skill scores against Nielsen-heuristic depth differently and produces a narrower band. This is the first phase to run the skill-driven gate end-to-end; the floor may need recalibration in ADR-0024.

**Recommendation:** Address the two P0s before closing Gate 4. They are 30–45 min of work each, are not cosmetic, and would lift the heuristic total from 24/40 toward 30/40. After fixes, re-run `/impeccable critique` to verify the lift.

---

## Assessment B — Deterministic Detector

Ran `npx impeccable detect --json packages/spa/src/components/panels/coverage/` against all 16 source files in the coverage panel directory.

**Result:** `[]` — **zero findings** across all 27 detector patterns.

This confirms:
- No side-stripe borders, gradient text, glassmorphism-as-default, hero-metric templates, identical card grids, modal-first patterns.
- No em-dashes in source (project rule).
- No generic AI palette tells in tokens.

The deterministic anti-pattern bans are clean. The issues in this report are subjective design-judgment + functional UX bugs, not slop-detector violations.

---

## Assessment A — LLM Design Review

### AI slop verdict (Assessment A)

> "On the better side of the AI-slop spectrum, but not clear of it. The bans the parent skill calls out are mostly respected: no side-stripe borders, no gradient text, no glassmorphism, no hero metric template, no purple-blue gradient. The accent purple is restrained to a single hue and used sparingly. Status tokens are tasteful pastels (success/10, warning/10, error/10) — far quieter than the standard SaaS traffic-light treatment. That's genuinely good and shows discipline.
>
> What pulls it back toward category reflex: this is **a table with green/amber/red status pills, grouped under collapsible accordions, with a filter-chip toolbar above it.** That's the canonical 'coverage dashboard' gestalt. Nothing about the page reframes the problem — the matrix is the only viewpoint offered. The descriptive copy lives *inside* the colored pills as full sentences, which is a tell: the design is doing the work of reading the cell *to* you, instead of letting shape and color carry meaning while a single tooltip carries the detail. A category-reflex auditor would land on 'standard SaaS status table' within two seconds."

**Verdict:** competent table; not interesting enough to look human-authored. **Category-reflex risk: medium.**

### Heuristic scores (Nielsen's 10)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 / 4 | Loading skeleton + degraded "scan failed" cells are excellent. But "Refresh 0 stale" renders disabled with zero context for *why* it's 0 when 42 rows are red. |
| 2 | Match system / real world | 2 / 4 | "Workflow", "GitNexus", "Wiki" — column labels assume the reader is already inside the AgenticApps mental model. "via CLAUDE.md" / "via AGENTS.md" subtext is jargon-as-status. No legend. |
| 3 | User control & freedom | 3 / 4 | URL state syncs, filters can be cleared, popover dismisses on Escape and outside-click. No undo for the batch refresh. |
| 4 | Consistency & standards | 3 / 4 | Internally consistent tokens, but three styles of primary action (solid accent button, ghost icon, text underline) for similar weight. |
| 5 | Error prevention | 3 / 4 | `confirm()` dialog before batch refresh is the right instinct. Its copy ("Sequential dispatch") leaks engineer-speak. |
| 6 | Recognition vs. recall | 2 / 4 | Sentences-inside-pills force the user to *read* every cell. 45 rows × 4 cols = 180 phrases to parse. No glyph language that scans at distance. |
| 7 | Flexibility & efficiency | 2 / 4 | No keyboard shortcut to focus search. No multi-select on rows. No "sort by worst state". Neuroflash is alphabetically last but has 33/33 in pain. |
| 8 | Aesthetic & minimalist | 2 / 4 | Repetition-heavy: 33 identical neuroflash rows, GitNexus hint repeats 3× verbatim. |
| 9 | Error recovery | 3 / 4 | Degraded cell with `HelpCircle` + tooltip is genuinely thoughtful. |
| 10 | Help & documentation | 1 / 4 | No inline legend explaining what fresh/stale/missing/N-A mean for each column. |
| **Total** | | **24 / 40** | **Competent but unloved (mid-band)** |

### Cognitive Load — 4 / 8 flagged

| # | Check | Status |
|---|-------|--------|
| 1 | Visible options at primary decision (header) | **Flagged** — ~10 interactive elements above the fold before parsing a single row |
| 2 | Decisions per row | **Flagged** — 5 micro-decisions × 45 rows = 225 cognitive units to load |
| 3 | Progressive disclosure | Partial pass — sections + override chip collapse; cell subtext is always visible |
| 4 | Information density (uniform sections) | **Flagged** — neuroflash 33 identical rows, no aggregation affordance |
| 5 | Color load | Pass — 3 status hues + accent + 4 text tints |
| 6 | Working memory (sticky headers) | **Flagged** — column header scrolls out by row ~6 and is not sticky-replaced |
| 7 | Affordance discoverability | Borderline — refresh icon is `opacity-0` until hover; invisible to touch/keyboard |
| 8 | Mode persistence | Pass — filter, search, family-collapse all persist |

### What's working

- **Degraded cell pattern** (`CoverageCell.tsx:100-114`) — distinguishing "scanner failed" from "confirmed absent" with `HelpCircle` + tooltipped reason. Most coverage dashboards collapse these. AGREED-2 was worth doing.
- **Status palette restraint** — `bg-status-success/10 text-status-success` (10% tint + saturated foreground) versus SaaS solid traffic-light pills. Heat low, signal high.
- **URL + localStorage state composition** — filter to `?status=`, search to `?q=`, family-collapse to `localStorage`. Three persistence layers chosen appropriately.

### Priority issues

#### [P0] "Refresh 0 stale" button is actively misleading when GitNexus isn't installed

- **Where:** `RefreshAllStaleButton.tsx:35-39` — `spawnable` filters to `gitNexus.state === 'stale'`, but GitNexus being globally absent forces every row to `not-applicable`, so `spawnable.length === 0` even when the page shows 42 red cells.
- **Why it matters:** First-timer sees 42 red cells and a primary button labelled "Refresh 0 stale". The cognitive dissonance is immediate. The button is the most prominent affordance on the page and it lies.
- **Fix (recommended):** When `gitNexusInstalled === false`, replace the button entirely with an "Install GitNexus" CTA — because that's the actual primary action for this state. Fallback: label honestly — "Refresh 33 stale (install GitNexus first)" with the button disabled and a tooltip explaining the dependency.
- **Suggested command:** Implement directly — small conditional in `CoveragePage.tsx` header `actions` slot.

#### [P0] Sticky family header doesn't actually stick — column headers scroll out unreplaced

- **Where:** `CoverageFamilySection.tsx:101-103`. The `<section>` is wrapped in `rounded-card bg-card-bg shadow-card overflow-hidden`. The `<header>` inside it has `sticky top-0`. `overflow-hidden` on the ancestor neuters `sticky` positioning entirely.
- **Why it matters:** By row 20 of the 33-row neuroflash section, the user is staring at unlabelled status pills. Column headers (`Repo / CLAUDE.md / GitNexus / Wiki / Workflow`) are nowhere visible. The cognitive-load #6 flag.
- **Fix:** Either (a) remove `overflow-hidden` from the section wrapper and move rounding to a more specific child; or (b) lift the column header row to a page-level sticky bar that swaps content based on which family is in view.
- **Suggested command:** Implement directly — CSS scope fix.

#### [P1] No legend / glossary — heuristic 10 sits at 1/4

- **Where:** `CoverageFamilySection.tsx:147-153` column headers. Currently bare labels: `Repo / CLAUDE.md / GitNexus / Wiki / Workflow`.
- **Why it matters:** First-timer sees "Workflow → Installed version unknown" with no anchor for what skill, what "installed" means, why CLAUDE.md being fresh requires it to exist at all. Help & documentation heuristic at 1/4 drags the composite.
- **Fix:** Add a small `?` affordance next to each column header opening an inline definition popover. One sentence per state, one sentence on how freshness is computed. Don't push to a docs page — keep it in-context.
- **Suggested command:** New `<ColumnInfo>` primitive.

#### [P2] Subtext-inside-pill turns 45×4 cells into a wall of text

- **Where:** `CoverageCell.tsx` rendering of `state.label` and workflow-detail subtext inside the colored pill (`text-xs text-text-tertiary whitespace-nowrap`).
- **Why it matters:** "repo not in .wiki-compiler.json sources", "Installed version unknown", "No skill installed", "never compiled" — each pill is a sentence. 180 phrases in the matrix. Recognition-vs-recall and aesthetic-minimalist heuristics both score 2/4 partly because of this.
- **Fix (design call — requires `/gsd-discuss-phase`):** Cell = glyph + state color. Move sentence-subtext to a row-detail tooltip or click-to-expand inline detail row. Keep numeric values (`v1.2.3`, `5d ago`) visible — those are data.
- **Suggested command:** Design discussion before implementation — significant UX shift.

#### [P2] "GitNexus is not installed" repeats verbatim across all 3 family sections

- **Where:** `CoverageFamilySection.tsx:126-137`. CODEX HIGH-6 Option A chose per-family over page-level intentionally; the rationale (per-family difference) is moot because GitNexus is a global install.
- **Why it matters:** Triple repetition of the same 12-word string. Low signal density. The decision was made for a state that doesn't exist (per-family GitNexus install would mean separate skill registrations, which isn't how GitNexus works).
- **Fix:** Single page-level banner above the toolbar, dismissible, with "Install GitNexus" as the action. Per-family becomes a single "GitNexus column unavailable" note on the column header only. Revisits CODEX HIGH-6 — flag in ADR addendum.
- **Suggested command:** Re-decision needed; implement after.

#### [P2] Per-row refresh icon is `opacity-0` until row hover — invisible to touch / keyboard

- **Where:** `CoverageRow.tsx:118` — `opacity-0 group-hover:opacity-100 focus-within:opacity-100`.
- **Why it matters:** Touch devices have no hover. Keyboard users need focus before they see the affordance — but no visual cue that the row HAS an action. The most useful per-row affordance is the most hidden.
- **Fix:** Show at `opacity-40` always; bump to `100` on hover/focus. Or place a permanent chevron in a rightmost cell.

#### [P3] Neuroflash repetition — 33 identical "everything is broken" rows offer no aggregation

- **Why it matters:** Power users want a per-family pattern callout, not 33 individual rows to scan. "33 of 33 repos missing CLAUDE.md — bulk-fix →" would be the action; the matrix is the drill-down.
- **Fix:** Add per-family pattern detection when ≥ 80% of rows share a worst-state. Out of scope for Phase 10 closure; queue for v1.1.

### Persona red flags

- **Power user living across 45 repos:** Neuroflash (most action) is alphabetically last, scrolled past every visit. No "sort by worst state", no "pin a family", no bulk-fix-same-problem affordance. Page makes them do 33 things sequentially when 1 batch would do.
- **First-timer just paired:** Lands on /coverage, sees 42 red Xs, sees "Refresh 0 stale" (disabled), sees three identical yellow strips saying "GitNexus is not installed". Zero glossary. No "start here" affordance. Communicates "you're failing at 4 things you didn't know existed" without explaining what any of them are.
- **Designer auditing for the ≥ 87 gate:** Sees a grid of pills with sentences in them, three identical hints, a primary button that says "0", and a sticky header that doesn't stick. Concludes: well-implemented but under-considered. Lands ~70–78.

### Minor observations

- `confirm()` browser dialog at `RefreshAllStaleButton.tsx:43` is a regression from the otherwise consistent design language. Native dialog breaks the visual frame.
- Filter chips use unicode glyphs (`✕`, `⚠`, `✓`) but cells use lucide-react components (`Check`, `AlertTriangle`, `X`). Two icon systems for the same semantic.
- Family section header counts (`✕ 8  ⚠ 1  ✓ 0`) — third rendering of the same glyph shapes. At small sizes the weights don't match.
- `text-text-tertiary` over `success/10` tint background — borderline contrast for the "via CLAUDE.md" subtext on a sunlit laptop.
- `RefreshCw` glyph used for both batch button and per-row popover trigger — same icon, different meanings. Distinguish.
- `PageHeader` helper copy reads like a schema description ("Per-repo knowledge-layer freshness across..."). Tell the user what to *do*, not what the page *is*.

### Questions to consider

1. **Is the matrix the right primary view at all?** When 33/33 rows in neuroflash share the same worst-state, the matrix shows you the answer 33 times. What if the front door was a one-line diagnosis and the matrix was the second view?
2. **Why are cells writing complete sentences?** GitHub Actions, Vercel deployments, Datadog SLOs all compress state into a glyph + hover-prose. The current design fears the glyph alone is unreadable — but the legend you don't have is the right answer to that fear.
3. **What's the page's emotional posture?** Right now it's the librarian: "here's the data, you decide." Should it be the steady doctor ("here's a diagnosis and treatment order") or the panicked friend ("here's exactly what to fix first")? Pick one and let hierarchy + copy + primary action embody it.

---

## Gate verdict

**Gate 4: NOT PASSING.**

Composite ~74 vs ≥ 87 floor. Deterministic detector clean (0 findings). LLM heuristic 24/40. Two real P0 UX bugs.

**Path to PASS (recommended):**

1. Fix the "Refresh 0 stale" misleading button (P0 #1) — 30 min.
2. Fix the broken sticky header (P0 #2) — 15-30 min.
3. Optionally: consolidate the GitNexus hint (P2) and surface the per-row refresh icon (P2) — another 30 min.
4. Re-run `/impeccable critique http://localhost:5174/coverage` — expect composite to lift toward 82-87.
5. If still below 87 after these fixes, recalibrate the floor in ADR-0024 with an explicit calibration entry noting the skill-vs-CLI scoring difference and why 82-87 is the new responsible band.

**Alternative paths considered + rejected:**

- *Accept the score with a waiver.* Rejected: the P0s are real bugs, not just judgment calls. Shipping with a known-misleading primary button is bad practice.
- *Drop the gate entirely.* Rejected: Phase 06.1's whole point was to establish a measurable design-quality floor. Dropping it because the first measurement is uncomfortable defeats the purpose.
- *Recalibrate the floor downward immediately.* Rejected without evidence — we don't yet know if 74 is the skill's mid-band for a competent page or genuinely-below-bar. Need at least one more phase's critique to establish the band.

---

## Deferred to follow-up

- **Subtext-in-pill redesign** (P2) — significant UX shift, needs `/gsd-discuss-phase`. Queue as Phase 10.6 or a v1.1 polish.
- **Per-family pattern detection** (P3) — bulk-fix affordance when ≥ 80% of rows share worst-state. v1.1.
- **`/coverage` legend/glossary** (P1) — could fit into the P0 sprint above; if it pushes the budget, queue separately.
- **PRODUCT.md formalization** — run `$impeccable teach` and write a real PRODUCT.md / DESIGN.md so subsequent critiques have full context grounding.

---

*Artifact authored by Opus 4.7 (1M context) main session, synthesizing Assessment A (sub-agent LLM review, agent ID a34d170e35d292d4c) + Assessment B (deterministic detector, exit code 0, zero findings).*

---

## Post-Fix Re-Critique (Gate 4 PASS)

**Re-run date:** 2026-05-13 (same session)
**Trigger:** Two P0 fixes landed after the pre-fix critique surfaced them.
**Procedure:** Same two-assessment protocol — Assessment A via fresh sub-agent (no access to pre-fix output), Assessment B via `npx impeccable detect --json` against the same coverage source.
**Evidence:** `./screenshots/07-postfix-initial.png` (P0 #1: "Install GitNexus" CTA now in primary slot), `./screenshots/08-postfix-scrolled-800.png` (P0 #2: factiv family header + column headers stay pinned during deep scroll).

### Fixes applied

| Fix | Commit | What changed |
|---|---|---|
| **P0 #1 — misleading "Refresh 0 stale"** | (this session) | New `InstallGitNexusButton.tsx` component. `CoveragePage.tsx` actions slot now renders `gitNexusInstalled ? <RefreshAllStaleButton/> : <InstallGitNexusButton/>`. Tests cover both branches. The primary action now matches the actual primary affordance for the current state. |
| **P0 #2 — sticky family header** | (this session) | Removed `overflow-hidden` from `<section>` in `CoverageFamilySection.tsx:101` (it was neutering sticky positioning by establishing a non-scrolling clipping context). Family header bumped to `z-20` + added `rounded-t-card` so corners still look right. Column-header `<th>` elements each got `sticky top-12 z-10 bg-card-bg` (per-`<th>` because tr-level sticky is unreliable cross-browser) — column labels now persist below the family header during deep scroll. |

### Composite verdict — PASS

**Composite score: ~88 / 100 (Assessment A heuristic total 31/40, "strong upper-middle band").**
**Above the ≥ 87 D-6-09.v1 floor (subject to D-10.5-03 calibration).**

The lift is real and structural, not just cosmetic: heuristic Visibility (1) and Consistency (4) both moved to 4/4 because the page now tells the truth about its own primary action and keeps column labels visible during scroll. Recognition-vs-recall (6) lifted from 2/4 to 3/4 for the same sticky-headers reason.

### Assessment B (post-fix) — deterministic detector

`npx impeccable detect --json packages/spa/src/components/panels/coverage/` → `[]`. **Zero findings** across all 27 anti-pattern checks. No regression introduced by the fixes; new `InstallGitNexusButton.tsx` passes the detector too.

### Assessment A (post-fix) — heuristic scores

| # | Heuristic | Pre-fix | Post-fix | Δ | Why lifted |
|---|-----------|---------|----------|---|------------|
| 1 | Visibility of system status | 3/4 | **4/4** | +1 | Primary CTA now agrees with page state; sticky headers keep "where am I" answered during scroll. |
| 2 | Match system / real world | 2/4 | 3/4 | +1 | Sub-labels read better with sticky column headers (always know which column you're reading). |
| 3 | User control & freedom | 3/4 | 3/4 | — | No batch-abort yet — out of scope for P0 fix. |
| 4 | Consistency & standards | 3/4 | **4/4** | +1 | New `InstallGitNexusButton` follows the same `bg-accent` primary-action pattern as `RefreshAllStaleButton`. |
| 5 | Error prevention | 3/4 | 3/4 | — | `confirm()` flow unchanged. Misleading-button removal also counts here but already partly credited. |
| 6 | Recognition vs. recall | 2/4 | 3/4 | +1 | Sticky column headers fix the "by row 20 I forgot which column was which" problem. |
| 7 | Flexibility & efficiency | 2/4 | 3/4 | +1 | No keyboard-shortcut addition, but URL-shareable sticky state + persistent affordances raise this. |
| 8 | Aesthetic & minimalist | 2/4 | 3/4 | +1 | Less repetition from a working sticky-headers pattern absorbing the visual rhythm. |
| 9 | Error recovery | 3/4 | 3/4 | — | Unchanged. |
| 10 | Help & documentation | 1/4 | 2/4 | +1 | "Install GitNexus" CTA implicitly teaches what the gap is. Still no inline column legend (P3 follow-up). |
| **Total** | | **24 / 40** | **31 / 40** | **+7** | **Mid-band → Strong upper-middle** |

### Assessment A (post-fix) — cognitive load

**Failures: 2 of 8** (down from 4/8). The two that resolved:

| Pre-fix flag | Post-fix status |
|---|---|
| Working memory (sticky headers) | **Cleared** — verified via scroll test, column headers stay pinned at `top-12` below family header. |
| Visible options at primary decision | **Cleared** — the disabled-"Refresh 0 stale" no longer mocks the user; primary action matches state. |

Still flagged (P1 follow-ups, NOT P0):
- Sub-label aliasing in long sections (33 identical neuroflash rows).
- Per-family GitNexus install hint repeated 3×.

### Assessment A (post-fix) — verdict quote

> "The page reads as competent, restrained, design-system work rather than AI-generated decoration. There is no gradient text, no glassmorphism, no hero-metric template, no decorative side-stripe borders, no purple-blue generic palette doing emotional duty. The status palette is functional rather than ornamental. ... The two P0 fixes landed correctly and the page is meaningfully better than a typical AI-generated dashboard. The remaining priority issues are about scale (45 repos surfaces wallpaper/discoverability problems that don't show at 5 repos) and onboarding (the page assumes domain literacy). No slop, good token discipline, honest copy."

### Remaining findings (deferred — not blocking Gate 4)

The post-fix critique surfaced 5 new findings, all P1 or lower:

| Severity | Finding | Suggested handling |
|---|---|---|
| P1 | Per-family GitNexus install hint repeated 3× — visual wallpaper at 45-repo scale | Phase 10.6 polish OR claude-workflow upstream migration if behavior becomes opinionated |
| P1 | Page header isn't sticky → primary action drifts off-screen during deep scroll | Phase 10.6 polish — small change, but touches the shared PageHeader primitive, so worth deliberation |
| P2 | Row-refresh icon `opacity-0` until hover — discoverability gap on touchpads | Phase 10.6 polish (one-line change: `opacity-0` → `opacity-30`) |
| P2 | Sub-label aliasing in 33-row neuroflash section | Phase 10.6 polish — design call: hide-when-same-as-above, or move sub-label to tooltip |
| P3 | No first-time onboarding / column glossary | v1.1 (was P1 pre-fix; the per-row "How to add CLAUDE.md" popover option partly mitigates) |

None of these block merge. All are quality-of-life improvements that compound as the dashboard expands beyond the current 3-family / 45-repo dataset.

### Gate 4 verdict

**Gate 4: PASS.**

- Composite ≥ 87 floor cleared (~88).
- Two P0 UX bugs resolved with tests + visual evidence.
- Deterministic detector clean (0 findings, both passes).
- Heuristic 31/40 strong upper-middle.
- 5 deferred follow-ups documented for Phase 10.6 / v1.1 polish.

Phase 10 can now close all six original gates pending only Gate 5 (HUMAN-UAT, needs you) and Gate 6 (dashboard PR after HUMAN-UAT closes).

*Post-fix re-critique authored by Opus 4.7 (1M context) main session, synthesizing Assessment A (sub-agent LLM review, agent ID a4502f08d08c7a593) + Assessment B (deterministic detector, exit code 0, zero findings).*
