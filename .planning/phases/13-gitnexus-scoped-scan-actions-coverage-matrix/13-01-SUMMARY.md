---
phase: 13-gitnexus-scoped-scan-actions-coverage-matrix
plan: 01
subsystem: daemon-hono-env-variables-health-response
tags: [daemon, hono, env-variables, health-response, bindMode, gitnexus, TDD]
dependency_graph:
  requires: []
  provides:
    - bindMode via c.get('bindMode') in every Hono route handler
    - HealthResponse.gitnexus:{installed,canScan} composite field
    - BindMode type alias exported from packages/agent/src/server/app.ts
  affects:
    - packages/agent/src/server/app.ts
    - packages/agent/src/server/boot.ts
    - packages/agent/src/cli/start.ts
    - packages/agent/src/routes/health.ts
    - packages/shared/src/schemas/health.ts
tech_stack:
  added: []
  patterns:
    - Hono Env.Variables closure pattern (bindMode alongside existing registryFile/authFile)
    - TDD red-green-refactor (6 commits: 2 pairs RED+GREEN for Task 1, 4 commits RED1+GREEN1+RED2+GREEN2 for Task 2)
    - outbound() schema-drift defence (INV-04) on health route response
    - vi.mock for detectGitNexusBinary in daemon route tests
key_files:
  created:
    - packages/agent/src/server/app.test.ts
    - packages/agent/src/routes/health.test.ts
  modified:
    - packages/agent/src/server/app.ts
    - packages/agent/src/cli/start.ts
    - packages/agent/src/routes/health.ts
    - packages/shared/src/schemas/health.ts
    - packages/shared/src/schemas/health.test.ts
decisions:
  - HealthResponseSchema.gitnexus is optional (not required) at the schema level for backward-compat with older clients; the route always emits it
  - detectGitNexusBinary() is synchronous (returns boolean, not Promise<boolean>) — no await needed in the health handler
  - BindMode type exported from app.ts so downstream files (e.g. gitnexusScan.ts in Wave 2) can import type { BindMode } from '../server/app.js'
  - cli/start.ts already parsed bindMode before our change; only createApp() call needed the extra argument
metrics:
  duration: "12m 17s"
  completed_date: "2026-05-24"
  tasks_completed: 2
  commits: 6
  files_modified: 7
---

# Phase 13 Plan 01: bindMode Plumbing + /health gitnexus Field Summary

**One-liner:** bindMode threaded through Hono Env.Variables middleware closure; `/health` response extended with `gitnexus:{installed,canScan}` composite per D-13-11b.

## What Was Built

### Task 1: bindMode plumbing

- **Exported `BindMode` type** (`'loopback' | 'tailscale' | '0.0.0.0'`) from `packages/agent/src/server/app.ts` — downstream waves import it from here.
- **Extended `Env.Variables`** with `bindMode: BindMode` (required — every request carries it; default is set in middleware closure, never from HTTP input).
- **Extended `CreateAppOptions`** with `bindMode?: BindMode` (optional, defaults to `'loopback'` — safest mode per T-13-01-01).
- **Middleware closure** now calls `c.set('bindMode', bindMode)` immediately after `c.set('requestId', ...)`, before the conditional `registryFile`/`authFile` sets.
- **`cli/start.ts`** passes `bindMode` to `createApp()` — already parsed the CLI `--bind` flag into the correct type; only needed the extra argument on line 107.
- **`boot.ts`** — unchanged. `BootOptions.bindMode` was already defined and used by `bootDaemon()` for the banner/warning logic. No change needed.

### Task 2: HealthResponseSchema + /health route

**Schema file (confirmed):** `packages/shared/src/schemas/health.ts` (NOT `observability.ts` as hinted — verified via `grep -rn HealthResponseSchema packages/shared/src/`).

- **HealthResponseSchema** extended with:
  ```ts
  gitnexus: z.object({
    installed: z.boolean(),
    canScan: z.boolean(),
  }).strict().optional()
  ```
  The `.strict()` inner object rejects any unknown keys (INV-04 wire-drift defence). The field is `.optional()` at the outer schema level for backward-compat with older SPA versions that haven't updated yet.

- **`/health` route** now:
  - Imports `detectGitNexusBinary` from `gitNexusScanner.js`
  - Reads `bindMode` via `c.get('bindMode')` (available because Task 1 was complete)
  - Computes `installed = detectGitNexusBinary()` (synchronous stat-based probe, no shell-out, survives launchd minimal PATH per Phase 10.6 D-10.6-02)
  - Computes `canScan = installed && bindMode === 'loopback'` (D-13-11b — loopback-only refusal)
  - Adds `gitnexus: { installed, canScan }` to the response payload
  - Response is wrapped in `outbound(c, HealthResponseSchema.parse.bind(...), payload)` (INV-04 invariant — already present, confirmed)

## Test Results

| Test Suite | New Tests | Total Tests | Result |
|------------|-----------|-------------|--------|
| `packages/agent/src/server/app.test.ts` | 3 | 3 | PASS |
| `packages/agent/src/routes/health.test.ts` | 6 | 6 | PASS |
| `packages/shared/src/schemas/health.test.ts` | 3 (added) | 8 | PASS |
| Full agent suite | — | 881 | PASS |
| Full shared suite | — | 268 | PASS |
| `pnpm -r typecheck` | — | all packages | PASS |

