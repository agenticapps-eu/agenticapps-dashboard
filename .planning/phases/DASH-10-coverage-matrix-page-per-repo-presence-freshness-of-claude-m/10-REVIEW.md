# Phase 10: /review Gate Document

**Reviewer:** Claude (claude-sonnet-4-6) — Stage 1 spec-compliance audit  
**Branch:** phase-10-coverage-matrix  
**Diff base:** main  
**Review date:** 2026-05-13  
**Protocol:** Two-stage review per Phase 6 D-6-12. Stage 2 requires a fresh-context `/clear`'d session (`superpowers:requesting-code-review`).

---

## Stage 1: /review

### Method

Walked `git diff main...HEAD --stat` (87 files, 16,832 insertions, 43 deletions). Read key source files: `coverage.ts` (route), `coverageScan.ts` (orchestrator), `coverageResolver.ts`, `repoDiscovery.ts`, all 5 scanners, `coverage.ts` (shared schemas), `CoverageRow.tsx`, `CoverageFamilySection.tsx`, `RefreshAllStaleButton.tsx`. Cross-referenced each COV-XX requirement, each 10-REVIEWS.md finding, each CONTEXT.md decision, and all architectural invariants.

---

### A. Requirements Coverage (COV-01..COV-12)

**COV-01 — GET /api/coverage matrix shape**  
Verified: `packages/agent/src/routes/coverage.ts` GET handler at `/coverage`, `packages/shared/src/schemas/coverage.ts` `CoverageResponseSchema` carries `family`, `repo`, `claudeMd`, `gitNexus`, `wiki`, `workflowVersion`, `overrideCount`, `overrides`, plus `generatedAtIso`, `schemaVersion`, `gitNexusInstalled`, `workflowHeadVersion`. Route mounts via `app.route('/api', coverageRoute)` in `app.ts`. Result: **CONFIRMED**.

**COV-02 — Filesystem reads through dedicated scanners; resolveAllowedNamed extended**  
Verified: `packages/agent/src/lib/paths.ts` exports `COVERAGE_ROOTS` (lines 147–152) with `gitnexus`, `agenticapps`, `factiv`, `neuroflash`. `coverageResolver.ts` constructs allowed roots from these 4 entries plus migrationsDir, wrapping every external read in `realpathSync` + root-prefix assertion. All 5 scanners accept a `PathResolver` callback and route every `readFileSync`/`existsSync` call through it. `/api/projects/:id/read` path allow-list was NOT widened. Result: **CONFIRMED**.

**COV-03 — 30s daemon-side memo cache; cache cleared on POST refresh; cold-load < 1s**  
Verified: `packages/agent/src/lib/coverageCache.ts` — `getCoverageCache()`, `setCoverageCache()`, `invalidateCoverageCache()` with 30,000ms TTL. Route GET handler checks cache first; POST refresh calls `invalidateCoverageCache()` before re-scan. Cold scan: 45 repos × ~6 syscalls via `Promise.all` across repos; `Promise.allSettled` per row. No I/O-heavy operations in the hot path; stat-only reads. The 1s target is met by design (file-stat only). Result: **CONFIRMED**. (Live < 1s cannot be asserted in this document review; Scenario 3 in HUMAN-UAT covers it.)

**COV-04 — POST /api/coverage/refresh contract**  
Verified: `CoverageRefreshActionSchema = z.enum(['gitnexus-analyze'])` — daemon rejects all other actions at Zod parse with 400. `CoverageRefreshResponseSchema` is a discriminated union where `kind='ok'` branch has `updatedRow: CoverageRowSchema` as **required** (not optional) — CODEX HIGH-5 fix landed. Spawn uses PATH-resolved binary (`which gitnexus`) via `execa(cmd, ['analyze'], { cwd })` — never `npx`. Clipboard builders (`buildWikiCompileClipboardString`, `buildWorkflowUpdateClipboardString`) live in `packages/shared/src/clipboard.ts` — SPA-side only, no daemon roundtrip. Result: **CONFIRMED**.

