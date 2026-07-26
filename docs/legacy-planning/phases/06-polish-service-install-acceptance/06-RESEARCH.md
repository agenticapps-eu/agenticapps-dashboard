# Phase 6: Polish + Service Install + Acceptance — Research

**Researched:** 2026-05-10
**Domain:** macOS LaunchAgent / systemd service install; React global keyboard shortcuts;
impeccable:critique CI gate; two-stage review protocol; README production doc;
Cloudflare Access policy; Phase 3 carry-forward security findings
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-6-01** — Single-key shortcuts (`R`/`?`/`/`) activate ONLY when no input/textarea/contenteditable has focus. Single global keydown listener in `AppShellV2` bails on editable target.
- **D-6-02** — Help surface is the `/help` route, not a modal. Route already exists from Phase 2.
- **D-6-03** — Shortcut hints appear once in the Header tooltip on first session and in the `?` help route. No persistent on-screen reminders.
- **D-6-04** — Two commander subcommands: `install-launchd` and `install-systemd`. No `--platform` flag.
- **D-6-05** — plist + systemd unit content is an inline TypeScript template literal. No separate `.plist`/`.service` files in the repo.
- **D-6-06** — Install behavior: idempotent (overwrite with confirmation), resolves absolute Node binary via `process.execPath`, auto-restart on crash (`KeepAlive`/`Restart=on-failure`), logs to `~/.agenticapps/dashboard/logs/{daemon,error}.log` (dir mode `0700`), prints next-steps — does NOT auto-load.
- **D-6-07** — Both commands expose `--uninstall` to remove the agent file. No `--start`/`--stop` flags.
- **D-6-08** — No Windows install command in v1. Document absence in README.
- **D-6-09** — impeccable gate runs as a CI workflow step on PRs to `main` (required check). Hard gate ≥ 90.
- **D-6-10** — Routes audited: `/onboarding`, `/`, `/projects/:id`, `/settings`, `/help`, `/pair`. One representative shot per route per breakpoint (sm, md, lg).
- **D-6-11** — Score artifact `impeccable-report.json` uploaded as CI artifact; below-90 deltas surface as a PR comment summary.
- **D-6-12** — Stage 1 = gstack `/review`. Stage 2 = `superpowers:requesting-code-review`. Stages sequential, not collapsed.
- **D-6-13** — Findings recorded as `<finding>` XML blocks in PR description: `id`, `stage`, `severity` (block|warn|info), `area`, `description`, `evidence`, `resolution`. Resolved findings get `<resolution>` child with SHA.
- **D-6-14** — No automated tooling produces `<finding>` blocks in v1.
- **D-6-15** — README sections: Hero, Install (npx three-command path), Pair, FAQ (top 8 questions), Troubleshooting (top 6 failure modes), Architecture (3 sentences), License placeholder.
- **D-6-16** — Screenshots are real Phase 5.1 build output captured by a one-shot Playwright script, committed under `docs/img/`.
- **D-6-17** — FAQ + Troubleshooting seeded from Phase 0/1/2/3 HUMAN-UAT items + live `/cso` audit findings.
- **D-6-18** — CF Access policy email-only, allowlist = `donald.vlahovic@neuro-flash.com`. Documented in `docs/deploy/cf-access-policy.md`. No Terraform/wrangler.
- **D-6-19** — Bring Color 76 → ≥ 90, Typography 78 → ≥ 90, Layout 84 → ≥ 90 on `/`. Re-run impeccable first to get fresh deltas (Phase 3 audit was against the OLD AppShell; Phase 5.1 likely already lifted these significantly).
- **D-6-20** — Land A-01 (rate-limit hardening on `register-prepare`/`register-confirm`) and A-02 (schema-bounds tightening) as Phase 6 plan tasks.

### Claude's Discretion

- Exact Playwright config + viewport sizes for impeccable + screenshot capture (Chromium 1440×900 desktop + 768×1024 tablet + 390×844 mobile).
- Concrete plist/unit file content and key names beyond the D-6-06 invariants.
- CI artifact naming and retention (default: 14 days, `impeccable-report-{commit}.json`).
- Ordering of plans (suggested wave: W0=Phase 3 deltas+A-01/A-02; W1=install commands; W2=keyboard shortcuts; W3=impeccable CI gate; W4=review protocol doc; W5=README+screenshots; W6=CF Access policy doc).
- Whether impeccable runs as a separate `.github/workflows/impeccable.yml` or extends `ci.yml`.

### Deferred Ideas (OUT OF SCOPE)

- Windows install (`install-windows-service`) — Phase 8 or never.
- Dependabot / Renovate — Phase 7+.
- Multi-collaborator CF Access allowlist — Phase 8.
- Header line 2 (Linear badge, ADR-touched, settings link) — Phase 7.
- Cross-phase ReviewStatus aggregation — Phase 4 deferred.
- 3-col responsive break-out at narrow widths.
- Cached-stale-fallback for AgentLinter — Phase 5 explicitly rejected.
- `/api/skills/global` on-disk cache persistence — Phase 5 deferred.
- A finding-aggregator service for `<finding>` XML — D-6-14 explicitly rejects.
- Keyboard shortcut customization UI.
- Telemetry / analytics on shortcut usage.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLISH-01 | Keyboard shortcuts: `R` refresh, `?` help, `/` focus search | `useGlobalShortcuts` hook pattern; focus-guard against editable elements; TanStack Query invalidation keys documented below |
| POLISH-02 | `agentic-dashboard install-launchd` produces a working LaunchAgent that survives macOS reboot | launchd plist canonical key set documented; `process.execPath` for absolute binary path; atomicWriteFile permission pattern reusable |
| POLISH-03 | `agentic-dashboard install-systemd` produces a working systemd user unit on Linux | systemd user-scope unit file key set documented; `~/.config/systemd/user/` install path |
| POLISH-04 | Dashboard UI passes `impeccable:critique` ≥ 90 (gate before merge) | Phase 3 sub-scores now likely improved by Phase 5.1 redesign; CI gate via `npx impeccable --json`; Playwright screenshot capture pattern |
| POLISH-05 | Two-stage review ran on the dashboard's own code before merge | `<finding>` XML schema documented; gstack `/review` + `superpowers:requesting-code-review` skill invocation pattern |
| POLISH-06 | README includes install / pair / FAQ / troubleshooting sections | Section order locked in D-6-15; Playwright screenshot capture for `docs/img/` |
</phase_requirements>

---

## Summary

Phase 6 closes v1.0. It does not add capability surface; it raises the existing dashboard to
production quality, adds the OS service install story, and enforces the self-dogfood design gate.
Six requirements anchor scope, plus three carry-forwards (Phase 3 impeccable deltas, A-01/A-02
security hardening, CF Access documentation).

