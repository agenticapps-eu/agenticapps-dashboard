---
phase: 10
slug: coverage-matrix-page
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 10 — Validation Strategy

> Per-phase validation contract derived from `10-RESEARCH.md § Validation Architecture` (lines 860–911). Maps every COV-01..COV-12 + inherited invariants INV-01..INV-05 to a vitest command or a manual UAT step.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (workspace catalog version; SPA also runs Playwright e2e) |
| **Config files** | `packages/agent/vitest.config.ts`, `packages/spa/vitest.config.ts`, `packages/spa/vitest.subprocess.config.ts`, `packages/spa/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @agenticapps/dashboard-agent test` (per-package, ~30s) |
| **Full suite command** | `pnpm -r test` (~3-4min — 1160+ tests workspace-wide; pre-Phase 10 baseline) |
| **Playwright e2e** | `pnpm --filter @agenticapps/dashboard-spa exec playwright test e2e/coverage.spec.ts` (~20-30s; Wave 5 only) |
| **Estimated full runtime post-Phase-10** | ~4-5min (Wave-0 adds ~150 unit tests + 1 e2e spec) |

---

## Sampling Rate

- **After every task commit:** Run quick command for the affected package (`pnpm --filter <pkg> test -- <touched-files-globs>`)
- **After every plan wave:** Run package-scoped suites (`pnpm --filter @agenticapps/dashboard-{agent,spa,shared} test`)
- **Before `/gsd-verify-work`:** Full suite `pnpm -r test` must be green
- **Max feedback latency:** 30s for per-task, 90s for per-package, 4min for full

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | Wave-0 File | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| COV-01 | `GET /api/coverage` returns 4-column matrix + override count + per-row freshness; both daemon and SPA Zod-parse it | integration | `pnpm --filter dashboard-agent test -- coverage.route.test.ts` | ✅ W0 | ⬜ pending |
| COV-02 | `resolveAllowedNamed` rejects `..`, absolute paths outside the 4 new allowed roots, and symlink-escapes | unit | `pnpm --filter dashboard-agent test -- paths.test.ts` (new cases for `~/.gitnexus`, `~/Sourcecode/<3 families>` roots) | ✅ W0 (extends Phase 5 test) | ⬜ pending |
| COV-02b | `GET /api/projects/:id/read` still rejects external paths (regression: don't widen old route) | unit | grep `'/api/projects/.*/read'` test assertions for new external roots = 0 hits | ✅ W0 | ⬜ pending |
| COV-03 | Memo cache: first call computes; second call within 30s returns same instance; `POST /coverage/refresh` clears cache | unit | `pnpm --filter dashboard-agent test -- coverageCache.test.ts` (3 cases: hit-within-ttl, miss-after-ttl, invalidate-on-refresh) | ✅ W0 | ⬜ pending |
| COV-04 | `POST /coverage/refresh` spawns `gitnexus analyze` when action='gitnexus-analyze' and binary on PATH; returns clipboard-string for wiki/CLAUDE.md/workflow-update actions; never executes `npx <pkg>` | unit | `pnpm --filter dashboard-agent test -- coverageSpawn.test.ts` (5 cases: spawn-gitnexus, clipboard-wiki, clipboard-claudemd, clipboard-workflow, fail-when-gitnexus-not-on-PATH) | ✅ W0 | ⬜ pending |
| COV-05 | `<CoverageFamilySection>` renders sticky header with filter-aware aggregate counts; collapse state persists in localStorage | component | `pnpm --filter dashboard-spa test -- CoverageFamilySection.test.tsx` | ✅ W0 | ⬜ pending |
| COV-06 | Toolbar: chip multi-select with "all" default; toggling another deselects "all"; toggling all four reverts to "all"; search debounce 200ms; URL `?status=stale&q=...` round-trips | component | `pnpm --filter dashboard-spa test -- CoverageToolbar.test.tsx` (multi-select + search + URL sync) | ✅ W0 | ⬜ pending |
| COV-07 | Override chip renders only when count>0; click expands list with phase slugs + ISO dates from `git log` | component + unit | spa: `OverrideChip.test.tsx`; agent: `overrideSentinelScanner.test.ts` (asserts git-log timestamp shape, handles zero-sentinels case) | ✅ W0 | ⬜ pending |
| COV-08 | workflowVersionScanner reads highest migration's `to_version`; compares against installed `version` from SKILL.md frontmatter; handles 5 cases: equal/behind/ahead/missing-skill/missing-version | unit | `pnpm --filter dashboard-agent test -- workflowVersionScanner.test.ts` (5 cases enumerated) + skill-directory probe (both `agentic-apps-workflow/SKILL.md` AND `agenticapps-workflow/skill/SKILL.md` layouts) | ✅ W0 | ⬜ pending |
| COV-09 | Sidebar renders new `Observability` section with `Coverage` link between Projects and Help; entry has correct `to`, `label`, `icon` | component | `pnpm --filter dashboard-spa test -- Sidebar.test.tsx` (text-order assertion + entry shape) | EDIT existing test | ⬜ pending |
| COV-10 | When `~/.gitnexus/` absent, scanner returns `not-applicable` for every row + global "Not installed" signal; SPA renders banner with copy-install-command button | integration + component | agent: `gitNexusScanner.test.ts` (HOME=tmpdir without `.gitnexus`); spa: `CoverageGitNexusBanner.test.tsx` | ✅ W0 | ⬜ pending |
| COV-11 | 4 states render with correct icon + color tokens per state (fresh=green✓, stale=amber⚠, missing=red✕, not-applicable=gray⚪) | component (snapshot or DOM assertion) | `pnpm --filter dashboard-spa test -- CoverageCell.test.tsx` (4 cases × 4 columns = 16 assertions) | ✅ W0 | ⬜ pending |
| COV-12 | Migration `0008-coverage-matrix-page.md` exists at expected path with valid YAML frontmatter (`id: 0008`, `from_version: 1.7.0`, `to_version: 1.8.0`); verify script can `jq 'length'` registry.json | smoke | dashboard-agent: `migration-0008.smoke.test.ts` (reads migration file, parses frontmatter, asserts version semantics + jq-correctness comment) | ✅ W0 | ⬜ pending |
| INV-01 | No daemon route writes to a registered project — `git diff --stat` after coverage scan + refresh shows no source changes | manual (UAT) | Recorded in `10-HUMAN-UAT.md` step 1 | — | ⬜ pending |
| INV-02 | `~/.agenticapps/dashboard/` files remain mode 0600 post-deploy | inherited smoke | existing daemon refuse-to-start guard (Phase 1) covers this | inherited | ⬜ pending |
| INV-03 | Page renders fully when GitNexus + wiki + sentinels all absent (this dev machine's default state) | component | `CoveragePage.test.tsx` empty-state branch + `/coverage` Playwright smoke on dev machine | ✅ W0 | ⬜ pending |
| INV-04 | Schema drift triggers `<SchemaDriftState>` per panel | unit | `coverageQueries.test.ts` mock-drift case | ✅ W0 | ⬜ pending |
| INV-05 | No native dependencies in `packages/agent` (no keytar, no FFI) | grep | `git diff` of `packages/agent/package.json` shows no native deps added | manual sanity-check | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `packages/shared/src/schemas/coverage.ts` — Zod schemas (`CoverageRowSchema`, `CoverageResponseSchema`, `CoverageRefreshRequestSchema`, `CoverageRefreshResponseSchema`) + 8-12 unit tests
- [ ] `packages/agent/src/lib/scanners/*.test.ts` — 5 scanner test files (claudeMd, gitNexus, wiki, workflowVersion, overrideSentinel)
- [ ] `packages/agent/src/lib/coverageScan.test.ts` — orchestrator with all 5 scanners
- [ ] `packages/agent/src/lib/coverageCache.test.ts` — 30s memo
- [ ] `packages/agent/src/lib/coverageSpawn.test.ts` — gitnexus spawn + clipboard string returners
- [ ] `packages/agent/src/lib/repoDiscovery.test.ts` — walks 3 family roots one level deep, returns `{family, repo, absPath}[]`
- [ ] `packages/agent/src/lib/paths.test.ts` — extend with 4 new allowed roots (additive to Phase 5 tests)
- [ ] `packages/agent/src/routes/coverage.test.ts` — route integration: `GET /api/coverage` happy + 500 + auth + CORS; `POST /coverage/refresh` 4 action shapes
- [ ] `packages/agent/test/migration-0008.smoke.test.ts` — reads `claude-workflow/migrations/0008-coverage-matrix-page.md`, asserts frontmatter
- [ ] `packages/spa/src/components/panels/coverage/*.test.tsx` — 8 component test files (CoveragePage, CoverageToolbar, CoverageGitNexusBanner, CoverageFamilySection, CoverageRow, CoverageCell, OverrideChip, CoverageEmptyState)
- [ ] `packages/spa/src/lib/coverageQueries.test.ts` — `useCoverage` + `useCoverageRefresh` (cache-key isolation, drift handling)
- [ ] `packages/spa/e2e/coverage.spec.ts` — single Playwright spec covering: cold-load → filter chip → search → override chip expand → refresh popover open+dismiss → keyboard navigation
- [ ] `packages/spa/src/components/ui/Sidebar.test.tsx` — extend with Observability section assertion

*Existing infrastructure (vitest, Playwright, fixture helpers) covers all phase requirements. Wave 0 only adds test files specific to coverage.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Daemon never writes to project filesystems during coverage scan or refresh | INV-01 | Filesystem-write absence is a negative property; full audit requires watching the FS during scan + refresh | (1) Stage a clean checkout of a registered project. (2) Open /coverage in dashboard. (3) Click refresh-all-stale. (4) Run `git status` in each touched project root. (5) Confirm 0 changes. Document in 10-HUMAN-UAT.md. |
| `~/.agenticapps/dashboard/` permissions remain 0600 after Phase 10 deploys | INV-02 | File-mode inheritance not directly observable from a unit test | Run `stat -f %p ~/.agenticapps/dashboard/*` and confirm last 3 digits = 600. Document in 10-HUMAN-UAT.md. |
| Visual coherence of /coverage against the locked tokens.css at lg breakpoint | UI-SPEC §4 | Requires impeccable critique + visual eyeballing | Run `npx impeccable detect --route /coverage --viewport 1440x900` and capture screenshot to refs/. Document score + screenshot path in 10-HUMAN-UAT.md. Gate: ≥ 90 composite. |
| Override chip "since" timestamp reflects the actual git commit, not the file mtime | COV-07 | Requires creating a sentinel + committing it + verifying the chip date matches `git log -1 --format=%aI` | (1) `touch <some-repo>/.planning/current-phase/multi-ai-review-skipped`. (2) `git add` + commit with a known date. (3) Reload /coverage. (4) Expand the chip. (5) Confirm the date matches the commit, not the file mtime. Document in 10-HUMAN-UAT.md. |
| Refresh-all-stale serialization (no concurrent index writes) | D-10-02 | Timing-sensitive; subprocess monitoring | Index 3 repos. Click refresh-all. Watch `~/.gitnexus/` mtimes — one at a time, not all at once. Document in 10-HUMAN-UAT.md. |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependency listed above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (planner enforces)
- [ ] Wave 0 covers all MISSING references (test files listed above)
- [ ] No watch-mode flags in any test command
- [ ] Feedback latency < 90s per package, < 4min full suite
- [ ] `nyquist_compliant: true` set in frontmatter after Wave-0 plans land

**Approval:** pending (planner produces concrete task IDs that reference these test files)
