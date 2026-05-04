---
phase: 03-multi-project-home-page
plan: 05
subsystem: daemon/registry
tags: [rename, tags, cache-eviction, mutation-routes, wave-2]
dependency_graph:
  requires:
    - "03-01 (Wave 0: shared schemas — RenameRequestSchema, TagsRequestSchema, RegistryEntrySchema)"
    - "03-04 (prepare/confirm routes; overviewCache.ts with evict())"
  provides:
    - "POST /api/registry/:id/rename (D-24)"
    - "POST /api/registry/:id/tags (D-24)"
    - "evict(id) call in /unregister handler (T-03-03-05 cross-plan invariant)"
  affects:
    - "Wave 2 CardContextMenu can now call rename/tags and receive updated RegistryEntry"
    - "Overview cache is now hygienic across all registry mutations (unregister evicts)"
tech_stack:
  added: []
  patterns:
    - "renameProject/setTags return boolean; handler reads updated entry post-write for response"
    - "outbound() schema-drift defense on all response shapes (Phase 1 D-16)"
    - "evictOverviewCache(id) inserted before 204 return in /unregister (T-03-03-05)"
key_files:
  created: []
  modified:
    - packages/agent/src/routes/registry.ts
    - packages/agent/src/server/__tests__/registry.test.ts
decisions:
  - "renameProject/setTags return boolean not RegistryEntry — handler reads updated entry post-write via readRegistry().projects.find()"
  - "/:id/rename and /:id/tags appended after prepare/confirm routes in the same registryRoute Hono router"
  - "evictOverviewCache imported as alias to distinguish from any future local variable named evict"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-04T19:10:00Z"
  tasks: 1
  files: 2
---

# Phase 3 Plan 5: Rename/Tags Routes + Cache Eviction Summary

**One-liner:** Bearer-gated `POST /:id/rename` and `POST /:id/tags` mutation routes returning updated `RegistryEntry`, plus `evict(id)` wired into the existing `/unregister` handler to satisfy the T-03-03-05 cross-plan cache-hygiene invariant.

## What Was Built

### Task 1: /:id/rename + /:id/tags routes + evict() in /unregister (TDD)

**RED phase:** 6 failing tests added to `packages/agent/src/server/__tests__/registry.test.ts`:
- `POST /api/registry/:id/rename` happy path → 200 + updated entry
- `POST /api/registry/:id/rename` unknown id → 404 `project_not_found`
- `POST /api/registry/:id/rename` empty name → 422 `invalid_request`
- `POST /api/registry/:id/tags` happy path → 200 + updated entry with tags
- `POST /api/registry/:id/tags` non-array tags → 422 `invalid_request`
- `POST /api/registry/unregister` evicts overview cache entry → `getCached(id)` returns null

**GREEN phase:** Implementation in `packages/agent/src/routes/registry.ts`:

1. **Imports extended:**
   - `RegistryEntrySchema`, `RenameRequestSchema`, `TagsRequestSchema` from `@agenticapps/dashboard-shared`
   - `renameProject`, `setTags` from `../lib/registry.js`
   - `evict as evictOverviewCache` from `../lib/overviewCache.js`

2. **`/unregister` handler modified:** Inserted `evictOverviewCache(body.id)` before the `204` return. Comment cites `T-03-03-05 cache hygiene` so future readers understand the invariant.

3. **`POST /:id/rename` handler appended:**
   - Validates body via `RenameRequestSchema` (`name: z.string().min(1)`) — empty name → 422
   - Calls `renameProject(id, body.name, registryFile)` (returns `boolean`)
   - Returns 404 if `false`, else reads updated entry via `readRegistry().find()` and returns 200 + `RegistryEntrySchema`-parsed response via `outbound()`

4. **`POST /:id/tags` handler appended:**
   - Validates body via `TagsRequestSchema` (`tags: z.array(z.string())`) — non-array → 422
   - Calls `setTags(id, body.tags, registryFile)` (returns `boolean`)
   - Returns 404 if `false`, else reads updated entry and returns 200 + `RegistryEntrySchema` shape

All 218 agent tests pass. `pnpm -r typecheck` exits 0. `pnpm lint` exits 0 errors (2 pre-existing warnings in unrelated files).

## Route Contracts

| Route | Auth | Body | 200 shape | Errors |
|-------|------|------|-----------|--------|
| `POST /api/registry/:id/rename` | Bearer | `{ name: string (min 1) }` | `RegistryEntry` | 404 not found, 422 invalid |
| `POST /api/registry/:id/tags` | Bearer | `{ tags: string[] }` | `RegistryEntry` | 404 not found, 422 invalid |

Bearer enforcement is handled by the existing `bearerAuth` middleware in `app.ts` — routes never execute if token is missing/invalid (401 returned by middleware).

## Cross-Plan Invariant Resolved

**T-03-03-05:** The `/unregister` handler now calls `evictOverviewCache(body.id)` on success. If a project is unregistered and then re-registered with the same id but a different root path, the overview cache will not serve stale data from the previous registration. The eviction test (`POST /api/registry/unregister evicts the overview cache`) verifies this contract with `setCached`/`getCached` assertions.

## Wave 2 SPA Hooks Status

After this plan, all 7 daemon endpoints the Wave 2 SPA needs are available:

| Endpoint | Plan |
|----------|------|
| `GET /api/registry` | Phase 1 |
| `POST /api/registry/register` | Phase 1 |
| `POST /api/registry/unregister` | Phase 1 |
| `POST /api/registry/register-prepare` | 03-04 |
| `POST /api/registry/register-confirm` | 03-04 |
| `GET /api/projects/:id/overview` | 03-03 |
| `POST /api/registry/:id/rename` | **03-05** |
| `POST /api/registry/:id/tags` | **03-05** |

## Deviations from Plan

### Adaptation (not a deviation)

**renameProject/setTags return boolean, not RegistryEntry | null**

The plan's `<interfaces>` block showed `renameProject` and `setTags` returning `RegistryEntry | null`, but the Phase 1 implementation (unchanged by plan 04) returns `boolean`. The handler adapts by:
1. Checking the boolean return for 404
2. Re-reading the registry post-write to get the updated entry for the response

This is functionally equivalent to the plan's intent. No lib change needed. The `<action>` block's code sketch was illustrative — the actual implementation follows the real types.

## Known Stubs

None — both routes return real persisted data from registry.json.

## Threat Surface Scan

No new network surface beyond what the plan's threat model covers. The `/:id/rename` and `/:id/tags` routes are parameter-bound (id is matched by exact equality in `renameProject`/`setTags`, no path traversal possible — T-03-05-02 mitigated). INV-01 (read-only on project FS) preserved — neither route touches the project filesystem.

## Self-Check: PASSED
