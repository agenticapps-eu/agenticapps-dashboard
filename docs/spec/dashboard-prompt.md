# Hand-off prompt: AgenticApps Pipeline Dashboard

This is a self-contained spec for building a registry-based, multi-project dashboard that visualizes the running state of the AgenticApps Superpowers + GSD + gstack pipeline. Hand this entire file to a fresh Claude Code session in a new worktree of `agenticapps-eu/agenticapps-dashboard`.

---

## Goal

Today, when I run `/gsd-execute-phase {N}` or invoke `agentic-apps-workflow` across multiple AgenticApps client projects, I have to grep through `.planning/`, `git log`, and skill output to know what fired, what's pending, and what the verification status is — for each project separately. I want a single page where this is visible at a glance, across all my registered projects, accessible from any device.

This is the missing visibility layer in my Superpowers + GSD + gstack stack. Pilot Shell (a competing platform) ships a dashboard like this; I'm building my own so I keep control of the discipline contract while gaining the visibility, and so it spans clients rather than being trapped per-project.

## Non-goals

- Not a remote service that stores my data. The cloud half is a static SPA only.
- Not a replacement for any existing skill. Strictly read-only over `.planning/`, `.claude/`, `git`, `~/.claude/`.
- Not a Linear / Sentry / Infisical replacement — links out to those when configured, doesn't reimplement them.
- Not real-time push. Polling at 5s is fine.
- Not a multi-tenant SaaS. One user, multiple devices, multiple projects, one local daemon.
- **Not dependent on any optional integration.** Dashboard MUST work fully without Sentry, Linear, or Infisical configured.

---

## Architecture: hosted SPA + local daemon + project registry

The dashboard is a single repo, three packages, two deployment targets:

```
┌──────────────────────────────────────┐    ┌──────────────────────────────────┐
│   dashboard.agenticapps.eu           │    │  localhost:5193                  │
│   (Cloudflare Pages, static SPA)     │    │  @agenticapps/dashboard-agent    │
│                                      │    │  (single daemon)                 │
│   Multi-project home page            │    │                                  │
│   Per-project three-column view      │◄──►│  Reads project roots from        │
│   Project switcher                   │    │  ~/.agenticapps/dashboard/       │
│                                      │    │     registry.json                │
│   No data stored cloud-side          │    │                                  │
│   Custom domain, optional CF Access  │    │  Per project, reads:             │
│   Free tier, preview deploys per PR  │    │    .planning/                    │
└──────────────────────────────────────┘    │    .claude/                      │
                                            │    git log (subprocess)          │
                                            │  Plus globally:                  │
                                            │    ~/.claude/skills/             │
                                            │    AgentLinter (subprocess)      │
                                            │                                  │
                                            │  Loopback-only by default        │
                                            │  Bearer token auth               │
                                            │  Path allow-list per project     │
                                            └──────────────────────────────────┘
```

**Key architectural commitments:**
- **Single daemon, multiple registered projects.** One pairing covers all of them.
- **Static SPA on Cloudflare Pages.** Free CDN, multi-device access via the same URL.
- **Composes with tmux + Tailscale.** iPad opens `dashboard.agenticapps.eu`, points the SPA at `http://devbox.tail-xxx.ts.net:5193`.
- **The SPA never holds my data** — only renders what the local daemon serves.
- **No third-party service is required.** Sentry, Linear, Infisical are optional features; absence shows graceful empty states with hints.

---

## Tech stack

### SPA (`packages/spa`)
- Vite + React 18 + TypeScript
- TailwindCSS
- TanStack Query (polling layer)
- Zod (parse every daemon response — strict)
- Lucide-react icons
- No analytics, no telemetry, no third-party JS beyond above

### Daemon (`packages/agent`)
- Node 20+ (LTS)
- Hono (small HTTP server)
- TypeScript with strict tsconfig
- Zod for response shapes (shared schema with SPA)
- `execa` for git / agentlinter subprocess calls
- `chokidar` for filesystem watching (debounced cache invalidation)
- `commander` for CLI parsing
- Single binary entry: `agentic-dashboard` (via `bin` field)
- **No native dependencies.** Stays portable; `npx` works without compile steps.

