# Phase 4: Single-project View — Discipline + Phase Progress - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

A `/projects/{id}` route that replaces the Phase 3 placeholder with a real header + Discipline column (left) + Phase Progress column (center). Right column (Health) is reserved for Phase 5. Driven entirely by reads from:

- `.planning/phases/<latest>/{CONTEXT,RESEARCH,UI-SPEC,PLAN-XX,SUMMARY-XX,REVIEW,REVIEW-FIX,*-REVIEW,SECURITY,IMPECCABLE,VERIFICATION,HUMAN-UAT}.md`
- `.planning/skill-observations/*.md` (commitment blocks, latest by mtime)
- `.planning/skill-observations/*.jsonl` (HookFirings + RationalizationFires events)
- `.claude/skills/agenticapps-workflow/skill/SKILL.md` (rationalization-row labels source)
- `.claude/skills/meta-observer/SKILL.md` (presence detection for DISC-04 install hint)
- `git log --format=%s` filtered to `test(... RED ...)` / `feat(... GREEN ...)` (ExecutionTimeline)
- `git symbolic-ref --short HEAD` (branch — already in projectOverview.ts)

**Read-only on the project filesystem.** No daemon route writes to `<projectRoot>/...` — the path allow-list (Phase 1 D-23) keeps reads under `.planning/.claude` only. The single allow-list exception (`POST /api/projects/{id}/open` editor spawn) is NOT in scope for Phase 4.

In scope (REQUIREMENTS Phase 4):

- DISC-01 CommitmentBlock — last `## Workflow commitment` block from `.planning/skill-observations/*.md`
- DISC-02 HookFirings — last 20 hook events from `.planning/skill-observations/*.jsonl`
- DISC-03 RationalizationFires — counter per rationalization-table row that fired, keyed off the project's installed agenticapps-workflow skill
- DISC-04 install hint — when meta-observer skill is missing, panel shows install command (no crash)
- PHASE-01 PhaseProgress — file-by-file checklist for the latest phase
- PHASE-02 ExecutionTimeline — TDD red/green commit pairs grouped per task
- PHASE-03 ReviewStatus — Stage 1/2 status, finding counts by severity (parsed from `<finding severity="...">` blocks; reuses Phase 3 `parseReviewFile`)
- PHASE-04 SecurityStatus — `/cso` `*-SECURITY.md` summary (database-sentinel summary if its report file exists)
- PHASE-05 VerificationStatus — must_haves vs evidence count (reuses Phase 3 `parseVerification`)
- Replace `packages/spa/src/routes/projects.$projectId.lazy.tsx` placeholder with real `<SingleProjectView />`

Out of scope (later phases):

- Right column (HEALTH-01..05): InstalledSkills, SkillHealth, ObservabilityHealth, SecretsHealth, IntegrationsHealth — Phase 5
- Header line 2 (`Linear: ACME-123` badge, `ADR last touched 2 days ago`, `[⚙ project settings]`) — Phase 5/6
- Hover-expand / progressive disclosure on panels — explicitly rejected by D-4-13
- `POST /api/projects/{id}/open` editor spawn for "open in editor" buttons next to filenames — Phase 5/6 polish
- Sub-route `/projects/{id}/settings` — Phase 6
- impeccable ≥ 90 hard gate — Phase 6 (POLISH-04). Phase 4 inherits Phase 2/3 anti-slop discipline; the critique gate measures these in Phase 6.
- Pagination / virtualisation for HookFirings — only 20 lines, never needed
- Persistence of any UI state across sessions — out of scope (Phase 6 polish concern)

</domain>

<decisions>
## Implementation Decisions

### Endpoint shape & data flow

- **D-4-01:** **Panel-split daemon endpoints, not a composite view route.** Five small Hono routes:
  - `GET /api/projects/:id/commitment` — returns `{ markdown: string | null, sourceFile: string | null }` for the most recent `## Workflow commitment` block.
  - `GET /api/projects/:id/observations/recent?limit=20` — returns `{ entries: HookFiring[] }`. Spec line 344 already lists this route.
  - `GET /api/projects/:id/phase-progress` — returns `{ phase: string|null, files: PhaseFileStatus[], tdd: { greenPairs, totalTasks, timeline: ExecutionTimelineEntry[] }, review: ReviewStatusPayload, verification: VerificationStatusPayload }`. Composes the bulk of the center column in one call to avoid five separate cache keys for closely-coupled data.
  - `GET /api/projects/:id/security` — returns `{ cso: CsoSummary | null, dbSentinel: DbSentinelSummary | null }` for PHASE-04.
  - `GET /api/projects/:id/discipline` — returns `{ rationalization: { rows: { label: string, fires: number }[] } }` for DISC-03's per-row counters (HookFirings stays on observations route; commitment stays on its own route to keep the slow markdown read isolated from the JSONL counter).
  - Each route has its own 5s daemon-side memo so a schema-drift on one panel doesn't blank the whole detail page (mirrors Phase 3 D-01's per-card fan-out + D-08 field split).
