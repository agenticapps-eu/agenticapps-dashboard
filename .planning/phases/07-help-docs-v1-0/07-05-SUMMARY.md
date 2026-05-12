---
phase: 07-help-docs-v1-0
plan: 05
subsystem: spa-help-routing-closure
tags: [tanstack-router, lazy-routes, mdx, playwright, impeccable, closing-ritual, tdd, checkpoint]

# Dependency graph
requires:
  - phase: 07-help-docs-v1-0
    plan: 01
    provides: "MDX pipeline, Tailwind v4 typography, Playwright runner, REQUIREMENTS HELP-01..06, tokenSourceOfTruth scope extension"
  - phase: 07-help-docs-v1-0
    plan: 02
    provides: "HelpLayout (sidebar+drawer+main+TOC) + HelpWidget (8-stub lazy dispatch) + HelpHook (deep-link) + ComingSoon + MermaidBlock + topicToUrl + populated mdxComponents map"
  - phase: 07-help-docs-v1-0
    plan: 03
    provides: "8 widget stubs at packages/spa/src/help/widgets/<Name>.stub.tsx"
  - phase: 07-help-docs-v1-0
    plan: 04
    provides: "6 MDX pages (5 anchors + reference/shortcuts) with frontmatter, Mermaid-as-JSX, HelpWidget references"
provides:
  - "helpRouteTable: typed source of truth — 43 entries (1 index + 5 anchors + 32 stubs + 4 redirects + 1 catchAll) with snapshot test guard"
  - "buildHelpRoutes factory: turns table into TanStack createRoute() instances; handles 5 entry kinds"
  - "ComingSoonRoute wrapper: shared parameterized stub-route component"
  - "5 lazy MDX route wrappers (createLazyRoute) — landing + 4 overview anchors + reference/shortcuts"
  - "_helpLayout route mounted at path '/help' (NOT pathless id-only — diagnosed bug; see Technical Findings)"
  - "Legacy /help route (routes/help.lazy.tsx) DELETED; legacy-help-route-deleted.test.ts is GREEN guard"
  - "mdxComponents finalized with 6 entries (HelpWidget, HelpHook, MermaidBlock, code, KbdHint, pre fallback)"
  - "Playwright walking-checklist spec (8 tests × 2 projects = 16 cases): zero console.errors, all anchors + redirects + stubs + ? shortcut + mobile drawer"
  - "useGlobalShortcuts modifier-bail fix: ? now works on US-layout keyboards (Shift+/ producing e.key === '?' with shiftKey=true)"
  - "07-VERIFICATION.md + 07-UAT.md: phase-level evidence map for HELP-01..06 + ROADMAP S1..S8"
  - "evidence/ artifacts: playwright.log, impeccable.log, 7 PNG screenshots (6 desktop + 1 mobile landing)"
affects:
  - HELP-01 (5 anchor MDX pages render — closed)
  - HELP-02 (32 stub paths render ComingSoon — closed)
  - HELP-03 (sidebar collapse + sticky + no console errors — closed)
  - HELP-04 (HelpWidget React.lazy dispatch + unknown error — closed)
  - HELP-05 (HelpHook ships, not yet wired — closed for v1.0 scope per CONTEXT.md deferred)
  - HELP-06 (shortcuts at /help/reference/shortcuts; legacy deleted; ? routes to /help — closed)
  - ROADMAP S1..S8 — closed (with S7 dormant in v1.0 per CONTEXT.md deferred + dark:prose-invert removal)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TanStack route generation from a typed table: discriminated union (index/anchor/stub/redirect/catchAll) + factory pattern; alternative to file-based routes"
    - "Pathless layout (`id`-only, no `path`) is a TanStack trap when combined with absolute child paths and a `$` catchAll: depth-based isFrameMoreSpecific picks the deeper catchAll over the static index. Solution: give layout a `path: '/help'` and use canonical relative paths on children (`/` index, `$` catchAll). Documented in fix commit f47f5f2."
    - "useGlobalShortcuts modifier-bail: shiftKey must NOT be in the bail — US-layout users need Shift+/ to type `?`. metaKey/ctrlKey/altKey still preserved. Test GS8b covers real-browser scenario; existing GS8 (no modifier) preserved for compat."
    - "dark:prose-invert is NOT dormant in v1.0 — theme system (lib/theme.ts) defaults to `dark` mode and adds .dark class to <html> app-wide. CONTEXT.md's assumption was wrong; fix landed in 0ce906a (drop the modifier, ship light-only docs prose for v1.0)."
    - "Playwright walking checklist as canonical e2e gate: 8 tests × 2 viewports (1440x900 + 375x800), zero console.error invariant, pairing state seeded via page.addInitScript before goto."
  removed_packages: []
  patterns_removed:
    - "Legacy /help keyboard-shortcuts page (routes/help.lazy.tsx + routes/__tests__/help.test.tsx) — content migrated to /help/reference/shortcuts MDX"