### Repo
- `agenticapps-eu/agenticapps-dashboard`
- pnpm workspaces, single lockfile
- Shared types in `packages/shared/`:
  ```
  packages/
  ├── shared/         # Zod schemas + TS types, depended on by spa + agent
  ├── spa/
  └── agent/
  ```
- `pnpm-workspace.yaml`:
  ```yaml
  packages:
    - 'packages/*'
  ```

---

## CLI surface

```
agentic-dashboard start                            # boot the daemon (foreground)
agentic-dashboard start --detach                   # boot detached (writes pidfile)
agentic-dashboard stop                             # graceful shutdown

agentic-dashboard register <path>                  # add one project root
agentic-dashboard register --auto <parent-dir>     # scan parent for AgenticApps projects, register matches
agentic-dashboard unregister <id|path>             # remove a project
agentic-dashboard list                             # registered projects + status
agentic-dashboard rename <id> <new-name>           # set display name
agentic-dashboard tag <id> <tag1> <tag2>           # set tags (e.g. "client", "active")

agentic-dashboard pair                             # print a fresh pair URL
agentic-dashboard rotate-token                     # invalidate current, issue new
agentic-dashboard status                           # health check

agentic-dashboard install-launchd                  # macOS: install LaunchAgent
agentic-dashboard uninstall-launchd                # macOS: remove LaunchAgent
agentic-dashboard install-systemd                  # Linux: install systemd user unit
```

`register --auto` scans the given directory looking for the marker — a `.claude/skills/agentic-apps-workflow/SKILL.md` file (project-local install) or a `.planning/config.json` referencing the workflow. User confirms each match before registration.

---

## Registry

Single source of truth at `~/.agenticapps/dashboard/registry.json`, mode `0600`:

```json
{
  "version": 1,
  "projects": [
    {
      "id": "acme-app",
      "name": "acme-app",
      "root": "/Users/donald/Sourcecode/acme-app",
      "client": "ACME Inc",
      "addedAt": "2026-05-02T14:00:00Z",
      "tags": ["client", "vite", "supabase", "active"]
    },
    {
      "id": "agentic-apps-workflow",
      "name": "agentic-apps-workflow",
      "root": "/Users/donald/Sourcecode/claude-workflow",
      "client": null,
      "addedAt": "2026-05-02T14:01:00Z",
      "tags": ["internal"]
    }
  ]
}
```

**ID generation:** slugify the project's directory name; collisions get a `-2`, `-3` suffix. User can rename via `agentic-dashboard rename`.

**Per-project status (computed at request time, cached 5s):**
- `.planning/` exists?
- `.claude/skills/agentic-apps-workflow/` installed?
- Current phase number (highest-numbered phase dir in `.planning/phases/`)
- Phase status (Pending / In Progress / Complete — read from frontmatter)
- Last commit timestamp on current branch

**Robustness:** if a registered project's `root` no longer exists, mark it as `unreachable` in `list` output; don't crash. Prompt for `unregister` on next interaction.

---

## Auth (no secrets manager required)

The daemon binds to `127.0.0.1:5193` by default. CORS allows only:
- Production: `https://dashboard.agenticapps.eu`
- Dev: `http://localhost:5174` (SPA dev server)

All routes require `Authorization: Bearer <token>`.

### Token storage

`~/.agenticapps/dashboard/auth.json`, mode `0600`:

```json
{
  "version": 1,
  "token": "8a3f-c9d2-1b47-e8f0-4a7c-9b1e-2d8a-6f93",
  "rotatedAt": "2026-05-02T14:00:00Z",
  "agentVersion": "0.1.0"
}
```

The token rotates on:
- `agentic-dashboard rotate-token` (manual)
- Daemon version upgrade
- 30 days uptime (auto-rotation; SPA shows re-pair prompt)

**Permissions check on startup.** If `auth.json` is not `0600`, the daemon refuses to start with a clear error: "auth.json has insecure permissions (mode 644); fix with `chmod 600 ~/.agenticapps/dashboard/auth.json` or run `agentic-dashboard rotate-token` to regenerate."

### Why a file, not Keychain

Keychain integration would add a native dependency (`keytar`) that breaks the simple `npx` install story and complicates Linux portability. A 0600 file in your home directory is sufficient for a daemon that already only listens on loopback. v2 can add Keychain as a `--secure-store keychain` opt-in.

