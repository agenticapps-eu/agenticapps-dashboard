# AgenticApps Pipeline Dashboard

## What This Is

A registry-based, multi-project dashboard that visualizes the running state of the AgenticApps Superpowers + GSD + gstack pipeline across all of Donald's client and internal projects. A single page shows what fired, what's pending, and verification status for every registered project — accessible from any device, while keeping all data on the user's own machine. Architecture: hosted static SPA on Cloudflare Pages + a single local daemon that reads `.planning/`, `.claude/`, and `git log` per registered project.

## Core Value

**A single place to see, from any device, what every AgenticApps project's pipeline is doing right now — without ever sending project data to a remote service.**

## Current Milestone: v1.2 Optional integrations & fleet-conformance follow-through

**Goal:** Land the held optional-integration panels (Sentry · Linear · Infisical, now unblocked by the completed `secrets-platform` cparx pilot) and close the carry-over conformance debt from v1.1.

**Target features:**
- **Phase 8 — Optional integration panels.** Sentry · Linear · Infisical read-only status panels. Each shows a "configure to enable" empty state when its env vars are unset; the dashboard stays fully functional without any of them. Infisical surface is a read-only *status reflection* only — secrets infrastructure lives in the separate `agenticapps-eu/secrets-platform` repo, not here.
- **Phase 12 gate close-out.** Run the deferred `12-06` close-out gate (Stage 1/2 review, `/cso`, `/qa`, `12-IMPECCABLE.md`) and produce `12-VERIFICATION.md`. Implementation (12-00..05) already shipped in v1.1.
- **Phase 13 gate close-out.** Complete the incomplete `13-04` gate ritual. Implementation (13-00..03) already shipped in v1.1.
- **Phase 14.1 polish bundle.** Lift `/code-intelligence` IMPECCABLE composite from ~74 to the ≥ 80 floor (D-10.5-03.calibration-2), retiring the outstanding structural-debt waiver.

**Key context:** Most of v1.2 is carry-over close-out of already-shipped v1.1 work; only Phase 8 is net-new. Phase dirs preserved (no `phases.clear`); phase numbering continues from existing. The Infisical panel waits on / reflects the separately-built secrets platform — it is not over-built here.

## Requirements

### Validated

- ✓ **BOOT-01..05** — v1.0 (Phase 0): pnpm workspace, green CI (5 gates), CF Pages preview, placeholder agent CLI, README.
- ✓ **DAEMON-01..06, AUTH-01..05, REG-01..05, API-01..03** — v1.0 (Phase 1): Hono daemon on `127.0.0.1:5193`, bearer-token + 0600 + rotation + CORS lock, registry CRUD, path allow-list, Tailscale opt-in.
- ✓ **SPA-01..04** — v1.0 (Phase 2): Vite/React/Tailwind shell, pair flow, onboarding, settings.
- ✓ **HOME-01..06** — v1.0 (Phase 3): multi-project home, cards, filters/search/sort, register modal.
- ✓ **DISC-01..03, PHASE-01..05** — v1.0 (Phase 4): Discipline + Phase Progress columns (DISC-04 install-hint partial).
- ✓ **HEALTH-01..05** — v1.0 (Phase 5): InstalledSkills, SkillHealth (AgentLinter), Observability/Secrets/Integrations health.
- ✓ **POLISH-01..06** — v1.0 (Phase 6): keyboard shortcuts, install-launchd/systemd, impeccable gate, two-stage review, README (live-reboot + Stage-2 fresh-session sign-offs deferred).
- ✓ **HELP-01, HELP-06** — v1.0 (Phase 7): `/help` docs site (anchor pages + shortcuts); HELP-02..05 stub/widget polish carried.
- ✓ **COV-01..12** — v1.1 (Phase 10/10.6): `/coverage` matrix across three families + three-state GitNexus detection; migration 0008.
- ✓ **TRD-01..05, SKD-01..04, PLI-01..03** — v1.1 (Phase 11): coverage trends (NDJSON snapshots + drift badges) + cross-repo skill drift (SKD-05 sidebar entry partial).
- ✓ **IMP-01..05** — v1.1 (Phase 11.1/11.2): column-width lock, sticky toolbar, Toast, contrast invariant, tooltips, touch targets.
- ✓ **D-10.5-01..05** — v1.1 (Phase 10.5): skill-driven impeccable gate; floor recalibrated to ≥ 80 + structural-debt waiver (D-10.5-03.calibration-2, ratified 2026-06-08).
- ✓ **D-14-01..10** — v1.1 (Phase 14): daemon-hosted understand-anything viewer + Code Intelligence section + scoped HMAC v2 tokens.

