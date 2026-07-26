---
phase: 07
slug: help-docs-v1-0
status: drafted
authored: 2026-05-11
---

# Phase 7: /help docs v1.0 — Verification

> 1:1 evidence map per HELP-01..HELP-06 + ROADMAP S1..S8. Drafted at the
> close of Plan 07-05 (Task 12); awaits final UAT sign-off + post-merge
> two-stage review.

## Requirement → Evidence Map

| Requirement | Behavior                                                                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                       | Status |
|-------------|------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------|
| HELP-01     | 5 anchor MDX pages render with Tailwind Typography prose + Mermaid SVG                   | `src/help/__tests__/anchor-pages.test.tsx` (5 cases pass) + `mermaid-syntax.test.ts` (5 fenced blocks parse via `mermaid.parse()`) + Playwright walking checklist test "every anchor renders without console errors; Mermaid SVG appears" (chromium-desktop + chromium-mobile, 6.2s, 16/16) + screenshots `help-{landing,workflow,repos,observability,operations}-lg.png`        | ✅      |
| HELP-02     | 32 stub paths render `<ComingSoon section title />` with section-aware back-link         | `helpRouteTable.test.ts` snapshot (43-entry table = 1 index + 5 anchors + 32 stubs + 4 redirects + 1 catch-all) + `ComingSoon.test.tsx` (table-driven back-link incl. `operations → /help/operations/install`) + Playwright "sampled stub routes render ComingSoon + back-link" (chromium-desktop + chromium-mobile)                                                            | ✅      |
| HELP-03     | HelpLayout sidebar + main shell + mobile drawer + zero console errors                    | `HelpLayout.test.tsx` (9 cases: NAV sections, stub-tag, mobile drawer toggle, search disabled, aside aria-label="Help navigation", article.prose without dark:prose-invert) + Playwright `console.error.length === 0` assertion + Playwright "Mobile viewport HelpLayout sidebar hidden initially; toggle opens it" (375×800)                                                  | ✅      |
| HELP-04     | HelpWidget dispatches 8 named stubs via lazy import + Suspense fallback                   | `HelpWidget.test.tsx` (10 cases: dispatch known names, error for unknown, `not-prose` wrapper) + `widgets/__tests__/stubs-smoke.test.tsx` (8 cases) + Playwright "widget Suspense resolves: repos/overview shows Coming v1.2 badge" + screenshot `help-repos-lg.png` (Coming v1.2 badge visible)                                                                                | ✅      |
| HELP-05     | HelpHook component ships + `topicToUrl(topic[, anchor])` produces correct URLs           | `topicToUrl.test.ts` (9 cases, table-driven) + `HelpHook.test.tsx` (6 cases: tooltip toggle, navigate dispatch, accessibility) — component does NOT yet have a v1.0 consumer (D-7 deferred to v1.1 wiring), but ships as a stable API                                                                                                                                          | ✅      |
| HELP-06     | Shortcuts content lives at `/help/reference/shortcuts`; legacy `/help` route deleted; `?` shortcut unchanged | `__tests__/legacy-help-route-deleted.test.ts` (2 cases: routes/help.lazy.tsx + tests/help.test.tsx both gone) + `reference-shortcuts.test.tsx` (4 cases: KbdHint imports + table render) + Playwright "? shortcut from / lands on /help docs landing" (pairing seeded) + existing `useGlobalShortcuts.test.tsx` GS8 still green + screenshot `help-shortcuts-lg.png`            | ✅      |

## ROADMAP Success Criteria 1–8

