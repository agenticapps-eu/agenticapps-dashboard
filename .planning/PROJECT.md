# AgenticApps Pipeline Dashboard

## What This Is

A registry-based, multi-project dashboard that visualizes the running state of the AgenticApps Superpowers + GSD + gstack pipeline across all of Donald's client and internal projects. A single page shows what fired, what's pending, and verification status for every registered project — accessible from any device, while keeping all data on the user's own machine. Architecture: hosted static SPA on Cloudflare Pages + a single local daemon that reads `.planning/`, `.claude/`, and `git log` per registered project.

## Core Value

**A single place to see, from any device, what every AgenticApps project's pipeline is doing right now — without ever sending project data to a remote service.**

## Requirements

### Validated

- **BOOT-01..BOOT-05** — Phase 0 (bootstrap): pnpm workspace skeleton, green CI pipeline (5 gates on push/PR), CF Pages preview deploy reproducibility doc, `@agenticapps/dashboard-agent@0.0.1-alpha.0` placeholder agent CLI ready for tag-driven publish, README at root. Live deploy + tag-publish + branch protection remain as human verification gates persisted in `00-HUMAN-UAT.md`.

### Active

- [ ] **REG-01–05**: Multi-project registry CRUD (CLI + SPA-driven)
- [ ] **AUTH-01–05**: Bearer-token auth, 0600 file storage, rotation, CORS lock
- [ ] **DAEMON-01–06**: Hono server, loopback default, Tailscale support, LaunchAgent install
- [ ] **API-01–10**: Health, registry, project overview, allow-listed reads, git subprocess, agentlinter
- [ ] **SPA-01–07**: Vite/React shell, pair flow, onboarding, settings, multi-project home, single-project view
- [ ] **DISC-01–04**: CommitmentBlock, HookFirings, RationalizationFires panels (left column)
- [ ] **PHASE-01–05**: PhaseProgress, ExecutionTimeline, ReviewStatus, SecurityStatus, VerificationStatus (center column)
- [ ] **HEALTH-01–05**: InstalledSkills, SkillHealth (AgentLinter), ObservabilityHealth, SecretsHealth, IntegrationsHealth (right column)
- [ ] **POLISH-01–04**: Keyboard shortcuts, install-launchd / install-systemd, impeccable critique gate, two-stage review

### Out of Scope

- **Cloud-side data storage** — Architectural commitment: data stays local. Daemon never uploads project files.
- **Hard dependency on Sentry / Linear / Infisical** — Optional integrations only; dashboard works fully without them.
- **Native dependencies** (`keytar`, FFI, etc.) — Breaks the `npx` install story and Linux portability.
- **External sharing / team collaboration** — One user, multiple devices; no multi-tenant SaaS.
- **Real-time multiplayer presence** — Polling at 5s is sufficient.
- **Embedded chat with Claude** — Chat lives in the terminal.
- **"Trigger this skill" buttons** — Read-only safety boundary on project filesystems.
- **Storing project history beyond `.git` and `.planning/`** — No additional persistence layer.
- **Time tracking, billing, productivity surveillance** — Not the product.
- **Cloudflare Workers / Pages Functions in v1** — SPA stays pure-static.
- **Auto-update of the daemon** — User explicitly runs `npx @agenticapps/dashboard-agent@latest`.
- **Single-tenant SaaS replacement of Linear / Sentry / Infisical** — Links out when configured; doesn't reimplement.

## Context

- **Source spec:** `docs/spec/dashboard-prompt.md` (730 lines, hand-off document; treat as binding).
- **Pipeline being visualized:** Superpowers + GSD + gstack workflow with enforced hooks (see `.claude/skills/agenticapps-workflow/skill/SKILL.md`).
- **Pre-flight state already done by user:**
  - GitHub repo `agenticapps-eu/agenticapps-dashboard` (private, smoke-tested).
  - npm scope `@agenticapps` claimed; `NPM_TOKEN` in GitHub Actions secrets.
  - Cloudflare Pages project `agenticapps-dashboard` connected; default URL `https://agenticapps-dashboard.pages.dev`; CF Access policy restricts to user's email.
  - GH secrets present: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NPM_TOKEN`.
  - Local environment: Node 20+, pnpm 9+, git, gh, EDITOR set.
  - Custom domain `dashboard.agenticapps.eu` deferred — production URL is `https://agenticapps-dashboard.pages.dev` for now.