- **D-4-02:** **5 s polling cadence, 5 s daemon memo, `refetchIntervalInBackground: false`.** Inherits Phase 3 D-02 + D-03 verbatim. All Phase 4 SPA queries use `staleTime: 5_000` + `refetchInterval: 5_000`. Daemon-side memo: `Map<projectId, { value, expiresAt }>` per route with lazy expiry on read (same pattern as `lib/overviewCache.ts`). Tab-hidden pauses; on visible, queries refetch immediately.
- **D-4-03:** **Reuse and extend `packages/agent/src/lib/projectOverview.ts` parsers — don't fork.** Phase 3 already wrote `parseReviewFile`, `parseVerification`, `parseTddPairs`, `detectBranch`, `findLatestPhaseDir`, `detectMarkers`. Phase 4 adds (in the same file or a sibling `lib/phaseDetail.ts`): `parseCommitmentBlock`, `readSkillObservations`, `parseRationalizationRows`, `parsePhaseChecklist`, `parseExecutionTimeline` (extends `parseTddPairs` to also return per-task grouping), `parseSecurityReports`. Single source of truth for parsing; tests live alongside.
- **D-4-04:** **Daemon-side cache key = (projectId + route name).** Five maps or one nested map; planner picks. Cache eviction lazy on read (Phase 3 pattern). No background sweeper unless latency suffers.

### Discipline-panel parsing rules

- **D-4-05:** **CommitmentBlock source = latest `.planning/skill-observations/*.md` by mtime.** Reader algorithm:
  1. `readdir(projectRoot/.planning/skill-observations/, { withFileTypes: true })`
  2. Filter `.md` files; pick the one with the highest `mtimeMs`.
  3. Read its contents; find the LAST occurrence of `^## Workflow commitment\s*$` (anchored as a markdown H2).
  4. Return everything from that heading to the next `^## ` (any H2) or EOF, excluding the next heading itself.
  - Empty/null states (no dir → triggers DISC-04 install hint; dir exists but no `.md` files; file exists but no commitment heading) all surface as `{ markdown: null, sourceFile: null }`.
