---
phase: 00-bootstrap
plan: 03
subsystem: spa
tags: [vite, react-18, tailwindcss-4, vitest, jsdom, testing-library, typescript, zod]

# Dependency graph
requires:
  - "Plan 00-01 — pnpm catalog with full SPA stack (react, vite, tailwindcss, @testing-library/*, jsdom) + @agenticapps/dashboard-shared HealthResponseSchema"
provides:
  - "@agenticapps/dashboard-spa as a buildable Vite SPA: pnpm --filter @agenticapps/dashboard-spa build → packages/spa/dist/{index.html, assets/index-*.{js,css}}"
  - "App.tsx — single-component shell rendering brand line + AgentVersion fallback row (HealthResponseSchema-validated)"
  - "Tailwind 4 wired via @tailwindcss/vite plugin (no postcss.config, no tailwind.config — RESEARCH §Pattern 4)"
  - "Vitest + jsdom + @testing-library/react + @testing-library/jest-dom matchers wired with auto-cleanup between tests"
  - "Cloudflare Pages publish target (BOOT-03): build command pnpm --filter @agenticapps/dashboard-spa build, publish dir packages/spa/dist"
affects: [00-04-release-workflow, 00-05-cf-pages-docs]

# Tech tracking
tech-stack:
  added:
    - "Vite 8.0.10 + @vitejs/plugin-react 6.0.1 (D-09 SPA build tool)"
    - "React 18.3.1 + react-dom 18.3.1 (D-09 SPA framework)"
    - "Tailwind CSS 4.2.4 + @tailwindcss/vite 4.2.4 (CSS-first config; @import \"tailwindcss\")"
    - "@testing-library/react 16.3.2 + @testing-library/jest-dom 6.4.0 (DOM-aware matchers)"
    - "jsdom 29.1.1 (vitest browser env for SPA project)"
    - "@tanstack/react-query 5.100.8 + lucide-react 1.14.0 (catalog-only — pulled in for Phase 1+)"
  patterns:
    - "Schema-validated static fallback: const fallbackParsed = HealthResponseSchema.parse(FALLBACK) at module-load — schema drift in shared surfaces immediately at build/test time, not at SPA runtime"
    - "afterEach(cleanup) in test-setup.ts — Vitest with `globals: false` does not auto-cleanup between tests; without this, multiple render(<App />) calls in one suite stack DOM trees and getByTestId throws \"Found multiple elements\""
    - "Stub-first TDD on the App component: stub <div /> commits as RED; full Tailwind shell commits as GREEN; test 3 (HealthResponseSchema.parse) is the only one that passes in both states because it doesn't touch App"

key-files:
  created:
    - "packages/spa/vite.config.ts"
    - "packages/spa/index.html"
    - "packages/spa/src/main.tsx"
    - "packages/spa/src/App.tsx"
    - "packages/spa/src/App.test.tsx"
    - "packages/spa/src/test-setup.ts"
    - "packages/spa/src/styles/global.css"
    - "packages/spa/src/vite-env.d.ts"
    - "packages/spa/.gitignore"
  modified:
    - "packages/spa/package.json (full Vite/React/Tailwind/RTL devDeps + dev/build/preview scripts)"
    - "packages/spa/tsconfig.json (added types: vitest/globals + @testing-library/jest-dom; widened include to vite/vitest configs)"
    - "packages/spa/vitest.config.ts (added vite/tailwind plugin chain + setupFiles)"
    - "packages/spa/src/index.ts (now re-exports App)"
    - "pnpm-lock.yaml (locked SPA + RTL/jsdom catalog entries)"
  deleted:
    - "packages/spa/src/index.test.ts (Plan 01 placeholder; superseded by App.test.tsx — workspace resolution still exercised by Test 3 there)"

