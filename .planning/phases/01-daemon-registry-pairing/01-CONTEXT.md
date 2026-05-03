# Phase 1: Daemon + Registry + Pairing - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

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
- `/api/projects/{id}/agentlinter`, `/api/projects/{id}/observations/recent`, `/api/projects/{id}/integrations`, `/api/projects/{id}/skills/local`, `/api/skills/global`, `POST /api/projects/{id}/open` — Phases 3–5 (each delivered with the consuming panel).
- `install-launchd` / `install-systemd` / `--detach` / pidfile-based supervision — Phase 6.
- chokidar-based file watching of registry.json or auth.json — deferred (re-read per request in Phase 1).
- Custom domain `dashboard.agenticapps.eu` flip — Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Daemon lifecycle & CLI UX

- **D-01:** `~/.agenticapps/dashboard/` is initialized **lazily on any subcommand**. Any CLI invocation (including `status`, `list`, `register`) ensures the dir exists with mode `0700`, creates an empty `registry.json` (mode `0600`) and an `auth.json` with a fresh token (mode `0600`) if missing. If existing files have looser permissions, daemon **refuses to start** with the spec's exact remediation message ("auth.json has insecure permissions (mode 644); fix with `chmod 600 ~/.agenticapps/dashboard/auth.json` or run `agentic-dashboard rotate-token` to regenerate.").
- **D-02:** Foreground daemon logs to **stdout/stderr only**. No file mirror in Phase 1. LaunchAgent / systemd installers (Phase 6) handle file redirection via the plist/unit. Banner format matches the spec example verbatim (Daemon starting, Registry, Listening on, Token, Pair this device, manual pair, Press Ctrl-C). Log lines use a simple `[agent] …` prefix; no JSON, no levels.
- **D-03:** `start` with **empty registry boots happily** and prints the pair URL anyway. Banner says "Registry: 0 projects". `/api/registry` returns `[]`. Pairing still works; registration follows.
- **D-04:** `list` and `status` default output is a **pretty table**, with `--json` flag for scripting. Both formats go through a Zod schema (re-export `RegistryListResponse`, `StatusResponse` from `packages/shared/src/schemas/`). `status` reports: daemon reachable (yes/no), uptime, bound address, registered project count, paired-since timestamp, and current token age (no token value).
- **D-05:** `agentic-dashboard stop` shuts down via two paths: (1) primary — read token from `auth.json`, `POST /api/admin/shutdown` to the bound URL, daemon completes in-flight requests then exits gracefully; (2) fallback — read pidfile and send `SIGTERM`. Hard `SIGKILL` only if `--force` is passed (defer to Phase 6 if not trivial). `/api/admin/shutdown` is bearer-token gated like every other route.
- **D-06:** Schema-validation errors are **NODE_ENV-gated** (Q4 from spec). `NODE_ENV=development` → 422 body includes Zod's flattened issue tree (`{ ok: false, error: 'invalid_request', issues: [{ path, message }, …], requestId }`). `NODE_ENV=production` (or unset) → 422 body is `{ ok: false, error: 'invalid_request', requestId }`. Daemon **always** logs the full Zod error server-side with the requestId, regardless of NODE_ENV.
- **D-07:** Pidfile is **always written** at `~/.agenticapps/dashboard/agent.pid` (mode `0600`) on `start`, removed on graceful shutdown. Stale pidfile detection: on `start`, if pidfile exists and the pid is alive, refuse with "Daemon already running (pid N). Run `agentic-dashboard stop` or `kill N`."

### Registry CRUD & `register --auto`

