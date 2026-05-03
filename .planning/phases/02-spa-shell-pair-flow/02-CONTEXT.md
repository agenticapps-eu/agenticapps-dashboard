# Phase 2: SPA Shell + Pair Flow - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A Vite + React + Tailwind SPA shell that owns the unpaired → paired transition:
- Routes `/`, `/onboarding`, `/pair`, `/settings`, `/help` (placeholder if not in scope) wired through a type-safe router.
- `/pair?agent=<url>&token=<dashed-hex>` validates inputs, calls `GET /health` with the bearer, stores `{agentUrl, token}` in localStorage, redirects to `/`.
- `/onboarding` shows a hero install walkthrough when no pairing exists.
- `/settings` provides manual-pair (paste agent URL + token, validates via `/health` before save) and theme toggle.
- Schema-drift detection on every daemon response (Zod `parse()`); failed parse renders an inline drift state for that panel only.
- 401-from-daemon surfaces a non-blocking top banner with a Re-pair CTA; stale data remains visible underneath.

**In scope (Phase 2):** SPA-01, SPA-02, SPA-03, SPA-04, INV-04 (SPA-side schema-drift detection — daemon side already shipped via Phase 1 D-16), AUTH-04 SPA-side 401 → re-pair flow (token rotation triggers were Phase 1).

**Out of scope (later phases):**
- Multi-project home content (cards, filters, search, sort, register modal) — Phase 3 (HOME-01..06).
- `/projects/{id}` three-column view — Phases 4 (DISC + PHASE) and 5 (HEALTH).
- `/settings/projects` register/unregister/rename/tag UI — Phase 3 alongside HOME-06 register modal.
- `/settings/integrations` configure-to-enable cards — Phase 5 (HEALTH-05).
- `+ Register project` modal & confused-deputy "option C" banner-confirmed nonce that supersedes the Phase 1 B2 stopgap (`assertRegistrationAllowed`) — Phase 3 alongside HOME-06.
- Keyboard shortcuts (`R`, `?`, `/`) — Phase 6 (POLISH-01).
- `impeccable:critique` ≥ 90 hard gate — Phase 6 (POLISH-04). Phase 2 sets the visual baseline that gate will measure.
- Playwright / visual-regression tests — deferred to Phase 6 polish; Phase 2 ships vitest + jsdom unit tests + happy-path subprocess test of `pnpm dev` boot.

</domain>

<decisions>
## Implementation Decisions

### Design tone & theme

- **D-01:** `/onboarding` ships with a "hero + numbered steps + tone" treatment, not bare spec copy. Layout: short headline ("One local daemon. Every device.") + one-line value prop ("Nothing leaves your machine.") + numbered Install/Start/Pair steps with `lucide-react` copy-icon affordance on each command, + a tertiary "Why local-only →" link to a one-paragraph aside. Soft visual hierarchy (no gradients, no hero illustrations, no animated terminal — those flunk anti-AI-slop on `impeccable:critique`). Survives Phase 6 polish with copy/spacing tweaks, not a rewrite.
- **D-02:** Default theme is **dark**. Pairs with terminal-adjacent context (CLI → dashboard handoff), keeps monospace command snippets readable, and dark-default UIs tend to score higher on `impeccable:critique` anti-slop pillars (less temptation toward gradients/glow). Tailwind class strategy: `dark` class on `<html>` per `tailwindcss` v4 dark-mode-class config; CSS variables for `--bg`, `--surface`, `--text`, `--accent` so the same components render either theme.
- **D-03:** Theme toggle exposed in **two places**: (a) sun/moon icon chip in the page header (always visible); (b) labeled toggle on `/settings`. Persisted in localStorage under `agentic-dashboard:theme` (`"dark" | "light" | "system"`). Default is `"dark"` (per D-02), but the toggle UI offers all three values (the third honors `prefers-color-scheme`).

### Routing & code structure

- **D-04:** Router is **TanStack Router** (`@tanstack/react-router`). Drives the choice: type-safe search params (the `/pair?agent=…&token=…` flow can declare a Zod-validated route schema and reject malformed URLs at the routing layer instead of in component-land), native pairing with `@tanstack/react-query` (already a dep), no FS-based routing magic. Adds 1 production dep (~12kB).
- **D-05:** **Per-route lazy splitting** via `React.lazy()` and TanStack Router's `lazyRouteComponent`. `/onboarding`, `/pair`, `/settings`, `/`, `/help` (stub), and the future `/projects/{id}` each compile to a separate chunk. Keeps the v1 SPA bundle small enough that home-page TTI on cold load stays sub-second; avoids a refactor pass when Phase 3+ adds heavier panels.