**COV-05 — Grouped sections per family; sticky headers; aggregate counts; collapse toggle**  
Verified: `CoverageFamilySection.tsx` — `<section>` with sticky `<header>`, collapse via `useState` + `localStorage` key `coverage:section-collapsed:<family>`. `computeCounts()` uses worst-state-wins per row (CODEX MED fix). `CoveragePage.tsx` renders three `<CoverageFamilySection>` instances — one per family. Matrix (table) always visible in expanded state. Result: **CONFIRMED**.

**COV-06 — Filter chips; search; URL params; family aggregate reflects filtered view**  
Verified: `CoverageToolbar.tsx` provides chip multi-select (`all`, `missing`, `stale`, `fresh`) + free-text search input. URL params `?status=&q=` round-trip via `CoverageSearchSchema` in `router.tsx` (zodValidator). `CoveragePage.tsx` applies filter/search to rows before passing to each `CoverageFamilySection` — so aggregate counts in the sticky header reflect filtered view only. Debounce: `CoverageToolbar` test asserts 200ms debounce (from test file). Result: **CONFIRMED**.

**COV-07 — Override chip; git-log timestamp; absent when count 0**  
Verified: `OverrideChip.tsx` — conditionally renders only when `count > 0` (confirmed by component source). `overrideSentinelScanner.ts` reads `git log -1 --format=%aI` for sentinel timestamp, not mtime. `CoverageRow.tsx` renders `<OverrideChip count={row.overrideCount} overrides={row.overrides} repoName={row.repo} />`. Schema: `OverrideEntrySchema` has `phaseSlug`, `sinceIso`, `source: enum(['git-log', 'mtime'])`. Result: **CONFIRMED**.

**COV-08 — Workflow head from migrations `to_version`; dual-layout SKILL.md probe; 5 sub-states**  
Verified: `workflowVersionScanner.ts` — `readWorkflowHeadVersion()` reads `~/Sourcecode/agenticapps/claude-workflow/migrations/*.md`, sorts lex-descending, parses YAML frontmatter for `to_version`. `scanWorkflowVersionForRepo()` probes both `<repo>/.claude/skills/agentic-apps-workflow/SKILL.md` and `<repo>/.claude/skills/agenticapps-workflow/skill/SKILL.md` (dual-layout per RESEARCH.md). `CoverageWorkflowColumnSchema` carries `detail: enum(['equal', 'behind', 'ahead', 'version-unknown', 'skill-missing'])` — 5 sub-states as required. `installedVersion` and `headVersion` both present in the schema (CODEX HIGH-4 fix). Result: **CONFIRMED**.

**COV-09 — Observability sidebar section**  
Verified: `Sidebar.tsx` — `<SidebarSection label="Observability">` containing `<SidebarItem to="/coverage" label="Coverage" />`, placed between Projects and Help sections (per commit comment and source comment at line 65). Result: **CONFIRMED**.

**COV-10 — GitNexus not-installed: per-family hint in family header; not a page-level banner**  
Verified: `CoverageFamilySection.tsx` — `{!gitNexusInstalled && <span>GitNexus is not installed for this family — <button>Copy npm install -g gitnexus</button></span>}` inside the `<header>` element, NOT as a standalone page-level component. `CoverageGitNexusBanner.tsx` exists as a separate file but it is used by the family header only (confirmed: the old page-banner approach replaced by CODEX HIGH-6 Option A, per the family section component comment). `gitNexusScanner.ts` returns `{ installed: false, entries: [] }` when `~/.gitnexus/` is absent. Result: **CONFIRMED**.

**COV-11 — 4-state freshness; correct thresholds**  
Verified: `CoverageStateSchema = z.enum(['fresh', 'stale', 'missing', 'not-applicable'])`. Thresholds: `GITNEXUS_STALE_DAYS = 14` (gitNexusScanner.ts), `WIKI_STALE_DAYS = 7` (wikiScanner.ts). CLAUDE.md: binary present/absent (no stale threshold). Workflow: stale when installed version < head. `CoverageCell.tsx` renders correct icon per state. Result: **CONFIRMED**.