- **D-08:** `register --auto <parent-dir>` marker definition: **either** `<parent>/<child>/.claude/skills/agentic-apps-workflow/SKILL.md` exists (project-local install) **or** `<parent>/<child>/.planning/config.json` exists. Match on either is sufficient. (Spec OR-language; broader matching helps mid-migration projects.)
- **D-09:** `register --auto` confirmation flow: **per-match Y/n inline** (Q7 from spec). Walk matches one at a time with `[client] (matched: .planning/, agentic-apps-workflow skill) — register? [Y/n]`. Flags: `--yes` accepts every match silently; `--dry-run` prints the matches without registering anything. Return code: 0 even when nothing was registered.
- **D-10:** Path-collision handling on `register` (any variant): **skip with notice, exit 0** if the resolved path is already registered ("/Users/donald/Sourcecode/acme-app already registered as id `acme-app`, skipping"). Slug collisions where the dirname matches but the path differs get a `-2`/`-3` suffix per spec. `register` is idempotent so `--auto` re-runs cleanly.
- **D-11:** `register --auto` scan depth is **direct children only (depth=1)**. `register --auto ~/Sourcecode` checks `~/Sourcecode/*/`, not deeper. Predictable, fast, matches Donald's flat layout. No `--max-depth` flag in v1.
- **D-12:** **No auto-tagging** in v1. `register` and `register --auto` write entries with empty `tags`. Tags are set explicitly via `agentic-dashboard tag <id> <tag>...`. Avoids embedding personal folder conventions into the tool.

### Token + rotation + re-pair UX

- **D-13:** Token format: **32 random bytes (256 bits) hex-encoded, chunked into 8 dash-separated 8-char groups**. `crypto.randomBytes(32).toString('hex').match(/.{1,8}/g).join('-')`. 71 chars total. Visually matches spec example; double-click selects the whole token in most terminals.
- **D-14:** Token rotation triggers (Q-spec confirmed): (a) explicit `agentic-dashboard rotate-token`; (b) auto on first `start` after the `agentVersion` field in `auth.json` differs from the current binary's version; (c) auto when `(now - rotatedAt) > 30 days`. Configurable interval is **deferred** — no `env.json` key in Phase 1. SPA Phase 2 will surface the resulting 401 as a re-pair prompt.
- **D-15:** Mid-rotation race-window behavior: **in-flight requests complete with the old token; new requests with the old token return 401**. The Bearer-token middleware reads from an in-memory `activeToken` ref captured atomically at request entry. `rotate-token` writes `auth.json` first, then flips the in-memory ref.
- **D-16:** **Daemon-side schema-drift defense** (INV-04): every response goes through `Schema.parse()` before send; on parse failure, daemon returns 500 with `{ ok: false, error: 'schema_drift', requestId }` and logs the full Zod error. SPA-side drift detection (rendering "Schema drift detected") is Phase 2's job. Phase 1 just guarantees the contract from the daemon's side.

### Networking & `--bind` modes

- **D-17:** `--bind tailscale` when `tailscale ip -4` errors or returns no IP: **refuse to start** with the explicit remediation `Tailscale not detected. Install from https://tailscale.com or use --bind 127.0.0.1.` Exit code 1. Silent fallback would surprise users who explicitly opted into Tailscale binding.
- **D-18:** Client-IP CIDR enforcement (`100.64.0.0/10`) is **ON by default** when bound to Tailscale or `0.0.0.0`. `--no-enforce-cidr` disables it for users with non-Tailscale-CIDR access needs. Loopback bind (`127.0.0.1`) doesn't apply CIDR (would reject all real IPs). Rejected requests get 403 (not 401 — auth was valid, network policy was the problem).
- **D-19:** Pair URL hostname when `--bind tailscale` succeeds: **MagicDNS hostname** from `tailscale status --json` (e.g. `devbox.tail-xxx.ts.net`); fall back to raw `100.x.y.z` IP if MagicDNS isn't configured. Hostname survives tailnet IP rotation.
- **D-20:** `--bind 0.0.0.0` prints a yellow startup banner: `WARNING: bound to 0.0.0.0 — only safe on Tailscale-isolated machines. CIDR enforcement is ON.` Combined with D-18, this means a misconfigured bind doesn't actually expose the daemon to the open LAN; clients outside `100.64.0.0/10` get 403.

### Cross-cutting

- **D-21:** Production SPA origin (CORS allow-list and pair URL host): hardcode **`https://agenticapps-dashboard.pages.dev`** for v1. Custom domain `dashboard.agenticapps.eu` flip is a Phase 6 one-line change in `packages/agent/src/constants.ts`. Dev origin stays `http://localhost:5174`.
- **D-22:** **No chokidar** in Phase 1. Daemon re-reads `registry.json` on each registry-touching request (no caching of the registry list itself; per-project status caches 5s per spec). CLI mutations (register/unregister/rename/tag) write the file directly while daemon is running; daemon picks up changes on the next request. chokidar usage is deferred to a later phase if a measurable need surfaces.
- **D-23:** Path allow-list (API-02) uses **`fs.realpath()`** on the resolved path and rejects if the realpath escapes one of the allowed roots. Defends against planted symlinks under `.planning/` or `.claude/` that point outside (e.g. `.planning/secret → ../../etc/passwd`). Defense-in-depth — spec language explicitly requires this ("realpaths outside the allow-list").

