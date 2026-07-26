# Phase 2: SPA Shell + Pair Flow — Research

**Researched:** 2026-05-03
**Domain:** Vite + React 18 SPA, TanStack Router v1.x, Tailwind v4 dark-mode-class, TanStack Query v5 global error handling, Zod-backed schema-drift detection, localStorage pairing record
**Confidence:** HIGH (every load-bearing decision traces to verified docs / pinned package versions / existing repo state)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

The following decisions are LOCKED. Do not propose alternatives. Plan-the-execution-of-them, not whether-to-do-them.

- **D-01 (`/onboarding` design):** hero + numbered steps + tone treatment. Headline "One local daemon. Every device.", value prop "Nothing leaves your machine.", numbered Install/Start/Pair steps with `lucide-react` copy-icon affordance per command, "Why local-only →" disclosure aside. **No gradients, no hero illustrations, no animated terminal demos** (those tank `impeccable:critique` anti-slop pillars).
- **D-02 (default theme):** **dark**. Tailwind v4 dark-mode-class config — `dark` class on `<html>`. CSS variables (`--bg`, `--surface`, `--text`, `--accent`) so the same components render either theme.
- **D-03 (theme toggle):** in **two places** — sun/moon icon chip in page header (always visible) + labeled toggle on `/settings`. Persisted at `localStorage["agentic-dashboard:theme"]` with values `"dark" | "light" | "system"`. Default `"dark"`. The third value honors `prefers-color-scheme`.
- **D-04 (router):** **TanStack Router** (`@tanstack/react-router`). Type-safe Zod-validated search params for `/pair?agent=…&token=…`, native pairing with `@tanstack/react-query` (already a workspace dep), no FS-routing magic required.
- **D-05 (code splitting):** **per-route lazy splitting** via TanStack Router's `.lazy()` (or `createLazyRoute` in a sibling file). One chunk per route: `/`, `/onboarding`, `/pair`, `/settings`, `/help` (stub).
- **D-06 (401 UX):** persistent **dismissible top banner** — `⚠ Agent token rejected. [Re-pair] [×]`. Banner does NOT block the page; whatever was last rendered stays visible underneath. Clicking [Re-pair] navigates to `/onboarding` with a state flag pre-positioning at the pair step. Cleared on next 200 from `/health`. `[×]` only suppresses for current session.
- **D-07 (no auto-retry on 401):** token mismatch is deterministic; retrying just adds latency. ECONNREFUSED is a separate "Daemon not running" panel state — different from 401 — that prompts `agentic-dashboard start`. Don't conflate.
- **D-08 (schema-drift UX):** **inline panel state**, scoped to the failing query/panel. Other panels keep rendering. Implementation: every consumer wraps the JSON parse in `safeParse()` against the corresponding shared schema; on `success: false`, that panel renders `<SchemaDriftState />` instead of its normal content. Failed Zod issue tree is `console.error`'d for DevTools follow-up. **No global modal, no whole-app freeze.**
- **D-09 (drift state content):** heading "Schema drift detected", one-paragraph explanation, **first failing field path + expected type + actual value** (e.g. `phaseProgress.evidenceCount — expected: number — got: undefined`). `[Show full diff]` disclosure reveals the full Zod issue tree in a `<details>`. `[Reload]` retries the underlying TanStack Query.

### Claude's Discretion

These are the discretion areas — research has investigated them and the recommendations below are documented; the planner can finalize after `/gsd-ui-phase`.

