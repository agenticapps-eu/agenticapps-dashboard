# Phase 14 — Impeccable Critique (Gate)

**Targets:** `/coverage` (Understand column added) and `/code-intelligence` (new page) at `http://localhost:5174`
**Date:** 2026-06-07
**Reviewer:** Opus 4.8 (1M context) via `impeccable:critique` skill — two-assessment protocol (LLM design review + deterministic detector), isolated sub-agents per D-10.5-02
**Branch:** `docs/phase-14-understand-anything-context` (post-wave-3 merge)
**Viewport:** 1440×900 (per D-10.5-03 / D-6-21)
**Procedure:** `~/.claude/skills/impeccable/reference/critique.md` — Assessment A (sub-agent LLM review, chrome-devtools-mcp live inspection of both routes, paired daemon, live data: 50 repos / 4 analyzed graphs) + Assessment B (`npx --yes impeccable --json` v2.3.2 source scan + in-page detector injection on both routes; `impeccable live` absent in v2.3.2, equivalent browser bundle served locally)
**Phase 14 scope under critique:** Understand column 3-state cell + `UnderstandCopyPill` (14-03), Code Intelligence sidebar section + `/code-intelligence` page (14-04), tooltips (`coverageColumnTooltips`), viewer-URL construction from per-row scoped tokens.

---

## Composite Verdict

**Composite score: ~78 / 100** — per-route: **/coverage ~80** (Nielsen 28/40 = 70%; detector source-clean; 1 real URL-scan finding), **/code-intelligence ~74** (Nielsen 24/40 = 60%; detector fully clean; under-finished rather than flawed).

**Below the D-6-09.v1 floor of ≥ 87. This is calibration data point #3 under the skill-driven gate (Phase 10 = ~74, Phase 11 = ~76, Phase 14 = ~78). All three points fall in the 74–78 band — D-10.5-03's recalibration condition is now met. Recommendation: write `D-10.5-03.calibration` confirming the observed band and resetting the floor to ~75, or re-anchor the scoring methodology. Until then this artifact records pass-with-debt, mirroring the Phase 11 precedent.**

Three observations carry the verdict:

1. **Phase 14's core interaction model landed clean.** The copy-pill (`cd … && claude "/understand"` + toast) is exactly right for a read-only daemon; scoped per-repo viewer tokens never leak the bearer token into URLs; `rel="noopener noreferrer"` and per-repo aria-labels are in place. Zero AI-slop patterns on either route (both assessments agree).

2. **Two real P1s were introduced by this phase** (not inherited): the 144px Understand column pushes `/coverage` 46px past the canonical 1440 viewport, clipping the "Refresh N stale" primary CTA; and the Understand column is excluded from `rowMatchesFilter` + `worstState`/`computeCounts`, so filter chips and family aggregate counts silently ignore the column the user is looking at.

3. **Inherited Phase 10/11 P1s were remediated this phase** (verified live by Assessment A): column x-positions byte-identical across all three family sections (colgroup SoT), header tooltips on all five data columns, tertiary-text contrast raised to ≈4.8:1 (was 3.8:1), PageHeader subtitle measure constrained to ~65ch, clipboard toast on both old (GitNexus) and new (Understand) pills.

---

## Design Health Score

### /coverage — Nielsen Heuristics (Assessment A)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Rich per-cell states + toasts + drift badges; Understand state invisible in family aggregate counts; theme toggle label inverted (pre-existing) |
| 2 | Match System / Real World | 3 | `/understand` pill mirrors the terminal command exactly; "repo not in .wiki-compiler.json sources" is config-speak (acceptable for the persona) |
| 3 | User Control and Freedom | 3 | URL-synced filters, persisted collapse, Esc-closing popover, new-tab links with noopener |
| 4 | Consistency and Standards | 2 | Understand column breaks the column design language: fresh = bare "View" link, no ✓ glyph, no tinted cell while every sibling column uses glyph + tint |
| 5 | Error Prevention | 3 | Read-only, copy-to-clipboard pattern, scan double-trigger guarded |
| 6 | Recognition Rather Than Recall | 3 | Header tooltips now on all 5 columns (inherited issue FIXED); pill self-labels the command |
| 7 | Flexibility and Efficiency | 3 | Search, filters, batch refresh, family Scan, ⌘K |
| 8 | Aesthetic and Minimalist Design | 2 | 46px horizontal overflow at canonical viewport clips primary CTA; five affordance vocabularies coexist in one row |
| 9 | Error Recovery | 3 | Failure toasts with next-step copy, retry on scan-failed, schema-drift surface |
| 10 | Help and Documentation | 3 | Tooltips, help-guide fallbacks in error toasts, claude-md-help route |
| **Total** | | **28/40** | |

