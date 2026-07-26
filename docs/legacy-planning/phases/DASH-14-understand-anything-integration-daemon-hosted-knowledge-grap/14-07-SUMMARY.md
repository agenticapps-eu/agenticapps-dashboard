---
phase: 14-understand-anything-integration-daemon-hosted-knowledge-grap
plan: "07"
subsystem: agent/cli
tags: [tdd, cli, understand-viewer, security, execFile]
dependency_graph:
  requires: [14-02]
  provides: [install-understand-viewer CLI command]
  affects: [packages/agent/src/cli.ts, packages/agent/src/cli/installUnderstandViewer.ts]
tech_stack:
  added: []
  patterns:
    - execFile argv-array (no shell) for all subprocess calls (T-14-07-03)
    - Injectable _seams object (cacheDir, viewerDir, exec, cpSync) for test isolation
    - Post-build A1 guard: regex asserts dist/index.html has no root-absolute /assets/ refs
    - Dynamic import lazy-chunk pattern (mirrors install-launchd wiring in cli.ts)
key_files:
  created:
    - packages/agent/src/cli/installUnderstandViewer.ts
    - packages/agent/src/cli/installUnderstandViewer.test.ts
  modified:
    - packages/agent/src/cli.ts (install-understand-viewer command registration)
    - packages/agent/src/cli.test.ts (help-output assertion for new command)
decisions:
  - "execFile (argv arrays) over exec (shell string) for all subprocess calls — T-14-07-03 threat mitigation; security plugin confirmed this during implementation"
  - "exec seam signature is (cmd, args, opts?) matching execFile — clean argv-array interface without shell involvement"
  - "cli.test.ts help-output assertion normalises whitespace before matching — commander wraps long descriptions across lines"
  - "A1 guard uses regex /(?:src|href)=[\"']\\/assets\\//.test(html) — catches only root-absolute refs, allows relative ./assets/ and ../assets/"
metrics:
  duration: "~8 min"
  completed: "2026-06-07"
  tasks: 2
  files: 4
---

# Phase 14 Plan 07: install-understand-viewer CLI Command

`agentic-dashboard install-understand-viewer` — build the upstream understand-anything viewer from the plugin cache with `--base=./` and install it into `~/.agenticapps/dashboard/understand-viewer/<version>/`.

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Failing tests for runInstallUnderstandViewer | 319fc4b | installUnderstandViewer.test.ts |
| 1 (GREEN) | runInstallUnderstandViewer with injectable exec/fs seams | 3e059f0 | installUnderstandViewer.ts, installUnderstandViewer.test.ts |
| 2 (RED) | Failing test for install-understand-viewer command registration | ed69eef | cli.test.ts |
| 2 (GREEN) | cli.ts command registration | 918f3c4 | cli.ts, cli.test.ts |

## Verification Results

- `pnpm --filter @agenticapps/dashboard-agent test` — 104 test files, 995 tests passing, 1 skipped
- `pnpm --filter @agenticapps/dashboard-agent typecheck` — clean
- `node dist/cli.js --help | grep -c install-understand-viewer` — 1
- All 7 behavior tests (9 test cases including sub-cases) green

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug / Security] execFile argv arrays instead of exec shell string**

- **Found during:** Task 1 implementation (security plugin post-write hook)
- **Issue:** Initial draft used `exec(cmdString, opts)` with promisified `exec`. While no user input was interpolated, this still invokes a shell subprocess unnecessarily and violates T-14-07-03's "Fixed argv arrays" requirement.
- **Fix:** Switched to `execFile` (promisified) with explicit `(cmd, args[], opts?)` seam signature. Tests updated to use matching `(cmd: string, args: string[], opts?: { cwd?: string })` spy signature.
- **Files modified:** installUnderstandViewer.ts, installUnderstandViewer.test.ts
- **Commit:** 3e059f0

**2. [Rule 1 - Bug] cli.test.ts whitespace normalisation for Commander line-wrapping**

- **Found during:** Task 2 GREEN phase
- **Issue:** The `install-understand-viewer` description is 68 characters — Commander wraps it at terminal width, inserting newlines + leading spaces. `toContain('Build and install the understand-anything viewer from the plugin cache')` failed because the string was not a continuous substring in the help output.
- **Fix:** Normalise stdout whitespace with `.replace(/\s+/g, ' ')` before asserting the description string.
- **Files modified:** cli.test.ts
- **Commit:** 918f3c4

## Threat Surface Scan

No new network endpoints or auth paths introduced. The `install-understand-viewer` command:
- Runs as a one-shot CLI action (not a daemon route)
- Writes only to `~/.agenticapps/dashboard/understand-viewer/` (daemon-write boundary)
- Target path derived from `UNDERSTAND_VIEWER_DIR` constant + semver (regex-validated by viewerInstall)
- All subprocess calls use fixed argv arrays (no shell, no user-input interpolation)

T-14-07-02 and T-14-07-03 mitigations are implemented as specified.

## TDD Gate Compliance

Both tasks followed strict RED/GREEN cycle:
- Task 1: RED commit 319fc4b (module not found) → GREEN commit 3e059f0
- Task 2: RED commit ed69eef (command not in help) → GREEN commit 918f3c4

## Self-Check

### Created files exist:
- packages/agent/src/cli/installUnderstandViewer.ts: FOUND
- packages/agent/src/cli/installUnderstandViewer.test.ts: FOUND

### Modified files exist:
- packages/agent/src/cli.ts: FOUND (contains 'install-understand-viewer')
- packages/agent/src/cli.test.ts: FOUND

### Commits exist:
- 319fc4b (Task 1 RED): FOUND
- 3e059f0 (Task 1 GREEN): FOUND
- ed69eef (Task 2 RED): FOUND
- 918f3c4 (Task 2 GREEN): FOUND

## Self-Check: PASSED