### Re-pair UX (401 handling)

- **D-06:** A 401 from the daemon (any route) surfaces as a **persistent dismissible top banner**: `⚠ Agent token rejected. [Re-pair] [×]`. Banner does NOT block the page — whatever was last rendered stays visible underneath (consistent with spec line 8 / acceptance criterion 8: "shows stale data, never crashes"). Clicking [Re-pair] navigates to `/onboarding` with a state flag that pre-positions the user at the pair step instead of the install walkthrough. Banner persists across in-app navigation until either (a) a successful 200 from `/health` clears it, or (b) user dismisses with [×] (which only suppresses for the current session — next 401 re-shows it).
- **D-07:** **No auto-retry on 401.** Token mismatch is deterministic — retrying just adds latency to the user-visible signal. (For the Phase 1 D-15 mid-rotation race window, the in-flight request the daemon already accepted on the old token completes; the next request shows the banner. Acceptable trade-off.) Network-level errors (`ECONNREFUSED`, fetch network error) are a separate state — Claude's discretion: render a distinct "Daemon not running" panel-state that prompts `agentic-dashboard start`, not re-pair. Don't conflate the two.

### Schema-drift UX (INV-04 SPA side)

- **D-08:** Schema drift surfaces as an **inline panel state**, scoped to the failing query/panel. Other panels keep rendering normally. Implementation: every daemon-response consumer wraps the JSON parse in a `safeParse()` against the corresponding shared schema; on `success: false`, the panel renders a `<SchemaDriftState />` component instead of its normal content. Failed Zod issue tree is logged via `console.error(...)` for DevTools follow-up. No global modal, no whole-app freeze.
- **D-09:** Drift state shows: heading "Schema drift detected", one-paragraph explanation ("Daemon and SPA disagree on the shape of this response. Update both ends to match."), the **first failing field path + expected type + actual value** (e.g. `phaseProgress.evidenceCount — expected: number — got: undefined`). A `[Show full diff]` disclosure button reveals the full Zod issue tree in a `<details>` panel for deeper diagnosis. `[Reload]` button retries the underlying TanStack Query.

### Claude's Discretion

