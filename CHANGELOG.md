# Changelog

All notable changes to agenticapps-dashboard are documented here.

## [v1.1] — Cross-family observability — 2026-05-13

### Added

- **`/coverage` page** — per-repo presence + freshness matrix across `~/Sourcecode/{agenticapps,factiv,neuroflash}` for CLAUDE.md, GitNexus index, family wiki, and workflow version. Family-grouped layout with sticky aggregate counts, status filter chips, search, per-row refresh actions. (Phase 10)
- **`GET /api/coverage` + `POST /api/coverage/refresh`** daemon endpoints, 30s memo cache, gitnexus-analyze spawn (PATH-resolved, argv-array, never `npx`).
- **Sidebar `Observability` section** with `Coverage` entry, replacing the three placeholder stubs (Skills/Health/Reviews).
- **Override chip** surfaces `<repo>/.planning/phases/*/multi-ai-review-skipped` sentinel files (from migration 0005's audit pattern). Inline expansion shows phase slug + sentinel since timestamp.
- **Migration 0008** in `claude-workflow` — documents the `/coverage` workflow surface, bumps workflow head version 1.7.0 → 1.8.0.
- **ADR 0023** in `claude-workflow/docs/decisions/` — captures Phase 10 design rationale (4 columns, 11 decisions D-10-01..D-10-11, override surface, refresh semantics, cache strategy).
- **CODEX MED-17 fixture test** (`migration-0008.fixture.test.ts`) — CI-resident, never skips; asserts parseFrontmatter produces the expected migration 0008 frontmatter shape.

### Known gaps

- Wiki refresh is clipboard-only in v1 (no headless `/wiki-compile` runner exists — see ADR 0023 §Decisions).
- The `GSD_SKIP_REVIEWS=1` env-var override is undetectable (no on-disk trace) — documented in 10-UAT.

---

## [v1.0.0] — Dashboard MVP — 2026-05-12

Initial production release. Phases 0–7 shipped.

See the phase planning documents in `.planning/phases/` for full detail.

**Highlights:**

- Local daemon (`agentic-dashboard`) with bearer-token auth, CORS lock, and registry
- Multi-project home page with phase progress, commitment, and health panels
- Single-project view with Discipline + Phase columns (CommitmentBlock, HookFirings, PhaseProgress, ExecutionTimeline, ReviewStatus, SecurityStatus)
- Skills + Health column (InstalledSkills, SkillHealth via AgentLinter, ObservabilityHealth, SecretsHealth, IntegrationsHealth)
- Help + Docs route with MDX-rendered workflow documentation
- Cloudflare Pages deploy at `https://agenticapps-dashboard.pages.dev`
- Full test suite (1000+ tests) with Vitest + Playwright
