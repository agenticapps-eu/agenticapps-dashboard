---
phase: 1
slug: daemon-registry-pairing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (already installed in packages/agent and packages/shared) |
| **Config file** | `packages/agent/vitest.config.ts`, `packages/shared/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @agenticapps/dashboard-agent test:run` |
| **Full suite command** | `pnpm test` (runs all packages via workspace) |
| **Estimated runtime** | ~30 seconds (fast unit + in-process route tests; subprocess CLI tests dominate) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @agenticapps/dashboard-agent test:run -- <pattern>` for the affected file
- **After every plan wave:** Run `pnpm test` (full workspace)
- **Before `/gsd-verify-work`:** Full suite must be green; the 4 mandated TDD cases (token-rotate, CORS reject, path allow-list reject, perms refuse) must each have a named, passing test
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _populated by planner_ | | | | | | | | | |

---

## Wave 0 Requirements

- [ ] Bump `zod` in pnpm catalog from `^3.24.0` to `^3.25.0` (required by `@hono/zod-validator@0.7.6`)
- [ ] Install runtime deps in `packages/agent`: `hono@^4.x`, `@hono/node-server@^1.x`, `@hono/zod-validator@^0.7.6`, `commander@^14.x`, `kleur@^4.x` (or `picocolors`), `zod@catalog:`
- [ ] Add new schema files in `packages/shared/src/schemas/` (auth, registry, read, git, errors) — stubs land in Wave 0 so dependent route tests can import them red
- [ ] Add subprocess-CLI test harness fixture (mktemp HOME, write fake registry/auth files, spawn `dist/cli.js`) under `packages/agent/src/__tests__/fixtures/`

*Wave 0 lands the dependency floor and empty schema stubs so subsequent waves can write tests that import-fail rather than reference-fail.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `--bind tailscale` succeeds when `tailscale ip -4` resolves | Phase 1 success criterion 5 | Requires real Tailscale daemon running on host | `tailscale status` to confirm connected, then `agentic-dashboard --bind tailscale start`, verify pair URL contains MagicDNS hostname |
| `--bind 0.0.0.0` warning banner is yellow + readable | D-20 | Color rendering depends on terminal | Run `agentic-dashboard --bind 0.0.0.0 start` in a real TTY (iTerm/Terminal.app), inspect banner |
| `agentic-dashboard install-launchd` install path | _Out of scope — Phase 6_ | _Deferred_ | _N/A in Phase 1_ |

*Most behaviors automated via vitest unit + in-process route tests + subprocess CLI tests. Tailscale and TTY-color are the only irreducibly manual gates.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
