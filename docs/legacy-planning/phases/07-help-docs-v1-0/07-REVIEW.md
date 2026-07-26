---
phase: 07
slug: help-docs-v1-0
artifact: REVIEW
status: drafted
authored: 2026-05-12
head: cfa72f7
base: origin/main
---

# Phase 7 — Two-stage Code Review

Two-stage code review of the Phase 7 (Help docs v1.0) branch before merging
`feat/help-docs-v1` to `main`. Stage 1 follows the gstack `/review` discipline
(spec compliance + structural quality). Stage 2 follows
`superpowers:requesting-code-review` (independent code-quality pass).

**Diff under review:** `git diff origin/main feat/help-docs-v1` — 74 commits,
100 files changed (~6 k LOC source delta + pnpm-lock + planning docs). Source
delta scoped to `packages/spa/src/help/**`,
`packages/spa/src/router.tsx`, `packages/spa/src/lib/useGlobalShortcuts.ts`,
`packages/spa/src/styles/global.css`,
`packages/spa/src/styles/tokenSourceOfTruth.test.ts`,
`packages/spa/vite.config.ts`, `packages/spa/e2e/**`.

**Out of scope** (per review request): pnpm-lock.yaml, `.planning/` docs,
pre-existing flaky agent subprocess test, impeccable tooling drift (v1.0.1),
`text-text-tertiary` contrast bump (v1.0.1).

---

## Stage 1 — Spec Compliance + Structural Review

**Verdict:** PASS-WITH-FLAGS
**Reviewer:** general-purpose agent acting as gstack `/review`
**Date:** 2026-05-12
**Diff:** 74 commits, ~6 k LOC source delta

### Scope check

- **Stated intent** (`07-CONTEXT.md` + ROADMAP Phase 7): ship v1.0 `/help` docs
  as an MDX-driven sidebar + main subsystem, 5 anchor pages + ~25 stubs +
  8 widget stubs, replace legacy `/help`, two-stage review readiness.
- **Delivered:** 5 anchor MDX pages + 32 stub routes (+2 over the original ~25
  estimate, documented in D-7-13) + 8 widget stubs + shell components +
  lazy router wiring + 16 e2e + 716 unit tests workspace-wide.
- **Drift?** None. The +2 stubs (`rationalization-table`, `red-flags`) are
  D-7-13 sanctioned. HELP-06 migration (legacy `/help` deletion + shortcuts
  MDX) is complete.
- **Missing requirements?** None — HELP-01..06 all closed; ROADMAP S1..S8
  have evidence pointers in `07-VERIFICATION.md`. S7 (dark mode) is
  documented dormancy with `0ce906a` `dark:prose-invert` drop.

### Stage 1 categories (applied where relevant)

- **SQL & Data Safety** — N/A. Phase touches no SQL, no DB, no daemon code.
- **Race Conditions & Concurrency** — Reviewed `MermaidBlock` async lazy
  import; `cancelled` flag + `data-processed` guard combine to make
  StrictMode double-mount + unmount-mid-load safe. No other concurrency.
- **LLM Output Trust Boundary** — N/A. No LLM-generated content.
- **Shell Injection** — N/A. No shell calls in the SPA delta.
- **Enum & Value Completeness** — `HelpRouteEntry` discriminated union has
  5 kinds; `buildHelpRoutes` exhaustively handles all 5 in an `if/else if`
  chain. TypeScript narrowing works correctly (each branch references a
  local `…Entry` alias to preserve narrowing across the cast). 8 widget
  names match between `helpRouteTable` (no widgets there, irrelevant),
  `HelpWidget.widgets` dispatch table, `widgets/__tests__/stubs-smoke.test`,
  and `HelpWidget.test` mock list — cross-checked. 5 NAV sections in
  `HelpLayout` align 1:1 with the `helpRouteTable` section labels.
