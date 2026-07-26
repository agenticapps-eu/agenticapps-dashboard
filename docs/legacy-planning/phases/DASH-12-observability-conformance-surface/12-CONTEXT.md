# Phase 12: Observability Conformance Surface - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning
**Mode:** `/gsd-discuss-phase 12` (`--auto`-equivalent — user directive: "continue with 12, no clarifying questions"; all gray-area defaults auto-selected from the recommended option, ratified retroactively against Phase 11 D-12-* anticipation. Mirrors Phase 11.2's discuss-phase mode per ROADMAP.md.)

<domain>
## Phase Boundary

Phase 12 opens **v1.2 — Fleet conformance & drift visibility** by graduating the Observability section from 2 surfaces (Coverage point-in-time + Skill drift cross-cut) to 3 by adding `/observability/conformance` — a fleet-level view answering "how conformant is every registered project to the AgenticApps standard, and how is conformance trending over 90 days?"

**Primary deliveries:**

1. **`/observability/conformance` route** — 3rd entry under `Observability` sidebar section. Composes:
   - 3-up family card row (agenticapps / factiv / neuroflash) showing current conformance score + 14d delta + status tier (green/amber/red).
   - 90-day fleet trend chart (pure SVG primitive, ≤120 LOC, no chart library — matches Phase 11 D-11-03 zero-third-party-JS stance).
   - Drifted-registry-path panel (when present) with one-click "Fix path" affordance per entry.

2. **Conformance score** — equal-weighted % of green cells across the 4 Coverage columns (CLAUDE.md / GitNexus / Wiki / Workflow). 0–100 integer. Tier mapping: ≥90 green / 70–89 amber / <70 red. Computed daemon-side, rolled up per family + fleet.

3. **Registry path drift auto-correction** — detector + `POST /api/admin/registry/fix-path` daemon route. Writes confined to `~/.agenticapps/dashboard/registry.json` (mode `0600`). Carry-over from Phase 11 D-12-09 anticipation.

4. **Coverage responsive collapse < 768px** — `useViewportBreakpoint` hook + card-per-row layout under `xs:` breakpoint. Carry-over from Phase 11.1/11.2 deferred items (iPad-portrait via Tailscale).

**Out of scope (v1.2.0 — explicitly deferred):**

- **Per-skill conformance weighting** — skill drift NOT folded into score for v1.2.0; revisit if dogfooding asks. (D-12-26 deferred to v1.2.1.)
- **Per-project drill-down on the trend chart** — 3-family aggregate is primary; per-repo drill-down would duplicate the Coverage matrix view.
- **Export to CSV/PNG** — no export workflow yet (v1.3+ candidate).
- **Slack/email notifications on conformance regression** — push surfaces are Phase 8 territory.
- **Custom conformance thresholds per project** — universal thresholds (90/70) for v1.2.0.
- **30/60/90 day toggle on the chart** — single 90-day window for v1.2.0; adds noise without proven signal.
- **Score decimals** — integer-only score (no `87.3%`).
- **Cross-family workflow upgrade orchestration** — adjacency hint from the audit; separate phase if/when justified.

</domain>

<decisions>
## Implementation Decisions

### Scope + Sidebar IA

- **D-12-01:** Sidebar IA — **`Conformance` as 3rd entry under `Observability`** (Coverage / Skill drift / Conformance). Why: Phase 11 D-11-08 anticipated this slot; matches user preference for graduating sidebar sections with growth room over peer top-level items (auto-memory `feedback_sidebar_section_architecture`). Locked.
- **D-12-02:** Route — **sibling `/observability/conformance`**, NOT widening Phase 5's existing `/observability` aggregator. Why: Phase 5's `/observability` is the per-project observability panel (Sentry/Linear/etc. signals); conformance is cross-project fleet roll-up — different shape, different consumer. Mirrors Phase 11 D-11-11 sibling-endpoint discipline.

### Conformance score model

- **D-12-03:** Score formula — **equal-weighted % of green cells across the 4 Coverage columns** (CLAUDE.md / GitNexus / Wiki / Workflow). Why: simplest model that ships; per-column priority weighting can land in v1.2.x if dogfooding shows certain columns dominate (e.g., users care more about Workflow than Wiki staleness). Equal weight is the honest v1 baseline.
- **D-12-04:** Tier mapping — **≥90% green / 70–89% amber / <70% red**. Why: 90 is a sensible "fully healthy" threshold (1 in 10 cells can be amber/red and still feel maintained); 70 is the "needs attention" floor (3 in 10 cells red is a real backlog). Matches the WCAG-style two-threshold pattern users are already used to.
- **D-12-05:** Score range — **0–100 integer**, no decimals. Why: `87%` is signal; `87.3%` is noise — perceived precision without operational meaning. Integers also stabilize x-axis labels on the chart.
- **D-12-06:** Aggregation levels — **3 family cards + 1 fleet aggregate**. Why: per-family is the user's mental model (the three Sourcecode subtrees they manage); fleet-aggregate is the headline number; per-repo drill-down belongs on the Coverage page that already exists.
- **D-12-07:** Drifted entries excluded from score — drifted registry paths return `null` from the scanner and are excluded from the denominator. Why: cannot rate what we cannot read; surfacing them in the drift panel gives the user the fix path before the score can recover.

### Chart primitive

- **D-12-08:** **Pure-SVG `FleetTrendChart`**, ≤120 LOC, no Recharts/Chart.js/D3. Why: matches Phase 11 D-11-03 zero-third-party-JS stance; the chart is structurally simple (4 polylines on a fixed grid); a library would add ≥30KB gzipped for ≤120 LOC of value. Planner can spike viability in Wave 0 if uncertain — if SVG gets ugly, escalate before locking.
- **D-12-09:** **90-day x-axis window**, fixed. Why: matches the existing Phase 11 `coverage-history` NDJSON 90-day retention (already in production); a 30/60/90 toggle for v1.2.0 adds UI weight without proven signal. Revisit if v1.2.0 user feedback shows people want short-window views.
- **D-12-10:** **4 polylines** — 3 family colors + 1 fleet-aggregate (heavier stroke weight, distinct token). Family colors: reuse Phase 5.1 family-color tokens if defined; else planner picks 3 distinct tokens from the existing palette. Fleet aggregate uses `text-text-primary` token for emphasis.
- **D-12-11:** **Disclosure UX** — hover **+ focus + keyboard reveal** for per-day breakdown panel. Why: mirrors Phase 11 D-11-02 (no hover-only, touch-compatible — Tailscale-from-iPad use case). Per-day panel shows: date + 4 family scores + fleet score.
- **D-12-12:** **Y-axis** = 0–100% conformance score, gridlines at 0/25/50/75/100 (4 horizontal rules). **X-axis** = daily ticks, label every ~14 days (90/7 ≈ 13 labels max).
- **D-12-13:** **Empty state** — when <14 days of history NDJSON exist, render an inline message "Building 90-day trend — N more days of data needed" rather than a sparse chart. Why: a 3-day chart is misleading; users should see the wait-state explicitly.

### Wire schema

- **D-12-14:** **Sibling endpoint** `GET /api/observability/conformance`, NOT a `conformance?: …` field on `CoverageResponse`. Why: keeps the matrix-view path (`/api/coverage`) hot and tight; conformance is a separate route consumer with different cadence (1-2 polls/visit vs 30s background refresh).
- **D-12-15:** **New shared schema file** `packages/shared/src/schemas/conformance.ts` — sibling to `coverage.ts` and `coverageHistory.ts`. Barrel re-export from `packages/shared/src/index.ts`. Why: file-boundary discipline keeps `coverage.ts` from growing past 200 LOC and keeps `git blame` clean for the existing Coverage surface (Phase 10 D-11-12 pattern).
- **D-12-16:** **Response shape** — bulk-per-family in a single payload:
  ```ts
  {
    today: { fleet: number, agenticapps: number, factiv: number, neuroflash: number, asOf: ISO },
    delta14d: { fleet: number, agenticapps: number, factiv: number, neuroflash: number },
    series: { date: ISO, fleet: number, agenticapps: number, factiv: number, neuroflash: number }[],  // 90 entries
    drifted: { id: string, storedPath: string, suggestedPath: string | null }[]
  }
  ```
  Why: one fetch per page load (matches Phase 11 PD-11-02 bulk-per-repo refinement); ~9KB payload at 90 days × 5 numbers per row — well within the 30s daemon-cache budget.
- **D-12-17:** **Daemon cache** — `packages/agent/src/lib/conformanceCache.ts`, 30s TTL singleton (matches Phase 10 `coverageCache` + Phase 11 `coverageHistoryCache` pattern). Recomputes from `coverageScan` + `coverage-history/<date>.ndjson` reads on miss.

### Registry path drift auto-correction

- **D-12-18:** **Detection** — compares `~/.agenticapps/dashboard/registry.json` `<root>` paths against actual filesystem state. Flags entries where: (a) `existsSync` returns false; (b) `realpath` resolves differently (rename via symlink); (c) the path is inside a configured family root but the family directory no longer contains it. Daemon-side, runs as part of `conformanceScan` aggregation.
- **D-12-19:** **Fix-path daemon route** — `POST /api/admin/registry/fix-path { id: string, newPath: string }`. Writes confined to `~/.agenticapps/dashboard/registry.json` (mode `0600`); idempotent; rejects newPath outside the configured family roots (mirrors Phase 1 D-15 path-confine guard).
- **D-12-20:** **SPA affordance** — drifted entries surface in a collapsible panel above the family cards on `/observability/conformance`. Each entry shows: project name + stored path + suggested path (when detector inferred one) + "Fix path" button. Success/error feedback via Phase 11.1 `Toast` primitive (single-slot, opacity-only animation).
- **D-12-21:** **Suggested-path inference** — best-effort: search the configured family roots for a directory matching the project's git origin remote (when `.git/config` is readable). When inference fails, the SPA prompts the user to paste the corrected path; no auto-fix without user confirmation.

### Coverage responsive collapse (carry-over polish)

- **D-12-22:** **New `useViewportBreakpoint` hook** — ResizeObserver on `document.documentElement`, publishes `--vp-bp` CSS var (`xs` / `sm` / `md` / `lg` / `xl`). Lives at `packages/spa/src/lib/useViewportBreakpoint.ts`. Why: minimal abstraction; matches Phase 11.1 `usePageHeaderHeight` pattern.
- **D-12-23:** **CoverageFamilySection** switches from `<table>` → card-per-row layout under `xs:` breakpoint (<768px). Card layout: project name + 4 status pills (one per column) + actions row. Touch-target sizes inherit Phase 11.2 D-11.2-11/12 (44×44 buttons in `w-12` actions column).
- **D-12-24:** **Bounded scope** — responsive collapse applies to `/coverage` only. `/observability/conformance` itself is desktop-first for v1.2.0 (chart at <768px would be unreadable; revisit in v1.2.x if iPad-portrait demand justifies a vertical sparkline variant).

### Cross-cutting reuse

- **D-12-25:** **Reuses** Phase 10 `coverageScan` orchestrator (extended with `aggregateByFamily`); Phase 11 `coverage-history/<date>.ndjson` NDJSON store (read path only — Phase 12 does not write to it); Phase 11.1 sticky `PageHeader` primitive (+ `--ph-h` CSS var); Phase 11.1 `Toast` primitive; Phase 5.1 status tokens (`text-status-success/-warning/-error`, `bg-status-*`); Phase 10.6 `gitNexusInstallState` enum (treated as `not-installed` → 0-weight, `installed-no-registry` → counts as `missing` for score).

### Gates + verification

- **D-12-26:** **`/cso` REQUIRED** — new daemon write surface (`POST /api/admin/registry/fix-path` mutates `registry.json`). Threat model must cover: path traversal in `newPath`, symlink-escape via `realpath` race, JSON injection, concurrent write race (parallel calls from multiple tabs), and registry-corruption recovery. Mirrors Phase 10 CODEX HIGH-1/HIGH-2/HIGH-3 patterns (absPath strip, symlink escape guard, resolver-everywhere).
- **D-12-27:** **Two-stage review** — Stage 1 `/review` + Stage 2 `superpowers:requesting-code-review` (do NOT collapse — workflow contract).
- **D-12-28:** **`/qa` walkthrough** on `/observability/conformance` covering: trend chart hover/focus/keyboard reveal, family card tier coloring at 90/89/70/69 boundary values, fix-path flow happy + error paths, responsive collapse on `/coverage` at 767px / 768px / 1024px viewports.
- **D-12-29:** **`/impeccable critique`** on `/observability/conformance` at 1440×900 → `12-IMPECCABLE.md` (calibration data point #5 for D-10.5-03). Coverage of `/coverage` re-pass below 768px (calibration data point #6) folds into the same artifact if time permits — else deferred to a Phase 12.x bundle.

### Claude's Discretion

- Exact stroke weights / opacity values for the 4 polylines — planner picks based on Phase 5.1 token palette.
- Per-day breakdown panel position (above/below the chart, or anchored to hover position) — planner picks based on impeccable critique iteration.
- Drift detector debounce / polling cadence — planner picks (suggest: same 30s cache TTL as coverage roll-up).
- Suggested-path inference fallback when `.git/config` is unreadable — planner picks the prompt wording.
- Whether to fold Coverage `<768px` impeccable re-pass into Phase 12's artifact or punt to Phase 12.x — planner reads time-box at Wave 4 and decides.

### Folded Todos

No pending todos cross-referenced to Phase 12 (`gsd-tools todo match-phase 12` returned 0 matches).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap + project anchors

- `.planning/ROADMAP.md` §"Phase 12: Observability Conformance Surface" — phase entry, milestone (v1.2), sub-tracks, anticipated decision set (D-12-01..09 provisional from Phase 11 forward references).
- `.planning/PROJECT.md` — core value (read-only on project FS; data stays local; no cloud-side storage); hard architectural constraints.
- `.planning/REQUIREMENTS.md` — phase-anchored REQ-IDs to mint during planning.
- `docs/spec/dashboard-prompt.md` — hard architectural constraints (read-only on project FS, daemon writes confined to `~/.agenticapps/dashboard/`, no native deps, bearer-auth on every route, CORS lock).

### Prior phase context (Phase 12 anticipation)

- `.planning/phases/DASH-11-coverage-trends-skill-drift/11-CONTEXT.md` §"Phase 12 anticipation" — D-11-07 (family-aggregate deferred here) + D-11-08 (sidebar IA — 3rd entry slot) + D-11-11 (sibling-endpoint pattern) + D-11-12 (per-feature schema file boundary).
- `.planning/phases/DASH-11.2-impeccable-p2-polish-bundle/11.2-CONTEXT.md` §"Out of scope" — Coverage responsive collapse <768px (carry-over to Phase 12); family-aggregate worst-state-wins refinement (carry-over consideration).
- `.planning/phases/DASH-11.1-impeccable-p1-polish-bundle/11.1-CONTEXT.md` — `PageHeader` sticky variant + `--ph-h` CSS var + `Toast` primitive contracts (Phase 12 reuses both).
- `.planning/phases/DASH-10-coverage-matrix-page-per-repo-presence-freshness-of-claude-m/10-CONTEXT.md` — Coverage matrix wire schema, scanner orchestrator, 30s daemon-cache pattern.
- `.planning/phases/DASH-10.5-impeccable-skill-driven-gate/10.5-DECISIONS.md` — D-10.5-03 composite ≥87 floor (Phase 12 IMPECCABLE = calibration data point #5).
- `.planning/phases/DASH-10-coverage-matrix-page-per-repo-presence-freshness-of-claude-m/10.6-DECISIONS.md` (or 10.6 in-line if no separate decisions doc) — `gitNexusInstallState` enum semantics for conformance scoring.

### Code reuse surfaces

- `packages/shared/src/schemas/coverage.ts` — `CoverageResponseSchema`, `CoverageColumn`, `RepoCoverage`, `gitNexusInstallState` enum (Phase 10.6).
- `packages/shared/src/schemas/coverageHistory.ts` — `CoverageHistoryEntry`, NDJSON-row schema (Phase 11). Phase 12 reads from the NDJSON store for the 90-day series; does NOT extend this schema.
- `packages/agent/src/lib/scanners/coverageScan.ts` — orchestrator (extension surface for `aggregateByFamily`).
- `packages/agent/src/lib/coverageHistoryCache.ts` — Phase 11 cache pattern (model for `conformanceCache.ts`).
- `packages/agent/src/routes/coverageHistory.ts` — Phase 11 route pattern (model for `routes/conformance.ts`).
- `packages/spa/src/lib/coverageHistoryQueries.ts` — Phase 11 query-hook pattern (model for `conformanceQueries.ts`).
- `packages/spa/src/components/ui/PageHeader.tsx` — Phase 11.1 sticky variant.
- `packages/spa/src/components/ui/Toast.tsx` — Phase 11.1 single-slot toast (used for path-fix success/error).
- `packages/spa/src/components/ui/Sidebar.tsx` — Section pattern (D-10-08 + D-11-08); Phase 12 adds `Conformance` entry under `Observability` section.
- `packages/spa/src/components/AppShellV2.tsx` — Shell composition.
- `packages/spa/src/styles/tokens.css` — Phase 5.1 token namespace (warm paper, aubergine, accent purple, status tokens).
- `packages/spa/src/components/panels/coverage/coverageColumns.ts` — column SoT (Phase 11.1); Phase 12 reads column count for score denominator.

### Daemon-side daemon-write contract

- `packages/agent/src/lib/paths.ts` — daemon-write allow-list (Phase 1 D-15); Phase 12 confirms `~/.agenticapps/dashboard/registry.json` is the only mutated file.
- `packages/agent/src/middleware/auth.ts` — bearer-auth enforcement (every Phase 12 route inherits).
- `packages/agent/src/middleware/cors.ts` — CORS lock (every Phase 12 route inherits).

### Threat model precedents (for `/cso`)

- Phase 10 `10-SECURITY.md` — symlink-escape guard pattern (CODEX HIGH-2), resolver-everywhere pattern (HIGH-3).
- Phase 1 `01-SECURITY.md` — registry-write threat model (path traversal, mode `0600`, idempotency).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`coverageScan` orchestrator** (`packages/agent/src/lib/scanners/coverageScan.ts`) — Phase 10 multi-scanner aggregator. Phase 12 extends with `aggregateByFamily(coverageResponse) → { agenticapps, factiv, neuroflash, fleet }` roll-up function. No new scanner needed.
- **NDJSON `coverage-history/` store** (`~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson`) — Phase 11 stood this up; Phase 12 reads it for the 90-day series. Read-only consumption.
- **`coverageHistoryCache` + `coverageHistory` route** (Phase 11) — exact pattern for `conformanceCache` + `conformance` route. Copy structure, swap shape.
- **`Sidebar.tsx` Observability section** — currently 2 entries (Coverage, Skill drift); Phase 12 adds Conformance as 3rd (Phase 11 D-11-08 anticipated the slot).
- **`PageHeader` sticky variant** (Phase 11.1) — Phase 12 reuses with `sticky` prop set; `--ph-h` CSS var consumed by chart top-offset.
- **`Toast` primitive** (Phase 11.1) — single-slot, opacity-only animation; Phase 12 wires path-fix success/error feedback.
- **Phase 5.1 status tokens** (`text-status-success`, `text-status-warning`, `text-status-error`, `bg-status-*`) — tier coloring for family cards. No new tokens minted in Phase 12; if family-distinct chart colors are needed, planner picks from the existing palette.
- **`gitNexusInstallState` enum** (Phase 10.6) — score weighting: `not-installed` → 0 (excluded from denominator); `installed-no-registry` → counts as `missing` (red); `installed-with-registry` → standard freshness rating.

### Established Patterns

- **Sibling routes over widening** (D-11-11, D-12-02) — every cross-cut surface gets its own route + schema file. Mirrors the per-feature folder discipline in `panels/`.
- **30s daemon cache singleton** (Phase 10 `coverageCache`, Phase 11 `coverageHistoryCache`) — Phase 12 `conformanceCache` follows.
- **Zod-barrel + parseOrDrift** (Phase 10) — every new schema gets a barrel re-export and SPA-side `parseOrDrift` defense.
- **TDD + RED state stubs in Wave 0** (Phase 10, 11) — Wave 0 lands the wire-schema tests + scanner test stubs + SPA panel test stubs before Wave 1 implementations turn them green.
- **Pure-SVG chart primitive** (Phase 11 D-11-03 set the precedent; Phase 12 inherits). No chart libraries.

### Integration Points

- **`packages/spa/src/router.tsx`** — add `conformanceRoute` (lazy-loaded, `validateSearch: zodValidator`, `errorComponent` reuse per Phase 7 Pitfall 8).
- **`packages/spa/src/components/ui/Sidebar.tsx`** — Observability section gains 3rd entry: `Conformance` (above or below `Skill drift` — planner picks; `Coverage` stays first as the entry-point view).
- **`packages/agent/src/server/app.ts`** — mount `conformanceRoute` + `registryFixPathRoute` under bearer-auth + CORS lock.
- **`packages/agent/src/lib/paths.ts`** — allow-list extension if needed; `registry.json` write is already allowed (Phase 1 D-15).
- **`packages/shared/src/index.ts`** — barrel re-export `conformance.ts` schema.

### Pre-existing TypeScript diagnostics

Pre-existing TypeScript diagnostics on files outside Phase 12's diff (`CoverageHistoryQueries`, `SkillDriftQueries`, `CoverageDriftBadge`, `SkillDriftCell`, `SkillDriftMatrix`, etc.) are stale state from another in-flight feature branch and surface on every unrelated edit (per session-handoff 2026-05-19 "Open questions"). They do NOT block Phase 12 work but should be cleaned up either inside Phase 12 (low risk; ≤10 min) or as a separate hygiene pass.

</code_context>

<specifics>
## Specific Ideas

- **"Conformance" as the noun** for the third Observability surface — not "Trend" (Phase 11 anticipated `/observability/trend` but conformance is the broader concept; trend is one way of viewing it). The sidebar entry is `Conformance`; the chart shows trends *of* conformance.
- **Tier thresholds intentionally match WCAG-style two-line cuts** (90/70 ≈ AAA/AA mental anchors) — users coming from the Coverage matrix already think in 4-state buckets (green/amber/red/grey); the conformance score is just the rolled-up percentage of that 4-state distribution.
- **The fleet-aggregate polyline gets visual weight** (heavier stroke, distinct token) so the user's eye lands on the headline number first. Family polylines are secondary signal.
- **No `OverrideSentinel` honoring on conformance scoring for v1.2.0** — the per-repo override sentinel (`.agenticapps-override.json`) suppresses *Coverage display*, not score participation. Future v1.2.x could honor it; v1.2.0 keeps the score honest.

</specifics>

<deferred>
## Deferred Ideas

These came up during scoping but belong outside Phase 12 v1.2.0:

- **Per-skill conformance weighting** (fold skill drift into the score) → v1.2.1 or later. Decision deferred until v1.2.0 dogfooding confirms the 4-Coverage-column score is the right primary signal.
- **Per-project drill-down on the trend chart** (click a polyline → repo-level history overlay) → Coverage page already provides per-repo state; per-repo trend is redundant for v1.2.0.
- **Export to CSV/PNG** → v1.3+. No export workflow exists in the dashboard yet.
- **Slack/email notifications on conformance regression** → Phase 8 territory (push surfaces require Sentry/Linear upstream tooling).
- **Custom per-project conformance thresholds** → universal 90/70 thresholds for v1.2.0; per-project overrides only if signal demands.
- **30/60/90 day toggle on the chart** → Single 90-day window for v1.2.0. Revisit if users report the 90d window obscures recent-only signal.
- **Score decimals** (`87.3%` vs `87%`) → integers only. Decimals add visual noise without operational meaning at fleet scale.
- **Cross-family workflow upgrade orchestration** → Adjacency hint from the v1.1 close-out audit; separate phase if/when justified. Conformance surface might expose the *need* for this, but the *fix* is a separate workstream.
- **Conformance regression alerts in-dashboard** (red banner when score drops >X in 24h) → v1.2.x; v1.2.0 keeps the surface read-only-with-fix-paths.
- **Per-family chart-color customization** → planner picks tokens from existing Phase 5.1 palette; user customization is not a v1.2.0 concern.

### Reviewed Todos (not folded)

No pending todos matched against Phase 12 (`gsd-tools todo match-phase 12` returned 0 matches).

</deferred>

---

*Phase: 12-observability-conformance-surface*
*Context gathered: 2026-05-19 (auto-mode, ratified against Phase 11 D-12-* anticipation)*
