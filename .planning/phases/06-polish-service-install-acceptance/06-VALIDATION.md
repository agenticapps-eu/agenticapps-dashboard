---
phase: 06
slug: polish-service-install-acceptance
status: locked
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-10
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from 06-RESEARCH.md "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (workspace-wide) |
| **Config file** | each package's `vitest.config.ts` |
| **Quick run command** | `pnpm --filter <pkg> exec vitest run <file>` |
| **Full suite command** | `pnpm -r test` |
| **Estimated runtime** | ~22s SPA, ~25s full workspace |

---

## Sampling Rate

- **After every task commit:** Run targeted file via `pnpm --filter <pkg> exec vitest run <file>`
- **After every plan wave:** Run full per-package suite (`pnpm --filter @agenticapps/dashboard-agent test` or `pnpm --filter @agenticapps/dashboard-spa exec vitest run`)
- **Before `/gsd-verify-work`:** `pnpm -r test` must be green AND `pnpm -r typecheck` must be clean
- **Max feedback latency:** ~25 seconds (full SPA suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 06-01-01 | 01 | 0 | POLISH-04 (preflight) | manual | `npx impeccable --json --route /` (capture baseline before any chrome work) | ⬜ pending |
| 06-02-01 | 02 | 1 | POLISH-01 (R refresh) | unit | `pnpm --filter @agenticapps/dashboard-spa exec vitest run useGlobalShortcuts.test.ts` | ⬜ pending |
| 06-02-02 | 02 | 1 | POLISH-01 (R focus guard — typing in search must NOT refresh) | unit | `pnpm --filter @agenticapps/dashboard-spa exec vitest run useGlobalShortcuts.test.ts -t "focus guard"` | ⬜ pending |
| 06-02-03 | 02 | 1 | POLISH-01 (? help overlay) | unit | `pnpm --filter @agenticapps/dashboard-spa exec vitest run HelpOverlay.test.tsx` | ⬜ pending |
| 06-02-04 | 02 | 1 | POLISH-01 (`/` focuses search) | unit | `pnpm --filter @agenticapps/dashboard-spa exec vitest run useGlobalShortcuts.test.ts -t "slash"` | ⬜ pending |
| 06-03-01 | 03 | 1 | POLISH-02 (install-launchd) | unit | `pnpm --filter @agenticapps/dashboard-agent exec vitest run cli/install-launchd.test.ts` | ⬜ pending |
| 06-03-02 | 03 | 1 | POLISH-02 (plist EnvironmentVariables.PATH) | unit | `pnpm --filter @agenticapps/dashboard-agent exec vitest run -t "PATH includes /opt/homebrew/bin"` | ⬜ pending |
| 06-03-03 | 03 | 1 | POLISH-03 (install-systemd) | unit | `pnpm --filter @agenticapps/dashboard-agent exec vitest run cli/install-systemd.test.ts` | ⬜ pending |
| 06-04-01 | 04 | 2 | POLISH-04 (impeccable ≥ 90 / home) | manual | `npx impeccable --json --route /` ≥ 90 | ⬜ pending |
| 06-04-02 | 04 | 2 | POLISH-04 (impeccable ≥ 90 / project) | manual | `npx impeccable --json --route /projects/<id>` ≥ 90 | ⬜ pending |
| 06-04-03 | 04 | 2 | POLISH-04 (after-shell.png re-capture) | manual | `node packages/spa/scripts/screenshot.mjs /projects/<id>` produces sidebar-shell PNG | ⬜ pending |
| 06-05-01 | 05 | 2 | POLISH-06 (README install/pair/FAQ/troubleshooting) | unit | `pnpm exec vitest run docs/readme-structure.test.ts` (asserts H2 anchors present) | ⬜ pending |
| 06-05-02 | 05 | 2 | POLISH-06 (README screenshots resolve) | manual | Visual review of README on GitHub preview | ⬜ pending |
| 06-06-01 | 06 | 3 | POLISH-05 (two-stage REVIEW.md) | manual | PR REVIEW.md contains `## Stage 1` + `## Stage 2` + `<finding severity=>` blocks | ⬜ pending |
| 06-06-02 | 06 | 3 | POLISH-04 (closure ritual passes) | manual | All Phase 5.1 deferred HUMAN-UAT items resolved | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/spa/src/lib/useGlobalShortcuts.test.ts` — unit tests for R / ? / `/` keyboard shortcut hook + focus guard
- [ ] `packages/spa/src/components/HelpOverlay.test.tsx` — overlay rendering, KbdHint usage, escape-to-close
- [ ] `packages/agent/src/cli/install-launchd.test.ts` — plist generation + load/unload + EnvironmentVariables.PATH assertion
- [ ] `packages/agent/src/cli/install-systemd.test.ts` — service file generation + systemctl --user enable assertion (Linux only)
- [ ] `tests/docs/readme-structure.test.ts` — assert README H2 sections (`## Install`, `## Pair`, `## FAQ`, `## Troubleshooting`)

*Existing infrastructure covers everything else.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LaunchAgent survives reboot | POLISH-02 | Reboot is destructive, can't be CI-tested | After install, reboot Mac, run `launchctl list \| grep eu.agenticapps.dashboard`, verify daemon responds at 127.0.0.1:5193 |
| systemd service survives logout | POLISH-03 | Linux-only, requires SSH session | After install on Linux, `systemctl --user enable agenticapps-dashboard`, log out + log back in, verify daemon responds |
| impeccable ≥ 90 on `/` and `/projects/:id` | POLISH-04 | Requires live dev server + headless browser at 1440x900; executor cannot reliably keep dev server alive | Run `pnpm --filter @agenticapps/dashboard-spa dev`, then `npx impeccable --route /` and `--route /projects/<id>` from a separate terminal at viewport 1440x900 |
| Two-stage REVIEW.md on closing PR | POLISH-05 | gstack `/review` + `superpowers:requesting-code-review` are interactive skills against a live PR | Open PR for v1.0, run both reviews sequentially, append outputs to REVIEW.md |

---

## Validation Sign-Off

- [ ] All tasks have automated verify command OR are tagged manual with explicit instructions
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test files (5 new test files identified)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s for all automated tests
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets this after deriving per-task entries)

**Approval:** pending — planner should review per-task map for completeness before flipping `nyquist_compliant: true`
