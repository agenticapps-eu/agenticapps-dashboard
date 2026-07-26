---
phase: 01-daemon-registry-pairing
plan: "05"
subsystem: agent-tailscale-e2e
tags: [tailscale, cidr, bind-modes, subprocess-tests, tdd, e2e, end-to-end]

dependency_graph:
  requires:
    - 01-01 (shared schemas)
    - 01-02 (lib layer: auth, registry, pidfile, logging, banner)
    - 01-03 (server: createApp, bootDaemon, cidrMiddleware)
    - 01-04 (CLI surface: start.ts stub, spawnAgent fixture)
  provides:
    - packages/agent/src/lib/tailscale.ts (getTailscaleIP, getTailscaleHostname, TailscaleNotDetectedError)
    - packages/agent/src/cli/start.ts (full --bind tailscale resolution — Plan 04 placeholder replaced)
    - packages/agent/src/server/middleware/cidr.test.ts (3 createApp integration tests added)
    - packages/agent/src/cli/__tests__/bind-modes.subprocess.test.ts (D-17 + D-20 subprocess coverage)
    - packages/agent/src/cli/__tests__/end-to-end.subprocess.test.ts (Phase 1 success criterion 1 closure)
  affects:
    - Phase 2 (SPA pair flow consumes pairHostname from start; Tailscale hostnames now correct)

tech-stack:
  added: []
  patterns:
    - execa argv-array (no shell) for Tailscale subprocess calls (T-01-05-01)
    - TailscaleNotDetectedError custom error class for typed error handling at call site
    - vi.mock('execa') hoisted before import — required for ESM module mock with vitest
    - explicit 5s timeout on both execa calls (T-01-05-05: prevent start hanging)
    - renderZeroBindWarning(enforceCIDR) param for accurate D-20 warning text

key-files:
  created:
    - packages/agent/src/lib/tailscale.ts
    - packages/agent/src/lib/tailscale.test.ts
    - packages/agent/src/cli/__tests__/bind-modes.subprocess.test.ts
    - packages/agent/src/cli/__tests__/end-to-end.subprocess.test.ts
  modified:
    - packages/agent/src/cli/start.ts (Plan 04 tailscale stub replaced)
    - packages/agent/src/server/middleware/cidr.test.ts (3 integration tests added)
    - packages/agent/src/server/boot.ts (BootOptions.enforceCIDR added)
    - packages/agent/src/lib/banner.ts (renderZeroBindWarning accepts enforceCIDR param)

key-decisions:
  - "PATH restriction for D-17 test removed: overriding PATH to a nonexistent directory also breaks node binary resolution in spawnSync. The dev machine has no tailscale binary on its real PATH — that is sufficient to trigger TailscaleNotDetectedError (ENOENT)."
  - "renderZeroBindWarning signature extended with optional enforceCIDR=true param: the D-20 banner text should accurately reflect whether CIDR is active. --no-enforce-cidr omits the 'CIDR enforcement is ON' clause. Backwards-compatible default."
  - "E2E read path uses .planning/PROJECT.md (not PROJECT.md): resolveAllowed enforces .planning/.claude allow-list; top-level project files are outside the allow-list by design."
  - "BootOptions.enforceCIDR added as optional field: passes CIDR state through to bootDaemon so the warning banner can reflect the actual enforcement mode."

metrics:
  duration_minutes: 7
  completed_date: "2026-05-03"
  tasks_completed: 2
  files_created: 4
  files_modified: 4
  tests_added: 16
---

# Phase 1 Plan 05: Tailscale Bind + CIDR Integration + End-to-End Smoke Summary

**Tailscale IP/hostname lib with mocked execa unit tests, full --bind tailscale wired into start.ts replacing the Plan 04 placeholder, CIDR middleware integration tests, bind-modes subprocess coverage for D-17 and D-20, and the Phase 1 success criterion 1 end-to-end smoke: register → start → /health → /api/registry → /read → traversal-rejected → rotate → old-token-401 → stop → exited.**

## What Was Built

### tailscale.ts Library

| Export | Behavior |
|--------|----------|
| `TailscaleNotDetectedError` | Error class with spec-verbatim D-17 message |
| `getTailscaleIP()` | Calls `tailscale ip -4` via execa; throws `TailscaleNotDetectedError` on ENOENT, non-zero exit, or empty stdout; 5s timeout (T-01-05-05) |
| `getTailscaleHostname(fallbackIp)` | Calls `tailscale status --json`; strips trailing dot from `Self.DNSName` per RESEARCH key finding 5 (Pitfall 5); falls back to `fallbackIp` on any failure (D-19); 5s timeout |

**D-17 exact message** (spec-verbatim, verified by string-equality test):
```
Tailscale not detected. Install from https://tailscale.com or use --bind 127.0.0.1.
```

### start.ts Complete Decision Tree