### Claude's Discretion

- Exact Hono middleware ordering (logger → cors → bearerAuth → routes → errorHandler is the obvious shape).
- Internal module layout under `packages/agent/src/` (suggested: `cli/`, `server/`, `routes/`, `lib/auth.ts`, `lib/registry.ts`, `lib/paths.ts`, `lib/logging.ts`).
- Colorization library for the banner (kleur vs picocolors — both are zero-dep, pick the lighter).
- Test layout: vitest for unit tests; Hono's `app.fetch(req)` for in-process route tests vs spawning the CLI as a subprocess for the four end-to-end CLI tests (boot, rotate-token, refuse-loose-perms, register-then-list).
- Port-conflict handling on `start` (clear `EADDRINUSE` message with the offending pid via `lsof`/`netstat`, then exit 1).
- Whether to expose `--port` and `--bind <host>` as commander flags or only via env (`AGENTIC_DASHBOARD_PORT`, `AGENTIC_DASHBOARD_BIND`) — recommend flags, with env fallbacks.
- Exact log message wording where not pinned by the spec.

### Folded Todos

None — no pending todos matched Phase 1 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec (binding)
- `docs/spec/dashboard-prompt.md` §"CLI surface" (lines 100–125) — every CLI command's exact name and one-line behavior.
- `docs/spec/dashboard-prompt.md` §"Registry" (lines 127–164) — registry.json schema, ID generation rules, per-project status fields, unreachable-root behavior.
- `docs/spec/dashboard-prompt.md` §"Auth (no secrets manager required)" (lines 168–198) — auth.json schema, rotation triggers, permissions-check remediation message.
- `docs/spec/dashboard-prompt.md` §"Pairing flow" (lines 200–222) — startup banner format (used verbatim).
- `docs/spec/dashboard-prompt.md` §"Tailscale / remote use case" (lines 224–240) — `--bind tailscale`, CIDR enforcement language, pair URL hostname rules.
- `docs/spec/dashboard-prompt.md` §"API surface (Hono routes)" (lines 290–352) — every Phase-1-relevant route signature and 422-on-allow-list-violation contract.
- `docs/spec/dashboard-prompt.md` §"Path allow-list (per project)" (lines 371–384) — code-level shape of the allow-list check.
- `docs/spec/dashboard-prompt.md` §"Acceptance criteria" items 1, 6, 7, 8, 11, 12 (lines 580, 585–587, 590–591) — Phase-1-relevant acceptance gates.
- `docs/spec/dashboard-prompt.md` §"Implementation phasing" Phase 1 bullet (lines 611–616) — the 5 sub-deliverables and the 4 mandated TDD cases.
- `docs/spec/dashboard-prompt.md` §"Open questions" Q4, Q7, Q8 (lines 673–682) — pre-recommended decisions that this CONTEXT confirmed.
- `docs/spec/dashboard-prompt.md` §"Constraints I want preserved" + §"Anti-features" (lines 686–712) — hard architectural invariants (read-only on project FS, 0600 confinement, bearer auth, CORS lock, no native deps).

### Project-level planning artifacts
- `.planning/PROJECT.md` — vision, hard constraints (tech stack locks for SPA + daemon), key decisions table.
- `.planning/REQUIREMENTS.md` — REQ-IDs in scope: BOOT-01..05 validated; DAEMON-01..06, AUTH-01..05, REG-01..05, API-01..03 active; INV-02 (lands here), INV-04, INV-05.
- `.planning/ROADMAP.md` — Phase 1 success criteria 1–5, depends-on Phase 0.
- `.planning/phases/00-bootstrap/00-CONTEXT.md` — Phase 0 decisions still in force: D-04 (pnpm catalog), D-05 (Node 20 LTS), D-06 (HealthResponseSchema is the cross-package contract proof), D-07 (commander stub already wires `--version`/`start`), D-10 (CI gates), D-15 (workflow commitment ritual mandatory), D-16 (no native deps).
- `CLAUDE.md` — repo state, target architecture, hard architectural constraints (every "must survive every refactor" bullet applies).
- Global `~/.claude/CLAUDE.md` — AgenticApps workflow hooks (per-plan TDD, post-phase `/review`+`/cso`+`/qa`).

