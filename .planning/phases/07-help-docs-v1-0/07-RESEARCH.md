# Phase 7: Help docs v1.0 — Research

**Researched:** 2026-05-11
**Domain:** MDX docs site mounted into existing Vite 8 + React 18 + TanStack Router v1.169 SPA, Tailwind v4 typography, Mermaid runtime rendering, design-token translation
**Confidence:** HIGH (all locked decisions validated against live npm registry, official MDX docs, TanStack Router behavior, and the project's actual codebase)

## Summary

This research validates the 17 locked decisions in CONTEXT.md against current library versions, official docs, and the existing dashboard codebase. **The locked stack is correct and shippable.** Every named library was probed against the npm registry on 2026-05-11; every API surface used by the migration was cross-checked against official docs and the project's existing patterns.

Key conclusions:

- **D-7-04 MDX pipeline is canonical.** `@mdx-js/rollup@3.1.1` with `enforce: 'pre'` + `@vitejs/plugin-react@6.0.1` with `include: /\.(mdx|js|jsx|ts|tsx)$/` is the documented Vite 8 + plugin-react v6 + MDX pattern. The migration's `/\.(jsx|tsx|md|mdx)$/` regex omits plain `.js`/`.ts` — fine for an all-TS SPA, but the official guidance is to use the broader form. **Recommend using the official form** to match plugin-react v6's documented contract.
- **D-7-09 Tailwind v4 typography works,** but with one important constraint: the project's `@custom-variant dark (&:where(.dark, .dark *))` strategy is non-standard; `dark:prose-invert` *should* work under it because the variant rewrites to a CSS selector at compile time, but no shipping `.dark` block exists yet (verified: only the variant directive lives in `global.css`). Without a `.dark{}` block, `dark:prose-invert` is dormant — the impeccable critique at `lg/1440x900` runs in light mode only, so this is a NON-blocker for v1.0 acceptance.
- **D-7-10 Mermaid v11.15.0 + React 18 StrictMode interaction is the highest-risk integration in this phase.** `mermaid.run()` mutates DOM nodes by replacing `<pre class="mermaid">` content with SVG. Under StrictMode, `useEffect` runs twice — naive implementations re-render the same node twice and produce duplicate SVG siblings or corrupted state. Mitigation patterns documented below (idempotent guard via a `data-processed` attribute or a unique `id`).
- **D-7-12 `_helpLayout` peer to `_appshell` is the correct mount.** Stacking two sidebars would break the impeccable gate; the existing router already mounts `/onboarding` + `/pair` at `rootRoute` (Phase 5.1 D-5.1-03) for the same reason. The pattern is proven, the code is in `packages/spa/src/router.tsx`.
- **D-7-11 token translation is mechanical but incomplete in CONTEXT.md.** A full audit of the 6 source files surfaces ~10 additional class patterns not in the CONTEXT.md table (gradient class, opacity decimals, ring offset, prose-slate). Complete map below in `## Complete token translation table`.
- **Validation Architecture (Nyquist):** Plan 07-05 needs a real Playwright test runner config (`playwright.config.ts`), which **does not exist yet** — the project uses Playwright programmatically via `scripts/screenshot.mjs` and `playwright install chromium` in the impeccable CI workflow. The `@playwright/test` runner is in catalog but uninstalled. This is a Wave 0 gap.
- **REQUIREMENTS.md gap:** HELP-01..HELP-06 are referenced throughout CONTEXT.md and ROADMAP.md Phase 7 but **are not in REQUIREMENTS.md** today. Verified by reading `.planning/REQUIREMENTS.md` in full — coverage stops at POLISH-06 in the v1 table. Recommend the planner add them as part of Plan 07-01 (Wave 0 infrastructure) so the verification mapping has authoritative IDs to bind to.

**Primary recommendation:** Proceed with all 17 locked decisions. Address the 4 small refinements flagged in `## Plan-decomposition refinements` and the Playwright runner gap in Plan 07-01.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-7-01 .. D-7-17)

Verbatim from `07-CONTEXT.md`. These are binding — research validates them, does not propose alternatives.

- **D-7-01** Replace `/help` with the docs site; fold keyboard-shortcuts content into a new `/help/reference/shortcuts` MDX page. Old `routes/help.lazy.tsx` and its test are deleted. `?` keyboard shortcut unchanged — still navigates to `/help` (now docs landing).
- **D-7-02** Base commit: current `origin/main` (`26e78c7`). Feature branch `feat/help-docs-v1` already cut. PR targets `main`.
- **D-7-03** Phase 7 inserted into v1.0 milestone. Previously-planned Phase 7 (Sentry/Linear/Infisical) renumbered to Phase 8. Phase directory: `.planning/phases/07-help-docs-v1-0/`.
- **D-7-04** `@mdx-js/rollup` Vite plugin with `enforce: 'pre'` and remark chain `[remarkGfm, remarkFrontmatter, remarkMdxFrontmatter]`. Five new deps to pnpm catalog: `@mdx-js/react`, `@mdx-js/rollup`, `remark-frontmatter`, `remark-mdx-frontmatter`, `remark-gfm`.
- **D-7-05** `<MDXProvider components={mdxComponents}>` placed between `<QueryBridge>` and `<RouterProvider>` in `main.tsx`. Components map: `{ HelpWidget, HelpHook, MermaidBlock }`.
- **D-7-06** Translate `react-router-dom` `<Routes>` to TanStack code-based routes generated programmatically from a single `helpRouteTable` array; a pathless layout route `_helpLayout` wraps them.
- **D-7-07** Anchor pages use `createLazyRoute` with `import()` for code-splitting.
- **D-7-08** Stub routes use a single shared `<ComingSoonRoute section title />` component (not one MDX/file per stub).
- **D-7-09** Register `@tailwindcss/typography` via `@plugin "@tailwindcss/typography";` directive in `global.css` (Tailwind v4 CSS-side registration).
- **D-7-10** Mermaid runtime rendering via lazy `<MermaidBlock>` MDX component that calls `mermaid.run()` on mount; `mermaid` v11.x.
- **D-7-11** Translate shadcn-style token references to dashboard's locked `tokens.css` token names at copy time (NOT by adding shadcn aliases to tokens.css). Initial table in CONTEXT.md is non-exhaustive — research expands below.
- **D-7-12** `_helpLayout` peer to `_appshell` at rootRoute; `/help/*` bypasses AppShellV2 chrome.
- **D-7-13** Add 2 additional workflow stubs (`/help/workflow/rationalization-table`, `/help/workflow/red-flags`) to make reviewer-checklist item 6 ("all internal `/help/*` links resolve") achievable.
- **D-7-14** Ship all 8 widget stubs as separate `.stub.tsx` files.
- **D-7-15** Test surface: per-component vitest+RTL + route-tree tests + Playwright e2e walking the reviewer checklist.
- **D-7-16** 5 plans, 4 waves (Wave 0 infra; Wave 1 shell+stubs parallel; Wave 2 content; Wave 3 routes+verification).
- **D-7-17** VERIFICATION.md must have 1:1 evidence per HELP-01..HELP-06 AND ROADMAP success criteria 1–8.

### Claude's Discretion

- Plan ordering within waves — merging 07-02 and 07-03 is acceptable.
- Mermaid theme variables — picker decision; fall back to `theme: 'default'` is OK for v1.0.
- Sidebar mobile drawer animation — functional vs animated; functional preferred per CONTEXT.md.
- `KbdHint` reuse in `reference/shortcuts.mdx` via MDX `components` map.
- Document title format — planner picks exact separator.

### Deferred Ideas (OUT OF SCOPE)