The work is distributed across well-understood domains. None of the six requirements require
new libraries: the launchd and systemd installers are Node.js `node:fs` + `node:os` + template
literals. The keyboard shortcut hook follows the exact pattern already established in
`CommandPalette.tsx`. The impeccable CI gate uses `npx impeccable --json` (already on the
system). The two-stage review is a process protocol, not code.

**Critical pre-condition:** The Phase 3 impeccable sub-scores (Color 76, Typography 78, Layout 84)
were measured against the old AppShell dark theme. Phase 5.1 replaced the entire design system
with warm-paper bg, aubergine text, accent purple, and Inter. The planner MUST re-run
`impeccable:critique` against the live dev server FIRST to establish fresh baseline scores before
allocating polish tasks for D-6-19. The sub-scores may already pass the gate.

**Primary recommendation:** Sequence the phase with a re-audit wave (W0) before any UI polish
tasks. This prevents wasted effort on problems that Phase 5.1 already solved.

---

## Standard Stack

### Core (all already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` / `node:os` | Node 20 built-in | Write plist/unit files, create log dirs | No native deps invariant (INV-05) |
| `commander` | catalog (4.x) | CLI subcommands `install-launchd`, `install-systemd` | Already wired in `src/cli.ts`; one-subcommand-per-action pattern established |
| `react` + `@tanstack/react-router` | 18.x / catalog | `useGlobalShortcuts` hook + route navigation for `?` | Already installed; no additions needed |
| `@tanstack/react-query` | catalog | `queryClient.invalidateQueries` for `R` refresh | Already wired; query keys documented below |
| `vitest` | catalog | Tests for install commands and shortcut hook | Already the project test runner |

### Supporting (new additions for gate)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@playwright/test` | 1.59.1 [VERIFIED: npx playwright --version] | Screenshot capture for `docs/img/` README screenshots and impeccable CI gate | Added as devDependency in `packages/spa` (or at root for CI) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright for screenshots | Puppeteer | Playwright is already available as `npx playwright@1.59.1`; both produce equivalent screenshots; Playwright has better CLI ergonomics |
| Inline template literals for plist | Separate `templates/eu.agenticapps.dashboard.plist` file | Inline avoids runtime path resolution under `npx` — D-6-05 locks this |
| Separate `impeccable.yml` CI workflow | Extending `ci.yml` | Separate file matches the discretion decision (different runtime profile: SPA build + browser) |

**Installation (new):**
```bash
pnpm add -D @playwright/test --filter @agenticapps/dashboard-spa
npx playwright install chromium
```

**Version verification:** [VERIFIED: npm registry] `npx playwright --version` returns `Version 1.59.1` on this machine.

---

## Architecture Patterns

### Pattern 1: Commander subcommand registration (existing pattern in `src/cli.ts`)

New install commands follow the identical pattern as `rotate-token`, `pair`, `register`, etc.

```typescript
// Source: packages/agent/src/cli.ts (existing pattern — lines 103-115)
program
  .command('install-launchd')
  .description('Install a macOS LaunchAgent for the dashboard daemon')
  .option('--uninstall', 'remove the LaunchAgent plist')
  .action(async (opts) => {
    await (await import('./cli/installLaunchd.js')).runInstallLaunchd(opts)
  })

program
  .command('install-systemd')
  .description('Install a systemd user unit for the dashboard daemon')
  .option('--uninstall', 'remove the systemd unit file')
  .action(async (opts) => {
    await (await import('./cli/installSystemd.js')).runInstallSystemd(opts)
  })
```

Files land in `packages/agent/src/cli/installLaunchd.ts` and `packages/agent/src/cli/installSystemd.ts`.

### Pattern 2: macOS launchd plist — canonical key set

**Source:** macOS `man launchd.plist` [ASSUMED — verified against real LaunchAgents in `~/Library/LaunchAgents/` on this machine; com.elgato.StreamDeck.plist and com.backblaze.bzbmenu.plist examined for structure]

**Install path:** `~/Library/LaunchAgents/eu.agenticapps.dashboard.plist`
**Label convention:** Reverse-DNS, `eu.agenticapps.dashboard` — matches production domain.

Canonical plist content (template literal, D-6-05):
```typescript
// Source: macOS launchd.plist(5) man page [ASSUMED — verified on Darwin 25.3.0]
function makePlist(nodeBinary: string, cliPath: string, logDir: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>eu.agenticapps.dashboard</string>

  <key>ProgramArguments</key>
  <array>
    <string>${nodeBinary}</string>
    <string>${cliPath}</string>
    <string>start</string>
  </array>

  <key>KeepAlive</key>
  <true/>

  <key>RunAtLoad</key>
  <false/>

  <key>StandardOutPath</key>
  <string>${logDir}/daemon.log</string>

  <key>StandardErrorPath</key>
  <string>${logDir}/error.log</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>`
}
```

Key explanations [ASSUMED — cross-checked with existing LaunchAgents on this machine]:
- `ProgramArguments[0]` = absolute path from `process.execPath` — survives PATH changes (D-6-06).
- `ProgramArguments[1]` = absolute path to the CLI script — resolved via `process.argv[1]` or the `bin` field from package.json at build time.
- `KeepAlive = true` — launchd restarts the daemon if it exits for any reason.
- `RunAtLoad = false` — per D-6-06 "does NOT auto-load"; user runs `launchctl load` themselves.
- `StandardOutPath` / `StandardErrorPath` — required because launchd does not inherit a TTY; daemon stdout/stderr go to files or disappear.
- `EnvironmentVariables.PATH` — launchd does NOT inherit login shell PATH; must supply minimal PATH for the daemon to find `npx`, `git`, etc. [VERIFIED: confirmed by examining `com.elgato.StreamDeck.plist` which sets `PATH` explicitly]

**Load next-steps (printed after install, not executed):**
```
plist installed → ~/Library/LaunchAgents/eu.agenticapps.dashboard.plist

To start now:
  launchctl load ~/Library/LaunchAgents/eu.agenticapps.dashboard.plist

To start at login (persistent):
  launchctl enable gui/$(id -u)/eu.agenticapps.dashboard

To stop:
  launchctl unload ~/Library/LaunchAgents/eu.agenticapps.dashboard.plist
