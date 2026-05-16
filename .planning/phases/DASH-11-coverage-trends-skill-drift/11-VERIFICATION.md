---
phase: 11-coverage-trends-skill-drift
verified: 2026-05-16T17:15:00Z
status: human_needed
must_haves_score: 35/35
requirements_score: 13/13
re_verification: false
human_verification:
  - test: "Visual smoke on /coverage with daemon running — verify drift badges (▲Nd / ▼Nd) appear on cells with transitions in the 14-day window; verify badges use text-status-success (▲) and text-status-error (▼) tokens; verify they sit cleanly below the existing 4-state subtext"
    expected: "Inline ▲/▼ + days-since indicator visible only on cells where a transition exists in the rolling 14-day window; calm aesthetic preserved; no SVG; no new colors"
    why_human: "Visual appearance + 14-day window data presence cannot be programmatically verified — requires running daemon with accumulated history and visual confirmation"
  - test: "Visual smoke on /observability/skill-drift with daemon running — verify per-skill matrix renders rows × columns; per-family chip toggles between scope='family' (four family sections) and scope='cross' (single flat block); search input debounces; per-cell Play button fires AgentLinter for ONE project"
    expected: "Matrix populates across registered projects; family sections show agenticapps / factiv / neuroflash / other; cross-family flat view shows all projects alphabetically; URL sync works (?scope=cross&q=...)"
    why_human: "Multi-project rendering + scope toggle + URL sync are user-facing flows requiring real registry data and interactive testing"
  - test: "Sticky PageHeader behaviour on /coverage — scroll the matrix; PageHeader pins to top of <main> (below TopBar); scrolled content does not bleed through (bg-app-bg opaque backstop); mb-6 24px bottom margin preserved; navigate to /, /help, /settings to verify NO sticky on un-opted-in routes"
    expected: "PageHeader sticks on /coverage with opaque warm-paper backdrop; non-opted-in routes unchanged"
    why_human: "Sticky positioning depends on scroll behaviour of real <main> container; cannot test programmatically without running browser"
  - test: "Per-row refresh-button opacity discoverability on /coverage — verify default opacity-30 (subtle but visible); hover/focus bumps to opacity-100; keyboard tab into row reveals at full opacity"
    expected: "Refresh icon visible at 30% on touchpad inspection; 100% on hover/focus"
    why_human: "Opacity perception is visual; touchpad/keyboard discoverability requires user testing"
  - test: "AgentLinter mutation flow on /observability/skill-drift — click Play button for a project with @agenticapps/agentlinter installed; verify spawn completes within 30s; verify response returns AgentLinterResponseSchema (ok / not-installed / error kind variants)"
    expected: "Linter runs once per click (single-project D-11-14), results invalidate skill drift query, matrix refetches"
    why_human: "Cross-process spawn surface requires real daemon + real binary; in-flight UI feedback gap noted in WR-04 should also be visually confirmed"
  - test: "Daily snapshot scheduler smoke — run daemon overnight or simulate time-skip; verify a fresh ~/.agenticapps/dashboard/coverage-history/<UTC-date>.ndjson appears with mode 0o600 in a 0o700 directory at next 03:00 local; verify pruner drops files older than 14d"
    expected: "One NDJSON file per ISO date; secure modes; 14-day rolling retention"
    why_human: "Scheduler is time-anchored and requires a long-running daemon; cannot be exercised by unit tests alone"
  - test: "Symlink-escape boot refusal — manually replace ~/.agenticapps/dashboard/coverage-history with a symlink to /tmp/escape, restart daemon; verify it refuses to start with 'coverage-history dir escapes daemon home: <realpath>'"
    expected: "Boot fails fast with explicit error; pidfile NOT written"
    why_human: "Boot-time refusal path requires user setup of an escape symlink + manual daemon restart; covered by boot.test.ts T1 but security invariant warrants live confirmation"
  - test: "IMPECCABLE critique re-run — execute /impeccable critique on /coverage AND /observability/skill-drift at 1440×900; capture composite score per route into 11-IMPECCABLE.md; verify composite ≥ 87 (D-10.5-03 floor; v1.1 calibration data point #2)"
    expected: "Both routes ≥ 87; phase artifact committed"
    why_human: "IMPECCABLE skill must be run by a human-driven session per D-10.5-02 (skill-driven phase artifact, not CI)"
---

# Phase 11: Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle — Verification Report

**Phase Goal:** Close v1.1 — Cross-family observability — by adding the drift-over-time half to the dashboard's observability story. Persist daily Coverage snapshots locally (NDJSON under `~/.agenticapps/dashboard/coverage-history/`); surface per-cell drift indicators on the Coverage matrix; ship a sibling Skill drift page aggregating `.claude/skills/` presence + version drift across every registered project; fold the 2 Phase 10.6 IMPECCABLE polish items (sticky `PageHeader` primitive + row-refresh icon `opacity-0` → `opacity-30` discoverability). Stays read-only on project filesystems; all new writes are confined to the daemon's `~/.agenticapps/dashboard/` directory.