- **MDX/XSS** — Authored content only. No user input renders into MDX.
  Frontmatter shape is typed in `mdx.d.ts`. **One note:** `MermaidBlock`
  initialises mermaid with `securityLevel: 'loose'` which allows HTML
  inside diagram labels. Acceptable for v1.0 (all diagrams are
  author-controlled, statically authored), but should be revisited if a
  v1.x build ever lets users author Mermaid diagrams (e.g. via a
  GitHub-issue-imported snippet).
- **React patterns** — `lazy()` + `Suspense` used correctly in
  `HelpWidget`; `data-processed` + `cancelled` guards on `MermaidBlock`
  are textbook StrictMode-safe; `useRouterState` select usage in
  `HelpLayout` is correct (re-renders only when pathname changes).
- **TanStack Router correctness** — The critical bug (pathless layout +
  `/help/$` outranking `/help` index) was caught + fixed in
  `f47f5f2`, with both `helpLayoutRoute` (mounted at `path: '/help'`) and
  `buildHelpRoutes` (children use `'/' | relative | '$'` paths) updated in
  lockstep. The Playwright walking checklist gate (`/help` renders prose
  + zero console errors + catch-all on unknown path) is exhaustive enough
  to catch a regression of this exact class.
- **Test coverage of new code** — Unit tests are present for every
  meaningful surface: `topicToUrl` (9 table cases),
  `HelpHook` (6), `ComingSoon` (5 sections + 2 link cases), `HelpWidget`
  (10 cases, all 8 dispatch + unknown + not-prose), `MermaidBlock`
  (4 cases incl. StrictMode), `HelpLayout` (9), `mdx-smoke` (3),
  `frontmatter` (6 cases + HELP-06 title), `anchor-pages` (5),
  `mermaid-syntax` (parses 5 fenced blocks), `reference-shortcuts` (4),
  `helpRouteTable` (6 snapshot cases), `legacy-help-route-deleted` (2
  filesystem guards), `stubs-smoke` (8), `_stub-pattern` (5). The 16 e2e
  cases walk both desktop + mobile. Coverage is **behavioural**, not
  structural — see Stage 2 for assessment.
- **Cross-phase regressions** — `useGlobalShortcuts` modifier-bail change
  (drop `shiftKey`) adds GS8b test and preserves GS6 (`metaKey`) and GS7
  (`ctrlKey`). Cmd-R / Cmd-Shift-R browser reload bails on `metaKey`,
  unchanged. `router.tsx` adds `helpLayoutRoute` as a sibling of
  `appShellLayoutRoute` at root — no overlap with `index`, `settings`,
  `projects/$projectId`, `onboarding`, or `pair`. Cross-checked.

### Findings

#### [INFO] (confidence: 9/10) `packages/spa/src/help/pages/reference/shortcuts.mdx:33` — Documentation drift: the published shortcuts page tells users the global hook "bails on `metaKey`/`ctrlKey`/`altKey`/`shiftKey`", but `useGlobalShortcuts.ts:54` was changed in `84b688f` to drop `shiftKey` from the bail. The shipped docs now contradict shipped behaviour.

Fix: update line 33 of `shortcuts.mdx` to read
`"…the shortcut hook bails on metaKey/ctrlKey/altKey."` Two sentences in
the same file already describe the `?` shortcut correctly; the modifier
sentence is the only drift. Author-only edit, no code change. Could be
filed as the very first v1.0.1 PR. **Not a blocker** (docs paragraph,
not a load-bearing claim).

#### [INFO] (confidence: 8/10) `packages/spa/src/help/components/ComingSoon.tsx:24-25` — The `reference` section back-link target is `/help/reference/overview`, which is NOT a route in `helpRouteTable` (only `glossary`/`adr-index`/`changelog`/`contributing` exist under `reference`, plus the `shortcuts` anchor). The catch-all `$` will redirect `/help/reference/overview → /help`, so the user clicking "Back to reference overview" lands on the landing page instead of a meaningful index. The component's own comment acknowledges this. UX cliff, not a crash.

