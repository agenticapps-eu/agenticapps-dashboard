---
phase: 08-optional-integration-panels
plan: "05"
subsystem: agent-linear-route
tags: [linear, sentry, route, tdd, cache, token-safety, git-detection, daemon, app-mount]
dependency_graph:
  requires:
    - 08-01 (LinearIssueSchema, LinearIssuesResponseSchema from @agenticapps/dashboard-shared)
    - 08-02 (fetchWithTimeout, classifyError, CacheEntry from outboundFetch.ts)
    - 08-03 (sentryRoute from routes/sentry.ts — mounted here)
  provides:
    - linearRoute (Hono handler for GET /:id/linear/issues + per-issue cache + evictLinearCacheProject)
    - sentryRoute mounted at /api/projects (was created in 08-03; first live mount here)
    - linearRoute mounted at /api/projects
  affects:
    - packages/agent/src/server/app.ts (both routes now live under bearer-auth middleware)
tech_stack:
  added: []
  patterns:
    - detectIssueIds: /[A-Z]{2,}-\d+/g matchAll on branch + log output, dedup via Set, cap 3 (D-08-07)
    - env-gated route (404 not_configured when LINEAR_API_KEY unset)
    - GraphQL POST to api.linear.app with raw API-key Authorization header (no Bearer prefix)
    - per-issue cache keyed projectId:issueId, TTL 60s + lastGood sub-entry (D-08-09, Pitfall 7)
    - classifyError 3-category sanitization including 400+RATELIMITED (Pitfall 1)
    - data.issue null → omit silently (not an error for the whole panel)
    - Route mounting pattern: app.route('/api/projects', route) after integrationsRoute
key_files:
  created:
    - packages/agent/src/routes/linear.ts
    - packages/agent/src/routes/linear.test.ts
  modified:
    - packages/agent/src/server/app.ts
decisions:
  - "detectIssueIds uses /g flag on LINEAR_BRANCH_RE for matchAll across multi-line log — integrations.ts uses non-global regex for branch-only single-match"
  - "Cache key is projectId:issueId not issueId alone — cross-project leakage guard (Pitfall 7 / T-08-22)"
  - "data.issue null → silently omit entry; whole panel is not an error (issue may have moved teams)"
  - "anyFailure+issues.length===0 → 503; anyFailure with some issues → partial response with per-issue stale"
  - "outbound() returns validated schema shape directly — no ok: true wrapper; test assertion corrected"
  - "Both sentry + linear routes mounted after integrationsRoute in app.ts — identical bearer-auth inheritance, no new auth code"
metrics:
  duration: "~9 min"
  completed: "2026-06-11"
  tasks: 3
  files: 3
---

# Phase 8 Plan 05: Linear Issues Route + Route Mounts Summary

Linear data route with branch/commit issue-ID detection, raw-key GraphQL fetch, per-issue caching, rate-limit classification, and key-safety guarantees. Mounts both Sentry (Plan 03) and Linear routes into app.ts, making them live under bearer-auth.

## What Was Built

### packages/agent/src/routes/linear.ts

`linearRoute = new Hono<Env>()` — single handler: `GET /:id/linear/issues`

**Issue-ID detection (LINEAR-02 / D-08-05):**