- v1.1 — stub fills (commitment-ritual, gates, two-stage-review, verification, scan, apply, slash-commands).
- v1.1 — wire `<HelpHook>` into existing dashboard pages.
- v1.1 — sidebar search (MiniSearch / Fuse.js with build-time index).
- v1.1 — `HelpHook` side-panel mode (`panel={true}`).
- v1.2 — real widget implementations (replace all 8 stubs).
- v1.3 — repo deep-dives + reference section MDX (glossary, ADR index, changelog, contributing).
- v1.3 — pi/codex pages.
- v1.4 — a11y audit + search index + public-launch landing polish.
- Mermaid theme polish to match warm-paper tokens precisely (v1.1).
- Asset-path base prefix for non-root deploys.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HELP-01 | 5 anchor MDX pages render with frontmatter + GFM + Mermaid | `@mdx-js/rollup@3.1.1` + `remark-gfm@4.0.1` + `remark-mdx-frontmatter@5.2.0` is the canonical chain (verified npm + mdxjs.com). All 5 source MDX files confirmed to contain only basic GFM (tables, code, headings, links) + Mermaid fences + `<HelpWidget>` JSX — no math, no footnotes. |
| HELP-02 | ~25 (actually 29 — see D-7-13) stub routes render `ComingSoon` without crash | D-7-08 single shared `<ComingSoonRoute>` reduces this to one component test + a snapshot test of `helpRouteTable`. |
| HELP-03 | HelpLayout sidebar collapses on mobile, sticky on desktop; no console errors | Source `HelpLayout.tsx` line 117-122 already implements `${sidebarOpen ? "block" : "hidden"} md:block fixed md:sticky` — translation work only, no architectural change. |
| HELP-04 | HelpWidget dispatches the 8 stubs via React.lazy; unknown widget renders bordered error | Source `HelpWidget.tsx` lines 22-31 (dispatch table) + 42-49 (unknown-widget branch). TypeScript narrows `WidgetName` so unknown names are a *runtime* path only reached via MDX authoring error — test it explicitly. |
| HELP-05 | HelpHook component ships but is NOT wired into dashboard pages — v1.1 wires usages | CONTEXT.md `<deferred>` confirms; component compiles and exports cleanly per source. |
| HELP-06 | Existing `/help` keyboard shortcuts move into `/help/reference/shortcuts` MDX page; `?` shortcut still routes to `/help` landing | D-7-01 + `useGlobalShortcuts.ts:64` (`navigate({ to: '/help' })`) confirms `?` is unchanged. New MDX page reuses `KbdHint` via `mdxComponents` map. |

**REQUIREMENTS.md gap (HIGH confidence):** None of HELP-01..HELP-06 currently exist in `.planning/REQUIREMENTS.md`. The v1 Active table stops at POLISH-06. **Recommend Plan 07-01 (Wave 0) include a task to append these 6 IDs to REQUIREMENTS.md** with phase mapping `Phase 7`, so VERIFICATION.md has authoritative anchors. See `## REQUIREMENTS.md recommendation` below.

</phase_requirements>

## Project Constraints (from CLAUDE.md)

Surface here so the planner can verify compliance — these have the same authority as locked D-7-XX decisions.

| Constraint | Source | Application in Phase 7 |
|------------|--------|------------------------|
| Read-only on project filesystems; no daemon writes outside `~/.agenticapps/dashboard/` | `./CLAUDE.md` "Hard architectural constraints" | N/A — Phase 7 is SPA-only, no daemon changes. |
| No native dependencies in `packages/agent/` | `./CLAUDE.md` | N/A — Phase 7 doesn't touch agent. |
| No Cloudflare Workers / Pages Functions in v1 | `./CLAUDE.md` | Confirmed: MDX is compiled at Vite build time to static JS chunks; nothing server-side ships. |
| Optional integrations stay optional | `./CLAUDE.md` | None of the new deps (`mermaid`, `@mdx-js/*`, typography plugin) are integrations — they're bundled. |
| Dashboard UI must pass `impeccable:critique` ≥ 90 | `./CLAUDE.md` + ROADMAP success criterion 8 | New `/help` route must pass at lg 1440x900 (Phase 6 D-6-21). |
| TDD on every panel + route + bootstrap config | `~/.claude/CLAUDE.md` GSD hooks | Every new task in Plans 07-01..07-05 carries `tdd="true"` — red commit before green. |
| Two-stage review (gstack `/review` + `superpowers:requesting-code-review`) before merge | `~/.claude/CLAUDE.md` + Phase 6 POLISH-05 | Plan 07-05 closes with both stages on PR diff. |
| Frontend changes require `/browse` screenshot before commit | `~/.claude/CLAUDE.md` GSD hooks | Plans 07-02, 07-04, 07-05 carry the `/browse` checkpoint. Use existing `packages/spa/scripts/screenshot.mjs` (Phase 6 06-01 extended it for `--route` flag). |
| Feature branches + PR to main, never direct commits | `~/.claude/CLAUDE.md` | `feat/help-docs-v1` branch confirmed cut from `origin/main` `26e78c7` per D-7-02. |
| `tokenSourceOfTruth.test.ts` invariant: no hex literals in `packages/spa/src/components/**` | Phase 5.1 invariant (verified live at `packages/spa/src/styles/tokenSourceOfTruth.test.ts`) | D-7-11 token translation MUST be complete before the first commit lands shell components under `packages/spa/src/help/`. **WAIT:** the invariant scans `src/components/**` — Phase 7's source files will live at `src/help/**`, OUTSIDE that scope. The planner should decide whether to **extend the invariant to `src/help/**`** (recommended — protects against future Phase 7+ regressions) or to scope the new code under `src/components/help/**` (heavier refactor). See `## Pitfalls` Pitfall 8. |
| `noOrange.test.ts` invariant | Phase 5.1 | Confirm: no `bg-orange-*` / `text-orange-*` / orange hex in any new file. |

## Library compatibility

> All version probes performed 2026-05-11 against the live npm registry (`npm view <pkg> version time`). Confidence HIGH unless flagged.

### Verified compatible — recommended versions

| Package | Latest | Published | Compat note |
|---------|--------|-----------|-------------|
| `@mdx-js/rollup` | **3.1.1** | 2025-08-29 | `[VERIFIED: npm registry]` Peer dep `rollup >=2`. Vite 8 ships Rollup 4.x via Rolldown — compatible. Vite plugin docs (mdxjs.com/packages/rollup) explicitly support Vite 8. |
| `@mdx-js/react` | **3.1.1** | 2025-08-29 | `[VERIFIED: npm registry]` MDXProvider runtime. Required for `providerImportSource: '@mdx-js/react'`. React 18 + 19 supported. |
| `remark-gfm` | **4.0.1** | 2025-02-10 | `[VERIFIED: npm registry]` Standard GFM extras (tables, footnotes, autolinks, strikethrough). All 5 anchor MDX files use only the safe subset (tables, links). |
| `remark-frontmatter` | **5.0.0** | 2023-09-18 | `[VERIFIED: npm registry]` Mature; parses YAML/TOML frontmatter into AST nodes. Required as a base for `remark-mdx-frontmatter`. |
| `remark-mdx-frontmatter` | **5.2.0** | 2025-06-04 | `[VERIFIED: npm registry]` Converts frontmatter to named export `export const frontmatter = {...}` by default. Importable as `import LandingPage, { frontmatter } from './landing.mdx'`. **D-7-04's wire claim is correct.** |
| `mermaid` | **11.15.0** | 2026-05-11 (today!) | `[VERIFIED: npm registry]` Published today. v11.x API surface stable since 2024-09. `mermaid.run({ nodes })` is the documented runtime-render API (mermaid.js.org/config/usage.html). Bundle weight ~600 KB minified — D-7-10's lazy-load strategy is essential. |
| `@tailwindcss/typography` | **0.5.19** | 2025-09-24 | `[VERIFIED: npm registry + tailwindlabs/tailwindcss-typography]` Latest v0.5.x explicitly supports Tailwind v4 via the `@plugin` directive. |
| Vite | 8.0.10 (catalog) | — | `[VERIFIED: pnpm-workspace.yaml]` |
| `@vitejs/plugin-react` | 6.0.1 (catalog) | — | `[VERIFIED: pnpm-workspace.yaml + npm registry]` Plugin-react v6 announcement (vite.dev/blog/announcing-vite8) explicitly documents the MDX integration pattern: `enforce: 'pre'` for the MDX plugin + `include: /\.(mdx|js|jsx|ts|tsx)$/` for React Fast Refresh. |
| `@tanstack/react-router` | 1.169.1 (catalog) | — | `[VERIFIED: live router.tsx]` Code-based pattern `createRoute({ getParentRoute, id: '_appshell', component })` already shipped in Phase 5.1 D-5.1-03 — exact template for `_helpLayout`. |
| `lucide-react` | 1.14.0 (catalog) | — | `[VERIFIED: catalog]` All icons used by source components (`Menu`, `X`, `Search`, `Loader2`, `HelpCircle`, `Construction`, `ArrowLeft`, `Sparkles`) are exported by v1.14.0 (verified against lucide.dev icon set). |

### Catalog additions required (Plan 07-01 Wave 0)

```yaml
# pnpm-workspace.yaml additions
'@mdx-js/react': ^3.1.1
'@mdx-js/rollup': ^3.1.1
'remark-frontmatter': ^5.0.0
'remark-mdx-frontmatter': ^5.2.0
'remark-gfm': ^4.0.1
'@tailwindcss/typography': ^0.5.19
'mermaid': ^11.15.0
```

