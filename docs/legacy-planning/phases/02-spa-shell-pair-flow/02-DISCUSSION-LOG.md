# Phase 2: SPA Shell + Pair Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 02-spa-shell-pair-flow
**Areas discussed:** Design tone + theme, Routing library, Re-pair UX (401 handling), Schema-drift UX

---

## Design tone + theme

### Polish level for /onboarding

| Option | Description | Selected |
|--------|-------------|----------|
| Spec copy as-is | Plain spec copy (heading + npx commands + 'Click pair URL'). Functional, monospace. Lowest effort; relies on Phase 6 polish to lift it. | |
| Hero + steps + tone (Recommended) | Hero headline + 'one local daemon, every device' framing, numbered steps with copy-to-clipboard on each command, brief 'why local-only' line, soft visual hierarchy. Tone-setting; survives to Phase 6 with light polish. | ✓ |
| Heavy product polish | Marketing-grade landing-page treatment with hero illustration, animated terminal demo, gradient/blur background. High effort, may flunk impeccable:critique anti-AI-slop check. | |

**User's choice:** Hero + steps + tone.
**Notes:** Sets the visual tone for all of Phases 3–6. Anti-AI-slop discipline (no gradients, no hero illustrations, no animated demos) is a hard constraint per impeccable:critique gate.

### Default theme

| Option | Description | Selected |
|--------|-------------|----------|
| Dark default (Recommended) | Dark by default. Matches terminal-adjacent context, pairs with monospace command snippets, scores better on impeccable:critique anti-slop pillars. | ✓ |
| Light default | More 'professional dashboard' feel. Better for screenshots in docs. Trade-off: monospace install commands look heavier on light bg. | |
| System-preference | Auto-match OS preference. Most respectful of user choice but means BOTH themes have to look great from day 1. | |

**User's choice:** Dark default.
**Notes:** Tailwind v4 dark-mode-class strategy (`dark` class on `<html>`); CSS-variable-driven theming.

### Theme toggle location

| Option | Description | Selected |
|--------|-------------|----------|
| /settings only (Recommended) | Theme toggle lives only on /settings page. Keeps chrome clean, set-once affordance. | |
| Header chip + /settings | Sun/moon icon in page header + labeled toggle in /settings. More discoverable; adds chrome. | ✓ |
| No toggle in v1 | Skip the toggle. Lock to one theme; add toggle in Phase 6. Risk: no escape hatch on day 1. | |

**User's choice:** Header chip + /settings.
**Notes:** Toggle UI offers three values (`dark` | `light` | `system`); default is `dark` per D-02. Persisted in `agentic-dashboard:theme` localStorage key.

---

## Routing library

### Library choice

| Option | Description | Selected |
|--------|-------------|----------|
| TanStack Router (Recommended) | Type-safe routes (Zod-validated search params for /pair flow), pairs natively with TanStack Query (already a dep). 1 dep ~12kB. Slightly steeper learning curve. | ✓ |
| React Router v7 | More conventional, larger community. No native search-param typing. ~10kB. | |
| Wouter / minimal | Tiny (~2kB). Enough for Phase 2's 4-5 routes. Trade-off: no nested routes, would outgrow it by Phase 4. | |

**User's choice:** TanStack Router.
**Notes:** Search-param Zod validation is the killer feature for `/pair?agent=…&token=…` — malformed URLs short-circuit at the routing layer.

### Code-splitting strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Per-route lazy (Recommended) | React.lazy() each route component. /onboarding, /pair, /settings, /, /projects/{id} each get their own chunk. | ✓ |
| Single bundle for v1 | Everything in one bundle for v1; revisit in Phase 6. Simpler now; risks needing a refactor pass. | |

**User's choice:** Per-route lazy.
**Notes:** Implemented via TanStack Router's `lazyRouteComponent`.

---

## Re-pair UX (401 handling)

### Surface shape

| Option | Description | Selected |
|--------|-------------|----------|
| Top banner + re-pair CTA (Recommended) | Persistent dismissible banner: 'Agent token rejected. [Re-pair] [×]'. Doesn't block page (stale data still visible). Click → /onboarding pair step. | ✓ |
| Auto-redirect to /onboarding | On 401, immediately redirect with banner. Most decisive but interrupts user; no escape to read stale data. | |
| Modal blocking dialog | Centered modal blocking the page. More intrusive; useful for zero-ambiguity but heavy for recoverable state. | |
| Toast + auto-redirect after 5s | Toast 'Token rejected, re-pairing in 5s...' with [Cancel]. Compromise, defaults to redirect. | |

