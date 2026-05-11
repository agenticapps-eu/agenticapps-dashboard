---
phase: 07
slug: help-docs-v1-0
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-11
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Populated from RESEARCH.md §"Validation Architecture" (Nyquist).
> Filled-out task-level map lands at the end of `/gsd-plan-phase` once each PLAN.md is authored — the planner is responsible for completing the per-task rows below before plan-check.

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

> Planner: fill the rows below after authoring each `07-NN-PLAN.md`. One row per task. Use the exact `task-id` from the plan frontmatter. `Test Type` column values: `unit` (vitest), `e2e` (Playwright), `infra` (config / catalog), `visual` (impeccable critique), `manual` (rare — see "Manual-Only Verifications" below). `Threat Ref` references threats from each plan's `<threat_model>` block.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to be filled by planner_ | — | — | — | — | — | — | — | — | ⬜ pending |

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
| Visual coherence of `/help` landing under warm-paper tokens (D-7-11) | HELP-01 visual quality | Impeccable critique scores automate ≥ 90 numeric, but a human eye must confirm the sidebar/main composition reads as the migration intended. | After Plan 07-05 closes, capture `/help` at lg breakpoint via `/browse`; compare against the migration `_shell/HelpLayout.tsx` design intent (sidebar w-72, main max-w-3xl prose). Note any visual delta in `07-07-SUMMARY.md`. |
| Mermaid diagram readability at desktop + mobile breakpoints | HELP-01 | Mermaid runtime renders SVG that may overflow narrow containers; impeccable Layout dimension is numeric, but readability is qualitative. | Walk the 4 Mermaid-containing pages (`/help/workflow/overview`, 2 on `/help/observability/overview`, 1 on `/help/repos/overview`) at lg (1440×900) AND mobile (375×800). Confirm SVG fits container; flag overflow as an info-level finding. |
| `?` keyboard shortcut still lands on docs landing | HELP-06 | Global keyboard shortcut hook (`useGlobalShortcuts`) integration with the new docs route — automatable via Playwright but worth a human keypress check post-merge. | Open dashboard, paired session, on `/`. Press `?`. Verify URL changes to `/help` AND docs landing renders (NOT the old keyboard-shortcuts page — which no longer exists). |
| Dark-mode `prose-invert` resolves correctly when dark mode lands in v1.1 | Future-compat | v1.0 ships no `.dark{}` block; `dark:prose-invert` is dormant. Can't verify automatically until v1.1 enables dark mode. | Documented for v1.1 verification cycle. No v1.0 action. |

*If a behavior appears here but a task above also covers it automatically, the automated check is the primary; the manual check is a belt-and-suspenders.*

---

## Validation Sign-Off

- [ ] All tasks have an automated verify command in the map above (or are listed in Manual-Only with explicit justification).
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify.
- [ ] Wave 0 covers all NEW infrastructure (catalog deps, Vite config, Playwright config, vitest extension, tokenSourceOfTruth scope, REQUIREMENTS.md).
- [ ] No watch-mode flags (Playwright + vitest run-once mode only).
- [ ] Feedback latency < 120 seconds for the full suite.
- [ ] `nyquist_compliant: true` set in frontmatter once map is filled and Wave 0 lands.

**Approval:** pending — set by `/gsd-plan-phase` orchestrator once each plan's tasks are mapped to rows above.
