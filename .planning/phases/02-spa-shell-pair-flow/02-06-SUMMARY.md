---
phase: 02-spa-shell-pair-flow
plan: 06
subsystem: spa-integration
tags: [repair-provider, query-client, repair-banner, appshell, e2e, subprocess, tdd, wave-3]
dependency_graph:
  requires:
    - "02-02 (AppShell banner-mount slot, router.tsx 5-route tree)"
    - "02-03 (RepairProvider, useRepair, createQueryClient, RepairBanner)"
    - "02-04 (OnboardingHero, /onboarding route, /pair route with PairFlow)"
    - "02-05 (IndexPage placeholder, ManualPairForm, ThemeToggle)"
  provides:
    - "main.tsx full provider chain: StrictMode → RepairProvider → QueryBridge → RouterProvider"
    - "AppShell.tsx: RepairBanner wired into data-slot=banner-mount (AUTH-04 SPA-side complete)"
    - "AppShell.test.tsx: 4 unit tests covering brand label, skip-link, banner slot, banner trigger"
    - "dev-perf-smoke.test.ts: real subprocess SPA-01 test (Wave-0 RED stub now GREEN)"
    - "e2e-pair-flow.test.tsx: 4 e2e scenarios (SPA-02 + SPA-03 + AUTH-04 W4)"
    - "vitest.config.ts: subprocess test excluded from jsdom suite"
    - "vitest.subprocess.config.ts: isolated node/forks config (T-02-28)"
    - "README.md: Phase 2 shipped status"
  affects:
    - packages/spa/src/main.tsx
    - packages/spa/src/components/AppShell.tsx
    - packages/spa/src/components/AppShell.test.tsx
    - packages/spa/src/__tests__/dev-perf-smoke.test.ts
    - packages/spa/src/__tests__/e2e-pair-flow.test.tsx
    - packages/spa/vitest.config.ts
    - packages/spa/vitest.subprocess.config.ts
    - packages/spa/package.json
    - README.md
tech_stack:
  added: []
  patterns:
    - "Pattern 6: QueryBridge inner component reads useRepair() and binds createQueryClient(repair) via useMemo once at mount"
    - "TDD: AppShell.test.tsx mocks @tanstack/react-router (Link, Outlet, useNavigate) for unit isolation"
    - "Subprocess test isolation: vitest.subprocess.config.ts with pool=forks, environment=node"
    - "E2e: createMemoryHistory drives full route tree in-process; vi.mock('../lib/api.js') prevents real fetch"
key_files:
  created:
    - packages/spa/src/components/AppShell.test.tsx
    - packages/spa/src/__tests__/e2e-pair-flow.test.tsx
    - packages/spa/vitest.subprocess.config.ts
  modified:
    - packages/spa/src/main.tsx (RepairProvider + QueryBridge wiring; new QueryClient() replaced)
    - packages/spa/src/components/AppShell.tsx (RepairBanner mounted in banner-mount slot)
    - packages/spa/src/__tests__/dev-perf-smoke.test.ts (Wave-0 stub replaced with real subprocess test)
    - packages/spa/vitest.config.ts (dev-perf-smoke excluded from jsdom suite)
    - packages/spa/package.json (test:subprocess script added)
    - README.md (Phase 2 status section added)
decisions:
  - "Separate vitest.subprocess.config.ts (fallback approach) instead of inline projects: in vitest.config.ts — vitest 4.x projects with extends:true inherits root include and runs ALL tests under both environments, breaking jsdom-dependent tests"
  - "AppShell.test.tsx mocks Outlet+Link+useNavigate from @tanstack/react-router — rendering AppShell inside RouterProvider requires async loading; direct render with mock avoids async setup while keeping full behavior coverage"
  - "W4 scenario uses setNeedsRepair(true) directly via captured RepairBus — IndexPage has no queries so QueryCache.onError never fires naturally; direct state mutation is the valid test path for the banner end-to-end"
  - "AnyRouter type used for QueryBridgeForTest prop — specific router type from createRouter({routeTree: router.routeTree}) is too narrow for the component prop with exactOptionalPropertyTypes:true"
  - "Plan 04 commits (7a422de, 40fc598) cherry-picked into worktree — they existed as loose objects but were not in the phase-02 branch ancestry (different executor worktree, not merged)"
metrics:
  duration: "75 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 3
  files_created: 3
  files_modified: 6
  commits: 6
---

# Phase 02 Plan 06: Wave 3 Final Integration Summary

