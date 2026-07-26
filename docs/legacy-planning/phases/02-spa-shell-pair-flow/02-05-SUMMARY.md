---
phase: 02-spa-shell-pair-flow
plan: 05
subsystem: spa-settings-routes
tags: [theme-toggle, manual-pair-form, settings, routes, app-cleanup, tdd, wave-2b]
dependency_graph:
  requires:
    - "02-02 (useTheme, getPairing/setPairing/clearPairing, route stubs)"
    - "02-03 (apiFetch, ApiError, parseOrDrift)"
  provides:
    - "ThemeToggle component — D-03 second toggle location on /settings"
    - "ManualPairForm component — SPA-04 full 8-state paste flow"
    - "settings.lazy route — ManualPairForm + ThemeToggle wired"
    - "index.lazy route — paired-home placeholder with agentUrl interpolation"
    - "help.lazy route — Phase 6 deferral stub"
    - "App.tsx removal — route components are canonical entry point"
    - "TokenSchema exported from @agenticapps/dashboard-shared"
  affects:
    - packages/spa/src/components (2 new components + tests)
    - packages/spa/src/routes (3 stubs replaced with real components)
    - packages/spa/src (App.tsx + App.test.tsx deleted; index.ts barrel emptied)
    - packages/shared/src/index.ts (TokenSchema added to exports)
tech_stack:
  added: []
  patterns:
    - "ManualPairForm: pre-write-then-clearPairing pattern — setPairing before fetch; clearPairing on every failure path (T-02-21/T-02-22)"
    - "ThemeToggle: native fieldset/radio with CSS accent-color — no custom keyboard handler (native arrow-key cycling)"
    - "aria-invalid + aria-describedby + readOnly (not disabled) during submit — preserves SR announcement per UI-SPEC"
    - "role=alert on both error and success form-level regions — announces on DOM insertion"
    - "useNavigate({ to: '/' }) after 800ms via window.setTimeout in useEffect"
key_files:
  created:
    - packages/spa/src/components/ThemeToggle.tsx
    - packages/spa/src/components/ThemeToggle.test.tsx
    - packages/spa/src/components/ManualPairForm.tsx
    - packages/spa/src/components/ManualPairForm.test.tsx
  modified:
    - packages/spa/src/routes/settings.lazy.tsx (stub replaced with ManualPairForm + ThemeToggle)
    - packages/spa/src/routes/index.lazy.tsx (stub replaced with Home placeholder + agentUrl)
    - packages/spa/src/routes/help.lazy.tsx (stub replaced with Help + Phase 6 deferral)
    - packages/spa/src/index.ts (App barrel export removed)
    - packages/shared/src/index.ts (TokenSchema added to exports)
  deleted:
    - packages/spa/src/App.tsx
    - packages/spa/src/App.test.tsx
decisions:
  - "TokenSchema exported from @agenticapps/dashboard-shared — was missing but required by ManualPairForm client-side validation; shared package is the single source of truth per D-13"
  - "Timer test uses waitFor({ timeout: 2000 }) instead of vi.useFakeTimers() — fake timers conflict with @testing-library/react waitFor internals in Vitest; real timer with extended timeout is more reliable"
  - "JSX.Element return type annotations omitted — TS2503 with react-jsx transform (same pattern as Plan 02 executor)"
metrics:
  duration: "15 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 3
  files_created: 4
  files_modified: 5
  files_deleted: 2
  commits: 4
---

# Phase 02 Plan 05: Settings Routes + App Cleanup — Wave 2B Summary

**One-liner:** ThemeToggle fieldset (D-03 second toggle location) + ManualPairForm 8-state SPA-04 paste flow wired to /health; /settings /help / routes replaced with real components; Phase 0 App.tsx removed; 18 new GREEN tests.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | ThemeToggle tri-state radio (D-03, UI-SPEC verbatim) | 8cfadf0 | ThemeToggle.tsx, ThemeToggle.test.tsx |
| 2 | ManualPairForm 8-state machine (SPA-04, UI-SPEC verbatim) | d2823f9 | ManualPairForm.tsx, ManualPairForm.test.tsx, shared/index.ts |
| 3a | Wire /settings + / + /help routes | 3710feb | settings.lazy.tsx, index.lazy.tsx, help.lazy.tsx, index.ts |
| 3b | Remove Phase 0 App.tsx + App.test.tsx | d64a8d1 | (deletions) |

