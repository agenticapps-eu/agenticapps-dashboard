# Phase 2: SPA Shell + Pair Flow -

**Archived from GSD phase `02-spa-shell-pair-flow`. Completed 2026-05-04.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/02-spa-shell-pair-flow/` — that tree, not this file, is the authoritative record.

## Why

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
- `/settings/integrations` configure-to-enable cards — Phase 5 (HEALTH

## Capabilities affected

- `openspec/specs/auth-and-pairing/spec.md`
- `openspec/specs/design-system/spec.md`

## What shipped

**02-01**

**One-liner:** Catalog expanded with TanStack Router + zod-adapter + user-event; PairingSchema + AgentUrlSchema shipped as single source of truth; strict CSP _headers + SPA fallback _redirects deployed; global.css loaded with full UI-SPEC token set; 4 RED stub test files planted with MISSING markers for Nyquist gate.

**02-02**

**One-liner:** Wave-0 RED stubs turned GREEN; pairing/theme libs implemented; ThemeChip + Header + AppShell chrome built; TanStack Router 5-route code-based tree wired with SPA-03 beforeLoad pairing guard; lazy chunks emitting from build.

**02-03**

**One-liner:** Wave-0 RED stub api.test.ts turned GREEN with 10 real cases; apiFetch + parseOrDrift + ApiError shipped as the daemon-fetch layer; RepairContext with stable useCallback helpers guards Plan 06's useMemo loop; createQueryClient wires QueryCache 401 interceptor (Pitfalls 4+5 guarded at source level); SchemaDriftState + DaemonUnreachableState + RepairBanner components ship with UI-SPEC verbatim copy and correct color tokens.

**02-04**

**One-liner:** /onboarding route ships D-01 verbatim-copy hero + 3 numbered steps + disclosure; /pair route implements a 5-state machine (pairing/success/drift/unreachable/failed) with validateSearch at the routing layer and MalformedPairUrl extracted to its own eager-importable file (W1 bundle-splitting fix); 19 new GREEN tests.

**02-05**

**One-liner:** ThemeToggle fieldset (D-03 second toggle location) + ManualPairForm 8-state SPA-04 paste flow wired to /health; /settings /help / routes replaced with real components; Phase 0 App.tsx removed; 18 new GREEN tests.

**02-06**

**One-liner:** RepairProvider + QueryBridge bus end-to-end so any 401 from TanStack Query flips RepairBanner without unmounting the page; Wave-0 dev-perf-smoke stub turned GREEN with real subprocess HMR test; 4-scenario e2e test suite covers unpaired-redirect, pair happy-path, paired direct-render, and 401-banner-repair (AUTH-04 SPA-side complete).

## Gates recorded

- verification — `02-VERIFICATION.md`
- code review — `02-REVIEW.md`
- human UAT — `02-HUMAN-UAT.md`
- validation — `02-VALIDATION.md`
