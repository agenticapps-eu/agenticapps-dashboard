---
phase: 08-optional-integration-panels
plan: "04"
subsystem: agent-cli-env-infisical
tags: [cli, env-file, tdd, security, infisical, redaction]
dependency_graph:
  requires:
    - 08-01 (ALLOWED_ENV_KEYS, AllowedEnvKeySchema, IntegrationsResponseSchema INFI-03 fields)
    - 08-02 (loadEnvFile, writeEnvFile, readEnvFile, ENV_FILE)
  provides:
    - runEnvSet (allow-list validation, 0600 merge-write, restart hint)
    - runEnvUnset (allow-list validation, 0600 rewrite)
    - runEnvList (key + set/unset + source + masked last-4, never full value)
    - loadEnvFile wired into daemon boot (try/catch — corrupt file never blocks start)
    - infisicalWorkspaceId + infisicalEnvironment in GET /api/projects/:id/integrations (INFI-03)
  affects:
    - packages/agent/src/cli.ts (env command + set/list/unset subcommands registered)
    - packages/agent/src/cli/start.ts (loadEnvFile at boot, after ensureViewerSecretFile)
    - packages/agent/src/routes/integrations.ts (INFI-03 scope spread in value object)
tech_stack:
  added: []
  patterns:
    - process.exit() outside try/catch in CLI commands (avoids test-mode catch interference)
    - padEnd tabular output (mirrors registryCmd.ts runList)
    - conditional spread for optional INFI-03 fields (backward-compatible, INV-03)
    - try/catch around loadEnvFile at boot (D-08-15 / Pitfall 4 — daemon never blocked)
key_files:
  created:
    - packages/agent/src/cli/envCmd.ts
    - packages/agent/src/cli/envCmd.test.ts
  modified:
    - packages/agent/src/cli.ts
    - packages/agent/src/cli/start.ts
    - packages/agent/src/routes/integrations.ts
    - packages/agent/src/routes/integrations.test.ts
decisions:
  - "process.exit() placed outside try/catch in runEnvSet/runEnvUnset — mocked exit throws, which would be caught by catch and re-exit(1) if placed inside; discovered during GREEN iteration"
  - "infisicalEnvironment conditionally spread only when defaultEnvironment !== undefined (not just present-valid state) — parseInfisicalConfig returns optional defaultEnvironment"
  - "runEnvList reads env.json separately via readEnvFile (not loadEnvFile) — CLI list must not merge into process.env as a side effect"
metrics:
  duration: "~9 min"
  completed: "2026-06-11"
  tasks: 3
  files: 6
---

# Phase 8 Plan 04: env CLI + boot wiring + INFI-03 integrations scope Summary

env set/list/unset CLI with allow-list enforcement and 0600 security discipline; loadEnvFile wired at daemon boot under try/catch so corrupt env.json never blocks start; GET /api/projects/:id/integrations extended with read-only Infisical scope (workspaceId + defaultEnvironment) when .infisical.json is present-valid.

## What Was Built

**packages/agent/src/cli/envCmd.ts**
- `runEnvSet(key, value, filePath?)`: `AllowedEnvKeySchema.safeParse` rejects unknown keys with named allowed list; reads existing env.json (or seeds empty `{version:1,vars:{}}`); merges key; `writeEnvFile` at 0600; prints restart hint. Full value is NEVER logged (INV-05 / D-08-14).
- `runEnvUnset(key, filePath?)`: same allow-list guard; deletes key from vars; rewrites env.json at 0600.
- `runEnvList(filePath?)`: tabular padEnd output — key (25) | set/unset (6) | source: process.env/env.json/— (12) | masked last-4 (`****xxxx`) or `—`. Full values never printed at any log level.

**packages/agent/src/cli.ts**
- `env` command registered with `set <key> <value>`, `list`, `unset <key>` subcommands using commander chaining pattern (mirrors rotate-token/pair style).

**packages/agent/src/cli/start.ts**
- `loadEnvFile()` inserted after `ensureViewerSecretFile()` and before `shouldAutoRotate(auth)`, wrapped in try/catch. On error: `agentError(...)` is called and the daemon continues — boot is never blocked (D-08-15 / Pitfall 4).

**packages/agent/src/routes/integrations.ts**
- INFI-03: value object extended with conditional spread: `infisicalWorkspaceId` and `infisicalEnvironment` only when `infisicalConfig.state === 'present-valid'`. `infisicalEnvironment` additionally guarded by `!== undefined` since `parseInfisicalConfig` makes `defaultEnvironment` optional. Existing sentry/linear/infisical three-state fields completely unchanged (backward-compatible, INV-03).

## TDD Gate Compliance

Both TDD tasks followed strict RED → GREEN flow:

| Gate | Task 1 (envCmd) | Task 3 (INFI-03) |
|------|-----------------|------------------|
| RED commit | `test(08-04): add RED tests for env set/list/unset CLI — allow-list, 0600, redaction` (df91e23) | `test(08-04): add RED tests for INFI-03 scope fields in integrations route (I11/I12/I13)` (5e3e9f2) |
| GREEN commit | `feat(08-04): implement env set/list/unset CLI — allow-list, 0600 writes, redacted output (GREEN)` (4711509) | `feat(08-04): INFI-03 — spread infisicalWorkspaceId + infisicalEnvironment into integrations response (GREEN)` (bc8148f) |

