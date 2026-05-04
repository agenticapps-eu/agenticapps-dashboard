# Roadmap: AgenticApps Pipeline Dashboard

## Overview

A nine-phase journey from empty repo to a working multi-project pipeline dashboard. Phases 0–6 deliver a complete, useful dashboard with zero third-party service dependencies. Phase 7 adds optional integrations (Sentry, Linear, Infisical-aware env loading) one at a time as upstream tooling lands. Phase 8 prepares for an eventual flip to public open-source.

**Source spec:** `docs/spec/dashboard-prompt.md` — every phase here is derived from spec §"Implementation phasing" and §"Acceptance criteria".

## Milestones

- 🚧 **v1.0 Working dashboard** — Phases 0–6 (in progress)
- 📋 **v1.1 Optional integrations** — Phase 7 (planned, gated on upstream tooling)
- 📋 **v1.2 Open-source readiness** — Phase 8 (planned, much later)

## Phases

**Phase Numbering:**
- Integer phases (0, 1, 2): Planned milestone work
- Decimal phases (7.1, 7.2): Sub-phases within Phase 7's optional-integrations milestone

- [ ] **Phase 0: Bootstrap** — pnpm workspace, Cloudflare Pages preview, npm placeholder, CI green
- [ ] **Phase 1: Daemon + Registry + Pairing** — Hono server, registry CRUD, bearer-token auth, path allow-list
- [ ] **Phase 2: SPA Shell + Pair Flow** — Vite/React/Tailwind shell, `/pair`, `/onboarding`, `/settings`
- [ ] **Phase 3: Multi-project Home** — `/api/registry`, `/api/projects/{id}/overview`, card grid, filters, register modal
- [ ] **Phase 4: Single-project View — Discipline + Phase Progress** — left + center columns
- [ ] **Phase 5: Skills + Health Panels** — right column, AgentLinter integration, observability/secrets/integrations detection
- [ ] **Phase 6: Polish + Service Install + Acceptance** — keyboard shortcuts, install-launchd/systemd, impeccable critique gate, two-stage review
- [ ] **Phase 7: Optional Integrations (held)** — Sentry / Linear / Infisical wiring, gated on upstream tooling
- [ ] **Phase 8: Open-source Readiness (much later)** — LICENSE, CONTRIBUTING, optional public landing

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
- [ ] 03-01-PLAN.md — Wave 0: shared schemas (overview.ts + registry.ts extensions) + 4 daemon RED stubs (registerNonces / rateLimiter / registerLog / overviewCache) + projectOverview reader + touchLongPress; ~25 new tests
- [ ] 03-02-PLAN.md — Wave 0: AppShell max-w override pattern (useSyncExternalStore-backed) + HomeLayout wrapper for the 5xl home page width
- [ ] 03-03-PLAN.md — Wave 1: GET /api/projects/:id/overview route + 5s memo cache + outbound() schema-drift defense + 404 + unreachable graceful Pending
- [ ] 03-04-PLAN.md — Wave 1: POST /register-prepare + /register-confirm (D-09 confused-deputy nonce flow) + rate limiter (D-14) + BLOCKED stderr log (D-15)
- [ ] 03-05-PLAN.md — Wave 1: POST /:id/rename + /:id/tags routes (D-24) + evict() in /unregister for cache hygiene
- [ ] 03-06-PLAN.md — Wave 2: SPA query/mutation hooks for all 7 endpoints + filterAndSort/computeOverflowChips pure functions + D-12 apiFetch guard + /projects/$projectId placeholder route
- [ ] 03-07-PLAN.md — Wave 2: HomeToolbar (chips + search + sort) + ProjectCard (compact + hover-expand + 5 states + kebab) + CardContextMenu (portal + roving tabindex + inline unregister confirm)
- [ ] 03-08-PLAN.md — Wave 2: RegisterModal (native <dialog> two-step + dirty discard + 410 auto-re-prepare + blocked + already-registered) + RegisterButtonCard + RenameTagsForms + MultiProjectHome composition + index route swap
- [ ] 03-09-PLAN.md — Wave 2: useLastRefresh hook + Header extension showing N projects + last-refresh timestamp (D-05)
- [ ] 03-10-PLAN.md — Wave 3: CommandPalette (Cmd/Ctrl+K, native <dialog> + listbox + aria-activedescendant + 4 v1 actions) mounted in AppShell
- [ ] 03-11-PLAN.md — Wave 4: end-to-end subprocess test (daemon spawn + prepare → confirm + single-use semantics) + README "Phase 3 shipped" + full pre-flight (typecheck + test + build + lint)

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
**Plans**: TBD