- **Test strategy:** vitest + `@testing-library/react` + jsdom (already configured) for unit + component tests. One subprocess test that spawns `pnpm --filter @agenticapps/dashboard-spa dev`, waits for the listening line, hits `http://localhost:5174/`, and asserts the redirect to `/onboarding`. Playwright + visual regression deferred to Phase 6 polish (POLISH-04 impeccable critique gate).
- **localStorage shape:** Single Zod schema in `packages/shared/src/schemas/pairing.ts` — `PairingSchema = z.object({ agentUrl: z.string().url(), token: z.string().regex(D-13 pattern), pairedAt: z.string().datetime() })`. Parsed on every read; corrupt or missing values fall back to "unpaired" state and route to `/onboarding`. Schema lives in `shared/` so future daemon-side use (e.g. embedded SPA bundle) gets the same shape for free.
- **Pair-URL agent-host validation:** Regex per spec line 222 — accept `http://(localhost|127\.0\.0\.1)(:\d+)?` and `https?://[a-z0-9-]+\.tail-[a-z0-9]+\.ts\.net(:\d+)?`. Reject anything else with a "this doesn't look like an agent URL" inline error on `/pair` and `/settings`. Both http and https accepted on the Tailscale form (daemon serves HTTP; `tailscale serve` users may proxy to HTTPS).
- **Manual-pair flow on `/settings`:** Block save until `/health` returns 200 and the `HealthResponseSchema` parses cleanly. Inline error states for: regex-rejected agent URL, regex-rejected token, network failure, 401 (token wrong), schema drift on `/health` (suggests daemon version mismatch). Save button disabled until both inputs pass client-side validation; loading state on submit while `/health` is in-flight.
- **Header chrome:** Minimal — product name on left, sun/moon theme chip + ⚙ settings icon on right. No breadcrumbs (TanStack Router's matchRoute handles "you are here" implicitly). No project switcher in Phase 2 (multi-project home arrives in Phase 3).
- **Pair URL generation + `dashboard.agenticapps.eu` flip:** Daemon already prints `https://agenticapps-dashboard.pages.dev/pair?...` per Phase 1 D-21. SPA accepts the same path locally during dev (Vite serves `localhost:5174/pair?...`). Custom domain flip is a Phase 6 daemon constant change (one line in `packages/agent/src/constants.ts`); SPA needs no change.
- **Hot-reload verification:** SPA-01 mandates < 2s hot-reload. Vite's HMR is sub-100ms by default; the only thing that endangers this is heavy synchronous work on module entry. Plan a `dev-perf-smoke.test.ts` (subprocess) that boots `pnpm dev`, edits a file, asserts the next HMR message arrives within 2s.

### Folded Todos

None — no pending todos surfaced in cross-reference.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec (binding)

- `docs/spec/dashboard-prompt.md` §"SPA route structure" (lines 388–400) — the seven routes; `/` redirects to `/onboarding` if no pairing.
- `docs/spec/dashboard-prompt.md` §"`/onboarding` content" (lines 403–419) — install copy. D-01 elevates this from bare copy to hero+steps treatment, but the install commands themselves stay verbatim.
- `docs/spec/dashboard-prompt.md` §"Pairing flow" lines 213–222 — pair URL format, agent-URL validation regex (`localhost / 127.0.0.1 / *.tail-*.ts.net`), localStorage shape, redirect to `/`.
- `docs/spec/dashboard-prompt.md` §"Schemas live in `packages/shared/`" lines 561–573 — every API response validates on both ends; mismatch = "schema drift" warning in SPA.
- `docs/spec/dashboard-prompt.md` §"Acceptance criteria" items 1, 8, 13, 14, 15 (lines 580, 587, 592, 593, 594) — Phase-2-relevant gates: pair URL flow, token rotation surface, empty-state UX, hot-reload <2s, eventual `impeccable:critique` ≥ 90.
- `docs/spec/dashboard-prompt.md` §"Implementation phasing" Phase 2 bullet (lines 618–622) — the four sub-deliverables.
- `docs/spec/dashboard-prompt.md` §"Constraints I want preserved" + §"Anti-features" (lines 686–712) — no analytics, no third-party JS beyond declared deps, read-only on project FS, optional integrations stay optional.

### Project-level planning artifacts

- `.planning/PROJECT.md` — vision, hard constraints (SPA tech-stack lock: Vite + React 18 + TS + Tailwind + TanStack Query + Zod + lucide-react), key decisions table.
- `.planning/REQUIREMENTS.md` — REQ-IDs in scope: SPA-01, SPA-02, SPA-03, SPA-04 active; INV-04 architectural invariant lands SPA-side here.
- `.planning/ROADMAP.md` — Phase 2 success criteria 1–4, depends-on Phase 1.
- `.planning/phases/00-bootstrap/00-CONTEXT.md` — Phase 0 decisions still in force: D-04 (pnpm catalog), D-06 (HealthResponseSchema is the cross-package contract proof), D-15 (workflow commitment ritual mandatory).
- `.planning/phases/01-daemon-registry-pairing/01-CONTEXT.md` — Phase 1 decisions Phase 2 must honor: D-13 (token regex), D-15 (mid-rotation race window — explains why no SPA auto-retry), D-16 (daemon outbound parse — SPA inbound parse pairs with this), D-21 (CORS allow-list + pair URL host = `agenticapps-dashboard.pages.dev`).
- `CLAUDE.md` — repo state, target architecture, hard architectural constraints (every "must survive every refactor" bullet applies).
- Global `~/.claude/CLAUDE.md` — AgenticApps workflow hooks (per-plan TDD, post-phase `/review`+`/cso`+`/qa`, pre-phase brainstorming on UI plans).

### Workflow contract

- `.claude/skills/agenticapps-workflow/skill/SKILL.md` — commitment ritual format, gate-to-skill map, rationalization table, 13 red flags.
- Pre-phase hook applies (per global CLAUDE.md): "If any plan has frontend files → run `superpowers:brainstorming` for UI/UX alternatives. Start dev server for UI plans, preview with `/browse`, user picks direction." This will fire when `/gsd-execute-phase 2` runs.

### External docs (router + Vite + Tailwind specifics)

- TanStack Router (Zod-validated search params): https://tanstack.com/router/latest/docs/framework/react/guide/search-params — `validateSearch` pattern for `/pair?agent=…&token=…`.
- TanStack Router lazy routes: https://tanstack.com/router/latest/docs/framework/react/guide/code-splitting — `lazyRouteComponent` pattern for D-05.
- TanStack Query v5 + TanStack Router integration: https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading — loader integration; SPA's daemon calls go through query.
- Tailwind v4 dark mode (class-based): https://tailwindcss.com/docs/dark-mode — `dark` class on `<html>`, plus the new v4 `@theme` block for CSS-variable-driven theming (D-02/D-03 implementation).
- Vite HMR contract: https://vitejs.dev/guide/api-hmr.html — relevant for the dev-perf-smoke test asserting <2s hot-reload (SPA-01).
- Zod `safeParse` semantics: https://zod.dev/?id=safeparse — used for D-08 SPA-side schema-drift detection without throwing into React render.
- React Router v7 (NOT chosen, but for context): https://reactrouter.com/start/data — listed so the planner doesn't re-litigate the choice.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `packages/spa/src/App.tsx` — placeholder shell mounted by `main.tsx`. Phase 2 replaces its body with the TanStack Router root + theme provider. Existing test `App.test.tsx` shows the `@testing-library/react` pattern.
- `packages/spa/src/main.tsx` — React root mount at `#root`. Phase 2 wraps with TanStack Router provider + TanStack Query provider + theme provider; structure stays.
- `packages/spa/src/test-setup.ts` — vitest + jsdom + jest-dom matchers wired. Reuse for component tests.
- `packages/spa/vite.config.ts` — port 5174, strictPort. No changes needed for Phase 2; verify dev server still binds correctly after adding TanStack Router's optional Vite plugin.
- `packages/shared/src/schemas/health.ts` — `HealthResponseSchema = { ok, version, message? }` (Phase 0 baseline). Phase 1 extended to include `daemonVersion`, `registryCount`, `paired`. SPA `parseOrDrift(HealthResponseSchema, json)` is the canonical pair-flow validation.
- `packages/shared/src/schemas/auth.ts` — token regex (D-13) is exported from here; SPA imports it for `/pair` and `/settings` token-input validation without duplication.
- `packages/spa/package.json` — TanStack Query, lucide-react, React 18, Tailwind v4, Vite, vitest already present. Phase 2 adds `@tanstack/react-router`. No other new deps.

### Established Patterns

- **Catalog-versioned deps** (Phase 0 D-04): all React/Tailwind/test deps are pinned in the root pnpm catalog. New `@tanstack/react-router` entry goes in the catalog, then `packages/spa/package.json` references `"@tanstack/react-router": "catalog:"`.
- **Shared-schemas single-source-of-truth** (Phase 0 D-06, Phase 1 D-16): every wire shape lives in `packages/shared/src/schemas/<name>.ts`. SPA imports schemas, never redefines them.
- **TS strict mode** (Phase 0 D-03): `noImplicitAny`, `strictNullChecks` on. TanStack Router's type-inference benefits from this.
- **ESM-only** (Phase 0): SPA is `"type": "module"`. No CJS interop.
- **TDD on every panel** (CLAUDE.md): each route component, each schema-drift fallback, each pair-flow validator gets a failing test first.

### Integration Points

- `packages/shared/src/schemas/pairing.ts` (NEW) — Zod schema for the `{agentUrl, token, pairedAt}` localStorage record. Exported from `shared/src/index.ts`.
- `packages/spa/src/router.tsx` (NEW) — TanStack Router root with route tree + `validateSearch` for `/pair`.
- `packages/spa/src/lib/pairing.ts` (NEW) — `getPairing()`, `setPairing()`, `clearPairing()`, `validateAgentUrl()`, `usePairing()` hook backed by localStorage + Zod.
- `packages/spa/src/lib/api.ts` (NEW) — TanStack-Query-friendly fetch wrapper that injects `Authorization: Bearer ${token}`, runs `safeParse()` against the response schema, surfaces 401 → re-pair-banner state via a query-client mutation, surfaces drift → `<SchemaDriftState />` panel state.
- `packages/spa/src/components/SchemaDriftState.tsx` (NEW) — D-08/D-09 component used in any panel that detects drift.
- `packages/spa/src/components/RepairBanner.tsx` (NEW) — D-06 top banner, mounted once in `App.tsx`.
- `packages/spa/src/lib/theme.ts` (NEW) — D-03 theme provider + `useTheme()` hook; toggles `dark` class on `<html>`.
- `packages/spa/src/routes/onboarding.tsx`, `routes/pair.tsx`, `routes/settings.tsx`, `routes/index.tsx` (NEW) — one route component per file under TanStack Router's file convention (or virtual-route convention if we skip the FS-routing plugin — planner decides based on simpler config win).
- `packages/spa/src/components/CodeBlock.tsx` (NEW) — copy-icon-affordance code snippet used in /onboarding (D-01).
- `~/.agenticapps/dashboard/auth.json` — daemon-owned, mode `0600`. SPA never reads this directly; user copies the token from the daemon's startup banner or pair URL.
- CI workflow `.github/workflows/ci.yml` — already runs `pnpm -r typecheck` + `pnpm -r test` + `pnpm -r build`. Phase 2 tests are picked up automatically.

</code_context>

<specifics>
## Specific Ideas

- The /onboarding hero deliberately rejects gradients, hero illustrations, and animated terminal demos — those are AI-slop tells that will tank `impeccable:critique` in Phase 6. The first impression should look like a tool, not a landing page.
- The Re-pair banner copy mirrors the spec's spirit ("agent unreachable, re-pair") — terse, one line of copy, two buttons. Acceptance criterion 8 explicitly says "rather than crashing" — the banner is the answer to that.
- Schema-drift detection is the single most important architectural payoff of the `packages/shared/` schema split. Don't make it cute — render the field path + expected/got types front-and-center so a mid-implementation drift bug is debuggable in 30 seconds, not 30 minutes.
- TanStack Router's Zod-validated search params is the right shape for `/pair?agent=…&token=…`: malformed URLs short-circuit at the routing layer with a 400-ish redirect to `/onboarding` instead of crashing the pair component.
- Theme persistence uses `agentic-dashboard:theme` localStorage key (namespaced) — paves the way for future config keys (e.g. last-viewed-project) under the same prefix.

</specifics>

<deferred>
## Deferred Ideas

### Confused-deputy "option C" banner-confirmed nonce

Phase 1's B2 stopgap (`assertRegistrationAllowed`) blocks system roots and credential dirs from being registered, but doesn't defend against an attacker tricking the user into pasting a malicious path into the SPA register form. The proper fix is "option C": SPA POSTs to `/api/registry/register-prepare` which returns a nonce + the resolved path; the SPA renders a confirmation banner with the path; user confirms; SPA POSTs `/api/registry/register-confirm` with the nonce. **Lands in Phase 3** alongside the `+ Register project` modal (HOME-06), not Phase 2. Phase 2 doesn't expose a register UI, so the stopgap remains sufficient.

### From spec, deferred to later phases

- **Multi-project home** (HOME-01..06) — Phase 3.
- **Single-project view** (DISC-01..04, PHASE-01..05) — Phase 4.
- **Health column + AgentLinter** (HEALTH-01..05) — Phase 5.
- **Keyboard shortcuts** (POLISH-01) — Phase 6.
- **`install-launchd` / `install-systemd`** (POLISH-02/03) — Phase 6.
- **`impeccable:critique` ≥ 90 hard gate** (POLISH-04) — Phase 6. Phase 2 sets the visual baseline.
- **Two-stage review on dashboard's own code** (POLISH-05) — Phase 6 (also runs informally end-of-Phase-2 per global CLAUDE.md hooks).
- **Custom domain `dashboard.agenticapps.eu` flip** — Phase 6 daemon-constant one-liner.

### Phase-2-adjacent items intentionally not covered here

- **Playwright / visual regression tests** — vitest + jsdom is sufficient for unit/component tests; visual-regression coverage lands in Phase 6 polish alongside the impeccable critique gate.
- **`/help` route content** — stub it (just route + placeholder page); content is Phase 6 (POLISH-06 README + help overlay).
- **`/settings/projects` and `/settings/integrations` sub-routes** — not in SPA-04. Phase 3 adds projects sub-route; Phase 5 adds integrations sub-route.
- **PWA / service-worker / installable** — explicitly out of v1 scope (no spec call).
- **i18n / RTL** — single-user (Donald), English-only by spec.

### Reviewed Todos (not folded)

None — no pending todos surfaced in cross-reference.

</deferred>

---

*Phase: 02-spa-shell-pair-flow*
*Context gathered: 2026-05-03*