### Active

- [ ] **REQ-12-* (Phase 12 conformance surface)** — implementation shipped (12-00..05); **close-out gate (12-06) + verification deferred** to v1.2. Carry into next milestone.
- [ ] **Phase 13 gate close-out (13-04)** — GitNexus scoped-scan actions shipped; gates ritual deferred.
- [ ] **Phase 14.1 polish bundle** — `/code-intelligence` IMPECCABLE lift (composite ~74 → ≥ 80); structural-debt waiver outstanding.
- [ ] **SENTRY-/LINEAR-/INFI-*** (Phase 8, held) — optional integrations, gated on upstream tooling.
- [ ] **OSS-01..03** (Phase 9) — open-source readiness.

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
| Single repo, three packages (`shared`, `spa`, `agent`) | Shared Zod schemas as single source of truth for wire contracts | ✓ Good (v1.0/v1.1) |
| Static SPA on Cloudflare Pages, no Workers/Functions in v1 | Pure-static keeps deployment auditable; CDN gives multi-device access | ✓ Good (v1.0/v1.1) |
| Local daemon, no cloud storage of registry/auth/project data | Hard architectural commitment from spec §"Constraints I want preserved" | ✓ Good (v1.0/v1.1) |
| `0600` file storage for token (not Keychain) in v1 | Avoids native deps; preserves `npx` install simplicity | ✓ Good (v1.0/v1.1) |
| Bearer token + loopback default; Tailscale opt-in | Defense-in-depth without exposing local services to LAN by accident | ✓ Good (v1.0/v1.1) |
| Sentry / Linear / Infisical as optional, env-var-gated | Phases 0–6 ship a complete dashboard with zero third-party deps | ✓ Good (v1.0/v1.1) |
| Repo private until Phase 6 ships; flip later if quality holds | Reduces external pressure during the discipline-establishing phases | ✓ Good (v1.0/v1.1) |
| MIT license (when public) | Matches the rest of the Claude Code skill ecosystem | ✓ Good (v1.0/v1.1) |
| CF Access email-only on production deploys | Matches "one user, multiple devices" stance | ✓ Good (v1.0/v1.1) |
| Workflow commitment ritual mandatory in every implementing session | Builds Cialdini-style consistency pressure that keeps discipline from eroding | ✓ Good (v1.0/v1.1) |

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

