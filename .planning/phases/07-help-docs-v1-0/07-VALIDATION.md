---
phase: 07
slug: help-docs-v1-0
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-11
filled: 2026-05-11
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from RESEARCH.md §"Validation Architecture" (Nyquist).
> Per-task verification map filled after all 5 PLAN.md files authored (`/gsd-plan-phase` 2026-05-11).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 + @testing-library/react 16.3.2 (existing) + @playwright/test 1.59.1 (catalog, Wave 0 installs runner) |
| **Config file** | `packages/spa/vitest.config.ts` (existing, extend MDX support); `packages/spa/playwright.config.ts` (NEW, Plan 07-01) |
| **Quick run command** | `pnpm --filter @agenticapps/dashboard-spa test -- src/help` |
| **Full suite command** | `pnpm -r typecheck && pnpm -r test && pnpm lint && pnpm --filter @agenticapps/dashboard-spa exec playwright test` |
| **Estimated runtime** | ~45 seconds (unit) + ~60 seconds (Playwright walking checklist) |

---

## Sampling Rate

- **After every task commit:** Run quick run command for the touched plan's test surface.
- **After every plan wave:** Run full suite command.
- **Before `/gsd-verify-work`:** Full suite must be green; Playwright walking checklist must record zero `console.error` events; impeccable critique on `/help` (lg, 1440×900) must score ≥ 90.
- **Max feedback latency:** ~120 seconds (unit + e2e combined).

---

## Per-Task Verification Map