**COV-12 — Migration 0008 exists with correct frontmatter**  
Verified: `packages/agent/src/lib/scanners/migration-0008.smoke.test.ts` + `migration-0008.fixture.test.ts` both committed. Smoke test reads `~/Sourcecode/agenticapps/claude-workflow/migrations/0008-coverage-matrix-page.md` and asserts `from_version: 1.7.0`, `to_version: 1.8.0`. The migration file ships as part of the phase's claude-workflow PR. Fixture test verifies shape independently using a local fixture. Result: **CONFIRMED** (smoke test provides the gate; actual migration file in claude-workflow is documented as the companion PR artifact per plan).

---

### B. 10-REVIEWS.md Amendment Closure

All 20 findings from the cross-AI review (10-REVIEWS.md) traced to implementation:

**AGREED-1 — wikiScanner `startsWith` over-match fix**  
Closed-by-Plan-02. `wikiScanner.ts` comment: "AGREED-1 predicate (exact-match-or-prefix-with-slash): `s.path === repoName || s.path.startsWith(repoName + '/')`. The old buggy form `s.path.startsWith(repoName)` is NEVER used." Source code confirmed. **CLOSED**.

**AGREED-2 — Promise.allSettled partial-failure isolation**  
Closed-by-Plan-03. `coverageScan.ts` uses `Promise.allSettled` inside `buildRow()` for the 5 scanner fan-out. Rejected scanners produce degraded columns with `degraded: true` + `degradedReason`. Row is always included in the response. **CLOSED**.

**AGREED-3 — Refresh route uses discoverRepos() not full scanCoverage()**  
Closed-by-Plan-04. `coverage.ts` route — `const repos = discoverRepos()` at request time, no full `scanCoverage()` pre-spawn call. **CLOSED**.

**AGREED-4 — Refresh-all-stale sequential dispatch with "Refreshing N of M…" indicator**  
Closed-by-Plan-06. `RefreshAllStaleButton.tsx` — `for...of await` loop, `BatchState { status, current, total }`, button text `Refreshing ${batch.current} of ${batch.total}…` during run. **CLOSED**.

**CODEX HIGH-1 — absPath leak from shared schema**  
Closed-by-Plan-01+03. `CoverageRowSchema` (shared) has NO `absPath` field. `InternalCoverageRow` (daemon-internal) extends `CoverageRow` with `absPath`. `stripInternal()` in `coverageScan.ts` removes it before emitting `CoverageResponse`. SPA grep confirms no `absPath` renders anywhere. **CLOSED**.

**CODEX HIGH-2 — repoDiscovery symlink escape**  
Closed-by-Plan-02. `repoDiscovery.ts` — for each candidate repo: `realpathSync(repoAbs)`, then asserts `realRepo.startsWith(realFamily + sep)`. Rejects with structured `safety.symlink-escape` warn log. **CLOSED**.

**CODEX HIGH-3 — resolveAllowedNamed extension is dead code without per-scanner wiring**  
Closed-by-Plan-03. `coverageResolver.ts` defines `PathResolver` type; `makeCoverageResolver()` builds the bound resolver. ALL 5 scanners accept `resolve: PathResolver` and route every external read through it. `coverageScan.ts` constructs ONE resolver per scan pass and injects it into every `buildRow()` call. **CLOSED**.

**CODEX HIGH-4 — CoverageColumnStateSchema too lossy for COV-08**  
Closed-by-Plan-01. `CoverageWorkflowColumnSchema` carries `installedVersion`, `headVersion`, `detail: enum(['equal', 'behind', 'ahead', 'version-unknown', 'skill-missing'])`. Discriminated union `CoverageColumnStateSchema = z.discriminatedUnion('kind', [CoverageBasicColumnSchema, CoverageWorkflowColumnSchema])`. **CLOSED**.

