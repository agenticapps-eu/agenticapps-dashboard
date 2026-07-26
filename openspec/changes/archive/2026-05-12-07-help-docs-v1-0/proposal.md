# Phase 7: Help docs v1.0

**Archived from GSD phase `07-help-docs-v1-0`. Completed 2026-05-12.**

> Reconstructed during the OpenSpec migration (2026-07-26) from the phase's own
> CONTEXT, PLAN, and SUMMARY artifacts. The originals are preserved verbatim at
> `docs/legacy-planning/phases/07-help-docs-v1-0/` — that tree, not this file, is the authoritative record.

## Why

Land the v1.0 `/help` docs site as a self-contained subsystem in the SPA: MDX-driven pages, sidebar/main/sticky-TOC layout, lazy-loaded widget stubs, and a TanStack-Router code-based route tree mounted at `/help/*`. **Scope is fixed by `~/Documents/Claude/Projects/agentic-workflow/dashboard-help-pages/_shell/MIGRATION-INSTRUCTIONS.md` and the five anchor MDX pages + ~25 stub paths + 8 widget stubs already authored there.**

**In scope:**
- 5 anchor MDX pages: `landing` (slug `/help`), `workflow/overview`, `repos/overview`, `observability/overview`, `operations/install`.
- ~25 stub paths rendering `<ComingSoon section title />` (workflow x9, repos x6, observability x7, operations x4, reference x4 + 2 newly-required workflow stubs — see D-7-13).
- Shell components: `HelpLayout` (sidebar + main + mobile drawer), `HelpWidget` (lazy dispatch), `HelpHook` (in-page deep-link), `ComingSoon`.
- 8 widget stub components (`RepoTopologyMap`, `WorkflowStateMachine`, `GatePicker`, `TraceVisualizer`, `ScanReportPlayground`, `ApplyConsentSimulator`, `MigrationDryRun`, `SlashCommandCatalog`) — each a thin wrapper around the shared `WidgetStub` primitive.
- Replacement of the existing `/help` route (keyboard-shortcuts page) with the new docs landing; keyboard-shortcuts content migrates to a new `/help/reference/shortcuts` MDX page.
- MDX pipeline: `@mdx-js/rollup` Vite plugin + `remark-gfm` + `r

## Capabilities affected

- `openspec/specs/help-docs/spec.md`

## What shipped

**07-01**

**MDX rollup pipeline (enforce:'pre' + remark-gfm/frontmatter/mdx-frontmatter), Tailwind v4 typography via @plugin directive, MDXProvider wired between QueryBridge and RouterProvider, ambient *.mdx typing, Playwright runner config (1440x900 + 375x800 projects), tokenSourceOfTruth invariant extended to src/help/**, and HELP-01..HELP-06 anchored in REQUIREMENTS.md — every artefact Waves 1–3 need to land Phase 7.**

**07-02**

**HelpLayout (5 NAV sections + D-7-13 workflow stubs + HELP-06 keyboard-shortcuts) + HelpWidget (8 lazy widgets + unknown-widget guard + not-prose) + HelpHook (tooltip + TanStack navigate via topicToUrl) + ComingSoon (operations special-case fallback) + MermaidBlock (StrictMode-safe lazy renderer with CSS-var theme) + topicToUrl pure function + mdxComponents map populated — all 5 shell components TanStack-translated, token-translated, tested (48 cases), typechecked, built, and tokenSourceOfTruth-invariant-safe.**

**07-03**

**Pruned `_stub-pattern.tsx` primitive (WidgetStub + WidgetStubProps only, warm-paper tokens applied) and 8 named widget stub default exports at `packages/spa/src/help/widgets/<Name>.stub.tsx` — every import target Plan 07-02's HelpWidget lazy dispatch table expects, with a table-driven smoke test that proves all 8 resolve and render without crashing.**

**07-04**

**5 anchor MDX pages (landing + workflow/overview + repos/overview + observability/overview + operations/install) with verbatim frontmatter + prose + Mermaid-as-JSX conversion (5 blocks across 4 files) + 4 HelpWidget references at correct paths (RepoTopologyMap x2, ScanReportPlayground, MigrationDryRun); reference/shortcuts.mdx with HELP-06 KbdHint table + Common tasks list; 4 vitest test files (22 cases total, all green) validating frontmatter shape, Mermaid syntax (5 blocks pass mermaid.parse), anchor MDX render via MDXProvider, and HELP-06 KbdHint integration. SPA: 710 tests pass (+22). Wor

**07-05**

The decisive plan that wires the entire Phase 7 stack into the SPA's TanStack router and runs the closing ritual against the result.

### Routing infrastructure (T1-T5)

A typed 43-entry `helpRouteTable` (`packages/spa/src/help/helpRouteTable.ts`) is the single source of truth for the `/help/*` route tree. The `buildHelpRoutes` factory turns it into TanStack `createRoute()` instances under a new `_helpLayout` route, mounted as a PEER of `_appshell` at `rootRoute` (D-7-12) so `/help/*` bypasses the AppShellV2 chrome.

Five lazy MDX route wrappers (`packages/spa/src/help/pages/*.lazy.tsx`) point

## Gates recorded

- verification — `07-VERIFICATION.md`
- code review — `07-REVIEW.md`
- UAT — `07-UAT.md`
- validation — `07-VALIDATION.md`