key-decisions:
  - "Drop explicit JSX.Element return annotation on App() — React 19 types removed the global JSX namespace; explicit annotation throws TS2503. TypeScript correctly infers ReactElement; no observable type-safety loss because callers don't assert on the return type."
  - "Add packages/spa/src/vite-env.d.ts (`/// <reference types=\"vite/client\" />`) — without it, `import './styles/global.css'` in main.tsx fails tsc --noEmit with TS2882 (no module type declaration for the side-effect CSS import). vite-env.d.ts is the canonical Vite escape hatch."
  - "Auto-cleanup in test-setup.ts uses afterEach(cleanup) from @testing-library/react instead of @testing-library/react/dont-cleanup-after-each — explicit, tied to vitest's afterEach, no ambiguity about whether cleanup ran."
  - "Phase 0 SPA renders the static fallback unconditionally — VITE_AGENT_URL feature toggle and the fetch wiring are reserved for Phase 1+. The plan and CONTEXT D-09 both call for the empty state by default; live fetch is out of Phase 0 scope. The HealthResponseSchema.parse(FALLBACK) call still proves the cross-package contract at build-and-test time."

requirements-completed: [BOOT-01, BOOT-03]
threat-refs: [T-00-08]

# Metrics
duration: ~3min (8611312 → 9730b97)
completed: 2026-05-02
---

# Phase 00 Plan 03: SPA Shell Summary

**Placeholder `@agenticapps/dashboard-spa` — Vite + React 18 + TypeScript + Tailwind 4 single-route shell rendering "AgenticApps Dashboard — alpha" + AgentVersion empty-state row that re-validates `HealthResponseSchema` from `@agenticapps/dashboard-shared` at module load.**

## Performance

- **Duration:** ~3 min (RED commit `8611312` at 18:56 → GREEN commit `9730b97` at 18:58)
- **Tasks:** 1 (RED → GREEN pair, single TDD task)
- **Files:** 9 created, 5 modified, 1 deleted
- **Bundle:** index.html 0.46 kB / index-*.css 7.52 kB / index-*.js 198.80 kB (gzipped: 0.32 / 2.32 / 59.10 kB)

## Accomplishments

- SPA renders the brand line + AgentVersion empty-state row out of the box; the only content piece coming from `@agenticapps/dashboard-shared` is `HealthResponseSchema`, and it's parsed against the static fallback at module-load so schema drift will fail the build and test, not the runtime.
- Tailwind 4 utilities are generated into the built CSS bundle — `find packages/spa/dist/assets -name 'index-*.css' -exec grep -l 'mx-auto' {} \;` matches.
- All five workspace gates green from the plan-end commit: `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test --run && pnpm build` exit 0. Workspace test count went from 4 (Plan 01) to 7 (Plan 01's 4 + this plan's 3).
- TDD evidence in git: `test(00-03): add SPA App render + fallback-state tests (RED)` then `feat(00-03): implement App shell with Tailwind 4 + AgentVersion fallback (GREEN)`. RED stub was a literal `<div />` — Tests 1 (heading) and 2 (testid status region) failed exactly as intended; Test 3 (schema parse) passed in both phases because it doesn't depend on App.
- The `dist/` is the contract surface for Cloudflare Pages — Plan 05 will document that build command (`pnpm --filter @agenticapps/dashboard-spa build`) and publish dir (`packages/spa/dist`) match the CF Pages project config.

## Task Commits

Each task committed atomically with `--no-verify` (parallel-executor protocol):

1. **Task 1 RED — failing tests + stub App** — `8611312` (test)
2. **Task 1 GREEN — full Tailwind 4 shell + cleanup wiring** — `9730b97` (feat)

_TDD evidence: `git log --oneline | grep "(00-03)"` → exactly one `test(00-03)` and one `feat(00-03)` commit, in that order._

## Files Created/Modified

