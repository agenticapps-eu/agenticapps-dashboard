# Phase 7 Deferred Items

> Out-of-scope issues discovered during execution. Not fixed by Phase 7 because they
> are NOT caused by Phase 7 changes. Tracked here per the GSD scope-boundary rule.

---

## Pre-existing flaky agent end-to-end subprocess test

**Discovered during:** Plan 07-01 final preflight (`pnpm -r test`).

**Symptom:**
```
FAIL  |agent| src/cli/__tests__/end-to-end.subprocess.test.ts > Phase 1 end-to-end smoke
AssertionError: expected 401 to be 200
   80|         const healthRes = await fetch(`${agentUrl}/health`, {
   81|           headers: { Authorization: `Bearer ${oldToken}` },
   82|         })
   83|         expect(healthRes.status).toBe(200)
                                       ^
```

**Diagnosis:** The test rotates a token then expects the *old* token to still authorize
one final `/health` request within a small race window. Under workspace-parallel runs
(`pnpm -r test`), other vitest pools can spawn enough subprocess load that the rotation
fires before the second fetch resolves, producing 401.

- Repro rate: ~50% under `pnpm -r test`.
- Stand-alone (`pnpm --filter @agenticapps/dashboard-agent test
  src/cli/__tests__/end-to-end.subprocess.test.ts`): passes 100 % of the time.
- Last touched: commit `f412126 fix(01): canonicalise registry roots via realpath at
  registration` (Phase 1) — pre-dates Phase 7 by several months.

**Out of scope for Phase 7:** Phase 7 changes touch only `packages/spa/**`,
`pnpm-workspace.yaml`, `pnpm-lock.yaml`, and `.planning/REQUIREMENTS.md`. The
subprocess test exercises only `packages/agent/src/cli` and has no dependency
on any of my changes.

**Recommended owner:** A future Phase-1 stabilization plan (or fold into the
Phase 8 polish work). Likely fix: make the rotation logic await the response or
keep the old token in a short grace window during rotation.

---

## Impeccable scoring tool drift (v1.0.1 follow-up)

**Discovered during:** Plan 07-05 T10 (impeccable critique ≥ 90 gate).

**Symptom:** `npx impeccable critique` no longer exists in impeccable v2.1.8 — only `detect` survives, which returns antipattern arrays without a composite score. Phase 6 D-6-21 set the gate at "score ≥ 90 on /help (lg 1440x900)" but the tool that emits a numeric score has been removed upstream.

**Post-fix detect output (against the green Phase 7 /help routes):**
- 5 low-contrast findings on /help (lg)
- All 5 trace to Phase 5.1 inherited `text-text-tertiary` (`#9c95a8`) — 2.8:1 vs 3:1 target
- Renders on the "(soon)" stub tags + various dashboard-wide chips
- **Zero findings caused by Plan 07-05's own additions.**

CI workflow `.github/workflows/impeccable.yml` is in the same drift state — it'll fail or no-op on the next run.

**Out of scope for Phase 7:** Plan 07-05 introduced no new findings. The drift is in shared tooling + Phase 5.1 token contrast, both cross-phase concerns.

**Recommended v1.0.1 path (per user decision in auto-mode question):**
1. Either pin impeccable to a scoring-capable version (search for v2.0.x or earlier with `critique` subcommand), or
2. Rewrite the scoring pipeline using `detect` output + a custom weighted aggregator that mirrors the prior composite formula.
3. Bump `text-text-tertiary` from `#9c95a8` to a shade that clears 3:1 (`#8b85a0` or darker) — cross-phase token patch; needs visual regression review against every dashboard route.

Full diagnosis in `evidence/impeccable.log`.

---

## Phase 7 CONTEXT.md mis-assumption about `.dark{}` (resolved, but noted for next phase planning)

**Discovered during:** Plan 07-05 T11 (`/browse` screenshot — prose rendered white on warm paper).

**Symptom:** Phase 7 CONTEXT.md `<deferred>` block stated "v1.0 ships no `.dark{}` block; `dark:prose-invert` is dormant". This was incorrect — the dashboard's theme system (`packages/spa/src/lib/theme.ts`, D-02 Phase 2) defaults to `dark` mode and adds `.dark` class to `<html>` app-wide. The `dark:prose-invert` modifier on HelpLayout's `<article>` thus DID fire, inverting headings + body to white on warm paper.

**Resolution:** Dropped `dark:prose-invert` from HelpLayout (`0ce906a`). v1.0 ships unconditional light-mode prose. Dark-mode prose deferred to v1.1.

**Future-proof note:** When authoring future CONTEXT.md `<deferred>` blocks involving dark mode, verify against `lib/theme.ts` actual default, not the assumed "no .dark{} block" pattern.

---

*Tracked: 2026-05-11 during Plan 07-01, updated 2026-05-12 during Plan 07-05 T9-T12 closure.*
