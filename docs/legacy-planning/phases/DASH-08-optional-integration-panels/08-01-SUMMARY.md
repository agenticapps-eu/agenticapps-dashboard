---
phase: 08-optional-integration-panels
plan: "01"
subsystem: shared-schemas
tags: [schemas, zod, sentry, linear, infisical, tdd]
dependency_graph:
  requires: []
  provides:
    - SentryIssueSchema
    - SentryRecentResponseSchema
    - LinearIssueSchema
    - LinearIssuesResponseSchema
    - ALLOWED_ENV_KEYS
    - AllowedEnvKeySchema
    - EnvFileSchema
    - IntegrationsResponseSchema (extended with INFI-03 scope fields)
  affects:
    - packages/shared/src/index.ts (re-exports)
    - downstream Wave 2/3/4 consumers of these schemas
tech_stack:
  added: []
  patterns:
    - zod dual-export (XSchema const + type X = z.infer)
    - z.union([z.string(), z.number()]).transform(String) for Sentry count A2 defence
    - z.record(AllowedEnvKeySchema, z.string()) for allow-list enforcement
    - version: z.literal(1) + payload pattern (mirrors auth.ts)
key_files:
  created:
    - packages/shared/src/schemas/sentry.ts
    - packages/shared/src/schemas/sentry.test.ts
    - packages/shared/src/schemas/linear.ts
    - packages/shared/src/schemas/linear.test.ts
    - packages/shared/src/schemas/env.ts
    - packages/shared/src/schemas/env.test.ts
  modified:
    - packages/shared/src/schemas/integrations.ts
    - packages/shared/src/index.ts
decisions:
  - "count field uses z.union([z.string(), z.number()]).transform(String) per A2 — Sentry API returns string but number is also tolerated"
  - "LinearIssuesResponseSchema (not LinearIssueResponseSchema) — daemon aggregates multi-fetch into one response per architecture diagram"
  - "env.ts excluded from index.ts re-exports (T-08-01/INV-05/D-08-13) — secrets-file shape has no browser surface"
  - "IntegrationsResponseSchema extended with optional infisicalWorkspaceId + infisicalEnvironment (INFI-03) — backward compatible"
metrics:
  duration: "~3 min 25 sec"
  completed: "2026-06-11"
  tasks: 3
  files: 8
---

# Phase 8 Plan 01: Shared Zod Schemas for Sentry, Linear, env.json Summary

Single source of truth for every new Phase 8 daemon↔SPA wire shape — Sentry recent-issues, Linear detected-issues list, daemon-only env.json, and extended Integrations scope reflection.

## What Was Built

Three new schema files plus extensions to two existing files establish the interface-first contracts that Wave 2 libs, Wave 3 routes, and Wave 4 SPA panels build against.

**packages/shared/src/schemas/sentry.ts**
- `SentryIssueSchema`: id, title, level enum (fatal/error/warning/info/debug), count (string|number → string via transform), lastSeen, permalink (url), shortId
- `SentryRecentResponseSchema`: issues array capped at max(5), stale boolean (default false), optional staleFrom + staleReason enum

**packages/shared/src/schemas/linear.ts**
- `LinearIssueSchema`: identifier, title, url, stateName, stateType enum (started/completed/cancelled/backlog/unstarted), assigneeName (nullable), per-issue stale metadata
- `LinearIssuesResponseSchema`: issues array capped at max(3) per D-08-07, top-level stale/staleFrom/staleReason for whole-panel outage

**packages/shared/src/schemas/env.ts** (daemon-only)
- `ALLOWED_ENV_KEYS`: const tuple of 3 permitted keys
- `AllowedEnvKeySchema`: z.enum rejects any key outside the allow-list (D-08-13)
- `EnvFileSchema`: version literal(1) + vars z.record(AllowedEnvKey, string)

**packages/shared/src/schemas/integrations.ts** (extended)
- Added optional `infisicalWorkspaceId` and `infisicalEnvironment` fields (INFI-03)
- Fully backward-compatible — existing consumers unaffected

**packages/shared/src/index.ts** (extended)
- Re-exports SentryIssueSchema, SentryRecentResponseSchema + types
- Re-exports LinearIssueSchema, LinearIssuesResponseSchema + types
- env.ts symbols deliberately absent (T-08-01/INV-05)

## TDD Gate Compliance

Both TDD tasks followed strict RED → GREEN flow:

| Gate | Task 1 (Sentry+Linear) | Task 2 (env.ts) |
|------|------------------------|-----------------|
| RED commit | `test(08-01): add RED tests for Sentry and Linear shared schemas` (276091e) | `test(08-01): add RED tests for env.json allow-list schema` (559daf0) |
| GREEN commit | `feat(08-01): implement Sentry and Linear shared schemas (GREEN)` (d5ab7f9) | `feat(08-01): implement env.json allow-list schema (GREEN)` (87f7181) |

Task 3 (integrations extension + index re-exports) is `type="auto"` — no TDD gate required.

## Verification

- `pnpm --filter @agenticapps/dashboard-shared test`: 370 tests, 25 test files — all pass
- `pnpm --filter @agenticapps/dashboard-shared typecheck`: clean (0 errors)
- `pnpm lint`: 0 errors (229 pre-existing warnings, none from this plan)
- `grep -c "schemas/sentry.js" index.ts` → 2 (re-exported)
- `grep -c "schemas/linear.js" index.ts` → 2 (re-exported)
- `grep -c "schemas/env.js" index.ts` → 0 (daemon-only, correctly absent)

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes at trust boundaries beyond what the plan's threat model covers. T-08-01 mitigation confirmed: env.ts is absent from index.ts. T-08-02 mitigation confirmed: AllowedEnvKeySchema rejects unknown keys at parse time.

## Self-Check

**Files created/exist:**
- `packages/shared/src/schemas/sentry.ts` — FOUND
- `packages/shared/src/schemas/sentry.test.ts` — FOUND
- `packages/shared/src/schemas/linear.ts` — FOUND
- `packages/shared/src/schemas/linear.test.ts` — FOUND
- `packages/shared/src/schemas/env.ts` — FOUND
- `packages/shared/src/schemas/env.test.ts` — FOUND

**Commits (all on gsd/phase-08-optional-integration-panels):**
- 276091e — RED Sentry+Linear tests
- d5ab7f9 — GREEN Sentry+Linear schemas
- 559daf0 — RED env tests
- 87f7181 — GREEN env schema
- 65de05a — integrations extension + index re-exports

## Self-Check: PASSED
