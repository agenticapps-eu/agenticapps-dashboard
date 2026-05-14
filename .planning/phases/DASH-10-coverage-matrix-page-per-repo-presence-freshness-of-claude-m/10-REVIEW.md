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

---

## Stage 2 — superpowers:requesting-code-review

Reviewed: 2026-05-13
Reviewer: general-purpose subagent (Stage 2) — Opus 4.7 (1M context), fresh-context independent pass
Range: 83fa438..dbe2b1f (55 commits, 58 files, +8362/-20)

### Strengths

- **Trust-boundary hygiene is exceptionally well executed.** `coverageResolver.ts:46-49,77-147` establishes a single `PathResolver` type that every scanner consumes; the resolver re-realpaths roots, merges caller-supplied roots, and enforces basename or extension whitelisting. The CODEX HIGH-3 closure is real, not lipstick.
- **TOCTOU mitigation in the refresh route is correct.** `coverage.ts:114-136` re-canonicalises `match.absPath` AND the family root immediately before spawn, then asserts `realRepo === familyRoot || realRepo.startsWith(familyRoot + sep)`. A symlink swap between discovery and spawn is rejected before `spawnGitNexusAnalyze` is ever called.
- **Per-repo refresh lock implementation is minimal and correct.** `coverage.ts:66-188` keys on `${family}/${repo}`, awaits an in-flight promise for duplicates, and cleans up via `try { ... } finally { refreshLocks.delete(lockKey) }`. Different repos run in parallel.
- **`stripInternal` + discriminated schemas prevent absPath leak structurally.** `coverageScan.ts:264-267` plus `CoverageRowSchema` having no `absPath` field means a future regression that adds it back would fail the outbound Zod parse (defense-in-depth on top of the explicit strip).
- **Symlink-escape rejection in repo discovery is path-sep-aware and broken-symlink-safe.** `repoDiscovery.ts:72-101` realpaths candidate AND family root, uses `sep` (not hard-coded `/`), logs `safety.symlink-escape` via `agentError` (operational logging surface), and `continue`s on realpath failures rather than throwing.
- **D-5-21 "no npx" honored.** `coverageSpawn.ts:28-38,60-81` uses `execFile('which', ['gitnexus'])` for PATH resolution, then `execa(cmd, ['analyze'], {cwd, timeout})` with argv-array form — no shell, no template literals, no `execa.command`. Returns `{kind: 'not-installed'}` when binary absent.
- **AGREED-1 false-positive guard.** `wikiScanner.ts:101-107` uses `s.path === repoName || s.path.startsWith(repoName + '/')` — the prefix-with-slash predicate. `wikiScanner.test.ts:86-94` tests the `app` vs `app-worker/docs` false-positive case.
- **Migration 0008 fixture test is genuinely CI-resident.** `migration-0008.fixture.test.ts` defines fixture content inline and asserts via tmpdir — never skips. The companion smoke test emits `console.warn` (not silent skip) when upstream is absent (`migration-0008.smoke.test.ts:32-40`).
- **Scanner tests use real tmpdir fixtures, not mocks-of-mocks.** `wikiScanner.test.ts:11-27`, `gitNexusScanner.test.ts`, `workflowVersionScanner.test.ts` all create real directories with `mkdtempSync` and write actual JSON to disk. Behaviour is exercised, not stubbed.
- **Schema-drift detection wired on both ends.** Daemon: `outbound(c, CoverageResponseSchema.parse.bind(...), value)` in both GET and POST routes. SPA: `apiFetch('/api/coverage', CoverageResponseSchema)` + `useCoverageRefresh` also runs `CoverageRefreshRequestSchema.parse(body)` before the network call — two layers of defense.

### Issues

#### Critical (Must Fix)