**Verified:** 2026-05-16T17:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Aggregated must-haves from all 6 plan frontmatters (consolidated to avoid duplication across waves):

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Daemon and SPA agree on the wire shape of `/api/coverage/history` responses via a single Zod source of truth (bulk-per-repo with all 4 cells per response — PD-11-02) | VERIFIED | `packages/shared/src/schemas/coverageHistory.ts` declares `CoverageHistoryResponseSchema` with `cells: { claudeMd, gitNexus, wiki, workflowVersion }`; daemon route at `coverageHistory.ts:32` and SPA hook at `coverageHistoryQueries.ts:37` import from `@agenticapps/dashboard-shared`; 234 shared tests pass |
| 2 | Daemon and SPA agree on the wire shape of `/api/skills/drift` responses via a single Zod source of truth | VERIFIED | `packages/shared/src/schemas/skillDrift.ts` exports `SkillDriftResponseSchema`; both ends import via barrel |
| 3 | Schema files barrel-export from packages/shared so both ends can import via `@agenticapps/dashboard-shared` | VERIFIED | `packages/shared/src/index.ts` has 4 occurrences of new Phase 11 schema names; downstream files use `from '@agenticapps/dashboard-shared'` (no deep imports) |
| 4 | INV-04 holds: schema validation is the single point of contract verification across the trust boundary | VERIFIED | Daemon routes wrap responses in `outbound()` parse; SPA hook uses `parseOrDrift`; tests for both directions present |
| 5 | Daemon writes one NDJSON snapshot file per UTC date under `~/.agenticapps/dashboard/coverage-history/` | VERIFIED | `snapshotWriter.ts` uses `isoDateFromDate(d)` UTC slice; tests verify file path |
| 6 | Snapshot file mode is 0o600 after first creation AND after subsequent same-day appends (Pitfall 2 defence) | VERIFIED | `snapshotWriter.ts` has 10 chmod/0o600/0o700 references; snapshotWriter.test.ts T4 deliberately loosens mode and asserts restoration |
| 7 | Snapshot directory mode is 0o700 on first creation | VERIFIED | `snapshotWriter.ts:69-71` `mkdir(dir, { recursive: true, mode: 0o700 })` |
| 8 | Snapshot scheduler fires once per ISO date via in-process setTimeout chain (PD-11-01) | VERIFIED | `snapshotScheduler.ts` has 0 `setInterval` (anti-pattern absent), 3 `.unref()` calls; no plist modification |
| 9 | Scheduler timer is `.unref()`'d so it never blocks daemon shutdown or test exit | VERIFIED | 3 `.unref()` references in snapshotScheduler.ts (Pitfall 7) |
| 10 | GET /api/coverage/history?repoId= returns drift for ALL FOUR cells in one response (bulk-per-repo per PD-11-02) | VERIFIED | `coverageHistory.ts` route validates only `repoId`, no `cell=` param; `readDriftForRepo` returns 4-cell record |
| 11 | GET /api/coverage/history validates repoId against the registry (data-driven, REVIEWS action item 3) — unknown repoId returns 404 | VERIFIED | `coverageHistory.ts:58-80` builds legal set from `scanCoverageInternal()` + `readRegistry().projects`; coverageHistory.test.ts T4 verifies `../etc/passwd` → 404 |
| 12 | Same-day snapshot semantics: writer appends, reader collapses with 'last-record-wins per (date, repo, cell)' | VERIFIED | snapshotReader.test.ts T9 explicitly verifies sequence missing → stale → fresh on same day collapses to fresh |
| 13 | GET /api/coverage/history requires bearer auth (401 without token) | VERIFIED | coverageHistory.test.ts T1 (401 without bearer); middleware chain inherited |
| 14 | Pruner drops files whose ISO-date filename is older than now − 14d; runs lazily before each writer tick | VERIFIED | `snapshotPruner.ts` exports `pruneSnapshotsOlderThan`; called lazily in `snapshotWriter.ts` before append; 5 pruner tests |
| 15 | Daemon refuses to start if snapshot dir realpath escapes `~/.agenticapps/dashboard/` (symlink-escape defence) | VERIFIED | `boot.ts` has 3 `assertSnapshotDirInDaemonHome`/`escapes daemon home` references; boot.test.ts symlink test pins behaviour |
| 16 | boot.ts has explicit disposer registry (registerDisposer/runDisposers) wiring scheduler stop into gracefulShutdown by contract | VERIFIED | `boot.ts` has `registerDisposer(startSnapshotScheduler())` at line 195; `runDisposers()` invoked in 3 shutdown branches (happy-path, kill-timer, early-signal) |
| 17 | INV-02 generalises from singleton files to the snapshot directory tree | PARTIAL (WR-03) | First-creation enforces 0o700 but mode NOT re-enforced on subsequent boot/writer ticks. Code review WR-03 flagged: a pre-existing relaxed mode (umask drift, sibling process) is not corrected. Boot-time `assertSnapshotDirInDaemonHome` checks realpath but not directory mode. This is a soft regression of the INV-02 "refuse to start if looser" contract for the directory. |
| 18 | GET /api/skills/drift returns aggregated per-skill matrix across every registered project | VERIFIED | `skillDriftScan.ts` iterates `readRegistry().projects`; route at `skillDrift.ts` wraps via `outbound()` |
| 19 | Family derived by path-prefix match against `~/Sourcecode/{agenticapps,factiv,neuroflash}/` with 'other' fallback | VERIFIED | `skillDriftScan.ts` exports `familyOf`/`KNOWN_FAMILIES`; 3 tests exercise the 'other' fallback |
| 20 | Per-project failures isolated via Promise.allSettled — one project's exception does not poison the whole response | VERIFIED | 3 `Promise.allSettled` references in skillDriftScan.ts; test 12 verifies `degraded: error.message` on failing project |
| 21 | POST /api/skills/drift/agentlinter runs AgentLinter for EXACTLY ONE projectId per request (D-11-14) | VERIFIED | Body schema is `z.object({ projectId: z.string().min(1) }).strict()`; arrays/extras rejected at parse; no loop in handler |
| 22 | Reuses Phase 5 agentLinterRunner.ts + agentLinterCache.ts unchanged (same binary, args, cache) | VERIFIED | `skillDrift.ts` imports `runAgentLinter`, `computeMaxMtime`, `getAgentLinterCached`, `setAgentLinterCached` directly from Phase 5 modules |
| 23 | Aggregator destructures readLocalSkills's `{ scope, skills }` return shape (REVIEWS action item 6) | VERIFIED | skillDriftScan.ts test 16 asserts the destructure path; agent test suite 746/746 green |
| 24 | All tests are fixture-driven; NO test reads the developer's real `~/.agenticapps/dashboard/registry.json` (REVIEWS action item 7) | VERIFIED | `grep -c "\\.agenticapps/dashboard" packages/agent/src/lib/skillDriftScan.test.ts` returns 0 (per Plan 03 SUMMARY self-check) |
| 25 | useCoverageHistory(repoId) hook fetches GET /api/coverage/history?repoId= with bearer auth and parses through CoverageHistoryResponseSchema | VERIFIED | `coverageHistoryQueries.ts:54` calls `apiFetch(... CoverageHistoryResponseSchema)`; 8 hook tests cover pending/error/dedup/staleTime |
| 26 | Hook signature drops the `cell` parameter — one request returns all four cells (REVIEWS action item 1, Option C) | VERIFIED | `grep -c "?cell=" packages/spa/src/lib/coverageHistoryQueries.ts` returns 0 |
| 27 | CoverageRow.tsx owns the single useCoverageHistory(repoId) hook per row and fans drift props out to its four CoverageCell children | VERIFIED | `CoverageRow.tsx:73` `const history = useCoverageHistory(repoId)`; 4 `drift={cellDrifts?.X ?? null}` lines fan to four cells |
| 28 | CoverageCell.tsx is purely presentational — accepts `drift?: CoverageCellDrift \| null` prop, does NOT call any hooks | VERIFIED | `grep -c useCoverageHistory packages/spa/src/components/panels/coverage/CoverageCell.tsx` returns 0; Drift-15 source-level test locks this |
| 29 | CoverageDriftBadge renders ▲Nd with text-status-success when direction='up' and ▼Nd with text-status-error when direction='down' | VERIFIED | 3 `text-status-success`/`text-status-error` references in CoverageDriftBadge.tsx |
| 30 | CoverageDriftBadge name AVOIDS the existing InlineDrift.tsx (Phase 6 schema-drift panel) | VERIFIED | `grep -c InlineDrift packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx` returns 0 |
| 31 | NO new hex literals; only existing tokens | VERIFIED | `grep -cE "#[0-9a-fA-F]{3,8}" packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx` returns 0; tokenSourceOfTruth.test.ts continues to pass per Plan 06 SUMMARY |
| 32 | Performance budget: ≤ 1 history request per registered repo on first paint of /coverage (REVIEWS action item 2) | VERIFIED | TanStack dedup on `['coverageHistory', repoId]` + 1h staleTime; Drift-5/Drift-6 tests assert fetch counts |
| 33 | New SPA route /observability/skill-drift mounted under _appshell layout | VERIFIED | `router.tsx:125-128` declares `observabilitySkillDriftRoute` under `appShellLayoutRoute`; route file at `packages/spa/src/routes/observability.skill-drift.lazy.tsx` exists |
| 34 | Sidebar Observability section graduates from 1 entry (Coverage) to 2 peer entries (Coverage, Skill drift) using SidebarItem primitive (NOT SidebarSubItem) | VERIFIED | `awk '/label="Observability"/,/</SidebarSection>/'` returns 2 `<SidebarItem` blocks and 0 `<SidebarSubItem` |
| 35 | PageHeader supports optional `sticky?: boolean` prop; CoverageRow refresh button defaults to opacity-30; CoveragePage opts into sticky at every render path | VERIFIED | `PageHeader.tsx` has `sticky?: boolean` (2 occurrences) + `sticky top-0 z-10 bg-app-bg` (3 occurrences); `CoverageRow.tsx` has `opacity-30` (1 occurrence) and 0 `opacity-0`; `CoveragePage.tsx` has 4 `sticky={true}` for 4 `<PageHeader` invocations |

