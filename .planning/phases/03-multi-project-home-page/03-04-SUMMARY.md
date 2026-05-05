---
phase: 03-multi-project-home-page
plan: 04
subsystem: daemon/registry
tags: [prepare-confirm, nonce, rate-limit, confused-deputy, wave-1]
dependency_graph:
  requires:
    - "03-01 (Wave 0: shared schemas + daemon lib stubs)"
  provides:
    - "POST /api/registry/register-prepare (D-09..D-14, D-17)"
    - "POST /api/registry/register-confirm (D-09, D-10, D-18, D-33)"
    - "canonicaliseRoot exported from packages/agent/src/lib/registry.ts"
  affects:
    - "Wave 2 SPA register modal must call prepare→confirm (not /register directly per D-12)"
    - "packages/agent/src/routes/registry.ts (new handlers appended)"
tech_stack:
  added:
    - "registerNonces.ts: in-memory nonce store with 5-min TTL + crypto.randomBytes"
    - "rateLimiter.ts: sliding 10s/10-burst window per tokenHash"
    - "registerLog.ts: D-15 single-line stderr BLOCKED audit log"
    - "overviewCache.ts: 5s in-process memo cache for /overview"
    - "projectOverview.ts: filesystem reader composing phaseStatus/stage1/stage2/tdd/branch/markers"
    - "packages/shared/src/schemas/overview.ts: ProjectOverviewSchema + sub-schemas"
    - "packages/shared/src/schemas/registry.ts: RegisterPrepare/Confirm/Rename/Tags schemas"
  patterns:
    - "option-C confused-deputy prepare/confirm with single-use nonce (D-09)"
    - "outbound() schema-drift defense on all response shapes (Phase 1 D-16)"
    - "defense-in-depth: assertRegistrationAllowed runs on both prepare AND confirm"
key_files:
  created:
    - packages/shared/src/schemas/overview.ts
    - packages/agent/src/lib/registerNonces.ts
    - packages/agent/src/lib/rateLimiter.ts
    - packages/agent/src/lib/registerLog.ts
    - packages/agent/src/lib/overviewCache.ts
    - packages/agent/src/lib/projectOverview.ts
    - packages/agent/src/server/__tests__/registry-prepare-confirm.test.ts
  modified:
    - packages/shared/src/schemas/registry.ts
    - packages/shared/src/index.ts
    - packages/agent/src/lib/registry.ts
    - packages/agent/src/routes/registry.ts
decisions:
  - "canonicaliseRoot now exported — marked with JSDoc noting Phase 3 D-09 reason"
  - "Wave 0 libs (registerNonces/rateLimiter/registerLog/overviewCache/projectOverview) implemented directly in this plan since Wave 0 agent (03-01) runs in parallel"
  - "registry-prepare-confirm.test.ts placed in server/__tests__/ (integration, uses createApp) not lib/ (unit)"
  - "projectOverview.ts uses ?? '' for fmMatch[1] to satisfy TS strict noUncheckedIndexedAccess"
metrics:
  duration: "~45 minutes"
  completed: "2026-05-04T16:44:44Z"
  tasks: 2
  files: 11
---

# Phase 3 Plan 4: Register Prepare/Confirm Routes Summary

**One-liner:** Confused-deputy option C prepare/confirm flow — two POST routes with in-memory nonce (32-char hex, 5-min TTL, single-use), sliding rate limiter (10 calls/10s/token → 429), defense-in-depth assertRegistrationAllowed on confirm, plus the Wave 0 daemon library foundation they depend on.

## What Was Built

### Task 1: register-prepare route + Wave 0 daemon libs

`POST /api/registry/register-prepare` — the SPA calls this with `{ path }` before registering any project. The handler:

1. **Rate-limits** via `rateLimiter.ts`: 10 calls per 10-second window per bearer token hash; 11th call → 429 with `Retry-After: 1`.
2. **Canonicalises** the path via the now-exported `canonicaliseRoot` (realpath + resolve fallback).
3. **Already-registered check**: returns `{ alreadyRegistered: true, existingEntry }` — no nonce issued.
4. **Blocked check** via `assertRegistrationAllowed`: returns `{ blocked: true, blockedReason }` — no nonce issued. `logBlocked` writes a D-15 stderr line.
5. **Issues nonce** via `registerNonces.ts`: 32-char hex, 5-min TTL, stored in-memory. Returns the full allowed shape including `suggestedName`, `suggestedSlug`, `detectedMarkers`.

