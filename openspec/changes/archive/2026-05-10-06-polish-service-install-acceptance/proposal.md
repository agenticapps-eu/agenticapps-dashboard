# Phase 6: Polish + Service Install + Acceptance -

**Archived from GSD phase `06-polish-service-install-acceptance`. Completed 2026-05-10.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/06-polish-service-install-acceptance/` — that tree, not this file, is the authoritative record.

## Why

Phase 6 closes v1.0. It does NOT add new capability surface — it raises the existing dashboard to acceptance quality and ships the install story. Six requirements anchor scope:

- **POLISH-01** — Keyboard shortcuts: `R` refresh, `?` help, `/` focus search.
- **POLISH-02** — `agentic-dashboard install-launchd` produces a working LaunchAgent that survives macOS reboot.
- **POLISH-03** — `agentic-dashboard install-systemd` produces a working systemd user unit on Linux.
- **POLISH-04** — Dashboard's own UI passes `impeccable:critique` ≥ 90 (gate before merge).
- **POLISH-05** — Two-stage review (Stage 1 + Stage 2 with `<finding>` schema) ran on the dashboard's own code before merge.
- **POLISH-06** — README includes install / pair / FAQ / troubleshooting sections.

Plus three carry-forwards explicitly handed from prior phases (see Phase 5 deferred):
- Q3 — CF Access policy applied to production domain (Phase 1 deferred → here).
- Phase 3 impeccable deltas (Color 76, Typography 78, Layout 84) — bring each below 90 up to ≥ 90.
- A-01 rate-limit + A-02 schema-bounds (Phase 3 PR follow-ups).

**New capabilities, new panels, new daemon routes are out of scope.** Phase 6 polishes what shipped through Phase 5; it does not extend it.

## Capabilities affected

- `openspec/specs/daemon-runtime/spec.md`
- `openspec/specs/design-system/spec.md`

## What shipped

**06-01**

## Objective completed

Plan 06-01 had two tasks:
1. **Task 1** — Extend `packages/spa/scripts/screenshot.mjs` with `--route`, `--viewport`, `--out`, `--base-url` flags (done in commit 5301c35, prior executor).
2. **Task 2** — Capture fresh impeccable baseline against the live Phase 5.1 sidebar shell and produce 4 artifacts. Done in commit dda823c.

**06-02**

### A-02: Schema Bounds Tightening (Task 1)

Added `.max()` constraints to `RenameRequestSchema` and `TagsRequestSchema` in `packages/shared/src/schemas/registry.ts`:

- `name: z.string().min(1).max(200)` — caps project names at 200 chars (preserves existing `min(1)`)
- `tags: z.array(z.string().max(50)).max(20)` — caps tag lists at 20 entries, each tag at 50 chars

These bounds prevent registry.json bloat (worst case ~5KB/project) and make the schema self-documenting for clients.

**7 boundary tests added** to `packages/shared/src/schemas/registry.test.ts`:
- 200-char name: passes (boundary i

**06-03**

### Shortcuts (all 4 wired)

| Key | Action | Guard |
|-----|--------|-------|
| R / r | Invalidate `['registry']` on `/`; 10 project query keys on `/projects/:id` | Focus guard + modifier bail |
| ? | Navigate to `/help` | Focus guard + modifier bail |
| / | Focus `[aria-label="Search projects"]` input | Focus guard + modifier bail |
| Cmd/Ctrl+K | Open command palette (pre-existing, documented in /help) | — |

### Focus Guard

Implemented in `isEditableSurface()` in `useGlobalShortcuts.ts`:
- Checks `tagName`: `input`, `textarea`, `select`
- Checks `el.isContentEditable === true` (covers ric

**06-04**

### packages/agent/src/cli/installLaunchd.ts

Two exported symbols:

**`makePlist(nodeBinary, cliPath, logDir): string`** — pure function returning a complete Apple Property List (plist) XML document with:
- `Label`: `eu.agenticapps.dashboard`
- `ProgramArguments`: `[nodeBinary, cliPath, 'start']`
- `KeepAlive`: `<true/>` (D-6-06 auto-restart)
- `RunAtLoad`: `<false/>` (D-6-06 no auto-load — user runs `launchctl load` themselves)
- `StandardOutPath` / `StandardErrorPath`: `${logDir}/daemon.log` / `${logDir}/error.log`
- `EnvironmentVariables.PATH`: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/b

**06-05**

### packages/agent/src/cli/installSystemd.ts

Two exported symbols:

**`makeSystemdUnit(nodeBinary, cliPath, logDir): string`** — pure function returning a complete systemd unit file with:
- `[Unit]` section: `Description=AgenticApps Dashboard Daemon`, `After=network.target`
- `[Service]` section: `Type=simple`, `ExecStart=${nodeBinary} ${cliPath} start`, `Restart=on-failure`, `RestartSec=5`
- `StandardOutput=append:${logDir}/daemon.log` / `StandardError=append:${logDir}/error.log` (Pitfall 6 modern directive)
- `Environment="PATH=/usr/local/bin:/usr/bin:/bin"` (Pitfall 1 — no /opt/homebrew on

**06-06**

## Objective completed

Plan 06-06 had three tasks:
1. **Task 1 (re-labelled Task 2 in plan)** — Targeted polish for all 8 genuine deterministic violations from the Plan 01 baseline (Branch B path — REMAINING DELTA confirmed).
2. **Task 2 (re-labelled Task 1 in plan)** — Score parser script (`scripts/check-impeccable-score.mjs`) + `@playwright/test` workspace dependency.
3. **Task 3** — CI gate workflow (`.github/workflows/impeccable.yml`) + post-polish re-measurement.

**06-07**

## Objective

Land all remaining POLISH requirements + close all carry-forwards in a single composed plan:

1. POLISH-05 protocol doc (D-6-12..14) — docs/review-protocol.md.
2. POLISH-06 README (D-6-15..17) — README.md rewrite + structure test.
3. D-6-16 screenshots — docs/img/{home,project,onboarding}.png from live SPA.
4. D-6-18 CF Access doc — docs/deploy/cf-access-policy.md.
5. Closure ritual — open v1.0 PR (per D-6-24), Stage 1 + Stage 2 reviews, update STATE/ROADMAP/REQUIREMENTS.

## Gates recorded

- verification — `06-VERIFICATION.md`
- validation — `06-VALIDATION.md`
