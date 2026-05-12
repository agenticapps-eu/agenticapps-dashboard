---
phase: 01-daemon-registry-pairing
verified: 2026-05-03T14:15:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
deferred:
  - truth: "AUTH-05 pair URL flow stores {agentUrl, token} in SPA localStorage and redirects to /"
    addressed_in: "Phase 2"
    evidence: "Phase 2 goal: 'completes pairing via /pair?agent=...&token=..., stores credentials in localStorage'; SPA-02 success criterion: 'Clicking the printed pair URL completes pairing without manual input; the SPA lands on /'"
human_verification:
  - test: "Live --bind tailscale positive path"
    expected: "agentic-dashboard start --bind tailscale boots, pair URL contains MagicDNS hostname with trailing dot stripped, curl from a second Tailscale device returns 200"
    why_human: "Requires a real Tailscale daemon running on host; dev machine has no tailscale binary. The absent-Tailscale path (D-17 degradation) is automated in bind-modes.subprocess.test.ts. The positive path is permanently manual per VALIDATION.md."
  - test: "D-20 yellow warning banner color is rendered correctly in terminal"
    expected: "Running agentic-dashboard start --bind 0.0.0.0 in a real TTY (iTerm/Terminal.app) shows the WARNING line in yellow ANSI color"
    why_human: "Color rendering depends on terminal capabilities; automated test only checks string content, not ANSI escape codes rendering"
---

# Phase 1: Daemon + Registry + Pairing Verification Report

**Phase Goal:** A working `agentic-dashboard` CLI/daemon that registers projects, serves a token-authed Hono API on `127.0.0.1:5193` with CORS lock, enforces path allow-lists, and prints a one-click pair URL.
**Verified:** 2026-05-03T14:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth                                                                                                                                         | Status     | Evidence                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `register <path>` → `start` boots daemon, prints pair URL, `/health` with bearer returns `{ ok: true }`                                      | ✓ VERIFIED | `end-to-end.subprocess.test.ts` covers full sequence; 160/160 tests pass; `health.ts` returns `HealthResponseSchema` with `ok: true`, `daemonVersion`, `registryCount`, `paired` |
| 2   | `rotate-token` invalidates prior token immediately; old bearer returns 401                                                                    | ✓ VERIFIED | `token-rotation-invalidates-old-token (mandatory TDD)` test in `server/__tests__/auth.test.ts`; D-15 write-then-flip in `lib/auth.ts:140`; e2e test verifies 401 on old token  |
| 3   | `GET /api/projects/{id}/read?path=../../etc/passwd` returns 422                                                                               | ✓ VERIFIED | `path-allow-list-rejects-traversal (mandatory TDD)` test; `resolveAllowed` pre-checks `..` components; `errorHandler` maps `PathViolation` → 422 `path_not_allowed`           |
| 4   | Daemon refuses to start when `~/.agenticapps/dashboard/auth.json` is `0644`, with clear remediation message                                  | ✓ VERIFIED | `permissions-check-refuses-0644 (mandatory TDD)` subprocess test; `assertSecurePermissions` in `lib/auth.ts:64–74` throws `InsecurePermissionsError` with exact spec message   |
| 5   | `--bind tailscale` gracefully degrades when Tailscale absent                                                                                  | ✓ VERIFIED | `bind-modes.subprocess.test.ts` confirms exact D-17 message; `getTailscaleIP` throws `TailscaleNotDetectedError`; start.ts exits 1 with exact message                         |

**Score:** 5/5 truths verified

### Deferred Items

