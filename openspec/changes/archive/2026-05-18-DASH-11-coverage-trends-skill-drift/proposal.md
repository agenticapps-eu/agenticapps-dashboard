# Phase 11: Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle

**Archived from GSD phase `DASH-11-coverage-trends-skill-drift`. Completed 2026-05-18.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/DASH-11-coverage-trends-skill-drift/` — that tree, not this file, is the authoritative record.

## Why

Close v1.1 — **Cross-family observability** — by extending the existing Coverage Matrix (Phase 10/10.5/10.6) along two axes and folding two leftover polish items:

1. **Coverage trends** — persist daily Coverage snapshots locally (NDJSON under `~/.agenticapps/dashboard/coverage-history/`); surface a per-cell inline drift indicator on `CoverageCell` (▲14d / ▼7d) when a state transition is detected within the rolling window.
2. **Cross-repo skill drift** — aggregate `.claude/skills/` across every registered project into a new **Skill drift** page; primary view is a **per-skill matrix** (rows = skills, columns = projects) showing presence + version drift. Includes an on-demand AgentLinter run per project from the matrix. Both per-family and cross-family views available via filter chip.
3. **Phase 10.6 polish bundle** — sticky `PageHeader` primitive (affects every dashboard route) + Coverage row-refresh icon `opacity-0` → `opacity-30` for touchpad/keyboard discoverability.

**In scope (v1.1 close-out):**
- Daemon snapshot writer + 14-day rolling retention + `GET /api/coverage/history?repoId=` endpoint (returns drift for ALL FOUR cells of one repo in one response — bulk-per-repo shape locked by PD-11-02 below).
- Daily cron trigger via Phase 6 launchd/systemd install (no opportunistic dashboard-load writes).
- `CoverageCell` extension: inline `▲Nd` / `▼Nd` text indicator when state

## Capabilities affected

- `openspec/specs/fleet-coverage/spec.md`
- `openspec/specs/skills-and-linting/spec.md`

## What shipped

**11-01**

**Two new shared Zod schema files (coverageHistory.ts bulk-per-repo, skillDrift.ts per-skill matrix) + barrel re-exports — the single wire contract every downstream Phase 11 plan compiles against.**

**11-02**

**Lands the entire Coverage trends daemon path — NDJSON snapshot writer + 14d pruner + bulk-per-repo reader + in-process scheduler (PD-11-01) + GET /api/coverage/history route (PD-11-02) + boot.ts disposer registry + symlink-escape boot check. Closes TRD-01..04; SPA Plan 11-04 can now consume drift.**

**11-03**

**Lands the entire Cross-repo Skill drift DAEMON path — skillDriftScan aggregator + skillDriftCache 30s memo + GET /api/skills/drift bulk matrix route + POST /api/skills/drift/agentlinter single-project on-demand run. Closes SKD-01..03; SPA Plan 11-05 can now consume both endpoints.**

**11-04**

**SPA-side coverage trends with EXACTLY ONE drift-data ownership model (Option C — REVIEWS action item 1 resolved): bulk-per-repo `useCoverageHistory` hook owned by CoverageRow, fans four cell drifts out as props to purely-presentational CoverageCell children. CoverageDriftBadge renders inline ▲Nd / ▼Nd. Performance budget locked structurally: ≤ 1 history request per registered repo on first paint.**

**11-05**

**Lands the entire SPA-side Skill drift surface — `useSkillDrift({scope})` + `useAgentLinterDrift` hooks (REVIEWS #10 shared schema; PD-11-03 scope), `SkillDriftCell` / `SkillDriftToolbar` / `SkillDriftMatrix` / `SkillDriftPage` components, `/observability/skill-drift` route mount under `_appshell`, and the second peer SidebarItem under Observability (D-11-08). Closes SKD-01..05.**

**11-06**

**PageHeader gains optional sticky prop (default false), CoverageRow refresh button defaults to opacity-30, and CoveragePage opts in at every render path — three Phase 10.6 IMPECCABLE-triage polish items shipped in 10 minutes via one TDD task split into three commits.**

## Gates recorded

- verification — `11-VERIFICATION.md`
- code review — `11-REVIEW.md`
- design critique — `11-IMPECCABLE.md`
- human UAT — `11-HUMAN-UAT.md`
- validation — `11-VALIDATION.md`