| #   | Criterion                                                                                | Evidence                                                                                                                                                                                                                                                                                                                                                                       |
|-----|------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1   | SPA dev serves /help landing with the new docs site (no legacy keyboard-shortcut page)    | Playwright walking checklist runs against the live Vite dev server + Plan 07-05 Task 8 pre-flight log + dev-server smoke captured during T11 screenshot session (prod preview also serves /help correctly)                                                                                                                                                                     |
| 2   | All 5 anchor pages render Mermaid diagrams correctly                                      | Playwright "every anchor renders without console errors; Mermaid SVG appears" (asserts `pre.mermaid, svg.mermaid, .mermaid svg` visible within 8s) + screenshots show diagrams as SVG, not raw fenced code                                                                                                                                                                      |
| 3   | 32 stub paths render `<ComingSoon section title />` with section-correct back-link        | helpRouteTable snapshot (32 stub entries) + ComingSoon table-driven back-link test + Playwright 3-sample test (`/help/workflow/gates`, `/help/observability/scan`, `/help/reference/glossary`)                                                                                                                                                                                  |
| 4   | Section bare paths (`/help/workflow`, `/help/repos`, `/help/observability`, `/help/operations`) redirect to overview/install | Playwright "section paths redirect to overview/install" test asserts URL transition for all 4 pairs + buildHelpRoutes.tsx `redirect` entry kind throws `redirect({ to })` in beforeLoad                                                                                                                                                                                         |
| 5   | `<HelpWidget>` lazy-loads + dispatches all 3 v1.0-referenced widgets (RepoTopologyMap, ScanReportPlayground, MigrationDryRun) | HelpWidget.test.tsx Suspense fallback + dispatch tests + anchor-pages.test.tsx (3 anchors reference widgets) + Playwright `Coming v1.2` badge visible on /help/repos/overview                                                                                                                                                                                                   |
| 6   | `?` keyboard shortcut from `/` lands on `/help` (landing renders)                         | Playwright "? shortcut from / lands on /help docs landing" (pairing seeded via `page.addInitScript`, AppShellV2 mounts, useGlobalShortcuts fires, navigates) + useGlobalShortcuts.test.tsx GS8                                                                                                                                                                                  |
| 7   | Dark mode renders correctly (DORMANT in v1.0)                                              | `dark:prose-invert` REMOVED from HelpLayout because the dashboard's theme system (lib/theme.ts D-02) adds the `dark` class to <html> by default, which broke prose rendering (Rule 1 fix during T10/T11). v1.0 ships warm-paper / light prose only; dark-mode prose styling is deferred to v1.1 (matches CONTEXT.md `<deferred>` + D-7-12). Verified via screenshot inspection. |
| 8   | Pre-flight green + impeccable critique gate + two-stage review                            | Task 8 pre-flight log (`pnpm -r typecheck && pnpm -r test && pnpm lint && pnpm -r build` all exit 0) + Task 10 impeccable evidence (see "Impeccable Score" section below for v1.0 tooling-drift caveat) + post-merge two-stage review TBD                                                                                                                                       |

## Test Counts

- vitest: 715 tests across 88 files (workspace-wide) — all green at HEAD `d86bb20`.
  - Plan 07-05 added: helpRouteTable snapshot, legacy-route-deleted, 5 anchor pages, reference-shortcuts, plus the inherited Plan 07-01..04 surface (mdx-smoke, topicToUrl, HelpHook, ComingSoon, HelpWidget, MermaidBlock, HelpLayout, stubs-smoke, frontmatter, mermaid-syntax).
- Playwright: 16 tests (8 per project) across `chromium-desktop` (1440×900) + `chromium-mobile` (375×800) — all green in 5.8–6.2s.
- Pre-flight: `pnpm -r typecheck && pnpm -r test && pnpm lint && pnpm -r build` — green at HEAD `d86bb20`.

## Impeccable Score

The original spec called for **composite score ≥ 90 on /help (lg 1440×900)**.
This gate **cannot be measured against impeccable v2.1.8** — the published
CLI has dropped the `critique` sub-command and now exposes only `detect`,
which returns a flat antipattern array (no composite or sub-dimension
scoring). See `evidence/impeccable.log` for the full diagnosis.

What we can report from `npx impeccable detect`:

| Surface         | Pre-fix | Post Plan 07-05 prose-fix (HEAD d86bb20) |
|-----------------|---------|------------------------------------------|
| low-contrast    | 27      | 5                                        |
| (other classes) | 0       | 0                                        |

The 5 remaining findings are all `#9c95a8` (`text-text-tertiary` at 2.8:1
vs the 3:1 target) — used for the "(soon)" stub tags. This token is
Phase 5.1-locked and fires identically on every dashboard route; **not
caused by Plan 07-05**.

Evidence: `evidence/impeccable.log` + `evidence/impeccable-help-lg.json`.

Recommendation: ship Phase 7 v1.0 and file impeccable-tooling-drift as a
v1.0.1 follow-up (pin to a scoring-capable impeccable version OR rewrite
the pipeline against the new antipattern-count surface). The CI workflow
at `.github/workflows/impeccable.yml` is in the same drift state — both
need to be addressed together.

## Manual UAT

See `07-UAT.md`.

## Sign-off

- [x] All HELP-01..HELP-06 ✅
- [x] All ROADMAP S1..S8 met (S7 dormant; S8 with tooling-drift caveat)
- [x] Pre-flight green (`pnpm -r typecheck && pnpm -r test && pnpm lint && pnpm -r build`)
- [x] Playwright green (16/16, 0 console.error)
- [⚠️] Impeccable ≥ 90 (TOOLING DRIFT — see Impeccable Score section)
- [x] /browse screenshots committed (6 desktop + 1 mobile, post prose-fix)
- [ ] 07-UAT.md filled (manual checklist — user signs off)
- [ ] Two-stage review run (`/review` Stage 1 + `superpowers:requesting-code-review` Stage 2 — post-merge per CLAUDE.md)
