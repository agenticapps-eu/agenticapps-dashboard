# Phase 05.1: UI Redesign — Cloudflare-Inspired Sidebar Dashboard Shell -

**Archived from GSD phase `DASH-05.1-ui-redesign-cloudflare-inspired-sidebar-dashboard-shell`. Completed 2026-05-09.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/DASH-05.1-ui-redesign-cloudflare-inspired-sidebar-dashboard-shell/` — that tree, not this file, is the authoritative record.

## Why

A **UI-only redesign** of the SPA shell and route layouts. No backend changes, no new features, no removed capabilities — every panel, route, query, and daemon contract that ships today continues to ship after 5.1. What changes is *the chrome around them*.

In scope:
- Replace the current top-header-only navigation with a **sidebar-driven shell** inspired by Cloudflare's dashboard surfaces.
- Restructure the four existing routes (`/`, `/projects/:id`, `/settings`, `/help`) inside the new shell.
- Establish a **design-system layer** (tokens, typography scale, spacing scale, component primitives) so future phases stop redefining one-offs.
- Polish the visual quality of all existing panels to fit the new shell — no anti-AI-slop regressions; ideally improve toward the Phase 6 impeccable ≥ 90 gate.
- Keep `/onboarding` and `/pair` deliberately out of the sidebar — those are pre-paired surfaces.

Out of scope (see Deferred):
- New panels, new routes, new daemon endpoints.
- Cmd+K command palette redesign (Phase 3 D-3-09 implementation kept; visual polish allowed).
- Theme system rework beyond the existing light/dark toggle.

## Capabilities affected

- `openspec/specs/design-system/spec.md`

## What shipped

**05.1-01**

### Token Foundation (Task 1)

`packages/spa/src/styles/tokens.css` is the new single source of truth. It uses Tailwind 4's `@theme` directive so utilities like `bg-card-bg`, `text-text-primary`, `shadow-card`, `rounded-card` are auto-generated from the locked values — no hex literals needed in component code.

**Token translation table (UI-SPEC names → tokens.css Tailwind-4 names → utility):**

| UI-SPEC name | tokens.css name | Tailwind utility |
|---|---|---|
| `--bg-app: #FAFAF7` | `--color-app-bg` | `bg-app-bg` |
| `--bg-sidebar: #F8F6F3` | `--color-sidebar-bg` | `bg-sidebar-bg` |
| `--bg

**05.1-02**

**7 sidebar/topbar/breadcrumb components built with TDD, composed into AppShellV2, wired into router via VITE_APPSHELL_V2 flag using two independent rootRoute instances to avoid addChildren mutation collision**

**05.1-03**

### Task 1 — PageHeader integration in MultiProjectHome (V2-gated)

`MultiProjectHome.tsx` now reads `import.meta.env.VITE_APPSHELL_V2 === '1'` at the top of its function body. When true:

- Renders `<PageHeader title="Projects" helper={headerHelper} />` before the toolbar/grid
- `headerHelper` is derived from `useLastRefresh()`: `"{N} projects · {refreshLabel}"` when count is available, empty string while loading
- Drops the inner `px-6 py-8 md:px-8` wrapper in V2 mode (AppShellV2 already provides `p-6` outer padding)
- Legacy mode (`flag=OFF`): renders identically to pre-Phase-5.1 (HomeLayou

**05.1-04**

PanelContainer + InlineDrift + all 13 production panels migrated from legacy `[--*]` CSS variable aliases to Tailwind 4 namespaced tokens (`bg-card-bg`, `text-text-primary`, etc.); SingleProjectView gains PageHeader V2-gate and gap-6 column rhythm.

**05.1-05**

### Token Infrastructure (Task 1 prerequisite)

**`packages/spa/src/styles/tokens.css`** — Tailwind 4 `@theme` block locking Phase 5.1 palette:
- `--color-app-bg: #FAFAF7`, `--color-card-bg: #FFFFFF`, `--color-card-bg-hover: #F5F5F0`
- `--color-border-subtle: #E8E8E3`, `--color-text-primary: #1A1A18`, `--color-text-secondary: #6B6B63`, `--color-text-tertiary: #9B9B93`
- `--color-accent: #6B46C1`, `--color-accent-hover: #5A389F`
- `--color-status-error: #B53D3D`, `--color-status-warning: #C17E3D`, `--color-status-success: #2D7A4F`
- Shadow, radius, and z-index ladder tokens

**`packages/spa/src

**05.1-06**

### Task 1 — Flag Flip + Conditional Stripping

**`packages/spa/src/router.tsx`** — Rewrote from dual-tree flag-conditional to a single clean AppShellV2 route tree:
- Deleted: `const useV2 = import.meta.env.VITE_APPSHELL_V2 === '1'`
- Deleted: entire `legacyRootRoute` / `legacyRouteTree` / `legacyRouter` block
- Deleted: `import { AppShell }` import
- Single `routeTree` with `appShellLayoutRoute` (id: `_appshell`) wrapping 4 paired routes; `/onboarding` and `/pair` at rootRoute (D-5.1-03)
- `Register` interface now types against the single `router` (not `legacyRouter`)

**Route-level stripping

## Gates recorded

- verification — `05.1-VERIFICATION.md`
- human UAT — `05.1-HUMAN-UAT.md`
- validation — `05.1-VALIDATION.md`
