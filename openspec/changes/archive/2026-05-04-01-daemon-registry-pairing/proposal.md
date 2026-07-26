# Phase 1: Daemon + Registry + Pairing -

**Archived from GSD phase `01-daemon-registry-pairing`. Completed 2026-05-04.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/01-daemon-registry-pairing/` — that tree, not this file, is the authoritative record.

## Why

A working `agentic-dashboard` CLI/daemon that:
- Boots a Hono server on `127.0.0.1:5193` (default), Tailscale, or `0.0.0.0` (banner-warned).
- Manages a JSON registry of projects under `~/.agenticapps/dashboard/registry.json` (mode `0600`) via CLI: `register`, `register --auto`, `unregister`, `list`, `rename`, `tag`.
- Authenticates every route with a bearer token stored in `~/.agenticapps/dashboard/auth.json` (mode `0600`); supports manual rotate, version-upgrade auto-rotate, and 30-day uptime auto-rotate.
- Prints a one-click pair URL on startup and supports manual pair via `/settings`.
- Enforces CORS to two known origins (prod SPA + dev SPA).
- Exposes Phase-1 routes: `GET /health`, `GET /api/projects/{id}/read?path=…` (path allow-listed), `GET /api/projects/{id}/git?cmd=…` (subcommand allow-listed), plus the registry CRUD endpoints (`/api/registry`, `/api/registry/register`, `/api/registry/unregister`, `/api/auth/rotate`).

**In scope (Phase 1):** DAEMON-01..06, AUTH-01..05, REG-01..05, API-01, API-02, API-03, INV-02, INV-05.

**Out of scope (later phases):**
- SPA shell, /pair flow, /onboarding, /settings — Phase 2.
- `/api/projects/{id}/overview`, multi-project home — Phase 3.
- `/api/projects/{id}/agentlinter`, `/api/projects/{id}/observations/recent`, `/api/projects/{id}/integrations`, `/api/projects/{id}/skills/local`, `/api/skills/global`, `POST /api/projects/{id}/op

## Capabilities affected

- `openspec/specs/daemon-runtime/spec.md`
- `openspec/specs/project-registry/spec.md`
- `openspec/specs/auth-and-pairing/spec.md`
- `openspec/specs/filesystem-access-policy/spec.md`

## What shipped

**01-01**

**zod catalog bumped ^3.25.0, hono/execa/picocolors runtime deps installed in packages/agent, and 6 Zod schemas (auth, registry, read, git, errors, server) created in packages/shared as the type contract for all Wave 1+ implementations**

**01-02**

All 7 lib modules plus the test fixture. Detailed breakdown:

### 1. `packages/agent/src/constants.ts`

Exports: `PROD_ORIGIN`, `DEV_ORIGIN`, `DEFAULT_HOST`, `DEFAULT_PORT`, `CONFIG_DIR`, `AUTH_FILE`, `REGISTRY_FILE`, `PIDFILE`, `SERVER_FILE`, `TAILSCALE_CIDR_BASE`, `TAILSCALE_CIDR_PREFIX`, `TOKEN_ROTATION_DAYS`, `GIT_ALLOWED_CMDS`, `GitAllowedCmd`.

Key: `PROD_ORIGIN = 'https://agenticapps-dashboard.pages.dev'` per D-21. Custom domain flip is a one-line change for Phase 6.

### 2. `packages/agent/src/lib/paths.ts`

Exports: `resolveAllowed`, `PathViolation`, `ALLOWED_SUBDIRS`.

Defends agains

**01-03**

Hono server factory with 7-layer middleware chain (logger → requestId → cors → bearerAuth → optional CIDR → routes → errorHandler), all 6 Phase-1 routes, and 4 spec-mandated TDD test suites — 102 tests green, typecheck clean.

**01-04**

### 10 CLI Commands

All commands are dispatched via lazy dynamic import in `cli.ts`.

| Command | Handler | Key Behavior |
|---------|---------|--------------|
| `start` | `cli/start.ts:runStart` | assertSecurePermissions → ensureAuthFile → shouldAutoRotate → assertNoStaleDaemon → bootDaemon; --bind tailscale stub for Plan 05 |
| `stop` | `cli/stop.ts:runStop` | Primary: POST /api/admin/shutdown with bearer (D-05); Fallback: SIGTERM via pidfile |
| `status` | `cli/status.ts:runStatus` | Pretty table + --json via StatusResponseSchema (D-04) |
| `register` | `cli/register.ts:runRegister` | Dire

**01-05**

### tailscale.ts Library

| Export | Behavior |
|--------|----------|
| `TailscaleNotDetectedError` | Error class with spec-verbatim D-17 message |
| `getTailscaleIP()` | Calls `tailscale ip -4` via execa; throws `TailscaleNotDetectedError` on ENOENT, non-zero exit, or empty stdout; 5s timeout (T-01-05-05) |
| `getTailscaleHostname(fallbackIp)` | Calls `tailscale status --json`; strips trailing dot from `Self.DNSName` per RESEARCH key finding 5 (Pitfall 5); falls back to `fallbackIp` on any failure (D-19); 5s timeout |

**D-17 exact message** (spec-verbatim, verified by string-equality test):

## Gates recorded

- verification — `01-VERIFICATION.md`
- code review — `01-REVIEW.md`
- human UAT — `01-HUMAN-UAT.md`
- validation — `01-VALIDATION.md`
