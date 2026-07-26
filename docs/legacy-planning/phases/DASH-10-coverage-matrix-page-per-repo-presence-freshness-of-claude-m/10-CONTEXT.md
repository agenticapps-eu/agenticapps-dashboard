# Phase 10: Coverage Matrix Page — Context

**Gathered:** 2026-05-13
**Status:** Ready for planning
**Mode:** Interactive `superpowers:brainstorming` inside `gsd-discuss-phase` — 4 user-named constraints + 4 follow-up ambiguities decided via AskUserQuestion.

<domain>
## Phase Boundary

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

Plus per-row **override chip** when any `<repo>/.planning/phases/*/multi-ai-review-skipped` sentinel exists (audit signal from migration 0005). The other override surface (`GSD_SKIP_REVIEWS=1` env var) leaves no on-disk trace and is undetectable; Phase 10 acknowledges this gap explicitly.

Plus a **"Refresh stale" action** per row + a "Refresh all stale" page-header button.

Ships as **migration 0008** in `~/Sourcecode/agenticapps/claude-workflow/migrations/0008-coverage-matrix-page.md`, bumping the workflow version from `1.7.0` → `1.8.0`.

**In scope:**
- New route `/coverage` mounted under `_appshell` via `createLazyRoute('/coverage')` in `packages/spa/src/router.tsx`.
- New daemon route `GET /api/coverage` returning the full matrix; daemon-side 30s memo cache.
- New daemon route `POST /api/coverage/refresh` accepting `{ family, repo, action: 'gitnexus-analyze' }`; spawns `gitnexus analyze`; returns required `updatedRow` on success. Clipboard actions (wiki refresh, CLAUDE.md authoring, workflow-version update) are SPA-side only per D-10-09 — the daemon rejects any non-'gitnexus-analyze' action at Zod parse with 400.
- New shared schemas at `packages/shared/src/schemas/coverage.ts` (`CoverageRowSchema`, `CoverageResponseSchema`, `CoverageRefreshRequestSchema`, `CoverageRefreshResponseSchema`).
- New SPA hooks (`useCoverage`, `useCoverageRefresh`) and panel components (`CoverageMatrix`, `CoverageFamilySection`, `CoverageRow`, `OverrideChip`).
- New filesystem scanners in `packages/agent/src/lib/coverageScan.ts` reading `~/Sourcecode/<family>/` (one level), `~/.gitnexus/registry.json`, `<family>/.wiki-compiler.json`, per-repo `<repo>/CLAUDE.md` and `<repo>/AGENTS.md` and `<repo>/.claude/skills/agentic-apps-workflow/SKILL.md` and `<repo>/.planning/phases/*/multi-ai-review-skipped` sentinels.
- New entry in `~/Sourcecode/agenticapps/claude-workflow/migrations/0008-coverage-matrix-page.md` documenting the dashboard route + the workflow-version bump.
- New ADR at `docs/decisions/0021-coverage-matrix-page.md` (workflow repo) capturing the design rationale.
- TDD on every new scanner, route, schema, and panel.
- Two-stage review + `/cso` (cross-repo filesystem trust boundary) + `/qa` (live dashboard walkthrough) + impeccable ≥ 90 on `/coverage` (1440x900).

