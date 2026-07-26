---
phase: 01-daemon-registry-pairing
plan: "02"
subsystem: agent-lib
tags: [auth, registry, paths, pidfile, logging, banner, tdd]
dependency_graph:
  requires:
    - 01-01 (shared Zod schemas — local stubs used; wired in 01-03)
  provides:
    - packages/agent/src/constants.ts (all daemon constants)
    - packages/agent/src/lib/auth.ts (token gen, file I/O, permissions, rotation)
    - packages/agent/src/lib/registry.ts (CRUD, slug, status)
    - packages/agent/src/lib/paths.ts (allow-list checker with realpath defense)
    - packages/agent/src/lib/pidfile.ts (liveness check, write/read/remove/assert)
    - packages/agent/src/lib/logging.ts ([agent] prefix logger, requestId)
    - packages/agent/src/lib/banner.ts (spec-verbatim startup banner, zero-bind warning)
    - packages/agent/src/lib/__fixtures__/tmpHome.ts (test fixture)
  affects:
    - packages/agent/src/lib/ (new directory)
    - packages/agent/src/constants.ts (new file)
    - packages/agent/package.json (added hono, execa, picocolors, zod, @hono/* as deps)
    - packages/agent/tsup.config.ts (noExternal expanded)
    - pnpm-workspace.yaml (zod ^3.24 to ^3.25 for @hono/zod-validator compatibility)
tech_stack:
  added:
    - hono@4.12.16
    - "@hono/node-server@2.0.1"
    - "@hono/zod-validator@0.7.6"
    - execa@9.6.1
    - picocolors@1.1.1
    - zod@^3.25.0 (catalog bump from ^3.24)
  patterns:
    - TDD strict red-green-refactor (4 RED commits + 4 GREEN commits)
    - Local inline Zod schemas until shared wiring in Plan 01-03
    - execa argv-array subprocess (no shell injection surface)
    - realpath allow-list defense for planted symlinks
    - process.kill(pid, 0) stale pidfile detection
    - write-then-flip D-15 token rotation ordering
key_files:
  created:
    - packages/agent/src/constants.ts
    - packages/agent/src/lib/auth.ts
    - packages/agent/src/lib/registry.ts
    - packages/agent/src/lib/paths.ts
    - packages/agent/src/lib/pidfile.ts
    - packages/agent/src/lib/logging.ts
    - packages/agent/src/lib/banner.ts
    - packages/agent/src/lib/__fixtures__/tmpHome.ts
    - packages/agent/src/lib/auth.test.ts
    - packages/agent/src/lib/registry.test.ts
    - packages/agent/src/lib/paths.test.ts
    - packages/agent/src/lib/pidfile.test.ts
    - packages/agent/src/lib/logging.test.ts
    - packages/agent/src/lib/banner.test.ts
  modified:
    - packages/agent/package.json
    - packages/agent/tsup.config.ts
    - pnpm-workspace.yaml
    - pnpm-lock.yaml
decisions:
  - "Local inline Zod schemas in auth.ts and registry.ts — Plan 01-03 wires to @agenticapps/dashboard-shared once 01-01 merges"
  - "realpath allowedRoots in resolveAllowed to handle macOS /var to /private/var — avoids false rejections on macOS tmpdir paths"
  - "paths.test.ts assertions use realpath() on expected values for the same macOS reason"
metrics:
  duration: ~18m
  completed: "2026-05-03"
  tasks_completed: 2
  files_created: 14
  files_modified: 4
  tests_added: 60
---

# Phase 1 Plan 02: Agent Lib Layer Summary

**One-liner:** Pure-function lib layer for the daemon — token gen (256-bit CSPRNG), auth-file I/O with 0600 enforcement, registry CRUD with idempotent slug collision handling, realpath allow-list path checker, pidfile liveness detection, structured logging, and spec-verbatim startup banner.

## What Was Built

All 7 lib modules plus the test fixture. Detailed breakdown:

### 1. `packages/agent/src/constants.ts`

Exports: `PROD_ORIGIN`, `DEV_ORIGIN`, `DEFAULT_HOST`, `DEFAULT_PORT`, `CONFIG_DIR`, `AUTH_FILE`, `REGISTRY_FILE`, `PIDFILE`, `SERVER_FILE`, `TAILSCALE_CIDR_BASE`, `TAILSCALE_CIDR_PREFIX`, `TOKEN_ROTATION_DAYS`, `GIT_ALLOWED_CMDS`, `GitAllowedCmd`.

Key: `PROD_ORIGIN = 'https://agenticapps-dashboard.pages.dev'` per D-21. Custom domain flip is a one-line change for Phase 6.

### 2. `packages/agent/src/lib/paths.ts`

Exports: `resolveAllowed`, `PathViolation`, `ALLOWED_SUBDIRS`.

Defends against: `..` traversal (pre-check before realpath), absolute paths, planted symlinks escaping `.planning/` or `.claude/`, paths outside the allow-list (e.g. `.git/HEAD`). Resolves allowedRoots via realpath to handle macOS `/var` to `/private/var` symlink.

### 3. `packages/agent/src/lib/pidfile.ts`

Exports: `isProcessAlive`, `writePidfile`, `readPidfile`, `removePidfile`, `assertNoStaleDaemon`, `StaleDaemonError`.

Uses `process.kill(pid, 0)` — distinguishes ESRCH (dead), EPERM (alive, different user), no-error (alive same user). D-07 compliant.

### 4. `packages/agent/src/lib/logging.ts`

Exports: `agentLog`, `agentError`, `generateRequestId`.

Simple `[agent] ` prefix to stdout/stderr per D-02. `generateRequestId` uses `crypto.randomUUID()` for correlation.

### 5. `packages/agent/src/lib/banner.ts`

Exports: `renderBanner`, `renderZeroBindWarning`.

Banner matches spec lines 207-219 verbatim: Daemon starting, Registry count, Listening on, Token, Pair this device (URL-encoded agent param), Or pair manually, Agent URL, Token, Press Ctrl-C closer. Zero-bind warning uses picocolors yellow ANSI per D-20.

### 6. `packages/agent/src/lib/auth.ts`

Exports: `generateToken`, `readAuthFile`, `writeAuthFile`, `rotateToken`, `getActiveToken`, `setActiveToken`, `assertSecurePermissions`, `ensureAuthFile`, `shouldAutoRotate`, `InsecurePermissionsError`.

Key invariants:
- D-13: `crypto.randomBytes(32).toString('hex').match(/.{1,8}/g)!.join('-')` = 71-char format
- D-01/INV-02: `assertSecurePermissions` throws `InsecurePermissionsError` with EXACT spec remediation message
- D-15: `rotateToken` writes file FIRST, then flips `activeToken` in-memory ref
- D-14: `shouldAutoRotate` returns true on version mismatch or age > 30 days
- `ensureAuthFile` is the lazy-init entry point used by every CLI subcommand (D-01)

### 7. `packages/agent/src/lib/registry.ts`

Exports: `readRegistry`, `writeRegistry`, `addProject`, `removeProject`, `renameProject`, `setTags`, `listProjectsWithStatus`, `slugify`, `ensureRegistryFile`, `isReachable`.

Key invariants:
- D-10: `addProject` is idempotent on path collision (returns `alreadyRegistered: true`); slug collisions get `-2`/`-3` suffix
- D-12: No auto-tagging; defaults `tags: []`
- T-01-02-10: `listProjectsWithStatus` uses `execa('git', ['log', ...], { cwd: root })` — argv array, no shell interpretation
- Unreachable roots marked `reachable: false`, never throws

### 8. `packages/agent/src/lib/__fixtures__/tmpHome.ts`

`makeTmpHome()` and `makeTmpProject()` helpers for deterministic file-I/O tests. `makeTmpProject` supports `withSymlinkEscape: true` to create a planted symlink for security tests.

## Reachability Map (REQ-IDs at lib layer)

| REQ-ID | Status | Notes |
|--------|--------|-------|
| AUTH-01 | lib-ready | `getActiveToken`/`setActiveToken` in-memory ref; server wiring in Plan 01-03 |
| AUTH-02 | server-scope | CORS is in Hono middleware (Plan 01-03) |
| AUTH-03 | lib-ready | `rotateToken` with D-15 write-then-flip ordering |
| AUTH-04 | lib-ready | `shouldAutoRotate` checks 30-day threshold |
| AUTH-05 | lib-ready | `rotateToken` generates new token and persists it |
| REG-01 | lib-ready | `addProject` + slug collision handling |
| REG-02 | cli-scope | `register --auto` scan logic in Plan 01-04 |
| REG-03 | lib-ready | `removeProject` by id or path |
| REG-04 | lib-ready | `listProjectsWithStatus` with reachability check |
| REG-05 | lib-ready | `renameProject` + `setTags` |
| DAEMON-04 | lib-ready | `assertSecurePermissions` + `ensureAuthFile` |
| DAEMON-05 | lib-ready | `renderBanner` spec-verbatim |
| INV-02 | lib-ready | mode 0600 on all writes + chmodSync hardening |
| INV-05 | met | Only pure-JS deps (execa, picocolors, zod, hono); no native deps |

## D-15 Race-Window Invariant

`rotateToken` ordering (verified by test):
1. `writeAuthFile(next, filePath)` — persists new token to disk
2. `setActiveToken(next.token)` — flips in-memory ref

In-flight requests that captured the old ref before step 2 complete with the old token. New requests presenting the old token after step 2 return 401.

## Banner Verbatim Verification

`renderBanner` output verified against spec lines 207-219:
- `[agent] Daemon starting…`
- `[agent] Registry: N projects (name1, name2, ...)`
- `[agent] Listening on <bindUrl>`
- `[agent] Token: <token>`
- `[agent]`
- `[agent] Pair this device:`
- `[agent]   https://agenticapps-dashboard.pages.dev/pair?agent=<encoded-url>&token=<token>`
- `[agent]`
- `[agent] Or pair manually at https://agenticapps-dashboard.pages.dev/settings:`
- `[agent]   Agent URL: http://<pairHostname>`
- `[agent]   Token:     <token>`
- `[agent]`
- `[agent] Press Ctrl-C to stop, or \`agentic-dashboard install-launchd\` to run as a service.`

Pair URL encodes the agent hostname with `encodeURIComponent` (not the token) per spec. Tested with substring `?agent=http%3A%2F%2F127.0.0.1%3A5193&token=`.

## assertSecurePermissions Exact Message

```
auth.json has insecure permissions (mode 644); fix with `chmod 600 /path/to/auth.json` or run `agentic-dashboard rotate-token` to regenerate.
```

## Subprocess Discipline

`execa` (argv array) is the only subprocess primitive in lib code. The project root is passed as `cwd` option to `execa`, not as an argument. This prevents shell interpretation of user-controlled paths. Verified by grep: zero occurrences of `node:child_process` in the lib directory.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] macOS /var to /private/var realpath false negatives in resolveAllowed**
- **Found during:** Task 1 GREEN phase (paths.test.ts failures)
- **Issue:** `resolve(projectRoot, d)` returns `/var/folders/.../` but `realpath(candidate)` returns `/private/var/folders/...` on macOS. The prefix check always failed.
- **Fix:** Also apply `realpath()` to the allowedRoots array before prefix comparison. Same fix applied to test assertions.
- **Files modified:** `packages/agent/src/lib/paths.ts`, `packages/agent/src/lib/paths.test.ts`
- **Commit:** da58cd4

**2. [Rule 2 - Missing] Dependency infrastructure not in worktree**
- **Found during:** Task 1 setup
- **Issue:** hono, execa, picocolors were not in `packages/agent/package.json`; zod catalog was ^3.24.0 (incompatible with @hono/zod-validator 0.7.x)
- **Fix:** Updated `packages/agent/package.json`, `packages/agent/tsup.config.ts`, `pnpm-workspace.yaml`, ran `pnpm install`
- **Files modified:** `packages/agent/package.json`, `packages/agent/tsup.config.ts`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`
- **Commit:** da58cd4

**3. [Rule 2 - Missing] Shared Zod schemas not yet importable (Plan 01-01 parallel)**
- **Found during:** Task 2 setup
- **Issue:** `@agenticapps/dashboard-shared` only exports `HealthResponseSchema` in this worktree; Plan 01-01 is adding auth/registry schemas concurrently
- **Fix:** Defined `AuthFileSchema` and `RegistryFileSchema` as local Zod schemas in `auth.ts` and `registry.ts` respectively. TODO comments mark them for replacement in Plan 01-03.
- **Files modified:** `packages/agent/src/lib/auth.ts`, `packages/agent/src/lib/registry.ts`

## Known Stubs

- `auth.ts` and `registry.ts` use **local Zod schemas** instead of shared imports. These are functionally equivalent to what Plan 01-01 defines (verified by cross-referencing the 01-01 worktree schema files), but they are intentionally local stubs. Plan 01-03 will replace them with `import { AuthFileSchema } from '@agenticapps/dashboard-shared'`.

## Self-Check: PASSED

Files verified to exist:
- packages/agent/src/constants.ts: FOUND
- packages/agent/src/lib/auth.ts: FOUND
- packages/agent/src/lib/registry.ts: FOUND
- packages/agent/src/lib/paths.ts: FOUND
- packages/agent/src/lib/pidfile.ts: FOUND
- packages/agent/src/lib/logging.ts: FOUND
- packages/agent/src/lib/banner.ts: FOUND
- packages/agent/src/lib/__fixtures__/tmpHome.ts: FOUND

Commits verified:
- 595096c (test RED: paths/pidfile/logging/banner): FOUND
- da58cd4 (feat GREEN: constants + paths/pidfile/logging/banner): FOUND
- f3e7af9 (test RED: auth/registry): FOUND
- 61cf08f (feat GREEN: auth/registry): FOUND

Tests: 60 passed, 0 failed.
