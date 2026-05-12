# Phase 7: Help docs v1.0 — Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Mode:** Auto (`--auto`; recommended defaults selected; user pre-approved 3 foundational decisions via AskUserQuestion)

<domain>
## Phase Boundary

Land the v1.0 `/help` docs site as a self-contained subsystem in the SPA: MDX-driven pages, sidebar/main/sticky-TOC layout, lazy-loaded widget stubs, and a TanStack-Router code-based route tree mounted at `/help/*`. **Scope is fixed by `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/MIGRATION-INSTRUCTIONS.md` and the five anchor MDX pages + ~25 stub paths + 8 widget stubs already authored there.**

**In scope:**
- 5 anchor MDX pages: `landing` (slug `/help`), `workflow/overview`, `repos/overview`, `observability/overview`, `operations/install`.
- ~25 stub paths rendering `<ComingSoon section title />` (workflow x9, repos x6, observability x7, operations x4, reference x4 + 2 newly-required workflow stubs — see D-7-13).
- Shell components: `HelpLayout` (sidebar + main + mobile drawer), `HelpWidget` (lazy dispatch), `HelpHook` (in-page deep-link), `ComingSoon`.
- 8 widget stub components (`RepoTopologyMap`, `WorkflowStateMachine`, `GatePicker`, `TraceVisualizer`, `ScanReportPlayground`, `ApplyConsentSimulator`, `MigrationDryRun`, `SlashCommandCatalog`) — each a thin wrapper around the shared `WidgetStub` primitive.
- Replacement of the existing `/help` route (keyboard-shortcuts page) with the new docs landing; keyboard-shortcuts content migrates to a new `/help/reference/shortcuts` MDX page.
- MDX pipeline: `@mdx-js/rollup` Vite plugin + `remark-gfm` + `remark-frontmatter` + `remark-mdx-frontmatter`.
- Mermaid runtime rendering for fenced ` ```mermaid ` blocks via a lazy `<MermaidBlock>` MDX component.
- `@tailwindcss/typography` v0.5.x registered into the Tailwind v4 stylesheet (`@plugin "@tailwindcss/typography";` in `global.css`) so `prose` and `prose-slate dark:prose-invert` classes resolve.
- Two-stage review + impeccable critique ≥ 90 on `/help` (lg, 1440x900) before merging.

**Out of scope (deferred — see `<deferred>`):**
- HelpHook in-dashboard usages (component ships; consumer wiring is v1.1).
- Search index (MiniSearch / Fuse.js) — sidebar search input ships disabled, wired in v1.1.
- Real widget implementations — all 8 stay as stubs until v1.2.
- pi/codex repo deep-dives and reference section MDX (glossary, ADR index, changelog, contributing) — stub-only in v1.0; written in v1.3/v1.4.
- a11y audit beyond `aria-label` + `aria-current` on nav links (full audit is v1.4).
- Side-panel mode for `HelpHook` (`panel={true}` falls through to navigate; real side-panel is v1.1+).

The phase MUST NOT introduce a Cloudflare Worker / Pages Function; the SPA remains pure static (project non-negotiable). The phase MUST keep zero third-party service dependencies (project non-negotiable).
</domain>

<decisions>
## Implementation Decisions

### User-locked decisions (from AskUserQuestion at phase kickoff)

- **D-7-01:** **Replace `/help` with the docs site; fold keyboard-shortcuts content into a new `/help/reference/shortcuts` MDX page.** The new docs site takes the canonical `/help` route. The current `routes/help.lazy.tsx` (KbdHint table + common tasks + "see README for full docs" link) is deleted; its content is rewritten as MDX at `packages/spa/src/help/pages/reference/shortcuts.mdx` and exposed in `HelpLayout`'s NAV under the **Reference** section, marked `status: "ready"`. The `?` keyboard shortcut (`useGlobalShortcuts` → `navigate({ to: '/help' })`) is unchanged; it now lands on the docs landing page, which links to `/help/reference/shortcuts` in the "Reference" sidebar group.
  - **Why:** Migration doc's design wants `/help` for the docs site. Existing `/help` is substantive (used by `?` shortcut, referenced in onboarding + Phase 06 docs) but the keyboard-shortcuts content is naturally docs content — folding it into the docs site preserves both surfaces. User chose this option over keeping `/help` as shortcuts + putting docs at `/docs`.
  - **How to apply:** Planner produces a plan that (a) deletes `packages/spa/src/routes/help.lazy.tsx` and `packages/spa/src/routes/__tests__/help.test.tsx`, (b) creates the new docs route tree, (c) authors `reference/shortcuts.mdx` rendering the existing KbdHint table + common-tasks list via MDX with a custom `KbdHint`-aware code block or inline JSX, (d) adds `{ label: "Keyboard shortcuts", path: "/help/reference/shortcuts", status: "ready" }` to `HelpLayout` NAV's Reference section (as the first entry before Glossary).

- **D-7-02:** **Base commit: current `origin/main` (`26e78c7`).** Feature branch `feat/help-docs-v1` was cut off `origin/main` at session start (verified pre-discuss). The migration doc's "off the same base as the redesign branch" instruction was written when phase-05.1 was in-flight; that branch is now fully merged into main as part of v1.0 (PR #15), so branching off main IS branching off the post-redesign base. No alternative base is technically viable — the migration's stack assumptions (Vite, Tailwind, shadcn-equivalent tokens) require the post-v1.0 SPA.
  - **Why:** The redesign is merged; "same base as redesign" semantically resolves to "same base as the merged redesign's tip" = `26e78c7`. Branching off the historical `616e41f` merge-base would lose the entire v1.0 stack (no Tailwind v4 plugin, no AppShellV2, no design tokens).
  - **How to apply:** Already done — `git checkout -b feat/help-docs-v1 origin/main` ran before this CONTEXT.md was written. PR will target `main`, NOT any redesign branch.

- **D-7-03:** **Phase slot: Phase 7, inserted into the v1.0 milestone (post-ship).** The roadmap's previously-planned Phase 7 (Optional Integrations / Sentry / Linear / Infisical) is renumbered to Phase 8; previously-planned Phase 8 (Open-source readiness) is renumbered to Phase 9. The v1.0 milestone now spans Phases 0–7. Phase 7 directory is `.planning/phases/07-help-docs-v1-0/` (slug auto-derived from phase name via `gsd-tools init`; the slug `help-docs-v1-0` differs cosmetically from the branch name `feat/help-docs-v1` but the `gsd-tools` slug generator treats the `1.0` in "v1.0" as `1-0`).
  - **Why:** User chose this over `/gsd-new-milestone` (heavier) or decimal Phase 06.2 (mixes new-product scope with polish-phase naming). Help-docs is new product scope, not polish.
  - **How to apply:** ROADMAP.md updated in pre-discuss step: phase listing, milestones block, Phase Details section, Progress table, Execution Order. CLAUDE.md "Phase 7+ = Sentry/Linear/Infisical" reservation now resolves to Phase 8+.

### MDX Pipeline (auto: recommended)

- **D-7-04:** **`@mdx-js/rollup` Vite plugin with `enforce: 'pre'` and remark plugin chain `[remarkGfm, remarkFrontmatter, remarkMdxFrontmatter]`.** Adds five npm deps to the pnpm catalog: `@mdx-js/react`, `@mdx-js/rollup`, `remark-frontmatter`, `remark-mdx-frontmatter`, `remark-gfm`. Vite config update goes in `packages/spa/vite.config.ts`. The plugin must run BEFORE `@vitejs/plugin-react` so MDX → JSX transform completes before React refresh injection; the `@vitejs/plugin-react` `include` regex must also be widened to match `\.mdx$`.
  - **Why:** This is the canonical Vite + MDX pipeline (matches migration Step 7 verbatim, adapted from the migration doc's npm install to pnpm catalog). `remark-mdx-frontmatter` exports the frontmatter as a named `frontmatter` const from each MDX module so we can read `slug` / `title` / `order` for breadcrumbs and `<title>` updates.
  - **How to apply:** Planner produces a Wave-0 infrastructure plan: catalog bump (`pnpm-workspace.yaml` + `packages/spa/package.json` adding `catalog:` refs), vite.config.ts edit, smoke test (assert that importing a `.mdx` file resolves and renders).

- **D-7-05:** **Wrap the SPA root with `<MDXProvider components={mdxComponents}>` in `packages/spa/src/main.tsx`,** passing `{ HelpWidget, HelpHook, MermaidBlock }` so MDX pages can use `<HelpWidget name="..." />` and ` ```mermaid ` blocks without explicit imports. The provider must sit inside the existing `<StrictMode>` → `<RepairProvider>` → `<QueryBridge>` ladder (specifically: BETWEEN `<QueryBridge>` and `<RouterProvider>`, so MDX-rendered components have access to React Query + repair context but the provider doesn't leak into the router error boundaries).
  - **Why:** Migration Step 10 requires it. Placement matters: too high blocks repair errors from seeing MDX renders; too low (inside route component) requires per-route wrapping.

### Router translation (auto: recommended; the largest stack delta)

- **D-7-06:** **Translate the migration's `react-router-dom` `<Routes>` to TanStack code-based routes generated programmatically from a single route table in `packages/spa/src/router.tsx`.** Add a pathless layout route `_helpLayout` (child of `appShellLayoutRoute`) whose component is `HelpLayout`. Under it: 1 index route (`/help` → landing), 5 anchor routes (one per MDX page), 4 redirect routes (`/help/workflow` → `/help/workflow/overview` etc.), and 27 stub routes (ComingSoon, parameterized by section + title), all generated from a `helpRouteTable` array.
  - **Why:** The dashboard's existing router (`packages/spa/src/router.tsx`) uses TanStack code-based routes throughout — adding 30+ file-based lazy routes would clash with that convention. A code-generated route table is DRY (one entry per page, not per file), keeps the route tree statically analyzable (TanStack can match without runtime dispatch), and matches the migration's `HelpRoutes.tsx` shape line-for-line. Catch-all-with-internal-dispatch (Option C) was rejected because it loses TanStack's static route matching for the help routes (no breadcrumb, no `<Link to>` autocomplete).
  - **How to apply:** Planner produces a plan that adds a `packages/spa/src/help/helpRouteTable.ts` exporting the table, a `packages/spa/src/help/buildHelpRoutes.ts` factory that turns the table into TanStack `createRoute(...)` instances under `appShellLayoutRoute`, lazy imports per anchor page (`./pages/landing.lazy.tsx` etc., each one-liner re-exporting the MDX default export wrapped in a thin `HelpPage` shell), and a wildcard child route `*` that pushes to `/help` (matches `<Navigate to="/help" replace />`).

- **D-7-07:** **Anchor pages use `createLazyRoute` with `import()` for code-splitting.** Each anchor route's lazy module exports a `Route` matching TanStack's `createLazyRoute('/help/...')({ component: ... })` shape. The component reads the MDX module's default export (the rendered MDX) and the `frontmatter` named export for breadcrumb + document.title.
  - **Why:** Matches existing TanStack patterns in the SPA (e.g. `routes/pair.lazy.tsx`, `routes/help.lazy.tsx` being replaced). Keeps initial bundle small — only the landing page MDX loads on first visit to `/help`.

- **D-7-08:** **Stub routes use a single shared `<ComingSoonRoute section title />` component** instead of one MDX/lazy file per stub. Each stub route's `component` prop receives a thin wrapper that calls `<ComingSoon section={...} title={...} />`.
  - **Why:** 27 separate MDX files just to render the same `ComingSoon` component would inflate the bundle and the test surface; one parameterized component covers all stubs cleanly.

### Tailwind v4 typography (auto: recommended)

- **D-7-09:** **Register `@tailwindcss/typography` via CSS `@plugin` directive in `packages/spa/src/styles/global.css`** (Tailwind v4 plugin registration syntax): add `@plugin "@tailwindcss/typography";` immediately after `@import "tailwindcss";`. Add `@tailwindcss/typography` to the pnpm catalog at the latest v0.5.x. The `prose prose-slate dark:prose-invert max-w-none` classes in `HelpLayout` then resolve.
  - **Why:** Tailwind v4 uses CSS-side plugin registration; there is no `tailwind.config.ts`. Tailwind Typography v0.5.x is compatible with Tailwind v4 (verified by maintainer notes). Without this directive, all the `prose-*` classes silently no-op.
  - **How to apply:** Planner verifies `@plugin` directive registration in global.css and that `prose` resolves in a smoke test. If v0.5.x has any unexpected v4 quirk, fall back to authoring a minimal `prose-equivalent.css` with the article typography rules — but try `@plugin` first.

### Mermaid renderer (auto: recommended)

- **D-7-10:** **Runtime Mermaid rendering via a lazy `<MermaidBlock>` MDX component that calls `mermaid.run()` on mount.** Add `mermaid` (^11.x) to the pnpm catalog. Author `packages/spa/src/help/components/MermaidBlock.tsx` that: (a) accepts MDX `code` children with `className="language-mermaid"`, (b) lazy-imports `mermaid` on mount via `React.lazy` or `useEffect + dynamic import`, (c) calls `mermaid.initialize({ startOnLoad: false, theme: ... })` once and `mermaid.run({ nodes: [ref] })` on mount, (d) renders a `<pre className="mermaid">{code}</pre>` slot for mermaid to replace with SVG. Register `<MermaidBlock>` in `mdxComponents` (passed to `<MDXProvider>`) as the renderer for `code` blocks with that language class.
  - **Why:** Pre-rendering to SVG at build time (Option B) would need a build-time Mermaid hook (extra Vite plugin); custom SVG placeholders (Option C) means rewriting every diagram in every page. Runtime render is the lowest-risk path that keeps page MDX exactly as-authored. The `mermaid.run()` call is the canonical API for runtime rendering against existing DOM nodes.
  - **How to apply:** Planner produces a small plan: catalog dep, component file, smoke test that renders `workflow/overview.mdx` and asserts the resulting DOM contains an SVG child of the mermaid container.

### Design-token translation (auto: critical for visual coherence)

- **D-7-11:** **Translate shadcn-style token references in the migrated `.tsx` files to the dashboard's locked `tokens.css` token names at copy time** (NOT by adding shadcn aliases to tokens.css). Translation map (non-exhaustive — planner expands as needed):
  - `bg-background` → `bg-app-bg`
  - `bg-card` → `bg-card-bg`
  - `bg-accent` (chrome hover) → `bg-card-bg-hover`
  - `bg-muted/30` → `bg-sidebar-bg/60` (or token alias for soft secondary surface)
  - `bg-muted/60` → `bg-sidebar-bg`
  - `bg-primary` → `bg-accent`
  - `bg-primary/90` (hover) → `bg-accent-hover`
  - `bg-destructive/5` (error wash) → `bg-status-error/10`
  - `text-foreground` → `text-text-primary`
  - `text-foreground/70` → `text-text-secondary`
  - `text-muted-foreground` → `text-text-secondary` (or `text-text-tertiary` for very subtle text)
  - `text-primary` → `text-accent`
  - `text-primary-foreground` (button text on purple) → `text-card-bg` (white-equivalent on accent)
  - `text-accent-foreground` (active nav link) → `text-accent`
  - `text-destructive` → `text-status-error`
  - `border` (default neutral) → `border-border-subtle`
  - `border-r` (sidebar separator) → `border-r border-border-subtle`
  - `border-destructive/40` → `border-status-error/40`
  - `border-muted` (dashed placeholder) → `border-border-subtle`
  - `focus:ring-ring` → `focus:ring-accent`
  - **Why:** Phase 05.1 explicitly locked the warm-paper token set (`--color-app-bg: #FAFAF7`, `--color-accent: #6B46C1`, etc.). Mixing shadcn neutral grays (`bg-background` resolving to white-on-dark-mode) would break the visual coherence the redesign was built to establish. The `tokenSourceOfTruth.test.ts` invariant (Phase 05.1) actively scans `packages/spa/src/components/` for hex literals — any leaked shadcn token would either resolve to wrong colors or fail the test.
  - **How to apply:** Planner produces a translation step in each component-copy plan. The translation is mechanical (sed-able) but planner audits each `className` block for tokens not in the table above and resolves them case-by-case.

- **D-7-12:** **`HelpLayout` shell sits at the SAME nesting level as `AppShellV2`'s main content (not inside it).** `HelpLayout` provides its own sidebar + content surface — it is a peer of `MultiProjectHome`, not a child of `PanelContainer`. The shell renders only when the user is on a `/help/*` route. Top-level `AppShellV2` chrome (sidebar nav, top-bar) is **hidden on `/help/*` routes** to give the docs site full chrome control (matches the migration's intent — the help site has its own sidebar nav).
  - **Why:** Stacking two sidebars (AppShellV2's project nav + HelpLayout's section nav) would create two-column-of-nav chrome that's visually broken and impeccable-failing. The migration's HelpLayout assumes it owns the chrome.
  - **How to apply:** Planner adds a sibling layout route `_helpLayout` directly under `rootRoute` (NOT under `appShellLayoutRoute`) so `/help/*` bypasses `AppShellV2`. This mirrors the Phase 5.1 D-5.1-03 pattern where `/onboarding` and `/pair` stay at `rootRoute` to bypass the shell.

