---
phase: 14-understand-anything-integration-daemon-hosted-knowledge-grap
plan: "02"
subsystem: agent/lib
tags: [tdd, security, understand-viewer, viewer-tokens, repo-resolution]
dependency_graph:
  requires: [14-01]
  provides: [repoRoot, viewerToken, viewerInstall]
  affects: [14-05, 14-06, 14-07, packages/agent/src/lib/gitnexusScan.ts, packages/agent/src/lib/auth.ts, packages/agent/src/cli/start.ts]
tech_stack:
  added: []
  patterns:
    - HMAC-SHA256 per-repo scoped tokens (format v1.<base64url>.<hex>)
    - Registry-first repo resolution with FS fallback (D-14-09)
    - timingSafeEqual with length guard for constant-time MAC comparison
    - Phase 10.6 stat-only detection (no subprocess)
    - Atomic 0600 write for secret storage
key_files:
  created:
    - packages/agent/src/lib/repoRoot.ts
    - packages/agent/src/lib/repoRoot.test.ts
    - packages/agent/src/lib/viewerToken.ts
    - packages/agent/src/lib/viewerToken.test.ts
    - packages/agent/src/lib/viewerInstall.ts
    - packages/agent/src/lib/viewerInstall.test.ts
  modified:
    - packages/agent/src/lib/gitnexusScan.ts (remove moved bodies; add re-export + resolveRepoRoot call)
    - packages/agent/src/lib/deterministicRepoRoot.test.ts (update import path to repoRoot.js)
    - packages/agent/src/lib/auth.ts (wire rotateViewerSecret in rotateToken)
    - packages/agent/src/cli/start.ts (wire ensureViewerSecretFile at boot)
    - packages/agent/src/constants.ts (add VIEWER_TOKEN_FILE, UNDERSTAND_VIEWER_DIR, UNDERSTAND_PLUGIN_CACHE)
decisions:
  - "resolveRepoRoot is registry-first (D-14-09): registry entries resolve before deterministic FS path, enabling non-standard project root locations to work correctly"
  - "viewerToken.ts does NOT import from auth.ts (no import cycle): uses randomBytes directly; auth.ts imports viewerToken.ts for rotation"
  - "verifyViewerToken returns uniform null on ANY failure (no exception details): prevents oracle attacks (T-14-02-01)"
  - "timingSafeEqual with explicit length guard before call: rejects invalid-length macs before Buffer comparison, preventing InvalidArgument errors"
  - "UNDERSTAND_PLUGIN_CACHE constant uses ~/.claude/plugins/cache/understand-anything/understand-anything path (matches actual plugin cache structure)"
metrics:
  duration: "~25 min"
  completed: "2026-06-07"
  tasks: 3
  files: 11
---

# Phase 14 Plan 02: Agent Foundation Modules — repoRoot, viewerToken, viewerInstall

Agent-side foundation for the understand-anything viewer: three new lib modules (repoRoot, viewerToken, viewerInstall) with full TDD suites, plus constants additions and boot/rotation wiring.

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Failing tests for repoRoot.ts | a8fc391 | repoRoot.test.ts |
| 1 (GREEN) | Extract repoRoot.ts — deterministicRepoRoot + derivedRepoId + resolveRepoRoot | 568e251 | repoRoot.ts, gitnexusScan.ts, deterministicRepoRoot.test.ts |
| 2 (RED) | Failing tests for viewerToken.ts | 8175cbb | viewerToken.test.ts |
| 2 (GREEN) | viewerToken.ts — HMAC tokens + boot/rotation wiring | 5a57f26 | viewerToken.ts, constants.ts, auth.ts, start.ts |
| 3 (RED) | Failing tests for viewerInstall.ts | 89cf531 | viewerInstall.test.ts |
| 3 (GREEN) | viewerInstall.ts — version detection | c8a8978 | viewerInstall.ts |

## Verification Results

- All 6 test files pass (75 tests total)
- `pnpm --filter @agenticapps/dashboard-agent typecheck` green
- No duplicate `deterministicRepoRoot` body: `grep -c "function deterministicRepoRoot" packages/agent/src/lib/gitnexusScan.ts` = 0
- `realpathSync.native` in exactly 1 implementation file (repoRoot.ts) — 2 call sites
- `rotateViewerSecret` wired in auth.ts: count = 2 (import + call)
- `ensureViewerSecretFile` wired in start.ts: count = 2 (import + call)
- `timingSafeEqual` in viewerToken.ts: count = 7 (import + usage)

## Deviations from Plan

None — plan executed exactly as written. The `rotateViewerSecret` call in `rotateToken()` was wired as specified; no import cycle was introduced because `viewerToken.ts` uses `randomBytes` directly instead of importing `generateToken` from `auth.ts`.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The three new lib modules are pure helper libraries:
- `repoRoot.ts` — pure function, no I/O beyond existing FS reads
- `viewerToken.ts` — writes to `~/.agenticapps/dashboard/viewer-token.json` (inside daemon-write boundary, mode 0600)
- `viewerInstall.ts` — read-only stat/readdir

No new threat flags.

## TDD Gate Compliance

All three tasks followed strict RED/GREEN cycle:
- RED commits: a8fc391 (repoRoot), 8175cbb (viewerToken), 89cf531 (viewerInstall)
- GREEN commits: 568e251 (repoRoot), 5a57f26 (viewerToken), c8a8978 (viewerInstall)
- No REFACTOR phase was needed (code is already clean from implementation)

## Self-Check

### Created files exist:
- packages/agent/src/lib/repoRoot.ts: FOUND
- packages/agent/src/lib/viewerToken.ts: FOUND
- packages/agent/src/lib/viewerInstall.ts: FOUND
- .planning/phases/DASH-14-.../14-02-SUMMARY.md: FOUND

### Commits exist:
- a8fc391 (repoRoot RED): FOUND
- 568e251 (repoRoot GREEN): FOUND
- 8175cbb (viewerToken RED): FOUND
- 5a57f26 (viewerToken GREEN): FOUND
- 89cf531 (viewerInstall RED): FOUND
- c8a8978 (viewerInstall GREEN): FOUND

## Self-Check: PASSED
