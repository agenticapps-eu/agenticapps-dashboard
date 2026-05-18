---
phase: 11
slug: coverage-trends-skill-drift
generated: 2026-05-16
source: 11-RESEARCH.md §"Validation Architecture"
---

# Phase 11 — Validation Strategy

## Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 1.x (existing — same as Phase 10) |
| Config file | `packages/agent/vitest.config.ts` (Node env), `packages/spa/vitest.config.ts` (jsdom), `packages/shared/vitest.config.ts` (Node env) |
| Quick run command | `pnpm --filter @agenticapps/dashboard-agent test` (or `-spa` / `-shared`) |
| Full suite command | `pnpm -r test` (160+ tests across packages as of Phase 1 close) |
| Phase gate | Full suite green before `/gsd-verify-work`; impeccable critique re-run on 2 routes |

## Req → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRD-01 | `writeDailySnapshot` writes NDJSON line per row, dir mode 0o700, file mode 0o600, ISO-date filename | unit | `pnpm --filter @agenticapps/dashboard-agent test src/lib/snapshots/snapshotWriter.test.ts` | Wave 0 (Plan 02) |
| TRD-01 | Re-invoking same-day appends additional lines (does NOT overwrite) | unit | same file | Wave 0 (Plan 02) |
| TRD-01 | `chmod 0o600` enforced after first creation (Pitfall 2 defence) | unit | same file | Wave 0 (Plan 02) |
| TRD-02 | Pruner unlinks files whose ISO-date filename is older than `now - 14d`; leaves newer files alone | unit | `pnpm --filter @agenticapps/dashboard-agent test src/lib/snapshots/snapshotPruner.test.ts` | Wave 0 (Plan 02) |
| TRD-02 | Pruner runs IMMEDIATELY before each write (lazy trigger — no second scheduler) | unit | `snapshotWriter.test.ts` integration with mocked pruner | Wave 0 (Plan 02) |
| TRD-03 | `GET /api/coverage/history` rejects path traversal in `repoId` (422) | unit | `pnpm --filter @agenticapps/dashboard-agent test src/routes/coverageHistory.test.ts` | Wave 0 (Plan 02) |
| TRD-03 | `GET /api/coverage/history` rejects unknown `cell` enum (400) | unit | same file | Wave 0 (Plan 02) |
| TRD-03 | `GET /api/coverage/history` requires bearer auth (401 without token) | unit | same file | Wave 0 (Plan 02) |
| TRD-03 | Server-side drift computation returns `{ direction, daysSince }` correctly across 4 transition scenarios (no-change, fresh→stale, stale→fresh, multiple-transitions) | unit | `src/lib/snapshots/snapshotReader.test.ts` | Wave 0 (Plan 02) |
| TRD-04 | Scheduler arms `setTimeout` to next 03:00 local; ticks fire `writeDailySnapshot`; re-arms after each tick | unit | `src/lib/snapshots/snapshotScheduler.test.ts` (uses `vi.useFakeTimers()` + injected `now` fn) | Wave 0 (Plan 02) |
| TRD-04 | Scheduler `.unref()`s timer (does not keep test process alive); disposer clears active timer | unit | same file | Wave 0 (Plan 02) |
| TRD-04 | Scheduler swallows `writeDailySnapshot` errors and re-arms anyway | unit | same file | Wave 0 (Plan 02) |
| TRD-05 | `CoverageDriftBadge` renders `▲Nd` with `text-status-success` when direction='up' | unit | `pnpm --filter @agenticapps/dashboard-spa test src/components/panels/coverage/CoverageDriftBadge.test.tsx` | Wave 0 (Plan 04) |
| TRD-05 | `CoverageDriftBadge` renders `▼Nd` with `text-status-error` when direction='down' | unit | same file | Wave 0 (Plan 04) |
| TRD-05 | `CoverageCell` renders no badge when `drift` prop absent (regression guard) | unit | `src/components/panels/coverage/CoverageCell.test.tsx` (existing — extend) | Wave 0 extension (Plan 04) |
| TRD-05 | `CoverageCell` wires `useCoverageHistory` for non-`not-applicable` cells; renders `<CoverageDriftBadge>` when hook returns a transition | unit | `src/components/panels/coverage/CoverageCell.test.tsx` (Plan 04 Task 3) | Wave 0 extension (Plan 04) |
| SKD-01 | `scanSkillDrift` calls `readLocalSkills` per registered project | unit | `pnpm --filter @agenticapps/dashboard-agent test src/lib/skillDriftScan.test.ts` | Wave 0 (Plan 03) |
| SKD-01 | `scanSkillDrift` derives family from `root` path prefix; falls back to 'other' for non-Sourcecode roots | unit | same file | Wave 0 (Plan 03) |
| SKD-01 | `scanSkillDrift` isolates per-project failures via `Promise.allSettled` — one rejection does not poison response | unit | same file | Wave 0 (Plan 03) |
| SKD-02 | `GET /api/skills/drift` returns `SkillDriftResponse` with bearer auth + 30s cache | unit | `pnpm --filter @agenticapps/dashboard-agent test src/routes/skillDrift.test.ts` | Wave 0 (Plan 03) |
| SKD-03 | `POST /api/skills/drift/agentlinter` validates body, 404s on unknown project, runs ONE lint, reuses cache | unit | same file | Wave 0 (Plan 03) |
| SKD-03 | Body validation rejects extra projectIds (route accepts singular projectId only) — D-11-14 enforcement | unit | same file | Wave 0 (Plan 03) |
| SKD-04 | `SkillDriftMatrix` renders one row per skill, one column per project | unit | `pnpm --filter @agenticapps/dashboard-spa test src/components/panels/skill-drift/SkillDriftMatrix.test.tsx` | Wave 0 (Plan 05) |
| SKD-04 | `SkillDriftToolbar` chip toggles per-family/cross-family scope, URL-syncs `?scope=`, 200ms debounce on text input | unit | `src/components/panels/skill-drift/SkillDriftToolbar.test.tsx` | Wave 0 (Plan 05) |
| SKD-05 | `Sidebar` now exposes both `Coverage` and `Skill drift` items under `Observability` | unit | `src/components/ui/Sidebar.test.tsx` (existing — extend) | Wave 0 extension (Plan 05) |
| PLI-01 | `PageHeader` with `sticky={true}` adds `sticky top-0 z-10 bg-app-bg` classes; default false preserves current behavior | unit | `src/components/ui/PageHeader.test.tsx` (existing — extend with sticky case) | Wave 0 extension (Plan 06) |
| PLI-02 | `CoverageRow` refresh button starts at `opacity-30`; hovers/focuses to `opacity-100` | unit | `src/components/panels/coverage/CoverageRow.test.tsx` (existing — extend) | Wave 0 extension (Plan 06) |
| PLI-03 | `/coverage` page passes `sticky={true}` to `PageHeader` at all FIVE invocations (PD-11-02 / REVIEWS item 9 — `CoveragePage.tsx`, not the lazy route) | unit | `src/components/panels/coverage/CoveragePage.test.tsx` (new) | Wave 1 (Plan 06) |
| Integration | Full cron-tick → snapshot file → endpoint read → SPA `CoverageCell` renders badge | integration | New test file `src/integration/snapshotFlow.integration.test.ts` (agent only, no SPA — daemon E2E) | Wave 0 |
| Integration | `scanSkillDrift` output → `/api/skills/drift` response → `SkillDriftMatrix` jsdom render | integration | New test file `src/integration/skillDriftFlow.integration.test.tsx` | Wave 0 |
| Impeccable | `/coverage` re-critique (drift badge + sticky header + opacity polish) | impeccable artifact | manual `/impeccable critique http://localhost:5174/coverage` | manual (gate) |
| Impeccable | `/observability/skill-drift` first critique | impeccable artifact | manual `/impeccable critique http://localhost:5174/observability/skill-drift` | manual (gate) |