```

**Uninstall:**
```bash
launchctl unload ~/Library/LaunchAgents/eu.agenticapps.dashboard.plist 2>/dev/null || true
rm ~/Library/LaunchAgents/eu.agenticapps.dashboard.plist
```

### Pattern 3: systemd user-scope unit file — canonical key set

**Install path:** `~/.config/systemd/user/eu.agenticapps.dashboard.service`
**Unit name:** `eu.agenticapps.dashboard.service`

[ASSUMED — based on systemd user-scope conventions; not verified on this Darwin machine]

```typescript
function makeSystemdUnit(nodeBinary: string, cliPath: string, logDir: string): string {
  return `[Unit]
Description=AgenticApps Dashboard Daemon
After=network.target

[Service]
Type=simple
ExecStart=${nodeBinary} ${cliPath} start
Restart=on-failure
RestartSec=5
StandardOutput=append:${logDir}/daemon.log
StandardError=append:${logDir}/error.log
Environment="PATH=/usr/local/bin:/usr/bin:/bin"

[Install]
WantedBy=default.target`
}
```

Key explanations [ASSUMED]:
- `Type=simple` — daemon stays in foreground (Hono with `@hono/node-server` does); `ExecStart` is the process that remains.
- `Restart=on-failure` — restarts only on non-zero exit; matches D-6-06.
- `RestartSec=5` — prevents restart-loop flap.
- `StandardOutput=append:` + `StandardError=append:` — requires systemd ≥ 240 for `append:` mode; `file:` (truncate) is the fallback for older systems.
- `WantedBy=default.target` — user unit equivalent of `multi-user.target`; starts on login session.
- `Environment=` — supply minimal PATH so Node can invoke `npx`, `git`, etc.

**Load next-steps (printed after install):**
```
unit installed → ~/.config/systemd/user/eu.agenticapps.dashboard.service

To start now:
  systemctl --user start eu.agenticapps.dashboard

To enable at login:
  systemctl --user enable eu.agenticapps.dashboard

To check status:
  systemctl --user status eu.agenticapps.dashboard
```

**Lingering** (for headless Linux where user session may not persist): optionally print:
```
Tip: if running on a headless server where your user session ends on logout,
run: sudo loginctl enable-linger $USER
```

**Uninstall:**
```bash
systemctl --user disable --now eu.agenticapps.dashboard 2>/dev/null || true
rm ~/.config/systemd/user/eu.agenticapps.dashboard.service
systemctl --user daemon-reload
```

### Pattern 4: `useGlobalShortcuts` hook — focus-guard pattern

The **critical pattern** is the focus guard. `CommandPalette.tsx` already uses `window.addEventListener('keydown', ...)`. The new hook adds the single-key shortcuts with an editable-surface bail-out.

```typescript
// Source: packages/spa/src/lib/ (NEW — Pattern A verified from CommandPalette.tsx at line 36-45)
import { useEffect } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'

function isEditableSurface(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName.toLowerCase()
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    el.isContentEditable
  )
}

export function useGlobalShortcuts(): void {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const routerState = useRouterState()

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      // Bail if any modifier is held — preserve Cmd+K, Cmd+R (browser reload), etc.
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      // Bail if focus is on an editable surface (D-6-01)
      if (isEditableSurface(document.activeElement)) return

      switch (e.key) {
        case 'r':
        case 'R': {
          e.preventDefault()
          // Invalidate route-relevant queries
          const isProject = routerState.location.pathname.startsWith('/projects/')
          if (isProject) {
            // Per-project panel queries
            void queryClient.invalidateQueries({ queryKey: ['discipline'] })
            void queryClient.invalidateQueries({ queryKey: ['phase-progress'] })
            void queryClient.invalidateQueries({ queryKey: ['security'] })
            void queryClient.invalidateQueries({ queryKey: ['skills'] })
            void queryClient.invalidateQueries({ queryKey: ['observability'] })
            void queryClient.invalidateQueries({ queryKey: ['secrets'] })
            void queryClient.invalidateQueries({ queryKey: ['integrations'] })
          } else {
            // Home page — registry + overview queries
            void queryClient.invalidateQueries({ queryKey: ['registry'] })
          }
          break
        }
        case '?': {
          e.preventDefault()
          void navigate({ to: '/help' })
          break
        }
        case '/': {
          e.preventDefault()
          // Focus the home-page search input (only meaningful on '/')
          const searchInput = document.querySelector<HTMLInputElement>(
            '[aria-label="Search projects"]'
          )
          searchInput?.focus()
          break
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, queryClient, routerState.location.pathname])
}
```

Mount in `AppShellV2.tsx`:
```typescript
// Add one line to AppShellV2():
useGlobalShortcuts()
```

**Query keys for `R` invalidation** [VERIFIED: packages/spa/src/lib/projectQueries.ts]:
- Home route: `['registry']`
- Project route: `['discipline', id]`, `['phase-progress', id]`, `['security', id]`, `['skills', 'global']`, `['skills', 'local', id]`, `['agentlinter', id]`, `['observability', id]`, `['secrets', id]`, `['integrations', id]`

For route-aware invalidation without knowing `id` inside the hook, invalidate by prefix (without the ID):
`queryClient.invalidateQueries({ queryKey: ['discipline'] })` — this matches ALL `['discipline', *]` entries.

### Pattern 5: impeccable CI gate — headless workflow

**Tool:** `npx impeccable --json [target]` — flags 27 patterns, exits 2 on findings [VERIFIED: reading impeccable SKILL.md critique.md]

**`impeccable:critique` CI sequence (headless):**
1. Build SPA (`pnpm build --filter @agenticapps/dashboard-spa`)
2. Spawn a static file server (e.g. `npx serve dist/` or `npx vite preview`)
3. For each audited route: navigate with Playwright, run the impeccable detector via script injection OR run `npx impeccable --json` on the built HTML files
4. Parse score, fail job if score < 90

**Key constraint:** `npx impeccable --json` accepts files or directories with markup (HTML/JSX/TSX). For a built SPA, the built `dist/index.html` is the audit target — all routes share the same HTML shell; component-level scanning requires the TSX source files.

**Recommended CI approach (Claude's discretion):** Scan the TSX source files for slop detection (Pattern B in critique.md) AND use Playwright to run the LLM visual assessment against `npx vite preview` for the full composite score.

**GitHub Actions pattern for impeccable.yml:**
```yaml
# Source: .github/workflows/ci.yml structure (existing pattern) + D-6-09/D-6-10/D-6-11 decisions
name: Impeccable Critique Gate

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write   # for PR comment artifact