### Missing stubs in HelpRoutes table (auto: in-scope fix)

- **D-7-13:** **Add 2 additional workflow stubs to the route table beyond the migration's HelpRoutes.tsx listing:** `/help/workflow/rationalization-table` (referenced in `workflow/overview.md:138`) and `/help/workflow/red-flags` (referenced in `workflow/overview.md:140`). Without these, the verification checklist item "all internal `/help/*` links resolve" fails — clicking either link falls through to the catch-all redirect to `/help`, losing user context.
  - **Why:** Reviewer checklist item is binding scope. Adding two extra `<ComingSoon>` stubs is one-line table entries; rewriting the source MDX to remove the links is a worse fix because it loses the v1.1 backlog signal.
  - **How to apply:** Planner appends the two entries to `helpRouteTable`; `HelpLayout` NAV gets them appended to the Workflow group (status: "stub").

### Widget split (auto: recommended)

- **D-7-14:** **Ship all 8 widget stubs as separate `.stub.tsx` files** even though only 3 are referenced in v1.0 anchor pages (`RepoTopologyMap`, `ScanReportPlayground`, `MigrationDryRun`). Each file imports `WidgetStub` from `_stub-pattern.tsx` and exports a default function calling `<WidgetStub title=... description=... emoji=... />`. The descriptions/emojis are copied verbatim from `_shell/widgets/_stub-pattern.tsx`.
  - **Why:** The `HelpWidget` dispatch table is what makes adding widgets later cheap. Five extra one-screen files cost ~50 lines total; deferring them would force a code change to ship the first v1.1 page that references them. The `_stub-pattern.tsx` file is then stripped of its 8 concrete exports — it ends up with only the shared `WidgetStub` component + `WidgetStubProps` type (per migration Step 5 close).
  - **How to apply:** Planner produces 8 stub files + the pruned `_stub-pattern.tsx` in one plan.

