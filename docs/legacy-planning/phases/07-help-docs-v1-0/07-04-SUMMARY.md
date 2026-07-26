---
phase: 07-help-docs-v1-0
plan: 04
subsystem: spa-help-content
tags: [mdx, content-migration, mermaid, helpwidget, kbdhint, tdd, vitest]

# Dependency graph
requires:
  - phase: 07-help-docs-v1-0
    plan: 01
    provides: "MDX rollup pipeline + ambient *.mdx typing + tokenSourceOfTruth invariant scope"
  - phase: 07-help-docs-v1-0
    plan: 02
    provides: "MermaidBlock + HelpWidget + ComingSoon + HelpHook + populated mdxComponents map"
  - phase: 07-help-docs-v1-0
    plan: 03
    provides: "8 widget stubs at packages/spa/src/help/widgets/<Name>.stub.tsx (RepoTopologyMap, ScanReportPlayground, MigrationDryRun directly referenced here)"
provides:
  - "5 anchor MDX pages at packages/spa/src/help/pages/{landing,workflow/overview,repos/overview,observability/overview,operations/install}.mdx"
  - "1 HELP-06 keyboard-shortcuts MDX at packages/spa/src/help/pages/reference/shortcuts.mdx (explicit KbdHint import)"
  - "5 mermaid blocks pre-validated by mermaid.parse() syntax test (landing 1 + workflow 1 + repos 1 + observability 2)"
  - "4 HelpWidget JSX references at the correct files (RepoTopologyMap x2, ScanReportPlayground, MigrationDryRun)"
  - "Frontmatter shape contract enforced across all 6 MDX modules via table-driven vitest"
  - "Anchor render smoke covering MDX+MDXProvider+widget dispatch+mermaid slot (5 cases)"
  - "Reference/shortcuts render smoke covering HELP-06 KbdHint chips + GFM table (4 cases)"
affects:
  - 07-05 (route wiring — these 6 .mdx modules become lazy-route component targets)
  - HELP-01 (5 anchor pages content closed)
  - HELP-06 (shortcuts content migrated; legacy /help deletion deferred to Plan 07-05)

# Tech tracking
tech-stack:
  added: []   # zero new deps — everything is consumed from Plan 07-01's catalog
  patterns:
    - "Mermaid-as-JSX in MDX: <MermaidBlock code={`...`} /> instead of triple-backtick mermaid fences (Plan 07-04 strategic decision per 07-PLAN-CHECK.md; 07-05 ships pre-mapping as belt-and-suspenders)"
    - "MDX heading-anchor: explicit <h2 id='...'>...</h2> for in-page links — kramdown {#anchor} sugar is NOT MDX-compatible (acorn parses {...} as JS expression)"
    - "Mermaid syntax test must run in jsdom env (mermaid v11 DOMPurify needs window); plan's `@vitest-environment node` directive would crash"
    - "Strict TS on regex captures: `m[1]` is string|undefined under noUncheckedIndexedAccess — guard with typeof check before push()"
    - "MDX explicit KbdHint import: `import { KbdHint } from '...'` at top of shortcuts.mdx is defensive; Plan 07-05 adds it to mdxComponents to make implicit"

key-files:
  created:
    - packages/spa/src/help/pages/landing.mdx
    - packages/spa/src/help/pages/workflow/overview.mdx
    - packages/spa/src/help/pages/repos/overview.mdx
    - packages/spa/src/help/pages/observability/overview.mdx
    - packages/spa/src/help/pages/operations/install.mdx
    - packages/spa/src/help/pages/reference/shortcuts.mdx
    - packages/spa/src/help/__tests__/frontmatter.test.tsx
    - packages/spa/src/help/__tests__/mermaid-syntax.test.ts
    - packages/spa/src/help/__tests__/anchor-pages.test.tsx
    - packages/spa/src/help/__tests__/reference-shortcuts.test.tsx
  modified: []   # all new files; operations/install.mdx was modified post-creation in same plan (kramdown fix) — still net new