Fix: pick one of —
1. Add `'reference'` to the `operations`-style special-case map so the
   reference fallback goes to `/help/reference/shortcuts` (the only ready
   reference anchor), OR
2. Author a stub `/help/reference/overview` (would require expanding NAV +
   helpRouteTable), OR
3. Leave as-is and rely on the catch-all to land on `/help`.

Recommend #1 for v1.0.1 — single-line change with no NAV impact. **Not a
blocker** for v1.0 (no `reference/*` stub is reachable from the four
section redirects; users hit this only by typing `/help/reference/<stub>`
manually).

#### [INFO] (confidence: 7/10) `packages/spa/src/help/buildHelpRoutes.tsx:53-58, 66-69, 73-77` — The factory uses `as unknown as AnyRoute` casts to escape `createRoute().lazy().lazy(...)`-style chained type problems. Three of the five branches carry a `eslint-disable-next-line @typescript-eslint/no-explicit-any` because the `Route` import inside the lazy module is opaque to the factory. Comment at the top of the file (lines 12-15) acknowledges this is per OQ-7-B.

Fix: live with it. The dynamic generation is the cost. The
`helpRouteTable` snapshot test + e2e walking checklist together
backstop the type erasure with runtime evidence. **Not a blocker.**

#### [INFO] (confidence: 6/10) `packages/spa/src/router.tsx:136` — Single-line route mount uses a triple cast: `helpLayoutRoute as unknown as AnyRoute) as AnyRoute[]`. Same pattern as `appShellLayoutRoute.addChildren([...] as AnyRoute[])` on line 134, so consistent with existing house style. No alternate API surface in TanStack Router v1.169 produces a typed `addChildren()` call against a `Route[]` derived from a factory. Live with it.

Fix: none required. Documented in `buildHelpRoutes.tsx` comment.
**Not a blocker.**

#### [INFO] (confidence: 8/10) `packages/spa/src/help/components/MermaidBlock.tsx:64` — `securityLevel: 'loose'` permits raw HTML in Mermaid labels. Acceptable for v1.0 because every `MermaidBlock code={\`…\`}/>` reference lives inside an MDX file authored by the project owner, so there is no untrusted input path. Worth re-evaluating if a future widget ever passes user-supplied code into `MermaidBlock`.

Fix: add a one-line code comment near `securityLevel: 'loose'`
documenting why this is safe for v1.0 (provenance: author-controlled
MDX only). Defer behavioural change to whenever user-authored mermaid
becomes a feature. **Not a blocker.**

#### [INFO] (confidence: 9/10) `packages/spa/src/help/components/MermaidBlock.tsx:57-74` — Dynamic `import('mermaid')` rejection is swallowed silently (no `.catch` on the outer `then`). Inner `mermaid.run()` rejection is `console.warn`-only by design (RESEARCH P6). The outer dynamic-import rejection (e.g. CDN bundle 404, network failure) would `unhandledrejection` on the page and could light up the Playwright `errors[]` capture as a `pageerror`. Today's Playwright assertion passes (16/16 green), so in practice mermaid does load.

Fix: append `.catch(() => { /* mermaid bundle failed to load; pre.mermaid is shown raw */ })` to the dynamic-import to make the failure mode explicit. Cosmetic — the user already sees the fenced source. **Not a blocker.**

#### [INFO] (confidence: 7/10) `packages/spa/src/help/HelpPage.tsx:27-29` — `document.title` is set in `useEffect` but never restored on unmount. Navigating from `/help/workflow/overview` ("Workflow Overview · AgenticApps Dashboard Help") back to `/` (which has no title-setting code on the dashboard side that I can see) means the page title stays as the last help-page title. Minor cosmetic; the dashboard's other shell pages would need to also set `document.title` to clean this up.

Fix: add `return () => { document.title = 'AgenticApps Dashboard' }` to
the effect. One-line. Could be paired with a corresponding effect in
`AppShellV2`. **Not a blocker** (cosmetic, surfaces only across
shell-to-shell navigation).

