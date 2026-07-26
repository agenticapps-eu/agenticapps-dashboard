---
phase: 06
plan: 04
subsystem: agent-cli
tags: [install, launchd, macos, service, cli, tdd]
dependency_graph:
  requires:
    - packages/agent/src/cli.ts
    - packages/agent/src/lib/auth.ts
  provides:
    - packages/agent/src/cli/installLaunchd.ts
    - packages/agent/src/cli/installLaunchd.test.ts
    - packages/agent/src/cli/__tests__/install-launchd.subprocess.test.ts
  affects:
    - packages/agent/dist/cli.js
    - packages/agent/dist/installLaunchd-ZNMBLONB.js
tech_stack:
  added: []
  patterns:
    - inline TypeScript template literal for plist content (D-6-05)
    - tsup dynamic import chunk for CLI lazy-loading
    - tmpdir HOME isolation for unit + subprocess tests
key_files:
  created:
    - packages/agent/src/cli/installLaunchd.ts
    - packages/agent/src/cli/installLaunchd.test.ts
    - packages/agent/src/cli/__tests__/install-launchd.subprocess.test.ts
  modified:
    - packages/agent/src/cli.ts
decisions:
  - D-6-04: own subcommand (not --platform flag)
  - D-6-05: inline TypeScript template literal (no .plist file in repo)
  - D-6-06: idempotent + process.execPath + KeepAlive + logs 0700 + next-steps (no auto-load)
  - D-6-07: --uninstall flag for symmetry
  - resolveCliPath uses import.meta.url dirname + 'cli.js' (tsup sibling chunk in dist/, not '../cli.js')
metrics:
  duration_minutes: 7
  completed_date: "2026-05-10"
  tasks_completed: 2
  files_modified: 4
  tests_added: 17
---

# Phase 6 Plan 04: install-launchd SUMMARY

**One-liner:** macOS LaunchAgent installer via `agentic-dashboard install-launchd` — plist with KeepAlive, explicit PATH (Pitfall 1), process.execPath baked in, 0644 plist + 0700 log dir, prints next-steps, does not auto-load.

## What Was Built

### packages/agent/src/cli/installLaunchd.ts

Two exported symbols:

