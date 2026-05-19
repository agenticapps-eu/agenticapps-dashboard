# Requirements: AgenticApps Pipeline Dashboard

**Defined:** 2026-05-02
**Core Value:** A single place to see, from any device, what every AgenticApps project's pipeline is doing right now — without ever sending project data to a remote service.
**Source spec:** `docs/spec/dashboard-prompt.md` (treat as binding).

---

## v1 Requirements

Phases 0–6 deliver a complete, useful dashboard with zero third-party service dependencies. v1 = Phases 0–6.

### Bootstrap (Phase 0)

- [ ] **BOOT-01**: pnpm workspace skeleton with `packages/spa`, `packages/agent`, `packages/shared` and a single root lockfile
- [ ] **BOOT-02**: CI workflow runs lint + typecheck + test on push and PR; green on `main` head
- [ ] **BOOT-03**: Cloudflare Pages preview deploy works on push to a branch; PR comment links to the preview URL
- [ ] **BOOT-04**: Placeholder agent package published to npm as `@agenticapps/dashboard-agent@0.0.1-alpha.0`
- [ ] **BOOT-05**: README at repo root with "alpha" notice, install snippet, and link to the spec

### Daemon Core (Phase 1)

- [ ] **DAEMON-01**: `agentic-dashboard start` boots the Hono server bound to `127.0.0.1:5193` by default
- [ ] **DAEMON-02**: `agentic-dashboard stop` gracefully shuts down a running daemon
- [ ] **DAEMON-03**: `agentic-dashboard status` reports daemon health and registered project count
- [ ] **DAEMON-04**: Daemon refuses to start if `auth.json` permissions are not `0600`, with a clear remediation message
- [ ] **DAEMON-05**: Daemon prints a one-click pair URL and manual-pair token at startup
- [ ] **DAEMON-06**: `--bind tailscale` auto-detects the Tailscale IP via `tailscale ip -4` and gracefully degrades when Tailscale is absent

### Auth & Pairing (Phase 1)

- [ ] **AUTH-01**: All routes require `Authorization: Bearer <token>`; missing/invalid token → 401
- [ ] **AUTH-02**: CORS allows only `https://dashboard.agenticapps.eu` (prod) and `http://localhost:5174` (dev) — others → CORS preflight rejected
- [ ] **AUTH-03**: `agentic-dashboard rotate-token` invalidates the current token immediately and issues a new one
- [ ] **AUTH-04**: Token auto-rotates after 30 days uptime; SPA detects 401 and prompts re-pair
- [ ] **AUTH-05**: Pair URL flow stores `{agentUrl, token}` in SPA localStorage and redirects to `/`

### Registry CRUD (Phase 1)

- [ ] **REG-01**: `agentic-dashboard register <path>` adds a project; collisions get `-2`/`-3` suffix on slugified id
- [ ] **REG-02**: `agentic-dashboard register --auto <parent-dir>` scans for AgenticApps markers and confirms each match
- [ ] **REG-03**: `agentic-dashboard unregister <id|path>` removes a project
- [ ] **REG-04**: `agentic-dashboard list` reports registered projects + status, marks unreachable roots without crashing
- [ ] **REG-05**: `agentic-dashboard rename <id> <new-name>` and `tag <id> <tag>...` mutate the registry only

### Path Allow-list & Read Routes (Phase 1)

- [ ] **API-01**: `GET /health` returns `{ ok, daemonVersion, registryCount, paired }`
- [ ] **API-02**: `GET /api/projects/{id}/read?path=...` rejects paths containing `..`, absolute paths, or realpaths outside `<root>/.planning` or `<root>/.claude` with 422
- [ ] **API-03**: `GET /api/projects/{id}/git?cmd=...` only executes allow-listed git subcommands (`log`, `status`, `diff-stat`, `branch`)

### SPA Shell & Pairing (Phase 2)

- [ ] **SPA-01**: Vite + React + Tailwind shell builds and serves at `localhost:5174` with hot-reload < 2s
- [ ] **SPA-02**: `/pair?agent=...&token=...` validates agent URL pattern, calls `/health`, stores credentials, redirects to `/`
- [ ] **SPA-03**: `/onboarding` shows install instructions when no pairing exists in localStorage
- [ ] **SPA-04**: `/settings` provides manual-pair fallback (paste agent URL + token) and theme toggle

### Multi-project Home (Phase 3)

- [ ] **HOME-01**: `GET /api/registry` returns all projects with per-project status (`reachable`, `currentPhase`, `lastCommitAt`)
- [ ] **HOME-02**: `GET /api/projects/{id}/overview` returns summary card data: phase, Stage 1/2 status, finding counts, must_haves vs evidence, last commit, branch
- [ ] **HOME-03**: Home page renders one card per registered project; cards refresh every 5s; per-card freshness visible
- [ ] **HOME-04**: Filter chips (`all` / `active` / `client` / `internal`) and search box filter the card grid
- [ ] **HOME-05**: Sort: tag priority (active > client > internal), then by last commit time desc
- [ ] **HOME-06**: "+ Register project" card opens a modal that POSTs to `/api/registry/register`

### Single-project View — Discipline Column (Phase 4)

- [x] **DISC-01**: Left column shows `CommitmentBlock` panel: last `## Workflow commitment` block from the project — *Phase 4 ships the panel + parser; data source `.planning/skill-observations/*.md` requires a transcript persister (meta-observer or equivalent) which lands in Phase 5+. Until then the panel renders the empty state. Acceptance gated on Phase 5+ data path.*
- [x] **DISC-02**: Left column shows `HookFirings` panel: last 20 entries from `.planning/skill-observations/`
- [x] **DISC-03**: Left column shows `RationalizationFires` panel: counter per rationalization-table row that fired
- [ ] **DISC-04**: When meta-observer skill is missing, panel shows install hint with copy-pasteable command (no crash)

### Single-project View — Phase Progress Column (Phase 4)

- [ ] **PHASE-01**: Center column shows `PhaseProgress`: file-by-file checklist (CONTEXT, PLAN, etc.)
- [ ] **PHASE-02**: Center column shows `ExecutionTimeline`: TDD red/green commit pairs from git log
- [ ] **PHASE-03**: Center column shows `ReviewStatus`: Stage 1/2 status, finding counts by severity (parsed from `<finding severity="...">` blocks)
- [ ] **PHASE-04**: Center column shows `SecurityStatus`: `/cso` + database-sentinel summary
- [ ] **PHASE-05**: Center column shows `VerificationStatus`: must_haves vs evidence count

### Single-project View — Health Column (Phase 5)

