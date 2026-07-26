---
phase: 00-bootstrap
plan: 01
subsystem: infra
tags: [pnpm-workspace, pnpm-catalog, vitest, typescript, eslint, prettier, github-actions, zod]

# Dependency graph
requires: []
provides:
  - "pnpm workspace with three package skeletons (shared, agent, spa)"
  - "Source-only @agenticapps/dashboard-shared exporting HealthResponseSchema (Zod) — single source of truth for daemon ↔ SPA wire shape"
  - "TypeScript strict baseline (tsconfig.base.json) + per-package tsconfig"
  - "ESLint flat config + Prettier wired across the workspace"
  - "Vitest test.projects with unique per-package names (shared, agent, spa)"
  - "GitHub Actions ci.yml running five gates (install/lint/typecheck/test/build) on push + pull_request"
  - "Pinned Phase 0 catalog (full library set Plans 02–04 will draw from)"
  - "Lockfile committed for --frozen-lockfile in CI"
affects: [00-02-agent-cli, 00-03-spa-shell, 00-04-release-workflow, 00-05-readme-docs]

# Tech tracking
tech-stack:
  added:
    - "pnpm 10.33 (workspaces + catalog protocol)"
    - "TypeScript 6.0.3 (strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess)"
    - "ESLint 9.39.4 (flat config) + typescript-eslint 8.59.1 + eslint-plugin-import + eslint-plugin-react + eslint-plugin-react-hooks + eslint-config-prettier"
    - "Prettier 3.8.3"
    - "Vitest 4.1.5 + @vitest/coverage-v8 4.1.5 + jsdom 29.1.1"
    - "Zod 3.24"
  patterns:
    - "Source-only shared package: exports field maps `.` straight to `./src/index.ts` — no build step in shared (RESEARCH Pattern 2)"
    - "pnpm catalog as single source of truth for cross-package versions; Plans 02 + 03 reference catalog: without re-touching pnpm-workspace.yaml (parallel-safe wave wiring)"
    - "ESLint flat config with file-glob overrides (SPA React rules, agent CLI overrides) — globs land idle in Plan 01, become live in Plans 02/03 without further config edits"
    - "Vitest test.projects from a single root config; per-package vitest.config.ts sets unique `name` (Pitfall 4) + per-project environment (node for shared/agent, jsdom for spa)"
    - "Stub-first TDD on bootstrap config: ci.yml ships first as a deliberately-incomplete stub that fails the structure-check matrix (RED), then the full file passes (GREEN) — TDD discipline applied to YAML config per CLAUDE.md"

key-files:
  created:
    - "pnpm-workspace.yaml"
    - "package.json (root)"
    - "tsconfig.base.json"
    - ".nvmrc, .editorconfig, .gitattributes"
    - "eslint.config.mjs, prettier.config.mjs"
    - "vitest.config.ts (root)"
    - "packages/shared/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/schemas/health.ts,src/schemas/health.test.ts}"
    - "packages/agent/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/index.test.ts}"
    - "packages/spa/{package.json,tsconfig.json,vitest.config.ts,src/index.ts,src/index.test.ts}"
    - ".github/workflows/ci.yml"
    - "pnpm-lock.yaml"
  modified:
    - ".gitignore (extended with node_modules/dist/coverage/.vite/etc.)"

key-decisions:
  - "Pinned ESLint to ^9.39.4 instead of the planned ^10.3.0 — eslint-plugin-react@7.37.5 caps its peer dep at ESLint 9.7 and crashes on ESLint 10's rule-context API change. ESLint 9 is the highest common denominator across all chosen plugins. Documented inline in pnpm-workspace.yaml; revisit when eslint-plugin-react ships ESLint 10 support."
  - "Source-only shared package (no build step) — Vite, Vitest, and tsx all resolve TypeScript sources directly through the `exports` field in monorepo mode. Defers any bundling concern in shared to a future phase if/when shared grows runtime-loadable surface."
  - "Full Phase 0 catalog committed in Plan 01 — even libraries Plans 02/03 will use (react, vite, tailwindcss, commander, tsx, etc.) live in pnpm-workspace.yaml now. Eliminates same-wave file-conflicts on the workspace YAML when Plans 02 + 03 run in parallel; both plans reference catalog: directly without touching the catalog file."