**User's choice:** Top banner + re-pair CTA.
**Notes:** Consistent with spec acceptance criterion 8: "shows stale data, never crashes". Persists across in-app navigation until 200 from /health clears it OR user dismisses (session-only suppression).

### Auto-retry policy

| Option | Description | Selected |
|--------|-------------|----------|
| No retry, show UI immediately (Recommended) | 401 → banner. Zero retries. Token mismatch is deterministic; retrying is just delay. | ✓ |
| 1 retry with 500ms backoff | Catches D-15 mid-rotation race. Adds ~500ms to genuine 401 detection. | |
| Distinguish 401 vs unreachable | 401 → re-pair UI; ECONNREFUSED → 'Daemon not running' separate UI. More work but more accurate. | |

**User's choice:** No retry, show UI immediately.
**Notes:** Network-level errors (ECONNREFUSED, fetch failure) are still treated as a separate state per Claude's discretion — distinct "Daemon not running" panel, not re-pair flow.

---

## Schema-drift UX

### Surface shape

| Option | Description | Selected |
|--------|-------------|----------|
| Inline panel state (Recommended) | Affected panel renders 'Schema drift detected' state instead of broken UI. Other panels still work. Failed parse logged with Zod issue tree. | ✓ |
| Top banner (global) | App-wide banner. Doesn't tell you WHICH panel — dig into console for details. | |
| Toast + log | Toast for ~5s, full Zod issues in console. Risk: drift goes unnoticed. | |
| Silent log | Console-only. Lowest friction; highest risk of missing it. | |

**User's choice:** Inline panel state.
**Notes:** Panel-scoped via `safeParse()` against shared schemas. Single-user dashboard means console logs ARE seen, but inline state makes it much faster to triage WHICH panel broke.

### Information shown

| Option | Description | Selected |
|--------|-------------|----------|
| Field + expected/got (Recommended) | Failing field path, expected type, actual value. 'Show full diff' button reveals complete Zod issue tree. | ✓ |
| Full Zod issues inline | Render entire flattened Zod issue tree directly. Most detail; busiest UI. | |
| Just 'Schema drift' + reload button | Minimal; user dives into DevTools console. Cleanest; least helpful. | |

**User's choice:** Field + expected/got with disclosure for full diff.
**Notes:** Optimizes for "diagnose in 30 seconds, not 30 minutes" during mid-implementation drift bugs.

---

## Claude's Discretion

Areas where the user did not surface preferences and Claude carries forward the recommended approach (documented in CONTEXT.md `<decisions>` section under "Claude's Discretion"):

- Test strategy (vitest + jsdom + @testing-library/react; Playwright deferred to Phase 6).
- localStorage shape (`PairingSchema` Zod-validated in `packages/shared`).
- Pair-URL agent-host validation regex (per spec line 222).
- Manual-pair flow blocks save until /health 200 + schema parses.
- Header chrome shape (product name + theme chip + ⚙ settings icon; no breadcrumbs in Phase 2).
- Pair URL host (already locked Phase 1 D-21 — `agenticapps-dashboard.pages.dev`; Phase 6 flips to custom domain).
- Hot-reload verification test for SPA-01.

---

## Deferred Ideas

- Confused-deputy "option C" banner-confirmed nonce — Phase 3 alongside `+ Register project` modal (HOME-06). Phase 1 B2 stopgap remains active until then.
- Multi-project home (HOME-01..06) — Phase 3.
- Single-project view (DISC, PHASE) — Phase 4.
- Health column + AgentLinter — Phase 5.
- Keyboard shortcuts, install-launchd/systemd, impeccable critique gate, two-stage review — Phase 6.
- Custom domain flip — Phase 6.
- Playwright / visual-regression tests — Phase 6 polish.
- `/settings/projects` (Phase 3) and `/settings/integrations` (Phase 5) sub-routes.
- PWA / service-worker / installable — out of v1 scope.
- i18n / RTL — single-user, English-only by spec.