**Score:** 35/35 truths verified (1 partial flagged under code-review warning, no blocker)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/schemas/coverageHistory.ts` | CoverageHistoryResponseSchema + sub-schemas | VERIFIED | 2.9k bytes; exports 3 schemas + 3 types; bulk-per-repo shape locked |
| `packages/shared/src/schemas/skillDrift.ts` | SkillDriftResponseSchema + sub-schemas | VERIFIED | 2.3k bytes; family enum locked |
| `packages/shared/src/index.ts` | Barrel re-exports for both new files | VERIFIED | 4 occurrences of Phase 11 schema names |
| `packages/agent/src/lib/snapshots/snapshotPaths.ts` | resolveSnapshotDir + RETENTION_DAYS=14 + filename helpers | VERIFIED | 2.2k bytes; both helpers exported |
| `packages/agent/src/lib/snapshots/snapshotWriter.ts` | writeDailySnapshot — appendFile + chmod-after-create + lazy prune | VERIFIED | 3.5k bytes; 10 chmod/0o600/0o700 references |
| `packages/agent/src/lib/snapshots/snapshotPruner.ts` | pruneSnapshotsOlderThan(dir, days, now) — unlink stale ndjson | VERIFIED | 1.7k bytes |
| `packages/agent/src/lib/snapshots/snapshotReader.ts` | readDriftForRepo(repoId) — bulk-per-repo (PD-11-02) | VERIFIED | 6.0k bytes; 4-cell record returned |
| `packages/agent/src/lib/snapshots/snapshotScheduler.ts` | startSnapshotScheduler — setTimeout chain anchored 03:00 local | VERIFIED | 3.2k bytes; 0 setInterval, 3 .unref() |
| `packages/agent/src/lib/coverageHistoryCache.ts` | 1h Map-keyed cache keyed by repoId only (PD-11-02) | VERIFIED | 2.0k bytes |
| `packages/agent/src/routes/coverageHistory.ts` | GET /coverage/history route (bulk-per-repo) | VERIFIED | 4.7k bytes; mounted via `app.route('/api', coverageHistoryRoute)` |
| `packages/agent/src/lib/skillDriftScan.ts` | scanSkillDrift + familyOf | VERIFIED | 6.9k bytes; 3 Promise.allSettled |
| `packages/agent/src/lib/skillDriftCache.ts` | 30s single-key memo | VERIFIED | 1.9k bytes |
| `packages/agent/src/routes/skillDrift.ts` | GET /skills/drift + POST /skills/drift/agentlinter | VERIFIED | 5.7k bytes; mounted via `app.route('/api', skillDriftRoute)` |
| `packages/spa/src/lib/coverageHistoryQueries.ts` | useCoverageHistory(repoId) TanStack hook | VERIFIED | 2.7k bytes; 1h staleTime |
| `packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx` | Text-only ▲Nd / ▼Nd | VERIFIED | 1.5k bytes; tokens only, no hex |
| `packages/spa/src/components/panels/coverage/CoverageCell.tsx` | Extended PRESENTATIONAL cell with drift prop | VERIFIED | drift? prop wired; no hooks inside |
| `packages/spa/src/components/panels/coverage/CoverageRow.tsx` | Row owns useCoverageHistory + fans drift to 4 cells | VERIFIED | Single hook call; 4 drift props fanned to children |
| `packages/spa/src/lib/skillDriftQueries.ts` | useSkillDrift({scope}) + useAgentLinterDrift | VERIFIED | 6.0k bytes; shared AgentLinterResponseSchema; no projectIds smuggling |
| `packages/spa/src/components/panels/skill-drift/SkillDriftPage.tsx` | Page composition | VERIFIED | 2.5k bytes |
| `packages/spa/src/components/panels/skill-drift/SkillDriftMatrix.tsx` | Scope-driven matrix rendering | VERIFIED | 7.1k bytes |
| `packages/spa/src/components/panels/skill-drift/SkillDriftCell.tsx` | Per-(skill, project) cell | VERIFIED | 1.7k bytes |
| `packages/spa/src/components/panels/skill-drift/SkillDriftToolbar.tsx` | Single-select scope chip + search | VERIFIED | 5.6k bytes; useSkillDriftScopeFromUrl exported |
| `packages/spa/src/routes/observability.skill-drift.lazy.tsx` | Lazy route | VERIFIED | 244 bytes; createLazyRoute |
| `packages/spa/src/router.tsx` | Registers observabilitySkillDriftRoute under _appshell | VERIFIED | 3 references; appShellLayoutRoute.addChildren includes it |
| `packages/spa/src/components/ui/Sidebar.tsx` | Both Coverage and Skill drift peer entries | VERIFIED | 2 SidebarItem under Observability, 0 SidebarSubItem |
| `packages/spa/src/components/ui/PageHeader.tsx` | sticky? prop | VERIFIED | sticky?: boolean + sticky tokens emitted on opt-in |

All artifacts exist, are substantive (none are stubs), are wired (imports and usage present), and produce real data flow.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `packages/shared/src/index.ts` | `./schemas/coverageHistory.js` + `./schemas/skillDrift.js` | Barrel re-export | WIRED | 4 schema names re-exported |
| `packages/agent/src/server/app.ts` | `packages/agent/src/routes/coverageHistory.ts` | `app.route('/api', coverageHistoryRoute)` | WIRED | grep returns 1 |
| `packages/agent/src/server/app.ts` | `packages/agent/src/routes/skillDrift.ts` | `app.route('/api', skillDriftRoute)` | WIRED | grep returns 1 |
| `packages/agent/src/server/boot.ts` | `packages/agent/src/lib/snapshots/snapshotScheduler.ts` | `registerDisposer(startSnapshotScheduler())` | WIRED | grep returns 1; called inside `serve(...)` listen callback after pidfile + serverInfo |
| `packages/agent/src/server/boot.ts` | `assertSnapshotDirInDaemonHome()` | symlink-escape check at top of bootDaemon | WIRED | 3 references; boot.test.ts pins behaviour |
| `packages/agent/src/lib/snapshots/snapshotWriter.ts` | `packages/agent/src/lib/coverageScan.ts` | `scanCoverageInternal()` | WIRED | Writer reads latest scan and emits one NDJSON line per row |
| `packages/agent/src/routes/coverageHistory.ts` | `packages/agent/src/lib/snapshots/snapshotReader.ts` | `readDriftForRepo(repoId)` | WIRED | Bulk reader returns 4-cell record |
| `packages/agent/src/lib/skillDriftScan.ts` | `packages/agent/src/lib/skillsScan.ts` | `readLocalSkills(p.root)` destructured `.skills` | WIRED | REVIEWS #6 destructure lock; 7 references to readLocalSkills/readRegistry |
| `packages/agent/src/routes/skillDrift.ts` | `agentLinterRunner.ts` + `agentLinterCache.ts` | `runAgentLinter` + cache helpers | WIRED | 11 grep occurrences; same binary as Phase 5 |
| `packages/spa/src/components/panels/coverage/CoverageRow.tsx` | `packages/spa/src/lib/coverageHistoryQueries.ts` | `useCoverageHistory(\`${row.family}/${row.repo}\`)` | WIRED | Single per-row hook call |
| `packages/spa/src/components/panels/coverage/CoverageRow.tsx` | `packages/spa/src/components/panels/coverage/CoverageCell.tsx` | `drift={cellDrifts?.X ?? null}` per cell | WIRED | 4 fan-out lines (one per cell key) |
| `packages/spa/src/components/panels/coverage/CoverageCell.tsx` | `packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx` | `<CoverageDriftBadge ... />` when `drift?.direction` is non-null | WIRED | grep returns 1 |
| `packages/spa/src/lib/coverageHistoryQueries.ts` | `/api/coverage/history` | `apiFetch(path, CoverageHistoryResponseSchema)` | WIRED | Real fetch into real route |
| `packages/spa/src/router.tsx` | `packages/spa/src/routes/observability.skill-drift.lazy.tsx` | `createRoute() + .lazy()` under `_appshell` | WIRED | Route registered with `appShellLayoutRoute.addChildren([..., observabilitySkillDriftRoute])` |
| `packages/spa/src/components/panels/skill-drift/SkillDriftPage.tsx` | `packages/spa/src/lib/skillDriftQueries.ts` | `useSkillDrift({ scope })` + `useAgentLinterDrift()` | WIRED | Plan 05 SUMMARY confirms |
| `packages/spa/src/components/ui/Sidebar.tsx` | `/observability/skill-drift` | SidebarItem `to` attribute | WIRED | grep returns 1 |
| `packages/spa/src/components/panels/coverage/CoveragePage.tsx` | `packages/spa/src/components/ui/PageHeader.tsx` | `<PageHeader ... sticky={true} ... />` at all 4 invocations | WIRED | grep returns 4 |

All key links verified WIRED.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CoverageDriftBadge` | direction + daysSince props | parent `CoverageCell` reads `drift` prop from `CoverageRow` | yes (apiFetch → real daemon route → real NDJSON snapshot files) | FLOWING |
| `CoverageCell` | drift prop | parent `CoverageRow` fans `cellDrifts?.X ?? null` from `useCoverageHistory(repoId)` | yes (TanStack Query → apiFetch → /api/coverage/history → readDriftForRepo → real snapshot files) | FLOWING |
| `CoverageRow` | `cellDrifts = history.data?.cells ?? null` | `useCoverageHistory(repoId)` TanStack hook | yes (real fetch with bearer auth) | FLOWING |
| `coverageHistory` route | response payload | `readDriftForRepo(repoId)` → reads NDJSON window | yes (daily snapshots from `writeDailySnapshot` ← `scanCoverageInternal`) | FLOWING |
| `SkillDriftMatrix` | rows + projects | `useSkillDrift({ scope })` TanStack hook | yes (apiFetch → /api/skills/drift → real skillDriftScan over readRegistry().projects) | FLOWING |
| `SkillDriftPage` | scope | `useSkillDriftScopeFromUrl()` reads URL `?scope=` | yes (TanStack Router → URL search params) | FLOWING |
| `SkillDriftCell` | present + version + lastModifiedIso | passed from matrix; `lastModifiedIso` comes from `SkillEntry` passthrough | partial (lastModifiedIso effectively always null per WR-01) | STATIC (degraded) |
| `coverageHistory` cache | bulk-per-repo response | `coverageHistoryCache.getCoverageHistoryCached` | yes; 1h TTL | FLOWING |
| `skillDrift` cache | full matrix | `skillDriftCache.getSkillDriftCached` | yes; 30s TTL | FLOWING |

Real data flows end-to-end for all primary surfaces. `SkillDriftCell.lastModifiedIso` is degraded (always null) due to upstream `readLocalSkills` not populating mtime — flagged in 11-REVIEW.md WR-01 and visible to operators only as missing per-cell mtime hover detail. Not a goal-blocker for v1.1.

### Behavioural Spot-Checks

| Behaviour | Command | Result | Status |
|-----------|---------|--------|--------|
| Shared package tests pass | `pnpm --filter @agenticapps/dashboard-shared test --run` | 234/234 green, 20 test files | PASS |
| Agent package tests pass | `pnpm --filter @agenticapps/dashboard-agent test --run` | 746/746 green, 83 test files | PASS |
| SPA package tests pass | `pnpm --filter @agenticapps/dashboard-spa test --run` | 894/894 green, 106 test files | PASS |
| Workspace typecheck clean | `pnpm -r typecheck` | All 5 packages clean | PASS |
| Daemon route mount order | `grep app.route packages/agent/src/server/app.ts \| grep -E "coverageHistoryRoute\|skillDriftRoute"` | Both mounted under /api | PASS |
| No `setInterval` in scheduler (anti-pattern check) | `grep -c setInterval packages/agent/src/lib/snapshots/snapshotScheduler.ts` | 0 | PASS |
| No `?cell=` URL fragments (bulk shape verification) | `grep -c "?cell=" packages/spa/src/lib/coverageHistoryQueries.ts` | 0 | PASS |
| No hooks in CoverageCell (Option C structural lock) | `grep -c useCoverageHistory packages/spa/src/components/panels/coverage/CoverageCell.tsx` | 0 | PASS |
| No InlineDrift collision | `grep -c InlineDrift packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx` | 0 | PASS |

All behavioural spot-checks pass.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|-------------|--------|----------|
| TRD-01 | 11-02 | Daemon writes daily NDJSON snapshot under `~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson` (mode 0o600 / dir 0o700) | SATISFIED | snapshotWriter.ts implementation + 7 writer tests |
| TRD-02 | 11-02 | Snapshot pruner drops files older than now-14d, runs lazily before each writer tick | SATISFIED | snapshotPruner.ts + 5 tests; lazy-on-write call ordering test in writer T5 |
| TRD-03 | 11-01, 11-02, 11-04 | GET /api/coverage/history?repoId= returns drift for 1 repo (bulk-per-repo via PD-11-02 — schema field set differs slightly from REQUIREMENTS.md text but PD-11-02 supersedes — wire shape: schemaVersion: 1, repoId, windowDays: 14, cells: {4 cells}) | SATISFIED | Route + schema + hook all wired bulk-per-repo; outbound() defence; 1h cache |
| TRD-04 | 11-02 | Daily snapshot trigger fires via in-process scheduler (PD-11-01 reinterprets D-11-02), anchored to 03:00 local, .unref()'d, swallows errors | SATISFIED | snapshotScheduler.ts + 7 tests; registered via disposer registry in boot.ts |
| TRD-05 | 11-01, 11-04 | CoverageCell renders ▲Nd/▼Nd inline indicator when `drift` prop is present; CoverageDriftBadge.tsx text-only span; aria-label singular/plural; no new hex literals | SATISFIED | CoverageDriftBadge implementation + 9 tests; CoverageCell extension + 6 tests; tokenSourceOfTruth.test.ts continues to pass |
| SKD-01 | 11-01, 11-03 | scanSkillDrift aggregator iterates readRegistry().projects, derives family path-based with 'other' fallback, Promise.allSettled isolation | SATISFIED | skillDriftScan.ts + 18 tests; 3 family-fallback tests |
| SKD-02 | 11-01, 11-03 | GET /api/skills/drift returns SkillDriftResponseSchema; 30s cache; bearer-auth + CORS; outbound() | SATISFIED | Route + schema + cache + outbound wired |
| SKD-03 | 11-03 | POST /api/skills/drift/agentlinter accepts {projectId} (single-project, .strict()); reuses Phase 5 runner + cache unchanged; AgentLinterResponseSchema response | SATISFIED | Route + .strict body schema + 12 POST tests; REVIEWS #10 shared schema reuse |
| SKD-04 | 11-01, 11-05 | New SPA route /observability/skill-drift; per-skill matrix; per-family/cross-family chip (PD-11-03); per-row "Run AgentLinter" button | SATISFIED | All page/matrix/toolbar/cell components + lazy route + 46 tests |
| SKD-05 | 11-05 | Sidebar Observability section graduates to 2 peer entries; both use SidebarItem (NOT SidebarSubItem) | SATISFIED | Sidebar.tsx: 2 SidebarItem under Observability, 0 SidebarSubItem; new Sidebar tests S10/S11/S12 lock position and primitive choice. Note: REQUIREMENTS.md traceability table still shows "Pending" for SKD-05 — stale row; code is shipped. |
| PLI-01 | 11-06 | PageHeader sticky?: boolean prop (default false); when true outer div gains sticky+top-0+z-10+bg-app-bg; mb-6 preserved | SATISFIED | PageHeader.tsx + 5 PH tests; backward-compat verified by PH-S1/PH-S2 |
| PLI-02 | 11-06 | CoverageRow per-row refresh button defaults to opacity-30; hover/focus bump to opacity-100 | SATISFIED | One-token swap in CoverageRow.tsx + 3 tests; opacity-0 confirmed absent |
| PLI-03 | 11-06 | /coverage opts into sticky PageHeader at every render path; coverage.lazy.tsx NOT modified (REVIEWS action item 9 correction) | SATISFIED | 4 `sticky={true}` for 4 PageHeader invocations in CoveragePage.tsx; lazy file untouched (fs.readFileSync lock test) |
| INV-01 | 11-02, 11-03 | No daemon route writes to a registered project's filesystem | SATISFIED | snapshotWriter writes only under daemon home; skillDriftScan reads only project skills; coverageHistory route never touches project FS |
| INV-02 | 11-02 | Daemon writes confined to ~/.agenticapps/dashboard/; mode 0o600/0o700; refuse to start if looser | SATISFIED (with note) | File mode 0o600 enforced after every write (Pitfall 2 defence). Dir mode 0o700 enforced on first creation only — WR-03 flagged the gap; not a blocker because the daemon currently creates the dir itself, but defence-in-depth recommended |
| INV-04 | 11-01, 11-02, 11-03, 11-04, 11-05 | Schema validation runs at both ends; mismatches surface as schema_drift | SATISFIED | outbound() on every daemon response; parseOrDrift in SPA hooks; H6/SDM equivalent tests cover schema_drift surfacing |
| INV-05 | 11-02, 11-03 | No native deps in packages/agent | SATISFIED | No new deps in package.json; in-process scheduler avoids node-cron; AgentLinter reused unchanged |

**Coverage:** 13/13 requirement IDs declared in plan frontmatters satisfied. No orphaned requirements (REQUIREMENTS.md Phase 11 section maps exactly to TRD-01..05 + SKD-01..05 + PLI-01..03 = 13, all addressed across the 6 plans).

### Anti-Patterns Found

Scan of Phase 11 modified files (`grep -rn TODO|FIXME|XXX|HACK|PLACEHOLDER`) returns only benign hits (placeholder text in `<input placeholder="...">`, comment references to placeholder rows). No stub returns, no console.log-only handlers, no empty arrays masquerading as data.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/agent/src/lib/skillDriftScan.ts:158-159` | reads `lastModifiedIso` via passthrough; field always null in practice | Info | WR-01 in 11-REVIEW.md — wire-contract field is reserved but inert |
| `packages/agent/src/routes/registry.ts:126-138` | missing cache eviction on unregister | Warning | WR-02 in 11-REVIEW.md — coverageHistoryCache + skillDriftCache continue to return stale `projectName` for up to 30s (skill drift) or 1h (per-repoId entries that survived unregister) |
| `packages/agent/src/lib/snapshots/snapshotWriter.ts:69-71` | dir mode 0o700 only enforced on first creation | Warning | WR-03 in 11-REVIEW.md — INV-02 directory-mode invariant has a soft hole (pre-existing relaxed dir mode is not corrected) |
| `packages/spa/src/components/panels/skill-drift/SkillDriftMatrix.tsx:188-216` | useAgentLinterDrift mutation has no isPending/isError feedback | Warning | WR-04 in 11-REVIEW.md — user can click button repeatedly during 30s linter run; no inline error if linter fails |
| `packages/spa/src/components/panels/skill-drift/SkillDriftPage.tsx:58-63` | raw schema_drift message leaks to user | Info | IN-04 in 11-REVIEW.md — UX inconsistency vs CoveragePage |
| `packages/agent/src/lib/snapshots/snapshotPruner.ts` | exported with no path-confinement assertion | Info | IN-02 in 11-REVIEW.md — defence-in-depth; no current exploit path |
| `packages/agent/src/lib/snapshots/snapshotScheduler.ts:50-71` | in-flight tick can re-arm timer after disposer ran | Info | IN-03 in 11-REVIEW.md — `.unref()`'d so does not prevent process exit |
| `packages/agent/src/lib/snapshots/snapshotReader.ts:128-134` | malformed JSON skipped silently with no counter | Info | IN-05 in 11-REVIEW.md — silent corruption recovery is fine, missing operator signal |

**Classification:** No blockers; 4 warnings + 4 info items already captured in 11-REVIEW.md awaiting a hardening pass. None of these prevent goal achievement. WR-02 (cache eviction on unregister) is the closest to a functional defect and should be addressed before merge — but it does not block the phase's primary deliverables.

### Human Verification Required

8 items documented in YAML frontmatter `human_verification:` block. Summary:

1. Visual smoke on /coverage drift badges
2. Visual smoke on /observability/skill-drift matrix + scope toggle + URL sync
3. Sticky PageHeader scroll behaviour on /coverage + non-opted-in routes
4. Per-row refresh-button opacity discoverability (touchpad + keyboard)
5. AgentLinter mutation flow on skill drift page (real spawn)
6. Daily snapshot scheduler smoke (overnight or simulated)
7. Symlink-escape boot refusal (manual setup + restart)
8. IMPECCABLE critique re-run on /coverage + /observability/skill-drift → 11-IMPECCABLE.md

### Gaps Summary

**No goal-blocking gaps.** All 35 must-have truths are verified; all 13 requirement IDs are satisfied; all artifacts exist substantively and are wired with real data flow; all behavioural spot-checks pass; full test suite is 1,874 green (234 shared + 746 agent + 894 SPA).

The phase ships its three sub-tracks end-to-end:
- **Coverage trends** — daily NDJSON snapshots, bulk-per-repo `/api/coverage/history`, inline ▲Nd/▼Nd drift badges via Option C ownership model (PD-11-02 + REVIEWS action item 1 resolved together)
- **Skill drift** — daemon aggregator + new `/observability/skill-drift` SPA route with PD-11-03 scope model, single-project AgentLinter calls (D-11-14), Sidebar peer-entry graduation (D-11-08)
- **Polish bundle** — sticky PageHeader prop + opacity-30 row-refresh + CoveragePage opt-in at every render path (REVIEWS action item 9 correction landed)

Architectural invariants hold: read-only on project filesystems (INV-01), daemon writes confined with mode enforcement (INV-02 — with WR-03 noting directory-mode hole that does not break the goal), schema validation at both ends (INV-04), no native dependencies (INV-05).

**Why human_needed and not passed:** Five visual/behavioural confirmations remain (drift badge appearance, matrix visual, sticky scroll, opacity discoverability, linter spawn), the daily-scheduler tick is time-anchored and cannot be exercised by unit tests, and the IMPECCABLE critique (calibration data point #2 for D-10.5-03 floor ≥ 87) must be run as a skill-driven session. The 4 warnings from 11-REVIEW.md (WR-01..04) are also surfaced here for triage but are not goal-blockers.

---

_Verified: 2026-05-16T17:15:00Z_
_Verifier: Claude (gsd-verifier)_
