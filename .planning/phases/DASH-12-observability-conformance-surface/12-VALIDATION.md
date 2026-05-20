---
phase: 12
slug: observability-conformance-surface
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x (workspace) — `packages/shared`, `packages/agent`, `packages/spa` |
| **Config file** | `vitest.config.ts` per package (existing) |
| **Quick run command** | `pnpm --filter <pkg> test --run` |
| **Full suite command** | `pnpm -r test --run` |
| **Estimated runtime** | ~60–90 seconds for full suite (≈1007 tests baseline post-Phase 11.2; expect +~40 in Phase 12) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <pkg> test --run` for the modified package
- **After every plan wave:** Run `pnpm -r test --run` + `pnpm -r typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green; `pnpm -r build` green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD     | TBD  | TBD  | REQ-12-NN   | T-12-NN    | TBD             | unit      | `pnpm --filter <pkg> test --run` | ❌ W0 | ⬜ pending |

*Filled in by gsd-planner during planning. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Foundations (per RESEARCH.md Wave 0): NDJSON retention bump 14d→90d + 5 snapshot test re-validation; chart primitive feasibility spike (≤120 LOC budget check); shared schema `conformance.ts` scaffold + Zod round-trip tests.

- [ ] `packages/agent/src/lib/snapshots/snapshotPaths.test.ts` — assert `RETENTION_DAYS = 90` (was 14) + boundary tests for prune/rollover
- [ ] `packages/agent/src/lib/snapshots/snapshotReader.test.ts` — full 90-day series read; cold-start empty handling
- [ ] `packages/agent/src/lib/snapshots/snapshotWriter.test.ts` — 90-day rollover semantics intact
- [ ] `packages/agent/src/lib/snapshots/coverageHistoryCache.test.ts` — TTL semantics under 90-day window
- [ ] `packages/shared/src/schemas/conformance.test.ts` — Zod round-trip for `ConformanceResponse`, `FamilyConformance`, `DayPoint`
- [ ] `packages/spa/src/hooks/useViewportBreakpoint.test.tsx` — matchMedia mock with breakpoint snap (xs/sm/md/lg/xl)

*Wave 0 unblocks Wave 1+. Cannot mark `wave_0_complete: true` until all six entries are ✅.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 1440×900 IMPECCABLE artifact composite ≥ 87 | (gate) | Skill-driven critique pattern, calibration data point #5 | Run `Skill: impeccable critique` against `/observability/conformance` (and `/observability/coverage` <768px responsive pass); write `12-IMPECCABLE.md`; verify composite ≥ 87 per D-10.5-03 calibration |
| Touch-compatible hover/focus on trend chart | D-12-06 | Pointer-events semantics + Tooltip primitive integration verified via real touch on iPad-portrait Tailscale connection | Open `/observability/conformance` from iPad-portrait via Tailscale, tap each day-tick, confirm per-day breakdown panel appears + dismisses (no hover-only) |
| Coverage <768px card layout — visual sanity at 375px / 414px / 768px | (responsive) | Visual layout aesthetics not fully covered by snapshot tests | `/qa` walkthrough at 375×667, 414×896, 768×1024; verify cards stack, no overflow, no broken column-state pills |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (retention bump, schema, viewport hook)
- [ ] No watch-mode flags (`--watch` forbidden in CI commands)
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter once gsd-planner fills the verification map

**Approval:** pending (planner fills task-level rows in step 8; verification table marked nyquist_compliant on plan-checker PASS)