### Pairing flow

When the daemon starts, it prints:

```
$ agentic-dashboard start

[agent] Daemon starting…
[agent] Registry: 3 projects (acme-app, beta-app, agentic-apps-workflow)
[agent] Listening on http://127.0.0.1:5193
[agent] Token: 8a3f-c9d2-1b47-e8f0-4a7c-9b1e-2d8a-6f93
[agent]
[agent] Pair this device:
[agent]   https://dashboard.agenticapps.eu/pair?agent=http%3A%2F%2F127.0.0.1%3A5193&token=8a3f...
[agent]
[agent] Or pair manually at https://dashboard.agenticapps.eu/settings:
[agent]   Agent URL: http://127.0.0.1:5193
[agent]   Token:     8a3f-c9d2-1b47-e8f0-4a7c-9b1e-2d8a-6f93
[agent]
[agent] Press Ctrl-C to stop, or `agentic-dashboard install-launchd` to run as a service.
```

The pair URL is one-click. SPA validates the agent URL against `localhost / 127.0.0.1 / *.tail-*.ts.net`, calls `/health` with the bearer, stores `{agentUrl, token}` in localStorage, redirects to `/`.

### Tailscale / remote use case

```bash
# On dev machine
agentic-dashboard start --bind tailscale     # auto-detects Tailscale IP, binds there
# OR explicit
agentic-dashboard start --bind 100.x.y.z
# OR all interfaces (only safe on Tailscale-isolated machines)
agentic-dashboard start --bind 0.0.0.0
```

When `--bind tailscale` is used:
- Daemon detects Tailscale IP via `tailscale ip -4` (gracefully fails if not installed)
- Pair URL uses the Tailscale hostname: `https://dashboard.agenticapps.eu/pair?agent=http%3A%2F%2Fdevbox.tail-xxx.ts.net%3A5193&token=…`
- Daemon optionally enforces client IP is in Tailscale CIDR (`100.64.0.0/10`); reject otherwise

For `--bind 0.0.0.0`: same CIDR enforcement, plus a startup banner warning.

---

## Daemon as a service (macOS LaunchAgent)

```bash
agentic-dashboard install-launchd
```

Generates `~/Library/LaunchAgents/eu.agenticapps.dashboard.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>eu.agenticapps.dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>{path-to-installed-agentic-dashboard}/dist/cli.js</string>
    <string>start</string>
    <string>--bind</string>
    <string>tailscale</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>{HOME}/.agenticapps/dashboard/logs/stdout.log</string>
  <key>StandardErrorPath</key>
  <string>{HOME}/.agenticapps/dashboard/logs/stderr.log</string>
</dict>
</plist>
```

Loaded with `launchctl load -w`. Survives reboots. Logs in `~/.agenticapps/dashboard/logs/`.

`agentic-dashboard uninstall-launchd` removes the plist and stops the service.

Linux equivalent (`install-systemd`) generates `~/.config/systemd/user/agentic-dashboard.service` and enables it via `systemctl --user enable`.

---

## API surface (Hono routes)

All routes require `Authorization: Bearer <token>`. CORS as above.

### Daemon-level

```
GET  /health
     → { ok, daemonVersion, registryCount, paired: true }

GET  /api/skills/global
     → list of ~/.claude/skills/*/SKILL.md (frontmatter only, plus mtime)

POST /api/registry/register
     body: { path, name?, client?, tags? }
     → { id, ... } (201) or 409 if path already registered

POST /api/registry/unregister
     body: { id }
     → 204

GET  /api/registry
     → [{ id, name, root, client, tags, status: { reachable, currentPhase, ... } }]

POST /api/auth/rotate
     → 204; old token invalidates immediately
```

The `/api/registry/register` and `/unregister` routes are the only "write" routes — but they only mutate the registry file, not project files. SPA-driven project registration is intentionally allowed (vs the strict no-write rule on project filesystems) so users can manage projects from the dashboard UI without dropping to the CLI.

### Project-scoped