**One-liner:** RepairProvider + QueryBridge bus end-to-end so any 401 from TanStack Query flips RepairBanner without unmounting the page; Wave-0 dev-perf-smoke stub turned GREEN with real subprocess HMR test; 4-scenario e2e test suite covers unpaired-redirect, pair happy-path, paired direct-render, and 401-banner-repair (AUTH-04 SPA-side complete).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Wire RepairProvider + createQueryClient bus; mount RepairBanner in AppShell | 9bbd90a | main.tsx, AppShell.tsx, AppShell.test.tsx |
| 2 | SPA-01 dev-perf-smoke subprocess test (Wave-0 stub GREEN) | bb0de40 | dev-perf-smoke.test.ts, vitest.config.ts, vitest.subprocess.config.ts, package.json |
| 3a | e2e pair-flow component test (SPA-02 + SPA-03 + AUTH-04) | c915e88 | e2e-pair-flow.test.tsx |
| 3b | README Phase 2 status update | 41082d1 | README.md |

## Provider Chain Architecture

The full provider chain in `main.tsx` (outermost → innermost):

```tsx
<StrictMode>
  <RepairProvider>            // creates RepairContext with stable useCallback setNeedsRepair
    <QueryBridge>             // inner component: useRepair() + useMemo(createQueryClient)
      <QueryClientProvider>   // binds the live repair bus to QueryCache.onError
        <RouterProvider>      // full 5-route tree
```

**Why `useMemo` is required:**  
`createQueryClient(repair)` must run exactly ONCE per mount. Without memoization:
1. Any parent re-render recreates the QueryClient, wiping the cache mid-session.
2. In StrictMode (double-mount), the first QueryClient is discarded after the second mount — memoization ensures both mounts bind the same live closure.
3. `repair.setNeedsRepair` is stable (wrapped in `useCallback([])` in RepairProvider) so the memo deps array `[repair.setNeedsRepair]` only fires once.

**Why `QueryBridge` is a separate inner component:**  
`useRepair()` requires being inside `<RepairProvider>`. The bridge lives inside it so it can call `useRepair()` and pass the live bus to `createQueryClient`.

## Wave-0 Stub Status

| File | Status | Plan |
|------|--------|------|
| `shared/src/schemas/pairing.test.ts` | GREEN | Plan 01 |
| `spa/src/lib/pairing.test.ts` | GREEN | Plan 02 |
| `spa/src/lib/theme.test.ts` | GREEN | Plan 02 |
| `spa/src/lib/api.test.ts` | GREEN | Plan 03 |
| `spa/src/__tests__/dev-perf-smoke.test.ts` | GREEN | Plan 06 Task 2 |

All 5 Wave-0 stubs are now GREEN.

## Phase 2 Test Coverage

| Suite | Test Files | Tests | Notes |
|-------|-----------|-------|-------|
| shared | 5 | 42 | Schema + Zod validation |
| spa (unit) | 15 | 102 | Components, libs, routes |
| spa (subprocess) | 1 | 1 | dev-perf-smoke (node env, forks) |
| spa (e2e) | 1 | 4 | pair-flow + 401 banner end-to-end |
| agent | 28 | 161 | Phase 1 daemon — unchanged |
| **Total** | **50** | **310** | |

## VALIDATION.md Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-----------|-------------------|--------|
| Foundation | 01 | 0 | BOOT-01..03 | — | unit | `pnpm -r test` | ✅ |
| Schemas + tokens | 01 | 0 | INV-01..03 | T-02-01..06 | unit | `pnpm --filter shared test` | ✅ |
| Pairing + theme libs | 02 | 0 | SPA-01..04 | T-02-07..10 | unit | `pnpm --filter spa test` | ✅ |
| SPA shell + chrome | 02 | 1 | D-01..D-05 | T-02-11..14 | unit | `pnpm --filter spa test` | ✅ |
| API + repair | 03 | 1 | INV-04, AUTH-04 | T-02-15..24 | unit | `pnpm --filter spa test` | ✅ |
| Onboarding + pair routes | 04 | 2 | SPA-02..03 | T-02-17..20 | unit | `pnpm --filter spa test` | ✅ |
| Settings + index + help | 05 | 2 | SPA-04 | T-02-21..24 | unit | `pnpm --filter spa test` | ✅ |
| RepairProvider bus | 06 T1 | 3 | AUTH-04 | T-02-25 | unit | `pnpm --filter spa test` | ✅ |
| dev-perf-smoke | 06 T2 | 3 | SPA-01 | T-02-26 | subprocess | `pnpm --filter spa test:subprocess` | ✅ |
| e2e pair-flow | 06 T3 | 3 | SPA-02+SPA-03+AUTH-04 | T-02-27..28 | e2e | `pnpm --filter spa test` | ✅ |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 04 commits missing from worktree branch ancestry**
- **Found during:** Task 1 setup — OnboardingHero.tsx, CodeBlock.tsx, pair.lazy.tsx updates were in separate git objects (7a422de, 40fc598) but not reachable from the phase-02 branch HEAD
- **Fix:** Cherry-picked both commits; resolved trivial ordering conflict in shared/src/index.ts
- **Files modified:** packages/shared/src/index.ts, packages/spa/src/components/OnboardingHero.tsx, packages/spa/src/components/CodeBlock.tsx, packages/spa/src/routes/onboarding.lazy.tsx, packages/spa/src/routes/pair.lazy.tsx, packages/spa/src/routes/pair-error.tsx, packages/spa/src/routes/pair.test.tsx
- **Commits:** 3ed218c, b8122ad (cherry-picks)

