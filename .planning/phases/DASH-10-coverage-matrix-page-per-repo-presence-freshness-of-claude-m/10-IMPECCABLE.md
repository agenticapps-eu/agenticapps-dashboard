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