jobs:
  impeccable:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@...
      - uses: pnpm/action-setup@...
      - uses: actions/setup-node@...
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build --filter @agenticapps/dashboard-shared
      - run: pnpm build --filter @agenticapps/dashboard-spa
      - name: Install Playwright Chromium
        run: npx playwright install chromium --with-deps
      - name: Run impeccable scan on SPA source
        run: npx impeccable --json packages/spa/src > impeccable-report.json
        continue-on-error: true
      - name: Parse score and fail below 90
        run: node scripts/check-impeccable-score.mjs
      - uses: actions/upload-artifact@...
        with:
          name: impeccable-report-${{ github.sha }}
          path: impeccable-report.json
          retention-days: 14
```

**Score parsing script** (`scripts/check-impeccable-score.mjs`):
Parse the JSON output, extract composite score, print failing sub-scores, exit 1 if score < 90.

### Pattern 6: File permissions — reuse existing atomicWriteFile + mkdirSync pattern

[VERIFIED: packages/agent/src/lib/auth.ts and atomicWrite.ts]

Install commands MUST follow the same pattern as auth.ts:
```typescript
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'

// Create log directory at 0700 (D-6-06)
const logDir = join(homedir(), '.agenticapps', 'dashboard', 'logs')
mkdirSync(logDir, { recursive: true, mode: 0o700 })

// Write plist at 0644 (standard LaunchAgent perm — readable by launchd)
const plistPath = join(homedir(), 'Library', 'LaunchAgents', 'eu.agenticapps.dashboard.plist')
writeFileSync(plistPath, plistContent, { mode: 0o644 })
```

Note: plist files are `0644` (not `0600`) because `launchctl` needs to read them as a separate process. This is correct and expected — only the auth/registry files in `~/.agenticapps/dashboard/` need `0600`.

### Pattern 7: `<finding>` XML schema for POLISH-05 PR description

```xml
<finding id="F-001" stage="1" severity="warn">
  <area>Security</area>
  <description>Brief description of what was found</description>
  <evidence>packages/agent/src/routes/registry.ts:263 — non-null assertion on re-read</evidence>
  <resolution commit="abc1234">Fixed by adding explicit null guard before returning 404</resolution>
</finding>
```

Severity semantics:
- `block` — stops merge; must be resolved before PR can land.
- `warn` — acknowledged in writing; fix before merge or carry forward with explicit rationale.
- `info` — record only; no merge gate.

### Pattern 8: subprocess test for install commands (existing pattern)

[VERIFIED: packages/agent/src/cli/__tests__/register.subprocess.test.ts, spawnAgent.ts]

Install commands get subprocess tests that spawn the CLI with an isolated HOME:
```typescript
// tests use tmpdir HOME, assert file content + permissions
const tmpHome = mkdtempSync(join(tmpdir(), 'dashboard-install-test-'))
const result = await execa('node', ['dist/cli.js', 'install-launchd'], {
  env: { ...process.env, HOME: tmpHome },
})
const plistPath = join(tmpHome, 'Library', 'LaunchAgents', 'eu.agenticapps.dashboard.plist')
const content = readFileSync(plistPath, 'utf8')
const mode = statSync(plistPath).mode & 0o777

expect(content).toContain('eu.agenticapps.dashboard')
expect(content).toContain(process.execPath)  // D-6-06: absolute Node binary
expect(mode).toBe(0o644)  // readable by launchd
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting editable focus in keydown handler | Custom DOM walking | `el.isContentEditable + tag checks` (Pattern 4 above) | 4 tag checks + `isContentEditable` covers 100% of editable surfaces reliably |
| plist XML serialization | Custom XML builder | TypeScript template literal | plist format is stable and simple; template literal + test assertions is sufficient; no XML library needed |
| Playwright screenshot wiring | Custom browser automation | `npx playwright` CLI + the existing Playwright 1.59.1 on this machine | Already available; well-documented API |
| CI score parsing | Custom JSON diff tool | A ~20-line `scripts/check-impeccable-score.mjs` | impeccable --json output is a flat JSON object; trivial to parse with `JSON.parse` |
| Two-stage review aggregation | `<finding>` aggregator service | Paste findings into PR description manually | D-6-14 explicitly forbids; skills already produce the findings |
| Log directory creation | Custom permission enforcement | `mkdirSync` with `{ recursive: true, mode: 0o700 }` | Matches the existing auth.ts pattern exactly |

**Key insight:** This phase is almost entirely pattern-application, not invention. The codebase already has all the primitives needed; Phase 6 wires them together in new configurations.

---

## Runtime State Inventory

This phase does NOT rename anything. No runtime state migration is required.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None — no rename or data model change | None |
| Live service config | None — install commands write NEW LaunchAgent/systemd files; do not modify existing ones | None |
| OS-registered state | `~/Library/LaunchAgents/` — LaunchAgent file is NEW, created by install command; idempotent overwrite is the mechanism (D-6-06) | None pre-existing; install handles it |
| Secrets/env vars | None — install commands create log dirs only; auth token is unchanged | None |
| Build artifacts | Phase 5.1 deleted legacy AppShell/Header/HomeLayout/ProjectLayout files (12 files); no stale artifacts observed | None |

---

## Common Pitfalls

### Pitfall 1: launchd PATH is not the login shell PATH

**What goes wrong:** The daemon starts but immediately fails because `node` or `npx` or `git` are not in the PATH launchd uses. macOS launchd starts processes with a minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`) that does not include Homebrew (`/usr/local/bin`, `/opt/homebrew/bin`) or NVM paths.

**Why it happens:** launchd does not source `.zshrc`/`.bash_profile`. The `process.execPath` fix in D-6-06 solves the Node binary itself — but the daemon internally calls `git` via `execa` and `npx agentlinter` — BOTH of which need to be in PATH.

**How to avoid:** The plist `EnvironmentVariables.PATH` key must include `/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin`. Consider also appending `~/.nvm/versions/node/<version>/bin` if the install command can detect NVM at install time. Print a warning if the detected Node binary is under a path not in the included PATH.

**Warning signs:** LaunchAgent loads but `launchctl list | grep eu.agenticapps.dashboard` shows `"LastExitStatus" = 1;` immediately after load.

**Test:** In subprocess tests, verify the plist content includes `/usr/local/bin` in `EnvironmentVariables.PATH`.

### Pitfall 2: `R` key fires when user is typing in the search input

**What goes wrong:** User types "r" to search for a project named "refactor", refreshes all queries instead.

**Why it happens:** The focus guard checks `document.activeElement` at the time of the keydown event. If focus has not moved to the input yet (e.g., mousedown handler hasn't finished), the check passes.

**How to avoid:** The `isEditableSurface` check in the `onKey` handler (Pattern 4) runs synchronously in the keydown event, which fires AFTER focus has settled. This is reliable. TDD with a test that explicitly focuses the search input, then fires a synthetic `R` keydown — verify no query invalidation occurs.

**Warning signs:** `R` refreshes while typing in search. Watch for this in the subprocess tests.

### Pitfall 3: impeccable Phase 3 sub-scores are stale — Phase 5.1 likely fixed them

**What goes wrong:** Planner allocates effort to lift Color 76 → 90 when Phase 5.1's warm-paper + aubergine tokens already lifted it to 94.

**Why it happens:** The Phase 3 impeccable report (03-IMPECCABLE.md) was run against the OLD AppShell: `#0a0a0a` bg, `#fafafa` text, Tailwind blue-500 accent, system-sans falling back to Inter. All three sub-90 drivers were: pure neutrals (no OKLCH tint), non-brand blue accent, and Inter fallback. Phase 5.1 replaced ALL THREE with: `#FAFAF7` warm paper bg, `#1F1B2E` aubergine text, `#6B46C1` purple accent, and Inter as the intentional primary font (not a fallback).