**2. [Rule 1 - Bug] JSX.Element namespace not found in @types/react 19.x**
- **Found during:** Task 1 typecheck
- **Issue:** AppShell.tsx exported `JSX.Element` return type; main.tsx's QueryBridge used same. With react-jsx transform + @types/react 19, global JSX namespace is not available.
- **Fix:** Changed to `React.JSX.Element` in both files
- **Files modified:** AppShell.tsx, main.tsx

**3. [Rule 3 - Blocking] vitest 4.x `projects` with `extends:true` inherits root `include` — runs all tests in subprocess environment**
- **Found during:** Task 2 step 1 — the `projects` config from the plan caused ALL test files (including .tsx unit tests) to run under both `unit` and `subprocess` projects, causing jsdom component tests to run in node env and fail with "window is not defined"
- **Fix:** Fell back to separate `vitest.subprocess.config.ts` file + `test:subprocess` script (fallback explicitly documented in the plan)
- **Files modified:** vitest.config.ts, vitest.subprocess.config.ts (new), package.json

**4. [Rule 1 - Bug] `poolOptions` deprecated in vitest 4 — top-level `forks` config required**
- **Found during:** Task 2, subprocess test run warning
- **Fix:** Replaced `poolOptions: { forks: { singleFork: true } }` with top-level `forks: { singleFork: true }` in vitest.subprocess.config.ts

**5. [Rule 1 - Bug] `getByRole('status', { name: /Agent token rejected/i })` — accessible name not computed from text content for live region roles in RTL**
- **Found during:** Task 3 W4 scenario — RepairBanner renders `role="status"` but accessible name query didn't match
- **Fix:** Split assertion into `getByRole('status')` + `getByText('Agent token rejected.')`
- **Files modified:** e2e-pair-flow.test.tsx

**6. [Rule 1 - Bug] `ReturnType<typeof createRouter>` is too narrow for component prop with exactOptionalPropertyTypes:true**
- **Found during:** Task 3 typecheck — `QueryBridgeForTest` component prop typed as `ReturnType<typeof createRouter>` conflicted with the specific router type from `createRouter({ routeTree: router.routeTree })`
- **Fix:** Changed prop type to `AnyRouter` from @tanstack/react-router
- **Files modified:** e2e-pair-flow.test.tsx

## Known Stubs

None. All Phase 2 components are fully implemented. IndexPage shows "Multi-project home arrives in Phase 3" which is intentional placeholder text for Phase 3, not a stub.

## Threat Flags

None. No new network endpoints or auth paths introduced beyond those in the plan's threat model (T-02-25 through T-02-28, all mitigated).

## Self-Check: PASSED

**Files created confirmed present:**
- `packages/spa/src/components/AppShell.test.tsx` ✓
- `packages/spa/src/__tests__/e2e-pair-flow.test.tsx` ✓
- `packages/spa/vitest.subprocess.config.ts` ✓

**Files modified confirmed updated:**
- `packages/spa/src/main.tsx` ✓ (contains RepairProvider, createQueryClient, useMemo, wrapped in useCallback)
- `packages/spa/src/components/AppShell.tsx` ✓ (contains RepairBanner, import RepairBanner)
- `packages/spa/src/__tests__/dev-perf-smoke.test.ts` ✓ (contains spawn('pnpm', Local:, hmr update, finally)
- `packages/spa/vitest.config.ts` ✓ (excludes dev-perf-smoke)
- `README.md` ✓ (contains Phase 2)

**Commits confirmed:**
- 9bbd90a (Task 1) ✓
- bb0de40 (Task 2) ✓
- c915e88 (Task 3a) ✓
- 41082d1 (Task 3b) ✓

**Tests:** 106 passing in SPA (unit+e2e), 1 passing subprocess, 309 total workspace. Typecheck: clean. Build: 10 chunks including 5 lazy route chunks + _redirects + _headers. All Wave-0 stubs GREEN.