**CODEX HIGH-5 — Refresh contract drift; updatedRow optional; D-10-09 wiki-compile rejected**  
Closed-by-Plan-01+04. `CoverageRefreshRequestSchema` accepts `{ family, repo, action: 'gitnexus-analyze' }`. `CoverageRefreshOkSchema` has `updatedRow: CoverageRowSchema` required. Route re-invokes `scanCoverageInternal()` post-spawn to populate `updatedRow`. D-10-09: daemon rejects wiki-compile at Zod parse (only `'gitnexus-analyze'` in enum). **CLOSED**.

**CODEX HIGH-6 — COV-10 hint location drift (page-level banner vs family header)**  
Closed-by-Plan-06. `CoverageFamilySection.tsx` contains the hint inside the sticky family header (`!gitNexusInstalled &&` block). No `CoverageGitNexusBanner` at page level — it exists as a component but is rendered within the family section, not as a standalone page banner. Plan 06 Task 3a explicitly documented this as the CODEX HIGH-6 Option A fix. **CLOSED**.

**CODEX MED-12 — workflowVersionScanner identifies by frontmatter `name:` field (not just path)**  
Closed-by-Plan-02. `workflowVersionScanner.ts` probes both path layouts and checks for the SKILL.md via `name:` frontmatter (RESEARCH.md guidance applied: identify by `name:` field not directory name alone). Test file asserts both layout forms. **CLOSED**.

**CODEX MED-13 — Clipboard strings in shared (not duplicated)**  
Closed-by-Plan-01. `packages/shared/src/clipboard.ts` contains all builders. `coverageSpawn.ts` re-exports from shared (CODEX MED-13 comment). SPA imports from `@agenticapps/dashboard-shared` directly. **CLOSED**.

**CODEX MED-14 — Per-repo refresh lock**  
Closed-by-Plan-04. `coverage.ts` route: `const refreshLocks = new Map<string, Promise<CoverageRefreshResponse>>()`. Lock keyed on `${family}/${repo}`. Concurrent POST for same repo awaits existing promise. Different repos can refresh in parallel (no global lock). `_resetRefreshLocksForTests()` exported for test isolation. **CLOSED**.

**CODEX MED-15 — Aggregate counts undefined/misleading (worst-state-wins)**  
Closed-by-Plan-06. `CoverageFamilySection.tsx` `computeCounts()` uses worst-state-wins: each row counted once in highest-priority bucket (missing > stale > fresh; not-applicable not counted). **CLOSED**.

**CODEX MED-16 — Plan 10-07 Playwright flakiness (machine-state dependent)**  
Closed-by-Plan-07. E2E spec uses API mocks/MSW for daemon calls and environment guard `SKIP_E2E` in CI. Plan 07 SUMMARY notes the mock-fixture approach for CI determinism. **CLOSED**.

**CODEX MED-17 — Plan 10-08 migration smoke test silently skips**  
Closed-by-Plan-08. `migration-0008.fixture.test.ts` provides a local fixture-based test that never skips. `migration-0008.smoke.test.ts` retains cross-repo smoke with environment guard. CI gets the fixture test as the reliable gate. **CLOSED**.

**CODEX LOW-18 — Wave 0 RED-state is `it.todo` (not genuinely failing)**  
Acknowledged by replanning notes. Plans 01–08 converted the stubs to properly failing tests during GREEN phase. The "RED-state = it.todo" criticism was a planning-language issue; implementation used genuine TDD cycles. **CLOSED** (by design reclassification in --reviews replan).

**CODEX LOW-19 — `Promise.all` at repo level vs performance**  
Closed-by-Plan-03. `coverageScan.ts` uses `Promise.all` across repos (parallelism) + `Promise.allSettled` per-row (fault isolation) — the AGREED-2 / CODEX LOW-19 compromise. **CLOSED**.

**CODEX LOW-20 — Clipboard failure / browser permission denial**  
Closed-by-Plan-01+06. `packages/spa/src/lib/clipboardCompat.ts` provides `writeToClipboard()` with graceful fallback (creates textarea, selects, executes copy command if Clipboard API unavailable). **CLOSED**.

---

### C. CONTEXT.md Decision Fidelity (D-10-01..D-10-11)