```
GET  /api/projects/{id}/overview
     → summary card data: current phase, Stage 1/2 status, finding counts,
       must_haves vs evidence, last commit, branch name

GET  /api/projects/{id}/read?path={relative path under .planning/ or .claude/}
     → { content, mtime, sha256 } or 422 if outside allow-list

GET  /api/projects/{id}/git?cmd={log|status|diff-stat|branch}&args=...
     → { stdout, stderr, exitCode } (cmd + args allow-listed)

POST /api/projects/{id}/open
     body: { path }
     → spawns $EDITOR; returns 200 immediately

GET  /api/projects/{id}/agentlinter
     → cached 1h; on miss runs `npx agentlinter scan` against the project's
       CLAUDE.md tree, returns parsed JSON

GET  /api/projects/{id}/skills/local
     → list of .claude/skills/*/SKILL.md frontmatter

GET  /api/projects/{id}/observations/recent?limit=20
     → recent JSONL entries from .planning/skill-observations/

GET  /api/projects/{id}/integrations
     → { sentry: { configured: bool, projectSlug? },
         linear: { configured: bool, teamId? },
         infisical: { configured: bool, scope? } }
     → all read from project's .env / config — never from a remote service
```

### Optional integration routes

These return 404 (with a clear "not configured" message body) when the relevant env var is missing:

```
GET  /api/projects/{id}/sentry/recent
     requires SENTRY_AUTH_TOKEN env on the daemon
     and project's .sentryclirc or env-detected DSN
     → cached 60s; recent errors

GET  /api/projects/{id}/linear/issue/{issueId}
     requires LINEAR_API_KEY env on the daemon
     → cached 60s; issue title, status, assignee
```

**Crucially:** the dashboard renders fine without either of these. Panels that depend on them show graceful empty states with copy like "Configure SENTRY_AUTH_TOKEN to enable this panel" linked to a one-page setup guide.

### Path allow-list (per project)

For `/api/projects/{id}/read`:

```ts
// resolve incoming path against project root, then check it's under one of:
const allowed = [
  path.resolve(project.root, '.planning'),
  path.resolve(project.root, '.claude'),
]
// reject paths containing .., starting with /, or with realpath outside `allowed`
```