Wave 0 libs created alongside (depended on by this plan and by 03-03/03-05+):
- `registerNonces.ts`: `issueNonce` / `consumeNonce` (single-use atomic delete) / `cleanupExpired` / `_resetForTests`
- `rateLimiter.ts`: `tokenHashOf` (sha256 first-8-hex) / `consume` / `sweepOldTimestamps` / `_resetForTests`
- `registerLog.ts`: `logBlocked` (D-15 exact format, newline-sanitized)
- `overviewCache.ts`: `getCached` / `setCached` / `evict` / `_resetForTests` (5s TTL, lazy expiry)
- `projectOverview.ts`: `readOverview` / `detectMarkers` / `findLatestPhaseDir` / `parseReviewFile` / `parseVerification` / `parseTddPairs` / `detectBranch`

Shared schemas extended:
- `packages/shared/src/schemas/overview.ts` (NEW): `ProjectOverviewSchema`, `FindingCountsSchema`, `DbAuditFindingsSchema`, `MarkersSchema`
- `packages/shared/src/schemas/registry.ts` (EXTENDED): `RegisterPrepareRequestSchema`, `RegisterPrepareResponseSchema` (z.union of 3 shapes), `RegisterConfirmRequestSchema`, `RegisterConfirmResponseSchema`, `RenameRequestSchema`, `TagsRequestSchema`

### Task 2: register-confirm route + integration tests

`POST /api/registry/register-confirm` — SPA calls this after user reviews the canonical path:

1. **Consumes nonce** via `consumeNonce` — deletes atomically on first call; unknown or expired → 410 `nonce_expired`.
2. **Defense-in-depth**: re-runs `assertRegistrationAllowed` on the nonce's `canonicalRoot`. If blocked (theoretical race window), returns 422 `path_blocked` + `logBlocked` (D-09/D-33).
3. **Registers** via `addProject` with optional `name` (falls back to `suggestedName` from nonce) / `client` / `tags`.
4. Returns 201 (new) or 200 (idempotent) with `RegisterConfirmResponseSchema` shape.

**10 integration tests** in `registry-prepare-confirm.test.ts`:
- prepare: allowed path, blocked path (~/.ssh → D-11), already-registered (D-17), rate-limit 11th→429 (D-14), validation error (missing path)
- confirm: valid nonce→201 with custom name+tags, uses suggestedName when name omitted, forged nonce→410, expired nonce→410 (fake timers), second-use same nonce→410 (D-10 single-use), no BLOCKED log on success (D-33)

## Deviations from Plan

### Auto-implemented Issues

**1. [Rule 2 - Missing deps] Wave 0 daemon libs created in this plan**
- **Found during:** Task 1 setup — `registerNonces.ts`, `rateLimiter.ts`, `registerLog.ts`, `overviewCache.ts`, `projectOverview.ts` all absent since Wave 0 agent (03-01) runs in parallel worktree
- **Fix:** Implemented all Wave 0 libs directly. Implementations match the 03-01-PLAN.md specs exactly so the parallel Wave 0 agent's output will be compatible.
- **Files modified:** 5 new lib files + 2 shared schema files
- **Commits:** b103546

**2. [Rule 1 - Bug] TypeScript strict mode issues in projectOverview.ts**
- **Found during:** `pnpm -r typecheck`
- **Issue:** `fmMatch[1]` typed as `string | undefined` even inside `if (fmMatch)` guard; regex capture groups also `string | undefined`
- **Fix:** Added `?? ''` defaults for capture group accesses; used `?? '0'` for parseInt args
- **Commits:** inline with b103546

**3. [Rule 1 - Bug] ESLint import order in projectOverview.ts**
- **Found during:** `pnpm lint`
- **Issue:** `@agenticapps/dashboard-shared` import placed after `../constants.js` (internal before external)
- **Fix:** Moved shared import to external group (with `execa`)
- **Commits:** inline with b103546

## Cross-Plan Dependencies

**Wave 2 SPA register modal (plans 03-06/03-07) MUST:**
- Call `POST /api/registry/register-prepare` first
- Show the user the canonical path + suggestedName
- Call `POST /api/registry/register-confirm` with the nonce
- **NEVER** call `POST /api/registry/register` directly from the SPA (D-12)

**Rate-limiter and nonce store contract:**
- Rate limit: 10 calls per 10-second sliding window per `tokenHashOf(bearer)`. 429 returns `Retry-After: 1`.
- Nonce TTL: 5 minutes. Expired or unknown nonce → 410 `nonce_expired`. SPA auto re-prepares on 410 (D-18).

## Known Stubs

None — all routes return real data. `detectMarkers` returns filesystem-checked booleans.

## Self-Check: PASSED

All 7 key files found on disk. Both commits (b103546, ec2fd47) verified in git log. 173 agent tests pass. typecheck and lint clean (0 errors).