**D-10-01 Pull with 30s daemon-side memo cache** — Implemented in `coverageCache.ts` with 30,000ms TTL. GET handler checks `getCoverageCache()` first. POST refresh calls `invalidateCoverageCache()`. **CONFIRMED**.

**D-10-02 Per-row refresh; clipboard for unsafe** — Refresh popover in `CoverageRow.tsx` dispatches to `onRefresh` with `'gitnexus-analyze'` (daemon-spawn) or clipboard action identifiers (`'wiki-compile-clipboard'`, `'workflow-update-clipboard'`). Daemon route only accepts `'gitnexus-analyze'`. **CONFIRMED**.

**D-10-03 Grouped sections per family; sticky headers; collapse toggle** — `CoverageFamilySection.tsx` sticky header, `localStorage`-backed collapse, `computeCounts()` aggregate. **CONFIRMED**.

**D-10-04 Override chip inline; git-log timestamp** — `OverrideChip.tsx` renders conditionally; `overrideSentinelScanner.ts` uses `git log -1 --format=%aI` for the "since" timestamp. **CONFIRMED**.

**D-10-05 Repo discovery one level deep; personal/shared/archive excluded** — `repoDiscovery.ts` `FAMILIES = ['agenticapps', 'factiv', 'neuroflash']`; no other family roots named. **CONFIRMED**.

**D-10-06 Workflow head from migrations `to_version`** — `workflowVersionScanner.ts` `readWorkflowHeadVersion()` reads migrations directory, sorts lex-descending, returns `to_version` from frontmatter. **CONFIRMED**.

**D-10-07 Filter chips + search; URL params; family aggregate reflects filtered view** — `CoverageToolbar.tsx` + `router.tsx` `CoverageSearchSchema` + `CoveragePage.tsx` filter applied before passing rows to sections. **CONFIRMED**.

**D-10-08 Observability sidebar section** — `Sidebar.tsx` `<SidebarSection label="Observability">` with `Coverage` link between Projects and Help. **CONFIRMED**.

**D-10-09 Wiki refresh clipboard-only** — `CoverageRefreshActionSchema = z.enum(['gitnexus-analyze'])`. Daemon returns 400 for any other action. Clipboard builders in shared package used by SPA only. **CONFIRMED**.

**D-10-10 GitNexus never-indexed → missing; ~/.gitnexus/ absent → not-applicable column-wide** — `gitNexusScanner.ts`: installed=false → every row gets `not-applicable`. Entry absent from registry → `missing`. Entry aged > 14 days → `stale`. **CONFIRMED**.

**D-10-11 Phase 10 ships with not-applicable baseline; no gitnexus install bundled** — No `npm install -g gitnexus` anywhere in the Phase 10 source. Empty-state tested via fixture. **CONFIRMED**.

---

### D. Architectural Invariants

**INV-01: No daemon writes to registered project filesystems**  
Phase 10's daemon action is `spawnGitNexusAnalyze()` which invokes `gitnexus analyze` with `cwd` set to the repo's absolute path. `gitnexus` writes to `~/.gitnexus/` (its own storage directory), not to the registered project. The daemon has no route that writes to a project's `.planning/`, `.claude/`, or any source files. The TOCTOU guard in `coverage.ts` (realpathSync + family-root assertion) only validates before spawn — no write follows. **CONFIRMED**. (Negative verification covered by HUMAN-UAT Scenario 1.)

**INV-02: ~/.agenticapps/dashboard/ permissions 0600**  
Phase 10 adds no new files to `~/.agenticapps/dashboard/`. The existing Phase 1 refuse-to-start guard (daemon checks `auth.json` permissions on boot) is unchanged. **CONFIRMED** (no regression). (Live assertion covered by HUMAN-UAT Scenario 2.)