```
opts.bind === 'tailscale'
  └─ getTailscaleIP() ok  → host=IP, pairHostname=DNSName:port, bindMode='tailscale'
  └─ getTailscaleIP() err → agentError(D-17 message), process.exit(1)

opts.bind === '0.0.0.0'
  └─ host='0.0.0.0', pairHostname='0.0.0.0:port', bindMode='0.0.0.0'

isIPv4(opts.bind) && bind !== '127.0.0.1'
  └─ host=bind, pairHostname='host:port', bindMode='tailscale' (CIDR ON)

isIPv4(opts.bind) && bind === '127.0.0.1' (or non-IPv4 string)
  └─ host=bind, pairHostname='host:port', bindMode='loopback' (CIDR OFF)
```

### CIDR Enforcement Matrix

| bindMode | enforceCidr flag | enforceCIDR result |
|----------|------------------|--------------------|
| `loopback` | any | OFF |
| `tailscale` | true (default) | ON |
| `tailscale` | false | OFF |
| `0.0.0.0` | true (default) | ON |
| `0.0.0.0` | false | OFF |

### Unit Tests (tailscale.test.ts — 9 cases, mocked execa)

| Test | What's verified |
|------|-----------------|
| getTailscaleIP success | Returns trimmed IP |
| getTailscaleIP ENOENT | Throws TailscaleNotDetectedError with exact D-17 message |
| getTailscaleIP non-zero exit | Throws TailscaleNotDetectedError |
| getTailscaleIP empty stdout | Throws TailscaleNotDetectedError |
| getTailscaleHostname strips dot | `devbox.tailfa84dd.ts.net.` → `devbox.tailfa84dd.ts.net` |
| getTailscaleHostname empty DNSName | Falls back to fallbackIp |
| getTailscaleHostname missing DNSName | Falls back to fallbackIp |
| getTailscaleHostname execa rejects | Falls back to fallbackIp |
| getTailscaleHostname JSON parse fails | Falls back to fallbackIp |

### CIDR Integration Tests (cidr.test.ts additions — 3 cases)

- `createApp({ enforceCIDR: true })`: `192.168.1.5` → 403 `cidr_violation`
- `createApp({ enforceCIDR: true })`: `100.64.5.5` → 200 (within CGNAT)
- `createApp({ enforceCIDR: false })`: `192.168.1.5` → 200 (CIDR gating disabled)

### bind-modes.subprocess.test.ts (3 cases)

- `--bind tailscale` exits 1 with EXACT D-17 remediation in combined output (verifies Phase 1 success criterion 5)
- `--bind 0.0.0.0` boots and prints "WARNING: bound to 0.0.0.0" before "Listening on" (D-20)
- `--bind 0.0.0.0 --no-enforce-cidr` boots without "CIDR enforcement is ON" in banner

### end-to-end.subprocess.test.ts (1 case — Phase 1 success criterion 1)

Full sequence verified:
1. `register <tmp-proj>` exits 0
2. `start --port <random>` boots and prints "Listening on"
3. `GET /health` → 200, `ok: true`, `registryCount: 1`
4. `GET /api/registry` → 200, list contains registered project
5. `GET /api/projects/:id/read?path=.planning/PROJECT.md` → 200, content matches
6. `GET /api/projects/:id/read?path=../../etc/passwd` → 422 (path traversal rejected)
7. `POST /api/auth/rotate` → 204 (token rotated)
8. `GET /health` with old token → 401 (D-15 invalidation confirmed)
9. `stop` exits 0 (POST /api/admin/shutdown primary path)
10. Daemon exits within 1.5s

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 RED | 1f8abc8 | Failing tests for tailscale lib (mocked execa) |
| Task 1 GREEN | 7be888e | Implement tailscale lib (getTailscaleIP, getTailscaleHostname) |
| Task 2 FEAT | e107599 | Wire start.ts to tailscale lib (full --bind tailscale) |
| Task 2 TEST | 6de3813 | Add cidr integration + bind-modes + end-to-end subprocess tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PATH restriction in D-17 subprocess test broke node resolution**
- **Found during:** Task 2 (bind-modes.subprocess.test.ts first run)
- **Issue:** Setting `PATH: '/nonexistent-path'` in `spawnSync` env prevents node itself from being found — `spawnSync('node', ...)` uses PATH to locate the binary. Result: status=null, empty stdout/stderr.
- **Fix:** Use real `process.env.PATH` (which already has no `tailscale` binary on this dev machine). The real PATH is sufficient to trigger ENOENT.
- **Files modified:** `packages/agent/src/cli/__tests__/bind-modes.subprocess.test.ts`
- **Commit:** 6de3813