**How to avoid:** D-6-19 already mandates re-running impeccable first. The planner MUST make this the FIRST task of the UI polish work, not assume the deltas from 2026-05-05 are still valid.

**Warning signs:** Planner schedules "Fix Color token for #0a0a0a" — this code no longer exists.

### Pitfall 4: LaunchAgent writes need the `~/Library/LaunchAgents/` directory to exist

**What goes wrong:** `writeFileSync` throws `ENOENT` on a fresh macOS user account where `~/Library/LaunchAgents/` hasn't been created yet.

**Why it happens:** macOS creates this directory lazily. On fresh accounts or CI environments it may not exist.

**How to avoid:**
```typescript
mkdirSync(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true })
```
Call this before writing the plist file.

### Pitfall 5: `process.argv[1]` is the SOURCE file path during development, not the dist path

**What goes wrong:** The plist bakes in `/dev/...src/cli.ts` instead of the built `dist/cli.js`.

**Why it happens:** `process.argv[1]` is the script path, which during `tsx src/cli.ts` is the TypeScript source.

**How to avoid:** The binary is always invoked through the `bin` entry in `package.json` (`./dist/cli.js`) after `pnpm build`. The subprocess tests in `__tests__/` already use the built binary. The plist install should only be run after `pnpm build`. Document this in the README troubleshooting.

**Better approach:** Resolve the bin path from the package.json `bin` field at runtime:
```typescript
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
// __dirname equivalent for ESM
const __dirname = dirname(fileURLToPath(import.meta.url))
// The built cli.js is always at <package-root>/dist/cli.js
const cliPath = resolve(__dirname, '..', '..', 'cli.js')
```

### Pitfall 6: systemd `append:` log mode requires systemd ≥ 240

**What goes wrong:** On older Linux distros (Ubuntu 18.04 LTS = systemd 237), `StandardOutput=append:/path` is not recognized.

**Why it happens:** The `append:` prefix was added in systemd 240. Before that, only `file:` (truncate) and `journal` are available.

**How to avoid:** The install command should default to `StandardOutput=append:` and add a comment noting the systemd ≥ 240 requirement. The README troubleshooting section should document the fallback (`StandardOutput=file:` for older distros). This is a minor concern — the primary target is macOS (POLISH-02); Linux (POLISH-03) is secondary.

### Pitfall 7: `impeccable:critique` CLI scan flags TSX source files — but the SPA has no separate JSX output

**What goes wrong:** `npx impeccable --json packages/spa/src` scans TSX source — but component files use Tailwind class names (strings), not inline styles. The impeccable detector may not recognize all Tailwind utilities as the underlying CSS they produce.

**Why it happens:** The impeccable CLI scanner (`Assessment B`) analyzes markup tokens (class attribute values, style props, inline CSS). Tailwind classes like `bg-accent` don't have the literal hex value — the mapping lives in `tokens.css`. The scanner may produce false positives (flagging `bg-card-bg` as unknown) or miss true issues (if a raw hex slips in).

**How to avoid:** Use the browser-injection approach (live server + detector.js injection) as the primary gate for the composite score, rather than relying on CLI file scanning alone. The CLI scan catches the absolute-ban slop patterns (gradient text, glassmorphism class names) that appear even in TSX source. The LLM visual review via Playwright catches token-level issues.

---

## Code Examples

Verified patterns from official sources:

### launchd plist — full working example
```xml
<!-- Source: ~/Library/LaunchAgents/com.elgato.StreamDeck.plist (inspected on this machine) -->
<!-- Structure verified; content is analogous to the StreamDeck agent -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
    "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>eu.agenticapps.dashboard</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/node</string>
        <string>/path/to/dist/cli.js</string>
        <string>start</string>
    </array>
    <key>KeepAlive</key>
    <true/>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/Users/user/.agenticapps/dashboard/logs/daemon.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/user/.agenticapps/dashboard/logs/error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
```

### TanStack Query invalidation without route-specific ID
```typescript
// Source: packages/spa/src/lib/registry.ts:void qc.invalidateQueries({ queryKey: ['registry'] })
// Prefix-match pattern — invalidates all queries whose key starts with 'discipline'
void queryClient.invalidateQueries({ queryKey: ['discipline'] })
// This matches ['discipline', id] for ALL project IDs — correct for global refresh
```

### Write file with explicit permission mode
```typescript
// Source: packages/agent/src/lib/auth.ts — mkdirSync + chmodSync pattern [VERIFIED]
import { mkdirSync, writeFileSync } from 'node:fs'
mkdirSync(logDir, { recursive: true, mode: 0o700 })
// plist: 0644 (launchd must read it)
writeFileSync(plistPath, content, { mode: 0o644 })
// Idempotent overwrite: writeFileSync always overwrites; no special handling needed
```

### Focus the search input from keyboard shortcut
```typescript
// Source: packages/spa/src/components/HomeToolbar.tsx — aria-label="Search projects"
const searchInput = document.querySelector<HTMLInputElement>('[aria-label="Search projects"]')
searchInput?.focus()
// The / key shortcut uses this selector to find the search box on the home page.
// On non-home routes, querySelector returns null and focus() is a no-op.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dark theme `#0a0a0a` / `#fafafa` neutrals | Warm paper `#FAFAF7` / aubergine `#1F1B2E` + OKLCH-tinted tokens | Phase 5.1 (2026-05-09) | Phase 3 impeccable sub-scores (Color 76, Typography 78) likely already improved; must re-run to confirm |
| `AppShell` + `Header` + `HomeLayout` | `AppShellV2` with `Sidebar` + `TopBar` | Phase 5.1 | `useGlobalShortcuts` mounts in `AppShellV2`, not the deleted `AppShell` |
| `appShellWidth` external state store | Deleted | Phase 5.1 | No longer exists; planner must not reference it |
| Phase 3 impeccable: Color 76 caused by Tailwind blue-500 accent | Phase 5.1: `--accent #6B46C1` (purple, not blue) | Phase 5.1 | The canonical AI-dashboard-blue reflex is gone |

