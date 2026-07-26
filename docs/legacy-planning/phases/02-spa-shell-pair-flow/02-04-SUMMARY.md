---
phase: 02-spa-shell-pair-flow
plan: 04
subsystem: spa-pair-flow
tags: [tanstack-router, validateSearch, pair-flow, onboarding, codeblock, tdd, wave-2a]
dependency_graph:
  requires:
    - "02-02 (getPairing/setPairing/clearPairing, router.tsx 5-route tree, route stubs)"
    - "02-03 (apiFetch + ApiError + DriftIssue, SchemaDriftState, DaemonUnreachableState)"
  provides:
    - "CodeBlock component with copy affordance (Plan 02-06 smoke-test references)"
    - "OnboardingHero component — D-01 verbatim copy, 3 numbered steps, disclosure"
    - "/onboarding route — sets page title, renders OnboardingHero"
    - "/pair route — PairFlow state machine (pairing→success/drift/unreachable/failed)"
    - "pair-error.tsx — MalformedPairUrl eager-importable by router.tsx (W1 fix)"
    - "router.tsx pairRoute upgrade — validateSearch(PairSearchSchema) + Pitfall-8 errorComponent"
  affects:
    - packages/spa/src/components (2 new components + 2 test files)
    - packages/spa/src/routes (3 new/replaced files + 1 test file)
    - packages/spa/src/router.tsx (pairRoute validateSearch + errorComponent)
    - packages/shared/src/index.ts (TokenSchema exported)
tech_stack:
  added:
    - "@tanstack/zod-adapter zodValidator — wired to PairSearchSchema on pairRoute"
  patterns:
    - "Pattern 2: TanStack Router validateSearch + zodValidator at routing layer (T-02-17 mitigated)"
    - "Pitfall 8: validateSearch errors route to errorComponent via routerCode === 'VALIDATE_SEARCH'"
    - "W1 fix: MalformedPairUrl extracted to pair-error.tsx so router.tsx eager-imports it without pulling pair.lazy chunk"
    - "PairFlow state machine: pairing → (success|drift|unreachable|failed) with clearPairing on any error"
    - "fireEvent + act for clipboard tests (userEvent v14 intercepts clipboard, bypasses component mock)"
key_files:
  created:
    - packages/spa/src/components/CodeBlock.tsx
    - packages/spa/src/components/CodeBlock.test.tsx
    - packages/spa/src/components/OnboardingHero.tsx
    - packages/spa/src/components/OnboardingHero.test.tsx
    - packages/spa/src/routes/pair-error.tsx
    - packages/spa/src/routes/pair.test.tsx
  modified:
    - packages/spa/src/routes/onboarding.lazy.tsx (stub replaced with real component)
    - packages/spa/src/routes/pair.lazy.tsx (stub replaced with PairFlow state machine)
    - packages/spa/src/router.tsx (pairRoute upgraded with validateSearch + errorComponent)
    - packages/shared/src/index.ts (TokenSchema added to exports)
decisions:
  - "fireEvent + act used for clipboard mock assertions — userEvent v14 intercepts navigator.clipboard calls via its own pointer simulation, so vi.fn() mocks on navigator.clipboard show 0 calls when using userEvent.click"
  - "PairFlow exported from pair.lazy.tsx (not just Route.options.component) to enable type-safe direct import in pair.test.tsx — RouteComponent is typed as RouteComponent | undefined which is not directly usable as JSX"
  - "TokenSchema added to packages/shared/src/index.ts — required by router.tsx PairSearchSchema but was missing from the package's public exports"
metrics:
  duration: "35 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 2
  files_created: 6
  files_modified: 4
  commits: 2
---

# Phase 02 Plan 04: Unpaired-Flow Routes — Wave 2A Summary

