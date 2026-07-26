---
phase: 3
slug: multi-project-home-page
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.6.x (already installed in `packages/spa`, `packages/agent`, `packages/shared`) |
| **Config file** | `packages/spa/vitest.config.ts`, `packages/agent/vitest.config.ts`, `packages/shared/vitest.config.ts` (all in place from Phase 0/1/2) |
| **Quick run command** | `pnpm -r test --run` (no watch mode; ~10 s on the post-Phase-2 327-test baseline) |
| **Full suite command** | `pnpm -r typecheck && pnpm -r test --run && pnpm -r build && pnpm lint` |
| **Estimated runtime** | quick: ~10 s; full: ~75 s |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter <package> test --run` for the package the task touched (~3–5 s)
- **After every plan wave:** `pnpm -r test --run` (full workspace, no watch)
- **Before `/gsd-verify-work`:** Full suite (typecheck + test + build + lint) must be green
- **Max feedback latency:** 12 s on a per-package run

---

## Per-Task Verification Map

This map is filled by the planner during plan generation. Each plan-task maps to one row. The planner derives `Test Type` from the contract:

- **unit:** vitest pure-function or component test against in-process state
- **component:** vitest + @testing-library/react against rendered React tree
- **integration:** Hono `app.fetch(req)` test or daemon library function test that hits the filesystem
- **subprocess:** spawn `agentic-dashboard` CLI or `pnpm dev` and assert observable behavior
- **e2e:** Playwright (deferred to Phase 6 polish; Phase 3 ships subprocess + component tests)

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note:* The planner will replace this single placeholder row with one row per task across all plans. The Wave 0 column is critical — every test file referenced by an `<automated>` block must either exist before that task runs (✅) or be installed in Wave 0 (❌ W0).

---

## Wave 0 Requirements

Wave 0 is for stub installation that other waves depend on. For Phase 3:

- [ ] `packages/shared/src/schemas/overview.ts` — RED stub for `ProjectOverviewSchema` (D-08); test file `overview.test.ts` asserts schema shape + parse behavior on minimal valid + drift cases
- [ ] `packages/shared/src/schemas/registry.ts` extended in place — RED stubs for `RegisterPrepareRequestSchema`, `RegisterPrepareResponseSchema` (allowed | blocked | alreadyRegistered union), `RegisterConfirmRequestSchema`, `RegisterConfirmResponseSchema`, `RenameRequestSchema`, `TagsRequestSchema`; test file `registry.test.ts` extends existing tests
- [ ] `packages/agent/src/lib/registerNonces.ts` — RED stub for nonce store API (`issueNonce`, `consumeNonce`, `cleanupExpired`); `registerNonces.test.ts` asserts TTL, single-use, expired-on-confirm
- [ ] `packages/agent/src/lib/rateLimiter.ts` — RED stub for `Map<tokenHash, timestamps[]>` rate limiter (`consume`, `tokenHashOf`); `rateLimiter.test.ts` asserts 1/s cap + 10-burst + 60s sweep
- [ ] `packages/agent/src/lib/projectOverview.ts` + `overviewCache.ts` — RED stubs; tests assert filesystem read + cache hit/miss/stale + multi-tab coalescing simulation
- [ ] `packages/agent/src/lib/registerLog.ts` — RED stub for `logBlocked()` console.error helper; test asserts log line format
- [ ] `packages/spa/src/lib/touchLongPress.ts` — RED stub for Pointer Events long-press detector; test simulates pointerdown + 500ms + pointerup
- [ ] **WR-01 carryover fix** (Phase 2 review finding) — refactor `useTheme()` to `useSyncExternalStore` so theme state is shared across components (CommandPalette adds a third consumer). Lock in Wave 0 before any palette work begins.
- [ ] AppShell `max-w-3xl` → conditional override pattern (component prop or HomeLayout wrapper) — Wave 0 lays the pattern; Wave 2 home page uses it.

*If all of the above are addressed in Wave 0, every subsequent wave's `<automated>` block can reference real files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card hover-expand reads naturally on a real Mac trackpad / Windows mouse | D-34 / D-35 | Touch + mouse + keyboard interaction nuance not faithfully testable in jsdom | `pnpm --filter @agenticapps/dashboard-spa dev` → register 3 projects → hover each card → verify ~120 ms transition with no rotate/scale/glow/bounce |
| Card touch long-press on real iPad over Tailscale opens the context menu without scrolling the page | D-23 / Tailscale UX | Pointer events on iOS Safari with Tailscale-served HTTP behave subtly different from jsdom | iPad Safari → `https://<host>.tail-...ts.net:5193` (paired) → long-press a card → verify menu opens at finger position; verify scroll does not start |
| Cmd+K vs Ctrl+K platform detection works on real macOS + Linux + Windows | D-32 | navigator.userAgent + key event differences | macOS: ⌘K opens; Linux/Windows: Ctrl+K opens |
| Schema drift state on a per-card basis renders without leaking into other cards | D-07 | Requires injecting a malformed daemon response into one of N cards | `pnpm dev` → manually edit one project's `.planning/phases/00-bootstrap/00-VERIFICATION.md` to a garbled state → verify only that card shows SchemaDriftState |
| Optimistic add invariant: register-confirm 201 → card appears within 1 frame (~16 ms) | D-25 / criterion 4 | Browser repaint timing is not exposed in jsdom | DevTools Performance recorder during register flow; assert paint event ≤ 50 ms after 201 |
| `impeccable:critique` ≥ 90 baseline check on the Phase 3 surfaces | D-42 / D-43 / D-44 | impeccable critique is a separate skill; Phase 6 owns the hard gate | Run `/impeccable:critique` against `packages/spa/src/components/MultiProjectHome.tsx` and friends; expect a baseline ≥ 80 in Phase 3 (≥ 90 is the Phase 6 lock) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (overview / registry / nonces / rate limiter / log helper / longPress / WR-01 / AppShell width override)
- [ ] No watch-mode flags (`vitest --run` only)
- [ ] Feedback latency < 12 s per-package quick run, < 75 s full suite
- [ ] `nyquist_compliant: true` set in frontmatter once planner has filled the per-task verification map

**Approval:** pending — planner will derive the per-task rows and flip `nyquist_compliant: true` once each must_have has at least one ≥2× sampled test (Nyquist principle).
