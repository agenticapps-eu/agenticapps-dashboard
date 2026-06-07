---
phase: 14
slug: understand-anything-integration-daemon-hosted-knowledge-grap
status: draft
nyquist_compliant: false
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
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run the touched package's vitest suite
- **After every plan wave:** Run `pnpm -r test && pnpm -r typecheck`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

*To be filled by the planner — every plan task maps here. Key behavior families that MUST have automated coverage (from 14-RESEARCH.md "Validation Architecture"):*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | D-14-03 | T-14-token | /understand data endpoints 403 without/with-wrong token; bearer token NOT accepted | unit | agent vitest | ❌ W0 | ⬜ pending |
| TBD | — | — | D-14-05 | T-14-traversal | file-content rejects `..`, absolute, NUL, non-graph-listed, >1MB, binary | unit | agent vitest | ❌ W0 | ⬜ pending |
| TBD | — | — | D-14-05b | T-14-leak | graph JSON sanitization relativizes absolute filePaths; no home-dir leak | unit | agent vitest | ❌ W0 | ⬜ pending |
| TBD | — | — | D-14-08 | — | staleness: hash equal → analyzed; differ → stale; missing meta → missing | unit | agent vitest | ❌ W0 | ⬜ pending |
| TBD | — | — | D-14-09 | T-14-resolve | repoId resolution registry-first, FS fallback, family allow-list, realpath guard | unit | agent vitest | ❌ W0 | ⬜ pending |
| TBD | — | — | D-14-10 | — | buildUnderstandCommand returns {string, argv} exact values | unit | shared vitest | ❌ W0 | ⬜ pending |
| TBD | — | — | D-14-06 | — | sidebar section renders; listing page states (empty/populated) | unit | spa vitest | ❌ W0 | ⬜ pending |
| TBD | — | — | coverage col | — | Understand column cell renders ✓-link / stale / missing+pill states | unit | spa vitest | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for new agent route module (understand viewer endpoints) — token gate, traversal suite, sanitization
- [ ] Test stubs for staleness/status detection in coverage scanner
- [ ] Test stubs for shared `buildUnderstandCommand` + schema parse/strict tests

*Existing vitest infrastructure covers all phase requirements — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Viewer renders the live claude-workflow graph end-to-end in a browser | D-14-01/07 | Full SPA-in-browser behavior (graph canvas, token gate UX) not unit-testable | Run `install-understand-viewer`, start daemon, click link from Coverage/Code Intelligence, verify graph renders + source preview works |
| `install-understand-viewer` against the real plugin cache | D-14-01 | Depends on user's installed plugin version + pnpm | Run command, verify `~/.agenticapps/dashboard/understand-viewer/<version>/` populated |
| Tailscale-bind viewer access | D-14-04 | Needs second device / tailscale session (same infra gap as Phase 13 UAT Test 10) | Open viewer link from remote device |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
