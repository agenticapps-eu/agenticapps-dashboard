---
phase: 02-spa-shell-pair-flow
plan: 03
subsystem: spa-api-layer
tags: [apiFetch, schema-drift, 401-plumbing, repair-context, tdd, wave-1c]
dependency_graph:
  requires:
    - "02-01 (PairingSchema from shared, global.css tokens)"
    - "02-02 (getPairing/pairing.ts, AppShell banner-mount slot, router.tsx)"
  provides:
    - "ApiError class + parseOrDrift + apiFetch (Plans 02-04, 02-05 consume for daemon HTTP)"
    - "RepairProvider + useRepair hook (Plan 02-06 wires into AppShell)"
    - "createQueryClient(repair) factory (Plan 02-06 wires into main.tsx QueryClientProvider)"
    - "SchemaDriftState component (Plans 02-04, 02-05 render on parseOrDrift ok:false)"
    - "DaemonUnreachableState component (Plans 02-04, 02-05 render on TypeError)"
    - "RepairBanner component (Plan 02-06 mounts in AppShell banner-mount slot)"
  affects:
    - packages/spa/src/lib (3 new lib modules)
    - packages/spa/src/components (3 new components)
    - packages/spa/package.json (zod added as direct dep)
tech_stack:
  added:
    - "zod: catalog: added to packages/spa/package.json dependencies (required for import type { z } from 'zod' in api.ts)"
  patterns:
    - "ApiError extends Error with status + requestId fields — differentiates auth failures from network failures"
    - "parseOrDrift<S>(schema, json): tagged union ok/drift — never throws into render tree (T-02-12 mitigated)"
    - "apiFetch<S>: injects Bearer, handles 401 via ApiError(401), propagates TypeError unchanged (Pitfall 4)"
    - "RepairBus: useCallback([]) on all three helpers for stable identities (B1 fix — Plan 06 useMemo guard)"
    - "createQueryClient: QueryCache.onError guards instanceof ApiError && status===401 (Pitfall 5: no state.data check)"
    - "repair.ts renamed to repair.tsx — JSX return from RepairProvider requires .tsx extension"
key_files:
  created:
    - packages/spa/src/lib/api.ts
    - packages/spa/src/lib/api.test.ts
    - packages/spa/src/lib/repair.tsx
    - packages/spa/src/lib/repair.test.tsx
    - packages/spa/src/lib/queryClient.ts
    - packages/spa/src/lib/queryClient.test.ts
    - packages/spa/src/components/SchemaDriftState.tsx
    - packages/spa/src/components/SchemaDriftState.test.tsx
    - packages/spa/src/components/DaemonUnreachableState.tsx
    - packages/spa/src/components/DaemonUnreachableState.test.tsx
    - packages/spa/src/components/RepairBanner.tsx
    - packages/spa/src/components/RepairBanner.test.tsx
  modified:
    - packages/spa/package.json (zod: catalog: added to dependencies)
    - pnpm-lock.yaml (updated after install)
decisions:
  - "repair.ts renamed to repair.tsx — RepairProvider returns JSX; Vite's oxc parser requires .tsx extension for JSX syntax"
  - "Strict-mode `first` possibly-undefined guard in parseOrDrift — Zod always produces ≥1 issue on failure but TypeScript strict mode flags it; added safe-access pattern that satisfies the compiler without being reachable at runtime"
  - "queryClient.ts comment for Pitfall 5 reworded to avoid the literal string 'query.state.data !== undefined' — the source-level grep test in queryClient.test.ts would otherwise match the comment itself"
metrics:
  duration: "12 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 3
  files_created: 12
  files_modified: 2
  commits: 3
---

# Phase 02 Plan 03: API Layer + Drift + 401 Plumbing — Wave 1C Summary

**One-liner:** Wave-0 RED stub api.test.ts turned GREEN with 10 real cases; apiFetch + parseOrDrift + ApiError shipped as the daemon-fetch layer; RepairContext with stable useCallback helpers guards Plan 06's useMemo loop; createQueryClient wires QueryCache 401 interceptor (Pitfalls 4+5 guarded at source level); SchemaDriftState + DaemonUnreachableState + RepairBanner components ship with UI-SPEC verbatim copy and correct color tokens.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | lib/api.ts (apiFetch + parseOrDrift + ApiError) — Wave-0 stub GREEN | 4f1da52 | packages/spa/src/lib/api.ts, api.test.ts, packages/spa/package.json |
| 2 | lib/repair.tsx + lib/queryClient.ts (RepairContext + 401 interceptor) | 32922d3 | packages/spa/src/lib/repair.tsx, repair.test.tsx, queryClient.ts, queryClient.test.ts |
| 3 | SchemaDriftState + DaemonUnreachableState + RepairBanner components | 4ae9b40 | 6 component files |