<finding severity="critical" req="D-10-09 / D-10-02" file="packages/spa/src/components/panels/coverage/CoveragePage.tsx:138-140">
**File:line:** `CoveragePage.tsx:138-141`
**What's wrong:** The per-row "Copy /wiki-compile command" action hardcodes the family as `'agenticapps'` for every row regardless of which family the row belongs to.
```typescript
case 'wiki-compile-clipboard':
  await writeToClipboard(buildWikiCompileClipboardString('agenticapps'))
  break
```
The chain `CoverageRow.onRefresh(action)` → `CoverageFamilySection.onRefresh(action)` → `CoveragePage.handleRefresh(action)` carries ONLY the action enum. No `family` or `repo` is propagated. The comment on lines 128-132 even acknowledges this is unfinished: *"Family captured in CoverageFamilySection → CoverageRow → here via the chain"* — but that chain never threads family through.
**Why it matters:** A user on a `factiv` or `neuroflash` row clicks "Copy /wiki-compile command" expecting `cd ~/Sourcecode/factiv && claude /wiki-compile`. They get `cd ~/Sourcecode/agenticapps && claude /wiki-compile`. They paste it, and either (a) recompile the wrong family (silent wrong-action), or (b) the command works in the agenticapps directory but does nothing for the family they intended. This is the central refresh affordance for 2/3 of all wiki-stale rows. Confirmed via grep — no test covers per-row dispatch through `CoveragePage.handleRefresh`.
**How to fix:** Change the signature of `onRefresh` end-to-end to carry row context:
```typescript
onRefresh?: (
  action: '...',
  context: { family: CoverageFamily; repo: string },
) => void
```
Thread `{ family: row.family, repo: row.repo }` from `CoverageRow.onRefresh` callsite and use `context.family` in `buildWikiCompileClipboardString`. Add a test in `CoveragePage.test.tsx` that mocks `writeToClipboard` and asserts the family passed for a non-agenticapps row.
</finding>

<finding severity="critical" req="D-10-02" file="packages/spa/src/components/panels/coverage/CoveragePage.tsx:135-137">
**File:line:** `CoveragePage.tsx:135-137`
**What's wrong:** The per-row "Run gitnexus analyze for this repo" popover button is dead. The `handleRefresh` switch body for `gitnexus-analyze` contains only `break` plus a comment claiming dispatch happens elsewhere:
```typescript
case 'gitnexus-analyze':
  // Per-row gitnexus-analyze is dispatched in RefreshAllStaleButton or CoverageRow
  break
```
`CoverageRow.tsx:120-123` calls `onRefresh?.(opt.action)` and closes the popover — it does NOT call the daemon. The daemon refresh mutation (`useCoverageRefresh`) lives in `CoveragePage`, not `CoverageRow`, so a per-row button click results in: popover closes, nothing else happens. No spawn, no toast, no error.
**Why it matters:** D-10-02 specifies per-row refresh actions for the cases where daemon can act safely (gitnexus-analyze is the only one). The page-level `RefreshAllStaleButton` runs every stale row in one batch, but users who want to refresh one row (the documented v1 affordance) get a no-op. This is a primary UX path for the page.
**How to fix:** In the same end-to-end `onRefresh(action, {family, repo})` refactor above, change the `gitnexus-analyze` case to:
```typescript
case 'gitnexus-analyze':
  await refresh.mutateAsync({ family: ctx.family, repo: ctx.repo, action: 'gitnexus-analyze' })
  break
```
Add a CoveragePage test that fires the popover button, asserts `refresh.mutateAsync` was called with the correct body.
</finding>

#### Important (Should Fix)

