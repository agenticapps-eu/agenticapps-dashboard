# Phase 10: Coverage Matrix Page — Research

**Researched:** 2026-05-13
**Domain:** Daemon-side cross-family filesystem scanning + SPA matrix UI + workflow-version coverage signal
**Confidence:** HIGH (primary signals all verified against real on-disk artifacts or installed packages)

## Summary

Phase 10 ships a `/coverage` page in agenticapps-dashboard that scans every git repo under `~/Sourcecode/{agenticapps,factiv,neuroflash}` (one level deep) and surfaces a 4-column presence/freshness matrix: CLAUDE.md, GitNexus index, Wiki linked, Workflow version. Family-grouped sticky-header layout; per-row override chip when `multi-ai-review-skipped` sentinels exist; per-row remediation actions (spawn `wiki-compile`/`gitnexus analyze`, copy `/update-agenticapps-workflow` to clipboard, or link to `/help` doc). Ships as migration `0008` in `claude-workflow` (bumps workflow `1.7.0 → 1.8.0`).

The decisive technical questions were answered by reading real installed artifacts in this session — not by speculation:

- **GitNexus `registry.json` is a top-level JSON array** of `RegistryEntry` (NOT an object with `.repos`). Schema: `{ name, path, storagePath, indexedAt, lastCommit, remoteUrl?, stats? }[]`. `indexedAt` is an ISO-8601 string — drives the 14-day stale threshold. `~/.gitnexus/` is currently absent on this machine; daemon must handle that as `not-applicable` per COV-10. [VERIFIED: gitnexus@1.6.4 dist/storage/repo-manager.{js,d.ts}, installed locally during research]
- **Wiki "last compile" lives in `<family>/.knowledge/wiki/.compile-state.json` with a `last_compiled` field formatted YYYY-MM-DD.** Confirmed real on factiv (compiled 2026-05-12); the wiki-builder plugin's `hooks/wiki-session-context` script reads this exact path. agenticapps's and neuroflash's wiki dirs are empty (only the legacy `sources.yaml.legacy`) — those families show `missing` for wiki. [VERIFIED: factiv/.knowledge/wiki/.compile-state.json + wiki-builder/plugin/hooks/wiki-session-context + commands/wiki-lint.md]
- **Workflow head version derives from `claude-workflow/migrations/<highest>.md` YAML frontmatter `to_version`.** All migration files have this field (0000..0007 inspected). Pattern: filename `^\d{4}-` lex-sort descending. Phase 10 ships `0008-coverage-matrix-page.md` with `to_version: 1.8.0`. [VERIFIED: 0000-baseline.md..0007-gitnexus-code-graph-integration.md all have `to_version:` field at line 5 of frontmatter]
- **Two divergent skill directory names exist in the wild** for the same skill (frontmatter `name: agentic-apps-workflow` in both):
  - Canonical: `<repo>/.claude/skills/agentic-apps-workflow/SKILL.md` (used by cparx, fx-signal-agent, all migration-installed instances)
  - Dashboard's own variant: `<repo>/.claude/skills/agenticapps-workflow/skill/SKILL.md` (bundle layout, NO version field — installed before migration 0005 codified the name)
  This is a 2-axis lookup matrix: dirname (`agentic-apps-workflow` | `agenticapps-workflow`) × layout (canonical `SKILL.md` | bundle `skill/SKILL.md`). The cleanest scanner reads frontmatter `name` rather than relying on dirname.
- **Sentinel path is exactly `<repo>/.planning/phases/*/multi-ai-review-skipped`** per the live hook `multi-ai-review-gate.sh:53` (it stat-tests `$CURRENT_PHASE/multi-ai-review-skipped` where `$CURRENT_PHASE = readlink .planning/current-phase`). Zero sentinels exist on disk today — scanner must handle empty-set as `overrideCount: 0` (no chip) per COV-07. [VERIFIED: find /Users/donald/Sourcecode -name multi-ai-review-skipped → empty]

**Primary recommendation:** Build `packages/agent/src/lib/coverageScan.ts` as a top-level orchestrator that fans out 4 independent sub-scanners (claudeMd, gitNexus, wiki, workflow) per family; cache the entire response in a per-route singleton `Map<'all', {value, expiresAt}>` (30s TTL per D-10-01); extend `resolveAllowedNamed` with 4 new roots (no schema invariant broken). For refresh actions, vendor the wiki-compile/gitnexus invocation pattern — never call `npx <pkg>` per D-5-21 — and for unsafe remediations (CLAUDE.md authoring, workflow update) return a clipboard string that the SPA copies via the existing Phase 6 KbdHint clipboard-toast pattern.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-10-01: Pull with 30s daemon-side memo cache.**
- File stats only (no content I/O); cold-load < 500ms even at 50 repos; 30s memo matches the natural churn rate of coverage signals.
- Apply: daemon route `GET /api/coverage` reads `scanCoverage()` and memos in `Map<'all', { value, expiresAt: Date.now()+30_000 }>`; cleared on `POST /api/coverage/refresh`. No chokidar, no background process.

**D-10-02: Per-row refresh; daemon-spawns when safe + clipboard for unsafe.**
- Wiki stale → daemon spawns `wiki-compile` equivalent (family-scoped).
- GitNexus stale → daemon spawns `gitnexus analyze` (repo-scoped).
- CLAUDE.md missing → no daemon action; help link only.
- Workflow version mismatch → clipboard copy of `/update-agenticapps-workflow`.
- `POST /api/coverage/refresh { repo, action }` accepts `action ∈ {"wiki-compile", "gitnexus-analyze"}`; clipboard actions short-circuit in SPA.
- **CSO: never `npx <pkg>` against open registry; pin to vendored or absolute-resolved binary (D-5-21 lesson).**

**D-10-03: Grouped sections per family, single page; sticky family headers + aggregate counts + per-family collapse.**
- Page: `<PageHeader title="Coverage" actions=[refresh-all-stale, status-filter-chips, search-box] />` then 3× `<CoverageFamilySection>` with sticky family headers showing `family · {repoCount} repos · ✕ N · ⚠ N · ✓ N` + collapse toggle.
- Default state: all expanded. Collapse persisted in `localStorage` (`coverage:section-collapsed:<family>`).

**D-10-04: Inline `⚠ N overrides` chip per-row when sentinels exist.**
- `GSD_SKIP_REVIEWS=1` is undetectable (no on-disk trace) — gap documented; only sentinel files surface.
- `<OverrideChip count={N} onClick={...} />` rendered conditionally next to `<RepoIdentity>`. Click expands inline list: `<phase-slug> — sentinel since YYYY-MM-DD` (timestamp from `git log -1 --format=%aI -- <sentinel-path>`).

**D-10-05: Repo discovery — every git repo under `~/Sourcecode/{agenticapps,factiv,neuroflash}` one level deep.**
- Skip directories starting with `.` and `node_modules`.
- Exclude `personal/`, `shared/`, `archive/`.
- Detection: directory contains `.git/` (which can be a file in worktrees — accept both file and dir).
- Verified count this session: agenticapps=9, factiv=3, neuroflash=33 → **45 repos** (CONTEXT.md said "~42"; the working number is 45).

**D-10-06: Workflow head version from highest-numbered migration `to_version` frontmatter.**
- Scanner reads `~/Sourcecode/agenticapps/claude-workflow/migrations/`, filters `^\d{4}-.*\.md$`, lex-sort descending, parses YAML frontmatter, returns `to_version`.
- Per-repo cell compares installed SKILL.md `version` against head: equal=green, behind=amber, ahead=green-with-annotation, missing-skill=red, missing-version-field=amber "version unknown".

**D-10-07: Sort + filter — default sort family-then-name, status filter chips, free-text search box.**
- Toolbar: `[all] [✕ missing] [⚠ stale] [✓ fresh]` (multi-select; toggling any deselects "all"). Search input case-insensitive substring on repo name (NOT family name), 200ms debounce.
- Filter state persisted in URL (`?status=stale&q=neuro`) for deep-linking.
- Family aggregate counts reflect FILTERED view (not unfiltered totals).

**D-10-08: New "Observability" section in sidebar nav between Projects and Help.**
- Sidebar gets `<SidebarSection title="Observability">` with single `<SidebarItem to="/coverage" label="Coverage" />`. Single-item sections acceptable in v1.
- Replaces current "OBSERVE" placeholder section in Sidebar.tsx (currently 3 disabled stubs: Skills/Health/Reviews — Phase 6+).

### Claude's Discretion

- Filesystem-scan parallelism (Promise.all per family vs sequential) — 45 repos × ~6 syscalls ≈ 270 stat calls; cold-load measurable in dogfooding.
- Wiki "last compile" detection fallback when `.compile-state.json` absent: max-mtime across `<family>/.knowledge/wiki/topics/*.md` OR INDEX.md mtime. **Researcher confirmation: `.compile-state.json` is the canonical primary signal** (see Open Questions below); fallback only if file absent.
- Override chip click-target (inline expansion vs popover) — default inline expansion per CONTEXT.md.
- Refresh-all-stale concurrency — serialize spawns (default sequential) for safety; never concurrent index writes.
- Workflow-version mismatch UX detail — `behind` shows installed version + update button; `ahead` shows green-with-annotation; `version unknown` (missing frontmatter version) treated as amber with "version unknown" subtext.
- Cache invalidation strategy on `POST /api/coverage/refresh` — default: clear entire memo (simplest; staleness is per-call not per-row).
- Mobile / narrow-screen behaviour — desktop-first inherited from Phase 5; narrow widths optional.