### Tests (auto: recommended TDD coverage)

- **D-7-15:** **Test surface for Phase 7:**
  - `HelpLayout`: sidebar renders all NAV sections, NavLink isActive styling fires on current path, mobile drawer toggles open/close, status="stub" entries render `(soon)` tag — vitest + RTL.
  - `HelpWidget`: known widget dispatch renders the stub via `React.lazy` (Suspense fallback then resolved), unknown widget renders the bordered error message.
  - `HelpHook`: `topicToUrl` pure function returns expected URL strings for `workflow.gates` / `observability.scan#high-confidence` (table-driven test), click navigates via `useNavigate()`, tooltip toggles on hover/focus.
  - `ComingSoon`: renders title + section + back-link, `section: "operations"` back-links to `/help/operations/install` instead of `/help/operations/overview` (table-driven).
  - `MermaidBlock`: smoke — renders a `<pre className="mermaid">` slot; intentionally does NOT assert on SVG output (mermaid library renders asynchronously in jsdom, async assertion would be flaky — defer to e2e).
  - Route tree: each anchor page renders its MDX content (smoke), each section-overview redirect navigates correctly, the workflow `*` catch-all pushes to `/help`.
  - `helpRouteTable`: snapshot test of the table ensures stub paths match the count in the migration HelpRoutes (plus the 2 from D-7-13).
  - E2E: Vite dev server + `@playwright/test` (already in catalog) walking the reviewer checklist — `/help` landing, each anchor page, 3 random stubs, dark-mode toggle, mobile viewport sidebar drawer.
  - **Why:** Coverage matches Phase 02/03/06 norms (~10–20 tests per panel). The e2e walkthrough is the reviewer checklist made automatable so we don't re-walk it manually after every commit.

