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

- [ ] **HELP-01**: 5 anchor MDX pages (`/help`, `/help/workflow/overview`, `/help/repos/overview`, `/help/observability/overview`, `/help/operations/install`) render with frontmatter (slug/title/order/section), GFM extras (tables, links, fenced code), and embedded Mermaid diagrams
- [ ] **HELP-02**: 29 stub paths (workflow ×11 including rationalization-table + red-flags; repos ×6; observability ×7; operations ×4; reference ×4 minus the now-ready `shortcuts`) render `<ComingSoon section title />` with correct back-link without crash
- [ ] **HELP-03**: `HelpLayout` renders sidebar (collapsed-on-mobile drawer; sticky-on-desktop nav) + main `<article className="prose">` content; zero console errors on any anchor route
- [ ] **HELP-04**: `<HelpWidget name="..." />` dispatches the 8 named widget stubs (RepoTopologyMap, WorkflowStateMachine, GatePicker, TraceVisualizer, ScanReportPlayground, ApplyConsentSimulator, MigrationDryRun, SlashCommandCatalog) via `React.lazy`; unknown widget renders a bordered error message
- [ ] **HELP-05**: `<HelpHook topic="..." />` component compiles and exports cleanly; pure `topicToUrl()` returns expected `/help/<segments>` URLs with optional `#anchor` (consumer wiring deferred to v1.1)
- [ ] **HELP-06**: existing `/help` keyboard-shortcuts page replaced by docs landing; shortcuts content lives at `/help/reference/shortcuts` MDX page rendering the `KbdHint` table; `?` keyboard shortcut still navigates to `/help` landing

### Architectural Invariants (every phase)

- [ ] **INV-01**: No daemon route writes to a registered project's filesystem (sole exception: `POST /api/projects/{id}/open`, user-driven)
- [ ] **INV-02**: Registry, auth, env files in `~/.agenticapps/dashboard/` enforce mode `0600`; daemon refuses to start if looser
- [x] **INV-03**: Dashboard renders fully and gracefully when Sentry / Linear / Infisical are unconfigured
- [ ] **INV-04**: Schema validation runs at both ends of every API call; mismatches surface as "schema drift" warnings
- [ ] **INV-05**: No native dependencies in `packages/agent` (no `keytar`, no FFI)

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
| INV-01 | All phases | Pending |
| INV-02 | Phase 1 (then upheld) | Pending |
| INV-03 | All phases | Complete |
| INV-04 | All phases | Complete |
| INV-05 | All phases | Complete |
| HELP-01 | Phase 7 | Pending |
| HELP-02 | Phase 7 | Pending |
| HELP-03 | Phase 7 | Pending |
| HELP-04 | Phase 7 | Pending |
| HELP-05 | Phase 7 | Pending |
| HELP-06 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 62 total (57 phase-bound + 5 invariants)
- Mapped to phases: 62
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-02*
*Last updated: 2026-05-11 — Phase 7 HELP-01..HELP-06 appended*
