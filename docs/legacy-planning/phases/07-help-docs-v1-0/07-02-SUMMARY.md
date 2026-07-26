---
phase: 07-help-docs-v1-0
plan: 02
subsystem: spa-help
tags: [react, tdd, mdx, tanstack-router, mermaid, tokens, tailwind, jsdom]

# Dependency graph
requires:
  - phase: 07-help-docs-v1-0
    plan: 01
    provides: MDX pipeline + MDXProvider + mdxComponents stub + tokenSourceOfTruth extension
  - phase: 05.1-redesign
    provides: warm-paper tokens.css (the destination of all token translations)
provides:
  - "HelpLayout component — 5-section NAV with D-7-13 workflow stubs and HELP-06 keyboard-shortcuts entry"
  - "HelpWidget — lazy dispatch table for 8 widget stubs + unknown-widget bordered error + not-prose wrapper"
  - "HelpHook — inline (?) icon button with hover/focus tooltip + TanStack navigate({ to: topicToUrl(topic) })"
  - "ComingSoon — fallback for v1.0 stub pages with operations special-case (/install vs /overview)"
  - "MermaidBlock — StrictMode-safe runtime mermaid renderer; theme reads warm-paper tokens at runtime via getComputedStyle"
  - "topicToUrl — pure function (anchored on first # split) extracted for table-driven testing"
  - "mdxComponents map exporting { HelpWidget, HelpHook, ComingSoon, MermaidBlock } for MDX pages"
  - "8 placeholder widget stubs in packages/spa/src/help/widgets/ (Rule 3 — 07-03 overwrites at merge-back)"
affects:
  - 07-04 (anchor MDX pages — consumes HelpWidget/HelpHook/ComingSoon/MermaidBlock by name via MDXProvider)
  - 07-05 (route wiring — mounts HelpLayout at /help; finalises mdxComponents with KbdHint + pre)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TanStack Router NavLink-replacement: useRouterState({ select: s => s.location.pathname }) + manual isActive comparison"
    - "Mermaid theme variables read from CSS custom properties at runtime via getComputedStyle (no hex in source — invariant-safe)"
    - "vi.mock for ../widgets/*.stub.js paths (R2 disjoint-set with Plan 07-03 — but vite's import-analysis required placeholder files to load)"
    - "StrictMode-safe lazy renderer pattern: data-processed dataset guard + cancellation flag in useEffect"
    - "Tailwind v4 prose typography lives on the outer <article>; not-prose escape hatch on widgets/diagrams"

key-files:
  created:
    - packages/spa/src/help/topicToUrl.ts
    - packages/spa/src/help/topicToUrl.test.ts
    - packages/spa/src/help/components/HelpLayout.tsx
    - packages/spa/src/help/components/HelpLayout.test.tsx
    - packages/spa/src/help/components/HelpWidget.tsx
    - packages/spa/src/help/components/HelpWidget.test.tsx
    - packages/spa/src/help/components/HelpHook.tsx
    - packages/spa/src/help/components/HelpHook.test.tsx
    - packages/spa/src/help/components/ComingSoon.tsx
    - packages/spa/src/help/components/ComingSoon.test.tsx
    - packages/spa/src/help/components/MermaidBlock.tsx
    - packages/spa/src/help/components/MermaidBlock.test.tsx
    - packages/spa/src/help/widgets/RepoTopologyMap.stub.tsx (07-03 overwrites)
    - packages/spa/src/help/widgets/WorkflowStateMachine.stub.tsx (07-03 overwrites)
    - packages/spa/src/help/widgets/GatePicker.stub.tsx (07-03 overwrites)
    - packages/spa/src/help/widgets/TraceVisualizer.stub.tsx (07-03 overwrites)
    - packages/spa/src/help/widgets/ScanReportPlayground.stub.tsx (07-03 overwrites)
    - packages/spa/src/help/widgets/ApplyConsentSimulator.stub.tsx (07-03 overwrites)
    - packages/spa/src/help/widgets/MigrationDryRun.stub.tsx (07-03 overwrites)
    - packages/spa/src/help/widgets/SlashCommandCatalog.stub.tsx (07-03 overwrites)
  modified:
    - packages/spa/src/help/mdxComponents.ts (Plan 07-01 stub → populated with 4 components)