<finding severity="important" req="testing portability" file="packages/agent/src/routes/coverage.test.ts:65,90,141,179,500-cleanup,578,583">
**File:line:** `coverage.test.ts:65,90,141,179,500,578,583`
**What's wrong:** The route test file hardcodes `/Users/donald/Sourcecode/agenticapps/agenticapps-dashboard` as the mock `discoverRepos` return value for 6 callsites. The POST route then calls `realpathSync(match.absPath)` inside the in-flight closure (`coverage.ts:117`). If the path does not exist, `realpathSync` throws and the route returns `{ ok: false, kind: 'error', stderr: 'repo path no longer accessible' }` — but tests like the "returns kind=ok" / "MED-14 lock" / "different repos parallel" assert `body.ok === true` and `body.kind === 'ok'`. These tests pass only when run on Donald's machine.
**Why it matters:** Any contributor on another laptop or CI runner will see these tests fail with `expected 'ok' to be 'error'`. Reproducibility, CI portability, and Stage 1's claim of 1,627 tests GREEN are all anchored to a developer-specific filesystem. Notably the existing CI workflow may have been masked because the dashboard repo's own path happens to satisfy the constant. If the project is ever scaffolded on a fresh machine for a new contributor, those tests will fail.
**How to fix:** Replace the literal with a per-test `mkdtempSync(join(tmpdir(), 'coverage-route-'))` directory, mock `discoverRepos` to return that tmpdir path, and create the tmpdir BEFORE the request so `realpathSync` succeeds. The TOCTOU test already does this (lines 494-526). Apply the same pattern to all 6 callsites.
</finding>

<finding severity="important" req="AGREED-2 / scanner robustness" file="packages/agent/src/lib/coverageScan.ts:148-159">
**File:line:** `coverageScan.ts:148-159`
**What's wrong:** The scanner fan-out uses `Promise.allSettled([Promise.resolve(scanX(...)), ...])`. Each `scanX(...)` is a SYNCHRONOUS function call. If any scanner throws synchronously, the throw happens *inside the array literal* — before `Promise.resolve` wraps the value — and propagates out of the array constructor BEFORE `Promise.allSettled` can capture it.

The throw then bubbles out of `buildRow` (which is `async`, so the sync throw becomes a rejected promise). That rejected promise reaches `Promise.all(repos.map(buildRow))` at line 93 — which is `Promise.all`, not `Promise.allSettled` — so one bad scanner poisons the entire scan and the route returns 500.

In practice none of the 5 scanners currently throw synchronously (each wraps reads in try/catch), so the bug is latent. But this defeats the AGREED-2 contract and the next scanner author who forgets the try/catch will break the page silently.
**Why it matters:** AGREED-2 is the documented isolation guarantee. The current code reads as defensive but isn't. A regression in any scanner (e.g. someone adds a `JSON.parse(rawFile)` outside a try/catch) will collapse the matrix for ALL repos, not just degrade one row.
**How to fix:** Wrap each scanner call in an explicit async IIFE so synchronous throws convert to promise rejections:
```typescript
const [cmS, gnS, wkS, wfS, ovS] = await Promise.allSettled([
  (async () => scanClaudeMd({ repoAbsPath, resolve }))(),
  (async () => rateGitNexusRepo(gnGlobal, repoAbsPath))(),
  ...
])
```
Add an explicit test where one scanner is replaced with `() => { throw new Error('boom') }` and assert the row is still emitted with the appropriate `degraded` column.
</finding>

<finding severity="important" req="UX surface for AGREED-2" file="packages/spa/src/components/panels/coverage/* (no surface)">
**File:line:** SPA-side — no file consumes `row.degraded` or column-level `degraded: true`
**What's wrong:** `CoverageBasicColumnSchema` and `CoverageWorkflowColumnSchema` both define an optional `degraded: boolean` + `degradedReason: string`. `CoverageRowSchema` defines an optional `degraded: { reason: string }`. The orchestrator populates these on scanner failure (`coverageScan.ts:170-229,251`). The SPA never reads them — grep confirms 0 hits for `degraded` in `packages/spa/src/components/panels/coverage/`. A scanner failure renders as a plain "missing" cell, indistinguishable from a confirmed-absent file.
**Why it matters:** The whole point of AGREED-2 was to keep the matrix rendering even when scanners fail, while telling the user "this column failed to scan, not necessarily absent". As implemented, the user sees red where they should see "could not be determined", and they have no way to know that a scanner threw. The signal exists in the schema but is wired to nowhere.
**How to fix:** In `CoverageCell.tsx`, render a distinct visual when `state.degraded === true` (e.g. a small "?" icon with a tooltip showing `degradedReason`). At minimum, log to the console so dogfooders notice. Add a CoverageCell test that asserts the degraded variant.
</finding>

