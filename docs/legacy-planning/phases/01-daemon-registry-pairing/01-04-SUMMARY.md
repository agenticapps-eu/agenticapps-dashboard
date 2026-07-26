---
phase: 01-daemon-registry-pairing
plan: "04"
subsystem: agent-cli
tags: [commander, cli, subprocess-tests, tdd, register, registry, auth, daemon]

dependency_graph:
  requires:
    - 01-01 (shared Zod schemas: RegistryListResponseSchema, StatusResponseSchema)
    - 01-02 (lib utilities: auth, registry, pidfile, serverInfo, logging, banner)
    - 01-03 (server: createApp, bootDaemon, app factory)
  provides:
    - packages/agent/src/cli/discover.ts (D-08 marker scan, depth=1, registerInteractive)
    - packages/agent/src/cli/register.ts (runRegister + runUnregister)
    - packages/agent/src/cli/registryCmd.ts (runList, runRename, runTag)
    - packages/agent/src/cli/status.ts (runStatus)
    - packages/agent/src/cli/token.ts (runRotateToken, runPair)
    - packages/agent/src/cli/start.ts (runStart with tailscale stub for Plan 05)
    - packages/agent/src/cli/stop.ts (runStop with dual-path D-05 shutdown)
    - packages/agent/src/cli/__tests__/__shared__/spawnAgent.ts (makeIsolatedHome, runAgent, startAgent)
    - 5 subprocess test files covering all major CLI flows
    - Extended cli.ts dispatcher (all 10 commands)
  affects:
    - 01-05 (start.ts tailscale stub — Plan 05 replaces the --bind tailscale fallback branch)
    - SPA (Phase 2 consumes register, list, status, pair URL)

tech-stack:
  added: []
  patterns:
    - Commander lazy dynamic import (.action(() => import('./cli/X.js'))) for tree-shaking
    - Root program must NOT define --json option; child subcommands define their own
      (commander consumes parent options before subcommands see them)
    - exactOptionalPropertyTypes: conditional property assignment for optional fields
    - mktemp HOME isolation (T-01-04-06) for all subprocess tests
    - startAgent() async ready Promise waits for 'Listening on' banner line

key-files:
  created:
    - packages/agent/src/cli/discover.ts
    - packages/agent/src/cli/discover.test.ts
    - packages/agent/src/cli/register.ts
    - packages/agent/src/cli/registryCmd.ts
    - packages/agent/src/cli/status.ts
    - packages/agent/src/cli/token.ts
    - packages/agent/src/cli/start.ts
    - packages/agent/src/cli/stop.ts
    - packages/agent/src/cli/__tests__/__shared__/spawnAgent.ts
    - packages/agent/src/cli/__tests__/start.subprocess.test.ts
    - packages/agent/src/cli/__tests__/stop.subprocess.test.ts
    - packages/agent/src/cli/__tests__/register.subprocess.test.ts
    - packages/agent/src/cli/__tests__/list-status.subprocess.test.ts
    - packages/agent/src/cli/__tests__/rotate-token.subprocess.test.ts
  modified:
    - packages/agent/src/cli.ts (10 commands + removed root --json option)
    - packages/agent/src/cli.test.ts (removed alpha-placeholder start test)

key-decisions:
  - "Remove root --json from commander program: commander consumes parent --json before list/status subcommands see their own --json option. Since --version --json is handled by early argv.includes() check, the root --json definition serves no purpose and breaks subcommand --json."
  - "start.ts --bind tailscale falls back to 127.0.0.1 with a logged warning; full Tailscale resolution (D-17, D-19) lands in Plan 05. Explicit TODO comment with 'lands in Plan 05' for handoff clarity."
  - "CLI test: removed 'exits 0 on start (alpha-placeholder)' from cli.test.ts — real start command now boots a daemon and can't exit 0 without running. Full boot test lives in start.subprocess.test.ts."
  - "exactOptionalPropertyTypes fixes: RegisterInteractiveOpts yes/dryRun and addProject name use conditional property assignment rather than spreading undefined values."

metrics:
  duration_minutes: ~12
  completed_date: "2026-05-03"
  tasks_completed: 2
  files_created: 14
  files_modified: 2
  tests_added: 20
---

# Phase 1 Plan 04: Full CLI Surface Summary

**Full 10-command CLI surface replacing the Phase-0 placeholder — discover/register/unregister/list/rename/tag/status/rotate-token/pair wired to real lib layer; start boots Hono via bootDaemon; stop dual-paths via /api/admin/shutdown + SIGTERM fallback; 5 subprocess tests with mktemp HOME isolation verify the complete flow end-to-end.**

