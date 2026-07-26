# Phase 4: Single-project View — Discipline + Phase Progress -

**Archived from GSD phase `04-single-project-view-discipline-phase-progress`. Completed 2026-05-08.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/04-single-project-view-discipline-phase-progress/` — that tree, not this file, is the authoritative record.

## Why

A `/projects/{id}` route that replaces the Phase 3 placeholder with a real header + Discipline column (left) + Phase Progress column (center). Right column (Health) is reserved for Phase 5. Driven entirely by reads from:

- `.planning/phases/<latest>/{CONTEXT,RESEARCH,UI-SPEC,PLAN-XX,SUMMARY-XX,REVIEW,REVIEW-FIX,*-REVIEW,SECURITY,IMPECCABLE,VERIFICATION,HUMAN-UAT}.md`
- `.planning/skill-observations/*.md` (commitment blocks, latest by mtime)
- `.planning/skill-observations/*.jsonl` (HookFirings + RationalizationFires events)
- `.claude/skills/agenticapps-workflow/skill/SKILL.md` (rationalization-row labels source)
- `.claude/skills/meta-observer/SKILL.md` (presence detection for DISC-04 install hint)
- `git log --format=%s` filtered to `test(... RED ...)` / `feat(... GREEN ...)` (ExecutionTimeline)
- `git symbolic-ref --short HEAD` (branch — already in projectOverview.ts)

**Read-only on the project filesystem.** No daemon route writes to `<projectRoot>/...` — the path allow-list (Phase 1 D-23) keeps reads under `.planning/.claude` only. The single allow-list exception (`POST /api/projects/{id}/open` editor spawn) is NOT in scope for Phase 4.

In scope (REQUIREMENTS Phase 4):

- DISC-01 CommitmentBlock — last `## Workflow commitment` block from `.planning/skill-observations/*.md`
- DISC-02 HookFirings — last 20 hook events from `.planning/skill-observations/*.jsonl`
- DISC-03 R

## Capabilities affected

- `openspec/specs/project-dashboard/spec.md`

## What shipped

**04-01**

Five new Zod schema files (with paired tests) added to `@agenticapps/dashboard-shared`, re-exported from `index.ts`. All Phase 4 daemon ↔ SPA wire contracts are now locked with `HookFiringSchema.passthrough()` enabling forward-compatible meta-observer event evolution (D-4-06) and a distinct four-bucket `ReviewFindingCountsSchema` coexisting safely alongside Phase 3's three-bucket `FindingCountsSchema`.

**04-02**

### `packages/agent/src/lib/phaseCache.ts`

Generalized per-route 5s memo cache keyed by `${projectId}:${routeName}`. Mirrors `overviewCache.ts` but is independent (separate store, separate module). Key design points:
- `getPhaseCache(key)`: lazy expiry on read (deletes stale entry)
- `setPhaseCache(key, value)`: stores with `expiresAt = now + 5000`
- `evictPhaseCacheProject(id)`: prefix scan `${id}:*` for unregister handler
- `_resetForTests()`: test backdoor matching overviewCache convention
- Value type is `unknown` — each route validates via Zod `outbound()` on the way out

### `packages/a

**04-03**

Five Hono panel routes (DISC-01..04, PHASE-01..05) fully implemented, TDD'd with 37 new tests across 5 route test files + 1 registry eviction test, wired into `app.ts`, and `registry.ts` unregister handler extended to evict phaseCache alongside the existing overviewCache (T-04-03-07).

**04-04**

Five TanStack Query hooks, ProjectLayout (max-w-7xl), ProjectHeader (single-line breadcrumb), and SingleProjectView (2-col grid shell) implemented with full TDD coverage. The `/projects/{id}` route now renders a real page header and scaffolded columns — the Phase 3 placeholder text is completely removed.

**04-05**

Three discipline-column SPA panels (CommitmentBlock, HookFirings, RationalizationFires) implemented with full TDD coverage, backed by a shared PanelContainer primitive and a pure formatRelativeTime utility. All 15 distinct render paths (5 states × 3 panels) are covered by tests. The SingleProjectView discipline-column placeholder slots are replaced by real components. Phase-progress-column slots remain as placeholders for Plan 06.

**04-06**

Five Phase Progress column panels (PhaseProgress, ExecutionTimeline, ReviewStatus, SecurityStatus, VerificationStatus) implemented with full TDD coverage, backed by a shared InlineDrift component extracted from the 3 Plan 05 copies. All 8 Phase 4 panels now use the shared component. SingleProjectView's 5 placeholder slots are replaced with real panel components. An end-to-end route test proves all 8 panels mount and asserts all 5 ROADMAP success criteria.

## Gates recorded

- verification — `04-VERIFICATION.md`
- code review — `04-REVIEW.md`
- security audit — `04-SECURITY.md`
- human UAT — `04-HUMAN-UAT.md`
- validation — `04-VALIDATION.md`
