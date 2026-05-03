# Phase 1: Daemon + Registry + Pairing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 01-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 01-daemon-registry-pairing
**Areas discussed:** Daemon lifecycle & CLI UX, register --auto discovery flow, Token + rotation + re-pair UX, --bind tailscale & networking, Cross-cutting (prod URL, registry reload, symlinks)

---

## Daemon lifecycle & CLI UX

### Init timing — when does ~/.agenticapps/dashboard/ get created?

| Option | Description | Selected |
|--------|-------------|----------|
| Lazy on any subcommand | First `register`/`start`/`status`/anything ensures dir+files exist with correct perms; refuses if existing perms loose | ✓ |
| Only on `start` (and `register` first) | Other commands print "run register first"; refuses elsewhere | |
| Explicit `init` command | User must run `init` before anything | |

**Notes:** Matches the spec's "three commands" install promise.

### Log destination during foreground start

| Option | Description | Selected |
|--------|-------------|----------|
| stdout/stderr only | LaunchAgent/systemd handle file redirection in Phase 6 | ✓ |
| stdout + ~/.agenticapps/dashboard/logs/agent.log mirror | Always tee to file with simple rotation | |
| Pretty in TTY, JSON when piped | Detect process.stdout.isTTY | |

### Behavior on `start` with empty registry

| Option | Description | Selected |
|--------|-------------|----------|
| Boot happily and print pair URL | Registry: 0 projects banner; /api/registry returns []; pairing still works | ✓ |
| Refuse to start, print hint | Forces a `register` first | |
| Boot but suppress pair URL | Daemon runs but no pair URL until ≥1 project | |

### Default output format for `list` and `status`

| Option | Description | Selected |
|--------|-------------|----------|
| Pretty table default + --json flag | gh/docker convention; JSON via Zod schema | ✓ |
| JSON default + --pretty for table | Optimizes for scripting | |
| Both always (table on stdout, JSON to fd 3) | Over-engineered for v1 | |

### Stop mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| HTTP /api/admin/shutdown (token-authed) + pidfile fallback | Primary HTTP, fallback SIGTERM via pidfile | ✓ |
| Pidfile only (SIGTERM) | No cross-host stop, but unimportant for v1 | |
| HTTP only | No fallback; user uses `kill` if hung | |

### Schema validation error verbosity (Q4)

| Option | Description | Selected |
|--------|-------------|----------|
| Gate by NODE_ENV | Verbose dev (Zod issue tree) / vague prod / always full server-side log | ✓ |
| Always verbose | Local daemon, no real attack surface for error oracles | |
| Always vague + always log full | Forces reading daemon logs to diagnose | |

### Pidfile in foreground mode

| Option | Description | Selected |
|--------|-------------|----------|
| Always write pidfile | ~/.agenticapps/dashboard/agent.pid 0600; enables stop fallback + stale detection | ✓ |
| Only with --detach (defer to Phase 6) | Foreground daemon trusts terminal | |

---

## register --auto discovery flow

### Marker definition

| Option | Description | Selected |
|--------|-------------|----------|
| Either marker matches | OR of `.claude/skills/agentic-apps-workflow/SKILL.md` and `.planning/config.json` | ✓ |
| Both must match | Stricter; misses partially-set-up projects | |
| Just `.planning/` exists | Simplest but matches non-AgenticApps repos | |

### User confirmation flow (Q7)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-match prompt (Y/n) inline | --yes auto-accepts all; --dry-run prints without registering | ✓ |
| Scan, list all, single confirm | Faster but riskier | |
| Always interactive picker (multiselect) | Adds prompt dep beyond commander | |

### Path-collision handling

| Option | Description | Selected |
|--------|-------------|----------|
| Skip with notice, exit 0 | Idempotent re-runs; slug collisions get -2/-3 suffix | ✓ |
| Refuse, exit 1 | Hard error; bad for `register --auto` re-scans | |
| Replace existing entry | Silent mutation; not auditable | |

### Scan depth

| Option | Description | Selected |
|--------|-------------|----------|
| Direct children only (depth=1) | Predictable, fast, matches Donald's flat layout | ✓ |
| Configurable --max-depth N (default 1) | Same default + opt-in flag | |
| Recursive until first match per branch | Surprising on huge trees with node_modules symlinks | |

### Auto-tagging

| Option | Description | Selected |
|--------|-------------|----------|
| No auto-tagging in v1 | Tags explicit via `tag` command | ✓ |
| Infer from parent dir name | Embeds Donald's folder convention | |
| Prompt for tags per match | More friction in bulk-scan flow | |

---

## Token + rotation + re-pair UX

### Token format

| Option | Description | Selected |
|--------|-------------|----------|
| 32-byte random, hex with dash groups | 256 bits, 71 chars, matches spec example | ✓ |
| UUIDv4 (string) | 122 bits, 36 chars | |
| 32-byte random, base64url no padding | ~43 chars; base64 chars don't survive shells cleanly | |