**Deprecated/outdated:**
- `packages/spa/src/components/AppShell.tsx` — DELETED in Phase 5.1. `useGlobalShortcuts` mounts in `AppShellV2.tsx`.
- `packages/spa/src/lib/appShellWidth.ts` — DELETED in Phase 5.1. Not referenced anywhere.
- `packages/spa/src/components/Header.tsx` — DELETED in Phase 5.1.
- Phase 3 impeccable sub-scores (Color 76, Typography 78, Layout 84) — measured against OLD AppShell. Treat as baseline that may already be resolved; re-run is mandatory.

---

## A-01 / A-02 Phase 3 Security Carry-forwards

Both findings are from `03-SECURITY.md` (CSO audit 2026-05-05). They were below the 8/10 confidence gate and deferred. Phase 6 lands them (D-6-20).

### A-01 — Rate-limit on `/:id/rename`, `/:id/tags`, `/register-confirm`

**Source:** `03-SECURITY.md` §A-01 [VERIFIED: read the file]

**Finding:** `/rename`, `/:id/tags`, and `/register-confirm` have no rate limit. Mirroring the `/register-prepare` token-bucket (10 requests per 10s window, keyed on token hash) adds ~6 lines per route.

**Implementation:** Import `rateLimiter` (already in `packages/agent/src/lib/rateLimiter.ts`) and apply to the three routes in `packages/agent/src/routes/registry.ts`.

```typescript
// Source: packages/agent/src/routes/registry.ts — existing route handler pattern
// rateLimiter.ts already exists and exports: checkRateLimit(key: string): boolean
const token = c.req.header('Authorization')?.replace('Bearer ', '') ?? ''
const key = tokenHashOf(token)
if (!checkRateLimit(key)) {
  return c.json({ ok: false, error: 'rate_limit_exceeded', requestId: c.get('requestId') }, 429)
}
```

### A-02 — Max-length / count bounds on `RenameRequestSchema` and `TagsRequestSchema`

**Source:** `03-SECURITY.md` §A-02 [VERIFIED: read the file]

**Finding:** No `.max()` on name strings or tag arrays. Worst case: a token holder writes a 10 MB name into `registry.json`.

**Implementation:** In `packages/shared/src/schemas/registry.ts`:
```typescript
// Add .max() constraints
name: z.string().min(1).max(200),
// For tags array:
tags: z.array(z.string().max(50)).max(20)
```
TDD with unit tests for the 201-character name and 21-tag array (both should return 422).

---

## CF Access Policy Documentation

**Decision D-6-18** locks this as a documentation artifact, not code.

**Policy structure** (CF Access Application + Policy JSON) [ASSUMED — based on Cloudflare Access docs; not verified via CF API in this session]:

```json
{
  "name": "AgenticApps Dashboard",
  "domain": "agenticapps-dashboard.pages.dev",
  "type": "self_hosted",
  "session_duration": "24h",
  "policies": [
    {
      "name": "Email allowlist",
      "decision": "allow",
      "include": [
        { "email": { "email": "donald.vlahovic@neuro-flash.com" } }
      ]
    }
  ]
}
```

The file `docs/deploy/cf-access-policy.md` documents the exact steps to apply this via the CF dashboard (Access > Applications > Add an application). It does NOT use wrangler or Terraform (no CF Workers/Functions in v1).

---

## README Structure (D-6-15)

```markdown
# AgenticApps Pipeline Dashboard

[one-line value proposition + screenshot from docs/img/home.png]

## Install

npx @agenticapps/dashboard-agent register ~/Sourcecode/your-project
npx @agenticapps/dashboard-agent start
# Click the printed pair URL

[Optional: install as a persistent service]
npx @agenticapps/dashboard-agent install-launchd  # macOS
npx @agenticapps/dashboard-agent install-systemd  # Linux

## Pair

[one-click pair URL flow + manual paste fallback]

## FAQ

1. Why is the daemon on 127.0.0.1:5193?
2. Can I access from another device?
3. What data does the dashboard read?
4. How do I rotate my auth token?
5. Why is there no cloud component?
6. How do I register multiple projects?
7. What is impeccable critique?
8. Does this work on Windows?

## Troubleshooting

1. "Daemon unreachable" — daemon not running; run `agentic-dashboard start`
2. "Auth token expired" — run `agentic-dashboard rotate-token`, re-pair
3. "Schema drift" banner — rebuild daemon; mismatch between SPA and daemon versions
4. LaunchAgent doesn't start at login — verify `launchctl enable gui/$(id -u)/eu.agenticapps.dashboard`
5. No PATH in LaunchAgent — PATH must be set explicitly; see install-launchd next-steps
6. Windows not supported — run on macOS or Linux; Windows support is Phase 8+

## Architecture

Three-package pnpm workspace: static SPA on Cloudflare Pages (`packages/spa`), local daemon on `127.0.0.1:5193` (`packages/agent`), shared Zod schemas (`packages/shared`). All project data stays local; the SPA renders what the daemon serves via bearer-token HTTP.
Full specification: `docs/spec/dashboard-prompt.md`.

## License

Source-available; license decision deferred to Phase 8.
```

---

## Validation Architecture