### Plan completion audit

- `helpRouteTable` 32 stubs / 43 entries — locked by snapshot test
  (`helpRouteTable.test.ts` 6 cases).
- All 6 ROADMAP success criteria HELP-01..06 have evidence pointers in
  `07-VERIFICATION.md`.
- ROADMAP S1..S8 addressed (S7 documented dormancy; S8 with tooling-drift
  caveat documented in `deferred-items.md`).
- The pathless-`_helpLayout` + catch-all-trap bug was correctly diagnosed
  (`buildHelpRoutes.tsx` comments document the root cause for posterity)
  + fixed + regression-locked by the walking-checklist e2e.
- The `?` shortcut `shiftKey` bail bug was correctly diagnosed
  (US-layout users physically type Shift+/ to produce `?`) + fixed + a
  GS8b test added that fires with `shiftKey: true`.

### Stage 1 conclusion

Verdict **PASS-WITH-FLAGS.** Six findings, all INFO severity. The two
load-bearing claims to verify before merge:

1. The shortcuts.mdx doc paragraph contradicts the implementation as of
   `84b688f`. (`INFO #1` — easy fix, would be the cleanest commit.)
2. The reference-section back-link cliffs into `/help` via catch-all.
   (`INFO #2` — UX wart, not a crash.)

Neither is a P0/P1 in normal-PR-review parlance. Both could be addressed
in a v1.0.1 follow-up PR. The rest are notes for awareness.

---

## Stage 2 — Independent Code Quality Review (`superpowers:requesting-code-review`)

**Verdict:** PASS-WITH-FLAGS
**Reviewer:** independent code-quality pass (no prior context on Phase 7
execution)
**Date:** 2026-05-12

### Findings

#### [INFO] (confidence: 9/10) `packages/spa/src/help/HelpPage.tsx:14-19` — The `HelpPageFrontmatter` interface is duplicated in `mdx.d.ts:18-23` (as the ambient `frontmatter` named-export type). Two definitions for the same shape; if a field is added to one, the other silently diverges. The frontmatter test does cross-check field presence at runtime, but not the type identity.

Fix: export `HelpPageFrontmatter` from `mdx.d.ts` (or extract to
`help/types.ts`) and re-use in `HelpPage.tsx`. One-line de-dup.

#### [INFO] (confidence: 8/10) `packages/spa/src/help/components/HelpLayout.tsx:33-107` — The 75-line `NAV` array is a hard-coded sidebar. The `helpRouteTable` already enumerates every path; the two arrays must stay in sync by hand. There's a snapshot test for `helpRouteTable` and unit tests for the NAV (rationalization-table + red-flags + shortcuts), but no cross-check that every `helpRouteTable` stub appears in NAV or vice versa.

Fix: either (a) derive NAV from `helpRouteTable` (adds a `label` +
`emoji` per entry; section grouping by `section` field — already in the
discriminated union for stubs but absent for anchors), or (b) add a unit
test that asserts `NAV.flatMap(s => s.items).map(i => i.path)` is a
strict superset of `helpRouteTable` entries with kind 'anchor' | 'stub'.
Option (b) is the cheap insurance.

#### [INFO] (confidence: 8/10) `packages/spa/src/help/components/HelpLayout.tsx:194` — The `<main>` element carries `max-w-3xl`, restricting content width to ~768px regardless of viewport. This is intentional for prose-readable line lengths but isn't documented inline. A future contributor might widen it for a widget without realising why.

Fix: add a one-line comment: `{/* max-w-3xl: prose-readable line length (~65ch). Widgets that need more room render via not-prose + their own container. */}`

#### [INFO] (confidence: 7/10) `packages/spa/src/help/buildHelpRoutes.tsx:42-46` — `relPath()` accepts arbitrary input. The five callers all pass values from the `helpRouteTable` (which is typed and locked by snapshot), but the function silently returns the input unchanged for any non-conformant path (e.g. accidentally `/HELP/...` or `/help-old/...`). With `helpRouteTable` typed + snapshot-locked, the risk surface is closed, but `relPath` itself is permissive.