patterns-established:
  - "Source-only `packages/shared` exports `.ts` directly via `exports` field — no shared dist/, no shared build step until that pattern stops scaling."
  - "Per-package vitest.config.ts must declare a unique `name` (matches Vitest test.projects requirement)."
  - "Bootstrap config (CI workflow YAML, package.json publish metadata, etc.) is TDD-tested via stub-first structure-check matrix: stub ships first and fails the grep matrix (RED), full config passes (GREEN). Same RED → GREEN commit pair in git as for source-code TDD."
  - "Workspace-internal deps use `workspace:*` (always-local, RESEARCH anti-pattern note); never `workspace:^` or `workspace:~`."

requirements-completed: [BOOT-01, BOOT-02]

# Metrics
duration: 8min
completed: 2026-05-02
---

# Phase 00 Plan 01: Workspace smoke Summary

**pnpm workspace with three package skeletons + HealthResponseSchema (Zod) single-source-of-truth + ESLint 9 / typescript-eslint 8 / Prettier 3 / TypeScript 6 strict / Vitest 4 with per-project naming + CI workflow running five gates on push and pull_request.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-02T16:42:34Z
- **Completed:** 2026-05-02T16:50:06Z
- **Tasks:** 3 (Task 1 + Task 2 RED→GREEN + Task 3 RED→GREEN)
- **Files modified:** 23 created, 1 modified (.gitignore extension)