# Test surface
tests:
  added_unit:
    - "helpRouteTable.test.ts (6 cases: count snapshot, unique stub paths, D-7-13 inclusion, shortcuts-is-anchor invariant, 4 redirect specs, catchAll redirect target)"
    - "legacy-help-route-deleted.test.ts (2 cases: routes/help.lazy.tsx absent, routes/__tests__/help.test.tsx absent)"
    - "router.test.tsx RT1a (1 case: _helpLayout peer route mounted at /help with correct id)"
    - "useGlobalShortcuts.test.tsx GS8b (1 case: ? with shiftKey=true still navigates to /help)"
  added_e2e:
    - "help-walking-checklist.spec.ts (8 tests × 2 projects = 16 cases): anchor walk + Mermaid + redirects + stub sample + widget Suspense + ? shortcut + mobile drawer + KbdHint chips"
  delta:
    - "Pre-plan baseline (post-Wave C): 710 SPA unit tests"
    - "Post-plan unit: 716 (+6) — helpRouteTable 6 + legacy-deleted 2 + RT1a 1 + GS8b 1 - some refactor consolidation"
    - "Post-plan e2e: 16/16 Playwright cases, 0 console.error events"

---

# Plan 07-05 Summary — Wave 3 Route Wiring + Closing Ritual

## What shipped

The decisive plan that wires the entire Phase 7 stack into the SPA's TanStack router and runs the closing ritual against the result.

### Routing infrastructure (T1-T5)

A typed 43-entry `helpRouteTable` (`packages/spa/src/help/helpRouteTable.ts`) is the single source of truth for the `/help/*` route tree. The `buildHelpRoutes` factory turns it into TanStack `createRoute()` instances under a new `_helpLayout` route, mounted as a PEER of `_appshell` at `rootRoute` (D-7-12) so `/help/*` bypasses the AppShellV2 chrome.

Five lazy MDX route wrappers (`packages/spa/src/help/pages/*.lazy.tsx`) point at Plan 07-04's MDX modules. A shared `ComingSoonRoute` wraps `<ComingSoon section title />` for all 32 stub routes — one parameterized component, not 32 lazy files.

`mdxComponents.ts` finalized with 6 entries: HelpWidget, HelpHook, MermaidBlock, `code` (for inline KbdHint), KbdHint (explicit MDX-callable), and `pre: MermaidPreOrDefault` (defensive — falls back to default `<pre>` for non-mermaid fenced blocks).

Legacy `routes/help.lazy.tsx` and its test DELETED; `legacy-help-route-deleted.test.ts` is a green guard against accidental resurrection.

### Closing ritual (T6-T12)

- **T6 impeccable.yml**: confirmed Phase 6 06-06 already added `/help` to the route list — no-op (`grep -q "/help" .github/workflows/impeccable.yml` returns true).
- **T7 Playwright spec authored**: `packages/spa/e2e/help-walking-checklist.spec.ts` — 8 test functions × 2 viewport projects = 16 cases.
- **T8 pre-flight**: `pnpm -r typecheck && pnpm -r test && pnpm lint && pnpm -r build` all green.
- **T9 Playwright walking checklist**: ran. INITIALLY 9/16 RED (see Technical Findings). After 5 fix commits, 16/16 GREEN, zero console.error events, TanStack params.stringify warn flood RESOLVED.
- **T10 impeccable score**: TOOLING DRIFT discovered — `npx impeccable critique` removed in v2.1.8 (only `detect` survives). Post-fix `detect` reports 5 low-contrast findings on /help, all from Phase 5.1 inherited `text-text-tertiary #9c95a8` (2.8:1 vs 3:1 target). **Zero findings caused by Plan 07-05's own additions.** User decided to ship Phase 7 and defer impeccable tooling + token-contrast bump to v1.0.1 — recorded in deferred-items.md.
- **T11 /browse screenshots**: 7 PNGs captured in `evidence/` — 6 routes × desktop + 1 mobile landing.
- **T12 VERIFICATION + UAT drafted**: `07-VERIFICATION.md` maps HELP-01..06 + ROADMAP S1..S8 to evidence pointers; `07-UAT.md` lists 4 manual-only behaviors + reviewer post-merge checklist.