Fix: either add an early `throw new Error(...)` for inputs that aren't
`/help` or `/help/...`, or annotate the function's JSDoc to document
the assumed precondition. Defensive code-comment is sufficient.

#### [INFO] (confidence: 7/10) `packages/spa/src/help/components/HelpHook.tsx:36-40` — `console.warn('HelpHook panel mode not yet implemented; navigating instead.')` fires every time a user clicks a `panel={true}` HelpHook. No HelpHook is wired into the dashboard in v1.0 (HELP-05 explicitly defers wiring), so this never fires today, but it will surface as console noise the first time a v1.1 author adds a `panel={true}` HelpHook before the side-panel implementation lands. (Same point in Stage 1, different angle: this is the warning-as-TODO anti-pattern.)

Fix: leave the warning, but file a tracker note in
`07-help-docs-v1-0/deferred-items.md` or a v1.1 plan stub so the
warning has an owner.

#### [INFO] (confidence: 6/10) `packages/spa/src/help/mdxComponents.tsx:32-48` — `MermaidPreOrDefault` does inline child-class detection. The "language-mermaid" string match is brittle (extra whitespace, future class drift). Today's MDX content uses JSX `<MermaidBlock code={\`...\`}/>` exclusively (verified by `mermaid-syntax.test.ts`), so this dead-code branch never fires. The comment at line 11-18 acknowledges this is a "defensive fallback".