## Accomplishments
- Three-package pnpm workspace boots from a clean checkout: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test --run && pnpm build` all exit 0.
- `HealthResponseSchema` (Zod) lives in `@agenticapps/dashboard-shared` and is consumed by both `packages/agent` and `packages/spa` via `workspace:*` bare imports — proves the cross-package contract end-to-end without any shared build step.
- Vitest test.projects discovers all three projects from the single root config; 5 tests pass across shared (3) + agent (1) + spa (1, jsdom).
- `.github/workflows/ci.yml` runs the full five-gate matrix on push (main + feat/** + fix/** + chore/**) and pull_request (to main), with `permissions: contents: read` (T-00-02 mitigation) and `--frozen-lockfile` (T-00-01 mitigation).
- TDD discipline applied to both code (HealthResponseSchema) and bootstrap config (ci.yml): both have RED stubs in git history before their GREEN implementations.

## Task Commits

Each task was committed atomically (parallel-executor protocol: `--no-verify` on each commit; orchestrator runs hooks once after wave merge):

1. **Task 1: Workspace skeleton + root config + ESLint/Prettier** — `f6be570` (feat)
2. **Task 2 RED: HealthResponseSchema + workspace-resolution tests** — `850033e` (test)
3. **Task 2 GREEN: Implement HealthResponseSchema** — `5a4d6a5` (feat)
4. **Task 3 RED: Stub ci.yml for structure-check matrix** — `74b6eb1` (test)
5. **Task 3 GREEN: Full ci.yml with five gates on push + PR** — `07e97ab` (feat)

_TDD evidence: `git log --oneline -n 5 \| grep -cE "^[a-f0-9]+ (test\|feat)\(00-01\)"` → 3 commits with `feat(00-01)` and 2 with `test(00-01)`. Both Task 2 (schema) and Task 3 (CI workflow) have explicit RED → GREEN commit pairs._

## Files Created/Modified

**Workspace root:**
- `pnpm-workspace.yaml` — Phase 0 catalog (full library set; Plans 02+03 will reference without modifying)
- `package.json` — five-gate scripts + engines pin (node ≥ 20, pnpm ≥ 9.5)
- `tsconfig.base.json` — strict + exactOptionalPropertyTypes + noUncheckedIndexedAccess + Node16
- `eslint.config.mjs` — flat config; SPA React glob + agent CLI overrides land idle until Plans 02/03
- `prettier.config.mjs` — no semi, single quote, trailing-comma all, 100-col
- `vitest.config.ts` — root config with `test.projects: ['packages/*']`
- `.nvmrc` (`20`), `.editorconfig` (LF, 2-space), `.gitattributes` (LF normalization)
- `.gitignore` — extended (preserved existing `.claude/skills/`, added node_modules / dist / coverage / .vite / etc.)
- `pnpm-lock.yaml` — committed for CI `--frozen-lockfile`

**Per-package (shared / agent / spa):**
- `packages/{name}/package.json` — name, version, type=module, scripts (typecheck, test, build), workspace:* dep on shared (for agent + spa), zod (for shared), vitest+typescript devDeps, jsdom devDep (spa only)
- `packages/{name}/tsconfig.json` — extends base; per-package module/moduleResolution (Node16 for agent, Bundler for shared/spa)
- `packages/{name}/vitest.config.ts` — unique `name`, environment node (shared/agent) or jsdom (spa)
- `packages/{name}/src/index.ts` — entry barrel (shared exports HealthResponseSchema; agent + spa are placeholder `export {}` until Plans 02/03)
- `packages/{name}/src/index.test.ts` (agent + spa) — workspace resolution tests
- `packages/shared/src/schemas/health.ts` — `HealthResponseSchema` (Zod object) + inferred `HealthResponse` type
- `packages/shared/src/schemas/health.test.ts` — 3 tests: valid parse, missing-ok rejection, optional message

**CI:**
- `.github/workflows/ci.yml` — five gates on push + pull_request, pinned actions (checkout@v6, setup-node@v4, pnpm/action-setup@v6), `permissions: contents: read`

## Decisions Made

- **ESLint pinned to v9 (not v10):** eslint-plugin-react@7.37.5 (the latest released version) caps its peer-dep range at ESLint 9.7 and throws a TypeError loading rules under ESLint 10. ESLint 9.39.4 is supported by all five chosen plugins. The plan's RESEARCH.md verified ESLint 10 against the npm registry but didn't cross-check `eslint-plugin-react` peer-dep compatibility. Rationale documented inline in `pnpm-workspace.yaml`.
- **Source-only `packages/shared`:** matches RESEARCH Pattern 2 and D-06 — Phase 0 has a single schema; a build step would be premature. The agent's eventual npm publish (Plan 02) will inline-bundle the schema rather than expose `@agenticapps/dashboard-shared` as a runtime dep.
- **Full catalog landed in Plan 01:** allows Plans 02 and 03 to be parallel-safe under the wave-2 scheduler. Both consume `catalog:` specifiers without touching `pnpm-workspace.yaml`. Same logic applied to `eslint.config.mjs`: SPA + agent globs ship now (idle until Plans 02/03 add matching files), preventing a same-file conflict during parallel execution.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking compatibility] ESLint pinned to ^9.39.4 instead of ^10.3.0**
- **Found during:** Task 1 verification — first run of `pnpm lint` crashed with `TypeError: Error while loading rule 'react/display-name': contextOrFilename.getFilename is not a function` from `eslint-plugin-react@7.37.5/lib/util/version.js:31:100`.
- **Issue:** The plan's RESEARCH.md specified `eslint: ^10.3.0` based on npm registry version verification, but didn't cross-check `eslint-plugin-react`'s peer-dep range. The latest published `eslint-plugin-react` is `7.37.5` and its `peerDependencies.eslint` reads `^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7` — no v10 support yet. The internal API change in ESLint 10's rule-context interface causes a hard crash on rule load against any matched file in the SPA glob.
- **Fix:** Changed catalog entry from `eslint: ^10.3.0` to `eslint: ^9.39.4` (latest 9.x maintenance line). Verified all other plugins still support 9: `typescript-eslint 8.59.1` declares `^8.57.0 || ^9.0.0 || ^10.0.0`, `eslint-config-prettier 10.1.8` declares `>=7.0.0`, `eslint-plugin-react-hooks 7.1.1` declares `^9.0.0 || ^10.0.0`, `eslint-plugin-import 2.32.0` declares `^9`. ESLint 9 is the highest common denominator.
- **Files modified:** `pnpm-workspace.yaml` (catalog entry + multi-line comment explaining the constraint and revisit-trigger).
- **Verification:** `pnpm install` → `pnpm lint` exit 0; structure-check confirms no rule-load errors. All other gates still green.
- **Committed in:** `f6be570` (Task 1 GREEN) — fix landed before any test or task-1 commit, so the workspace is shipped with the working version.

**2. [Rule 1 — Lint clean-up] Removed inter-import blank line in agent + spa test files**
- **Found during:** Task 2 GREEN — first `pnpm lint` after RED commit reported 2 warnings: `import/order: There should be no empty line within import group`.
- **Issue:** I had separated `import { describe, it, expect } from 'vitest'` from `import { HealthResponseSchema } from '@agenticapps/dashboard-shared'` with a blank line. Both resolve to the `external` group under `eslint-plugin-import`, so newlines-between-groups doesn't apply.
- **Fix:** Removed the blank line in `packages/agent/src/index.test.ts` and `packages/spa/src/index.test.ts`. The shared health.test.ts is untouched because `'../index.js'` is the `parent` group (different from `'vitest'`'s `external` group), so the blank line there is correct.
- **Files modified:** `packages/agent/src/index.test.ts`, `packages/spa/src/index.test.ts`.
- **Verification:** `pnpm lint` exits 0 with zero warnings (only the benign "react version detect" info line remains).
- **Committed in:** `5a4d6a5` (Task 2 GREEN) — folded into the GREEN commit since the warning surfaced after lint became sensitive to the test-file imports.

---

**Total deviations:** 2 auto-fixed (1 blocking compatibility, 1 lint clean-up)
**Impact on plan:** Both fixes were strictly within scope of the affected tasks. The ESLint pin is a pure version downgrade; the lint clean-up is one-line edits. No scope creep, no architectural changes.

## Issues Encountered

- **Worktree branch was based on a stale commit (5d736bc) instead of the expected base (e2a7938)** — the worktree branch had only 4 placeholder commits and was missing all `.planning/` files and `CLAUDE.md`. Resolved with `git reset --hard e2a7938553cae0ecf876fa41aea8e2191d59f133` per the worktree-branch-check protocol; all planning files restored in the working tree before Task 1 began.

## Self-Check: PASSED

All 27 files claimed in the SUMMARY exist on disk. All 5 commit hashes (f6be570, 850033e, 5a4d6a5, 74b6eb1, 07e97ab) exist in git history. Five-gate suite verified green from a clean tree (node_modules wiped + `pnpm install --frozen-lockfile` + lint + typecheck + test --run + build all exit 0).

## Next Plan Readiness

- **Plan 02 (`@agenticapps/dashboard-agent` CLI + tsup bundle + npm metadata):**
  - `packages/agent/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}` ready as the canvas; `commander` and `tsx` already in catalog.
  - Agent CLI ESLint glob (`packages/agent/src/**/*.ts`) already permits `no-console` + `no-process-exit`.
  - Workspace:* dep on shared resolves; agent's index.test.ts proves bare-import works.
  - To do in Plan 02: replace the placeholder `export {}` in `packages/agent/src/index.ts` with the commander entry; flip `private: true → false` only after `bin` and `files` fields are wired.
- **Plan 03 (SPA shell with React + Tailwind 4 + Vite):**
  - SPA stack already in catalog (react, react-dom, vite, @vitejs/plugin-react, tailwindcss, @tailwindcss/vite, @tanstack/react-query, lucide-react, @testing-library/react, @testing-library/jest-dom).
  - SPA ESLint React glob (`packages/spa/**/*.{ts,tsx}`) already wired; will become live when `.tsx` files land.
  - SPA's vitest jsdom env already configured; Plan 03 just needs to add `setupFiles` for `@testing-library/jest-dom` matchers.
  - To do in Plan 03: replace placeholder, add `vite.config.ts`, `index.html`, `App.tsx`, etc.
- **Plan 04 (release.yml + agent publish metadata):**
  - `permissions: contents: read` baseline established in `ci.yml`; release.yml will scope `id-token: write` to itself only.
  - npm provenance pattern not yet wired (Plan 04 work).

**Concerns / blockers:**
- Watch the `eslint-plugin-react` upstream — once it ships ESLint 10 support, the catalog can move forward. Tracked inline in `pnpm-workspace.yaml`; not blocking any Phase 0 work.
- The "react version detect" warning during lint will go away once Plan 03 adds `react` to the SPA's dependencies.

---
*Phase: 00-bootstrap*
*Plan: 01*
*Completed: 2026-05-02*