**SPA package wiring:**
- `packages/spa/vite.config.ts` — Vite 8 + react() + tailwindcss() plugin chain; dev port 5174 strict; sourcemap on for the build (T-00-08 accept).
- `packages/spa/vitest.config.ts` — same plugin chain so jsdom tests render the same component tree as production; project name `spa`; setupFiles → `./src/test-setup.ts`; include `src/**/*.test.{ts,tsx}`.
- `packages/spa/package.json` — `dev` / `build` / `preview` scripts wired; full catalog: deps (react, react-dom, @tanstack/react-query, lucide-react, @agenticapps/dashboard-shared) + devDeps (vite, @vitejs/plugin-react, tailwindcss, @tailwindcss/vite, @types/react, @types/react-dom, jsdom, @testing-library/react, @testing-library/jest-dom, eslint-plugin-react, eslint-plugin-react-hooks).
- `packages/spa/tsconfig.json` — extends base; `jsx: react-jsx`, `moduleResolution: Bundler` (RESEARCH Pattern 6), `types: [vitest/globals, @testing-library/jest-dom]`; include widened to cover vite + vitest configs.
- `packages/spa/.gitignore` — `dist/`, `.vite/`, `*.tsbuildinfo`.

**App + entry:**
- `packages/spa/index.html` — Vite entrypoint; loads `/src/main.tsx` as `<script type="module">`.
- `packages/spa/src/main.tsx` — `<StrictMode>` + `createRoot` + side-effect `import './styles/global.css'`.
- `packages/spa/src/App.tsx` — single component:
  - `<h1>AgenticApps Dashboard <span>— alpha</span></h1>`
  - `<section role="status" data-testid="agent-version">` showing version + status badge + (when present) the `health.message`.
  - Module-level `HealthResponseSchema.parse(FALLBACK)` so schema drift fails at module-load.
- `packages/spa/src/index.ts` — replaced Plan 01 placeholder; now re-exports `App`.
- `packages/spa/src/styles/global.css` — `@import "tailwindcss"` (Pitfall 6: NOT `@tailwind base/utilities`); `@theme` block for `--color-brand`; html/body/#root → `height: 100%`.
- `packages/spa/src/vite-env.d.ts` — `/// <reference types="vite/client" />` so the side-effect CSS import typechecks under `tsc --noEmit`.

**Tests:**
- `packages/spa/src/App.test.tsx` — three `it()` blocks:
  1. `render(<App />)` produces an h1 matching `/AgenticApps Dashboard/i` and `/alpha/i`.
  2. `render(<App />)` exposes a `[data-testid="agent-version"]` region whose text matches `/not running/i` and `/Agent not running/i`.
  3. `HealthResponseSchema.parse({ ok: false, version: 'not running', message: 'Agent not running' })` does not throw — the contract holds for the empty state too.