## Exports from lib/api.ts (Plans 02-04 + 02-05 import)

```typescript
// packages/spa/src/lib/api.ts
export class ApiError extends Error {
  readonly status: number
  readonly requestId: string | undefined
}

export type DriftIssue = {
  path: string      // first.path.join('.') or '(root)'
  expected: string  // first.expected or first.code
  got: string       // first.received or 'unknown'
  issues: z.ZodIssue[]
}

export type ParseOrDrift<T> =
  | { ok: true; data: T }
  | { ok: false; drift: DriftIssue }

export function parseOrDrift<S extends z.ZodTypeAny>(
  schema: S,
  json: unknown,
): ParseOrDrift<z.infer<S>>
// On Zod failure: calls console.error('[schema-drift]', issues) per D-08

export async function apiFetch<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<ParseOrDrift<z.infer<S>>>
// Injects Authorization: Bearer header from getPairing()
// Throws ApiError(401) on auth failure (null pairing OR 401 response)
// Propagates TypeError unchanged (ECONNREFUSED → DaemonUnreachableState)
// Normalizes trailing slash from agentUrl
```

## Exports from lib/repair.tsx (Plan 02-06 imports)

```typescript
// packages/spa/src/lib/repair.tsx
export type RepairBus = {
  needsRepair: boolean
  dismissed: boolean
  setNeedsRepair: (v: boolean) => void  // useCallback([], []) — stable identity
  dismiss: () => void                    // useCallback([], []) — stable identity
  clear: () => void                      // useCallback([], []) — stable identity
}

export function RepairProvider({ children }: { children: ReactNode }): React.JSX.Element
// D-06: setNeedsRepair(true) resets dismissed flag (new 401 re-shows banner)
// clear() resets both to false (call on /health 200)

export function useRepair(): RepairBus
// Throws if used outside <RepairProvider>
```

## Exports from lib/queryClient.ts (Plan 02-06 imports)

```typescript
// packages/spa/src/lib/queryClient.ts
export function createQueryClient(repair: Pick<RepairBus, 'setNeedsRepair'>): QueryClient
// QueryCache.onError: ApiError(401) → repair.setNeedsRepair(true)
// TypeError → no-op (Pitfall 4 guard)
// Non-401 ApiError → no-op
// defaultOptions.queries: retry: false, refetchOnWindowFocus: false, staleTime: 5_000
```

## Component File Paths + Key Copy Strings (Plan 02-06 grep checklist)

| Component | Path | Key copy | Color token |
|-----------|------|----------|-------------|
| `SchemaDriftState` | `packages/spa/src/components/SchemaDriftState.tsx` | "Schema drift detected", "Retry request", "Show full diff" | `text-[--danger]` on AlertTriangle |
| `DaemonUnreachableState` | `packages/spa/src/components/DaemonUnreachableState.tsx` | "Daemon not running", "Try again", "agentic-dashboard start" | `text-[--warning]` on AlertTriangle (NOT --danger) |
| `RepairBanner` | `packages/spa/src/components/RepairBanner.tsx` | "Agent token rejected.", aria-label "Re-pair (open onboarding)", aria-label "Dismiss banner (will return on next 401)" | `text-[--danger]` + `bg-[--danger-surface]` |

## Pitfall Guards (source-level — reproducible grep)

```bash
# Pitfall 4: TypeError does NOT flow to setNeedsRepair (queryClient.ts)
grep -c "error instanceof ApiError && error.status === 401" packages/spa/src/lib/queryClient.ts
# → 1

# Pitfall 5: no query.state.data guard in queryClient.ts
grep "query.state.data" packages/spa/src/lib/queryClient.ts
# → (empty — no match)

# B1 fix: useCallback count in repair.tsx >= 3
grep -c "useCallback" packages/spa/src/lib/repair.tsx
# → 5 (import + 3 helpers)
```

## Test Coverage Summary

| File | Test count | Key cases |
|------|-----------|-----------|
| `api.test.ts` | 10 | Bearer header injection, 401+requestId, TypeError propagation (Pitfall 4), 200 success, parseOrDrift drift/console.error, unpaired 401, trailing-slash normalization, non-401 error |
| `repair.test.tsx` | 7 | Outside provider throws, default state, setNeedsRepair(true) resets dismissed, dismiss keeps needsRepair, clear resets both, **setNeedsRepair identity stable across re-renders** (B1 fix), identity unchanged after mutation |
| `queryClient.test.ts` | 5 | ApiError(401) flips setNeedsRepair, TypeError ignored (Pitfall 4), non-401 ApiError ignored, retry:false (D-07), no query.state.data guard (Pitfall 5 source grep) |
| `SchemaDriftState.test.tsx` | 6 | heading, body, field/expected/got, Show full diff disclosure, Retry request calls onRetry, verbatim copy check |
| `DaemonUnreachableState.test.tsx` | 5 | heading, agentUrl interpolation, Try again calls onRetry, verbatim copy, --warning color |
| `RepairBanner.test.tsx` | 9 | needsRepair=false → null, banner copy, Re-pair aria-label, Re-pair navigates to /onboarding + clear(), Dismiss aria-label, Dismiss hides banner, Esc triggers dismiss, Esc when hidden → no effect, --danger color |