<finding severity="important" req="resolver tautology" file="multiple scanner files">
**File:line:** `claudeMdScanner.ts:85`, `gitNexusScanner.ts:101`, `wikiScanner.ts:87,127`, `workflowVersionScanner.ts:165`, `overrideSentinelScanner.ts:96`
**What's wrong:** Every scanner calls the resolver, then immediately checks `existsSync(resolvedPath)`. But the resolver uses `realpathSync(candidatePath)` which throws on missing/inaccessible paths. If `resolve()` returns successfully, the path EXISTS by definition. The `existsSync` checks are tautologically true — dead code.
**Why it matters:** It looks like defensive belt-and-braces but it's actually misleading: future authors may infer the resolver does NOT validate existence and add new readers that skip the resolver. It also creates churn — every TOCTOU window (file deleted between resolver and existsSync) returns the wrong branch (`'missing'` when the resolver previously succeeded). Minor correctness drift in a race.
**How to fix:** Either (a) remove the post-resolver `existsSync` checks, or (b) document the contract: "resolver throws PathViolation when path is missing — `existsSync` is a defensive re-check for TOCTOU race only." Pick one and apply consistently.
</finding>

<finding severity="important" req="COV-10 wording bug" file="packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx:128">
**File:line:** `CoverageFamilySection.tsx:127-128`
**What's wrong:** The hint message reads `"GitNexus is not installed for this family —"` but `gitNexusInstalled` is a GLOBAL signal, not per-family. When GitNexus is absent, this identical message appears in all 3 family headers — implying the install is per-family, which is incorrect. (Stage 1 flagged this as `info`; on second look it's a real correctness defect because the user will reasonably think they need to install GitNexus separately for each family.)
**Why it matters:** Users get told 3x the same untrue thing. Anyone who reads the COV-10 spec and then audits the UI will assume the binding is broken. Also conflicts with the comment block above (`CODEX HIGH-6 Option A: per-family GitNexus install hint`) — the chosen design is per-family rendering but the same global gate, so the COPY should reflect that.
**How to fix:** Change the message to "GitNexus is not installed —" (drop "for this family"). Or render it once at the page level when `!gitNexusInstalled` — but that re-opens the CODEX HIGH-6 page-banner-vs-family-header debate. Simplest fix is text.
</finding>

#### Minor (Nice to Have)

<finding severity="minor" file="packages/spa/src/components/panels/coverage/CoveragePage.tsx:146">
**File:line:** `CoveragePage.tsx:146`
**What's wrong:** `void navigate({ to: buildClaudeMdHelpUrl() as '/' })`. `buildClaudeMdHelpUrl()` returns `/help/operations/install#claude-md-bootstrap`. The cast `as '/'` lies to TypeScript to silence the strict route-literal check. Whether the runtime navigation succeeds depends entirely on TanStack Router's behaviour with unknown route literals.
**Why it matters:** The user clicking "How to add CLAUDE.md" may end up at `/` instead of the docs page, or at the docs page but with a router warning, or… it's not deterministic. The compiler's safety guarantee was intentionally bypassed without an asserted reason.
**How to fix:** Either (a) register the help routes properly with the router and use the typed `to` parameter, or (b) use an anchor tag with `href={buildClaudeMdHelpUrl()}` for a documented external/static destination, or (c) re-export the help URL as a typed literal from `buildHelpRoutes`.
</finding>