### /code-intelligence — Nielsen Heuristics (Assessment A)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Status column 100% empty when everything is fresh — blank column reads as broken; violates "honest data" brand rule |
| 2 | Match System / Real World | 3 | "110 files", absolute dates — plain and honest |
| 3 | User Control and Freedom | 3 | New-tab viewer links, nothing destructive |
| 4 | Consistency and Standards | 2 | Same action is "View" on /coverage vs "Open viewer" here; absolute dates vs relative time elsewhere; no card container unlike every other panel |
| 5 | Error Prevention | 3 | Read-only listing |
| 6 | Recognition Rather Than Recall | 2 | Analyzing a new repo requires recalling `/understand` from subtitle prose — no copyable command on this page |
| 7 | Flexibility and Efficiency | 2 | No search/sort/filter; fails at the 50-repo scale the daemon already scans |
| 8 | Aesthetic and Minimalist Design | 3 | Calm, airy, no overflow — but sparse to the point of unfinished |
| 9 | Error Recovery | 2 | Error state dumps raw `error.message`, no Retry button (CoveragePage has one) |
| 10 | Help and Documentation | 2 | Install/update CLI hints good (D-14-02) but invisible when healthy; nothing explains what a knowledge graph offers |
| **Total** | | **24/40** | |

### Cognitive Load (8-item checklist)

- **/coverage: 3 failures → moderate.** (1) Affordance vocabulary sprawl — tinted cell / Scan pill / copy pill / text link / hover icon in one row; (2) Understand excluded from filter + aggregate logic while visually present; (3) primary CTA partially clipped at viewport edge. Decision-point option counts within threshold; progressive disclosure good.
- **/code-intelligence: 2 failures → moderate.** (1) Dead-end for the unanalyzed case — gap repos absent, action path only in subtitle prose; (2) uncommunicative empty cells (blank Status when fresh; `AnalyzedRow` renders empty Actions cell with no explanation when viewer not installed).

---

## Anti-Patterns Verdict

**LLM assessment (Assessment A):** **Not AI slop — both routes.** `/coverage`: no gradients, no glassmorphism, no hero metrics, no identical card grids, no side-stripes, no modal-first patterns; tinted semantic cells + honest microcopy + hover-revealed actions is distinctive instrument-panel work. Category-reflex check passes (a "coverage dashboard" reflex predicts KPI cards + donut charts; this is the opposite). `/code-intelligence`: clean on slop but **marginal on distinctiveness** — a bare 6-column admin table with uppercase tracking-wider headers is the one generic-SaaS tic in the codebase; reads as scaffolding, not an authored surface. Category-reflex risk: low on /coverage, inverted-but-unflattering on /code-intelligence.