**Out of scope (deferred — see `<deferred>`):**
- Real-time updates beyond 5s polling; no websockets.
- Backfilling old phases with sentinel scans (forward-only — sentinels are tracked from this phase forward).
- Detecting the `GSD_SKIP_REVIEWS=1` env-var override (no on-disk trace exists; documenting the gap in CONTEXT + UAT).
- Cross-family aggregate "all coverage % across all families" header chart (could land in a follow-up dashboard polish phase).
- Per-repo "drill-down" detail page (the matrix row is self-contained; drill-down is a future feature).
- Linking `/coverage` rows to a per-phase audit view (out of scope; the override chip's expand-list is the closest available signal in v1).
- Multi-machine coverage aggregation (project explicitly local-only).
- Indexing `~/Sourcecode/personal/`, `~/Sourcecode/shared/`, `~/Sourcecode/archive/` (excluded per migration 0007 conventions).

</domain>

<decisions>
## Implementation Decisions

### User-locked decisions (4 constraints + 4 follow-ups via AskUserQuestion 2026-05-13)

- **D-10-01: Pull with 30s daemon-side memo cache** (constraint #1 — data acquisition).
  - **Why:** Phase 10 reads ~30 repos' filesystem state on demand. File stats only (no content I/O), so cold-load is sub-500ms even at 50 repos. 30s memo matches Phase 4's phaseCache pattern (5s for phase data; coverage churn is slower, so 30s is appropriate). No background process, no on-disk state file, no chokidar against `~/Sourcecode` (which would be expensive across 50 repos).
  - **How to apply:** Planner produces a daemon route `GET /api/coverage` that calls `scanCoverage()` and memos the response in a `Map<"all", { value, expiresAt }>` with `Date.now() + 30_000` as the expiry. Memo cleared on `POST /api/coverage/refresh`.

- **D-10-02: Per-row refresh; daemon-spawns when safe + clipboard for unsafe** (constraint #2 — refresh action).
  - **Why:** Each freshness gap has a different remediation:
    - Wiki linked stale → daemon spawns `cd ~/Sourcecode/<family> && /wiki-compile` equivalent (safe, idempotent, family-scoped).
    - GitNexus stale → daemon spawns `cd <repo> && gitnexus analyze` (safe, idempotent, per-repo).
    - CLAUDE.md missing → no daemon action (requires human authoring); show a help link to the relevant doc page.
    - Workflow version mismatch → copy `/update-agenticapps-workflow` one-liner to clipboard (the migration runner is interactive — not safely headless).
  - **How to apply:** Planner produces `POST /api/coverage/refresh` accepting `{ repo: string, action: "wiki-compile" | "gitnexus-analyze" }`. Spawns via the existing `execa` pattern (Phase 1 — never `npx` against open registry; we vendor the plugin entry point or use the absolute resolved path). For `clipboard` actions the SPA renders a copy button + toast — no daemon roundtrip needed. Add a page-header "Refresh all stale" button that batches the spawnable actions across all rows (serialized to avoid concurrent index thrash).
  - **CSO note:** Spawned commands are NOT `npx <pkg>` — pin to vendored or globally-installed binaries; `/cso` will audit this.

- **D-10-03: Grouped sections per family, single page; sticky family headers + aggregate counts + per-family collapse** (constraint #3 — cross-family display).
  - **Why:** The CLAUDE.md hierarchy enforces a family boundary; tabbing it would hide cross-family aggregate; flat-matrix-with-family-column would make the boundary indistinguishable from a regular column; tree-view-with-expand would hide the matrix value (which is the point of the page). Grouped sections satisfy all three: boundary is visible, cross-family aggregate is on one page, matrix is always visible.
  - **How to apply:** Page structure: `<PageHeader title="Coverage" actions=[refresh-all-stale, status-filter-chips, search-box] />`, then three `<CoverageFamilySection family={...} rows={...} />` components, each with a sticky family header showing `family · {repo count} repos · ✕ N missing · ⚠ N stale · ✓ N fresh` and a collapse toggle. Default state: all expanded. Persist collapse state in `localStorage` (matches existing dashboard pattern from Phase 3 for filter chips).

- **D-10-04: Inline `⚠ N overrides` chip per-row when sentinels exist** (constraint #4 — override surfacing).
  - **Why:** The `multi-ai-review-skipped` sentinel is detectable via filesystem scan. The `GSD_SKIP_REVIEWS=1` env-var override is undetectable (no on-disk trace) — Phase 10 acknowledges the gap explicitly. The chip slot is reused for future override types if migration 0008+ codifies more. Adding a 5th column would inflate the matrix for a feature most rows won't have most of the time. The chip lives next to the repo identity because that's where the audit question ("who's bypassing review?") is rooted.
  - **How to apply:** `<OverrideChip count={N} onClick={...} />` rendered conditionally next to `<CoverageRow repoName />`. Click expands an inline list of affected `<phase-slug> — sentinel since YYYY-MM-DD (git log)` entries. Daemon scanner reads `<repo>/.planning/phases/*/multi-ai-review-skipped` mtime + a `git log -1 --format=%aI -- <sentinel-path>` for the "since" timestamp.

### Follow-up decisions (4 ambiguities surfaced after the 4 named constraints)

- **D-10-05: Repo discovery — every git repo under `~/Sourcecode/{agenticapps,factiv,neuroflash}` one level deep** (`personal/`, `shared/`, `archive/` excluded). Estimated ~42 repos.
  - **Why:** The dashboard's purpose is to surface coverage GAPS, including the "this repo isn't even in `.wiki-compiler.json` sources" signal. Filtering to only wiki-referenced repos would hide that signal. Curated active-development set (7 repos) is too narrow for cross-family visibility.
  - **How to apply:** Daemon scanner walks each of the 3 family roots, treats any directory containing `.git/` as a repo. Skip directories starting with `.` and any directory named `node_modules`. Exclude the three deferred family roots.

- **D-10-06: Workflow version "current head" read from the latest migration's `to_version` frontmatter in `~/Sourcecode/agenticapps/claude-workflow/migrations/*.md`.**
  - **Why:** Single source of truth that's self-updating. Migration 0008 (this phase) ships with `to_version: 1.8.0`, which automatically becomes the new head. Reading installed SKILL.md instead would lock the head to "whatever the user happens to have installed" (potentially stale). A dedicated VERSION file would require every migration to update it — duplicate state.
  - **How to apply:** Daemon scanner reads `~/Sourcecode/agenticapps/claude-workflow/migrations/` directory, sorts filenames lex-descending, parses YAML frontmatter of the first one, returns `to_version`. Per-repo column compares each repo's installed `<repo>/.claude/skills/agentic-apps-workflow/SKILL.md` frontmatter `version` against this head — equal = green, behind = amber (stale), missing skill file = red (missing).

- **D-10-07: Sort + filter — default sort family-then-name, filter chips for status, free-text search box.**
  - **Why:** Matches the existing HomeToolbar pattern from Phase 3 (consistent UX across the dashboard). Filter chips affect all family sections at once; family aggregate counts in the sticky header reflect the filtered view (not the unfiltered total — otherwise the counts mislead).
  - **How to apply:** Page-header toolbar with `<StatusChip label="all" /> <StatusChip label="✕ missing" /> <StatusChip label="⚠ stale" /> <StatusChip label="✓ fresh" />` (multi-select; "all" is the default and toggling any other deselects "all"). Search input filters by repo name (case-insensitive substring). Filter state persists in URL query params (`?status=stale&q=neuro`) so users can deep-link to a filtered view.

- **D-10-08: New "Observability" section in the sidebar nav** (user chose forward-thinking architecture over my recommendation of a top-level entry between Projects and Help).
  - **Why:** Leaves room for future cross-family panels (compliance, security audit, etc.). User explicitly chose this over my recommendation — pattern: prefers section architecture that can grow, even when v1.0 puts only one entry in that section.
  - **How to apply:** AppShellV2 sidebar gets a new `<SidebarSection title="Observability">` group containing `<SidebarItem to="/coverage" label="Coverage" />`. Section placement: between the existing "Projects" group and the "Help" group. Single-item sections are acceptable in v1.

### Post-research amendments (added 2026-05-13 after 10-RESEARCH.md surfaced technical realities)

- **D-10-09: Wiki refresh is CLIPBOARD-ONLY in v1.0** (revises D-10-02). RESEARCH.md surfaced that `/wiki-compile` is a Claude Code slash command with **no headless runner** — daemon cannot spawn it. The "daemon spawns when safe" rule (D-10-02) therefore applies ONLY to `gitnexus analyze`. Wiki refresh, CLAUDE.md authoring, and workflow-version update all become clipboard actions in v1.0.
  - **Why:** Forcing wiki-compile through `claude code -p` headless mode (experimental) would couple the dashboard to Claude Code's CLI surface and break when that surface changes. Shipping a CLI wrapper for the wiki-compiler plugin is scope creep into wiki-builder territory.
  - **How to apply:** Planner removes "spawnWikiCompile" from the daemon's refresh route. Refresh-action popover for wiki-stale rows offers a "Copy `/wiki-compile` command for terminal" button + a help link. Page UI documents the limitation in a small subscript under the toolbar. Defer headless wiki refresh to a future phase (could ship a wrapper or revisit headless Claude Code).
  - **Net effect on D-10-02**: still per-row refresh + daemon-spawns-when-safe, but the "when safe" set narrows to `{gitnexus analyze}` only.

- **D-10-10: GitNexus "never indexed" → `missing` (red); `~/.gitnexus/` absent entirely → `not-applicable` (gray) for the whole column** (refines COV-11 + COV-10). RESEARCH.md Q-5 + verified empty-state.
  - **Why:** "Never indexed" semantically IS a missing artifact — user has not run the initial `gitnexus analyze`. The 14-day stale threshold applies only to indexed repos that have aged out. When the tool itself isn't installed (`~/.gitnexus/` missing), the column has no meaningful state for any row, hence `not-applicable` is column-wide.
  - **How to apply:** Scanner returns `not-applicable` for every row when `~/.gitnexus/` absent (with the install banner). When `~/.gitnexus/registry.json` exists but a specific repo isn't in `entries[]`, return `missing` (red) for that row. When the repo IS in entries[] but `last_indexed < now - 14d`, return `stale` (amber). When fresh, return `fresh` (green).

- **D-10-11: Phase 10 ships with the `not-applicable` GitNexus baseline; no gitnexus install bundled.**
  - **Why:** Phase 10's job is to surface the coverage gap, not close it. Shipping with the `Not installed` GitNexus column proves the empty-state code path works — which IS the most common case for new dashboard users. Bundling gitnexus install would inflate scope (license review for PolyForm Noncommercial; 10-15min indexing time; daemon would need to detect gitnexus installation events).
  - **How to apply:** UAT verifies both empty state (live, dev machine) AND populated state (fixture test with a mocked registry.json on disk). Migration 0008 documents the gitnexus install path as a separate user step. No `npm install -g gitnexus` shell-out during Phase 10 verification.

### Post-research findings to lock as implementation guidance (Claude's discretion confirmed)

- **Repo count is 45 not ~42** (agenticapps=9, factiv=3, neuroflash=33). RESEARCH.md verified by `find` walk.
- **`registry.json` is a top-level JSON array of RegistryEntry**, NOT `{ repos: [...] }`. The ADR 0020 + migration 0007 verify scripts (`jq '.repos | length'`) contain a bug. Phase 10's scanner MUST use the correct schema; migration 0008's frontmatter MAY document the corrected `jq 'length'` form for future migration verify steps.
- **Skill directory probe MUST try both layouts**: (a) `<repo>/.claude/skills/agentic-apps-workflow/SKILL.md` (canonical, used by migration-installed projects); (b) `<repo>/.claude/skills/agenticapps-workflow/skill/SKILL.md` (bundle layout, used by this dashboard repo itself — with NO version field). Identify by frontmatter `name:` field, not by directory name.
- **Wiki "last compile" comes from `<family>/.knowledge/wiki/.compile-state.json` `last_compiled` field (YYYY-MM-DD)**. Treat absent file as "never compiled" → `missing`. Treat parse failure as `stale` with subtext "compile-state.json invalid" (Q-2 recommendation accepted).
- **Override chip "since" timestamp comes from `git log -1 --format=%aI -- <sentinel-path>`**, not mtime. ~5-20ms per sentinel; bounded by # sentinels (currently 0 across all repos).
- **GitNexus path canonicalization**: scanner tries BOTH `repoAbsPath` AND `realpathSync(repoAbsPath)` when matching against `registry.json` entries. Cost: one extra `realpath` syscall per uncached repo (Q-1 recommendation accepted).

### Claude's Discretion

The following are implementation details the planner / researcher resolves:

- **Filesystem-scan parallelism.** Sequential vs `Promise.all` across the 3 family roots, then sequential vs parallel per-repo scans within a family. ~42 repos × ~6 file existence checks = ~250 syscalls. Sequential is likely fast enough (single-digit ms each), but planner can choose `Promise.all` if the cold-load latency feels sluggish in dogfooding.
- **GitNexus registry JSON shape.** The ADR mentions `registry.json` and `.repos | length` but doesn't show the exact schema. Researcher reads the gitnexus source (npm-installed copy) to lock the schema before writing the Zod parser. If GitNexus isn't installed (`~/.gitnexus/` doesn't exist — current state), the GitNexus column shows `⚪ Not installed` for all rows with a one-line "Run `npm install -g gitnexus`" hint.
- **Wiki "last compile" detection.** Either (a) mtime of `<family>/.knowledge/wiki/INDEX.md` (the auto-regenerated index file), (b) max mtime across `<family>/.knowledge/wiki/topics/*.md`, or (c) a state file emitted by the wiki compiler. Researcher checks the wiki-compiler plugin source to see if option (c) exists; otherwise default to (a).
- **CLAUDE.md vs AGENTS.md.** ADR 0019 mentions both. If a repo has `AGENTS.md` but not `CLAUDE.md`, treat as present (the spec says "or AGENTS.md"). Researcher confirms whether any active-development repo uses AGENTS.md instead.
- **Override chip click-target.** Inline expansion vs popover vs link to a future per-phase audit page. Planner picks; default to inline expansion.
- **Refresh-all-stale concurrency.** Serialize the `gitnexus analyze` + `wiki-compile` spawns (one at a time) vs run them in parallel. Sequentially is safer (no concurrent index writes); the daemon can show a progress indicator. Planner picks; default sequential.
- **Workflow-version mismatch UX detail.** When the installed skill version is BEHIND the head, the cell shows the installed version + an "update" copy-button. When AHEAD (user is on a pre-release migration not yet in the head), show as green with a small "ahead" annotation. Researcher confirms semver semantics with the migration system.
- **Cache invalidation on `POST /api/coverage/refresh`.** Whether to clear the entire memo or just the affected row. Default: clear entire memo (simplest; staleness is per-call, not per-row).
- **Mobile / narrow-screen behaviour.** Phase 5 deferred this; Phase 10 inherits the desktop-first stance. Planner sizes if it shows up in QA.

### Folded Todos

None — `gsd-tools todo match-phase 10` was not run (no `.planning/todos/` directory was populated for this project). If todos surface later they'll be folded into a `09.x` or via the gsd-add-todo flow.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Workflow contract (authoritative)
- `~/Sourcecode/agenticapps/claude-workflow/docs/decisions/0018-multi-ai-plan-review-enforcement.md` — Multi-AI plan review gate; override surfaces (env-var + sentinel file); audit pattern. Source for D-10-04.
- `~/Sourcecode/agenticapps/claude-workflow/docs/decisions/0019-llm-wiki-compiler-integration.md` — Per-family wiki compiler; `.wiki-compiler.json` schema rationale; `<family>/.knowledge/wiki/` output layout. Source for "Wiki linked" column.
- `~/Sourcecode/agenticapps/claude-workflow/docs/decisions/0020-gitnexus-code-graph-integration.md` — GitNexus integration; `~/.gitnexus/registry.json` multi-repo registry; "Migration 0008 (queued)" — this phase. Source for "GitNexus indexed" column.
- `~/Sourcecode/agenticapps/claude-workflow/migrations/0005-multi-ai-plan-review-enforcement.md` — Hook 6 install; sentinel + env-var override semantics. Source for D-10-04 + override scanner.
- `~/Sourcecode/agenticapps/claude-workflow/migrations/0006-llm-wiki-builder-integration.md` — Wiki plugin install; `.wiki-compiler.json` minimum schema; per-family scaffolding.
- `~/Sourcecode/agenticapps/claude-workflow/migrations/0007-gitnexus-code-graph-integration.md` — GitNexus install + indexing helper script + registry semantics. Source for "GitNexus indexed" column.
- `~/Sourcecode/agenticapps/claude-workflow/templates/.claude/hooks/multi-ai-review-gate.sh` — Authoritative source for sentinel path + env-var name (read this for the exact path the scanner must check).

### Family boundary + repo discovery
- `~/Sourcecode/CLAUDE.md` — Family boundary contract ("stay inside the family unless cross-family is explicit"). Source for D-10-03 + D-10-08 (matrix must respect the boundary visually).
- `~/Sourcecode/agenticapps/CLAUDE.md` — agenticapps family active repo list + wiki commands.
- `~/Sourcecode/factiv/CLAUDE.md` — factiv family active repo list.
- `~/Sourcecode/neuroflash/CLAUDE.md` — neuroflash family active repo list (32 repos enumerated).
- `~/Sourcecode/agenticapps/.wiki-compiler.json` — agenticapps wiki sources (currently 8 entries).
- `~/Sourcecode/factiv/.wiki-compiler.json` — factiv wiki sources (currently 7 entries).
- `~/Sourcecode/neuroflash/.wiki-compiler.json` — neuroflash wiki sources (currently 8 entries; missing 25+ neuroflash repos — the page will surface this gap).

### Dashboard project
- `docs/spec/dashboard-prompt.md` — Authoritative dashboard spec (binding for any new route).
- `.planning/PROJECT.md` — Project vision, locked tech stack, hard non-negotiables (read-only on project filesystems; daemon writes confined to `~/.agenticapps/dashboard/`).
- `.planning/STATE.md` — Current milestone state (v1.1 now; Phase 10 active).
- `.planning/ROADMAP.md` — Phase 10 stanza with goal + columns table.
- `.planning/phases/05-skills-health-panels/05-CONTEXT.md` — **Critical pattern source.** D-5-11 (daemon-side scanners, no `/read` exposure), D-5-12 (singleton global routes), D-5-13 (`resolveAllowed` extension pattern), D-5-17 (multi-signal detection), D-5-19 (three-state-per-row vocabulary), D-5-20 (inline configure-to-enable copy), D-5-21 (vendored plugin, no `npx` against open registry — CSO requirement). Phase 10 is the next iteration of these patterns.
- `.planning/phases/07-help-docs-v1-0/07-CONTEXT.md` — D-7-06 (TanStack code-based routes via factory), D-7-11 (tokens.css naming — no shadcn aliases).
- `.planning/phases/03-multi-project-home-page/03-CONTEXT.md` — HomeToolbar filter chips + search box pattern (D-10-07 reuses this).

### Codebase scout (Phase 10)
- `packages/spa/src/router.tsx` — Existing router; new route mounts under `appShellLayoutRoute.addChildren()`.
- `packages/spa/src/components/ProjectCard.tsx` — Closest existing matrix-like component (rows + freshness indicators + expandable section). Pattern reference for `CoverageRow`.
- `packages/spa/src/components/panels/InstalledSkills.tsx` — Pattern for "lazy fetch + empty/error/loaded state" panel.
- `packages/spa/src/components/ui/` — Card, Pill, StatusPill, MetricNumeric, PageHeader, EmptyState (all reusable).
- `packages/spa/src/lib/projectQueries.ts` — TanStack Query hook pattern.
- `packages/agent/src/server/app.ts` — Hono route mount table.
- `packages/agent/src/routes/skills.ts` — Daemon route example (cached subprocess + outbound parse).
- `packages/agent/src/lib/paths.ts` — `resolveAllowed` + `resolveAllowedNamed` allow-list machinery. **D-10-NEW: extend `resolveAllowedNamed` with new allowed roots for `~/.gitnexus`, `~/Sourcecode/agenticapps`, `~/Sourcecode/factiv`, `~/Sourcecode/neuroflash`.**
- `packages/agent/src/lib/skillsScan.ts` — `parseFrontmatter()` SKILL.md frontmatter reader (reusable for workflow-version column).

</canonical_refs>

<code_context>
## Existing Code Insights (from scout)

### Reusable Assets
- **Router pattern**: `createLazyRoute('/coverage')` mounted in `packages/spa/src/router.tsx` under `appShellLayoutRoute.addChildren()`. Same line where Phase 7 added the `/help` peer layout.
- **Daemon route pattern**: `new Hono<Env>()` instance with `.get()` + `.post()` handlers, mounted in `packages/agent/src/server/app.ts` via `app.route(prefix, route)`. Already 17 mounted routes.
- **Outbound parse pattern**: `outbound(c, Schema.parse.bind(Schema), data)` (daemon) + `apiFetch(url, Schema)` (SPA). Both halves enforce schema.
- **Allow-list pattern**: `resolveAllowedNamed(candidatePath, { roots: [...], allowedNames: [...] })` already validates absolute paths against allowed roots + basename whitelist. **Extend with new roots for Phase 10.**
- **SKILL.md frontmatter reader**: `parseFrontmatter()` in `packages/agent/src/lib/skillsScan.ts` parses YAML frontmatter line-by-line, including `key: value` and literal blocks (`|`). Reusable for migration-file `to_version` and workflow SKILL.md `version`.
- **Panel pattern**: One component per panel under `packages/spa/src/components/panels/`, each `.test.tsx` co-located. Phase 5 D-5-02 + D-4-11 pattern carries forward.
- **UI primitives**: Card, Pill (5 variants), StatusPill, MetricNumeric, PageHeader, EmptyState. All Tailwind 4 namespaced tokens, no hex literals (Phase 5.1 constraint).
- **Filter chips + search box**: HomeToolbar from Phase 3 is the canonical pattern; Phase 10 reuses the same chip + free-text-search composition.

### Established Patterns
- **30s memo cache**: Phase 4 `phaseCache` at 5s; Phase 5 AgentLinter cache 1h. Phase 10 picks 30s as middle ground.
- **Multi-signal detection**: Phase 5 D-5-17 detects observability tools via ANY-OR signal set; Phase 10's "Wiki linked" column similarly checks BOTH the `.wiki-compiler.json` source reference AND the `.knowledge/wiki/` mtime.
- **Privacy-preserving daemon scanners**: Phase 5 D-5-11/12 — SPA never names a path; daemon owns the allow-list. Phase 10 follows the same model.
- **Configuration freshness as informational signal**: Phase 5 SecretsHealth surfaces `.infisical.json` presence + JSON-validity without ever reading secret values. Phase 10's overrides chip surfaces sentinel presence without ever reading sentinel contents.

### Integration Points
- **Sidebar nav**: New `Observability` section in AppShellV2 sidebar between `Projects` and `Help`. Single item: `Coverage`.
- **Route mount**: `appShellLayoutRoute.addChildren([..., coverageRoute])` in router.tsx.
- **App.ts mount**: `app.route('/api', coverageRoute)` near existing `/api/skills` mounts.
- **Allow-list extension**: 4 new roots in `resolveAllowedNamed` — `~/.gitnexus`, `~/Sourcecode/agenticapps`, `~/Sourcecode/factiv`, `~/Sourcecode/neuroflash`.

</code_context>

<specifics>
## Specific Ideas

- **The matrix mock the user previewed**: 4-column grid per family, sticky family header showing aggregate counts (✕ N missing  ⚠ N stale  ✓ N fresh), collapse/expand per family, "Refresh all stale" page-action button.
- **Override chip wording**: `⚠ N override` (singular when N=1) inline next to the repo name. Click expands to show `<phase-slug> — sentinel since YYYY-MM-DD`.
- **Filter chip set**: `[all] [✕ missing only] [⚠ stale only] [✓ fresh only]` — multi-select, "all" is default, toggling another deselects "all".
- **GitNexus "Not installed" state**: When `~/.gitnexus/` doesn't exist, the GitNexus column shows `⚪ Not installed` for all rows with a one-line install hint. Currently the truth on this machine — verified during discuss-phase.
- **Migration 0008 ships as part of this phase**: not a follow-up. The migration file documents the dashboard route + bumps the workflow version. The Coverage page's "Workflow version" column will go green on every repo once 0008 has been applied (or amber if a repo is one migration behind).

</specifics>

<deferred>
## Deferred Ideas

### Mentioned but out of scope for v1.0
- **Cross-family aggregate dashboard header** — "Coverage health across all families: X% green" hero number. Could land in a follow-up dashboard polish phase.
- **Per-repo drill-down detail page** (`/coverage/$repo` showing all artifacts + history). Future feature; v1 row is self-contained.
- **Link from override chip to a per-phase audit view** — would require new phase audit infrastructure. Inline expansion is the v1 affordance.
- **Detecting the `GSD_SKIP_REVIEWS=1` env-var override** — undetectable (no on-disk trace). Documented gap in Phase 10 UAT.
- **Real-time updates** — 5s polling pattern from Phase 3 inherited; no websockets.
- **Multi-machine coverage aggregation** — project is local-only.
- **Indexing `~/Sourcecode/{personal,shared,archive}`** — excluded per migration 0007 conventions.
- **Workflow version detection from a dedicated VERSION file** — rejected in D-10-06; migrations' `to_version` is the single source of truth.
- **Workflow head detection via npm registry** — rejected; we vendor claude-workflow, not npm-installed.
- **AgentLinter as a 5th column** — Phase 5 already ships AgentLinter score in the per-project view. Adding it to /coverage as a cross-repo column is interesting but would inflate the matrix; defer to a follow-up.
- **Aggregating phase-progress counts (e.g. "this repo has 3 unverified phases")** — different concern, different view.

### Reviewed Todos (not folded)
None — no todos were surfaced for this phase.

</deferred>

---

*Phase: 10-coverage-matrix-page*
*Context gathered: 2026-05-13*
*Discussion: 8 decisions in 1 session via `superpowers:brainstorming` inside `gsd-discuss-phase 10`. 4 user-named constraints (data acquisition / refresh granularity / cross-family display / override surfacing) + 4 follow-up ambiguities (repo discovery / workflow version detection / sort+filter UX / sidebar nav slot).*