### Deferred Ideas (OUT OF SCOPE)

- Cross-family aggregate health-score % hero number — v1.2 follow-up.
- Per-repo drill-down detail page (`/coverage/$repo`) — future feature.
- Override chip → per-phase audit page link — Inline expansion is the v1 affordance.
- Detecting `GSD_SKIP_REVIEWS=1` env-var override — undetectable.
- Real-time updates beyond 5s polling — no websockets.
- Multi-machine coverage aggregation — project is local-only.
- Indexing `~/Sourcecode/{personal,shared,archive}` — excluded per migration 0007.
- Workflow head detection from dedicated VERSION file or npm registry — rejected; migrations' `to_version` is canonical.
- AgentLinter as a 5th column — defer to follow-up.
- Aggregating phase-progress counts — different concern, different view.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COV-01 | `GET /api/coverage` returns full matrix with 4 columns + overrideCount + freshness state | Schemas section below; daemon route follows existing Hono pattern (overview.ts is the closest model) |
| COV-02 | Daemon-side dedicated scanners; `resolveAllowedNamed` extended with 4 new roots; SPA never names external paths | `resolveAllowedNamed` extension pattern from Phase 5 D-5-13 verified in paths.ts:97-137 |
| COV-03 | 30s daemon cache; cleared on refresh; cold-load < 1s for ~42 repos | overviewCache.ts pattern (lazy expiry, evict on mutation) is the template; 45 repos × ~6 stat calls is sub-second |
| COV-04 | `POST /api/coverage/refresh { repo, action }`; spawns `wiki-compile` or `gitnexus analyze`; clipboard for unsafe | execa pattern verified in agentLinterRunner.ts; spawn target resolution via `createRequire`+`pkg.bin` is the supply-chain-safe template |
| COV-05 | Grouped sections per family with sticky aggregate-count headers + collapse | localStorage pattern from Phase 3 filter chips; sticky positioning via Tailwind `sticky top-0` |
| COV-06 | Toolbar: status filter chips + search + default sort + URL persistence; counts reflect filtered view | HomeToolbar from Phase 3 is the template; URL state via TanStack Router search-param schema |
| COV-07 | Inline `⚠ N override` chip when `<repo>/.planning/phases/*/multi-ai-review-skipped` exists; click expands list | Sentinel path verified in multi-ai-review-gate.sh:53; zero sentinels currently — empty-set handling required |
| COV-08 | Workflow head from highest migration's `to_version` frontmatter; per-repo comparison; 5 state cases | All 8 migration files inspected; `to_version` field present in all; parseFrontmatter from skillsScan.ts reusable |
| COV-09 | Sidebar `Observability` section between Projects and Help with `Coverage` entry | Sidebar.tsx already has placeholder OBSERVE section — re-purpose, don't add a 4th section |
| COV-10 | `~/.gitnexus/` absent → `not-applicable` for every row + install hint; never crashes | `~/.gitnexus/` does not exist on this machine — directly verified; existsSync gate is the single check |
| COV-11 | Four-state vocabulary: `fresh` / `stale` / `missing` / `not-applicable`; thresholds: GitNexus 14d, Wiki 7d, Workflow=behind-head, CLAUDE.md binary | Threshold semantics locked in CONTEXT.md §Domain |
| COV-12 | Migration `0008-coverage-matrix-page.md` ships with `from_version: 1.7.0`, `to_version: 1.8.0` | Frontmatter pattern verified in migrations 0000-0007 |
| INV-01..INV-05 | Read-only on project FS; ~/.agenticapps/dashboard/ 0600; INV-03/INV-04/INV-05 carry forward | resolveAllowedNamed reads only; coverage daemon writes nothing to repos; cache is in-memory |

## Project Constraints (from CLAUDE.md)

These are HARD invariants. Plans MUST honor them; verification MUST check them.