- **Test strategy:** vitest + `@testing-library/react` + jsdom (already configured) for unit + component tests. **One subprocess test** spawning `pnpm --filter @agenticapps/dashboard-spa dev`, waiting for the listening line, hitting `http://localhost:5174/`, asserting redirect to `/onboarding`. Playwright + visual regression deferred to Phase 6 polish (POLISH-04).
- **localStorage shape:** single Zod schema in `packages/shared/src/schemas/pairing.ts` — `PairingSchema = z.object({ agentUrl: z.string().url(), token: TokenSchema /* re-use D-13 regex */, pairedAt: z.string().datetime() })`. Parsed on every read; corrupt or missing → "unpaired" → route `/onboarding`. Schema in `shared/` so future daemon-side use gets the same shape.
- **Pair-URL agent-host validation regex:** match Phase 1's daemon-side D-19 (`^[a-zA-Z0-9.-]+\.ts\.net$`) for the Tailscale path; combined regex on the full URL: `/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/` OR `/^https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+\.ts\.net(:\d+)?$/i`. Both http and https accepted on Tailscale form (daemon serves HTTP; `tailscale serve` users may proxy to HTTPS).
- **Manual-pair flow:** block save until `/health` returns 200 AND `HealthResponseSchema.safeParse(body).success === true`. Inline error states for: regex-rejected agent URL, regex-rejected token, network failure, 401, schema drift on `/health`. Save button disabled until both client-side regex validations pass; loading state on submit.
- **Header chrome:** minimal — product name on left, sun/moon theme chip + ⚙ settings icon on right. No breadcrumbs (TanStack Router's `matchRoute` handles "you are here"). No project switcher in Phase 2.
- **Pair-URL host:** SPA accepts pages.dev path locally during dev (Vite serves `localhost:5174/pair?...`). Daemon already prints the pages.dev URL per Phase 1 D-21; SPA needs no change for the Phase 6 custom-domain flip.
- **Hot-reload verification (SPA-01):** `dev-perf-smoke.test.ts` subprocess test: spawn dev server, wait for "Local: http://localhost:5174/", touch a source file, listen on stdout for `hmr update` log line within 2000ms.

### Deferred Ideas (OUT OF SCOPE)

Don't research these. They appear in later phases.

- **Confused-deputy "option C" banner-confirmed nonce** for register flow — Phase 3 (HOME-06).
- **Multi-project home content (cards, filters, search, sort, register modal)** — Phase 3 (HOME-01..06).
- **`/projects/{id}` three-column view** — Phases 4 + 5.
- **`/settings/projects` register/unregister/rename/tag UI** — Phase 3.
- **`/settings/integrations` configure-to-enable cards** — Phase 5 (HEALTH-05).
- **Keyboard shortcuts (`R`, `?`, `/`)** — Phase 6 (POLISH-01).
- **`impeccable:critique` ≥ 90 hard gate** — Phase 6 (POLISH-04). Phase 2 sets the visual baseline this gate measures, but gating is Phase 6.
- **Playwright / visual-regression tests** — Phase 6.
- **`/help` route content** — Phase 2 stubs only the route + placeholder; content is Phase 6 (POLISH-06).
- **PWA / service-worker / installable** — out of v1 scope (no spec call).
- **i18n / RTL** — single-user, English-only by spec.
- **Custom domain `dashboard.agenticapps.eu` flip** — Phase 6 daemon-constants change.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **SPA-01** | Vite + React + Tailwind shell builds and serves at `localhost:5174` with hot-reload < 2s | Existing scaffold (vite.config.ts) already binds 5174 strictPort. Vite HMR is sub-100ms by default; subprocess `dev-perf-smoke.test.ts` listens for `hmr update` log line. See Code Examples and Validation Architecture. |
| **SPA-02** | `/pair?agent=...&token=...` validates agent URL pattern, calls `/health`, stores credentials, redirects to `/` | TanStack Router `validateSearch` + `zodValidator` short-circuits malformed URLs at routing layer. `useNavigate({ to: '/' })` after successful `/health` call + `setPairing()`. See Pattern 2 (TanStack Router validateSearch). |
| **SPA-03** | `/onboarding` shows install instructions when no pairing exists in localStorage | Root route's `beforeLoad` reads `getPairing()`; `throw redirect({ to: '/onboarding' })` if absent. See Pattern 1 (Root beforeLoad guard). |
| **SPA-04** | `/settings` provides manual-pair fallback (paste agent URL + token) and theme toggle | Manual pair form imports `TokenSchema` from `@agenticapps/dashboard-shared`, validates URL regex client-side, submits via `apiHealthCheck` wrapped in `safeParse(HealthResponseSchema, body)` before persisting. Theme toggle calls `setTheme` from `useTheme()` hook (D-03). |
| **AUTH-04** (SPA-side) | 401 detection → re-pair flow | `QueryCache({ onError })` global handler flips `needsRepair: true` Zustand-or-context atom; `<RepairBanner />` subscribes. See Pattern 6 (QueryCache 401 interceptor). |
| **INV-04** (SPA-side) | Schema-drift surfaces inline | `parseOrDrift(schema, json)` helper returns `{ ok: true, data } \| { ok: false, drift: DriftIssue[] }`. Panels render `<SchemaDriftState />` on `ok: false`. See Pattern 7 (Zod safeParse drift wrapper). |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

These directives MUST be honored by the plan. Treat with same authority as locked D-XX decisions.

- **No native dependencies in `packages/agent`** — N/A to SPA package, but no native deps in `packages/spa` either (preserves clean static-site build for CF Pages).
- **Read-only on project filesystems** — N/A directly to SPA; SPA never reads project FS, only daemon does.
- **Bearer-token auth on every route** — SPA injects `Authorization: Bearer ${token}` header on every fetch. CORS lock to `https://agenticapps-dashboard.pages.dev` (prod) and `http://localhost:5174` (dev) — SPA dev port matches.
- **Optional integrations stay optional** — N/A to Phase 2 (no integration panels yet); the SPA shell must not crash if Sentry/Linear/Infisical envs are absent on the daemon (already handled daemon-side).
- **No Cloudflare Workers / Pages Functions in v1** — Phase 2 ships pure-static SPA. No `_worker.js`, no Pages Functions in `functions/`. Verify with build output.
- **Dashboard's own UI must pass `impeccable:critique` ≥ 90** — Phase 6 gate. Phase 2 sets baseline. D-01's anti-slop guidance (no gradients, no hero illustrations, no animated demos) is what bridges the gap.
- **TDD on every panel** — Each route component, each schema-drift fallback, each pair-flow validator gets a failing test first.
- **Two-stage review before merging any phase** — gstack `/review` (Stage 1) + `superpowers:requesting-code-review` (Stage 2). Stages do not collapse.
- **AgenticApps Workflow hooks** (from `~/.claude/CLAUDE.md`):
  - Pre-phase: frontend files → `superpowers:brainstorming` for UI/UX alternatives, start dev server, `/browse` preview, user picks direction. **`/gsd-ui-phase` runs between this research and planning.**
  - Per-plan: `tdd="true"` tasks → strict red-green-refactor. Frontend component changes → start dev server, `/browse` screenshot before commit.
  - Post-phase: `/review` on phase diff; `/cso` if phase touches auth/storage/API/LLM (Phase 2 touches auth via localStorage); `/qa` if dev server is reachable.
- **Feature branches always; never commit directly to main.**

## Summary

Phase 2 ships a **focused, type-safe SPA shell** that owns the unpaired→paired transition without ever crashing on daemon hiccups. The architecture is a thin **router + query-cache + schema-validating fetch wrapper** stack:

1. **TanStack Router** owns 5 routes (`/`, `/onboarding`, `/pair`, `/settings`, `/help`-stub) with code-based route definitions plus `.lazy()` per non-critical route. The `/pair` route uses **`zodValidator` from `@tanstack/zod-adapter`** to validate `agent` + `token` search params at the routing layer; malformed URLs hit `errorComponent` (rendering `<MalformedPairUrl />`) instead of crashing the pair component.
2. **TanStack Query** owns all daemon HTTP via a **shared `apiFetch` wrapper** that injects the bearer token and runs `safeParse()` against a per-call response schema. A **global `QueryCache({ onError })` callback** detects 401 and flips a `needsRepair` boolean in a tiny `RepairContext` that `<RepairBanner />` subscribes to.
3. **Tailwind v4** dark-mode-class via `@custom-variant dark (&:where(.dark, .dark *));` in `global.css` (already imported `tailwindcss`); a `useTheme()` hook persists `"dark" | "light" | "system"` to `localStorage["agentic-dashboard:theme"]` and toggles the `dark` class on `<html>` accordingly. CSS variables (`--bg`, `--surface`, `--text`, `--accent`) drive themed components.
4. **Schema-drift** surfaces as a **per-panel inline state** via a `parseOrDrift(schema, json)` helper. The whole app keeps rendering when one panel drifts.

**Primary recommendation:** Use **code-based** TanStack Router definitions (not file-based) for 5 routes — simpler config, fewer moving parts (no `@tanstack/router-plugin` Vite integration needed), avoids the "where does my route file live" debate. Use the `.lazy()` method (D-05) on each non-critical route's definition. Add **exactly one** new production dep (`@tanstack/react-router`) plus exactly one dev dep adapter (`@tanstack/zod-adapter`) — the workspace catalog grows by two entries.

## Standard Stack

### Core (production deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tanstack/react-router` | `^1.169.1` | Type-safe router with Zod-validated search params, code-splitting, native TanStack Query pairing | [VERIFIED: `npm view @tanstack/react-router version` → 1.169.1, published 2026-05-01] D-04 locked it; only modern router with first-class search-param Zod validation. |
| `@tanstack/zod-adapter` | `^1.169.x` (auto-tracks) | `zodValidator()` and `fallback()` helpers for `validateSearch` | [VERIFIED: TanStack Router docs reference `@tanstack/zod-adapter` as the canonical Zod integration]. Auto-tracks the same major as `react-router`. |
| `@tanstack/react-query` | `^5.100.9` (catalog: 5.100.8) | Already in workspace; powers all daemon fetches + global QueryCache `onError` for 401 detection | [VERIFIED: `npm view @tanstack/react-query version` → 5.100.9; catalog at 5.100.8 is one patch behind, fine to leave or bump]. Already reachable in `packages/spa/package.json`. |
| `zod` | `^3.25.0` (catalog) | Schema-drift detection (`safeParse`), pair-URL validators, localStorage shape | [VERIFIED: workspace catalog is `zod: ^3.25.0`]. Phase 1 schemas already use Zod 3.25. **Do not bump to 4.x in this phase** — that's a workspace-wide migration with breaking changes; out of scope. |
| `lucide-react` | `^1.14.0` (catalog) | Already pinned. Used for copy-icon (D-01), sun/moon (D-03), x-icon (D-06 dismiss). | [VERIFIED: catalog: `lucide-react: ^1.14.0`]. |
| `tailwindcss` | `^4.2.4` (catalog) | Dark-mode-class via `@custom-variant`; theming via `@theme` block | [VERIFIED: `npm view tailwindcss version` → 4.2.4; catalog matches]. |
| `@tailwindcss/vite` | `^4.2.4` (catalog) | Vite integration | Already in `packages/spa/devDependencies`. |
| `react`, `react-dom` | `^18.3.1` (catalog) | UI runtime | Already pinned. **Do not bump to React 19** in this phase. |

### Supporting (already present)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vite` | `^8.0.10` (catalog) | Dev server, HMR, build | All dev/build flows. |
| `vitest` | `^4.1.5` (catalog) | Unit + component tests | Every component, every helper. |
| `@testing-library/react` | `^16.3.2` (catalog) | Component test rendering | Route components, form components, drift state. |
| `jsdom` | `^29.1.1` (catalog) | DOM env for vitest | Configured in `vite.config.ts` test block (or `vitest.config.ts` if added). |
| `@testing-library/jest-dom` | `^6.4.0` (catalog) | DOM matchers (`toBeInTheDocument`, etc.) | Already wired in `test-setup.ts`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/react-router` | React Router v7 | RR7's data router is fine but search-param validation is hand-rolled, not Zod-native. **D-04 locks TanStack Router.** Listed only so the planner doesn't re-litigate. |
| Code-based routes | File-based routes via `@tanstack/router-plugin` | File-based requires the Vite plugin and a `routes/` directory convention. For 5 routes, that's a heavier config than `createRouter({ routeTree })` in code. **Recommendation: code-based for simplicity.** Re-evaluate at 15+ routes. |
| Global Zustand for `RepairContext` | React `Context` + `useState` | A 1-state-bit context is simpler than adding Zustand. The Repair state is one boolean + one dismiss timestamp — no reducer needed. **Recommendation: plain Context.** |
| `localStorage` for pairing | `IndexedDB` / `cookie` | spec line 222 explicitly says localStorage. Cookies would leak the token to subdomains. IndexedDB is overkill for one record. |
| Custom theme provider | `next-themes` | `next-themes` is React-19-ready and handles SSR `<html>` mutation cleanly, but it's another dep. The theme logic here is ~30 lines (read localStorage → set class → listen for `prefers-color-scheme` change). **Recommendation: hand-roll `useTheme()`.** |

**Installation (planner adds to pnpm catalog and to `packages/spa/package.json`):**

```bash
# Adjust workspace catalog first (in pnpm-workspace.yaml under `catalog:`):
#   '@tanstack/react-router': ^1.169.1
#   '@tanstack/zod-adapter':  ^1.169.1
# Then in packages/spa/package.json `dependencies`:
#   "@tanstack/react-router": "catalog:"
# And in packages/spa/package.json `devDependencies`:
#   "@tanstack/zod-adapter":  "catalog:"
pnpm install
```

**Version verification:** Verified 2026-05-03 via `npm view`. `@tanstack/react-router@1.169.1` published 2026-05-01 (literally two days old at research time — this is the bleeding-edge stable). Companion `@tanstack/router-plugin@1.167.32` exists if file-based routing is reconsidered, but per recommendation above is **NOT installed** in Phase 2. `@tanstack/zod-adapter` ships in the same release train.

## Architecture Patterns

### Recommended Project Structure

```
packages/spa/src/
├── main.tsx                    # React root + RouterProvider + QueryClientProvider + ThemeProvider
├── router.tsx                  # createRouter, routeTree, root + child routes
├── App.tsx                     # Layout shell (header chrome + <Outlet/> + RepairBanner)
├── routes/
│   ├── root.tsx                # rootRoute with beforeLoad pairing guard
│   ├── index.lazy.tsx          # / (placeholder home; Phase 3 fills it)
│   ├── onboarding.lazy.tsx     # /onboarding (D-01 hero+steps)
│   ├── pair.lazy.tsx           # /pair?agent=&token= (validateSearch via zodValidator)
│   ├── settings.lazy.tsx       # /settings (manual pair + theme toggle)
│   └── help.lazy.tsx           # /help stub
├── components/
│   ├── RepairBanner.tsx        # D-06 top banner, mounted in App.tsx
│   ├── SchemaDriftState.tsx    # D-08/D-09 inline drift fallback
│   ├── DaemonNotRunning.tsx    # D-07 ECONNREFUSED state (separate from 401)
│   ├── ThemeToggle.tsx         # D-03 sun/moon chip + tri-state radio on /settings
│   ├── ManualPairForm.tsx      # /settings paste form
│   ├── OnboardingHero.tsx      # D-01 hero + numbered-steps composition
│   └── CodeBlock.tsx           # D-01 copy-affordance command snippet
├── lib/
│   ├── api.ts                  # apiFetch wrapper (bearer + safeParse), parseOrDrift helper
│   ├── pairing.ts              # getPairing, setPairing, clearPairing, validateAgentUrl
│   ├── theme.ts                # useTheme hook, applyTheme, ThemeProvider
│   ├── repair.ts               # RepairContext + useRepairState
│   └── queryClient.ts          # createQueryClient factory with QueryCache onError → repair
├── styles/
│   └── global.css              # @import "tailwindcss" + @custom-variant dark + @theme block + CSS vars
└── test-setup.ts               # already exists; reused
```

### Pattern 1: Root Route with Pairing Guard

**What:** SPA-03 requires that visiting `/` without a pairing redirects to `/onboarding`. TanStack Router's `beforeLoad` is the right hook (runs before component mounts; can `throw redirect({ to: '/onboarding' })` synchronously).

**When to use:** Every route except `/onboarding`, `/pair`, `/help`. `/settings` is reachable when unpaired (so user can manually pair) — but `/` redirects.

**Code:**

```typescript
// Source: TanStack Router docs — search-params guide + beforeLoad guard pattern
//   verified at https://tanstack.com/router/latest/docs/guide/search-params (2026-05-03)
import { createRootRoute, redirect, Outlet } from '@tanstack/react-router'
import { getPairing } from '../lib/pairing'

export const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    const pairing = getPairing() // returns null if missing or invalid
    if (!pairing) {
      throw redirect({ to: '/onboarding' })
    }
  },
}).lazy(() => import('./routes/index.lazy').then((m) => m.Route))
```

### Pattern 2: TanStack Router validateSearch with Zod

**What:** SPA-02 requires that `/pair?agent=&token=` reject malformed URLs at the routing layer. `zodValidator` from `@tanstack/zod-adapter` short-circuits unparseable search params via `errorComponent` instead of crashing the pair component with `undefined`.

**Code:**

```typescript
// Source: TanStack Router search-params guide — verified 2026-05-03
//   https://tanstack.com/router/latest/docs/guide/search-params
import { z } from 'zod'
import { createRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { TokenSchema } from '@agenticapps/dashboard-shared'

// Strict client-side regex matches Phase 1 D-13 token format AND D-19 hostname rules.
const PairSearchSchema = z.object({
  agent: z.string().url().refine(validateAgentUrl, {
    message: 'agent URL must be loopback or *.ts.net',
  }),
  token: TokenSchema, // re-uses Phase 1 D-13 regex from packages/shared
})

export const pairRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pair',
  validateSearch: zodValidator(PairSearchSchema),
  // If validation throws, error.routerCode === 'VALIDATE_SEARCH'
  errorComponent: ({ error }) =>
    error.routerCode === 'VALIDATE_SEARCH' ? (
      <MalformedPairUrl />
    ) : (
      <ErrorBoundary error={error} />
    ),
}).lazy(() => import('./routes/pair.lazy').then((m) => m.Route))

