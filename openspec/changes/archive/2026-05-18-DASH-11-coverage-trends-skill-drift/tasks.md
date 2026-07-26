# Tasks — Phase 11: Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle

All items are complete: this phase shipped on 2026-05-18. Reconstructed from the
PLAN checklists at `docs/legacy-planning/phases/DASH-11-coverage-trends-skill-drift/`.

## 11-01

- [x] `packages/shared/src/schemas/coverageHistory.ts` exists with locked field set (bulk-per-repo: schemaVersion: literal 1, windowDays: literal 14, four required cells in a `.strict()` inner object)
- [x] `packages/shared/src/schemas/skillDrift.ts` exists with locked field set (3 schemas + family enum locked to 4 values)
- [x] `packages/shared/src/index.ts` barrel re-exports both schema files including the new `CoverageCellDriftSchema` (append-only — no modifications to pre-existing exports)
- [x] Test counts: ≥17 in coverageHistory.test.ts, ≥19 in skillDrift.test.ts
- [x] All new tests pass
- [x] Full shared package suite stays green
- [x] Three TDD commits landed: `test(11-01): add failing tests for CoverageHistoryResponseSchema (bulk-per-repo)` → `feat(11-01): add CoverageHistoryResponseSchema (bulk-per-repo)` → `test(11-01): add f...
- [x] Bulk-per-repo shape (PD-11-02) is the only `CoverageHistoryResponseSchema` shape — no per-(repo, cell) discriminator anywhere

## 11-02

- [x] 7 new daemon-side source files exist (paths, writer, pruner, reader (bulk), scheduler, cache (keyed by repoId), route (bulk))
- [x] 7 corresponding test files exist
- [x] `app.route('/api', coverageHistoryRoute)` line added to `server/app.ts`
- [x] `registerDisposer(startSnapshotScheduler())` invocation + symlink-escape `realpathSync` check added to `server/boot.ts`
- [x] `boot.ts` exposes the new `registerDisposer` / `runDisposers` / `clearDisposers` helpers (Task 6 — REVIEWS action item 5)
- [x] All ≥35 new vitest cases pass; full agent suite stays green
- [x] Manual smoke confirms `0o600` on disk after first AND second same-day writes (Pitfall 2 defence working)
- [x] Manual smoke confirms `0o700` on directory
- [x] Manual smoke confirms `/api/coverage/history?repoId=...` returns all 4 cells in one response (PD-11-02 verified live)
- [x] Curl confirms 200 / 400 / 401 / 404 codes match the threat model
- [x] Scheduler `.unref()`'d (Pitfall 7); no setInterval anywhere
- [x] Boot check refuses to start when snapshot dir realpath escapes daemon home
- [x] PD-11-01 reinterpretation of D-11-02 recorded in the plan SUMMARY
- [x] PD-11-02 bulk-per-repo response shape recorded in the plan SUMMARY
- [x] REVIEWS.md action item 3 (registry validation), 4 (same-day collapse), 5 (disposer registry) all visibly addressed
- [x] Every threat in the STRIDE register has a disposition + concrete mitigation

## 11-03

- [x] `packages/agent/src/lib/skillDriftScan.ts` exists with `scanSkillDrift` + `familyOf` exported
- [x] `packages/agent/src/lib/skillDriftCache.ts` exists with 30s memo
- [x] `packages/agent/src/routes/skillDrift.ts` exists with GET + POST handlers
- [x] `app.route('/api', skillDriftRoute)` mounted in `server/app.ts`
- [x] Aggregator destructures `.skills` from `readLocalSkills` return (REVIEWS action item 6)
- [x] POST response uses shared `AgentLinterResponseSchema` from `@agenticapps/dashboard-shared` — NO local schema copy (REVIEWS action item 10)
- [x] ALL tests are fixture-driven; no `~/.agenticapps/dashboard/registry.json` reads (REVIEWS action item 7)
- [x] ≥38 new vitest cases pass
- [x] Family enum locked to `agenticapps|factiv|neuroflash|other`; `'other'` fallback explicitly tested
- [x] `Promise.allSettled` isolation tested via mock-throw fixture
- [x] D-11-14 single-project-per-request enforced structurally
- [x] No direct subprocess spawn in this plan
- [x] Curl smoke confirms 200 / 400 / 401 / 404 codes match the threat model
- [x] Every threat in the STRIDE register has a disposition + concrete mitigation

## 11-04

- [x] `useCoverageHistory(repoId)` hook exists with bulk-per-repo signature (no `cell` param), 1h staleTime, per-repoId queryKey
- [x] `CoverageDriftBadge` exists; NOT named `InlineDrift`; no hex literals
- [x] `CoverageCell` accepts optional `drift?: CoverageCellDrift | null` prop; renders the badge when direction is non-null; **NO hook calls inside CoverageCell** (grep verifies)
- [x] `CoverageRow` is the SINGLE owner of `useCoverageHistory` per row; fans drift out to four cells as props
- [x] Aria-label correctly singular/plural ("1 day ago" vs "3 days ago")
- [x] Regression guard: CoverageCell + CoverageRow render unchanged when `drift` is undefined (existing tests pass)
- [x] Performance budget locked: ≤ 1 history request per registered repo on first paint (Task 3 test 5 enforces — REVIEWS action item 2)
- [x] Drift-data ownership model is EXACTLY ONE — Option C (CoverageRow owns, CoverageCell consumes) — REVIEWS action item 1 resolved
- [x] ≥23 new tests pass; full SPA suite stays green

## 11-05

- [x] 2 hooks + 4 components + 1 lazy route + router extension + Sidebar extension all land
- [x] Sidebar has 2 peer `SidebarItem`s under Observability (NOT SidebarSubItem)
- [x] `/observability/skill-drift` navigable from sidebar
- [x] Page composes PageHeader + Toolbar + Matrix correctly across all four states
- [x] Per-row "Run AgentLinter" button POSTs `{ projectId }` for ONE project at a time (D-11-14)
- [x] Scope chip single-select with URL sync `?scope=family|cross` (PD-11-03)
- [x] Matrix renders family sections in `scope='family'`, single flat block in `scope='cross'`
- [x] Mutation hook reuses SHARED `AgentLinterResponseSchema` — no local copy (REVIEWS action item 10)
- [x] Mutation hook uses positional `apiFetch(path, schema, init?)`
- [x] Family enum surfaces all four values (incl. `'other'`)
- [x] No new hex literals
- [x] ≥40 new tests pass; full SPA suite stays green
- [x] Manual smoke confirms route renders + sidebar navigates + mutation fires correct body

## 11-06

- [x] `PageHeader` accepts optional `sticky?: boolean` prop (default `false`)
- [x] When `sticky=true`, the outer div gains `sticky top-0 z-10 bg-app-bg` classes
- [x] `mb-6` 24px bottom margin preserved in both sticky and non-sticky modes
- [x] `CoverageRow` per-row refresh button starts at `opacity-30` (was `opacity-0`)
- [x] `hover:opacity-100` / `focus:opacity-100` bumping behaviour preserved
- [x] `CoveragePage.tsx` opts into `sticky={true}` at all FIVE `<PageHeader>` invocations (REVIEWS action item 9 — corrected file location): 
- [x] `coverage.lazy.tsx` is NOT modified (verified by grep)
- [x] Other routes remain default (non-sticky) — regression-guarded
- [x] ≥10 new tests pass; full SPA suite stays green
- [x] Visual smoke confirms sticky behaviour on `/coverage` only