### Plan decomposition (auto: recommended; planner may refine)

- **D-7-16:** **5 plans:**
  - `07-01-PLAN.md` — **Wave 0 infrastructure**: pnpm catalog adds (`@mdx-js/react`, `@mdx-js/rollup`, `remark-gfm`, `remark-frontmatter`, `remark-mdx-frontmatter`, `@tailwindcss/typography`, `mermaid`), `vite.config.ts` MDX plugin + plugin-react regex widening, `global.css` `@plugin "@tailwindcss/typography";`, `main.tsx` `<MDXProvider>` wiring, smoke test for `.mdx` imports + `prose` resolution.
  - `07-02-PLAN.md` — **Wave 1 shell components** (parallel with 07-03): copy + translate-tokens for `HelpLayout`, `HelpWidget`, `HelpHook`, `ComingSoon`, `MermaidBlock`. Adapt `HelpLayout` from `react-router-dom` (`Outlet`, `NavLink`, `Link`) to TanStack (`Outlet`, `Link`). Adapt `HelpHook` from `useNavigate` (`react-router-dom`) to `useNavigate` (`@tanstack/react-router`). Tests per D-7-15.
  - `07-03-PLAN.md` — **Wave 1 widget stubs** (parallel with 07-02): 8 `.stub.tsx` files + pruned `_stub-pattern.tsx`. Smoke test that each default export renders without error.
  - `07-04-PLAN.md` — **Wave 2 page content**: copy all 5 anchor pages from `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/*.md` to `packages/spa/src/help/pages/**/*.mdx`, verify frontmatter intact, verify Mermaid blocks parse, verify `<HelpWidget>` JSX inside MDX resolves. Author `reference/shortcuts.mdx` from the existing `/help` keyboard-shortcuts content. No code-change plans — content + frontmatter validation only.
  - `07-05-PLAN.md` — **Wave 3 route wiring + verification**: build `helpRouteTable`, `buildHelpRoutes` factory, mount under new `_helpLayout` peer to `_appshell`; delete old `routes/help.lazy.tsx` + `routes/__tests__/help.test.tsx`; wire `<MDXProvider>` components map; redirects + catch-all; Playwright e2e walking reviewer checklist; impeccable critique ≥ 90 on `/help` (lg, 1440x900); browse-screenshot evidence for verification.
  - **Why:** Tight wave dependencies — infrastructure first, shell+stubs in parallel, then content (which depends on shell components being importable), then routes (which depend on all three).