- **D-4-06:** **`HookFiringSchema` = `{ ts: ISO8601, skill: string, hook: string, payload?: unknown }`.** Implemented as `z.object({ ts, skill, hook }).passthrough()` so unknown fields from a future meta-observer release don't trip schema-drift. SPA renders `ts` (relative time) + `skill` (bold) + `hook` (badge). Unknown fields ignored visually but preserved in the cached query data for future expansion.
- **D-4-07 (amended 2026-05-06 — UAT G2):** **`RationalizationFires` row labels parsed at request time from the project's workflow skill SKILL.md rationalization markdown table, probing both canonical and bundle layouts.** Algorithm:
  1. Probe these paths in order, picking the first that exists (all under `.claude` allow-list):
     - `<projectRoot>/.claude/skills/agentic-apps-workflow/SKILL.md` (canonical; matches `cli/discover.ts:18` and the workflow skill's own `name:` field)
     - `<projectRoot>/.claude/skills/agentic-apps-workflow/skill/SKILL.md` (canonical with bundle subdir)
     - `<projectRoot>/.claude/skills/agenticapps-workflow/SKILL.md` (legacy hyphen-less, single-file)
     - `<projectRoot>/.claude/skills/agenticapps-workflow/skill/SKILL.md` (legacy hyphen-less, bundle — the original `git clone` target)
  2. Find the rationalization markdown table (canonical heading per the skill — researcher confirms exact heading, e.g. `## Rationalizations to watch for` or `## Rationalization Table`).
  3. Extract first column of each row as a label, skipping the header row.
  4. Counter aggregates JSONL hook events from `.planning/skill-observations/*.jsonl` whose `payload.row` (or equivalent field per D-4-06 passthrough shape) matches a label.
  - Self-updating: when the workflow skill adds rows in a future release, the dashboard adapts on next reload. No dashboard release coupling.
  - Empty state when no SKILL.md found at any candidate path: panel shows "agentic-apps-workflow skill not installed in this project" with `claude skill install agentic-apps-workflow` (display name + install command both use the canonical hyphenated form per the skill's `name:` field).
  - **Amendment rationale (UAT G2, 2026-05-06):** Original locked decision hardcoded only the bundle layout (`agenticapps-workflow/skill/SKILL.md`), producing false-negative install hints for projects on the canonical single-file layout (`agentic-apps-workflow/SKILL.md`) that the workflow README documents and that `cli/discover.ts` already detects. The amended probe order keeps the original path as a fallback (no behavior change for existing bundle installs) while adding the canonical layout that real projects actually use.
- **D-4-08:** **HookFirings recency = last 20 lines globally across `.planning/skill-observations/*.jsonl` by line `ts` desc.** Daemon walks all `.jsonl` (and `.ndjson` if present) files, parses each line as JSON, sorts by `ts` desc across all files, returns top 20. Implemented as a streaming read (don't load all session files into memory; use `node:readline` per file, then merge top-N with a small heap) — researcher picks the exact pattern. Robust to per-file line counts (a quiet last session doesn't blank the panel if prior session had activity).

### Layout: header + 3-column shell

- **D-4-09:** **2-column CSS grid in Phase 4; Phase 5 widens to 3-col.** `<SingleProjectView />` root: `grid-template-columns: 1fr 1.5fr` (left = 1, center = 1.5 — center holds more panels and benefits from extra width). Phase 5 changes one rule to `1fr 1.5fr 1fr` and adds the right-column components without touching anything else. Page reads as a complete two-column detail view today — no visible "work in progress" stubs.
- **D-4-10:** **Header = single line per spec ASCII line 472, minus deferred bits.** Render: `← All Projects · {name} ({client?}) · {branch ?? '(no branch)'} · phase {paddedPhase} — {status}`. Drop the second line (`Linear: ACME-123 · ADR last touched 2 days ago · [⚙ project settings]`) entirely — Linear detection + ADR-touched detection + settings page are Phase 5+ deferred items. Header height stays compact.
- **D-4-11:** **One component per panel under `packages/spa/src/components/panels/`:**
  - `panels/CommitmentBlock.tsx` (DISC-01)
  - `panels/HookFirings.tsx` (DISC-02)
  - `panels/RationalizationFires.tsx` (DISC-03)
  - `panels/PhaseProgress.tsx` (PHASE-01)
  - `panels/ExecutionTimeline.tsx` (PHASE-02)
  - `panels/ReviewStatus.tsx` (PHASE-03)
  - `panels/SecurityStatus.tsx` (PHASE-04)
  - `panels/VerificationStatus.tsx` (PHASE-05)
  - `SingleProjectView.tsx` composes them via the 2-col grid.
  - Each panel is independently testable (vitest component tests). Phase 5 adds new panels to the same dir without restructuring.
- **D-4-12:** **Replace `routes/projects.$projectId.lazy.tsx` body with `<SingleProjectView projectId={projectId} />`.** The current placeholder ("Phase 4 work — three-column view lands soon") is removed entirely. Page title still updates per `useEffect` to `${projectId} — AgenticApps Dashboard` (or a richer name once `/api/registry` provides it).

### Empty / missing / install-hint states

- **D-4-13:** **Panels are always-expanded — no progressive disclosure.** This is a detail page; the user clicked through specifically to see everything. No hover-expand, no max-height transitions, no animation budget to police. Removes the D-43 (Phase 3) rotate/scale/glow risk surface entirely for Phase 4. Different UX role from the home cards (D-34, Phase 3) — consistent rationale, different choice.
- **D-4-14:** **Per-panel empty states render the panel with explicit "no data yet" copy. No skeletons, no hide-on-empty.** Layout stays stable across project states. Specific copy:
  - CommitmentBlock no source → `No commitment block found. The latest session may not have emitted one yet.`
  - HookFirings no JSONL → renders DISC-04 install hint (D-4-15) — distinct from "skill installed but no hooks fired yet" which renders `No hook firings yet — try running a `/review` or `/cso`.`
  - RationalizationFires no agenticapps-workflow skill → install hint (parallel to D-4-15 but for that skill).
  - RationalizationFires installed but no fires → renders the table with all rows showing `0 fires` (positive signal).
  - PhaseProgress no `.planning/phases/<latest>/` → `No phase work yet. Run `/gsd-discuss-phase` or `/gsd-plan-phase` to start.`
  - ExecutionTimeline no `test(RED)`/`feat(GREEN)` commits → `No TDD commits yet for this phase.`
  - ReviewStatus no review files → `No review run yet — try `/review` or `/gsd-code-review`.`
  - SecurityStatus no `*-SECURITY.md` → `No /cso audit yet for this phase.`
  - VerificationStatus no `*-VERIFICATION.md` → `No verification run yet — try `/gsd-verify-work`.`
- **D-4-15 (amended 2026-05-06 — UAT G2):** **DISC-04 install hint** — when no `meta-observer` SKILL.md is found at either `<projectRoot>/.claude/skills/meta-observer/SKILL.md` (canonical single-file) or `<projectRoot>/.claude/skills/meta-observer/skill/SKILL.md` (bundle), the HookFirings panel shows:
  ```
  No skill-observations yet
  ─────────────────────────
  The meta-observer skill is not installed in this project.

  $ claude skill install meta-observer

  [copy] (button)
  ```
  - Detection: daemon's `/api/projects/:id/observations/recent` returns `{ entries: [], skillInstalled: false }` (or a 404-style envelope — schema TBD by planner; `skillInstalled` flag is the contract).
  - Exact CLI command (`claude skill install meta-observer` vs `claude plugin install ...` vs whatever the agenticapps-workflow skill mandates) → researcher confirms; if uncertain, planner ships with a placeholder + TODO marker for Phase 5 cleanup.
  - Copy button uses `navigator.clipboard.writeText` with a fallback selectable `<code>` block. No external clipboard libraries.
- **D-4-16:** **ReviewStatus reads from latest phase only.** Files read: `.planning/phases/<latest>/REVIEW.md`, `REVIEW-FIX.md`, plus any `*-REVIEW.md` (e.g. Phase 3 wrote `03-IMPECCABLE.md` and the like — exclude those; only `*-REVIEW.md` filename pattern counts). Reuses Phase 3's `parseReviewFile` which already supports both the frontmatter-stored counts (fast path: `critical: 5`, `warning: 12`, `info: 0`) and `<finding severity="...">` block counting (accurate path). Aggregated finding counts surface as the four-bucket display: `🔴 critical · 🟠 high · 🟡 medium · ⚪ low` (matching CSO severity buckets — coordinate with Phase 3 D-36 glyph rules; finalise with planner once SecurityStatus is wired).

### Claude's Discretion

- **TanStack Query cache key shapes.** Suggested: `['commitment', projectId]`, `['observations', projectId]`, `['phase-progress', projectId]`, `['security', projectId]`, `['discipline', projectId]`. Planner finalises (e.g. whether to add a `phaseId` segment for cache invalidation when the latest phase advances).
- **Daemon-side cache structure.** Single `Map<string, { value, expiresAt }>` keyed by `${projectId}:${route}` vs five separate maps. Phase 3's `lib/overviewCache.ts` is the reference pattern; planner picks generalize-vs-duplicate.
- **`parseExecutionTimeline` grouping logic.** Spec PHASE-02 says "TDD red/green pairs grouped per task". A commit subject like `test(03-04): add failing tests for foo` and `feat(03-04): implement foo` group under task `03-04`. Subject regex extracting the `(NN-NN)` task ID is open; planner finalises.
- **PhaseProgress checklist file ordering.** Suggested order: `CONTEXT.md → RESEARCH.md → UI-SPEC.md (if exists) → DISCUSSION-LOG.md (if exists) → 04-01-PLAN.md, 04-01-SUMMARY.md (each plan's pair, ordered) → REVIEW.md → REVIEW-FIX.md (if exists) → SECURITY.md → IMPECCABLE.md → VERIFICATION.md → HUMAN-UAT.md`. Researcher confirms the canonical list from prior phase artifacts.
- **`PhaseFileStatusSchema` exact field names.** Suggested: `{ name: string, present: boolean, mtimeIso: string|null }`. Planner can rename for consistency with `ProjectOverviewSchema` field naming (Phase 3 D-08 left `mustHaves` vs `must_haves` to planner discretion; Phase 4 carries the same flexibility).
- **`HookFiringSchema` payload field shape.** D-4-06 keeps `payload?: unknown` with passthrough; if researcher discovers a stable meta-observer event vocabulary, schema can lock specific event types as a discriminated union. Otherwise stay tolerant.
- **`navigator.clipboard.writeText` fallback path** (D-4-15). Planner picks: `document.execCommand('copy')` legacy fallback vs simply selecting the text and showing a "press ⌘C to copy" hint. Either works; legacy fallback is more robust.
- **Test layout per package.** Suggested: `lib/projectOverview.test.ts` extended with new parser tests + new `lib/phaseDetail.test.ts` if parsers move there. Each new route file gets a `routes/{name}.test.ts` (in-process Hono test, see Phase 1's pattern). SPA: each panel gets a `panels/{Name}.test.tsx` component test; one `SingleProjectView.test.tsx` integration test wiring happy + empty paths through MSW or in-test fetch mock.
- **Linear-style branch detection.** Spec line 478 says `Linear: ACME-123` is a static link surfacing only when a Linear-style branch/commit reference is detected. Phase 4 deferred this (D-4-10 dropped header line 2). If the planner finds adding it cheap (a regex on branch name), they may slip it under "Claude's discretion" — but only the badge text + link, not the panel.

### Folded Todos

None — no pending todos surfaced in cross-reference (`gsd-tools list-todos` returned 0).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec (binding)

- `docs/spec/dashboard-prompt.md` §"Page layout — single project (`/projects/{id}`)" lines 465–505 — header anatomy, three-column structure, panel definitions. D-4-09, D-4-10, D-4-11 implement this directly.
- `docs/spec/dashboard-prompt.md` §"API surface (Hono routes)" lines 320–370 — `/api/projects/:id/read`, `/git`, `/observations/recent`, `/agentlinter` (Phase 5), `/skills/local` (Phase 5). D-4-01 panel-split route names align with this list.
- `docs/spec/dashboard-prompt.md` §"Acceptance criteria" item 5 (line 584) — every panel renders OR shows graceful empty state with hint. D-4-14, D-4-15 implement this.
- `docs/spec/dashboard-prompt.md` §"Constraints I want preserved" + §"Anti-features" lines 686–712 — read-only on project FS, registry/auth/env writes confined to `~/.agenticapps/dashboard/`, bearer-token on every route, CORS lock, no native deps. INV-01..05 carry into Phase 4 unchanged.
- `docs/spec/dashboard-prompt.md` §"Visual style" lines 548–554 — anti-AI-slop self-test, dark default, restrained palette, distinctive typography. Phase 4 inherits Phase 2 D-01..D-03 + Phase 3 D-42..D-44.
- `docs/spec/dashboard-prompt.md` §"Implementation phasing" Phase 4 bullet (lines 631–636) — explicit four-deliverable scope.
- `docs/spec/dashboard-prompt.md` §"Shared types (`packages/shared/`)" lines 558–572 — names `PhaseProgressSchema`, `HookFiringSchema`, `CommitmentBlockSchema`, `FindingSchema`. D-4-06 + D-4-11 + planner's schema additions land here.

### Project-level planning artifacts

- `.planning/PROJECT.md` — vision, hard tech-stack lock (Vite + React 18 + TS + Tailwind + TanStack Query + Zod + lucide-react on the SPA; Node 20 + Hono + Zod + execa on the daemon), key decisions table.
- `.planning/REQUIREMENTS.md` — REQ-IDs in scope: DISC-01, DISC-02, DISC-03, DISC-04, PHASE-01, PHASE-02, PHASE-03, PHASE-04, PHASE-05. INV-01..05 carry forward unchanged.
- `.planning/ROADMAP.md` Phase 4 entry — depends on Phase 3, success criteria 1–5 (subset of the REQUIREMENTS list — full REQUIREMENTS scope is binding per spec phasing).
- `.planning/phases/00-bootstrap/00-CONTEXT.md` — Phase 0 decisions in force: D-04 (pnpm catalog versions), D-06 (HealthResponseSchema cross-package proof), D-15 (workflow commitment ritual mandatory — meta-observation source), D-16 (no native deps).
- `.planning/phases/01-daemon-registry-pairing/01-CONTEXT.md` — Phase 1 decisions Phase 4 must honour: D-13 (token format), D-15 (mid-rotation race window), D-16 (daemon-side `Schema.parse()` outbound), D-21 (CORS allow-list + production SPA origin), D-22 (no chokidar; per-request reads), D-23 (`fs.realpath` allow-list defence — gates the new SKILL.md and skill-observations reads).
- `.planning/phases/02-spa-shell-pair-flow/02-CONTEXT.md` — Phase 2 decisions Phase 4 builds on: D-01 (anti-slop tone), D-02/D-03 (dark default + 3-way theme), D-04 (TanStack Router lazy routes — `projects.$projectId.lazy.tsx` already exists), D-05 (lazy routes), D-06/D-07 (401 → `RepairBanner`, no auto-retry), D-08/D-09 (schema drift → inline panel state), localStorage prefix `agentic-dashboard:*`.
- `.planning/phases/03-multi-project-home-page/03-CONTEXT.md` — Phase 3 decisions Phase 4 builds on:
  - D-01 (per-card fan-out pattern → Phase 4's per-panel fan-out)
  - D-02 (5 s daemon memo per route)
  - D-03 (refetchIntervalInBackground:false)
  - D-07 (per-card error surfaces — extends to per-panel: schema drift, 5xx, 401)
  - D-08 (field-split philosophy: light vs rich endpoints; Phase 4 adds detail-rich endpoints)
  - D-37 (click-target rule — `/projects/{id}` is the navigation destination Phase 4 fulfils)
  - D-42 (no skeleton-shimmer)
  - D-43 (animation discipline — but D-4-13 removes animation from Phase 4 entirely)
  - D-44 (empty-phase card → analogous empty states in D-4-14)
- `CLAUDE.md` — repo state, hard architectural constraints (every "must survive every refactor" bullet), pre-PR checklist (`pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build`, **`pnpm lint`**).
- Global `~/.claude/CLAUDE.md` — AgenticApps workflow hooks (per-plan TDD with `tdd="true"`, post-phase `/review`+`/cso` (Phase 4 doesn't touch auth/storage/LLM but does add new HTTP read routes — `/cso` still mandatory)+`/qa` (dev server reachable)).

### Workflow contract

- `.claude/skills/agenticapps-workflow/skill/SKILL.md` — commitment ritual format (the source CommitmentBlock parses), gate-to-skill map (Stage 1 + Stage 2 not collapsible), **rationalization table — D-4-07 reads this file at runtime to enumerate row labels**, 13 red flags.
- Pre-phase hook (per global CLAUDE.md): UI plans MUST run `superpowers:brainstorming` for UI/UX alternatives before coding. Phase 4's panel layout, header, and DISC-04 install-hint are candidate plans.
- Post-phase hooks: `/review` (Stage 1) → `superpowers:requesting-code-review` (Stage 2) → `/cso` (this phase adds five new HTTP read routes — `/cso` is mandatory) → `/qa` (dev server reachable on `localhost:5174`).

### External docs (relevant to the new surfaces)

- TanStack Query v5 polling + visibility: https://tanstack.com/query/latest/docs/react/guides/important-defaults — `refetchIntervalInBackground` default, `dataUpdatedAt`. D-4-02.
- TanStack Router lazy routes: already used in Phase 2; `routes/projects.$projectId.lazy.tsx` swaps body in place.
- Hono Zod validator + JSON body: https://hono.dev/docs/guides/validation — same pattern as Phase 1/3 routes.
- Hono context get/set: https://hono.dev/docs/api/context — for per-request `requestId` and per-projectId memo lookup.
- Node `node:readline` for streaming JSONL: https://nodejs.org/api/readline.html — D-4-08 streaming read pattern.
- Node `fs.promises.readdir`/`stat` for mtime sort: D-4-05.
- WAI-ARIA dialog pattern (potentially for future "open file" buttons in PHASE-01): https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ — Phase 4 doesn't render any dialogs; reference for completeness.
- Clipboard API: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText — D-4-15 install-hint copy button.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (don't reinvent)

- `packages/agent/src/lib/projectOverview.ts` — already has `parseReviewFile`, `parseVerification`, `parseTddPairs`, `detectBranch`, `findLatestPhaseDir`, `detectMarkers`. Phase 4 extends this file (or a sibling `lib/phaseDetail.ts`) with: `parseCommitmentBlock`, `readSkillObservations` (last-N JSONL merge per D-4-08), `parseRationalizationRows` (SKILL.md table parse per D-4-07), `parsePhaseChecklist` (file presence + mtime per D-4-11), `parseExecutionTimeline` (extends `parseTddPairs` to return per-task grouped pairs with commit SHAs and timestamps), `parseSecurityReports` (`*-SECURITY.md` summary).
- `packages/agent/src/lib/paths.ts` — `resolveAllowed` enforces the `.planning/.claude` allow-list. Every new route reuses this for path resolution.
- `packages/agent/src/lib/git.ts` — `runAllowedGit` for `git log --format=...`, `git symbolic-ref --short HEAD`. ExecutionTimeline expands the format string to capture SHA + subject + ISO date.
- `packages/agent/src/lib/registry.ts` — `readRegistry` for project lookup by `id` in every route.
- `packages/agent/src/lib/overviewCache.ts` — Phase 3's per-projectId 5s memo. Phase 4 either generalizes this to a per-route cache or duplicates the pattern (planner's call per D-4-04).
- `packages/agent/src/server/middleware/errors.ts` — `outbound(c, parser, value, status?)` pattern for daemon-side schema-drift defence. Reused for every new route.
- `packages/agent/src/routes/read.ts` — already implements the path allow-list read with realpath check + size cap; the `read.ts` route is already wired but not yet exercised by SPA. Phase 4's panels do NOT call `/read` directly — all parsing happens daemon-side.
- `packages/agent/src/routes/git.ts` — `/api/projects/:id/git?cmd=...` already exists with `runAllowedGit`. Phase 4 doesn't expose ExecutionTimeline data through this route — instead, the daemon-side `parseExecutionTimeline` calls `runAllowedGit` internally and the frontend gets pre-parsed JSON via `/phase-progress`.
- `packages/agent/src/routes/overview.ts` — Phase 3's `/api/projects/:id/overview`. Phase 4 leaves this untouched; the new five routes are siblings.
- `packages/spa/src/lib/api.ts` — `apiFetch(path, schema)` with `parseOrDrift()` + `ApiError`. Every new SPA→daemon call routes through this. Existing rejects-`/register`-from-SPA assertion (Phase 3 D-12) stays; no new lint rules needed.
- `packages/spa/src/lib/queryClient.ts` — TanStack Query client with 401 interceptor (Phase 2 D-06/D-07). Reused for every Phase 4 query.
- `packages/spa/src/lib/repair.tsx` — 401 → RepairBanner state. Triggers across all panel queries on token mismatch.
- `packages/spa/src/components/SchemaDriftState.tsx` — inline drift surface. Used per-panel when that panel's response fails Zod parse (mirrors Phase 3 D-07's per-card pattern but at panel granularity).
- `packages/spa/src/components/AppShell.tsx` — root shell. The `/projects/$projectId` route renders inside it; CommandPalette + RepairBanner + Header all already present.
- `packages/spa/src/components/Header.tsx` — currently renders product name + theme chip + last-refresh. Phase 4 needs a route-aware variant: on `/projects/$projectId`, render the spec line 472 header instead. Planner picks: extend `Header.tsx` with route detection vs add a new `<ProjectHeader />` that mounts inside `<SingleProjectView />` and the existing `<Header />` hides on the project route.
- `packages/spa/src/router.tsx` — TanStack Router root. `/projects/$projectId` lazy route already exists (Phase 3 D-37 placeholder).
- `packages/spa/src/routes/projects.$projectId.lazy.tsx` — placeholder body to replace with `<SingleProjectView />`.
- `packages/spa/src/styles/global.css` — design tokens (`--bg`, `--surface`, `--text`, `--accent`, `--border`, `--ring`, `--text-muted`) already locked. All new panels consume these — no new tokens.
- `packages/spa/package.json` — TanStack Query, TanStack Router, lucide-react, React 18, Tailwind v4, Vite, vitest already present. **No new SPA deps for Phase 4.**
- `packages/agent/package.json` — Hono, zod, execa already present. **No new agent deps for Phase 4.**

### Established Patterns

- **Catalog-versioned deps** (Phase 0 D-04): no new deps means no catalog edits.
- **Shared schemas single source of truth** (Phase 0 D-06, Phase 1 D-16): every new wire shape lands in `packages/shared/src/schemas/`. Phase 4 adds:
  - `commitment.ts` (`CommitmentBlockResponseSchema`)
  - `observations.ts` (`HookFiringSchema`, `ObservationsRecentResponseSchema`, including `skillInstalled: boolean` per D-4-15)
  - `phaseDetail.ts` (`PhaseFileStatusSchema`, `ExecutionTimelineEntrySchema`, `ReviewStatusPayloadSchema`, `VerificationStatusPayloadSchema`, `PhaseProgressResponseSchema`)
  - `discipline.ts` (`RationalizationRowSchema`, `DisciplineResponseSchema`)
  - `security.ts` (`CsoSummarySchema`, `DbSentinelSummarySchema`, `SecurityResponseSchema`)
- **TS strict mode** + **ESM-only** + `exactOptionalPropertyTypes` carry from Phase 0–3.
- **TDD mandatory** per global CLAUDE.md and repo CLAUDE.md — every parser, route, schema, and panel gets a failing test first.
- **Two-stage review** before merge — Stage 1 `/review` + Stage 2 `superpowers:requesting-code-review`. Stages do NOT collapse.
- **`pnpm lint` is mandatory** in pre-PR check (CLAUDE.md memory feedback).
- **Daemon-side `Schema.parse()` on outbound** (Phase 1 D-16): every new route uses `outbound(c, ResponseSchema.parse.bind(ResponseSchema), value)` to catch daemon-side schema drift.
- **Path allow-list defence** (Phase 1 D-23): every filesystem read in new parsers must go through `resolveAllowed` from `lib/paths.ts`. The `.claude/skills/agenticapps-workflow/skill/SKILL.md` read in D-4-07 confirms this is permitted (`.claude` is allow-listed).

### Integration Points

- **Daemon-side new files:**
  - `packages/agent/src/lib/phaseDetail.ts` (NEW or extend `projectOverview.ts`) — parsers per D-4-03. Tests alongside.
  - `packages/agent/src/lib/disciplineDetail.ts` (NEW) — `parseRationalizationRows`, `readSkillObservations`. Separated because the JSONL streaming logic is distinct from phase-file parsing.
  - `packages/agent/src/lib/phaseCache.ts` (NEW or generalize `overviewCache.ts`) — per-route 5s memo. Vitest unit tests for hit/miss/stale.
  - `packages/agent/src/routes/commitment.ts` (NEW) — `GET /api/projects/:id/commitment`.
  - `packages/agent/src/routes/observations.ts` (NEW) — `GET /api/projects/:id/observations/recent`.
  - `packages/agent/src/routes/phaseProgress.ts` (NEW) — `GET /api/projects/:id/phase-progress`.
  - `packages/agent/src/routes/discipline.ts` (NEW) — `GET /api/projects/:id/discipline`.
  - `packages/agent/src/routes/security.ts` (NEW) — `GET /api/projects/:id/security`.
  - `packages/agent/src/server/app.ts` (EDIT) — wire the five new routes into the Hono app with bearer + CIDR + CORS middleware (already in place).
- **Daemon-side new schemas (in `packages/shared/src/schemas/`):**
  - `commitment.ts`, `observations.ts`, `phaseDetail.ts`, `discipline.ts`, `security.ts` per the `Established Patterns` list above.
  - `packages/shared/src/index.ts` (EDIT) — re-export new schemas alongside existing.
- **SPA-side new files:**
  - `packages/spa/src/components/SingleProjectView.tsx` (NEW) — top-level 2-col layout (D-4-09), composes panels, owns the project-header block (D-4-10).
  - `packages/spa/src/components/panels/CommitmentBlock.tsx` (NEW) — DISC-01.
  - `packages/spa/src/components/panels/HookFirings.tsx` (NEW) — DISC-02 + DISC-04 install hint.
  - `packages/spa/src/components/panels/RationalizationFires.tsx` (NEW) — DISC-03.
  - `packages/spa/src/components/panels/PhaseProgress.tsx` (NEW) — PHASE-01.
  - `packages/spa/src/components/panels/ExecutionTimeline.tsx` (NEW) — PHASE-02.
  - `packages/spa/src/components/panels/ReviewStatus.tsx` (NEW) — PHASE-03.
  - `packages/spa/src/components/panels/SecurityStatus.tsx` (NEW) — PHASE-04.
  - `packages/spa/src/components/panels/VerificationStatus.tsx` (NEW) — PHASE-05.
  - `packages/spa/src/lib/projectQueries.ts` (NEW) — TanStack Query hooks: `useCommitment(id)`, `useObservations(id)`, `usePhaseProgress(id)`, `useDiscipline(id)`, `useSecurity(id)`. Each wraps `apiFetch` + the right schema.
  - `packages/spa/src/routes/projects.$projectId.lazy.tsx` (REPLACE body) — mounts `<SingleProjectView />`.
- **CI:** `.github/workflows/ci.yml` already runs lint + typecheck + test + build. Phase 4 tests get picked up automatically.

</code_context>

<specifics>
## Specific Ideas

- The **2-column-now / 3-column-later** layout choice (D-4-09) is deliberate: the alternative ("render a stub Phase 5 panel") violates anti-slop discipline (Phase 3 D-43). Phase 4 ships as a complete, satisfying detail view today. Phase 5 widens the grid by one CSS rule and inserts the right-column components.
- The **per-panel endpoint split** (D-4-01) is the same isolation principle as Phase 3 D-01's per-card fan-out, applied at panel granularity instead of project granularity. The /cso security audit should specifically verify that schema-drift on one panel route does NOT cascade across panels (per-panel `<SchemaDriftState />` mount points).
- **`HookFiringSchema.passthrough()`** (D-4-06) is a deliberate concession to upstream evolution. Claude Code may add fields to its hook event JSON; the dashboard tolerates them rather than crashing. The cost is slightly looser type safety on the SPA — acceptable for a panel that just renders display data.
- **`RationalizationFires` row labels read at runtime from the project's SKILL.md** (D-4-07). This means an outdated dashboard release will still match a fresh workflow skill — no version coupling. The cost is one extra file read per `/discipline` request; the 5s memo (D-4-02) absorbs it.
- **DISC-04 install-hint copy command** (D-4-15) is the most user-facing copy in this phase. The exact wording matters for impeccable. Researcher should confirm the canonical command per the agenticapps-workflow skill — and surface a placeholder if the skill itself doesn't define one (in which case Phase 6 polish would tighten the copy).
- The **always-expanded panels** choice (D-4-13) trades some visual density consistency with Phase 3 cards for a simpler, calmer detail view. This is consistent with the rationalization that the home page is for scanning (compact density helps) and the detail page is for reading (full content from the start helps).
- **ReviewStatus reuses Phase 3's `parseReviewFile`** (D-4-16) which supports both frontmatter counts (fast) and `<finding>` block counts (accurate). The fast path is the default; the accurate path is the verifier. Phase 4 leans on the existing implementation — no parser rewrite.
- **No `/api/projects/:id/open` editor spawn in Phase 4.** PhaseProgress could ergonomically render filenames as clickable "open in $EDITOR" buttons, but spawning editors is a deferred concern. Filenames render as plain `<code>` for v1.
- **Linear: ACME-N badge** detection (spec line 478) is intentionally deferred (D-4-10). Adding it costs little (a regex on `branch`), but its value is contingent on the Linear panel that lands later. Save the pattern for Phase 5/7 when the full Linear integration ships.

</specifics>

<deferred>
## Deferred Ideas

### Phase 4-adjacent items intentionally not covered here

- **Right column (HEALTH-01..05)** — Phase 5. `<SingleProjectView />` widens its grid by one CSS rule + inserts the panels.
- **Header line 2** (`Linear: ACME-123` badge, `ADR last touched 2 days ago`, `[⚙ project settings]`) — Phase 5/6.
- **`POST /api/projects/{id}/open` editor spawn** — spec line 333 + 695 explicitly allow this. Phase 5/6 polish concern. Phase 4's PhaseProgress filenames render as static `<code>` blocks.
- **Sub-route `/projects/{id}/settings`** — Phase 6 polish.
- **`impeccable:critique` ≥ 90 hard gate** — Phase 6 (POLISH-04). Phase 4 inherits Phase 2/3 anti-slop discipline.
- **Hover-expand on detail panels** — explicitly rejected for Phase 4 (D-4-13). Could be reintroduced for "long" panels (e.g. ExecutionTimeline with 50+ tasks) in a polish pass.
- **Live-update via WebSocket / SSE** — out of scope. 5s polling (D-4-02) is sufficient for the dashboard's read-only use case.
- **Aggregate ReviewStatus across phases** — D-4-16 keeps it phase-scoped. Cross-phase aggregate could land in Phase 6 with a "all phases" view.
- **Pagination / virtualisation for HookFirings** — D-4-08 caps at 20 lines; never needs virtualisation.
- **Persistence of any UI state across sessions** — same as Phase 3 D-40 sort: out of scope, Phase 6 polish if needed.
- **Specific install-command finalisation** (D-4-15) — researcher confirms the canonical `claude skill install meta-observer` (or per-workflow-skill convention); Phase 6 polish tightens the copy if needed.

### From spec / earlier-phase open questions still pending

- **Q5 Meta-observer skill packaging** (Phase 1 deferred) — Phase 4 owns the JSONL CONSUMER (HookFirings, RationalizationFires); the meta-observer skill itself is packaged separately and Phase 4 detects its presence via `.claude/skills/meta-observer/SKILL.md` (D-4-15). Skill release coordinates outside this repo.
- **Q1/Q2 Repo visibility flip + LICENSE** (Phase 1 deferred) — Phase 8.
- **Q3 CF Access policy on production domain** (Phase 1 deferred) — Phase 6.
- **Q6 AgentLinter integration** (Phase 1 deferred) — Phase 5.
- **Phase 1 HUMAN-UAT pending items** (Tailscale live bind + 0.0.0.0 yellow banner) — tracked in `.planning/phases/01-daemon-registry-pairing/01-HUMAN-UAT.md`. Phase 6 polish or out-of-band.
- **Phase 0 + Phase 2 HUMAN-UAT verification debt** — 14 `human_needed` items across CF Pages, npm publish, three-way pairing. External-service-dependent; surface during Phase 6 or alongside live deployment.
- **Phase 3 impeccable deltas** (Color 76, Typography 78, Layout 84) — Phase 6 polish: tint OKLCH neutrals toward brand hue, swap `--accent` to AgenticApps brand color, drop Inter from `--font-sans` fallback or load iA Writer Mono S for headings.
- **A-01 rate-limit + A-02 schema-bounds** (Phase 3 PR follow-ups) — below-threshold DoS-class; revisit when CF Access is wired (Phase 6).

### Reviewed Todos (not folded)

None — no pending todos surfaced in cross-reference.

</deferred>

---

*Phase: 04-single-project-view-discipline-phase-progress*
*Context gathered: 2026-05-05*
