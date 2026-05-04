---
phase: 02-spa-shell-pair-flow
fixed_at: 2026-05-04T11:42:00Z
review_path: .planning/phases/02-spa-shell-pair-flow/02-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-05-04T11:42:00Z
**Source review:** `.planning/phases/02-spa-shell-pair-flow/02-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (Warnings; Info findings deferred per `fix_scope: critical_warning`)
- Fixed: 4
- Skipped: 0

All four warnings were verified against `02-CONTEXT.md` locked decisions
(D-01..D-09) and `02-RESEARCH.md` documented patterns before applying. None
contradicted a locked D-XX decision; all four were applied. Workspace-wide
`pnpm -r test` (124 SPA tests + 161 agent tests + shared schema tests) and
`pnpm -r typecheck` both pass at the end of this iteration.

## Fixed Issues

### WR-04: `ManualPairForm` submit button uses `aria-disabled` but allows native form submission via Enter key

**Files modified:** `packages/spa/src/components/ManualPairForm.tsx`, `packages/spa/src/components/ManualPairForm.test.tsx`
**Commit:** `eabe0c1`
**Applied fix:** Added native `disabled={!canSubmit || status.kind === 'submitting'}` on the submit button (in addition to existing `aria-disabled`) AND a re-entry guard `if (status.kind === 'submitting') return` at the top of `onSubmit()`. The native attribute blocks pointer + keyboard activation; the guard is defense-in-depth for any state path that could still slip through. Added regression test that drives the form into an in-flight `submitting` state with a controlled promise, focuses the token input, presses Enter, and asserts `apiFetch` was still called only once. The original test `expect(button).toHaveAttribute('aria-disabled', 'true')` continues to pass because we kept `aria-disabled` alongside the new native `disabled`.

### WR-03: CSP `connect-src` is stricter than `AgentUrlSchema` — valid pairings can be blocked in production

**Files modified:** `packages/spa/public/_headers`, `packages/spa/src/__tests__/csp-headers.test.ts`
**Commit:** `a4aed14`
**Applied fix:** Loosened the CSP `connect-src` directive from the literal-port allow-list (`http://localhost:5193 http://127.0.0.1:5193 https://*.ts.net http://*.ts.net`) to a port-wildcard allow-list (`http://localhost:* http://127.0.0.1:* https://*.ts.net:* http://*.ts.net:*`). This matches the flexibility of `AgentUrlSchema` (which accepts any 1–5-digit port) and the daemon's `--port` CLI flag. Verified the user's CLAUDE.md note: this CSP is the SPA-side outbound gate, distinct from the daemon-side CORS lock at `https://dashboard.agenticapps.eu` (prod) + `http://localhost:5174` (dev) — those are different concerns and the CORS lock is unaffected. Added a new `csp-headers.test.ts` that reads `public/_headers` from disk and asserts `connect-src` allows `:*` on loopback + `*.ts.net` AND does NOT pin loopback to a literal port; this protects against a future `_headers` edit silently re-tightening the policy.

### WR-02: `router.tsx` errorComponent re-throws inside React render — risks blank screen on non-VALIDATE_SEARCH errors

**Files modified:** `packages/spa/src/router.tsx`, `packages/spa/src/routes/pair-error.tsx`, `packages/spa/src/routes/pair.test.tsx`
**Commit:** `e4d2593`
**Applied fix:** Replaced `throw error` in the `/pair` route's `errorComponent` with a render of a new `<RouteError/>` component (added to `pair-error.tsx` so router.tsx can eager-import it without pulling in the `pair.lazy` chunk). RouteError shows: `role="alert"` section, "Pairing failed unexpectedly" heading, the error message (or "Unknown error." fallback for unmessaged errors), a "Try again" button wired to TanStack Router's `reset` callback, and an "Open onboarding" escape link. Also extracted the `errorComponent` callback as a named export `pairErrorComponent` so the WR-02 contract is unit-testable without driving a full router. Added 5 regression tests on the live `pairErrorComponent` (VALIDATE_SEARCH → MalformedPairUrl; generic Error → RouteError no-throw; string error; null error) plus 5 component-level tests on `RouteError` itself (alert role, Try-again wiring, omitted-button when no reset, onboarding link, "Unknown error." fallback).

### WR-01: `useTheme()` is per-component state — Header chip and Settings toggle desync on `/settings`

**Files modified:** `packages/spa/src/lib/theme.ts`, `packages/spa/src/lib/theme.sync.test.tsx`
**Commit:** `62ba812`
**Applied fix:** Promoted `choice` from a per-component `useState` to a module-level external store backed by `useSyncExternalStore`. Subscribers receive snapshot updates whenever any consumer calls `setChoice()` (via internal `emit()`) or another tab writes the localStorage key (via a `storage` event listener inside `subscribe()`). All `useTheme()` consumers in a single render tree now re-render in lockstep when any one of them calls `setChoice()`, eliminating the Header `<ThemeChip/>` vs `/settings` `<ThemeToggle/>` desync that was reproducible on the `/settings` route. Cross-tab sync is a free side benefit. The existing 7 theme tests and 4 ThemeChip tests + 6 ThemeToggle tests all continue to pass; new file `theme.sync.test.tsx` adds 3 regression tests: render `<ThemeChip/>` + `<ThemeToggle/>` together, click toggle radio, assert chip aria-label updates; reverse direction (chip click updates radio); two `<ThemeChip/>`s in the same tree stay in sync. Recommendation Option A (useSyncExternalStore + storage event) was chosen over Option B (ThemeProvider context) per user guidance — lighter implementation and avoids touching the existing `App.tsx` provider stack.

## Skipped Issues

_None — all four in-scope warnings were applied cleanly._

---

_Fixed: 2026-05-04T11:42:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
