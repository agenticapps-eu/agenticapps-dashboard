---
phase: 01-daemon-registry-pairing
plan: "01"
subsystem: infra
tags: [zod, hono, execa, picocolors, tsup, shared-schemas, registry, auth, tdd]

requires:
  - phase: 00-bootstrap
    provides: pnpm workspace with shared package, agent package, tsup build config, vitest test setup

provides:
  - zod catalog bumped ^3.24.0 → ^3.25.0 (peer-dep for @hono/zod-validator)
  - hono, @hono/node-server, @hono/zod-validator, execa, picocolors installed in packages/agent
  - 6 new shared Zod schemas (auth, registry, read, git, errors, server)
  - HealthResponseSchema extended with optional daemonVersion/registryCount/paired
  - All new schemas re-exported from packages/shared/src/index.ts
  - tsup noExternal expanded to bundle all 8 runtime deps

affects:
  - 01-02 (auth file + bearer token — imports AuthFileSchema)
  - 01-03 (registry CRUD — imports RegistryEntrySchema, RegistryFileSchema, etc.)
  - 01-04 (Hono server — imports all schemas for route handlers)
  - 01-05 (health + read + git routes — imports ReadResponseSchema, GitResponseSchema)

tech-stack:
  added:
    - hono@4.12.16 (HTTP server + middleware)
    - "@hono/node-server@2.0.1" (Node.js HTTP adapter)
    - "@hono/zod-validator@0.7.6" (request validation middleware)
    - execa@9.6.1 (subprocess spawning — git, tailscale)
    - picocolors@1.1.1 (terminal color for banner/warnings)
    - zod@3.25.76 (resolved version from ^3.25.0 catalog)
  patterns:
    - "Schema-first: all daemon ↔ SPA wire shapes defined in packages/shared before implementation"
    - "Backward-compat extension: new schema fields are .optional() to preserve Phase 0 contract"
    - "TDD red-green-refactor: test files written and committed before schema implementations"
    - "tsup noExternal allowlist must exactly match dependencies block"

key-files:
  created:
    - packages/shared/src/schemas/auth.ts
    - packages/shared/src/schemas/registry.ts
    - packages/shared/src/schemas/read.ts
    - packages/shared/src/schemas/git.ts
    - packages/shared/src/schemas/errors.ts
    - packages/shared/src/schemas/server.ts
    - packages/shared/src/schemas/auth.test.ts
    - packages/shared/src/schemas/registry.test.ts
    - packages/shared/src/schemas/errors.test.ts
  modified:
    - pnpm-workspace.yaml (zod catalog ^3.24.0 → ^3.25.0)
    - packages/agent/package.json (8 runtime deps moved to dependencies)
    - packages/agent/tsup.config.ts (noExternal expanded to 8 entries)
    - packages/shared/src/schemas/health.ts (extended with 3 optional fields)
    - packages/shared/src/schemas/health.test.ts (2 new tests for optional fields)
    - packages/shared/src/index.ts (6 new schema re-exports)
    - pnpm-lock.yaml (updated with new resolved packages)

key-decisions:
  - "Extend HealthResponseSchema in-place (not a new schema) — new fields .optional() for backward compat with Phase 0 --version --json"
  - "Move @agenticapps/dashboard-shared and commander from devDependencies to dependencies — they are runtime deps needed in the published npm bundle"
  - "noExternal allowlist strategy: explicitly list every runtime dep to ensure tsup bundles them — prevents MODULE_NOT_FOUND on npx installs"

patterns-established:
  - "Schema-first: all wire shapes in packages/shared before any route implementation begins"
  - "Catalog-pin strategy: bump zod catalog before adding peer-dep packages"
  - "TDD for schemas: test file committed RED, then implementation committed GREEN"

requirements-completed:
  - INV-02
  - INV-05
  - API-01
  - AUTH-01
  - AUTH-02
  - AUTH-03

duration: 3min
completed: "2026-05-03"
---

# Phase 01 Plan 01: Dependency Floor + Shared Schema Stubs Summary

**zod catalog bumped ^3.25.0, hono/execa/picocolors runtime deps installed in packages/agent, and 6 Zod schemas (auth, registry, read, git, errors, server) created in packages/shared as the type contract for all Wave 1+ implementations**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-03T10:35:45Z
- **Completed:** 2026-05-03T10:38:48Z
- **Tasks:** 2 (1 chore + 1 TDD feat)
- **Files modified:** 11

