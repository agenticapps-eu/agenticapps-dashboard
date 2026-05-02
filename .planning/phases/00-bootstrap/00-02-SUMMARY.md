---
phase: 00-bootstrap
plan: 02
subsystem: agent
tags: [agent-cli, commander, tsup, esm-bundle, npm-publish, prerelease, tdd-subprocess]

# Dependency graph
requires: [00-01]
provides:
  - "Buildable @agenticapps/dashboard-agent CLI: commander entry, ESM, shebang, target node20"
  - "tsup bundle config inlining @agenticapps/dashboard-shared + commander + zod (T-00-04 mitigation: zero runtime workspace deps in published artifact)"
  - "Subprocess + bundle-integrity test suite that runs against the *built* dist/cli.js, not the dev source — exercises the publishable artifact"
  - "publish:dry npm script (pnpm publish --dry-run --no-git-checks --tag alpha) — gates the publish shape on every CI run; ready for Plan 04 release.yml to wire"
  - "AGENT_VERSION constant module shared between CLI and (future) library exports"
affects: [00-04-release-workflow]

# Tech tracking
tech-stack:
  added:
    - "tsup ^8.5.1 (ESM bundler with dts + sourcemap; pinned to 8.x — ^9 not yet on npm registry as of 2026-05-02)"
    - "@types/node ^20.19.39 (process/console types in agent CLI; pinned to Node 20 LTS line matching .nvmrc)"
    - "commander 14.0.3 (already in catalog from Plan 01; first runtime use here)"
  patterns:
    - "ESM CLI banner = #!/usr/bin/env node + createRequire shim — esbuild's default dynamic-require shim cannot resolve commander's `require('events')` in the bundled CJS path; the createRequire banner satisfies it against Node's real builtin module"
    - "Pre-parse --version --json intercept before program.parse() — RESEARCH Pitfall 5 (commander's --version doesn't compose with subcommands; --json is a flag, not a subcommand)"
    - "Subprocess tests built-artifact-first: beforeAll runs `pnpm build` via spawnSync(argv-array) so the test suite always exercises the dist/cli.js that will ship to npm"
    - "Dry-run publish requires --tag alpha for prerelease versions on npm 10+ — baked into a publish:dry script so Plan 04's release.yml inherits the right invocation"

key-files:
  created:
    - "packages/agent/tsup.config.ts"
    - "packages/agent/src/cli.ts"
    - "packages/agent/src/cli.test.ts"
    - "packages/agent/src/version.ts"
    - "packages/agent/.npmignore"
  modified:
    - "packages/agent/package.json (private→false, bin/files/exports, build=tsup, prepublishOnly, publish:dry, dependencies={}, +tsup +@types/node +shared workspace dep)"
    - "packages/agent/src/index.ts (placeholder export {} → re-export AGENT_VERSION)"
    - "packages/agent/tsconfig.json (types=[node] + ignoreDeprecations=6.0)"
    - "pnpm-lock.yaml"

key-decisions:
  - "tsup pinned to ^8.5.1: plan specified ^9.0.0 but tsup latest published is 8.5.1 (npm view 2026-05-02). 8.x supports node20 + ESM + dts + noExternal — every feature this plan needs."
  - "createRequire banner injected into the CLI bundle: commander is CommonJS internally; when esbuild bundles CJS-into-ESM with format:'esm', any `require()` call in the dependency triggers a runtime 'Dynamic require not supported' shim error. Adding `import { createRequire } from \"node:module\"; const require = createRequire(import.meta.url);` to the banner gives the bundle a real require for Node builtins. Node 20+ guarantees `node:module`."
  - "@types/node added at the agent package level (not the catalog): only the agent uses Node globals (process, console, child_process). Adding it to the catalog would force the SPA to pull node types it doesn't need. The 20.x line matches .nvmrc."
  - "publish:dry script uses --tag alpha: npm 10 mandates --tag for prerelease versions (those whose semver has a hyphen-suffix like 0.0.1-alpha.0). Without --tag, npm errors with 'You must specify a tag when publishing a prerelease version'. The script bakes the alpha-channel choice into the package; Plan 04's release.yml will inherit the same flag."