key-decisions:
  - "Mermaid is JSX (`<MermaidBlock code={...}/>`), NOT triple-backtick fenced — keeps content authoring decoupled from Plan 07-05 pre-mapping wiring. Strategic deviation acknowledged in 07-PLAN-CHECK.md."
  - "Heading anchors use explicit `<h2 id='...'>` HTML; the canonical kramdown `{#anchor}` syntax breaks acorn-based MDX parsing. Discovered by frontmatter test (RED phase) — classic TDD catch."
  - "Mermaid syntax test runs in jsdom, not node (plan's directive). mermaid v11 always initialises DOMPurify which requires window. Documented in test header comment."
  - "Anchor-pages test mocks widget stubs by path to avoid coupling to Plan 07-03's exact widget contents (smoke goal is HelpWidget dispatch + Suspense resolution, not stub content)."
  - "KbdHint import in reference/shortcuts.mdx kept explicit even after 07-05 will add to mdxComponents — isolation tests stay green without provider context."

patterns-established:
  - "Anchor MDX page authoring pattern: frontmatter + prose verbatim + JSX MermaidBlock + JSX HelpWidget. All 5 anchor pages follow identical shape."
  - "MDX test surface: 4 test files per Wave-2 plan (frontmatter shape + render smoke + syntax validation for diagrams + per-page render-and-content)."
  - "TDD on content plans: test that imports MDX file IS the RED phase; the content commit IS the GREEN. The vitest run is the proof."

requirements-completed:
  - HELP-01   # 5 anchor pages content closed (routing in 07-05)
  - HELP-06   # keyboard shortcuts content migrated to /help/reference/shortcuts

# Metrics
duration: 11min
completed: 2026-05-11
---

# Phase 07 Plan 04: Wave 2 page content (5 anchor MDX + reference/shortcuts MDX) Summary

**5 anchor MDX pages (landing + workflow/overview + repos/overview + observability/overview + operations/install) with verbatim frontmatter + prose + Mermaid-as-JSX conversion (5 blocks across 4 files) + 4 HelpWidget references at correct paths (RepoTopologyMap x2, ScanReportPlayground, MigrationDryRun); reference/shortcuts.mdx with HELP-06 KbdHint table + Common tasks list; 4 vitest test files (22 cases total, all green) validating frontmatter shape, Mermaid syntax (5 blocks pass mermaid.parse), anchor MDX render via MDXProvider, and HELP-06 KbdHint integration. SPA: 710 tests pass (+22). Workspace: 1381 tests green. Typecheck/build/lint all exit 0.**

## Performance

- **Duration:** ~11 min wall-clock (start 2026-05-11T18:56:12Z → end 2026-05-11T19:07:39Z)
- **Tasks:** 7 of 7
- **Commits:** 8 (5 feat + 2 fix + 1 not-applicable; per-task: T1 1 commit, T2 1, T3 2 — test + fix, T4 1 + 1 fix, T5 1, T6 1, T7 verification only)
- **Files created:** 10 (6 MDX + 4 tests)
- **Files modified:** 0 (operations/install.mdx was modified in same plan after creation — net new)
- **Test count delta:** SPA 688 → 710 (+22 from this plan: 7 frontmatter + 6 mermaid-syntax + 5 anchor-render + 4 shortcuts-render = 22)
- **Workspace test total:** 1381 pass (shared 158 + agent 482 + spa 710 + meta-observer 31)

## Accomplishments