## Accomplishments

- Bumped zod catalog from ^3.24.0 to ^3.25.0, resolving @hono/zod-validator 0.7.x peer-dep requirement cleanly — no `unmet peer dependency` warnings on `pnpm install`
- Installed 5 new runtime deps (hono@4.12.16, @hono/node-server@2.0.1, @hono/zod-validator@0.7.6, execa@9.6.1, picocolors@1.1.1) into packages/agent dependencies (not devDependencies); expanded tsup noExternal to bundle all 8 runtime deps into dist/cli.js
- Created 6 new Zod schema files in packages/shared/src/schemas/ covering the full daemon ↔ SPA wire contract; all schemas re-exported from index.ts; HealthResponseSchema extended with 3 optional Phase 1 fields while keeping all 3 Phase 0 tests passing

## Task Commits

1. **Task 1: Bump zod catalog + install Phase 1 runtime deps** - `4b81c4e` (chore)
2. **Task 2 RED: Failing tests for Phase 1 schema stubs** - `f71bc76` (test)
3. **Task 2 GREEN: Implement Phase 1 shared schemas** - `8814890` (feat)

## Files Created/Modified

- `pnpm-workspace.yaml` — zod catalog bumped ^3.24.0 → ^3.25.0
- `packages/agent/package.json` — 8 runtime deps added to dependencies; @agenticapps/dashboard-shared + commander moved from devDeps
- `packages/agent/tsup.config.ts` — noExternal expanded: hono, @hono/node-server, @hono/zod-validator, execa, picocolors added
- `pnpm-lock.yaml` — updated with resolved versions (zod@3.25.76, hono@4.12.16, etc.)
- `packages/shared/src/schemas/auth.ts` — AuthFileSchema: version literal(1), token, rotatedAt ISO datetime, agentVersion
- `packages/shared/src/schemas/registry.ts` — RegistryEntrySchema, RegistryFileSchema, RegistryListItemSchema, RegistryListResponseSchema, StatusResponseSchema
- `packages/shared/src/schemas/read.ts` — ReadResponseSchema: content, mtime ISO, sha256 64-char hex
- `packages/shared/src/schemas/git.ts` — GitResponseSchema: stdout, stderr, exitCode int
- `packages/shared/src/schemas/errors.ts` — ErrorResponseSchema: ok literal(false), error, requestId, optional issues array
- `packages/shared/src/schemas/server.ts` — ServerInfoSchema: bindUrl URL, pid positive int, startedAt ISO datetime
- `packages/shared/src/schemas/health.ts` — extended with optional daemonVersion, registryCount, paired
- `packages/shared/src/schemas/health.test.ts` — 2 new tests for optional fields
- `packages/shared/src/schemas/auth.test.ts` — 4 tests (RED → GREEN)
- `packages/shared/src/schemas/registry.test.ts` — 7 tests (RED → GREEN)
- `packages/shared/src/schemas/errors.test.ts` — 3 tests (RED → GREEN)
- `packages/shared/src/index.ts` — 6 new schema + type re-exports added

## Decisions Made

- Extended HealthResponseSchema in-place (not a new schema) — new fields are `.optional()` for backward compatibility with Phase 0's `--version --json` output which only includes `ok` and `version`
- Moved `@agenticapps/dashboard-shared` and `commander` from devDependencies to dependencies — these are runtime deps required in the published npm bundle; leaving them in devDeps would cause MODULE_NOT_FOUND on `npx @agenticapps/dashboard-agent`
- Explicit tsup noExternal allowlist strategy: every dep in the `dependencies` block is also in `noExternal` — ensures tsup bundles them into dist/cli.js for portable `npx` distribution

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All Wave 1 test files can now `import { AuthFileSchema, RegistryEntrySchema, ErrorResponseSchema, ServerInfoSchema } from '@agenticapps/dashboard-shared'` and get proper TypeScript types
- Hono, execa, and picocolors are installed and bundled — Plan 02 (auth file + daemon startup) and Plan 03 (Hono server) can begin
- zod@3.25.76 resolved — no peer-dep conflict with @hono/zod-validator@0.7.6
- dist/cli.js builds cleanly with all 8 deps bundled (no external hono imports in output)

---
*Phase: 01-daemon-registry-pairing*
*Completed: 2026-05-03*

## Self-Check: PASSED

All created files confirmed present and all commits verified in git log.