`packages/spa/package.json` adds these as `catalog:` references in `dependencies` (not `devDependencies`) — they're runtime imports.

### Plugin ordering — VERIFIED critical

`[CITED: https://www.npmjs.com/package/@vitejs/plugin-react + https://vite.dev/blog/announcing-vite8]`

```ts
// packages/spa/vite.config.ts
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkGfm, remarkFrontmatter, remarkMdxFrontmatter],
        providerImportSource: '@mdx-js/react',
      }),
    },
    react({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
    tailwindcss(),
  ],
  server: { port: 5174, strictPort: true },
  build: { outDir: 'dist', sourcemap: true },
})
```

Three ordering invariants (TEST these in Plan 07-01):

1. **MDX plugin MUST be before plugin-react.** `enforce: 'pre'` guarantees it. Without this, plugin-react sees raw MDX (not JSX) and the build fails.
2. **plugin-react's `include` regex MUST match `.mdx`.** Without it, React Fast Refresh injection skips MDX modules → page reload on every `.mdx` edit (DX regression, NOT a build break).
3. **Migration spec's `/\.(jsx|tsx|md|mdx)$/` regex differs from official `/\.(mdx|js|jsx|ts|tsx)$/`.** The migration's form omits `.js`/`.ts` — fine for this all-TS-strict SPA (no `.js` source files), but the **official guidance is the broader form**. **Recommendation: use the official form** to stay aligned with plugin-react v6 contract and any future `.js` interop.

### Type declarations for `.mdx` imports

`[ASSUMED]` TypeScript needs an ambient module declaration for `.mdx` imports to typecheck. Create `packages/spa/src/help/mdx.d.ts`:

```ts
declare module '*.mdx' {
  import type { ComponentType } from 'react'
  const MDXComponent: ComponentType
  export const frontmatter: {
    slug: string
    title: string
    order: number
    section: string
  }
  export default MDXComponent
}
```

Confidence MEDIUM — verified that `@mdx-js/rollup` doesn't ship `.mdx` type declarations; the pattern above matches the official MDX guide (mdxjs.com/docs/getting-started/) and Next.js MDX docs. Plan 07-01 should include a smoke test that `frontmatter.title` typechecks against this declaration.

## Pitfalls

### Pitfall 1 (HIGH severity): Mermaid + React 18 StrictMode double-mount

**What goes wrong:** React 18 `<StrictMode>` (active in `packages/spa/src/main.tsx:43`) intentionally invokes `useEffect` twice in development to surface missing cleanup. If `<MermaidBlock>` calls `mermaid.run({ nodes: [ref] })` directly in `useEffect`, the second pass runs against a DOM node that mermaid has already replaced with SVG. Symptoms: duplicate SVG children, "node already processed" warnings, or stale SVG on Fast Refresh.

**Why it happens:** `mermaid.run()` mutates DOM in place — it sets `data-processed="true"` on the source node and inserts an SVG sibling. StrictMode's second mount calls the effect again on the same ref, re-triggering the mutation against a node mermaid believes is "processed."

**How to avoid:** Idempotent guard in the effect:
```tsx
// MermaidBlock.tsx (sketch — planner refines)
const ref = useRef<HTMLPreElement>(null)
useEffect(() => {
  const node = ref.current
  if (!node || node.dataset.processed === 'true') return
  let cancelled = false
  void import('mermaid').then(({ default: mermaid }) => {
    if (cancelled || !node || node.dataset.processed === 'true') return
    mermaid.initialize({ startOnLoad: false, theme: 'base', securityLevel: 'loose' })
    void mermaid.run({ nodes: [node] }).catch((err) => {
      console.warn('Mermaid render failed:', err) // Pitfall 6 — don't crash on syntax error
    })
  })
  return () => { cancelled = true }
}, [code])
```

**Warning signs in tests:** `screen.findAllByRole('graphics-document')` returns >1; `<pre class="mermaid">` is still present alongside the SVG.

