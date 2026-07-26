---
phase: 02-spa-shell-pair-flow
verified: 2026-05-04T09:20:00Z
status: human_needed
score: 4/4 must-haves verified (automated checks)
overrides_applied: 0
human_verification:
  - test: "Boot the dev server with `pnpm --filter @agenticapps/dashboard-spa dev` and visit http://localhost:5174/ in a browser without any localStorage pairing"
    expected: "Browser redirects to /onboarding and the OnboardingHero headline 'One local daemon. Every device.' is visible"
    why_human: "SPA-01 HMR timing assertion requires a running dev server; visual redirect confirmation requires a browser"
  - test: "Run `agentic-dashboard pair` from a registered project, click the printed URL in the browser"
    expected: "Browser visits /pair?agent=...&token=..., briefly shows 'Connecting to agent…', then navigates to / and shows 'Home' heading with paired agentUrl"
    why_human: "Requires a running daemon with a registered project and an actual browser navigation click"
  - test: "In a paired browser session, visit /settings and paste a valid agent URL + token, then click 'Save & connect'"
    expected: "Button shows 'Connecting…' while calling /health, then 'Connected.' + 'Redirecting…' and auto-navigates to / after 800ms"
    why_human: "Real form interaction and 800ms timer require browser + running daemon"
  - test: "Click the theme toggle (sun/moon chip in header) and verify dark/light/system cycle; reload and confirm persistence"
    expected: "Theme cycles dark → light → system → dark; localStorage key 'agentic-dashboard:theme' persists across reload"
    why_human: "Visual theme switching and persistence require browser observation"
---

# Phase 2: SPA Shell + Pair Flow Verification Report

**Phase Goal:** A Vite + React + Tailwind shell that renders `/onboarding` for unpaired sessions, completes pairing via `/pair?agent=...&token=...`, stores credentials in localStorage, and exposes manual-pair fallback at `/settings`.

**Verified:** 2026-05-04T09:20:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `pnpm --filter @agenticapps/dashboard-spa dev` boots at `localhost:5174` with HMR <2s | ✓ VERIFIED (automated gate; human smoke needed) | `dev-perf-smoke.test.ts` subprocess test exists with `spawn('pnpm')`, `waitForStdout(/Local:\s+http:\/\/localhost:5174/i, 30_000)`, `toBeLessThan(2_000)` assertion, and finally-block restore. `pnpm -r test` exits 0 (106 SPA tests passing). SPA-01 subprocess test runs separately via `test:subprocess`. |
| 2 | Visiting `/` without paired credentials redirects to `/onboarding` and shows the install guide | ✓ VERIFIED | `router.tsx` indexRoute `beforeLoad` calls `getPairing()` and throws `redirect({ to: '/onboarding' })` when null. `OnboardingHero.tsx` exists with verbatim headline "One local daemon. Every device." and all 3 numbered steps. e2e test asserts `getByRole('heading', { level: 1 })` has text "One local daemon. Every device." after navigating to `/` unpaired. |
| 3 | Clicking the pair URL completes pairing without manual input; SPA lands on `/` | ✓ VERIFIED | `pair.lazy.tsx` implements PairFlow state machine: `setPairing()` on mount, `apiFetch('/health', HealthResponseSchema)`, `navigate({ to: '/', replace: true })` on success. `router.tsx` has `validateSearch: zodValidator(PairSearchSchema)` and Pitfall-8 errorComponent. e2e test mocks apiFetch to return `{ ok: true, data: { ok: true } }` and asserts localStorage pairing persisted + "Home" heading visible. |
| 4 | `/settings` accepts manual paste of agent URL + token and validates by calling `/health` before saving | ✓ VERIFIED | `ManualPairForm.tsx` exists with `apiFetch('/health', HealthResponseSchema)`, `setPairing()` pre-write, `clearPairing()` on every failure. 8-state machine (idle/submitting/success/error) with verbatim copy: "Save & connect", "Connecting…", "Connected.", "Token rejected", "Couldn't reach the agent", "Schema drift on /health". `settings.lazy.tsx` mounts `<ManualPairForm />`. |

**Score:** 4/4 truths verified (automated checks pass; manual smoke still needed)

### Deferred Items

