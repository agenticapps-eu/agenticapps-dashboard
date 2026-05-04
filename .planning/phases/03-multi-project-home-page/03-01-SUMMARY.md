---
phase: 03-multi-project-home-page
plan: "01"
subsystem: shared-schemas + agent-libs + spa-lib
tags: [schemas, zod, nonces, rate-limiting, caching, filesystem-reader, touch]
dependency_graph:
  requires: []
  provides:
    - "@agenticapps/dashboard-shared: ProjectOverviewSchema, FindingCountsSchema, DbAuditFindingsSchema, MarkersSchema"
    - "@agenticapps/dashboard-shared: RegisterPrepareRequestSchema, RegisterPrepareResponseSchema, RegisterConfirmRequestSchema, RenameRequestSchema, TagsRequestSchema"
    - "packages/agent/src/lib/registerNonces.ts: issueNonce, consumeNonce, cleanupExpired"
    - "packages/agent/src/lib/rateLimiter.ts: tokenHashOf, consume, sweepOldTimestamps"
    - "packages/agent/src/lib/registerLog.ts: logBlocked"
    - "packages/agent/src/lib/overviewCache.ts: getCached, setCached, evict"
    - "packages/agent/src/lib/projectOverview.ts: readOverview, parseReviewFile, parseVerification, parseTddPairs, detectBranch, detectMarkers, findLatestPhaseDir"
    - "packages/spa/src/lib/touchLongPress.ts: useLongPress"
  affects:
    - "Wave 1 executor (03-02..03-05): daemon routes use these libs directly"
    - "Wave 2 executor (03-06..03-09): SPA components import ProjectOverviewSchema and useLongPress"
tech_stack:
  added:
    - "ProjectOverviewSchema (Zod): phaseStatus enum + 7 nullable sub-objects"
    - "NonceHexSchema (/^[0-9a-f]{32}$/): 32-char CSPRNG nonce validation"
    - "RegisterPrepareResponseSchema (z.union, 3-way): no discriminatedUnion — no shared discriminator"
  patterns:
    - "Lazy cache expiry: getCached checks expiresAt on read, deletes stale entry"
    - "setInterval().unref(): sweep intervals don't prevent process exit in tests"
    - "execa argv-array: all git subprocess calls use fixed argv arrays (no shell)"
    - "Defense-in-depth: readOverview validates against ProjectOverviewSchema.parse() before returning"
key_files:
  created:
    - packages/shared/src/schemas/overview.ts
    - packages/shared/src/schemas/overview.test.ts
    - packages/agent/src/lib/registerNonces.ts
    - packages/agent/src/lib/registerNonces.test.ts
    - packages/agent/src/lib/rateLimiter.ts
    - packages/agent/src/lib/rateLimiter.test.ts
    - packages/agent/src/lib/registerLog.ts
    - packages/agent/src/lib/registerLog.test.ts
    - packages/agent/src/lib/overviewCache.ts
    - packages/agent/src/lib/overviewCache.test.ts
    - packages/agent/src/lib/projectOverview.ts
    - packages/agent/src/lib/projectOverview.test.ts
    - packages/agent/src/lib/__fixtures__/sample-project/.planning/phases/02-foo/02-PLAN.md
    - packages/agent/src/lib/__fixtures__/sample-project/.planning/phases/02-foo/02-REVIEW.md
    - packages/agent/src/lib/__fixtures__/sample-project/.planning/phases/02-foo/02-VERIFICATION.md
    - packages/spa/src/lib/touchLongPress.ts
    - packages/spa/src/lib/touchLongPress.test.tsx
  modified:
    - packages/shared/src/schemas/registry.ts
    - packages/shared/src/schemas/registry.test.ts
    - packages/shared/src/index.ts
decisions:
  - "VERIFICATION.md format: used two heuristics — bold-bullet lines (/^\\s*-\\s*\\*\\*[^*]+\\*\\*/) for mustHaves, '**Evidence' occurrences for evidence count. Workflow skill SKILL.md does not prescribe a rigid format; heuristics match Phase 2 VERIFICATION.md in the codebase."
  - "3-way union (z.union not z.discriminatedUnion) for RegisterPrepareResponseSchema: no single discriminator field covers all three shapes (allowed has both blocked:false + alreadyRegistered:false; RESEARCH Pattern 20 confirmed this)"
  - "parseTddPairs/detectBranch test isolation: fixture is inside the git worktree so git walks up and finds the repo. Tests use isolated /tmp dirs (outside any git repo) for the no-git behavior."
  - "touchLongPress test file is .tsx (not .ts): JSX in test requires tsx extension for Vite/oxc transform."
metrics:
  duration: "~35 minutes"
  completed: "2026-05-04"
  tasks: 3
  files: 20
---

# Phase 3 Plan 01: Wave 0 Foundation — Shared Schemas + Daemon/SPA Libs Summary