- [x] **HEALTH-01**: Right column shows `InstalledSkills`: `~/.claude/skills/` (global) + project `.claude/skills/`
- [x] **HEALTH-02**: Right column shows `SkillHealth`: AgentLinter scores + Position Risk warnings (cached 1h)
- [x] **HEALTH-03**: Right column shows `ObservabilityHealth`: detection of Spotlight / Sentry SDK / sentry-cli via grep
- [x] **HEALTH-04**: Right column shows `SecretsHealth`: `.infisical.json` presence detection (informational only)
- [x] **HEALTH-05**: Right column shows `IntegrationsHealth`: Sentry / Linear / Infisical configured-or-not status with "configure" links

### Polish, Service Install, Acceptance (Phase 6)

- [ ] **POLISH-01**: Keyboard shortcuts: `R` refresh, `?` help, `/` focus search
- [ ] **POLISH-02**: `agentic-dashboard install-launchd` produces a working LaunchAgent that survives macOS reboot
- [ ] **POLISH-03**: `agentic-dashboard install-systemd` produces a working systemd user unit on Linux
- [ ] **POLISH-04**: Dashboard's own UI passes `impeccable:critique` ≥ 90 (gate before merge)
- [ ] **POLISH-05**: Two-stage review (Stage 1 + Stage 2 with `<finding>` schema) ran on the dashboard's own code before merge
- [ ] **POLISH-06**: README includes install / pair / FAQ / troubleshooting sections

### Help docs v1.0 (Phase 7)

- [x] **HELP-01**: 5 anchor MDX pages (`/help`, `/help/workflow/overview`, `/help/repos/overview`, `/help/observability/overview`, `/help/operations/install`) render with frontmatter (slug/title/order/section), GFM extras (tables, links, fenced code), and embedded Mermaid diagrams
- [ ] **HELP-02**: 29 stub paths (workflow ×11 including rationalization-table + red-flags; repos ×6; observability ×7; operations ×4; reference ×4 minus the now-ready `shortcuts`) render `<ComingSoon section title />` with correct back-link without crash
- [ ] **HELP-03**: `HelpLayout` renders sidebar (collapsed-on-mobile drawer; sticky-on-desktop nav) + main `<article className="prose">` content; zero console errors on any anchor route
- [ ] **HELP-04**: `<HelpWidget name="..." />` dispatches the 8 named widget stubs (RepoTopologyMap, WorkflowStateMachine, GatePicker, TraceVisualizer, ScanReportPlayground, ApplyConsentSimulator, MigrationDryRun, SlashCommandCatalog) via `React.lazy`; unknown widget renders a bordered error message
- [ ] **HELP-05**: `<HelpHook topic="..." />` component compiles and exports cleanly; pure `topicToUrl()` returns expected `/help/<segments>` URLs with optional `#anchor` (consumer wiring deferred to v1.1)
- [x] **HELP-06**: existing `/help` keyboard-shortcuts page replaced by docs landing; shortcuts content lives at `/help/reference/shortcuts` MDX page rendering the `KbdHint` table; `?` keyboard shortcut still navigates to `/help` landing

### Coverage Matrix Page (Phase 10)

