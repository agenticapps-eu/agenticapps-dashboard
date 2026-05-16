# Phase 11: Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `11-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 11 — Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle
**Areas discussed:** Coverage trends (snapshot storage + drift surface), Cross-repo skill drift (aggregation + linter depth + scope), Family-aggregate scope, Sidebar IA

---

## Coverage trends — Retention window

| Option | Description | Selected |
|--------|-------------|----------|
| 14 days (Recommended) | Symmetry with COV-11 GitNexus-stale threshold; tight visual signal; ~5MB/year storage at 45 repos × 4 columns. Matches the 'recent drift' framing of the audit. | ✓ |
| 30 days | Covers a full v1.x cycle; bigger NDJSON but still trivial (~10MB/year). Good if 14d feels too short for 'what did we just fix?' signal. | |
| 90 days | Quarterly view; storage still trivial. Better for trend stories but the inline indicator becomes less actionable as the window widens. | |
| Rolling, no cap | Keep everything; trust git log as the deeper history. Simpler to implement (no pruner). Storage grows linearly — ~50MB by year 3. | |

**User's choice:** 14 days (Recommended)
**Notes:** Locked as D-11-01. NDJSON-append plus a daily pruner that drops lines older than 14d.

---

## Coverage trends — Snapshot trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Daily cron only (Recommended) | Reuses Phase 6 launchd/systemd install. Simplest; one snapshot per calendar day. Misses days the daemon isn't running but the gap is acceptable for an inline drift signal. | ✓ |
| Cron + opportunistic on dashboard load (dedup by date) | Covers missed days. Adds dedup logic (don't double-write same ISO date). Slightly more complex; bigger surface for race conditions. | |
| On-load only (no cron) | Skips launchd dependency entirely; only captures days the user opens the dashboard. Cleanest install story; weakest history continuity. | |

**User's choice:** Daily cron only (Recommended)
**Notes:** Locked as D-11-02. Extends existing Phase 6 launchd plist with a `StartCalendarInterval` entry.

---

## Coverage trends — Drift surface on CoverageCell

| Option | Description | Selected |
|--------|-------------|----------|
| Inline indicator only (▲14d / ▼7d) (Recommended) | Calmest. Single line of text per cell when a state transition exists; absent otherwise. Preserves the matrix's density. No new SVG primitive. | ✓ |
| 12-tick mini-sparkline only | Conveys magnitude visually. Adds an SVG element to every cell — noisy in a 45×4 matrix. Forces a 30-line render fn into the cell component. | |
| Both — sparkline on hover, indicator always-on | Most info; progressive disclosure. Hover-only behavior breaks on touch devices (Tailscale-from-iPad use case). Roughly 2× the scope of either alone. | |

**User's choice:** Inline indicator only (▲14d / ▼7d) (Recommended)
**Notes:** Locked as D-11-03. Component name MUST avoid the existing `InlineDrift.tsx` (Phase 6 schema-drift panel). Sparkline + hover deferred to v1.2.

---

## Skill drift — Aggregation level

| Option | Description | Selected |
|--------|-------------|----------|
| Per-skill matrix (Recommended) | Rows = skills, columns = projects. Answers 'which projects still don't have skill X?' fleet-wide. Mirrors Coverage matrix mental model. | ✓ |
| Per-project matrix | Rows = projects, columns = skills. Answers 'what skills is project X missing?'. Better for project-centric audits. | |
| Both views side-by-side with a toggle | Most complete; roughly 2× the scope. Requires duplicate test coverage. | |

**User's choice:** Per-skill matrix (Recommended)
**Notes:** Locked as D-11-04. Per-project view already partially exists at the Phase 5 single-project Skills panel; per-project cross-repo view deferred to v1.2.

---

## Skill drift — AgentLinter integration depth

| Option | Description | Selected |
|--------|-------------|----------|
| Presence + version drift only (Recommended) | Pure read of `.claude/skills/<id>/skill.json`. Zero AgentLinter runtime cost. Fastest scan. | |
| Plus latest cached AgentLinter scores per project (no fresh run) | Reuses Phase 5's `agentLinterCache.ts`. Surface caches the user already paid for. | |
| Plus on-demand AgentLinter run per project from the matrix | Adds a daemon spawn surface (AgentLinter binary). Crosses a trust boundary; /cso must audit. Biggest scope; richest signal. | ✓ |

**User's choice:** Plus on-demand AgentLinter run per project from the matrix
**Notes:** Locked as D-11-05. User chose the richer option over the recommended minimal scope. NOT a new spawn surface — Phase 5 already spawns AgentLinter from the daemon at the per-project route. Phase 11 adds a new INVOCATION CONTEXT (cross-repo matrix), not a new BINARY CALL. `/cso` punch list per D-11-14: verify call-site cannot escape per-project root constraint and cannot run multiple project lints per request.

---

## Skill drift — Cross-family vs in-family scope

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-family aggregate — all 3 families in one matrix (Recommended) | Matches the v1.1 milestone name 'Cross-family observability'. One panel, one scan, one mental model. | |
| Per-family only (3 separate matrices, no cross-family view) | Simpler IA; respects family-boundary contract. Defers cross-family aggregate to v1.2. | |
| Both — per-family default, cross-family via filter chip | Most flexible; roughly 1.5× the scope. Filter chip pattern already exists from Phase 10 toolbar. | ✓ |

**User's choice:** Both — per-family default, cross-family via filter chip
**Notes:** Locked as D-11-06. Reuses Phase 10's `CoverageToolbar` multi-select filter-chip pattern (200ms debounce + URL sync). Default per-family respects family-boundary contract; cross-family chip closes v1.1 framing.

---

## Scope — Family-aggregate Coverage trend in v1.1?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to v1.2 (Recommended) | Per-cell inline drift is enough. Fleet-level chart belongs on Phase 12's `/observability/trend` route. | ✓ |
| Per-family aggregate (3 line charts on the Coverage page header) | 'neuroflash freshness: 90% → 60% over 14d' as a 3-up header. Adds an SVG line-chart primitive (~60 LOC). | |
| Cross-family aggregate (one fleet-level line chart) | Most ambitious; risks overlapping Phase 12's `/observability/trend` route. | |

**User's choice:** Defer to v1.2 (Recommended)
**Notes:** Locked as D-11-07. Preserves the family-aggregate surface for Phase 12 to own; avoids duplicating work.

---

## IA — Sidebar Observability section structure

| Option | Description | Selected |
|--------|-------------|----------|
| 2 entries: Coverage, Skill drift (Recommended) | Trends stay inline on CoverageCell. Skill drift gets its own top-level entry. Phase 12 adds 'Conformance' as a 3rd entry. Matches preference for new sections with growth room (auto-memory `feedback_sidebar_section_architecture`). | ✓ |
| 3 entries: Coverage, Trends, Skill drift | Trends gets its own page — redundant with the locked inline-only drift surface. Likely to surface a near-empty page for v1.1. | |
| Coverage + ?view=trends sub-route; Skill drift as top-level | Hybrid — trends as a Coverage sub-view, skill drift separately. Hides trends behind a URL param; harder to discover. | |

**User's choice:** 2 entries: Coverage, Skill drift (Recommended)
**Notes:** Locked as D-11-08. Graduates `Observability` from single-item (D-10-08) to multi-item; Phase 12 adds `Conformance` naturally.

---

## Claude's Discretion

Captured in `11-CONTEXT.md` §Decisions → Claude's Discretion:
- Component naming for the inline drift surface (NOT `InlineDrift` which collides with the Phase 6 schema-drift panel).
- NDJSON record shape internal to `coverage-history/*.ndjson` files (wire shape locked separately).
- Cron implementation detail (extend launchd plist vs separate timer).

## Deferred Ideas

Captured in `11-CONTEXT.md` §Deferred. Highlights:
- Family-aggregate trends → v1.2 (Phase 12 home).
- 12-tick mini-sparkline on `CoverageCell` → v1.2 (revisit if inline indicator misses signal).
- Hover-only progressive disclosure → rejected (touch-device incompatibility).
- Per-project Skill drift matrix view → v1.2 (per-skill is primary in v1.1).
- 3 remaining P3 items from `10-IMPECCABLE.md` → polish backlog (likely Phase 13+).
