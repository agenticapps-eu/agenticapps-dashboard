---
phase: 14-understand-anything-integration-daemon-hosted-knowledge-grap
plan: "05"
subsystem: agent/routes
tags: [tdd, security, understand-viewer, viewer-route, static-serving, token-gate]
dependency_graph:
  requires: [14-02]
  provides: [understandViewerRoute, understandDataRoute, file-content-guards]
  affects: [packages/agent/src/server/app.ts]
tech_stack:
  added: []
  patterns:
    - Per-repo scoped ?token= viewer token gate (verifyViewerToken, not bearerAuth)
    - FIX 2 sanitisation (sanitiseGraphNodes) on knowledge-graph + domain-graph
    - 12-guard upstream readSourceFile suite (traversal, symlink, allow-list, size, binary)
    - Per-request graphFilePathSet parse (no cache, RESEARCH Pitfall 4)
    - Explicit realpath containment for symlink escape (T-14-05-03)
    - readFileSync+MIME map static serving (bypasses serveStatic CWD constraint)
    - Pre-bearerAuth route mounting (Hono registration-order short-circuit)
key_files:
  created:
    - packages/agent/src/routes/understandViewer.ts
    - packages/agent/src/routes/understandViewer.test.ts
  modified:
    - packages/agent/src/server/app.ts (mount pre-bearerAuth; viewerTokenFile/viewerRootOverrides/viewerDirOverride options)
decisions:
  - "handleFileContent implements 12 upstream guards IN ORDER with exact status codes and error strings"
  - "sanitiseGraphNodes applied to BOTH knowledge-graph.json and domain-graph.json (RESEARCH Pitfall 5)"
  - "Static serving uses readFileSync+MIME map over serveStatic to avoid CWD-relative constraint in test environments"
  - "Realpath containment (T-14-05-03) checked BEFORE graph-membership for existing files so symlinks are caught even when graph-listed"
  - "Test seam: viewerRootOverrides map injected via CreateAppOptions/c.get bypasses registry+FS for isolated tests"
  - "Unresolvable repoId returns 'Repository not found or not registered' (no path detail, T-14-05-06)"
  - "No bindMode check anywhere in understandViewer.ts — deliberate D-14-04 Tailscale parity; comment explains contrast with D-13-11"
metrics:
  duration: "~13 min"
  completed: "2026-06-07"
  tasks: 3
  files: 3
---

# Phase 14 Plan 05: understandViewer Route -- Static Serving + 6 Token-Gated Data Endpoints

Hono implementation of the understand-anything dev-server contract: scoped-token data router (6 endpoints) + static viewer SPA serving at `/understand/{family}/{repo}/`, both mounted before `bearerAuth` in `app.ts`.

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1+2+3 (RED) | Failing tests for all three tasks | 8ff7fba | understandViewer.test.ts (62 tests) |
| 1+2+3 (GREEN) | Full route implementation + app.ts mounting | 98cce90 | understandViewer.ts, understandViewer.test.ts, app.ts |

## Verification Results

- All 62 understandViewer tests pass
- Full agent test suite: 1047 passed, 1 skipped (0 new failures introduced)
- `pnpm --filter @agenticapps/dashboard-agent typecheck` green
- `grep -c "bindMode" packages/agent/src/routes/understandViewer.ts` = 1 (explanatory comment only, zero code branches -- D-14-04 verified)
- `grep -n "app.route('/understand'" packages/agent/src/server/app.ts` appears at line 153, before `bearerAuth(` at line 161

## Acceptance Criteria Verification

### Task 1
- All behavior tests green including bearer-token-rejected case and cross-repo binding
- Sanitisation negative assertions pass (fixture root not in serialized response)
- bindMode count = 1 (comment only, no branches)

### Task 2
- All 8 behavior groups green: traversal, symlink-escape, allow-list, size, binary
- Error strings byte-identical to upstream (exact string assertions)
- Cache-staleness test (Test 8) proves per-request graph parse
- Error responses do not include filesystem paths (assertion on error body)

### Task 3
- Redirect preserves ?token= (Location header assertion)
- Traversal tests pass (Hono URL normalization prevents path escape -- 401 from bearerAuth is acceptable per updated assertion)
- Integration test proves: data endpoint reachable without bearer, /api/* still bearer-gated
- `/understand` mounted before `bearerAuth(` in app.ts (line 153 < line 161)
- Full agent suite green

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unicode characters rejected by oxc parser**
- **Found during:** GREEN phase
- **Issue:** Arrow characters in JSDoc comments, and the `*/` sequence inside a block comment caused parse errors with vite 8 + oxc
- **Fix:** Replaced arrow chars with `->` throughout comments; replaced `*/` wildcard notation in doc strings with `...`
- **Files modified:** packages/agent/src/routes/understandViewer.ts

**2. [Rule 2 - Missing functionality] TypeScript exactOptionalPropertyTypes**
- **Found during:** typecheck
- **Issue:** Handler parameter types used complex `Parameters<Parameters<...>[N]>[0]` which TypeScript rejected; test used `undefined` for optional property violating `exactOptionalPropertyTypes`
- **Fix:** Used `Context<Env>` import from hono for handler types; restructured test createApp call to conditionally add viewerDirOverride
- **Files modified:** packages/agent/src/routes/understandViewer.ts, understandViewer.test.ts

**3. [Rule 1 - Bug] Traversal tests expecting strict 404 -- Hono normalizes URLs**
- **Found during:** Test 3 traversal assertions
- **Issue:** Path `/understand/f/r/../../../etc/passwd` is normalized by Hono BEFORE routing -- the normalized path escapes `/understand/` prefix, so bearerAuth intercepts (401). This is actually MORE restrictive (no route match at all), but tests expected only 404.
- **Fix:** Added 401 to acceptable status codes in traversal tests; documented the invariant (the `/etc/passwd` file is never served regardless of status)
- **Files modified:** packages/agent/src/routes/understandViewer.test.ts

## Known Stubs

None -- all 6 endpoints return real data from the filesystem.

## Threat Surface Scan

All new routes are in the plan's threat model (T-14-05-01 through T-14-05-SC). No unplanned surface introduced:

| Flag | File | Description |
|------|------|-------------|
| Planned | packages/agent/src/routes/understandViewer.ts | 6 new data endpoints at app root (token-gated by verifyViewerToken) |
| Planned | packages/agent/src/routes/understandViewer.ts | Static serving at /understand/{family}/{repo}/ (tokenless assets, no project data) |

Both are covered by the plan's threat register. No new threat flags.

## TDD Gate Compliance

Both gates present in git log:
- RED commit: 8ff7fba (test(14-05): add failing tests...)
- GREEN commit: 98cce90 (feat(14-05): implement understandViewer route...)

No REFACTOR phase needed (implementation is clean from the start).

## Self-Check

### Created files exist:
- packages/agent/src/routes/understandViewer.ts: FOUND
- packages/agent/src/routes/understandViewer.test.ts: FOUND
- .planning/phases/DASH-14-.../14-05-SUMMARY.md: FOUND (this file)

### Commits exist:
- 8ff7fba (RED tests): FOUND
- 98cce90 (GREEN implementation): FOUND

## Self-Check: PASSED