- **5 anchor MDX pages shipped with content verbatim from the migration source.** Prose intact, frontmatter intact, all internal `/help/*` links preserved, all external links (github.com / capitalparx.com / pi.dev / etc.) preserved.
- **All 5 mermaid blocks converted from triple-backtick fences to `<MermaidBlock code={...}/>` JSX.** Distribution per plan: landing 1, workflow 1, repos 1, observability 2, operations 0. No fenced ` ```mermaid ` syntax remains in any pages file (grep returns empty).
- **All 4 HelpWidget JSX references land at the documented paths and use only 3 of the 8 valid stub names.** landing.mdx and repos/overview.mdx both reference RepoTopologyMap (2 sites); observability/overview.mdx → ScanReportPlayground; operations/install.mdx → MigrationDryRun. Unknown widget names would surface at TypeScript via the `WidgetName` keyof type — none exist.
- **reference/shortcuts.mdx ships HELP-06 content with explicit KbdHint import.** 8 KbdHint references inline (4 in the global shortcuts table + 4 in Common tasks bullets) covering R / ? / / / Cmd+K. The "When shortcuts don't fire" paragraph clarifies why the docs site itself doesn't trigger the dashboard's global shortcut hook.
- **Frontmatter shape contract enforced for every MDX module.** Table-driven test asserts `{slug, title, order, section}` on all 6 MDX files; HELP-06 named case verifies shortcuts.mdx title is exactly "Keyboard shortcuts".
- **Mermaid syntax pre-validated by `mermaid.parse()`.** Catches any typo at commit time, before Plan 07-05's Playwright walking checklist would discover it at browser-render time. All 5 blocks parse cleanly with `suppressErrors: false`.
- **Anchor MDX renders proven via MDXProvider.** RTL render of each MDX through `<MDXProvider components={mdxComponents}>` asserts headings appear, `pre.mermaid` slots appear (correct count per file), and the 3 referenced widget stubs dispatch via React.lazy + Suspense (mocked at test boundary so this plan is independent of 07-03 worktree merge).
- **HELP-06 evidence at integration level.** Shortcuts.mdx renders through the real mdxComponents map; the KbdHint chips for R / ? / / / Cmd / K all appear; GFM table renders (proves remark-gfm operational on shortcuts page); the "Refresh the current view's data" description for the R shortcut is present.

## Mermaid block accounting

| File | Mermaid blocks | Verified by |
|---|---|---|
| `landing.mdx` | 1 (flowchart LR: Idea → Brainstorm → Plan → Execute → Verify → Review → Ship + 4 gates) | mermaid.parse() |
| `workflow/overview.mdx` | 1 (flowchart TB: 4-layer composition L1→L2; L2→L3+L4) | mermaid.parse() |
| `repos/overview.mdx` | 1 (flowchart TB: spec subgraph → host subgraphs → consumer + projects) | mermaid.parse() |
| `observability/overview.mdx` | 2 (flowchart TB §10 contract + sequenceDiagram trace context) | mermaid.parse() |
| `operations/install.mdx` | 0 (sanity-asserted by test) | mermaid-syntax test rule 2 |
| `reference/shortcuts.mdx` | 0 (no diagram content) | (implicit) |
| **TOTAL** | **5** | total-count rule passes |

## HelpWidget reference accounting

| File | Widget(s) referenced | Plan 07-03 stub path |
|---|---|---|
| `landing.mdx` | `<HelpWidget name="RepoTopologyMap" />` | `widgets/RepoTopologyMap.stub.tsx` |
| `repos/overview.mdx` | `<HelpWidget name="RepoTopologyMap" />` | same as above (2 sites in v1.0) |
| `observability/overview.mdx` | `<HelpWidget name="ScanReportPlayground" />` | `widgets/ScanReportPlayground.stub.tsx` |
| `operations/install.mdx` | `<HelpWidget name="MigrationDryRun" />` | `widgets/MigrationDryRun.stub.tsx` |
| `workflow/overview.mdx` | (none — content-only) | — |
| `reference/shortcuts.mdx` | (none) | — |
| **TOTAL** | **4 references / 3 unique names** | All 3 names exist in HelpWidget dispatch table |

## Test counts

| Test file | Cases | Pass | Note |
|---|---|---|---|
| `frontmatter.test.tsx` | 7 (6 table + 1 named) | 7 | Table-driven; +1 named for HELP-06 title |
| `mermaid-syntax.test.ts` | 6 (4 file + 1 zero-count + 1 total-count) | 6 | jsdom env (mermaid v11 DOMPurify needs window) |
| `anchor-pages.test.tsx` | 5 (one per anchor) | 5 | Mocks 3 widget stubs + mermaid module |
| `reference-shortcuts.test.tsx` | 4 (heading + chips + R-desc + GFM table) | 4 | Real mdxComponents map, no mocks |
| **TOTAL** | **22** | **22** | All green |

## Task commits

Each task was committed atomically. Hashes are short SHA on `feat/help-docs-v1`.

1. **Task 1: 5 anchor MDX pages with JSX-converted Mermaid blocks** — `0eb97d5` (feat)
2. **Task 2: reference/shortcuts.mdx (HELP-06)** — `8460d1c` (feat)
3. **Task 3 RED→GREEN test commit** — `c4e10ba` (test) — caught kramdown bug
4. **Task 3 fix: kramdown `{#anchor}` → `<h2 id>` in operations/install.mdx** — `fb4c836` (fix)
5. **Task 4: mermaid syntax test (jsdom, not node, per mermaid v11 DOMPurify constraint)** — `017eb11` (test)
6. **Task 5: anchor MDX render smoke (5 cases)** — `551fb95` (test)
7. **Task 6: reference/shortcuts render + KbdHint integration (HELP-06)** — `64c61ee` (test)
8. **Task 4 follow-up fix: strict TS on regex match** — `605b9c3` (fix)

_HEAD at plan close: 605b9c3._

## Decisions Made

- **Mermaid-as-JSX over fenced ` ```mermaid `.** Honors the strategic deviation called out in 07-PLAN-CHECK.md F-04: Plan 07-05's `pre: MermaidPreOrDefault` mapping becomes belt-and-suspenders, not load-bearing. Content authoring decouples from route wiring.
- **Explicit `<h2 id="...">` for anchor headings; kramdown `{#anchor}` not MDX-compatible.** acorn (MDX's JS expression parser) treats `{...}` as an expression embed and fails on the literal `#`. The frontmatter test (RED phase) was the moment of discovery; classic TDD value.
- **`@vitest-environment jsdom` for mermaid-syntax test.** Plan specified node, but mermaid v11 unconditionally initialises DOMPurify at import — node-only crashes with "DOMPurify.addHook is not a function". jsdom satisfies the DOM requirement; parse() still runs as pure syntax check.
- **Widget stub mocks in anchor-pages test by relative path, not by content.** Decouples this plan's test from Plan 07-03's specific widget content; the smoke goal is "HelpWidget lazy dispatch + Suspense resolves to a renderable component" — a `<div data-testid>` proves that without depending on the real stub copy.
- **Explicit `import { KbdHint }` in shortcuts.mdx.** Plan 07-05 will register KbdHint in the mdxComponents map (making the explicit import redundant), but the explicit version keeps reference-shortcuts.test.tsx green without provider-context plumbing. Conservative belt-and-suspenders.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] kramdown `{#pi-install}` / `{#codex-install}` heading syntax in operations/install.mdx**
- **Found during:** Task 3 frontmatter test RED phase
- **Issue:** MDX's acorn parser treats `{...}` as a JS expression embed; the literal `#` inside fails with `SyntaxError: Unexpected token`. The source `.md` used kramdown heading-id sugar; that sugar is remark-gfm-recognized in plain Markdown but NOT MDX-compatible (MDX runs acorn before remark).
- **Fix:** Replaced both occurrences with explicit `<h2 id="pi-install">Pi install</h2>` and `<h2 id="codex-install">Codex install</h2>`. Preserves the in-page anchor links `[pi](#pi-install)` and `[Codex](#codex-install)` — same `id` attributes, just explicit HTML.
- **Files modified:** `packages/spa/src/help/pages/operations/install.mdx`
- **Verification:** frontmatter test went RED → GREEN (7 passed).
- **Committed in:** `fb4c836` (split from `c4e10ba` test commit for cleaner RED→GREEN history)

**2. [Rule 3 - Blocking] mermaid-syntax test crashed under `@vitest-environment node`**
- **Found during:** Task 4 first test run
- **Issue:** mermaid v11 imports DOMPurify at module load and calls `DOMPurify.addHook()`, which requires a `window` global. Plan's `// @vitest-environment node` directive resulted in `TypeError: DOMPurify.addHook is not a function`. Plan acknowledges this risk in a NOTE comment but doesn't prescribe the fix.
- **Fix:** Changed directive to `// @vitest-environment jsdom`. Documented in the test file's header comment explaining why.
- **Files modified:** `packages/spa/src/help/__tests__/mermaid-syntax.test.ts`
- **Verification:** Test went from 4 failed / 2 passed → 6 passed.
- **Committed in:** `017eb11` (single commit — fix landed before any GREEN commit existed)

**3. [Rule 1 - Bug] strict TypeScript on regex capture group**
- **Found during:** Task 7 workspace typecheck preflight
- **Issue:** `m[1]` from `RegExpExecArray` is typed `string | undefined` under `noUncheckedIndexedAccess`; pushing directly into `string[]` fails tsc strict mode. (Vite build skipped this file because vitest test files aren't typechecked at build time.)
- **Fix:** Guard with `if (typeof code === 'string') blocks.push(code)`. The regex always populates group 1 when match succeeds, but TS can't prove that.
- **Files modified:** `packages/spa/src/help/__tests__/mermaid-syntax.test.ts`
- **Verification:** `pnpm --filter @agenticapps/dashboard-spa typecheck` exit 0; mermaid test still 6/6 green.
- **Committed in:** `605b9c3` (post-Task-6 typecheck-fix commit; would otherwise have failed Task 7's workspace gate)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking).
**Impact on plan:** None of the 3 expanded scope. All 3 were caught at verification time and resolved without diverging from the plan's documented outputs. Two of them (1 + 2) were knowable risks the plan flagged or hinted at; the third (3) was a TypeScript strictness mismatch between plan-author intent and the SPA's tsconfig.

## Threat Flags

None. All threat dispositions in the plan's threat model (T-07-04-01..05) were honoured:
- T-07-04-01 (XSS via MDX content): all content sourced from in-repo migration files reviewed at commit time. No unsafe HTML injection helpers introduced anywhere in the help system. ✓
- T-07-04-02 (Open redirect via external links): no user-supplied URLs; all external links point to github.com, capitalparx.com, pi.dev, agenticapps.eu, claude.com, openai.com — all explicitly trusted in the project's threat model. ✓
- T-07-04-03 (Information disclosure): all repo names, project mentions, version numbers are public. ✓
- T-07-04-04 (DoS via Mermaid syntax error): mermaid.parse() validates every block at commit time — bad syntax blocks the test (Task 4). ✓
- T-07-04-05 (Tampering with KbdHint import path): the relative path `'../../../components/ui/KbdHint.js'` resolves to the controlled tokens-checked component file. ✓

No new threat surface introduced by this plan.

## Issues Encountered

None beyond the 3 auto-fixed deviations above. No flaky tests, no pre-existing failures resurfaced, no scope creep.

## Coverage Matrix

| Decision / Requirement | Task | Status |
|---|---|---|
| D-7-01 (HELP-06 shortcuts content moved to MDX) | T2, T6 | ✓ |
| D-7-13 (workflow stubs referenced in source content survived migration) | T1 (rationalization-table, red-flags links present) | ✓ (Plan 07-05 routes them) |
| D-7-14 (3-of-8 widget stubs referenced by anchor MDX) | T1 | ✓ |
| D-7-15 (content tests) | T3, T4, T5, T6 | ✓ |
| D-7-17 (verification evidence — vitest + grep) | T1..T7 | ✓ |
| HELP-01 (5 anchor pages content) | T1 | ✓ |
| HELP-06 (shortcuts content migrated) | T2, T6 | ✓ |
| Plan-check F-04 (dark-mode plumbing dormant; prose-invert class but no .dark{}) | implicit (no dark scaffold required) | ✓ |

## Next Phase Readiness

**Wave 3 (Plan 07-05 route wiring) unblocked.** Per the plan-check's coverage table:

- 6 MDX modules exist at the documented import paths Plan 07-05 will reference ✓
- Each MDX exports `default` (rendered component) + `frontmatter` (typed const) — proven by frontmatter test ✓
- 4 HelpWidget JSX references all resolve to existing stubs (Plan 07-03) — proven by anchor-pages test ✓
- 5 mermaid blocks pre-validated for syntax — Plan 07-05's Playwright no-console-errors invariant will not flake on bad mermaid ✓
- HELP-06 content renders inside the existing mdxComponents map — Plan 07-05 just needs to add KbdHint to the map for the implicit form to also work ✓

Plan 07-05 can author `helpRouteTable`, `buildHelpRoutes`, mount `_helpLayout`, delete the legacy `/help` route, run the Playwright walking checklist, and submit for impeccable critique.

## Self-Check: PASSED

**Files exist (`test -f` on each):**
- `packages/spa/src/help/pages/landing.mdx` — FOUND
- `packages/spa/src/help/pages/workflow/overview.mdx` — FOUND
- `packages/spa/src/help/pages/repos/overview.mdx` — FOUND
- `packages/spa/src/help/pages/observability/overview.mdx` — FOUND
- `packages/spa/src/help/pages/operations/install.mdx` — FOUND
- `packages/spa/src/help/pages/reference/shortcuts.mdx` — FOUND
- `packages/spa/src/help/__tests__/frontmatter.test.tsx` — FOUND
- `packages/spa/src/help/__tests__/mermaid-syntax.test.ts` — FOUND
- `packages/spa/src/help/__tests__/anchor-pages.test.tsx` — FOUND
- `packages/spa/src/help/__tests__/reference-shortcuts.test.tsx` — FOUND
- `.planning/phases/07-help-docs-v1-0/07-04-SUMMARY.md` — FOUND (this file)

**Commits exist (git log --oneline -10):**
- 0eb97d5 ✓ (T1 anchor MDX)
- 8460d1c ✓ (T2 shortcuts MDX)
- c4e10ba ✓ (T3 test)
- fb4c836 ✓ (T3 fix kramdown)
- 017eb11 ✓ (T4 mermaid test)
- 551fb95 ✓ (T5 anchor render)
- 64c61ee ✓ (T6 shortcuts render)
- 605b9c3 ✓ (T7 typecheck fix)

**Preflight gates:**
- `pnpm --filter @agenticapps/dashboard-spa typecheck` → exit 0
- `pnpm --filter @agenticapps/dashboard-spa test` → 87 files, 710 tests passed (was 688, +22 from this plan)
- `pnpm --filter @agenticapps/dashboard-spa build` → exit 0 (built in 704ms)
- `pnpm -r typecheck` → exit 0 (5/5 packages)
- `pnpm -r test` → 1381 workspace tests passed (shared 158 + agent 482 + spa 710 + meta-observer 31)
- `pnpm -r build` → exit 0
- `pnpm lint` → 0 errors, 52 warnings (all pre-existing — none in files authored by this plan)

---
*Phase: 07-help-docs-v1-0*
*Plan: 04 — Wave 2 page content (5 anchor MDX + reference/shortcuts MDX + content validation)*
*Completed: 2026-05-11*