requirements-completed: [BOOT-04]

# Metrics
duration: ~7 min
completed: 2026-05-02
---

# Phase 00 Plan 02: Agent CLI Summary

**Placeholder `@agenticapps/dashboard-agent` CLI: commander-based ESM CLI with `--version`, `--version --json`, and `start` commands; tsup bundles `@agenticapps/dashboard-shared` + `commander` + `zod` into a self-contained ESM artifact (zero runtime workspace deps, T-00-04 mitigated). Subprocess + bundle-integrity test suite runs against the built `dist/cli.js`. Dry-run publish succeeds with `--tag alpha`.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-02T16:55:15Z
- **Completed:** 2026-05-02T17:02:14Z
- **Tasks:** 2 (Task 1 build + Task 2 RED→GREEN+lint-fix)
- **Files:** 5 created, 4 modified

## Task Commits

Each task committed atomically with `--no-verify` (parallel-executor protocol; orchestrator runs hooks once after wave merge):

1. **Task 1: tsup bundle config + version module + commander CLI source** — `a01b4d6` (feat)
2. **Task 2 RED: CLI subprocess + bundle-integrity tests** — `f8fc5c4` (test)
3. **Task 2 GREEN: publish:dry script + import-group cleanup** — `6769bf2` (feat)
4. **Task 2 follow-up: drop literal execSync token from comment for grep gate** — `530be5d` (fix)

_TDD evidence: `git log --oneline -n 10 | grep -cE "^[a-f0-9]+ (test|feat)\(00-02\)"` → 3 commits matching the required pair (1 test + 2 feat). RED was demonstrated meaningfully: temporarily disabling the `--version --json` block in `cli.ts` produced exactly one failing test (Test 3, `JSON.parse` on empty stdout); cli.ts then restored before the RED test commit landed._

## Acceptance Verification

### Task 1 (build/runtime smoke)

| Criterion | Evidence |
|-----------|----------|
| `bin["agentic-dashboard"] === "./dist/cli.js"` | `node -p '...'` → `./dist/cli.js` |
| `private === false` | `node -p '...'` → `false` |
| `files === ["dist"]` | `node -p '...'` → `["dist"]` |
| `dependencies === {}` | `node -p '...'` → `{}` (commander + shared in devDeps; bundled by tsup) |
| `tsup.config.ts` `noExternal: ['@agenticapps/dashboard-shared', 'commander', 'zod']` + shebang banner | grep + read |
| `head -1 dist/cli.js === "#!/usr/bin/env node"` | confirmed |
| `node dist/cli.js --version` → `0.0.1-alpha.0` | confirmed |
| `node dist/cli.js start` → `alpha placeholder` + `Phase 1` | confirmed (two lines: alpha placeholder + register-once-Phase-1-ships hint) |
| `pnpm-workspace.yaml` already has commander + tsx in catalog (untouched here) | confirmed |

### Task 2 (TDD + dry-run gate)

| Criterion | Evidence |
|-----------|----------|
| `cli.test.ts` exists with 5 `it()` blocks | confirmed |
| `cli.test.ts` contains `spawnSync`, no `execSync` | `grep -c spawnSync` → 6, `grep -c execSync` → 0 (after fix `530be5d`) |
| `pnpm --filter @agenticapps/dashboard-agent test --run` exits 0, 6 tests passing | 5 from `cli.test.ts` + 1 from `index.test.ts` (Plan 01 workspace-resolution test, untouched) |
| TDD commit pair in git: `test(00-02):` + `feat(00-02):` | 1 test + 2 feat = 3 commits matching gate |
| `pnpm publish --dry-run --no-git-checks --tag alpha` exits 0 | confirmed (see tarball below) |
| Tarball contains only `dist/*` + `package.json`; NO `src/` | confirmed in tarball summary |
| Root `pnpm test --run` exits 0 | 10/10 tests across 4 files |
| Root `pnpm typecheck` exits 0 | confirmed |
| Root `pnpm lint` exits 0 (warnings allowed) | confirmed (only "react detect" warning remains, expected per Plan 01 SUMMARY) |
| Root `pnpm build` exits 0 | confirmed |