Items not yet fully met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | AUTH-05: Pair URL flow stores `{agentUrl, token}` in SPA localStorage and redirects to `/` | Phase 2 | Phase 2 goal includes "stores credentials in localStorage"; SPA-02 success criterion: "Clicking the printed pair URL completes pairing without manual input; the SPA lands on /". Phase 1 delivers daemon-side pair URL generation (banner + `pair` command). |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `pnpm-workspace.yaml` | zod ^3.25.0 catalog | ✓ VERIFIED | Line 6: `zod: ^3.25.0` |
| `packages/agent/package.json` | hono + execa + picocolors runtime deps | ✓ VERIFIED | All 8 runtime deps in dependencies block |
| `packages/agent/tsup.config.ts` | noExternal bundles all 8 deps | ✓ VERIFIED | Lines 22–30 include hono, @hono/node-server, @hono/zod-validator, execa, picocolors |
| `packages/shared/src/schemas/auth.ts` | AuthFileSchema | ✓ VERIFIED | Exports AuthFileSchema, AuthFile |
| `packages/shared/src/schemas/registry.ts` | RegistryEntrySchema, RegistryFileSchema, RegistryListItemSchema, RegistryListResponseSchema, StatusResponseSchema | ✓ VERIFIED | All 5 schemas + types exported |
| `packages/shared/src/schemas/read.ts` | ReadResponseSchema | ✓ VERIFIED | Exports ReadResponseSchema, ReadResponse |
| `packages/shared/src/schemas/git.ts` | GitResponseSchema | ✓ VERIFIED | Exports GitResponseSchema, GitResponse |
| `packages/shared/src/schemas/errors.ts` | ErrorResponseSchema | ✓ VERIFIED | Exports ErrorResponseSchema, ErrorResponse |
| `packages/shared/src/schemas/server.ts` | ServerInfoSchema | ✓ VERIFIED | Exports ServerInfoSchema, ServerInfo |
| `packages/shared/src/schemas/health.ts` | Extended with optional daemonVersion, registryCount, paired | ✓ VERIFIED | 3 optional fields added; backward-compat confirmed |
| `packages/shared/src/index.ts` | Re-exports all new schemas | ✓ VERIFIED | 6 schema groups re-exported (7 Schema exports) |
| `packages/agent/src/constants.ts` | PROD_ORIGIN, DEV_ORIGIN, DEFAULT_PORT, DEFAULT_HOST, CONFIG_DIR, AUTH_FILE, REGISTRY_FILE, PIDFILE, SERVER_FILE, TAILSCALE_CIDR_BASE, TAILSCALE_CIDR_PREFIX, TOKEN_ROTATION_DAYS, GIT_ALLOWED_CMDS | ✓ VERIFIED | All 13+ constants exported; PROD_ORIGIN = `https://agenticapps-dashboard.pages.dev` (D-21) |
| `packages/agent/src/lib/auth.ts` | generateToken, readAuthFile, writeAuthFile, rotateToken, getActiveToken, setActiveToken, assertSecurePermissions, ensureAuthFile, shouldAutoRotate, InsecurePermissionsError | ✓ VERIFIED | All 10 exports present; D-13 token format verified |
| `packages/agent/src/lib/registry.ts` | readRegistry, writeRegistry, addProject, removeProject, renameProject, setTags, listProjectsWithStatus, slugify, ensureRegistryFile, isReachable | ✓ VERIFIED | All 10 exports; idempotent register + slug collision -2/-3 verified |
| `packages/agent/src/lib/paths.ts` | resolveAllowed, PathViolation, ALLOWED_SUBDIRS | ✓ VERIFIED | Rejects .., absolute, planted symlink, outside .planning/.claude |
| `packages/agent/src/lib/pidfile.ts` | writePidfile, readPidfile, removePidfile, isProcessAlive, assertNoStaleDaemon, StaleDaemonError | ✓ VERIFIED | process.kill(pid, 0) liveness check |
| `packages/agent/src/lib/logging.ts` | agentLog, agentError, generateRequestId | ✓ VERIFIED | [agent] prefix; UUID requestId |
| `packages/agent/src/lib/banner.ts` | renderBanner (spec-verbatim), renderZeroBindWarning | ✓ VERIFIED | "Press Ctrl-C to stop..." line present; pair URL URL-encodes agent param |
| `packages/agent/src/lib/tailscale.ts` | getTailscaleIP, getTailscaleHostname, TailscaleNotDetectedError | ✓ VERIFIED | Exact D-17 message; trailing-dot strip via `replace(/\.$/, '')` |
| `packages/agent/src/lib/serverInfo.ts` | writeServerInfo, readServerInfo, removeServerInfo | ✓ VERIFIED | mode 0600 on server.json |
| `packages/agent/src/lib/git.ts` | runAllowedGit, GitNotAllowedError | ✓ VERIFIED | allow-list checked BEFORE execa spawn |
| `packages/agent/src/server/app.ts` | createApp factory; middleware ordering; all routes mounted | ✓ VERIFIED | cors() line 64, bearerAuth() line 75 — CORS before bearerAuth confirmed |
| `packages/agent/src/server/boot.ts` | bootDaemon, gracefulShutdown | ✓ VERIFIED | writeServerInfo on listen, removeServerInfo on shutdown; 5s hard timeout |
| `packages/agent/src/server/middleware/cidr.ts` | cidrMiddleware, isTailscaleCIDR | ✓ VERIFIED | 100.64.0.0/10; IPv6-mapped IPv4 stripped |
| `packages/agent/src/server/middleware/errors.ts` | errorHandler, outbound() D-16 helper | ✓ VERIFIED | schema_drift → 500; PathViolation → 422; ZodError → 422; NODE_ENV-gated verbosity |
| `packages/agent/src/routes/health.ts` | GET /health → HealthResponseSchema | ✓ VERIFIED | outbound() wrapper; daemonVersion/registryCount/paired populated |
| `packages/agent/src/routes/admin.ts` | POST /api/admin/shutdown | ✓ VERIFIED | Returns 204; triggers SIGTERM |
| `packages/agent/src/routes/registry.ts` | GET /api/registry, POST /api/registry/register, POST /api/registry/unregister | ✓ VERIFIED | outbound() on list; 201/200 idempotent register |
| `packages/agent/src/routes/auth.ts` | POST /api/auth/rotate | ✓ VERIFIED | rotateToken() → 204 |
| `packages/agent/src/routes/read.ts` | GET /api/projects/:id/read (path allow-list) | ✓ VERIFIED | resolveAllowed() wired; throws PathViolation → 422 |
| `packages/agent/src/routes/git.ts` | GET /api/projects/:id/git (cmd allow-list) | ✓ VERIFIED | runAllowedGit() wired; non-allow-list → 422 |
| `packages/agent/src/cli.ts` | All 10 commands dispatched | ✓ VERIFIED | start, stop, status, register, unregister, list, rename, tag, rotate-token, pair |
| `packages/agent/src/cli/start.ts` | ensureAuthFile + assertSecurePermissions + bootDaemon; full tailscale resolution | ✓ VERIFIED | No `not yet wired` placeholder; getTailscaleIP() wired |
| `packages/agent/src/cli/stop.ts` | /api/admin/shutdown primary, SIGTERM fallback | ✓ VERIFIED | readServerInfo + bearer POST; SIGTERM via pidfile fallback |
| `packages/agent/src/cli/register.ts` | runRegister, runUnregister | ✓ VERIFIED | --auto, --yes, --dry-run, idempotent |
| `packages/agent/src/cli/registryCmd.ts` | runList, runRename, runTag | ✓ VERIFIED | RegistryListResponseSchema.parse validated |
| `packages/agent/src/cli/status.ts` | runStatus | ✓ VERIFIED | StatusResponseSchema.parse validated |
| `packages/agent/src/cli/token.ts` | runRotateToken, runPair | ✓ VERIFIED | rotateToken() called; pair URL generated |
| `packages/agent/src/cli/discover.ts` | discoverProjects, registerInteractive | ✓ VERIFIED | D-08 markers; depth=1; --yes/--dry-run |
| `packages/agent/src/server/__tests__/auth.test.ts` | 4 mandatory TDD cases | ✓ VERIFIED | All 4 named describe blocks present and passing |
| `packages/agent/src/server/__tests__/paths.test.ts` | path-allow-list-rejects-traversal mandatory TDD | ✓ VERIFIED | 422 + path_not_allowed verified |
| `packages/agent/src/cli/__tests__/end-to-end.subprocess.test.ts` | Phase 1 success criterion 1 closure | ✓ VERIFIED | Full register → start → /health → read → rotate → 401 → stop sequence |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `packages/shared/src/index.ts` | all 6 new schema files | re-exports | ✓ WIRED | 7 Schema exports, 7 type exports confirmed |
| `packages/agent/tsup.config.ts` | noExternal list | bundling | ✓ WIRED | hono, @hono/node-server, @hono/zod-validator, execa, picocolors listed |
| `packages/agent/src/lib/auth.ts` | local AuthFileSchema | parse on read/write | ✓ WIRED | Note: uses local schema (not shared import) — functionally identical, intentional per Plan 02 devnotes. Routes use shared import. |
| `packages/agent/src/lib/registry.ts` | local RegistryFileSchema | parse on read/write | ✓ WIRED | Same note as auth.ts — intentional local schemas per Plan 02 devnotes |
| `packages/agent/src/routes/read.ts` | resolveAllowed (paths.ts) | path allow-list enforcement | ✓ WIRED | `const real = await resolveAllowed(project.root, relPath)` |
| `packages/agent/src/server/app.ts` | getActiveToken (auth.ts) | bearerAuth verifyToken closure | ✓ WIRED | `verifyToken: async (token) => token === getActiveToken()` — reads in-memory ref per-request (D-15) |
| `packages/agent/src/server/app.ts` | errorHandler (errors.ts) | app.onError | ✓ WIRED | `app.onError(errorHandler)` |
| `packages/agent/src/server/boot.ts` | writeServerInfo/removeServerInfo | listen callback + gracefulShutdown | ✓ WIRED | server.json lifecycle confirmed |
| `packages/agent/src/cli/start.ts` | getTailscaleIP/getTailscaleHostname (tailscale.ts) | --bind tailscale branch | ✓ WIRED | No `not yet wired` placeholder; both functions imported and called |
| `packages/agent/src/cli/start.ts` | bootDaemon (boot.ts) | actual server boot | ✓ WIRED | `await bootDaemon({ app, host, port, pairHostname, bindMode })` |
| `packages/agent/src/cli/stop.ts` | readServerInfo (serverInfo.ts) | bindUrl lookup for shutdown POST | ✓ WIRED | `const info = readServerInfo()` |
| All routes | outbound() helper (errors.ts) | D-16 schema-drift defense | ✓ WIRED | health.ts, registry.ts, read.ts, git.ts all use `outbound(c, Schema.parse.bind(Schema), payload)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `routes/health.ts` | `reg.projects.length` | `readRegistry()` → JSON.parse(readFileSync) | Yes — reads actual registry.json | ✓ FLOWING |
| `routes/registry.ts` | `items` | `listProjectsWithStatus()` → readRegistry() + git execa | Yes — real filesystem reads + git | ✓ FLOWING |
| `routes/read.ts` | `content` | `readFile(real, 'utf8')` after resolveAllowed | Yes — actual project file content | ✓ FLOWING |
| `routes/git.ts` | `result` | `runAllowedGit(cmd, project.root)` → execa git | Yes — real git subprocess | ✓ FLOWING |
| `server/boot.ts` | `projects` | `listProjectsWithStatus()` | Yes — real registry data | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| D-13 token format | `node -e "const {randomBytes}=require('crypto');const t=randomBytes(32).toString('hex').match(/.{1,8}/g).join('-');console.log(t.length,/^[0-9a-f]{8}(-[0-9a-f]{8}){7}$/.test(t))"` | `71 true` | ✓ PASS |
| Full test suite | `pnpm test --run` | `160 passed (31 files)` | ✓ PASS |
| --bind tailscale absent | verified via bind-modes.subprocess.test.ts in suite | exit 1 + exact D-17 message | ✓ PASS (via suite) |
| --bind tailscale present | Manual gate (Tailscale binary not on dev machine) | N/A | ? SKIP (manual required) |
| TTY yellow banner color | Manual gate (terminal rendering) | N/A | ? SKIP (manual required) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| DAEMON-01 | 01-03, 01-04, 01-05 | `start` boots Hono on 127.0.0.1:5193 | ✓ SATISFIED | start.ts → bootDaemon → @hono/node-server; e2e test verifies /health 200 |
| DAEMON-02 | 01-04 | `stop` gracefully shuts down | ✓ SATISFIED | stop.ts: POST /api/admin/shutdown primary, SIGTERM fallback; stop.subprocess.test.ts |
| DAEMON-03 | 01-04 | `status` reports daemon health | ✓ SATISFIED | status.ts: StatusResponseSchema; list-status.subprocess.test.ts |
| DAEMON-04 | 01-02, 01-03, 01-04 | Refuses start if auth.json is 0644 | ✓ SATISFIED | assertSecurePermissions; permissions-check-refuses-0644 TDD case |
| DAEMON-05 | 01-02, 01-03 | Prints one-click pair URL at startup | ✓ SATISFIED | renderBanner with PROD_ORIGIN/pair?agent=...&token=... |
| DAEMON-06 | 01-05 | --bind tailscale auto-detects + graceful degrade | ✓ SATISFIED | getTailscaleIP/getTailscaleHostname; TailscaleNotDetectedError D-17; bind-modes test |
| AUTH-01 | 01-03 | All routes require bearer token; missing/invalid → 401 | ✓ SATISFIED | bearerAuth in app.ts; test suite auth tests |
| AUTH-02 | 01-03 | CORS allows only agenticapps-dashboard.pages.dev + localhost:5174 | ✓ SATISFIED | cors() with [PROD_ORIGIN, DEV_ORIGIN]; cors-rejects-wrong-origin TDD case. Note: REQUIREMENTS.md lists dashboard.agenticapps.eu but D-21 decision uses pages.dev for v1 (custom domain deferred to Phase 6) |
| AUTH-03 | 01-02, 01-03, 01-05 | rotate-token invalidates prior token immediately | ✓ SATISFIED | D-15 write-then-flip; token-rotation-invalidates-old-token TDD; e2e verifies 401 on old token |
| AUTH-04 | 01-02, 01-04 | Token auto-rotates after 30 days / version mismatch | ✓ SATISFIED | shouldAutoRotate + rotateToken in start.ts; TOKEN_ROTATION_DAYS=30 |
| AUTH-05 | 01-02, 01-04 | Pair URL flow stores {agentUrl, token} in SPA localStorage | DEFERRED | Daemon-side: pair URL generated in banner + `pair` command. SPA localStorage: Phase 2 (SPA-02) |
| REG-01 | 01-02, 01-04 | register adds project; slug collisions get -2/-3 | ✓ SATISFIED | addProject idempotent; slugify; -2/-3 suffix; register.subprocess.test.ts |
| REG-02 | 01-04 | register --auto scans with markers, confirms each match | ✓ SATISFIED | discoverProjects (D-08 markers); registerInteractive Y/n; discover.test.ts |
| REG-03 | 01-02, 01-04 | unregister removes project | ✓ SATISFIED | removeProject by id or path; register.subprocess.test.ts |
| REG-04 | 01-02, 01-04 | list reports projects + status, marks unreachable | ✓ SATISFIED | listProjectsWithStatus; isReachable; list-status.subprocess.test.ts |
| REG-05 | 01-02, 01-04 | rename and tag mutate registry only | ✓ SATISFIED | renameProject, setTags; CLI register.ts runRename/runTag |
| API-01 | 01-03 | GET /health returns {ok, daemonVersion, registryCount, paired} | ✓ SATISFIED | health.ts route; HealthResponseSchema with all 4 fields |
| API-02 | 01-02, 01-03 | GET /read rejects .., absolute, outside .planning/.claude with 422 | ✓ SATISFIED | resolveAllowed; path-allow-list-rejects-traversal TDD; e2e traversal test |
| API-03 | 01-03 | GET /git only executes allow-listed subcommands | ✓ SATISFIED | runAllowedGit; GitNotAllowedError; GIT_ALLOWED_CMDS [log, status, diff-stat, branch] |
| INV-02 | 01-01, 01-02, 01-03 | Registry/auth/env files mode 0600; daemon refuses if looser | ✓ SATISFIED | chmodSync 0600 on all writes; assertSecurePermissions; start refuses |
| INV-05 | 01-01 | No native deps in packages/agent | ✓ SATISFIED | Pure-JS: hono, execa, picocolors, zod, commander — no keytar, no FFI |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `packages/agent/src/lib/auth.ts` | 4–6 | Local AuthFileSchema (comment says will be replaced in Plan 01-03) | ℹ️ Info | Known devnote: functionally equivalent to shared schema; routes use shared imports. No user impact. |
| `packages/agent/src/lib/registry.ts` | 4–9 | Local RegistryFileSchema (same note) | ℹ️ Info | Same as above. |

**Note:** These are documented intentional deviations from Plan 02 — the lib layer was built before the shared schemas were merged (wave ordering). The routes and CLI correctly import from `@agenticapps/dashboard-shared`. This does not affect behavior but means the two schemas exist in two places. Should be unified in a future cleanup pass.

### Human Verification Required

#### 1. Live --bind tailscale positive path

**Test:** On a machine with Tailscale daemon running: `agentic-dashboard start --bind tailscale`
**Expected:** Daemon boots bound to Tailscale IP, pair URL uses MagicDNS hostname (trailing dot stripped), `curl` from a second Tailscale device returns `{ ok: true }` from `/health`
**Why human:** Requires a real Tailscale daemon running; dev machine has no tailscale binary. The absent-Tailscale path is fully automated (D-17 degradation test passes). Only the positive path requires a Tailscale-connected environment.

#### 2. D-20 yellow warning banner color rendering

**Test:** Run `agentic-dashboard start --bind 0.0.0.0` in a real terminal (iTerm/Terminal.app with ANSI color support)
**Expected:** The WARNING line renders in yellow — `[agent] WARNING: bound to 0.0.0.0 — only safe on Tailscale-isolated machines. CIDR enforcement is ON.`
**Why human:** picocolors ANSI color codes cannot be verified by automated grep; requires visual inspection in a TTY environment. String content is verified by the automated bind-modes.subprocess.test.ts.

### Gaps Summary

No blocking gaps found. All 5 ROADMAP success criteria are verified. All mandatory TDD cases pass. 160/160 tests green. AUTH-05's SPA localStorage portion is deferred to Phase 2 (Phase 2 goal explicitly covers it via SPA-02). Two human verification items remain — both are documented manual gates in VALIDATION.md and are inherent to the environment (real Tailscale, real TTY) rather than implementation defects.

**AUTH-02 note:** REQUIREMENTS.md lists `dashboard.agenticapps.eu` as the production CORS origin, but D-21 explicitly decided to use `agenticapps-dashboard.pages.dev` for Phases 0–6 (custom domain deferred to Phase 6). This is correctly implemented and is not a gap.

**Local schemas note:** `lib/auth.ts` and `lib/registry.ts` define local Zod schemas instead of importing from `@agenticapps/dashboard-shared`. This is documented as an intentional wave-ordering artifact in Plan 02 (the lib layer was built before shared schemas were merged). The schemas are functionally identical. All routes correctly import from `@agenticapps/dashboard-shared`. This is a minor debt item, not a functional gap.

---

_Verified: 2026-05-03T14:15:00Z_
_Verifier: Claude (gsd-verifier)_