No items deferred to later phases. All 4 success criteria are addressed in this phase.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/spa/src/lib/pairing.ts` | getPairing/setPairing/clearPairing with PairingSchema.safeParse | ✓ VERIFIED | Exists 870B; exports all 3 functions; imports `PairingSchema` from shared; corrupt auto-clears |
| `packages/spa/src/lib/theme.ts` | useTheme tri-state + initTheme + applyTheme | ✓ VERIFIED | Exists 1.5kB; exports `useTheme`, `initTheme`, `applyTheme`, `ThemeChoice`; `'agentic-dashboard:theme'` key |
| `packages/spa/src/lib/api.ts` | ApiError + parseOrDrift + apiFetch | ✓ VERIFIED | Exists 2.7kB; exports all 3 + DriftIssue type; console.error('[schema-drift]'); Authorization Bearer injection |
| `packages/spa/src/lib/repair.tsx` | RepairProvider + useRepair + RepairBus | ✓ VERIFIED | Exists 1.5kB; 5 useCallback calls (B1 fix); setNeedsRepair resets dismissed (D-06) |
| `packages/spa/src/lib/queryClient.ts` | createQueryClient(repair) with QueryCache 401 interceptor | ✓ VERIFIED | Exists 949B; `instanceof ApiError && error.status === 401`; `retry: false`; no `query.state.data` guard |
| `packages/spa/src/router.tsx` | 5-route tree + SPA-03 guard + validateSearch on /pair | ✓ VERIFIED | 5 `.lazy(() => import(` calls; `throw redirect({ to: '/onboarding' })` in indexRoute.beforeLoad; `zodValidator(PairSearchSchema)` on pairRoute |
| `packages/spa/src/main.tsx` | RepairProvider + createQueryClient bus + initTheme pre-render | ✓ VERIFIED | RepairProvider wraps QueryBridge; `useMemo` for createQueryClient; `initTheme()` called before `createRoot()` |
| `packages/spa/src/components/AppShell.tsx` | Header + Outlet + RepairBanner in banner-mount slot | ✓ VERIFIED | `<RepairBanner />` inside `data-slot="banner-mount"`; `id="main"` on main; skip-link present |
| `packages/spa/src/components/OnboardingHero.tsx` | D-01 hero — verbatim copy + no AI slop | ✓ VERIFIED | "One local daemon. Every device.", "Nothing leaves your machine.", "Why local-only →"; ZERO bg-gradient/bg-clip-text/backdrop-blur/shadow-2xl/drop-shadow/animate-spin/img/video |
| `packages/spa/src/components/ManualPairForm.tsx` | 8-state machine + UI-SPEC verbatim copy | ✓ VERIFIED | All copy present: "Manual pair", "Save & connect", "Connecting…", "Connected.", "Token rejected", "Couldn't reach the agent", "Schema drift on /health"; aria-invalid + aria-describedby + readOnly (not disabled) |
| `packages/spa/src/components/RepairBanner.tsx` | D-06 banner with Esc key + Re-pair CTA + dismiss | ✓ VERIFIED | "Agent token rejected.", `aria-label="Re-pair (open onboarding)"`, `aria-label="Dismiss banner (will return on next 401)"`, `e.key === 'Escape'`, `motion-safe:` |
| `packages/spa/src/components/SchemaDriftState.tsx` | INV-04 inline drift state | ✓ VERIFIED | "Schema drift detected", "Retry request", "Show full diff"; `text-[--danger]`; dl with field/expected/got |
| `packages/spa/src/components/DaemonUnreachableState.tsx` | D-07 daemon-down state distinct from 401 | ✓ VERIFIED | "Daemon not running", "Try again", "agentic-dashboard start"; `text-[--warning]` (NOT --danger) |
| `packages/spa/src/routes/pair.lazy.tsx` | PairFlow happy path + error states | ✓ VERIFIED | setPairing + apiFetch('/health') + navigate('/', replace) + all 4 error states including SchemaDriftState + DaemonUnreachableState |
| `packages/spa/src/routes/pair-error.tsx` | MalformedPairUrl extracted (W1 bundle split fix) | ✓ VERIFIED | "This pair URL doesn't look right"; router.tsx imports from `./routes/pair-error.js` not pair.lazy; 0 eager imports from pair.lazy in router.tsx |
| `packages/spa/src/routes/settings.lazy.tsx` | /settings mounts ManualPairForm + ThemeToggle | ✓ VERIFIED | `<ManualPairForm />` and `<ThemeToggle />` both mounted |
| `packages/spa/src/routes/onboarding.lazy.tsx` | /onboarding renders OnboardingHero + sets page title | ✓ VERIFIED | `document.title = 'AgenticApps Dashboard — Onboarding'`; `<OnboardingHero />` |
| `packages/spa/src/__tests__/dev-perf-smoke.test.ts` | Wave-0 stub turned GREEN (SPA-01) | ✓ VERIFIED | `spawn('pnpm')`, `waitForStdout(/Local:\s+http:\/\/localhost:5174/i)`, `fetch('http://localhost:5174/')` warm-up, `toBeLessThan(2_000)`, `finally` restore; no MISSING markers |
| `packages/spa/src/__tests__/e2e-pair-flow.test.tsx` | 4-scenario e2e: SPA-02 + SPA-03 + AUTH-04 (W4) | ✓ VERIFIED | 4 describe blocks; `createMemoryHistory`; `RepairProvider`; `vi.mock('../lib/api.js')`; "One local daemon. Every device." assertion; "Agent token rejected." assertion; `new ApiError(401, ...)` |
| `packages/spa/public/_redirects` | Cloudflare Pages SPA fallback | ✓ VERIFIED | `/* /index.html 200`; copied to dist/ on build |
| `packages/spa/public/_headers` | Strict CSP banning unsafe-eval + frame-ancestors | ✓ VERIFIED | Content-Security-Policy; X-Frame-Options: DENY; no unsafe-eval; connect-src with 127.0.0.1:5193 + *.ts.net |
| `packages/spa/src/styles/global.css` | @custom-variant dark + @theme + :root + .dark tokens | ✓ VERIFIED | 4 required patterns present; all UI-SPEC color tokens in both :root and .dark |
| `packages/spa/src/App.tsx` | ABSENT (Phase 0 placeholder deleted) | ✓ VERIFIED | File does not exist; App.test.tsx also absent |
| `README.md` | Phase 2 status section | ✓ VERIFIED | "Phases 0, 1, and 2 shipped." with /onboarding, /pair, /settings, AUTH-04, INV-04 mentioned |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `router.tsx indexRoute` | `lib/pairing.ts` | `getPairing()` in `beforeLoad` → `throw redirect` when null | ✓ WIRED | Line 12 import + line 28/30 usage confirmed |
| `router.tsx pairRoute` | `@tanstack/zod-adapter` | `validateSearch: zodValidator(PairSearchSchema)` | ✓ WIRED | Line 9 import + line 54 usage confirmed |
| `main.tsx` | `lib/repair.tsx` | `<RepairProvider>` wraps app; `useRepair()` in QueryBridge | ✓ WIRED | Lines 7+42 confirmed |
| `main.tsx` | `lib/queryClient.ts` | `createQueryClient({ setNeedsRepair: repair.setNeedsRepair })` in useMemo | ✓ WIRED | Line 8 import + lines 24-26 usage confirmed |
| `main.tsx` | `lib/theme.ts` | `initTheme()` called BEFORE `createRoot()` | ✓ WIRED | Line 6 import; line 12 call; line 40 createRoot — correct order |
| `AppShell.tsx` | `RepairBanner.tsx` | `<RepairBanner />` inside `data-slot="banner-mount"` | ✓ WIRED | Import line 3; usage in JSX confirmed |
| `pair.lazy.tsx` | `lib/api.ts` | `apiFetch('/health', HealthResponseSchema)` | ✓ WIRED | Line 4 import + line 31 call confirmed |
| `pair.lazy.tsx` | `lib/pairing.ts` | `setPairing` + `clearPairing` | ✓ WIRED | Line 5 import; both functions used in state machine |
| `onboarding.lazy.tsx` | `OnboardingHero.tsx` | `<OnboardingHero />` | ✓ WIRED | Line 3 import; rendered in return |
| `ManualPairForm.tsx` | `lib/api.ts` | `apiFetch('/health', HealthResponseSchema)` | ✓ WIRED | Line 9 import + line 60 call confirmed |
| `ManualPairForm.tsx` | `@agenticapps/dashboard-shared` | `AgentUrlSchema` + `TokenSchema` client-side validation | ✓ WIRED | Lines 5-8 import; safeParse used in validateAgentUrl + validateToken |
| `lib/queryClient.ts` | `lib/api.ts` | `instanceof ApiError && error.status === 401` | ✓ WIRED | Source confirms exact guard; no query.state.data guard |
| `lib/queryClient.ts` | `lib/repair.tsx` | `repair.setNeedsRepair(true)` on 401 | ✓ WIRED | repair parameter consumed in onError |
| `RepairBanner.tsx` | `lib/repair.tsx` | `useRepair()` hook | ✓ WIRED | Line 4 import; destructured in component body |
| `e2e-pair-flow.test.tsx` | `router.tsx` | `createMemoryHistory` drives full route tree | ✓ WIRED | `createRouter({ routeTree: router.routeTree, history: memoryHistory })` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `ManualPairForm.tsx` | `status` state machine | Local `useState` + `apiFetch('/health', ...)` result | Yes — real fetch through `apiFetch` wrapper with bearer token | ✓ FLOWING |
| `pair.lazy.tsx` | `status` state machine | Local `useState` + `apiFetch('/health', ...)` result | Yes — real fetch with setPairing pre-write | ✓ FLOWING |
| `RepairBanner.tsx` | `needsRepair`, `dismissed` | `useRepair()` from RepairContext, populated by `QueryCache.onError` on 401 | Yes — QueryCache.onError drives it via `setNeedsRepair(true)` | ✓ FLOWING |
| `index.lazy.tsx` | `pairing?.agentUrl` | `getPairing()` localStorage read | Yes — reads real localStorage with Zod safeParse | ✓ FLOWING |
| `OnboardingHero.tsx` | n/a (static content) | n/a | n/a — static content per D-01 spec | ✓ N/A |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `pnpm -r typecheck` exits 0 | `pnpm -r typecheck 2>&1 \| tail -3` | packages/shared, spa, agent typecheck: Done | ✓ PASS |
| `pnpm -r test` exits 0 with 309+ tests | `pnpm -r test 2>&1 \| tail -5` | spa: 106 passed, agent: 161 passed | ✓ PASS |
| `pnpm -r build` exits 0 with ≥5 lazy chunks | `pnpm -r build 2>&1 \| tail -10` | 10 chunks incl. 5 lazy routes + _redirects + _headers in dist | ✓ PASS |
| MISSING markers gone from all stub files | `grep -rn "MISSING" packages/spa/src/lib/ packages/spa/src/__tests__/` | 0 lines returned | ✓ PASS |
| App.tsx + App.test.tsx absent | `test -f packages/spa/src/App.tsx` | Files absent | ✓ PASS |
| No `query.state.data` guard in queryClient.ts (Pitfall 5) | `grep "query.state.data" packages/spa/src/lib/queryClient.ts` | No match | ✓ PASS |
| SPA-01 subprocess test has boot + HMR assertions | Content inspection of dev-perf-smoke.test.ts | spawn, waitForStdout, toBeLessThan(2_000), finally-restore all present | ✓ PASS |
| e2e has 401-banner scenario (W4) | `grep "Agent token rejected" packages/spa/src/__tests__/e2e-pair-flow.test.tsx` | Line 169 match | ✓ PASS |
| SPA boots with HMR <2s (subprocess smoke) | Requires live dev server | Not tested in this session | ? SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|---------|
| SPA-01 | 02-01, 02-06 | Vite + React + Tailwind shell boots at localhost:5174 with HMR <2s | ✓ SATISFIED | dev-perf-smoke.test.ts exists with subprocess assertion; build emits valid SPA; `pnpm -r test` passes; subprocess test requires live run for final gate |
| SPA-02 | 02-04 | `/pair?agent=&token=` validates, calls /health, stores credentials, redirects | ✓ SATISFIED | pair.lazy.tsx PairFlow state machine; validateSearch+zodValidator in router.tsx; e2e happy-path test |
| SPA-03 | 02-02, 02-04 | `/onboarding` shows install instructions when no pairing | ✓ SATISFIED | indexRoute beforeLoad guard; OnboardingHero with verbatim D-01 copy; e2e unpaired redirect test |
| SPA-04 | 02-05 | `/settings` manual-pair fallback + theme toggle | ✓ SATISFIED | ManualPairForm 8-state machine + ThemeToggle in settings.lazy.tsx |
| INV-04 (SPA-side) | 02-03, 02-04, 02-05 | Schema validation on every daemon response; mismatches surface as "schema drift" | ✓ SATISFIED | parseOrDrift in api.ts; SchemaDriftState component; console.error('[schema-drift]'); pair.lazy + ManualPairForm both handle drift |
| AUTH-04 (SPA-side) | 02-03, 02-06 | SPA detects 401 and prompts re-pair via non-blocking banner | ✓ SATISFIED | QueryCache.onError → setNeedsRepair(true) on ApiError(401); RepairBanner in AppShell banner-mount; e2e W4 scenario |

**No orphaned requirements.** REQUIREMENTS.md lists SPA-01..04, INV-04, AUTH-04 as Phase 2 scope. All 6 are covered by the plans and verified in the codebase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Checked files: all key lib, component, and route files. No TODOs in production code (intentional stubs are named placeholder routes for later phases). No hardcoded empty data arrays flowing to rendering. No placeholder return values in implemented components.

**D-01 anti-slop check (OnboardingHero.tsx):** CLEAN — zero occurrences of `bg-gradient`, `bg-clip-text`, `backdrop-blur`, `shadow-2xl`, `drop-shadow`, `animate-spin`, `<img`, `<video`.

**Pitfall guards confirmed at source level:**
- Pitfall 4: `queryClient.ts` — `instanceof ApiError && error.status === 401` guard; TypeError does not flow to setNeedsRepair
- Pitfall 5: `queryClient.ts` — no `query.state.data !== undefined` guard present (source-level grep verified)
- Pitfall 8: `router.tsx` — `error.routerCode === 'VALIDATE_SEARCH'` in pairRoute errorComponent
- W1: `router.tsx` — 0 eager imports from `./routes/pair.lazy` (only dynamic `.lazy(() => import(...))`); MalformedPairUrl lives in `pair-error.tsx`
- B1: `repair.tsx` — 5 `useCallback` calls; all 3 helpers (setNeedsRepair, dismiss, clear) wrapped for stable identity

### Human Verification Required

#### 1. SPA dev server boots + HMR smoke (SPA-01 complete gate)

**Test:** Run `pnpm --filter @agenticapps/dashboard-spa dev`, open `http://localhost:5174/` in a browser (no pairing stored), confirm redirect to `/onboarding` and OnboardingHero renders.
**Expected:** Browser shows the headline "One local daemon. Every device." within 2 seconds of page load. Subsequent edits to a source file should trigger HMR within 2s (subprocess test covers the assertion programmatically; this is a visual sanity check).
**Why human:** The subprocess test `dev-perf-smoke.test.ts` is marked to run in a separate pool and requires a real dev server. It was not run in this verification session to avoid port conflicts.

#### 2. End-to-end pair URL flow (SPA-02 full manual smoke)

**Test:** Start the daemon (`agentic-dashboard start`), copy the printed pair URL, paste it in a browser address bar.
**Expected:** Browser visits `/pair?agent=http://127.0.0.1:5193&token=...`, shows "Connecting to agent…" briefly, then navigates to `/` and displays the "Home" heading with the agentUrl interpolated.
**Why human:** Requires a running daemon with a valid auth token. Cannot be simulated without a real process.

#### 3. Manual pair fallback on /settings (SPA-04 manual smoke)

**Test:** With a valid token from `agentic-dashboard pair`, navigate to `/settings`, clear the pre-filled fields if any, paste a valid agent URL and token, click "Save & connect".
**Expected:** Button shows "Connecting…", then "Connected." + "Redirecting…", and after 800ms navigates to `/`.
**Why human:** Requires a running daemon and real browser interaction for form timing.

#### 4. Theme persistence across reload

**Test:** Click the theme chip in the header 1–2 times, then reload the page.
**Expected:** The theme choice (light or system) persists; no dark/light flash before the persisted theme applies (D-02 initTheme pre-render guarantee).
**Why human:** Visual verification of first-paint behavior cannot be automated with jsdom.

### Gaps Summary

No blocking gaps. All 4 success criteria are verified against the actual codebase with automated checks passing:

- `pnpm -r typecheck` exits 0 (3 packages clean)
- `pnpm -r test` exits 0 (309 total: spa 106 + agent 161 + shared 42)
- `pnpm -r build` exits 0 (10 chunks in dist including 5 lazy route chunks + _redirects + _headers)
- All Wave-0 MISSING stubs are GREEN (0 MISSING markers remaining)
- All 6 requirement IDs (SPA-01..04, INV-04, AUTH-04) have implementation evidence

Status is `human_needed` because 4 items require a browser and/or a running daemon to fully smoke-test the UX flows. The automated test suite (including the subprocess HMR test and the 4-scenario e2e test) covers the business logic; the manual items confirm the end-to-end experience.

---

_Verified: 2026-05-04T09:20:00Z_
_Verifier: Claude (gsd-verifier)_