### Phase 5: Skills + Health Panels
**Goal**: The right column — InstalledSkills (global + local), SkillHealth (AgentLinter-backed), ObservabilityHealth, SecretsHealth, IntegrationsHealth — with cached AgentLinter subprocess and grep-based detection.
**Depends on**: Phase 4
**Requirements**: HEALTH-01–05, INV-03 (graceful empty states)
**Success Criteria**:
  1. InstalledSkills renders skills from `~/.claude/skills/*/SKILL.md` (frontmatter only) and project `.claude/skills/*/SKILL.md`.
  2. SkillHealth runs `npx agentlinter scan` (cached 1h), surfaces Position Risk warnings; cache invalidates on `SKILL.md` mtime change.
  3. ObservabilityHealth detects Spotlight / Sentry SDK / sentry-cli in `package.json` + CI files via grep.
  4. With Sentry / Linear / Infisical unconfigured, IntegrationsHealth shows "Configure to enable" with one-paragraph guides linked.
**Plans**: TBD

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
**Plans**: TBD

### Phase 7: Optional Integrations (held)
**Goal**: Wire Sentry, Linear, and Infisical-aware env loading one sub-phase at a time, only when upstream tooling is set up. Each is fully optional and the dashboard MUST continue to work without them.
**Depends on**: Phase 6
**Requirements**: SENTRY-01–03, LINEAR-01–03, INFI-01–02 (all v2)
**Success Criteria** (per sub-phase):
  - 7a (Sentry): With `SENTRY_AUTH_TOKEN` set, recent errors render in the right column; without it, panel still renders with "configure" copy.
  - 7b (Linear): With `LINEAR_API_KEY` set, branch-to-issue linking surfaces issue title/status in the header; without it, no panel error.
  - 7c (Infisical): `infisical run -- agentic-dashboard start` works with no daemon code change.
**Plans**: TBD per sub-phase

### Phase 8: Open-source Readiness (much later)
**Goal**: LICENSE (MIT), CONTRIBUTING.md, and the optional flip of CF Access to public landing once the dashboard has soaked privately.
**Depends on**: Phase 7 (held until user opts in)
**Requirements**: OSS-01, OSS-02, OSS-03
**Success Criteria**:
  1. `LICENSE` and `CONTRIBUTING.md` at repo root match conventions in the rest of the Claude Code skill ecosystem.
  2. (Optional) CF Access policy on `dashboard.agenticapps.eu` relaxed; public landing renders for unauthenticated visitors with onboarding copy.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Bootstrap | 0/TBD | Not started | - |
| 1. Daemon + Registry + Pairing | 0/TBD | Not started | - |
| 2. SPA Shell + Pair Flow | 0/TBD | Not started | - |
| 3. Multi-project Home | 0/TBD | Not started | - |
| 4. Single-project View — Disc + Phase | 0/TBD | Not started | - |
| 5. Skills + Health Panels | 0/TBD | Not started | - |
| 6. Polish + Service Install + Acceptance | 0/TBD | Not started | - |
| 7. Optional Integrations | 0/TBD | Deferred (held until upstream tooling) | - |
| 8. Open-source Readiness | 0/TBD | Deferred (much later) | - |
