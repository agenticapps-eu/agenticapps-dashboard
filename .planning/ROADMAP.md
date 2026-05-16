# Roadmap: AgenticApps Pipeline Dashboard

## Overview

A ten-phase journey from empty repo to a working multi-project pipeline dashboard with first-party `/help` docs. Phases 0–6 delivered the v1.0 dashboard (shipped as PR #15, tagged `v1.0.0`). Phase 7 — **added post-v1.0 ship** — landed the v1.0 `/help` docs site (5 anchor MDX pages + ~25 stub pages + shell components + 8 widget stubs) via PR #21 / #22 (squash-merged to `main` on 2026-05-12). Phase 8 (was Phase 7) adds optional integrations (Sentry, Linear, Infisical-aware env loading) one at a time as upstream tooling lands. Phase 9 (was Phase 8) prepares for an eventual flip to public open-source.

**Source spec:** `docs/spec/dashboard-prompt.md` — every phase here is derived from spec §"Implementation phasing" and §"Acceptance criteria". Phase 7's migration spec lives outside the repo at `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/MIGRATION-INSTRUCTIONS.md`.

## Milestones

- ✅ **v1.0 Working dashboard** — Phases 0–6 complete; merged via PR #15 + tagged `v1.0.0`
- ✅ **v1.0 /help docs site (post-ship)** — Phase 7 complete; merged via PR #21 + PR #22 on 2026-05-12
- ✅ **v1.0.1 Follow-ups (closed 2026-05-14)** — both items resolved: impeccable tool drift superseded by Phase 10.5 D-10.5-01, and `text-text-tertiary` bumped to `#807A92` (3.9:1). See `.planning/phases/07-help-docs-v1-0/deferred-items.md`.
- 🚧 **v1.1 Cross-family observability** — Phase 10 (Coverage Matrix), 10.5 (skill-driven impeccable gate), 10.6 (three-state GitNexus detection) all shipped 2026-05-13 → 2026-05-14 via PRs #28 + #29. Phase 11 close-out scope TBD.
- ⏸️ **v1.2 Optional integrations** — Phase 8 (held until upstream Sentry / Linear / Infisical tooling lands)
- 📋 **v1.3 Open-source readiness** — Phase 9 (planned, much later)

## Phases

**Phase Numbering:**
- Integer phases (0, 1, 2): Planned milestone work
- Decimal phases (5.1, 6.1, 8.1): Sub-phases within their parent phase

- [x] **Phase 0: Bootstrap** — pnpm workspace, Cloudflare Pages preview, npm placeholder, CI green
- [x] **Phase 1: Daemon + Registry + Pairing** — Hono server, registry CRUD, bearer-token auth, path allow-list
- [x] **Phase 2: SPA Shell + Pair Flow** — Vite/React/Tailwind shell, `/pair`, `/onboarding`, `/settings`
- [x] **Phase 3: Multi-project Home** — `/api/registry`, `/api/projects/{id}/overview`, card grid, filters, register modal
- [x] **Phase 4: Single-project View — Discipline + Phase Progress** — left + center columns
- [x] **Phase 5: Skills + Health Panels** — right column, AgentLinter integration, observability/secrets/integrations detection
- [x] **Phase 05.1: UI redesign — Cloudflare-inspired sidebar shell** (inserted) — AppShellV2 + tokens.css + 7 UI primitives + panel migration
- [x] **Phase 6: Polish + Service Install + Acceptance** — keyboard shortcuts, install-launchd/systemd, impeccable critique gate, two-stage review
- [x] **Phase 06.1: Typography + layout impeccable lift** (inserted) — closes ≥ 90 gate on all 6 v1.0 routes
- [x] **Phase 7: Help docs v1.0** — MDX `/help` docs site (5 anchor pages + 25 stub pages + shell + 8 widget stubs); replaces existing `/help` shortcut page, folds shortcuts into docs
- [ ] **Phase 8: Optional Integrations (held)** — Sentry / Linear / Infisical wiring, gated on upstream tooling
- [ ] **Phase 9: Open-source Readiness (much later)** — LICENSE, CONTRIBUTING, optional public landing
- [x] **Phase 10: Coverage Matrix Page** — per-repo presence + freshness of CLAUDE.md, GitNexus index, family wiki, workflow version across the three client families (ships as migration 0008 in claude-workflow; depends on Phase 7, skips held Phases 8/9) (completed 2026-05-13, PR #28)
- [x] **Phase 10.5: Impeccable skill-driven gate (INSERTED)** — retire broken CI gate (`.github/workflows/impeccable.yml`), adopt per-phase `<N>-IMPECCABLE.md` artifact authored by running `/impeccable critique`. 5 decisions: D-10.5-01..05. Shipped bundled in PR #28 (completed 2026-05-13)
- [x] **Phase 10.6: Three-state GitNexus detection (INSERTED)** — coverage scanner upgraded from boolean `~/.gitnexus` presence to `gitNexusInstallState` enum (`not-installed` / `installed-no-registry` / `installed-with-registry`); new `IndexGitNexusButton` CTA for the middle state; stat-based binary probe over fnm/nvm/volta/bun/homebrew/system prefixes (completed 2026-05-14, PR #29)

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
- [x] 06.1-07-PLAN.md — Wave 5: closure ritual + final regression sweep

### Phase 7: Help docs v1.0  ✅ shipped 2026-05-12 (PR #21 + #22)
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
- [x] 07-04-PLAN.md — Wave 2 page content: 5 anchor MDX (landing, workflow/overview, repos/overview, observability/overview, operations/install) + reference/shortcuts.mdx (HELP-06) + frontmatter + Mermaid syntax + render smoke tests (22 tests; Mermaid blocks converted from fences to JSX)
- [x] 07-05-PLAN.md — Wave 3 route wiring + closing ritual: helpRouteTable (41 entries) + buildHelpRoutes factory + ComingSoonRoute + 6 lazy wrappers + _helpLayout peer route (D-7-12) + DELETE legacy /help + Playwright walking checklist + impeccable ≥ 90 gate + /browse screenshots + VERIFICATION.md + UAT.md

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
Phases execute in numeric order: 0 → 1 → 2 → 3 → (5.1) → 4 → 5 → 6 → (6.1) → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Bootstrap | 5/5 | ✅ Complete | 2026-05-03 |
| 1. Daemon + Registry + Pairing | 5/5 | ✅ Complete | 2026-05-04 |
| 2. SPA Shell + Pair Flow | 6/6 | ✅ Complete | 2026-05-04 |
| 3. Multi-project Home | 11/11 | ✅ Complete | 2026-05-05 |
| 4. Single-project View — Disc + Phase | 6/6 | ✅ Complete | 2026-05-08 |
| 5. Skills + Health Panels | 6/6 | ✅ Complete | 2026-05-08 |
| 05.1. UI redesign (inserted) | 6/6 | ✅ Complete | 2026-05-09 |
| 6. Polish + Service Install + Acceptance | 7/7 | ✅ Complete | 2026-05-10 |
| 06.1. Typography + Layout lift (inserted) | 7/7 | ✅ Complete | 2026-05-11 |
| 7. Help docs v1.0 | 5/5 | ✅ Complete (PR #21 + #22) | 2026-05-12 |
| 8. Optional Integrations | 0/TBD | ⏸️ Held (upstream tooling required) | - |
| 9. Open-source Readiness | 0/TBD | 📋 Deferred (much later) | - |
| 10. Coverage Matrix Page | 9/9 | ✅ Complete (PR #28) | 2026-05-13 |
| 10.5. Impeccable skill-driven gate (inserted) | 5 deliverables / 5 | ✅ Complete (PR #28) | 2026-05-13 |
| 10.6. Three-state GitNexus detection (inserted) | 1/1 | ✅ Complete (PR #29) | 2026-05-14 |

**v1.0.1 follow-ups (deferred from Phase 7):**
- Impeccable scoring tool drift — pick: pin to `npx impeccable@<last-with-critique>` or migrate to the `detect`-only surface in v2.1.8+. See `.planning/phases/07-help-docs-v1-0/deferred-items.md`.
- `text-text-tertiary` token contrast bump — current `#9c95a8` is 2.8:1 on warm paper; needs ≥ 3:1. Cross-phase Phase 5.1 token patch.

### Phase 10: Coverage Matrix Page — per-repo presence + freshness of CLAUDE.md, GitNexus index, family wiki, workflow version across three client families

**Goal:** Ship a `/coverage` page in agenticapps-dashboard that shows, for every git repo under `~/Sourcecode/{agenticapps,factiv,neuroflash}`, whether each of four knowledge artifacts is present and how fresh it is — with green/amber/red freshness coloring per row and a "refresh stale" action. Ships as **migration 0008** in claude-workflow. Honors the family-boundary contract from `~/Sourcecode/CLAUDE.md`.
**Milestone:** v1.1 — Cross-family observability
**Depends on:** Phase 7 (last shipped phase; skips held Phases 8/9)
**Authoritative inputs:**
  - `claude-workflow/docs/decisions/0018-multi-ai-plan-review-enforcement.md`
  - `claude-workflow/docs/decisions/0019-llm-wiki-compiler-integration.md`
  - `claude-workflow/docs/decisions/0020-gitnexus-code-graph-integration.md`
  - `claude-workflow/migrations/{0005,0006,0007}.md`
  - `~/Sourcecode/CLAUDE.md` + each family's `CLAUDE.md`
  - Each family's `.wiki-compiler.json` (runtime schema)
  - Existing agenticapps-dashboard codebase
**Coverage columns:**
  | Column | Source of truth | "Fresh" means |
  |---|---|---|
  | CLAUDE.md | `<repo>/CLAUDE.md` (or AGENTS.md) | exists |
  | GitNexus indexed | `~/.gitnexus/registry.json` entry | last-indexed ≤ 14 days |
  | Wiki linked | `<family>/.wiki-compiler.json` references repo | last compile ≤ 7 days |
  | Workflow version | `<repo>/.claude/skills/agentic-apps-workflow/SKILL.md` frontmatter | matches current head (1.7.0 → 1.8.0 after migration 0008) |
**Non-goals (explicit):** No rewrite of dashboard's data layer; no auth (local-only); no websockets; no remote read of these state files.
**Requirements**: COV-01, COV-02, COV-03, COV-04, COV-05, COV-06, COV-07, COV-08, COV-09, COV-10, COV-11, COV-12
**Plans:** 9/9 plans complete

Plans:
- [x] 10-01-PLAN.md — Wave 0 (TDD): Shared Zod schemas (coverage.ts) + barrel re-export + 21 RED-state test stubs across daemon scanners/orchestrator/route + SPA query hooks + 8 panel components — establishes the wire contract + Nyquist test scaffold
- [x] 10-02-PLAN.md — Wave 1 (TDD): 5 daemon scanners + repoDiscovery — claudeMdScanner / gitNexusScanner / wikiScanner / workflowVersionScanner / overrideSentinelScanner. Encodes RESEARCH Pitfalls 1-6 (registry-as-array, never-compiled-vs-not-linked, version-unknown dashboard case, dual-layout SKILL.md probe, empty sentinel set, no worktree walk)
- [x] 10-03-PLAN.md — Wave 1 (TDD, parallel with 02): paths.ts COVERAGE_ROOTS extension (additive — old /api/projects/:id/read scope preserved) + coverageCache (30s TTL singleton) + coverageScan orchestrator (Promise.allSettled partial-failure isolation per AGREED-2) + coverageSpawn (gitnexus-only spawn; re-exports clipboard builders from @agenticapps/dashboard-shared per CODEX MED-13)
- [x] 10-04-PLAN.md — Wave 2: routes/coverage.ts (GET /api/coverage + POST /api/coverage/refresh) + server/app.ts mount. Bearer-auth + CORS inherited; D-10-09 wiki-rejection at request-body Zod parse; cache integration; outbound() schema-drift defense
- [x] 10-05-PLAN.md — Wave 2 (parallel with 04): SPA lib/coverageQueries.ts — useCoverage (30s staleTime matching daemon cache) + useCoverageRefresh (invalidates query onSuccess) + parseOrDrift reuse
- [x] 10-06-PLAN.md — Wave 3: 8 SPA panel components in panels/coverage/ — CoverageCell (4-state Phase 05.1 tokens; workflow variant renders behind/ahead/version-unknown sub-states per CODEX HIGH-4) + OverrideChip (count===0 returns null per Pitfall 5) + CoverageRow + CoverageFamilySection (sticky header + per-family GitNexus install hint when not-applicable per CODEX HIGH-6 + filter-aware counts + localStorage collapse) + CoverageToolbar (4-chip multi-select + 200ms debounce + URL sync) + RefreshAllStaleButton (batch-progress state per AGREED-4) + CoverageEmptyState + CoveragePage composing all
- [x] 10-07-PLAN.md — Wave 4: route mount — coverage.lazy.tsx + router.tsx coverageRoute (validateSearch zodValidator + errorComponent reuse per Phase 7 Pitfall 8) + Sidebar.tsx replaces OBSERVE placeholder with Observability/Coverage entry (COV-09) + Playwright e2e spec covering 6 user-journey scenarios
- [x] 10-08-PLAN.md — Wave 5: Migration 0008 + ADR 0021 in claude-workflow repo (human-action checkpoints) + dashboard-side migration-0008.fixture.test.ts (CI-resident per CODEX MED-17) + migration-0008.smoke.test.ts (cross-repo, warns-not-skips) + CHANGELOG.md v1.1 entry (COV-12 — originally shipped as workflow head 1.7.0 → 1.8.0; re-anchored 2026-05-14 to 1.5.0 → 1.6.0 by claude-workflow PR #17 chain-integrity fix)
- [x] 10-09-PLAN.md — Wave 6 (depends on 10-08): Post-phase gates (added 2026-05-13 per CODEX HIGH-11) — Stage 1 /review, Stage 2 superpowers:requesting-code-review, /cso cross-repo trust boundary audit, /qa live walkthrough, impeccable:critique ≥ 90 at 1440x900, 10-HUMAN-UAT.md scaffold with 6 acceptance scenarios, REQUIREMENTS.md COV-01..12 tick-off

### Phase 10.5: Impeccable skill-driven gate (INSERTED)

**Goal:** Replace the broken CI-enforced impeccable gate with a skill-driven per-phase artifact. Phase 6's `.github/workflows/impeccable.yml` + `scripts/check-impeccable-score.mjs` have been silently broken since `npx impeccable critique` was removed in v2.1.8. Every frontend-touching phase ends by running `/impeccable critique` against affected routes at 1440×900 and committing `<N>-IMPECCABLE.md`.
**Milestone:** v1.1 — Cross-family observability
**Depends on:** Phase 6 / Phase 10 (triggered by Phase 10 Gate 4)
**Decisions:** D-10.5-01 (retire CI gate) · D-10.5-02 (skill-driven per-phase artifact is the gate) · D-10.5-03 (composite ≥ 87 floor provisional pending 3-phase calibration) · D-10.5-04 (no headless skill invocation in CI) · D-10.5-05 (cross-repo update via ADR addendum only).
**Scope:** `.planning/phases/DASH-10.5-impeccable-skill-driven-gate/10.5-SCOPE.md`
**Deliverables (5):**
- [x] D1 — Run `/impeccable critique` against `/coverage` → write `10-IMPECCABLE.md` (composite + sub-scores + findings).
- [x] D2 — Delete `.github/workflows/impeccable.yml` + `scripts/check-impeccable-score.mjs`.
- [x] D3 — Update `CLAUDE.md:38` + `docs/spec/dashboard-prompt.md` lines 554, 594, 696 to describe the per-phase artifact contract.
- [x] D4 — New dashboard ADR `docs/decisions/0024-impeccable-skill-driven-gate.md` documenting the retirement + new contract.
- [x] D5 — Cross-repo ADR-0011 addendum on `agenticapps-workflow-core` (separate branch + PR, queued).

### Phase 10.6: Three-state GitNexus detection (INSERTED)

**Goal:** Distinguish three GitNexus install states on the coverage page instead of conflating them as a boolean. Triggered by user bug report: "coverage page says GitNexus not installed but it is installed on my machine" — root cause was `existsSync(~/.gitnexus)` proxy that only becomes true after the first `gitnexus analyze`, misclassifying users with binary installed (e.g. via fnm) but never analyzed.
**Milestone:** v1.1 — Cross-family observability
**Depends on:** Phase 10 (extends the coverage scanner + page CTAs)
**Decisions:**
- 3-state enum on the wire (`not-installed` / `installed-no-registry` / `installed-with-registry`), not 2 boolean flags. Why: semantic clarity, exhaustive-switch checking, harder to misuse.
- Stat-based binary detection probes well-known prefixes (XDG, fnm, nvm, npm-global, volta, bun, homebrew, /usr/local) — no shell-out. Why: predictable, no shell-injection surface, survives launchd minimal PATH.
- Per-row state under `installed-no-registry` shifts `'not-applicable'` → `'missing'`. Why: under installed-no-registry, repos CAN be indexed — actionable state is the correct semantic.
- eslint `argsIgnorePattern: '^_'` + variants adopted globally to align with existing underscore-discard convention.
**Files touched:**
- `packages/agent/src/lib/scanners/gitNexusScanner.ts` — new `detectGitNexusBinary`, 3-state enum, semantic shift for `rateGitNexusRepo`.
- `packages/shared/src/schemas/coverage.ts` — `gitNexusInstallState` enum replaces `gitNexusInstalled` boolean on `CoverageResponseSchema`.
- `packages/shared/src/clipboard.ts` — new `buildGitnexusIndexClipboardString()`.
- `packages/spa/src/components/panels/coverage/IndexGitNexusButton.tsx` — new component (sparkles icon, copies `gitnexus analyze`).
- `packages/spa/src/components/panels/coverage/CoveragePage.tsx` — 3-way CTA selection.
- `packages/spa/src/components/panels/coverage/CoverageFamilySection.tsx` — install hint only for `not-installed`.
- `eslint.config.mjs` — added `argsIgnorePattern`, `varsIgnorePattern`, `caughtErrorsIgnorePattern`, `destructuredArrayIgnorePattern` all `^_`.
**Plans:** N/A — single squashable feature (1 PR scope). Triggered as a hot-follow-up; no separate `/gsd-plan-phase` artefacts.

### Phase 11: Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle

**Goal:** Close v1.1 — Cross-family observability — by adding the **drift over time** half to the dashboard's observability story. Persist daily Coverage snapshots locally (NDJSON under `~/.agenticapps/dashboard/coverage-history/`) and surface per-cell drift indicators on the Coverage matrix; ship a sibling **Skill drift** page aggregating `.claude/skills/` presence + version drift across every registered project; fold the 2 Phase 10.6 IMPECCABLE polish items (sticky `PageHeader` primitive + row-refresh icon `opacity-0` → `opacity-30` discoverability). Stays read-only on project filesystems; all new writes are confined to the daemon's `~/.agenticapps/dashboard/` directory.
**Milestone:** v1.1 — Cross-family observability (close-out)
**Depends on:** Phase 10 (reuses `coverageScan` orchestrator, `gitNexusInstallState` enum from 10.6, 30s daemon cache, wire-schema barrel) · Phase 5 (extends per-project skills scanner into cross-repo aggregator) · Phase 10.5 (re-runs `impeccable critique` as calibration data point #2 for D-10.5-03 score floor)
**Authoritative inputs:**
  - `.planning/ROADMAP.md` §"Phase 11+ Candidates — v1.1 close-out audit (2026-05-14)" — combined A+B decision recorded 2026-05-15
  - `.planning/phases/DASH-10-coverage-matrix-page-per-repo-presence-freshness-of-claude-m/10-IMPECCABLE.md` — 2 polish items flagged "fold into Phase 11.x"
  - `.planning/phases/DASH-10.5-impeccable-skill-driven-gate/10.5-DECISIONS.md` — composite floor + calibration policy (D-10.5-03)
  - `packages/agent/src/lib/scanners/` — existing coverage scanners (extension surface)
  - `packages/shared/src/schemas/coverage.ts` — `CoverageResponseSchema` (extension surface for `history?: CoverageDrift[]`)
  - `docs/spec/dashboard-prompt.md` — hard architectural constraints (read-only on project FS, daemon writes confined to `~/.agenticapps/dashboard/`, no native deps, bearer-auth on every route)
**Sub-tracks:**
  | Sub-track | Scope |
  |---|---|
  | Trends (Candidate A) | Daemon snapshot writer (NDJSON-append, rolling retention) under `~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson`; `GET /api/coverage/history?repoId=&cell=` endpoint; SPA inline drift indicator on `CoverageCell` (▲14d / ▼7d) and/or 12-tick sparkline. |
  | Skill drift (Candidate B) | New daemon aggregator scanning `.claude/skills/` across every registered project; new sidebar entry `Observability › Skill drift`; new SPA panel showing skill-presence matrix + version drift across projects. Reuses Phase 5 AgentLinter integration where available. |
  | Polish bundle | Sticky `PageHeader` primitive (affects every dashboard route — bonus benefit beyond Coverage); row-refresh icon `opacity-0` → `opacity-30` for touchpad/keyboard discoverability. |
  | Gates | Stage 1 `/review`, Stage 2 `superpowers:requesting-code-review`, `/cso` for daemon filesystem-write surface (new write paths cross trust boundary), `/qa` walkthrough, `impeccable:critique` post-fix re-run (calibration data point #2 for D-10.5-03 floor). |
**Non-goals (explicit):** No cloud upload of snapshots; no family-aggregate trend views (deferred to v1.2 — open question 4 in audit); no auto-correction of registry path drift (separate hygiene task); no rewrite of Phase 10 scanner architecture; no new third-party deps (must stay native-free per spec).
**Open scope decisions — RESOLVED in `/gsd-discuss-phase 11` (CONTEXT D-11-01..14, 2026-05-16):**
  1. Snapshot retention window — **14 days** rolling (D-11-01)
  2. Snapshot trigger — **daily cron only** via Phase 6 launchd / systemd install. Reinterpreted via **PD-11-01** (recorded in 11-RESEARCH.md §A9 + Plan 02) as in-process scheduler inside the running daemon — `KeepAlive=true` on the existing plist is incompatible with `StartCalendarInterval`. (D-11-02)
  3. Drift surface — **inline indicator only** (▲Nd / ▼Nd text). No sparkline in v1.1. (D-11-03)
  4. Family-aggregate trends — **deferred to v1.2** (Phase 12 `/observability/trend`). (D-11-07)
  5. Skill-drift aggregation level — **per-skill matrix** as primary view (rows = skills, columns = projects). (D-11-04)
  6. AgentLinter integration depth — **on-demand AgentLinter run per project from the matrix**; reuses Phase 5 runner + cache unchanged. (D-11-05)
  7. Cross-family vs in-family — **both**; per-family default, cross-family via filter chip. (D-11-06)
  8. Sidebar IA — **2 peer entries under `Observability`**: `Coverage`, `Skill drift` (using `SidebarItem` primitive, NOT `SidebarSubItem`). (D-11-08)

**PLAN-DECISIONS (recorded during `/gsd-plan-phase 11`, 2026-05-16):**
  - **PD-11-01** — Reinterpret D-11-02. The "daily cron via Phase 6 install" is realised as an **in-process `setTimeout` chain** inside the daemon process that launchd / systemd already keeps alive. NO `StartCalendarInterval` added to the plist (would either spawn duplicate daemons or be silently ignored under `KeepAlive=true`). Scheduler is `.unref()`'d, anchored to 03:00 local time, first-boot-fires-immediately when today's NDJSON file does not exist. Recorded in 11-RESEARCH.md §A9 + Plan 02 §Pattern 2. **Reviewed against `installLaunchd.ts:46` source evidence — verified incompatible with KeepAlive=true.**

**Requirements (minted during `/gsd-plan-phase 11`, 2026-05-16):** TRD-01, TRD-02, TRD-03, TRD-04, TRD-05, SKD-01, SKD-02, SKD-03, SKD-04, SKD-05, PLI-01, PLI-02, PLI-03 — full descriptions in `.planning/REQUIREMENTS.md` §"Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle (Phase 11)".

**Plans:** 2/6 plans executed

Plans:
- [x] 11-01-PLAN.md — Wave 0 (TDD): shared schemas `coverageHistory.ts` + `skillDrift.ts` + barrel re-export. Covers TRD-03, TRD-05, SKD-01, SKD-02, SKD-04, INV-04. Foundation for every downstream daemon + SPA plan.
- [x] 11-02-PLAN.md — Wave 1 (TDD): Coverage trends daemon — `snapshotPaths/Writer/Pruner/Reader/Scheduler` + `coverageHistoryCache` + `GET /api/coverage/history` route + boot-wired symlink-escape defence + in-process scheduler (PD-11-01). Covers TRD-01..04, INV-01/02/04/05. depends_on: 11-01.
- [ ] 11-03-PLAN.md — Wave 1 (TDD, parallel with 02): Skill drift daemon — `skillDriftScan` aggregator (path-based familyOf with 'other' fallback) + `skillDriftCache` (30s) + `GET /api/skills/drift` + `POST /api/skills/drift/agentlinter` (single-project-per-request, .strict body). Reuses Phase 5 `agentLinterRunner` + `agentLinterCache` UNCHANGED — D-11-14 widens call-site only, not spawn surface. Covers SKD-01..03, INV-01/04/05. depends_on: 11-01.
- [ ] 11-04-PLAN.md — Wave 2 (TDD): SPA Coverage drift badge — `useCoverageHistory(repoId, cell)` hook + `CoverageDriftBadge` component (text-only ▲Nd / ▼Nd, name avoids Phase 6 `InlineDrift` collision) + `CoverageCell` extended with optional `drift` prop. Covers TRD-03, TRD-05, INV-04. depends_on: 11-01, 11-02.
- [ ] 11-05-PLAN.md — Wave 2 (TDD, parallel with 04 + 06): SPA Skill drift page — `useSkillDrift` + `useAgentLinterDrift` hooks + `SkillDriftCell/Matrix/Toolbar/Page` components + lazy route `/observability/skill-drift` + Sidebar peer-entry (`SidebarItem`, NOT `SidebarSubItem`). Covers SKD-01..05, INV-04. depends_on: 11-01, 11-03.
- [ ] 11-06-PLAN.md — Wave 2 (TDD, parallel with 04 + 05): Polish bundle — `PageHeader` sticky prop (default false, backward-compat) + `CoverageRow` opacity-30 default + `/coverage` opts into `sticky={true}`. Covers PLI-01..03. depends_on: [] (independent of all other plans).

**Gates (after Wave 2 ships — Wave 3 sequential):**
- Stage 1 `/review` on the phase diff
- Stage 2 `superpowers:requesting-code-review`
- `/cso` audit on D-11-13 (new write path `coverage-history/`) + D-11-14 (widened AgentLinter call-site)
- `/qa` walkthrough on `/coverage` + `/observability/skill-drift`
- `/impeccable critique` on `/coverage` (post-fix re-run with drift badge + sticky header + opacity polish) AND `/observability/skill-drift` (first critique) → `11-IMPECCABLE.md` composite ≥ 87 floor (calibration data point #2 per D-10.5-03)

---

## Phase 11+ Candidates — v1.1 close-out audit (2026-05-14)

**Audit scope:** v1.1 milestone "Cross-family observability" has shipped Phase 10 (Coverage Matrix) + 10.5 (skill-driven impeccable gate) + 10.6 (3-state GitNexus detection). What else, if anything, belongs in v1.1 before declaring the milestone closed and reverting to Phase 8 (held: optional integrations) for v1.2?

**Authoritative framing:** PROJECT.md Core Value — *"A single place to see, from any device, what every AgenticApps project's pipeline is doing right now — without ever sending project data to a remote service."*

The Coverage Matrix delivers the **point-in-time** half of "what every project's pipeline is doing right now". The natural v1.1 close-out question: should v1.1 also deliver the **drift over time** half ("how is it changing") before moving on?

### Candidate A — Phase 11: Coverage trends + Phase 10.6 polish bundle ★ RECOMMENDED

**Goal:** Persist daily coverage snapshots locally and show drift indicators per cell (e.g. `▲ 14d` / `▼ since 2026-05-08`). Bundle in the 2 Phase 10.6 triage items (sticky PageHeader + row-refresh icon opacity bump) since both touch the Coverage surface and individually are too small to phase-justify.

**Why this is the right v1.1 close-out:**

- **Closes the observability loop.** Phase 10 answers "what's broken?"; trends answer "what's getting worse?" and "what did we just fix?". Trends turn the matrix from a passive snapshot into a leading indicator.
- **Stays inside hard architectural constraints.** Snapshots persist to `~/.agenticapps/dashboard/coverage-history/` (already mode `0600` writable per spec); the dashboard's read-only contract over project filesystems is untouched. No new services, no native deps, no cloud upload.
- **Compounds with Phase 10 investment.** Reuses `coverageScan` orchestrator, the `gitNexusInstallState` enum (10.6), the 30s daemon cache, and the existing wire-schema barrel. No new schema layer.
- **Naturally folds the Phase 10.6 polish backlog.** The 2 "fold into Phase 11.x" items from `.planning/phases/DASH-10-.../10-IMPECCABLE.md` triage are Coverage-surface UX work — they belong here.

**Sketch (subject to /gsd-discuss-phase 11 + /gsd-plan-phase 11):**

| Wave | Work |
|---|---|
| 0 | Shared schema: extend `CoverageResponseSchema` with optional `history?: CoverageDrift[]`; new schema `CoverageDrift` (per cell, last 14 days, state transition list). |
| 1 | Daemon: snapshot writer (NDJSON-append under `~/.agenticapps/dashboard/coverage-history/<ISO-date>.ndjson`, 14-day rolling retention). New endpoint `GET /api/coverage/history?repoId=&cell=`. Cron-style daily run via launchd / systemd timer (reuses Phase 6 install-launchd/systemd). |
| 2 | SPA: drift sparkline (12-tick mini-sparkline, no library — pure SVG, 30-line render fn). `CoverageCell` gets optional `drift` prop; renders inline `▲14d` / `▼7d` text indicator if drift present. |
| 3 | Polish bundle: sticky PageHeader (shared primitive — affects every dashboard route; bonus benefit beyond Coverage); row-refresh icon `opacity-0` → `opacity-30` (touchpad/keyboard discoverability). |
| 4 | Gates: Stage 1 + Stage 2 review, `/cso` (touches daemon filesystem writes — needs trust-boundary pass), `/qa` walkthrough, `/impeccable critique` post-fix re-run (calibration data point #2 for D-10.5-03 score floor). |

**Effort estimate:** 4 waves, ~5 plans, comparable to Phase 10 scope. Roughly 1 week of focused execution.

**Open scope decisions (would be surfaced in /gsd-discuss-phase 11):**

- **Retention window** — 14 days vs 30 days vs 90 days. Storage cost is trivial (NDJSON, ~few KB/day for 45 repos × 4 columns); the question is UI signal-to-noise.
- **Snapshot trigger** — daily cron only, or also opportunistically on every dashboard load (with dedup)? Cron-only is simpler but misses days the user isn't using the dashboard.
- **Drift surface** — inline indicator (▲14d) vs sparkline vs both. Pure inline is calmer; sparkline conveys magnitude but adds visual weight to an already-dense matrix.
- **Cross-repo aggregation** — does v1.1 also ship a family-aggregate trend (e.g. "neuroflash wiki freshness: 90% → 60% over 14 days")? Could be deferred to v1.2.

### Candidate B — Phase 11: Cross-repo skill drift surface (alternative)

**Goal:** Aggregate `.claude/skills/` across all registered projects into a "Skill matrix" page. Highlight which skills are missing, version drift between repos, last-modified per skill.

**Why this is a strong alternative:** Phase 5 already wired the per-project Skills panel and AgentLinter integration. A cross-repo aggregate is a small extension — same data sources, different aggregation layer. Stays read-only.

**Why I'm NOT recommending it over Candidate A:** v1.1's milestone name is "Cross-family observability" — Coverage trends are a deeper completion of that promise. Skill drift is more naturally a **v1.2** topic ("project lifecycle observability") and would benefit from being scoped after Phase 8's integration work has shape (Sentry / Linear can supply richer signal).

### Candidate C — Defer everything; declare v1.1 closed now

**Goal:** Treat Phase 10 / 10.5 / 10.6 as sufficient for v1.1. Move directly to Phase 8 (held: optional integrations) when upstream tooling lands; bundle the 2 Phase 10.6 polish items into Phase 8 or a small inline patch.

**Why this is on the table:** v1.1's stated milestone description is "Coverage Matrix Page ships as migration 0008 in claude-workflow" — strictly speaking, that's done. The dashboard's observability story is materially richer than v1.0. Donald may have higher-leverage work elsewhere.

**Why I'm NOT recommending it:** "Drift over time" is the natural extension of "what's the current state?", and the daemon + scanner infrastructure was just built. Cost-to-add is low while context is fresh; cost would balloon if Phase 11 = trends is attempted 6 months later after the Coverage code has been forgotten.

### Recommendation

**Phase 11 = Candidate A (Coverage trends + Phase 10.6 polish bundle).** Close v1.1 with the drift story before reverting to held Phase 8.

**Phase 12 (v1.2 start) decision deferred until Phase 8 unblock signal arrives** — i.e. when Sentry / Linear / Infisical upstream tooling reaches a stable enough surface to consume. v1.2 likely re-numbers Phase 8 (held) as Phase 12 and proceeds.

**Next action if Phase 11 = Candidate A is approved:** `/gsd-discuss-phase 11` to surface the 4 open scope decisions above before planning.

### Decision (2026-05-15) — Phase 11 = Candidates A + B combined

**Chosen direction:** Bundle Candidate A (Coverage trends) and Candidate B (Cross-repo skill drift surface) into a single Phase 11. v1.1 close-out is the union of both observability stories — temporal (trends) + cross-cut (skill drift) — plus the 2 Phase 10.6 polish items.

**Why combined makes sense:**

- **Shared daemon infrastructure.** Both reuse the existing scanner architecture from Phase 10. Coverage trends extends `coverageScan` with a snapshot writer; skill drift extends the per-project `.claude/skills/` scanner (Phase 5) into a cross-repo aggregator. No new architectural primitives required.
- **Shared sidebar entry point.** Both belong under the AppShellV2 `Observability` section. v1.1 introduced the section with a single `Coverage` entry; this phase fleshes it out to a proper section with multiple entries — better information architecture than treating each as a one-off phase.
- **Reuses the Phase 10 wire-schema pattern.** Same Zod-barrel discipline, same `parseOrDrift` strategy on the SPA side, same 30s daemon cache shape.
- **Closes v1.1 with the milestone's full observability promise delivered.** "Cross-family observability" reads stronger as Coverage + Trends + Skill drift than as just Coverage.
- **Concentrates context.** Phase 10 / 10.5 / 10.6 are fresh in memory. Splitting trends and skill drift into separate phases would mean re-loading the daemon scanner mental model twice.

**Why combined is NOT just "Phase 11 + Phase 12":**

- Skill drift would otherwise sit awkwardly between v1.1's Coverage focus and Phase 8's held integration work. Folding it into Phase 11 gives it a natural home in the cross-family-observability frame.
- A standalone "skill drift" phase would be small (~3-4 plans). The discuss → plan → execute → review cycle has fixed overhead; bundling avoids paying that overhead twice for adjacent work.

**Phase 11 combined scope sketch (subject to /gsd-discuss-phase 11):**

| Sub-track | Scope |
|---|---|
| Trends (Candidate A) | Daemon snapshot writer to `~/.agenticapps/dashboard/coverage-history/` (NDJSON, rolling retention); `GET /api/coverage/history` endpoint; SPA inline drift indicators on `CoverageCell`. |
| Skill drift (Candidate B) | New daemon aggregator scanning `.claude/skills/` across all registered projects; new sidebar entry `Observability › Skill drift`; new SPA panel showing skill-presence matrix + version drift across projects. Reuses Phase 5 AgentLinter integration where available. |
| Polish bundle | Sticky `PageHeader` primitive (affects every dashboard route); row-refresh icon `opacity-0` → `opacity-30`. |
| Gates | Stage 1 + Stage 2 review, `/cso` for daemon filesystem-write surface, `/qa` walkthrough, `/impeccable critique` post-fix (calibration data point #2 for D-10.5-03 floor). |

**Open scope decisions (8 — to be surfaced in /gsd-discuss-phase 11):**

*From Candidate A:*
1. Snapshot retention window — 14d / 30d / 90d?
2. Snapshot trigger — cron-only vs cron + opportunistic dedup on dashboard load?
3. Drift surface — inline `▲14d` indicator / sparkline / both?
4. Family-aggregate trends in v1.1 or defer to v1.2?

*From Candidate B:*
5. Skill-drift aggregation level — per-skill (showing presence in N of M projects) vs per-project (showing missing skills) vs both views?
6. AgentLinter integration depth — surface per-project linter outputs in the matrix, or just version-drift / presence?
7. Cross-family vs in-family drift — does v1.1 ship the cross-family view, or scope to in-family only?

*From combined frame:*
8. Sidebar IA — keep `Observability` as a section with 2-3 entries (Coverage, Trends, Skill drift)? Or fold Trends into Coverage as a sub-view?

**Next concrete action:** `/gsd-discuss-phase 11` to surface the 8 open scope decisions before formal planning. Discuss-phase output will feed `/gsd-plan-phase 11`.

*Audit authored 2026-05-14 by Opus 4.7 (1M context) main session. Decision (combined A+B) recorded 2026-05-15.*