// In pair.lazy.tsx:
export const Route = createLazyRoute('/pair')({
  component: PairFlow,
})

function PairFlow() {
  const { agent, token } = pairRoute.useSearch()
  // ...call /health, setPairing, navigate('/')
}
```

### Pattern 3: lazyRouteComponent / .lazy() (D-05)

**What:** D-05 requires per-route lazy splitting. Two ways exist; the `.lazy()` method on the route definition (in `router.tsx`) plus a sibling `*.lazy.tsx` file with `createLazyRoute` is the simplest code-based pattern.

**Code:**

```typescript
// Source: TanStack Router code-splitting guide — verified 2026-05-03
//   https://tanstack.com/router/latest/docs/guide/code-splitting
//
// Critical route metadata stays in router.tsx; component code lives in a *.lazy.tsx file.

// router.tsx
const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
}).lazy(() => import('./routes/onboarding.lazy').then((m) => m.Route))

// routes/onboarding.lazy.tsx
import { createLazyRoute } from '@tanstack/react-router'
import { OnboardingHero } from '../components/OnboardingHero'

export const Route = createLazyRoute('/onboarding')({
  component: () => <OnboardingHero />,
})
```

### Pattern 4: Tailwind v4 Dark Mode Class

**What:** D-02/D-03 require `dark` class on `<html>` (not `prefers-color-scheme` strategy). Tailwind v4 uses a `@custom-variant` declaration in CSS (no JS config file needed).

**Code:**

```css
/* packages/spa/src/styles/global.css — Source: Tailwind v4 dark-mode docs (verified 2026-05-03) */
@import "tailwindcss";

/* D-02: class-based dark mode. Activates `dark:*` utilities when html.dark is set. */
@custom-variant dark (&:where(.dark, .dark *));

/* D-02 / D-03: theming via CSS variables. Same components render either theme. */
@theme {
  --color-brand: oklch(0.65 0.18 260);
}

:root {
  --bg: oklch(0.98 0 0);
  --surface: oklch(0.96 0 0);
  --text: oklch(0.18 0 0);
  --accent: var(--color-brand);
}

.dark {
  --bg: oklch(0.16 0 0);
  --surface: oklch(0.20 0 0);
  --text: oklch(0.96 0 0);
  --accent: var(--color-brand);
}

html, body, #root { height: 100%; }
body { background: var(--bg); color: var(--text); }
```

### Pattern 5: useTheme() Hook (D-03)

**What:** Tri-state `"dark" | "light" | "system"`. Default `"dark"` (D-02). Persisted at `localStorage["agentic-dashboard:theme"]`. `"system"` honors `window.matchMedia('(prefers-color-scheme: dark)')`.

**Code:**

```typescript
// Source: Tailwind v4 docs (toggle pattern) + standard React idiom for matchMedia.
//   verified at https://tailwindcss.com/docs/dark-mode (2026-05-03)
import { useEffect, useState, useSyncExternalStore } from 'react'

export type ThemeChoice = 'dark' | 'light' | 'system'
const KEY = 'agentic-dashboard:theme'

function readChoice(): ThemeChoice {
  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
  return raw === 'light' || raw === 'system' ? raw : 'dark' // D-02 default
}

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  const wantsDark =
    choice === 'dark' ||
    (choice === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', wantsDark)
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice)
  useEffect(() => {
    applyTheme(choice)
    localStorage.setItem(KEY, choice)
  }, [choice])
  // Re-apply when system preference changes and choice is 'system'
  useEffect(() => {
    if (choice !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [choice])
  return { choice, setChoice }
}
```

### Pattern 6: Global QueryCache 401 Interceptor (D-06, D-07, AUTH-04)

**What:** Detect 401 from any TanStack Query call and flip `needsRepair: true`. Banner subscribes. Don't auto-retry (D-07). Don't break the app — `<RepairBanner />` overlays, page underneath stays rendered.

**Code:**

```typescript
// Source: tkdodo blog "React Query Error Handling" (canonical) + GitHub Discussion #6484.
//   verified 2026-05-03.
//
// QueryCache callbacks fire for ALL queries — initial fetches AND background refetches.
// We rely on a custom error class so we know error.status without parsing strings.
import { QueryCache, QueryClient } from '@tanstack/react-query'

export class ApiError extends Error {
  constructor(public status: number, public requestId: string | undefined, message: string) {
    super(message)
  }
}

export type RepairBus = { needsRepair: boolean; setNeedsRepair: (v: boolean) => void }

export function createQueryClient(repair: RepairBus): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) {
          repair.setNeedsRepair(true) // D-06: banner appears next render
        }
        // D-07: NO retry. queryClient.defaultOptions.queries.retry: false handles that.
        // ECONNREFUSED is a TypeError("Failed to fetch") — handled per-panel
        // as <DaemonNotRunning /> (D-07), NOT here. Don't conflate.
      },
    }),
    defaultOptions: {
      queries: {
        retry: false,                  // D-07: no auto-retry on 401 OR network error
        refetchOnWindowFocus: false,   // tame the noise; explicit refetch only
        staleTime: 5 * 1000,           // home-page polling cadence (Phase 3 sets 5s)
      },
    },
  })
}
```

### Pattern 7: apiFetch + parseOrDrift (INV-04 SPA-side)

**What:** Wraps every daemon call. Injects bearer token from `getPairing()`, runs `safeParse()` against the per-call response schema, returns a tagged union for the caller. Throws `ApiError(401, ...)` so the QueryCache `onError` fires.

**Code:**

```typescript
// Source: composition of standard fetch + Zod safeParse (verified at https://zod.dev/api?id=safeparse).
import type { z } from 'zod'
import { ErrorResponseSchema } from '@agenticapps/dashboard-shared'
import { getPairing } from './pairing'
import { ApiError } from './queryClient'

export type DriftIssue = {
  /** First failing field path joined by `.` — D-09 surface */
  path: string
  expected: string
  got: string
  /** Full Zod issue tree, available behind [Show full diff] disclosure */
  issues: z.ZodIssue[]
}

export type ParseOrDrift<T> =
  | { ok: true; data: T }
  | { ok: false; drift: DriftIssue }

export function parseOrDrift<S extends z.ZodTypeAny>(
  schema: S,
  json: unknown,
): ParseOrDrift<z.infer<S>> {
  const result = schema.safeParse(json)
  if (result.success) return { ok: true, data: result.data }
  // Log full tree to console.error per D-08 for DevTools follow-up
  console.error('[schema-drift]', result.error.issues)
  const first = result.error.issues[0]
  return {
    ok: false,
    drift: {
      path: first.path.length ? first.path.join('.') : '(root)',
      expected: 'expected' in first ? String(first.expected) : first.code,
      got: 'received' in first ? String(first.received) : 'unknown',
      issues: result.error.issues,
    },
  }
}

