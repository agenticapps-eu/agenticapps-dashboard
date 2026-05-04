---
phase: 2
slug: spa-shell-pair-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled by gsd-planner after plans land; refined by /gsd-validate-phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x + @testing-library/react 16.x + jsdom (already configured Phase 0) |
| **Config file** | `packages/spa/vitest.config.ts` (or `vite.config.ts` `test` block) |
| **Quick run command** | `pnpm --filter @agenticapps/dashboard-spa test` |
| **Full suite command** | `pnpm -r test` (workspace-wide; agent + shared + spa) |
| **Estimated runtime** | ~6 seconds (spa only) / ~25 seconds (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @agenticapps/dashboard-spa test` (quick, scoped)
- **After every plan wave:** Run `pnpm -r test` + `pnpm -r typecheck` (full)
- **Before `/gsd-verify-work`:** Full suite green AND `pnpm -r build` green AND subprocess hot-reload <2s test green
- **Max feedback latency:** 6 seconds (per-task) / 25 seconds (per-wave)

---

## Per-Task Verification Map

> Populated by gsd-planner once PLAN files land. Each task gets a row mapping (task ID → plan → wave → requirement → threat ref → test type → automated command).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | SPA-01 | — | Dev server boots on port 5174 | subprocess | `pnpm --filter @agenticapps/dashboard-spa test dev-perf-smoke` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Coverage discipline:** Every task in every PLAN.md must have either an `<automated>` verification command OR a Wave 0 dependency on a test file that does. No 3 consecutive tasks may rely on manual verification — Nyquist sampling continuity gate.

---

## Wave 0 Requirements

> Populated by gsd-planner. The first wave installs test infrastructure for any new test layers Phase 2 introduces.

- [ ] `packages/shared/src/schemas/pairing.test.ts` — stubs for `PairingSchema`, `AgentUrlSchema`, `parseOrDrift` (per RESEARCH.md §"Schema-drift detection")
- [ ] `packages/spa/src/lib/api.test.ts` — stubs for QueryCache 401-interceptor + ECONNREFUSED detection (per RESEARCH.md Pitfall 5)
- [ ] `packages/spa/src/lib/theme.test.ts` — stubs for theme persistence + tri-state logic
- [ ] `packages/spa/src/lib/pairing.test.ts` — stubs for getPairing/setPairing/clearPairing localStorage round-trip
- [ ] `packages/spa/src/test/dev-perf-smoke.test.ts` — subprocess test asserting `pnpm dev` HMR <2s (per RESEARCH.md §"Vite hot-reload benchmark")

*Existing infrastructure: vitest + @testing-library/react + jsdom + jest-dom matchers configured in Phase 0 (`packages/spa/src/test-setup.ts`). New deps required: `@tanstack/react-router` + `@tanstack/zod-adapter` (router test fixtures) + `@testing-library/user-event` (form tests).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `impeccable:critique` ≥ 90 visual baseline | INV (Phase 6 gate; Phase 2 sets baseline) | Subjective design quality dimension | Run `/impeccable` against deployed Pages preview; capture score for trend tracking |
| Dark/light theme transitions render correctly across all routes | D-02, D-03 | jsdom doesn't render computed CSS; visual regression deferred to Phase 6 (POLISH-04) | Manually toggle theme on each route, screenshot diff |
| Pair URL one-click flow with real daemon | SPA-02, SPA-03 | Requires live `agentic-dashboard start` printing pair URL with real token | Boot daemon → click pair URL → verify lands on `/` paired |
| Schema-drift error UX is debuggable | D-09 | Verified by reading the surface, not parsing pixels | Force drift (manually mutate `HealthResponseSchema` SPA-side) → confirm field path + expected/got render readable |

*All other behaviors have automated verification via vitest unit/component/subprocess tests.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 stub test files listed above)
- [ ] No watch-mode flags (vitest run, not vitest watch)
- [ ] Feedback latency < 6s per-task (scoped) / < 25s per-wave (full)
- [ ] `nyquist_compliant: true` set in frontmatter (after gsd-planner populates Per-Task Verification Map)

**Approval:** pending — awaits PLAN.md generation + gsd-plan-checker pass