**Carry-forward debt** (not blocking Phase 11): 4 inherited P1s from `11-IMPECCABLE.md` (column-width drift, no toolbar sticky, no clipboard feedback, `text-text-tertiary` contrast) — candidates for an optional Phase 11.1 polish phase. Drift-surface re-pass IMPECCABLE recommended in 2-3 weeks once 14-day history populates and badges render. **Phase 11.1 closed all 4 P1s** (commit `8fe463a` on PR #36 — column-width lock via `<colgroup>` + SoT, sticky `CoverageToolbar` inside PageHeader, Toast primitive + 6-site wiring, `--color-text-tertiary` token bumped to `#706B85` per PD-11.1-09). **Phase 11.2 closed the 6 P2/P3 follow-ups** from `11.1-IMPECCABLE.md` (column-header tooltips, per-row gitnexus-analyze spinner + Toast, wiki column tightening, 44×44 touch target, controlled search, `max-w-prose` subtitle). Pending: code review WR-01 (CoverageToolbar debounce-cleanup-on-unmount latent bug, advisory).

**Phase 11.2 — Impeccable P2 polish bundle — complete (2026-05-18).** Validated decisions: **D-11.2-01..05** (in-house Tooltip primitive — hand-rolled, opacity-only, useId/ARIA, tokens-only, ~76 LOC at `packages/spa/src/components/ui/Tooltip.tsx`; 4 column-header tooltips via `coverageColumnTooltips.ts` SoT), **D-11.2-06..08** (per-row in-flight feedback — single-mutation `refresh.isPending + refresh.variables` derivation, 7th/8th Toast call sites for gitnexus-analyze success/error), **D-11.2-09** (wiki column `w-[22rem]` → `w-72`, single edit to `COVERAGE_COL_WIDTHS` SoT — IMP-01 dependency contract verified), **D-11.2-10..12** (refresh button 44×44px touch target — both pending and idle branches; actions column `w-8` → `w-12` for 4px breathing), **D-11.2-13** (CoverageToolbar controlled input via mirror-state + useEffect prop-sync), **D-11.2-14** (PageHeader subtitle `max-w-prose` 65ch). All 6 plans executed in 3 waves (W1: 01/03/05/06 parallel, W2: 02, W3: 04). 13/13 automated must-haves verified; 4 HUMAN-UAT items persisted as `status: partial` for live browser confirmation. Test totals after Phase 11.2: shared 234 + agent 746 + spa 996 + meta-observer 31 = 2,007 passing.

---

## v1.1 milestone close (2026-06-08)

**v1.1 "Cross-family observability" shipped and archived.** Spans Phases 10, 10.5, 10.6, 11, 11.1, 11.2, 12, 13, 14 — the full post-v1.0 observability arc: Coverage Matrix → skill-driven impeccable gate → trends + skill drift → impeccable polish → conformance surface → GitNexus scoped scans → understand-anything knowledge-graph viewer. Final ship PR #54 (merge `f5771fb`), tagged `v1.1`.

**Current state:** three-package pnpm workspace (shared/spa/agent); daemon on `127.0.0.1:5193`; SPA on Cloudflare Pages. Test suite ~2,600+ across packages (agent 1115 + spa 1205 + shared 329 + meta-observer 31 as of Phase 14 close). GitNexus + understand-anything viewer (v2.7.6) installed and integrated.

**Deferred into v1.2** (recorded in MILESTONES.md + STATE.md "Deferred Items"): Phase 12 close-out gate (12-06) + verification; Phase 13 gate (13-04); Phase 14.1 `/code-intelligence` IMPECCABLE lift; 2 open debug sessions; historical human-UAT/verification sign-offs (Phases 00–06, 05.1, 10, 11.1, 11.2); Tailscale second-device viewer (D-14-04, infra-gated).

**Versioning reconciliation:** the ROADMAP/REQUIREMENTS phase bodies labeled Phases 12–14 as "v1.2"; STATE.md's `milestone: v1.1` pointer + the explicit close commit fold them into v1.1. Those "v1.2" strings are now historical; the *next* milestone reuses the v1.2 label.

---

*Last updated: 2026-06-10 — milestone **v1.2 "Optional integrations & fleet-conformance follow-through"** opened. Scope: Phase 8 (Sentry/Linear/Infisical panels) + Phase 12/13 gate close-outs + Phase 14.1 IMPECCABLE lift. Phase dirs preserved (no clear); numbering continues. See `.planning/REQUIREMENTS.md` + `.planning/ROADMAP.md`.*

*Previous: 2026-06-08 after v1.1 (Cross-family observability) milestone close — Phases 10–14 archived, tagged v1.1. See `.planning/MILESTONES.md`.*

*Previous: 2026-05-18 after Phase 11.2 (Impeccable P2 polish bundle) execution complete — 6 plans across 3 waves shipped on `feat/11.2-impeccable-p2-polish-bundle`. Closes the 11.1-IMPECCABLE.md P2/P3 follow-up bundle (column-header tooltips + per-row spinner + touch target + controlled search + max-w-prose). v1.1 (Cross-family observability) substantively complete with calibration ratified.*

*Previous: 2026-05-10 after Phase 5.1 (UI redesign — Cloudflare-inspired sidebar shell) execution complete — 6 plans across 6 waves shipped: design tokens (warm paper, aubergine, accent purple), 7 + 8 UI primitives, AppShellV2 with sectioned Sidebar/TopBar/Breadcrumb/PageHeader, alias-free repalette of all 4 paired routes + 13 panels + 32 shell-adjacent components, legacy AppShell/Header/HomeLayout/ProjectLayout/appShellWidth/ProjectHeader deleted (12 files), VITE_APPSHELL_V2 cutover. Phase required mid-execution recovery (commit 31310d2) — Wave 5 work commits orphaned during fast-forward; cherry-pick + manual cleanup landed the alias migration on the branch. ~1158 workspace tests pass; verification: 7/7 must-haves passed, 2 human items (impeccable critique gate AC-06 + after-shell screenshot AC-08) deferred to Phase 6 POLISH-04 hard gate. Phase 0/1/2/3 HUMAN-UAT debt unchanged.*