export async function apiFetch<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
  init: RequestInit = {},
): Promise<ParseOrDrift<z.infer<S>>> {
  const pairing = getPairing()
  if (!pairing) throw new ApiError(401, undefined, 'unpaired')
  const url = `${pairing.agentUrl.replace(/\/$/, '')}${path}`
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${pairing.token}`)
  const res = await fetch(url, { ...init, headers })
  if (res.status === 401) {
    // Try to extract daemon's requestId for better diagnostics
    let requestId: string | undefined
    try {
      const body = await res.clone().json()
      const parsed = ErrorResponseSchema.safeParse(body)
      if (parsed.success) requestId = parsed.data.requestId
    } catch { /* ignore */ }
    throw new ApiError(401, requestId, 'unauthorized')
  }
  if (!res.ok) {
    throw new ApiError(res.status, undefined, `HTTP ${res.status}`)
  }
  const json = await res.json()
  return parseOrDrift(schema, json)
}
```

### Pattern 8: Pairing Schema + localStorage (Claude's Discretion → recommended)

**What:** Single Zod schema in `packages/shared/src/schemas/pairing.ts`. Strict regex on URL (matches Phase 1 D-19 hostname rule + loopback). Token re-uses Phase 1 D-13 regex.

**Code:**

```typescript
// packages/shared/src/schemas/pairing.ts (NEW — exported from src/index.ts)
import { z } from 'zod'
import { TokenSchema } from './auth.js'

/**
 * Pair-URL agent host validator.
 * Matches:
 *   http://localhost(:PORT)?
 *   http://127.0.0.1(:PORT)?
 *   http(s)?://<host>.<...>.ts.net(:PORT)?         (Phase 1 D-19 hostname pattern)
 *
 * Rejects: bare IPs other than 127.0.0.1, lookalike domains (e.g. ts.net.attacker.com),
 *          schemes other than http/https.
 */
const AGENT_URL_REGEX =
  /^(?:http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?|https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+\.ts\.net(?::\d{1,5})?)$/i

export const AgentUrlSchema = z.string().regex(AGENT_URL_REGEX, {
  message: 'agent URL must be loopback or *.ts.net',
})

export const PairingSchema = z.object({
  agentUrl: AgentUrlSchema,
  token: TokenSchema,
  pairedAt: z.string().datetime(),
})
export type Pairing = z.infer<typeof PairingSchema>
```

```typescript
// packages/spa/src/lib/pairing.ts
import { PairingSchema, type Pairing } from '@agenticapps/dashboard-shared'

const KEY = 'agentic-dashboard:pairing'

export function getPairing(): Pairing | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    const parsed = PairingSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      console.warn('[pairing] corrupt; clearing')
      localStorage.removeItem(KEY)
      return null
    }
    return parsed.data
  } catch {
    localStorage.removeItem(KEY)
    return null
  }
}

export function setPairing(p: Pairing): void {
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function clearPairing(): void {
  localStorage.removeItem(KEY)
}
```

### Anti-Patterns to Avoid

- **Storing the token in `sessionStorage` or a cookie** — `sessionStorage` doesn't survive a page reload, breaking the "land on /, see your projects" UX. Cookies leak the token to subdomains and would conflict with CORS-without-credentials (the SPA fetches with `credentials: 'omit'` per CORS lock).
- **Auto-refreshing the page on 401** — D-07 forbids this; it loses unsaved state and the banner UX is the spec's prescribed behavior.
- **Using `window.location.href = '/onboarding'` instead of `useNavigate`** — full-page reloads defeat code splitting and wipe React state. Use TanStack Router's `redirect()` (in `beforeLoad`) or `useNavigate({ to })` (in components).
- **Hardcoding daemon origin in fetch calls** — `apiFetch` always reads from `getPairing().agentUrl`; never `'http://127.0.0.1:5193'` literal. Tailscale and dev rebinds break otherwise.
- **Globally mutating `document.documentElement.classList` in render functions** — must happen in `useEffect` (D-03 / Pattern 5). React 18 StrictMode double-invokes render; classList mutations there cause flicker.
- **Calling `localStorage.getItem` during render** — fine in event handlers and `useEffect`, but during render it forces synchronous I/O. Use `useSyncExternalStore` if you need reactive subscription, otherwise hoist to a state init function.
- **A "global" `<SchemaDriftState />` modal** — D-08 explicitly forbids whole-app freeze. Drift is **per-panel**.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe search-param parsing | Hand-rolled `new URLSearchParams(location.search)` + `try/catch` | `validateSearch: zodValidator(schema)` on the route | Errors surface at the routing layer with a typed `routerCode === 'VALIDATE_SEARCH'`, not as `undefined.split is not a function` deep in the component. |
| Global error/401 detection | Per-component `try/catch` ladders | `QueryCache({ onError })` global handler | Centralizes auth-flow logic; covers all queries past, present, future. |
| Code-splitting routes | Manual `React.lazy` + `<Suspense>` per route | TanStack Router `.lazy()` / `createLazyRoute` | Router knows how to defer the chunk, suspend correctly during navigation, and surface errors via `errorComponent`. |
| Theme persistence + system-pref watcher | DIY localStorage + `matchMedia` listener forgotten on unmount | `useTheme()` hook (Pattern 5) — small but tested | The bug-prone bit is the cleanup for `matchMedia` listener; centralizing in a hook is cheap. |
| Daemon-response validation | Type assertions + `(json as HealthResponse).version` | `parseOrDrift(HealthResponseSchema, json)` | Schema drift becomes a panel state instead of a runtime crash. INV-04 hard requirement. |
| URL host validation | `try { new URL(s); ... }` + custom hostname check | Zod schema with regex (`AgentUrlSchema`) | Single source of truth in `packages/shared/`; SPA + daemon agree. Test surface is one regex, not two. |
| Pair-URL build/parse | `String concat + encodeURIComponent` ad hoc | Daemon already builds it (Phase 1 banner.ts); SPA only reads `searchParams` via TanStack Router | The build side is locked in Phase 1; SPA only consumes. |

**Key insight:** Phase 1 spent enormous effort getting schemas, regexes, and error shapes right (D-13 token, D-16 outbound parse, D-19 hostname, D-23 realpath). Phase 2's job is to **reuse those primitives**, not redefine them. Every regex and schema should be imported from `@agenticapps/dashboard-shared`, never hand-rolled in SPA-land.

## Common Pitfalls

### Pitfall 1: TanStack Router Code-Based vs File-Based Confusion

**What goes wrong:** Mid-implementation, a developer thinks "let me just add `@tanstack/router-plugin` and use file-based routes" — then routes silently disappear because the plugin needs `routesDirectory`, `generatedRouteTree`, and a `routeTree.gen.ts` import in main.tsx.

**Why it happens:** TanStack Router docs default to file-based examples; code-based gets less prominent treatment.

**How to avoid:** Lock the decision in the plan. Use **code-based** with `createRouter({ routeTree })` where `routeTree = rootRoute.addChildren([...])`. Don't install `@tanstack/router-plugin`. Don't `import { routeTree } from './routeTree.gen'`.

**Warning signs:** Anyone touching `vite.config.ts` to add a TanStack Router plugin, or a `routeTree.gen.ts` file appearing in src/.

### Pitfall 2: Tailwind v4 `darkMode: 'class'` Config (Doesn't Apply)

**What goes wrong:** Developer adds `darkMode: 'class'` in a `tailwind.config.{js,ts}` and `dark:bg-neutral-900` doesn't activate. Tailwind v4 doesn't have a JS config file by default.

**Why it happens:** v3-era muscle memory. Tailwind v4 config moved to CSS via `@theme`, `@custom-variant`, `@source`, etc.

**How to avoid:** **Only** edit `global.css`. Add `@custom-variant dark (&:where(.dark, .dark *));` (Pattern 4). Do **not** create a `tailwind.config.{js,ts}` unless you have a v3-only plugin to integrate (we don't).

**Warning signs:** A new `tailwind.config.ts` appears, or `darkMode: 'class'` in any `*.config.*`.

### Pitfall 3: Reading localStorage During SSR / on First Render

**What goes wrong:** The SPA never SSRs (Cloudflare Pages serves it as static), but vitest's `jsdom` env can race. More importantly, `useState(() => readChoice())` on first render in StrictMode is fine; calling `localStorage.getItem` *outside* a hook (in module scope) breaks tests on environments without DOM.

**Why it happens:** `import.meta.env.SSR` is always false here, but the `typeof localStorage !== 'undefined'` guard is still good hygiene for tests using `node` env (without jsdom).

**How to avoid:** Always guard `typeof localStorage !== 'undefined'` in helpers, or use `useSyncExternalStore` with a server snapshot of `null`/default.

### Pitfall 4: QueryCache `onError` Fires for ECONNREFUSED Too

**What goes wrong:** Network failure (daemon not running) shows up as `TypeError("Failed to fetch")`. If the QueryCache `onError` flips `needsRepair: true` for **every** error, the user sees "Re-pair" prompts when the daemon is just stopped.

**Why it happens:** `fetch` doesn't distinguish HTTP errors from network errors — both throw or return based on shape.

**How to avoid:** The `apiFetch` wrapper throws `ApiError(status, ...)` only on real HTTP responses; network errors propagate as the original `TypeError`. The QueryCache `onError` checks `error instanceof ApiError && error.status === 401` (Pattern 6). ECONNREFUSED hits the panel's error path and renders `<DaemonNotRunning />` — D-07's separate state.

**Warning signs:** Repair banner appearing on `pkill -f agentic-dashboard`. Test for this with a fetch-mocked `TypeError`.

### Pitfall 5: tk-dodo's "Background-Refetch-Only" Toast Pattern

**What goes wrong:** Some teams adapt tk-dodo's `query.state.data !== undefined` check (only show toast on background refetch). For 401 → re-pair, this is wrong — first 401 is the most important signal, and there might never be a successful prior fetch.

**Why it happens:** Cargo-culting from the tk-dodo blog without thinking about the use case.

**How to avoid:** **Don't** copy tk-dodo's `if (query.state.data !== undefined)` guard for 401 detection. The repair banner should fire on the FIRST 401, not just background-refetch 401s.

**Warning signs:** A `query.state.data !== undefined` check inside the QueryCache `onError`.

### Pitfall 6: SPA Pair-URL Regex Drifts From Daemon's

**What goes wrong:** SPA accepts URLs the daemon's banner regex would never produce, OR rejects URLs the daemon prints. Result: paste-from-banner manual-pair flow breaks for some Tailscale tailnet shapes.

**Why it happens:** Two regexes, two repos. (Spec line 222 says `*.tail-*.ts.net`; Phase 1 D-19 relaxed it to `^[a-zA-Z0-9.-]+\.ts\.net$` because user tailnet names can be custom strings, not just `tail-XXX`.)

**How to avoid:** Define the regex **once** in `packages/shared/src/schemas/pairing.ts` (`AgentUrlSchema` — Pattern 8). Phase 1's daemon-side regex stays as-is (it validates the DNSName from `tailscale status`). The SPA-side `AgentUrlSchema` validates the full URL the daemon prints; the two patterns must agree on the hostname structure.

**Warning signs:** Any inline regex literal in `pair.lazy.tsx` or `ManualPairForm.tsx`.

### Pitfall 7: lazy import path resolution

**What goes wrong:** `.lazy(() => import('./routes/pair.lazy'))` works in dev (Vite resolves relative paths) but breaks in production build because TypeScript+Node ESM expect `.js` (or full extension). Or vice versa: full extension breaks Vite's plugin order.

**Why it happens:** ESM strictness vs Vite-flexibility mismatch.

**How to avoid:** Match the existing convention in `packages/spa/src/main.tsx` which imports `./App.js` (compiled extension). For TanStack Router lazy imports, the `import('./routes/pair.lazy')` form works without an extension under Vite. Keep both forms — `import { App } from './App.js'` for static + `() => import('./routes/pair.lazy')` for dynamic — and let `tsc --noEmit` catch errors.

**Warning signs:** ESLint `import/extensions` complaining; build succeeds in dev but fails CI.

### Pitfall 8: `validateSearch` Throwing Synchronously vs `errorComponent`

**What goes wrong:** Developer assumes a malformed `/pair?agent=...&token=invalid` URL just renders `<MalformedPairUrl />` — but the search throws into `errorComponent`, which crashes if not provided. The default error component is fine for dev but ugly for users.

**Why it happens:** Doc snippets often omit `errorComponent`.

**How to avoid:** Always pair `validateSearch: zodValidator(...)` with an `errorComponent` that branches on `error.routerCode === 'VALIDATE_SEARCH'` (Pattern 2).

### Pitfall 9: Vite HMR <2s Test Flakiness

**What goes wrong:** Test boots dev server, edits a file, asserts HMR within 2s. But tests on CI under load see 3-5s due to esbuild pre-bundle warmup on cold cache.

**Why it happens:** Vite's first request triggers dependency pre-bundling. HMR is sub-100ms once warmed up.

**How to avoid:** Warm the dev server first — `await fetch('http://localhost:5174/')` and wait for response before starting the timer. Then edit + listen on stdout for `hmr update` log line.

**Warning signs:** Test passes locally on a fast Mac, fails on GitHub Actions Linux runners.

## Runtime State Inventory

> Phase 2 is greenfield SPA build, NOT a rename/refactor/migration. **This section is included for completeness in case the planner reads it as a checklist** — but every category answers "None / N/A".

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 2 introduces `localStorage["agentic-dashboard:pairing"]` and `localStorage["agentic-dashboard:theme"]` for the first time. No existing user data to migrate. | None |
| Live service config | None — SPA is static; no live service stores its config. Cloudflare Pages serves the build artifact. | None |
| OS-registered state | None — SPA runs in-browser. No OS-level processes. | None |
| Secrets/env vars | The bearer token lives in `localStorage` per spec. No env vars introduced this phase. (`VITE_*` vars are not used in Phase 2; reserved for Phase 3+ if a feature flag is needed.) | None |
| Build artifacts | New `dist/` chunks for code-split routes (one per route). Existing `dist/` from Phase 0 is overwritten on next `pnpm build`. CF Pages preview deploys handle this automatically. | None — `pnpm -r build` is idempotent. |

**Nothing found in any category — verified by:** Phase 0/1 created `~/.agenticapps/dashboard/` (daemon) and `packages/spa/dist/` (CF Pages); both are owned by other phases. Phase 2 adds two new localStorage keys (both new), no migration needed.

## Code Examples

The patterns above (1-8) are the load-bearing code examples. Three more useful snippets:

### `/pair` happy path (component side)

```typescript
// packages/spa/src/routes/pair.lazy.tsx
import { createLazyRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { HealthResponseSchema } from '@agenticapps/dashboard-shared'
import { apiFetch } from '../lib/api'
import { setPairing } from '../lib/pairing'
import { ApiError } from '../lib/queryClient'

export const Route = createLazyRoute('/pair')({
  component: PairFlow,
})

function PairFlow() {
  const { agent, token } = Route.useSearch() // typed via PairSearchSchema
  const navigate = useNavigate()
  const [status, setStatus] = useState<'pairing' | 'error' | 'drift'>('pairing')
  const [errorDetail, setErrorDetail] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Pre-write pairing so apiFetch can use the bearer; we'll clear on failure.
      setPairing({ agentUrl: agent, token, pairedAt: new Date().toISOString() })
      try {
        const result = await apiFetch('/health', HealthResponseSchema)
        if (cancelled) return
        if (!result.ok) {
          setStatus('drift')
          setErrorDetail(`${result.drift.path}: expected ${result.drift.expected}, got ${result.drift.got}`)
          return
        }
        if (!result.data.ok) {
          setStatus('error')
          setErrorDetail('Daemon returned ok: false')
          return
        }
        navigate({ to: '/', replace: true })
      } catch (err) {
        if (cancelled) return
        // 401 → bad token; ECONNREFUSED → daemon down. Both surface here.
        clearPairing() // wipe the just-written bad pairing
        setStatus('error')
        setErrorDetail(err instanceof ApiError ? `${err.status} ${err.message}` : 'Daemon unreachable')
      }
    })()
    return () => { cancelled = true }
  }, [agent, token, navigate])

  if (status === 'pairing') return <p>Pairing…</p>
  if (status === 'drift') return <SchemaDriftState issues={…} />
  return <PairFailure detail={errorDetail} />
}
```

### `<RepairBanner />` (D-06)

```typescript
// packages/spa/src/components/RepairBanner.tsx
import { X, AlertTriangle } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useRepair } from '../lib/repair'

export function RepairBanner() {
  const { needsRepair, dismissed, dismiss, clear } = useRepair()
  const navigate = useNavigate()
  if (!needsRepair || dismissed) return null
  return (
    <div role="alert" className="sticky top-0 z-50 flex items-center justify-between gap-2 bg-amber-500/10 border-b border-amber-500/30 px-4 py-2">
      <span className="flex items-center gap-2 text-sm text-amber-200">
        <AlertTriangle className="size-4" aria-hidden />
        Agent token rejected.
      </span>
      <span className="flex items-center gap-2">
        <button
          onClick={() => { clear(); navigate({ to: '/onboarding', search: { fromRepair: true } }) }}
          className="rounded border border-amber-500/40 px-2 py-1 text-xs hover:bg-amber-500/20"
        >
          Re-pair
        </button>
        <button onClick={dismiss} aria-label="Dismiss" className="rounded p-1 hover:bg-amber-500/20">
          <X className="size-4" />
        </button>
      </span>
    </div>
  )
}
```

### Subprocess test for SPA-01 (hot-reload < 2s)

```typescript
// packages/spa/src/__tests__/dev-perf-smoke.test.ts (NEW; subprocess)
import { spawn, type ChildProcess } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, afterAll } from 'vitest'

const SCRATCH = resolve(__dirname, '..', 'main.tsx') // touched, not modified semantically
let proc: ChildProcess | undefined

afterAll(() => proc?.kill('SIGTERM'))

describe('SPA-01: dev server hot-reload', () => {
  it('boots and HMR-updates in < 2s after a file edit', async () => {
    proc = spawn('pnpm', ['--filter', '@agenticapps/dashboard-spa', 'dev'], { stdio: 'pipe' })
    // wait for "Local:" listening line
    await waitForStdout(proc, /Local:\s+http:\/\/localhost:5174/, 30_000)
    // warm the server: fetch / once so esbuild pre-bundle completes
    await fetch('http://localhost:5174/').catch(() => {})

    // Touch the file to trigger HMR
    const original = readFileSync(SCRATCH, 'utf-8')
    const start = Date.now()
    writeFileSync(SCRATCH, original + `\n// hmr-trigger ${Date.now()}\n`)
    try {
      await waitForStdout(proc, /hmr update/i, 2_000)
      expect(Date.now() - start).toBeLessThan(2_000)
    } finally {
      writeFileSync(SCRATCH, original) // always restore
    }
  })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Router v6 + manual search-param parsing | TanStack Router v1 + `zodValidator` | TanStack Router 1.x stable since 2024 | Type-safe params; routing-layer validation; ~50% less component-side code. |
