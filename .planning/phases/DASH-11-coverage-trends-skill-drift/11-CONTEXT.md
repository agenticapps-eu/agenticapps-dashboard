# Phase 11: Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle — Context

**Gathered:** 2026-05-16
**Status:** Ready for planning
**Branch:** `feat/coverage-trends-skill-drift` (cut from `main@9f149d2`, pushed to origin)

<domain>
## Phase Boundary

Close v1.1 — **Cross-family observability** — by extending the existing Coverage Matrix (Phase 10/10.5/10.6) along two axes and folding two leftover polish items:

1. **Coverage trends** — persist daily Coverage snapshots locally (NDJSON under `~/.agenticapps/dashboard/coverage-history/`); surface a per-cell inline drift indicator on `CoverageCell` (▲14d / ▼7d) when a state transition is detected within the rolling window.
2. **Cross-repo skill drift** — aggregate `.claude/skills/` across every registered project into a new **Skill drift** page; primary view is a **per-skill matrix** (rows = skills, columns = projects) showing presence + version drift. Includes an on-demand AgentLinter run per project from the matrix. Both per-family and cross-family views available via filter chip.
3. **Phase 10.6 polish bundle** — sticky `PageHeader` primitive (affects every dashboard route) + Coverage row-refresh icon `opacity-0` → `opacity-30` for touchpad/keyboard discoverability.

