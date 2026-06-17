---
phase: DASH-15
slug: capability-level-engine-fleet-matrix
status: draft
nyquist_compliant: false
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
| _populated by planner_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> The planner MUST replace the placeholder row above with one row per task, mapping each L0–L6 rung predicate (CML-01..09) to a deterministic vitest assertion. Each rung predicate is independently testable (red→green per rung).

---

## Wave 0 Requirements

- [ ] Existing vitest infrastructure covers all phase requirements — no new framework install expected (agent/shared/spa packages already have vitest).

*If the ClaudeMdEval schema or scanner needs new test fixtures (sample CLAUDE.md files at each L-level), the planner adds them as a Wave 0 fixtures task.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| L-level badge + drawer visual quality | CML (UI) | IMPECCABLE composite is a skill-driven visual audit, not a unit test | Run `impeccable:critique` against the Coverage Matrix + drawer at 1440×900; produce `DASH-15-IMPECCABLE.md` (composite ≥ 80) |

*All deterministic engine/schema behaviors have automated vitest verification; only the visual-quality gate is skill-driven.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
