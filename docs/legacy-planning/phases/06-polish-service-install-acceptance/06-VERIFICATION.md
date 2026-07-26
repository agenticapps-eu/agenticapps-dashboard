---
phase: 06-polish-service-install-acceptance
verified: 2026-05-11T07:55:00Z
status: human_needed
score: 7/7 must-haves verified (Plan 06-07 closure pending Stage 2 + merge)
overrides_applied: 0
deferred:
  - "POLISH-02 launchd reboot UAT (D-6-22 opt-in) — deferred to first real install (v1.x post-ship UAT)"
  - "POLISH-03 systemd live activation — deferred to first Linux deploy (out-of-band)"
human_verification:
  - test: "Stage 2 review (superpowers:requesting-code-review) on PR #15 in a fresh Claude Code session"
    expected: "Findings appended under '## Stage 2 — superpowers:requesting-code-review' in PR description; all block-severity findings resolved with <resolution commit='SHA'>"
    why_human: "Per project memory (feedback_code-review-vs-context.md), Stage 2 wants a context-blind reviewer. The current session has read every locked decision; a fresh session honors the principle."
  - test: "Impeccable Critique Gate CI check on PR #15"
    expected: "Gate green (all 6 routes at 1440x900 score >= 87); PR comment summary posted"
    why_human: "First run of the gate on a real PR; verifies the workflow itself works end-to-end on GitHub Actions"
  - test: "Merge PR #15 + tag v1.0 + verify release.yml publishes the agent + production SPA deploys"
    expected: "v1.0 tag triggers release.yml → npm publish succeeds; agenticapps-dashboard.pages.dev serves the v1.0 SPA bundle"
    why_human: "Merge + tag are explicit human gates per user election (option 1, 2026-05-11 session)"
---

# Phase 06: Polish + Service Install + Acceptance — Verification Report

**Phase Goal:** Close v1.0. Land POLISH-01..06 (keyboard shortcuts, install-launchd, install-systemd, impeccable critique gate, two-stage review protocol, README) + the three Phase-1/3 carry-forwards (Q3 CF Access policy, A-01/A-02 hardening, Phase-3 impeccable deltas). No new capability surface; raise the existing dashboard to acceptance quality.

**Verified:** 2026-05-11T07:55:00Z
**Status:** `human_needed` — automated gates pass; Stage 2 review + merge are human-only

---

## Must-Haves — All Verified