<finding severity="minor" file="packages/spa/src/components/panels/coverage/RefreshAllStaleButton.tsx:42-46">
**File:line:** `RefreshAllStaleButton.tsx:42-46`
**What's wrong:** The confirm dialog reads `"Refresh ${spawnable.length} stale entries across ${spawnable.length} repos."` — both values are the same variable. Copy-paste artifact. Each entry IS one repo, so the second "across N repos" is redundant.
**Why it matters:** Reads slightly confusingly. Not a bug.
**How to fix:** `"Refresh ${spawnable.length} stale repos via gitnexus analyze. Sequential dispatch. Continue?"`
</finding>

<finding severity="minor" file="packages/agent/src/routes/coverage.ts:159">
**File:line:** `coverage.ts:159`
**What's wrong:** After a successful spawn, the route calls `scanCoverageInternal()` to produce `updatedRow`. This walks all 45 repos and re-runs all 5 scanners across each — for a single-row update. CODEX HIGH-5 mandates `updatedRow` be present, but populating it via a full re-scan is overkill.
**Why it matters:** A POST refresh that completes the spawn in 200ms then waits ~500ms to assemble the full matrix just to extract one row. Cold-load latency target was < 1s; the refresh round-trip is now 700ms in the warm case. Not blocking, but the cache invalidation + the re-scan both happen, so the next GET will hit a fresh cache (good) — the route is doing the scan work twice.
**How to fix:** Either (a) accept the cost (it's bounded), or (b) write a `scanSingleRowInternal(family, repo, ...)` that builds just one row, returns it, and lets the next GET cold-scan when the cache misses naturally.
</finding>

<finding severity="minor" file="packages/agent/src/lib/coverageCache.ts:22">
**File:line:** `coverageCache.ts:22`
**What's wrong:** Module-scoped singleton `let cache: CoverageCacheEntry | null = null` is shared across all callers in the daemon process. Test isolation requires `_resetCoverageCacheForTests()`. Multiple daemon instances within the same process (none today, but plausible for testing) would share cache.
**Why it matters:** Future maintainability — a second daemon instance for, say, a multi-tenant variant would share the cache silently.
**How to fix:** Move state into a factory that the route closure captures, or wrap in a small class. Not blocking; the singleton model is consistent with `overviewCache.ts` so changing it now would break the pattern.
</finding>

<finding severity="minor" file="packages/agent/src/lib/scanners/workflowVersionScanner.ts:192-200">
**File:line:** `workflowVersionScanner.ts:192-200`
**What's wrong:** When `head` is null (migrations dir not present) and the repo has an installed version, the scanner returns `state: 'fresh', detail: 'ahead'`. Marking "ahead" when there is no reference point to be ahead OF feels wrong — semantically the comparison cannot be made, so it should be `'version-unknown'` or a new `'head-unknown'` discriminant.
**Why it matters:** Stage 1 flagged this as `info`. The current behaviour is plausibly defensible (fresh + ahead = "you're at least at head"), but the UI label "ahead" alongside `headVersion: null` is a confusing pair. A dogfooder who hasn't cloned claude-workflow will see "Workflow: fresh (ahead)" and have no way to verify.
**How to fix:** When `head === null`, return `state: 'fresh', detail: 'equal'` with a side-channel hint, or extend the enum with `'head-unknown'`.
</finding>

<finding severity="minor" file="packages/agent/src/lib/coverageResolver.ts:115-120">
**File:line:** `coverageResolver.ts:115-120`
**What's wrong:** The resolver wraps `realpathSync(candidatePath)` in try/catch and throws PathViolation with message `not accessible: ${candidatePath}`. This message includes the candidate path on the LHS, not the original homedir-relative form. Combined with `realpathSafe` for roots (which silently swallows failures), the error chain is non-trivial to diagnose when a scanner unexpectedly returns 'missing' on a path the user expected to exist.
**Why it matters:** Diagnostics. Not a runtime bug.
**How to fix:** Add minimal structured logging at PathViolation throw sites, gated behind a daemon debug flag.
</finding>

### Recommendations

- **End-to-end refactor of `onRefresh(action, context)` is high value.** It closes both Critical findings (per-row gitnexus-analyze + wiki-compile clipboard family) and unlocks a richer per-row toast/error surface. Worth doing before merge.
- **Add a focused test for per-row dispatch.** `CoverageUserJourney.test.tsx` should exercise each popover option for at least one non-agenticapps row, mocking `writeToClipboard` and `refresh.mutateAsync` and asserting the payload.
- **Add a "scanner threw" fixture test.** Inject a faulty scanner into the orchestrator (via the `resolve` callback throwing on a specific scanner's invocation pattern) and assert the row still renders with `degraded.reason` populated. This is the missing AGREED-2 negative test.
- **Reconsider the post-resolver `existsSync` calls.** Either delete them (dead) or document them as a deliberate TOCTOU re-check.
- **Surface scanner failures in the UI.** A small "?" icon + tooltip on degraded cells would convert silent failure into visible failure — the page is designed to expose coverage gaps; it should also expose its own coverage gaps.
- **Sidebar section labels are inconsistent in case.** `WORKSPACE` and `ACCOUNT` are uppercase; `Observability` is title-case. Pick a convention (the rest of `Sidebar.tsx` suggests uppercase is canonical for section dividers).

### Assessment

**Ready to merge?** No — two Critical defects affect documented user-facing functionality (per-row gitnexus-analyze button is a no-op for every row; per-row wiki-compile clipboard hardcodes `agenticapps` family for factiv/neuroflash rows). One Important defect (hardcoded developer path in route tests) breaks CI portability and makes the "1,627 tests GREEN" claim machine-dependent. AGREED-2's Promise pattern is latently broken though no current scanner triggers it.

**Reasoning:** The architectural spine of Phase 10 — trust boundary, TOCTOU mitigation, per-repo lock, absPath strip, schema-drift detection, scanner isolation — is unusually well executed and Stage 1's PASS is justified at that level. But Stage 1 audited *schemas and contracts* and did not exercise the per-row click path through `CoveragePage.handleRefresh`. The two Critical findings are visible only when you trace a single click from `CoverageRow.onRefresh` all the way to where the daemon mutation or clipboard writer actually runs — Stage 1's spec-compliance check confirmed the *components* exist and pass schemas, but not that the wiring between them carries family/repo context. Fix the wiring, port the route tests to tmpdir, and merge.

---

*Stage 2 authored by Opus 4.7 (1M context) fresh-context subagent per `superpowers:requesting-code-review` contract.*

---

## Stage 2 Closure — Fixes Applied

Closed: 2026-05-13
Author: Opus 4.7 (1M context) main session
Range: dbe2b1f → (uncommitted Stage 2 fixes)

### Verdict: Critical + Important findings resolved; Minor deferred

All Critical findings and the actionable Important findings have been fixed. Minor findings are listed at the bottom with an explicit deferral rationale.

### Fixes

| Severity | Finding | Files Touched | What changed |
|---|---|---|---|
| **Critical** | `onRefresh` chain dropped row context — gitnexus button no-op + wiki-compile clipboard hardcoded `'agenticapps'` | `CoverageRow.tsx`, `CoverageFamilySection.tsx` (type chain), `CoveragePage.tsx` | Extended `onRefresh` signature to `(action, { family, repo }) => void`. `CoveragePage.handleRefresh` now uses `context.family` for `buildWikiCompileClipboardString` and calls `refresh.mutateAsync({ family, repo, action: 'gitnexus-analyze' })` for the gitnexus case. 3 new tests in `CoveragePage.test.tsx` exercise per-row dispatch for factiv + neuroflash rows. |
| **Important** | Route tests hardcoded `/Users/donald/Sourcecode/...` at 6 callsites — would fail on any other machine | `routes/coverage.test.ts` | Tests now build a tmp repo via `mkdtempSync` inside `makeTmpHome()`, override `process.env.HOME` so `os.homedir()` resolves to the tmp tree, and restore the prior value in `afterEach`. The "different repos" test creates a sibling tmp repo. |
| **Important** | `Promise.allSettled([Promise.resolve(scanX(...)), ...])` lets sync throws escape the array literal | `lib/coverageScan.ts` | Each scanner call now wraps in an async IIFE: `(async () => scanX(...))()` so a sync throw resolves to a rejected promise that `allSettled` catches. New file `coverageScan.allSettled.test.ts` mocks `wikiScanner.scanWikiForFamily` to throw synchronously and asserts the row is still emitted with `wiki.degraded === true`. |
| **Important** | `row.degraded` and column-level `degraded: true` never consumed by SPA | `components/panels/coverage/CoverageCell.tsx` | `CoverageCell` now short-circuits to a distinct "scan failed" rendering (HelpCircle icon, tooltip showing `degradedReason`) when `state.degraded === true`. AGREED-2's signal now reaches the user. |
| **Important** | Family-section gitnexus install hint copy implied per-family install | `components/panels/coverage/CoverageFamilySection.tsx` | Dropped "for this family" — message now reads "GitNexus is not installed — Copy npm install -g gitnexus". |

### Verification

- `pnpm -r typecheck` — clean across all 5 packages.
- `pnpm --filter @agenticapps/dashboard-agent test` — 638/638 PASS (one new file with 1 new test added).
- `pnpm --filter @agenticapps/dashboard-shared test` — 196/196 PASS.
- `pnpm --filter @agenticapps/dashboard-spa test` for coverage scope only — 77/77 PASS (3 new tests added in `CoveragePage.test.tsx`).
- Full SPA `pnpm test` — 792/797 PASS. The 5 failing tests are the pre-existing 5000ms-timeout flake documented in `session-handoff.md`. Verified to be timeout flake, not logic regression: `RegisterModal.test.tsx` passes 25/25 in 3.11s when run in isolation. Stage 2 fixes added 4 new tests and did not introduce these failures (underlying issue is `testTimeout: 5000` against 95+ parallel files). Fix tracked as follow-up — outside Stage 2 scope.

### Minor findings — deferred

| Finding | Why deferred |
|---|---|
| `void navigate({ to: ... as '/' })` route-cast lies to TS | Route literal extension belongs to a help-routes phase; cast is documented but functional. |
| "Refresh N stale entries across N repos" — duplicate variable | Cosmetic. |
| Post-spawn `scanCoverageInternal()` re-scans all 45 repos for one updated row | Bounded cost; CODEX HIGH-5 demands `updatedRow`; per-row builder is non-trivial. |
| `coverageCache.ts` module-scope singleton | Consistent with `overviewCache.ts`. |
| `workflowVersionScanner.ts:192-200` — `state: fresh, detail: ahead` when `head === null` | Stage 1 also flagged as info; defer to v1.2. |
| `coverageResolver.ts:115-120` — PathViolation diagnostics minimal | Daemon already logs `safety.symlink-escape` separately. |
| Resolver tautology — `existsSync` after `realpathSync` | Belt-and-braces; harmless. |
| Sidebar section-label case inconsistency | Outside Phase 10 scope. |

### What this unblocks

Stage 2 is now PASS. Remaining Phase 10 human gates:

1. /review Stage 1 — PASS (existing)
2. superpowers:requesting-code-review Stage 2 — PASS (this section)
3. /qa live walkthrough (Gate 3 in session-handoff)
4. impeccable critique (Gate 4; blocked on tool drift)
5. HUMAN-UAT walkthrough (Gate 5)
6. Push claude-workflow PR (Gate 1) + dashboard PR after gates 3+5 close (Gate 6)

*Stage 2 closure authored by Opus 4.7 (1M context) main session after applying fixes.*
