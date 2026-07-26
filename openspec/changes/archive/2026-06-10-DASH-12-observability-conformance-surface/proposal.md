# Phase 12: Observability Conformance Surface -

**Archived from GSD phase `DASH-12-observability-conformance-surface`. Completed 2026-06-10.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/DASH-12-observability-conformance-surface/` — that tree, not this file, is the authoritative record.

## Why

Phase 12 opens **v1.2 — Fleet conformance & drift visibility** by graduating the Observability section from 2 surfaces (Coverage point-in-time + Skill drift cross-cut) to 3 by adding `/observability/conformance` — a fleet-level view answering "how conformant is every registered project to the AgenticApps standard, and how is conformance trending over 90 days?"

**Primary deliveries:**

1. **`/observability/conformance` route** — 3rd entry under `Observability` sidebar section. Composes:
   - 3-up family card row (agenticapps / factiv / neuroflash) showing current conformance score + 14d delta + status tier (green/amber/red).
   - 90-day fleet trend chart (pure SVG primitive, ≤120 LOC, no chart library — matches Phase 11 D-11-03 zero-third-party-JS stance).
   - Drifted-registry-path panel (when present) with one-click "Fix path" affordance per entry.

2. **Conformance score** — equal-weighted % of green cells across the 4 Coverage columns (CLAUDE.md / GitNexus / Wiki / Workflow). 0–100 integer. Tier mapping: ≥90 green / 70–89 amber / <70 red. Computed daemon-side, rolled up per family + fleet.

3. **Registry path drift auto-correction** — detector + `POST /api/admin/registry/fix-path` daemon route. Writes confined to `~/.agenticapps/dashboard/registry.json` (mode `0600`). Carry-over from Phase 11 D-12-09 anticipation.

4. **Coverage responsive collapse < 768px** — `useViewportB

## Capabilities affected

- `openspec/specs/fleet-conformance/spec.md`

## What shipped

**12-00**

**Shared conformance schema (7 exports + 6 types) + NDJSON retention bump 14→90d + matchMedia/useSyncExternalStore viewport breakpoint hook — three foundational deliverables that unblock every Phase 12 downstream wave.**

**12-01**

Pure daemon-side conformance scoring primitives — `computeConformanceScores` and `readDailySeriesForFleet` — landed with full TDD coverage of the Pitfall 2 (not-applicable exclusion) and Pitfall 3 (mean-of-3 fleet aggregation) load-bearing correctness invariants.

**12-02**

**Five new daemon files + one app.ts mount — GET /api/observability/conformance (bulk-per-family payload) and POST /api/admin/registry/fix-path (the Phase 12 threat surface) plus the cache + drift detector + orchestrator that compose Wave 1 into a fully working wire surface. 60 atomic tests, 11 threat mitigations, zero new runtime deps.**

**12-03**

**Four new SPA files (3 components + 1 query hook) + 4 test files — useConformance/useRegistryFixPath TanStack hooks, FleetTrendChart pure-SVG 90-day chart (≤120 LOC budget held at 101), FamilyCard tier-coloured card, PathDriftPanel with Fix-path affordance + concurrent-row isolation. 51 atomic tests added, all green; SPA suite 1015 → 1066. T-12-XSS mitigated (dangerous-inner-html prop absent from all three component files; verified by source-level grep tests).**

**12-04**

**Three small surfaces wire the Wave 3 primitives into a routable page that ships: a 202-LOC presentational `ConformancePage` composing PathDriftPanel + 3× FamilyCard + FleetTrendChart under a sticky PageHeader; an 18-LOC lazy route mirroring Phase 11's skill-drift pattern; a 9-line Sidebar.tsx edit that graduates the Observability section from 2 → 3 peer entries (Coverage → Skill drift → Conformance, additive — preserves Phase 11 D-11-08 IA per documented deviation from RESEARCH OQ3). 5 atomic commits (RED + GREEN per TDD task). 18 new tests, all green; full SPA suite 1066 → 1084 (exact delta

**12-05**

**`/coverage` collapses from a 6-column table to a card-per-row layout at xs viewports (<640px Tailwind 4) via a top-level early-return in CoverageFamilySection that picks CoverageFamilySectionMobile; all hooks fire unconditionally so the breakpoint flip is Rules-of-Hooks-safe.**

**12-06**

Closed the Phase 12 gate deferred at v1.1 milestone close. Because the implementation (12-00…05) already shipped and merged in v1.1 — and was two-stage reviewed in-flight (PR #40–#52) — the gate was run **retrospectively** via the GSD retro-toolkit rather than the original branch-diff `12-06` plan (whose `HEAD vs main` framing was stale).

## Gates recorded

- verification — `12-VERIFICATION.md`
- code review — `12-REVIEW.md`
- security audit — `12-SECURITY.md`
- design critique — `12-IMPECCABLE.md`
- human UAT — `12-HUMAN-UAT.md`
- validation — `12-VALIDATION.md`
