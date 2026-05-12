# Phase 7: Help docs v1.0 — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 07-help-docs-v1-0
**Mode:** `--auto` (`/gsd-discuss-phase 7 --auto`)
**Areas discussed:** Existing /help route conflict, Branch base, Phase numbering, MDX pipeline, Router translation, Tailwind v4 typography, Mermaid renderer, Design-token translation, Layout placement, Stub completeness, Widget split, Test coverage, Plan decomposition

---

## Existing /help route conflict (user-locked via AskUserQuestion)

| Option | Description | Selected |
|--------|-------------|----------|
| Replace /help, fold shortcuts into docs | New docs site takes /help. Keyboard shortcuts move into a new docs page (e.g. /help/reference/shortcuts). '?' still opens /help (landing). Cleanest URL — matches the migration doc verbatim. Requires moving shortcut content into an MDX page. | ✓ |
| Put docs at /docs, keep /help as-is | New docs site lives at /docs. Existing /help (shortcuts/tasks) is untouched. '?' still works. Search-and-replace all /help/* internal links in the new MDX pages to /docs/*. Minimum disruption to current users, but URL diverges from upstream design intent. | |
| Move shortcuts to /shortcuts, docs to /help | Shortcuts get their own /shortcuts route (rebound to '?'). Docs take /help. URL matches migration doc, shortcuts get a clear home. Cost: '?' shortcut needs rebinding in code + tests. | |

**User's choice:** Replace /help, fold shortcuts into docs.
**Notes:** Captured as D-7-01. The old `routes/help.lazy.tsx` (KbdHint table + common tasks list) is deleted in Plan 07-05; its content lives as MDX at `/help/reference/shortcuts`, marked `status: "ready"` in HelpLayout NAV.

---

## Branch base (user-locked via AskUserQuestion)

| Option | Description | Selected |
|--------|-------------|----------|
| Branch off current origin/main (26e78c7) | Post-v1.0 main. Docs site sits on top of merged redesign + service-install work. Only base that has the Tailwind v4 / TanStack Router / shadcn-equivalent stack the migration assumes. | ✓ |
| Branch off pre-redesign base (616e41f) | Honors the literal text of the migration doc, but 616e41f is a fix commit from BEFORE v1.0 — lacks the entire redesigned shell, Tailwind v4 config, and current UI primitives. The migration doc itself would not apply to this base. | |
| Stop and clarify the redesign branch reference | Pause so the user can point me at the right ref before I cut feat/help-docs-v1. | |

**User's choice:** Branch off current origin/main (26e78c7).
**Notes:** Captured as D-7-02. `feat/help-docs-v1` was cut from `26e78c7` before this discuss step ran. PR targets `main`.

---

## Phase numbering (user-locked via AskUserQuestion)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 07 in current v1.0 milestone | Adds Phase 07 to the existing v1.0 milestone (after the closed Phases 00-06). Updates ROADMAP.md. Renumbers previously-planned Phase 7 (Sentry/Linear/Infisical) to Phase 8. | ✓ |
| Open new v1.1 milestone via /gsd-new-milestone | Run /gsd-new-milestone to bump PROJECT.md to v1.1 and start the milestone with help-docs as Phase 01. | |
| Decimal Phase 06.2 under v1.0 | Treat help-docs as a decimal slot under the closed Phase 06 polish work. Mixes new product scope with polish-phase naming. | |

**User's choice:** Phase 07 in current v1.0 milestone.
**Notes:** Captured as D-7-03. ROADMAP.md updated before this step ran — Phase 7 renumbered to Phase 8, Phase 8 renumbered to Phase 9, milestone block extended to note "v1.0 /help docs site (post-ship)".

---

## MDX pipeline (auto-picked recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| `@mdx-js/rollup` Vite plugin with remark chain | Canonical Vite + MDX pipeline. enforce: 'pre' so MDX→JSX runs before plugin-react. remark-gfm + remark-frontmatter + remark-mdx-frontmatter. Matches migration Step 7. | ✓ |
| `vite-plugin-mdx` (third-party) | Simpler API but less canonical; smaller ecosystem; might not track Vite 8 cleanly. | |

**Auto-selection:** `@mdx-js/rollup`.
**Notes:** Captured as D-7-04. Vite 8 + plugin-react 6 + Tailwind v4 — verified compatible. plugin-react `include` regex must widen to match `.mdx`.

---

## MDXProvider placement (auto-picked recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap inside QueryBridge, outside RouterProvider | MDX renders have access to React Query + repair context; provider doesn't leak into router error boundaries. | ✓ |
| Wrap above StrictMode | Too high — provider would catch every render including non-MDX routes. | |
| Wrap inside each route's component | Per-route wrapping; verbose, easy to forget on new help pages. | |

**Auto-selection:** Inside QueryBridge, outside RouterProvider.
**Notes:** Captured as D-7-05.

---

## Router translation (auto-picked recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Code-based route table generated programmatically | DRY (one entry per page, not per file). Statically analyzable by TanStack. Matches existing `router.tsx` code-based pattern. Single `helpRouteTable.ts` array + factory. | ✓ |
| 30+ file-based lazy routes | One `help.lazy.tsx` per page. Verbose; clashes with existing code-based pattern in router.tsx. | |
| Single `help/$` catch-all with internal dispatch | Pragmatic but breaks TanStack static matching: no breadcrumb support, no `<Link to>` autocomplete. | |

**Auto-selection:** Code-based route table.
**Notes:** Captured as D-7-06.

---

## Anchor page rendering (auto-picked recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| `createLazyRoute` with `import()` per anchor page | Code-splitting; only landing MDX loads on first visit. Matches existing pair.lazy.tsx pattern. | ✓ |
| All MDX bundled eagerly | Simpler but inflates initial bundle by ~30KB MDX content. | |

**Auto-selection:** `createLazyRoute`.
**Notes:** Captured as D-7-07.

---

## Stub route rendering (auto-picked recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Single shared `<ComingSoonRoute section title />` component | 27 stubs share one parameterized component. Cleanest code surface and test surface. | ✓ |
| One MDX file per stub | Inflates bundle and test surface for no functional gain. | |

**Auto-selection:** Shared `ComingSoonRoute`.
**Notes:** Captured as D-7-08.

---

## Tailwind v4 typography (auto-picked recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| `@plugin "@tailwindcss/typography";` in global.css | Tailwind v4 CSS-side plugin registration. `prose-*` classes resolve via the plugin. v0.5.x supports Tailwind v4. | ✓ |
| Author custom `prose-equivalent.css` | Fallback if @plugin proves incompatible — replicates the article typography rules without the plugin. | |
| Inline typography classes on every element | Verbose; loses the `prose` semantics. | |

**Auto-selection:** `@plugin` directive (with custom CSS as fallback).
**Notes:** Captured as D-7-09.

---

## Mermaid renderer (auto-picked recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Runtime `<MermaidBlock>` with lazy mermaid import | Page MDX stays as-authored. Lazy-loads `mermaid` only on routes that need it. `mermaid.run()` is the canonical API. | ✓ |
| Build-time pre-render to SVG | Faster runtime, no client JS. Needs build-time Vite plugin; complicates authoring (no live edits to diagrams). | |
| Defer Mermaid to v1.1 | Replace blocks with custom SVG. Misses success criterion 2. | |

**Auto-selection:** Runtime `<MermaidBlock>`.
**Notes:** Captured as D-7-10. Mermaid v11+.

---

## Design-token translation (auto-picked recommended; non-negotiable for visual coherence)

| Option | Description | Selected |
|--------|-------------|----------|
| Translate shadcn-style tokens to dashboard tokens at copy time | Components use locked `tokens.css` names (e.g. `bg-app-bg`, `text-text-primary`, `text-accent`). No shadcn classes leak into `packages/spa/src/`. | ✓ |
| Add shadcn aliases to tokens.css | Less invasive at copy time, but introduces two parallel token vocabularies in one app. Breaks the Phase 5.1 "single source of truth" invariant. | |

**Auto-selection:** Translate at copy time.
**Notes:** Captured as D-7-11. The `tokenSourceOfTruth.test.ts` invariant from Phase 5.1 would fail if shadcn tokens leaked into `packages/spa/src/components/`.

---

## Layout placement (auto-picked recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| `_helpLayout` peer to `_appshell` at rootRoute | `/help/*` bypasses AppShellV2 chrome; HelpLayout owns the entire viewport. Avoids two-sidebar collision. Matches Phase 5.1 D-5.1-03 pattern for `/onboarding` + `/pair`. | ✓ |
| Mount HelpLayout INSIDE AppShellV2's content area | Keeps dashboard chrome visible. Stacks HelpLayout's sidebar next to AppShellV2's sidebar — visually broken, impeccable-failing. | |

**Auto-selection:** Peer layout route.
**Notes:** Captured as D-7-12.

---

## Missing stubs (auto-picked in-scope fix)

| Option | Description | Selected |
|--------|-------------|----------|
| Add 2 stubs (`rationalization-table`, `red-flags`) to make reviewer checklist item 6 pass | One-line table additions. Reviewer checklist binds scope. | ✓ |
| Strip the broken links from source MDX | Loses v1.1 backlog signal. Source MDX shouldn't be edited for this kind of fix. | |
| Accept the catch-all redirect on broken links | Loses breadcrumb context on click. Fails the reviewer checklist. | |

**Auto-selection:** Add 2 stubs.
**Notes:** Captured as D-7-13. Total stub count goes from 27 to 29.

---

## Widget split (auto-picked recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Ship all 8 widget stubs as separate files | Each is ~10 LOC. v1.1 pages can reference any widget without code change to the help system. | ✓ |
| Ship only the 3 referenced widgets (RepoTopologyMap, ScanReportPlayground, MigrationDryRun) | Smaller surface but forces a code change to ship the first v1.1 page that references any of the other 5. | |

**Auto-selection:** All 8.
**Notes:** Captured as D-7-14.

---

## Test coverage (auto-picked recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| ~30-40 vitest tests + Playwright e2e walking reviewer checklist | Matches Phase 02/03/06 coverage norms. Reviewer-checklist e2e is the automatable form of the manual verification list. | ✓ |
| Only smoke tests per component | Skips edge cases (operations section back-link special-case, isActive styling, unknown widget error path). | |
| Skip e2e; rely on manual reviewer walkthrough | Burdens the human reviewer with re-walking the checklist on every commit. | |

**Auto-selection:** Full coverage + e2e.
**Notes:** Captured as D-7-15. `@playwright/test` already in catalog.

---

## Plan decomposition (auto-picked recommended; planner may refine)

| Option | Description | Selected |
|--------|-------------|----------|
| 5 plans (Wave 0 infra; Wave 1 shell + stubs in parallel; Wave 2 content; Wave 3 routes + verify) | Tight wave dependencies, parallelizable in the middle wave. Each plan ~3-5 atomic tasks. | ✓ |
| 3 plans (combine infra+shell, content, routes+verify) | Coarser; fewer commit boundaries; harder to parallelize. | |
| 7+ plans (one per migration step) | Over-decomposed; many plans would have 1-2 tasks. | |

**Auto-selection:** 5 plans.
**Notes:** Captured as D-7-16.

---

## Claude's Discretion

Planner has discretion on:
- Whether to merge 07-02 and 07-03 into a single Wave-1 plan if executor capacity allows.
- Mermaid theme variables (warm-paper palette match or fall back to `theme: 'default'`).
- Sidebar mobile drawer animation (functional vs animated transition).
- Exact `document.title` format string.

## Deferred Ideas

See CONTEXT.md `<deferred>` section. Headline items:
- v1.1 — fill missing stubs (commitment-ritual, gates, two-stage-review, verification, scan, apply, slash-commands).
- v1.1 — wire `<HelpHook>` into existing dashboard pages.
- v1.1 — sidebar search (MiniSearch / Fuse.js).
- v1.2 — real widget implementations (replace all 8 stubs).
- v1.3 — repo deep-dives + reference section MDX.
- v1.4 — a11y audit + search index + public-launch landing polish.
