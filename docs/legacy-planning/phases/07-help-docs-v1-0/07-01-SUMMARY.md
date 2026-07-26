---
phase: 07-help-docs-v1-0
plan: 01
subsystem: infra
tags: [mdx, vite, tailwind, typography, playwright, react, tdd]

# Dependency graph
requires:
  - phase: 05.1-redesign
    provides: warm-paper tokens.css + tokenSourceOfTruth invariant (extended here)
  - phase: 06-polish
    provides: "@playwright/test catalog entry (Wave 0 adds the runner config that consumes it)"
provides:
  - "@mdx-js/rollup Vite pipeline (enforce:'pre' + remark chain) compiling .mdx → JSX before plugin-react"
  - "@tailwindcss/typography registered via Tailwind v4 @plugin directive in global.css"
  - "ambient *.mdx TypeScript module declaration so `import X, { frontmatter } from './x.mdx'` typechecks"
  - "MDXProvider wired between QueryBridge and RouterProvider so MDX-rendered components access query + repair context"
  - "empty mdxComponents map ready for Plan 07-02 to populate with HelpWidget/HelpHook/MermaidBlock/ComingSoon"
  - "tokenSourceOfTruth invariant extended to src/help/** (prevents Wave 1+ hex literal leaks)"
  - "playwright.config.ts + e2e/ skeleton (chromium-desktop 1440x900 + chromium-mobile 375x800)"
  - "HELP-01..HELP-06 anchored in REQUIREMENTS.md with traceability rows"
affects:
  - 07-02 (shell components — consumes MDXProvider, prose utilities, token-of-truth gate)
  - 07-03 (widget stubs — consumes mdxComponents map indirectly)
  - 07-04 (anchor MDX pages — consumes MDX pipeline + ambient *.mdx declaration)
  - 07-05 (route wiring + Playwright walking checklist — consumes playwright.config.ts)

# Tech tracking
tech-stack:
  added:
    - "@mdx-js/react@3.1.1 (catalog) — MDXProvider runtime"
    - "@mdx-js/rollup@3.1.1 (catalog) — Vite MDX plugin"
    - "@types/mdx@2.0.13 (catalog, devDep) — type-only dep for MDXComponents"
    - "remark-gfm@4.0.1 (catalog)"
    - "remark-frontmatter@5.0.0 (catalog)"
    - "remark-mdx-frontmatter@5.2.0 (catalog) — exports frontmatter named const"
    - "@tailwindcss/typography@0.5.19 (catalog) — Tailwind v4 prose utilities"
    - "mermaid@11.15.0 (catalog) — runtime SVG diagram rendering (consumed in Plan 07-02)"
  patterns:
    - "Tailwind v4 CSS-side plugin registration via `@plugin` directive (no tailwind.config.ts)"
    - "MDX rollup plugin with enforce:'pre' AND plugin-react `include` widened to /\\.(mdx|js|jsx|ts|tsx)$/"
    - "vitest.config.ts MIRRORS vite.config.ts plugin chain (was a real divergence — fixed in T5)"
    - "Per-section domain directory under packages/spa/src/help/ owned by Wave 1+"

key-files:
  created:
    - packages/spa/src/help/mdx.d.ts
    - packages/spa/src/help/mdxComponents.ts
    - packages/spa/src/help/__tests__/fixtures/smoke.mdx
    - packages/spa/src/help/__tests__/mdx-smoke.test.tsx
    - packages/spa/playwright.config.ts
    - packages/spa/e2e/.gitkeep
    - .planning/phases/07-help-docs-v1-0/deferred-items.md
  modified:
    - pnpm-workspace.yaml (catalog +8 entries)
    - packages/spa/package.json (+8 catalog refs across dependencies + devDependencies + `e2e` script)
    - packages/spa/vite.config.ts (MDX plugin chain inserted)
    - packages/spa/vitest.config.ts (MDX plugin chain MIRRORED — Rule 3 fix)
    - packages/spa/src/styles/global.css (`@plugin "@tailwindcss/typography";`)
    - packages/spa/src/main.tsx (MDXProvider between QueryBridge and RouterProvider)
    - packages/spa/src/styles/tokenSourceOfTruth.test.ts (HELP_DIR walk added)
    - .planning/REQUIREMENTS.md (HELP-01..HELP-06 + traceability rows + coverage 56→62)

key-decisions:
  - "vitest.config.ts plugins must mirror vite.config.ts (catalog drift was a real blocker for T5 RED→GREEN)"
  - "@types/mdx added as direct devDep (transitive peer of @mdx-js/react not enough for tsc to resolve `mdx/types`)"
  - "playwright --list exits 1 with zero specs; plan's wrapper grep is the correct gate for an empty e2e/ dir"