**2. [Rule 2 - Missing functionality] renderZeroBindWarning needed enforceCIDR param for accurate D-20 text**
- **Found during:** Task 2 (bind-modes test for --no-enforce-cidr)
- **Issue:** The `--no-enforce-cidr` test asserts the banner does NOT say "CIDR enforcement is ON" when CIDR is disabled. But `renderZeroBindWarning` always included that clause, making it inaccurate when `--no-enforce-cidr` is passed.
- **Fix:** Added optional `enforceCIDR = true` param to `renderZeroBindWarning`; the "CIDR enforcement is ON" clause is omitted when false. `BootOptions.enforceCIDR` added as optional field; `bootDaemon` passes it through.
- **Files modified:** `packages/agent/src/lib/banner.ts`, `packages/agent/src/server/boot.ts`, `packages/agent/src/cli/start.ts`
- **Commit:** e107599

**3. [Rule 1 - Bug] E2E read path was PROJECT.md instead of .planning/PROJECT.md**
- **Found during:** Task 2 (end-to-end test first run, read returned 422)
- **Issue:** `resolveAllowed()` enforces the `.planning`/`.claude` allow-list. `path=PROJECT.md` resolves to `<proj>/PROJECT.md` (outside the allow-list). The file is at `<proj>/.planning/PROJECT.md`.
- **Fix:** Changed query to `path=.planning%2FPROJECT.md`; also added `.claude` dir creation to the tmp project setup.
- **Files modified:** `packages/agent/src/cli/__tests__/end-to-end.subprocess.test.ts`
- **Commit:** 6de3813

## Known Stubs

None. All Plan 05 scope is fully implemented:
- `--bind tailscale` is fully wired (Plan 04 placeholder replaced)
- All bind modes covered by unit and subprocess tests

## Manual Gate

Per VALIDATION.md "Manual-Only Verifications" (lines 58-62):

**Live `--bind tailscale` smoke test** must be performed on a Tailscale-connected machine:
- `tailscale ip -4` must return a real Tailscale IP
- `tailscale status --json` must return a `Self.DNSName` with trailing dot
- Pair URL must use the MagicDNS hostname (dot stripped)
- CIDR enforcement: requests from outside `100.64.0.0/10` must return 403

Automated tests cover only the absent-Tailscale path (D-17) and the mocked JSON parse (trailing dot strip). The live path requires a Tailscale-connected machine.

## Phase 1 Outcome

All Phase 1 requirements satisfied:

| REQ-ID | Description | Status |
|--------|-------------|--------|
| DAEMON-01 | Hono server on 127.0.0.1:5193 (default) | ✓ Plan 03 |
| DAEMON-02 | --bind tailscale / 0.0.0.0 support | ✓ Plan 05 |
| DAEMON-03 | Pidfile lifecycle | ✓ Plan 03/04 |
| DAEMON-04 | Refuse 0644 auth.json | ✓ Plan 03/04 |
| DAEMON-05 | Graceful shutdown via /api/admin/shutdown | ✓ Plan 03/04 |
| DAEMON-06 | CIDR enforcement on non-loopback binds | ✓ Plan 03/05 |
| AUTH-01 | Bearer token on every route | ✓ Plan 03 |
| AUTH-02 | --bind tailscale D-17 exact remediation | ✓ Plan 05 |
| AUTH-03 | Token rotation invalidates old token (D-15) | ✓ Plan 03/05 e2e |
| AUTH-04 | Secure file permissions (0600) | ✓ Plan 02/03/04 |
| AUTH-05 | Auto-rotate on version mismatch / 30 days | ✓ Plan 02/04 |
| REG-01 | register / unregister / list / rename / tag | ✓ Plan 04 |
| REG-02 | register --auto (D-08 markers, depth=1) | ✓ Plan 04 |
| REG-03 | Idempotent register (D-10) | ✓ Plan 04 |
| REG-04 | Per-match Y/n confirm (D-09) | ✓ Plan 04 |
| REG-05 | Registry format + slug collision | ✓ Plan 02/04 |
| API-01 | GET /health | ✓ Plan 03/05 e2e |
| API-02 | GET /api/projects/:id/read (path allow-list) | ✓ Plan 03/05 e2e |
| API-03 | GET /api/projects/:id/git (cmd allow-list) | ✓ Plan 03 |
| INV-02 | CORS locked to known origins | ✓ Plan 03 |
| INV-05 | Schema-drift defense (outbound parse) | ✓ Plan 03 |

**Phase 1 success criterion 1 closed:** register → start → curl /health returns `{ ok: true }` — verified by end-to-end.subprocess.test.ts.

**Phase 1 success criterion 5 closed:** `--bind tailscale` degrades gracefully (D-17 remediation) — verified by bind-modes.subprocess.test.ts.

## Threat Flags

None. All STRIDE items from the plan's threat register mitigated:
- T-01-05-02: DNSName interpolated after dot-strip; pair URL is user-visible terminal output, not programmatic resolution
- T-01-05-03: D-20 yellow banner + D-18 CIDR enforcement ON by default
- T-01-05-05: explicit 5s timeout on both execa calls
- T-01-05-07: all subprocess tests use makeIsolatedHome (mktemp HOME); cleanup in finally

## Self-Check: PASSED