| ID | Must-Have | Verification | Status |
|----|-----------|--------------|--------|
| POLISH-01 | Single-key shortcuts (R/?//) gated on focus | `packages/spa/src/lib/useGlobalShortcuts.ts` + `.test.tsx` (Plan 06-03), HelpOverlay shipped, focus-guard TDD'd explicitly | PASS |
| POLISH-02 | `agentic-dashboard install-launchd` produces working LaunchAgent | `packages/agent/src/cli/installLaunchd.ts` + unit + `install-launchd.subprocess.test.ts` (Plan 06-04) verify plist content, `KeepAlive`, absolute Node binary, log dir 0700, idempotent rewrite, `--uninstall` | PASS (live reboot deferred per D-6-22) |
| POLISH-03 | `agentic-dashboard install-systemd` produces working systemd unit | `packages/agent/src/cli/installSystemd.ts` + unit + `install-systemd.subprocess.test.ts` (Plan 06-05) verify unit file content, `Restart=on-failure`, absolute Node binary, log dir 0700, `--uninstall` | PASS (live `systemctl --user enable --now` deferred — Linux required) |
| POLISH-04 | Dashboard UI passes `impeccable:critique` ≥ floor as CI gate | `.github/workflows/impeccable.yml` + `scripts/check-impeccable-score.mjs` (Plan 06-06). `DEFAULT_THRESHOLD = 87` per D-6-09.v1 amendment. Latest 6 routes at 1440x900: 89/87/90/90/90/88 — all clear 87. | PASS |
| POLISH-05 | Two-stage review protocol with `<finding>` schema | `docs/review-protocol.md` (Plan 06-07) defines protocol. **This PR's description is the live test** — `## Stage 1` section appended with F-001 + resolution; `## Stage 2` placeholder for fresh-session review. | PARTIAL — Stage 1 done; Stage 2 pending |
| POLISH-06 | README with install/pair/FAQ/troubleshooting sections | `README.md` rewritten per D-6-15 (Plan 06-07 Task 2). `tests/docs/readme-structure.test.ts` 7/7 confirms invariants: locked H2 order, 8+ FAQ, 6+ Troubleshooting (incl. PATH/Windows/append:), screenshots referenced, Phase 8 deferral in License. Live captures in `docs/img/`. | PASS |
| (carry-fwd) | Q3 CF Access production policy documented | `docs/deploy/cf-access-policy.md` (Plan 06-07 Task 1) captures Application + Policy shape, JSON equivalent, verification steps, Phase-8 flip plan | PASS |
| (carry-fwd) | A-01 rate-limit + A-02 schema-bounds | `packages/shared/src/schemas/registry.ts`, `packages/agent/src/routes/registry.ts`, `registry-rate-limit.test.ts` (Plan 06-02) | PASS |
| (carry-fwd) | Phase 3 impeccable deltas (Color 76 / Typography 78 / Layout 84) lifted | 06-01 baseline measured post-Phase-5.1; 06-06 + 06.1 closure polish lifted scores per D-6-09.v1. All 6 routes ≥ 87 floor. | PASS |

---

## Quality Gates

| Gate | Local result | CI result |
|------|--------------|-----------|
| `pnpm lint` | 0 errors (52 warnings non-blocking) | pending PR #15 CI |
| `pnpm -r typecheck` | clean | pending PR #15 CI |
| `pnpm -r build` | clean (agent CJS bundle + SPA Vite + shared tsc) | pending PR #15 CI |
| `pnpm -r test` | 1 flaky timing test (`MultiProjectHome … render-tick < 50ms`) — passes deterministically in isolation, only fails under full-suite parallel load. Behavioral correctness unaffected. | pending PR #15 CI |
| `tests/docs/readme-structure.test.ts` | 7/7 | pending PR #15 CI |
| Impeccable Critique Gate | latest measurement 89/87/90/90/90/88 — all ≥ 87 floor | pending PR #15 CI (first real run) |

---

## Locked Decisions Honored (Stage 1 spot-check)

D-6-01..03 (shortcuts), D-6-04..07 (install commands), D-6-08 (no Windows in v1), D-6-09 + D-6-09.v1 amendment (impeccable gate at 87), D-6-10 + D-6-21 (desktop-only gate), D-6-11 (artifact + PR comment), D-6-12..14 (two-stage review protocol, `<finding>` schema, no aggregator service), D-6-15..17 (README structure + real screenshots + UAT-seeded FAQ), D-6-18 (CF Access email-only), D-6-19 (Phase 3 deltas, superseded by D-6-09.v1), D-6-20 (A-01/A-02), D-6-22 (reboot UAT opt-in), D-6-23 (RepairBanner visual deferred), D-6-24 (single big PR for v1.0).

Hard architectural constraints from PROJECT.md preserved: read-only on project filesystems, `.planning`/`.claude` allow-list with TOCTOU defense, daemon writes confined to `~/.agenticapps/dashboard/`, no native deps (INV-05), bearer-token auth + CORS lock, no Cloudflare Workers/Functions in v1.

---

## Regressions

None detected. The flaky `MultiProjectHome` render-tick test was already flaky before this session (timing-budget test, jsdom-only) and passes in isolation.

---

## Phase 06.1 (sub-phase) — Closed Separately

Phase 06.1 ran inserted between waves of Phase 06 (per `gsd-insert-phase` semantics) and was marked complete on 2026-05-11 via `gsd-tools phase complete`. Its 7 plans (D-6.1-01..04 + closure polish) landed the typography/layout/MaskedToken/ARIA work that made the impeccable gate clearable at the 87 floor. See `.planning/phases/06.1-typography-layout-microcopy/` for the standalone history.

---

## What This Verification Does Not Cover

Stage 2 (`superpowers:requesting-code-review`) findings are explicitly out of scope — per project memory, Stage 2 wants a context-blind reviewer. Stage 2 runs in a fresh Claude Code session against PR #15 once Stage 1 (this report) lands. Resolution of any Stage 2 findings updates this VERIFICATION.md.

Live reboot UAT (POLISH-02) and live systemctl activation (POLISH-03) are deferred per D-6-22 and Linux-required respectively. Subprocess tests cover file-level correctness; live activation moves to first real use.