## What Was Built

### 10 CLI Commands

All commands are dispatched via lazy dynamic import in `cli.ts`.

| Command | Handler | Key Behavior |
|---------|---------|--------------|
| `start` | `cli/start.ts:runStart` | assertSecurePermissions → ensureAuthFile → shouldAutoRotate → assertNoStaleDaemon → bootDaemon; --bind tailscale stub for Plan 05 |
| `stop` | `cli/stop.ts:runStop` | Primary: POST /api/admin/shutdown with bearer (D-05); Fallback: SIGTERM via pidfile |
| `status` | `cli/status.ts:runStatus` | Pretty table + --json via StatusResponseSchema (D-04) |
| `register` | `cli/register.ts:runRegister` | Direct path + --auto scan; D-09 per-match Y/n; --yes/--dry-run; D-10 idempotent |
| `unregister` | `cli/register.ts:runUnregister` | removeProject by id or path; non-zero on not-found |
| `list` | `cli/registryCmd.ts:runList` | Pretty table + --json via RegistryListResponseSchema (D-04) |
| `rename` | `cli/registryCmd.ts:runRename` | renameProject |
| `tag` | `cli/registryCmd.ts:runTag` | setTags (replaces existing) |
| `rotate-token` | `cli/token.ts:runRotateToken` | rotateToken (D-15 write-then-flip) |
| `pair` | `cli/token.ts:runPair` | Print pair URL for 127.0.0.1:5193 |

### Discover Library (Task 1 TDD)

`discover.ts` implements:
- `discoverProjects(parentDir, { depth: 1 })` — scans direct children for D-08 markers:
  - `.claude/skills/agentic-apps-workflow/SKILL.md`
  - `.planning/config.json`
- `registerInteractive(matches, opts)` — per-match Y/n, --yes, --dry-run (D-09)
- Returns `DiscoveredMatch[]` with root/name/markers fields

8 unit tests in `discover.test.ts` verify all D-08/D-09/D-11 behaviors.

### Subprocess Test Fixture

`cli/__tests__/__shared__/spawnAgent.ts`:
- `makeIsolatedHome()` — mkdtemp under /tmp with `.agenticapps/dashboard/` pre-created (T-01-04-06)
- `runAgent(args, home)` — spawnSync with HOME override
- `startAgent(home, port)` — spawn background daemon + ready Promise resolves on "Listening on" banner

Plan 05 can consume `startAgent` / `makeIsolatedHome` for Tailscale bind tests.

### 5 Subprocess Test Files

| File | Tests | What's Verified |
|------|-------|-----------------|
| `start.subprocess.test.ts` | 2 | Boot + /health curl; 0644 auth.json refusal (DAEMON-04) |
| `stop.subprocess.test.ts` | 2 | Boot + stop exits within 2s; no-daemon no-op |
| `register.subprocess.test.ts` | 3 | register + idempotent re-register; unregister |
| `list-status.subprocess.test.ts` | 4 | list --json (RegistryListResponseSchema); status --json (StatusResponseSchema); pretty table paths |
| `rotate-token.subprocess.test.ts` | 2 | Token changes; D-13 format regex |

### start.ts ↔ bootDaemon Integration

```
runStart() flow:
  1. assertSecurePermissions(AUTH_FILE)  — fails if 0644, DAEMON-04
  2. ensureRegistryFile()                — creates registry.json if missing
  3. ensureAuthFile()                    — creates/reads auth.json, sets in-memory activeToken
  4. shouldAutoRotate(auth)              — D-14: version mismatch or >30 days
  5. assertNoStaleDaemon()               — D-07: refuse if pid is alive
  6. createApp({ enforceCIDR })          — Hono app from Plan 03
  7. bootDaemon({ app, host, port, ... }) — binds, writes pidfile + server.json, prints banner
```

### --bind tailscale Stub (Plan 05 Handoff)

In `start.ts` (lines 63-72), the tailscale branch:
```typescript
// TODO(Plan 05): Replace this block with full Tailscale resolution.
// Plan 05 will replace this tailscale stub with:
//   - execa('tailscale', ['ip', '-4']) for bind IP
//   - execa('tailscale', ['status', '--json']) for MagicDNS pairHostname (D-19)
//   - D-17: refuse with exact remediation message when tailscale not detected
if (opts.bind === 'tailscale') {
  agentError('--bind tailscale not yet wired (lands in Plan 05). Falling back to 127.0.0.1.')
  host = DEFAULT_HOST; bindMode = 'loopback'
}
```

Plan 05 replaces this entire block with real Tailscale execa calls.

### cli.test.ts Changes