- [x] **COV-01**: `GET /api/coverage` returns the full coverage matrix — one entry per git repo under `~/Sourcecode/{agenticapps,factiv,neuroflash}` (one level deep), each entry has `family`, `repo`, `claudeMd`, `gitNexus`, `wiki`, `workflowVersion` columns + `overrideCount` + per-column freshness state (`fresh`/`stale`/`missing`/`not-applicable`).
- [x] **COV-02**: Filesystem reads outside the dashboard project root use daemon-side dedicated scanners only (no `/api/projects/:id/read` exposure); `resolveAllowedNamed` extended with new allowed roots (`~/.gitnexus`, `~/Sourcecode/agenticapps`, `~/Sourcecode/factiv`, `~/Sourcecode/neuroflash`); SPA never names any external path.
- [x] **COV-03**: `GET /api/coverage` response cached 30s daemon-side; cache cleared on `POST /api/coverage/refresh`; cold-load scan completes < 1s for ~42 repos.
- [x] **COV-04**: `POST /api/coverage/refresh` accepts `{ family, repo, action }` with `action` constrained to the enum `{ "gitnexus-analyze" }`; daemon spawns `gitnexus analyze` (repo-scoped, PATH-resolved binary, never `npx`) and returns `{ updatedRow: CoverageRow }` (REQUIRED, not optional) on success; clipboard actions (wiki refresh, CLAUDE.md authoring, workflow-version update) are SPA-side only — the SPA constructs the clipboard string locally from shared `packages/shared/src/clipboard.ts` builders and never round-trips through the daemon; the daemon REJECTS any non-`gitnexus-analyze` action at Zod parse with 400 (D-10-09).
- [x] **COV-05**: `/coverage` route renders grouped sections per family with sticky headers showing aggregate counts (`✕ N missing · ⚠ N stale · ✓ N fresh`) + per-family collapse toggle; matrix value always visible (never hidden behind tree expansion).
- [x] **COV-06**: Page-header toolbar provides status filter chips (`[all] [✕ missing] [⚠ stale] [✓ fresh]` multi-select with "all" default) + free-text repo-name search; default sort family-alpha then repo-alpha; filter state persisted in URL query params for deep-linking; family aggregate counts reflect filtered view.
- [x] **COV-07**: Inline `⚠ N override` chip rendered next to repo name when any `<repo>/.planning/phases/*/multi-ai-review-skipped` sentinel exists; click expands inline to list `<phase-slug> — sentinel since <ISO-date>` entries; chip absent when count is 0.
- [x] **COV-08**: Workflow-version "current head" derived from the highest-numbered file in `~/Sourcecode/agenticapps/claude-workflow/migrations/*.md`, parsing `to_version` from YAML frontmatter; per-repo cell compares installed SKILL.md (probed at any of 4 candidate paths under `<repo>/.claude/skills/` per dual-dirname × dual-layout probe — see RESEARCH.md §"Skill directory probe MUST try both layouts" and Plan 10-02 Task 3) frontmatter `version` field against this head (equal=green, behind=amber, ahead=green-with-annotation, missing-skill-file=red, missing-version-field=amber with "version unknown" subtext).
- [x] **COV-09**: AppShellV2 sidebar gets a new `Observability` section between `Projects` and `Help`, containing a single `Coverage` entry routing to `/coverage`.
- [x] **COV-10**: When `~/.gitnexus/` directory does not exist, the GitNexus column shows `⚪ Not installed` for every row; each family-section header (the FamilyHeader component inside CoverageFamilySection) shows a one-line `npm install -g gitnexus` hint with a Copy button; rows show `not-applicable` freshness state; never crashes, never shows red; there is NO page-level banner — the hint sits at the family aggregate level to match the family-grouping architecture.
- [x] **COV-11**: Four-state per-column freshness: `fresh` (green ✓), `stale` (amber ⚠), `missing` (red ✕), `not-applicable` (gray ⚪); thresholds — GitNexus stale at > 14 days since last index, Wiki stale at > 7 days since last family compile, Workflow stale at any version below head, CLAUDE.md never stale (binary present/absent).
- [x] **COV-12**: Migration `0008-coverage-matrix-page.md` ships in `~/Sourcecode/agenticapps/claude-workflow/migrations/` alongside the dashboard PR; frontmatter `from_version: 1.5.0`, `to_version: 1.6.0` (**re-anchored 2026-05-14** via claude-workflow PR #17 "chain integrity": coverage matrix is a dashboard surface, not a consumer-repo capability bump, so it took a smaller version slot. CLAUDE.md vendoring migration 0009 now carries the 1.6 → 1.8 jump that was originally bundled with 0008); documents the new `/coverage` route as a workflow surface (so other repos can discover where coverage is tracked); workflow scaffolder head currently at 1.9.3 (0007 gitnexus-code-graph-integration).

### Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle (Phase 11)

**Minted:** 2026-05-16 during `/gsd-plan-phase 11`. Working stems `TRD-*` (trends), `SKD-*` (skill drift), `PLI-*` (polish) per ROADMAP placeholder. Adopts the proposed mapping from `11-RESEARCH.md` §"Phase Requirements".

#### Coverage trends (TRD-*)

- [x] **TRD-01**: Daemon writes daily NDJSON snapshot to `~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson` (UTC date). Directory created with `mode 0o700` on first use; file created with `mode 0o600`; explicit `fs.chmod(path, 0o600)` re-applied after first creation to defend against umask drift on subsequent appends. Snapshot record shape is row-per-day: one record per repo per day with the four per-column freshness states (`claudeMd`, `gitNexus`, `wiki`, `workflowVersion`) inline. Realised by `snapshotWriter.ts` reading `scanCoverageInternal()` and emitting one NDJSON line per row via `fs.appendFile(..., { flag: 'a', mode: 0o600 })`. (D-11-01, D-11-13, INV-02 generalised to directory tree)
- [x] **TRD-02**: Snapshot pruner drops files whose ISO-date filename is older than `now - 14d`; runs lazily IMMEDIATELY before each writer tick (no second scheduler). Filename regex-validated (`/^\d{4}-\d{2}-\d{2}\.ndjson$/`) — non-matching entries are skipped, not unlinked. (D-11-01)
- [x] **TRD-03**: `GET /api/coverage/history?repoId=&cell=` returns `CoverageHistoryResponseSchema` `{ schemaVersion: 1, repoId, cell, direction, daysSince, windowDays: 14 }` for a single (repo, cell) coordinate. Server-side drift computation: scans the 14-day NDJSON window for the most-recent state transition; returns `direction='up'` (improvement) / `'down'` (regression) / `null` (no transition in window) and the corresponding `daysSince` (or `null`). Query params Zod-validated: `repoId` matches `/^[a-z0-9\-]+\/[a-z0-9\-_]+$/`; `cell` ∈ enum `{claudeMd, gitNexus, wiki, workflowVersion}`. Cached 1h daemon-side via `coverageHistoryCache.ts` `Map<string, { value, expiresAt }>` keyed by `${repoId}:${cell}`. Bearer-auth + CORS inherited from middleware chain. (D-11-11, D-11-12)
- [x] **TRD-04**: Daily snapshot trigger fires once per ISO date while daemon is running via an **in-process scheduler** (PD-11-01 — see Plan 02). Implementation: `setTimeout` chain anchored to next 03:00 local time, re-armed after each tick, `.unref()`'d so it does not block daemon shutdown. Errors swallowed (logged via `agentError`) so a failed write never crashes the daemon and the scheduler always re-arms. First-boot fires immediately IF `<today-UTC>.ndjson` does not yet exist; never backfills historical missed days. NO `StartCalendarInterval` added to Phase 6 launchd plist (research finding A9 — `KeepAlive=true` makes the plist incompatible with calendar triggers). (D-11-02 reinterpreted via PD-11-01)
- [x] **TRD-05**: `CoverageCell` renders `▲Nd` / `▼Nd` inline indicator below the existing 4-state subtext when `drift` prop is present (`{ direction: 'up' | 'down'; daysSince: number }`). New component `CoverageDriftBadge.tsx` — text-only span using `text-status-success` (▲ / improvement) and `text-status-error` (▼ / regression) tokens. `aria-label` reads `"Improved N day(s) ago"` / `"Regressed N day(s) ago"`. NO new hex literals; `tokenSourceOfTruth.test.ts` continues to pass. (D-11-03 — component name MUST NOT be `InlineDrift` — Phase 6 schema-drift panel collision)

#### Cross-repo skill drift (SKD-*)

- [x] **SKD-01**: Daemon `scanSkillDrift()` aggregator iterates `readRegistry().projects`, calls `readLocalSkills(p.root)` per project, derives family by path-prefix matching `root` against `~/Sourcecode/{agenticapps,factiv,neuroflash}/` with `'other'` fallback for off-family roots. Uses `Promise.allSettled` partial-failure isolation (Phase 10 AGREED-2 precedent) — one project's failure produces a `degraded: <error>` column entry, never a 500. Family derivation helper `familyOf(root)` lives in `skillDriftScan.ts`; fixture-tested against `'agenticapps'`, `'factiv'`, `'neuroflash'`, and `'other'` buckets. (Registry has no family metadata — verified live: `client: null` for every entry — family MUST come from path.) (D-11-04)
- [x] **SKD-02**: `GET /api/skills/drift` returns `SkillDriftResponseSchema` — `{ schemaVersion: 1, generatedAtIso, projects: [{projectId, projectName, family, degraded?}], rows: [{skillId, byProject: Record<projectId, SkillDriftCell>}] }`. Cached 30s daemon-side via `skillDriftCache.ts` (single-key memo, matches Phase 10 coverage-cache cadence). Bearer-auth + CORS inherited. Outbound `parseOrDrift` via `outbound()` wrapper (INV-04). (D-11-04, D-11-12)
- [x] **SKD-03**: `POST /api/skills/drift/agentlinter` accepts body `{ projectId: string }` (Zod `.min(1)`; route schema does NOT support arrays or comma-lists — single-project-per-request enforced structurally per D-11-14). Looks up project root via `readRegistry()` — fails closed (404) on unknown `projectId`. Reuses Phase 5 `agentLinterCache` (`getAgentLinterCached` / `setAgentLinterCached` / `computeMaxMtime`) + Phase 5 `runAgentLinter(entry.root)` — same binary, same `--local` flag, same 30s timeout, same supply-chain invariant (D-5-21). Returns 200 + sync body matching Phase 5's GET shape (`AgentLinterResponseSchema`). Bearer-auth on every request. (D-11-05, D-11-14)
- [x] **SKD-04**: New SPA route `/observability/skill-drift` (lazy + zodValidator under `_appshell` layout) renders per-skill matrix (rows = skills, columns = projects). `SkillDriftMatrix.tsx` renders one row per `SkillDriftRow.skillId`, one column per `projects[]` entry, with `SkillDriftCell.tsx` showing presence + version per (skill, project). `SkillDriftToolbar.tsx` provides per-family/cross-family filter chip (Phase 10 `CoverageToolbar` pattern: 200ms debounce + URL sync via `?scope=family|cross`; default `scope=family`). Per-row "Run AgentLinter" button POSTs to `/api/skills/drift/agentlinter` for ONE project at a time. (D-11-04, D-11-06)
- [ ] **SKD-05**: AppShellV2 `Observability` sidebar section graduates from one entry (`Coverage`) to two peer entries: `Coverage` and `Skill drift`. Both use the existing `SidebarItem` primitive (NOT `SidebarSubItem`) so visual indent matches the established peer pattern in `Sidebar.tsx`. (D-11-08 — overrides the CONTEXT `SidebarSubItem` mention based on code-pattern review of `Sidebar.tsx:69-73`.)

#### Polish bundle (PLI-*)

- [x] **PLI-01**: `PageHeader` gains a `sticky?: boolean` prop (default `false` — preserves current behaviour on every route that has not opted in). When `sticky={true}`, the outer `<div>` className becomes `mb-6 flex flex-col gap-1 sticky top-0 z-10 bg-app-bg`. `z-10` matches the existing `--z-sticky: 10` token; `bg-app-bg` (`#FAFAF7`) provides the opaque backstop so scrolled content does not bleed through; the `mb-6` 24px bottom margin is preserved per CONTEXT §Specifics. (D-11-09)
- [x] **PLI-02**: `CoverageRow.tsx` per-row refresh button starts at `opacity-30` (was `opacity-0`); hover/focus still bumps to `opacity-100`. One-token swap on the existing className. (D-11-10)
- [x] **PLI-03**: `/coverage` route (`packages/spa/src/routes/coverage.lazy.tsx`) opts into sticky `PageHeader` by passing `sticky={true}`. Other dashboard routes remain default (`sticky=false`) and adopt during their own cycles. (D-11-09 opt-in pattern)

### Impeccable P1 polish bundle (Phase 11.1)

**Minted:** 2026-05-18 during `/gsd-plan-phase 11.1`. Working stem `IMP-*` (impeccable polish). Bundle of 4 inherited P1s from `11-IMPECCABLE.md` (calibration data point #2, composite 76). Targeted lift: composite 76 → ~82; calibration data point #3 to settle D-10.5-03 floor recalibration.

- [ ] **IMP-01**: All three `CoverageFamilySection` `<table>` elements render identical pixel widths per column at 1440×900. Implemented via shared `<colgroup>` populated from `packages/spa/src/components/panels/coverage/coverageColumns.ts` (single source of truth: `repo: w-72`, `claudeMd: w-32`, `gitNexus: w-32`, `wiki: w-[22rem]`, `workflow: w-32`, `actions: w-8`). `table` element gains `table-fixed` className. `CoverageRow.tsx` consumes the same constants for cell widths. Verified by `CoverageFamilySection.test.tsx` asserting `<col>` className equality across 3 sections + `/browse` screenshot at scrollY 0/400/800. (D-11.1-01, D-11.1-02 — rejects Option B CSS-Grid refactor)
- [ ] **IMP-02**: `CoverageToolbar` (filter chips + search input) is rendered INSIDE the sticky `PageHeader` block (via its `children` slot) so it remains visible at every `main.scrollTop` value. Layering-stack offsets switch from hardcoded `top-8` / `top-[5.0625rem]` to `calc(var(--ph-h) - 1.5rem)` / `calc(var(--ph-h) + 1.5625rem)`. The CSS variable `--ph-h` is published by a new `usePageHeaderHeight()` hook (`ResizeObserver` observing the PageHeader's rendered height, writing the px value to `document.documentElement.style`). `:root { --ph-h: 56px }` default in `tokens.css` covers first-paint before measurement lands. Verified by `CoveragePage.test.tsx` structural assertion (`<CoverageToolbar>` inside the sticky subtree) + `--ph-h` published assertion + `/browse` screenshot at scrollY 200/600/1000. (D-11.1-03, D-11.1-04, D-11.1-05)
- [ ] **IMP-03**: Every clipboard write surfaces a visible toast within 200ms. New `Toast` primitive (`packages/spa/src/components/ui/Toast.tsx` + `ToastProvider` + `useToast()` hook) renders via `document.body` portal at `position: fixed; top: 16px; right: 16px; z-index: var(--z-toast)`. Single-slot replace semantics (rapid second `show()` REPLACES the current toast — no queue). Opacity-only animation (`transition-opacity duration-150 ease-out`). Default duration 2400ms. Variants: `success` (green tint, `aria-live="polite"`, glyph `✓`) and `error` (red tint, `aria-live="assertive"`, glyph `✕`). Wired at all 6 clipboard call sites: `IndexGitNexusButton.tsx`, `InstallGitNexusButton.tsx`, `CoverageEmptyState.tsx`, `CoverageFamilySection.tsx:152` (family npm install), `CoveragePage.tsx:145` (wiki-compile), `CoveragePage.tsx:148` (workflow update). `ToastProvider` wraps `AppShellV2` so every authenticated route inherits the context. Wording is contextual per call site (CLI vs URL semantics). On `writeToClipboard → false`: error variant. (D-11.1-06..12)
- [ ] **IMP-04**: `--color-text-tertiary` swaps from `#807A92` to `#75708A` in `packages/spa/src/styles/tokens.css`. Computed contrast ratios: ~4.69:1 vs `--color-app-bg` (`#FAFAF7`), ~4.64:1 vs `--color-sidebar-bg` (`#F8F6F3`). Both clear WCAG AA body-text floor (4.5:1) with safe margin. Tier-gap analysis: secondary at `#6B6478` (~5.18:1) preserves ~1.10:1 inter-tier ratio (visible delta retained vs IMPECCABLE-suggested `#6B6580` which collapsed the tier at ~1.02:1). Token-history comment block updated to document the v1.0.0 → v1.0.1 → v1.1 chain. All ~40 consumers inherit automatically — no per-site review required. (D-11.1-13, D-11.1-14)
- [ ] **IMP-05**: Token-contrast invariant locked. `packages/spa/src/lib/contrast.ts` provides pure-JS WCAG 2.1 relative-luminance + contrast-ratio helpers (~10 LOC, zero deps). `packages/spa/src/styles/verify-contrast.test.ts` asserts every `text-*` token clears its WCAG floor against both `--color-app-bg` and `--color-sidebar-bg` (primary ≥13:1, secondary ≥4.5:1, tertiary ≥4.5:1). Test runs in CI on every PR — any future token edit that regresses contrast fails the suite. Closes the v1.0.1 → v1.1 regression class. (D-11.1-15)

### Observability Conformance Surface (Phase 12)

**Minted:** 2026-05-19 during `/gsd-plan-phase 12`. Working stems `CON-*` (conformance score), `FCH-*` (fleet chart), `RPD-*` (registry path drift), `RVP-*` (responsive viewport), `PAGE-*` (page composition), `NAV-*` (sidebar), `FOUNDATION-*` (wave 0 retention bump), `IMP-*` (impeccable artifact). Maps the 29 ratified D-12-NN decisions (D-12-01..D-12-29) onto the requirement surface. Plan set: 7 plans across 6 waves. Calibration data point #5 for D-10.5-03 floor recalibration.

#### Foundations (FOUNDATION-*)

- [ ] **REQ-12-FOUNDATION-01**: `packages/agent/src/lib/snapshots/snapshotPaths.ts` `RETENTION_DAYS` constant bumps from `14` → `90` to power the 90-day fleet conformance trend chart (D-12-09). Non-cascading per A1 (verified): `CoverageHistoryResponseSchema.windowDays: z.literal(14)` is the Phase 11 drift-summary window, semantically independent of snapshot retention. `snapshotPaths.test.ts:31` asserts new value; `snapshotPruner.test.ts` unchanged (uses explicit `14` arg, not constant reference). (D-12-09 + RESEARCH §Pitfall 1)

#### Conformance score (CON-*)

- [ ] **REQ-12-CON-01**: New shared schema `packages/shared/src/schemas/conformance.ts` with `ConformanceTierSchema` (`green` / `amber` / `red`), `tierOf(score)` helper (≥90 green / 70-89 amber / <70 red), `ConformanceDayPointSchema`, `PathDriftReasonSchema`, `PathDriftEntrySchema`, `ConformanceResponseSchema` (`.strict()` on every nested object — wire-drift defence), `RegistryFixPathRequestSchema`. Barrel re-export from `packages/shared/src/index.ts`. (D-12-04, D-12-14, D-12-15, D-12-16, D-12-05)

- [ ] **REQ-12-CON-02**: `packages/agent/src/lib/conformanceScore.ts` exports pure `computeConformanceScores(coverage: CoverageResponse, driftedRepoIds: Set<string>): Record<CoverageFamily | 'fleet', FamilyScore>`. Equal-weight per cell across 4 columns (D-12-03). `not-applicable` cells excluded from BOTH numerator and denominator (Pitfall 2). Drifted repo IDs excluded from per-family denominator (D-12-07). 'other' family excluded entirely (D-12-06 = 3 family cards + fleet only). Fleet score = `Math.round((agenticapps + factiv + neuroflash) / 3)` — mean-of-3 (Pitfall 3 / A8). Integer-only (D-12-05).

- [ ] **REQ-12-CON-03**: `tierOf(score: number) → 'green' | 'amber' | 'red'` lives in shared schema (REQ-12-CON-01); both daemon and SPA import. Boundary semantics: 89→amber, 90→green, 69→red, 70→amber, 0→red, 100→green. (D-12-04)

- [ ] **REQ-12-CON-04**: Daemon route `GET /api/observability/conformance` returns the bulk-per-family `ConformanceResponse` payload (D-12-16): `{ schemaVersion: 1, today: {...}, delta14d: {...}, series: ConformanceDayPoint[90], drifted: PathDriftEntry[] }`. Bearer-auth + CORS inherited from middleware (Phase 1). Outbound parse via `outbound()` wrapper (INV-04 schema-drift defence). 30s daemon cache via `conformanceCache.ts` singleton (D-12-17). SPA hook `useConformance` (30s staleTime per Pitfall 11) consumes via `apiFetch` + `parseOrDrift`. (D-12-14, D-12-17, D-12-02)

- [ ] **REQ-12-CON-05**: `packages/agent/src/lib/conformanceScan.ts` orchestrator composes `scanCoverageInternal()` + `detectPathDrift()` (via `Promise.allSettled` partial-failure isolation) + `computeConformanceScores()` + `readDailySeriesForFleet({ driftedRepoIds })`. Derives `delta14d` from `series[length-15]` (today minus 14 days ago). Defensive payload on partial failures (daemon never 500s on a partial scan). `snapshotFleetReader.ts` walks the 90-day NDJSON window emitting per-day fleet+family scores with last-record-wins same-day collapse + Pitfalls 2/3 consistency. (D-12-16, D-12-25)

#### Fleet trend chart (FCH-*)

- [ ] **REQ-12-FCH-01**: `packages/spa/src/components/panels/conformance/FleetTrendChart.tsx` is a pure-SVG primitive with LOC budget ≤ 120 (D-12-08). Props: `{ series: ConformanceDayPoint[]; ariaLabel: string }`. Zero chart libraries (no Recharts / Chart.js / D3). LOC verified by test asserting non-blank non-comment line count ≤ 120. (D-12-08, D-12-10)

- [ ] **REQ-12-FCH-02**: Chart layout — 90-day x-axis with daily tick marks (90 small lines) + text labels every 14 days (≈7 labels). Y-axis 0-100 with gridlines at 0/25/50/75/100. Threshold rules at 70 (amber line) and 90 (green line) use `strokeDasharray="4 4"`. 4 polylines: 3 family (stroke 1.5, distinct status tokens) + 1 fleet aggregate (stroke 2.5, heavier — `stroke-text-primary`). (D-12-09, D-12-10, D-12-12)

- [ ] **REQ-12-FCH-03**: Per-day reveal supports hover + focus + keyboard + touch (Pitfall 5). Wires `onMouseEnter`/`onMouseLeave` (desktop), `onFocus`/`onBlur` on invisible `<rect tabIndex={0}>` overlays (keyboard nav), `onPointerDown` (touch/iPad-Tailscale), and `Escape` key closes (Phase 11.2 Tooltip parity). Breakdown panel anchored top-right within chart bounds (no overflow on viewport <900px). (D-12-11, D-12-22 hook reuse)

- [ ] **REQ-12-FCH-04**: Empty state — `series.length === 0` renders "No history yet — building 90-day trend"; `series.length > 0 && < 14` renders `"Building 90-day trend — N more day(s) of data needed"`. Honest cold-start UX (D-12-13).

- [ ] **REQ-12-FCH-05**: A11y — `role="img"` + `aria-label` on chart wrapper. Sibling visually-hidden `<table className="sr-only">` with one `<tr>` per day mirroring SVG data (Date / Fleet / agenticapps / factiv / neuroflash columns). SR users get the table; sighted users get the SVG. (Pitfall 8)

#### Registry path drift (RPD-*)

- [ ] **REQ-12-RPD-01**: `packages/agent/src/lib/registryPathDrift.ts` exports `detectPathDrift()`. Iterates `readRegistry().projects`. Per entry: emits `reason: 'missing'` when `existsSync(root)` is false; emits `reason: 'symlink-target-changed'` when `realpath(root)` differs from `canonicaliseRoot(root)`; emits `reason: 'git-remote-changed'` when `.git/config` `remote.origin.url` is readable but stored path is not under any family root tree. Failure-isolated (`try/catch` per entry; never throws). Returns `PathDriftEntry[]` matching shared schema. (D-12-18)

- [ ] **REQ-12-RPD-02**: `inferSuggestedPath(originUrl: string): Promise<string | null>` is best-effort. Reads `.git/config` via `fs.readFile` + regex parse (`[remote "origin"]\nturl = ...`) — NO subprocess invocation (RESEARCH §Environment availability fallback; T-12-SUPPLY-CHAIN). Iterates `COVERAGE_ROOTS` family roots (agenticapps / factiv / neuroflash) one level deep; first match wins; returns `realpath(candidate)` or candidate path on realpath failure. Returns `null` when no candidate matches. Never throws. (D-12-21)

- [ ] **REQ-12-RPD-03**: Daemon route `POST /api/admin/registry/fix-path` with body `{ id, newPath }` (Zod `.strict()` rejects extra keys). Defences (in order): bearer-auth inherited; rate-limiter `rlConsume(tokHash)` 10/10s (T-12-DENIAL-OF-SERVICE); Zod body parse 422 `invalid_request`; `canonicaliseRoot(newPath)` (realpath + abs) → 422 `newPath_unresolvable` on ENOENT; `assertRegistrationAllowed(canonical)` (system-root + secret-dir blocklist) → 422 `newPath_blocked`; realpath family-root containment check (Pitfall 7 — `canonical === r || canonical.startsWith(r + sep)` against `realpath(COVERAGE_ROOTS[f]())`) → 422 `newPath_outside_family_roots`; `readRegistry()` lookup → 404 `project_not_found`; atomic mutation via `writeRegistry()` → `atomicWriteFile()` (O_NOFOLLOW + O_EXCL + fsync + rename); `invalidateConformanceCache()` + `invalidateCoverageCache()`. Response body matches `RegistryEntrySchema` via `outbound()` wrapper. Error responses use structured codes only — no FS path leakage (T-12-INFO-DISCLOSURE). (D-12-19, D-12-26)

- [ ] **REQ-12-RPD-04**: SPA component `PathDriftPanel.tsx` is a collapsible panel above the family card row on `/observability/conformance`. Returns null when `drifted.length === 0`. Per-entry row: project name + storedPath (truncated text via JSX) + arrow → suggestedPath (when present) OR controlled `<input maxLength={4096}>` + Fix-path button. Button disabled until non-empty path. `useRegistryFixPath` mutation invoked on click; per-row `inFlightRefreshes: ReadonlySet<string>` Set (Phase 11.2 pattern) for concurrent-click safety. On settle: `useToast.show()` (success: green "Fixed registry path for {id}"; error: red `"Failed to fix path: ${errorCodeToMessage(code)}"` with mapped user-friendly strings — no raw error.message). NO use of the dangerous-inner-html prop (T-12-XSS — React JSX text escaping is the defence). (D-12-20, D-12-21)

#### Responsive viewport (RVP-*)

- [ ] **REQ-12-RVP-01**: `packages/spa/src/lib/useViewportBreakpoint.ts` returns `'xs' | 'sm' | 'md' | 'lg' | 'xl'`. Implementation: `window.matchMedia` per Tailwind 4 breakpoint + `useSyncExternalStore` (concurrent-rendering safe). Returns 'xl' when `(min-width: 1280px)` matches; 'lg' when `(min-width: 1024px)` matches but 1280 does not; 'md' at 768-1024; 'sm' at 640-768; 'xs' otherwise. SSR fallback returns 'lg'. (D-12-22 with A6 deviation: matchMedia chosen over ResizeObserver per RESEARCH §Pitfall 10 — RO fires ~5000 events/resize-drag vs matchMedia's ~5)

- [ ] **REQ-12-RVP-02**: `CoverageFamilySection.tsx` branches on `useViewportBreakpoint() === 'xs'` BEFORE any other render path. Mobile branch returns `<CoverageFamilySectionMobile {...props} />` (card-per-row layout). Desktop branch is UNCHANGED — preserves Phase 11.1 IMP-01 `<colgroup>` width contract + Phase 11.2 D-11.2-09/10/11/12 invariants. Mobile per-card: project name + override chip + 4 column states (CoverageCell reused, 2-column grid) + actions row (refresh button preserves `min-w/h-[44px] + p-[15px]` Phase 11.2 D-11.2-11 touch target). (D-12-23)

- [ ] **REQ-12-RVP-03**: Bounded scope — responsive collapse applies to `/coverage` ONLY. `/observability/conformance` is desktop-first for v1.2.0 (D-12-24). The conformance page does NOT use `useViewportBreakpoint`. (D-12-24)

#### Page composition (PAGE-*)

- [ ] **REQ-12-PAGE-01**: `/observability/conformance` route lazy-loaded under `_appshell` layout via `createLazyRoute('/observability/conformance')`. Registered in `packages/spa/src/router.tsx` as `conformanceRoute`. NO `validateSearch` in v1.2.0 (deep-link to specific day deferred). Sibling route (D-12-02 — NOT widening Phase 5 `/observability` aggregator). (D-12-01, D-12-02)

- [ ] **REQ-12-PAGE-02**: `ConformancePage.tsx` composes the page. Branches on `useConformance()` result: isLoading → loading skeleton; isError → `<ErrorState />` with generic message (T-12-INFO-DISCLOSURE — no FS path leakage); `'schemaDriftAt' in data` → `<SchemaDriftState path={data.schemaDriftAt} />` (existing primitive — T-12-PAGE-DRIFT-RENDER mitigation); happy path → sticky `<PageHeader title="Fleet conformance" sticky />` + conditional `<PathDriftPanel />` (when drifted non-empty) + 3-up `<FamilyCard />` row + `<FleetTrendChart />`. (D-12-01)

#### Navigation (NAV-*)

- [ ] **REQ-12-NAV-01**: `Sidebar.tsx` Observability section gains a 3rd `<SidebarItem>` entry. Order: Coverage → Skill drift → Conformance (additive — preserves existing Phase 11 D-11-08 IA; user-memory `feedback_sidebar_section_architecture` — growth over reorder). Conformance entry uses `lucide-react` `TrendingUp` icon (distinct from Activity-Coverage and Layers-Skill-drift). Path `/observability/conformance`. Peer `SidebarItem` primitive (NOT `SidebarSubItem` — matches Phase 11 D-11-08). (D-12-01)

#### Impeccable artifact (IMP-*)

- [ ] **REQ-12-IMP-01**: `Skill: impeccable critique` run at 1440×900 on `/observability/conformance` produces `.planning/phases/DASH-12-observability-conformance-surface/12-IMPECCABLE.md`. Required content: composite score (0-100), per-heuristic scores (Typography / Color / Layout / Hierarchy / Affordance / Motion / Feedback / Empty states / Errors / Loading / Density / a11y / Microcopy / Brand / Performance), findings (P1 / P2 / P3), persona red flags (Director / Maker / Editor), Phase 12.x candidate carry-overs. Composite ≥ 87 threshold (D-10.5-03 floor; calibration data point #5 — settles the floor recalibration policy). Bonus opportunistic: 5-min `/coverage` <768px screenshot pass folded into same artifact if time permits (Open Question 5 resolution; else punted to Phase 12.x). (D-12-29)



### Architectural Invariants (every phase)

- [x] **INV-01**: No daemon route writes to a registered project's filesystem (sole exception: `POST /api/projects/{id}/open`, user-driven)
- [x] **INV-02**: Registry, auth, env files in `~/.agenticapps/dashboard/` enforce mode `0600`; daemon refuses to start if looser. **Generalised in Phase 11:** the policy extends to the new `coverage-history/` directory tree — directory mode `0o700`, NDJSON files mode `0o600`, symlink-escape defence via `realpathSync(snapshotDir)` once at boot.
- [x] **INV-03**: Dashboard renders fully and gracefully when Sentry / Linear / Infisical are unconfigured
- [x] **INV-04**: Schema validation runs at both ends of every API call; mismatches surface as "schema drift" warnings
- [x] **INV-05**: No native dependencies in `packages/agent` (no `keytar`, no FFI)

---

## v2 Requirements

Deferred to Phases 7+. Tracked but not in v1 roadmap.

### Sentry Integration (Phase 7a)

- **SENTRY-01**: `GET /api/projects/{id}/sentry/recent` returns recent errors when `SENTRY_AUTH_TOKEN` is set
- **SENTRY-02**: Cached 60s; failures fall back to "API unreachable — using cached data from {time}"
- **SENTRY-03**: Without `SENTRY_AUTH_TOKEN`, panel shows "Configure to enable" with one-paragraph guide

### Linear Integration (Phase 7b)

- **LINEAR-01**: `GET /api/projects/{id}/linear/issue/{issueId}` returns issue title/status/assignee when `LINEAR_API_KEY` is set
- **LINEAR-02**: Branch name pattern detection links commits/PRs to Linear issue IDs
- **LINEAR-03**: Without `LINEAR_API_KEY`, panel shows "Configure to enable"

### Infisical-aware env loading (Phase 7c)

- **INFI-01**: Daemon reads its env from `process.env`; running under `infisical run` makes it Infisical-aware with no code change
- **INFI-02**: `agentic-dashboard env set` writes to `~/.agenticapps/dashboard/env.json` (mode `0600`) for non-Infisical users

### Open-source readiness (Phase 8)

- **OSS-01**: LICENSE file (MIT) added at repo root
- **OSS-02**: CONTRIBUTING.md with development setup, two-stage review expectation, and PR template
- **OSS-03**: Public-landing variant of `dashboard.agenticapps.eu` (CF Access policy relaxed) — only when public-readiness criteria met

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cloud-side data storage of any kind | Architectural commitment: registry/auth/project data stays local |
| Hard dependency on Sentry / Linear / Infisical | All three are optional; dashboard must work without any of them |
| Native dependencies in `packages/agent` (`keytar`, FFI) | Breaks the `npx` install story and Linux portability |
| Cloudflare Workers / Pages Functions in v1 | Keeps SPA pure-static and deployment auditable |
| External sharing / team collaboration | One user, multiple devices |
| Real-time push / multiplayer presence | 5s polling is sufficient |
| Embedded chat with Claude | Chat lives in the terminal |
| "Trigger this skill" buttons | Read-only safety boundary on project filesystems |
| Storing project history beyond `.git` and `.planning/` | No additional persistence layer |
| Time tracking, billing, productivity surveillance | Not the product |
| Auto-update of the daemon | User explicitly runs `npx @agenticapps/dashboard-agent@latest` |
| Custom domain `dashboard.agenticapps.eu` in v1 | Deferred — production URL is `https://agenticapps-dashboard.pages.dev` for Phases 0–6 |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BOOT-01 | Phase 0 | Pending |
| BOOT-02 | Phase 0 | Pending |
| BOOT-03 | Phase 0 | Pending |
| BOOT-04 | Phase 0 | Pending |
| BOOT-05 | Phase 0 | Pending |
| DAEMON-01 | Phase 1 | Pending |
| DAEMON-02 | Phase 1 | Pending |
| DAEMON-03 | Phase 1 | Pending |
| DAEMON-04 | Phase 1 | Pending |
| DAEMON-05 | Phase 1 | Pending |
| DAEMON-06 | Phase 1 | Pending |
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| REG-01 | Phase 1 | Pending |
| REG-02 | Phase 1 | Pending |
| REG-03 | Phase 1 | Pending |
| REG-04 | Phase 1 | Pending |
| REG-05 | Phase 1 | Pending |
| API-01 | Phase 1 | Pending |
| API-02 | Phase 1 | Pending |
| API-03 | Phase 1 | Pending |
| SPA-01 | Phase 2 | Pending |
| SPA-02 | Phase 2 | Pending |
| SPA-03 | Phase 2 | Pending |
| SPA-04 | Phase 2 | Pending |
| HOME-01 | Phase 3 | Pending |
| HOME-02 | Phase 3 | Pending |
| HOME-03 | Phase 3 | Pending |
| HOME-04 | Phase 3 | Pending |
| HOME-05 | Phase 3 | Pending |
| HOME-06 | Phase 3 | Pending |
| DISC-01 | Phase 4 (panel) + Phase 5+ (data) | Partial — panel ships in Phase 4, populated state deferred to Phase 5 (UAT G1) |
| DISC-02 | Phase 4 | Complete |
| DISC-03 | Phase 4 | Complete |
| DISC-04 | Phase 4 | Pending |
| PHASE-01 | Phase 4 | Pending |
| PHASE-02 | Phase 4 | Pending |
| PHASE-03 | Phase 4 | Pending |
| PHASE-04 | Phase 4 | Pending |
| PHASE-05 | Phase 4 | Pending |
| HEALTH-01 | Phase 5 | Complete |
| HEALTH-02 | Phase 5 | Complete |
| HEALTH-03 | Phase 5 | Complete |
| HEALTH-04 | Phase 5 | Complete |
| HEALTH-05 | Phase 5 | Complete |
| POLISH-01 | Phase 6 | Complete |
| POLISH-02 | Phase 6 | Complete (live reboot UAT deferred per D-6-22) |
| POLISH-03 | Phase 6 | Complete (live systemctl activation deferred — Linux required) |
| POLISH-04 | Phase 6 | Complete (gate floor amended to 87 per D-6-09.v1; v1.1 lifts to 90) |
| POLISH-05 | Phase 6 | Stage 1 complete; Stage 2 pending fresh-session review on PR #15 |
| POLISH-06 | Phase 6 | Complete |
| INV-01 | All phases | Complete |
| INV-02 | Phase 1 (then upheld) | Pending — generalised in Phase 11 to cover `coverage-history/` directory tree |
| INV-03 | All phases | Complete |
| INV-04 | All phases | Complete |
| INV-05 | All phases | Complete |
| HELP-01 | Phase 7 | Complete |
| HELP-02 | Phase 7 | Pending |
| HELP-03 | Phase 7 | Pending |
| HELP-04 | Phase 7 | Pending |
| HELP-05 | Phase 7 | Pending |
| HELP-06 | Phase 7 | Complete |
| COV-01 | Phase 10 | Complete |
| COV-02 | Phase 10 | Complete |
| COV-03 | Phase 10 | Complete |
| COV-04 | Phase 10 | Complete |
| COV-05 | Phase 10 | Complete |
| COV-06 | Phase 10 | Complete |
| COV-07 | Phase 10 | Complete |
| COV-08 | Phase 10 | Complete |
| COV-09 | Phase 10 | Complete |
| COV-10 | Phase 10 | Complete |
| COV-11 | Phase 10 | Complete |
| COV-12 | Phase 10 | Complete |
| TRD-01 | Phase 11 | Complete |
| TRD-02 | Phase 11 | Complete |
| TRD-03 | Phase 11 | Complete |
| TRD-04 | Phase 11 | Complete |
| TRD-05 | Phase 11 | Complete |
| SKD-01 | Phase 11 | Complete |
| SKD-02 | Phase 11 | Complete |
| SKD-03 | Phase 11 | Complete |
| SKD-04 | Phase 11 | Complete |
| SKD-05 | Phase 11 | Pending |
| PLI-01 | Phase 11 | Complete |
| PLI-02 | Phase 11 | Complete |
| PLI-03 | Phase 11 | Complete |
| IMP-01 | Phase 11.1 | Pending |
| IMP-02 | Phase 11.1 | Pending |
| IMP-03 | Phase 11.1 | Pending |
| IMP-04 | Phase 11.1 | Pending |
| IMP-05 | Phase 11.1 | Pending |
| REQ-12-FOUNDATION-01 | Phase 12 | Pending |
| REQ-12-CON-01 | Phase 12 | Pending |
| REQ-12-CON-02 | Phase 12 | Pending |
| REQ-12-CON-03 | Phase 12 | Pending |
| REQ-12-CON-04 | Phase 12 | Pending |
| REQ-12-CON-05 | Phase 12 | Pending |
| REQ-12-FCH-01 | Phase 12 | Pending |
| REQ-12-FCH-02 | Phase 12 | Pending |
| REQ-12-FCH-03 | Phase 12 | Pending |
| REQ-12-FCH-04 | Phase 12 | Pending |
| REQ-12-FCH-05 | Phase 12 | Pending |
| REQ-12-RPD-01 | Phase 12 | Pending |
| REQ-12-RPD-02 | Phase 12 | Pending |
| REQ-12-RPD-03 | Phase 12 | Pending |
| REQ-12-RPD-04 | Phase 12 | Pending |
| REQ-12-RVP-01 | Phase 12 | Pending |
| REQ-12-RVP-02 | Phase 12 | Pending |
| REQ-12-RVP-03 | Phase 12 | Pending |
| REQ-12-PAGE-01 | Phase 12 | Pending |
| REQ-12-PAGE-02 | Phase 12 | Pending |
| REQ-12-NAV-01 | Phase 12 | Pending |
| REQ-12-IMP-01 | Phase 12 | Pending |

**Coverage:**
- v1 requirements: 62 total (57 phase-bound + 5 invariants)
- v1.1 requirements: 18 added (TRD-01..05, SKD-01..05, PLI-01..03, IMP-01..05)
- v1.2 requirements: 22 added (REQ-12-FOUNDATION-01, REQ-12-CON-01..05, REQ-12-FCH-01..05, REQ-12-RPD-01..04, REQ-12-RVP-01..03, REQ-12-PAGE-01..02, REQ-12-NAV-01, REQ-12-IMP-01)
- Mapped to phases: 102 (62 v1 + 18 v1.1 + 22 v1.2)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-02*
*Last updated: 2026-05-19 — Phase 12 REQ-12-FOUNDATION-01 + REQ-12-CON-01..05 + REQ-12-FCH-01..05 + REQ-12-RPD-01..04 + REQ-12-RVP-01..03 + REQ-12-PAGE-01..02 + REQ-12-NAV-01 + REQ-12-IMP-01 appended during `/gsd-plan-phase 12`*