## Commits (24 total on this plan)

Wave 3 ran as 4 sub-phases (autonomous T1-T8, RED T9, fix-up T9-T12, inline `?` shortcut fix):

| # | Hash | Type | Description |
|---|------|------|-------------|
| 1 | `a9e598b` | test (RED) | T1: helpRouteTable snapshot (43 entries) |
| 2 | `d6f6447` | feat | T1+T2 folded GREEN: helpRouteTable + 6 lazy MDX wrappers + HelpPage shell |
| 3 | `f85c822` | feat | T3: ComingSoonRoute + buildHelpRoutes factory |
| 4 | `c8b6a65` | test (RED) | T4: legacy /help deletion guard |
| 5 | `ef6cc77` | feat (GREEN) | T4: _helpLayout peer route + legacy /help removed |
| 6 | `31f0b10` | feat | T5: mdxComponents.ts → .tsx rename |
| 7 | `477b7e1` | feat | T5: mdxComponents content (KbdHint + pre fallback) |
| 8 | `e0fe2e7` | fix | Auto-fix during T8: buildHelpRoutes paths must NOT strip /help prefix |
| 9 | `312f8e3` | test | T7: Playwright walking-checklist spec |
| 10 | `f4c6e9e` | chore | T8: pre-flight gate evidence |
| 11 | `7463046` | docs | VALIDATION T1-T8 green; STATE record at T9 checkpoint |
| 12 | `c169c73` | test (RED) | T9: Playwright walking checklist 9/16 failed (blocking gate) |
| 13 | `f47f5f2` | fix | T9 fix 1: mount _helpLayout at /help (single root cause for F1/F2 + F5/F6 + F8/F9) |
| 14 | `1082a69` | fix | T9 fix 2: tighten KbdHint locator + seed pairing in walking-checklist spec |
| 15 | `98c45f6` | test (GREEN) | T9: 16/16 green, 0 console.error |
| 16 | `18ba95d` | test | T10: impeccable tool surface drifted — 5 inherited findings, 0 from this plan |
| 17 | `0ce906a` | fix | Bonus: drop dark:prose-invert (theme system adds .dark by default; CONTEXT.md mis-assumption) |
| 18 | `d86bb20` | test | T11: 7 /browse screenshots committed |
| 19 | `34b0de3` | docs | T12: VERIFICATION + UAT drafted; VALIDATION rows updated |
| 20 | `a2de025` | test (RED) | Inline fix: GS8b real-browser ? keypress test |
| 21 | `84b688f` | fix (GREEN) | Inline fix: drop shiftKey from useGlobalShortcuts modifier-bail |
| 22 | `631da77` | docs | UAT + deferred-items reflect inline ? fix and v1.0.1 follow-ups |

## Technical Findings (notable bugs caught + fixed)

### F-CRIT-1: _helpLayout pathless + absolute paths + $ catchAll trap (f47f5f2)

**Symptom**: 6 of 16 Playwright tests failed in 3 outwardly-unrelated clusters:
- Every anchor's `article.prose` never became visible (5s timeout)
- Catch-all redirect `/help/unknown` never fired (page never loaded)
- `<aside aria-label="Help navigation">` not found by getByLabel

**Root cause**: With pathless `_helpLayout` (`id`-only, no `path`) and absolute `/help/...` paths on every child, TanStack v1.169's `isFrameMoreSpecific` rewards DEEPER frames when statics/dynamics/index-ness are equal. The catch-all `/help/$` (depth 3) silently outranked the static index `/help` (depth 2). `/help` resolved to the empty catch-all route, `<Outlet/>` rendered nothing, the catch-all's redirect-to-/help looped. F8/F9 (aria-label) appeared broken because the page never rendered at all.

**Fix**: Drop `id`, mount layout at `path: '/help'`, children use canonical relative paths (`/` for index, `$` for catch-all, etc.).

