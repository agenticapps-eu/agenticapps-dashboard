---
phase: 08-optional-integration-panels
plan: "03"
subsystem: agent-sentry-route
tags: [sentry, route, tdd, cache, token-safety, slug-resolution, daemon]
dependency_graph:
  requires:
    - 08-01 (SentryIssueSchema, SentryRecentResponseSchema from @agenticapps/dashboard-shared)
    - 08-02 (fetchWithTimeout, classifyError, CacheEntry from outboundFetch.ts)
  provides:
    - sentryRoute (Hono handler for GET /:id/sentry/recent)
    - evictSentryCacheProject (issues + slug cache eviction)
    - resolveSentrySlugs (3-tier: .sentryclirc → /api/0/projects/ → env fallback, 10-min cache)
  affects:
    - downstream Plan 08-05 (mounts sentryRoute in app.ts at /api/projects)
tech_stack:
  added: []
  patterns:
    - env-gated route (404 not_configured when SENTRY_AUTH_TOKEN unset)
    - 60s TTL issues cache + 10-min slug cache (separate Maps keyed by projectId — Pitfall 5)
    - lastGood sub-entry survives TTL expiry for D-08-09 stale fallback
    - classifyError 3-category sanitization — raw upstream body never reaches SPA
    - minimal INI parser for .sentryclirc [defaults] section (tier-1 slug resolution)
    - /api/0/projects/ list-and-match with String(numericId) comparison (Pitfall 3)
    - Hono route mounted in test via createAppWithSentry() wrapper (pre-08-05 mount)
key_files:
  created:
    - packages/agent/src/routes/sentry.ts
    - packages/agent/src/routes/sentry.test.ts
  modified: []
decisions:
  - "Route not mounted in app.ts — that is Plan 08-05's scope; test wrapper createAppWithSentry() provides full integration coverage in the meantime"
  - "evictSentryCacheProject clears both issuesCache and slugCache — explicit eviction removes everything; TTL expiry (not eviction) is the lastGood survival path"
  - "S-05 stale test uses vi.spyOn(Date, 'now') to simulate TTL expiry rather than eviction — preserves the lastGood sub-entry correctly"
  - "SENTRY_DSN env var used for tier-2 resolution (not file-based DSN detection) — projectMetadataScan detects DSN presence only (no value extraction per T-5-NoSecretRead); route reads SENTRY_DSN from process.env for actual value"
metrics:
  duration: "~8.5 min"
  completed: "2026-06-11"
  tasks: 2
  files: 2
---

# Phase 8 Plan 03: Sentry Recent-Issues Route Summary

Env-gated Sentry data route with 3-tier slug resolution, dual-TTL caching, last-good stale fallback, and token-safety guarantees. Delivers SENTRY-01/02/03 and INV-05.

## What Was Built

**packages/agent/src/routes/sentry.ts**

`sentryRoute = new Hono<Env>()` — single handler: `GET /:id/sentry/recent`

**Env gate (SENTRY-03):** Returns `404 not_configured` when `SENTRY_AUTH_TOKEN` is unset. Returns `404 project_not_found` when `:id` is not in the registry.

**Slug resolution (D-08-01 / Research Finding 1):**

Tier-1: minimal `.sentryclirc` INI parser — accepts `[header]` + `key = value` lines, extracts `org` and `project` from the `[defaults]` section only. No code execution, no includes. Zero API calls when file is present.

Tier-2: reads `SENTRY_DSN` from `process.env`, parses the numeric project id from the last path segment, calls `GET https://sentry.io/api/0/projects/` (paginated, 10-page × 100 guard), matches `project.id === String(numericId)` (Pitfall 3 string comparison), extracts `organization.slug` + `project.slug`.

Tier-3: `SENTRY_ORG_SLUG` + `SENTRY_PROJECT_SLUG` env vars — explicit escape hatch.

Resolved slugs cached in a module-level `slugCache` Map with a 10-min TTL keyed by `projectId` (Pitfall 5 — separate from issues cache).

**Issues fetch (SENTRY-01):** `GET https://sentry.io/api/0/organizations/{orgSlug}/issues/?query=is:unresolved&sort=date&limit=5&project={numericId}` via `fetchWithTimeout` with `Authorization: Bearer ${token}`. Maps raw response to `SentryIssueSchema` fields (top 5).

**60s cache + last-good stale fallback (SENTRY-02 / D-08-09):**
- `issuesCache` Map with `TTL_MS = 60_000` keyed by `projectId`
- `CacheEntry<SentryRecentResponse>` carries `lastGood` sub-entry that persists across TTL expiry
- On re-fetch failure: if `prev?.lastGood` exists → serve `{...lastGood.value, stale:true, staleFrom, staleReason}` via `outbound()` → 200
- No prior last-good → `c.json({ok:false, error:category, requestId}, 503)`

**Token safety (INV-05 / T-08-09/10):**
- `SENTRY_AUTH_TOKEN` value never serialized into any JSON response field
- `agentError` logs only `status` + `category` — never the token or raw upstream body
- Sentry host hardcoded to `sentry.io` — no user-supplied URLs (T-08-11)
- INV-05 assertion tested: `JSON.stringify(responseBody)` never contains the secret token string across all code paths (happy path, 503, not_configured)

