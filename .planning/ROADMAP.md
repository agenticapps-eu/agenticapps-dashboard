# Roadmap: AgenticApps Pipeline Dashboard

## Overview

A ten-phase journey from empty repo to a working multi-project pipeline dashboard with first-party `/help` docs. Phases 0–6 delivered the v1.0 dashboard (shipped as PR #15, tagged `v1.0.0`). Phase 7 — **added post-v1.0 ship** — lands the v1.0 `/help` docs site (5 anchor MDX pages + ~25 stub pages + shell components + 8 widget stubs). Phase 8 (was Phase 7) adds optional integrations (Sentry, Linear, Infisical-aware env loading) one at a time as upstream tooling lands. Phase 9 (was Phase 8) prepares for an eventual flip to public open-source.

**Source spec:** `docs/spec/dashboard-prompt.md` — every phase here is derived from spec §"Implementation phasing" and §"Acceptance criteria". Phase 7's migration spec lives outside the repo at `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/MIGRATION-INSTRUCTIONS.md`.

## Milestones

- ✅ **v1.0 Working dashboard** — Phases 0–6 complete; merged via PR #15 + tagged `v1.0.0`
- 🚧 **v1.0 /help docs site (post-ship)** — Phase 7 (in-flight on `feat/help-docs-v1`)
- 📋 **v1.1 Optional integrations** — Phase 8 (planned, gated on upstream tooling)
- 📋 **v1.2 Open-source readiness** — Phase 9 (planned, much later)

## Phases

**Phase Numbering:**
- Integer phases (0, 1, 2): Planned milestone work
- Decimal phases (5.1, 6.1, 8.1): Sub-phases within their parent phase

- [ ] **Phase 0: Bootstrap** — pnpm workspace, Cloudflare Pages preview, npm placeholder, CI green
- [ ] **Phase 1: Daemon + Registry + Pairing** — Hono server, registry CRUD, bearer-token auth, path allow-list
- [ ] **Phase 2: SPA Shell + Pair Flow** — Vite/React/Tailwind shell, `/pair`, `/onboarding`, `/settings`
- [ ] **Phase 3: Multi-project Home** — `/api/registry`, `/api/projects/{id}/overview`, card grid, filters, register modal
- [ ] **Phase 4: Single-project View — Discipline + Phase Progress** — left + center columns
- [ ] **Phase 5: Skills + Health Panels** — right column, AgentLinter integration, observability/secrets/integrations detection
- [ ] **Phase 6: Polish + Service Install + Acceptance** — keyboard shortcuts, install-launchd/systemd, impeccable critique gate, two-stage review
- [ ] **Phase 7: Help docs v1.0** — MDX `/help` docs site (5 anchor pages + 25 stub pages + shell + 8 widget stubs); replaces existing `/help` shortcut page, folds shortcuts into docs
- [ ] **Phase 8: Optional Integrations (held)** — Sentry / Linear / Infisical wiring, gated on upstream tooling
- [ ] **Phase 9: Open-source Readiness (much later)** — LICENSE, CONTRIBUTING, optional public landing

## Phase Details

### Phase 0: Bootstrap
**Goal**: Stand up the pnpm workspace, Cloudflare Pages preview deploy, npm placeholder package, README, and green CI — establishing the contracts every subsequent phase inherits.
**Depends on**: Nothing (first phase)
**Requirements**: BOOT-01, BOOT-02, BOOT-03, BOOT-04, BOOT-05
**Success Criteria** (what must be TRUE):
  1. `pnpm install` from a fresh clone resolves successfully against the root `pnpm-workspace.yaml` with `packages/spa`, `packages/agent`, `packages/shared`.
  2. Pushing a branch triggers a Cloudflare Pages preview deploy; the preview URL is accessible behind CF Access (email-only).
  3. `npm view @agenticapps/dashboard-agent@0.0.1-alpha.0` returns metadata; `npx @agenticapps/dashboard-agent@0.0.1-alpha.0` runs and prints a friendly "alpha placeholder" message and exit code 0.
  4. CI workflow runs lint + typecheck + test on push and PR; status is green on `main`.
  5. README at repo root opens with an "alpha" notice, the install snippet, and links to the spec.
**Plans**: 5 plans

Plans:
- [x] 00-01-PLAN.md — Workspace skeleton + HealthResponseSchema + CI workflow (smoke plan, Wave 1)
- [x] 00-02-PLAN.md — `packages/agent` commander CLI + tsup bundle + subprocess tests (Wave 2)
- [x] 00-03-PLAN.md — `packages/spa` Vite/React/Tailwind 4 shell with AgentVersion fallback (Wave 2)
- [x] 00-04-PLAN.md — `release.yml` workflow with provenance + publint/attw gates (Wave 3)
- [x] 00-05-PLAN.md — README.md + `docs/deploy/cloudflare-pages-setup.md` (Wave 3)

### Phase 1: Daemon + Registry + Pairing
**Goal**: A working `agentic-dashboard` CLI/daemon that registers projects, serves a token-authed Hono API on `127.0.0.1:5193` with CORS lock, enforces path allow-lists, and prints a one-click pair URL.
**Depends on**: Phase 0
**Requirements**: DAEMON-01–06, AUTH-01–05, REG-01–05, API-01, API-02, API-03, INV-02, INV-05
**Success Criteria**:
  1. `agentic-dashboard register <path>` followed by `agentic-dashboard start` boots the daemon, prints a pair URL, and `curl -H "Authorization: Bearer <token>" http://127.0.0.1:5193/health` returns `{ ok: true }`.
  2. `agentic-dashboard rotate-token` invalidates the prior token immediately; the next bearer-token request with the old value returns 401.
  3. `GET /api/projects/{id}/read?path=../../etc/passwd` returns 422 (path allow-list rejects traversal).
  4. Daemon refuses to start when `~/.agenticapps/dashboard/auth.json` is `0644`, with a clear remediation message.
  5. `--bind tailscale` succeeds when `tailscale ip -4` resolves and gracefully degrades otherwise.
**Plans**: 5 plans

Plans:
- [ ] 01-01-PLAN.md — Wave 0: zod ^3.25 catalog bump + Hono/execa/picocolors install + 6 shared schema stubs (auth, registry, read, git, errors, server) + extended HealthResponseSchema
- [ ] 01-02-PLAN.md — Wave 1: lib utilities (constants, paths allow-list with realpath defense, pidfile, logging, banner verbatim per spec, auth with token gen + 0600 enforcement + D-15 rotation, registry CRUD with idempotent register + slug collisions)
- [ ] 01-03-PLAN.md — Wave 2: Hono server (createApp factory with cors-before-bearerAuth, optional CIDR middleware, NODE_ENV-gated errors, D-16 outbound parse) + 6 routes (/health, /api/admin/shutdown, /api/registry CRUD, /api/auth/rotate, /api/projects/:id/read, /api/projects/:id/git) + 4 MANDATORY TDD CASES as named tests + serverInfo + git allow-list runner + boot
- [ ] 01-04-PLAN.md — Wave 3 (parallel with 05): full CLI surface (start, stop, status, register/--auto, unregister, list, rename, tag, rotate-token, pair) + 5 subprocess tests with isolated HOME fixture
- [ ] 01-05-PLAN.md — Wave 3 (parallel with 04): Tailscale lib (mocked-execa unit tests) + start.ts wires --bind tailscale + cidr middleware integration tests + bind-modes subprocess tests + end-to-end smoke covering Phase 1 success criterion 1

### Phase 2: SPA Shell + Pair Flow
**Goal**: A Vite + React + Tailwind shell that renders `/onboarding` for unpaired sessions, completes pairing via `/pair?agent=...&token=...`, stores credentials in localStorage, and exposes manual-pair fallback at `/settings`.
**Depends on**: Phase 1
**Requirements**: SPA-01, SPA-02, SPA-03, SPA-04, INV-04 (SPA-side), AUTH-04 (SPA-side)
**Success Criteria**:
  1. `pnpm --filter @agenticapps/dashboard-spa dev` boots the SPA at `localhost:5174` with hot-reload < 2s.
  2. Visiting `/` without paired credentials redirects to `/onboarding` and shows the install guide.
  3. Clicking the printed pair URL completes pairing without manual input; the SPA lands on `/`.
  4. `/settings` accepts manual paste of agent URL + token and validates by calling `/health` before saving.
**Plans**: 6 plans

Plans:
- [x] 02-01-PLAN.md — Wave 0: catalog + PairingSchema/AgentUrlSchema + CF Pages _redirects/_headers + global.css UI-SPEC tokens + 4 RED stub tests
- [x] 02-02-PLAN.md — Wave 1A: lib/pairing + lib/theme (D-02/D-03) + ThemeChip + Header + AppShell + 5-route TanStack Router (D-04, D-05)
- [x] 02-03-PLAN.md — Wave 1B: lib/api (apiFetch + parseOrDrift + ApiError) + lib/queryClient (Pattern 6 401 interceptor) + lib/repair + SchemaDriftState + DaemonUnreachableState + RepairBanner
- [x] 02-04-PLAN.md — Wave 2A: CodeBlock + OnboardingHero (D-01) + /onboarding + /pair (validateSearch + happy-path + 4 error states)
- [x] 02-05-PLAN.md — Wave 2B: ThemeToggle + ManualPairForm (SPA-04 8-state machine) + /settings + / + /help routes; remove Phase 0 App.tsx
- [x] 02-06-PLAN.md — Wave 3: wire RepairProvider+QueryBridge in main.tsx; mount RepairBanner in AppShell; SPA-01 dev-perf-smoke subprocess test; e2e pair-flow test; README update

### Phase 3: Multi-project Home Page
**Goal**: A multi-project home page rendering one card per registered project with current phase, finding counts, and last-commit time; supports filters, search, sort, and an in-UI "Register project" modal.
**Depends on**: Phase 2
**Requirements**: HOME-01, HOME-02, HOME-03, HOME-04, HOME-05, HOME-06
**Success Criteria**:
  1. With ≥2 registered projects, `/` renders a card per project with phase, finding-counts breakdown, last-commit timestamp.
  2. Cards refresh every 5s; per-card freshness indicator visible.
  3. Filter chips and search box filter the grid live (no full reload).
  4. "+ Register project" modal POSTs to `/api/registry/register`; new card appears within 5s without page reload.
**Plans**: 11 plans

Plans:
- [x] 03-01-PLAN.md — Wave 0: shared schemas (overview.ts + registry.ts extensions) + 4 daemon RED stubs (registerNonces / rateLimiter / registerLog / overviewCache) + projectOverview reader + touchLongPress; ~25 new tests
- [x] 03-02-PLAN.md — Wave 0: AppShell max-w override pattern (useSyncExternalStore-backed) + HomeLayout wrapper for the 5xl home page width
- [x] 03-03-PLAN.md — Wave 1: GET /api/projects/:id/overview route + 5s memo cache + outbound() schema-drift defense + 404 + unreachable graceful Pending
- [x] 03-04-PLAN.md — Wave 1: POST /register-prepare + /register-confirm (D-09 confused-deputy nonce flow) + rate limiter (D-14) + BLOCKED stderr log (D-15)
- [x] 03-05-PLAN.md — Wave 1: POST /:id/rename + /:id/tags routes (D-24) + evict() in /unregister for cache hygiene
- [x] 03-06-PLAN.md — Wave 2: SPA query/mutation hooks for all 7 endpoints + filterAndSort/computeOverflowChips pure functions + D-12 apiFetch guard + /projects/$projectId placeholder route
- [x] 03-07-PLAN.md — Wave 2: HomeToolbar (chips + search + sort) + ProjectCard (compact + hover-expand + 5 states + kebab) + CardContextMenu (portal + roving tabindex + inline unregister confirm)
- [x] 03-08-PLAN.md — Wave 2: RegisterModal (native <dialog> two-step + dirty discard + 410 auto-re-prepare + blocked + already-registered) + RegisterButtonCard + RenameTagsForms + MultiProjectHome composition + index route swap
- [x] 03-09-PLAN.md — Wave 2: useLastRefresh hook + Header extension showing N projects + last-refresh timestamp (D-05)
- [x] 03-10-PLAN.md — Wave 3: CommandPalette (Cmd/Ctrl+K, native <dialog> + listbox + aria-activedescendant + 4 v1 actions) mounted in AppShell
- [x] 03-11-PLAN.md — Wave 4: end-to-end subprocess test (daemon spawn + prepare → confirm + single-use semantics) + README "Phase 3 shipped" + full pre-flight (typecheck + test + build + lint)

### Phase 4: Single-project View — Discipline + Phase Progress
**Goal**: Per-project three-column view's left (Discipline) and center (Phase progress) columns, driven by `.planning/phases/<current>/` and meta-observer JSONL.
**Depends on**: Phase 3
**Requirements**: DISC-01–04, PHASE-01–05
**Success Criteria**:
  1. Clicking a card on `/` navigates to `/projects/{id}` and renders header + left + center columns.
  2. CommitmentBlock surfaces the most recent `## Workflow commitment` block from the project's session output.
  3. ExecutionTimeline parses `test(RED)` and `feat(GREEN)` commit pairs from `git log` and groups them per task.
  4. ReviewStatus parses `<finding severity="...">` blocks per spec §"Stage 2 finding count" and renders by severity.
  5. VerificationStatus shows must_haves count vs evidence count from `VERIFICATION.md`.
**Plans**: 6 plans

Plans:
- [x] 04-01-PLAN.md — Wave 0: shared schemas (commitment, observations, phaseDetail, discipline, security) + barrel re-export + 22+ failing-then-passing schema tests
- [x] 04-02-PLAN.md — Wave 1: phaseCache (per-route 5s memo, evictPhaseCacheProject) + phaseDetail.ts (8 parsers: parseCommitmentBlock, readSkillObservations, parseRationalizationRows, parsePhaseChecklist, parseExecutionTimeline, parseSecurityReports, parseReviewFindings4, parseVerificationDetail) + phase4-fixture helper + 49+ tests
- [x] 04-03-PLAN.md — Wave 2: 5 daemon routes (/commitment, /observations/recent, /phase-progress, /discipline, /security) + app.ts wiring + unregister cache eviction + 36+ in-process Hono tests
- [x] 04-04-PLAN.md — Wave 3: SPA infrastructure — projectQueries (5 TanStack Query hooks) + ProjectLayout (max-w-7xl) + SingleProjectView shell with 2-col grid + ProjectHeader + replace placeholder route body
- [x] 04-05-PLAN.md — Wave 4: Discipline column — PanelContainer + relativeTime + 3 panels (CommitmentBlock, HookFirings with DISC-04 install-hint, RationalizationFires) + mount in SingleProjectView
- [x] 04-06-PLAN.md — Wave 5: Phase Progress column — extract shared InlineDrift + 5 panels (PhaseProgress, ExecutionTimeline, ReviewStatus, SecurityStatus, VerificationStatus) + mount + e2e route test verifying ROADMAP success criteria 1-5

### Phase 5: Skills + Health Panels
**Goal**: The right column — InstalledSkills (global + local), SkillHealth (AgentLinter-backed), ObservabilityHealth, SecretsHealth, IntegrationsHealth — with cached AgentLinter subprocess and grep-based detection.
**Depends on**: Phase 4
**Requirements**: HEALTH-01–05, INV-03 (graceful empty states)
**Success Criteria**:
  1. InstalledSkills renders skills from `~/.claude/skills/*/SKILL.md` (frontmatter only) and project `.claude/skills/*/SKILL.md`.
  2. SkillHealth runs `npx agentlinter scan` (cached 1h), surfaces Position Risk warnings; cache invalidates on `SKILL.md` mtime change.
  3. ObservabilityHealth detects Spotlight / Sentry SDK / sentry-cli in `package.json` + CI files via grep.
  4. With Sentry / Linear / Infisical unconfigured, IntegrationsHealth shows "Configure to enable" with one-paragraph guides linked.
**Plans**: 6 plans

Plans:
- [x] 05-01-PLAN.md — Wave 1: 5 shared schemas (skills/agentlinter/observability/secrets/integrations) + meta-observer workspace pkg with SessionEnd hook + atomic write + transcript extractors + 2 Wave-0 probes
- [x] 05-02-PLAN.md — Wave 1: skillsScan (dual-layout SKILL.md frontmatter reader) + agentLinterRunner (5-class outcome with --local privacy invariant) + agentLinterCache (1h+mtime) + 3 daemon routes (/api/skills/global, /api/projects/:id/skills/local, /api/projects/:id/agentlinter)
- [x] 05-03-PLAN.md — Wave 1: paths.ts resolveAllowedNamed extension (D-5-13) + projectMetadataScan (9 detectors for package.json/.infisical.json/.sentryclirc/.env/.spotlight/CI YAML/sentry-cli binary) + integrationsState 3-state truth table + 3 daemon routes (observability/secrets/integrations)
- [x] 05-04-PLAN.md — Wave 2: 3 TanStack Query hooks (useGlobalSkills/useLocalSkills/useAgentLinter) + InstalledSkills panel (HEALTH-01) + SkillHealth panel (HEALTH-02) with row-expand + 4-class empty states + retry button
- [x] 05-05-PLAN.md — Wave 2: 3 TanStack Query hooks (useObservability/useSecrets/useIntegrations) + ObservabilityHealth (HEALTH-03 multi-signal provenance) + SecretsHealth (HEALTH-04 3-state) + IntegrationsHealth (HEALTH-05 3-state with verbatim configure-to-enable paragraphs)
- [x] 05-06-PLAN.md — Wave 3: SingleProjectView 3-col grid widening (D-5-01 / D-4-09 staged) + meta-observer end-to-end script + D-5-10 closure gate (real Claude session populates CommitmentBlock + HookFirings) + final regression

### Phase 05.1: UI redesign Cloudflare-inspired sidebar dashboard shell (INSERTED)

**Goal**: Replace the current top-header-only navigation with a sidebar-driven shell inspired by Cloudflare dashboard surfaces. Apply the locked design tokens (warm paper bg, purple accent, Inter typography, soft card shadows) across all paired routes. Establish the design-system primitive layer. Migrate every Phase 5 panel to use the new Card primitive. ZERO functional regressions — every panel that exists today must still exist after 5.1, with the same data and behavior. The 1117-test suite must continue to pass. Drives toward Phase 6 POLISH-04 impeccable >= 90 gate.
**Depends on**: Phase 5
**Requirements**: None (internal UI quality work; ties to POLISH-04 in Phase 6)
**Success Criteria**:
  1. All paired routes (`/`, `/projects/:id`, `/settings`, `/help`) render under AppShellV2 with locked tokens (UI-SPEC AC-01).
  2. `/onboarding` and `/pair` keep their standalone presentation (UI-SPEC AC-02).
  3. Every Phase 5 panel still works — 1117-test baseline holds (UI-SPEC AC-03).
  4. No orange anywhere; tokens.css is the single source of truth (UI-SPEC AC-04, AC-05).
  5. `impeccable:critique` >= 90 on `/` and `/projects/:id` at 1440x900 (UI-SPEC AC-06; preview gate, Phase 6 enforces).
  6. New UI primitive component tests pass (UI-SPEC AC-07).
  7. Visual smoke screenshot committed at refs/after-shell.png (UI-SPEC AC-08).
**Plans**: 6 plans

Plans:
- [x] 05.1-01-PLAN.md — Wave 1: tokens.css + 7 UI primitives (Card, CardHeader, EmptyState, Pill, StatusPill, MetricNumeric, KbdHint) + Inter font + alias layer + noOrange invariant
- [x] 05.1-02-PLAN.md — Wave 2: shell components (Sidebar*, TopBar, Breadcrumb, PageHeader) + AppShellV2 + VITE_APPSHELL_V2 flag + pathless layout fixing /onboarding+/pair leak
- [x] 05.1-03-PLAN.md — Wave 3: migrate `/` (MultiProjectHome PageHeader + repalette HomeToolbar/ProjectCard/RegisterButtonCard)
- [x] 05.1-04-PLAN.md — Wave 4: migrate `/projects/:id` (PanelContainer + InlineDrift + 13 panels + SingleProjectView PageHeader + grid gap normalization)
- [x] 05.1-05-PLAN.md — Wave 5: migrate `/settings`+`/help` + repalette remaining shell-adjacent components (RepairBanner, CommandPalette, modals, Header, etc.) — alias-free precondition for Wave 6
- [x] 05.1-06-PLAN.md — Wave 6: flag flip + delete legacy AppShell/Header/HomeLayout/ProjectLayout/appShellWidth/ProjectHeader + delete alias :root block + legacy .dark block; capture refs/after-shell.png; run /impeccable:critique closure ritual

### Phase 6: Polish + Service Install + Acceptance
**Goal**: Production-ready dashboard — keyboard shortcuts, LaunchAgent / systemd installers, impeccable-critique gate, two-stage review, README with FAQ + troubleshooting, CF Access policy applied (already done pre-flight).
**Depends on**: Phase 5
**Requirements**: POLISH-01–06
**Success Criteria**:
  1. `agentic-dashboard install-launchd` produces `~/Library/LaunchAgents/eu.agenticapps.dashboard.plist`; `launchctl list | grep eu.agenticapps.dashboard` shows it loaded; daemon survives reboot.
  2. `R` refreshes, `?` shows help overlay, `/` focuses the home-page search box.
  3. `impeccable:critique` against the dashboard's own UI scores ≥ 90.
  4. PR closing v1.0 has Stage 1 (`/review`) AND Stage 2 (`superpowers:requesting-code-review`) sections in REVIEW.md, with `<finding severity="...">` blocks.
  5. README has install / pair / FAQ / troubleshooting sections.
**Plans**: 7 plans

Plans:
- [x] 06-01-PLAN.md — Wave 0: baseline impeccable capture + screenshot.mjs --route/--viewport extension; closes Phase 5.1 HUMAN-UAT AC-08 (after-shell.png re-capture)
- [x] 06-02-PLAN.md — Wave 0: A-01 rate-limit on /rename + /tags + /register-confirm; A-02 schema bounds (.max(200)/.max(20)/.max(50)) — Phase 3 carry-forward (D-6-20)
- [x] 06-03-PLAN.md — Wave 1: useGlobalShortcuts + HelpOverlay + KbdHint chips on /help (POLISH-01 D-6-01..03)
- [x] 06-04-PLAN.md — Wave 1: install-launchd command + makePlist + 14 unit tests + 3 subprocess tests (POLISH-02 D-6-04..07)
- [x] 06-05-PLAN.md — Wave 1: install-systemd command + makeSystemdUnit + 15 unit tests + 3 subprocess tests (POLISH-03 D-6-04..07)
- [x] 06-06-PLAN.md — Wave 2: impeccable CI gate (.github/workflows/impeccable.yml) + check-impeccable-score.mjs parser + Playwright workspace dep + targeted polish for any sub-90 deltas (POLISH-04 D-6-09..11; closes D-6-19 + Phase 5.1 AC-06)
- [x] 06-07-PLAN.md — Wave 3: review protocol doc + CF Access doc (D-6-18) + README rewrite (D-6-15..17) + closure ritual with two-stage review on Phase 6's own PR (POLISH-05 + POLISH-06)

### Phase 06.1: typography-layout-impeccable-lift (INSERTED)

**Goal:** Lift Typography (82 → ≥ 90) and Layout (88 → ≥ 90) sub-scores on `/`; bring all 6 v1.0 user-touched routes' composite scores to ≥ 90 at desktop (lg, 1440x900) per D-6-21. Closes the impeccable gate gap so Phase 6's 06-07 closing-ritual PR clears the gate. UX architecture work (line-length policy, integration-panel progressive disclosure, token masking on /settings, ARIA on Sidebar/TopBar, numbered-steps empty canvas on /pair) — not visual polish.
**Requirements**: None (decimal sub-phase tracked via D-6.1-01..04 instead of REQ-IDs)
**Depends on:** Phase 6
**Plans:** 7/7 plans complete

Plans:
- [x] 06.1-01-PLAN.md — Wave 1: D-6.1-01 max-w-[75ch] on /help + /onboarding prose (TDD; 2 tasks)
- [x] 06.1-02-PLAN.md — Wave 1: D-6.1-03 MaskedToken primitive (RED→GREEN; 2 tasks)
- [x] 06.1-03-PLAN.md — Wave 2: D-6.1-02 PanelContainer disclosure + 5 panel updates + panel-prose max-w-[75ch] (depends_on: [01]; 2 tasks)
- [x] 06.1-04-PLAN.md — Wave 1: D-6.1-04 ARIA (aria-current/aria-label on Sidebar; aria-live="polite" on TopBar) + /pair numbered-steps empty canvas (3 tasks)
- [x] 06.1-05-PLAN.md — Wave 3: D-6.1-03 MaskedToken integration in ManualPairForm + /settings page-prose cap (depends_on: [02]; 2 tasks)
- [x] 06.1-06-PLAN.md — Wave 4: re-measure impeccable on all 6 routes; verify gate ≥ 90; commit refs/post-061-impeccable.md (autonomous: false; checkpoint:human-verify + checkpoint:decision; depends_on: [01,02,03,04,05]; 4 tasks)

### Phase 7: Help docs v1.0
**Goal**: Ship the v1.0 `/help` docs site as a separate feature branch (`feat/help-docs-v1`) off `origin/main` — MDX-driven, mounted under `/help/*` in the existing TanStack Router. Replaces the current `/help` keyboard-shortcuts page; folds shortcuts into `/help/reference/shortcuts`. Five anchor pages (landing, workflow/overview, repos/overview, observability/overview, operations/install) plus ~25 stub pages rendering `ComingSoon`. Shell components: HelpLayout (sidebar + main + sticky TOC, mobile drawer), HelpWidget (lazy dispatch), HelpHook (in-page deep link), ComingSoon. Eight named widget stubs (RepoTopologyMap, WorkflowStateMachine, GatePicker, TraceVisualizer, ScanReportPlayground, ApplyConsentSimulator, MigrationDryRun, SlashCommandCatalog) — real implementations land in v1.2. PR targets `main`, ships independently of any future redesign work.
**Canonical refs:** `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/MIGRATION-INSTRUCTIONS.md` (the migration spec — 12 steps), `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/HelpRoutes.tsx`, `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/HelpLayout.tsx`, `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/components/{HelpWidget,HelpHook,ComingSoon}.tsx`, `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/widgets/_stub-pattern.tsx`, source MDX content at `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/{landing,workflow/overview,repos/overview,observability/overview,operations/install}.md`.
**Depends on**: Phase 6 (v1.0 ship — branched off `origin/main` `26e78c7`)
**Requirements**: HELP-01 (5 anchor MDX pages render with frontmatter + GFM + Mermaid), HELP-02 (~25 stub routes render `ComingSoon` without crash), HELP-03 (HelpLayout sidebar collapses on mobile, sticky on desktop; no console errors), HELP-04 (HelpWidget dispatches the 8 stubs via React.lazy; unknown widget renders bordered error), HELP-05 (HelpHook deep-link component ships but is not yet wired into dashboard pages — v1.1 wires usages), HELP-06 (existing `/help` keyboard shortcuts move into `/help/reference/shortcuts` MDX page; `?` shortcut still routes to `/help` landing).
**Success Criteria**:
  1. `pnpm --filter @agenticapps/dashboard-spa dev` boots SPA on `:5174`; visiting `/help` renders the landing MDX (three navigation cards + intro paragraph + Mermaid diagram).
  2. All 5 anchor pages render with their embedded Mermaid diagrams (verified via `/browse` screenshot — no console errors).
  3. Each of the ~25 stub paths (e.g. `/help/workflow/gates`, `/help/reference/glossary`) renders `ComingSoon` with the correct section + title + back-link.
  4. `/help/workflow`, `/help/repos`, `/help/observability` redirect to their `/overview` page; `/help/operations` redirects to `/help/operations/install`.
  5. `<HelpWidget name="RepoTopologyMap" />` (in `repos/overview.mdx`), `<HelpWidget name="ScanReportPlayground" />` (in `observability/overview.mdx`), and `<HelpWidget name="MigrationDryRun" />` (in `operations/install.mdx`) render the corresponding `*Stub` widgets via `React.lazy`.
  6. `?` keyboard shortcut still pushes `/help` (lands on docs landing). Keyboard shortcuts content from old `/help` lives at `/help/reference/shortcuts` with the same `KbdHint` rendering.
  7. Dark mode renders correctly on every help route (prose-invert applied via Tailwind v4 typography plugin).
  8. `pnpm -r typecheck && pnpm -r test && pnpm lint` all green; SPA build emits the help MDX chunks; PR opens against `main` (NOT the redesign branch) with two-stage review + impeccable critique ≥ 90 on `/help` (lg, 1440x900).
**Plans**: 5 plans

Plans:
- [x] 07-01-PLAN.md — Wave 0 infrastructure: 7 catalog deps (@mdx-js/react, @mdx-js/rollup, remark-{gfm,frontmatter,mdx-frontmatter}, @tailwindcss/typography, mermaid) + Vite MDX plugin + Tailwind v4 typography + MDXProvider wiring + playwright.config.ts + tokenSourceOfTruth scope extension + HELP-01..06 in REQUIREMENTS.md + smoke test
- [x] 07-02-PLAN.md — Wave 1 shell components: HelpLayout (5 NAV sections incl. D-7-13 stubs + HELP-06 entry) + HelpWidget (8-stub dispatch) + HelpHook + ComingSoon + MermaidBlock (StrictMode-safe) + topicToUrl pure fn; ~40 unit tests
- [x] 07-03-PLAN.md — Wave 1 widget stubs: pruned _stub-pattern.tsx (primitive only) + 8 .stub.tsx default exports + 13 smoke tests (parallel with 07-02; disjoint file set)
- [ ] 07-04-PLAN.md — Wave 2 page content: 5 anchor MDX (landing, workflow/overview, repos/overview, observability/overview, operations/install) + reference/shortcuts.mdx (HELP-06) + frontmatter + Mermaid syntax + render smoke tests (22 tests; Mermaid blocks converted from fences to JSX)
- [ ] 07-05-PLAN.md — Wave 3 route wiring + closing ritual: helpRouteTable (41 entries) + buildHelpRoutes factory + ComingSoonRoute + 6 lazy wrappers + _helpLayout peer route (D-7-12) + DELETE legacy /help + Playwright walking checklist + impeccable ≥ 90 gate + /browse screenshots + VERIFICATION.md + UAT.md

### Phase 8: Optional Integrations (held) — was Phase 7
**Goal**: Wire Sentry, Linear, and Infisical-aware env loading one sub-phase at a time, only when upstream tooling is set up. Each is fully optional and the dashboard MUST continue to work without them.
**Depends on**: Phase 7
**Requirements**: SENTRY-01–03, LINEAR-01–03, INFI-01–02 (all v2)
**Success Criteria** (per sub-phase):
  - 8a (Sentry): With `SENTRY_AUTH_TOKEN` set, recent errors render in the right column; without it, panel still renders with "configure" copy.
  - 8b (Linear): With `LINEAR_API_KEY` set, branch-to-issue linking surfaces issue title/status in the header; without it, no panel error.
  - 8c (Infisical): `infisical run -- agentic-dashboard start` works with no daemon code change.
**Plans**: TBD per sub-phase

### Phase 9: Open-source Readiness (much later) — was Phase 8
**Goal**: LICENSE (MIT), CONTRIBUTING.md, and the optional flip of CF Access to public landing once the dashboard has soaked privately.
**Depends on**: Phase 8 (held until user opts in)
**Requirements**: OSS-01, OSS-02, OSS-03
**Success Criteria**:
  1. `LICENSE` and `CONTRIBUTING.md` at repo root match conventions in the rest of the Claude Code skill ecosystem.
  2. (Optional) CF Access policy on `dashboard.agenticapps.eu` relaxed; public landing renders for unauthenticated visitors with onboarding copy.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Bootstrap | 0/TBD | Not started | - |
| 1. Daemon + Registry + Pairing | 0/TBD | Not started | - |
| 2. SPA Shell + Pair Flow | 0/TBD | Not started | - |
| 3. Multi-project Home | 0/TBD | Not started | - |
| 4. Single-project View — Disc + Phase | 0/TBD | Not started | - |
| 5. Skills + Health Panels | 5/6 | In Progress|  |
| 6. Polish + Service Install + Acceptance | 0/TBD | Not started | - |
| 7. Help docs v1.0 | 0/TBD | In Progress (`feat/help-docs-v1`) | - |
| 8. Optional Integrations | 0/TBD | Deferred (held until upstream tooling) | - |
| 9. Open-source Readiness | 0/TBD | Deferred (much later) | - |