### Auto-rotation policy

| Option | Description | Selected |
|--------|-------------|----------|
| 30-day uptime + version-upgrade + manual | Three triggers per spec | ✓ |
| Manual + version-upgrade only | Drop time-based rotation; revisit if shared-device emerges | |
| Configurable interval, default 30 days | Adds env.json key with no caller in v1 | |

### Mid-rotation race-window behavior

| Option | Description | Selected |
|--------|-------------|----------|
| In-flight complete with old token; new requests with old → 401 | In-memory active-token ref captured atomically at request entry | ✓ |
| Re-read auth.json on every request | Trivially correct but adds disk IO per request | |
| Reject in-flight + new old-token requests immediately | Cleaner semantics but breaks SPA mid-fetch | |

### Schema-drift defense (INV-04, daemon side)

| Option | Description | Selected |
|--------|-------------|----------|
| Daemon refuses to send malformed responses | Schema.parse() before send; 500 + schema_drift error on failure; SPA-side detection is Phase 2 | ✓ |
| Best-effort — log and send anyway | Lighter daemon overhead, ships broken responses | |
| Strict in dev, log-only in prod | Risk: prod daemon drifts silently | |

---

## --bind tailscale & networking

### Tailscale CLI missing behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse to start with explicit remediation | Exit 1 with install link or fall-back-flag hint | ✓ |
| Warn, fall back to 127.0.0.1 | Convenient for portable LaunchAgent plists | |
| Silent fallback to 127.0.0.1 | Risky — user thinks remote-accessible but isn't | |

### CIDR enforcement default (when bound to Tailscale or 0.0.0.0)

| Option | Description | Selected |
|--------|-------------|----------|
| ON by default with --no-enforce-cidr opt-out | Defense-in-depth | ✓ |
| OFF by default with --enforce-cidr opt-in | Bearer auth already required; CIDR redundant for most | |
| Always ON, no opt-out | Smallest config surface | |

### Pair URL hostname when bound to Tailscale

| Option | Description | Selected |
|--------|-------------|----------|
| MagicDNS hostname when available, IP otherwise | tailscale status --json → Self.DNSName | ✓ |
| Always raw IP | Simpler but URL changes if tailnet rotates IPs | |
| Both — hostname primary, IP fallback | Visually noisier; risk of pasting wrong one | |

### `--bind 0.0.0.0` policy

| Option | Description | Selected |
|--------|-------------|----------|
| Banner warning + CIDR enforcement (100.64.0.0/10) | Misconfigured bind doesn't actually expose to LAN | ✓ |
| Banner only, no CIDR enforcement on 0.0.0.0 | Trust user's stated intent | |
| Refuse unless --i-know-what-im-doing | Most paranoid; spec didn't ask for it | |

---

## Cross-cutting

### Production SPA origin

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcode `agenticapps-dashboard.pages.dev` for v1, document Phase 6 swap | Match Phase 0 deferred-domain reality | ✓ |
| Hardcode `dashboard.agenticapps.eu` per spec | Pair URLs fail until custom domain ships | |
| Configurable via env var | No caller in v1 | |

### Registry hot-reload

| Option | Description | Selected |
|--------|-------------|----------|
| Re-read per request, no chokidar in Phase 1 | Simpler; CLI mutations picked up next request | ✓ |
| chokidar watcher with 5s debounce | Adds watcher lifecycle | |
| Read once at start, mutate via API only | Bigger architectural commitment | |

### Path allow-list symlink strictness

| Option | Description | Selected |
|--------|-------------|----------|
| fs.realpath() the resolved path; reject if escapes allow-list | Defends against planted symlinks | ✓ |
| Lexical check only (path.resolve) | Faster, but planted symlink can escape | |

---

## Claude's Discretion

- Hono middleware ordering (logger → cors → bearerAuth → routes → errorHandler).
- Internal module layout under `packages/agent/src/`.
- Colorization library for the banner (kleur vs picocolors).
- Test layout: vitest unit + Hono `app.fetch(req)` for in-process route tests.
- Port-conflict handling on `start` (`EADDRINUSE` clear message + offending pid).
- Whether `--port` and `--bind <host>` are commander flags or env vars (recommend flags with env fallbacks).
- Exact log message wording where not pinned by spec.

## Deferred Ideas

- chokidar-based watching (defer until measurable need)
- `--detach` flag → Phase 6
- `POST /api/projects/{id}/open` → Phase 4
- `/api/projects/{id}/overview`, `/agentlinter`, `/observations/recent`, `/integrations`, `/skills/local`, `/api/skills/global` → Phases 3–5
- IPv6 Tailscale CIDR → revisit later
- Env-var fallbacks for --port/--bind → Phase 7c (Infisical-aware)
- Multi-token pairing → Phase 7+
- Custom domain flip → Phase 6
- SPA-side schema-drift UX → Phase 2
