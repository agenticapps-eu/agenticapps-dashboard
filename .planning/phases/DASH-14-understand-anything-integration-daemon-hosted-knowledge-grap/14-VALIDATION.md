---
phase: 14
slug: understand-anything-integration-daemon-hosted-knowledge-grap
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-07
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (workspace-wide; shared 234 / agent 943+ / spa 996+ tests as of Phase 13 close) |
| **Config file** | per-package `vitest.config.ts` (existing) |
| **Quick run command** | `pnpm --filter @agenticapps/dashboard-agent test` (or `--filter @agenticapps/dashboard-spa` / `dashboard-shared` per touched package) |
| **Full suite command** | `pnpm -r test && pnpm -r typecheck` |
| **Estimated runtime** | ~60–120 seconds full; ~20–40s per package |

---

## Sampling Rate

- **After every task commit:** Run the touched package's vitest suite
- **After every plan wave:** Run `pnpm -r test && pnpm -r typecheck`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

All tasks are `tdd="true"` — the test file is created RED-first inside the same task (Wave 0 is folded into each plan's first commit; no orphaned MISSING references).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01/T1 | 14-01 | 1 | D-14-02 | T-14-01-01 | health understand block strict; no token field on health wire | unit | shared vitest `src/schemas/health.test.ts` | created in-task | ⬜ pending |
| 14-01/T2 | 14-01 | 1 | D-14-08 | T-14-01-02 | coverage understand column strict + back-compat optional | unit | shared vitest `src/schemas/coverage.test.ts` | extend existing | ⬜ pending |
| 14-01/T3 | 14-01 | 1 | D-14-10 | — | buildUnderstandCommand exact {string, argv} | unit | shared vitest `src/clipboard.test.ts` | extend existing | ⬜ pending |
| 14-02/T1 | 14-02 | 2 | D-14-09 | T-14-resolve / T-14-02-03 | repoRoot extraction: family allow-list, realpath guard, registry-first resolveRepoRoot | unit | agent vitest `src/lib/repoRoot.test.ts` + migrated `deterministicRepoRoot.test.ts` | created in-task | ⬜ pending |
| 14-02/T2 | 14-02 | 2 | D-14-03 | T-14-token / T-14-02-01/02/04/05 | HMAC mint/verify round-trip, cross-repo rejection, malformed/decoded-repoId rejection, 0600 secret, rotation invalidation | unit | agent vitest `src/lib/viewerToken.test.ts` | created in-task | ⬜ pending |
| 14-02/T3 | 14-02 | 2 | D-14-01/02 | — | semver-correct install/plugin version detection, no subprocess | unit | agent vitest `src/lib/viewerInstall.test.ts` | created in-task | ⬜ pending |
| 14-03/T1 | 14-03 | 2 | D-14-10/07 | T-14-03-02/03 | pill/link states, exact clipboard string, noopener | unit | spa vitest `UnderstandCopyPill.test.tsx` | created in-task | ⬜ pending |
| 14-03/T2 | 14-03 | 2 | D-14-08 (display) | — | understand cell ✓-link / stale / missing + undefined back-compat, desktop + mobile | unit | spa vitest `CoverageRow/CoverageFamilySection(.Mobile).test.tsx` | extend existing | ⬜ pending |
| 14-03/T3 | 14-03 | 2 | D-14-03/07 | T-14-03-01 | viewer URL = scoped token only; bearer token negative-asserted | unit | spa vitest `CoveragePage.test.tsx` | extend existing | ⬜ pending |
| 14-04/T1 | 14-04 | 2 | D-14-06/02 | T-14-04-01/02 | listing page states (empty/populated/install-hint/update-hint), new-tab links | unit | spa vitest `CodeIntelligencePage.test.tsx` | created in-task | ⬜ pending |
| 14-04/T2 | 14-04 | 2 | D-14-06 | — | sidebar section ordering + route registration | unit | spa vitest `Sidebar.test.tsx` | extend existing | ⬜ pending |
| 14-05/T1 | 14-05 | 3 | D-14-03/05b | T-14-token / T-14-leak / T-14-05-01/04 | 403 without/with-wrong token, bearer NOT accepted, cross-repo binding, FIX 2 sanitization (kg + domain-graph), upstream 404 semantics | unit | agent vitest `src/routes/understandViewer.test.ts` | created in-task (Wave 0 ref #1) | ⬜ pending |
| 14-05/T2 | 14-05 | 3 | D-14-05 | T-14-traversal / T-14-05-02/03 | file-content rejects `..`, absolute, NUL, encoded traversal, symlink escape, non-graph-listed, >1MB, binary; per-request graph parse | unit | agent vitest `src/routes/understandViewer.test.ts` | same file | ⬜ pending |
| 14-05/T3 | 14-05 | 3 | D-14-04/07 | T-14-05-05/07 | static serving traversal-safe, trailing-slash redirect preserves token, pre-bearerAuth mount integration proof, no bindMode gate | unit+integration | agent vitest `understandViewer.test.ts` + `src/server/app.test.ts` | same + extend | ⬜ pending |
| 14-06/T1 | 14-06 | 3 | D-14-08 | T-14-06-01 | hash equal → fresh; differ → stale; missing/malformed meta → missing; HEAD via pure FS (ref/detached/packed-refs) | unit | agent vitest `src/lib/scanners/understandScanner.test.ts` (Wave 0 ref #2) | created in-task | ⬜ pending |
| 14-06/T2 | 14-06 | 3 | D-14-03/08 | T-14-06-02/04 | row viewerToken verifies back to row repoId; missing rows tokenless; degraded-row isolation | unit | agent vitest `src/lib/coverageScan.test.ts` | extend existing | ⬜ pending |
| 14-06/T3 | 14-06 | 3 | D-14-02 | T-14-06-03 | health understand block truth-table; no token in health | unit | agent vitest `src/routes/health.test.ts` | extend existing | ⬜ pending |
| 14-07/T1 | 14-07 | 3 | D-14-01 | T-14-07-02/03 | installer failure modes byte-exact, core-before-dashboard order, --base=./ + post-build relative-ref guard, write-boundary copy | unit | agent vitest `src/cli/installUnderstandViewer.test.ts` | created in-task | ⬜ pending |
| 14-07/T2 | 14-07 | 3 | D-14-01 | — | CLI registration; built binary --help smoke | unit+cli | agent vitest `src/cli.test.ts` + dist help grep | extend existing | ⬜ pending |
| 14-08/T1 | 14-08 | 4 | all | — | full-suite gate + verification-map cross-check | full suite | `pnpm -r test && pnpm -r typecheck && pnpm -r build` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Folded into TDD-first tasks (every code task is `tdd="true"`, test file lands RED before implementation in the same plan):

- [x] Agent route test stubs (understandViewer endpoints — token gate, traversal suite, sanitization) → 14-05 Tasks 1-3
- [x] Staleness/status detection stubs → 14-06 Task 1
- [x] Shared `buildUnderstandCommand` + schema parse/strict stubs → 14-01 Tasks 1-3
- [x] repoRoot extraction security-suite migration → 14-02 Task 1

*Existing vitest infrastructure covers all phase requirements — no framework install needed.*

---

## Manual-Only Verifications

Executed at plan 14-08 Task 2 (blocking human-verify checkpoint):

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Viewer renders the live claude-workflow graph end-to-end in a browser | D-14-01/07 | Full SPA-in-browser behavior (graph canvas, token gate UX) not unit-testable | 14-08 Task 2 steps 2-5 |
| `install-understand-viewer` against the real plugin cache | D-14-01 | Depends on user's installed plugin version + pnpm | 14-08 Task 2 step 1 |
| Tailscale-bind viewer access | D-14-04 | Needs second device / tailscale session (same infra gap as Phase 13 UAT Test 10) | 14-08 Task 2 step 7 (optional, skip-with-note allowed) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (folded into tdd tasks)
- [x] No watch-mode flags (all commands use `--run` / one-shot)
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner sign-off 2026-06-07 (plan set 14-01..14-08)