**Total new tests: 42 (Wave-0 RED stub now fully GREEN)**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] repair.ts renamed to repair.tsx — JSX in .ts file**
- **Found during:** Task 2, first test run
- **Issue:** `RepairProvider` returns JSX (`<RepairContext.Provider>`) but the file extension was `.ts`. Vite's oxc parser throws `PARSE_ERROR: Expected > but found Identifier` when processing JSX in a `.ts` file.
- **Fix:** Renamed `repair.ts` → `repair.tsx`. Import statements reference `./repair.js` which Vite's bundler module resolution resolves to `.tsx` correctly. `repair.test.ts` also renamed to `repair.test.tsx` for the same reason.
- **Files modified:** `packages/spa/src/lib/repair.tsx`, `packages/spa/src/lib/repair.test.tsx`
- **Commit:** 32922d3

**2. [Rule 1 - Bug] TypeScript strict mode: `first` in parseOrDrift is possibly undefined**
- **Found during:** Task 1 typecheck
- **Issue:** `result.error.issues[0]` is typed as `ZodIssue | undefined` in strict mode. The plan snippet accessed `.path`, `.expected`, `.code`, `.received` directly on potentially-undefined `first`.
- **Fix:** Added a safe-access pattern with fallback values. Zod never produces an empty issues array on a failed parse, so the fallback is unreachable at runtime but satisfies the compiler.
- **Files modified:** `packages/spa/src/lib/api.ts`
- **Commit:** 4f1da52

**3. [Rule 1 - Bug] queryClient.ts Pitfall 5 comment triggered own source-level grep test**
- **Found during:** Task 2, first test run
- **Issue:** The comment `// Pitfall 5: NEVER guard on \`query.state.data !== undefined\`` contained the exact literal string `query.state.data !== undefined`. The test `expect(source).not.toMatch(/query\.state\.data\s*!==/)` matched the comment itself.
- **Fix:** Rewrote the comment to describe the intent without including the forbidden literal: `// Pitfall 5: do NOT add a stale-data guard here (tk-dodo anti-pattern)`.
- **Files modified:** `packages/spa/src/lib/queryClient.ts`
- **Commit:** 32922d3

**4. [Rule 2 - Missing] `zod` added as direct dep to packages/spa/package.json**
- **Found during:** Task 1 typecheck
- **Issue:** `import type { z } from 'zod'` in `api.ts` requires `zod` to be a direct dependency in `packages/spa`. It was only a transitive dep via `@agenticapps/dashboard-shared`. TypeScript's module resolution under `moduleResolution: Bundler` requires the dep to be listed directly.
- **Fix:** Added `"zod": "catalog:"` to `packages/spa/package.json` dependencies.
- **Files modified:** `packages/spa/package.json`, `pnpm-lock.yaml`
- **Commit:** 4f1da52

## Known Stubs

None. All three lib modules and three components are fully implemented with real logic. No placeholder values or TODO comments in production code.

## Threat Flags

None. All new files are:
- Static components (no network endpoints)
- Client-side fetch wrapper (`apiFetch` — documented in plan threat model T-02-12 through T-02-16, all mitigated)
- Context provider (no trust boundary crossing)

The threat mitigations from the plan's threat register are all implemented:
- T-02-12: `parseOrDrift` returns tagged union, never throws into render tree
- T-02-14: Source-level grep test confirms no `query.state.data` guard
- T-02-15: RepairBanner CTA navigates only to `/onboarding` (hardcoded, not from response body)
- T-02-16: queryClient.test.ts "TypeError ignored" case defends against regression

## Self-Check: PASSED

**Files created confirmed present:** All 12 files verified present on disk.

**Commits confirmed:** 4f1da52 (Task 1), 32922d3 (Task 2), 4ae9b40 (Task 3) — all in git log.

**Tests:** 62 passing, 1 skipped (dev-perf-smoke — belongs to Plan 02-06). Typecheck: clean.

**Grep gates:**
- `grep -c "useCallback" packages/spa/src/lib/repair.tsx` → 5 (≥ 3 required)
- `grep "setNeedsRepair identity stable across re-renders" packages/spa/src/lib/repair.test.tsx` → FOUND
- `grep "query.state.data" packages/spa/src/lib/queryClient.ts` → (empty — GOOD)
- `grep -c "describe.todo" packages/spa/src/lib/api.test.ts` → 0
- `grep -c "MISSING" packages/spa/src/lib/api.test.ts` → 0