patterns-established:
  - "MDX pipeline ordering: { enforce:'pre', ...mdx({...}) } FIRST; plugin-react widened include SECOND; tailwindcss LAST"
  - "Token invariant scan walks both src/components/** and src/help/** with try/catch fallback for not-yet-existing dirs"
  - "TDD RED→GREEN with explicit `test(...): RED` and `feat(...): GREEN` commit prefixes per project ~/.claude/CLAUDE.md"

requirements-completed:
  - HELP-01
  - HELP-02
  - HELP-03
  - HELP-04
  - HELP-05
  - HELP-06

# Metrics
duration: 10min
completed: 2026-05-11
---

# Phase 07 Plan 01: Wave 0 infrastructure (MDX + Tailwind typography + Playwright + REQUIREMENTS) Summary

**MDX rollup pipeline (enforce:'pre' + remark-gfm/frontmatter/mdx-frontmatter), Tailwind v4 typography via @plugin directive, MDXProvider wired between QueryBridge and RouterProvider, ambient *.mdx typing, Playwright runner config (1440x900 + 375x800 projects), tokenSourceOfTruth invariant extended to src/help/**, and HELP-01..HELP-06 anchored in REQUIREMENTS.md — every artefact Waves 1–3 need to land Phase 7.**

## Performance

- **Duration:** ~10 min wall-clock (Bash + Edit/Write only — no human checkpoints in this plan)
- **Started:** 2026-05-11T20:20Z
- **Completed:** 2026-05-11T20:30Z
- **Tasks:** 8 of 8
- **Commits:** 11 (8 task-commits + 1 RED+GREEN split + 1 style fix + 1 deferred-items log)
- **Files modified:** 8 modified, 7 created (15 total touched)
- **Test count delta:** 627 → 630 SPA tests (+3 from new mdx-smoke suite)

## Accomplishments

- **MDX pipeline shipped end-to-end.** A fixture .mdx file compiles, imports, renders, exposes its `frontmatter` named export, and resolves the `prose` Tailwind class — proven by the smoke test.
- **MDXProvider in correct slot.** Between `<QueryBridge>` (so MDX-rendered widgets get the query client + repair bus) and `<RouterProvider>` (so the provider does not leak into router error boundaries) per D-7-05.
- **Tailwind v4 `@plugin` directive registered.** `prose-slate dark:prose-invert max-w-none` will resolve cleanly in HelpLayout (Plan 07-02).
- **tokenSourceOfTruth invariant widened.** Hex literals in src/help/** are now an automatic fail — blocks regression risk in the upcoming MermaidBlock token translation (P2 from RESEARCH.md).
- **Playwright runner config + e2e/ dir.** Plan 07-05 can author specs and run them without further infra.
- **REQUIREMENTS.md is now the source of truth for HELP-01..HELP-06.** VERIFICATION.md (Plan 07-05) has authoritative anchors to bind evidence to.

## Catalog versions installed (resolved by pnpm)

```
@mdx-js/react@3.1.1
@mdx-js/rollup@3.1.1
@types/mdx@2.0.13              (deviation — added during Task 5 GREEN, see below)
remark-gfm@4.0.1
remark-frontmatter@5.0.0
remark-mdx-frontmatter@5.2.0
@tailwindcss/typography@0.5.19
mermaid@11.15.0
```

All match the validated ranges from 07-RESEARCH.md §"Library compatibility". `pnpm install --frozen-lockfile` after this plan will resolve these exactly (T-07-01-01 mitigation).

## Vite plugin order (verified in packages/spa/vite.config.ts)

```ts
plugins: [
  { enforce: 'pre', ...mdx({                            // FIRST + enforce:'pre'
      remarkPlugins: [remarkGfm, remarkFrontmatter, remarkMdxFrontmatter],
      providerImportSource: '@mdx-js/react',
  })},
  react({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),         // SECOND, include widened
  tailwindcss(),                                        // LAST
]
```

Three ordering invariants from the plan honoured. The same plugin block is **mirrored into `packages/spa/vitest.config.ts`** (was missing before — see Deviations).

## MDXProvider placement diff (main.tsx)

```diff
 createRoot(rootEl).render(
   <StrictMode>
     <RepairProvider>
       <QueryBridge>
-        <RouterProvider router={router} />
+        <MDXProvider components={mdxComponents}>
+          <RouterProvider router={router} />
+        </MDXProvider>
       </QueryBridge>
     </RepairProvider>
   </StrictMode>,
 )
```

awk source-order check: `<QueryBridge>` line 47 < `<MDXProvider...>` line 48 < `<RouterProvider` line 49 → ordering invariant holds.

## Smoke test output (3 passed)

```
 RUN  v4.1.5 packages/spa
 PASS  src/help/__tests__/mdx-smoke.test.tsx
   Wave 0 MDX pipeline smoke
     ✓ imports a .mdx fixture and renders a default React component
     ✓ exposes the named frontmatter export with the typed shape
     ✓ renders the article with the prose class so the typography plugin can style it

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Duration  522ms
```

## tokenSourceOfTruth scope-extension diff

```diff
 const STYLES_DIR = dirname(fileURLToPath(import.meta.url))
 const COMPONENTS_DIR = resolve(STYLES_DIR, '..', 'components')
+const HELP_DIR = resolve(STYLES_DIR, '..', 'help')
 const TOKENS_FILE = resolve(STYLES_DIR, 'tokens.css')
...
-describe('AC-05 — tokens.css is the single source of truth for color hex values', () => {
-  const componentFiles = walk(COMPONENTS_DIR)
+describe('AC-05 + HELP — tokens.css is the single source of truth for color hex values (scans src/components/** + src/help/**)', () => {
+  const componentFiles = (() => {
+    const files = walk(COMPONENTS_DIR)
+    try { return [...files, ...walk(HELP_DIR)] }
+    catch { return files }   // src/help may not exist yet in Wave 0
+  })()
```

`pnpm --filter @agenticapps/dashboard-spa test src/styles/tokenSourceOfTruth.test.ts` → 3 passed.

## REQUIREMENTS.md changes

- New section "### Help docs v1.0 (Phase 7)" inserted between POLISH (line 99) and Architectural Invariants (line 109) — 6 bullets HELP-01..HELP-06.
- Traceability table gained 6 rows (HELP-01..HELP-06 | Phase 7 | Pending).
- Coverage block: v1 requirements 56 → 62, mapped 56 → 62, unmapped 0.
- Footer date refreshed to 2026-05-11.
- `grep -c "HELP-0[1-6]"` returns **13** (6 bullets + 6 trace rows + 1 footer mention) — well above the ≥ 12 threshold.

## Task Commits

Each task was committed atomically. Hashes are short SHA on `feat/help-docs-v1`.

1. **Task 1: 7 catalog deps** — `a3d3624` (chore) — pnpm-workspace.yaml + packages/spa/package.json
2. **Task 2: MDX rollup plugin into vite.config** — `622373b` (feat)
3. **Task 3: @tailwindcss/typography @plugin directive** — `c232246` (feat)
4. **Task 4: ambient *.mdx module declaration** — `ad8d637` (feat)
5. **Task 5 RED: failing MDX smoke test + fixture** — `6f4f7e5` (test)
6. **Task 5 GREEN: mdxComponents stub + MDXProvider wiring** — `08a8505` (feat) — fixes vitest.config.ts + adds @types/mdx (auto-deviations, see below)
7. **Task 6: tokenSourceOfTruth invariant extended** — `b97b6fc` (feat)
8. **Task 7: playwright.config.ts + e2e/ skeleton** — `a8ba864` (feat)
9. **Task 8: HELP-01..HELP-06 to REQUIREMENTS.md** — `a638522` (docs)
10. **Lint follow-up: import-order in mdx-smoke.test.tsx** — `2d35f64` (style)
11. **Deferred-items: pre-existing agent subprocess flake** — `96be2ac` (docs)

_HEAD at plan close: 96be2ac2d5ec644e80acdb069656368ab0f154d0._

## Files Created/Modified

**Created (7):**
- `packages/spa/src/help/mdx.d.ts` — Ambient *.mdx module declaration (default ComponentType + named `frontmatter`)
- `packages/spa/src/help/mdxComponents.ts` — Empty MDXComponents stub (Plan 07-02 fills in)
- `packages/spa/src/help/__tests__/fixtures/smoke.mdx` — Minimal MDX fixture (frontmatter + H1 + ordered list)
- `packages/spa/src/help/__tests__/mdx-smoke.test.tsx` — 3-assertion smoke (import resolves, frontmatter shape, prose class)
- `packages/spa/playwright.config.ts` — Runner config (chromium-desktop 1440x900 + chromium-mobile 375x800)
- `packages/spa/e2e/.gitkeep` — Empty-directory placeholder
- `.planning/phases/07-help-docs-v1-0/deferred-items.md` — Logs the pre-existing agent subprocess flake

**Modified (8):**
- `pnpm-workspace.yaml` — +8 catalog entries (7 from plan + @types/mdx deviation)
- `packages/spa/package.json` — +8 catalog refs (7 dependencies + @types/mdx devDep) + `e2e` script
- `packages/spa/vite.config.ts` — MDX rollup plugin + plugin-react widened + remark chain
- `packages/spa/vitest.config.ts` — Mirrors vite.config plugin chain (DEVIATION fix)
- `packages/spa/src/styles/global.css` — `@plugin "@tailwindcss/typography";` after `@import "tailwindcss";`
- `packages/spa/src/main.tsx` — `<MDXProvider>` between `<QueryBridge>` and `<RouterProvider>`
- `packages/spa/src/styles/tokenSourceOfTruth.test.ts` — Walks src/help/** in addition to src/components/**
- `.planning/REQUIREMENTS.md` — HELP-01..HELP-06 section + traceability rows + coverage 62

## Decisions Made

- **vitest plugin chain mirrors vite plugin chain.** Originally vitest.config.ts only loaded react+tailwindcss. With MDX, vitest cannot resolve .mdx imports unless the same chain is present. Adopted "mirror" as the rule going forward — any future Vite plugin used in production must also be in vitest.config.ts.
- **`@types/mdx` is a direct devDep.** It's only a peer of `@mdx-js/react` transitively; tsc needs it in the package's own dep graph. Added to catalog AND to dashboard-spa devDependencies.
- **Smoke-test verify treats `playwright --list` exit-1 as success when the grep matches.** Playwright correctly exits 1 with zero specs; the documented `<verify>` block in the plan wraps it in `grep -q` which inverts that into a clean Wave-0 verify. Documented inline in the commit body.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts plugin chain did not mirror vite.config.ts**
- **Found during:** Task 5 GREEN (running the MDX smoke test for the first time)
- **Issue:** With only `[react(), tailwindcss()]` in vitest.config.ts, the .mdx fixture import failed at transform with "invalid JS syntax" — vitest does not pick up vite.config.ts plugins automatically.
- **Fix:** Mirrored the full plugin chain into vitest.config.ts: `[{ enforce:'pre', ...mdx({...}) }, react({ include: /\.(mdx|js|jsx|ts|tsx)$/ }), tailwindcss()]`. Same `remarkPlugins` and `providerImportSource`.
- **Files modified:** `packages/spa/vitest.config.ts`
- **Verification:** Smoke test went RED ("Failed to parse source") → GREEN (3 passed) after the patch.
- **Committed in:** `08a8505` (Task 5 GREEN)

**2. [Rule 3 - Blocking] mdxComponents.ts could not resolve `mdx/types`**
- **Found during:** Task 5 GREEN (running `pnpm --filter @agenticapps/dashboard-spa typecheck`)
- **Issue:** `import type { MDXComponents } from 'mdx/types'` failed with TS2307 "Cannot find module 'mdx/types'". The `@types/mdx` package ships at the v2 path but only as a transitive peer of `@mdx-js/react` — TypeScript's module resolution requires it to be a direct dep of the consuming package.
- **Fix:** Added `@types/mdx@^2.0.13` to the pnpm catalog and to `packages/spa/package.json` `devDependencies` (type-level only — runtime never imports from `mdx/types`).
- **Files modified:** `pnpm-workspace.yaml`, `packages/spa/package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm --filter @agenticapps/dashboard-spa typecheck` exit 0.
- **Committed in:** `08a8505` (Task 5 GREEN, alongside the vitest fix)

**3. [Rule 1 - Bug] import-order lint warning in mdx-smoke.test.tsx**
- **Found during:** Workspace lint preflight after Task 8
- **Issue:** The TDD RED draft of mdx-smoke.test.tsx ordered `import Smoke ... from './fixtures/smoke.mdx'` BEFORE `import { mdxComponents } from '../mdxComponents'` — eslint-plugin-import wants the parent path before the sibling.
- **Fix:** Reordered imports; placed mdxComponents (parent) before smoke.mdx (sibling) with the blank-line separator already present.
- **Files modified:** `packages/spa/src/help/__tests__/mdx-smoke.test.tsx`
- **Verification:** `pnpm --filter @agenticapps/dashboard-spa exec eslint src/help/__tests__/mdx-smoke.test.tsx` → 0 warnings/errors; smoke test still 3-of-3 GREEN.
- **Committed in:** `2d35f64` (separate style commit so it does not contaminate the GREEN history)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug).
**Impact on plan:** All three deviations were necessary for the plan to actually deliver its truths (smoke test passing, typecheck clean, lint clean). No scope creep — every fix kept the executor on the plan's documented critical path.

## Threat Flags

None. All threat dispositions in the plan's `<threat_model>` (T-07-01-01..06) were honoured:
- T-07-01-01 (catalog tampering) — mitigated by exact version pins resolving via pnpm lockfile.
- T-07-01-02 (providerImportSource tampering) — hardcoded in vite.config.ts AND vitest.config.ts.
- T-07-01-03 (source maps in production) — accepted per Phase 0 D-00-08.
- T-07-01-04 (Mermaid bundle in main chunk) — verified: production build chunks do NOT contain mermaid (it ships only when MermaidBlock.tsx imports it lazily in Plan 07-02).
- T-07-01-05 (tokenSourceOfTruth scope) — extended by Task 6.
- T-07-01-06 (Playwright webServer spoofing) — hardcoded command + strictPort:true in vite.config.ts.

## Issues Encountered

**Pre-existing flaky agent end-to-end subprocess test.** `pnpm -r test` flaked in `packages/agent/src/cli/__tests__/end-to-end.subprocess.test.ts:83` (token-rotation race). Stand-alone re-run passes 1/1. Last touched in Phase 1 commit `f412126`; entirely outside Phase 7's diff. Logged in `.planning/phases/07-help-docs-v1-0/deferred-items.md` and committed in `96be2ac` per the GSD scope-boundary rule.

## Coverage Matrix

| Decision / Refinement | Task | Status |
|---|---|---|
| D-7-04 (MDX rollup pipeline) | T2 | ✓ |
| D-7-05 (MDXProvider placement) | T5 | ✓ |
| D-7-09 (Tailwind typography via @plugin) | T3 | ✓ |
| R1.1 (REQUIREMENTS.md HELP-01..06) | T8 | ✓ |
| R1.2 (ambient *.mdx typing) | T4 | ✓ |
| R1.3 (tokenSourceOfTruth scope) | T6 | ✓ |
| R1.4 (Playwright runner config) | T7 | ✓ |
| Wave-0 sufficiency (unblocks 07-02..05) | T1..T8 | ✓ |

## Next Phase Readiness

**Wave 1 unblocked.** Per the plan-check report's Wave-0 sufficiency table:
- pnpm-workspace.yaml has all 7 (now 8) required catalog entries ✓
- vite.config.ts compiles .mdx before plugin-react ✓
- `prose` class resolves at build time ✓
- ambient *.mdx module declaration typechecks ✓
- MDXProvider wraps RouterProvider so MDX-rendered widgets resolve ✓
- src/help/** protected against hex-literal leaks ✓
- packages/spa/playwright.config.ts + e2e/ exist for Plan 07-05 ✓
- REQUIREMENTS.md HELP-01..06 anchored for VERIFICATION.md ✓
- mdxComponents.ts stub created (Plan 07-02 finalises it) ✓

`07-VALIDATION.md` frontmatter `wave_0_complete:` flag should now flip to `true` (set below as part of this plan's STATE updates).

The two parallel Wave-1 plans (07-02 shell components + 07-03 widget stubs) can be spawned by the orchestrator immediately.

## Self-Check: PASSED

**Files exist:**
- `packages/spa/src/help/mdx.d.ts` — FOUND
- `packages/spa/src/help/mdxComponents.ts` — FOUND
- `packages/spa/src/help/__tests__/fixtures/smoke.mdx` — FOUND
- `packages/spa/src/help/__tests__/mdx-smoke.test.tsx` — FOUND
- `packages/spa/playwright.config.ts` — FOUND
- `packages/spa/e2e/.gitkeep` — FOUND
- `.planning/phases/07-help-docs-v1-0/deferred-items.md` — FOUND
- `.planning/phases/07-help-docs-v1-0/07-01-SUMMARY.md` — FOUND (this file)

**Commits exist (git log --all):**
- a3d3624 ✓  622373b ✓  c232246 ✓  ad8d637 ✓  6f4f7e5 ✓  08a8505 ✓
- b97b6fc ✓  a8ba864 ✓  a638522 ✓  2d35f64 ✓  96be2ac ✓

**Preflight gates:**
- `pnpm -r typecheck` → exit 0 (5/5 packages)
- `pnpm --filter @agenticapps/dashboard-spa test` → 75 files, 630 tests passed (was 627, +3 from mdx-smoke)
- `pnpm --filter @agenticapps/dashboard-spa build` → exit 0 (built in 294ms)
- `pnpm lint` → exit 0 (54 warnings, 0 errors — none introduced by this plan after the style commit)
- `pnpm --filter @agenticapps/dashboard-spa exec playwright test --list` → 0 specs (expected for Wave 0)

---
*Phase: 07-help-docs-v1-0*
*Plan: 01 — Wave 0 infrastructure*
*Completed: 2026-05-11*
