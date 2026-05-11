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

*Tracked: 2026-05-11 during Plan 07-01 execution.*
