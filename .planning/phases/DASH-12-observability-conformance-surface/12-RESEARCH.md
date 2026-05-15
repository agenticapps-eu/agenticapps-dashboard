# Phase 12: Observability Conformance Surface — Research

**Compiled:** 2026-05-15
**Purpose:** Brainstormed alternatives per `superpowers:brainstorming` for each gray-area decision in `12-CONTEXT.md`. **At least 2 alternatives per decision**, with the recommendation called out. Decisions are **NOT** locked here — `/gsd-discuss-phase 12` resolves them via AskUserQuestion.

This document is a working RESEARCH.md. `/gsd-plan-phase 12` extends it with technical realities and rejected-option post-mortems before producing the executable plan.

---

## D-12-01 — GSD phase number

The hand-off says to cut the branch now and sequence the merge after the redesign branch (which doesn't exist) and/or after Phase 11. The phase-number choice affects roadmap math, not technical work.

### Alternative A — **Phase 12** (recommended)

Allocate the next major number. Phase 11 (Coverage trends + Skill drift, decided 2026-05-15) keeps its slot.

- **Pros:** Continuous numbering. Branch can be cut and worked in parallel; merge order resolved by PR review. Phase 11's snapshot history pattern (daily snapshots under `~/.agenticapps/dashboard/coverage-history/`) gets defined first and Phase 12 can mirror it for baseline history snapshots, avoiding a parallel-invention conflict.
- **Cons:** If Phase 12 finishes before Phase 11, the snapshot pattern must be invented here, then Phase 11 inherits it. Mitigatable.

### Alternative B — Phase 11.5

Slot between Phase 11 and a future Phase 12. Mirrors the Phase 5.1 / Phase 6.1 / Phase 10.5 / Phase 10.6 pattern (interstitial polish/fix phases).

- **Pros:** Signals "lives in the Observability section that Phase 11 introduces."
- **Cons:** The decimal phases in this repo have been polish/fix/follow-up *to a recently-shipped phase*, not new feature work of comparable scope. Phase 12's hand-off is a full 5-plan feature, not polish — using the decimal slot misrepresents the scope.

### Alternative C — Defer until Phase 11 ships, then renumber

Don't cut the branch yet.

- **Pros:** Cleanest sequencing; no parallel branches.
- **Cons:** Hand-off explicitly says "cut now, sequence after." Defeats the parallelism the hand-off proposes.

**Recommendation: A — Phase 12.** Document the Phase 11 → Phase 12 dependency in `12-CONTEXT.md` and coordinate snapshot-storage path with Phase 11's planner.

---

## D-12-02 — Daemon route shape

`/api/projects/:id/observability` already exists for Phase 5 HEALTH-03 (Sentry / Spotlight / Sentry-CLI detection). Phase 12 must not break that contract.

### Alternative A — **New sibling routes** under `/observability/baseline*` (recommended)

```
GET /api/projects/:id/observability/baseline                — current baseline.json
GET /api/projects/:id/observability/baseline/history?days=N — Baseline[] from git log of baseline.json
GET /api/projects/:id/observability/scan-report             — raw .scan-report.md text
GET /api/observability/trend?days=N                          — fleet-wide aggregate trend (no projectId)
```

- **Pros:** No breaking change. Each endpoint has a focused Zod contract. URL namespace stays semantic. Fleet trend gets a flat route (no `:id`) which mirrors `/api/coverage` from Phase 10.
- **Cons:** Four new routes. Slight contract surface growth. Tests required for each.

### Alternative B — Extend existing `/observability` to return baseline data too

Merge §10.9 baseline + Phase 5 HEALTH-03 data into one `ObservabilityResponseSchema`.

- **Pros:** One route, one Zod schema, one cache entry.
- **Cons:** **Breaks Phase 5 schema contract.** Any consumer (existing dashboard panel) would need to be updated in lockstep. Conflates two orthogonal observability concerns (vendor tooling presence vs §10.9 conformance).

### Alternative C — Single rich route `GET /api/projects/:id/observability/conformance`

Returns baseline + history + scan-report excerpt in one payload.

- **Pros:** Single roundtrip per project; SPA can render detail view from one fetch.
- **Cons:** Couples three independent data sources behind one cache TTL. History is git-log-walking (slower); scan-report is potentially large markdown; baseline is fast. Mixing them gives the worst TTL of the three.

**Recommendation: A.** Four narrow endpoints with independent caches (5s for baseline, 30s for history, 60s for scan-report-tail, 30s for fleet trend). Mirrors the Phase 10 coverage cache pattern.

---

## D-12-03 — Path allow-list extension

Phase 1 constraint: `/read` resolves only under `<root>/.planning` and `<root>/.claude`. Phase 12 needs `<root>/.observability/baseline.json` and `<root>/.scan-report.md`.

### Alternative A — **Dedicated typed endpoints, no `/read` widening** (recommended)

The new routes from D-12-02-A resolve `<root>/.observability/baseline.json` and `<root>/.scan-report.md` internally. Each endpoint hard-codes its target relative path; no path parameter, no glob, no symlink-following. Return Zod-validated JSON (for baseline) or raw text (for scan-report).

- **Pros:** Adds two specific files to the trust boundary, not a glob. Endpoints expose typed payloads, not filesystem access. `/cso` audit narrow and focused.
- **Cons:** Two new resolvers to test. Slightly more code than widening `/read`.

### Alternative B — Widen `/read`'s allow-list to include `.observability`

Add `.observability` (and `.scan-report.md` at root) to the existing allow-list.

- **Pros:** One code change. Reuses existing `/read` infrastructure.
- **Cons:** `/read` returns *raw file contents* with no schema validation. SPA would then parse arbitrary text and the trust boundary moves into the SPA. Spec compliance becomes harder to audit (anyone with `/read` can request `.observability/anything.json`). Worse: `.scan-report.md` can be quite large, and `/read` has no size cap mentioned in Phase 1.

### Alternative C — Symlink-only opt-in: project owner symlinks `.observability/baseline.json` into `.planning/`

Use the existing `.planning` allow-list by indirection.

- **Pros:** Zero daemon code change.
- **Cons:** Symlinks-as-API is brittle, surprising, and security-sensitive (the allow-list resolver would need to canonicalize realpaths). Spec §10.9 declares `.observability/baseline.json` as the canonical path; bouncing through `.planning` violates that intent.

**Recommendation: A.** Narrow, typed, auditable.

---

## D-12-04 — Chart library

No chart lib currently installed. Three primitives needed: sparkline (per-project detail view), stacked bar (per-checklist breakdown), line chart (fleet trend over 90 days).

### Alternative A — **Hand-rolled SVG for v1** (recommended)

Three small components:

- `<Sparkline data={number[]} />` — polyline over a viewBox, ~30 LOC.
- `<StackedBar segments={{label, value, color}[]} />` — flex of div widths or SVG rects, ~40 LOC.
- `<LineChart data={{date, value}[]} />` — SVG polyline + axis labels + hover dots, ~120 LOC.

- **Pros:** Zero new dependency. Bundle size impact 0. Full control over a11y (text-equivalents, ARIA roles). Tokens drive colors (matches the design system). Visual hierarchy matches the design tokens cleanly.
- **Cons:** ~190 LOC + tests to maintain. No advanced interactions (brushing, zoom) — but v1 doesn't need them. The 90-day line chart with hover-dots is the riskiest piece (interaction).

### Alternative B — Recharts

Full-featured React chart library. ~75 KB gzipped.

- **Pros:** Battle-tested. Trivial to swap chart types. ResponsiveContainer handles size automatically.
- **Cons:** Largest bundle. Brings d3 transitively. Default styles do not match the design system; restyling is non-trivial. Adds a new dep right before a possible redesign branch.

### Alternative C — visx (low-level d3 primitives + React)

- **Pros:** Smaller than recharts, more composable, design-system-friendly. Same SVG primitives as hand-rolled but with axis/scale helpers.
- **Cons:** Still a new dependency. ~40 KB gzipped.

### Alternative D — Sparkline-only deps like `react-sparklines` (~3 KB)

- **Pros:** Tiny.
- **Cons:** Solves only the sparkline; the fleet trend chart still needs another solution. Two libraries for one concern is worse than one or zero.

**Recommendation: A — hand-rolled SVG.** Revisit if Phase 12.1 wants brushing/zoom or if Phase 11 lands recharts first.

---

## D-12-05 — Status pill thresholds

Hand-off defaults: 0/7/14 days. Reasonable; not based on data.

### Alternative A — **Accept hand-off defaults for v1** (recommended)

`Conformant` = gaps=0 AND scan ≤7 days old.
`Drift Detected` = gaps>0 (any age).
`Stale` = scan >14 days old (regardless of gap count — overrides Conformant).
`Not Set Up` = no baseline file.

- **Pros:** Simple. Matches hand-off. Easy to override later.
- **Cons:** No empirical basis. Stale window may be too long (scan-apply should be a weekly habit) or too short.

### Alternative B — Tighter thresholds (3/14)

`Stale` = scan >7 days; `Conformant` requires scan ≤3 days.

- **Pros:** Encourages more frequent scans.
- **Cons:** Most projects would be `Stale` most of the time, devaluing the signal.

### Alternative C — Configurable per-project via baseline metadata

Add an optional `dashboard.staleness_days: number` in the baseline (or in §10.8 metadata).

- **Pros:** Per-project tuning.
- **Cons:** Spec change for an open question. Premature.

**Recommendation: A.** Surface tuning as a Phase 12.1 follow-up if `/qa` reveals the defaults misfire.

---

## D-12-06 — Run-scan UX

Browser context, no terminal launcher.

### Alternative A — **Clipboard-only** (recommended)

Button renders `Copy "claude /add-observability scan-apply --confidence high" to clipboard` (project root + selected confidence pre-filled). Toast on copy. Matches Phase 10 D-10-09 precedent (wiki refresh, CLAUDE.md authoring, workflow-version update were all clipboard-only).

- **Pros:** Works in every runtime (browser, Tauri, Electron). Single code path. No SSH/terminal coupling.
- **Cons:** User has to paste into terminal — one extra step.

### Alternative B — Daemon spawns the command

Daemon shells out to `claude /add-observability scan-apply ...`.

- **Pros:** One-click.
- **Cons:** `claude` is a slash-command-driven CLI with interactive elicitation. Headless execution is unsupported or experimental. Same trap as D-10-09's wiki-compile attempt. Spawning interactive CLIs from a daemon route is non-conformant with Phase 1 read-only spirit.

### Alternative C — Daemon writes a "scan request" file the user's running Claude Code instance picks up

- **Pros:** Bridges browser → editor without spawning.
- **Cons:** Coupling to a Claude-Code-specific file-watcher convention that doesn't exist. Architecturally fragile.

**Recommendation: A.** Clipboard + toast + a `/help/observability/scan` link.

---

## D-12-07 — Scan-report rendering

Hand-off recommends full render via existing MDX renderer.

### Alternative A — **Full render in slideover panel** (recommended)

Reuse `packages/spa/src/help/mdxComponents.tsx` renderer. Slideover from right (lucide-react `X` close, esc to close, click outside dismisses).

- **Pros:** User stays in dashboard context. Full report accessible. Free a11y from existing renderer.
- **Cons:** Slideover component doesn't exist yet — needs building, but reusable across other dashboard surfaces.

### Alternative B — Executive summary only (first N lines + "expand" link)

Render the first ~40 lines of the report inline; expand opens the full report in a new tab.

- **Pros:** Smaller initial payload. Faster.
- **Cons:** Loses context. Drift contributors are often in the middle of the report.

### Alternative C — Open as new tab to `/help/scan-report/:projectId`

Treat it as a help-doc page in the dashboard's existing help shell.

- **Pros:** Reuses help-route infra.
- **Cons:** Scan reports are project-specific, not topic-specific. Mounting them under `/help` is a category error.

**Recommendation: A.** Add a generic `<Slideover>` primitive while we're at it (Phase 11 may use it too).

---

## D-12-08 — Help-page authoring

The hand-off references v1.1 help docs that will live at `/help/observability/scan` + `/help/observability/apply`. They don't exist yet.

### Alternative A — **Phase 12 wires HelpHooks to stubs via ComingSoonRoute** (recommended)

Reuse the existing `ComingSoonRoute` pattern (Phase 7). HelpHooks resolve to "Coming soon" pages until v1.1 help docs author the real content.

- **Pros:** Phase 12 doesn't block on help-doc authoring. No broken links.
- **Cons:** Users clicking HelpHook see a placeholder, not the substantive page. Acceptable in v1.

### Alternative B — Phase 12 authors the help pages too

Bundle help-doc authoring into Phase 12's scope.

- **Pros:** Complete experience at v1 launch.
- **Cons:** Doubles the phase's scope. Help-doc authoring has its own review cadence (technical writer pass) and is a separate workstream per the hand-off.

### Alternative C — No HelpHooks in v1; add when help pages land

- **Pros:** No broken/stub links.
- **Cons:** Loses the in-context help affordance the hand-off explicitly designs for. Retrofitting hooks across three views later is wasted churn.

**Recommendation: A.** Stub pages render with a single-paragraph description + a "Help docs v1.1 will fill this out" notice + a link back to the relevant dashboard view.

---

## D-12-09 — Registry root-path drift status pill

Observation: registry entries reference paths that may no longer exist post family-reorg. Without surfacing this, mis-pathed projects render as `Not Set Up` — misleading.

### Alternative A — **New status pill `Registry Drift`** (recommended)

Daemon reports `root_exists: boolean` per project. SPA renders:

- `Not Set Up` — root exists, baseline file missing.
- `Registry Drift` — root path itself doesn't exist on disk. Different icon (e.g. broken-link), different color. Clicking opens a help page on `agentic-dashboard register --auto` or a manual rename action.

- **Pros:** Surfaces a real hygiene issue. Cheap to compute. Distinguishes registration error from "haven't run scan yet."
- **Cons:** One more status state to document and test. Pill UI must accommodate a 5th state without crowding.

### Alternative B — Filter mis-pathed projects out of the Observability list

Silently exclude them.

- **Pros:** Cleaner list.
- **Cons:** Mis-pathed projects disappear from the dashboard's view entirely — bad for hygiene. The user has no signal that their registration is broken.

### Alternative C — Treat as `Not Set Up` (do nothing)

- **Pros:** No new code.
- **Cons:** Misleading status. User runs scan-apply on a non-existent path and gets a confusing error.

**Recommendation: A.** Surface the broken state explicitly.

---

## Cross-cutting notes for `/gsd-plan-phase 12`

These aren't decisions but inputs the planner needs:

- **Reuse opportunity with Phase 11.** Phase 11 (Coverage trends) likely introduces a snapshot-storage path under `~/.agenticapps/dashboard/coverage-history/`. Phase 12's history-walking reads from `git log` of `.observability/baseline.json` directly (no daemon-side snapshot storage needed — git is the historical store). Plan Phase 12's history scanner to be deterministic from git log alone; don't take on a daemon-side baseline snapshot infra unless Phase 11 ships one we can mirror.
- **Test-fixture strategy.** Commit two fixture baselines under `packages/agent/test-fixtures/observability-baselines/` (one conformant, one drift-detected). Don't depend on the registry's pointing at real fx-signal-agent / cparx paths; those paths drift.
- **Lazy-route convention.** Phase 7 established `createLazyRoute('/...lazy.tsx')`. Phase 12's three views all use this — page chunks load on demand, sparkline+chart primitives are siblings.
- **Sidebar IA — single vs grouped.** D-10-08 added `Observability` as a section. Phase 11 will likely add `Coverage Trends` + maybe `Skill Drift` as 1–2 entries in that section. Phase 12 adds `Conformance` (overview) + may add `Trend` as a separate entry, OR fold the trend view as a sub-tab inside `Conformance`. Decide in `/gsd-discuss-phase 12` after Phase 11's IA settles. Pre-recommendation: `Observability → {Coverage, Coverage Trends, Skill Drift, Conformance}` (3 entries from Phase 11 + 1 from Phase 12, with `Conformance Trend` as a sub-route inside `Conformance`, not a peer entry).
- **Bundle budget.** Hand-rolled SVG charts keep us well under the bundle budget. If we later swap to recharts, the addition needs a budget review (Phase 6 introduced bundle metrics).
- **A11y baseline.** Every chart primitive needs a `role="img"` + `aria-label` + a hidden table-equivalent. Phase 10's coverage matrix established the pattern; reuse it.
- **i18n future-proofing.** All status pill labels go through the existing string table (not yet enforced for help docs — Phase 7 deferred). Phase 12 follows the existing pattern: string literals in JSX, future i18n pass extracts them. Don't pre-emptively wire i18n.
