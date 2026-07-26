# Phase 12: Observability Conformance Surface - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `12-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 12 — Observability Conformance Surface
**Mode:** `/gsd-discuss-phase 12` (`--auto`-equivalent — user directive: "continue with 12, no clarifying questions")
**Areas discussed:** Scope + IA · Conformance score model · Chart primitive · Wire schema · Registry path drift · Responsive collapse · Gates
**Ratification basis:** Phase 11 `11-CONTEXT.md` §"Phase 12 anticipation" (D-12-01..09 forward references); Phase 11.1 + 11.2 carry-over deferred items; user auto-memory `feedback_sidebar_section_architecture` ("prefer new sidebar section with growth room over peer top-level items").

---

## Scope + Sidebar IA

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling under `Observability` (Coverage / Skill drift / Conformance) | 3rd entry in existing section; graduates Observability to multi-item maturity | ✓ |
| New top-level section (`Conformance` peer to `Observability`) | Separates concerns but fragments fleet-observability narrative across 2 sections | |
| Inline tab on `/coverage` | Lowest sidebar weight; loses standalone URL + bookmarkability | |

**Auto-selected:** Sibling under `Observability` (D-12-01).
**Notes:** Locked in Phase 11 D-11-08 anticipation. Matches user's stated preference for graduating sections over peer top-level items (auto-memory). No revisit needed.

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling route `/observability/conformance` | Mirrors Phase 11 D-11-11 sibling-endpoint discipline; separate consumer | ✓ |
| Widen Phase 5's `/observability` aggregator | Reuses existing route but conflates per-project signals with cross-project roll-up | |

**Auto-selected:** Sibling route (D-12-02).
**Notes:** Phase 5's `/observability` is per-project Sentry/Linear/etc. signal surface — different shape, different cadence, different consumer. Conflating would couple v1.2 fleet roll-up to v1.0 per-project observability evolution.

---

## Conformance score model

| Option | Description | Selected |
|--------|-------------|----------|
| Equal-weighted % of green cells across 4 Coverage columns | Simplest model; ships honest baseline; revisit if columns prove unequally important | ✓ |
| Workflow-weighted (50% Workflow + 50% other 3 columns) | Privileges fleet-wide workflow currency; opinionated choice without dogfooding data | |
| Per-family customizable weights | Maximum flexibility; doubles surface area for v1.2.0 without proven need | |

**Auto-selected:** Equal-weighted (D-12-03).

| Option | Description | Selected |
|--------|-------------|----------|
| ≥90 green / 70–89 amber / <70 red | Matches WCAG-style two-line cuts users already think in | ✓ |
| ≥80 green / 60–79 amber / <60 red | Lower thresholds; "fully healthy" feels achievable too early | |
| ≥95 green / 80–94 amber / <80 red | Higher thresholds; risk of perpetual amber state demotivating maintenance | |

**Auto-selected:** 90/70 tier mapping (D-12-04).

| Option | Description | Selected |
|--------|-------------|----------|
| 0–100 integer (no decimals) | `87%` is signal; `87.3%` is noise | ✓ |
| One decimal (`87.3%`) | Perceived precision without operational meaning | |
| Whole percentages with 5-step rounding (`85%` / `90%`) | Reduces noise but loses 1-point movement signal | |

**Auto-selected:** Integer (D-12-05).

| Option | Description | Selected |
|--------|-------------|----------|
| 3 family cards + 1 fleet aggregate | Matches user mental model (3 Sourcecode subtrees + headline) | ✓ |
| Per-repo card grid | Duplicates `/coverage` matrix; defeats the roll-up purpose | |
| Single fleet number, no per-family breakdown | Headline only; loses family-level signal that drives prioritization | |

**Auto-selected:** 3 + 1 (D-12-06).

---

## Chart primitive

| Option | Description | Selected |
|--------|-------------|----------|
| Pure-SVG primitive, ≤120 LOC | Matches Phase 11 D-11-03 zero-third-party-JS; structurally simple chart | ✓ |
| Recharts | ~80KB gzipped; overkill for 4 polylines + 4 gridlines | |
| Chart.js | ~60KB gzipped + canvas (loses SVG accessibility) | |
| D3 | Maximum power; maximum LOC + learning curve | |

**Auto-selected:** Pure-SVG (D-12-08). Planner may spike viability in Wave 0; escalate if SVG gets ugly before Wave 1.

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 90-day window | Matches existing NDJSON retention; no UI weight | ✓ |
| 30/60/90 day toggle | Adds UI control without proven signal-need for v1.2.0 | |
| 365-day window | Requires retention extension; out of v1.2.0 scope | |

**Auto-selected:** 90-day fixed (D-12-09).

| Option | Description | Selected |
|--------|-------------|----------|
| 4 polylines (3 family + 1 fleet aggregate, heavier weight) | Headline gets visual weight; family details are secondary signal | ✓ |
| 1 polyline (fleet only) + 3 family cards | Cleanest chart; loses temporal family-comparison signal | |
| 3 polylines (family only), no fleet | Forces user to mentally average; defeats purpose of fleet view | |

**Auto-selected:** 4 polylines (D-12-10).

| Option | Description | Selected |
|--------|-------------|----------|
| Hover + focus + keyboard reveal | Touch-compatible (Tailscale-from-iPad); mirrors Phase 11 D-11-02 | ✓ |
| Hover-only disclosure | Breaks on touch devices | |
| Always-on per-tick labels | Chart noise at 90 daily ticks | |

**Auto-selected:** Hover + focus + keyboard (D-12-11).