### Workflow contract
- `.claude/skills/agenticapps-workflow/skill/SKILL.md` — commitment ritual format, gate-to-skill map, rationalization table, 13 red flags.

### External docs (Hono + Tailscale + Node specifics)
- Hono routing + middleware: https://hono.dev/docs/api/routing — request/response handling, validators, error handling middleware.
- Hono Zod validator pattern: https://hono.dev/docs/guides/validation#zod-validator — preferred shape for request-body validation.
- Tailscale CLI status command: `tailscale status --json` (machine-readable; check `Self.DNSName` for MagicDNS hostname).
- Tailscale CGNAT range: `100.64.0.0/10` (IPv4); IPv6 is `fd7a:115c:a1e0::/48` — out of scope for Phase 1 (CIDR check is IPv4-only).
- Node `fs.realpath` semantics: https://nodejs.org/api/fs.html#fsrealpathpath-options-callback — symlink resolution for path allow-list.
- Node `crypto.randomBytes`: https://nodejs.org/api/crypto.html#cryptorandombytessize-callback — token entropy source.
- Hono testing helpers: https://hono.dev/docs/guides/testing — `app.fetch(req)` pattern for in-process route tests.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/shared/src/schemas/health.ts` — `HealthResponseSchema = { ok: boolean, version: string, message?: string }`. Phase 1's `GET /health` must return a payload matching this schema (extended with `daemonVersion`, `registryCount`, `paired` per spec API §"Daemon-level"). Recommend: rename the existing field set to `HealthResponseSchemaV0` (Phase 0 placeholder) and ship a richer `HealthResponseSchemaV1` in this phase, or extend in place — planner decides.
- `packages/agent/src/cli.ts` — existing commander stub already wires `--version`/`--version --json`/`start`. Phase 1 replaces the placeholder `start` action with the real Hono boot sequence and adds the new commands.
- `packages/agent/src/version.ts` — re-exports `AGENT_VERSION` from package.json; reusable as the source of truth for `auth.json.agentVersion` and the `daemonVersion` field on `/health`.
- `tsup` build config (Phase 0) — already produces a single ESM bundle at `dist/cli.js`; new files under `packages/agent/src/` get bundled automatically.
- `packages/agent/src/cli.test.ts`, `packages/agent/src/index.test.ts` — existing subprocess-style CLI tests show the spawn-and-assert pattern that the four mandated TDD cases (boot, rotate-token, CORS reject, allow-list reject, perms reject) should follow.

### Established Patterns
- **ESM-only**: agent package is `"type": "module"`, no CJS interop. Phase 1 code must use ESM imports throughout (no `require`).
- **Zod-first schemas**: every wire shape lives in `packages/shared/src/schemas/<name>.ts` and is exported from `packages/shared/src/index.ts`. Phase 1 will add `auth.ts`, `registry.ts`, `read.ts`, `git.ts`, `errors.ts` (or similar).
- **Cross-package validation**: SPA + daemon both `parse()` against the same schema (Phase 0 D-06). Daemon-side outbound parse before send (D-16) is the new addition.
- **Vitest unit + subprocess**: unit tests exercise pure functions; subprocess tests verify CLI behavior end-to-end. Mix of both is the established convention.
- **`engines.node >= 20`**: every `Node:*` API used must be Node 20 LTS available; no Node 22-only features.
- **Strict TypeScript**: `noImplicitAny`, `strictNullChecks`, etc. all on per Phase 0 D-03.