### Verification (binds to ROADMAP success criteria 1–8)

- **D-7-17:** **VERIFICATION.md must have 1:1 evidence per HELP-01..HELP-06 requirement AND ROADMAP success criteria 1–8.** Evidence types:
  - Reviewer-checklist e2e Playwright report (browser console capture asserts no errors).
  - `/browse` screenshots at desktop (1440×900) + mobile (375×800) committed under `.planning/phases/07-help-docs-v1-0/evidence/`.
  - impeccable critique JSON report for `/help` route at lg breakpoint.
  - `pnpm -r typecheck && pnpm -r test && pnpm lint && pnpm -r build` exit-zero log.

### Claude's Discretion

- **Plan ordering within waves** — planner may merge 07-02 and 07-03 into a single Wave-1 plan if the executor capacity allows, but the migration steps map more cleanly as two.
- **Mermaid theme selection** — `mermaid.initialize({ theme: 'base', themeVariables: {...} })` with theme variables sourced from `tokens.css` (purple accent, warm-paper bg). Planner picks the exact variables that look right; fallback to `theme: 'default'` is acceptable for v1.0 if the warm-paper theming proves fiddly.
- **Sidebar mobile drawer animation** — migration uses plain `hidden`/`block` toggle. Planner may add a CSS transition if the impeccable critique flags abrupt toggles, but the migration intent is functional, not animated.
- **`KbdHint` reuse in shortcuts MDX** — `packages/spa/src/components/ui/KbdHint.tsx` already exists (Phase 5.1). The `reference/shortcuts.mdx` page should reference it via MDX (passed in `mdxComponents`) rather than duplicating the visual.
- **Document title format** — `document.title = '${frontmatter.title} — AgenticApps Dashboard Help'`. Planner picks the exact separator/casing if needed for impeccable copy review.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Migration spec (the binding contract)