| Option | Description | Selected |
|--------|-------------|----------|
| Inline message "Building 90-day trend — N more days of data needed" when <14 days | Honest wait-state; no misleading sparse chart | ✓ |
| Render sparse chart with whatever days are present | Misleading — looks complete but isn't | |
| Hide chart, show only family cards | Loses the trend-visibility purpose of the page | |

**Auto-selected:** Inline wait-state message (D-12-13).

---

## Wire schema

| Option | Description | Selected |
|--------|-------------|----------|
| Sibling endpoint `GET /api/observability/conformance` | Keeps Coverage matrix path tight; separate cadence | ✓ |
| Extend `CoverageResponseSchema` with `conformance?: …` field | Bloats the hot 30s Coverage payload | |
| New top-level `/api/conformance` route | Loses the observability namespace grouping | |

**Auto-selected:** Sibling under `/api/observability/` (D-12-14).

| Option | Description | Selected |
|--------|-------------|----------|
| Bulk-per-family in single payload (~9KB at 90 days × 5 numbers per row) | One fetch per visit; matches Phase 11 PD-11-02 refinement | ✓ |
| Per-family endpoint (`?family=agenticapps`) | 4 round-trips per page load; over-fragmented | |
| Per-day endpoint (`?date=2026-05-19`) | Per-day breakdown panel could lazy-fetch but defaults to bulk-loaded series | |

**Auto-selected:** Bulk-per-family (D-12-16).

---

## Registry path drift auto-correction

| Option | Description | Selected |
|--------|-------------|----------|
| Ship in Phase 12 (carry-over from Phase 11 D-12-09 anticipation) | Bundles related hygiene into the cross-cutting fleet-observability surface | ✓ |
| Defer to v1.2.x bundle | Phase 12 stays narrower but loses adjacency benefit | |
| Defer to Phase 13+ | Loses the existing scope/research overhead saving | |

**Auto-selected:** Ship in Phase 12 (D-12-18).

| Option | Description | Selected |
|--------|-------------|----------|
| `POST /api/admin/registry/fix-path` daemon route (mode 0600 writes confined to `~/.agenticapps/dashboard/`) | Mirrors Phase 1 D-15 path-confine pattern; clean trust-boundary | ✓ |
| Spawn CLI in user's terminal to fix path | Outside the dashboard's read-only-on-project-FS contract; not the right surface | |
| Auto-fix without user confirmation | Risk of bad inference clobbering registry; user-confirmation gate required | |

**Auto-selected:** Daemon route + user confirmation (D-12-19).

---

## Coverage responsive collapse (carry-over)

| Option | Description | Selected |
|--------|-------------|----------|
| Bundle into Phase 12 | Adjacency to conformance surface (also responsive-sensitive); single impeccable run | ✓ |
| Defer to Phase 12.x bundle | Loses adjacency; risks accumulating responsive backlog | |
| Defer indefinitely | Phase 11.1/11.2 already deferred; further defer signals it'll never ship | |

**Auto-selected:** Bundle into Phase 12 (D-12-22, D-12-23).

| Option | Description | Selected |
|--------|-------------|----------|
| `useViewportBreakpoint` hook + `xs:` breakpoint card-per-row in CoverageFamilySection | Minimal new abstraction; matches Phase 11.1 `usePageHeaderHeight` pattern | ✓ |
| Tailwind responsive utilities only (no hook) | Doesn't expose breakpoint state to TS; harder to conditionally render different components | |
| Full CSS Grid refactor (no JS hook) | Larger surface; risk of regressing Phase 11.1 `<colgroup>` width contract | |

**Auto-selected:** Hook + breakpoint (D-12-22).

---

## Gates + verification

| Option | Description | Selected |
|--------|-------------|----------|
| `/cso` REQUIRED (new daemon write surface) | Path traversal + symlink escape + concurrent-write race threats | ✓ |
| `/cso` NOT REQUIRED (read-only route) | Wrong — `POST /api/admin/registry/fix-path` mutates registry | |

**Auto-selected:** `/cso` REQUIRED (D-12-26).

| Option | Description | Selected |
|--------|-------------|----------|
| Two-stage review (Stage 1 + Stage 2 separate) | Workflow contract — do NOT collapse | ✓ |
| Single-stage review | Violates project workflow discipline | |

**Auto-selected:** Two-stage (D-12-27).

| Option | Description | Selected |
|--------|-------------|----------|
| `/impeccable critique` → `12-IMPECCABLE.md` at 1440×900 (calibration data point #5) | Continues the post-Phase-10.5 per-phase artifact contract | ✓ |
| Skip impeccable run | Violates D-10.5-02 (skill-driven artifact is the gate) | |

**Auto-selected:** Impeccable run + calibration data point #5 (D-12-29).

---

## Claude's Discretion

Areas where the planner has flexibility (not asked):

- Exact stroke weights / opacity values for the 4 polylines
- Per-day breakdown panel position (above/below/anchored)
- Drift detector cadence (recommended: 30s matching coverage cache)
- Suggested-path inference fallback wording when `.git/config` is unreadable
- Whether to fold Coverage `<768px` impeccable re-pass into Phase 12's artifact or punt to Phase 12.x
- Order of `Conformance` vs `Skill drift` entries under Observability section
- Whether to use family-distinct chart-color tokens (if defined in Phase 5.1) or planner-picked tokens

## Deferred Ideas

See `12-CONTEXT.md` `<deferred>` section — captures 10 v1.2.x+ ideas surfaced during scoping (per-skill weighting, drill-down, export, push notifications, custom thresholds, day-range toggle, decimals, cross-family upgrade orchestration, regression alerts, color customization).