### Dry-Run Publish Tarball

Captured from `pnpm publish --dry-run --no-git-checks --tag alpha`:

```
📦  @agenticapps/dashboard-agent@0.0.1-alpha.0
Tarball Contents
  2.1kB   dist/chunk-34EGTU2I.js
  195B    dist/chunk-34EGTU2I.js.map
  13B     dist/cli.d.ts
  248.4kB dist/cli.js
  432.7kB dist/cli.js.map
  74B     dist/index.d.ts
  260B    dist/index.js
  71B     dist/index.js.map
  875B    package.json
Tarball Details
  filename:     agenticapps-dashboard-agent-0.0.1-alpha.0.tgz
  package size: 125.9 kB
  unpacked:     684.7 kB
  shasum:       53e764c531ab45cbedba747783a94dfdc77c568d
  total files:  9
Publishing to https://registry.npmjs.org/ with tag alpha and default access (dry-run)
```

Notably absent from the tarball: `src/`, `tsup.config.ts`, `tsconfig.json`, `vitest.config.ts`, `.npmignore`, `*.test.ts`, `*.tsbuildinfo` — exactly as `.npmignore` + `files: ["dist"]` intend. The `cli.js.map` sourcemap (433 KB) is the largest single file; it's intentional per T-00-05 disposition (accept — source paths in maps, no secrets).

**Actual publish is gated by Plan 04 + a user-created `v0.0.1-alpha.0` tag.** This plan only proves the tarball shape and the dry-run path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking compatibility] tsup pinned to ^8.5.1 (plan specified ^9.0.0)**
- **Found during:** Task 1, first `pnpm install`.
- **Issue:** `ERR_PNPM_NO_MATCHING_VERSION  No matching version found for tsup@^9.0.0`. Latest published as of 2026-05-02 is `8.5.1`. Plan's ^9 was speculative.
- **Fix:** Changed `packages/agent/package.json` devDep from `"tsup": "^9.0.0"` to `"tsup": "^8.5.1"`. tsup 8.x supports every feature this plan needs (ESM, dts, noExternal, banner, target node20).
- **Files modified:** `packages/agent/package.json`.
- **Committed in:** `a01b4d6` (Task 1 GREEN — fix landed before any commit, working tree shipped with the working version).

**2. [Rule 3 — Blocking compatibility] Added `@types/node` ^20.19.39 to agent devDependencies**
- **Found during:** Task 1, first `pnpm --filter ... build`. tsup's dts step emitted: `Cannot find name 'process'. Do you need to install type definitions for node?` (six errors on cli.ts lines 6, 14, 15, 30, 31, 32 covering `process` + `console` references).
- **Issue:** The CLI uses Node globals (`process.argv`, `process.exit`, `console.log`). Plan 01's tsconfig.base.json sets `lib: ["ES2022"]` but no Node types. Plan 02's plan didn't list @types/node — implicit assumption.
- **Fix:** Added `"@types/node": "^20.19.39"` to `packages/agent/devDependencies` (pinned to Node 20 LTS line matching `.nvmrc`); added `"types": ["node"]` to `packages/agent/tsconfig.json` `compilerOptions`.
- **Verification:** `pnpm --filter ... build` succeeds (DTS step green); `pnpm typecheck` passes from root.
- **Files modified:** `packages/agent/package.json`, `packages/agent/tsconfig.json`.
- **Committed in:** `a01b4d6` (Task 1).