`detectIssueIds(root)` reads the current branch name via `runAllowedGit('branch', root)` and recent commit messages via `runAllowedGit('log', root)` (20-commit cap already baked into `ARGV_BY_CMD`). Uses `/[A-Z]{2,}-\d+/g` (note `/g` flag for `matchAll` across multi-line log output — diverges from `integrations.ts`'s non-global regex). Branch IDs collected first, then log IDs. Deduped via a `Set` preserving insertion order. Capped at 3 (D-08-07).

**Env gate (LINEAR-03):** Returns `404 not_configured` when `LINEAR_API_KEY` is unset. Returns `404 project_not_found` when `:id` is not in the registry. Empty issue-ID list → `200` with `issues: []` (panel renders configure/empty state, not an error).

**GraphQL fetch (LINEAR-01 / Research Finding 3):**

`POST https://api.linear.app/graphql` with `Content-Type: application/json` and **raw API key** in `Authorization` header (no `Bearer` prefix — A3/Finding 3). Issue queried by human-readable identifier (`issue(id: "ACME-123")`) directly. `data.issue` null → issue silently omitted (not found or moved teams — not an error for the whole panel).

**Per-issue cache (D-08-09 / Pitfall 7):**

Module-level `issueCache` Map keyed `${projectId}:${issueId}` with `TTL_MS = 60_000`. `CacheEntry<LinearIssue>` carries `lastGood` sub-entry that persists across TTL expiry. On fetch failure: serve `lastGood` with `stale:true + staleFrom + staleReason` if available; else mark issue as failed. When all fetches fail with no last-good: `503` with sanitized category.

**Error classification (D-08-11 / Pitfall 1):**

All errors passed through `classifyError(err, status, body)`. Linear HTTP-400 + `errors[0].extensions.code === 'RATELIMITED'` correctly classified as `rate-limited` (not `unreachable`). Token and raw body never logged or serialized.

**Token safety (INV-05 / T-08-19/20):**

`LINEAR_API_KEY` never appears in any JSON response field. `agentError` logs `issueId + status + category` only — no API key, no raw GraphQL body. Endpoint URL hardcoded to `api.linear.app/graphql` (T-08-21 — no SSRF). All test INV-05 substring assertions pass.

**Exports:** `linearRoute`, `detectIssueIds`, `evictLinearCacheProject(id)` — deletes all `${id}:*` keys from `issueCache`.

### packages/agent/src/server/app.ts (modified)

Added imports for `sentryRoute` and `linearRoute`. Mounted both after `integrationsRoute`:

```typescript
app.route('/api/projects', sentryRoute)
app.route('/api/projects', linearRoute)
```

Both routes inherit the full existing middleware chain (logger → requestId → CIDR → CORS → bearerAuth). No new auth code added.

## TDD Gate Compliance

Strict RED → GREEN per plan `type: tdd`:

| Gate | Commit |
|------|--------|
| RED (test) | `test(08-05): add RED tests for Linear issue-ID detection + issues route` (e12b741) |
| GREEN (feat) | `feat(08-05): implement Linear issues route (GREEN)` (120c0bb) |

18 tests across both tasks:
- D-01..06: detectIssueIds behaviors (branch-only, log-only, both-source, dedup, cap-3, no-match)
- L-01..12: route behaviors (env-gate, project-lookup, payload shape, raw-key auth, cache hit, cache isolation, 400+RATELIMITED, null-omit, 503 no-last-good, INV-05 key substring, empty IDs, evict export)

Task 3 (app.ts mount) is `type="auto"` — no TDD gate required.

## Verification

- `pnpm --filter @agenticapps/dashboard-agent test linear`: 18 tests, 1 file — all pass
- `pnpm --filter @agenticapps/dashboard-agent test`: 1196 tests, 111 files — all pass (1 pre-existing skip)
- `pnpm --filter @agenticapps/dashboard-agent typecheck`: clean (0 errors)
- `pnpm lint`: 0 errors
- `grep -c "app.route('/api/projects', sentryRoute)" packages/agent/src/server/app.ts` → 1
- `grep -c "app.route('/api/projects', linearRoute)" packages/agent/src/server/app.ts` → 1
- INV-05 substring assertion: `expect(text).not.toContain(SECRET_KEY)` across not_configured, 503, and happy-path responses — all passing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion `body.ok` not in outbound response shape**
- **Found during:** GREEN test run — L-03 failed with `expected undefined to be true`
- **Issue:** `outbound()` returns the validated `LinearIssuesResponseSchema` object directly (no `ok: true` wrapper). Test incorrectly asserted `body.ok === true`.
- **Fix:** Removed the `body.ok` assertion; added comment explaining `outbound()` shape
- **Files modified:** `packages/agent/src/routes/linear.test.ts`
- **Commit:** 120c0bb

**2. [Rule 1 - Bug] TypeScript strict null checks on array element access**
- **Found during:** typecheck after GREEN — TS2532/TS18048 on `issues[0]` and `issues[0].*`
- **Issue:** `exactOptionalPropertyTypes: true` + `noUncheckedIndexedAccess` treats array element access as potentially `undefined`
- **Fix:** Added `?` optional chaining (`issues[0]?.identifier`) and explicit cast (`issues[0] as Record<string, unknown>`) in test assertions
- **Files modified:** `packages/agent/src/routes/linear.test.ts`
- **Commit:** 120c0bb

**3. [Rule 1 - Bug] Test infrastructure — wrong fixture signature and missing registration**
- **Found during:** First GREEN test run — most tests returned 404 (bearer token mismatch)
- **Issue:** Test used `makePhase4Fixture(tmpHome.homeDir)` (wrong — fixture takes no args) and assumed `fixture.projectId` (doesn't exist). Without HTTP registration, no registry entry → 404 on all project routes.
- **Fix:** Rewrote `beforeEach` to mirror `sentry.test.ts` pattern: `makeTmpHome()` + `makePhase4Fixture()` (no args) + register via `POST /api/registry/register` to get real project ID
- **Files modified:** `packages/agent/src/routes/linear.test.ts`
- **Commit:** 120c0bb (rewrite of test before first GREEN run)

## Known Stubs

None. Both routes return real data shapes and are live in `app.ts`. The SPA cannot yet render the data (SPA panels are Plan 08-06 scope) but the daemon endpoints are fully functional.

## Threat Surface Scan

All surfaces covered by the plan's threat model. No new surfaces beyond those registered:

| Flag | File | Description |
|------|------|-------------|
| T-08-19 covered | linear.ts | LINEAR_API_KEY never serialized — confirmed by INV-05 test assertions |
| T-08-20 covered | linear.ts | `agentError` logs issueId+status+category only, no key/body interpolation |
| T-08-21 covered | linear.ts | `LINEAR_API = 'https://api.linear.app/graphql'` — hardcoded, no user URL |
| T-08-22 covered | linear.ts | Cache keyed `${projectId}:${issueId}` from `readRegistry().find()` guard |
| T-08-23 accepted | linear.ts | D-08-10 carve-out: opt-in via LINEAR_API_KEY; own key to own Linear project |

## Self-Check

**Files created/exist:**
- `packages/agent/src/routes/linear.ts` — FOUND
- `packages/agent/src/routes/linear.test.ts` — FOUND

**Files modified:**
- `packages/agent/src/server/app.ts` — FOUND, both mounts present

**Commits (all on gsd/phase-08-optional-integration-panels):**
- e12b741 — test: RED linear tests
- 120c0bb — feat: GREEN linear route implementation
- d911f25 — feat: mount sentry + linear routes in app.ts

## Self-Check: PASSED