key-decisions:
  - "Mermaid theme = Option A (getComputedStyle reading --color-* CSS vars). Skipped Option B (hex literals + invariant allow-list) entirely. Honors plan-check F-01 hazard."
  - "HelpWidget runtime fallback for unknown widget names is a bordered-error div (not throw) — MDX authoring mistake should not crash the site."
  - "Mermaid render errors log via console.warn, NOT console.error, so Playwright's no-console-errors invariant (Plan 07-05) stays green even on bad fence syntax (RESEARCH P6)."
  - "Created 8 placeholder widget stub files (Rule 3 — blocking). Vite's import-analysis runs before vi.mock, so the test cannot load HelpWidget.tsx unless ../widgets/*.stub.js can be statically resolved. Orchestrator MUST resolve git conflicts on packages/spa/src/help/widgets/** in favour of 07-03's branch at merge-back."
  - "Test 'shows tooltip on focus' uses userEvent.tab() instead of the plan's btn.focus() — React's synthetic onFocus relies on delegation that jsdom's native focus call does not consistently trigger."
  - "HelpLayout source docblock rewritten to avoid the literal string 'react-router-dom' so the acceptance criterion `! grep -q react-router-dom` passes."

patterns-established:
  - "RED→GREEN commit prefix discipline: test(07-02): RED followed by feat(07-02): GREEN for every TDD task (6 cycles in this plan)."
  - "Token translation table (D-7-11) applied as a complete map; final audit via grep -oE proves every Tailwind class is a tokens.css name."
  - "All MDX-callable components ship with not-prose escape hatch on the outer wrapper so MDX prose typography does not bleed into widgets / diagrams (Pitfall 9)."

requirements-completed:
  - HELP-03
  - HELP-04
  - HELP-05

# Metrics
duration: 11min
completed: 2026-05-11
---

# Phase 07 Plan 02: Wave 1 shell components Summary

**HelpLayout (5 NAV sections + D-7-13 workflow stubs + HELP-06 keyboard-shortcuts) + HelpWidget (8 lazy widgets + unknown-widget guard + not-prose) + HelpHook (tooltip + TanStack navigate via topicToUrl) + ComingSoon (operations special-case fallback) + MermaidBlock (StrictMode-safe lazy renderer with CSS-var theme) + topicToUrl pure function + mdxComponents map populated — all 5 shell components TanStack-translated, token-translated, tested (48 cases), typechecked, built, and tokenSourceOfTruth-invariant-safe.**

## Performance

- **Duration:** ~11 min wall-clock (start 2026-05-11T18:37:34Z → end 2026-05-11T18:49:06Z, 692s)
- **Tasks:** 8 of 8
- **Commits:** 13 (6 RED + 6 GREEN + 1 Task 7 metadata)
- **Files created:** 21 (5 components + 5 component tests + 1 pure fn + 1 pure fn test + 8 placeholder widget stubs + 1 mdxComponents modification listed separately)
- **Test count delta:** 630 → 675 SPA tests (+45)
- **Tests added per file:**
  - topicToUrl.test.ts — 9 cases
  - HelpHook.test.tsx — 6 cases
  - ComingSoon.test.tsx — 7 cases
  - HelpWidget.test.tsx — 10 cases
  - MermaidBlock.test.tsx — 4 cases
  - HelpLayout.test.tsx — 9 cases

## Accomplishments

- **All 5 shell components landed end-to-end.** Each has its own test file with comprehensive coverage (NAV deltas, active-route detection, mobile drawer, operations special-case, StrictMode safety, lazy dispatch).
- **TanStack-router migration completed in the help domain.** Zero `react-router-dom` strings remain in any of the 5 component .tsx files. NavLink → Link + useRouterState; useNavigate signature `navigate({ to: '...' })`; Outlet same name.
- **Token translation table (D-7-11) applied 100%.** Every Tailwind class across all 5 components is a tokens.css name. Final audit (excludes CSS var references in comments):
  - bg-accent, bg-accent-bg, bg-accent-hover, bg-app-bg, bg-card-bg, bg-card-bg-hover, bg-card-bg-hover/60, bg-sidebar-bg, bg-sidebar-bg/60, bg-status-error/10, bg-text-primary
  - border-border-subtle (+ border-b, border-r, border-dashed structural variants), border-status-error/40
  - text-accent, text-app-bg, text-card-bg, text-status-error, text-text-primary, text-text-secondary, text-text-tertiary