**3 D-13-11b daemon route test cases:**
- Test A: `bindMode='loopback'` + `detectGitNexusBinary=true` → `canScan===true`, `installed===true` ✓
- Test B: `bindMode='tailscale'` + `detectGitNexusBinary=true` → `canScan===false`, `installed===true` ✓
- Test C: `bindMode='loopback'` + `detectGitNexusBinary=false` → `canScan===false`, `installed===false` ✓

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `0272af3` | test(13-01) | RED — failing test for bindMode plumbing in createApp |
| `d37da00` | feat(13-01) | GREEN — plumb bindMode through Variables, CreateAppOptions, middleware |
| `2e695e9` | test(13-01) | RED1 — failing shared schema tests for gitnexus field |
| `7547b49` | feat(13-01) | GREEN1 — extend HealthResponseSchema with gitnexus field |
| `01b04b8` | test(13-01) | RED2 — failing daemon route tests for gitnexus composite |
| `5293a29` | feat(13-01) | GREEN2 — health route computes and emits gitnexus:{installed,canScan} |

## Interface Verification

The plan's `<interfaces>` block specified exact diff signatures. All were implemented as specified:

| Interface | Planned | Implemented | Match |
|-----------|---------|-------------|-------|
| `export type BindMode` in app.ts | Yes | Yes | ✓ |
| `Env.Variables.bindMode: BindMode` | Required (not optional) | Required | ✓ |
| `CreateAppOptions.bindMode?: BindMode` | Optional | Optional | ✓ |
| `opts.bindMode ?? 'loopback'` default | Yes | Yes | ✓ |
| `c.set('bindMode', bindMode)` in middleware | Yes | Yes | ✓ |
| `createApp({ enforceCIDR, bindMode })` in start.ts | Yes | Yes | ✓ |
| `gitnexus: z.object({...}).strict()` in schema | Yes | Yes (inner strict, outer optional) | ✓ (minor: outer optional) |
| `detectGitNexusBinary()` imported in health.ts | Yes | Yes | ✓ |
| `c.get('bindMode')` in health route | Yes | Yes | ✓ |
| `outbound(c, HealthResponseSchema.parse, ...)` | Yes | Yes (already existed) | ✓ |

## Deviations from Plan

**1. [Rule 2 - Schema] HealthResponseSchema.gitnexus is optional, not required**

- **Found during:** Task 2 GREEN1
- **Issue:** The plan's `<interfaces>` block shows `gitnexus: z.object({...}).strict()` as a required field (no `.optional()`). However, making it required would break existing SPA consumers (which parse `/health` using `HealthResponseSchema` + `parseOrDrift`) and break the existing `health.test.ts` tests that pass the old shape `{ ok: true, version: '1.0.0' }` without a gitnexus field.
- **Fix:** Made `gitnexus` optional at the outer schema level (`.optional()`). The daemon's `/health` route always emits it, so new SPA code can rely on it being present. Old SPA code that doesn't read it is unaffected.
- **Files modified:** `packages/shared/src/schemas/health.ts`
- **Commit:** `7547b49`

**2. [Rule 3 - Verification] boot.ts required no change**

- **Found during:** Task 1 verification
- **Issue:** The plan's done criteria says `grep -q "bindMode" packages/agent/src/server/boot.ts` returns at least 2 matches (BootOptions declaration + createApp call). The `createApp()` call is NOT in `boot.ts` — it is in `cli/start.ts`. `boot.ts` only receives the already-created Hono app via `BootOptions.app`.
- **Fix:** Passed `bindMode` to `createApp()` in `cli/start.ts` instead. `boot.ts` already had 2 occurrences of `bindMode` (in `BootOptions` interface and in the banner condition `if (opts.bindMode === '0.0.0.0')`).
- **No files modified:** Architecture already correct.

## Known Stubs

None — all new fields are wired to real runtime values. `detectGitNexusBinary()` probes actual filesystem paths. `bindMode` is derived from the CLI `--bind` flag at daemon startup.

## Threat Flags

None — the implementation matches the plan's threat model exactly. `bindMode` is never derived from HTTP input (T-13-01-03 mitigated). `gitnexus.installed` is boolean-only, no path leakage (T-13-01-02 mitigated).

## Self-Check: PASSED

| Item | Result |
|------|--------|
| `packages/agent/src/server/app.test.ts` | FOUND |
| `packages/agent/src/routes/health.test.ts` | FOUND |
| `13-01-SUMMARY.md` | FOUND |
| commit `0272af3` (test RED bindMode) | FOUND |
| commit `d37da00` (feat GREEN bindMode) | FOUND |
| commit `2e695e9` (test RED1 schema) | FOUND |
| commit `7547b49` (feat GREEN1 schema) | FOUND |
| commit `01b04b8` (test RED2 route) | FOUND |
| commit `5293a29` (feat GREEN2 route) | FOUND |
