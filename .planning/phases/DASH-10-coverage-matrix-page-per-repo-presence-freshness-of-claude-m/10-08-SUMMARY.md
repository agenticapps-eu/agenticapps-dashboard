---
phase: 10
plan: "08"
subsystem: cross-repo-artefacts+tests+changelog
tags:
  - coverage-matrix
  - workflow-migration
  - adr
  - codex-med-17
  - cross-repo
dependency_graph:
  requires:
    - 10-07 (route wiring + sidebar Observability section)
    - claude-workflow migrations/0007 (base version 1.7.0)
  provides:
    - migration 0008 in claude-workflow (workflow surface bump 1.7.0 → 1.8.0)
    - ADR 0023 in claude-workflow/docs/decisions/ (Phase 10 design rationale)
    - CI-resident fixture test (CODEX MED-17) protecting COV-12
    - Cross-repo smoke test (warns when upstream missing, not silent skip)
    - CHANGELOG.md v1.1 entry
  affects:
    - workflowVersionScanner (reads highest migration's to_version — 0010 remains head)
    - Any plan verifying COV-12 (migration 0008 present + fixture test guards shape)
tech_stack:
  added: []
  patterns:
    - "parseFrontmatter reused for migration frontmatter shape testing (same pattern as workflowVersionScanner)"
    - "it.skipIf(!HAS_UPSTREAM) for cross-repo smoke — visible WARN not silent skip (CODEX MED-17)"
    - "Inline fixture string pattern for CI-resident tests that don't depend on upstream repos"
key_files:
  created:
    - "~/Sourcecode/agenticapps/claude-workflow/migrations/0008-coverage-matrix-page.md (cross-repo, feature branch)"
    - "~/Sourcecode/agenticapps/claude-workflow/docs/decisions/0023-coverage-matrix-page.md (cross-repo, feature branch)"
    - packages/agent/src/lib/scanners/migration-0008.fixture.test.ts
    - packages/agent/src/lib/scanners/migration-0008.smoke.test.ts
    - CHANGELOG.md
  modified: []
decisions:
  - "ADR renumbered 0023 (not 0021 per plan) — 0021 and 0022 were already committed in claude-workflow for vendor-workflow-block and post-process-gsd-section-markers"
  - "Tests placed in src/lib/scanners/ (not packages/agent/test/) — vitest.config.ts include is src/**/*.test.ts; plan's test/ path would not be picked up"
  - "Migration 0008 includes type: workflow-surface field (matches fixture test's expected shape)"
  - "Smoke test jq assertion: asserts jq 'length' present + top-level array note present (not .not.toMatch the bug string — migration legitimately references the old form when documenting the correction)"
  - "Cross-repo branch NOT pushed; user must push feat/migration-0008-coverage-matrix-page and open PR manually"
metrics:
  duration: ~20min
  completed: "2026-05-13"
  tasks_completed: 3
  files_changed: 5
---

# Phase 10 Plan 08: Workflow Artefacts — Migration 0008 + ADR 0023 + Tests + CHANGELOG

Migration 0008 (coverage-matrix workflow surface, 1.7.0→1.8.0) + ADR 0023 authored in claude-workflow; CI-resident fixture test (CODEX MED-17) + cross-repo smoke test + CHANGELOG v1.1 entry in dashboard. COV-12 closed.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Author migration 0008 in claude-workflow (cross-repo) | 7db473f (claude-workflow) | migrations/0008-coverage-matrix-page.md |
| 2 | Author ADR 0023 in claude-workflow (cross-repo) | 56e636c (claude-workflow) | docs/decisions/0023-coverage-matrix-page.md |
| 3a | Add migration-0008 fixture + smoke tests | 7ae41f0 (dashboard) | migration-0008.fixture.test.ts, migration-0008.smoke.test.ts |
| 3b | Add CHANGELOG.md with v1.1 Phase 10 entry | bf45947 (dashboard) | CHANGELOG.md |

## Artefacts Shipped

### claude-workflow (branch: `feat/migration-0008-coverage-matrix-page`)

**Migration 0008** (`~/Sourcecode/agenticapps/claude-workflow/migrations/0008-coverage-matrix-page.md`):
- `id: 0008`, `slug: coverage-matrix-page`, `type: workflow-surface`
- `from_version: 1.7.0`, `to_version: 1.8.0`
- Documents the `/coverage` route as a workflow surface
- Corrects migration 0007's `jq '.repos | length'` bug (registry is top-level array — use `jq 'length'`)
- Documents wiki refresh as clipboard-only in v1 (D-10-09; no headless runner)
- Commit: `7db473f`

**ADR 0023** (`~/Sourcecode/agenticapps/claude-workflow/docs/decisions/0023-coverage-matrix-page.md`):
- `id: 0023` (renumbered from plan's 0021 — 0021/0022 already taken)
- `status: Accepted`, `date: 2026-05-13`, `related: [0018, 0019, 0020]`
- Covers all 11 Phase 10 decisions (D-10-01..D-10-11)
- 4-column scope, family-grouped layout, override chip, refresh semantics, 30s cache
- Commit: `56e636c`

### Dashboard (`phase-10-coverage-matrix` branch)

**Fixture test** (`packages/agent/src/lib/scanners/migration-0008.fixture.test.ts`):
- CODEX MED-17: always runs in CI, never skips
- 5 tests: parses expected frontmatter shape, asserts jq correction language, asserts clipboard-only note, parseFrontmatter null for empty/no-delimiters
- Commit: `7ae41f0`

**Smoke test** (`packages/agent/src/lib/scanners/migration-0008.smoke.test.ts`):
- Cross-repo: `it.skipIf(!HAS_UPSTREAM)` on all 5 tests
- Emits `console.warn` (not silent skip) when upstream missing — CI gap visible
- When upstream present: asserts id=0008, to_version=1.8.0, jq correction documented, clipboard-only documented
- Commit: `7ae41f0`

**CHANGELOG.md** (new, repo root):
- v1.1 entry: /coverage page, GET/POST /api/coverage, Observability sidebar, override chip, migration 0008, ADR 0023, CODEX MED-17 fixture test; known gaps noted
- v1.0.0 entry: Dashboard MVP placeholder (Phases 0-7)
- Commit: `bf45947`

## Test Results

| Suite | Files | Tests | Result |
|-------|-------|-------|--------|
| migration-0008.fixture.test.ts | 1 | 5 | GREEN |
| migration-0008.smoke.test.ts | 1 | 5 | GREEN (upstream present) |
| Full agent suite | 71 | 637 | GREEN (1 pre-existing flaky bind-modes build race; unrelated to this plan) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ADR renumbered 0021→0023 — collision with existing files**
- **Found during:** Task 2 pre-execution check
- **Issue:** ADR 0021 and 0022 already existed in claude-workflow (vendor-workflow-block-instead-of-inline and post-process-gsd-section-markers). The plan was written when the repo was at v1.7.0; it has since advanced to v1.9.0 with two additional ADRs and migrations (0009, 0010).
- **Fix:** Used next available ADR number (0023). All internal references updated to 0023. Migration 0008 frontmatter updated to reference ADR 0023.
- **Files modified:** 0023-coverage-matrix-page.md (new), 0008-coverage-matrix-page.md notes updated
- **Commit:** 56e636c, 7db473f

**2. [Rule 3 - Blocking] Test paths moved: packages/agent/test/ → src/lib/scanners/**
- **Found during:** Task 3 (pre-write check)
- **Issue:** Plan specified `packages/agent/test/migration-0008.*.test.ts`, but vitest.config.ts has `include: ['src/**/*.test.ts']`. A `test/` directory at package root would not be discovered.
- **Fix:** Co-located tests in `src/lib/scanners/` alongside the workflowVersionScanner tests they complement.
- **Files modified:** Both test files created at canonical location
- **Commit:** 7ae41f0

**3. [Rule 1 - Bug] Smoke test jq assertion: removed `.not.toMatch` for the bug pattern**
- **Found during:** Task 3 first test run (FAIL)
- **Issue:** `expect(content).not.toMatch(/jq '\.repos \| length'/)` failed because migration 0008 legitimately contains that text when documenting the migration 0007 correction ("Migration 0007's verify snippet `jq '.repos | length'` was incorrect"). The assertion was incorrect — the migration is expected to mention the old form as the thing being corrected.
- **Fix:** Changed to assert presence of correction language (`jq 'length'` + `top-level array`) rather than absence of the old form.
- **Files modified:** migration-0008.smoke.test.ts
- **Commit:** 7ae41f0

## Cross-Repo Push Handoff

**IMPORTANT:** Cross-repo branch `feat/migration-0008-coverage-matrix-page` in `~/Sourcecode/agenticapps/claude-workflow/` has 2 commits ready to push. User must push + open PR manually:

```bash
cd ~/Sourcecode/agenticapps/claude-workflow
git push -u origin feat/migration-0008-coverage-matrix-page
# Then open PR on GitHub against main
```

The branch contains:
- `7db473f` — `feat(migration-0008): Coverage Matrix Page — workflow surface bump 1.7.0 → 1.8.0`
- `56e636c` — `feat(adr-0023): Coverage Matrix Page — per-repo presence + freshness dashboard`

After PR merges, `workflowVersionScanner.readWorkflowHeadVersion()` will continue to read `to_version: 1.9.0` from migration 0010 (the highest-numbered migration). Migration 0008 fills the retroactive slot between 0007 and 0009.

## Known Stubs

None. All test files exercise real parseFrontmatter logic. CHANGELOG entries are substantive.

## Threat Flags

None. No new network endpoints or trust boundaries introduced. Cross-repo documentation files (migration + ADR) are intentionally public artifacts — no secrets.

## Self-Check: PASSED

Files verified:
- ~/Sourcecode/agenticapps/claude-workflow/migrations/0008-coverage-matrix-page.md: EXISTS, contains `to_version: 1.8.0`
- ~/Sourcecode/agenticapps/claude-workflow/docs/decisions/0023-coverage-matrix-page.md: EXISTS, contains `id: 0023`, `status: Accepted`
- packages/agent/src/lib/scanners/migration-0008.fixture.test.ts: EXISTS
- packages/agent/src/lib/scanners/migration-0008.smoke.test.ts: EXISTS
- CHANGELOG.md: EXISTS, contains `v1.1`, `/coverage`, `migration 0008`, `ADR 0023`

Commits verified:
- Dashboard `7ae41f0` — feat(10-08): fixture + smoke tests
- Dashboard `bf45947` — chore(10-08): CHANGELOG.md
- claude-workflow `7db473f` — feat(migration-0008): workflow surface bump
- claude-workflow `56e636c` — feat(adr-0023): Coverage Matrix Page ADR

Tests: 10/10 migration-0008 tests GREEN; full agent suite GREEN (pre-existing bind-modes flakiness unrelated).