**3. [Rule 3 — Blocking deprecation] Added `ignoreDeprecations: "6.0"` to agent tsconfig**
- **Found during:** Task 1, first build's dts step emitted `error TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`.
- **Issue:** TypeScript 6.0.3 (catalog-pinned in Plan 01) treats `baseUrl` (which tsup's internal tsc invocation sets implicitly) as a hard error unless `ignoreDeprecations` is set. The base tsconfig.base.json doesn't set baseUrl, but tsup's dts pipeline injects one.
- **Fix:** Added `"ignoreDeprecations": "6.0"` to `packages/agent/tsconfig.json` `compilerOptions`. Scoped to the agent only; SPA + shared don't go through tsup. Revisit when tsup drops the implicit baseUrl or when we move to TypeScript 7.
- **Files modified:** `packages/agent/tsconfig.json`.
- **Committed in:** `a01b4d6` (Task 1).

**4. [Rule 3 — Blocking config] Added `createRequire` banner to tsup config**
- **Found during:** Task 1, first runtime smoke (`node dist/cli.js --version`) — runtime crash: `Error: Dynamic require of "events" is not supported` from inside the bundled commander.
- **Issue:** commander 14 is published as CJS internally and does `require('events')` at the top of `lib/command.js`. When tsup/esbuild bundles CJS-into-ESM with `format:'esm'` and `noExternal:['commander']`, esbuild emits a `__require2` shim that throws on dynamic-required modules — including Node builtins. Plan's tsup.config.ts had only `banner: { js: '#!/usr/bin/env node' }` which doesn't address this.
- **Fix:** Replaced the banner with a multi-line banner that prepends `import { createRequire } from "node:module"; const require = createRequire(import.meta.url);` to the bundle. esbuild now resolves commander's `require('events')` against Node's real builtin module. Also added `platform: 'node'` to tsup config for explicitness (default already, but documents intent).
- **Verification:** `node dist/cli.js --version` exits 0; `start` and `--version --json` likewise.
- **Files modified:** `packages/agent/tsup.config.ts`.
- **Committed in:** `a01b4d6` (Task 1).

**5. [Rule 3 — Blocking npm constraint] Dry-run publish requires `--tag alpha` for prerelease**
- **Found during:** Task 2, first `pnpm publish --dry-run --no-git-checks` — npm errored: `You must specify a tag using --tag when publishing a prerelease version.`
- **Issue:** `0.0.1-alpha.0` has a SemVer prerelease suffix (`-alpha.0`). npm 10+ refuses to publish prerelease versions to the default `latest` tag without an explicit `--tag` override (so they don't shadow stable versions for `npm install` consumers). Plan's verify command (`pnpm publish --dry-run --no-git-checks`) was missing `--tag alpha`.
- **Fix:** Added a `publish:dry` npm script in `packages/agent/package.json`: `pnpm publish --dry-run --no-git-checks --tag alpha`. This bakes the alpha-channel choice into the package; Plan 04's release.yml will reuse the same flag (or invoke `pnpm publish:dry`).
- **Verification:** `pnpm --filter @agenticapps/dashboard-agent publish:dry` exits 0; tarball summary captured above.
- **Files modified:** `packages/agent/package.json` (scripts).
- **Committed in:** `6769bf2` (Task 2 GREEN).
- **Forward note:** Plan 04 must include `--tag alpha` in its release.yml publish step. The `publish:dry` script makes this explicit and reusable.

**6. [Rule 1 — Lint clean-up] Collapsed import-group blank line in cli.test.ts**
- **Found during:** Task 2 GREEN, root `pnpm lint` reported `import/order: There should be no empty line within import group` at `packages/agent/src/cli.test.ts:6`.
- **Issue:** The plan's literal test file had blank lines separating `node:*` imports from `vitest` from `@agenticapps/dashboard-shared`. eslint-plugin-import classifies all three as the same import group when path groups aren't customized; `newlines-between: 'always'` only applies between *different* groups.
- **Fix:** Reordered + collapsed: `node:*` imports stay together (one group), then a single blank line, then `@agenticapps/dashboard-shared` + `vitest` together (alphabetized).
- **Files modified:** `packages/agent/src/cli.test.ts`.
- **Verification:** `pnpm lint` clean (only the benign "react detect" warning remains).
- **Committed in:** `6769bf2` (Task 2 GREEN).

**7. [Rule 1 — Acceptance grep gate] Removed literal `execSync` token from cli.test.ts comment**
- **Found during:** Task 2 acceptance verification — the grep gate `! grep -q "execSync" packages/agent/src/cli.test.ts` returned 1 match because the file's comment said "spawnSync (not execSync) — argv array, ...". The gate is a literal string match.
- **Issue:** Even though `execSync` was only mentioned in a *negation comment* explaining the security choice, the acceptance criterion is a strict literal grep. Comments count as text.
- **Fix:** Reworded the comment from "spawnSync (not execSync) — argv array, no shell interpretation, no injection surface." to "Uses spawnSync with an argv array — no shell interpretation, no injection surface (T-00-07)." Same intent, no banned token.
- **Files modified:** `packages/agent/src/cli.test.ts`.
- **Verification:** `grep -q spawnSync && ! grep -q execSync` now exits 0.
- **Committed in:** `530be5d` (Task 2 follow-up).

---

**Total deviations:** 7 auto-fixed (5 Rule 3 blocking, 2 Rule 1 cleanup).
**Impact on plan:** All deviations were strictly within the affected tasks' scope. No architectural changes. Five of the seven (tsup pin, @types/node, ignoreDeprecations, createRequire banner, --tag alpha) are inherent gaps between the plan's text and what npm + TypeScript + esbuild actually require in 2026; they're documented for Plan 04 to honor and for any future Phase that rebuilds the agent.

**Forward dependencies for Plan 04 (release.yml):**
- Use `--tag alpha` (or invoke `pnpm --filter @agenticapps/dashboard-agent publish:dry` / `publish`) when calling `pnpm publish` from CI.
- The `prepublishOnly: pnpm build` script means CI's publish step does NOT need a separate build step; pnpm publish runs prepublishOnly automatically. (Plan 04's gates should still run an explicit build for visibility.)
- `@types/node` is now in agent's devDependencies, so any future agent CLI work has Node types available without a catalog touch.

## Issues Encountered

- **tsup ^9 not on registry**: caught at install time, fixed with ^8.5.1. (Deviation #1.)
- **Bundled commander triggered esbuild dynamic-require shim crash**: caught at first runtime smoke, fixed with `createRequire` banner. (Deviation #4.) This is the most subtle of the deviations — it would have shipped to npm as a broken bundle if Task 1's verify block didn't run `node dist/cli.js --version` post-build.
- **Dry-run publish needed `--tag alpha`**: caught at first dry-run, fixed by adding `publish:dry` script. (Deviation #5.) Forward-relevant for Plan 04.

## Self-Check: PASSED

All 5 created files exist on disk:
- `packages/agent/tsup.config.ts` — FOUND
- `packages/agent/src/cli.ts` — FOUND
- `packages/agent/src/cli.test.ts` — FOUND
- `packages/agent/src/version.ts` — FOUND
- `packages/agent/.npmignore` — FOUND

All 4 commit hashes exist in `git log`:
- `a01b4d6` feat(00-02): wire commander CLI + tsup bundle for placeholder agent — FOUND
- `f8fc5c4` test(00-02): add CLI subprocess + bundle-integrity tests — FOUND
- `6769bf2` feat(00-02): wire CLI subprocess + bundle-integrity tests against built dist — FOUND
- `530be5d` fix(00-02): remove literal execSync token from comment for grep gate — FOUND

All five root gates green from a frozen-lockfile install: `pnpm install --frozen-lockfile` + `pnpm lint` + `pnpm typecheck` + `pnpm test --run` (10/10 tests across 4 files) + `pnpm build` all exit 0.

`pnpm --filter @agenticapps/dashboard-agent publish:dry` exits 0; tarball lists exactly `dist/*` + `package.json`.

## Next Plan Readiness

- **Plan 04 (release.yml + agent publish metadata):**
  - `publish:dry` script available; release.yml can call `pnpm --filter @agenticapps/dashboard-agent publish --tag alpha --provenance --access public` (NOT `--dry-run`).
  - `prepublishOnly: pnpm build` ensures CI doesn't ship stale dist.
  - Tarball already validated: 9 files, ~125 KB packed. publint + attw can be wired against this exact shape.
  - `bin: agentic-dashboard` mapped to `./dist/cli.js`; npm registers it on install.

**Concerns / blockers:**
- None for Plan 04 itself. The `--tag alpha` requirement is now explicit and reusable.
- Watch for tsup ^9 stable: when it lands, the catalog can move forward. Currently pinned to ^8.5.1 (sufficient for all Phase 0 needs).

---
*Phase: 00-bootstrap*
*Plan: 02*
*Completed: 2026-05-02*
