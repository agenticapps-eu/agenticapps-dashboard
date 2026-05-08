# Phase 5: Skills + Health Panels - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Closing the single-project view by adding the right column (Skills + Health) AND closing the Phase 4 G1 deferral by shipping the meta-observer transcript persister that fills `.planning/skill-observations/`. Phase 5 owns producer + consumer of the discipline data path, so the dashboard ships with populated CommitmentBlock + HookFirings panels for the first time.

In scope (REQUIREMENTS Phase 5):

- **HEALTH-01 InstalledSkills** — global `~/.claude/skills/*/SKILL.md` + project `<root>/.claude/skills/*/SKILL.md`, frontmatter only.
- **HEALTH-02 SkillHealth** — `npx agentlinter scan` results with score + Position Risk warnings, cached 1h or until SKILL.md mtime change.
- **HEALTH-03 ObservabilityHealth** — Spotlight / Sentry SDK / sentry-cli detection via grep on `package.json` + CI files, multi-signal.
- **HEALTH-04 SecretsHealth** — `.infisical.json` file presence + JSON-validity check (informational only; no Infisical API calls).
- **HEALTH-05 IntegrationsHealth** — Sentry / Linear / Infisical three-state (`configured` / `present-but-not-configured` / `not-detected`) with inline one-paragraph guides.
- **Layout transition** — `<SingleProjectView />` grid widens from 2-col (`1fr 1.5fr`) to 3-col (`1fr 1.5fr 1fr`) via single CSS-rule change staged by Phase 4 D-4-09. Right column = third `<section>` with the five panels.
- **Transcript persister (G1 unblocker)** — new `packages/meta-observer/` workspace package: Claude Code SessionEnd hook that writes commitment-block markdown + JSONL hook firings into `<projectRoot>/.planning/skill-observations/`. Closes the deferred DISC-01 data path so Phase 4's left-column panels actually populate.

**Read-only on the project filesystem still holds — but with three precise extensions**, all locked daemon-side, none exposed via `/read`:

- Top-level project metadata files (`package.json`, `.infisical.json`, `.github/workflows/*.yml`) — read via dedicated daemon-side scanners only. SPA never names these paths.
- Global skills root (`~/.claude/skills/`) — read via a singleton `/api/skills/global` route with daemon-side allow-list anchored at `os.homedir() + '/.claude/skills'`.
- Per-project local skills (`<root>/.claude/skills/`) — already permitted under Phase 1 D-23 (`.claude` allow-list).

The meta-observer skill writes only to `<projectRoot>/.planning/skill-observations/` and resolves that root via CWD walk-up — it is the persister, not the dashboard daemon, so INV-01 (daemon never writes to a project) holds unchanged.

Out of scope (later phases):

- Optional integration data fetching (Sentry events, Linear issues, Infisical secrets) — Phase 7. Phase 5's IntegrationsHealth surfaces *configuration state*, not data.
- `agentic-dashboard install-launchd` / `install-systemd` and keyboard shortcuts — Phase 6 (POLISH-01..03).
- impeccable ≥ 90 hard gate — Phase 6 (POLISH-04).
- README install/pair/FAQ/troubleshooting — Phase 6 (POLISH-06).
- Header line 2 (Linear badge, ADR-touched, settings link) — deferred from Phase 4; revisit Phase 7 alongside Linear integration.
- meta-observer backfill of historical Claude Code transcripts — explicitly deferred (forward-only).
- Lockfile parsing (yarn.lock / pnpm-lock.yaml) for transitive Sentry deps — package.json signals only.
- Monorepo / multi-root project handling — single project root via CWD walk-up suffices for v1.
- Cross-phase ReviewStatus aggregation — Phase 6 if needed.

</domain>

<decisions>
## Implementation Decisions

### Layout transition (Phase 4 → Phase 5)

- **D-5-01: Widen grid in place — `1fr 1.5fr 1fr`.** `packages/spa/src/components/SingleProjectView.tsx` `data-testid="single-project-grid"` `className` changes from `grid-cols-[1fr_1.5fr]` to `grid-cols-[1fr_1.5fr_1fr]`. A third `<section data-testid="health-column" aria-label="Health">` mounts the right column alongside `discipline-column` + `phase-progress-column`. No layout rework, no responsive break-out for Phase 5; narrow-screen stacking is for the planner to size if it shows up in QA. Phase 4 D-4-09 staged this exact change.
- **D-5-02: One component per panel under `packages/spa/src/components/panels/`** — `InstalledSkills.tsx`, `SkillHealth.tsx`, `ObservabilityHealth.tsx`, `SecretsHealth.tsx`, `IntegrationsHealth.tsx`, plus `*.test.tsx` for each. Inherits Phase 4 D-4-11 (panels dir convention, independently testable).
- **Always-expanded panels** (Phase 4 D-4-13 carries forward unchanged): no hover-expand or progressive disclosure at the panel level. Row-level click-to-expand inside `SkillHealth` (D-5-16) is content interaction, not panel disclosure — planner validates the distinction holds against anti-slop discipline as the design solidifies.

### Transcript persister (G1 unblocker)