One-liner: CSPRNG nonce store, sliding-window rate limiter, 5s memo cache, filesystem overview reader, and 3-way prepare/confirm/rename/tags Zod schemas wired as the shared contract for all Wave 1 daemon routes and Wave 2 SPA components.

## What Was Built

### Task 1 — Shared schemas (commit 8939d54)

**New file: `packages/shared/src/schemas/overview.ts`**

Exports:
- `FindingCountsSchema` — `{ red, yellow, green }` nonnegative integers
- `DbAuditFindingsSchema` — `{ critical, high, medium, low }` nonnegative integers
- `MarkersSchema` — `{ gitRepo, planning, claudeSkills }` booleans
- `ProjectOverviewSchema` — top-level schema with `phaseStatus: enum['Pending', 'In Progress', 'Complete']` + 6 nullable sub-objects
- Inferred `ProjectOverview` type

**Extended: `packages/shared/src/schemas/registry.ts`**

Added (below existing Phase 1 exports — no removals):
- `RegisterPrepareRequestSchema` — `{ path: string.min(1) }`
- `NonceHexSchema` — internal, `/^[0-9a-f]{32}$/` regex
- `RegisterPrepareResponseSchema` — `z.union([allowed, blocked, alreadyRegistered])` — 3-way per RESEARCH Pattern 20
- `RegisterConfirmRequestSchema` — `{ nonce: NonceHexSchema, name?, client?, tags? }`
- `RegisterConfirmResponseSchema` — alias of `RegisterResponseSchema`
- `RenameRequestSchema` — `{ name: string.min(1) }`
- `TagsRequestSchema` — `{ tags: string[] }`

**Extended: `packages/shared/src/index.ts`** — barrel re-exports all new schemas and types.

**Tests:** 4 new overview tests + 8 new registry tests. All 57 shared tests pass.

### Task 2 — Daemon libs (commit 7dfee8b)

**`registerNonces.ts`** (D-10, T-03-01-01, T-03-01-03):
- `issueNonce`: `crypto.randomBytes(16).toString('hex')` → 32-char nonce, 5-min TTL
- `consumeNonce`: single-use, deletes on every call (unknown OR expired → null)
- `cleanupExpired`: removes entries past `expiresAt`
- 60s sweep interval with `.unref()` to avoid test hangs

**`rateLimiter.ts`** (D-14):
- `tokenHashOf`: first 8 chars of sha256(token) — privacy-preserving key
- `consume`: sliding 10s window, 10-burst cap, returns `{ allowed: false, retryAfter: 1 }` on cap
- `sweepOldTimestamps`: removes stale entries
- 60s sweep with `.unref()`

**`registerLog.ts`** (D-15, T-03-01-02):
- `logBlocked`: single-line stderr in `[agent] BLOCKED register: <root> (<reason>) tokenHash=<8> requestId=<uuid>` format
- Sanitizes `\n` → `\\n` in `reason` and `root` (log injection prevention)

**`overviewCache.ts`** (D-02, T-03-01-04):
- `getCached`: lazy expiry — checks `expiresAt` on read, deletes stale entry
- `setCached`: stores with `now + 5_000ms` TTL
- `evict`: call on unregister (documented in JSDoc per T-03-01-04)
- No background sweeper — bounded by registry size (~5–50 entries)

All 194 agent tests pass (up from 179 before this plan).

### Task 3 — projectOverview reader + useLongPress (commits 36081c7, 952d1af)

**`projectOverview.ts`** (HOME-02, D-04, T-03-01-05, T-03-01-06):
- `detectMarkers(root)` — existsSync checks for `.git`, `.planning`, `.claude/skills`
- `findLatestPhaseDir(root)` — sorts `phases/` entries by leading numeric prefix descending
- `parseReviewFile(filePath)` — YAML frontmatter `critical/warning/info` → `red/yellow/green`; falls back to `<finding severity="...">` tag counting when no frontmatter (Pitfall 1)
- `parseVerification(filePath)` — counts bold-bullet lines (`/^\s*-\s*\*\*[^*]+\*\*/`) for mustHaves; counts `**Evidence` occurrences for evidence
- `parseTddPairs(root)` — `execa('git', ['log', '--format=%s', '--no-merges'], ...)` with 5s timeout, argv-array (T-03-01-06)
- `detectBranch(root)` — `execa('git', ['symbolic-ref', '--short', 'HEAD'], ...)`, returns null on error
- `readOverview(root)` — composes all the above into `ProjectOverview`; validates with `ProjectOverviewSchema.parse()` before returning (defense-in-depth per D-07)

**Fixtures** under `packages/agent/src/lib/__fixtures__/sample-project/`:
- `02-PLAN.md` — minimal stub (satisfies hasPlan check)
- `02-REVIEW.md` — real Phase 2 frontmatter format: `critical: 0, warning: 2, info: 5`
- `02-VERIFICATION.md` — 3 bold-bullet mustHaves, 2 `**Evidence` occurrences → `In Progress`

