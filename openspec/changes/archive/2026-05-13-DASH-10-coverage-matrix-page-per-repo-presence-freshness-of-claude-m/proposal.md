# Phase 10: Coverage Matrix Page

**Archived from GSD phase `DASH-10-coverage-matrix-page-per-repo-presence-freshness-of-claude-m`. Completed 2026-05-13.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/DASH-10-coverage-matrix-page-per-repo-presence-freshness-of-claude-m/` — that tree, not this file, is the authoritative record.

## Why

Ship a `/coverage` route in agenticapps-dashboard that visualises, for every git repo under `~/Sourcecode/{agenticapps,factiv,neuroflash}` (one level deep), the **presence + freshness** of four knowledge artifacts:

| Column | Source of truth | "Fresh" means |
|---|---|---|
| **CLAUDE.md** | `<repo>/CLAUDE.md` (or `<repo>/AGENTS.md` as fallback) | file exists |
| **GitNexus indexed** | `~/.gitnexus/registry.json` entry for `<repo>` | last-indexed ≤ 14 days ago |
| **Wiki linked** | `<family>/.wiki-compiler.json` `sources[].path` references repo's dir, AND `<family>/.knowledge/wiki/` last compile ≤ 7 days ago | both conditions |
| **Workflow version** | `<repo>/.claude/skills/agentic-apps-workflow/SKILL.md` frontmatter `version` field | matches current head from `claude-workflow/migrations/*.md` (highest `to_version`) — currently `1.7.0`; migration 0008 (this phase) bumps to `1.8.0` |

Per-row freshness coloring (4 states):
- 🟢 **fresh** — artifact exists and within freshness window
- 🟡 **stale** — artifact exists but past freshness window
- 🔴 **missing** — artifact does not exist
- ⚪ **not-applicable** — column does not apply (e.g. GitNexus on a repo not in the active-development set; or no `~/.gitnexus/` installed)

Plus per-row **override chip** when any `<repo>/.planning/phases/*/multi-ai-review-skipped` sentinel exists (audit signal from migration 0005). The other override

## Capabilities affected

- `openspec/specs/fleet-coverage/spec.md`

## What shipped

**10-01**

Wire contract for Phase 10 locked: 4 Zod schemas with discriminated unions (CODEX HIGH-1/4/5 fixes), 4 clipboard builders centralized in shared (CODEX MED-13), and 21 test scaffold files spanning daemon scanners/orchestrator/route and SPA query hooks/panels.

**10-02**

**coverageResolver.ts** — Canonical `PathResolver` type and `makeCoverageResolver()` factory. Synchronous wrapper over the existing `resolveAllowedNamed` function. Exports `PathViolation` error class. All scanners import `type { PathResolver }` from this module.

**repoDiscovery.ts** — Walks `FAMILIES = ['agenticapps', 'factiv', 'neuroflash']` under `~/Sourcecode`. For each family directory, lists subdirectories with a `.git` entry (file or directory). CODEX HIGH-2: calls `realpathSync` on every candidate; if realpath escapes the family root, emits `safety.symlink-escape` structured warning an

**10-03**

Orchestration layer complete. `scanCoverage()` fans out 5 scanners across all discovered repos using Promise.all/Promise.allSettled, strips daemon-internal `absPath` before emission, and uses a single PathResolver constructed once per scan. All CODEX HIGH/MED security contracts enforced: absPath strip (HIGH-1), PathResolver injection (HIGH-3), clipboard dedup (MED-13), no-npx spawn (D-5-21), no wiki spawn (D-10-09).

**10-04**

Coverage route implemented and mounted. `GET /api/coverage` returns a 30s-TTL-cached `CoverageResponse` with no `absPath` fields (CODEX HIGH-1 structural guarantee). `POST /api/coverage/refresh` accepts only `gitnexus-analyze` (D-10-09 + CODEX HIGH-5), resolves the repo path via synchronous `discoverRepos()` (AGREED-3), re-canonicalises via `realpathSync` immediately before spawn (CODEX HIGH-3 TOCTOU), serialises concurrent same-repo POSTs via an in-memory lock (CODEX MED-14), and returns `updatedRow` REQUIRED on success (CODEX HIGH-5). The route is mounted at `/api` in `app.ts` alongside the

**10-05**

SPA query bindings for the coverage matrix daemon endpoints. `useCoverage()` wraps `GET /api/coverage` with 30s staleTime and refetchInterval (matching the daemon's coverageCache TTL — COV-01/COV-03). `useCoverageRefresh()` wraps `POST /api/coverage/refresh` with client-side `CoverageRefreshRequestSchema.parse()` before the network request (CODEX HIGH-5 defense-in-depth), invalidates `['coverage']` on success, and exposes `mutateAsync` for Plan 06's sequential batch dispatch (AGREED-4).

**10-06**

8 SPA panel components + clipboardCompat + RefreshAllStaleButton for the `/coverage` route. All Phase 05.1 tokens, no hex literals, no shadcn aliases. 783 tests GREEN (full suite), typecheck exits 0.

**10-07**

/coverage route mounted under _appshell; Sidebar OBSERVE replaced with Observability+Coverage; 7 Playwright e2e scenarios + 7 deterministic mocked CI-safe journey tests (CODEX MED-16). 794 tests GREEN.

**10-08**

Migration 0008 (coverage-matrix workflow surface, 1.7.0→1.8.0) + ADR 0023 authored in claude-workflow; CI-resident fixture test (CODEX MED-17) + cross-repo smoke test + CHANGELOG v1.1 entry in dashboard. COV-12 closed.

**10-09**

Plan 09 is the mandatory post-phase gate plan for Phase 10 (Coverage Matrix Page). It runs last — after all 8 implementation plans — and produces the review, security, and acceptance artifacts required before the phase can merge.

**Tasks executed (autonomous):**

| Task | Artifact | Result |
|------|---------|--------|
| Task 1 | `10-REVIEW.md` — Stage 1 /review | PASS — 0 errors, 1 warning, 2 info |
| Task 3 | `10-CSO.md` — /cso audit sections A–D | PASS — 0 errors, 0 warnings, 3 info |
| Task 6 | `10-HUMAN-UAT.md` — 6 acceptance scenarios | Scaffold complete |
| Task 7 | REQUIREMENTS.md COV

## Gates recorded

- verification — `10-VERIFICATION.md`
- code review — `10-REVIEW.md`
- security audit — `10-CSO.md`
- design critique — `10-IMPECCABLE.md`
- human UAT — `10-HUMAN-UAT.md`
- validation — `10-VALIDATION.md`