**In scope (v1.1 close-out):**
- Daemon snapshot writer + 14-day rolling retention + `GET /api/coverage/history?repoId=` endpoint (returns drift for ALL FOUR cells of one repo in one response — bulk-per-repo shape locked by PD-11-02 below).
- Daily cron trigger via Phase 6 launchd/systemd install (no opportunistic dashboard-load writes).
- `CoverageCell` extension: inline `▲Nd` / `▼Nd` text indicator when state transition occurred in the last 14 days; absent otherwise. `CoverageCell` stays purely presentational — drift data arrives via a `drift?` prop fanned out from its parent `CoverageRow`, which owns the single per-repo history hook (Option C — see PD-11-02).
- Daemon `skillDriftScan.ts` aggregator + `GET /api/skills/drift` endpoint + `POST /api/skills/drift/agentlinter` for on-demand AgentLinter runs per project (reuses Phase 5 `agentLinterRunner.ts` + `agentLinterCache.ts`).
- New SPA route `/observability/skill-drift` mounted under `_appshell`; new `Skill drift` sidebar entry (the second item under `Observability` after `Coverage`).
- `PageHeader` sticky polish + `RefreshRowButton`/icon opacity polish.
- TDD on every new schema, scanner, route, hook, panel.
- Gates: Stage 1 `/review` + Stage 2 `superpowers:requesting-code-review` + `/cso` (new daemon write surface for snapshots + widened AgentLinter spawn surface) + `/qa` walkthrough + `impeccable:critique` post-fix (calibration data point #2 for D-10.5-03 floor).

**Out of scope (v1.1 — explicitly deferred):**
- **Family-aggregate trends** (per-family or fleet-level Coverage line charts) — deferred to v1.2; will likely live on Phase 12's `/observability/trend` route, not on the Coverage page.
- **12-tick mini-sparkline on `CoverageCell`** — inline indicator only for v1.1; sparkline can land in v1.2 if signal justifies it.
- **Hover-only drift surfaces** — break on touch (Tailscale-from-iPad use case).
- **Auto-correction of registry path drift** — separate hygiene task (also called out in Phase 12 CONTEXT D-12-09).
- **Help-page authoring** for any new `/help/observability/...` deep-links — stubbed via `ComingSoonRoute` if referenced; authoring is the v1.1 help-docs workstream.
- **New chart libraries** — pure SVG primitives only (matches Phase 12's D-12-04 stance; preserves zero-third-party-JS constraint).
- **Per-project Skill drift matrix view (rows=projects, cols=skills)** — per-skill is the primary; per-project remains accessible via the Phase 5 single-project Skills panel that already exists.

</domain>

<decisions>
## Implementation Decisions

### Coverage trends (Candidate A)

- **D-11-01:** Snapshot retention window — **14 days** (rolling). Why: symmetry with COV-11's GitNexus 14-day stale threshold; tight visual signal; ~5MB/year storage at 45 repos × 4 columns. NDJSON-append plus a daily pruner that drops lines older than 14 days.
- **D-11-02:** Snapshot trigger — **daily cron only** via the existing Phase 6 launchd / systemd install. Why: reuses installed infrastructure; one snapshot per ISO date; no race-condition surface from opportunistic on-load writes. Acceptable gap: days the daemon isn't running are missing from history (signal degrades, doesn't crash). **SUPERSEDED by PD-11-01 — see <deviations> block below.**
- **D-11-03:** Drift surface — **inline indicator only** (▲Nd / ▼Nd text, where N is days since the most recent state transition within the 14d window). Why: preserves the dense matrix's calm aesthetic (post Phase-6/10.5 polish); no new SVG primitive; works on touch. Absent when no transition in window. Component name MUST avoid the existing `InlineDrift.tsx` (schema-drift panel) — use `CoverageDriftBadge` or similar.

### Skill drift (Candidate B)

- **D-11-04:** Aggregation level — **per-skill matrix** as the primary view (rows = skills, columns = projects). Why: mirrors the Coverage matrix mental model; answers "which projects are still behind on skill X?" fleet-wide; per-project view already exists at the Phase 5 single-project Skills panel.
- **D-11-05:** AgentLinter integration depth — **on-demand AgentLinter run per project from the matrix**. Why: reuses Phase 5's existing `packages/agent/src/lib/agentLinterRunner.ts` + `agentLinterCache.ts`; the AgentLinter spawn surface already exists at the per-project route — Phase 11 adds a new invocation context (from the cross-repo matrix), not a new spawn surface. `/cso` must verify the widened call-site doesn't expand the trust boundary beyond the per-project equivalent (same binary, same args, same cache semantics, same per-project root constraint).
- **D-11-06:** Cross-family vs in-family — **both, per-family default with cross-family via filter chip**. Why: reuses Phase 10's `CoverageToolbar` multi-select filter-chip pattern (200ms debounce + URL sync). Default per-family respects family-boundary contract; cross-family chip closes the v1.1 milestone framing without forcing it as the default. **Scope-model details refined by PD-11-03 below.**

### Scope + IA

- **D-11-07:** Family-aggregate Coverage trends — **deferred to v1.2**. Why: per-cell inline drift is enough to deliver v1.1's promise; fleet-level charts likely belong on Phase 12's `/observability/trend` route (avoids duplicating work with the Observability Conformance Surface).
- **D-11-08:** Sidebar IA — **2 entries under `Observability`: `Coverage`, `Skill drift`**. Why: Trends are inline on `CoverageCell` (per D-11-03), so a separate "Trends" sidebar entry would surface a near-empty page. Graduates the section from single-item (D-10-08) to multi-item without forcing a third entry. Matches user's stated preference for new sidebar sections with growth room over peer top-level items (auto-memory `feedback_sidebar_section_architecture`). Phase 12 adds `Conformance` as a 3rd entry naturally.

### Polish bundle

- **D-11-09:** Sticky `PageHeader` primitive — modify `packages/spa/src/components/ui/PageHeader.tsx` to support a `sticky?: boolean` prop (default `false` to preserve current behavior on routes that haven't been audited). Opt-in per route to avoid regressing scroll behavior on non-Coverage pages. Why: minimal surface; lets Coverage opt in immediately while other routes adopt during their own gate cycles.
- **D-11-10:** Coverage row-refresh icon opacity polish — `opacity-0` → `opacity-30` on the per-row refresh button (touchpad/keyboard discoverability per Phase 10.6 IMPECCABLE triage). Lives inside `CoverageRow.tsx`; hover/focus still bumps to `opacity-100`.

### Wire schema strategy

- **D-11-11:** **Sibling endpoint** for history (`GET /api/coverage/history`), NOT a `history?: CoverageDrift[]` field on `CoverageResponseSchema`. Why: keeps the 30s `CoverageResponse` payload tight (the matrix-view path is hot); history is a separate cell-scoped fetch only when the cell renders a drift indicator. Mirrors how Phase 12 chose sibling routes (D-12-02) over widening Phase 5's `/observability`. **Endpoint SHAPE refined by PD-11-02 below — now bulk-per-repo (4 cells per response) instead of per-(repo, cell).**
- **D-11-12:** **New shared schema file** `packages/shared/src/schemas/coverageHistory.ts` (sibling to `coverage.ts`); barrel re-export from `packages/shared/src/index.ts`. Skill drift gets its own `packages/shared/src/schemas/skillDrift.ts`. Why: file boundary keeps the Phase 10 schema file from growing past 200 LOC and keeps git blame clean for the existing Coverage surface.

### Trust-boundary deltas (for `/cso`)

- **D-11-13:** New **daemon write path** — `~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson` (mode `0600`, append-only by writer, pruner drops files older than 14d). First time the daemon writes outside `registry.json` / `auth.json` — `/cso` must verify path is confined to `~/.agenticapps/dashboard/`, mode enforcement, no symlink escape.
- **D-11-14:** **Widened AgentLinter spawn surface** — new call-site for `agentLinterRunner.run()` at the cross-repo Skill drift route, in addition to Phase 5's per-project route. Same binary, same args, same cache. `/cso` audits that the new call-site cannot escape its per-project root constraint and cannot run more than 1 project's lint at a time per request.

### Claude's Discretion

- **Component naming** for the inline drift surface (`CoverageDriftBadge` / `DriftIndicator` / `TrendBadge` — Claude picks at plan time; just NOT `InlineDrift` which is the Phase 6 schema-drift panel).
- **NDJSON record shape** internal to `coverage-history/*.ndjson` files (planner can choose record per row per day vs row per (row × column) per day). Wire shape is locked by `CoverageHistorySchema` regardless.
- **Cron implementation detail** — extend the existing Phase 6 launchd plist with a `StartCalendarInterval` entry, or wire a separate timer; planner decides based on what tests cleanest. **Resolved by PD-11-01 below — in-process scheduler chosen.**

### Folded Todos

None matched from `gsd-tools todo match-phase 11` (todo_count = 0). The 5 STATE.md "Pending Todos" are tracked separately:

- STATE Todo #1 (push ADR-0011 addendum) — out of scope; cross-repo workflow-core branch lives elsewhere.
- STATE Todo #2 (migration-0008 drift investigation) — already resolved by PR #30 (`db9de37`); marker can be closed in a follow-up STATE update.
- STATE Todo #3 (v1.0.1 follow-ups) — already closed via PR #31 (`28beb0e`); STATE marker should be removed.
- STATE Todo #4 (Phase 10.6 polish backlog) — **partially folded** as D-11-09 + D-11-10 (the 2 items called out in the audit as "fold into Phase 11.x"). The other 3 P3 items stay in `10-IMPECCABLE.md` for a future polish bundle.
- STATE Todo #5 (Phase 11/12 audit) — resolved by the 2026-05-15 audit decision (combined A+B) and this CONTEXT.

</decisions>

<deviations>
## Plan-Time Deviations (PD-11-NN)

These supersede or refine locked decisions during planning. Recorded here for
auditability — original decision text is preserved above for traceability.

### PD-11-01 — In-process scheduler supersedes D-11-02's launchd `StartCalendarInterval`

**Supersedes:** D-11-02's "daily cron only via the existing Phase 6 launchd / systemd install" — specifically the `StartCalendarInterval` plist extension implied by the wording.

**New direction:** Daily snapshot trigger fires **inside the running daemon** via an in-process `setTimeout` chain anchored to next 03:00 local time, re-armed after each tick, `.unref()`'d so it does not block daemon shutdown. NO modifications to the Phase 6 launchd plist or systemd unit.

**Why the deviation:**
- Phase 6's installed plist sets `KeepAlive=true` + `RunAtLoad=false` (verified at `installLaunchd.ts:46`). Adding `StartCalendarInterval` to a `KeepAlive=true` plist either spawns duplicate daemons or is silently ignored — launchd treats those triggers as mutually exclusive (research §A9).
- The daemon process IS the long-lived process that launchd keeps alive; scheduling within it reuses the same lifecycle without a second launchd-managed actor.
- Tests are simpler (`vi.useFakeTimers()` + injected `now()`) than out-of-process cron testing.

**Spirit preserved:** Daily snapshot, one tick per ISO date, infrastructure-managed lifecycle. The only changed implementation detail is "who fires the tick" — the daemon, not launchd.

**Owner:** Plan 11-02 Task 4 (`snapshotScheduler.ts`).

---

### PD-11-02 — Bulk-per-repo `/api/coverage/history` endpoint supersedes per-(repo, cell) shape

**Refines:** D-11-11's "sibling endpoint" decision. The sibling endpoint stays — its SHAPE changes from per-(repo, cell) to per-repo (all 4 cells in one response).

**New endpoint contract:**

```
GET /api/coverage/history?repoId=<family/repo>
→ {
    schemaVersion: 1,
    repoId: '<family/repo>',
    windowDays: 14,
    cells: {
      claudeMd:        { direction: 'up'|'down'|null, daysSince: number|null },
      gitNexus:        { direction: ..., daysSince: ... },
      wiki:            { direction: ..., daysSince: ... },
      workflowVersion: { direction: ..., daysSince: ... },
    }
  }
```

The `?cell=` query parameter is REMOVED — every response carries drift for all
four cells of the named repo.

**Why the deviation:**
- The original per-(repo, cell) shape produces 4 requests per row × ~42 rows = ~168 requests on first paint of `/coverage`. TanStack Query dedup cannot help — query keys are unique per `(repoId, cell)` tuple. REVIEWS.md action item 2 flagged this as a HIGH performance concern.
- The original shape also forced an ambiguous ownership model on `CoverageCell.tsx`: either the cell becomes a smart cell (calls `useCoverageHistory` itself, breaks presentational purity) or its parent fans out the data (in which case ONE history call per cell is wasteful when the parent already fetches per-row coverage data).
- Bulk-per-repo cuts first-paint requests to ≤ 1 per registered repo (≤ 42), keeps `CoverageCell` purely presentational with a `drift?` prop, and lets `CoverageRow` own the single `useCoverageHistory(repoId)` hook that produces the four cell drifts in one go.

**Performance budget (REVIEWS.md action item 2):**
- **≤ 1 history request per registered repo on first paint of `/coverage` until the user interacts** (i.e. ≤ ~42 requests for the current registry size, not ~168).
- Verified by a fetch-call-count assertion in `CoverageRow.test.tsx` and an integration assertion in `CoveragePage.test.tsx` (mock `apiFetch`, render with N fixture rows, assert call count === N).

**Drift-data ownership model (REVIEWS.md action item 1 — Option C chosen):**
- `CoverageRow.tsx` owns `useCoverageHistory(repoId)` and passes each of the four cells' `drift` values as props into the four `CoverageCell` children.
- `CoverageCell.tsx` stays purely presentational with a `drift?: { direction; daysSince } | null` prop. NO hook calls inside the cell.
- `CoveragePage.tsx` is unchanged — the per-row fanout lives one level down.

**Owners:**
- Plan 11-01: schema `CoverageHistoryResponseSchema` shape (cells inline, 4-cell record).
- Plan 11-02: endpoint handler + cache key (now `${repoId}` not `${repoId}:${cell}`); `snapshotReader.ts` exposes a `readDriftForRepo(repoId)` helper returning all 4 cells.
- Plan 11-04: `useCoverageHistory(repoId)` hook signature drops `cell` parameter; `CoverageRow.tsx` added to `files_modified`; `CoverageCell.tsx` becomes purely presentational.

---

### PD-11-03 — Skill-drift scope model: family sections by default + cross-family flat view via chip

**Refines:** D-11-06's "both, per-family default with cross-family via filter chip" by locking the exact UX so Plan 11-05's hook signature, toolbar tests, and matrix tests all align before execution (REVIEWS.md action item 8).

**Decision:** Mirror Phase 10's `CoverageToolbar.tsx` exactly:

- Default scope `'family'`: matrix is **rendered as four family sections** (`agenticapps`, `factiv`, `neuroflash`, `other`) stacked vertically. Each section header shows family name + project count. Columns within each section are that family's projects only. This matches `CoverageFamilySection.tsx` and `CoveragePage.tsx`'s family grouping.
- Scope `'cross'` (via chip): matrix is **rendered as a single flat block** with ALL projects from ALL families interleaved alphabetically by `projectId` as columns. No family section dividers.
- URL sync: `?scope=family` (default — may be elided) | `?scope=cross`.
- Chip pattern: single-select chip group `[ Per family ] [ Cross family ]` (NOT multi-select — exactly one is active at a time).
- `useSkillDrift({ scope })` hook signature: `scope` is consumed for the queryKey only (`['skillDrift', scope]`) so URL navigation between scopes triggers a cache-aware refetch if needed; the daemon endpoint does NOT change shape based on scope (always returns all projects + all skills; SPA filters/groups client-side).

**Owner:** Plan 11-05 Task 1 (hook), Task 2 (toolbar + matrix rendering).

</deviations>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 11 scope source-of-truth
- `.planning/ROADMAP.md` §"Phase 11: Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle" — formal phase entry inserted 2026-05-16.
- `.planning/ROADMAP.md` §"Phase 11+ Candidates — v1.1 close-out audit (2026-05-14)" — audit decision (combined A+B, recorded 2026-05-15) and the original 8 open scope decisions.

### Hard architectural constraints (every implementation choice must respect these)
- `docs/spec/dashboard-prompt.md` — daemon read-only on project FS, daemon writes confined to `~/.agenticapps/dashboard/`, no native deps, bearer-auth + CORS lock, no Cloudflare Workers in v1.
- `.planning/PROJECT.md` §"Constraints" — same constraints framed as project-level non-negotiables.
- `.planning/REQUIREMENTS.md` §"Architectural Invariants" — INV-01..INV-05.

### Phase 10 surface (extension targets)
- `packages/shared/src/schemas/coverage.ts` — current `CoverageResponseSchema`; Phase 11 adds sibling history schema, does NOT modify this file.
- `packages/agent/src/lib/scanners/` — existing 5 Coverage scanners; Phase 11 adds `snapshotWriter.ts` and `snapshotPruner.ts` under `packages/agent/src/lib/snapshots/` (NEW dir, not under `scanners/`).
- `packages/agent/src/lib/coverageScan.ts` — orchestrator; snapshot write triggers off the cron tick reading the latest scan, NOT inside the request-path orchestrator.
- `packages/agent/src/lib/coverageCache.ts` — 30s memo; unchanged.
- `packages/agent/src/routes/` — existing route directory; Phase 11 adds `coverage-history.ts` + `skill-drift.ts`.
- `packages/spa/src/components/panels/coverage/CoverageCell.tsx` — extend with optional `drift?: { direction: 'up' | 'down'; daysSince: number } | null` prop and render the inline `▲Nd`/`▼Nd` badge. **Cell stays presentational — no hook calls inside (PD-11-02).**
- `packages/spa/src/components/panels/coverage/CoverageRow.tsx` — owns `useCoverageHistory(repoId)` per PD-11-02 + opacity polish (D-11-10) lives here.
- `packages/spa/src/components/ui/PageHeader.tsx` — add `sticky?: boolean` prop (D-11-09).
- `packages/spa/src/components/panels/coverage/CoveragePage.tsx` — owns the `<PageHeader>` invocation; PLI-03 opts THIS file (not `coverage.lazy.tsx`) into `sticky={true}`.

### Phase 5 surface (skills + AgentLinter — reuse, do NOT rebuild)
- `packages/agent/src/lib/skillsScan.ts` — per-project skills scanner; Phase 11's cross-repo aggregator wraps this per project, does NOT reimplement scan logic. **`readLocalSkills` returns `{ scope: 'local'; skills: SkillEntry[] }` (not a raw array — verified at `skillsScan.ts:133-135`).**
- `packages/agent/src/routes/skills.ts` — per-project skills route; Phase 11 adds a sibling `/api/skills/drift` route.
- `packages/agent/src/lib/agentLinterRunner.ts` — spawn surface; reused as-is by D-11-05.
- `packages/agent/src/lib/agentLinterCache.ts` — 1h cache; reused.
- `packages/agent/src/routes/agentlinter.ts` — Phase 5 per-project route; canonical response shape `AgentLinterResponseSchema` from `@agenticapps/dashboard-shared`. **Plan 11-05 mutation hook MUST import this shared schema (do NOT define a local copy — REVIEWS.md action item 10).**
- `packages/spa/src/components/panels/InstalledSkills.tsx` + `SkillHealth.tsx` — single-project precedents for visual treatment of skill presence + lint scores.

### Phase 10.6 / 10.5 polish source
- `.planning/phases/DASH-10-coverage-matrix-page-per-repo-presence-freshness-of-claude-m/10-IMPECCABLE.md` §"Additional follow-up" — the 2 items folded as D-11-09 + D-11-10.
- `.planning/phases/DASH-10.5-impeccable-skill-driven-gate/10.5-DECISIONS.md` — composite ≥ 87 floor (D-10.5-03); Phase 11 is calibration data point #2.

### Phase 12 anticipation (informs IA + non-duplication)
- `.planning/phases/DASH-12-observability-conformance-surface/12-CONTEXT.md` — Phase 12 anticipates Phase 11's IA choices (D-12-01) and already scopes a 90-day fleet trend chart on `/observability/trend` (D-12-04). Phase 11's D-11-07 (defer family-aggregate to v1.2) keeps that surface for Phase 12 to own.

### Design system
- `packages/spa/src/styles/tokens.css` — Phase 5.1 token namespace (warm paper, aubergine, accent purple). Drift badge must use existing status tokens (`text-status-error`, `text-status-success` or new tertiary if needed; planner picks).
- `packages/spa/src/components/AppShellV2.tsx` + `Sidebar.tsx` — section/entry pattern (D-10-08 introduced `Observability` as single-item section).

### SPA API client
- `packages/spa/src/lib/api.ts` — **`apiFetch(path, schema, init?)` returns `Promise<ParseOrDrift<T>>` (verified at `api.ts:61-65`). Callers must unwrap via `result.ok ? result.data : throw`.** Plans 11-04 and 11-05 MUST use this signature exactly — do NOT pass options-object shapes.

### Forbidden name collision
- `packages/spa/src/components/panels/InlineDrift.tsx` — **THIS IS THE PHASE 6 SCHEMA-DRIFT PANEL**, not coverage drift. Phase 11's inline drift indicator MUST NOT reuse this name. Suggested names: `CoverageDriftBadge`, `DriftIndicator`, `TrendBadge` (planner picks).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`packages/agent/src/lib/scanners/coverageScan.ts`** — Phase 10 orchestrator. Phase 11 reads its latest output (via cache or fresh scan) inside the daily cron callback and writes the snapshot.
- **`packages/agent/src/lib/skillsScan.ts`** — Per-project skills scanner. Phase 11's cross-repo aggregator iterates registered projects and calls this per project. `readLocalSkills(root)` returns `{ scope: 'local'; skills: SkillEntry[] }`; aggregator destructures `.skills`.
- **`packages/agent/src/lib/agentLinterRunner.ts`** + **`agentLinterCache.ts`** — AgentLinter spawn + cache. Phase 11's D-11-05 on-demand AgentLinter route reuses both unchanged.
- **`packages/spa/src/components/panels/coverage/CoverageCell.tsx`** — Receives optional `drift` prop fanned out by parent `CoverageRow`; renders inline indicator next to existing 4-state cell content. NO hook calls inside.
- **`packages/spa/src/components/panels/coverage/CoverageRow.tsx`** — Owns `useCoverageHistory(repoId)` and fans drift props out to its four CoverageCell children (PD-11-02). Also carries the opacity-30 polish (D-11-10).
- **`packages/spa/src/components/panels/coverage/CoverageToolbar.tsx`** — Multi-select filter chip pattern (200ms debounce + URL sync). Skill drift toolbar replicates this exact pattern for per-family/cross-family toggle.
- **`packages/spa/src/components/ui/PageHeader.tsx`** — Existing primitive; Phase 11 adds `sticky?: boolean` prop opt-in.
- **`packages/spa/src/components/ui/SidebarSection.tsx` + `SidebarItem.tsx`** — Existing primitives; Skill drift entry is one more `SidebarItem` peer under the existing `Observability` `SidebarSection` (NOT `SidebarSubItem` — see Plan 11-05).
- **Phase 6 launchd plist** at `packages/agent/src/install/launchd/*` (path to verify at plan time) — **NOT MODIFIED** per PD-11-01; scheduler runs in-process inside the daemon launchd keeps alive.
- **`packages/agent/src/lib/paths.ts`** — `COVERAGE_ROOTS` extension pattern (used in Phase 10 to add `~/.gitnexus` + family roots). New write path `~/.agenticapps/dashboard/coverage-history/` lives under the existing daemon-confined root, so no new public allow-list needed.

### Established Patterns

- **Zod schemas as single source of truth** for daemon ↔ SPA wire shapes (PROJECT.md constraint). Drift schemas live in `packages/shared/src/schemas/{coverageHistory,skillDrift}.ts` and are validated at both ends with `parseOrDrift`.
- **30s daemon memo + 5s SPA polling** for matrix-style endpoints (Phase 10). Skill drift adopts the same; coverage-history endpoint uses a longer cache (1h — history changes once per day at most).
- **`Promise.allSettled` partial-failure isolation** for fan-out scanners (Phase 10 AGREED-2). Skill drift's per-project AgentLinter run uses the same pattern when invoked over many projects (the on-demand UX should be one-at-a-time though, per D-11-14).
- **Clipboard-only for daemon-spawn-unsafe actions** (D-10-09). N/A here — D-11-05 is an explicit decision to spawn AgentLinter, not clipboard.
- **4-state freshness vocabulary** (`fresh`/`stale`/`missing`/`not-applicable` per COV-11) — drift indicators reference state transitions between these enums.
- **Mode 0600 enforcement** (Phase 1, AUTH constraints) — extended to `coverage-history/` directory creation.

### Integration Points

- **New route mount** — extend `packages/agent/src/server/app.ts` with `coverage-history` + `skill-drift` routes (bearer-auth + CORS inherited from middleware).
- **New SPA route** — extend `packages/spa/src/router.tsx` with `/observability/skill-drift` (lazy + zodValidator like the Phase 10 `/coverage` route).
- **New sidebar entry** — extend `packages/spa/src/components/ui/Sidebar.tsx` with one more `SidebarItem` under the existing `Observability` `SidebarSection`.
- **In-process scheduler wiring** — `packages/agent/src/server/boot.ts` calls `startSnapshotScheduler()` and registers its disposer with the existing `gracefulShutdown` path. Per REVIEWS.md action item 5, Plan 11-02 contains an explicit sub-task to introduce a minimal disposer registry inside `boot.ts` so the wiring is explicit, not assumed (current `boot.ts` has no callback/disposer registry — verified at `boot.ts:31-83`).
- **CHANGELOG.md** — v1.1 entry already exists for Phase 10; Phase 11 appends a sub-bullet (not a new release line — v1.1 is the milestone being closed).

</code_context>

<specifics>
## Specific Ideas

- Drift indicator text format: `▲Nd` (improved N days ago — e.g. cell went `missing` → `fresh`) and `▼Nd` (regressed N days ago — e.g. `fresh` → `stale` or `stale` → `missing`). Down arrow for regressions matches the "what's getting worse?" framing from the audit.
- Skill drift filter chip for per-family vs cross-family reuses Phase 10's `CoverageToolbar` styling exactly (same chip group, same 200ms debounce, same URL sync) — visual consistency between the two Observability surfaces is a design goal.
- Sticky `PageHeader` should retain the 24px bottom margin (`mb-6`) below the title row; the sticky behavior wraps the existing layout, doesn't replace it.

</specifics>

<deferred>
## Deferred Ideas

### v1.2 candidates surfaced by Phase 11 scope-trimming
- **Family-aggregate Coverage trends** (per-family 3-up or fleet-level line chart on the Coverage page) — D-11-07. Better home: Phase 12's `/observability/trend` route, which is already scoped to own the 90-day fleet line chart.
- **12-tick mini-sparkline on `CoverageCell`** — alternative to D-11-03's inline-only indicator. Revisit if v1.1 user feedback shows the inline indicator misses magnitude/trend signal.
- **Hover-only progressive disclosure for drift** (sparkline on hover, indicator always-on) — rejected for touch-device incompatibility; revisit only if a pointer-device-only deployment context appears.
- **Per-project Skill drift matrix view** (rows = projects, columns = skills) — D-11-04 chose per-skill as primary. Per-project view already partially exists at the Phase 5 single-project Skills panel; a dedicated cross-repo per-project view can land in v1.2 if dogfooding asks for it.

### Phase 10.6 polish backlog (not folded into Phase 11)
- 3 remaining P3 items in `10-IMPECCABLE.md` "Additional follow-up" — stay in the polish backlog for a future bundle phase (likely Phase 13+).

### Reviewed Todos (not folded)
None reviewed — `gsd-tools todo match-phase 11` returned 0 matches; STATE.md Pending Todos handled via the Decisions §"Folded Todos" subsection.

</deferred>

---

*Phase: DASH-11-coverage-trends-skill-drift*
*Context gathered: 2026-05-16*
*Deviations appended 2026-05-16 during `/gsd-plan-phase 11 --reviews` (PD-11-01, PD-11-02, PD-11-03).*