**`makePlist(nodeBinary, cliPath, logDir): string`** — pure function returning a complete Apple Property List (plist) XML document with:
- `Label`: `eu.agenticapps.dashboard`
- `ProgramArguments`: `[nodeBinary, cliPath, 'start']`
- `KeepAlive`: `<true/>` (D-6-06 auto-restart)
- `RunAtLoad`: `<false/>` (D-6-06 no auto-load — user runs `launchctl load` themselves)
- `StandardOutPath` / `StandardErrorPath`: `${logDir}/daemon.log` / `${logDir}/error.log`
- `EnvironmentVariables.PATH`: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin` (Pitfall 1)

**`runInstallLaunchd({ uninstall? }): Promise<void>`** — installs or removes the plist:
- Install: creates `~/Library/LaunchAgents/` (Pitfall 4: recursive), creates `~/.agenticapps/dashboard/logs/` at mode 0700, writes plist at mode 0644, prints next-steps including `launchctl load <path>`
- Uninstall: removes plist if present; silent no-op if absent (D-6-07)
- Idempotent: `writeFileSync` overwrites on second call; no duplication possible

### packages/agent/src/cli.ts

New `install-launchd` commander subcommand registered after `pair`, using the same dynamic import pattern as all other subcommands. The `--uninstall` option is wired to `InstallLaunchdOpts.uninstall`.

### packages/agent/src/cli/installLaunchd.test.ts

14 unit tests (7 `makePlist` + 7 `runInstallLaunchd`) running against a tmpdir-isolated HOME:

| Test group | Tests |
|------------|-------|
| makePlist: XML preamble + DOCTYPE | 1 |
| makePlist: Label correct | 1 |
| makePlist: ProgramArguments 3 entries | 1 |
| makePlist: KeepAlive true | 1 |
| makePlist: RunAtLoad false | 1 |
| makePlist: PATH includes /opt/homebrew/bin + /usr/local/bin | 1 |
| makePlist: log paths use logDir | 1 |
| runInstallLaunchd: plist exists + mode 0644 | 1 |
| runInstallLaunchd: logs dir exists + mode 0700 | 1 |
| runInstallLaunchd: process.execPath baked in | 1 |
| runInstallLaunchd: idempotent (no Label duplication) | 1 |
| runInstallLaunchd: --uninstall removes plist | 1 |
| runInstallLaunchd: --uninstall no-ops if missing | 1 |
| runInstallLaunchd: prints launchctl load in next-steps | 1 |

### packages/agent/src/cli/__tests__/install-launchd.subprocess.test.ts

3 subprocess tests spawning the built `dist/cli.js` with isolated HOME:

1. Full end-to-end: plist written + mode 0644 + content includes `eu.agenticapps.dashboard` + `process.execPath` + `/opt/homebrew/bin` + log dir 0700
2. `--uninstall` removes the plist
3. Idempotent: two consecutive installs leave exactly one `<key>Label</key>` in the plist

## Pitfall Mitigations Applied

| Pitfall | Mitigation |
|---------|------------|
| Pitfall 1: launchd minimal PATH | `EnvironmentVariables.PATH = /opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin` baked into plist |
| Pitfall 4: ~/Library/LaunchAgents may not exist on fresh macOS | `mkdirSync(launchAgentsDir, { recursive: true })` |
| Pitfall 5: process.argv[1] is source path in dev | `resolveCliPath()` uses `dirname(fileURLToPath(import.meta.url))` + `'cli.js'` — in the tsup bundle, `import.meta.url` points to the sibling chunk in `dist/`, so `resolve(here, 'cli.js')` correctly resolves to `dist/cli.js` |

## Test Count Delta

+17 tests: 14 unit + 3 subprocess

Before plan: 420 agent tests
After plan: 437 agent tests

## Decisions Made

1. **resolveCliPath targets sibling, not parent:** The plan comment said "from dist/cli/installLaunchd.js up to dist/cli.js" but tsup produces a flat `dist/installLaunchd-XXXX.js` chunk (no `cli/` subdirectory). Used `resolve(here, 'cli.js')` instead of `resolve(here, '..', 'cli.js')`. Verified by examining the actual build output chunk location.

2. **No `execa` version conflict:** The existing subprocess tests use `execa` via `spawnSync`. The new subprocess test uses `execa` directly (already a `noExternal` dependency in tsup.config.ts).

## Manual Reboot Validation: Deferred

Per D-6-22, reboot UAT is deferred to Phase 6 closure ritual (Plan 07 Task 2). The install command is verified end-to-end by the subprocess tests; the launchd auto-start-on-reboot behavior requires a full macOS reboot cycle which cannot be automated in CI.

## Native Dependencies: None Added

Only node built-ins used: `node:fs`, `node:os`, `node:path`, `node:url`. INV-05 (no native deps) preserved.

## Deviations from Plan

**1. [Rule 1 - Bug] resolveCliPath: `../cli.js` → `cli.js`**
- **Found during:** Task 1 GREEN implementation, verified against actual tsup output
- **Issue:** Plan comment assumed tsup would produce `dist/cli/installLaunchd.js` (nested). Actual tsup output is a flat sibling chunk `dist/installLaunchd-XXXX.js`. Using `resolve(here, '..', 'cli.js')` would produce `packages/agent/cli.js` (not in dist/), breaking the plist at runtime.
- **Fix:** Changed to `resolve(here, 'cli.js')` — from the chunk's `dist/` directory, resolves correctly to `dist/cli.js`
- **Files modified:** `packages/agent/src/cli/installLaunchd.ts`
- **Commit:** a3633b2

## Self-Check: PASSED

Checking created files:
- FOUND: packages/agent/src/cli/installLaunchd.ts
- FOUND: packages/agent/src/cli/installLaunchd.test.ts
- FOUND: packages/agent/src/cli/__tests__/install-launchd.subprocess.test.ts

Checking commits:
- FOUND: 491e343 (RED: test(06-04): install-launchd makePlist + runInstallLaunchd unit tests)
- FOUND: a3633b2 (GREEN: feat(06-04): install-launchd makePlist + runInstallLaunchd handler)
- FOUND: eea6792 (feat(06-04): wire install-launchd commander subcommand + subprocess test)

Test suite: 14 unit tests PASS, 3 subprocess tests PASS, 437 total agent tests PASS