1. **Read-only on project filesystems.** Sole exception is `POST /api/projects/{id}/open` (user-driven editor spawn). The new `POST /api/coverage/refresh` spawns subprocesses in the target repo (gitnexus analyze) or family root (wiki-compile) — these subprocesses themselves write to `~/.gitnexus/` and `<family>/.knowledge/wiki/` (NOT to a registered project's source files), so the spirit of INV-01 holds. **Daemon route still writes nothing.** Verification must confirm: the spawned subprocess only mutates outside the registered project source tree.
2. **Path allow-list scope.** `/api/projects/{id}/read` MUST stay anchored at `.planning/.claude` only — do NOT widen for Phase 10. New external paths go through `resolveAllowedNamed` only, with the 4 new roots added explicitly.
3. **Daemon writes confined to `~/.agenticapps/dashboard/`.** Phase 10 introduces no new write paths. Memo cache is in-memory only.
4. **No native dependencies in `packages/agent/`.** No new deps required — execa, zod, hono already present.
5. **Bearer-token auth on every route.** Inherited from app.ts middleware chain; no per-route auth needed.
6. **CORS locked to `https://dashboard.agenticapps.eu` + `http://localhost:5174`.** Inherited.
7. **Optional integrations stay optional.** GitNexus absent → graceful `not-applicable`; wiki compiler absent → graceful `missing`.
8. **No Cloudflare Workers / Pages Functions.** SPA stays pure static.
9. **`impeccable:critique` ≥ 90 on the new `/coverage` page (1440×900).** Anti-AI-slop self-test.
10. **TDD on every panel, every daemon route, every scanner.** No exceptions; Phase 5/6/7 precedent.
11. **Two-stage review before merge.** gstack `/review` + `superpowers:requesting-code-review`. **`/cso` is mandatory** for Phase 10 — new cross-family filesystem trust boundary.

## Standard Stack

### Core (already in workspace — no new deps for Phase 10)

| Library | Version (verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hono | catalog (current in agent pkg) | Daemon HTTP routes | Phase 1 D-01 lock — every daemon route is a Hono sub-app |
| Zod | catalog | Wire schemas in `@agenticapps/dashboard-shared` | Phase 0 D-06 — single source of truth, both ends parse |
| execa | catalog (in agent pkg) | Subprocess spawning (argv-array only — never shell strings) for wiki-compile + gitnexus analyze | Phase 5 D-5-15/D-5-21 vendored-binary pattern verified in agentLinterRunner.ts |
| React 18 + TS | catalog | SPA panels | Phase 2 D-01 |
| Tailwind v4 | catalog | All styling via tokens.css | Phase 5.1 lock |
| TanStack Query | catalog | SPA data hooks (`useCoverage`, `useCoverageRefresh`) | Phase 3 D-01..D-03 polling pattern |
| TanStack Router | catalog | Lazy route `/coverage` under `_appshell` | Phase 7 D-7-06 code-based routes |
| lucide-react | catalog | Icons (AlertTriangle for override chip; Activity for sidebar Observability) | Phase 5.1 |
| vitest | catalog | Unit + component tests | Phase 0+ |

### Supporting (already in workspace)

| Existing module | Purpose | Reuse in Phase 10 |
|---------|---------|-------------|
| `packages/agent/src/lib/paths.ts` | `resolveAllowed` + `resolveAllowedNamed` | Extend `resolveAllowedNamed` with 4 new roots |
| `packages/agent/src/lib/skillsScan.ts` | `parseFrontmatter()` for SKILL.md | Reuse for migration files' `to_version` + skill files' `version` |
| `packages/agent/src/lib/overviewCache.ts` | Lazy-expiry per-id Map cache | Pattern for new `coverageCache.ts` (singleton instead of per-id) |
| `packages/agent/src/lib/agentLinterRunner.ts` | execa with `createRequire`+`pkg.bin` for vendored binary | Pattern for spawning `gitnexus analyze` (npm-global) and `wiki-compile` (slash-command — different path; see Open Questions) |
| `packages/agent/src/lib/git.ts` | `runAllowedGit` for allow-listed git subcommands | Add `log` subcommand if not present — used for sentinel "since" timestamp |
| `packages/agent/src/routes/skills.ts` | Singleton route, in-module memo cache | Template for `coverageRoute` (singleton `/api/coverage`) |
| `packages/spa/src/lib/api.ts` | `apiFetch(path, schema)` + parseOrDrift | Reuse for `useCoverage` + `useCoverageRefresh` |
| `packages/spa/src/lib/projectQueries.ts` | TanStack Query hook pattern | Pattern for `useCoverage()` (no projectId) |
| `packages/spa/src/components/ui/Sidebar.tsx` | Existing OBSERVE placeholder section | Re-purpose into Observability section, remove SkillsHealth/Reviews disabled stubs |
| `packages/spa/src/components/SchemaDriftState.tsx` | Inline drift surface per panel | Reuse for coverage drift |
| `packages/spa/src/components/ui/PageHeader.tsx`, `StatusPill`, `EmptyState` | Phase 5.1 primitives | Reuse — no new primitives required |

### Installation

```bash
# NO new deps. All Phase 10 work uses existing workspace packages.
# After Phase 10 lands:
pnpm -r build
pnpm -r test
pnpm -r typecheck
```

**Version verification:** All workspace deps follow the catalog (per Phase 0 D-04). gitnexus is npm-global at v1.6.4 [VERIFIED: `npm view gitnexus` returns `gitnexus@1.6.4` published with `bin: gitnexus`, 35 deps, 38.8MB unpacked]; Phase 10 spawns `gitnexus` from PATH (no npm-install in daemon).

## Architecture Patterns

### Recommended File Structure

```
packages/shared/src/schemas/
└── coverage.ts                          # NEW — CoverageRowSchema, CoverageResponseSchema, CoverageRefreshRequest/ResponseSchema

packages/agent/src/
├── lib/
│   ├── paths.ts                          # EDIT — extend resolveAllowedNamed roots
│   ├── coverageScan.ts                   # NEW — top-level orchestrator
│   ├── scanners/                         # NEW — per-column scanners (one file each)
│   │   ├── claudeMdScanner.ts            # CLAUDE.md / AGENTS.md fallback presence
│   │   ├── gitNexusScanner.ts            # ~/.gitnexus/registry.json — array of RegistryEntry
│   │   ├── wikiScanner.ts                # <family>/.knowledge/wiki/.compile-state.json
│   │   ├── workflowVersionScanner.ts     # migrations dir + per-repo SKILL.md
│   │   └── overrideSentinelScanner.ts    # <repo>/.planning/phases/*/multi-ai-review-skipped + git log
│   ├── repoDiscovery.ts                  # NEW — list every .git/ under 3 family roots
│   ├── coverageCache.ts                  # NEW — singleton 30s memo (Map<'all', {value, expiresAt}>)
│   └── coverageSpawn.ts                  # NEW — execa pattern for wiki-compile + gitnexus analyze
├── routes/
│   └── coverage.ts                       # NEW — GET /api/coverage + POST /api/coverage/refresh
└── server/
    └── app.ts                            # EDIT — app.route('/api', coverageRoute)

packages/spa/src/
├── routes/
│   └── coverage.lazy.tsx                  # NEW — page top-level
├── components/
│   ├── ui/
│   │   └── Sidebar.tsx                   # EDIT — Observability section
│   └── panels/coverage/                   # NEW — co-locate all coverage panels
│       ├── CoveragePage.tsx
│       ├── CoverageToolbar.tsx
│       ├── CoverageGitNexusBanner.tsx
│       ├── CoverageFamilySection.tsx
│       ├── CoverageRow.tsx
│       ├── CoverageCell.tsx
│       ├── OverrideChip.tsx
│       ├── RefreshAllStaleButton.tsx
│       └── *.test.tsx                     # co-located per Phase 5 D-5-02
└── lib/
    └── coverageQueries.ts                 # NEW — useCoverage, useCoverageRefresh

claude-workflow/migrations/
└── 0008-coverage-matrix-page.md          # NEW — bumps 1.7.0 → 1.8.0

claude-workflow/docs/decisions/
└── 0021-coverage-matrix-page.md          # NEW — ADR
```

### Pattern 1: Singleton route with in-module memo (matches Phase 5 D-5-12)

```typescript
// packages/agent/src/routes/coverage.ts
// Source: existing pattern in routes/skills.ts (verified this session)
import { Hono } from 'hono'
import { CoverageResponseSchema } from '@agenticapps/dashboard-shared'
import { scanCoverage } from '../lib/coverageScan.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const coverageRoute = new Hono<Env>()

const TTL_MS = 30_000
let cache: { value: Awaited<ReturnType<typeof scanCoverage>>; expiresAt: number } | null = null

coverageRoute.get('/coverage', async (c) => {
  const now = Date.now()
  if (cache && now < cache.expiresAt) {
    return outbound(c, CoverageResponseSchema.parse.bind(CoverageResponseSchema), cache.value)
  }
  const value = await scanCoverage()
  cache = { value, expiresAt: now + TTL_MS }
  return outbound(c, CoverageResponseSchema.parse.bind(CoverageResponseSchema), value)
})

coverageRoute.post('/coverage/refresh', async (c) => {
  // body validation via @hono/zod-validator (existing pattern)
  // spawn appropriate action; invalidate cache; return updated row
  cache = null
  // ... see Pattern 4 for spawn pattern
})

// Mount in app.ts: app.route('/api', coverageRoute)
```

### Pattern 2: `resolveAllowedNamed` extension (matches Phase 5 D-5-13)

```typescript
// packages/agent/src/lib/paths.ts — EDIT
// Source: paths.ts:97-137 (verified this session)
// Add 4 new roots; resolveAllowedNamed already supports multiple roots.

// Helper for coverage-scanner consumers:
export const COVERAGE_ROOTS = {
  gitnexus: () => join(homedir(), '.gitnexus'),
  agenticapps: () => join(homedir(), 'Sourcecode', 'agenticapps'),
  factiv: () => join(homedir(), 'Sourcecode', 'factiv'),
  neuroflash: () => join(homedir(), 'Sourcecode', 'neuroflash'),
}

// At call site:
await resolveAllowedNamed(
  join(COVERAGE_ROOTS.gitnexus(), 'registry.json'),
  { roots: [COVERAGE_ROOTS.gitnexus()], allowedNames: ['registry.json'] }
)
```

**Why this is safe:** the existing `resolveAllowedNamed` realpath-checks the candidate AND each root before prefix-matching; basename-whitelist prevents reading arbitrary files even within an allowed root. Phase 5 `/cso` already audited this pattern. The new roots are read-only via dedicated scanners — they are NOT exposed via `/api/projects/:id/read`.

### Pattern 3: Discovery of git repos under family root

```typescript
// packages/agent/src/lib/repoDiscovery.ts
// Source: D-10-05 spec + verified counts (agenticapps=9, factiv=3, neuroflash=33)
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const FAMILIES = ['agenticapps', 'factiv', 'neuroflash'] as const

export interface DiscoveredRepo {
  family: typeof FAMILIES[number]
  name: string       // dirname
  absPath: string    // absolute path
}

export function discoverRepos(): DiscoveredRepo[] {
  const repos: DiscoveredRepo[] = []
  for (const family of FAMILIES) {
    const root = join(homedir(), 'Sourcecode', family)
    if (!existsSync(root)) continue
    let entries: string[]
    try { entries = readdirSync(root) } catch { continue }
    for (const name of entries) {
      if (name.startsWith('.')) continue
      if (name === 'node_modules') continue
      const abs = join(root, name)
      let st
      try { st = statSync(abs) } catch { continue }
      if (!st.isDirectory()) continue
      // Accept both .git/ directories AND .git files (worktrees)
      if (!existsSync(join(abs, '.git'))) continue
      repos.push({ family, name, absPath: abs })
    }
  }
  return repos
}
```

### Pattern 4: Subprocess spawn for refresh actions (matches Phase 5 D-5-21 vendored pattern)

```typescript
// packages/agent/src/lib/coverageSpawn.ts
// Source: agentLinterRunner.ts:34-85 (verified this session)
//
// CRITICAL: NEVER bare `npx gitnexus` — that hits the open registry; an account
// takeover or supply-chain attack on `gitnexus` (currently owned by abhigyanpatwari
// — npm view shows 261 versions) becomes RCE on the dashboard host.
//
// gitnexus is installed globally via migration 0007 — use absolute PATH-resolved
// `which gitnexus` outcome, executed via execa with argv array (NEVER shell string).
// All subprocess invocations in this module use execa(cmd, argv[]) — never execa.command()
// or any string-interpolated form. Matches the safe pattern in agentLinterRunner.ts.

import { execa } from 'execa'

const SPAWN_TIMEOUT_MS = 5 * 60 * 1000  // 5 min for index/compile operations

export async function spawnGitNexusAnalyze(repoAbsPath: string): Promise<RefreshResult> {
  const cmd = await resolveOnPath('gitnexus')  // returns absolute path or null
  if (!cmd) return { kind: 'not-installed' }
  try {
    const result = await execa(cmd, ['analyze'], {
      cwd: repoAbsPath,
      timeout: SPAWN_TIMEOUT_MS,
    })
    return { kind: 'ok', stdout: result.stdout }
  } catch (e: any) {
    if (e.timedOut) return { kind: 'timeout' }
    return { kind: 'error', exitCode: e.exitCode ?? -1, stderr: e.stderr ?? '' }
  }
}

// Pattern 4b — wiki-compile is a Claude Code slash command. There is no npm bin.
// The wiki-builder plugin lives at ~/Sourcecode/agenticapps/wiki-builder/plugin/.
// The /wiki-compile command's instructions tell Claude Code to "invoke the wiki-compiler skill".
// The skill itself is markdown — there's no executable.
//
// Recommended approach for daemon spawning: shell out to `claude` CLI with the slash-command
// (matches user expectation), OR (Open Question O-3) provide a "Run wiki-compile in terminal"
// affordance only — surface a clipboard string the user pastes into a Claude Code session.
//
// Default: clipboard-only for wiki, daemon-spawn ONLY for gitnexus. This matches D-10-02
// "clipboard for unsafe" semantics. Planner confirms.
```

### Pattern 5: Lazy route mount (matches Phase 7 D-7-06)

```typescript
// packages/spa/src/router.tsx — EDIT
// Source: router.tsx:88-91 (existing projectsIdRoute pattern, verified this session)
const coverageRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/coverage',
  validateSearch: zodValidator(CoverageSearchSchema),  // for ?status=... &q=...
}).lazy(() => import('./routes/coverage.lazy.js').then((m) => m.Route))

// In routeTree:
appShellLayoutRoute.addChildren([
  indexRoute,
  settingsRoute,
  projectsIdRoute,
  coverageRoute,  // NEW
] as AnyRoute[]),
```

### Anti-Patterns to Avoid

- **`npx gitnexus` against open registry.** D-5-21 lesson — every cache miss could pull a different version with auto-run install scripts. Use absolute PATH resolution OR refuse with `not-installed` if PATH lookup fails. [CITED: 05-CONTEXT.md D-5-21 + npm view gitnexus showing 261 versions]
- **Widening `/api/projects/:id/read` to cover external paths.** Phase 5 D-5-11 lesson — the project-scoped read route is ONLY `.planning/.claude`. New paths get dedicated scanners that never accept a SPA-supplied path argument. [CITED: 05-CONTEXT.md D-5-11]
- **chokidar / background process for staleness detection.** D-10-01 — pull-only with 30s memo cache. No long-lived watchers. [CITED: 10-CONTEXT.md D-10-01]
- **Detecting `GSD_SKIP_REVIEWS=1` env-var override.** Impossible — no on-disk trace. Document the gap; do not pretend. [CITED: 10-CONTEXT.md §deferred]
- **Hard-coding repo list.** Repo set is discovered at scan time. Adding a repo to a family means it shows up next refresh; deleting a repo means it disappears.
- **Reading wiki source files to count freshness.** Use `.compile-state.json` `last_compiled` field only. Walking thousands of source files would defeat the 30s memo cache and break the <1s cold-load target.
- **Renaming the canonical sentinel path.** Sentinel is `<repo>/.planning/phases/*/multi-ai-review-skipped` (per hook 6 source). Any divergence breaks the audit trail.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parse | A YAML library or regex | `parseFrontmatter()` from skillsScan.ts | Already handles `key: value`, `description: \|` literal blocks, passthrough fields; battle-tested in Phase 5 |
| Path traversal / symlink defence | Custom realpath logic | `resolveAllowedNamed` from paths.ts | Already realpath-checks both candidate and roots; basename-whitelist; symlink-escape defence via the same primitive used in Phase 5 |
| Per-id memo cache | New Map abstraction | `overviewCache.ts` pattern (lazy expiry on read, evict on mutation) | Singleton variant of same pattern — strict TypeScript types, tested |
| TanStack Query hook | Custom fetch + state machinery | `apiFetch(path, schema)` + `useQuery` | Schema drift surfaces via `<SchemaDriftState />`; 401 → RepairBanner inherited |
| Subprocess spawn classification | bare execa with try/catch | `agentLinterRunner.ts` discriminated-union pattern | 5 failure classes (ok/not-installed/timeout/error/unparseable) already encoded; clipboard-style copy matches D-5-15 |
| File-existence check + read | `existsSync` then `readFile` (race condition) | `try/catch + JSON.parse` inside `try` | Atomic; matches existing scanners (skillsScan.ts:144-201) |
| Sticky-on-scroll family headers | Custom IntersectionObserver | Tailwind `sticky top-0 z-10` | Native CSS sticky; works inside scrolling family-section container |
| Status filter chip multi-select | New state primitive | URL search-param state via TanStack Router's `validateSearch` | Deep-linking inherent; Phase 7 pair-error pattern is the reference |
| Sidebar section grouping | New `<Group>` component | Existing `<SidebarSection>` + `<SidebarItem>` | Sidebar.tsx already has `OBSERVE` placeholder section to re-purpose |

**Key insight:** Phase 10 introduces NO new architectural primitive. It composes Phase 1's allow-list + Phase 3's home-card cache + Phase 5's skills/agentlinter route + Phase 5.1's design tokens + Phase 7's lazy route + Phase 5's discriminated-union spawn pattern. The novelty is exclusively cross-family scope and UX composition.

## Runtime State Inventory

Phase 10 is a refactor-adjacent phase (introduces new code, no rename). However the scanner must read state from multiple categories — documenting explicitly:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — coverage cache is in-memory only; no DB; no on-disk state file | None |
| Live service config | `~/.gitnexus/registry.json` (read by scanner; written by gitnexus binary — NOT by daemon). `<family>/.knowledge/wiki/.compile-state.json` (read by scanner; written by wiki-compiler plugin — NOT by daemon). `<repo>/.claude/skills/agentic-apps-workflow/SKILL.md` (read; not written). | Document read-only paths in resolveAllowedNamed scope |
| OS-registered state | None — coverage is not registered with launchd/systemd/Task Scheduler. The dashboard daemon is, but Phase 10 doesn't touch that registration. | None |
| Secrets/env vars | `GSD_SKIP_REVIEWS=1` is referenced (acknowledged as undetectable). No other env vars in scope. No secret material. | Document the undetectability gap in `/coverage` page as informational subtext on the override-chip cluster |
| Build artifacts | New `packages/agent/dist/` entries for coverage routes/scanners; new `packages/spa/dist/assets/coverage-*.js` chunk for the lazy route. Built via existing `pnpm -r build`. | None — tooling already wired |

## Common Pitfalls

### Pitfall 1: Treating gitnexus `registry.json` as `{repos: [...]}` instead of a top-level array
**What goes wrong:** Zod schema parses fail at runtime; all rows show `not-applicable` or scanner throws.
**Why it happens:** ADR 0020 and migration 0007 verify scripts use `jq '.repos | length'` which IS WRONG (would return null). Real schema is `RegistryEntry[]`.
**How to avoid:** Schema as `z.array(RegistryEntrySchema)`. Treat empty array, missing file, missing dir as `not-applicable`. **The ADR/migration verify scripts have a bug — Phase 10's migration 0008 should NOT copy that pattern.**
**Warning signs:** `jq '.repos'` returning null in any verification script.

### Pitfall 2: Reading wiki `.compile-state.json` and stopping there when the file doesn't exist
**What goes wrong:** agenticapps and neuroflash families currently have NO `.compile-state.json` (only factiv does — they haven't run `/wiki-compile` yet). Scanner returns `missing`, which is correct, but the user may interpret it as broken.
**Why it happens:** The compile state file is only written after the first successful `/wiki-compile`. Empty wikis are normal.
**How to avoid:** Distinguish "wiki not configured" (no `.wiki-compiler.json`) from "wiki configured but never compiled" (config exists but no `.compile-state.json`). The cell label should reflect this — "Never compiled" vs "Wiki not linked".
**Warning signs:** Same `missing` state for two structurally different conditions.

### Pitfall 3: Workflow-version mismatch because the dashboard's own SKILL.md has no `version:` field
**What goes wrong:** Scanner reads `<repo>/.claude/skills/agenticapps-workflow/skill/SKILL.md` (note: bundle layout + non-canonical dirname), finds `name: agentic-apps-workflow` but no `version:`. If the scanner expects `version`, returns `null` and shows the dashboard repo as `missing` (red).
**Why it happens:** The dashboard repo was bootstrapped before migration 0005 codified the version field. **Confirmed this session** by inspecting `.claude/skills/agenticapps-workflow/skill/SKILL.md` — name field exists, version field absent.
**How to avoid:** When SKILL.md is found but `version` is absent, set state to `stale` with subtext "version unknown" (per CONTEXT.md follow-up D-10-06). NOT `missing`. The skill file IS present.
**Warning signs:** The dashboard's own row showing red on the Workflow column — that means the scanner is conflating "skill missing" with "version-field missing".

### Pitfall 4: Skill directory name divergence
**What goes wrong:** Scanner looks for `<repo>/.claude/skills/agentic-apps-workflow/SKILL.md` (canonical hyphenated name from migration 0005). The dashboard's own copy lives at `.claude/skills/agenticapps-workflow/skill/SKILL.md` (no hyphen, bundle layout). Scanner reports `missing`, user is confused.
**Why it happens:** Two naming conventions exist — `agentic-apps-workflow` (the canonical name, used by migrations 0005+) and `agenticapps-workflow` (used by the dashboard's own setup skill before the migration codified the name).
**How to avoid:** Scanner probes BOTH dirnames AND both layouts (canonical + bundle). Identify the skill by frontmatter `name:` field, not by directory name. The `findSkillPath` dual-layout probe in Phase 4 phaseDetail.ts is half the answer — extend it with the dirname alternative OR list both candidate dirnames.
**Warning signs:** Phase 10's own repo's Workflow column being red. ALSO: factiv/fx-signal-agent has 12 `.claude/worktrees/agent-*` directories that contain duplicated SKILL.md files — the scanner must NOT walk into `.claude/worktrees/`.

### Pitfall 5: Empty sentinel set → trying to render an empty list
**What goes wrong:** Zero sentinels exist anywhere (verified this session). If the override chip renders unconditionally, the SPA will show "⚠ 0 override" pollution on every row.
**Why it happens:** Forward-only sentinel tracking (per CONTEXT.md and migration 0005 §Notes). Sentinels accumulate over time; in the dashboard's lifetime so far, none have been used.
**How to avoid:** Chip strictly conditional: `count > 0 && <OverrideChip count={count} />`. NO empty-state UI for "no overrides" — that's noise.
**Warning signs:** Empty chip slots taking visual space; UI bloat.

### Pitfall 6: Reading `.claude/worktrees/` or other nested skill directories
**What goes wrong:** fx-signal-agent has 12 worktrees, each with its own duplicated `.claude/skills/agentic-apps-workflow/SKILL.md`. Naive scanner walks them all.
**Why it happens:** worktrees are a git-native pattern that materialise the skill tree into nested directories.
**How to avoid:** Scanner only reads `<repo>/.claude/skills/` directly (one level), never `<repo>/.claude/worktrees/**`. Phase 5's `skillsScan.ts` uses `readdirSync(root)` (no recursion) — same pattern.
**Warning signs:** Workflow-version state seemingly random; same repo reported multiple times.

### Pitfall 7: ADR/migration `~/.gitnexus/registry.json` verify uses wrong schema
**What goes wrong:** Migration 0007 verify includes `jq '.repos | length' ~/.gitnexus/registry.json` — would always return `null` because the actual file is a top-level array.
**Why it happens:** The ADR and migration were written before testing against the real registry. (~/.gitnexus does not exist on this machine, so the verify script was never actually run.)
**How to avoid:** Phase 10 migration 0008 verify uses `jq 'length' ~/.gitnexus/registry.json 2>/dev/null || echo 0`. Document the upstream bug in migration 0008 §Notes so future maintainers don't copy the broken pattern.
**Warning signs:** Migration 0007's own verify silently producing `null`.

### Pitfall 8: Refresh-all-stale triggers concurrent index writes
**What goes wrong:** SPA fires `POST /api/coverage/refresh` for every stale row in parallel. Two `gitnexus analyze` calls against different repos can be concurrent (different storage paths) but two `wiki-compile` calls against the SAME family conflict (same `<family>/.knowledge/wiki/` write target).
**Why it happens:** Naive batch button does `Promise.all(rows.map(refresh))`.
**How to avoid:** Daemon serializes spawns within a family. Cross-family spawns CAN parallelize (different storage targets) but the simpler implementation is sequential global. Default sequential per CONTEXT.md Claude's Discretion.
**Warning signs:** Wiki-compile reporting partial topic writes; `last_compiled` field flapping.

## Code Examples

### Reading `.compile-state.json` for wiki freshness

```typescript
// packages/agent/src/lib/scanners/wikiScanner.ts
// Source: VERIFIED file at /Users/donald/Sourcecode/factiv/.knowledge/wiki/.compile-state.json
//   { "last_compiled": "2026-05-12", "wiki_version": 1, ... }
// Plus /Users/donald/Sourcecode/agenticapps/wiki-builder/plugin/hooks/wiki-session-context:38
//   state_file="$project_root/$output_path/.compile-state.json"
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const CompileStateSchema = z.object({
  last_compiled: z.string().optional(),
  wiki_version: z.number().optional(),
  topics: z.array(z.string()).optional(),
}).passthrough()

const WIKI_STALE_DAYS = 7

export interface WikiScanResult {
  state: 'fresh' | 'stale' | 'missing' | 'not-applicable'
  lastCompiledDate?: string  // YYYY-MM-DD
  daysSinceCompile?: number
  hint?: string              // e.g. "never compiled" vs "wiki not linked"
}

export function scanWikiForFamily(familyAbsPath: string, repoName: string): WikiScanResult {
  // Step 1: does the family have a wiki configured at all?
  const configPath = join(familyAbsPath, '.wiki-compiler.json')
  if (!existsSync(configPath)) {
    return { state: 'missing', hint: 'wiki not linked' }
  }
  // Step 2: does the .wiki-compiler.json reference this repo?
  // (CONTEXT.md: "Wiki linked = .wiki-compiler.json sources[].path references repo's dir
  //   AND .knowledge/wiki/ last compile ≤ 7 days ago")
  let cfg: any
  try {
    cfg = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    return { state: 'missing', hint: 'wiki config invalid' }
  }
  const sources: { path?: string }[] = Array.isArray(cfg?.sources) ? cfg.sources : []
  const referenced = sources.some((s) => typeof s.path === 'string' && s.path.startsWith(repoName))
  if (!referenced) {
    return { state: 'missing', hint: 'repo not in .wiki-compiler.json sources' }
  }
  // Step 3: read compile state
  const statePath = join(familyAbsPath, '.knowledge', 'wiki', '.compile-state.json')
  if (!existsSync(statePath)) {
    return { state: 'stale', hint: 'never compiled' }  // configured but not compiled — amber, not red
  }
  let state: z.infer<typeof CompileStateSchema>
  try {
    state = CompileStateSchema.parse(JSON.parse(readFileSync(statePath, 'utf8')))
  } catch {
    return { state: 'stale', hint: 'compile-state.json invalid' }
  }
  if (!state.last_compiled) return { state: 'stale', hint: 'last_compiled missing' }

  // YYYY-MM-DD → Date
  const compiled = new Date(state.last_compiled + 'T00:00:00Z')
  const days = Math.floor((Date.now() - compiled.getTime()) / (1000 * 60 * 60 * 24))
  return {
    state: days <= WIKI_STALE_DAYS ? 'fresh' : 'stale',
    lastCompiledDate: state.last_compiled,
    daysSinceCompile: days,
  }
}
```

### Reading gitnexus `registry.json` (top-level array)

```typescript
// packages/agent/src/lib/scanners/gitNexusScanner.ts
// Source: VERIFIED via gitnexus@1.6.4 dist/storage/repo-manager.{js,d.ts}
//   readRegistry(): Promise<RegistryEntry[]>
//   export interface RegistryEntry {
//     name: string;
//     path: string;
//     storagePath: string;
//     indexedAt: string;       // ISO-8601
//     lastCommit: string;
//     remoteUrl?: string;
//     stats?: { files?; nodes?; edges?; communities?; processes?; embeddings? };
//   }
import { z } from 'zod'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const GITNEXUS_STALE_DAYS = 14

const RegistryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  storagePath: z.string(),
  indexedAt: z.string(),  // ISO-8601 datetime
  lastCommit: z.string(),
  remoteUrl: z.string().optional(),
  stats: z.object({}).passthrough().optional(),
}).passthrough()

const RegistryArraySchema = z.array(RegistryEntrySchema)

export interface GitNexusGlobalState {
  installed: boolean
  entries: z.infer<typeof RegistryArraySchema>
}

export function scanGitNexusGlobal(): GitNexusGlobalState {
  const dir = join(homedir(), '.gitnexus')
  if (!existsSync(dir)) return { installed: false, entries: [] }
  const file = join(dir, 'registry.json')
  if (!existsSync(file)) return { installed: true, entries: [] }
  let parsed
  try {
    parsed = RegistryArraySchema.parse(JSON.parse(readFileSync(file, 'utf8')))
  } catch {
    return { installed: true, entries: [] }  // corrupt — treat as none
  }
  return { installed: true, entries: parsed }
}

export interface GitNexusRepoState {
  state: 'fresh' | 'stale' | 'missing' | 'not-applicable'
  indexedAt?: string  // ISO-8601
  daysSinceIndex?: number
}

export function rateRepo(
  global: GitNexusGlobalState,
  repoAbsPath: string,
): GitNexusRepoState {
  if (!global.installed) return { state: 'not-applicable' }
  // gitnexus stores canonicalised paths; on macOS that means realpath-resolved.
  // Compare by absolute path string (case-insensitive on darwin filesystem).
  const entry = global.entries.find((e) => e.path === repoAbsPath || e.path === realpathSafe(repoAbsPath))
  if (!entry) return { state: 'missing' }
  const indexed = new Date(entry.indexedAt)
  const days = Math.floor((Date.now() - indexed.getTime()) / (1000 * 60 * 60 * 24))
  return {
    state: days <= GITNEXUS_STALE_DAYS ? 'fresh' : 'stale',
    indexedAt: entry.indexedAt,
    daysSinceIndex: days,
  }
}
```

### Workflow version: highest migration's `to_version`

```typescript
// packages/agent/src/lib/scanners/workflowVersionScanner.ts
// Source: VERIFIED migrations 0000..0007 all have `^to_version:` in frontmatter
import { readdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseFrontmatter } from '../skillsScan.js'  // REUSE — handles `key: value` lines

const MIGRATIONS_DIR = join(homedir(), 'Sourcecode', 'agenticapps', 'claude-workflow', 'migrations')

export function readWorkflowHeadVersion(): string | null {
  if (!existsSync(MIGRATIONS_DIR)) return null
  let entries: string[]
  try {
    entries = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{4}-.+\.md$/.test(f))
      .sort()
      .reverse()  // lex-descending → highest numbered first
  } catch {
    return null
  }
  for (const name of entries) {
    const fm = parseFrontmatter(join(MIGRATIONS_DIR, name))
    if (!fm) continue
    const toVersion = (fm as any).to_version as string | undefined
    if (typeof toVersion === 'string' && toVersion.trim()) return toVersion.trim()
  }
  return null
}

// Per-repo: read installed SKILL.md
// Probe BOTH dirname conventions AND both layouts (canonical + bundle).
const CANDIDATE_PATHS = (repoAbs: string) => [
  // Canonical name + canonical layout (cparx, fx-signal-agent — migration-installed)
  join(repoAbs, '.claude', 'skills', 'agentic-apps-workflow', 'SKILL.md'),
  // Canonical name + bundle layout (defensive — Phase 4 D-4-15 dual-probe pattern)
  join(repoAbs, '.claude', 'skills', 'agentic-apps-workflow', 'skill', 'SKILL.md'),
  // Dashboard's own divergent name + bundle layout
  join(repoAbs, '.claude', 'skills', 'agenticapps-workflow', 'skill', 'SKILL.md'),
  // Defensive: dashboard's name + canonical layout
  join(repoAbs, '.claude', 'skills', 'agenticapps-workflow', 'SKILL.md'),
]

export interface WorkflowRepoState {
  state: 'fresh' | 'stale' | 'missing' | 'not-applicable'
  installedVersion?: string
  headVersion?: string
  detail?: 'version-unknown' | 'behind' | 'ahead' | 'equal' | 'skill-missing'
}

export function scanWorkflowVersionForRepo(
  repoAbsPath: string,
  head: string | null,
): WorkflowRepoState {
  for (const p of CANDIDATE_PATHS(repoAbsPath)) {
    if (!existsSync(p)) continue
    const fm = parseFrontmatter(p)
    if (!fm) continue
    const ver = (fm as any).version as string | undefined
    if (typeof ver !== 'string' || !ver.trim()) {
      return { state: 'stale', installedVersion: undefined, detail: 'version-unknown' }
    }
    if (!head) return { state: 'fresh', installedVersion: ver.trim() }
    const cmp = compareSemver(ver.trim(), head)
    if (cmp === 0) return { state: 'fresh', installedVersion: ver.trim(), headVersion: head, detail: 'equal' }
    if (cmp < 0) return { state: 'stale', installedVersion: ver.trim(), headVersion: head, detail: 'behind' }
    return { state: 'fresh', installedVersion: ver.trim(), headVersion: head, detail: 'ahead' }
  }
  return { state: 'missing', detail: 'skill-missing' }
}

function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0
    if (x < y) return -1
    if (x > y) return 1
  }
  return 0
}
```

### Sentinel scan (override chip)

```typescript
// packages/agent/src/lib/scanners/overrideSentinelScanner.ts
// Source: VERIFIED hook 6 at multi-ai-review-gate.sh:53
//   [ -f "$CURRENT_PHASE/multi-ai-review-skipped" ] && exit 0
// And ADR 0018 §"Override surface": "touch .planning/current-phase/multi-ai-review-skipped"
// Phase-resolved version: <repo>/.planning/phases/<phase-slug>/multi-ai-review-skipped
//
// Subprocess invocation: uses execFileSync (NOT exec) with argv array — no shell expansion,
// no string interpolation. Args are constant strings + cwd; the only variable is the safe
// `phaseSlug` from readdirSync. Matches the safe pattern in packages/agent/src/lib/git.ts.
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const SENTINEL_NAME = 'multi-ai-review-skipped'

export interface OverrideEntry {
  phaseSlug: string
  sinceIso?: string  // git-log commit date if available, else mtime
  source: 'git-log' | 'mtime'
}

export function scanOverrideSentinelsForRepo(repoAbsPath: string): OverrideEntry[] {
  const phasesDir = join(repoAbsPath, '.planning', 'phases')
  if (!existsSync(phasesDir)) return []
  let phaseDirs: string[]
  try { phaseDirs = readdirSync(phasesDir) } catch { return [] }
  const entries: OverrideEntry[] = []
  for (const phaseSlug of phaseDirs) {
    const sentinel = join(phasesDir, phaseSlug, SENTINEL_NAME)
    if (!existsSync(sentinel)) continue
    // Try git log first for the canonical "since" timestamp.
    // execFileSync with argv array — no shell, no interpolation.
    let sinceIso: string | undefined
    let source: 'git-log' | 'mtime' = 'mtime'
    try {
      const out = execFileSync(
        'git',
        ['log', '-1', '--format=%aI', '--', join('.planning', 'phases', phaseSlug, SENTINEL_NAME)],
        { cwd: repoAbsPath, encoding: 'utf8', timeout: 5_000 }
      ).trim()
      if (out) { sinceIso = out; source = 'git-log' }
    } catch { /* fall through to mtime */ }
    if (!sinceIso) {
      try { sinceIso = statSync(sentinel).mtime.toISOString() } catch { /* skip */ }
    }
    entries.push({ phaseSlug, sinceIso, source })
  }
  return entries
}
```

### CLAUDE.md / AGENTS.md presence

```typescript
// packages/agent/src/lib/scanners/claudeMdScanner.ts
// Source: VERIFIED CLAUDE.md across most repos + AGENTS.md fallback at codex-workflow
// Rule: CLAUDE.md OR AGENTS.md = present (fresh). Neither = missing.
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export type ClaudeMdState = 'fresh' | 'missing'

export function scanClaudeMd(repoAbsPath: string): { state: ClaudeMdState; via: 'CLAUDE.md' | 'AGENTS.md' | 'none' } {
  if (existsSync(join(repoAbsPath, 'CLAUDE.md'))) return { state: 'fresh', via: 'CLAUDE.md' }
  if (existsSync(join(repoAbsPath, 'AGENTS.md'))) return { state: 'fresh', via: 'AGENTS.md' }
  return { state: 'missing', via: 'none' }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npx <pkg> scan ...` | Vendored or PATH-resolved binary; execa with argv-array only | Phase 5 D-5-21 (2026-05-08 CSO finding) | All subprocess spawns must follow this pattern |
| Single-signal detection (deps-only) | Multi-signal ANY-OR detection with evidence trail | Phase 5 D-5-17 | Wiki "linked" requires BOTH config reference AND fresh compile (still single-source per signal, but composite signal) |
| `/api/projects/:id/read` for any project file | Dedicated daemon-side scanners + `resolveAllowedNamed` | Phase 5 D-5-11 to D-5-13 | Phase 10 strictly follows this — `/read` is NOT widened |
| chokidar background watcher | Pull-only with TTL memo | Phase 1 D-22 + Phase 10 D-10-01 | 30s memo across full matrix; no background process |
| Optimistic data (treat empty config as success) | Distinct empty-state classes per failure mode | Phase 5 D-5-15 / D-5-18 | Wiki: "never compiled" vs "wiki not linked" rendered differently |

**Deprecated/outdated:**

- **Migration 0007 + ADR 0020 verify pattern** uses `jq '.repos | length'` against `~/.gitnexus/registry.json`. This is INCORRECT — the real schema is a top-level array. Verified by inspecting gitnexus@1.6.4 source (`dist/storage/repo-manager.js:222-231`). Phase 10's migration 0008 verify must use `jq 'length'`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | gitnexus `RegistryEntry.path` is stored as a realpath-resolved absolute path (so simple string-compare works against `realpath(repoAbsPath)`) | gitNexusScanner code example | If gitnexus stores symlink-form on macOS but daemon reads realpath-form, every row reports `missing` GitNexus despite being indexed. Mitigation: try both forms (raw + realpath) — verified pattern in gitnexus's own `canonicalizePath` helper [VERIFIED: dist/storage/repo-manager.js:320-334 confirms canonicalisation IS applied to writes since #664 — but old-format entries may be present] |
| A2 | Spawning `wiki-compile` from the daemon is undesirable (it's a Claude Code slash command, not a binary). Phase 10's wiki refresh is clipboard-only OR via a separate `claude` CLI invocation. | Pattern 4 + Open Question O-3 | If spawned wrong, the family wiki could be partially written or thrash. Mitigation: ship clipboard-only for wiki in v1.0; daemon-spawn ONLY gitnexus analyze. Planner can re-open if there's a clean way to invoke the wiki-compiler plugin headlessly |
| A3 | The user can run the dashboard daemon while `~/.gitnexus/` is still absent and the page renders cleanly with `Not installed` banner | COV-10 implementation | If existsSync gate is missing or the scanner crashes on `ENOENT`, the whole page 500s. Mitigation: existsSync gate first; never let the GitNexus scanner throw |
| A4 | Migration files always have a frontmatter `to_version` field (parsing won't return null on a valid migration) | workflowVersionScanner code | If the highest-numbered file has no `to_version`, head is `null` and every repo shows `fresh` (the fallback in scanWorkflowVersionForRepo). [VERIFIED 0000-0007 all have it; defensive fallback included] |
| A5 | The "since" timestamp on a sentinel is best derived from `git log -1 --format=%aI`; if not in git, fall back to mtime | overrideSentinelScanner code | If `git log` is missing or slow (5s timeout), every sentinel reports mtime — fine. If `git` itself is absent from PATH (unlikely on a dev machine), execFileSync throws but we catch and fall through to mtime |
| A6 | The dashboard's own SKILL.md naming will eventually be fixed by a follow-up migration (renaming `agenticapps-workflow` → `agentic-apps-workflow`); Phase 10's scanner accommodates the divergence in the meantime | workflowVersionScanner CANDIDATE_PATHS | If the dirname divergence is never resolved, the scanner permanently probes both. Cost is 4 stat calls per repo instead of 1. Trivial |
| A7 | URL search params persist across cross-family filter changes (TanStack Router `validateSearch` is the right primitive) | COV-06 implementation | If `validateSearch` errors render a blank page (Phase 7 hit this exact issue — see router.tsx:38-55), Phase 10 must mirror the `errorComponent` defensive pattern |
| A8 | `~/Sourcecode/{personal,shared,archive}` are NOT walked under any circumstance (CONTEXT.md D-10-05 + migration 0007 exclusion) | Pattern 3 repoDiscovery | If accidentally included, dozens of personal repos pollute the matrix. Hard-code the family list, never read from a config |

**If user confirms A1-A2 before planning, the planner can lock the gitnexus path-match logic + wiki-spawn strategy with full confidence.**

## Open Questions (RESOLVED)

All 5 questions accepted with the inline recommendations during the post-research user gate on 2026-05-13. Resolutions locked in `10-CONTEXT.md` § "Post-research amendments" (D-10-09 = Q-3) and "Post-research findings to lock" (Q-1, Q-2, Q-4 and the practical effects of Q-5 on the column).

1. **Q-1 (RESOLVED — accept recommendation): Does gitnexus's `registry.json` `path` field store the realpath form, the user-supplied form, or both?**
   - What we know: gitnexus@1.6.4 since PR #664 (review by @evander-wang) canonicalises paths at write time via `canonicalizePath` (= `realpathSync.native` with fallback). Older entries may use raw `path.resolve()`.
   - What's unclear: whether the daemon-side scanner needs to canonicalise repoAbsPath before comparison.
   - Recommendation: Match by trying BOTH `repoAbsPath` AND `realpathSync(repoAbsPath)`. Cost is one extra stat per uncached repo.

2. **Q-2: When the wiki has been compiled but `.compile-state.json` is corrupt or partial, what state?**
   - What we know: factiv has a valid file. agenticapps and neuroflash have NO file (configs exist, never compiled). No corrupt-file case seen in the wild yet.
   - What's unclear: realistic failure mode.
   - Recommendation: Treat parse failure as `stale` with subtext "compile-state.json invalid" — recoverable by re-compile.

3. **Q-3: How does the daemon invoke `wiki-compile`?**
   - What we know: `/wiki-compile` is a Claude Code slash command (`~/Sourcecode/agenticapps/wiki-builder/plugin/commands/wiki-compile.md`), NOT an npm binary. Its instructions say "invoke the wiki-compiler skill" — that skill is markdown directing Claude Code to do classification work. There is no headless runner.
   - What's unclear: how to make the "Refresh wiki" button actually do anything from a daemon spawn.
   - Recommendation: For v1.0, **wiki refresh is clipboard-only** (the SPA copies `cd ~/Sourcecode/<family> && claude /wiki-compile` to clipboard with a toast). The "daemon-spawns when safe" applies to gitnexus only. Document the limitation in the page UI. **Defer wiki daemon-spawn to a follow-up phase** that either ships a CLI wrapper for the wiki-compiler plugin or uses `claude code -p` headless invocation (currently experimental).

4. **Q-4: Should the override-chip click handler call back to the daemon for `git log`-derived "since" timestamps, or is mtime good enough at render time?**
   - What we know: The daemon already runs `git log -1` in `git.ts` (`runAllowedGit`). Adding the call to the override scanner adds ~5-20ms per sentinel.
   - What's unclear: whether mtime would mislead users when sentinels are checked into git (the git commit timestamp is the "authentic" one).
   - Recommendation: Daemon enriches with git-log timestamp during the scan; SPA renders directly. Cost is bounded by # sentinels (currently 0 — typical usage will be tiny).

5. **Q-5: What's the "stale" threshold semantics for the GitNexus column when a repo has never been indexed?**
   - What we know: GitNexus stale at > 14 days. "Never indexed" = not in registry.
   - What's unclear: Is "never indexed" `missing` or `stale`?
   - Recommendation: `missing` (red) — the user should know they haven't run the initial `gitnexus analyze`. The 14-day threshold applies only to indexed repos that have aged out. This aligns with the CONTEXT.md COV-11 four-state vocabulary.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | All daemon code | ✓ | 20+ (per package.json engines) | — |
| pnpm 9+ | Workspace tooling | ✓ | 10.33.2 | — |
| git (CLI) | overrideSentinelScanner.ts `git log -1` | ✓ (every dev machine) | system default | mtime fallback already coded |
| ~/Sourcecode/agenticapps/claude-workflow/migrations/ | workflowVersionScanner.ts head detection | ✓ | up to 0007 | head=null fallback (scanner treats every repo as `fresh` — degraded but non-crashing) |
| ~/Sourcecode/{agenticapps,factiv,neuroflash}/ | repoDiscovery.ts | ✓ | 45 repos | per-family existsSync gate skips missing families |
| ~/.gitnexus/ | gitNexusScanner.ts | ✗ | — | `not-applicable` state per COV-10 (BY DESIGN — this is the canonical empty case) |
| gitnexus CLI on PATH | coverageSpawn.ts `spawnGitNexusAnalyze` | ✗ | — | `kind: 'not-installed'` — SPA shows install hint |
| `/wiki-compile` runner | coverageSpawn.ts wiki refresh | ✗ (no headless runner exists) | n/a | **Clipboard-only for v1.0 per Q-3** |
| TanStack Router v1.x | Lazy route registration | ✓ | catalog | — |
| Tailwind v4 tokens.css | Coverage panel styling | ✓ | catalog (Phase 5.1 lock) | — |

**Missing dependencies with no fallback:** None — all blockers have graceful degradation paths.

**Missing dependencies with fallback:**
- `~/.gitnexus/` absent → entire GitNexus column shows `not-applicable` with install hint. Verified flow.
- gitnexus binary not on PATH → `spawnGitNexusAnalyze` returns `kind: 'not-installed'`; SPA shows install hint instead of broken state.
- wiki-compile not headlessly runnable → clipboard-only refresh path (no daemon spawn). Documented in page UI.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (workspace catalog version) |
| Config files | `packages/agent/vitest.config.ts`, `packages/spa/vitest.config.ts`, `packages/spa/vitest.subprocess.config.ts` |
| Quick run command | `pnpm --filter @agenticapps/dashboard-agent test` (per-package, ~30s) |
| Full suite command | `pnpm -r test` (~3-4min — 1160+ tests across workspace) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COV-01 | `GET /api/coverage` returns 4-column matrix with valid Zod parse on both ends | integration | `pnpm --filter @agenticapps/dashboard-agent test -- coverage.test.ts` | Wave 0 |
| COV-02 | `resolveAllowedNamed` rejects external paths outside the 4 new roots; SPA never sees an external path string | unit + e2e | `pnpm --filter @agenticapps/dashboard-agent test -- paths.test.ts` + grep `'/api/projects/.*/read'` against external roots = 0 hits | Wave 0 |
| COV-03 | Memo cache: first call computes, second within 30s returns same instance; cleared on POST /refresh | unit | `pnpm --filter @agenticapps/dashboard-agent test -- coverageCache.test.ts` | Wave 0 |
| COV-04 | POST /refresh routes to spawn or clipboard based on action; spawn never executes `npx`; clipboard actions return a string | unit | `pnpm --filter @agenticapps/dashboard-agent test -- coverageSpawn.test.ts` | Wave 0 |
| COV-05 | `<CoverageFamilySection>` renders sticky header with filter-aware counts; collapse persists in localStorage | component | `pnpm --filter @agenticapps/dashboard-spa test -- CoverageFamilySection.test.tsx` | Wave 0 |
| COV-06 | Toolbar chip multi-select + search; URL search-param round-trips | component | `pnpm --filter @agenticapps/dashboard-spa test -- CoverageToolbar.test.tsx` | Wave 0 |
| COV-07 | Override chip renders ONLY when count > 0; click expands list with phase slugs + ISO dates | component | `pnpm --filter @agenticapps/dashboard-spa test -- OverrideChip.test.tsx` + unit on `overrideSentinelScanner.test.ts` | Wave 0 |
| COV-08 | workflowVersionScanner picks highest migration `to_version`; compares semver against installed; handles 5 cases | unit | `pnpm --filter @agenticapps/dashboard-agent test -- workflowVersionScanner.test.ts` (cases: equal/behind/ahead/missing-skill/missing-version) | Wave 0 |
| COV-09 | Sidebar renders Observability section with single Coverage entry between Projects and Help | component | `pnpm --filter @agenticapps/dashboard-spa test -- Sidebar.test.tsx` (snapshot or text-order assertion) | EDIT existing test |
| COV-10 | When `~/.gitnexus/` absent, all rows GitNexus column = `not-applicable`; banner renders | integration + component | agent: `gitNexusScanner.test.ts` with HOME=tmpdir; spa: `CoverageGitNexusBanner.test.tsx` | Wave 0 |
| COV-11 | All 4 states render with correct icon + color tokens per state | component (snapshot or DOM assertion) | `pnpm --filter @agenticapps/dashboard-spa test -- CoverageCell.test.tsx` | Wave 0 |
| COV-12 | Migration 0008 exists with valid frontmatter; verify script passes pre-flight | smoke | `bash claude-workflow/migrations/0008-coverage-matrix-page.md` block via test-fixtures pattern (mirrors migrations 0005-0007 test fixtures) | Wave 0 |
| INV-01 | No daemon route writes to a registered project — `git diff --stat` after a refresh shows no changes to project source | manual (UAT) | Recorded in HUMAN-UAT.md | — |
| INV-02 | `~/.agenticapps/dashboard/` files still 0600 post-deploy | manual / smoke | existing daemon refuse-to-start guard | inherited |
| INV-03 | Page renders fully when GitNexus + wiki + sentinels all absent | component | `CoveragePage.test.tsx` empty-state case | Wave 0 |
| INV-04 | Schema drift triggers `<SchemaDriftState>` per panel | unit | `coverageQueries.test.ts` mock drift | Wave 0 |
| INV-05 | `packages/agent/package.json` has no new native deps | smoke | `grep -E "keytar\|ffi" packages/agent/package.json && exit 1` | Phase 6 inherited |

### Sampling Rate

- **Per task commit:** `pnpm --filter <pkg> test -- <changed-file>.test.ts` (sub-30s)
- **Per wave merge:** `pnpm -r test` (full ~3-4min)
- **Phase gate:** `pnpm -r typecheck && pnpm -r test && pnpm -r build` green before `/gsd-verify-work`; plus impeccable ≥ 90 on `/coverage` at 1440×900; plus `/cso` audit on cross-family scanner.

### Wave 0 Gaps

- [ ] `packages/shared/src/schemas/coverage.ts` — Zod schemas (Wave 0 task)
- [ ] `packages/shared/src/schemas/coverage.test.ts` — schema validation tests
- [ ] `packages/agent/src/lib/coverageScan.test.ts` — orchestrator unit tests (mocks per-scanner)
- [ ] `packages/agent/src/lib/scanners/*.test.ts` — one test file per scanner (5 files)
- [ ] `packages/agent/src/lib/coverageCache.test.ts` — TTL + invalidation
- [ ] `packages/agent/src/lib/coverageSpawn.test.ts` — execa mocking pattern (mirror agentLinterRunner.test.ts)
- [ ] `packages/agent/src/routes/coverage.test.ts` — Hono route tests (200/400/500/cache hit)
- [ ] `packages/spa/src/components/panels/coverage/*.test.tsx` — 8 component test files
- [ ] `packages/spa/src/lib/coverageQueries.test.ts` — TanStack Query hook tests
- [ ] `packages/spa/src/components/ui/Sidebar.test.tsx` — UPDATE existing test for Observability section

## Security Domain

Phase 10 introduces a new cross-family filesystem trust boundary. `/cso` audit is MANDATORY (per CONTEXT.md §scope).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing bearer-token middleware (inherited app.ts) — no per-route auth code |
| V3 Session Management | yes | Inherited Phase 1 D-13/D-14/D-15 token rotation |
| V4 Access Control | yes | `resolveAllowedNamed` for path scope; basename allow-list; realpath defence |
| V5 Input Validation | yes | Zod schemas (CoverageRefreshRequestSchema) on body; `validateSearch` on URL params |
| V6 Cryptography | no | No new crypto material introduced |
| V11 Business Logic | yes | Override chip cannot be spoofed by SPA (count derives from filesystem only) |
| V12 Files & Resources | yes | Path traversal defence (existing); read-only on project FS (INV-01) |
| V13 API & Web Service | yes | CORS lock inherited; bearer-token inherited; outbound() schema-drift defence per route |

### Known Threat Patterns for {Daemon + Cross-Family Scanner}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via repo name (`../../etc/passwd`) | Tampering | `resolveAllowedNamed` realpath + basename allow-list (Phase 1 D-23 / Phase 5 D-5-13 — same primitive); repo names are discovered via readdir (never SPA-supplied) |
| Symlink escape from family root | Tampering | `realpath` resolution before prefix-check (existing in paths.ts) |
| Subprocess injection via repo name | Tampering | All subprocess calls use `execa(cmd, argv[])` or `execFileSync(cmd, argv[], opts)` — argv-array form only; never shell strings (verified pattern in agentLinterRunner.ts and git.ts); repo name only used as `cwd:` not as an arg |
| Supply-chain hijack of `gitnexus` package | Tampering / RCE | NEVER `npx`; only PATH-resolved binary (system-installed by user via migration 0007). When absent → graceful `not-installed` |
| Token leak via subprocess env | Information Disclosure | execa default inherits env — Phase 5 reviewed this; the bearer token lives in `~/.agenticapps/dashboard/auth.json` and is NOT read into process.env. Daemon never sets it as env. Spawn inherits process.env which doesn't carry the bearer |
| Stale cache showing wrong matrix after a refresh | Repudiation (audit confusion) | `POST /coverage/refresh` clears entire memo (Claude's Discretion default); next `GET` re-scans |
| SSRF via external host in spawned subprocess | n/a | gitnexus does not make outbound requests for `analyze` (it processes local FS); wiki-compile is clipboard-only |
| Sentinel forgery to suppress override chip | Tampering | Sentinel detection is presence-based — there's no "fake sentinel"; if it's there, it's there. The override chip *surfaces* the file's existence; deleting it removes the chip (which is the intent of the override-skip mechanism). Audit signal is `git log` provenance |
| Reading secret material in CLAUDE.md | Information Disclosure | CLAUDE.md scanner uses `existsSync` only — content is NEVER read or surfaced by `/api/coverage` |
| Reading wiki content | Information Disclosure | Wiki scanner reads `.compile-state.json` ONLY (metadata) — never source markdown or compiled content |

## Sources

### Primary (HIGH confidence — verified via tool or direct file inspection this session)

- `/Users/donald/Sourcecode/factiv/.knowledge/wiki/.compile-state.json` — confirmed canonical wiki freshness signal: `last_compiled: "2026-05-12"`, YYYY-MM-DD format
- `/Users/donald/Sourcecode/agenticapps/wiki-builder/plugin/hooks/wiki-session-context:38-46` — confirmed `.compile-state.json` is the plugin's own source of truth
- `/Users/donald/Sourcecode/agenticapps/wiki-builder/plugin/commands/wiki-lint.md:12` — corroborating reference to `.compile-state.json`
- `npm install -g gitnexus` install of `gitnexus@1.6.4` then read of `dist/storage/repo-manager.{js,d.ts}` — confirmed registry schema is `RegistryEntry[]` (top-level array)
- `/Users/donald/Sourcecode/agenticapps/claude-workflow/migrations/0000..0007-*.md` — all 8 confirmed to have `^to_version:` in frontmatter
- `/Users/donald/Sourcecode/agenticapps/claude-workflow/templates/.claude/hooks/multi-ai-review-gate.sh:53` — confirmed sentinel filename `multi-ai-review-skipped`
- `/Users/donald/Sourcecode/agenticapps/agenticapps-dashboard/.claude/skills/agenticapps-workflow/skill/SKILL.md` — confirmed dashboard's own skill has NO `version:` field
- `/Users/donald/Sourcecode/factiv/cparx/.claude/skills/agentic-apps-workflow/SKILL.md` — confirmed `version: 1.3.0` present
- `find /Users/donald/Sourcecode -name multi-ai-review-skipped` — confirmed ZERO sentinels exist currently
- `/Users/donald/Sourcecode/agenticapps/agenticapps-dashboard/packages/agent/src/lib/paths.ts` — confirmed `resolveAllowedNamed` shape (paths.ts:97-137)
- `/Users/donald/Sourcecode/agenticapps/agenticapps-dashboard/packages/agent/src/lib/skillsScan.ts` — confirmed `parseFrontmatter()` handles all needed YAML cases
- `/Users/donald/Sourcecode/agenticapps/agenticapps-dashboard/packages/agent/src/lib/agentLinterRunner.ts` — confirmed vendored-binary spawn pattern (createRequire + pkg.bin + execa argv-array)
- `/Users/donald/Sourcecode/agenticapps/agenticapps-dashboard/packages/agent/src/routes/skills.ts` — confirmed singleton route + in-module memo cache template
- `/Users/donald/Sourcecode/agenticapps/agenticapps-dashboard/packages/spa/src/router.tsx` — confirmed `appShellLayoutRoute.addChildren()` + lazy-route mount pattern
- `/Users/donald/Sourcecode/agenticapps/agenticapps-dashboard/packages/spa/src/components/ui/Sidebar.tsx` — confirmed existing OBSERVE placeholder section to re-purpose

### Secondary (MEDIUM confidence — cross-referenced from canonical workflow ADRs/migrations)

- `~/Sourcecode/agenticapps/claude-workflow/docs/decisions/0018-multi-ai-plan-review-enforcement.md` — hook 6 design rationale + override surface enumeration
- `~/Sourcecode/agenticapps/claude-workflow/docs/decisions/0019-llm-wiki-compiler-integration.md` — `.wiki-compiler.json` per-family scoping; output layout
- `~/Sourcecode/agenticapps/claude-workflow/docs/decisions/0020-gitnexus-code-graph-integration.md` — GitNexus multi-repo registry rationale (note: ADR's jq verify snippet uses wrong schema)
- `~/Sourcecode/agenticapps/claude-workflow/migrations/0005-multi-ai-plan-review-enforcement.md` — hook install steps + override sentinel naming
- `~/Sourcecode/agenticapps/claude-workflow/migrations/0006-llm-wiki-builder-integration.md` — wiki plugin install + `.knowledge/wiki/` output dir layout
- `~/Sourcecode/agenticapps/claude-workflow/migrations/0007-gitnexus-code-graph-integration.md` — gitnexus install (note: verify script has the `jq '.repos | length'` bug)

### Tertiary (LOW confidence — verify before relying)

- gitnexus's behaviour when re-indexing after a repo rename: gitnexus tries to preserve a custom alias (`hasCustomAlias`), but un-aliased repos get re-derived. Phase 10 doesn't trigger this; flagged for future.
- Whether `/wiki-compile` could be invoked via `claude code --print --slash-command wiki-compile` (a hypothetical headless entry point): unverified. Q-3 defers wiki spawn entirely.
- Whether TanStack Router's `validateSearch` errorComponent behaves identically for `/coverage` as it did for `/pair`: high confidence given Phase 7's precedent (router.tsx:38-55), but a smoke test in the first plan should confirm.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries already in workspace and tested in 8 prior phases
- Architecture: HIGH — every pattern composes a verified Phase 1-7 primitive; no new architectural primitive introduced
- Pitfalls: HIGH — pitfalls 1, 3, 4, 5, 6, 7 are all verified against on-disk artifacts; pitfalls 2 and 8 are inferred from the spec but well-grounded
- Schemas (gitnexus registry, wiki compile-state): HIGH — both verified by direct file/source inspection this session
- Migration / workflow head detection: HIGH — frontmatter `to_version` present in all 8 inspected migration files
- Subprocess spawn for wiki-compile: LOW — there is no headless runner; clipboard-only is the v1 fallback (Q-3)
- ~/.gitnexus path-match canonicalisation: MEDIUM — gitnexus canonicalises since #664 but old entries may use raw path.resolve (A1)

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (30 days — stable codebase, no library version churn expected)