Fix: live with it for v1.0 since the branch is dead, OR strip the
custom `pre` and let MDX render fences as plain `<pre><code>` (would
mean future authors who try ```mermaid backticks get raw code instead
of a rendered diagram, which is loud + obvious). The current shape
is reasonable.

#### [INFO] (confidence: 8/10) `packages/spa/src/help/components/MermaidBlock.tsx:36-46` — `getMermaidThemeVariables()` reads computed CSS at render time, but the function does NOT cache — every `MermaidBlock` re-render that fires the effect computes the same four token values. Today this happens once per mount because the effect's only dep is `code`. If a future change adds re-renders (e.g. theme switching), this becomes hot.

Fix: extract `getMermaidThemeVariables` outside the component and
memo, OR move the call out of the effect into module scope so it
happens once at first render. Premature for v1.0 — flag for v1.1
dark-mode work where theme-switching will exercise this path.

#### [INFO] (confidence: 7/10) `packages/spa/src/help/__tests__/anchor-pages.test.tsx:27-35` — The widget-stub mocks use specifiers WITHOUT the `.js` suffix (`'../widgets/RepoTopologyMap.stub'`), while `HelpWidget.test.tsx:16-39` uses the same names WITH `.js` (`'../widgets/RepoTopologyMap.stub.js'`). Inconsistent. The HelpWidget test comment explicitly states the `.js` is required to match the source import; the anchor-pages test gets away without it because it imports the widgets indirectly through the MDX → HelpWidget chain and vitest's resolver is lenient. The inconsistency itself is the maintenance hazard.

Fix: pick one style and use it across both files. The HelpWidget
spec's `.js` is correct under NodeNext ESM and matches the source's
import. Update anchor-pages.test.tsx to use `.js` too.

#### [INFO] (confidence: 6/10) `packages/spa/src/help/widgets/_stub-pattern.tsx` — Filename starts with `_` (a Python-ish "private" convention; the file does export the public `WidgetStub` primitive). TanStack Router file-routing uses `_` for pathless layouts; in a widgets directory that's neither route-related nor lint-flagged, the leading-underscore convention will trip future readers. The comment at the top says "this file ONLY contains the shared `WidgetStub` primitive" — fine, but the convention is inherited from the migration source (the source had a single file with all stubs; we split them out, but kept the original filename).

Fix: rename to `WidgetStub.tsx` and update the eight stub imports +
the test specifier. Cosmetic; risk-free as a v1.0.1 rename.

#### [INFO] (confidence: 7/10) `packages/spa/src/help/components/HelpLayout.tsx:117, 137` — Two `Link to="/help"` references with identical text "AgenticApps" (header on mobile, sidebar on desktop). Hard-coded brand string in component. Probably fine for a v1.0 single-tenant dashboard; would want extraction if the product name ever changes (it has changed once already — `agenticapps-dashboard` was previously something else per the git history references).

Fix: extract to a `BRAND_NAME` constant near the component, or
import from a shared brand-tokens module if one exists. Cosmetic.

### Test quality assessment

The 716 unit tests + 16 e2e cases are **behavioural, not structural**.
Specifically:

- `topicToUrl.test.ts` is pure table-driven I/O — exercises edge cases
  (empty topic, anchor with dots, trailing-segment anchor, no-anchor
  topic). Strong.
- `HelpWidget.test.tsx` tests both the happy path (8 known names render)
  and the unknown-widget runtime branch with `@ts-expect-error` — proof
  the runtime guard is meaningful, not just a TypeScript exhaustiveness
  artifact.
- `helpRouteTable.test.ts` is a structural snapshot — but augmented with
  semantic assertions (the 2 D-7-13 stubs, the HELP-06 anchor-not-stub
  invariant, the 4 redirect targets, the catch-all target). A regression
  that adds a 33rd stub or renames a route will fail the test with a
  human-readable message, not just an opaque "shape changed".
- `mermaid-syntax.test.ts` literally `mermaid.parse()`s each fenced block
  on disk — catches typos at commit time, not browser time.
- `frontmatter.test.tsx` validates that `remark-mdx-frontmatter` produces
  the expected shape per MDX file, with explicit per-file expectations.
- `legacy-help-route-deleted.test.ts` is a filesystem guard — the kind of
  test most reviewers forget but pays off the first time a junior dev
  re-adds the legacy file by accident.
- `anchor-pages.test.tsx` cross-validates the MDX → MDXProvider →
  HelpWidget integration with mocked widgets + mocked mermaid — verifies
  that the JSX shape of every anchor MDX file resolves to mountable React,
  without dragging in the lazy-load chains.
- `useGlobalShortcuts.test.tsx` GS8b is the **textbook example of a
  regression-locking test**: explicit comment + explicit `shiftKey: true`
  assertion that would have caught the original bug if it had existed.

The Playwright walking checklist is the highest-leverage piece —
asserts (a) every anchor renders prose, (b) Mermaid SVG appears
(real browser, real lazy-load), (c) `console.error.length === 0`,
(d) 32-stub samples render `<ComingSoon>` + back-link, (e) section paths
redirect, (f) catch-all redirects, (g) `?` shortcut navigates,
(h) shortcuts page renders KbdHint chips, (i) mobile drawer toggles.
Nine assertions across two viewports, ~6 s total runtime, 16/16 green.

**Gaps** (Stage 2 honesty):

- No test confirms NAV `<-->` helpRouteTable consistency (see finding
  above). A new stub added to the route table without a NAV entry would
  ship invisible to users — only the snapshot test would flag it
  (assuming the count change is noticed in review).
- No accessibility audit on the rendered `<article.prose>` for heading
  hierarchy (e.g. `h1` count == 1, no skipped levels). The walking
  checklist asserts `getByRole('heading', { level: 1 })` is visible but
  doesn't enforce a single h1.
- `mdx-smoke.test.tsx` runs the pipeline once on a fixture but doesn't
  prove that `*.mdx` ambient-type-only declarations are actually
  consumed correctly across editor / build / test. (Pre-flight
  `pnpm -r build` is the de facto guard.)

**Net:** test quality is well above the standard for a SPA-only docs
phase. The discipline of "RED test before GREEN code" is visible
throughout the commit log (`test(07-XX): RED <something>` followed by
`feat(07-XX): GREEN <something>`).

### Readability assessment

**`HelpLayout.tsx`** (214 lines) — clean. The NAV definition is verbose
but transparent; reading top-to-bottom you see five sections, items per
section, status flag, click handler that closes the drawer. The single
detailed comment block on the `<article.prose>` warning explains exactly
why `dark:prose-invert` was removed and links to the auto-fix commit
(T10 evidence). Idiomatic React + TanStack Router.

**`HelpWidget.tsx`** (58 lines) — minimal. The 8-name dispatch table is
declarative and grep-friendly. The "Unknown widget" branch is helpful
(red border, code-formatted name, instruction to edit HelpWidget.tsx).
The Suspense fallback is on-brand with a spinner + name.

**`helpRouteTable.ts`** (127 lines) — readable as a config file. The
section grouping with comments (workflow 11 incl. D-7-13 additions, repos
6, observability 7, operations 4, reference 4) makes the count match the
test obvious. The discriminated union at the top of the file is the
contract; `buildHelpRoutes.tsx` is the consumer. Pair reads cleanly.

**`buildHelpRoutes.tsx`** (105 lines) — the most "load-bearing" file in
the diff. The comments at lines 21-39 are unusually thorough — they
explain (a) what each entry kind produces, (b) why `relPath` strips
`/help/`, (c) the depth-based tie-breaker bug that motivated mounting
`_helpLayout` at `path: '/help'` instead of pathless `id: '_helpLayout'`.
Six months from now, a reader debugging a TanStack Router issue gets a
ready-made explanation of the foot-gun. Excellent.

**`MermaidBlock.tsx`** (88 lines) — small, focused, well-commented.
The StrictMode guard + cancellation flag + console.warn-over-error
decisions are each annotated with the reason. The token-via-getComputedStyle
explanation is good. Net: A.

**`ComingSoonRoute.tsx`** (18 lines) — trivially small. The wrapper exists
because TanStack Router's `component` prop expects a no-arg renderable
and `ComingSoon` takes `section` + `title` props. Right pattern.

**`mdxComponents.tsx`** (57 lines) — small. `MermaidPreOrDefault` is the
weakest spot (Stage 2 finding above) but the rationale comment is good.

**Stage 2 conclusion:** the new code reads cleanly. The most novel files
are the most heavily commented; the trivially small files don't have
unnecessary commentary. No abbreviations or jargon that bites. A new
reader can navigate `helpRouteTable.ts` → `buildHelpRoutes.tsx` →
`router.tsx:130-136` and understand the routing contract end-to-end in
under five minutes.

Verdict **PASS-WITH-FLAGS.** Ten findings, all INFO severity. Most
suggest cosmetic or de-duplication work that would land cleanly as
v1.0.1 polish. The codebase is at a comfortable maintainability bar for
a v1.0 release.

---

## Summary

| Stage | Verdict | Severity of findings |
|-------|---------|----------------------|
| Stage 1 — gstack `/review` | **PASS-WITH-FLAGS** | 6 × INFO |
| Stage 2 — independent code quality | **PASS-WITH-FLAGS** | 10 × INFO |

**Overall:** **safe to merge to `main` and tag v1.0.1.** No CRITICAL or
BLOCK findings. The two highest-confidence INFO items both have obvious
one-line v1.0.1 fixes:

1. **Stage 1 INFO #1** — update `shortcuts.mdx` line 33 to reflect the
   actual `useGlobalShortcuts` modifier-bail (drop the `shiftKey`
   mention).
2. **Stage 1 INFO #2** — `ComingSoon` reference-section fallback path
   does not exist; back-link cliffs into the landing page via catch-all.

Both could be addressed inline before the merge, or filed as the first
v1.0.1 PR. The user's prior decisions to defer impeccable tooling and
the `text-text-tertiary` contrast bump to v1.0.1 are independent of
these findings.

Phase 7 is **safe to mark complete** and merge `feat/help-docs-v1` to
`main`.