## ManualPairForm State-Machine Diagram

```
idle
 └─ submit attempt with valid fields
     ├─ client validation fails (blur/submit) → stays idle; field-level inline error
     └─ validation passes
         └─ submitting  (setPairing pre-write; inputs readOnly; button "Connecting…")
             ├─ apiFetch ok:false (drift) → clearPairing → error{drift}
             ├─ apiFetch ok:true, data.ok=false → clearPairing → error{daemon-not-ready}
             ├─ ApiError(401) → clearPairing → error{401}
             ├─ TypeError (network) → clearPairing → error{network}
             ├─ other ApiError → clearPairing → error{unknown}
             └─ ok:true, data.ok=true → success
                 └─ useEffect after 800ms → navigate({ to: '/' })
```

## ThemeToggle ↔ ThemeChip Shared Source of Truth

Both components import `useTheme` from `../lib/theme.js`:

- `ThemeChip` (Header): `const { choice, setChoice } = useTheme()` — cycles dark→light→system→dark on click
- `ThemeToggle` (/settings): `const { choice, setChoice } = useTheme()` — radio group selects directly

Both read/write `localStorage` key `agentic-dashboard:theme` (D-03 namespacing). Setting either one immediately reflects in the other because both React trees read from the same `readChoice()` function on mount and write via `localStorage.setItem`.

## ManualPairForm UI-SPEC Verbatim Copy (16 Strings)

| Contract ID | Copy | File:Line |
|-------------|------|-----------|
| section heading | `Manual pair` | ManualPairForm.tsx:114 |
| agent URL label | `Agent URL` | ManualPairForm.tsx:119 |
| agent URL helper | `Loopback or *.ts.net only.` | ManualPairForm.tsx:145 |
| agent URL placeholder | `http://127.0.0.1:5193` | ManualPairForm.tsx:133 |
| agent URL error | `This doesn't look like an agent URL. Use \`http://127.0.0.1:5193\` or your Tailscale \`*.ts.net\` host.` | ManualPairForm.tsx:31 |
| token label | `Token` | ManualPairForm.tsx:155 (label text) |
| token helper | `71 characters, dash-separated. Find it in the agent's startup banner.` | ManualPairForm.tsx:178 |
| token placeholder | `a1b2c3d4-…-z9y8x7w6` | ManualPairForm.tsx:166 |
| token error | `Token format doesn't match. Copy it again from the agent's startup banner.` | ManualPairForm.tsx:38 |
| submit resting | `Save & connect` | ManualPairForm.tsx:200 |
| submit in-flight | `Connecting…` | ManualPairForm.tsx:200 |
| error: network heading | `Couldn't reach the agent` | ManualPairForm.tsx:91 |
| error: network body | `Try \`agentic-dashboard status\` in your terminal.` | ManualPairForm.tsx:92 |
| error: 401 heading | `Token rejected` | ManualPairForm.tsx:85 |
| error: 401 body | `Re-check the token in the agent's startup banner.` | ManualPairForm.tsx:86 |
| error: drift heading | `Schema drift on /health` | ManualPairForm.tsx:65 |
| error: drift body | `Update the agent (\`npx @agenticapps/dashboard-agent@latest\`) and try again.` | ManualPairForm.tsx:66 |
| success heading | `Connected.` | ManualPairForm.tsx:218 |
| success body | `Redirecting…` | ManualPairForm.tsx:219 (via `&hellip;`) |

## App.tsx Removal Note

**Phase 0 placeholder superseded; route components are the canonical entry points.**

`packages/spa/src/App.tsx` was the Phase 0 static fallback shell — it mounted a `HealthResponse` stub directly without any router. `packages/spa/src/main.tsx` stopped mounting `App` in Plan 02 (Task 3) when `RouterProvider` replaced it. App.tsx persisted until this plan as a "mount target that tests can import directly." Plan 05 removes it and its 3 tests; Plan 06 will add router-native smoke coverage.

`packages/spa/src/index.ts` contained `export { App } from './App.js'` — replaced with `export {}` to preserve the file for any tooling that might reference `packages/spa/src/index.ts`, but with no active exports.

