---
phase: 1
slug: daemon-registry-pairing
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-03
last_updated: 2026-05-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (already installed in packages/agent and packages/shared) |
| **Config file** | `packages/agent/vitest.config.ts`, `packages/shared/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @agenticapps/dashboard-agent test` |
| **Full suite command** | `pnpm test` (runs all packages via workspace) |
| **Estimated runtime** | ~45–60 seconds (subprocess CLI tests dominate after Plans 04–05) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @agenticapps/dashboard-agent test -- <pattern>` for the affected file
- **After every plan wave:** Run `pnpm test` (full workspace)
- **Before `/gsd-verify-work`:** Full suite must be green; the 4 mandated TDD cases (token-rotate, CORS reject, path allow-list reject, perms refuse) must each have a named, passing test
- **Max feedback latency:** 60 seconds (subprocess tests inherent overhead)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-T1 | 01 | 0 | INV-05 | T-01-01-04 | tsup noExternal correctly bundles new deps; no MODULE_NOT_FOUND on dist | unit | `pnpm --filter @agenticapps/dashboard-agent build` | n/a (build step) | planned |
| 01-01-T2 | 01 | 0 | INV-04 | T-01-01-05 | All Phase 1 schemas exist + parse correctly; HealthResponseSchema backward-compat | unit | `pnpm --filter @agenticapps/dashboard-shared test` | ❌ Wave 0 (creates) | planned |
| 01-02-T1a | 02 | 1 | API-02 | T-01-02-02, T-01-02-03 | resolveAllowed rejects ../, absolute, planted symlink, outside .planning/.claude | unit | `pnpm --filter @agenticapps/dashboard-agent test -- lib/paths.test.ts` | ❌ created in this task | planned |
| 01-02-T1b | 02 | 1 | DAEMON-05 | T-01-02-05 | pidfile liveness via process.kill(pid,0); stale auto-removed | unit | `pnpm --filter @agenticapps/dashboard-agent test -- lib/pidfile.test.ts` | ❌ created in this task | planned |
| 01-02-T1c | 02 | 1 | DAEMON-05 | (cosmetic) | Banner output verbatim spec lines 207-219 + URL-encoded pair URL | unit | `pnpm --filter @agenticapps/dashboard-agent test -- lib/banner.test.ts` | ❌ created in this task | planned |
| 01-02-T2a | 02 | 1 | AUTH-01, AUTH-03, AUTH-04, INV-02 | T-01-02-01, T-01-02-04, T-01-02-09 | generateToken 71-char format; rotateToken D-15 ordering; assertSecurePermissions exact spec text | unit | `pnpm --filter @agenticapps/dashboard-agent test -- lib/auth.test.ts` | ❌ created in this task | planned |
| 01-02-T2b | 02 | 1 | REG-01, REG-02, REG-03, REG-04, REG-05 | T-01-02-08, T-01-02-10 | addProject idempotent + slug collision -2/-3; listProjectsWithStatus survives unreachable | unit | `pnpm --filter @agenticapps/dashboard-agent test -- lib/registry.test.ts` | ❌ created in this task | planned |
| 01-03-T1a | 03 | 2 | DAEMON-02 | T-01-03-08 | server.json (mode 0600) lifecycle: write on listen, remove on shutdown | unit | `pnpm --filter @agenticapps/dashboard-agent test -- lib/serverInfo.test.ts` | ❌ created in this task | planned |
| 01-03-T1b | 03 | 2 | API-03 | T-01-03-05 | runAllowedGit blocks non-allow-list cmds (e.g. 'rebase', 'log;rm -rf') BEFORE execa spawn | unit | `pnpm --filter @agenticapps/dashboard-agent test -- lib/git.test.ts` | ❌ created in this task | planned |
| 01-03-T1c | 03 | 2 | DAEMON-06 | T-01-03-07 | isTailscaleCIDR boundary check; cidrMiddleware returns 403 for off-CIDR | unit | `pnpm --filter @agenticapps/dashboard-agent test -- server/middleware/cidr.test.ts` | ❌ created in this task (extended in 01-05-T2) | planned |
| 01-03-T2a | 03 | 2 | AUTH-03, D-15 | T-01-03-01 | **MANDATORY TDD:** token-rotation-invalidates-old-token | in-process route | `pnpm --filter @agenticapps/dashboard-agent test -- server/__tests__/auth.test.ts -t "token-rotation-invalidates-old-token"` | ❌ created in this task | planned |
| 01-03-T2b | 03 | 2 | AUTH-02 | T-01-03-02 | **MANDATORY TDD:** cors-rejects-wrong-origin | in-process route | `pnpm --filter @agenticapps/dashboard-agent test -- server/__tests__/auth.test.ts -t "cors-rejects-wrong-origin"` | ❌ created in this task | planned |
| 01-03-T2c | 03 | 2 | DAEMON-04, INV-02 | T-01-03-04 | **MANDATORY TDD:** permissions-check-refuses-0644 (subprocess against built dist/cli.js) | subprocess | `pnpm --filter @agenticapps/dashboard-agent test -- server/__tests__/auth.test.ts -t "permissions-check-refuses-0644"` | ❌ created in this task | planned |
| 01-03-T2d | 03 | 2 | API-02 | T-01-03-03 | **MANDATORY TDD:** path-allow-list-rejects-traversal | in-process route | `pnpm --filter @agenticapps/dashboard-agent test -- server/__tests__/paths.test.ts -t "path-allow-list-rejects-traversal"` | ❌ created in this task | planned |
| 01-03-T2e | 03 | 2 | API-01, INV-04 | T-01-03-06 | GET /health returns HealthResponseSchema-valid; D-16 schema_drift fallback to 500 | in-process route | `pnpm --filter @agenticapps/dashboard-agent test -- server/__tests__/health.test.ts` | ❌ created in this task | planned |
| 01-03-T2f | 03 | 2 | AUTH-01, REG-01, REG-03 | T-01-03-13 | /api/registry GET/register/unregister; idempotent register returns 200+alreadyRegistered | in-process route | `pnpm --filter @agenticapps/dashboard-agent test -- server/__tests__/registry.test.ts` | ❌ created in this task | planned |
| 01-03-T2g | 03 | 2 | API-03 | T-01-03-05 | GET /api/projects/:id/git rejects non-allow-list cmd with 422 | in-process route | `pnpm --filter @agenticapps/dashboard-agent test -- server/__tests__/git.test.ts` | ❌ created in this task | planned |
| 01-03-T2h | 03 | 2 | DAEMON-02 | T-01-03-12 | POST /api/admin/shutdown returns 204 (mocked server.close) | in-process route | `pnpm --filter @agenticapps/dashboard-agent test -- server/__tests__/admin.test.ts` | ❌ created in this task | planned |
| 01-04-T1a | 04 | 3 | REG-02 | T-01-04-03 | discoverProjects depth=1 + D-08 markers; registerInteractive --yes / --dry-run | unit | `pnpm --filter @agenticapps/dashboard-agent test -- cli/discover.test.ts` | ❌ created in this task | planned |
| 01-04-T1b | 04 | 3 | REG-04, DAEMON-03 | (cosmetic) | list/status default pretty table; --json validates against schemas | unit (covered by subprocess in T2) | (see T2c) | n/a | planned |
| 01-04-T2a | 04 | 3 | DAEMON-01, AUTH-01 | T-01-04-04 | start subprocess: boots, /health curl returns 200 with bearer | subprocess | `pnpm --filter @agenticapps/dashboard-agent test -- cli/__tests__/start.subprocess.test.ts` | ❌ created in this task | planned |
| 01-04-T2b | 04 | 3 | DAEMON-02 | T-01-04-01 | stop subprocess: graceful exit within 2s | subprocess | `pnpm --filter @agenticapps/dashboard-agent test -- cli/__tests__/stop.subprocess.test.ts` | ❌ created in this task | planned |
| 01-04-T2c | 04 | 3 | REG-01 | T-01-04-04 | register subprocess: idempotent re-register exits 0 + already-registered | subprocess | `pnpm --filter @agenticapps/dashboard-agent test -- cli/__tests__/register.subprocess.test.ts` | ❌ created in this task | planned |
| 01-04-T2d | 04 | 3 | REG-04, DAEMON-03 | (cosmetic) | list --json + status --json validate against schemas | subprocess | `pnpm --filter @agenticapps/dashboard-agent test -- cli/__tests__/list-status.subprocess.test.ts` | ❌ created in this task | planned |
| 01-04-T2e | 04 | 3 | AUTH-03 | T-01-04-07 | rotate-token subprocess: token in auth.json changes | subprocess | `pnpm --filter @agenticapps/dashboard-agent test -- cli/__tests__/rotate-token.subprocess.test.ts` | ❌ created in this task | planned |
| 01-05-T1 | 05 | 3 | DAEMON-06 | T-01-05-01, T-01-05-02 | tailscale lib mocked-execa: exact remediation message + trailing-dot strip | unit | `pnpm --filter @agenticapps/dashboard-agent test -- lib/tailscale.test.ts` | ❌ created in this task | planned |
| 01-05-T2a | 05 | 3 | DAEMON-06 | T-01-05-01 | bind-modes subprocess: --bind tailscale exits 1 with EXACT D-17 message | subprocess | `pnpm --filter @agenticapps/dashboard-agent test -- cli/__tests__/bind-modes.subprocess.test.ts` | ❌ created in this task | planned |
| 01-05-T2b | 05 | 3 | DAEMON-06 | T-01-05-03 | bind-modes subprocess: --bind 0.0.0.0 prints WARNING banner | subprocess | `pnpm --filter @agenticapps/dashboard-agent test -- cli/__tests__/bind-modes.subprocess.test.ts` | ❌ created in this task | planned |
| 01-05-T2c | 05 | 3 | DAEMON-06 | T-01-03-07 | cidr middleware integration: 403 off-CIDR / 200 in-CIDR / 200 enforceCIDR=false | in-process route | `pnpm --filter @agenticapps/dashboard-agent test -- server/middleware/cidr.test.ts` | ❌ extended in this task | planned |
| 01-05-T2d | 05 | 3 | All Phase 1 REQ-IDs | (closes everything) | end-to-end smoke: register → start → /health → /api/registry → read → rotate → 401 → stop | subprocess | `pnpm --filter @agenticapps/dashboard-agent test -- cli/__tests__/end-to-end.subprocess.test.ts` | ❌ created in this task | planned |

---

## Wave 0 Requirements

- [ ] Bump `zod` in pnpm catalog from `^3.24.0` to `^3.25.0` (required by `@hono/zod-validator@0.7.6`) — Plan 01 Task 1
- [ ] Install runtime deps in `packages/agent`: `hono@^4.12.16`, `@hono/node-server@^2.0.1`, `@hono/zod-validator@^0.7.6`, `execa@^9.6.1`, `picocolors@^1.1.1`; add `commander@catalog:` and `zod@catalog:` to dependencies (move from devDependencies) — Plan 01 Task 1
- [ ] Add `hono`, `@hono/node-server`, `@hono/zod-validator`, `execa`, `picocolors` to tsup `noExternal` in `packages/agent/tsup.config.ts` — Plan 01 Task 1
- [ ] Create new schema files in `packages/shared/src/schemas/` (auth, registry, read, git, errors, server) + extend health (optional new fields) — Plan 01 Task 2
- [ ] Re-export all new schemas from `packages/shared/src/index.ts` — Plan 01 Task 2
- [ ] Add subprocess-CLI test harness fixture (mktemp HOME, isolated env, build-once beforeAll) at `packages/agent/src/cli/__tests__/__shared__/spawnAgent.ts` — Plan 04 Task 2 (consumed by Plan 05)

*Wave 0 lands the dependency floor and empty schema stubs so subsequent waves can write tests that import-fail rather than reference-fail.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `--bind tailscale` succeeds when `tailscale ip -4` resolves | Phase 1 success criterion 5 (positive case) | Requires real Tailscale daemon running on host | `tailscale status` to confirm connected, then `agentic-dashboard --bind tailscale start`, verify pair URL contains MagicDNS hostname (no trailing dot) and `curl --interface tailscale0 -H "Authorization: Bearer <token>" http://<tailscale-ip>:5193/health` returns 200 |
| `--bind 0.0.0.0` warning banner is **yellow** + readable | D-20 | Color rendering depends on terminal | Run `agentic-dashboard --bind 0.0.0.0 start` in a real TTY (iTerm/Terminal.app), inspect that the WARNING line renders yellow |
| Pair URL clicked from a remote device completes /health round-trip via Tailscale | Phase 1 success criterion 1 (cross-device) | Requires second device on same tailnet | On dev box: `agentic-dashboard --bind tailscale start`. On iPad/laptop on same tailnet: open the printed pair URL in browser; SPA pair flow lands here in Phase 2, but for Phase 1 just verify `curl https://<magicdns>:5193/health -H "Authorization: Bearer <token>"` returns 200 from the second device |
| `agentic-dashboard install-launchd` install path | _Out of scope — Phase 6_ | _Deferred_ | _N/A in Phase 1_ |

*Most behaviors automated via vitest unit + in-process route tests + subprocess CLI tests. Tailscale-live (positive path) and TTY-color are the only irreducibly manual gates.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every Plan task has automated verify; Wave 0 listed above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task in Plans 01–05 has its own verify command)
- [x] Wave 0 covers all MISSING references (deps + schema stubs in Plan 01 land before any Wave 1+ test file is written)
- [x] No watch-mode flags (all commands use `vitest run` via `pnpm test`)
- [x] Feedback latency < 60s (extended from 30s due to subprocess tests; documented above)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (planner sign-off 2026-05-03)