**One-liner:** /onboarding route ships D-01 verbatim-copy hero + 3 numbered steps + disclosure; /pair route implements a 5-state machine (pairing/success/drift/unreachable/failed) with validateSearch at the routing layer and MalformedPairUrl extracted to its own eager-importable file (W1 bundle-splitting fix); 19 new GREEN tests.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | CodeBlock + OnboardingHero + /onboarding route | 7a422de | CodeBlock.tsx, CodeBlock.test.tsx, OnboardingHero.tsx, OnboardingHero.test.tsx, onboarding.lazy.tsx |
| 2 | /pair route validateSearch + happy-path + pair-error extraction | 40fc598 | pair.lazy.tsx, pair-error.tsx, pair.test.tsx, router.tsx |

## /pair Status State Machine

```
initial: { kind: 'pairing' }
         │
         ├── apiFetch('/health', HealthResponseSchema)
         │       │
         │       ├── ok: true, data.ok: true ──────────────► navigate({ to: '/', replace: true })
         │       │
         │       ├── ok: false (schema drift) ────────────► clearPairing() + { kind: 'drift' }
         │       │                                            renders <SchemaDriftState />
         │       │
         │       ├── ApiError(401) ───────────────────────► clearPairing() + { kind: 'failed', heading: 'Token rejected' }
         │       │
         │       ├── ApiError(other status) ──────────────► clearPairing() + { kind: 'failed', heading: 'Pairing failed', body: 'HTTP N' }
         │       │
         │       └── TypeError('Failed to fetch') ────────► clearPairing() + { kind: 'unreachable' }
         │                                                    renders <DaemonUnreachableState />
         │
         └── cancelled (unmount) ──────────────────────────► no setState
```

**Cancellation guard:** `let cancelled = false; return () => { cancelled = true }` prevents setState after unmount across all branches.

## 4 Verbatim Error Copy Strings

| State | Heading | Source |
|-------|---------|--------|
| Token rejected | `Token rejected` | UI-SPEC §PairFlow Copywriting |
| Non-401 HTTP error | `Pairing failed` | UI-SPEC §PairFlow Copywriting |
| Daemon unreachable | `Daemon not running` | DaemonUnreachableState component (Plan 03) |
| Malformed URL | `This pair URL doesn't look right` | pair-error.tsx (W1 extracted) |

## MalformedPairUrl Bundle-Split Location (W1 Fix)

`MalformedPairUrl` is exported from `packages/spa/src/routes/pair-error.tsx` (NOT from `pair.lazy.tsx`).

**Why this matters:** `router.tsx` needs to eager-import `MalformedPairUrl` so the `errorComponent` function is available before the lazy chunk loads. If `MalformedPairUrl` lived in `pair.lazy.tsx`, the eager import would defeat per-route code-splitting by pulling the entire pair.lazy chunk (6.79 kB) into the main bundle.

**Build verification:**
```
dist/assets/pair.lazy-CIvHHiqZ.js    6.79 kB  (separate chunk — code split preserved)
dist/assets/index-XqhWSV9w.js      148.55 kB  (main bundle — MalformedPairUrl is tiny, absorbed here)
```

**Grep gate:**
```bash
grep -c "from './routes/pair.lazy" packages/spa/src/router.tsx
# → 0 (only .lazy(() => import('./routes/pair.lazy.js')) dynamic import)
```

## Anti-Slop Grep Guards (D-01 + W3)

OnboardingHero.tsx contains NONE of: `bg-gradient`, `<img`, `<video`, `animate-spin`, `bg-clip-text`, `backdrop-blur`, `shadow-2xl`, `drop-shadow`.

Verified:
```bash
grep -E "bg-gradient|<img|<video|animate-spin|bg-clip-text|backdrop-blur|shadow-2xl|drop-shadow" \
  packages/spa/src/components/OnboardingHero.tsx
# → (empty — CLEAN)
```

## Test Coverage Summary

| File | Tests | Key cases |
|------|-------|-----------|
| `CodeBlock.test.tsx` | 6 | renders verbatim, aria-label, writeText called (fireEvent), Copied state, Failed to copy alert, 1500ms revert |
| `OnboardingHero.test.tsx` | 10 | headline, value prop, 3 step headings, Step 2 two CodeBlocks, pages.dev/pair URL, "Why local-only →" (U+2192), disclosure body .planning/ + no telemetry, no img tags, no AI-slop classNames, ol[role=list] |
| `pair.test.tsx` | 5 | happy path navigate, drift clearPairing + SchemaDriftState, 401 Token rejected + clearPairing, TypeError DaemonUnreachableState + clearPairing, MalformedPairUrl heading verbatim |