- **Mermaid theme is hex-free.** Option A (getComputedStyle reading --color-* CSS vars) implemented per plan-check F-01 hazard. `tokenSourceOfTruth.test.ts` stays green.
- **HelpLayout NAV deltas verified.** Workflow gains rationalization-table + red-flags (D-7-13). Reference gains Keyboard shortcuts as first entry with status: ready (HELP-06).
- **mdxComponents finalised for v1.0 component-level scope.** Map now exports 4 of the 6 final entries; KbdHint + pre come in Plan 07-05.

## Token audit

`grep -roE "(bg|text|border)-[a-z]+(-[a-z]+)*(/[0-9]+)?" packages/spa/src/help/components/` (deduplicated):

```
bg-accent, bg-accent-bg, bg-accent-hover, bg-app-bg, bg-card-bg, bg-card-bg-hover,
bg-card-bg-hover/60, bg-sidebar-bg, bg-sidebar-bg/60, bg-status-error/10, bg-text-primary,
border-b, border-border-subtle, border-dashed, border-r, border-status-error/40,
text-accent, text-app-bg, text-card-bg, text-center, text-lg, text-sm, text-status-error,
text-text-primary, text-text-secondary, text-text-tertiary, text-xl, text-xs
```

Plus comment-only matches in MermaidBlock.tsx (CSS-var references, not Tailwind classes):
- `text-primary` (from `--color-text-primary`)
- `text-tertiary` (from `--color-text-tertiary`)

These are docblock annotations describing the CSS-var read; no className uses them. The narrowed audit `grep -oE 'className="[^"]*"' ... | grep -oE "(bg|text|border)-..."` returns ZERO matches for MermaidBlock — only `not-prose` and `mermaid` (escape hatch + library class).

**Zero hex literals in any component file** (`grep -rE '#[0-9a-fA-F]{3,8}\b' packages/spa/src/help/components/` returns nothing).

## TDD commit pairs

| Task | RED commit | GREEN commit | Tests |
|------|------------|--------------|-------|
| 1. topicToUrl | 41c0ef7 | ccfabc0 | 9 |
| 2. HelpHook | 3dea4c8 | 9924313 | 6 |
| 3. ComingSoon | 9f4dae8 | e6c3196 | 7 |
| 4. HelpWidget | 30c4a29 | 495060e | 10 |
| 5. MermaidBlock | a13972b | 8323378 | 4 |
| 6. HelpLayout | aa01b61 | 71ab92e | 9 |
| 7. mdxComponents (no TDD, populates Plan 07-01 stub) | — | 969bed3 | — |
| 8. Final sweep (verification only) | — | — | — |

_HEAD at plan close: 969bed3._

All 6 RED commits genuinely failed before their paired GREEN — verified in commit bodies. No GREEN commit was authored before the RED.

## Preflight gates (final)

