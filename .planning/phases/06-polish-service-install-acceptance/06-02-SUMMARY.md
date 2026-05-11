---
phase: 06
plan: 02
subsystem: agent-registry-security
tags: [rate-limiting, schema-validation, security, tdd, a-01, a-02]
dependency_graph:
  requires: []
  provides:
    - "A-01: token-bucket rate limit on /rename, /tags, /register-confirm"
    - "A-02: schema bounds on RenameRequestSchema (name<=200) and TagsRequestSchema (tags<=20, tag<=50)"
  affects:
    - packages/agent/src/routes/registry.ts
    - packages/shared/src/schemas/registry.ts
tech_stack:
  added: []
  patterns:
    - "Sliding 10s window token-bucket rate limiter (existing pattern from register-prepare, now extended to 3 more routes)"
    - "Zod .max() bounds on string and array schemas"
key_files:
  created:
    - packages/agent/src/routes/registry-rate-limit.test.ts
  modified:
    - packages/shared/src/schemas/registry.ts
    - packages/shared/src/schemas/registry.test.ts
    - packages/agent/src/routes/registry.ts
decisions:
  - "Rate-limit key is per token-hash (sha256 first 8 hex chars), shared across all mutation routes — exhausting rename budget blocks tags on same token (correct: one logical actor)"
  - "requestId extracted locally inside each handler body — pre-existing 404/200 paths use c.get('requestId') directly, no disruption"
  - "RL4 test validates shared-bucket behavior: 10 renames + 1 tags = 429 (same token-hash bucket)"
metrics:
  duration_minutes: 35
  completed_date: "2026-05-10"
  tasks_completed: 2
  files_modified: 4
  files_created: 1
---

# Phase 6 Plan 2: CSO Carry-forwards A-01 + A-02 Summary

**One-liner:** Zod `.max()` bounds on name/tags schemas + sliding 10s token-bucket rate limit on three mutation routes, closing Phase 3 CSO findings A-01 and A-02 via strict TDD.

## What Was Built

### A-02: Schema Bounds Tightening (Task 1)

Added `.max()` constraints to `RenameRequestSchema` and `TagsRequestSchema` in `packages/shared/src/schemas/registry.ts`:

- `name: z.string().min(1).max(200)` — caps project names at 200 chars (preserves existing `min(1)`)
- `tags: z.array(z.string().max(50)).max(20)` — caps tag lists at 20 entries, each tag at 50 chars

These bounds prevent registry.json bloat (worst case ~5KB/project) and make the schema self-documenting for clients.

**7 boundary tests added** to `packages/shared/src/schemas/registry.test.ts`:
- 200-char name: passes (boundary inclusive)
- 201-char name: fails (boundary exclusive)
- Empty name: fails (existing `min(1)` preserved)
- 20-element tag array: passes
- 21-element tag array: fails
- 50-char tag: passes
- 51-char tag: fails
- Empty tag array: passes (clear-tags use case)

### A-01: Rate-Limit Hardening (Task 2)

Mirrored the existing `register-prepare` rate-limit gate (D-14, sliding 10s window, cap 10) onto three mutation routes in `packages/agent/src/routes/registry.ts`:

- `POST /api/registry/register-confirm`
- `POST /api/registry/:id/rename`
- `POST /api/registry/:id/tags`

The gate block is identical to the register-prepare gate: extracts `tokHash` from the bearer token header, calls `rlConsume(tokHash)`, returns 429 + `Retry-After: 1` if denied. The block runs at the TOP of each handler body, before `c.req.valid('json')` extraction.

**6 in-process Hono tests** added to `packages/agent/src/routes/registry-rate-limit.test.ts`:
- RL1: first 10 rename requests succeed; 11th returns 429 with `error: 'rate_limited'` and `Retry-After: 1`
- RL2: exhausted rename bucket returns 429 (confirms gate is active)
- RL3: first 10 tags requests succeed; 11th returns 429
- RL4: shared bucket — 10 renames exhaust token's budget; 1st tags request is also 429
- RL5: first 10 confirm requests return 410 (unknown nonce); 11th returns 429
- RL6: confirm bucket exhaustion confirmed

## TDD Commit Pairs

| Step | Commit | Description |
|------|--------|-------------|
| Task 1 RED | `d1490d4` | test(06-02): A-02 boundary tests for RenameRequestSchema/TagsRequestSchema |
| Task 1 GREEN | `85abef5` | feat(06-02): A-02 tighten registry schema bounds (name<=200, tags<=20, tag<=50) |
| Task 2 RED | `26625fb` | test(06-02): A-01 rate-limit tests for /rename /tags /register-confirm |
| Task 2 GREEN | `1962844` | feat(06-02): A-01 rate-limit /rename /tags /register-confirm (mirror register-prepare) |

## Test Count Delta

| Package | Before | After | Delta |
|---------|--------|-------|-------|
| shared | 151 | 158 | +7 boundary tests |
| agent | 420 | 426 | +6 rate-limit tests |
| **Total** | 571 | **584** | **+13** |

## Acceptance Criteria — PASSED

- [x] `grep "max(200)" packages/shared/src/schemas/registry.ts` matches
- [x] `grep "max(20)" packages/shared/src/schemas/registry.ts` matches
- [x] `grep "max(50)" packages/shared/src/schemas/registry.ts` matches
- [x] `grep -c "rlConsume" packages/agent/src/routes/registry.ts` returns 5 (>= 4)
- [x] `grep -c "rate_limited" packages/agent/src/routes/registry.ts` returns 4 (>= 4)
- [x] `grep -c "Retry-After" packages/agent/src/routes/registry.ts` returns 4 (>= 4)
- [x] `grep -c "describe\|it(" packages/agent/src/routes/registry-rate-limit.test.ts` returns 10 (>= 6)
- [x] `pnpm --filter @agenticapps/dashboard-agent exec vitest run src/routes/registry-rate-limit.test.ts` exits 0
- [x] `pnpm --filter @agenticapps/dashboard-agent test` exits 0 — 426 tests pass
- [x] `pnpm --filter @agenticapps/dashboard-shared test` exits 0 — 158 tests pass
- [x] `pnpm -r typecheck` exits 0
- [x] `git log --oneline | head -6 | grep -c '06-02'` returns 4 (RED+GREEN per task)

## Security Findings Closed

| Finding | Status | Evidence |
|---------|--------|---------|
| A-01: No rate limit on /rename, /tags, /register-confirm | **CLOSED** | `rlConsume` at top of all 3 handlers; 6 passing tests |
| A-02: Unbounded name/tags strings risk registry.json bloat | **CLOSED** | `.max(200)`, `.max(20)`, `.max(50)` in schema; 7 passing boundary tests |

## Deviations from Plan

None — plan executed exactly as written. The rate-limit block is verbatim from the register-prepare gate (lines 137-150 pattern) as specified. Schema bounds applied at the exact lines specified (registry.ts lines 113 and 118).

## Known Stubs

None — all schema changes and rate-limit gates are fully wired. No placeholder or TODO values remain in modified files.

## Threat Flags

None — changes implement the mitigations already enumerated in the plan's threat register (T-06-02-01 and T-06-02-02). No new security surface introduced.

## Self-Check: PASSED