**Total new tests: 21 (83 total in suite, all GREEN)**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TokenSchema missing from @agenticapps/dashboard-shared exports**
- **Found during:** Task 2 typecheck — `router.tsx` imports `{ AgentUrlSchema, TokenSchema }` from `@agenticapps/dashboard-shared` but `TokenSchema` was not in `packages/shared/src/index.ts`
- **Fix:** Added `TokenSchema` to the `auth.ts` export line in `packages/shared/src/index.ts`
- **Files modified:** `packages/shared/src/index.ts`
- **Commit:** 7a422de

**2. [Rule 1 - Bug] userEvent v14 intercepts navigator.clipboard — mock shows 0 calls**
- **Found during:** Task 1, CodeBlock.test.tsx iteration
- **Issue:** `@testing-library/user-event` v14 installs its own clipboard simulation. When using `userEvent.click`, the component's `navigator.clipboard.writeText(command)` call goes to userEvent's internal clipboard, not our `vi.fn()` mock. Result: writeText mock showed 0 calls even though state changed to 'copied'.
- **Fix:** Switched clipboard-assertion tests from `userEvent.click` to `fireEvent.click + act`. UI-state tests (Copied text, Failed to copy alert) work with either approach since they check React state, not call counts.
- **Files modified:** `packages/spa/src/components/CodeBlock.test.tsx`
- **Commit:** 7a422de

**3. [Rule 1 - Bug] PairRoute.options.component not type-safe as JSX element**
- **Found during:** Task 2 typecheck — `TanStack Router` types `Route.options.component` as `RouteComponent | undefined`, which TypeScript rejects as a JSX element type
- **Fix:** Exported `PairFlow` directly from `pair.lazy.tsx` and imported it by name in the test
- **Files modified:** `packages/spa/src/routes/pair.lazy.tsx`, `packages/spa/src/routes/pair.test.tsx`
- **Commit:** 40fc598

## Known Stubs

None. All components are fully implemented with real logic.

## Threat Flags

None. No new network endpoints or auth paths introduced beyond those in the plan's threat model (T-02-17 through T-02-20, all mitigated).

## Self-Check: PASSED

**Files created confirmed present:**
- `packages/spa/src/components/CodeBlock.tsx` ✓
- `packages/spa/src/components/CodeBlock.test.tsx` ✓
- `packages/spa/src/components/OnboardingHero.tsx` ✓
- `packages/spa/src/components/OnboardingHero.test.tsx` ✓
- `packages/spa/src/routes/pair-error.tsx` ✓
- `packages/spa/src/routes/pair.test.tsx` ✓

**Files modified confirmed updated:**
- `packages/spa/src/routes/onboarding.lazy.tsx` ✓ (contains `<OnboardingHero />`)
- `packages/spa/src/routes/pair.lazy.tsx` ✓ (contains `PairFlow`, `setPairing`, `clearPairing`, `apiFetch('/health', HealthResponseSchema)`)
- `packages/spa/src/router.tsx` ✓ (contains `validateSearch: zodValidator(PairSearchSchema)`, `error.routerCode === 'VALIDATE_SEARCH'`, `import { MalformedPairUrl } from './routes/pair-error.js'`)
- `packages/shared/src/index.ts` ✓ (TokenSchema exported)

**Commits confirmed:** 7a422de (Task 1), 40fc598 (Task 2) — both in git log.

**Tests:** 83 passing, 1 skipped (dev-perf-smoke — belongs to Plan 02-06). Typecheck: clean. Build: 10 chunks including 5 lazy route chunks. Anti-slop guards verified clean. Bundle-split W1 grep gate: 0 eager imports from pair.lazy in router.tsx.