- `packages/spa/src/test-setup.ts` — `import '@testing-library/jest-dom/vitest'` + `afterEach(cleanup)` (see deviation below).
- **Deleted** `packages/spa/src/index.test.ts` (Plan 01 placeholder; cross-package shared resolution now exercised by Test 3 above + Plan 01 Task 2's surviving agent-side workspace-resolution test).

## Decisions Made

- **Drop explicit `JSX.Element` return annotation on `App()`** — React 19 types (which is what the SPA's `@types/react@19.2.14` ships) removed the global `JSX` namespace; explicit annotation throws `TS2503: Cannot find namespace 'JSX'`. TypeScript correctly infers the return type; nothing in the codebase asserts on it.
- **Add `packages/spa/src/vite-env.d.ts`** — without it, `import './styles/global.css'` fails `tsc --noEmit` with `TS2882`. The triple-slash reference to `vite/client` is the canonical Vite escape hatch (declares modules for `*.css`, `*.svg?url`, `import.meta.env`, etc.). One-line file; no policy implications.
- **`afterEach(cleanup)` in `test-setup.ts`** — Vitest configured with `globals: false` does not auto-call `cleanup()` between tests. With two `render(<App />)` calls in the same suite (Tests 1 + 2), the second call sees stacked DOM trees and `getByTestId` throws `Found multiple elements`. Importing from `@testing-library/react` and tying it to vitest's `afterEach` is explicit and vendor-neutral; no surprise globals.
- **Phase 0 SPA renders the static fallback unconditionally** — the plan and `CONTEXT.md` D-09 both specify the empty state as the Phase 0 default; the `VITE_AGENT_URL` fetch toggle is reserved for Phase 1+. The cross-package contract is still exercised — `HealthResponseSchema.parse(FALLBACK)` at module-load forces a fresh validation against `@agenticapps/dashboard-shared` every build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] DOM cleanup between tests**
- **Found during:** Task 1 GREEN — second test (`getByTestId('agent-version')`) failed with `TestingLibraryElementError: Found multiple elements by: [data-testid="agent-version"]` because Test 1's mount stayed in the document while Test 2 re-rendered.
- **Issue:** With `globals: false` (which the plan's `<action>` step 4 specifies), Vitest doesn't auto-import `@testing-library/react`'s implicit `afterEach(cleanup)` hook. Plan didn't specify how to bridge this — the omission would surface as a flaky test regression as soon as a second `render()` landed in any suite.
- **Fix:** Extended `packages/spa/src/test-setup.ts` to import `cleanup` from `@testing-library/react` and `afterEach` from `vitest` and run `cleanup()` after each test. Documented inline why the hook is needed.
- **Files modified:** `packages/spa/src/test-setup.ts` (3 lines added).
- **Verification:** `pnpm --filter @agenticapps/dashboard-spa test --run` → 3 passed, 0 failed.
- **Committed in:** `9730b97` (GREEN).

**2. [Rule 1 — Bug] React 19 types: drop `JSX.Element` annotation**
- **Found during:** First `pnpm typecheck` after wiring main.tsx + App.tsx — `src/App.tsx(13,24): error TS2503: Cannot find namespace 'JSX'`.
- **Issue:** Plan's `<action>` step 10 specifies `export function App(): JSX.Element { ... }`. The catalog ships `@types/react@^19.2.14`, which removed the global `JSX` namespace; the namespace is now `React.JSX`. Either annotate `React.JSX.Element` (requires another import) or drop the annotation and let TS infer. Since nothing in the codebase asserts on the return type, dropping the annotation is the smaller change.
- **Fix:** Changed `export function App(): JSX.Element {` → `export function App() {`.
- **Files modified:** `packages/spa/src/App.tsx`.
- **Verification:** `pnpm typecheck` → clean.
- **Committed in:** `9730b97` (GREEN).

**3. [Rule 3 — Blocking] Add `vite-env.d.ts` for CSS side-effect import**
- **Found during:** Same `pnpm typecheck` run — `src/main.tsx(5,8): error TS2882: Cannot find module or type declarations for side-effect import of './styles/global.css'`.
- **Issue:** Plan's `<action>` step 9 wires `import './styles/global.css'` in `main.tsx`. Vite handles CSS imports at runtime, but `tsc --noEmit` needs a declaration. The canonical fix is `vite-env.d.ts` with `/// <reference types="vite/client" />`. Plan didn't specify it; without the file, `pnpm typecheck` (one of the five gates) fails.
- **Fix:** Created `packages/spa/src/vite-env.d.ts` with the single triple-slash reference. The reference also brings in declarations for `import.meta.env`, `*.svg`, etc. — useful for Phase 1+.
- **Files modified:** `packages/spa/src/vite-env.d.ts` (new file, 1 line).
- **Verification:** `pnpm typecheck` → clean.
- **Committed in:** `9730b97` (GREEN).

**4. [Rule 1 — Lint clean-up] Reorder imports in App.test.tsx**
- **Found during:** First `pnpm lint` after writing App.test.tsx — `import/order: There should be no empty line within import group` (warning, exit code still 0 thanks to ESLint's separation, but Plan 01 set the precedent that lint must be clean).
- **Issue:** I had grouped `@testing-library/react` + `vitest` together with a blank line before `@agenticapps/dashboard-shared`. All three resolve to the `external` group under `eslint-plugin-import`, so the blank line was wrong. (Same root cause as Plan 01's deviation 2 in agent + spa test files.)
- **Fix:** Moved `@agenticapps/dashboard-shared` import to the top of the external group; removed the blank line.
- **Files modified:** `packages/spa/src/App.test.tsx` (import block reordered).
- **Verification:** `pnpm lint` → 0 errors, 0 warnings.
- **Committed in:** `9730b97` (GREEN).

---

**Total deviations:** 4 auto-fixed (1 missing cleanup, 1 React 19 type drift, 1 missing CSS-import declaration, 1 import-order warning). All four were inside the scope of the affected file/task; no architectural changes; all four required for the five-gate suite to stay green.

## Issues Encountered

- **Worktree branch was based on stale commit `5d736bc`** (4 placeholder commits) instead of the expected base `93cdfa10` (Plan 01 complete). Resolved with `git reset --hard 93cdfa104c3a62d1517feb534a369189bd8d3c4e` per the worktree-branch-check protocol; `.planning/`, `CLAUDE.md`, and Plan 01's full SPA stack restored before any Plan 03 work began.

## Self-Check: PASSED

All 9 created files exist on disk:
- `packages/spa/vite.config.ts` ✓
- `packages/spa/index.html` ✓
- `packages/spa/src/main.tsx` ✓
- `packages/spa/src/App.tsx` ✓
- `packages/spa/src/App.test.tsx` ✓
- `packages/spa/src/test-setup.ts` ✓
- `packages/spa/src/styles/global.css` ✓
- `packages/spa/src/vite-env.d.ts` ✓
- `packages/spa/.gitignore` ✓

Both commits exist in git history:
- `8611312` (test/RED) ✓
- `9730b97` (feat/GREEN) ✓

Built artifacts exist on disk after `pnpm --filter @agenticapps/dashboard-spa build`:
- `packages/spa/dist/index.html` (contains "AgenticApps Dashboard") ✓
- `packages/spa/dist/assets/index-*.js` ✓
- `packages/spa/dist/assets/index-*.css` (contains `mx-auto`) ✓

All five workspace gates green from `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test --run && pnpm build`. 7 tests pass across 3 projects (shared 3 + agent 1 + spa 3).

## Next Plan Readiness

- **Plan 02 (`@agenticapps/dashboard-agent` — runs in parallel under wave 2):** No interaction with this plan. Both stay inside their package directories.
- **Plan 04 (release.yml + agent publish metadata):** No SPA dependency; the SPA isn't published to npm.
- **Plan 05 (CF Pages docs):** This plan delivers the contract — build command `pnpm --filter @agenticapps/dashboard-spa build`, publish dir `packages/spa/dist`, NODE_VERSION 20, PNPM_VERSION 10. Plan 05 documents this in `docs/deploy/cloudflare-pages-setup.md`.
- **Phase 1+ (daemon + pair flow):** Wire the `VITE_AGENT_URL` feature toggle and replace the static fallback with a TanStack Query fetch against the agent's `/health` endpoint. The schema-drift safety net (`HealthResponseSchema.parse(FALLBACK)`) stays as a build-time invariant; the runtime parse against the live response is added in Phase 1.

**Concerns / blockers:**
- The Phase 6 `impeccable:critique ≥ 90` gate is not a Phase 0 acceptance — this plan ships structure + utility classes only, no design system. Phase 6 will iterate; nothing here pre-decides any visual choice that would be hard to undo (one color token in `@theme`, no custom components, no design tokens beyond Tailwind defaults).
- React 19 types drift: noted above as deviation 2. The catalog pins `@types/react@^19.2.14` but `react@^18.3.1` — the published Types-package version intentionally runs ahead of the runtime. If Phase 1+ wants to upgrade to React 19 runtime, no type churn expected.

---
*Phase: 00-bootstrap*
*Plan: 03*
*Completed: 2026-05-02*