Daemon-level reads of `~/.claude/skills/` are not project-scoped (they're global) and live at `/api/skills/global`.

---

## SPA route structure

```
/                              → multi-project home (if paired); else /onboarding
/projects/{id}                 → single-project three-column view
/onboarding                    → install-the-daemon walkthrough
/pair?agent=...&token=...      → pair flow
/settings                      → manual pair, theme, project management
/settings/projects             → register / unregister / rename / tag from UI
/settings/integrations         → "configure these env vars to enable optional features"
/help                          → keyboard shortcuts, troubleshooting
```

If user lands on `/` without a pairing in localStorage, redirect to `/onboarding`.

### `/onboarding` content

Plain copy:

> ## Install the daemon
>
> ```
> npx @agenticapps/dashboard-agent register ~/Sourcecode/your-first-project
> npx @agenticapps/dashboard-agent start
> ```
>
> The daemon will print a pair URL. Click it to complete setup.
>
> Optional: `agentic-dashboard install-launchd` (macOS) to run on every boot.

No login form. No magic. Just a path.

---

## Page layout — multi-project home (`/`)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  AgenticApps Dashboard · 6 projects · last refresh 2s ago · ⚙ settings     │
└────────────────────────────────────────────────────────────────────────────┘

  Filter: [all] [active] [client] [internal]    Search: [               ]

  ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐
  │ acme-app               │  │ beta-app               │  │ gamma-internal       │
  │ ACME Inc · client      │  │ BETA Co · client       │  │ Internal · internal  │
  │                        │  │                        │  │                      │
  │ Phase 04 · In Progress │  │ Phase 02 · Complete    │  │ no .planning/        │
  │                        │  │                        │  │                      │
  │ Stage 2 findings:      │  │ Stage 2 findings:      │  │ install workflow     │
  │   🔴 0  🟡 2  🟢 5     │  │   🔴 0  🟡 0  🟢 1     │  │ skill →              │
  │                        │  │                        │  │                      │
  │ DB-AUDIT: 0 critical   │  │ DB-AUDIT: 1 high       │  │                      │
  │                        │  │                        │  │                      │
  │ TDD pairs: 4/5         │  │ TDD pairs: 3/3         │  │                      │
  │ Verification: 3/4      │  │ Verification: 4/4      │  │                      │
  │                        │  │                        │  │                      │
  │ last commit 14m ago    │  │ last commit 2h ago     │  │ last activity 4d ago │
  └────────────────────────┘  └────────────────────────┘  └─────────────────────┘

  ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐
  │ delta-app              │  │ epsilon-app            │  │ + Register project   │
  │ DELTA · client         │  │ archived               │  │                      │
  │ ...                    │  │ ...                    │  │                      │
  └────────────────────────┘  └────────────────────────┘  └─────────────────────┘
```

**Sort:** by tag priority (active > client > internal), then by last commit time desc.

**Click card** → `/projects/{id}` (the existing three-column layout).

**Card composition** = single `/api/projects/{id}/overview` call per card. Polled every 5s globally; per-card data shows freshness.

**"+ Register project" card** → modal that lets user paste a path, names get auto-suggested. POSTs to `/api/registry/register`.

---

## Page layout — single project (`/projects/{id}`)

Three columns, header.

### Header

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ← All Projects · acme-app (ACME Inc) · feat/impeccable · phase 04 — In Prog │
│     Linear: ACME-123 · ADR last touched 2 days ago · [⚙ project settings]    │
└──────────────────────────────────────────────────────────────────────────────┘
```

(`Linear: ACME-123` is a static link that surfaces only if a Linear-style branch / commit reference is detected; no API call required for the link itself. The full Linear panel is a separate optional integration.)

### Left column — Discipline state

- **CommitmentBlock** — last `## Workflow commitment` block emitted in this project
- **HookFirings** — last 20 hook fires from `.planning/skill-observations/`
- **RationalizationFires** — counter per rationalization-table row that fired

If the meta-observer skill (per action-plan §4.3) is not installed in this project, the panel shows an install hint with a copy-pasteable command.

### Center column — Phase progress

- **PhaseProgress** — file-by-file checklist (CONTEXT.md ✓, PLAN.md ✓, etc.)
- **ExecutionTimeline** — TDD red/green pairs from git log
- **ReviewStatus** — Stage 1 / Stage 2 status, finding counts by severity (parses `<finding severity="...">` blocks per action-plan §4.1)
- **SecurityStatus** — `/cso` + database-sentinel summary
- **VerificationStatus** — must_haves vs evidence count

### Right column — Skills and tooling health

- **InstalledSkills** — `~/.claude/skills/` (global) and project `.claude/skills/`
- **SkillHealth** — AgentLinter scores, Position Risk warnings (cached 1h)
- **ObservabilityHealth** — Spotlight / Sentry SDK / sentry-cli detection (grep package.json + CI files)
- **SecretsHealth** — `.infisical.json` presence detection (purely informational; no Infisical calls)
- **IntegrationsHealth** — Sentry / Linear / Infisical configured-or-not status, with "configure" links

If any optional integration is unconfigured, no error — just a discreet "configure to enable" line.

---

## Optional integrations: the contract

For all three (Sentry, Linear, Infisical), the rule is the same:

1. Dashboard works fully without them.
2. When unconfigured: panels show "Configure to enable" with a single one-paragraph guide and the env var name.
3. When configured: panels show data. Failures are caught and shown as "Sentry API unreachable — using cached data from {time}" rather than crashing.
4. Configuration is via env vars passed to the daemon at startup. No secret store required.

### Configuring Sentry (when ready, NOT in v1)

```bash
SENTRY_AUTH_TOKEN=sntrys_... agentic-dashboard start
# OR persisted via:
agentic-dashboard env set SENTRY_AUTH_TOKEN sntrys_...
agentic-dashboard restart
```

`agentic-dashboard env set` writes to `~/.agenticapps/dashboard/env.json` (mode `0600`). Daemon merges these into its env on startup.

### Configuring Linear (when ready)

```bash
LINEAR_API_KEY=lin_api_... agentic-dashboard start
# OR
agentic-dashboard env set LINEAR_API_KEY lin_api_...
```

### Configuring Infisical (much later)

When Donald eventually adopts Infisical (action-plan §5), the dashboard daemon can read its env from Infisical instead of the local env.json:

```bash
infisical run --env=prod -- agentic-dashboard start
```

No code change required — daemon just reads `process.env.SENTRY_AUTH_TOKEN` etc. The shift to Infisical is invisible to the dashboard.

---

## Visual style

- Match the impeccable design language if installed in the consuming project (read its tokens via `/api/projects/{id}/read?path=.claude/skills/impeccable/...`).
- Otherwise: dark-mode default; light-mode toggle.
- Restrained palette: neutral grays, single accent color (your AgenticApps brand color, configurable via `~/.agenticapps/dashboard/theme.json`).
- Typography: **NOT Inter.** Pick something distinctive. Suggestion: iA Writer Mono for headers / monospace; Söhne or Inter Display for body.
- **Anti-AI-slop self-test:** every frontend-touching phase ends by running the `impeccable:critique` skill against affected routes at 1440×900 and committing `<phase>-IMPECCABLE.md`. Composite floor ≥ 87 (D-6-09.v1, subject to calibration in `.planning/phases/DASH-10.5-impeccable-skill-driven-gate/10.5-DECISIONS.md` (D-10.5-01..05)). Phase 6's CI gate retired in favor of the per-phase artifact.

---

## Shared types (`packages/shared/`)

Zod schemas exported from `packages/shared/src/schemas/` and consumed by both SPA (response validation) and daemon (response generation). Single source of truth.

Critical schemas:

- `ProjectSchema` — registry record
- `ProjectOverviewSchema` — home-page card data
- `PhaseProgressSchema` — three-column center data
- `HookFiringSchema` — JSONL line from meta-observer
- `CommitmentBlockSchema`
- `FindingSchema` — the GodMode `<finding severity="..." category="...">` shape
- `SkillFrontmatterSchema`

All API responses validate against schemas on both ends. Mismatch = "schema drift" warning in SPA.

---

## Acceptance criteria

The dashboard is "done" when:

1. `agentic-dashboard start` runs as a daemon, registers ≥1 project, prints a pair URL, and the SPA at `dashboard.agenticapps.eu` shows the multi-project home page after pairing.
2. Multi-project home page renders cards for each registered project with current phase, finding counts, and last-commit time. Click → single-project view.
3. Adding/removing projects via SPA (`/settings/projects`) immediately reflects in the home page.
4. **Dashboard works fully without Sentry, Linear, or Infisical configured.** All three are entirely optional. Their panels show graceful empty states with "configure to enable" copy when env vars are unset.
5. Every other panel either renders data or shows a graceful empty state with a hint.
6. No daemon route writes to project filesystems. Only writes are to the registry, auth, and env.json files in `~/.agenticapps/dashboard/`.
7. Path allow-list rejects anything outside `.planning/` and `.claude/` per project.
8. Token rotation works: `agentic-dashboard rotate-token`, SPA tab shows "agent unreachable, re-pair" rather than crashing.
9. `agentic-dashboard install-launchd` produces a working LaunchAgent that survives reboot.
10. Cloudflare Access policy is configured on `dashboard.agenticapps.eu` (production), restricting to your email.
11. `auth.json`, `registry.json`, `env.json` all enforce mode `0600` — daemon refuses to start if permissions are looser.
12. Pairing works across `localhost`, Tailscale hostname, and (smoke-test only) explicit IP on LAN.
13. Empty-state UX: in a fresh install with zero registered projects, `/` redirects to `/onboarding` and renders a one-screen install guide.
14. SPA hot-reload loop is fast: `pnpm --filter @agenticapps/dashboard-spa dev` → tweak a panel → see it in <2s.
15. Every frontend-touching phase has an `<N>-IMPECCABLE.md` artifact committed alongside the phase docs, generated by the `impeccable:critique` skill at 1440×900. Composite floor ≥ 87 (D-6-09.v1, calibration pending — see D-10.5-03).
16. Two-stage review (Stage 1 + Stage 2 with `<finding>` schema) ran on the dashboard's own code before merge.

---

## Implementation phasing (for the implementing session)

Use GSD: discuss → plan → execute → verify per phase, with the AgenticApps workflow skill active.

**Phase 0 — Repo bootstrap + deployment skeleton (1 short session)**
- Create `agenticapps-eu/agenticapps-dashboard` (private to start)
- pnpm workspace skeleton: `packages/spa`, `packages/agent`, `packages/shared`
- Root `package.json`, `pnpm-workspace.yaml`, base `.gitignore`, base CI workflow
- Cloudflare Pages project connected (preview deploy works on a placeholder `index.html`)
- npm scope `@agenticapps` claimed; placeholder agent published as `0.0.1-alpha.0`
- README with "this is alpha" notice

**Phase 1 — Daemon skeleton + registry + pairing (2 sessions)**
- Daemon: Hono server, `start` / `stop` / `status` commands
- Registry CRUD via CLI: `register` / `unregister` / `list` / `rename` / `tag`
- Auth: token generation, `auth.json` with `0600`, permissions enforcement on startup, `rotate-token`
- `/health`, CORS, path allow-list (per registered project), Bearer token middleware
- TDD: token rotation invalidates old token; CORS rejects wrong origin; path allow-list rejects `..`; permissions check refuses `0644`

**Phase 2 — SPA skeleton + pairing (1 session)**
- Vite + React + Tailwind shell
- Pair flow at `/pair`
- Onboarding at `/onboarding`
- Settings page at `/settings` with manual-pair fallback
- Empty `/` until pairing succeeds

**Phase 3 — Multi-project home page (1 session)**
- `/api/registry` endpoint with per-project status summaries
- `/api/projects/{id}/overview` endpoint
- Home-page card grid, filters, search, sort
- "+ Register project" modal hitting `POST /api/registry/register`

**Phase 4 — Single-project view (Discipline + Phase progress) (1 session)**
- `/projects/{id}` route
- Left column: CommitmentBlock, HookFirings, RationalizationFires
- Center column: PhaseProgress, ExecutionTimeline, ReviewStatus, SecurityStatus, VerificationStatus
- Driven entirely by `.planning/phases/<current>/` and meta-observer JSONL
- Stage 2 finding count parses `<finding severity="...">` blocks (per action-plan §4.1)

**Phase 5 — Skills + Health panels (1 session)**
- Right column: InstalledSkills, SkillHealth (AgentLinter integration), ObservabilityHealth, SecretsHealth, IntegrationsHealth
- AgentLinter subprocess + 1h cache
- Grep-based detection of Spotlight / Sentry SDK / sentry-cli / `.infisical.json`

**Phase 6 — Polish + service install + acceptance (1 session)**
- Keyboard shortcuts (R=refresh, ?=help, /=focus search)
- `install-launchd` and `install-systemd` commands
- impeccable critique self-test (gate)
- Cloudflare Access policy applied to production domain
- README in the repo with install / pair / FAQ / troubleshooting sections
- Two-stage review pass with `<finding>` schema

**Phase 7 — Optional integrations (LATER, separate phase, not v1) (1 session each)**
- Sentry panel (Phase 7a) — when Donald sets up Sentry per action-plan §3
- Linear panel (Phase 7b) — when Donald wants it
- Infisical-aware env loading (Phase 7c) — when Donald adopts Infisical

**Phase 8 — Open-source readiness (optional, much later)**
- LICENSE
- CONTRIBUTING.md
- Public landing on `dashboard.agenticapps.eu` (drop CF Access auth) if/when ready

**Phases 0–6 produce a working, useful dashboard with no third-party dependencies.** Phases 7+ are additive.

---

## Open questions for the implementing session to surface in `/gsd-discuss-phase 0`

1. **Repo visibility:** start private and flip to public later, or public from day one?
   *Recommendation:* private until phase 6 ships and looks good. Then flip.
2. **License if eventually public:** MIT, AGPL, or custom?
   *Recommendation:* MIT. Match the rest of the Claude Code skill ecosystem.
3. **Cloudflare Access for production:** restrict to your email only, or a small allowlist of collaborators?
   *Recommendation:* email-only until you have collaborators.
4. **Should the agent expose schema validation errors verbosely or vaguely?**
   *Recommendation:* verbose in dev, vague in prod (gate via `NODE_ENV`).
5. **Should the meta-observer skill be packaged inside this repo or stay separate?**
   *Recommendation:* separate skill repo (it has independent value); dashboard just consumes its log format. Document the JSONL schema in `packages/shared/src/schemas/observation.ts`.
6. **AgentLinter integration in v1 or deferred?**
   *Recommendation:* v1 (Phase 5). Position Risk warning is the highest-leverage signal.
7. **Auto-discovery (`register --auto`) in v1 or deferred?**
   *Recommendation:* v1, but with explicit confirmation per match. Deferring it means manual registration of every project, which gets annoying past 3.
8. **Daemon process model: foreground-by-default, or detach-by-default?**
   *Recommendation:* foreground by default (so users see logs and Ctrl-C works). LaunchAgent install handles backgrounding properly.

---

## Constraints I want preserved no matter what

- **Workflow commitment ritual is mandatory** in every implementing session. The dashboard build itself is subject to the AgenticApps workflow skill — TDD on every panel, two-stage review, impeccable critique on the UI.
- **Dashboard works fully without Sentry, Linear, or Infisical.** These are optional, additive integrations. Phase 6 ships a complete dashboard with zero third-party service dependencies.
- **No remote services storing my data.** Daemon stays local; SPA on Pages is a static asset.
- **Reasonable install friction.** First-time setup is `npx @agenticapps/dashboard-agent register <path> && agentic-dashboard start && click pair URL`. Three commands.
- **Filesystem reads are allow-listed per project.** Anything outside `.planning/` or `.claude/` for a registered project is 403.
- **Read-only on project filesystems.** No daemon route writes to any registered project's files. The single exception is `/api/projects/{id}/open` which spawns `$EDITOR` — explicitly user-driven via a button click.
- **Registry / auth / env writes are confined to `~/.agenticapps/dashboard/`.** All mode `0600`.
- **Token-bound auth on every call.** No anonymous access; CORS lock to known origins.
- **Anti-AI-slop self-test.** Every frontend-touching phase runs the `impeccable:critique` skill against affected routes and commits `<N>-IMPECCABLE.md`. Composite floor ≥ 87 at 1440×900 (D-6-09.v1, calibration pending per D-10.5-03). Phase 6's CI gate has been retired.

## Anti-features (explicit)

- ❌ Cloud-side data storage of any kind (registry, auth, project files all stay local)
- ❌ Hard dependency on Sentry, Linear, Infisical, or any third-party service
- ❌ Native dependencies that complicate `npx` install (no Keychain, no FFI)
- ❌ External sharing / team collaboration
- ❌ Real-time multiplayer presence
- ❌ Embedded chat with Claude (chat lives in the terminal)
- ❌ "Trigger this skill" buttons (read-only safety boundary on project files)
- ❌ Storing project history beyond what's already in `.git` and `.planning/`
- ❌ Time tracking, billing, productivity surveillance
- ❌ Pulling in npm packages I haven't audited (lock the dependency list early, review every addition)
- ❌ Cloudflare Workers / Pages Functions in v1 (keep the SPA pure-static)
- ❌ Auto-update of the daemon (user explicitly runs `npx @agenticapps/dashboard-agent@latest` to upgrade)

---

## When this prompt is handed to a Claude Code session

1. Emit the workflow commitment ritual immediately.
2. Run `/gsd-discuss-phase 0` and surface the open questions above to the user.
3. Run `/gsd-plan-phase 0` to plan the bootstrap phase.
4. Run `/gsd-execute-phase 0` with TDD enforcement (yes, even bootstrap — the GitHub Actions and pnpm workspace config benefit from being arrived at deliberately).
5. Two-stage review on the bootstrap PR.
6. Verify acceptance for phase 0 (Cloudflare Pages preview deploy works, npm placeholder published) before phase 1.
7. Repeat per phase. Don't ship anything that doesn't have evidence in `VERIFICATION.md`.

Phases 0–6 ship a complete, useful dashboard. Phase 7 (Sentry, Linear, Infisical) is explicitly held until Donald is ready for those.

---

## Cross-references

- See `tooling-research-2026-05-02.md` for the full 32-item research.
- See `tooling-action-plan-2026-05-02.md` for the surrounding integration plan (impeccable, database-sentinel, Sentry stack, eval rig, session search, the meta-observer skill that produces the JSONL the dashboard reads).