### Integration Points
- `packages/shared/src/schemas/` — new schemas land here, exported from `packages/shared/src/index.ts`.
- `packages/agent/src/cli.ts` — existing commander entry; new commands plug into the same `program.command(…)` chain.
- `packages/agent/src/server/` (new) — Hono app, middleware, route mounts.
- `packages/agent/src/lib/` (new) — auth, registry, paths, logging utilities. Pure-function-friendly, easy to test.
- `~/.agenticapps/dashboard/` — mutable state directory. Daemon owns it; CLI commands and daemon agree on the format.
- CI workflow `.github/workflows/ci.yml` — already runs lint+typecheck+test+build. New tests will be picked up automatically; no CI changes needed for Phase 1.
- `release.yml` — when Phase 1 ships, agent version bumps to `0.1.0-alpha.0` (or `0.0.1-alpha.4` if Donald wants to preserve the alpha sequence). Release-workflow change is deferred until Phase 1 is ready to publish.

</code_context>

<specifics>
## Specific Ideas

- Pair URL printed at startup matches spec banner verbatim (lines 207–219) — including the "Or pair manually at https://agenticapps-dashboard.pages.dev/settings:" hint and the "Press Ctrl-C to stop, or `agentic-dashboard install-launchd` to run as a service." closer (the install-launchd hint stays even though that command lands in Phase 6, because it tells users where the migration path goes).
- The four mandated TDD cases from spec line 616 are non-negotiable: token-rotation invalidates old token, CORS rejects wrong origin, path allow-list rejects `..`, permissions check refuses `0644`. These each become a named test file in `packages/agent/src/server/__tests__/` so they're easy to find and re-run.
- `register --auto` per-match prompt should print the matched markers in the prompt so user knows *why* something matched (not just the path). E.g. `acme-app  matched: .planning/, agentic-apps-workflow/SKILL.md  — register? [Y/n]`.
- Error response shape is a single Zod schema (`ErrorResponseSchema = { ok: false, error: string, issues?: Issue[], requestId: string }`) used by every error path — 401, 403, 422, 500, schema_drift. Prevents drift between handlers.
- `requestId` is a per-request UUID generated in middleware, attached to logs and to every error response. Lets users grep daemon logs by ID when something fails.

</specifics>

<deferred>
## Deferred Ideas

### From spec open questions still pending
- **Q5 Meta-observer skill packaging** — Phase 4 (left column needs the JSONL it produces). Spec recommends separate skill repo; document JSONL schema in `packages/shared/src/schemas/observation.ts` when it lands.
- **Q1 Repo visibility flip + Q2 LICENSE** — Phase 8 (open-source readiness). Provenance (`--provenance` in release.yml) reactivates as a one-PR revert when this lands.
- **Q3 CF Access policy on production domain** — Phase 6 (POLISH).
- **Q6 AgentLinter integration** — Phase 5 (HEALTH-02).

### Phase-1-adjacent items intentionally not covered here
- **chokidar-based registry/auth watching** — D-22 defers to a later phase if a measurable need surfaces (e.g. multiple daemons on same machine, or sub-second registry update visibility).
- **`--detach` flag and pidfile-based supervision beyond stop fallback** — Phase 6 (`install-launchd` / `install-systemd`).
- **`POST /api/projects/{id}/open` (spawning $EDITOR)** — Phase 4 (single-project view button calls it).
- **`/api/projects/{id}/overview`, `/agentlinter`, `/observations/recent`, `/integrations`, `/skills/local`, `/api/skills/global`** — each delivered with its consuming panel in Phases 3–5.
- **IPv6 Tailscale CIDR (fd7a:115c:a1e0::/48)** — IPv4-only check in Phase 1; revisit if Donald moves to IPv6-first networking.
- **`--port` / `--bind` env-var fallbacks** — flag-only in Phase 1; env-var fallbacks deferred unless a use case shows up (Infisical-aware env loading is Phase 7c).
- **Token revocation list / multi-token pairing** — Single-active-token model is sufficient for v1; multi-device pairing is a Phase 7+ idea if it ever matters.
- **Custom domain `dashboard.agenticapps.eu` flip** — Phase 6 one-line constants change.
- **Full schema-drift UX (SPA-side rendering)** — Phase 2.

### Reviewed Todos (not folded)
None — no pending todos surfaced in cross-reference.

</deferred>

---

*Phase: 01-daemon-registry-pairing*
*Context gathered: 2026-05-03*
