---
phase: 4
slug: single-project-view-discipline-phase-progress
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (already installed in `packages/spa`, `packages/agent`, `packages/shared`) |
| **Config file** | `vitest.config.ts` per package |
| **Quick run command** | `pnpm --filter @agenticapps/dashboard-spa test -- --run` |
| **Full suite command** | `pnpm -r test` |
| **Estimated runtime** | ~30 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <changed-package> test -- --run`
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Filled in by gsd-planner during PLAN.md generation. Each task's `<acceptance_criteria>` block becomes a row here.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> No new framework install required. vitest already installed. Wave 0 may cover shared schema additions in `@agenticapps/dashboard-shared` that downstream waves depend on.

- [ ] TBD — populated by planner

*Existing infrastructure covers all phase requirements (vitest + Testing Library + supertest).*

---

## Manual-Only Verifications

> Populated by planner from RESEARCH.md `## Validation Architecture` and UI-SPEC.md visual/interaction specs.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TBD | TBD | TBD | TBD |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