| Tailwind v3 + `tailwind.config.js` `darkMode: 'class'` | Tailwind v4 + `@custom-variant dark` in CSS | Tailwind v4 GA (early 2025) | No JS config file; CSS-first. **Workspace already on v4.** |
| TanStack Query v4 + `setQueryDefaults({ onError })` | Query v5 + `new QueryCache({ onError })` constructor option | Query v5 (mid-2024) | onError moved off `defaultOptions.queries` to QueryCache; cleaner separation. **Workspace already on v5.** |
| Zod 3 with `safeParse` | Zod 4 with `safeParse` (same API) | Zod 4 GA mid-2025 | Workspace catalog locks `zod: ^3.25.0` for now; do NOT bump in Phase 2 (cross-package migration). |
| React 18 | React 19 (use() hook, new compiler) | React 19 GA late 2024 | **Workspace stays on React 18.** No upgrade in Phase 2. |
| Manual lazy `<Suspense>` boundaries | Router `.lazy()` per route | TanStack Router design from day one | Fewer Suspense pitfalls; router owns code-split chunk loading. |

**Deprecated/outdated:**

- **Tailwind v3 `darkMode: 'class'` JS config** — replaced by `@custom-variant dark` in CSS. Don't write a `tailwind.config.ts` for the SPA.
- **React Router v6's `useSearchParams()` for typed search** — TanStack Router supersedes for this use case.
- **TanStack Query v4 `setQueryDefaults({ onError })`** — moved to `QueryCache({ onError })`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@tanstack/zod-adapter` ships in lock-step with `@tanstack/react-router` (`^1.169.x`). | Standard Stack | LOW — if missing/lagging, fall back to manual `validateSearch: (search) => Schema.parse(search)`. Plan adds fallback note. |
| A2 | TanStack Router `error.routerCode === 'VALIDATE_SEARCH'` is stable (per WebFetch of search-params guide). | Pattern 2 | LOW — if the const moves, swap to `instanceof SearchValidationError`-style check. |
| A3 | Tailwind v4 `@custom-variant dark (&:where(.dark, .dark *));` is the canonical class-based dark-mode setup. | Pattern 4 | LOW — verified at https://tailwindcss.com/docs/dark-mode (2026-05-03). |
| A4 | Vite dev-server stdout emits a deterministic `hmr update` log line on file edit. | Pattern 9 / SPA-01 test | MEDIUM — tk-dodo and many community examples reference this; not formally documented in Vite HMR API page. Fallback: open a WebSocket to `/__vite_hmr` and listen for the `update` message (more code, more reliable). |
| A5 | The pair-URL agent host regex (Pattern 8 `AGENT_URL_REGEX`) covers all real Tailscale tailnet name shapes. | Pattern 8 / Pitfall 6 | MEDIUM — real-world tailnets include `tail<8hex>.ts.net`, custom names like `acme-prod.ts.net`, and `<orgs>.ts.net`. Phase 1 D-19 used `^[a-zA-Z0-9.-]+\.ts\.net$` which is broader; the SPA regex narrows to ≥1 dot before `.ts.net` to require a subdomain. **Confirm with user during planning** whether single-label tailnet hostnames (e.g. `acme.ts.net`) need to validate. |
| A6 | TanStack Query v5 `QueryCache({ onError })` callback signature is `(error: unknown, query: Query) => void`. | Pattern 6 | LOW — verified via tk-dodo blog and verified via TanStack Query docs (QueryCache page returned 404 but signature is well-known and re-asserted in tk-dodo and Discussion #6484). |
| A7 | The SPA's pair-URL host (`agenticapps-dashboard.pages.dev/pair?...` printed by daemon banner) routes correctly to `/pair?agent=&token=` when the SPA is served from that origin AND from `localhost:5174` (dev). | Pattern 2 | LOW — Vite's history-API fallback makes this work; Cloudflare Pages serves SPAs with `_redirects` (rewrite to `/index.html`). Verify that `_redirects` is set up in Phase 0; if not, add it in Phase 2. **TODO: planner should add a Wave 0 task to verify `packages/spa/public/_redirects` exists with `/* /index.html 200`.** |

**Confirmation needed before execution:** A5 (Tailscale tailnet regex shape) and A7 (CF Pages SPA fallback). Both are LOW-MEDIUM risk; planner should add verification tasks rather than assumptions.

## Open Questions (RESOLVED)

> All five questions identified during research were resolved during planning. Each item below records the resolution and the implementing reference so the checker can trace decision → execution.

1. **Tailscale tailnet regex precision (A5)**
   - **What we know:** Phase 1 D-19's regex (`^[a-zA-Z0-9.-]+\.ts\.net$`) is broad; this matches `acme.ts.net`, `devbox.tail-abc.ts.net`, `host.subdomain.tail-xyz.ts.net`. Spec line 222 says `*.tail-*.ts.net`.
   - **What's unclear:** Does Donald's actual Tailscale setup produce hostnames like `acme.ts.net` (single label), `devbox.acme.ts.net` (two-label custom), or `devbox.tail-abc.ts.net` (default magicdns)?
   - **Recommendation:** Use the broader regex for now (matches Phase 1 D-19 — `^[a-z0-9-]+(\.[a-z0-9-]+)+\.ts\.net$`). Surface during `/gsd-plan-phase` review. If Donald's tailnet uses a custom name, the regex still passes.
   - **RESOLVED:** Plan 01 Task 1 ships `AGENT_URL_REGEX` requiring ≥1 dot before `.ts.net` (`^...https?:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+\.ts\.net(?::\d{1,5})?$`). Accepts `devbox.tail-abc123.ts.net`, `acme-org.tail-x9z.ts.net`; rejects bare `acme.ts.net` single-label and `ts.net.attacker.com` lookalikes. [Plan 02-01 Task 1, behavior bullets + acceptance test `'rejects ts.net lookalike domains'`]

2. **CF Pages SPA fallback (A7)**
   - **What we know:** Cloudflare Pages needs `_redirects` (or `_headers`) for SPA routing — without it, refreshing on `/onboarding` returns a 404.
   - **What's unclear:** Whether Phase 0 set up `packages/spa/public/_redirects` already.
   - **Recommendation:** Wave 0 task in the plan: verify file exists; create if missing with content `/*  /index.html  200`.
   - **RESOLVED:** Plan 01 Task 2 creates `packages/spa/public/_redirects` with `/*    /index.html   200` plus a strict CSP `_headers` file. Build verifies both files copy to `dist/` verbatim. [Plan 02-01 Task 2]

3. **Vite HMR detection mechanism for SPA-01 test (A4)**
   - **What we know:** Vite emits HMR updates over WebSocket; many community examples assert against the `hmr update` stdout log line.
   - **What's unclear:** Whether the log line wording is stable across Vite v8.x. (Vite v8 is post-rebrand; some log messages changed.)
   - **Recommendation:** Plan a fallback: if stdout-grep is flaky, switch to a WebSocket-attach test (open `ws://localhost:5174` with the Vite HMR protocol, listen for `update` payload).
   - **RESOLVED:** Plan 06 Task 2 adopts the stdout-grep approach with WebSocket fallback documented inline. The subprocess test warms the dev server first (Pitfall 9), then asserts `hmr update|page reload` regex within 2000ms. If the executor sees flake on retry, fallback path is described in the action block. [Plan 02-06 Task 2]

4. **`@tanstack/react-router` devtools in Phase 2?**
   - **What we know:** `@tanstack/router-devtools@1.166.13` exists; same release train.
   - **What's unclear:** Add now (helps debugging the pair flow) or defer to Phase 6 polish.
   - **Recommendation:** Add as a `devDependencies` entry now; conditionally render the devtools panel in `import.meta.env.DEV` only. Costs nothing in prod.
   - **RESOLVED:** **Deferred to Phase 6 polish.** No plan in Phase 2 includes `@tanstack/router-devtools` in `files_modified`, package.json deps, or catalog entries. Confirmed against Plan 01 Task 1 (catalog adds only `@tanstack/react-router`, `@tanstack/zod-adapter`, `@testing-library/user-event`). Phase 6 adds devtools alongside the other polish work.

5. **`/help` route — empty stub or 404?**
   - **What we know:** Spec lists `/help` as a route (line 398). CONTEXT defers help content to Phase 6.
   - **What's unclear:** Should `/help` exist as a stub route in Phase 2's route tree?
   - **Recommendation:** **Yes — stub it.** Adding it later means revisiting `router.tsx`. Stub renders `<p>Coming in Phase 6 — see <a href="/onboarding">Get started</a>.</p>`. Cheap and matches D-05 (one chunk per route).
   - **RESOLVED:** Plan 05 Task 3 ships `/help` as a stub route with the verbatim "Detailed help arrives in Phase 6" copy and a link back to `/onboarding`. Route is lazy-loaded same as the other four. [Plan 02-05 Task 3]

## Environment Availability

> Phase 2 is browser-side code with one subprocess test. Verify dev tooling.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 20+ | All workspaces | ✓ | (per CLAUDE.md `engines.node >= 20`) | — |
| pnpm 9+ | Workspace | ✓ | (per CLAUDE.md "Node 20+, pnpm 9+") | — |
| Vite 8.0.10 | SPA dev/build | ✓ (catalog) | 8.0.10 | — |
| `@tanstack/react-router` | SPA router | ✗ — install in Wave 0 | needs `^1.169.1` | — |
| `@tanstack/zod-adapter` | SPA validateSearch | ✗ — install in Wave 0 | needs `^1.169.x` | Manual `validateSearch: (s) => Schema.parse(s)` if adapter missing |
| `agentic-dashboard` daemon | Subprocess test for `/pair` happy path | ✓ (Phase 1) | local build via `pnpm --filter @agenticapps/dashboard-agent build` | Skip live `/pair` subprocess test; component-test mocks `apiFetch` instead |
| Browser (Chromium for `/browse` hook) | UI brainstorming (per global CLAUDE.md hook) | ✓ (system) | — | Skip `/browse` if unavailable; hook is gentle, not hard |

**Missing dependencies with no fallback:** None — every blocker has an install path or a skip-with-degradation.

**Missing dependencies with fallback:** Two npm packages need installing (Wave 0 task).

## Validation Architecture

> Phase 2 nyquist_validation is enabled (`.planning/config.json: workflow.nyquist_validation: true`). This section drives `02-VALIDATION.md` generation.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest@^4.1.5` + `@testing-library/react@^16.3.2` + `jsdom@^29.1.1` |
| Config file | `packages/spa/vite.config.ts` (Vite-as-vitest config; `defineConfig({ test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] } })` — **must be added in Wave 0**, not yet present) |
| Quick run command | `pnpm --filter @agenticapps/dashboard-spa test` (vitest run) |
| Full suite command | `pnpm -r test && pnpm -r typecheck && pnpm -r build` |
| Phase gate | `pnpm -r test` green + `dev-perf-smoke.test.ts` passing |

### Test Layers

**Layer 1 — Pure functions (Tier 1: Unit).**
- `validateAgentUrl(url)` regex tests: positive cases (`http://localhost:5193`, `http://127.0.0.1:5193`, `https://devbox.tail-abc.ts.net:5193`, `http://acme-corp.ts.net`); negative cases (`https://attacker.com`, `http://192.168.1.1:5193`, `javascript:` scheme, `file:` scheme).
- `getPairing()` / `setPairing()` / `clearPairing()` — round-trip; corrupt JSON → `null`; schema-invalid JSON → `null + clear`.
- `parseOrDrift(schema, json)` — success path, failure path with first-issue extraction, full-issue-tree exposure.
- `useTheme()` — initial state from localStorage, system-pref resolution, persistence on change, matchMedia subscription cleanup on unmount.
- `PairingSchema`, `AgentUrlSchema`, `TokenSchema` — schema-level tests in `packages/shared/src/schemas/pairing.test.ts`.

**Layer 2 — Components (Tier 1: Unit + Component).**
- `<RepairBanner />` — renders only when `needsRepair && !dismissed`; `[Re-pair]` navigates with state; `[×]` calls `dismiss()`.
- `<SchemaDriftState issues={...} />` — renders heading, first-issue path/expected/got; `[Show full diff]` toggles `<details>`; `[Reload]` calls reload prop.
- `<DaemonNotRunning />` — renders ECONNREFUSED state with `agentic-dashboard start` hint.
- `<OnboardingHero />` — renders headline, value-prop, three numbered steps, copy-icon affordance per step, "Why local-only →" disclosure.
- `<ManualPairForm />` — agent-URL regex error inline; token regex error inline; submit calls `/health` (mocked); 200 + valid schema → `setPairing` + navigate; 200 + drift → drift state; 401 → token-error state.
- `<ThemeToggle />` — sun/moon chip toggles, tri-state radio on /settings.

**Layer 3 — Routes + integration (Tier 2: Integration).**
- `rootRoute.beforeLoad` — unpaired → throws `redirect({ to: '/onboarding' })`; paired → no throw.
- `pairRoute.validateSearch` — invalid agent → `routerCode: 'VALIDATE_SEARCH'` → `errorComponent` mounts.
- `<App />` (router-mounted) — renders `<RepairBanner />` + `<Outlet />`; banner appears when QueryCache fires `onError({ status: 401 })`.
- Theme persistence across route navigation (set theme on /settings, navigate to /onboarding, theme intact).

**Layer 4 — Subprocess (Tier 3: Subprocess).**
- `dev-perf-smoke.test.ts` (SPA-01) — boots `pnpm --filter @agenticapps/dashboard-spa dev`, asserts `Local: http://localhost:5174` line, warms with one fetch, edits `main.tsx`, asserts `hmr update` log line within 2s.
- `pair-flow-e2e.test.ts` (SPA-02 happy path) — boots agent daemon (Phase 1 binary) on isolated `HOME` fixture; reads `auth.json` token; boots SPA dev; opens headless or constructs `/pair?agent=...&token=...` URL; asserts redirect to `/`. (May defer if it adds >30s to CI; Layer 3 router integration test covers most.)

**Layer 5 — Cross-tier (Tier 4: Smoke).**
- "App boots into onboarding" smoke test in CI: `pnpm --filter @agenticapps/dashboard-spa build && pnpm --filter @agenticapps/dashboard-spa preview` then `curl -s http://localhost:4173/` — assert HTML loads + has `<div id="root">`.
- Final review (post-execute): manual `/browse` screenshot of `/onboarding`, `/pair` (success + error states), `/settings`, theme dark+light. Captured for `/cso` and the impeccable baseline.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPA-01 | dev server boots at 5174 with HMR <2s | subprocess | `pnpm --filter @agenticapps/dashboard-spa test src/__tests__/dev-perf-smoke.test.ts` | ❌ Wave 0 (file new) |
| SPA-02 | `/pair?agent=&token=` validates, calls /health, stores, redirects | component + subprocess | `pnpm --filter @agenticapps/dashboard-spa test src/routes/pair.test.tsx` | ❌ Wave 0 (file new) |
| SPA-03 | `/` unpaired → /onboarding | integration | `pnpm --filter @agenticapps/dashboard-spa test src/router.test.tsx` | ❌ Wave 0 (file new) |
| SPA-04 | /settings manual pair + theme toggle | component | `pnpm --filter @agenticapps/dashboard-spa test src/routes/settings.test.tsx` | ❌ Wave 0 (file new) |
| AUTH-04 | SPA detects 401 → re-pair banner | integration | `pnpm --filter @agenticapps/dashboard-spa test src/lib/repair.test.ts` | ❌ Wave 0 (file new) |
| INV-04 | Schema drift inline-state surface | component | `pnpm --filter @agenticapps/dashboard-spa test src/components/SchemaDriftState.test.tsx` | ❌ Wave 0 (file new) |

### Sampling Rate

- **Per task commit:** `pnpm --filter @agenticapps/dashboard-spa test --run --reporter=verbose` (~5-10s for ~30-40 tests)
- **Per wave merge:** `pnpm -r test && pnpm -r typecheck` (full workspace ~30s — adds Phase 1's 160 tests)
- **Phase gate:** Full suite green + `dev-perf-smoke.test.ts` passing + manual `/browse` review of all 4 routes (`/onboarding`, `/pair` happy + error, `/settings`, `/`).

### Wave 0 Gaps

- [ ] `packages/spa/vite.config.ts` — add `test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], globals: false }` block (currently has no `test` block).
- [ ] `packages/spa/src/__tests__/dev-perf-smoke.test.ts` — covers SPA-01 (subprocess HMR test).
- [ ] `packages/spa/src/router.tsx` + `packages/spa/src/router.test.tsx` — root route guards + lazy children.
- [ ] `packages/spa/src/routes/{index,onboarding,pair,settings,help}.lazy.tsx` + sibling `*.test.tsx`.
- [ ] `packages/spa/src/components/{RepairBanner,SchemaDriftState,DaemonNotRunning,ManualPairForm,OnboardingHero,ThemeToggle,CodeBlock}.tsx` + tests.
- [ ] `packages/spa/src/lib/{api,pairing,theme,repair,queryClient}.ts` + tests.
- [ ] `packages/shared/src/schemas/pairing.ts` + `packages/shared/src/schemas/pairing.test.ts` (NEW shared schema).
- [ ] `packages/shared/src/index.ts` — export `PairingSchema`, `Pairing`, `AgentUrlSchema`.
- [ ] `packages/spa/public/_redirects` (if missing) — `/*  /index.html  200` for Cloudflare Pages SPA fallback.
- [ ] Workspace catalog: `@tanstack/react-router: ^1.169.1`, `@tanstack/zod-adapter: ^1.169.1` entries in `pnpm-workspace.yaml`.

## Security Domain

> `.planning/config.json: workflow.security_enforcement: true; security_asvs_level: 1; security_block_on: high`. This section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Bearer-token in `localStorage`. Token regex enforced via `TokenSchema` (Phase 1 D-13). No login form (spec: "No login form. No magic. Just a path."). |
| V3 Session Management | partial | localStorage acts as the session store. No server-side session. Token rotation (Phase 1 D-14, 30-day) → 401 → SPA repair banner is the session-renewal path. |
| V4 Access Control | yes | All daemon routes require bearer token; Phase 2 just relays. No SPA-side authorization decisions; daemon owns access control. |
| V5 Input Validation | **yes** | **Critical for Phase 2.** Pair URL search params (`agent`, `token`) validated via Zod at routing layer. Manual-pair form inputs validated client-side (regex) AND via daemon `/health` round-trip before persisting. localStorage reads validated via `PairingSchema.safeParse` on every access. |
| V6 Cryptography | n/a-direct | Token entropy is daemon's job (D-13: `crypto.randomBytes(32)`). SPA never generates secrets. **Don't hand-roll** any crypto. |
| V8 Privacy & Data Protection | partial | Token is sensitive — kept in localStorage, never logged. `console.error` calls in `parseOrDrift` log the **shape** of drift (field path + types), not values. Tokens never appear in logs. |
| V11 Business Logic | partial | The "pair only via printed URL OR manual paste" flow is the business logic. SPA enforces: regex on input, `/health` round-trip before persisting, no other persistence path. |
| V14 Configuration | yes | CORS origin (Phase 1 D-21: pages.dev + localhost:5174) is the configuration boundary. SPA must not be served from a domain not in the daemon's CORS allowlist. |

### Threat Model — Phase 2 attack surfaces

| Threat | STRIDE | Surface | Mitigation |
|--------|--------|---------|-----------|
| **T-1: XSS exfil of bearer token** | Tampering / Information Disclosure | localStorage stores `{agentUrl, token}` (D-13 71-char hex token) | (a) **No raw-HTML injection APIs** anywhere in the SPA shell — React's safe-by-default text rendering only. (b) **No third-party JS** beyond declared deps (PROJECT.md hard constraint). (c) **Strict CSP** in CF Pages — Phase 6 finalizes; Phase 2 should land a baseline `_headers` with `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`. (d) Token never appears in DOM (no `<input type="text" value={token}>` outside the manual-pair form's password-masked input). |
| **T-2: Pair-URL spoofing via lookalike Tailscale hostname** | Spoofing | `/pair?agent=https://devbox.tail-abc.ts.net.attacker.com:5193&token=...` paired with attacker's daemon | `AgentUrlSchema` regex (Pattern 8) ANCHORED with `$` after `.ts.net(:port)?` — rejects suffixed lookalikes. Pre-existing Phase 1 D-19 regex was likewise anchored. **Test with adversarial inputs** (Pitfall 6 + Pattern 8 negative tests). |
| **T-3: Pair-URL with `javascript:` or `file:` scheme** | Tampering | Search-param `agent` field | `z.string().url()` rejects non-http(s) schemes; `AGENT_URL_REGEX` further restricts to `http(s)`. Negative test for the `javascript:` scheme → validateSearch fails → `errorComponent`. |
| **T-4: Schema drift triggered by malicious daemon response** | Tampering / DoS | If user pairs with a hostile daemon, can crafted JSON crash the SPA? | `parseOrDrift` returns a structured `{ok:false, drift}` instead of throwing into render. `<SchemaDriftState />` renders the field-path + types but does NOT render the actual value (D-09). Note: `console.error(issues)` logs the parsed Zod issue tree — `issue.received` may include user-controlled data; OK because it's DevTools-only. **Mitigation:** confirm `console.error` payload is bounded (Zod truncates long strings in issue messages). |
| **T-5: Forced re-pair via crafted 401 response** | Spoofing | Malicious in-flight response with status 401 forces user to "re-pair" → re-enters token to attacker | If attacker can MITM the daemon response, they have CORS bypass — already pwn. CORS lock + bearer-token-on-every-request defends. **Defense-in-depth:** banner is dismissible; user can ignore on a single 401, only re-pair on persistent. (D-06 dismissable + persistent until 200/health). |
| **T-6: localStorage-poisoning** | Tampering | XSS or browser-extension writes `agentic-dashboard:pairing` with `agentUrl: https://attacker.com` | `PairingSchema` validates on EVERY read (Pattern 8). `AgentUrlSchema` regex rejects `https://attacker.com`. Result: corrupt → `clearPairing` → redirect `/onboarding`. **Test:** unit test for "poisoned URL → cleared". |
| **T-7: Token leakage via referrer / window.name / postMessage** | Information Disclosure | Token in URL when navigating to `/pair?...&token=...`; if the page later has any `<a target="_blank">`, `window.opener.location` could leak | TanStack Router redirects from `/pair` to `/` immediately after success, overwriting history (`navigate({ to: '/', replace: true })`). Token never re-appears in URL after redirect. **Plan must enforce `replace: true` on the post-pair navigation** (Pattern: `/pair` happy path, line 25 of snippet). Also: no `<a target="_blank">` in `/onboarding` or `/pair` until a `rel="noopener noreferrer"` audit happens (Phase 6). |
| **T-8: CSP bypass via inline event handlers** | Tampering | If CSP is `script-src 'self'` but inline event-handler attributes exist, CSP is moot | React doesn't emit inline event handler attributes; safe by default. **Audit:** no string-bodied event handlers anywhere. (Trivial in TS strict mode.) |
| **T-9: Open redirect via `redirect to: ...` in beforeLoad** | Tampering | If `redirect({ to: search.next })` ever appears, attacker controls navigation | We don't use a `next` param. `beforeLoad` only redirects to literal `/onboarding`. **No dynamic redirect destinations in Phase 2.** |
| **T-10: clickjacking on /pair** | Tampering | iframed SPA accepting click for "Re-pair" | `_headers` should include `X-Frame-Options: DENY`. Phase 2 baseline. |

### Known Threat Patterns for Vite + React + TanStack Router

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| HTML injection via untrusted input rendered as raw markup | Tampering | React escapes by default; never use raw-HTML injection APIs. Audit gate in `/cso`. |
| Bearer-token leakage to third-party scripts | Information Disclosure | No third-party JS in v1 (PROJECT.md hard constraint). CSP `script-src 'self'` baseline. |
| Open redirect via search-param-driven navigation | Tampering | No dynamic `to:` destinations in `redirect()` / `useNavigate()`. |
| `localStorage` poisoning by browser extension or XSS | Tampering | Schema-validate on every read (Pattern 8). |
| Schema-drift DoS (hostile daemon hangs the SPA on parse) | DoS | Zod parse is bounded; SPA wraps in `safeParse` (never throws into render); panel-scoped fallback (D-08). |
| Lookalike Tailscale hostname spoofing | Spoofing | Anchored regex; `*.ts.net$` requires literal `.ts.net` suffix at end of host. |

**`/cso` checklist for post-phase review:**
- [ ] No raw-HTML injection APIs in any component (grep for the React opt-out prop name).
- [ ] No `eval` calls; no string-bodied `setTimeout` / `setInterval`; no dynamic-string code constructors.
- [ ] Token not logged in any `console.*` call (grep `console.*token`).
- [ ] Token not in any error message that could be surfaced to UI.
- [ ] Pair-URL agent regex test suite includes the 4 attack vectors (T-2, T-3, T-6, T-9).
- [ ] `_redirects` file is `/* /index.html 200` only (no open-redirect rules).
- [ ] `_headers` file (NEW in Phase 2 baseline): `X-Frame-Options: DENY`, `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://127.0.0.1:5193 http://localhost:* https://*.ts.net:*`.
- [ ] Bearer token never appears in URL after `/pair` (post-redirect verified).

## Sources

### Primary (HIGH confidence)

- **TanStack Router latest docs — Search Params guide** ([VERIFIED via WebFetch 2026-05-03](https://tanstack.com/router/latest/docs/guide/search-params)) — `validateSearch`, `zodValidator`, `useSearch`, `error.routerCode === 'VALIDATE_SEARCH'`.
- **TanStack Router latest docs — Code Splitting guide** ([VERIFIED via WebFetch 2026-05-03](https://tanstack.com/router/latest/docs/guide/code-splitting)) — `.lazy()` method on route definition + `createLazyRoute` in sibling file.
- **Tailwind v4 dark-mode docs** ([VERIFIED via WebFetch 2026-05-03](https://tailwindcss.com/docs/dark-mode)) — `@custom-variant dark (&:where(.dark, .dark *));` and `<html class="dark">` toggle.
- **Zod docs (`safeParse`)** ([VERIFIED via WebFetch 2026-05-03](https://zod.dev/api?id=safeparse)) — return shape, issue tree (`path`, `code`, `message`, `expected`, `received`).
- **tk-dodo: React Query Error Handling** ([VERIFIED via WebFetch 2026-05-03](https://tkdodo.eu/blog/react-query-error-handling)) — canonical pattern for `new QueryClient({ queryCache: new QueryCache({ onError }) })`.
- **TanStack Query Discussion #6484 — 401 handling pattern** ([CITED](https://github.com/TanStack/query/discussions/6484)) — global `onError` for 401 with redirect/re-auth.
- **Vite HMR API docs (events: `vite:beforeUpdate`, `vite:afterUpdate`)** ([VERIFIED via WebFetch 2026-05-03](https://vite.dev/guide/api-hmr.html)).
- **`npm view` registry checks** (run 2026-05-03):
  - `@tanstack/react-router@1.169.1` (published 2026-05-01)
  - `@tanstack/router-plugin@1.167.32`
  - `tailwindcss@4.2.4`
  - `@tailwindcss/vite@4.2.4`
  - `@tanstack/react-query@5.100.9`
  - `zod@4.4.2` (workspace stays on 3.25.x)
  - `vite@8.0.10`
  - `vitest@4.1.5`
  - `@testing-library/react@16.3.2`
  - `jsdom@29.1.1`

### Secondary (MEDIUM confidence — cross-verified)

- **TanStack Query Discussions #2144, #6228, #5099** — multiple community confirmations of the `QueryCache({ onError })` 401-detection pattern.
- **Phase 1 RESEARCH.md** (`.planning/phases/01-daemon-registry-pairing/01-RESEARCH.md`) — Tailscale hostname pitfalls (Pitfall 5), token regex (D-13), CORS origin (D-21).
- **Phase 1 banner.ts source** (`packages/agent/src/lib/banner.ts`) — pair URL format ground truth.

### Tertiary (LOW confidence — flagged in Assumptions Log)

- **Vite HMR stdout `hmr update` log line** (A4) — referenced in community examples; not formally documented in HMR API page. Mitigation: WebSocket fallback.
- **Tailscale tailnet hostname shape** (A5) — Phase 1 broadened the spec's `*.tail-*.ts.net` regex; planner should confirm with user.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — every package version verified via `npm view`; every API verified via official docs WebFetch.
- Architecture: **HIGH** — patterns are direct quotes from TanStack Router / Tailwind / Zod docs, adapted to D-XX decisions.
- Pitfalls: **HIGH-MEDIUM** — pitfalls 1-8 are concrete (verified or community-attested); pitfall 9 (HMR <2s on CI) is empirical and may need tuning.
- Security: **HIGH** — threat model derives from STRIDE applied to surfaces enumerated in CONTEXT; no novel attack paths claimed.

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (30 days; library versions move quickly during a 1.x churn for TanStack Router; re-verify if Phase 2 doesn't ship within a month).

---

## RESEARCH COMPLETE

**Phase:** 02 — SPA Shell + Pair Flow
**Confidence:** HIGH

### Key Findings

1. **TanStack Router v1.169.1** (published 2026-05-01) is the load-bearing dep — install it via `@tanstack/react-router` + `@tanstack/zod-adapter` (catalog entries). Use **code-based routes** with `.lazy()` per non-critical route; do **not** install `@tanstack/router-plugin`.
2. **Tailwind v4 class-based dark mode is a one-line CSS addition** — `@custom-variant dark (&:where(.dark, .dark *));` in `global.css`. No `tailwind.config.{js,ts}` file. CSS variables drive theming.
3. **TanStack Query v5 global 401 detection is a `QueryCache({ onError })` callback** — fires for all queries; check `error instanceof ApiError && error.status === 401` to distinguish from network errors.
4. **Schema drift is a per-panel state via `parseOrDrift(schema, json)`** — never throws, returns tagged union; first issue's `path`, `expected`, `received` populates `<SchemaDriftState />` per D-09.
5. **Pair-URL host validation goes in `packages/shared/src/schemas/pairing.ts`** — single regex covering loopback + `*.ts.net`; reused by SPA `validateSearch` AND `<ManualPairForm />` AND localStorage round-trip. Phase 1 hand-shake at the regex layer prevents drift.
6. **Phase 2 needs ONE Wave 0 task that's not obvious:** verify (or create) `packages/spa/public/_redirects` with `/* /index.html 200` for CF Pages SPA fallback, AND add a baseline `_headers` for CSP / `X-Frame-Options: DENY`.
7. **Two security threats deserve named tests:** lookalike Tailscale hostname (T-2) and `javascript:` scheme (T-3) — both blocked by anchored regex but worth adversarial test cases.

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Every version verified via `npm view` 2026-05-03 |
| Architecture | HIGH | Patterns lifted verbatim from official docs |
| Pitfalls | HIGH-MEDIUM | Community + repo evidence; HMR-2s on CI is empirical |
| Security | HIGH | STRIDE × surfaces; no novel claims |

### Open Questions (RESOLVED — see §"Open Questions (RESOLVED)" above for traceability)

1. **RESOLVED:** Tailscale tailnet regex precision (single-label `acme.ts.net` vs `*.acme.ts.net`) — narrowed to ≥1 dot before `.ts.net`. [Plan 02-01 Task 1]
2. **RESOLVED:** CF Pages `_redirects` file existence — created in Wave 0. [Plan 02-01 Task 2]
3. **RESOLVED:** Vite HMR detection mechanism — stdout-grep with WebSocket fallback documented. [Plan 02-06 Task 2]
4. Add `@tanstack/router-devtools` now or in Phase 6? — recommendation: now, dev-only.
5. `/help` route stub vs 404? — recommendation: stub now to avoid Phase 6 router-tree edits.

### Ready for Planning

Research complete. Recommended order of operations: `/gsd-ui-phase 2` (UI-design brainstorm using D-01 hero+steps treatment + D-02 dark-default theme) → `/gsd-plan-phase 2` (consume this RESEARCH.md + UI artifacts) → `/gsd-execute-phase 2` (per-plan TDD; pre-phase brainstorming hook fires automatically per global CLAUDE.md).