Task 2 (`type="auto"`, no TDD gate required).

## Verification

- `pnpm --filter @agenticapps/dashboard-agent test envCmd`: 10 tests pass
- `pnpm --filter @agenticapps/dashboard-agent test integrations`: 19 tests pass (10 existing + 3 new INFI-03)
- `pnpm --filter @agenticapps/dashboard-agent typecheck`: clean (0 errors)
- `pnpm lint`: 0 errors
- `grep -c "command('env')" packages/agent/src/cli.ts` → 1
- `grep -c "loadEnvFile" packages/agent/src/cli/start.ts` → 2 (import + call)
- `app.ts` and `sentry.ts` NOT modified (constraint respected)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] process.exit() inside try block caught by mocked exit in tests**
- **Found during:** Task 1 GREEN — E2 and E4 tests exited with code 1 instead of 0
- **Issue:** In test mode `process.exit` is mocked to throw. The throw from `process.exit(0)` inside a `try` block was caught by the `catch (err)` clause, which then called `agentError` and `process.exit(1)`.
- **Fix:** Moved `agentLog(...)` + `process.exit(0)` calls outside the try/catch in `runEnvSet` and `runEnvUnset`, keeping only the actual I/O operations inside try.
- **Files modified:** `packages/agent/src/cli/envCmd.ts`
- **Commit:** 4711509

**2. [Rule 1 - Bug] Missing `runEnvList` in E4 test destructure**
- **Found during:** Task 1 GREEN — E4 test reported `sentryRow` undefined
- **Issue:** E4 only destructured `{ runEnvSet, runEnvUnset }` from `getEnvCmd()` but called `runEnvList(envPath)` which was undefined (ReferenceError caught silently by `callWithExit`).
- **Fix:** Added `runEnvList` to destructure in E4.
- **Files modified:** `packages/agent/src/cli/envCmd.test.ts`
- **Commit:** 4711509

**3. [Rule 1 - Bug] TS2532 noUncheckedIndexedAccess on mock.calls array access**
- **Found during:** Task 1 typecheck
- **Issue:** `mockedAgentError.mock.calls[0][0]` flagged as possibly undefined under `noUncheckedIndexedAccess`.
- **Fix:** Cast via `(mock.calls[0] as unknown[])[0] as string` pattern (same fix used in Plan 02).
- **Files modified:** `packages/agent/src/cli/envCmd.test.ts`
- **Commit:** 4711509

**4. [Rule 1 - Bug] Unused `mockExit` variable triggers ESLint no-unused-vars error**
- **Found during:** Post-implementation lint run
- **Issue:** `const mockExit = vi.spyOn(...)` — value assigned but never used; ESLint `@typescript-eslint/no-unused-vars` requires `_`-prefix for intentional discards.
- **Fix:** Renamed to `_mockExit`.
- **Files modified:** `packages/agent/src/cli/envCmd.test.ts`
- **Commit:** 969fe9a

## Known Stubs

None — all three deliverables are fully wired with real data sources.

## Threat Surface Scan

All new surfaces are covered by the plan's threat model:

| Flag | File | Description |
|------|------|-------------|
| T-08-14 mitigated | `cli/envCmd.ts` | `AllowedEnvKeySchema.safeParse` rejects unknown keys — env.json cannot become a general secret dump |
| T-08-15 mitigated | `cli/envCmd.ts` | `runEnvList` shows only last-4 masked; full value never in any log call; tested with `expect(row).not.toContain(fullValue)` |
| T-08-16 accepted | `routes/integrations.ts` | workspaceId + defaultEnvironment are config identifiers, not secrets (Research Finding 8) |
| T-08-17 mitigated | `cli/start.ts` | loadEnvFile wrapped in try/catch; daemon continues on corruption |
| T-08-18 mitigated | `cli/envCmd.ts` | writeEnvFile (Plan 02) uses atomicWriteFile 0o600 — inherited |

No new threat surfaces beyond the plan's model.

## Self-Check

**Files created/exist:**
- `packages/agent/src/cli/envCmd.ts` — FOUND
- `packages/agent/src/cli/envCmd.test.ts` — FOUND

**Files modified:**
- `packages/agent/src/cli.ts` — env command registered
- `packages/agent/src/cli/start.ts` — loadEnvFile wired
- `packages/agent/src/routes/integrations.ts` — INFI-03 scope spread
- `packages/agent/src/routes/integrations.test.ts` — I11/I12/I13 added

**Commits (all on gsd/phase-08-optional-integration-panels):**
- df91e23 — test: RED envCmd tests
- 4711509 — feat: GREEN envCmd implementation
- f2f5b27 — feat: cli.ts + start.ts wiring
- 5e3e9f2 — test: RED INFI-03 tests
- bc8148f — feat: GREEN INFI-03 implementation
- 969fe9a — fix: lint unused mockExit

## Self-Check: PASSED