- `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/MIGRATION-INSTRUCTIONS.md` — 12-step procedure; the spec for this phase. **Note for planner:** Steps 6–10 assume `react-router-dom` + npm + Tailwind v3 + single-package layout; translate to pnpm catalog + TanStack Router + Tailwind v4 + `packages/spa/` layout per D-7-04..D-7-12.

### Source shell components (verbatim — translate tokens + router, otherwise copy)

- `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/HelpRoutes.tsx` — the `react-router-dom` route table to translate into `helpRouteTable.ts`.
- `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/HelpLayout.tsx` — sidebar + main shell.
- `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/components/HelpWidget.tsx` — lazy widget dispatcher.
- `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/components/HelpHook.tsx` — in-page deep-link.
- `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/components/ComingSoon.tsx` — stub placeholder.
- `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/widgets/_stub-pattern.tsx` — `WidgetStub` primitive + 8 concrete stubs to split (Step 5).

### Source MDX content (5 anchor pages)

- `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/landing.md` — slug `/help`, frontmatter `{ slug, title, order, section }`.
- `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/workflow/overview.md` — contains 1 Mermaid block.
- `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/repos/overview.md` — contains 1 `<HelpWidget name="RepoTopologyMap" />` + 1 Mermaid.
- `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/observability/overview.md` — contains 2 Mermaid blocks + 1 `<HelpWidget name="ScanReportPlayground" />`.
- `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/operations/install.md` — contains 1 `<HelpWidget name="MigrationDryRun" />`.

