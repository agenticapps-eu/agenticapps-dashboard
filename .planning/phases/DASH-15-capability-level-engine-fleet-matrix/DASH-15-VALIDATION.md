---
phase: DASH-15
slug: capability-level-engine-fleet-matrix
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-17
---

# Phase DASH-15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (per-package) |
| **Config file** | each package's `vitest.config.ts` / workspace config |
| **Quick run command** | `pnpm --filter @agenticapps/dashboard-agent test` (engine/scanner) · `pnpm --filter @agenticapps/dashboard-shared test` (schema) · `pnpm --filter @agenticapps/dashboard-spa test` (matrix/drawer) |
| **Full suite command** | per-package `pnpm --filter <pkg> test` (NOT `pnpm -r test` — see ssh-agent socket memory) |
| **Estimated runtime** | ~10–30 seconds per package |

---

## Sampling Rate

- **After every task commit:** Run the affected package's quick test command
- **After every plan wave:** Run the full per-package suites touched by the wave
- **Before `/gsd:verify-work`:** All touched package suites must be green + `pnpm lint`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-T1 | 01 | 1 | CML-07 | T-15-01-01 | ClaudeMdEval round-trips valid payload; rejects level 7 / missing rungs | unit (schema) | `pnpm --filter @agenticapps/dashboard-shared test claudeMdLevel` | Wave 0 (new) | ⬜ pending |
| 15-01-T2 | 01 | 1 | CML-07 | T-15-01-02 | CoverageRow.eval optional → pre-DASH-15 daemon payload still parses | unit (schema) | `pnpm --filter @agenticapps/dashboard-shared test` | self (coverage.test.ts) | ⬜ pending |
| 15-02-T1 | 02 | 2 | CML-02, CML-03, CML-04, CML-05 | T-15-02-01 | Per-rung L0–L6 predicates + strict-cumulative cap + L5 inferred + nextSteps (RED) | unit (scanner) | `pnpm --filter @agenticapps/dashboard-agent test claudeMdLevelScanner` | Wave 0 (new) | ⬜ pending |
| 15-02-T2 | 02 | 2 | CML-01, CML-02, CML-03, CML-04, CML-05 | T-15-02-01/02/03/04 | Scanner returns full ClaudeMdEval; every read resolver-mediated; git argv-array; evidence are summaries only (GREEN) | unit (scanner) | `pnpm --filter @agenticapps/dashboard-agent test claudeMdLevelScanner` | Wave 0 (new) | ⬜ pending |
| 15-02-T3 | 02 | 2 | CML-06 | T-15-02-05 | 7th allSettled slot; throwing scanner yields degraded row (eval omitted), not 500 | unit (orchestrator) | `pnpm --filter @agenticapps/dashboard-agent test coverageScan` | self (coverageScan.allSettled.test.ts) | ⬜ pending |
| 15-03-T1 | 03 | 2 | CML-08 | T-15-03-01/02 | LevelBadgeCell renders L{level}; degraded → em-dash no button; inferred → ~ sigil; onClick fires | unit (React) | `pnpm --filter @agenticapps/dashboard-spa test LevelBadgeCell` | Wave 0 (new) | ⬜ pending |
| 15-03-T2 | 03 | 2 | CML-09 | T-15-03-01/03 | Drawer renders 6 rungs ✓/○ + evidence + L5 inferred sigil+callout + nextSteps/Fully-adaptive; closes on Esc/backdrop | unit (React) | `pnpm --filter @agenticapps/dashboard-spa test ClaudeMdLevelDrawer` | Wave 0 (new) | ⬜ pending |
| 15-04-T1 | 04 | 3 | CML-08 | T-15-04-02 | level column width + header tooltip registered (no existing width change) | unit (typecheck) | `pnpm --filter @agenticapps/dashboard-spa typecheck` | self | ⬜ pending |
| 15-04-T2 | 04 | 3 | CML-08, CML-09 | T-15-04-01/02 | level <td> mounts LevelBadgeCell; drawer gated on row.eval !== undefined; <col>+<th> present | unit (React) | `pnpm --filter @agenticapps/dashboard-spa test coverage` | self (CoverageRow test) | ⬜ pending |
| 15-04-T3 | 04 | 3 | CML-08, CML-09 (UI gate) | — | /coverage IMPECCABLE composite >= 80 (drawer closed + open) at 1440×900 | manual (skill) | `impeccable:critique` → `15-IMPECCABLE.md` | artifact (new) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Each L0–L6 rung predicate (CML-02/03) is an independently testable case inside `15-02-T1`/`15-02-T2` (red→green per rung); the scanner test file carries one `describe` block per rung.

---

## Wave 0 Requirements

- [x] Existing vitest infrastructure covers all phase requirements — no new framework install expected (agent/shared/spa packages already have vitest).
- [ ] New Wave 0 test files (failing-first) created before their implementations:
  - `packages/shared/src/schemas/claudeMdLevel.test.ts` (15-01-T1)
  - `packages/agent/src/lib/scanners/claudeMdLevelScanner.test.ts` (15-02-T1, written RED before 15-02-T2)
  - `packages/spa/src/components/panels/coverage/LevelBadgeCell.test.tsx` (15-03-T1)
  - `packages/spa/src/components/panels/coverage/ClaudeMdLevelDrawer.test.tsx` (15-03-T2)

*Test fixtures (sample CLAUDE.md at each L-level) are constructed in-test via `mkdtempSync` + git-init helpers — no committed fixture files needed (matches overrideSentinelScanner.test.ts harness).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| L-level badge + drawer visual quality | CML (UI) | IMPECCABLE composite is a skill-driven visual audit, not a unit test | Run `impeccable:critique` against the Coverage Matrix + drawer at 1440×900; produce `15-IMPECCABLE.md` (composite ≥ 80) |

*All deterministic engine/schema behaviors have automated vitest verification; only the visual-quality gate is skill-driven.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-populated 2026-06-17
