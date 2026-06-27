---
phase: 08-optional-integration-panels
plan: "02"
subsystem: agent-primitives
tags: [outbound-http, env-file, tdd, security, daemon]
dependency_graph:
  requires:
    - 08-01 (EnvFileSchema, AllowedEnvKeySchema, EnvFile type from packages/shared)
  provides:
    - fetchWithTimeout (5s timeout, no retry, Node 22 global fetch)
    - classifyError (9-row mapping: AbortError/TypeError/401/403/429/Linear-400-RATELIMITED/404/5xx/catch-all)
    - CacheEntry<T> with optional lastGood sub-entry (D-08-09)
    - loadEnvFile (process.env-wins merge, assertSecurePermissions, parseOrCorrupt)
    - writeEnvFile (EnvFileSchema.parse + ensureConfigDir + atomicWriteFile at 0o600)
    - readEnvFile (null-when-absent, permission check, for CLI env list)
    - ENV_FILE constant (join(CONFIG_DIR, 'env.json'))
    - ensureConfigDir export from auth.ts (unchanged behavior)
    - ./daemon subpath export in shared package (daemon-only schemas, no browser surface)
  affects:
    - packages/agent/src/constants.ts (ENV_FILE added)
    - packages/agent/src/lib/auth.ts (ensureConfigDir exported)
    - packages/shared/package.json (./daemon subpath export + build entry)
    - packages/shared/src/daemon.ts (new barrel for daemon-only schemas)
    - downstream Wave 3 routes (sentry.ts, linear.ts) consume fetchWithTimeout + classifyError
    - downstream Wave 3/4 CLI (envCmd.ts, start.ts) consume loadEnvFile/writeEnvFile/readEnvFile
tech_stack:
  added: []
  patterns:
    - fetchWithTimeout with AbortController + clearTimeout-in-finally (mirrors atomicWrite.ts discipline)
    - classifyError 3-category collapse (INV-05 / D-08-11) — raw body never returned to SPA
    - CacheEntry<T> generic with optional lastGood sub-entry (D-08-09)
    - envFile mirrors auth.ts discipline exactly (assertSecurePermissions + atomicWriteFile + parseOrCorrupt + ensureConfigDir)
    - process.env-wins merge (D-08-12 / INFI-01): !(key in process.env) guard
    - ./daemon subpath export pattern for daemon-only shared schemas (avoids rootDir crossing)
key_files:
  created:
    - packages/agent/src/lib/outboundFetch.ts
    - packages/agent/src/lib/outboundFetch.test.ts
    - packages/agent/src/lib/envFile.ts
    - packages/agent/src/lib/envFile.test.ts
    - packages/shared/src/daemon.ts
  modified:
    - packages/agent/src/constants.ts
    - packages/agent/src/lib/auth.ts
    - packages/shared/package.json
decisions:
  - "./daemon subpath export in shared — avoids rootDir violation from direct relative path across package boundary; keeps env.ts absent from the browser-facing index.ts (T-08-01/INV-05)"
  - "EnvFile imported via @agenticapps/dashboard-shared/daemon (not relative path) — tsc rootDir enforcement requires package-boundary crossing to go through exports map"
  - "isLinearRateLimited() private helper inside classifyError — Linear 400+RATELIMITED detection is encapsulated, not exposed as a separate export (Pitfall 1)"
metrics:
  duration: "~8 min"
  completed: "2026-06-11"
  tasks: 3
  files: 8
---

# Phase 8 Plan 02: Outbound Fetch + Env File Primitives Summary

Daemon primitives for Phase 8 outbound egress and secrets-on-disk: `outboundFetch.ts` encapsulates all HTTP risk (timeout, no-retry, sanitized error classification, last-good retention); `envFile.ts` mirrors `auth.ts` security discipline exactly for env.json (0600, symlink-reject, atomic-write, process.env-wins merge). Wave 3 routes and CLI consume tested helpers — no re-implementation.

## What Was Built

**packages/agent/src/lib/outboundFetch.ts**
- `fetchWithTimeout(url, init, timeoutMs=5000)`: Node 22 global `fetch` + `AbortController`; `clearTimeout` runs in `finally` whether fetch resolves or throws (mirrors `atomicWrite.ts` discipline). No retry (D-08-08).
- `classifyError(err, status?, body?)`: collapses every upstream condition to `'unreachable' | 'unauthorized' | 'rate-limited'`. Covers all 9 mapping rows including Linear's non-standard HTTP 400+`RATELIMITED` extensions code (Pitfall 1). Raw body never returned by the helper to SPA responses (INV-05).
- `CacheEntry<T>`: generic interface extending `integrations.ts` inline shape with optional `lastGood` sub-entry for D-08-09 last-good retention beyond TTL expiry.

**packages/agent/src/lib/envFile.ts**
- `loadEnvFile(filePath?)`: early-return on absent file (INV-03); `assertSecurePermissions` before read (T-08-06, reused from auth.ts — lstat symlink rejection); `parseOrCorrupt(EnvFileSchema)` for schema validation; sets `process.env[key] = value` only when `!(key in process.env)` (D-08-12 / INFI-01). Throws `StateCorruptionError` on bad JSON/schema — caller (`runStart`) wraps in try/catch (Pitfall 4).
- `writeEnvFile(data, filePath?)`: `EnvFileSchema.parse(data)` validates allow-list before touching disk; `ensureConfigDir(dirname(filePath))` (reused from auth.ts); `atomicWriteFile(filePath, …, 0o600)` (T-08-07).
- `readEnvFile(filePath?)`: null when absent, same permission check as loadEnvFile, for CLI `env list`.