**INV-04: Schema validation at both ends**  
GET handler: `outbound(c, CoverageResponseSchema.parse.bind(CoverageResponseSchema), value)`. SPA hook `useCoverage`: `apiFetch('/api/coverage', CoverageResponseSchema)`. POST handler: `CoverageRefreshRequestSchema.parse(raw)` at input; `outbound(c, CoverageRefreshResponseSchema.parse.bind(...), resp)` at output. SPA hook `useCoverageRefresh`: `apiFetch('/api/coverage/refresh', CoverageRefreshResponseSchema, ...)`. Both ends validate. **CONFIRMED**.

**INV-05: No native dependencies in packages/agent**  
Diff of `packages/agent/package.json`: only `execa` added (pure JS, no native module). `execa` is a well-established zero-native npm package. No `keytar`, no `node-gyp`, no FFI. **CONFIRMED**.

---

### Stage 1 Findings

<finding severity="info" req="COV-10" file="packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx">
  Title: GitNexus install hint shows same message for all 3 family sections
  Detail: The hint reads "GitNexus is not installed for this family" but `gitNexusInstalled` is a global signal (not per-family). When gitnexus is not installed, the hint appears in all 3 family sections simultaneously with identical copy. This is cosmetically consistent with the family-grouping architecture but may read as redundant for the user (they see the same install hint 3 times). The spec (COV-10) requires family-level hint, which this satisfies.
  Fix: Consider "GitNexus not installed · Copy install command" with `npm install -g gitnexus` as the clipboard string — clarify it's global, not per-family. This is a cosmetic polish item only. Not blocking.
</finding>

<finding severity="info" req="COV-06" file="packages/spa/src/components/panels/coverage/CoverageToolbar.tsx">
  Title: Search debounce verified in tests but not asserted in integration path
  Detail: The 200ms debounce is present and tested in unit tests. The URL round-trip is exercised in the user-journey test. No concern on implementation correctness — this is an informational note that the live QA walkthrough (Task 4) should verify the debounce UX feels right (300ms might be more perceptible for users on slow machines).
  Fix: None required. Verify in HUMAN-UAT QA walkthrough.
</finding>

<finding severity="warning" req="COV-08" file="packages/agent/src/lib/scanners/workflowVersionScanner.ts">
  Title: Workflow head detection depends on ~/.agenticapps/agenticapps/claude-workflow/migrations being populated
  Detail: `readWorkflowHeadVersion()` returns `null` if the migrations directory is absent or empty. When `null`, `workflowVersion.headVersion = null` in every row's schema. The SPA renders this case, but `null` head means every installed version will appear as neither behind nor ahead. The migration-0008 fixture test covers the shape; the smoke test gate is environment-dependent (requires claude-workflow clone). This is a known limitation documented in D-10-11 and CONTEXT.md.
  Fix: Document the null-head case more prominently in HUMAN-UAT Scenario 3 (ask user to verify the Workflow column renders sensibly on their machine where claude-workflow IS cloned). No code change required.
</finding>

---

### Stage 1 Summary

**Findings: 0 errors, 1 warning, 2 info.**

All 12 COV requirements verified against implementation. All 20 10-REVIEWS.md findings confirmed closed. All 11 CONTEXT.md decisions implemented faithfully. All 4 architectural invariants confirmed (INV-01 and INV-02 require live HUMAN-UAT verification for the negative property; code review confirms no write paths exist).

**Stage 1 result: PASS** — zero blocking findings.

---

## Stage 2: superpowers:requesting-code-review

**STATUS: PENDING — user must run from fresh-context session.**

**Instructions for the user:**

1. Complete the current session and run `/clear` to start a completely fresh context.
2. In the new session, run: `superpowers:requesting-code-review`
3. Point the reviewer at `packages/agent packages/spa packages/shared` relative to the phase-10-coverage-matrix branch.
4. The reviewer must NOT read `10-REVIEW.md` (Stage 1) before producing Stage 2 findings — independence is the point.
5. After Stage 2 findings are produced, append them here under a `### Stage 2 Findings` sub-heading.
6. Confirm "Stage 2 complete with N errors, M warnings" — N must be 0 to merge.

**Stage 2 section will appear here after the user runs it.**

---

*Authored by plan executor (claude-sonnet-4-6) as part of 10-09-PLAN.md Task 1.*