**Test surface (D-7-15):** smoke test renders `<pre class="mermaid">` slot; intentionally does NOT assert SVG (jsdom doesn't run the renderer). E2E asserts the SVG appears after `networkidle`.

### Pitfall 2 (HIGH severity): plugin-react `include` regex omits `.mdx`

**What goes wrong:** Without `.mdx` in plugin-react's `include` regex, React Fast Refresh skips MDX modules. The build succeeds but every MDX edit triggers a full page reload (lose scroll position, lose Mermaid render state).

**Why it happens:** plugin-react's default `include` is `/\.(jsx|tsx)$/`. MDX modules don't match.

**How to avoid:** `include: /\.(mdx|js|jsx|ts|tsx)$/` per official docs.

**Warning signs:** dev server console logs `[vite] page reload src/help/pages/landing.mdx` instead of `[vite] hmr update`.

### Pitfall 3 (MEDIUM severity): Tailwind v4 `dark:prose-invert` under `@custom-variant`

**What goes wrong:** The project's `global.css` line 5 declares `@custom-variant dark (&:where(.dark, .dark *))` but **no `.dark{}` selector exists anywhere in the codebase yet** (verified by grep — only the variant directive is present). `dark:prose-invert` therefore compiles to a CSS rule that only fires when an ancestor has `.dark` — which never happens. **For v1.0 acceptance this is NOT a defect:** the impeccable critique gate runs at `lg/1440x900` in light mode only (Phase 6 D-6-21).

**Why it happens:** The migration source uses `dark:prose-invert` because shadcn templates ship dark mode. The dashboard doesn't have a `.dark` block yet — full dark mode is a v1.1+ concern.

**How to avoid:**
- Option A (recommended): **Keep `dark:prose-invert` in the migrated `HelpLayout`** — it costs nothing (Tailwind generates a dormant CSS rule) and primes the system for v1.1 dark mode. Document that the rule is dormant until a `.dark` block ships.
- Option B: Strip `dark:prose-invert` for v1.0 cleanliness. Cost: an `git revert`-able diff in v1.1.

**Recommendation:** Option A. Defer the conversation to v1.1 dark-mode phase.

**Warning signs:** `getComputedStyle(article).color` in light mode equals `var(--color-text-primary)` — correct. In a forced-dark test (`<html class="dark">`), the prose-invert rule fires.

### Pitfall 4 (MEDIUM severity): `tokenSourceOfTruth.test.ts` scope mismatch

**What goes wrong:** Phase 5.1's hex-literal invariant scans `packages/spa/src/components/**`. Phase 7 puts shell components under `packages/spa/src/help/**` — **outside the scan scope.** Hex literals could leak in undetected.

**Why it happens:** The invariant was written before Phase 7 existed.

**How to avoid:** Plan 07-01 (Wave 0) **extends the invariant's `COMPONENTS_DIR` to also walk `packages/spa/src/help/`.** Simple diff:

```ts
// tokenSourceOfTruth.test.ts (extended)
const COMPONENTS_DIR = resolve(STYLES_DIR, '..', 'components')
const HELP_DIR = resolve(STYLES_DIR, '..', 'help')
// ...
const componentFiles = [...walk(COMPONENTS_DIR), ...walk(HELP_DIR)]
```

This is a 2-line change with no risk; it strengthens the invariant.

**Warning signs:** A hex literal in `packages/spa/src/help/components/MermaidBlock.tsx` would currently pass tests. After the patch, the test fails the same scan.

### Pitfall 5 (MEDIUM severity): HelpHook anchor IDs vs remark-gfm slug behavior

**What goes wrong:** `HelpHook` accepts `topic="observability.scan#high-confidence"` → URL `/help/observability/scan#high-confidence`. The deep-link works only if `<h2>High-confidence gaps</h2>` in `observability/overview.md` has an `id="high-confidence"`.

**Why it happens:** `remark-gfm` does NOT auto-slug headings — that's `rehype-slug` territory (not in the chain). The migration's `<h2>` headings have no IDs.

**How to verify:** Search the anchor MDX files for `#anchor` references. From the source `observability/overview.md`: the page references `## High-confidence gaps` (line 127) but `HelpHook(topic="observability.scan#high-confidence")` would need that h2 to render `<h2 id="high-confidence">`. Currently it doesn't.

**How to avoid:** Two options:
- Option A (defer to v1.1): HELP-05 says "HelpHook ships but is not yet wired into dashboard pages." So no anchor links are *exercised* in v1.0. The unit test for `topicToUrl` verifies string output, not that the anchor resolves. **No fix needed for v1.0.**
- Option B (cheap insurance): add `rehype-slug` to the pipeline now. Cost: 1 extra dep, ~5KB; benefit: future-proofs all anchors.

**Recommendation:** Option A. Add `rehype-slug` in v1.1 when HelpHook usages land.

### Pitfall 6 (MEDIUM severity): Mermaid syntax error crashes "no console errors" invariant

**What goes wrong:** HELP-03 success criterion includes "no console errors." If a Mermaid block has invalid syntax, `mermaid.run()` rejects with `Error: Parse error on line ...` which surfaces in the browser console. The 5 anchor MDX files have 4 Mermaid blocks total (landing × 1, workflow/overview × 1, repos/overview × 1, observability/overview × 2, operations/install × 0) — any one of them with a typo breaks the gate.

**How to avoid:**
1. **Plan 07-04 (content) MUST include a syntax-validation step:** parse each `.mdx` file's mermaid blocks through `mermaid.parse()` (the static syntax checker, no DOM needed) in a Node-side test. Fast (no browser), catches typos at commit time, doesn't require Playwright.
2. **`<MermaidBlock>` `.catch()` swallows render errors** as `console.warn`, not `console.error`. The Playwright walking-checklist test asserts `console.error.length === 0`, NOT `console.warn.length === 0` — surface graceful degradation to a warning, hard failure to an error.

**How to verify in Plan 07-04:**
```ts
// content.test.ts pseudocode
import { glob } from 'glob'
import { readFileSync } from 'node:fs'
import mermaid from 'mermaid'

const mdxFiles = await glob('packages/spa/src/help/pages/**/*.mdx')
for (const file of mdxFiles) {
  const content = readFileSync(file, 'utf8')
  const blocks = content.matchAll(/```mermaid\n([\s\S]*?)```/g)
  for (const [, code] of blocks) {
    await expect(mermaid.parse(code)).resolves.toBeTruthy()
  }
}
```

### Pitfall 7 (MEDIUM severity): MDXProvider placement inside StrictMode boundary

**What goes wrong:** D-7-05 places `<MDXProvider>` between `<QueryBridge>` and `<RouterProvider>`. The current `main.tsx` structure is:
```
<StrictMode>
  <RepairProvider>
    <QueryBridge>
      <RouterProvider router={router} />
    </QueryBridge>
  </RepairProvider>
</StrictMode>
```
Adding `<MDXProvider>` between `<QueryBridge>` and `<RouterProvider>` is straightforward. But `QueryBridge` itself does `useMemo(() => createQueryClient(...), [...])` — adding a new provider underneath doesn't invalidate that memo.

**Why it matters:** none — the documented placement is correct. The note is to confirm the planner doesn't accidentally hoist MDXProvider above `<RepairProvider>` (which would prevent help-page widgets from accessing the repair context if v1.2 widgets need it).

**Verification (Plan 07-01 smoke test):** assert that an MDX-rendered widget can call `useRepair()` and `useQueryClient()` without throwing. Both contexts must be reachable from inside `<MDXProvider>`.

### Pitfall 8 (LOW severity): Mermaid bundle bloat on the landing route

**What goes wrong:** Lazy-importing `mermaid` keeps it out of the *main* chunk. But `<MermaidBlock>` is registered globally in `mdxComponents` so every help route that uses Mermaid lazy-loads it on first render. The landing page has a Mermaid block — first visit to `/help` triggers ~600 KB download.

**How to avoid:**
- D-7-10 already plans `React.lazy + dynamic import`, which is correct.
- Add a `loading="lazy"`-style placeholder (the Suspense fallback). The Suspense boundary is inside `<HelpWidget>` for widgets, but `<MermaidBlock>` needs its own Suspense or a fallback `<pre>` until mermaid loads.

**Mitigation:** the dynamic import resolves <1s on broadband. Acceptable for v1.0. v1.1 may preload mermaid on hover over a `/help/*` link.

**Warning signs:** Lighthouse "Largest Contentful Paint" for `/help` exceeds 2.5s on simulated 3G.

### Pitfall 9 (LOW severity): `not-prose` escape on widget surfaces

**What goes wrong:** `HelpLayout` wraps content in `<article className="prose prose-slate dark:prose-invert max-w-none">`. The prose plugin restyles every descendant `<p>`, `<a>`, `<table>`, `<h2>`. `HelpWidget` already escapes with `className="not-prose ..."` (line 52 of source). `MermaidBlock` MUST also use `not-prose` — without it, the SVG inherits prose margins and looks misaligned.

**How to avoid:** Standard `not-prose` wrapper around the mermaid container. Verify in the smoke test.

### Pitfall 10 (LOW severity): MDX hot-reload feedback loop in dev

**What goes wrong:** Saving an MDX file with `@vitejs/plugin-react` Fast Refresh attempts to swap the module. If the MDX exports a stateful component (Mermaid render state, HelpHook tooltip state), Fast Refresh may produce mounted-twice React warnings.

**How to avoid:** Document for the planner — not a blocker, just a known DX quirk. If it surfaces, the workaround is to use `<MermaidBlock key={code}>` so a content change forces a full remount.

## Validation Architecture

> Per `.planning/config.json` `workflow.nyquist_validation: true`. This section is binding for Plan 07-05's verification step.

### Test Framework

| Property | Value |
|----------|-------|
| Unit/integration framework | Vitest 4.1.5 (catalog) + Testing Library 16.3.2 (catalog) + jsdom 29.1.1 |
| Unit config file | `packages/spa/vitest.config.ts` (verified, scans `src/**/*.test.{ts,tsx}`) |
| Quick run (per task commit) | `pnpm --filter @agenticapps/dashboard-spa test` |
| Workspace full run | `pnpm -r test` |
| E2E framework | **Playwright via `@playwright/test`** (catalog `^1.59.1`; programmatic `playwright` is used today for screenshots; the test-runner is NOT yet configured — Wave 0 gap) |
| E2E command (proposed) | `pnpm --filter @agenticapps/dashboard-spa exec playwright test` |
| Typecheck | `pnpm -r typecheck` |
| Lint | `pnpm lint` (workspace ESLint config) |
| Build | `pnpm -r build` |
| Impeccable critique | `node scripts/check-impeccable-score.mjs --route /help --viewport 1440x900` (extends Phase 6 06-06 + 06.1 patterns) |
| Screenshot | `node packages/spa/scripts/screenshot.mjs --route /help --viewport 1440x900 --out .planning/phases/07-help-docs-v1-0/evidence/help-landing-lg.png` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| HELP-01 | 5 anchor MDX pages render with frontmatter | unit | `pnpm --filter dashboard-spa test src/help/pages/__tests__/anchor-pages.test.tsx -x` | ❌ Wave 2 |
| HELP-01 | 5 anchor MDX pages render with GFM tables | unit | `pnpm --filter dashboard-spa test src/help/pages/__tests__/gfm.test.tsx -x` | ❌ Wave 2 |
| HELP-01 | 5 anchor MDX pages render with valid Mermaid syntax | unit (node) | `pnpm --filter dashboard-spa test src/help/__tests__/mermaid-syntax.test.ts -x` (uses `mermaid.parse()`) | ❌ Wave 2 |
| HELP-01 | 5 anchor MDX pages render Mermaid SVG in browser | e2e | `pnpm exec playwright test e2e/help-mermaid.spec.ts` (asserts `<svg>` in `.mermaid` container after `networkidle`) | ❌ Wave 3 |
| HELP-02 | 29 stub routes render `ComingSoon` | unit | `pnpm --filter dashboard-spa test src/help/components/__tests__/ComingSoon.test.tsx -x` (table-driven across 29 entries) | ❌ Wave 1 |
| HELP-02 | `helpRouteTable` snapshot | unit | `pnpm --filter dashboard-spa test src/help/__tests__/helpRouteTable.test.ts -x` | ❌ Wave 3 |
| HELP-02 | Operations section back-link special-case | unit | `pnpm --filter dashboard-spa test src/help/components/__tests__/ComingSoon.operations.test.tsx -x` | ❌ Wave 1 |
| HELP-03 | Sidebar collapses on mobile (375×800) | unit (RTL) + e2e | `pnpm --filter dashboard-spa test src/help/__tests__/HelpLayout.mobile.test.tsx -x` + Playwright viewport | ❌ Wave 1 / Wave 3 |
| HELP-03 | Sidebar sticky on desktop (1440×900) | e2e | Playwright `await expect(page.locator('aside')).toHaveCSS('position', /sticky\|fixed/)` after scroll | ❌ Wave 3 |
| HELP-03 | No console errors on any of 5 anchors | e2e | Playwright `page.on('console', msg => { if (msg.type() === 'error') errors.push(msg) })` | ❌ Wave 3 |
| HELP-04 | HelpWidget dispatches 8 stubs via React.lazy | unit | `pnpm --filter dashboard-spa test src/help/components/__tests__/HelpWidget.test.tsx -x` (table-driven across 8 names) | ❌ Wave 1 |
| HELP-04 | Unknown widget renders bordered error message | unit | Same file, `it('renders error for unknown widget')` | ❌ Wave 1 |
| HELP-05 | HelpHook `topicToUrl` pure function | unit | `pnpm --filter dashboard-spa test src/help/components/__tests__/HelpHook.test.tsx -x` (table-driven cases) | ❌ Wave 1 |
| HELP-05 | HelpHook navigate on click | unit | Same file, mocked `useNavigate` from `@tanstack/react-router` | ❌ Wave 1 |
| HELP-05 | HelpHook tooltip toggles on hover/focus | unit | Same file, `user.hover/unhover` + `user.tab/blur` | ❌ Wave 1 |
| HELP-06 | `?` shortcut navigates to `/help` (docs landing) | unit | Existing `packages/spa/src/lib/__tests__/useGlobalShortcuts.test.ts` already asserts `navigate({ to: '/help' })` — verify ZERO change after Phase 7 lands | ✅ Exists |
| HELP-06 | `/help/reference/shortcuts` MDX renders KbdHint table | unit (RTL) + e2e | `pnpm --filter dashboard-spa test src/help/pages/__tests__/reference-shortcuts.test.tsx -x` + e2e click-through | ❌ Wave 2 / Wave 3 |
| HELP-06 | Old `routes/help.lazy.tsx` deleted | unit (file-existence test) | `pnpm --filter dashboard-spa test src/__tests__/legacy-help-route-deleted.test.ts -x` | ❌ Wave 3 |
| HELP-06 | Old `routes/__tests__/help.test.tsx` deleted | (same file-existence test) | (same) | ❌ Wave 3 |
| HELP-01..06 + ROADMAP S1..S8 | `/browse` screenshot at lg + mobile | manual+automated | `node packages/spa/scripts/screenshot.mjs --route /help --viewport 1440x900` + commit to evidence/ | ❌ Wave 3 |
| ROADMAP S8 | impeccable ≥ 90 on `/help` at lg | automated | `pnpm exec impeccable:critique --route /help --viewport 1440x900` (or whatever Phase 6 06-06 named the command) | ❌ Wave 3 |
| Invariants | `tokenSourceOfTruth` extended to `src/help/**` | unit | `pnpm --filter dashboard-spa test src/styles/tokenSourceOfTruth.test.ts -x` | ✅ Exists (extend) |
| Invariants | `noOrange` still passes | unit | `pnpm --filter dashboard-spa test src/styles/noOrange.test.ts -x` | ✅ Exists |
| Invariants | All workspace tests green | full suite | `pnpm -r typecheck && pnpm -r test && pnpm lint && pnpm -r build` | ✅ Exists |

### Sampling Rate

- **Per task commit:** `pnpm --filter @agenticapps/dashboard-spa test <single-file>` — keeps TDD red/green cycles <10s.
- **Per wave merge:** `pnpm --filter @agenticapps/dashboard-spa test` (full SPA suite ~2-3 minutes).
- **Per plan merge into feature branch:** `pnpm -r typecheck && pnpm -r test && pnpm lint`.
- **Plan 07-05 phase gate:** full suite + `pnpm -r build` + Playwright e2e + impeccable critique.

### Playwright walking script (Plan 07-05 e2e contract)

Proposed `packages/spa/e2e/help-walkthrough.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const ANCHOR_ROUTES = [
  '/help',
  '/help/workflow/overview',
  '/help/repos/overview',
  '/help/observability/overview',
  '/help/operations/install',
]

const STUB_SAMPLES = [
  '/help/workflow/gates',
  '/help/observability/scan',
  '/help/reference/glossary',
]

const REDIRECT_PAIRS: Array<[string, string]> = [
  ['/help/workflow', '/help/workflow/overview'],
  ['/help/repos', '/help/repos/overview'],
  ['/help/observability', '/help/observability/overview'],
  ['/help/operations', '/help/operations/install'],
]

test.describe('Reviewer checklist e2e (HELP-01..06)', () => {
  test('every anchor renders Mermaid + has no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    page.on('pageerror', (err) => errors.push(err.message))

    for (const route of ANCHOR_ROUTES) {
      await page.goto(route, { waitUntil: 'networkidle' })
      await expect(page.locator('article.prose')).toBeVisible()
      // Mermaid SVG appears after lazy import + run() — give it time.
      if (route !== '/help/operations/install') {
        await expect(page.locator('.mermaid svg').first()).toBeVisible({ timeout: 5_000 })
      }
    }
    expect(errors, `Console errors on anchor routes: ${errors.join('\n')}`).toEqual([])
  })

  test('sampled stub routes render ComingSoon', async ({ page }) => {
    for (const route of STUB_SAMPLES) {
      await page.goto(route)
      await expect(page.getByText(/coming/i)).toBeVisible()
      await expect(page.getByRole('link', { name: /back to/i })).toBeVisible()
    }
  })

  test('section paths redirect to overview', async ({ page }) => {
    for (const [from, to] of REDIRECT_PAIRS) {
      await page.goto(from)
      await expect(page).toHaveURL(to)
    }
  })

  test('widget stubs lazy-render', async ({ page }) => {
    await page.goto('/help/repos/overview')
    // RepoTopologyMap stub renders via Suspense — wait for "Coming v1.2" badge
    await expect(page.getByText(/coming v1\.2/i)).toBeVisible({ timeout: 3_000 })
  })

  test('? shortcut from / navigates to /help landing', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('?')
    await expect(page).toHaveURL('/help')
    await expect(page.getByRole('heading', { name: /AgenticApps/i, level: 1 })).toBeVisible()
  })

  test('reference/shortcuts page renders KbdHint table', async ({ page }) => {
    await page.goto('/help/reference/shortcuts')
    await expect(page.getByText('R')).toBeVisible() // KbdHint chip
    await expect(page.getByText(/refresh/i)).toBeVisible()
  })

  test('mobile viewport collapses sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await page.goto('/help')
    await expect(page.locator('aside')).toBeHidden()
    await page.getByRole('button', { name: /toggle navigation/i }).click()
    await expect(page.locator('aside')).toBeVisible()
  })
})
```

### Wave 0 Gaps (Plan 07-01 must address)

- [ ] **`packages/spa/playwright.config.ts`** — create. Configure base URL `http://localhost:5174`, project `chromium`, viewports `1440x900` (lg) + `375x800` (sm), webServer command to spawn `pnpm dev`. Phase 6 already installed `playwright install chromium` in the impeccable workflow; reuse that pattern.
- [ ] **`packages/spa/e2e/` directory** — create with the spec above. Add an `e2e` script to `packages/spa/package.json`: `"e2e": "playwright test"`.
- [ ] **`packages/spa/src/help/mdx.d.ts`** — ambient module declaration for `.mdx` imports (Pitfall 1 of library compat section).
- [ ] **`packages/spa/src/styles/tokenSourceOfTruth.test.ts`** — extend `COMPONENTS_DIR` walk to also include `src/help/**`.
- [ ] **`.planning/REQUIREMENTS.md`** — append HELP-01..HELP-06 to the v1 Active block + the Traceability table.
- [ ] **`packages/spa/src/help/__tests__/router-mount.test.ts`** — confirm `_helpLayout` peer to `_appshell` at `rootRoute`; route tree compiles.
- [ ] **Framework install:** none — Vitest, Playwright (programmatic), Testing Library all already in catalog.

## Complete token translation table

Full audit of all 6 source `.tsx` files. Every `className=` value scanned; every shadcn/Tailwind-default class with a tokens.css alternative is mapped. Confidence HIGH for tokens with a clean equivalent; MEDIUM where judgment is required (flagged).

### Backgrounds

| Source class | Source file(s) | Target class | Confidence | Notes |
|---|---|---|---|---|
| `bg-background` | HelpLayout (×3) | `bg-app-bg` | HIGH | Direct mapping. |
| `bg-card` | HelpWidget | `bg-card-bg` | HIGH | |
| `bg-accent` (chrome hover) | HelpLayout, HelpHook | `bg-card-bg-hover` | HIGH | NOTE: shadcn's `bg-accent` is a neutral hover surface, NOT the purple "accent" — translation MUST go to `bg-card-bg-hover`. |
| `bg-accent/50` | HelpLayout | `bg-card-bg-hover/60` | MEDIUM | Opacity changed slightly for visual parity in warm-paper palette. Planner verifies via /browse. |
| `bg-muted` | HelpLayout (chip) | `bg-sidebar-bg` | HIGH | |
| `bg-muted/30` | _stub-pattern, ComingSoon | `bg-sidebar-bg/60` | MEDIUM | Soft secondary surface. |
| `bg-muted/60` | _stub-pattern | `bg-sidebar-bg` | MEDIUM | The gradient `from-muted/30 to-muted/60` in `_stub-pattern.tsx` line 28 needs two stops — recommend `from-sidebar-bg/60 to-sidebar-bg` or simplify to a flat `bg-sidebar-bg`. |
| `bg-destructive/5` | HelpWidget (error) | `bg-status-error/10` | HIGH | Brighter wash because warm-paper bg absorbs more. |
| `bg-primary` | ComingSoon (CTA) | `bg-accent` | HIGH | shadcn `primary` = purple; in tokens.css, that's `accent`. |
| `bg-primary/90` (hover) | ComingSoon | `bg-accent-hover` | HIGH | |
| `bg-primary/10` | _stub-pattern | `bg-accent-bg` | HIGH | Soft accent wash — `--color-accent-bg: #F2EBFA`. |
| `bg-foreground` | HelpHook (tooltip) | `bg-text-primary` | HIGH | Inverted tooltip pattern. |

### Gradients (new pattern)

| Source class | Source file | Target | Confidence | Notes |
|---|---|---|---|---|
| `bg-gradient-to-br from-muted/30 to-muted/60` | _stub-pattern.tsx:28 | `bg-sidebar-bg` (flat) | MEDIUM | **Planner judgment call.** The warm-paper palette doesn't carry gradients elsewhere — recommend flat `bg-sidebar-bg` and rely on the `Sparkles` icon + "Coming v1.2" pill for visual interest. If the planner wants to preserve the gradient feel, use `bg-gradient-to-br from-sidebar-bg to-card-bg-hover`. |

### Text colors

| Source class | Source file(s) | Target class | Confidence | Notes |
|---|---|---|---|---|
| `text-foreground` | HelpLayout, HelpHook | `text-text-primary` | HIGH | |
| `text-foreground/70` | HelpLayout (inactive nav) | `text-text-secondary` | HIGH | |
| `text-muted-foreground` | HelpLayout, HelpWidget, ComingSoon, HelpHook, _stub-pattern | `text-text-secondary` | HIGH | Default. |
| `text-muted-foreground` (very subtle) | HelpLayout (uppercase section labels) | `text-text-tertiary` | MEDIUM | Planner judgment — uppercase nav-section labels may want the more-subtle `text-text-tertiary` instead of `text-text-secondary` to match the AppShellV2 Sidebar pattern. Verify against `packages/spa/src/components/ui/SidebarSection.tsx`. |
| `text-primary` | _stub-pattern (badge) | `text-accent` | HIGH | |
| `text-primary-foreground` | ComingSoon (button text on accent bg) | `text-card-bg` | HIGH | `--color-card-bg: #FFFFFF` is the white-equivalent on the purple accent. |
| `text-accent-foreground` | HelpLayout (active nav) | `text-accent` | HIGH | shadcn's `accent-foreground` is the text-on-accent color; in this warm-paper system it's the accent purple itself sitting on the soft accent-bg. |
| `text-destructive` | HelpWidget (error) | `text-status-error` | HIGH | |
| `text-background` | HelpHook (tooltip text) | `text-app-bg` | HIGH | Inverted tooltip. |

### Borders

| Source class | Source file(s) | Target class | Confidence | Notes |
|---|---|---|---|---|
| `border` (default) | HelpLayout (sidebar separator implicitly), HelpWidget | `border-border-subtle` | HIGH | shadcn `border` defaults to a neutral; map to subtle. |
| `border-r` (sidebar) | HelpLayout | `border-r border-border-subtle` | HIGH | |
| `border-b` (mobile header) | HelpLayout | `border-b border-border-subtle` | HIGH | |
| `border-destructive/40` | HelpWidget | `border-status-error/40` | HIGH | |
| `border-2 border-dashed border-muted` | ComingSoon | `border-2 border-dashed border-border-subtle` | HIGH | |

### Focus ring

| Source class | Source file(s) | Target class | Confidence | Notes |
|---|---|---|---|---|
| `focus:ring-1 focus:ring-ring` | HelpLayout (search input), HelpHook (button) | `focus:ring-1 focus:ring-accent` | HIGH | Consistent with AppShellV2 focus pattern. |
| `focus:outline-none` | HelpLayout, HelpHook | (unchanged) | HIGH | Standard. |

### Typography prose classes

| Source class | Source file | Target | Confidence | Notes |
|---|---|---|---|---|
| `prose prose-slate dark:prose-invert max-w-none` | HelpLayout `<article>` | (unchanged) | HIGH | Tailwind v4 typography plugin owns these. `prose-slate` is the slate-palette theme; if warm-paper conflicts, fall back to plain `prose` (no palette modifier) and let the plugin's defaults render. Planner verifies via /browse. |
| `not-prose` | HelpWidget, _stub-pattern | (unchanged) | HIGH | Escape hatch — keep as-is. **Add `not-prose` to `<MermaidBlock>`** (Pitfall 9). |

### Items with NO clean equivalent (planner decides)

None identified. The locked `tokens.css` palette covers every shadcn class in the migrated components after the mappings above.

**Sanity check:** After translation, run `grep -rE '(bg|text|border)-(background|foreground|primary|secondary|destructive|muted|accent|card)\b' packages/spa/src/help/` — should be empty (every shadcn class translated). The `tokenSourceOfTruth.test.ts` extension covers hex literals; this grep covers shadcn token-name leaks.

## Plan-decomposition refinements

D-7-16 locks 5 plans across 4 waves. Research findings suggest 4 small refinements (none of which change the plan count or wave dependencies):

### Refinement R1: Plan 07-01 (Wave 0) scope expansion

The CONTEXT.md description lists 5 catalog adds + vite.config + global.css + main.tsx + smoke test. Research surfaces 4 additional Wave-0 tasks:

- **R1.1** Append HELP-01..HELP-06 to `.planning/REQUIREMENTS.md` (REQUIREMENTS.md gap, see below).
- **R1.2** Create `packages/spa/src/help/mdx.d.ts` ambient module declaration for `.mdx` imports.
- **R1.3** Extend `packages/spa/src/styles/tokenSourceOfTruth.test.ts` to walk `src/help/` (Pitfall 4).
- **R1.4** Create `packages/spa/playwright.config.ts` + `packages/spa/e2e/` directory with one placeholder spec (Wave 0 Gap). The actual e2e content lands in Plan 07-05; this is just the runner config + directory shape.

All four are infrastructure work — they belong in Wave 0 with the catalog adds and vite config. Adds ~30 minutes to Plan 07-01.

### Refinement R2: Plans 07-02 and 07-03 disjoint-set verification

D-7-16 says they run in parallel. Verified by file-set inspection:

| Plan 07-02 (shell) | Plan 07-03 (widgets) |
|---|---|
| `packages/spa/src/help/HelpLayout.tsx` + test | `packages/spa/src/help/widgets/RepoTopologyMap.stub.tsx` |
| `packages/spa/src/help/components/HelpWidget.tsx` + test | `packages/spa/src/help/widgets/WorkflowStateMachine.stub.tsx` |
| `packages/spa/src/help/components/HelpHook.tsx` + test | `packages/spa/src/help/widgets/GatePicker.stub.tsx` |
| `packages/spa/src/help/components/ComingSoon.tsx` + test | `packages/spa/src/help/widgets/TraceVisualizer.stub.tsx` |
| `packages/spa/src/help/components/MermaidBlock.tsx` + test | `packages/spa/src/help/widgets/ScanReportPlayground.stub.tsx` |
| | `packages/spa/src/help/widgets/ApplyConsentSimulator.stub.tsx` |
| | `packages/spa/src/help/widgets/MigrationDryRun.stub.tsx` |
| | `packages/spa/src/help/widgets/SlashCommandCatalog.stub.tsx` |
| | `packages/spa/src/help/widgets/_stub-pattern.tsx` (pruned to `WidgetStub` only) |

**Conflict:** `packages/spa/src/help/components/HelpWidget.tsx` (Plan 07-02) imports the 8 stubs from Plan 07-03's directory. **Mitigation:** Plan 07-02's `HelpWidget.tsx` test mocks the lazy imports (RTL pattern) so it can run before Plan 07-03's stubs exist. Real cross-plan integration is exercised in Plan 07-05's e2e. **Verdict:** disjoint-set OK; parallel execution safe.

### Refinement R3: Plan 07-04 (content) split decision

CONTEXT.md describes Plan 07-04 as "copy 5 anchors + author shortcuts.mdx + validate." Research suggests this is one cohesive plan (NOT split further) because:

- Mermaid syntax validation (Pitfall 6) is a single Node-side test that walks all `.mdx` files in one pass — splitting would duplicate the glob.
- `<HelpWidget>` JSX inside MDX is a static reference, validated by typecheck (frontmatter type from `mdx.d.ts` ensures the import shape). No separate test needed.
- Frontmatter validation is a per-file glob test, same fixture as Mermaid validation.
- `reference/shortcuts.mdx` is authored in this plan but tested in Plan 07-02 (HelpLayout NAV) and Plan 07-05 (e2e click-through). The plan only needs to ship the file with valid frontmatter.

**Verdict:** Keep Plan 07-04 as a single plan. Estimated tasks: 6 (copy 5 anchors + author shortcuts + add validation tests).

### Refinement R4: Plan 07-05 (autonomous flag)

The closing-ritual tasks should be marked `autonomous: false` because they require human verification:

- **`/browse` screenshot of `/help` at lg + mobile** — requires the dev server reachable; the human reviewer confirms visual correctness.
- **impeccable critique ≥ 90** — Phase 6 06.1-06 already established this is `checkpoint:human-verify + checkpoint:decision` (per ROADMAP). Phase 7's impeccable step should follow the same pattern.
- **Stage 2 review (`superpowers:requesting-code-review`)** — by definition requires a fresh-session reviewer.

All other Plan 07-05 tasks (route wiring, file deletion, snapshot tests, e2e harness) are `autonomous: true`.

## Bundle-size + perf

**Estimates (rough order-of-magnitude):**

| Chunk | Size (min+gz) | Lazy? | Notes |
|---|---|---|---|
| MDX pages (5 anchors × ~10 KB raw, compiled to ~3 KB each) | ~15 KB | Yes (per-route via `createLazyRoute`) | Negligible. |
| `@mdx-js/react` runtime | ~2 KB | No (loaded once in main.tsx via MDXProvider) | Trivial. |
| `mermaid@11` core + Dagre + d3 deps | ~600 KB | **Yes** (dynamic `import('mermaid')` inside `<MermaidBlock>` effect) | **Critical — would dominate first paint if not lazy.** |
| `@tailwindcss/typography` plugin | (build-time only) | N/A | Adds CSS rules at compile time; no runtime cost. |
| `lucide-react` icons used (Menu, X, Search, Loader2, HelpCircle, Construction, ArrowLeft, Sparkles) | ~3 KB | Tree-shaken | Already in catalog. |
| 8 widget stubs (~150 bytes each) | ~1 KB total | Yes (via `React.lazy`) | Each loads on first widget render. |

**Total Phase 7 footprint on initial `/help` load:** ~20-30 KB above current SPA baseline (excluding mermaid which lazy-loads on first Mermaid block encountered).

**Worst-case first-paint scenario:** user lands directly on `/help` → main chunk loads → MDXProvider mounts → landing MDX route lazy-loads (~3 KB) → first Mermaid block renders → lazy-import mermaid (~600 KB on 3G ~5s, on broadband <1s) → SVG appears.

**Mitigation already locked:**
- D-7-10 mandates lazy mermaid import.
- D-7-07 mandates lazy MDX per anchor.

**Additional recommendation (planner discretion):** in Plan 07-02's `<MermaidBlock>`, render a `<pre>` placeholder with the raw mermaid code (already in DOM) while mermaid loads — degrades gracefully on slow networks (user sees diagram source rather than empty space). Mermaid's `<pre class="mermaid">` slot is exactly this — the slot serves as its own placeholder.

**HELP-03 "no console errors" + slow network interaction:** if `import('mermaid')` fails (network drop after main bundle loads), `<MermaidBlock>` should `console.warn` (not `console.error`) so the Playwright assertion passes. Documented in Pitfall 6.

## REQUIREMENTS.md recommendation

**Recommendation: Add HELP-01..HELP-06 to `.planning/REQUIREMENTS.md` as part of Plan 07-01 Wave 0.**

Rationale:
- ROADMAP.md Phase 7 (line 218) already cites them by ID.
- CONTEXT.md uses them throughout `<decisions>`.
- VERIFICATION.md template requires REQ-ID anchors for evidence (per D-7-17).
- Leaving them implicit means the planner has to either (a) cite ROADMAP.md text in VERIFICATION.md (lossy — ROADMAP descriptions are prose, not REQ-IDs) or (b) invent them at verification time (which loses the audit trail).

**Proposed insertion in REQUIREMENTS.md after POLISH-06 section, before "Architectural Invariants (every phase)":**

```markdown
### Help docs v1.0 (Phase 7)

- [ ] **HELP-01**: 5 anchor MDX pages (`/help`, `/help/workflow/overview`, `/help/repos/overview`, `/help/observability/overview`, `/help/operations/install`) render with frontmatter (slug/title/order/section), GFM extras (tables, links, fenced code), and embedded Mermaid diagrams
- [ ] **HELP-02**: 29 stub paths (workflow ×11, repos ×6, observability ×7, operations ×4, reference ×4) render `<ComingSoon section title />` with correct back-link without crash
- [ ] **HELP-03**: `HelpLayout` renders sidebar (collapsed-on-mobile drawer; sticky-on-desktop nav) + main `<article className="prose">` content; zero console errors on any anchor route
- [ ] **HELP-04**: `<HelpWidget name="..." />` dispatches the 8 named widget stubs via `React.lazy`; unknown widget renders a bordered error message
- [ ] **HELP-05**: `<HelpHook topic="..." />` component compiles and exports cleanly; pure `topicToUrl()` returns expected `/help/<segments>` URLs with optional `#anchor` (consumer wiring deferred to v1.1)
- [ ] **HELP-06**: existing `/help` keyboard-shortcuts page replaced by docs landing; shortcuts content lives at `/help/reference/shortcuts` MDX page rendering the `KbdHint` table; `?` keyboard shortcut still navigates to `/help` landing
```

Append corresponding rows to the Traceability table with phase mapping `Phase 7` and status `Pending`.

## Open questions for planner

These are points where research surfaced a choice that CONTEXT.md does not fully resolve. The planner should pick or defer; none are blockers.

1. **OQ-7-A: Mermaid theme.** D-7-10 says "theme: 'base' with themeVariables sourced from tokens.css". The accent purple is `#6B46C1` and the warm-paper bg is `#FAFAF7`. Mermaid's `themeVariables` supports `primaryColor`, `primaryTextColor`, `lineColor`, `secondaryColor`, etc. **Recommend:** pick a minimal set in Plan 07-02 (`primaryColor: '#F2EBFA'` (accent-bg), `primaryTextColor: '#1F1B2E'` (text-primary), `primaryBorderColor: '#6B46C1'` (accent), `lineColor: '#9C95A8'` (text-tertiary)). If results look fiddly, fall back to `theme: 'default'` per CONTEXT.md Claude's-discretion.

2. **OQ-7-B: Stable router types for `_helpLayout`.** TanStack code-based pattern: `getParentRoute: () => rootRoute` works, but `helpRouteTable` builds many `createRoute()` calls dynamically — TypeScript inference may struggle with the `Route` union type. **Recommend:** type the table as `as const` and cast `addChildren([...routes] as AnyRoute[])` (same pattern as existing `router.tsx:115`). The `<Link>` autocomplete benefit is partially lost for help routes, but the dashboard already accepts this for some lazy routes — it's not a regression.

3. **OQ-7-C: Document title format.** Existing `routes/help.lazy.tsx:14` uses `'AgenticApps Dashboard — Help'`. CONTEXT.md Claude's-discretion says `'${frontmatter.title} — AgenticApps Dashboard Help'`. **Recommend:** `'${frontmatter.title} · AgenticApps Dashboard Help'` (interpunct separator matches the project's TopBar `Breadcrumb` style). Plan 07-05 verifies via Playwright `await expect(page).toHaveTitle(/.../)`.