- **Competitive context:** Pilot Shell ships a similar dashboard. Building this in-house keeps control of the discipline contract while gaining cross-client visibility.

## Constraints

- **Tech stack — SPA**: Vite + React 18 + TypeScript + TailwindCSS + TanStack Query + Zod + lucide-react. **No analytics, no telemetry, no third-party JS beyond these.** Why: minimum-trust frontend; everything else gets reviewed before adoption.
- **Tech stack — Daemon**: Node 20+ (LTS) + Hono + TS strict + Zod + execa + chokidar + commander. **Zero native dependencies.** Why: `npx` install story stays portable; Linux/macOS parity preserved.
- **Repo layout**: pnpm workspaces, single lockfile, packages `shared/` (Zod schemas), `spa/`, `agent/`. Why: shared schema is the single source of truth for daemon ↔ SPA contracts.
- **Read-only on project filesystems**: No daemon route writes to a registered project's files. Sole exception: `POST /api/projects/{id}/open` spawning `$EDITOR` (user-driven). Why: hard safety boundary; dashboard cannot accidentally mutate a project.
- **Path allow-list per project**: Reads only resolve under `<root>/.planning` or `<root>/.claude`. Reject `..`, absolute paths, or realpaths outside the allow-list. Why: containment.
- **Daemon writes confined to `~/.agenticapps/dashboard/`**: Registry, auth, env files all mode `0600`; daemon refuses to start if permissions are looser. Why: prevents cross-user reads of tokens.
- **Bearer-token auth on every route**: CORS locked to production SPA origin and dev SPA origin. Why: even on loopback, defense-in-depth.
- **Optional integrations stay optional**: Sentry / Linear / Infisical panels show "configure to enable" empty states when env vars are unset; failures show stale cache, never crash. Why: dashboard must function fully without any of them.
- **No Cloudflare Workers / Pages Functions in v1**: SPA is pure static. Why: keeps deployment trivial and auditable.
- **Anti-AI-slop self-test**: Dashboard's own UI must pass `impeccable:critique` ≥ 90. Why: dogfood the discipline.
- **Two-stage review**: gstack `/review` (Stage 1: spec compliance) + `superpowers:requesting-code-review` (Stage 2: code quality, independent reviewer). Stages do **not** collapse. Why: they catch different failures.
- **TDD on every panel, every daemon route, and the bootstrap config** — including CI workflow files. Why: spec explicitly mandates it.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single repo, three packages (`shared`, `spa`, `agent`) | Shared Zod schemas as single source of truth for wire contracts | — Pending |
| Static SPA on Cloudflare Pages, no Workers/Functions in v1 | Pure-static keeps deployment auditable; CDN gives multi-device access | — Pending |
| Local daemon, no cloud storage of registry/auth/project data | Hard architectural commitment from spec §"Constraints I want preserved" | — Pending |
| `0600` file storage for token (not Keychain) in v1 | Avoids native deps; preserves `npx` install simplicity | — Pending |
| Bearer token + loopback default; Tailscale opt-in | Defense-in-depth without exposing local services to LAN by accident | — Pending |
| Sentry / Linear / Infisical as optional, env-var-gated | Phases 0–6 ship a complete dashboard with zero third-party deps | — Pending |
| Repo private until Phase 6 ships; flip later if quality holds | Reduces external pressure during the discipline-establishing phases | — Pending |
| MIT license (when public) | Matches the rest of the Claude Code skill ecosystem | — Pending |
| CF Access email-only on production deploys | Matches "one user, multiple devices" stance | — Pending |
| Workflow commitment ritual mandatory in every implementing session | Builds Cialdini-style consistency pressure that keeps discipline from eroding | — Pending |

## Evolution