> One row per task across the 5 plans. `Test Type` values: `unit` (vitest), `e2e` (Playwright), `infra` (config / catalog), `visual` (impeccable critique), `manual` (checkpoint:human-verify).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-T1 | 07-01 | 0 | HELP-01..06 | T-07-01-01 | pnpm-locked dep versions | infra | `pnpm install && grep -q "@mdx-js/rollup" pnpm-workspace.yaml` | ✅ created in plan | ✅ green |
| 07-01-T2 | 07-01 | 0 | HELP-01 | T-07-01-04 | MDX→JSX before plugin-react Fast Refresh | infra | `pnpm --filter @agenticapps/dashboard-spa build` | ✅ | ✅ green |
| 07-01-T3 | 07-01 | 0 | HELP-01 | n/a | Tailwind v4 plugin registration | infra | `grep -q '@plugin "@tailwindcss/typography"' packages/spa/src/styles/global.css && pnpm --filter @agenticapps/dashboard-spa build` | ✅ | ✅ green |
| 07-01-T4 | 07-01 | 0 | HELP-01 | n/a | Ambient .mdx typing | infra | `pnpm --filter @agenticapps/dashboard-spa typecheck` | ✅ | ✅ green |
| 07-01-T5 | 07-01 | 0 | HELP-01 | T-07-01-02 | MDX pipeline end-to-end | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/__tests__/mdx-smoke.test.tsx` | ✅ | ✅ green |
| 07-01-T6 | 07-01 | 0 | HELP-03 | T-07-01-05 | tokenSourceOfTruth extends to src/help/** | unit | `pnpm --filter @agenticapps/dashboard-spa test src/styles/tokenSourceOfTruth.test.ts` | ✅ | ✅ green |
| 07-01-T7 | 07-01 | 0 | HELP-01..06 | T-07-01-06 | Playwright runner config (1440×900 + 375×800) | infra | `pnpm --filter @agenticapps/dashboard-spa exec playwright test --list` | ✅ | ✅ green |
| 07-01-T8 | 07-01 | 0 | HELP-01..06 | n/a | REQUIREMENTS.md anchors | infra | `grep -c "HELP-0[1-6]" .planning/REQUIREMENTS.md` ≥ 12 | ✅ | ✅ green |
| 07-02-T1 | 07-02 | 1 | HELP-05 | T-07-02-04 | Pure topicToUrl URL builder | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/topicToUrl.test.ts` | ✅ | ⬜ pending |
| 07-02-T2 | 07-02 | 1 | HELP-05 | T-07-02-02, T-07-02-04 | HelpHook tooltip + navigate (TanStack) | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/components/HelpHook.test.tsx` | ✅ | ⬜ pending |
| 07-02-T3 | 07-02 | 1 | HELP-02 | n/a | ComingSoon section back-link incl. operations special-case | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/components/ComingSoon.test.tsx` | ✅ | ⬜ pending |
| 07-02-T4 | 07-02 | 1 | HELP-04 | T-07-02-03, T-07-02-05 | HelpWidget dispatch + not-prose + unknown error | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/components/HelpWidget.test.tsx` | ✅ | ⬜ pending |
| 07-02-T5 | 07-02 | 1 | HELP-01 | T-07-02-01, T-07-02-06, T-07-02-07 | MermaidBlock StrictMode safety + console.warn | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/components/MermaidBlock.test.tsx` | ✅ | ⬜ pending |
| 07-02-T6 | 07-02 | 1 | HELP-03 | n/a | HelpLayout NAV + D-7-13 stubs + HELP-06 entry + mobile drawer + TanStack routing | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/components/HelpLayout.test.tsx` | ✅ | ⬜ pending |
| 07-02-T7 | 07-02 | 1 | HELP-04 | n/a | mdxComponents 4-entry map | unit | `pnpm --filter @agenticapps/dashboard-spa typecheck && pnpm --filter @agenticapps/dashboard-spa test src/help/__tests__/mdx-smoke.test.tsx` | ✅ | ⬜ pending |
| 07-02-T8 | 07-02 | 1 | HELP-03 | n/a | Workspace tests + token-of-truth gate | unit | `pnpm --filter @agenticapps/dashboard-spa test && pnpm -r typecheck && pnpm lint` | ✅ | ⬜ pending |
| 07-03-T1 | 07-03 | 1 | HELP-04 | n/a | WidgetStub primitive | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/widgets/_stub-pattern.test.tsx` | ✅ | ⬜ pending |
| 07-03-T2 | 07-03 | 1 | HELP-04 | n/a | 8 stub default exports | unit (file existence) | `for f in RepoTopologyMap WorkflowStateMachine GatePicker TraceVisualizer ScanReportPlayground ApplyConsentSimulator MigrationDryRun SlashCommandCatalog; do test -f "packages/spa/src/help/widgets/${f}.stub.tsx"; done` | ✅ | ⬜ pending |
| 07-03-T3 | 07-03 | 1 | HELP-04 | n/a | 8-stub smoke render | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/widgets/__tests__/stubs-smoke.test.tsx` | ✅ | ⬜ pending |
| 07-03-T4 | 07-03 | 1 | HELP-04 | T-07-03-04 | Workspace gate + invariants | unit | `pnpm --filter @agenticapps/dashboard-spa test src/help/ src/styles/tokenSourceOfTruth.test.ts` | ✅ | ⬜ pending |
| 07-04-T1 | 07-04 | 2 | HELP-01 | T-07-04-01 | 5 anchor MDX files compiled | infra | `pnpm --filter @agenticapps/dashboard-spa typecheck && pnpm --filter @agenticapps/dashboard-spa build` | ✅ | ⬜ pending |
| 07-04-T2 | 07-04 | 2 | HELP-06 | T-07-04-05 | reference/shortcuts.mdx with KbdHint imports | infra | `pnpm --filter @agenticapps/dashboard-spa typecheck && pnpm --filter @agenticapps/dashboard-spa build` | ✅ | ⬜ pending |
| 07-04-T3 | 07-04 | 2 | HELP-01, HELP-06 | n/a | Frontmatter shape contract | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/__tests__/frontmatter.test.tsx` | ✅ | ⬜ pending |
| 07-04-T4 | 07-04 | 2 | HELP-01 | T-07-04-04 | Mermaid syntax validation (mermaid.parse) | unit (TDD, node-env) | `pnpm --filter @agenticapps/dashboard-spa test src/help/__tests__/mermaid-syntax.test.ts` | ✅ | ⬜ pending |
| 07-04-T5 | 07-04 | 2 | HELP-01 | n/a | 5 anchor MDX render (RTL + MDXProvider, widgets mocked) | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/__tests__/anchor-pages.test.tsx` | ✅ | ⬜ pending |
| 07-04-T6 | 07-04 | 2 | HELP-06 | n/a | reference/shortcuts.mdx renders KbdHint table | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/__tests__/reference-shortcuts.test.tsx` | ✅ | ⬜ pending |
| 07-04-T7 | 07-04 | 2 | HELP-01, HELP-06 | n/a | Workspace gate | unit | `pnpm --filter @agenticapps/dashboard-spa test && pnpm -r typecheck && pnpm lint` | ✅ | ⬜ pending |
| 07-05-T1 | 07-05 | 3 | HELP-02 | n/a | helpRouteTable 43-entry snapshot incl. D-7-13 stubs (a9e598b RED → d6f6447 GREEN) | unit (TDD) | `pnpm --filter @agenticapps/dashboard-spa test src/help/__tests__/helpRouteTable.test.ts` | ✅ | ✅ green |
| 07-05-T2 | 07-05 | 3 | HELP-01, HELP-06 | n/a | 6 lazy MDX route wrappers + HelpPage shell (folded into T1 GREEN d6f6447 — deviation Rule 3) | infra | `pnpm --filter @agenticapps/dashboard-spa typecheck && pnpm --filter @agenticapps/dashboard-spa build` | ✅ | ✅ green |
| 07-05-T3 | 07-05 | 3 | HELP-02 | n/a | ComingSoonRoute + buildHelpRoutes factory (f85c822) | infra | `pnpm --filter @agenticapps/dashboard-spa typecheck && pnpm --filter @agenticapps/dashboard-spa build` | ✅ | ✅ green |
| 07-05-T4 | 07-05 | 3 | HELP-01..06 | T-07-05-02, T-07-05-06 | _helpLayout peer + legacy /help deleted (c8b6a65 RED → ef6cc77 GREEN) | unit (TDD) + infra | `pnpm --filter @agenticapps/dashboard-spa test src/help/__tests__/legacy-help-route-deleted.test.ts && pnpm --filter @agenticapps/dashboard-spa typecheck && pnpm --filter @agenticapps/dashboard-spa build` | ✅ | ✅ green |
| 07-05-T5 | 07-05 | 3 | HELP-06 | T-07-05-05 | mdxComponents finalised: KbdHint + pre fallback (31f0b10 rename + 477b7e1 content) | unit | `pnpm --filter @agenticapps/dashboard-spa typecheck && pnpm --filter @agenticapps/dashboard-spa test src/help/` | ✅ | ✅ green |
| 07-05-T6 | 07-05 | 3 | HELP-01..06 | n/a | impeccable.yml route list (no-op — /help already on line 86 per plan-checker) | infra | `grep -q "/help" .github/workflows/impeccable.yml` | ✅ | ✅ green (no-op) |
| 07-05-T7 | 07-05 | 3 | HELP-01..06 | n/a | Playwright walking checklist spec authored — 8 tests (312f8e3) | e2e (spec) | `pnpm --filter @agenticapps/dashboard-spa exec playwright test --list \| grep -q "help-walking-checklist"` | ✅ | ✅ green |
| 07-05-T8 | 07-05 | 3 | HELP-01..06 | n/a | Pre-flight workspace gate (e0fe2e7 fix + f4c6e9e evidence) | infra | `pnpm -r typecheck && pnpm -r test && pnpm lint && pnpm -r build` | ✅ | ✅ green |
| 07-05-T9 | 07-05 | 3 | HELP-01..06 | n/a | Playwright walking checklist runs green; zero console.error | e2e (run) + checkpoint | `pnpm --filter @agenticapps/dashboard-spa exec playwright test` | ✅ | ❌ red — 9/16 failed (see evidence/playwright.log) |
| 07-05-T10 | 07-05 | 3 | ROADMAP S8 | n/a | impeccable ≥ 90 on /help lg | visual + checkpoint | `node scripts/check-impeccable-score.mjs --route /help --viewport 1440x900` | ✅ | ⬜ blocked by T9 |
| 07-05-T11 | 07-05 | 3 | HELP-01..06 | n/a | /browse screenshots committed (6 routes × ≥1 viewport) | manual + automated | `node packages/spa/scripts/screenshot.mjs --route /help --viewport 1440x900 --out ...` | ✅ | ⬜ blocked by T9 |
| 07-05-T12 | 07-05 | 3 | HELP-01..06 + ROADMAP S1..S8 | n/a | VERIFICATION.md + UAT.md with full evidence map | manual | doc review | ✅ | ⬜ blocked by T9 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The infrastructure plan (`07-01-PLAN.md`) MUST land these before any Wave-1 plan can execute:

- [ ] `pnpm-workspace.yaml` catalog adds: `@mdx-js/react@^3.1.1`, `@mdx-js/rollup@^3.1.1`, `remark-gfm@^4.0.1`, `remark-frontmatter@^5.0.0`, `remark-mdx-frontmatter@^5.2.0`, `@tailwindcss/typography@^0.5.19`, `mermaid@^11.15.0`.
- [ ] `packages/spa/package.json` references the new catalog deps under `dependencies` (not `devDependencies` — these ship to the browser).
- [ ] `packages/spa/vite.config.ts` registers `mdx({ remarkPlugins: [...], providerImportSource: '@mdx-js/react' })` with `enforce: 'pre'` and `@vitejs/plugin-react`'s `include` regex widened to match `.mdx`.
- [ ] `packages/spa/src/styles/global.css` adds `@plugin "@tailwindcss/typography";` immediately after `@import "tailwindcss";`.
- [ ] `packages/spa/src/main.tsx` wraps the router with `<MDXProvider components={mdxComponents}>` between `<QueryBridge>` and `<RouterProvider>`.
- [ ] `packages/spa/playwright.config.ts` (NEW) — Playwright test runner config: projects for `chromium-desktop` (1440×900) + `chromium-mobile` (375×800), baseURL `http://localhost:5174`, webServer auto-spawns `pnpm --filter @agenticapps/dashboard-spa dev`.
- [ ] `packages/spa/e2e/` directory (NEW) — for Playwright `.spec.ts` files.
- [ ] `packages/spa/vitest.config.ts` — extend `include` to match `src/help/**/*.test.{ts,tsx}` and verify MDX modules resolve in test env (jsdom + the same MDX plugin).
- [ ] `packages/spa/src/__tests__/tokenSourceOfTruth.test.ts` — extend `COMPONENTS_DIR` scan to also walk `src/help/**` so leaked hex literals in the new help shell fail the test.
- [ ] `.planning/REQUIREMENTS.md` — append HELP-01..HELP-06 with full prose + Phase 7 traceability rows (per RESEARCH.md recommendation 7).
- [ ] Smoke vitest test that imports a `.mdx` file and asserts `prose` class resolves (proves the MDX pipeline + Tailwind typography plugin work end-to-end before any real help content is authored).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual coherence of `/help` landing under warm-paper tokens (D-7-11) | HELP-01 visual quality | Impeccable critique scores automate ≥ 90 numeric, but a human eye must confirm the sidebar/main composition reads as the migration intended. | After Plan 07-05 closes, capture `/help` at lg breakpoint via `/browse`; compare against the migration `_shell/HelpLayout.tsx` design intent (sidebar w-72, main max-w-3xl prose). Note any visual delta in `07-05-SUMMARY.md`. |
| Mermaid diagram readability at desktop + mobile breakpoints | HELP-01 | Mermaid runtime renders SVG that may overflow narrow containers; impeccable Layout dimension is numeric, but readability is qualitative. | Walk the 4 Mermaid-containing pages (`/help/workflow/overview`, 2 on `/help/observability/overview`, 1 on `/help/repos/overview`, 1 on `/help`) at lg (1440×900) AND mobile (375×800). Confirm SVG fits container; flag overflow as an info-level finding. |
| `?` keyboard shortcut still lands on docs landing | HELP-06 | Global keyboard shortcut hook (`useGlobalShortcuts`) integration with the new docs route — automatable via Playwright but worth a human keypress check post-merge. | Open dashboard, paired session, on `/`. Press `?`. Verify URL changes to `/help` AND docs landing renders (NOT the old keyboard-shortcuts page — which no longer exists). |
| Dark-mode `prose-invert` resolves correctly when dark mode lands in v1.1 | Future-compat | v1.0 ships no `.dark{}` block; `dark:prose-invert` is dormant. Can't verify automatically until v1.1 enables dark mode. | Documented for v1.1 verification cycle. No v1.0 action. |

*If a behavior appears here but a task above also covers it automatically, the automated check is the primary; the manual check is a belt-and-suspenders.*

---

## Validation Sign-Off

- [x] All tasks have an automated verify command in the map above (or are listed in Manual-Only with explicit justification). **39 task rows filled (07-01:8 + 07-02:8 + 07-03:4 + 07-04:7 + 07-05:12).**
- [x] Sampling continuity: no 3 consecutive tasks without automated verify. **Checked — every task has either `<automated>` or is `checkpoint:human-verify` with documented manual procedure.**
- [x] Wave 0 covers all NEW infrastructure (catalog deps, Vite config, Playwright config, vitest extension, tokenSourceOfTruth scope, REQUIREMENTS.md).
- [x] No watch-mode flags (Playwright + vitest run-once mode only).
- [x] Feedback latency < 120 seconds for the full suite.
- [x] `nyquist_compliant: true` set in frontmatter (line 5) once map is filled and Wave 0 lands. **(map filled now; Wave 0 lands when Plan 07-01 ships)**

**Approval:** Approved by planner 2026-05-11 after authoring all 5 PLAN.md files. `wave_0_complete: true` flag is set by the orchestrator after Plan 07-01 ships green.
