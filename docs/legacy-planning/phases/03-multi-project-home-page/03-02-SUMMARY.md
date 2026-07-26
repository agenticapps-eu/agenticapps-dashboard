---
phase: 03-multi-project-home-page
plan: 02
subsystem: spa
tags: [layout, width-override, useSyncExternalStore, wave-0]
dependency_graph:
  requires: []
  provides:
    - useAppShellWidth hook (packages/spa/src/lib/appShellWidth.ts)
    - HomeLayout component (packages/spa/src/components/HomeLayout.tsx)
  affects:
    - packages/spa/src/components/AppShell.tsx
tech_stack:
  added: []
  patterns:
    - useSyncExternalStore external store for layout state (mirrors theme.ts WR-01 pattern)
    - useEffect mount/unmount setter pattern for route-scoped layout overrides
key_files:
  created:
    - packages/spa/src/lib/appShellWidth.ts
    - packages/spa/src/components/HomeLayout.tsx
    - packages/spa/src/lib/appShellWidth.test.ts
    - packages/spa/src/components/HomeLayout.test.tsx
  modified:
    - packages/spa/src/components/AppShell.tsx
    - packages/spa/src/components/AppShell.test.tsx
decisions:
  - useSyncExternalStore bus for AppShell main-width (same as theme.ts WR-01); avoids prop threading through TanStack Router root component
  - HomeLayout sets max-w-5xl on mount, resets on unmount — all other routes stay max-w-3xl by default
  - max-w-3xl literal removed from AppShell JSX; default now lives in appShellWidth.ts getServerSnapshot
metrics:
  duration: ~25 minutes
  completed: 2026-05-04
  tasks_completed: 1
  files_created: 4
  files_modified: 2
---

# Phase 3 Plan 02: AppShell Width Override + HomeLayout Wrapper Summary

**One-liner:** `useSyncExternalStore` bus in `appShellWidth.ts` lets `HomeLayout` expand AppShell's `<main>` to `max-w-5xl` on mount and restore `max-w-3xl` on unmount, without touching TanStack Router's root component signature.

---

## What Was Built

### `packages/spa/src/lib/appShellWidth.ts` (NEW)

Module-scope external store with four exports:

- `setAppShellWidth(value)` — updates the current width string and notifies all subscribers
- `subscribeAppShellWidth(cb)` — registers a subscriber, returns unsubscribe function
- `getSnapshot()` — returns current width (default `'max-w-3xl'`)
- `useAppShellWidth()` — React hook via `useSyncExternalStore`; re-renders consumers when width changes

Pattern is identical to `packages/spa/src/lib/theme.ts` (WR-01 fix from Phase 2), providing a process-private, bundle-scoped subscription bus.

### `packages/spa/src/components/HomeLayout.tsx` (NEW)

Route-level wrapper that:
1. On mount (`useEffect`): calls `setAppShellWidth('max-w-5xl')`
2. On unmount (effect cleanup): calls `setAppShellWidth('max-w-3xl')`
3. Renders `<>{children}</>` — transparent wrapper, no DOM element added

Wave 2's `MultiProjectHome` wraps its content in `<HomeLayout>` to activate the wider layout automatically.

### `packages/spa/src/components/AppShell.tsx` (MODIFIED)

- Added `import { useAppShellWidth } from '../lib/appShellWidth.js'`
- `const mainWidth = useAppShellWidth()` called in the component body
- `<main>` className changed from `"... max-w-3xl ..."` to `` `... ${mainWidth} ...` ``
- The `max-w-3xl` literal is now gone from AppShell JSX; the default lives in `appShellWidth.ts`'s `getSnapshot()` / `getServerSnapshot()`

---

## Chosen Approach and Why

The plan explored four approaches before landing on this one:

| Approach | Why Rejected |
|----------|--------------|
| `mainClassName` prop on AppShell | TanStack Router's `createRootRoute({ component: AppShell })` passes no props; can't thread a prop through the root route component |
| React context Provider inside Outlet children | Consumers sit above providers in the render tree (AppShell renders the Provider inside Outlet, but AppShell's `<main>` is the consumer — wrong direction) |
| Remove max-width from AppShell entirely, each route wraps itself | Too invasive for Wave 0; touches 5 Phase 2 route files |
| `useSyncExternalStore` module-scope bus (chosen) | Matches the established WR-01 pattern from Phase 2; zero churn to route files; HomeLayout mounts inside the Outlet so the effect runs after AppShell already subscribed |

---

## Phase 2 Routes Unaffected

All Phase 2 routes (`/onboarding`, `/pair`, `/settings`, `/help`, `/`) do not render `<HomeLayout>`. They inherit the default `max-w-3xl` from `getSnapshot()`'s default value. The existing 124 Phase 2 tests still pass with 0 regressions.

---

## Test Coverage

| File | Tests Added |
|------|-------------|
| `appShellWidth.test.ts` | 6 unit tests: default snapshot, set/get, subscriber notification, unsubscribe, hook returns current, hook updates reactively |
| `HomeLayout.test.tsx` | 5 tests: renders children, sets max-w-5xl on mount, resets on unmount, AppShell main reflects 5xl, AppShell main reverts to 3xl |
| `AppShell.test.tsx` | 3 new tests: max-w-3xl by default, switches to 5xl on store update, resets to 3xl after clearing |

Total: 14 new tests. All 138 tests (20 test files) pass.

---

## Deviations from Plan

None — plan executed as written. The `useSyncExternalStore` approach described in the plan's `<action>` section was implemented exactly. The only detail not in the plan was adding an empty line between import groups in `AppShell.tsx` to satisfy ESLint's `import/order` rule (pre-existing rule, not a new constraint).

---

## Verification

- `pnpm --filter @agenticapps/dashboard-spa test --run`: 138 passed, 0 failed (20 test files)
- `pnpm -r typecheck`: exits 0 (shared + spa + agent all pass)
- `pnpm lint`: 0 errors (2 pre-existing warnings in out-of-scope files: tailscale.test.ts, api.test.ts)
- Acceptance criteria:
  - `grep -c 'useAppShellWidth\|useSyncExternalStore' appShellWidth.ts` → 4 (≥2) ✓
  - `grep -c 'export function setAppShellWidth' appShellWidth.ts` → 1 ✓
  - `grep -c 'useAppShellWidth' AppShell.tsx` → 2 (≥1) ✓
  - `grep -c 'max-w-3xl' AppShell.tsx` → 0 (literal removed) ✓
  - `grep -c 'export function HomeLayout' HomeLayout.tsx` → 1 ✓
  - `grep -c 'max-w-5xl' HomeLayout.tsx` → 2 (≥1, includes JSDoc comment) ✓
  - `grep -c 'useEffect' HomeLayout.tsx` → 2 (≥1, import + usage) ✓

---

## Known Stubs

None. This plan ships infrastructure only (no UI rendering). No stub values flow to UI.

## Threat Flags

None. This plan introduces no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. The `appShellWidth.ts` module-scope state is process-private CSS class strings (T-03-02-01 accepted, T-03-02-02 accepted per plan's threat model).

## Self-Check: PASSED

- `packages/spa/src/lib/appShellWidth.ts` — FOUND
- `packages/spa/src/components/HomeLayout.tsx` — FOUND
- `packages/spa/src/components/AppShell.tsx` — FOUND (modified)
- `packages/spa/src/lib/appShellWidth.test.ts` — FOUND
- `packages/spa/src/components/HomeLayout.test.tsx` — FOUND
- `packages/spa/src/components/AppShell.test.tsx` — FOUND (modified)
- Commit `bcb4c7a` (feat(03-02)) — FOUND in git log