| Gate | Result |
|------|--------|
| `pnpm --filter @agenticapps/dashboard-spa test src/help` | 7 files / 48 tests passed (+45 vs 07-01 close) |
| `pnpm --filter @agenticapps/dashboard-spa test` (full suite) | 81 files / 675 tests passed (+45 vs 07-01 close) |
| `pnpm --filter @agenticapps/dashboard-spa typecheck` | exit 0 |
| `pnpm --filter @agenticapps/dashboard-spa build` | exit 0 (mermaid lazy-chunked: sequenceDiagram/architectureDiagram/cytoscape as separate chunks) |
| `pnpm --filter @agenticapps/dashboard-spa exec eslint src/help/` | exit 0 (no warnings/errors in help/) |
| `pnpm --filter @agenticapps/dashboard-spa test src/styles/tokenSourceOfTruth.test.ts` | 3 passed (invariant green — zero hex in src/help/**) |
| `grep -rE '#[0-9a-fA-F]{3,8}\b' packages/spa/src/help/components/` | 0 matches |
| `grep -r "react-router-dom" packages/spa/src/help/` | 0 matches (verified — translation complete) |

## Files Created/Modified

**Created (21):**

Tests:
- `packages/spa/src/help/topicToUrl.test.ts` — 9 table-driven cases
- `packages/spa/src/help/components/HelpHook.test.tsx` — 6 cases (default label, override, hover, focus, click navigate, panel fall-through)
- `packages/spa/src/help/components/ComingSoon.test.tsx` — 7 cases (5 sections + GitHub link + Contributing link)
- `packages/spa/src/help/components/HelpWidget.test.tsx` — 10 cases (8 lazy dispatch + unknown error + not-prose)
- `packages/spa/src/help/components/MermaidBlock.test.tsx` — 4 cases (pre class, not-prose, StrictMode, async smoke)
- `packages/spa/src/help/components/HelpLayout.test.tsx` — 9 cases (5 NAV + 2 D-7-13 + HELP-06 + stub label + active styling + drawer + Outlet + search + article)

Components:
- `packages/spa/src/help/topicToUrl.ts` — pure function, 19 lines
- `packages/spa/src/help/components/HelpHook.tsx` — inline (?) button + tooltip + TanStack navigate
- `packages/spa/src/help/components/ComingSoon.tsx` — fallback page with operations-section special-case
- `packages/spa/src/help/components/HelpWidget.tsx` — 8-widget dispatch table via React.lazy
- `packages/spa/src/help/components/MermaidBlock.tsx` — StrictMode-safe runtime renderer with CSS-var theme
- `packages/spa/src/help/components/HelpLayout.tsx` — full layout (5 sections, 38 NAV items, mobile drawer)

Widget placeholders (Rule 3 — 07-03 overwrites at merge-back):
- `packages/spa/src/help/widgets/RepoTopologyMap.stub.tsx`
- `packages/spa/src/help/widgets/WorkflowStateMachine.stub.tsx`
- `packages/spa/src/help/widgets/GatePicker.stub.tsx`
- `packages/spa/src/help/widgets/TraceVisualizer.stub.tsx`
- `packages/spa/src/help/widgets/ScanReportPlayground.stub.tsx`
- `packages/spa/src/help/widgets/ApplyConsentSimulator.stub.tsx`
- `packages/spa/src/help/widgets/MigrationDryRun.stub.tsx`
- `packages/spa/src/help/widgets/SlashCommandCatalog.stub.tsx`

**Modified (1):**
- `packages/spa/src/help/mdxComponents.ts` — adds 4 imports + 4 entries in MDXComponents map

## Decisions Made

- **Option A (CSS-var theme) for MermaidBlock.** Per plan-check F-01 hazard the plan included two sequential code blocks; followed the explicit instruction to skip directly to Option A so the file never contains hex literals. `tokenSourceOfTruth.test.ts` stays clean.
- **Placeholder widget stubs (8 files) created in this worktree.** Vite's import-analysis statically resolves `lazy(() => import('../widgets/X.stub.js'))` at transform-time, BEFORE vi.mock can intercept. Without placeholders the HelpWidget test simply cannot load HelpWidget.tsx. The placeholders are minimal default exports clearly labelled "07-03 ships canonical at merge-back".
- **HelpHook focus-tooltip test uses `userEvent.tab()` instead of `btn.focus()`.** Native `Element.focus()` does not consistently trigger React's synthetic `onFocus` in jsdom; `userEvent.tab()` synthesises a real focus event sequence.
- **HelpLayout docblock rewritten** to avoid the literal string "react-router-dom" in a code comment, so the acceptance grep `! grep -q "react-router-dom"` passes literally rather than requiring a comment-only allowlist.
- **HelpLayout test fix for strict TS.** `arr[0].x` is `T | undefined` under TS strict mode; replaced with narrowed-on-throw pattern so `tsc --noEmit` stays green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Vite import-analysis blocks HelpWidget tests without physical widget stub files**
- **Found during:** Task 4 GREEN (running vitest on HelpWidget.test.tsx)
- **Issue:** Vite 8's import-analysis statically resolves the lazy `import('../widgets/X.stub.js')` URLs in HelpWidget.tsx at transform-time, BEFORE vi.mock takes effect. The module fails to load with "Failed to resolve import" and the test cannot even start. The plan's R2 disjoint-set resolution assumed vi.mock alone would be sufficient.
- **Fix:** Created 8 minimal placeholder `.stub.tsx` files in `packages/spa/src/help/widgets/`. Each is a 4-line default export labelled "Plan 07-02 placeholder; 07-03 ships canonical at merge-back".
- **Files modified:** `packages/spa/src/help/widgets/*.stub.tsx` (8 files)
- **Verification:** Test went from "no tests / module not found" → "10 tests passed".
- **Committed in:** `495060e` (Task 4 GREEN).
- **Merge-back note:** Orchestrator MUST take Plan 07-03's branch versions for `packages/spa/src/help/widgets/**` during the wave merge. 07-03 ships canonical stubs with richer markup + the `_stub-pattern.tsx` primitive these placeholders never had.

**2. [Rule 1 — Test bug] HelpHook focus-tooltip test used native btn.focus() which jsdom does not always propagate to React's synthetic onFocus**
- **Found during:** Task 2 GREEN (running vitest on HelpHook.test.tsx — 1 of 6 cases failing)
- **Issue:** `btn.focus()` is a native DOM call; React's `onFocus` listener relies on synthetic-event delegation that jsdom doesn't always trigger from a raw native focus call. The tooltip never appears in the test's view of the DOM.
- **Fix:** Replaced `btn.focus()` + `await user.tab()` with `await user.tab()` (focuses the button via tabbable order) + a second `await user.tab()` (tabs off to blur). Same coverage; same invariant (focus shows tooltip / blur hides).
- **Files modified:** `packages/spa/src/help/components/HelpHook.test.tsx`
- **Verification:** Test went 5/6 passing → 6/6 passing.
- **Committed in:** `9924313` (Task 2 GREEN).

**3. [Rule 3 — Blocking] @agenticapps/dashboard-shared dist missing in fresh worktree blocks full-suite test**
- **Found during:** Task 8 final sweep (`pnpm --filter @agenticapps/dashboard-spa test` reported 15 file failures due to "Failed to resolve import '@agenticapps/dashboard-shared'")
- **Issue:** Fresh worktree's `node_modules` did not include a built `packages/shared/dist`. The shared workspace package needs to be built before SPA tests can resolve its workspace dist exports (this is the same root cause as Phase 6 fix `6e86579` — "prebuild @agenticapps/dashboard-shared so vite can resolve workspace dist exports"). Not unique to Plan 07-02.
- **Fix:** Ran `pnpm --filter @agenticapps/dashboard-shared build` (tsup → `dist/index.js`).
- **Files modified:** none (build artefact only, in `.gitignore`).
- **Verification:** Full suite went 17 failed → 0 failed; 675 tests pass.
- **Committed in:** — (build step, no source change).

**4. [Rule 3 — Blocking] HelpLayout test typecheck errors under strict TS (arr[0] is T | undefined)**
- **Found during:** Task 7 verification (`pnpm typecheck`)
- **Issue:** `screen.getAllByRole(...)[0].toHaveAttribute(...)` produced 3 `TS18048: 'link' is possibly 'undefined'` errors under strict `noUncheckedIndexedAccess`.
- **Fix:** Replaced `arr[0].x` with explicit narrowing: `const v = arr[0]; if (!v) throw new Error('expected at least one ...')`. Same coverage; same intent; throws a useful message if the underlying NAV ever drops the entry.
- **Files modified:** `packages/spa/src/help/components/HelpLayout.test.tsx`
- **Verification:** `pnpm typecheck` → exit 0.
- **Committed in:** `969bed3` (Task 7).

**5. [Rule 1 — Test bug] ComingSoon GitHub-link test used invalid jest-dom matcher syntax**
- **Found during:** Task 3 RED authoring
- **Issue:** The plan-provided test used `expect(link).toHaveAttribute('href', expect.stringContaining(...))` — `toHaveAttribute` does NOT accept asymmetric matchers as its second argument. Would have produced a misleading failure message even if the implementation was correct.
- **Fix:** Replaced with `expect(link.getAttribute('href')).toContain(...)`. Same coverage; same invariant (the GitHub issues URL contains "agenticapps-dashboard/issues").
- **Files modified:** `packages/spa/src/help/components/ComingSoon.test.tsx` (in the RED commit itself)
- **Verification:** Test passed in GREEN run (7/7).
- **Committed in:** `9f4dae8` (Task 3 RED, with explanatory commit body).

**6. [Rule 1 — Documentation] HelpLayout docblock mentioned react-router-dom in a comment, triggering the acceptance criterion grep**
- **Found during:** Task 6 GREEN (running the acceptance criteria after vitest passed)
- **Issue:** A migration-context comment said `(translated: react-router-dom NavLink/Outlet → @tanstack/react-router ...)`. The acceptance criterion `! grep -q "react-router-dom"` is a coarse grep that doesn't distinguish imports from comments.
- **Fix:** Rewrote the docblock paragraph to convey the same migration intent without the literal string "react-router-dom".
- **Files modified:** `packages/spa/src/help/components/HelpLayout.tsx`
- **Verification:** `grep -q "react-router-dom" packages/spa/src/help/components/HelpLayout.tsx` exit 1; tests still 9/9 green.
- **Committed in:** `71ab92e` (Task 6 GREEN — fix included in the same commit since it doesn't change runtime behaviour).

---

**Total deviations:** 6 auto-fixed (4 blocking, 2 test bugs). No deviations required Rule 4 (architectural ask). All deviations are documented in their commit bodies.

## Threat Flags

None. All threat dispositions in the plan's `<threat_model>` (T-07-02-01..07) were honoured:

- T-07-02-01 (Mermaid securityLevel: 'loose'): MITIGATED — `securityLevel: 'loose'` set, mermaid source comes only from MDX (controlled by us).
- T-07-02-02 (HelpHook tooltip XSS): MITIGATED — `{label}` is a React expression; React auto-escapes.
- T-07-02-03 (HelpWidget dispatch table): ACCEPTED — compile-time WidgetName union + runtime fallback to bordered error.
- T-07-02-04 (topicToUrl open redirect): MITIGATED — always prefixes `/help/`; v1.0 topics are hardcoded in MDX.
- T-07-02-05 (mock vs real stubs): ACCEPTED — vi.mock is test-time only; production code imports from the real `*.stub.js` paths.
- T-07-02-06 (Mermaid theme runtime read): MITIGATED — `getComputedStyle(document.documentElement)` reads only `--color-*` CSS vars from tokens.css (controlled by us).
- T-07-02-07 (Mermaid render-failure infinite retry): MITIGATED — `console.warn` fires once per `code` change; `data-processed` guard prevents re-runs.

No new threat surface introduced beyond the plan's <threat_model>.

## Issues Encountered

- **Fresh worktree had no packages/shared/dist.** Required a one-off `pnpm --filter @agenticapps/dashboard-shared build`. Not unique to Plan 07-02 — the same root cause that landed Phase 6 commit `6e86579` ("prebuild @agenticapps/dashboard-shared so vite can resolve workspace dist exports"). The orchestrator should consider running `pnpm -r build --filter @agenticapps/dashboard-shared` once before spawning Wave-1 worktrees.
- **Vite 8 + vi.mock interaction.** Documented in Deviation 1. Worth a note in Pitfall 10 of RESEARCH.md if Phase 7+ adds more lazy-loaded dispatch tables.

## Coverage Matrix

| Decision / Refinement | Task | Status |
|---|---|---|
| D-7-11 (token translation table — complete map applied) | T2..T6 | ✓ |
| D-7-12 (peer layout) | T6 (HelpLayout) | ✓ |
| D-7-13 (extra workflow stubs: rationalization-table, red-flags) | T6 | ✓ |
| D-7-14 (8 widget stubs by name) | T4 (HelpWidget dispatch); 07-03 owns the stub files | ✓ |
| D-7-15 (component test surface per spec) | T1..T6 | ✓ |
| D-7-16 (5-plan decomposition with parallel 07-02 + 07-03) | this plan | ✓ |
| HELP-03 (HelpLayout component) | T6 | ✓ |
| HELP-04 (HelpWidget component) | T4 | ✓ |
| HELP-05 (HelpHook component) | T2 | ✓ |
| HELP-06 (Keyboard shortcuts NAV entry) | T6 | ✓ |
| RESEARCH P1 (Mermaid StrictMode safety) | T5 | ✓ |
| RESEARCH P4 (no hex in src/help/**) | T5 (Option A) | ✓ |
| RESEARCH P6 (console.warn not console.error on mermaid failure) | T5 | ✓ |
| RESEARCH P9 (not-prose wrapper on widgets + MermaidBlock) | T4 + T5 | ✓ |
| Plan-check F-01 (skip hex literal step in MermaidBlock) | T5 | ✓ |
| Plan-check F-02 (canonical token audit via grep + visual inspection) | this SUMMARY | ✓ |

## Next Phase Readiness

**Plan 07-04 (anchor MDX pages) is unblocked.** The 4 MDX-callable components are registered in `mdxComponents.ts` and resolve at MDX render-time via the MDXProvider chain from Plan 07-01. Plan 07-04 can author `*.mdx` pages that reference `<HelpWidget name="..." />` and `<HelpHook topic="..." />` without explicit imports.

**Plan 07-05 (route wiring + Playwright walking checklist)** can:
1. Add `KbdHint` + `pre: MermaidPreOrDefault` to `mdxComponents.ts` (this plan deliberately stopped at the 4 widely-used components per the plan's explicit instruction).
2. Mount HelpLayout at `/help/*` via TanStack route definition.
3. Author Playwright specs that drive the rendered shell + assert SVG visibility from Mermaid (deferred from this plan's unit tests per D-7-15).

**Wave 1 parallel sibling 07-03** lands the canonical widget stub files. Merge-back protocol:
- Git conflicts on `packages/spa/src/help/widgets/**` MUST resolve in favour of 07-03's branch (this worktree only carries placeholders).
- All other files (5 components, 5 component tests, topicToUrl + test, mdxComponents update) are exclusive to Plan 07-02 and produce no conflict.

## Self-Check: PASSED

**Files exist (this worktree):**
- `packages/spa/src/help/topicToUrl.ts` — FOUND
- `packages/spa/src/help/topicToUrl.test.ts` — FOUND
- `packages/spa/src/help/components/HelpLayout.tsx` — FOUND
- `packages/spa/src/help/components/HelpLayout.test.tsx` — FOUND
- `packages/spa/src/help/components/HelpWidget.tsx` — FOUND
- `packages/spa/src/help/components/HelpWidget.test.tsx` — FOUND
- `packages/spa/src/help/components/HelpHook.tsx` — FOUND
- `packages/spa/src/help/components/HelpHook.test.tsx` — FOUND
- `packages/spa/src/help/components/ComingSoon.tsx` — FOUND
- `packages/spa/src/help/components/ComingSoon.test.tsx` — FOUND
- `packages/spa/src/help/components/MermaidBlock.tsx` — FOUND
- `packages/spa/src/help/components/MermaidBlock.test.tsx` — FOUND
- `packages/spa/src/help/widgets/{RepoTopologyMap,WorkflowStateMachine,GatePicker,TraceVisualizer,ScanReportPlayground,ApplyConsentSimulator,MigrationDryRun,SlashCommandCatalog}.stub.tsx` — 8 FOUND
- `packages/spa/src/help/mdxComponents.ts` — FOUND (modified, was Plan 07-01 empty stub)
- `.planning/phases/07-help-docs-v1-0/07-02-SUMMARY.md` — FOUND (this file)

**Commits exist (git log):**
- 41c0ef7, ccfabc0 (T1) ✓
- 3dea4c8, 9924313 (T2) ✓
- 9f4dae8, e6c3196 (T3) ✓
- 30c4a29, 495060e (T4) ✓
- a13972b, 8323378 (T5) ✓
- aa01b61, 71ab92e (T6) ✓
- 969bed3 (T7) ✓

**Preflight gates:**
- `pnpm --filter @agenticapps/dashboard-spa test src/help` → 7 files / 48 tests passed
- `pnpm --filter @agenticapps/dashboard-spa test` → 81 files / 675 tests passed
- `pnpm --filter @agenticapps/dashboard-spa typecheck` → exit 0
- `pnpm --filter @agenticapps/dashboard-spa build` → exit 0 (mermaid lazy-chunked)
- `pnpm --filter @agenticapps/dashboard-spa exec eslint src/help/` → exit 0
- `pnpm --filter @agenticapps/dashboard-spa test src/styles/tokenSourceOfTruth.test.ts` → 3 passed
- `grep -rE '#[0-9a-fA-F]{3,8}\b' packages/spa/src/help/components/` → 0 matches
- `grep -r "react-router-dom" packages/spa/src/help/` → 0 matches

---
*Phase: 07-help-docs-v1-0*
*Plan: 02 — Wave 1 shell components*
*Completed: 2026-05-11*