**Deterministic scan (Assessment B, impeccable v2.3.2):**
- CLI source scan (`packages/spa/src/components/panels/coverage/`, `packages/spa/src/components/panels/code-intelligence/`, `Sidebar.tsx`): **exit 0 — zero findings across 27 patterns** (verified non-vacuous: 26+ files scanned).
- URL scan `/coverage`: 44 raw hits → 8 distinct findings → **1 REAL**: `tiny-text` — 11px `text-xs` provenance captions ("via CLAUDE.md" etc.), 36 flagged instances of one token (project `text-xs` renders 11px vs Tailwind's 12px default). 7 FP groups: cramped-padding ×2 (full-bleed app shell, no visible boundary), text-overflow (sr-only skip link), clipped-overflow-container (closed ⌘K dialog, 0×0), nested-cards ×3 (sticky family headers sharing the card surface — same bg, no border/shadow), bounce-easing + layout-transition (Tailwind bundle strings; computed-style sweep found 0 elements using either).
- URL scan `/code-intelligence`: 5 hits, all app-shell/bundle FPs already classified. **0 real findings** — the Knowledge graphs panel itself triggered nothing.

**Visual overlays:** left rendered in the `[Human]` tab at `/coverage` (1440×900); `[LLM]` tab also left open.

---

## Priority Issues

1. **[P1] /coverage overflows the canonical 1440×900 viewport by 46px, clipping the primary CTA.** The 144px Understand column pushed content past the viewport (`scrollWidth` 1471 vs `clientWidth` 1425); "Refresh N stale" is half-clipped and row refresh icons need horizontal scroll. *Why:* the page's most important batch action is partially invisible at the design-canonical size; worse at iPad-landscape widths. *Fix:* reclaim width from the over-generous Wiki column (`w-72`/288px for content measured at 150px — `coverageColumns.ts` documents 138px of breathing room) and/or Repo column, keeping colgroup SoT. *Suggested:* `$impeccable adapt`.
2. **[P1] Understand column excluded from the page's state system.** `rowMatchesFilter` (CoveragePage.tsx) and `worstState`/`computeCounts` (CoverageFamilySection.tsx) enumerate only the original 4 columns: filter by "Missing" and repos missing only a knowledge graph vanish; family headers report counts that contradict the visible column. *Fix:* include `row.understand?.state` in both, or visibly mark the column out-of-aggregate. *Suggested:* `$impeccable harden`.
3. **[P2] Understand states sit outside the coverage visual language.** Fresh renders a bare accent "View ↗" link (component doc comment promises "✓-link" — implementation drifted from intent); missing renders a neutral gray pill with zero "missing" signal. The column doesn't answer the question the matrix exists to answer at a glance. *Fix:* standard state-tinted cell treatment + ✓ glyph prefix. *Suggested:* `$impeccable polish`.
4. **[P2] /code-intelligence forgot its own recovery and action affordances.** (a) Error state prints raw `error.message`, no Retry (CoveragePage has `onRetry`); (b) stale rows get a pill but no re-analyze affordance — the copy pill exists one page away for the same row; (c) `AnalyzedRow` renders an empty Actions cell with no explanation when viewer not installed. *Fix:* add Retry, reuse `UnderstandCopyPill` for stale rows, placeholder text in empty Actions. *Suggested:* `$impeccable harden`.
5. **[P3] Silent-blank edge case in the Understand cell.** `state='fresh'` with no `viewerUrl` (unpaired / token absent) renders an empty `<div>` — the em-dash fallback only fires when `row.understand` is undefined. A fresh graph then shows literally nothing, violating "honest data". *Fix:* render unlinked ✓ state or em-dash when both link and pill are suppressed. *Suggested:* `$impeccable harden`.
6. **[P3] 11px provenance captions (detector tiny-text, 36 instances).** Project `text-xs` token renders 11px, below the 12px floor; tertiary metadata with aria-label duplication, so candidate for an accepted-token waiver — but as rendered text it is a real hit. *Fix:* either bump the token to 12px or record the waiver. *Suggested:* `$impeccable typeset`.

---

## Persona Red Flags

- **Alex (Power User):** "Refresh 39 stale" clipped at the right viewport edge on a 1440 display; per-row refresh targets require an unexpected horizontal scroll. Will file "Missing filter ignores Understand" as a bug the first time he triages knowledge graphs via the chips.
- **Jordan (First-Timer):** lands on /code-intelligence, sees an empty Status column ("is status broken?"); wants to analyze a 5th repo and finds no button — the action lives on a differently-named page in a different sidebar section, where the same action is labeled "View" instead of "Open viewer".
- **Donald (iPad over Tailscale, glancing):** at iPad-landscape widths (1024–1180px) the desktop table renders and the Workflow, Understand, and Actions columns live entirely offscreen — the column he shipped this phase is the one he can't see from the sofa. Hover-gated refresh icons unreachable on touch (pre-existing); raw ISO `title` tooltip invisible on touch entirely.

---

## What's Working

1. **The copy-pill interaction model** never pretends the dashboard can run the analysis; it hands over the exact terminal command with a confirming toast. Terminal-native UX matched to the persona.
2. **Inherited-issue remediation:** column alignment, header tooltips, tertiary contrast (≈4.8:1), subtitle measure, and toast parity on the old GitNexus pill all verified live this phase.
3. **Security-conscious detailing without UI tax:** scoped per-repo viewer tokens (bearer token never in URLs), noopener/noreferrer, per-repo aria-labels.

## Minor Observations

- Theme toggle reports "current: dark" while rendering light (`html.class="dark"` with light palette) — status-visibility lie, likely pre-Phase-14.
- Tooltip copy renders markdown backticks literally ("Built by \`/understand\`…").
- `title`-attribute ISO timestamp on the viewer link: inconsistent with the custom Tooltip system; not humanized ("analyzed 1d ago").
- /code-intelligence hardcodes `'en-US'` date locale; rest of app speaks relative time; all four "Last analyzed" values render identically at day granularity, hiding order.
- Install hint uses `role="alert"` for a passive permanent state — should be `role="status"` (the update hint gets this right).

## Questions to Consider

1. **Is "Understand" a coverage column or a launcher?** It currently participates visually but not logically in the matrix. If coverage, it must speak ✓/✗/⚠; if launcher, why does it live inside a freshness matrix?
2. **Does /code-intelligence earn its sidebar section yet?** It is a 4-row, fewer-affordances projection of data /coverage already shows; the one thing it could uniquely offer (a glimpse *into* a graph — node counts, clusters, thumbnail) is absent.
3. **What is the column budget for /coverage?** Phase 14 made it 7 columns and broke the canonical viewport; GitNexus explorer entries are anticipated. At what point does the matrix pivot instead of accreting 144px per phase?

---

## Floor Comparison (D-10.5-03)

| Phase | Composite | Floor (≥87) | Outcome |
|-------|-----------|-------------|---------|
| 10 | ~74 | miss | pass-with-debt |
| 11 | ~76 | miss | pass-with-debt (11.1/11.2 polish phases spawned) |
| **14** | **~78** | **miss** | **pass-with-debt — this artifact; P1/P2 items above are the follow-up candidates** |

Three calibration data points now exist (74, 76, 78) — all in the 74–78 band, monotonically improving, all below the 87 floor set against the retired CLI's distribution. **D-10.5-03's recalibration condition is met: write `D-10.5-03.calibration` recording the observed band and either resetting the floor (~75 suggested) or re-anchoring the methodology.** Per the Phase 11 precedent, the P1s (viewport overflow, filter/count exclusion) are small, well-localized fixes suitable for a 14.1 polish bundle; they were introduced by this phase and should be fixed before v1.1 milestone close even if the floor is recalibrated.