**`touchLongPress.ts`** (D-23, D-43):
- `useLongPress(onLongPress, delay=500)` — Pointer Events hook
- 500ms `window.setTimeout` on pointerDown
- Cancels on pointerUp, pointerCancel, or pointermove > 8px delta (`Math.hypot`)
- No visual feedback during press (D-43)
- Test file is `.tsx` (JSX required for @testing-library/react render)

## VERIFICATION.md Format Chosen

The workflow skill (`SKILL.md`) does not prescribe a specific VERIFICATION.md format — it only requires that human-verified truths be recorded. The heuristics chosen match the actual Phase 2 VERIFICATION.md format used in this codebase:
- **mustHaves:** lines matching `^\s*-\s*\*\*[^*]+\*\*` (bold-bullet list items like `- **truth** description`)
- **evidence:** occurrences of `**Evidence` (bold Evidence label in table rows or inline prose)

These patterns are referenced in `parseVerification`'s JSDoc.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] parseTddPairs/detectBranch test using fixture inside git repo**
- **Found during:** Task 3 test run
- **Issue:** The `sample-project` fixture is inside the worktree (a git repo), so `git symbolic-ref --short HEAD` walks up and finds the worktree branch — returning a non-null result instead of null.
- **Fix:** Changed the "no git" tests to use an isolated `/tmp` dir (outside any git tree) instead of the fixture root.
- **Files modified:** `packages/agent/src/lib/projectOverview.test.ts`
- **Commit:** 36081c7

**2. [Rule 2 - Missing Critical Functionality] TypeScript strict mode non-null assertions**
- **Found during:** `pnpm -r typecheck` after Task 3
- **Issue:** Regex match group accesses (`match[1]`) typed as `string | undefined`; array index access (`dirs[0]`) typed as `string | undefined`.
- **Fix:** Added `!` non-null assertions at 7 locations where match is guaranteed by surrounding guard.
- **Files modified:** `packages/agent/src/lib/projectOverview.ts`, `packages/agent/src/lib/registerLog.test.ts`
- **Commit:** 952d1af

**3. [Rule 1 - Bug] touchLongPress test file extension**
- **Found during:** Task 3 test run
- **Issue:** Test file had `.ts` extension but used JSX — Vite/oxc parse error.
- **Fix:** Renamed to `.tsx`.
- **Files modified:** `packages/spa/src/lib/touchLongPress.test.tsx`
- **Commit:** 36081c7

**4. [Rule 2 - Missing Critical Functionality] ESLint import-order cleanup**
- **Found during:** `pnpm lint` after Task 3
- **Issue:** Several new files had import group ordering violations (vitest and @agenticapps/dashboard-shared in same third-party group with extra blank lines; unused `vi` and `basename` imports).
- **Fix:** Merged import groups, removed unused imports.
- **Files modified:** `packages/agent/src/lib/projectOverview.ts`, `packages/agent/src/lib/projectOverview.test.ts`, `packages/agent/src/lib/overviewCache.test.ts`, `packages/agent/src/lib/registerLog.test.ts`
- **Commit:** 952d1af

## Test Count Delta

| Package | Before Plan 01 | After Plan 01 | Delta |
|---------|---------------|---------------|-------|
| shared  | 49            | 57            | +8    |
| agent   | 179 (33 files)| 194 (33 files)| +15   |
| spa     | 124           | 128           | +4    |
| **Total** | **352**     | **379**       | **+27** |

All Phase 1 and Phase 2 tests remain green — no regressions.

## Self-Check

### Files exist
- packages/shared/src/schemas/overview.ts — FOUND
- packages/shared/src/schemas/registry.ts (extended) — FOUND
- packages/shared/src/index.ts (extended) — FOUND
- packages/agent/src/lib/registerNonces.ts — FOUND
- packages/agent/src/lib/rateLimiter.ts — FOUND
- packages/agent/src/lib/registerLog.ts — FOUND
- packages/agent/src/lib/overviewCache.ts — FOUND
- packages/agent/src/lib/projectOverview.ts — FOUND
- packages/spa/src/lib/touchLongPress.ts — FOUND
- packages/agent/src/lib/__fixtures__/sample-project/.planning/phases/02-foo/02-REVIEW.md — FOUND

### Commits exist
- 8939d54 — Task 1 shared schemas
- 7dfee8b — Task 2 daemon libs
- 36081c7 — Task 3 projectOverview + useLongPress
- 952d1af — Fix typecheck + lint

## Self-Check: PASSED

All files exist, all commits verified, 379 tests pass, `pnpm -r typecheck` and `pnpm lint` both exit 0 (lint: 2 pre-existing warnings in unrelated files only).