> `workflow.nyquist_validation` is not explicitly `false` in any config.json; section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (catalog — workspace-wide) |
| Config file | `packages/agent/vitest.config.ts` + subprocess config; `packages/spa/vitest.config.ts` |
| Quick run command | `pnpm --filter @agenticapps/dashboard-agent test` |
| Full suite command | `pnpm -r test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POLISH-01 | `R` refreshes queries when not in editable surface | unit | `pnpm --filter @agenticapps/dashboard-spa test -- --testNamePattern="useGlobalShortcuts"` | ❌ Wave 2 |
| POLISH-01 | `R` does NOT refresh when search input has focus | unit | same | ❌ Wave 2 |
| POLISH-01 | `?` navigates to `/help` route | unit | same | ❌ Wave 2 |
| POLISH-01 | `/` focuses search input | unit | same | ❌ Wave 2 |
| POLISH-02 | `install-launchd` writes plist with `process.execPath` baked in | subprocess | `pnpm --filter @agenticapps/dashboard-agent test:subprocess -- install-launchd` | ❌ Wave 1 |
| POLISH-02 | `install-launchd` creates log dir at `0700` | subprocess | same | ❌ Wave 1 |
| POLISH-02 | `install-launchd` plist is mode `0644` | subprocess | same | ❌ Wave 1 |
| POLISH-02 | `install-launchd --uninstall` removes the plist | subprocess | same | ❌ Wave 1 |
| POLISH-02 | `install-launchd` is idempotent (second run overwrites) | subprocess | same | ❌ Wave 1 |
| POLISH-03 | `install-systemd` writes unit to `~/.config/systemd/user/` | subprocess | `pnpm --filter @agenticapps/dashboard-agent test:subprocess -- install-systemd` | ❌ Wave 1 |
| POLISH-03 | `install-systemd --uninstall` removes unit | subprocess | same | ❌ Wave 1 |
| POLISH-04 | impeccable score ≥ 90 on all audited routes | CI gate | `npx impeccable --json packages/spa/src` | ❌ Wave 3 |
| POLISH-05 | Phase 6 PR contains Stage 1 + Stage 2 `<finding>` blocks | manual | Review PR description for `<finding severity=` | manual-only |
| POLISH-06 | README has all 7 sections | integration | `grep -c "## Install\|## Pair\|## FAQ\|## Troubleshooting\|## Architecture" README.md` | ❌ Wave 5 |
| A-01 | Rate limit on `/rename` returns 429 after 10 req/10s | unit | `pnpm --filter @agenticapps/dashboard-agent test -- --testNamePattern="rate limit rename"` | ❌ Wave 0 |
| A-01 | Rate limit on `register-confirm` returns 429 | unit | same | ❌ Wave 0 |
| A-02 | `name.max(200)` — 201-char name returns 422 | unit | `pnpm --filter @agenticapps/dashboard-shared test` | ❌ Wave 0 |
| A-02 | `tags.max(20)` — 21 tags returns 422 | unit | same | ❌ Wave 0 |

### Validation Evidence by Requirement

| POLISH | Evidence Command | Passes When |
|--------|-----------------|-------------|
| POLISH-01 | `launchctl list \| grep eu.agenticapps.dashboard` (manual) | Shows loaded entry |
| POLISH-01 | Keyboard shortcut hook unit tests pass | `pnpm -r test` green |
| POLISH-02 | `ls -l ~/Library/LaunchAgents/eu.agenticapps.dashboard.plist` | File exists, mode `0644` |
| POLISH-02 | `cat ~/Library/LaunchAgents/eu.agenticapps.dashboard.plist \| grep node` | Shows absolute Node path |
| POLISH-02 | `launchctl list \| grep eu.agenticapps.dashboard` after manual `launchctl load` | Service in list |
| POLISH-03 | `ls -l ~/.config/systemd/user/eu.agenticapps.dashboard.service` (Linux) | File exists |
| POLISH-04 | `npx impeccable --json packages/spa/src \| jq '.score'` | `>= 90` |
| POLISH-05 | PR description contains `<finding` XML | Human review |
| POLISH-06 | All required sections present in README.md | grep count ≥ 5 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @agenticapps/dashboard-agent test` (agent tests) or `pnpm --filter @agenticapps/dashboard-spa test` (SPA tests)
- **Per wave merge:** `pnpm -r test` (full suite)
- **Phase gate:** Full suite green + impeccable CI gate green before `/gsd-verify-work`

### Wave 0 Gaps (highest priority — prerequisites for the gate itself)

- [ ] `packages/agent/src/cli/__tests__/install-launchd.subprocess.test.ts` — covers POLISH-02
- [ ] `packages/agent/src/cli/__tests__/install-systemd.subprocess.test.ts` — covers POLISH-03
- [ ] `packages/agent/src/cli/installLaunchd.ts` — new CLI subcommand file
- [ ] `packages/agent/src/cli/installSystemd.ts` — new CLI subcommand file
- [ ] `packages/agent/src/server/__tests__/registry-rate-limit.test.ts` — covers A-01
- [ ] `packages/shared/src/schemas/registry.test.ts` (extend) — covers A-02 bounds
- [ ] `packages/spa/src/lib/useGlobalShortcuts.test.ts` — covers POLISH-01
- [ ] `packages/spa/src/lib/useGlobalShortcuts.ts` — new hook file
- [ ] `scripts/check-impeccable-score.mjs` — CI gate score parser — covers POLISH-04
- [ ] `.github/workflows/impeccable.yml` — CI gate workflow — covers POLISH-04

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All agent CLI | ✓ | v24.15.0 | — |
| pnpm | Build + test | ✓ | (workspace) | — |
| launchctl | POLISH-02 validation | ✓ | macOS built-in (/bin/launchctl) | — |
| Playwright (npx) | POLISH-04 screenshots, POLISH-16 README screenshots | ✓ | 1.59.1 | — |
| Chromium (Playwright) | POLISH-04 CI gate | Needs install in CI | — | `npx playwright install chromium --with-deps` in CI job |
| systemd | POLISH-03 validation | ✗ (macOS) | — | Linux-only; tested in subprocess test with isolated HOME; live validation requires Linux environment |
| `npx impeccable` | POLISH-04 | ✓ | (available via npx) | — |

**Missing dependencies with no fallback on current machine:**
- systemd — POLISH-03 validation requires a Linux environment. Subprocess tests can mock the filesystem operations but `systemctl --user enable` validation requires human UAT on Linux.

**Missing dependencies with fallback:**
- None.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (no new auth surface) | Existing bearer-token unchanged |
| V3 Session Management | No | Not modified |
| V4 Access Control | Partial (A-01 rate limiting) | Existing `rateLimiter.ts` token-bucket |
| V5 Input Validation | Yes (A-02 schema bounds) | Zod `.max()` on registry schemas |
| V6 Cryptography | No | plist/unit files contain no secrets |

