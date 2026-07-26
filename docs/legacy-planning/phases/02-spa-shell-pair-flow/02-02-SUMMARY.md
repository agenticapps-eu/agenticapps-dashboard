---
phase: 02-spa-shell-pair-flow
plan: 02
subsystem: spa-shell
tags: [tanstack-router, theme, pairing, localStorage, chrome, tdd, wave-1b]
dependency_graph:
  requires:
    - "02-01 (PairingSchema from shared, TanStack Router catalog entry, global.css tokens, RED stubs)"
  provides:
    - "getPairing/setPairing/clearPairing localStorage helpers (Plans 02-03, 02-04 import)"
    - "useTheme/applyTheme/initTheme hook (Plans 02-03, 02-04, 02-05 import)"
    - "ThemeChoice type (Plans 02-04, 02-05 reference)"
    - "AppShell component with skip-link + banner-mount slot (Plan 02-04 mounts RepairBanner)"
    - "Header component (Plans 02-04, 02-05 render via router tree)"
    - "ThemeChip component (Plan 02-05 settings duplicates toggle)"
    - "router.tsx with 5-route tree + SPA-03 pairing guard (Plans 02-04, 02-05 replace stub routes)"
    - "5 route stub files (Plans 02-04, 02-05 replace with real components)"
    - "main.tsx with RouterProvider + QueryClientProvider + pre-render initTheme"
  affects:
    - packages/spa/src/lib (new pairing.ts + theme.ts)
    - packages/spa/src/components (new ThemeChip + Header + AppShell)
    - packages/spa/src/router.tsx (new 5-route code-based tree)
    - packages/spa/src/routes/ (new stub lazy files)
    - packages/spa/src/main.tsx (replaced — now mounts router, not App)
    - packages/spa/index.html (body class removed; global.css vars take over)
tech_stack:
  added: []
  patterns:
    - "getPairing/setPairing/clearPairing: PairingSchema.safeParse on every read; corrupt auto-clears"
    - "useTheme: useState(readChoice) + useEffect per [choice] to applyTheme + persist; system subscribes matchMedia"
    - "initTheme: called pre-createRoot in main.tsx to prevent first-paint flash (D-02)"
    - "ThemeChip: CYCLE map dark→light→system→dark; Moon/Sun/Monitor icons; dynamic aria-label"
    - "TanStack Router code-based: createRoute(...).lazy(() => import(stub).then(m=>m.Route))"
    - "SPA-03 guard: indexRoute beforeLoad calls getPairing(); throws redirect({to:'/onboarding'}) if null"
    - "Type registration: declare module '@tanstack/react-router' { interface Register { router } }"
key_files:
  created:
    - packages/spa/src/lib/pairing.ts
    - packages/spa/src/lib/theme.ts
    - packages/spa/src/components/ThemeChip.tsx
    - packages/spa/src/components/ThemeChip.test.tsx
    - packages/spa/src/components/Header.tsx
    - packages/spa/src/components/AppShell.tsx
    - packages/spa/src/router.tsx
    - packages/spa/src/routes/index.lazy.tsx
    - packages/spa/src/routes/onboarding.lazy.tsx
    - packages/spa/src/routes/pair.lazy.tsx
    - packages/spa/src/routes/settings.lazy.tsx
    - packages/spa/src/routes/help.lazy.tsx
  modified:
    - packages/spa/src/lib/pairing.test.ts (Wave-0 describe.todo stubs replaced with 5 real tests)
    - packages/spa/src/lib/theme.test.ts (Wave-0 describe.todo stubs replaced with 7 real tests)
    - packages/spa/src/main.tsx (replaced App mount with RouterProvider + QueryClientProvider)
    - packages/spa/index.html (removed body hardcoded classes; global.css vars take over)
decisions:
  - "Token format in VALID_PAIRING test changed to D-13 hex-chunked pattern (8 groups of 8 hex chars) — PairingSchema imports TokenSchema which enforces this format; arbitrary hex string would fail safeParse"
  - "JSX.Element return type annotation removed from all three components — TypeScript strict mode with react-jsx transform raises TS2503 for bare JSX namespace; inference is equivalent and cleaner"
  - "Route stub files use createLazyRoute + TODO comment naming receiving plan — Plans 04+05 will replace in-place; stubs are intentional Wave-0 placeholders per Nyquist gate contract"