## Test Coverage

| File | Test count | Notes |
|------|-----------|-------|
| `ThemeToggle.test.tsx` | 6 | heading, 3 labels, default D-02, localStorage persist, CSS classes |
| `ManualPairForm.test.tsx` | 12 | heading, aria-disabled, valid/blur errors, 4 submit outcomes, readOnly, navigate timer |

**77 total passing tests** (80 with ManualPairForm+ThemeToggle added, minus 3 App.test.tsx removed = 77).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TokenSchema not exported from @agenticapps/dashboard-shared**
- **Found during:** Task 2 first test run — `TypeError: Cannot read properties of undefined (reading 'safeParse')` for `TokenSchema.safeParse`
- **Issue:** Plan specified `import { AgentUrlSchema, TokenSchema, HealthResponseSchema } from '@agenticapps/dashboard-shared'` but `TokenSchema` was missing from `packages/shared/src/index.ts`. Only `AuthFileSchema` was exported from `auth.ts`, not `TokenSchema` itself.
- **Fix:** Added `TokenSchema` to the `AuthFileSchema` export line in `packages/shared/src/index.ts`: `export { AuthFileSchema, TokenSchema } from './schemas/auth.js'`
- **Files modified:** `packages/shared/src/index.ts`
- **Commit:** d2823f9

**2. [Rule 1 - Bug] vi.useFakeTimers() + waitFor caused 5s timeout in navigate timer test**
- **Found during:** Task 2 test run — the "after success state, navigates to / after ~800ms" test timed out
- **Issue:** `vi.useFakeTimers()` + `userEvent.setup({ delay: null })` + `waitFor` deadlock in Vitest/jsdom: `waitFor` uses `setInterval` internally which is also faked, preventing the assertion retry loop from running.
- **Fix:** Removed `vi.useFakeTimers()` and used `waitFor({ timeout: 2000 })` with real timers instead. The 800ms navigation delay is fast enough that real timers complete well within the 2s budget.
- **Files modified:** `packages/spa/src/components/ManualPairForm.test.tsx`
- **Commit:** d2823f9 (same commit; fix applied before commit)

## Known Stubs

No unintentional stubs. The index.lazy route "Multi-project home arrives in Phase 3" and help.lazy "Detailed help arrives in Phase 6" are **intentional phase-deferred placeholders per the plan spec** — not blank or missing content. They are named stubs with correct verbatim copy from UI-SPEC.

## Threat Flags

None. All files are:
- Static UI components (no network endpoints)
- Forms that validate client-side and call the existing `apiFetch` wrapper (threat model already covers apiFetch's boundary in Plan 03)
- Route wrappers with `document.title` side effects only

The plan threat model T-02-21 through T-02-24 mitigations are all implemented:
- T-02-21: `AgentUrlSchema.safeParse` client-side in `canSubmit` + `validateAgentUrl`
- T-02-22: `onSubmit` re-validates even if aria-disabled bypassed
- T-02-23: accepted (symmetric error regions, no timing oracle)
- T-02-24: `grep -r "from './App'"` returns no matches; build exits 0

## Self-Check: PASSED

**Files created confirmed present:**
- `packages/spa/src/components/ThemeToggle.tsx` — FOUND
- `packages/spa/src/components/ThemeToggle.test.tsx` — FOUND
- `packages/spa/src/components/ManualPairForm.tsx` — FOUND
- `packages/spa/src/components/ManualPairForm.test.tsx` — FOUND

**Files deleted confirmed absent:**
- `packages/spa/src/App.tsx` — ABSENT (confirmed)
- `packages/spa/src/App.test.tsx` — ABSENT (confirmed)

**No App imports remaining:** `grep -r "from './App'"` → no matches.

**Commits confirmed in git log:**
- `8cfadf0` feat(02): ThemeToggle tri-state radio — FOUND
- `d2823f9` feat(02): ManualPairForm SPA-04 paste flow — FOUND
- `3710feb` feat(02): wire /settings + / + /help routes — FOUND
- `d64a8d1` chore(02): remove Phase 0 App.tsx + App.test.tsx — FOUND

**Tests:** 77 passed, 1 skipped (dev-perf-smoke — belongs to Plan 06). Typecheck: clean. Build: 5 lazy chunks emitted.