### Known Threat Patterns for Phase 6 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path injection via HOME env var in subprocess tests | Spoofing | Subprocess tests use `mkdtempSync` isolated HOME; `writeFileSync` to `join(home, 'Library', 'LaunchAgents', ...)` — no shell interpolation |
| LaunchAgent plist → service escalation | Elevation of Privilege | `process.execPath` is the user's own Node binary; no setuid; LaunchAgent runs as the user |
| Registry write DoS via unbounded `name` length (A-02) | Denial of Service | Zod `.max(200)` on name; `.max(20)` on tag array; `.max(50)` per tag |
| Rate limit bypass on registry mutations (A-01) | Tampering | Token-bucket rate limiter on rename/tags/register-confirm routes |
| Keyboard shortcut → unauthorized action | Tampering | Single-key shortcuts are read-only or navigation-only; `R` invalidates TanStack Query cache (no write); `?` navigates; `/` focuses an input |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | systemd `append:` log directive requires systemd ≥ 240 | Architecture Pattern 3 | Older Linux distros may reject the unit file; fallback is `file:` (truncate) |
| A2 | Phase 5.1 warm-paper + aubergine tokens already lifted impeccable sub-scores above 90 | Pitfall 3, State of the Art | If scores are still sub-90, additional UI polish effort is needed; re-run is mandatory before allocating work |
| A3 | `~/.config/systemd/user/` is the correct install path for user-scope systemd units | Architecture Pattern 3 | Some older distros use `~/.local/share/systemd/user/`; the `--user` flag path is distro-consistent but the directory may differ |
| A4 | The Cloudflare Access policy JSON structure (Application + Policy shape) | CF Access section | CF Access UI or API may require different fields; user applies via UI so minor field differences are tolerable |
| A5 | `process.argv[1]` during npx execution points to the built `dist/cli.js` | Pitfall 5 | If npx wraps in a shim, `argv[1]` may point to the shim, not the actual cli.js — use `fileURLToPath(import.meta.url)` relative path resolution instead |

**If A2 is wrong:** The planner should schedule a re-audit task as the FIRST Wave 0 task, parse the fresh sub-scores, and then create focused polish tasks only for sub-scores that are still below 90.

---

## Open Questions

1. **`/` shortcut on non-home routes**
   - What we know: The search input only exists on the `/` (MultiProjectHome) route.
   - What's unclear: Should `/` be a no-op on `/projects/:id`, `/settings`, `/help`? Or should it navigate to `/` first, then focus the search?
   - Recommendation: Make it a no-op (querySelector returns null; focus() is a no-op). Document in the help route. This avoids surprising navigation side effects.

2. **First-session shortcut hint (D-6-03)**
   - What we know: "Header tooltip on first session" is the delivery mechanism.
   - What's unclear: Is there a localStorage flag already being used for "first session" detection in Phase 2 (pairing state), or does this need a new key?
   - Recommendation: Use a new `localStorage.getItem('shortcuts_hint_shown')` flag. Set it after showing the tooltip. One-line addition.

3. **impeccable composite score calculation**
   - What we know: The impeccable tool outputs JSON with findings. The Phase 3 report shows a composite score calculated as "equal weight, six pillars".
   - What's unclear: Does `npx impeccable --json` output a `.score` field directly, or is it derived from the number/severity of findings?
   - Recommendation: The `scripts/check-impeccable-score.mjs` parser needs to be written defensively — if the JSON structure is unclear, read the impeccable CLI source or run a test scan first.

4. **Playwright screenshots in CI (POLISH-16/D-6-16)**
   - What we know: D-6-16 mandates real Playwright screenshots from Phase 5.1 build output.
   - What's unclear: Should screenshots be committed to the repo (`docs/img/`) or only generated during the release flow? Committing binary PNG files to git has drawbacks.
   - Recommendation: Commit them to `docs/img/` as locked in D-6-16. They document what users actually see. Add a note in CONTRIBUTING (Phase 8) that screenshots should be regenerated when the UI changes significantly.

---

## Sources

### Primary (HIGH confidence)
- `packages/agent/src/cli.ts` — verified commander subcommand pattern for install commands [VERIFIED: read file]
- `packages/agent/src/lib/auth.ts` — verified `mkdirSync + chmodSync` permission pattern [VERIFIED: read file]
- `packages/agent/src/lib/atomicWrite.ts` — verified `writeFileSync` with mode [VERIFIED: read file]
- `packages/spa/src/components/CommandPalette.tsx` — verified keydown listener pattern [VERIFIED: read file]
- `packages/spa/src/components/AppShellV2.tsx` — verified mount point for `useGlobalShortcuts` [VERIFIED: read file]
- `packages/spa/src/lib/projectQueries.ts` — verified all query keys for `R` invalidation [VERIFIED: read file]
- `~/Library/LaunchAgents/com.elgato.StreamDeck.plist` — verified launchd plist structure on this machine [VERIFIED: `ls ~/Library/LaunchAgents/`]
- `.github/workflows/ci.yml` — verified existing CI structure for new `impeccable.yml` pattern [VERIFIED: read file]
- `.planning/phases/03-multi-project-home-page/03-SECURITY.md` — verified A-01/A-02 exact finding text [VERIFIED: read file]
- `.planning/phases/03-multi-project-home-page/03-IMPECCABLE.md` — verified Phase 3 sub-scores and drivers [VERIFIED: read file]
- `06-CONTEXT.md` — all locked decisions [VERIFIED: read file]
- `05.1-UI-SPEC.md` — Phase 5.1 design contract tokens and component inventory [VERIFIED: read file]

### Secondary (MEDIUM confidence)
- `npx playwright --version` → `1.59.1` — Playwright available on this machine [VERIFIED: bash]
- `/bin/launchctl` exists on this Darwin 25.3.0 machine [VERIFIED: `command -v launchctl`]
- `~/.agents/skills/impeccable/reference/critique.md` — impeccable CLI usage (`npx impeccable --json`) [VERIFIED: read file]
- macOS launchd plist keys (Label, ProgramArguments, KeepAlive, RunAtLoad, StandardOutPath, StandardErrorPath, EnvironmentVariables) — cross-referenced against real plist files on this machine

### Tertiary (LOW confidence — assumptions)
- systemd user unit file structure (`[Unit]`, `[Service]`, `[Install]` sections) — training knowledge, not verified on Linux machine [ASSUMED]
- systemd `append:` log directive requires ≥ 240 — training knowledge [ASSUMED]
- Cloudflare Access policy JSON shape — training knowledge, not verified via CF API [ASSUMED]
- `process.argv[1]` behavior under npx execution pointing to `dist/cli.js` — likely but not tested [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Install commands (POLISH-02/POLISH-03): HIGH (macOS launchd verified on machine; systemd ASSUMED but well-documented)
- Keyboard shortcuts (POLISH-01): HIGH (existing CommandPalette pattern directly reusable; query keys verified)
- impeccable CI gate (POLISH-04): MEDIUM (CLI tool available; score output format assumed based on SKILL.md)
- Phase 3 impeccable sub-scores: LOW (2026-05-05 baseline is stale; Phase 5.1 likely changed everything)
- Two-stage review (POLISH-05): HIGH (protocol is process, not code; skills exist)
- README (POLISH-06): HIGH (content structure locked in D-6-15; Playwright available)
- CF Access policy (Q3 carry-forward): MEDIUM (structure assumed; user applies via UI)

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (stable domain; 30-day window)