metrics:
  duration: "18 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 3
  files_created: 12
  files_modified: 4
  commits: 3
---

# Phase 02 Plan 02: SPA Shell + Chrome — Wave 1B Summary

**One-liner:** Wave-0 RED stubs turned GREEN; pairing/theme libs implemented; ThemeChip + Header + AppShell chrome built; TanStack Router 5-route code-based tree wired with SPA-03 beforeLoad pairing guard; lazy chunks emitting from build.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | lib/pairing.ts + lib/theme.ts (Wave-0 stubs GREEN) | 193a31f | packages/spa/src/lib/pairing.ts, theme.ts, pairing.test.ts, theme.test.ts |
| 2 | ThemeChip + Header + AppShell components | 1242125 | packages/spa/src/components/ThemeChip.tsx, ThemeChip.test.tsx, Header.tsx, AppShell.tsx |
| 3 | router.tsx + main.tsx + 5 route stubs | bd763cb | packages/spa/src/router.tsx, main.tsx, index.html, routes/*.lazy.tsx |

## lib/pairing.ts API (Plans 02-03, 02-04 import)

```typescript
// packages/spa/src/lib/pairing.ts
import { PairingSchema, type Pairing } from '@agenticapps/dashboard-shared'

const KEY = 'agentic-dashboard:pairing'  // D-03 namespacing

export function getPairing(): Pairing | null
// Returns null if: localStorage undefined, key missing, JSON corrupt (auto-clears),
// PairingSchema.safeParse fails (auto-clears + warns once via console.warn)

export function setPairing(p: Pairing): void
// Writes JSON.stringify(p) to KEY. Caller is trusted; no re-validation.

export function clearPairing(): void
// Removes KEY from localStorage.
```

## lib/theme.ts API (Plans 02-04, 02-05 import)

```typescript
// packages/spa/src/lib/theme.ts
export type ThemeChoice = 'dark' | 'light' | 'system'
// KEY = 'agentic-dashboard:theme'  (D-03 namespacing)

export function applyTheme(choice: ThemeChoice): void
// Toggles html.dark: dark=true, light=false, system=matchMedia result

export function initTheme(): void
// Call BEFORE createRoot() in main.tsx — prevents first-paint dark/light flash (D-02)
// Already called in main.tsx; Plans 03+ do not need to call it again.

export function useTheme(): { choice: ThemeChoice; setChoice: (c: ThemeChoice) => void }
// useState(readChoice) — defaults to 'dark' (D-02) when localStorage empty
// useEffect[choice]: applyTheme + persist to localStorage
// useEffect[choice='system']: addEventListener('change') + cleanup on choice change
```

## Component File Paths + Key Tokens

| Component | Path | Key classNames |
|-----------|------|----------------|
| `ThemeChip` | `packages/spa/src/components/ThemeChip.tsx` | `h-8 w-8`, `text-[--text-muted]`, `focus-visible:ring-2 focus-visible:ring-[--ring]` |
| `Header` | `packages/spa/src/components/Header.tsx` | `sticky top-0 z-40 flex h-14`, `border-b border-[--border] bg-[--surface]` |
| `AppShell` | `packages/spa/src/components/AppShell.tsx` | `flex min-h-screen flex-col bg-[--bg]`, `id="main"`, `data-slot="banner-mount"` |

**AppShell mount points Plan 04 needs:**
- `<div data-slot="banner-mount" />` — RepairBanner wires here (D-06)
- `<main id="main">` — skip-link target (`href="#main"` in the sr-only skip link)

## Router Route Paths + Lazy Import Targets

| Route | Path | Lazy stub file | Replaced by |
|-------|------|----------------|-------------|
| `indexRoute` | `/` | `src/routes/index.lazy.tsx` | Plan 05 |
| `onboardingRoute` | `/onboarding` | `src/routes/onboarding.lazy.tsx` | Plan 04 |
| `pairRoute` | `/pair` | `src/routes/pair.lazy.tsx` | Plan 04 |
| `settingsRoute` | `/settings` | `src/routes/settings.lazy.tsx` | Plan 05 |
| `helpRoute` | `/help` | `src/routes/help.lazy.tsx` | Plan 05 |

**SPA-03 pairing guard** (T-02-10 mitigation):
```typescript
// indexRoute beforeLoad — runs on EVERY navigation to '/'
const pairing = getPairing()
if (!pairing) {
  throw redirect({ to: '/onboarding' })
}
```

**Type registration** (Pitfall 7 / T-02-11 mitigation):
```typescript
declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
```
This means `Link to=` and `useNavigate({ to })` are type-checked against the registered route tree.

## App.tsx Status

`packages/spa/src/App.tsx` still exists and `App.test.tsx` still tests it directly via `@testing-library/react`. `main.tsx` no longer mounts `App` — it mounts `RouterProvider` instead. `App.test.tsx` remains GREEN because it imports `App` directly without going through the router. **Plan 05 deletes `App.tsx`** after `/settings` and the index route components land and `App.test.tsx` is replaced by router-native tests.

## Known Stubs

All stubs are intentional Wave-0 route placeholders per the Nyquist gate contract:

| File | Stub content | Replaced by |
|------|-------------|-------------|
| `src/routes/index.lazy.tsx` | `<p>TODO Plan 05: index placeholder</p>` | Plan 05 |
| `src/routes/onboarding.lazy.tsx` | `<p>TODO Plan 04: onboarding placeholder</p>` | Plan 04 |
| `src/routes/pair.lazy.tsx` | `<p>TODO Plan 04: pair placeholder</p>` | Plan 04 |
| `src/routes/settings.lazy.tsx` | `<p>TODO Plan 05: settings placeholder</p>` | Plan 05 |
| `src/routes/help.lazy.tsx` | `<p>TODO Plan 05: help placeholder</p>` | Plan 05 |

No unintentional stubs in lib/component files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Token format in test fixture did not match D-13 TokenSchema**
- **Found during:** Task 1 test run
- **Issue:** `VALID_PAIRING.token = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'` — 32 plain hex chars. `TokenSchema` enforces the D-13 format: 8 dash-separated groups of 8 hex chars (`/^[0-9a-f]{8}(-[0-9a-f]{8}){7}$/`). `PairingSchema.safeParse` rejected the token, causing `getPairing()` to return null even after `setPairing()`.
- **Fix:** Changed to `'aabbccdd-11223344-aabbccdd-11223344-aabbccdd-11223344-aabbccdd-11223344'` (valid D-13 format).
- **Files modified:** `packages/spa/src/lib/pairing.test.ts`
- **Commit:** 193a31f

**2. [Rule 1 - Bug] `JSX.Element` return type annotation raised TS2503 (cannot find namespace JSX)**
- **Found during:** Task 2 typecheck
- **Issue:** With `react-jsx` transform and TypeScript strict mode, bare `JSX` namespace is not available without an explicit `import React from 'react'`. The plan's code snippets used `(): JSX.Element` which is invalid in this tsconfig.
- **Fix:** Removed explicit return type annotations from all three components — TypeScript infers `JSX.Element` correctly from the returned JSX without needing the annotation.
- **Files modified:** `packages/spa/src/components/ThemeChip.tsx`, `Header.tsx`, `AppShell.tsx`
- **Commit:** 1242125

## Threat Flags

None. No new network endpoints, auth paths, or trust-boundary-crossing patterns introduced. The localStorage pairing guard (T-02-08, T-02-10, T-02-11 from plan threat model) is implemented and covered by tests.

## Self-Check: PASSED

All 12 created files confirmed present. All 4 modified files confirmed updated. 3 commits confirmed in git log (193a31f, 1242125, bd763cb). Tests: 20 passed, 2 skipped (api.test + dev-perf-smoke — belong to Plans 03+06). Typecheck: clean. Build: 8 JS chunks including 5 lazy route chunks. Anti-pitfall guards: no router-plugin, no routeTree.gen.ts, no tailwind.config in src.