### Dashboard locked refs

- `.planning/PROJECT.md` §"Non-negotiables" — no Cloudflare Functions in v1, optional integrations stay optional, anti-AI-slop self-test (`impeccable:critique` ≥ 90).
- `.planning/ROADMAP.md` §"Phase 7" — success criteria 1–8 (the binding acceptance bar).
- `packages/spa/src/styles/tokens.css` — design tokens (single source of truth; locked Phase 5.1).
- `packages/spa/src/styles/global.css` — Tailwind v4 entry; `@plugin "@tailwindcss/typography";` lands here.
- `packages/spa/vite.config.ts` — Vite + Tailwind v4 plugin; `@mdx-js/rollup` plugin lands here.
- `packages/spa/src/router.tsx` — TanStack code-based route tree; `helpRouteTable` mounts here.
- `packages/spa/src/main.tsx` — React root; `<MDXProvider>` lands here.
- `packages/spa/src/routes/help.lazy.tsx` — **to be DELETED** in Plan 07-05 (replaced by docs landing).
- `packages/spa/src/routes/__tests__/help.test.tsx` — **to be DELETED** (test covered old content).
- `packages/spa/src/lib/useGlobalShortcuts.ts` — confirms `?` → `navigate({ to: '/help' })` is unchanged; lands on docs landing.
- `packages/spa/src/components/ui/KbdHint.tsx` — reused inside `reference/shortcuts.mdx` via MDX `components` map.
- `pnpm-workspace.yaml` — catalog block; 7 new entries land here.
- `~/.claude/CLAUDE.md` §"GSD Phase Execution Hooks" — pre-phase brainstorming + dev-server + `/browse`; post-phase `/review`, `/cso` (if needed), `/qa`.
- `.claude/skills/agenticapps-workflow/skill/SKILL.md` — workflow enforcement (commitment ritual, TDD, two-stage review, verification-before-completion).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`KbdHint` (`packages/spa/src/components/ui/KbdHint.tsx`)** — the rendered keyboard-key chip, already used in the existing `/help` route. Reuse inside `reference/shortcuts.mdx` rather than re-implementing.
- **`useGlobalShortcuts` (`packages/spa/src/lib/useGlobalShortcuts.ts`)** — the `?` → `/help` binding already exists; D-7-01 requires NO change to this hook.
- **TanStack Router patterns (`router.tsx`)** — code-based `createRoute` factory pattern is already established; `appShellLayoutRoute` pathless layout pattern is the model for `_helpLayout`.
- **`tokens.css` (`packages/spa/src/styles/tokens.css`)** — full token set locked Phase 5.1; D-7-11 translation map binds to these names.
- **`@tailwindcss/vite` plugin** — already wired in `vite.config.ts`; D-7-09 adds the typography plugin via `@plugin` directive in the existing global.css.
- **`@playwright/test`** — already in catalog (Phase 6); Plan 07-05 e2e tests use it without new dep.

### Established Patterns

- **Code-based TanStack routes with lazy child route imports** — every existing route in `routes/*.lazy.tsx` follows `createLazyRoute('/path')({ component })`. D-7-07 anchor pages follow this exactly.
- **Pathless layout route at root** — `appShellLayoutRoute` (id `_appshell`) was Phase 5.1 D-5.1-03's pattern for "this layout wraps these routes but doesn't add a path segment." D-7-12 uses the same pattern for `_helpLayout` as a peer (NOT child) of `_appshell` so `/help/*` bypasses the dashboard chrome.
- **`@tanstack/react-query` + repair context** — `<QueryBridge>` provides query client + repair context to all routes. MDX content rendered via `<MDXProvider>` (D-7-05) lands inside this provider chain so widget stubs can use query hooks if needed in v1.2.
- **Atomic commits per task with TDD `test(RED): / feat(GREEN):` pattern** — Phase 02–06 norm. Test-first commits + green-commits are part of the verification evidence.