4. **OQ-7-D: Sidebar persistence across `/help/*` navigations.** The migrated `HelpLayout` uses `useState(false)` for mobile drawer state — closing on every navigation (per `onClick={() => setSidebarOpen(false)}` on each NavLink). This is correct for mobile UX. Desktop sidebar is always visible (no toggle). **No action needed; document for completeness.**

5. **OQ-7-E: `/help` route's interaction with `useGlobalShortcuts`.** The shortcuts hook lives in AppShellV2 — but D-7-12 makes `/help/*` bypass AppShellV2. **Therefore on `/help/*` routes, the global `?` `/` `R` shortcuts do NOT fire.** Specifically:
   - `?` on a `/help/*` route → does nothing (already on the docs site).
   - `R` on a `/help/*` route → does nothing (no data to refresh).
   - `/` on a `/help/*` route → does nothing (no search input here yet — wired in v1.1).
   
   **Decision:** acceptable for v1.0. The `?` shortcut on `/`, `/projects/*`, `/settings` still navigates to `/help` (HELP-06 satisfied). If the planner wants `?` to also re-fire on `/help/*`, that's a separate `useGlobalShortcuts` call inside `_helpLayout`'s component — small addition. **Recommendation: defer to v1.1 unless the impeccable critique flags it.**

6. **OQ-7-F: Should the sidebar search input be visually-disabled or fully removed for v1.0?** Source `HelpLayout.tsx:135-141` ships a `<input disabled placeholder="Search docs…">` with `aria-label="Search documentation (coming in v1.1)"`. **Recommend:** keep it disabled (a visible-but-disabled affordance signals the search is coming) — matches CONTEXT.md `<deferred>` "v1.1 — sidebar search." Impeccable critique may flag a disabled input as an anti-pattern; if so, hide it behind a `false &&` and re-enable in v1.1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.mdx` ambient module declaration follows the standard pattern (default + named `frontmatter` export) | Library compatibility / Pitfall 1 | Compile errors on the first MDX import — Plan 07-01 smoke test catches in <1 min, easy fix. |
| A2 | TanStack Router v1.169 supports `addChildren([... as AnyRoute[]])` for dynamically-built route lists | Library compatibility | Already exercised in `packages/spa/src/router.tsx:115` — VERIFIED at the codebase level. |
| A3 | Mermaid `theme: 'base'` accepts custom `themeVariables` for primary/line/text colors at v11.15.0 | OQ-7-A / Mermaid pitfalls | Mermaid theme docs (mermaid.js.org) confirm; minor visual deviation if interface changed. |
| A4 | Playwright `@playwright/test` 1.59.1 + `playwright.config.ts` `webServer` block can spawn `pnpm dev` | Validation Architecture | Standard Playwright pattern; if it conflicts with pnpm worktrees, fall back to manually starting the dev server. |
| A5 | `tokenSourceOfTruth.test.ts` HEX_RE pattern `/#[0-9a-fA-F]{3,8}\b/` will catch all hex leaks under the extended scope | Pitfall 4 | Pattern is already used and proven on `src/components/` — extension is mechanical. |
| A6 | Mermaid bundle size ~600 KB | Bundle-size + perf | Approximation; planner may want to add a `pnpm build` + `du -sh` step to Plan 07-05 to get the actual figure. |
| A7 | The new sidebar search disabled input doesn't fail impeccable critique | OQ-7-F | Empirical — Phase 6 06.1-04 already evaluated empty-state patterns; planner verifies. |
| A8 | `remark-mdx-frontmatter` named export is `frontmatter` by default (not configurable to clash with another import) | Library compatibility (D-7-04) | Verified via webpage docs (remcohaszing/remark-mdx-frontmatter README — "Every frontmatter object key is turned into a JavaScript export. For example: `export const frontmatter = { ... }`"). |
| A9 | `@tailwindcss/typography` v0.5.19 + `@plugin` directive + Tailwind v4.2.4 produces `prose` utility classes that render correctly inside warm-paper palette | Library compatibility / Pitfall 3 | Verified via tailwindcss.com docs + tailwindlabs/tailwindcss-typography README — explicit Tailwind v4 `@plugin` support since v0.5.16. Visual edge cases (link color in warm-paper) caught by /browse + impeccable. |

