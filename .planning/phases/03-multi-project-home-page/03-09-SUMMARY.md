---
phase: 03-multi-project-home-page
plan: "09"
subsystem: spa-header
tags: [react, tanstack-query, hooks, header, d-05]
dependency_graph:
  requires: [03-06]
  provides: [useLastRefresh, Header status line]
  affects: [packages/spa/src/components/Header.tsx, packages/spa/src/lib/lastRefresh.ts]
tech_stack:
  added: []
  patterns: [useQueryClient + getQueryCache for cache inspection, setInterval in useEffect for 1s tick, relativeSeconds pure function]
key_files:
  created:
    - packages/spa/src/lib/lastRefresh.ts
    - packages/spa/src/lib/lastRefresh.test.ts
    - packages/spa/src/components/Header.test.tsx
  modified:
    - packages/spa/src/components/Header.tsx
    - packages/spa/src/components/AppShell.test.tsx
decisions:
  - relativeSeconds exported as pure function for direct unit testing without React context
  - useLastRefresh reads getQueryData(['registry']) directly (not from useRegistryList) to avoid plan-06 import dependency in parallel execution
  - AppShell.test.tsx wrapped with QueryClientProvider as a Rule 1 auto-fix (Header now requires one)
metrics:
  duration: ~25 minutes
  completed: 2026-05-04
  tasks_completed: 1
  files_changed: 5
---

# Phase 03 Plan 09: useLastRefresh hook + Header status line Summary

**One-liner:** `useLastRefresh` hook reading TanStack QueryCache for oldest `dataUpdatedAt` across `['registry']` and `['overview', *]` queries, ticking every 1s, wired into Header as `"{N} projects · last refresh Ns ago"` status span.

## What Was Built

### `useLastRefresh` hook (`packages/spa/src/lib/lastRefresh.ts`)

Contract:
```typescript
export function useLastRefresh(): { count: number | null; refreshLabel: string | null }
export function relativeSeconds(deltaMs: number): string  // pure, exported for tests
```

- `count`: length of `['registry']` query data array, or `null` while loading.
- `refreshLabel`: `"last refresh Ns ago"` using `Math.min(...dataUpdatedAt)` across all `['registry']` and `['overview', *]` cache entries with `dataUpdatedAt > 0`; `"refreshing…"` when no entry has completed yet.
- Updates every 1s via `setInterval`; interval cleaned up on unmount via `clearInterval`.
- Reads query cache directly via `useQueryClient().getQueryCache().getAll()` — no imports from `registry.ts` (plan-06's domain).

### Header extension (`packages/spa/src/components/Header.tsx`)

Added a single `<span aria-hidden="true" className="text-sm text-[--text-muted]">` between the brand `<Link>` and the flex spacer `<span>`. Renders:
- `"{N} projects · "` when registry data is loaded
- `"— projects · "` while loading
- Followed by `{refreshLabel}` (`"last refresh Ns ago"` or `"refreshing…"`)

Changed header flex `gap-2` to `gap-3` per UI-SPEC (12px gap between brand and status span).

The status span carries `aria-hidden="true"` per D-05 — supplementary info, not critical for screen readers. Two `aria-hidden="true"` spans now exist in the header: the status span and the existing flex spacer.

### Tests

**`lastRefresh.test.ts`** (11 tests):
- `relativeSeconds`: 4 tests covering s/m/h/d thresholds
- `useLastRefresh`: 7 tests covering no-queries state, count from registry, null count, oldest-timestamp label, interval tick update, dataUpdatedAt=0 filtering, clearInterval on unmount

**`Header.test.tsx`** (6 tests):
- Brand label unchanged
- ThemeChip still renders
- Settings link still renders
- Status span has `aria-hidden="true"`
- Shows `"— projects · refreshing…"` with no queries
- Shows `"3 projects · last refresh…"` with seeded registry data

Total new tests: **17** (requirement: ≥7).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AppShell.test.tsx needed QueryClientProvider after Header gained useQueryClient() dependency**

- **Found during:** Task 1 (GREEN phase — tests ran and AppShell.test.tsx failed)
- **Issue:** Header now calls `useLastRefresh()` which calls `useQueryClient()`. AppShell renders Header. AppShell.test.tsx rendered AppShell without a `QueryClientProvider`, causing "No QueryClient set" errors in 4 tests.
- **Fix:** Added `import { QueryClient, QueryClientProvider }` to `AppShell.test.tsx` and wrapped `renderAppShell()` with `<QueryClientProvider client={qc}>`.
- **Files modified:** `packages/spa/src/components/AppShell.test.tsx`
- **Commit:** d2a6fca (included in same task commit)

**2. [Rule 2 - Missing] `@ts-expect-error` directives removed after finding they were unnecessary**

- `query.state.dataUpdatedAt` is publicly typed in TanStack Query v5; the suppression directives caused TS2578 "Unused '@ts-expect-error' directive" errors. Removed all 5 occurrences across `lastRefresh.test.ts` and `Header.test.tsx`.

**3. [Rule 1 - Bug] Import order warning in Header.tsx**

- ESLint `import/order` flagged `../lib/lastRefresh.js` appearing after `./ThemeChip.js` (parent-dir imports should precede same-dir imports). Fixed by reordering: `lastRefresh.js` import moved above `ThemeChip.js` import with a blank-line separator.

## Known Stubs

None. `useLastRefresh` reads live query cache; no hardcoded values flow to UI.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. `useLastRefresh` reads only TanStack Query's in-memory cache (internal SPA state). T-03-09-02 (setInterval DoS) is mitigated: 1Hz tick, `clearInterval` on unmount confirmed by test.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `packages/spa/src/lib/lastRefresh.ts` | FOUND |
| `packages/spa/src/lib/lastRefresh.test.ts` | FOUND |
| `packages/spa/src/components/Header.tsx` | FOUND |
| `packages/spa/src/components/Header.test.tsx` | FOUND |
| Commit d2a6fca | FOUND |
| 142/142 tests pass | PASS |
| TypeScript clean (`tsc --noEmit`) | PASS |
| ESLint clean | PASS |