**packages/agent/src/constants.ts**
- `ENV_FILE = join(CONFIG_DIR, 'env.json')` added after `AUTH_FILE`.

**packages/agent/src/lib/auth.ts**
- `ensureConfigDir` changed from private `function` to `export function` — behavior unchanged; callers `writeAuthFile` and `ensureAuthFile` within auth.ts continue to work identically.

**packages/shared/src/daemon.ts + package.json**
- New `./daemon` subpath export exposing `ALLOWED_ENV_KEYS`, `AllowedEnvKeySchema`, `EnvFileSchema`, `EnvFile` type — daemon-only, no browser surface (T-08-01).
- Build script updated to include `src/daemon.ts` as a second entry point.

## TDD Gate Compliance

Both TDD tasks followed strict RED → GREEN flow:

| Gate | Task 2 (outboundFetch) | Task 3 (envFile) |
|------|------------------------|-----------------|
| RED commit | `test(08-02): add RED tests for outboundFetch` (8dd8725) | `test(08-02): add RED tests for envFile` (45882be) |
| GREEN commit | `feat(08-02): implement outboundFetch` (4371aa1) | `feat(08-02): implement envFile` (9092b7c) |

Task 1 (`type="auto"`, no TDD gate required).

## Verification

- `pnpm --filter @agenticapps/dashboard-agent typecheck`: clean (0 errors)
- `pnpm --filter @agenticapps/dashboard-agent test`: 108 test files, 1151 tests pass (1 pre-existing skip)
- `pnpm --filter @agenticapps/dashboard-shared test`: 25 test files, 370 tests pass
- `pnpm lint`: 0 errors (229 pre-existing warnings, none from this plan)
- No new dependencies in `packages/agent/package.json` (INV-02 confirmed)
- `grep -c "assertSecurePermissions" envFile.ts` → 6 (reused, not reimplemented)
- `grep -c "lstatSync" envFile.ts` (non-comment) → 0 (delegated to auth.ts)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS2532 strict array-index in outboundFetch.test.ts**
- **Found during:** Task 2 GREEN typecheck
- **Issue:** `capturedInits[0].signal` flagged as possibly undefined under `noUncheckedIndexedAccess`
- **Fix:** Changed `capturedInits: RequestInit[]` array to `capturedInit: RequestInit | undefined` variable; assertion uses optional chaining `capturedInit?.signal`
- **Files modified:** `packages/agent/src/lib/outboundFetch.test.ts`
- **Commit:** 4371aa1 (included in GREEN commit)

**2. [Rule 3 - Blocking] rootDir violation from deep relative import of env.ts**
- **Found during:** Task 3 GREEN implementation
- **Issue:** `import from '../../../shared/src/schemas/env.js'` crosses tsc `rootDir` boundary (TS6059). The env schema is intentionally excluded from `packages/shared/src/index.ts` (T-08-01/INV-05), so `@agenticapps/dashboard-shared` doesn't expose it.
- **Fix:** Added `packages/shared/src/daemon.ts` barrel + `./daemon` subpath export to `packages/shared/package.json`; updated build script to include `src/daemon.ts` as second entry point; import uses `@agenticapps/dashboard-shared/daemon`.
- **Files modified:** `packages/shared/src/daemon.ts` (new), `packages/shared/package.json`
- **Commit:** 9092b7c (included in GREEN commit)
- **Why not Rule 4:** New export entry in package.json + one-file barrel is not an architectural change (no new table, service, or breaking API change). It is a required mechanical step to cross a package boundary correctly.

**3. [Rule 1 - Bug] Unused mkdirSync import in envFile.test.ts**
- **Found during:** Task 3 lint run
- **Issue:** `mkdirSync` imported but never used in test file — ESLint `no-unused-vars` error
- **Fix:** Removed from import list
- **Files modified:** `packages/agent/src/lib/envFile.test.ts`
- **Commit:** 9092b7c (included in GREEN commit)

## Threat Surface Scan

All new surfaces are covered by the plan's threat model:
- T-08-04/05: `classifyError` collapses upstream errors to 3 categories; no raw body or token value logged/returned — confirmed in implementation.
- T-08-06: `loadEnvFile` calls `assertSecurePermissions` before read — symlink swap prevented.
- T-08-07: `writeEnvFile` uses `atomicWriteFile` at 0o600 — no partial-write window.
- T-08-08: `parseOrCorrupt` throws; caller must wrap (deferred to Plan 08-04 `runStart` wiring).
- T-08-SC: Zero new npm packages (INV-02). `fetch` and `AbortController` are Node 22 built-ins.

No new threat surfaces beyond the plan's model.

## Self-Check

**Files created/exist:**
- `packages/agent/src/lib/outboundFetch.ts` — FOUND
- `packages/agent/src/lib/outboundFetch.test.ts` — FOUND
- `packages/agent/src/lib/envFile.ts` — FOUND
- `packages/agent/src/lib/envFile.test.ts` — FOUND
- `packages/shared/src/daemon.ts` — FOUND

**Commits (all on gsd/phase-08-optional-integration-panels):**
- 56cf1a8 — feat: ENV_FILE constant + ensureConfigDir export
- 8dd8725 — test: RED outboundFetch
- 4371aa1 — feat: GREEN outboundFetch
- 45882be — test: RED envFile
- 9092b7c — feat: GREEN envFile + daemon subpath export