## Sampling Rate

- **Per task commit:** `pnpm --filter @agenticapps/dashboard-agent test src/lib/snapshots/` (or relevant package filter)
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green + both IMPECCABLE artifacts committed before `/gsd-verify-work`

## Wave 0 Gaps

These test files MUST exist before their corresponding production code lands (TDD red phase):

- [ ] `packages/agent/src/lib/snapshots/snapshotWriter.test.ts` — covers TRD-01 (write semantics + mode enforcement)
- [ ] `packages/agent/src/lib/snapshots/snapshotPruner.test.ts` — covers TRD-02 (14d rolling cutoff)
- [ ] `packages/agent/src/lib/snapshots/snapshotReader.test.ts` — covers server-side drift computation
- [ ] `packages/agent/src/lib/snapshots/snapshotScheduler.test.ts` — covers TRD-04 (timer arming + dispose)
- [ ] `packages/agent/src/routes/coverageHistory.test.ts` — covers TRD-03 (route auth + validation + traversal defence)
- [ ] `packages/agent/src/lib/skillDriftScan.test.ts` — covers SKD-01 (aggregator + family derivation + isolation)
- [ ] `packages/agent/src/lib/skillDriftCache.test.ts` — covers SKD-02 cache semantics (30s TTL + invalidation)
- [ ] `packages/agent/src/routes/skillDrift.test.ts` — covers SKD-02 + SKD-03 (both routes, body validation, single-project enforcement)
- [ ] `packages/spa/src/components/panels/coverage/CoverageDriftBadge.test.tsx` — covers TRD-05 visual
- [ ] `packages/spa/src/components/panels/skill-drift/SkillDriftMatrix.test.tsx` — covers SKD-04 matrix render
- [ ] `packages/spa/src/components/panels/skill-drift/SkillDriftToolbar.test.tsx` — covers SKD-04 toolbar URL sync + debounce
- [ ] `packages/spa/src/lib/coverageHistoryQueries.test.ts` — covers TanStack Query hook (cache + suspense behaviour)
- [ ] `packages/spa/src/lib/skillDriftQueries.test.ts` — covers TanStack Query hook
- [ ] `packages/spa/src/components/panels/coverage/CoveragePage.test.tsx` — covers PLI-03 (CoveragePage opts into sticky PageHeader at all FIVE invocations; lazy route is intentionally NOT modified per REVIEWS item 9 / PD-11-02)
- [ ] Integration: `packages/agent/src/integration/snapshotFlow.integration.test.ts` — covers full end-to-end on daemon side
- [ ] Test fixtures: extend `packages/agent/src/lib/__fixtures__/` with `coverage-history/` example NDJSON files for snapshot-reader unit tests (use small synthetic data — 3 repos, 5 days, 2 known transitions)

Framework install: none — vitest already wired.