After each phase transition, a successor session updates this file:
1. Move shipped requirements from Active → Validated with phase reference.
2. Move invalidated requirements to Out of Scope with reason.
3. Add new requirements that emerged to Active.
4. Append new key decisions with rationale.
5. Refresh "What This Is" if the product description has drifted.

---

## Phase 11 evolution (2026-05-18)

**Phase 11 — Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle — complete.** Validated requirements: **TRD-01..05** (Coverage trends — bulk-per-repo `/api/coverage/history`, NDJSON snapshots in `~/.agenticapps/dashboard/coverage-history/`, 14-day pruner, in-process scheduler, `CoverageDriftBadge` inline drift surface, Option C single-ownership in `CoverageRow`), **SKD-01..05** (Skill drift — daemon `skillDriftScan` + `/api/skills/drift` GET + on-demand POST AgentLinter spawn, new `/observability/skill-drift` SPA route with per-skill matrix, Sidebar 2nd Observability entry per D-11-08), **PLI-01..03** (Phase 10.6 polish — sticky `PageHeader` opt-in default false, row-refresh `opacity-30` default, `CoveragePage` opts in at all four render paths), **INV-01..05** (read-only project FS preserved, schema validation both ends, no native deps added, single-ownership drift model, no `InlineDrift` collision).

Post-UAT sticky-layering fix landed (`89d4b2d` + `1efde99`): `PageHeader` uses `-mt-6 sticky top-[-1.5rem] min-h-14`; family-header rebased to `top-8`; column-headers to `top-[5.0625rem]` — three-element stack flush across all scroll positions at 1440×900.

**v1.1 (Cross-family observability) substantially complete:** Phase 10 (Coverage Matrix) + Phase 10.5 (impeccable skill-driven gate) + Phase 10.6 (3-state GitNexus detection) + Phase 11 (trends + skill drift + polish bundle) all shipped.

**Decisions added:**
- D-11-01..14 + PD-11-01..03 documented in `.planning/phases/DASH-11-coverage-trends-skill-drift/11-CONTEXT.md`
- **D-10.5-03.calibration-1** (interim): two IMPECCABLE data points (Phase 10 = 74, Phase 11 = 76) both Nielsen 24/40; 87 floor confirmed empirically unreachable on Coverage surface; proposed recalibration to ≥ 80 with structural-debt waiver clause (Option B) — NOT yet ratified, final calibration deferred to data point #3. See `.planning/phases/DASH-10.5-impeccable-skill-driven-gate/10.5-DECISIONS.md`.

**Carry-forward debt** (not blocking Phase 11): 4 inherited P1s from `11-IMPECCABLE.md` (column-width drift, no toolbar sticky, no clipboard feedback, `text-text-tertiary` contrast) — candidates for an optional Phase 11.1 polish phase. Drift-surface re-pass IMPECCABLE recommended in 2-3 weeks once 14-day history populates and badges render.

---

*Last updated: 2026-05-18 after Phase 11 (Coverage trends + Cross-repo skill drift + Phase 10.6 polish bundle) execution complete — 6 plans across 2 waves shipped. Phase 11's own deliverables design-clean; v1.1 milestone substantially closed (4/5+ Phase candidates shipped).*

*Previous: 2026-05-10 after Phase 5.1 (UI redesign — Cloudflare-inspired sidebar shell) execution complete — 6 plans across 6 waves shipped: design tokens (warm paper, aubergine, accent purple), 7 + 8 UI primitives, AppShellV2 with sectioned Sidebar/TopBar/Breadcrumb/PageHeader, alias-free repalette of all 4 paired routes + 13 panels + 32 shell-adjacent components, legacy AppShell/Header/HomeLayout/ProjectLayout/appShellWidth/ProjectHeader deleted (12 files), VITE_APPSHELL_V2 cutover. Phase required mid-execution recovery (commit 31310d2) — Wave 5 work commits orphaned during fast-forward; cherry-pick + manual cleanup landed the alias migration on the branch. ~1158 workspace tests pass; verification: 7/7 must-haves passed, 2 human items (impeccable critique gate AC-06 + after-shell screenshot AC-08) deferred to Phase 6 POLISH-04 hard gate. Phase 0/1/2/3 HUMAN-UAT debt unchanged.*