### Integration Points

- **`packages/spa/src/main.tsx`** — `<MDXProvider>` wrapper lands here (Wave 0).
- **`packages/spa/vite.config.ts`** — `@mdx-js/rollup` plugin + `@vitejs/plugin-react` regex widening (Wave 0).
- **`packages/spa/src/styles/global.css`** — `@plugin "@tailwindcss/typography";` directive (Wave 0).
- **`packages/spa/src/router.tsx`** — `_helpLayout` peer-layout-route + `helpRouteTable` mount point (Wave 3).
- **`packages/spa/src/routes/help.lazy.tsx`** — **deleted** (Wave 3); replaced by docs landing route.
- **`packages/spa/src/routes/__tests__/help.test.tsx`** — **deleted** (Wave 3); replaced by route-tree tests and per-component tests under `packages/spa/src/help/__tests__/`.
- **`pnpm-workspace.yaml` `catalog:` block** — 7 new entries (Wave 0).
- **`packages/spa/package.json`** — 7 new `catalog:` references in `dependencies` (Wave 0).

</code_context>

<specifics>
## Specific Ideas

- **User chose "replace /help" over the alternatives** during the foundational AskUserQuestion. The intent: docs are the primary `/help` surface; the old shortcut table is content that belongs IN the docs, not a separate surface.
- **PR targets `main`, NOT any redesign branch** — explicitly called out in the user's task instruction. The "ship independently" phrasing means the docs PR's merge does not depend on any other in-flight work.
- **Reviewer checklist (migration §"Verification before merge") is binding scope** — all 8 items must pass before PR opens. D-7-13 specifically adds 2 stubs to make item 6 (all internal links resolve) achievable without rewriting source MDX.

</specifics>

<deferred>
## Deferred Ideas

These ideas came up during analysis but belong in later phases. Do NOT act on them in Phase 7.

- **v1.1 — fill highest-value missing stubs**: workflow commitment-ritual/gates/two-stage-review/verification, observability install/scan/apply, operations slash-commands. Each is currently a `ComingSoon` stub.
- **v1.1 — wire `<HelpHook>` into existing dashboard pages**: PanelContainer headers, error states, onboarding hints. Decide which topics provide value; add hooks one at a time.
- **v1.1 — sidebar search**: MiniSearch or Fuse.js with a build-time index over MDX page contents. Sidebar input ships disabled in v1.0.
- **v1.1 — `HelpHook` side-panel mode (`panel={true}`)**: currently falls through to `navigate()`. Real side-panel renders without losing dashboard context.
- **v1.2 — real widget implementations**: replace all 8 `.stub.tsx` with real components. `RepoTopologyMap` is force-directed graph, `WorkflowStateMachine` is animated state machine, etc. See `_stub-pattern.tsx` descriptions.
- **v1.3 — repo deep-dives + reference section**: `/help/repos/{core,claude,pi,codex,dashboard,projects}` and `/help/reference/{glossary,adr-index,changelog,contributing}` — currently all stubs.
- **v1.3 — pi/codex pages**: cross-host docs. Currently the docs are dashboard-centric.
- **v1.4 — a11y audit + search index + public-launch landing polish**: full WCAG audit, MiniSearch build-time index, public-facing landing copy.
- **Mermaid theme polish to match warm-paper tokens**: v1.0 ships with whatever `theme: 'base'` + minimal theme variables produces. v1.1 may invest in matching `--color-accent` precisely.
- **Asset-path base prefix for non-root deploys**: irrelevant for v1.0 (deploys at root of `dashboard.agenticapps.eu`). If a future deploy lands under a base path, vite.config.ts `base` adjustment is required.
- **Search-and-replace internal `/help/*` links if `/help` route ever moves**: not relevant since D-7-01 keeps `/help` as the docs root.

</deferred>

---

*Phase: 07-help-docs-v1-0*
*Context gathered: 2026-05-11*
*Mode: `--auto` (defaults selected, logged inline above as "auto: recommended")*