- **Removed:** `'exits 0 on start (daemon boot wired in Plan 01-04)'` test — the real `start` boots a Hono server and won't exit 0. Replaced by `start.subprocess.test.ts`.
- **Preserved:** `--version` print, `--version --json` Phase 0 contract, shebang check, bundled import check.

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 RED | f49c33e | discover lib tests (failing) |
| Task 1 GREEN | d9ad470 | discover + register/list/status/token/start/stop + extended cli.ts |
| Task 2 | 4f1df06 | subprocess tests + --json scope fix + exactOptionalPropertyTypes |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Commander root --json option shadowed subcommand --json options**
- **Found during:** Task 2 (list-status subprocess tests failing with non-JSON output)
- **Issue:** When both the parent `program` and `list`/`status` subcommands define `--json`, commander parses `--json` into the parent program's option scope. The subcommand `.action()` callback receives `opts.json = undefined`.
- **Fix:** Removed the root `--json` option from `program`. The `--version --json` early-exit check uses `argv.includes()` before `program.parse()`, so removing the root option doesn't break the Phase 0 contract.
- **Files modified:** `packages/agent/src/cli.ts`
- **Commit:** 4f1df06

**2. [Rule 1 - Bug] spawnAgent.ts cliBundle path had wrong depth (../../../../../)**
- **Found during:** Task 2 (all subprocess tests exiting 1 with MODULE_NOT_FOUND)
- **Issue:** `resolve(__dirname, '../../../../../dist/cli.js')` from `src/cli/__tests__/__shared__/` resolves to the project root, not `packages/agent/`. Should be `../../../../dist/cli.js`.
- **Fix:** Changed 5 levels up to 4 levels up.
- **Files modified:** `packages/agent/src/cli/__tests__/__shared__/spawnAgent.ts`
- **Commit:** 4f1df06

**3. [Rule 1 - Bug] exactOptionalPropertyTypes: RegisterInteractiveOpts yes/dryRun and addProject name**
- **Found during:** Task 1 GREEN tsc --noEmit
- **Issue:** `{ yes: opts.yes }` passes `boolean | undefined` to `yes?: boolean` under strictOptionalPropertyTypes
- **Fix:** Conditional property assignment (`if (opts.yes !== undefined) opts.yes = ...`)
- **Files modified:** `packages/agent/src/cli/register.ts`
- **Commit:** 4f1df06

## Known Stubs

- **`start.ts` --bind tailscale:** Falls back to `127.0.0.1` with an error message. Full Tailscale bind (D-17, D-19) lands in Plan 05. Explicit `TODO(Plan 05)` comment marks the replacement point for the Plan 05 executor.

## Threat Flags

None. All threat model items from the plan's STRIDE register are mitigated:
- T-01-04-01: `isProcessAlive(pid)` check before SIGTERM
- T-01-04-02: token in Authorization header, not URL
- T-01-04-03: --dry-run available for inspection before --yes
- T-01-04-04: `ensureAuthFile()` called at top of every command
- T-01-04-05: CIDR enforcement defaults ON for non-loopback
- T-01-04-06: mktemp HOME isolation in all subprocess tests
- T-01-04-09: commander argv, no shell spawning

## Self-Check: PASSED

Files verified:
- packages/agent/src/cli/discover.ts: FOUND
- packages/agent/src/cli/register.ts: FOUND
- packages/agent/src/cli/registryCmd.ts: FOUND
- packages/agent/src/cli/status.ts: FOUND
- packages/agent/src/cli/token.ts: FOUND
- packages/agent/src/cli/start.ts: FOUND
- packages/agent/src/cli/stop.ts: FOUND
- packages/agent/src/cli/__tests__/__shared__/spawnAgent.ts: FOUND
- packages/agent/src/cli/__tests__/start.subprocess.test.ts: FOUND
- packages/agent/src/cli/__tests__/stop.subprocess.test.ts: FOUND
- packages/agent/src/cli/__tests__/register.subprocess.test.ts: FOUND
- packages/agent/src/cli/__tests__/list-status.subprocess.test.ts: FOUND
- packages/agent/src/cli/__tests__/rotate-token.subprocess.test.ts: FOUND

Commits verified:
- f49c33e (test RED discover): FOUND
- d9ad470 (feat GREEN cli actions): FOUND
- 4f1df06 (feat subprocess tests + fixes): FOUND

Test results: 122 passed (23 files), 0 failed
TypeScript: clean (tsc --noEmit exits 0)
10 CLI commands: start stop status register unregister list rename tag rotate-token pair
Phase 0 contract: --version --json emits HealthResponseSchema-valid JSON