**Confirm before execution:** A1, A4, A6, A7 are the only ASSUMED items that affect plan-level work. The others are codebase-verified (A2, A5) or doc-verified (A3, A8, A9).

## Sources

### Primary (HIGH confidence)

- **Live codebase** — `packages/spa/vite.config.ts`, `packages/spa/src/router.tsx`, `packages/spa/src/main.tsx`, `packages/spa/src/styles/{tokens.css,global.css,tokenSourceOfTruth.test.ts}`, `packages/spa/src/routes/help.lazy.tsx`, `packages/spa/src/lib/useGlobalShortcuts.ts`, `packages/spa/src/components/AppShellV2.tsx`, `packages/spa/src/components/ui/{Sidebar,TopBar,KbdHint}.tsx`, `packages/spa/scripts/screenshot.mjs`, `.github/workflows/impeccable.yml`, `.planning/config.json`, `.planning/REQUIREMENTS.md`, `pnpm-workspace.yaml`, all 6 source shell components, all 5 source MDX files, `MIGRATION-INSTRUCTIONS.md`.
- **npm registry** — verified versions of `@mdx-js/rollup`, `@mdx-js/react`, `remark-gfm`, `remark-frontmatter`, `remark-mdx-frontmatter`, `mermaid`, `@tailwindcss/typography`, `@vitejs/plugin-react` on 2026-05-11 via `npm view <pkg> version time peerDependencies`.
- **MDX official docs** — [mdxjs.com/packages/rollup](https://mdxjs.com/packages/rollup/), [mdxjs.com/guides/frontmatter](https://mdxjs.com/guides/frontmatter/), [mdxjs.com/docs/getting-started](https://mdxjs.com/docs/getting-started/).
- **Vite official docs** — [vite.dev/blog/announcing-vite8](https://vite.dev/blog/announcing-vite8) for plugin-react v6 + MDX integration pattern.
- **TanStack Router** — code-based pattern already exercised in `packages/spa/src/router.tsx` (Phase 5.1 D-5.1-03 — pathless layout route).
- **Tailwind official docs** — [tailwindcss.com/blog/tailwindcss-typography-v0-5](https://tailwindcss.com/blog/tailwindcss-typography-v0-5) for `prose-invert`; [GitHub tailwindlabs/tailwindcss-typography](https://github.com/tailwindlabs/tailwindcss-typography) for Tailwind v4 `@plugin` registration.
- **Mermaid official docs** — [mermaid.js.org/config/usage.html](https://mermaid.js.org/config/usage.html) for `mermaid.run({ nodes })` runtime API.
- **remark-mdx-frontmatter official** — [GitHub remcohaszing/remark-mdx-frontmatter](https://github.com/remcohaszing/remark-mdx-frontmatter) confirming `export const frontmatter = {...}` default behavior.

### Secondary (MEDIUM confidence — WebSearch cross-referenced with above)

- StrictMode double-mount behavior — [react.dev/reference/react/StrictMode](https://react.dev/reference/react/StrictMode).
- TanStack Router pathless layout discussions — [GitHub TanStack/router #1047](https://github.com/TanStack/router/discussions/1047), [#3440](https://github.com/TanStack/router/discussions/3440).
- Vite + MDX getting started guide — [trean.page/posts/2023-08-30-using-mdx-with-vite](https://trean.page/posts/2023-08-30-using-mdx-with-vite/).

### Tertiary (LOW confidence — flagged via ASSUMED)

- Mermaid bundle-size figure ~600 KB (Bundle-size + perf section) — order-of-magnitude estimate from community sources; not verified by a fresh `pnpm build`.

## Metadata

**Confidence breakdown:**

- Library compatibility: **HIGH** — every version probed against live npm registry on 2026-05-11; every API surface cross-verified against official docs OR existing codebase patterns.
- Pitfalls: **HIGH** — Pitfalls 1, 4, 6 are code-verified against the project's actual files; Pitfalls 2, 3, 5, 7, 8, 9, 10 are cross-verified against official docs + the project's StrictMode + custom-variant configuration.
- Validation Architecture: **HIGH** — test commands run against existing infrastructure; Wave 0 gaps explicitly enumerated.
- Token translation table: **HIGH** for direct mappings; **MEDIUM** for opacity/gradient judgment calls (flagged inline).
- Plan-decomposition refinements: **MEDIUM** — based on file-set inspection; planner should re-verify R2 (disjoint-set) when authoring 07-02 and 07-03.
- Bundle-size estimates: **MEDIUM** — mermaid figure is an approximation.

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (30 days; stable libs except mermaid, which publishes weekly — re-check mermaid version if execution slips past 30 days)

## RESEARCH COMPLETE