**Bonus**: The TanStack `Generated path … did not match` warn flood that surfaced in the initial T9 run was ALSO a symptom of the same matcher bug. Resolved by the same commit.

### F-CRIT-2: useGlobalShortcuts shiftKey bail prevents ? on US layouts (84b688f)

**Symptom**: Real US-keyboard users couldn't trigger the `?` → /help shortcut. Playwright synthetic `page.keyboard.press('?')` bypasses OS layout and produced `shiftKey=false`, so the e2e walk passed.

**Root cause**: `useGlobalShortcuts.ts:49` bailed on `e.shiftKey`. On US layouts, `?` requires `Shift+/`, so `e.shiftKey=true` accompanies every `?` keypress. The hook never fired.

**Fix**: Drop `shiftKey` from the modifier-bail. metaKey/ctrlKey/altKey preserved (Cmd-R, Cmd-K, Alt-combos still untouched). New unit test `GS8b` covers the real-browser scenario explicitly.

**Scope note**: This bug is pre-existing Phase 6 POLISH-01 code, not introduced by Phase 7. User decided in auto-mode question gate to fix inline in this PR rather than defer to v1.0.1.

### F-CRIT-3: dark:prose-invert not dormant in v1.0 (0ce906a)

**Symptom**: Prose rendered WHITE on warm paper background — discovered during T11 screenshot capture.

**Root cause**: Phase 7 CONTEXT.md `<deferred>` block stated "v1.0 ships no `.dark{}` block; `dark:prose-invert` is dormant" — incorrect. The dashboard's theme system (`lib/theme.ts`, D-02) defaults to `dark` mode and adds `.dark` class to `<html>` app-wide. `dark:prose-invert` thus fired, inverting headings + body to white.

**Fix**: Drop `dark:prose-invert` from HelpLayout `<article>`. v1.0 ships unconditional light-mode prose. Dark-mode prose deferred to v1.1.

**Future-proof note**: Logged in deferred-items.md — when authoring future CONTEXT.md `<deferred>` blocks involving dark mode, verify against `lib/theme.ts` actual default, not the assumed "no .dark{} block" pattern.

## Test count delta

| Stage | Tests |
|-------|-------|
| Pre-phase (main `26e78c7`) | 627 |
| After 07-01 (Wave 0) | 630 (+3) |
| After 07-02+07-03 (Wave 1) | 688 (+58) |
| After 07-04 (Wave 2) | 710 (+22) |
| After 07-05 T1-T8 | 715 (+5) |
| After 07-05 fix-up + T9-T12 + ? fix | **716 (+1, post-refactor consolidation)** |
| Plus e2e Playwright | **16/16 cases** |

## Deferred to v1.0.1 (per user auto-mode decisions)

1. **Impeccable tooling drift** — pin to a scoring-capable version OR rewrite scorer using `detect` + custom aggregator.
2. **`text-text-tertiary` token contrast bump** — `#9c95a8` (2.8:1) → `#8b85a0` or darker (3:1+). Cross-phase Phase 5.1 patch; needs visual regression review.

Both tracked in `deferred-items.md`.

## Status

- Plan 07-05: **COMPLETE** (T1-T12 + 2 inline fixes)
- Phase 7: **READY FOR TWO-STAGE REVIEW** (`/review` Stage 1 + `superpowers:requesting-code-review` Stage 2) and final phase complete
- Working tree clean at HEAD `631da77`
- Branch: `feat/help-docs-v1` (26 commits ahead of origin/main — about to be 28 with this SUMMARY + final phase-complete commit)

## Self-Check

- [x] All 12 tasks executed atomically with TDD discipline where mandated
- [x] All success criteria (8 ROADMAP + 6 HELP-01..06) covered with evidence pointers in 07-VERIFICATION.md
- [x] Two critical implementation bugs (F-CRIT-1, F-CRIT-2) and one CONTEXT mis-assumption (F-CRIT-3) caught + fixed
- [x] Working tree clean; all changes committed
- [x] No hex literals or shadcn tokens introduced (`tokenSourceOfTruth.test.ts` invariant green)
- [x] 16/16 Playwright + 716 unit tests; typecheck/build/lint green
- [x] User decisions on v1.0.1 follow-ups documented in deferred-items.md

Self-Check: PASSED