- **D-5-03: Persister ships in Phase 5 as `packages/meta-observer/` workspace package.** New pnpm workspace alongside `agent` / `spa` / `shared`. Pro: shares root tooling (TS strict, vitest, ESLint, lint-staged, catalog deps), can import `@agenticapps/dashboard-shared` schemas directly (e.g. for the JSONL `HookFiringSchema` Phase 4 D-4-06 already locked), single PR closes producer + consumer end-to-end. Phase 5 closes both halves of the G1 deferral inside one phase commit chain.
- **D-5-04: Claude Code SessionEnd hook is the writer.** Single hook entry point fires once per Claude session at natural session boundary; no per-message overhead, no PostToolUse high-frequency write path. Crashed sessions get no record (acceptable trade — covered by mid-session view's "no commitment block found yet" empty state from D-4-14).
- **D-5-05: Persister writes both `.md` (commitment blocks) and `.jsonl` (hook firings).** Single skill, two output streams. Closes BOTH the DISC-01 (CommitmentBlock) and DISC-02 (HookFirings) empty-state paths Phase 4 left for "Phase 5+". DISC-03 RationalizationFires also derives from the JSONL stream, so the same skill release closes that data path too.
- **D-5-06: One file per session, named `{ISO date+time}--{sessionId}.md` and `.jsonl`.** Pattern matches `2026-05-06T17-55-12--{sessionId}.md`. Each session is an atomic write target; latest-by-mtime read in Phase 4 D-4-05 still picks the most recent commitment unchanged. Directory growth is acknowledged — eventual prune is out of scope for v1; revisit if directory size becomes a real complaint.
- **D-5-07: Project root resolved via CWD walk-up looking for `.planning/` or `.claude/`.** Mirrors how `cli/discover.ts:18` already finds project roots. The hook walks upward from the session's CWD; the first directory containing either marker is the target. Refuses to write if no project root found (silent skip; no daemon error path). Researcher confirms whether Claude Code SessionEnd hooks expose `CLAUDE_PROJECT_DIR` or equivalent — if so, prefer that over the walk-up.
- **D-5-08: Forward-only — no backfill on first install.** First session post-install is the seed write. CommitmentBlock + HookFirings sit empty for one session, then populate. Privacy/scope concerns of historical-transcript scraping avoided. Manual `meta-observer backfill` command is deferred (see `<deferred>`).
- **D-5-09: Manual `claude skill install meta-observer` per project.** Matches the DISC-04 install-hint copy Phase 4 already shipped (with the dual-layout skill probe per UAT G2 amendment in D-4-07/D-4-15). User sees an empty CommitmentBlock with the install hint → copy-paste install command → next session populates the panels. No auto-install (would violate INV-01 since the daemon would be writing into project FS), no global install (would leak observations across projects in a way the per-project read model isn't designed for).
- **D-5-10: Phase 5 closure gate = end-to-end populated panels on this dashboard repo.** Phase 5 doesn't ship until: (a) install meta-observer skill in `agenticapps-dashboard/.claude/skills/`, (b) run a real Claude session against this repo, (c) verify CommitmentBlock + HookFirings populate, (d) capture screenshot for HUMAN-UAT. The G1 deferral does NOT recur as UAT debt — it must close *in this phase*.

### Path allow-list extension

- **D-5-11: Top-level project metadata files via dedicated daemon-side scanners — no `/read` exposure.** A new `lib/projectMetadataScan.ts` (or sibling functions in existing files; planner picks structure) reads specific filenames directly via `fs.readFile` after explicit name-check. The existing `/api/projects/:id/read` endpoint stays locked to `.planning/.claude` per Phase 1 D-23. SPA never names a top-level path; it calls dedicated routes (`/api/projects/:id/observability`, `/secrets`, `/integrations`) and gets pre-parsed JSON back. Pro: containment intact — daemon decides what's readable, attacker who somehow forges a SPA request still cannot read arbitrary project-root files. Each new metadata signal needs a new daemon-side function — acceptable cost.
- **D-5-12: Global skills via singleton `/api/skills/global` route, no projectId.** Daemon-side allow-list anchored at `os.homedir() + '/.claude/skills'`; reads `*/SKILL.md` frontmatter only (not body). One cache, all projects share. Per-route memo TTL longer than 5s — likely 60s or 5min (planner picks; skill list rarely changes). The companion `/api/projects/:id/skills/local` route handles per-project skills. SPA's InstalledSkills panel calls both and merges client-side, tagging entries `scope: global|local`.
- **D-5-13: Reuse `resolveAllowed` pattern with extended root sets.** `lib/paths.ts` gets a name-restricted variant — e.g. `resolveAllowed(projectRoot, name, { roots: [projectRoot], allowedNames: ['package.json', '.infisical.json'] })` — that asserts both the realpath under the allowed root AND the basename in an explicit whitelist. CI-workflow reads use `{ roots: [projectRoot/.github/workflows], extension: '.yml' }`. Same realpath + traversal defence Phase 1 D-23 wrote, no net-new mechanism.

### AgentLinter integration

- **D-5-14: Cache key = `(projectId, max-mtime across all SKILL.md)`, 1h hard ceiling on top of mtime invalidation.** Daemon walks `<root>/.claude/skills/**/SKILL.md` + `~/.claude/skills/**/SKILL.md`, takes max mtime; cache hit when both projectId and max-mtime unchanged AND age < 1h. Matches spec's "cached 1h ... cache invalidates on SKILL.md mtime change" verbatim. Cache stored in-memory by default; persistence across daemon restarts is for the planner to weigh (in-memory `Map` vs `~/.agenticapps/dashboard/cache.json` mode `0600`). On a project with 50 skills and one edit, full re-scan is acceptable — 1h amortizes the cost.
- **D-5-15: Distinct empty states per failure class.** Four explicitly-designed states:
  - **Linter not installed / network unreachable** → panel copy: "AgentLinter not installed. Run `npm install -g agentlinter` to enable scoring." (verb form depends on what `npx` actually surfaces; researcher confirms the exact "command not found / fetch failed" branches.)
  - **Scan timeout (default 30s)** → panel copy: "Lint scan timed out — retry?" with a retry button that bypasses the 1h cache for one call.
  - **Non-zero exit with parseable error message** → panel copy renders the linter's stderr inline.
  - **Non-zero exit, unparseable output** → panel copy: "Lint scan failed (exit N) — see daemon log."
  Each class has a distinct copy + design state; planner finalises wording in conjunction with the impeccable critique (Phase 6 will tighten if needed). Cached-stale-fallback (the Sentry pattern) is explicitly NOT used here — a stale lint scan against an outdated skill set lies more than a clear failure state.
- **D-5-16: SkillHealth surfaces score badge + Position Risk count per row; rows expand inline on click to show specific warnings.** Compact view: each skill row shows `{name} · {score}/100 · {N} Position Risk warnings`. Clicking a row expands inline to show the specific warning text + AgentLinter rule names. Panel itself stays always-expanded per D-4-13; row-level interaction is content navigation, not progressive disclosure of the panel. Severity bucket mapping to D-4-16's four glyphs (🔴 critical / 🟠 high / 🟡 medium / ⚪ low) — researcher confirms what severities AgentLinter actually emits and aligns the mapping.
- **D-5-21 (added 2026-05-08, post-phase /cso): Spawn target is `@agenticapps/agentlinter` resolved as a workspace dependency, NEVER bare `npx agentlinter` against the open registry.** /cso surfaced that `npx --yes agentlinter` resolves to a third-party package owned by `simonkim <seojoon.kim@gmail.com>` — every cache miss could fetch a different version (no pin, no integrity check, install scripts auto-run). Two compromise paths: (a) account takeover → patch version pushes RCE to every dashboard host on next SkillHealth render; (b) ownership transfer → next release exfiltrates creds. **Mitigation (delivery decided 2026-05-08):** vendor a reviewed snapshot of the `seojoonkim/agentlinter` v2.3.0 source as `packages/agentlinter/` in this monorepo, scoped `@agenticapps/agentlinter`, consumed by the agent via `"@agenticapps/agentlinter": "workspace:*"`. NOT published to npm — there is no `@agenticapps` npm org, claiming it would add 5min of friction with no upside (only consumer is the dashboard). Workspace-link gives us pinning by definition (no version drift, no integrity-hash dance, no install-script vector). **Patches applied vs upstream v2.3.0:** removed `src/upload.ts` + the share block in `bin.ts` (no network code remains), excluded `analytics/` (15MB of upstream's third-party scan archive — privacy hygiene), modernised tsconfig for TS 6 (`module: node16`, `moduleResolution: node16`, explicit `types: ["node"]`). `agentLinterRunner.ts` resolves the bin via `createRequire` + `pkg.bin` and spawns `node <resolved-bin>`. Test #1 asserts the spawn cmd is `node` and arg[0] is a path under `@agenticapps/agentlinter` — fails CI if the spawn target ever regresses to `npx`. **Upstream-watch action** (`docs/agentlinter-fork-upstream-watch.yml`) ships into the `agenticapps-eu/agentlinter` GitHub fork; opens a weekly tracking issue when upstream `seojoonkim/agentlinter` publishes commits or npm versions. Cherry-picks land directly in `packages/agentlinter/src/` here, not in a separate publish pipeline. D-5-15's "not-installed" state stays in the discriminated union — fires only on broken `node_modules` / partial install. User-facing copy switched to "Reinstall with `pnpm install --frozen-lockfile`". Security reports: `.gstack/security-reports/2026-05-08T04-50-46Z.json` (Finding #1 CRITICAL → resolved) and `.gstack/security-reports/2026-05-08T08-50-00Z-agentlinter-v2.3.0-audit.md` (full v2.3.0 audit, three findings remediated by the patches above).

### Detection vocabulary (Observability + Integrations)

- **D-5-17: ObservabilityHealth uses multi-signal detection per tool.** Each tool detected via ANY-OR signal set; panel surfaces which signals matched ("detected via @sentry/node + .sentryclirc"). Vocabulary:
  - **Sentry**: `package.json` deps/devDeps include `@sentry/*` || `package.json` scripts mention `sentry-cli` || `<root>/.sentryclirc` exists || env file (`<root>/.env`, `.env.local`, etc. — researcher confirms which) mentions `SENTRY_DSN`.
  - **Spotlight**: `package.json` deps include `@spotlightjs/*` || `<root>/.spotlight/` directory present.
  - **sentry-cli**: standalone binary on PATH (`which sentry-cli` exit 0) || in `package.json` scripts || in CI YAML (`.github/workflows/**/*.yml` grep).
  Multi-signal philosophy is **consistent across all three** — false-positive resistant + user-honest about evidence.
- **D-5-18: SecretsHealth = `.infisical.json` file presence + JSON-validity check.** Not just `existsSync`; the daemon reads + `JSON.parse` to confirm it's structurally valid. Surface state: `present + valid` (badge), `present but invalid` (warning copy: ".infisical.json found but not parseable"), `absent` (default empty). Informational only — no Infisical API calls, no secret content read or surfaced.
- **D-5-19: IntegrationsHealth uses three-state per integration.** Each of Sentry / Linear / Infisical shows one of:
  - **`configured`** — relevant env var present on the daemon (`SENTRY_AUTH_TOKEN`, `LINEAR_API_KEY`, etc.). Optional API ping when daemon has internet — but ping failure does NOT downgrade the state to `not-detected`; treat as "configured + temporarily unreachable" with stale data shown if cached, generic "ready" badge if not.
  - **`present-but-not-configured`** — ObservabilityHealth signals matched but daemon env var missing. Copy: "Sentry SDK detected. Set `SENTRY_AUTH_TOKEN` to enable the panel." Couples ObservabilityHealth → IntegrationsHealth at the data-flow level: detected-but-unconfigured is a stronger nudge than not-detected-at-all.
  - **`not-detected`** — neither signals nor env vars. Copy: "Configure to enable" + the inline one-paragraph guide.
- **D-5-20: 'Configure to enable' guides live as inline panel copy, one paragraph each.** Spec line 504 says one-paragraph; render directly inside the panel's empty state. No external doc page, no modal, no "Read more" link. Three paragraphs total (Sentry, Linear, Infisical) — each must be tight: install line + env var name + what gets enabled. The exact copy is a Phase 5 design constraint and a Phase 6 polish touch-point if it doesn't pass impeccable.

### Claude's Discretion

- **AgentLinter subprocess execution model.** `execa('npx', ['agentlinter', 'scan', ...])` with stdio capture vs streaming — researcher samples actual `npx agentlinter scan` output volume on a 50-skill set and picks. If output is ≤ a few hundred KB, stdio capture is simpler; if MB+, stream and parse line-by-line.
- **AgentLinter cache persistence across daemon restarts.** In-memory `Map<string, { value, expiresAt, mtime }>` vs `~/.agenticapps/dashboard/cache.json` (mode `0600`). In-memory is simpler if 1h TTL aligns with typical daemon uptime; on-disk eats a startup-warm penalty but survives restarts. Planner picks; default to in-memory unless restart frequency makes it painful in dogfooding.
- **Position Risk severity mapping to D-4-16's four glyphs.** Researcher confirms what severities AgentLinter emits in 2026 and maps to 🔴 critical / 🟠 high / 🟡 medium / ⚪ low. If AgentLinter emits a different palette (e.g. just "warning" / "error"), planner picks a sensible coercion.
- **`/api/skills/global` cache TTL.** 60s vs 5min vs 1h. Skill list rarely changes — but `claude skill install` is a real action that should reflect within reasonable time. Planner picks; 60s is the conservative default.
- **meta-observer JSONL event vocabulary.** Researcher studies Claude Code SessionEnd hook payload shape and locks the JSONL schema in `packages/shared/src/schemas/observations.ts`. Phase 4 D-4-06 set `HookFiringSchema = { ts, skill, hook }.passthrough()`; Phase 5 either tightens this with a discriminated union of known event types OR keeps the passthrough. If the hook payload is stable, lock the union; if not, stay tolerant.
- **meta-observer hook script language.** Bash vs Node vs Deno vs TypeScript-via-tsx. Constraint: no native deps (INV-05 carries to the meta-observer package). Researcher picks based on Claude Code skill conventions and how skills under `~/.claude/skills/` are typically authored. If TypeScript: ensure no compile step is required at install time.
- **meta-observer atomic write pattern.** `fs.writeFile(path)` direct vs write-to-`.tmp` then rename. Atomicity matters when CommitmentBlock reads the latest-by-mtime file mid-write. Planner picks; `.tmp` + rename is the safe default.
- **3-col responsive behaviour at narrow widths.** Likely "stack columns vertically below 1024px or 1280px" but the threshold + transition design is for the planner. Phase 5 doesn't need responsive parity with the home page; the detail view is desktop-first.
- **Daemon-side scanner organisation.** One `lib/projectMetadataScan.ts` per signal type, or a single `lib/healthScan.ts` with multiple exported functions. Planner picks per-file pattern based on test-locality preference and how shared the helpers are.
- **TanStack Query cache keys for new panel queries.** Suggested: `['agentlinter', projectId]`, `['skills-global']` (no projectId), `['skills-local', projectId]`, `['observability', projectId]`, `['secrets', projectId]`, `['integrations', projectId]`. Planner finalises (e.g. whether `agentlinter` cache key includes a maxMtime segment to mirror daemon-side invalidation).

### Folded Todos

None — `gsd-tools todo match-phase 5` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec (binding)

- `docs/spec/dashboard-prompt.md` §"Right column — Skills and tooling health" lines 496–504 — five panel definitions, exact wording for "configure to enable". D-5-17, D-5-18, D-5-19, D-5-20 implement this directly.
- `docs/spec/dashboard-prompt.md` §"API surface (Hono routes)" lines 320–352 — `/api/projects/:id/agentlinter` (line 337), `/api/projects/:id/skills/local` (line 341), `/api/projects/:id/observations/recent` (line 344), `/api/projects/:id/integrations` (line 347). D-5-12, D-5-14, D-5-19 align with these route names.
- `docs/spec/dashboard-prompt.md` §"Optional integrations: the contract" lines 506–544 — three-step rule (works without, configure-to-enable copy, env-var driven). D-5-19 + D-5-20 implement this verbatim.
- `docs/spec/dashboard-prompt.md` §"Implementation phasing" Phase 5 bullet lines 638–641 — explicit four-deliverable scope. D-5-14, D-5-17, D-5-18 align.
- `docs/spec/dashboard-prompt.md` §"Constraints I want preserved" + §"Anti-features" lines 686–712 — read-only on project FS, registry/auth/env writes confined to `~/.agenticapps/dashboard/`, bearer-token on every route, CORS lock, no native deps. INV-01..05 carry into Phase 5 unchanged. D-5-11, D-5-12, D-5-13 add three precise allow-list extensions without breaking the invariant.
- `docs/spec/dashboard-prompt.md` §"Visual style" lines 548–554 — anti-AI-slop self-test, dark default, restrained palette. Phase 5 inherits Phase 2 D-01..D-03 + Phase 3 D-42..D-44 + Phase 4 D-4-13..D-4-16.

### Project-level planning artifacts

- `.planning/PROJECT.md` — vision, hard tech-stack lock, key decisions table.
- `.planning/REQUIREMENTS.md` — REQ-IDs in scope: HEALTH-01..05, INV-03 (graceful empty states). Also unblocks DISC-01 (annotated "Partial pending Phase 5") via the meta-observer skill.
- `.planning/ROADMAP.md` Phase 5 entry — depends on Phase 4, success criteria 1–4.
- `.planning/phases/00-bootstrap/00-CONTEXT.md` — Phase 0 D-04 (catalog versions; meta-observer follows), D-06 (HealthResponseSchema cross-package proof), D-15 (workflow commitment ritual mandatory — meta-observer is what records this), D-16 (no native deps; meta-observer skill is bound by this too).
- `.planning/phases/01-daemon-registry-pairing/01-CONTEXT.md` — Phase 1 decisions Phase 5 must honour: D-13/D-14/D-15 (token format, rotation race window), D-16 (daemon-side `Schema.parse()` outbound), D-21 (CORS allow-list — five new routes inherit), D-22 (no chokidar; per-request reads), **D-23 (`fs.realpath` allow-list defence — Phase 5 D-5-11/D-5-12/D-5-13 extend this carefully)**.
- `.planning/phases/02-spa-shell-pair-flow/02-CONTEXT.md` — Phase 2 D-01 (anti-slop tone), D-02/D-03 (dark default + 3-way theme), D-04 (TanStack Router lazy routes), D-06/D-07 (401 → RepairBanner, no auto-retry), D-08/D-09 (schema drift → inline panel state — Phase 5 reuses `<SchemaDriftState />` per panel), localStorage prefix `agentic-dashboard:*`.
- `.planning/phases/03-multi-project-home-page/03-CONTEXT.md` — D-01 (per-card fan-out → Phase 5's per-panel fan-out continues), D-02 (5s daemon memo per route — Phase 5 extends to longer TTLs for `/skills/global` 60s and `/agentlinter` 1h), D-03 (refetchIntervalInBackground:false), D-07 (per-card error surfaces → per-panel), D-42 (no skeleton-shimmer), D-43 (animation discipline), D-44 (empty-phase card → analogous empty states).
- `.planning/phases/04-single-project-view-discipline-phase-progress/04-CONTEXT.md` — **all D-4-01..D-4-16 carry forward**, especially D-4-09 (2-col grid stages 3-col widening — Phase 5 executes), D-4-11 (panels dir convention), D-4-13 (always-expanded panels), D-4-14 (per-panel empty states with explicit copy), D-4-15 (DISC-04 install hint + copy button — Phase 5's `present-but-not-configured` state mirrors this pattern). The G1 deferral note in DISC-01 is what Phase 5's D-5-03..D-5-10 closes.
- `CLAUDE.md` — repo state, hard architectural constraints (every "must survive every refactor" bullet), pre-PR checklist (`pnpm -r typecheck`, `pnpm -r test`, `pnpm -r build`, `pnpm lint`).
- Global `~/.claude/CLAUDE.md` — AgenticApps workflow hooks (per-plan TDD with `tdd="true"`, post-phase `/review` + `/cso` (mandatory: Phase 5 adds five new HTTP read routes + a transcript persister) + `/qa` (dev server reachable on `localhost:5174`)).

### Workflow contract

- `.claude/skills/agenticapps-workflow/skill/SKILL.md` — commitment ritual format. The meta-observer skill captures the same `## Workflow commitment` block format this skill mandates. **Coordination point**: meta-observer must NOT modify the workflow skill; it observes and persists the artefacts the workflow skill produces. If the workflow skill changes its commitment-block format, meta-observer adapts (researcher confirms current format).
- Pre-phase hook (per global CLAUDE.md): UI plans MUST run `superpowers:brainstorming` for UI/UX alternatives. Phase 5's right-column panel design is a candidate.
- Post-phase hooks: `/review` (Stage 1) → `superpowers:requesting-code-review` (Stage 2) → `/cso` (Phase 5 adds five new HTTP read routes + a workspace package writing to project FS — `/cso` is mandatory) → `/qa` (dev server reachable).

### Claude Code skill platform

- **Skill SKILL.md format + frontmatter** — researcher fetches current canonical docs via `mcp__context7__*` (search "Claude Code skills SKILL.md frontmatter") and locks the meta-observer manifest shape.
- **SessionEnd hook entry point + payload** — researcher fetches current canonical docs (Anthropic's Claude Code skill API) for `SessionEnd` hook signature, payload shape (especially whether `CLAUDE_PROJECT_DIR` or equivalent is exposed), and the script language conventions. D-5-04, D-5-07.
- **AgentLinter CLI + JSON output** — researcher runs `npx agentlinter scan` against the dashboard's own `~/.claude/skills/` to capture actual JSON shape, severity vocabulary, and Position Risk surface. D-5-14, D-5-16.

### External docs (relevant to the new surfaces)

- TanStack Query v5 polling + visibility: https://tanstack.com/query/latest/docs/react/guides/important-defaults — `refetchIntervalInBackground` default carries unchanged.
- Hono Zod validator: https://hono.dev/docs/guides/validation — five new routes follow Phase 1/3/4 pattern.
- Hono context get/set: https://hono.dev/docs/api/context — for per-request `requestId` and per-projectId memo lookup.
- Node `child_process.spawn` / `execa` for `npx agentlinter scan`: https://github.com/sindresorhus/execa — D-5-14, D-5-15.
- Node `fs.promises.readdir` + frontmatter parse: D-5-12 global skills route.
- Clipboard API: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText — present-but-not-configured copy buttons reuse Phase 4 D-4-15 pattern.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (don't reinvent)

- `packages/agent/src/lib/paths.ts` — `resolveAllowed` enforces the `.planning/.claude` allow-list. **Phase 5 extends with a name-restricted variant per D-5-13** for top-level metadata files. The existing realpath + traversal defence is reused unchanged.
- `packages/agent/src/lib/projectOverview.ts` — Phase 3 parsers (`detectMarkers`, `findLatestPhaseDir`).
- `packages/agent/src/lib/phaseDetail.ts` — Phase 4 parsers (`parseCommitmentBlock`, `readSkillObservations`, `parseRationalizationRows`, `findSkillPath` dual-layout probe). The `findSkillPath` helper is the canonical shape for any new "find a skill at canonical-or-bundle layout" need; Phase 5 reuses this directly for InstalledSkills frontmatter reads.
- `packages/agent/src/lib/git.ts` — `runAllowedGit`. Phase 5 doesn't need this for any HEALTH-* panel.
- `packages/agent/src/lib/registry.ts` — `readRegistry` for project lookup by `id`. Used by every per-project route.
- `packages/agent/src/lib/overviewCache.ts` — Phase 3's per-projectId 5s memo. Phase 5 generalises to a per-route cache with TTL parameter (5s for most, 60s for `/skills/global`, 1h for `/agentlinter`). Planner finalises the abstraction shape.
- `packages/agent/src/server/middleware/errors.ts` — `outbound(c, parser, value, status?)` for daemon-side schema-drift defence. Reused for every new route.
- `packages/agent/src/routes/read.ts` — already implements path allow-list read with realpath + size cap. Phase 5 explicitly does NOT extend this route's allow-list (D-5-11) — top-level metadata reads bypass `/read` entirely.
- `packages/agent/src/routes/overview.ts` / `commitment.ts` / `discipline.ts` / `observations.ts` / `phaseProgress.ts` / `security.ts` — Phase 3+4 routes. Five new sibling routes follow the same shape.
- `packages/spa/src/lib/api.ts` — `apiFetch(path, schema)` with `parseOrDrift()` + `ApiError`. Every new SPA→daemon call routes through this.
- `packages/spa/src/lib/queryClient.ts` — TanStack Query client with 401 interceptor (Phase 2 D-06/D-07). Reused.
- `packages/spa/src/lib/repair.tsx` — 401 → RepairBanner state. Triggers across all panel queries on token mismatch.
- `packages/spa/src/components/SchemaDriftState.tsx` — inline drift surface per panel.
- `packages/spa/src/components/AppShell.tsx` + `Header.tsx` + `ProjectHeader.tsx` + `ProjectLayout.tsx` — shells already in place from Phase 4. Phase 5 mounts the new right column inside `SingleProjectView.tsx`.
- `packages/spa/src/components/SingleProjectView.tsx` — Phase 4's 2-col layout. **Phase 5 single edit**: change `grid-cols-[1fr_1.5fr]` → `grid-cols-[1fr_1.5fr_1fr]` and add a `<section data-testid="health-column" aria-label="Health">` with five new panel components. No other layout work.
- `packages/spa/src/components/panels/` — Phase 4 panels live here. Phase 5 adds 5 more, same convention.
- `packages/spa/src/styles/global.css` — design tokens locked since Phase 2 (`--bg`, `--surface`, `--text`, `--accent`, `--border`, `--ring`, `--text-muted`). All new panels consume these — no new tokens.
- `packages/spa/package.json` — TanStack Query, TanStack Router, lucide-react, React 18, Tailwind v4, Vite, vitest already present. **No new SPA deps for Phase 5.**
- `packages/agent/package.json` — Hono, zod, execa already present. `execa` powers AgentLinter subprocess. **No new agent deps for Phase 5.**

### Established Patterns

- **Catalog-versioned deps** (Phase 0 D-04): `packages/meta-observer/` uses catalog versions for any shared deps (zod especially, since meta-observer writes JSONL events that must validate against `packages/shared/src/schemas/observations.ts`).
- **Shared schemas single source of truth** (Phase 0 D-06, Phase 1 D-16): every new wire shape lands in `packages/shared/src/schemas/`. Phase 5 adds:
  - `skills.ts` (`SkillFrontmatterSchema`, `GlobalSkillsResponseSchema`, `LocalSkillsResponseSchema` — separate so per-project cache invalidates separately)
  - `agentlinter.ts` (`AgentLinterScoreSchema`, `PositionRiskSchema`, `AgentLinterResponseSchema` with failure-class discriminator)
  - `observability.ts` (`ObservabilitySignalSchema` per tool, `ObservabilityResponseSchema`)
  - `secrets.ts` (`SecretsResponseSchema` with `present-valid | present-invalid | absent` state)
  - `integrations.ts` (`IntegrationStateSchema` three-state, `IntegrationsResponseSchema`)
- **TS strict mode** + **ESM-only** + `exactOptionalPropertyTypes` carry from Phase 0–4. Apply equally to `packages/meta-observer/`.
- **TDD mandatory** per global CLAUDE.md and repo CLAUDE.md — every parser, scanner, route, schema, panel, and the meta-observer skill itself gets a failing test first.
- **Two-stage review** before merge — Stage 1 `/review` + Stage 2 `superpowers:requesting-code-review`. Stages do NOT collapse.
- **`pnpm lint` is mandatory** in pre-PR check.
- **Daemon-side `Schema.parse()` on outbound** (Phase 1 D-16): every new route uses `outbound(c, ResponseSchema.parse.bind(ResponseSchema), value)`.
- **Path allow-list defence** (Phase 1 D-23, extended in D-5-13): every filesystem read in new scanners must go through the `resolveAllowed` family with explicit root + name restrictions. The `.claude` allow-list already permits `~/.claude/skills/*/SKILL.md` reads at the daemon level — but only because Phase 5 routes anchor the allow-list at `os.homedir() + '/.claude/skills'`, not at a project root.
- **No native deps** (INV-05): `packages/meta-observer/` is bound by this — pure Node/TS, no FFI, no native modules. The hook script must run with whatever Claude Code skill runtime provides.

### Integration Points

**Daemon-side new files:**
- `packages/agent/src/lib/projectMetadataScan.ts` (NEW) — top-level metadata scanners: `parsePackageJson(projectRoot)`, `parseInfisicalConfig(projectRoot)`, `parseCiWorkflowsForSentry(projectRoot)`. Uses extended `resolveAllowed` (D-5-13).
- `packages/agent/src/lib/skillsScan.ts` (NEW) — `readSkillFrontmatter(skillRoot)` reusable for both global (`os.homedir() + '/.claude/skills'`) and local (`<root>/.claude/skills`). Uses Phase 4's `findSkillPath` for canonical/bundle-layout probing.
- `packages/agent/src/lib/agentLinterRunner.ts` (NEW) — execa subprocess + cache + failure classification. Cache key = `${projectId}:${maxMtime}` (D-5-14). Failure classification per D-5-15.
- `packages/agent/src/lib/integrationsState.ts` (NEW) — env-var presence detection + three-state aggregation (D-5-19). Imports `projectMetadataScan.ts` for the "present-but-not-configured" branch.
- `packages/agent/src/lib/cache.ts` (NEW or generalise `overviewCache.ts`) — per-route cache with TTL parameter. Phase 5 finally has more than two TTLs in flight, so the abstraction earns its keep.
- `packages/agent/src/routes/agentlinter.ts` (NEW) — `GET /api/projects/:id/agentlinter`.
- `packages/agent/src/routes/skills.ts` (NEW) — `GET /api/skills/global` (singleton, no projectId, daemon-only allow-list per D-5-12) + `GET /api/projects/:id/skills/local`.
- `packages/agent/src/routes/observability.ts` (NEW) — `GET /api/projects/:id/observability` returns multi-signal detection per D-5-17.
- `packages/agent/src/routes/secrets.ts` (NEW) — `GET /api/projects/:id/secrets` returns SecretsHealth state per D-5-18.
- `packages/agent/src/routes/integrations.ts` (NEW) — `GET /api/projects/:id/integrations` returns three-state per D-5-19.
- `packages/agent/src/server/app.ts` (EDIT) — wire the new routes (existing bearer + CORS + CIDR middleware applies unchanged).

**Daemon-side new schemas (in `packages/shared/src/schemas/`):**
- `skills.ts`, `agentlinter.ts`, `observability.ts`, `secrets.ts`, `integrations.ts` per the `Established Patterns` list.
- `packages/shared/src/index.ts` (EDIT) — re-export new schemas.

**SPA-side new files:**
- `packages/spa/src/components/panels/InstalledSkills.tsx` (NEW) — HEALTH-01. Consumes both `useGlobalSkills()` and `useLocalSkills(id)`, merges with `scope` tag.
- `packages/spa/src/components/panels/SkillHealth.tsx` (NEW) — HEALTH-02. Score badge + Position Risk count per row + click-to-expand inline (D-5-16).
- `packages/spa/src/components/panels/ObservabilityHealth.tsx` (NEW) — HEALTH-03. Signal-list per tool with "detected via X + Y" copy.
- `packages/spa/src/components/panels/SecretsHealth.tsx` (NEW) — HEALTH-04. Three-state (`present + valid` / `present-invalid` / `absent`).
- `packages/spa/src/components/panels/IntegrationsHealth.tsx` (NEW) — HEALTH-05. Three-state per integration (D-5-19) with inline guides (D-5-20).
- `packages/spa/src/components/SingleProjectView.tsx` (EDIT) — single-line CSS change `grid-cols-[1fr_1.5fr]` → `grid-cols-[1fr_1.5fr_1fr]` + new `<section>` with five panel mounts. Comment block at the top updated.
- `packages/spa/src/lib/projectQueries.ts` (NEW or EDIT — depends on whether Phase 4 created the file) — TanStack Query hooks: `useAgentLinter(id)`, `useGlobalSkills()`, `useLocalSkills(id)`, `useObservability(id)`, `useSecrets(id)`, `useIntegrations(id)`. Each wraps `apiFetch` + the right schema; cache key per Claude's-Discretion shape.

**meta-observer workspace package (NEW):**
- `packages/meta-observer/package.json` — pnpm workspace pkg, no native deps, catalog versions.
- `packages/meta-observer/SKILL.md` — Claude Code skill manifest. `name: meta-observer` (canonical hyphenated; matches DISC-04 install hint copy that Phase 4 already shipped).
- `packages/meta-observer/hooks/session-end.{sh|ts}` (NEW) — entry script per D-5-04. Language picked by researcher.
- `packages/meta-observer/lib/projectRoot.ts` (NEW) — CWD walk-up resolution per D-5-07.
- `packages/meta-observer/lib/writeCommitment.ts` (NEW) — extracts `## Workflow commitment` blocks from session transcript, writes `.md` per session per D-5-06.
- `packages/meta-observer/lib/writeFirings.ts` (NEW) — converts session hook events to JSONL stream per D-5-06, validated against `@agenticapps/dashboard-shared`'s `HookFiringSchema`.
- `packages/meta-observer/lib/atomicWrite.ts` (NEW) — write-to-`.tmp` + rename per Claude's-Discretion atomicity choice.
- `packages/meta-observer/test/` — vitest coverage of project-root walk-up, commitment extraction, JSONL conversion, atomic write.

**CI:** `.github/workflows/ci.yml` already runs lint + typecheck + test + build. The new `packages/meta-observer/` workspace gets picked up automatically by `pnpm -r typecheck` / `pnpm -r test` / `pnpm -r build`.

</code_context>

<specifics>
## Specific Ideas

- **Phase 5 owns producer + consumer.** Closing the G1 deferral inside Phase 5 (rather than punting to a sub-phase or external repo) was the most consequential decision. The dashboard is sold on "what every project's pipeline is doing right now" — shipping it with permanently-empty CommitmentBlock + HookFirings panels would dilute the value prop across all of v1.0. Bringing the persister into Phase 5 means more work but a complete product at v1.0 launch.
- **End-to-end populated panels gate Phase 5 closure (D-5-10).** Not a HUMAN-UAT item, not a "ships when researcher confirms" item — Phase 5 doesn't close until the dashboard's own `agenticapps-dashboard` repo has a populated CommitmentBlock screenshot. Captures the discipline the spec demands.
- **The 2→3-col widening is one CSS rule plus one `<section>`.** Phase 4 D-4-09 deliberately staged this. Phase 5 doesn't restructure the page — it executes the staged transition. Anti-slop discipline (Phase 3 D-43) applies: no animation on column entry, no skeleton-shimmer.
- **Multi-signal Observability detection (D-5-17) is honest about evidence.** The panel surfacing "detected via @sentry/node + .sentryclirc" tells the user *why* the dashboard thinks Sentry is installed. Single-signal detection (deps-only) would lie about projects that use sentry-cli without the SDK. The cost is per-signal parsing surface area; the win is panel honesty.
- **Three-state IntegrationsHealth (D-5-19) couples to ObservabilityHealth.** "Sentry SDK detected but `SENTRY_AUTH_TOKEN` not set" is a stronger nudge than "Configure to enable" — the user has already taken a step; the panel acknowledges that and points at the next one. Two-state would treat both projects identically.
- **Inline one-paragraph guides (D-5-20) constrain copy quality.** Each integration's "Configure to enable" paragraph must communicate: install line + env var name + what gets enabled — in roughly 50 words. This is a Phase 5 design constraint and a Phase 6 polish target if it doesn't pass impeccable.
- **AgentLinter failure classes are designed UX (D-5-15), not error handlers.** "Lint scan timed out — retry?" with a button is a different state from "AgentLinter not installed. Run `npm install -g agentlinter`". Each tells the user a different next action. Generic "lint unavailable" copy would be a regression from D-4-14's per-panel-empty-state discipline.
- **Path allow-list extension (D-5-11/D-5-12/D-5-13) is the most security-sensitive choice in Phase 5.** Three precise extensions: dedicated daemon-side scanners for top-level metadata (no `/read` exposure), singleton route for global skills, name-restricted `resolveAllowed` variant. Each preserves the principle that the SPA never names a path that resolves outside the allow-list root for that route. `/cso` audit must verify this: an attacker who somehow forges a SPA request still cannot read arbitrary project-root files.
- **meta-observer atomic write matters because the consumer reads latest-by-mtime.** D-4-05 picks the highest-mtime `.md` file. If the writer touches the file before content is written, CommitmentBlock could pick a partial file. Write-to-`.tmp` + rename is the safe pattern; planner picks but defaults to safe.
- **No new SPA or agent deps for Phase 5.** Phase 4 confirmed the shape; Phase 5 holds the line. New `packages/meta-observer/` workspace adds zod (catalog) and probably nothing else — no SDK bindings, no transcript-parsing libraries.

</specifics>

<deferred>
## Deferred Ideas

### Phase 5-adjacent items intentionally not covered here

- **Optional integration data fetching** (Sentry events panel, Linear issue badges, Infisical-aware env loading) — Phase 7. Phase 5's IntegrationsHealth surfaces *configuration state*, not data.
- **`agentic-dashboard install-launchd` / `install-systemd`** — Phase 6 (POLISH-02/03).
- **Keyboard shortcuts** (`R` refresh, `?` help, `/` focus search) — Phase 6 (POLISH-01).
- **`impeccable:critique` ≥ 90 hard gate** — Phase 6 (POLISH-04). Phase 5 inherits Phase 2/3/4 anti-slop discipline; the gate is Phase 6.
- **README install / pair / FAQ / troubleshooting** — Phase 6 (POLISH-06).
- **Header line 2** (Linear badge, ADR-touched, settings link) — deferred from Phase 4; Phase 5 doesn't add it back. Linear badge revisits with Phase 7's Linear integration.
- **meta-observer manual `meta-observer backfill` command** — D-5-08 picked forward-only. If the empty-Discipline-panels-post-install experience becomes annoying in dogfooding, revisit with a backfill command. Not in Phase 5 scope.
- **meta-observer auto-install at register time** — explicitly rejected (would violate INV-01: daemon writing into project FS). Reconsider only if Claude Code adds a skill-install primitive that the daemon can invoke without writing to project FS itself.
- **meta-observer global install (one for all projects)** — rejected (cross-project leak risk). Per-project install matches the per-project panel design.
- **Lockfile parsing** (yarn.lock / pnpm-lock.yaml) for transitive Sentry deps — package.json signals only for v1.
- **Monorepo / multi-root project detection** — single project root via CWD walk-up suffices. Multi-root projects defer until they appear in the registry.
- **Cross-phase ReviewStatus aggregation** — Phase 4 D-4-16 keeps ReviewStatus phase-scoped; cross-phase aggregate could land in Phase 6 or never.
- **3-col responsive break-out at narrow widths** — desktop-first. If QA flags narrow-screen issues, planner adds a stack-vertically rule with a threshold.
- **Cached-stale-fallback for AgentLinter** — explicitly rejected; a stale lint result against an outdated skill set lies more than a clear failure state.
- **`/api/skills/global` on-disk cache persistence** — in-memory by default; revisit if daemon restart frequency makes the warm-up cost annoying.

### From spec / earlier-phase open questions still pending

- **Q1/Q2 Repo visibility flip + LICENSE** (Phase 1 deferred) — Phase 8.
- **Q3 CF Access policy on production domain** (Phase 1 deferred) — Phase 6.
- **Q5 Meta-observer skill packaging** (Phase 1 deferred) — **closed by Phase 5 D-5-03**: lives in `packages/meta-observer/` workspace pkg.
- **Q6 AgentLinter integration** (Phase 1 deferred) — **closed by Phase 5 D-5-14..D-5-16**.
- **Phase 1 HUMAN-UAT pending items** (Tailscale live bind + 0.0.0.0 yellow banner) — tracked in `01-HUMAN-UAT.md`. Phase 6 polish or out-of-band.
- **Phase 0 + Phase 2 HUMAN-UAT verification debt** — 14 `human_needed` items (CF Pages, npm publish, three-way pairing). External-service-dependent; Phase 6 or alongside live deployment.
- **Phase 3 impeccable deltas** (Color 76, Typography 78, Layout 84) — Phase 6 polish.
- **A-01 rate-limit + A-02 schema-bounds** (Phase 3 PR follow-ups) — Phase 6.

### Reviewed Todos (not folded)

None — `gsd-tools todo match-phase 5` returned 0 matches.

</deferred>

---

*Phase: 05-skills-health-panels*
*Context gathered: 2026-05-06*