**Exports:** `sentryRoute`, `evictSentryCacheProject(id)` — clears both `issuesCache` and `slugCache` for a project (mirrors `evictIntegrationsCacheProject` pattern; wired into unregister in a follow-up plan).

## TDD Gate Compliance

Both tasks followed strict RED → GREEN:

| Gate | Task 1+2 (combined in one file) |
|------|--------------------------------|
| RED commit | `test(08-03): add RED tests for sentry route` (1c46617) |
| GREEN commit | `feat(08-03): implement sentry/recent route` (70ed4b3) |

14 tests across both tasks:
- SL-01..06: slug resolution (tier-1 .sentryclirc, tier-2 /projects/ match, tier-3 env, Pitfall 3, null path, slug cache hit)
- S-01..07: route behaviors (not_configured, project_not_found, happy path, 60s cache hit, stale fallback, 503 no-last-good, INV-05 token substring)
- S-08: evictSentryCacheProject export

## Verification

- `pnpm --filter @agenticapps/dashboard-agent test sentry`: 14 tests, 1 test file — all pass
- `pnpm --filter @agenticapps/dashboard-agent typecheck`: clean (0 errors)
- `pnpm lint`: 0 errors (pre-existing warnings unchanged)
- INV-05 substring assertion present and passing: `expect(text).not.toContain(SECRET_TOKEN)` across happy path, 503, and not_configured responses
- `app.ts` not modified — route mounting deferred to Plan 08-05

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] exactOptionalPropertyTypes mismatch on slug cache return**
- **Found during:** Task 1+2 GREEN typecheck
- **Issue:** `numericProjectId: cached.numericProjectId` (type `string | undefined`) not assignable to return type `numericProjectId?: string` under `exactOptionalPropertyTypes: true`
- **Fix:** Conditionally set `result.numericProjectId = cached.numericProjectId` only when value is not `undefined`
- **Files modified:** `packages/agent/src/routes/sentry.ts`
- **Commit:** 70ed4b3

**2. [Rule 1 - Bug] Unused imports in test file**
- **Found during:** lint run after GREEN
- **Issue:** `mkdirSync` and `tmpdir` imported but never used; `makeDsn` helper function defined but never called
- **Fix:** Removed unused imports and unused helper
- **Files modified:** `packages/agent/src/routes/sentry.test.ts`
- **Commit:** 70ed4b3

**3. [Rule 3 - Blocking] sentryRoute not mounted in createApp (Plan 08-05 scope)**
- **Found during:** First test run — all tests returned 404 because route was not in the app
- **Issue:** Route mounting happens in Plan 08-05; tests using `createApp({ registryFile })` directly received 404 for all sentry routes
- **Fix:** Added `createAppWithSentry(registryFile)` wrapper in test file that calls `createApp()` then appends the sentry route via `app.route('/api/projects', sentryRoute)` — mirrors the 08-05 mount structure
- **Files modified:** `packages/agent/src/routes/sentry.test.ts`
- **Commit:** 70ed4b3

**4. [Rule 1 - Bug] S-05 stale test: evictSentryCacheProject removes lastGood**
- **Found during:** GREEN test run — S-05 returned 503 instead of 200
- **Issue:** `evictSentryCacheProject(projectId)` deletes both caches including `lastGood`; test was using eviction to simulate TTL expiry but the semantics are different — eviction removes everything, TTL expiry leaves the entry (with stale `cachedAtMs`) in place
- **Fix:** Replaced explicit eviction in S-05 with `vi.spyOn(Date, 'now').mockReturnValue(originalNow() + 2 * 60 * 1000)` to advance time beyond the 60s TTL, preserving the cache entry and its `lastGood` sub-entry
- **Files modified:** `packages/agent/src/routes/sentry.test.ts`
- **Commit:** 70ed4b3

## Known Stubs

None. The route returns real data shapes; it is not mounted in `app.ts` yet (that is intentional — Plan 08-05's scope). The SPA cannot reach this route until 08-05 mounts it.

## Threat Surface Scan

All surfaces covered by the plan's threat model. No new surfaces beyond those registered:

| Flag | File | Description |
|------|------|-------------|
| T-08-09 covered | sentry.ts | Token never in response — confirmed by INV-05 test assertion |
| T-08-10 covered | sentry.ts | `agentError` logs status+category only, no token/body interpolation |
| T-08-11 covered | sentry.ts | `SENTRY_API = 'https://sentry.io/api/0'` — hardcoded, no user URL |
| T-08-12 covered | sentry.ts | Both caches keyed by `projectId` from `readRegistry().find()` guard |
| T-08-13 accepted | sentry.ts | D-08-10 carve-out: opt-in via SENTRY_AUTH_TOKEN; own token to own Sentry project |

## Self-Check

**Files created/exist:**
- `packages/agent/src/routes/sentry.ts` — FOUND
- `packages/agent/src/routes/sentry.test.ts` — FOUND

**Commits (all on gsd/phase-08-optional-integration-panels):**
- 1c46617 — test: RED sentry tests
- 70ed4b3 — feat: GREEN sentry route implementation

## Self-Check: PASSED
