---
phase: 13
slug: gitnexus-scoped-scan-actions-coverage-matrix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest@latest` (already in workspace) |
| **Config file** | `packages/agent/vitest.config.ts` + `packages/spa/vitest.config.ts` + `packages/shared/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @agenticapps/dashboard-agent test -- gitnexusScan` |
| **Full suite command** | `pnpm -r test` |
| **Estimated runtime** | ~30 seconds (filtered); ~3 minutes (full -r) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @agenticapps/dashboard-agent test -- gitnexusScan` (Wave 1 & 2) or the SPA equivalent (Wave 3)
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (filtered quick run)

---

## Per-Task Verification Map

> Populated by the planner — one row per task. Each task must map to either an `<automated>` verify command or a Wave 0 fixture/stub dependency. Phase 13 has no REQ-IDs (`phase_req_ids: null`); rows reference implementation behaviours instead.

| Task ID | Plan | Wave | Behaviour | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-----------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD by planner | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/agent/src/routes/gitnexusScan.test.ts` — route handler unit tests (POST 200/409/403/404/429; GET 200/404)
- [ ] `packages/agent/src/lib/gitnexusScan.test.ts` — job registry + spawn orchestrator unit tests
- [ ] `packages/agent/src/lib/gitnexusFamilyScan.test.ts` — family orchestrator unit tests
- [ ] `packages/agent/src/__tests__/gitnexusScan.integration.test.ts` — end-to-end with stub `gitnexus` binary
- [ ] `packages/agent/test-fixtures/stub-gitnexus.sh` — executable stub that takes `analyze <path>` and exits 0/non-zero based on env var
- [ ] `packages/agent/test-fixtures/stub-gitnexus-failing.sh` — variant that fails on 2nd invocation by arg pattern (family partial-success integration)
- [ ] `packages/spa/src/lib/queries/gitnexusScan.test.ts` — hook tests (`useGitnexusScan`, `useGitnexusScanProgress`)
- [ ] `packages/spa/src/components/panels/coverage/ScanPill.test.tsx` — pill component tests (states: enabled / disabled+tooltip / scanning / install-fallback)

*Existing infrastructure: vitest already wired in all three packages; `packages/agent/test/` already contains route harness patterns from Phase 12.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/qa` walkthrough on Coverage page | Family/per-repo scan UX | Visual + multi-step flow | 1. Scan one repo (✗ → spinner → ✓). 2. Scan a family (sequential per-row progress). 3. Bind daemon to tailscale → confirm Scan pills are disabled with tooltip. 4. Rename `gitnexus` binary aside → confirm InstallGitNexusButton fallback. 5. Click Scan twice rapidly on same row → confirm 409 toast. 6. Use stub binary that fails on 2nd invocation → confirm partial-success toast "N/M scanned, K failed — retry failed?". |
| IMPECCABLE composite ≥ 87 at 1440×900 | D-10.5-03 calibration point #6 | Skill-driven design audit | Run `impeccable:critique` skill on Coverage page; write `13-IMPECCABLE.md`; composite must be ≥ 87 |
| Two-stage code review | CLAUDE.md hard requirement | Human judgement | Stage 1 `/review` (gstack) on the phase diff; Stage 2 `superpowers:requesting-code-review` (independent review). Do NOT collapse stages. |
| `/cso` audit | New subprocess-exec surface + `~/.gitnexus/` write boundary exception | Threat model review | `/cso` against the daemon route changes; PLAN.md `<threat_model>` block must enumerate the 9 patterns from 13-RESEARCH.md "Known Threat Patterns" + the explicit write-boundary carve-out |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
