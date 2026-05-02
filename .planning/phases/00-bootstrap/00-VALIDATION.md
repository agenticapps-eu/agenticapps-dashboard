---
phase: 0
slug: bootstrap
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (per D-02; configured in Wave 0) |
| **Config file** | `vitest.config.ts` (root) + per-package `vitest.config.ts` |
| **Quick run command** | `pnpm test --run` (non-watch, all projects) |
| **Full suite command** | `pnpm lint && pnpm typecheck && pnpm test --run && pnpm build` |
| **Estimated runtime** | ~30 seconds (placeholder phase, minimal tests) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run` (or filtered project: `pnpm --filter @agenticapps/dashboard-agent test --run`)
- **After every plan wave:** Run `pnpm lint && pnpm typecheck && pnpm test --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Filled by planner. Each plan task with `tdd="true"` or producing executable code MUST have a row.
> See `00-RESEARCH.md` "Validation Architecture" section for the per-requirement test matrix.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _TBD_   | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | _TBD_ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Wave 0 = the bootstrap wave. For Phase 0 (which IS the bootstrap), this means the very first plan must install Vitest and create the test directory structure before any later task can register a `<automated>` verify command.

- [ ] `vitest.config.ts` at repo root with `test.projects: ['packages/*']`
- [ ] `packages/shared/vitest.config.ts` with `test: { name: 'shared', environment: 'node' }`
- [ ] `packages/agent/vitest.config.ts` with `test: { name: 'agent', environment: 'node' }`
- [ ] `packages/spa/vitest.config.ts` with `test: { name: 'spa', environment: 'jsdom' }`
- [ ] Vitest + `@vitest/coverage-v8` + `jsdom` installed via pnpm catalog

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CF Pages preview URL responds 200 behind CF Access | BOOT-03 | Requires live Cloudflare infrastructure + browser to satisfy CF Access challenge | Push branch → wait for CF Pages comment on PR → click preview URL → confirm Access email gate → confirm SPA loads |
| PR comment from Cloudflare bot contains preview URL | BOOT-03 | Cloudflare integration is external; cannot be unit-tested | Open the PR → confirm "Cloudflare Pages" bot comment with `<hash>.agenticapps-dashboard.pages.dev` link |
| `npm view @agenticapps/dashboard-agent@0.0.1-alpha.0` returns metadata | BOOT-04 | npm registry is external; happens AFTER `release.yml` runs on `v0.0.1-alpha.0` tag | After tag push: `npm view @agenticapps/dashboard-agent@0.0.1-alpha.0 version dist.tarball` |
| `npx @agenticapps/dashboard-agent@0.0.1-alpha.0` from clean machine prints alpha message + exit 0 | BOOT-04 | End-to-end install simulation; only meaningful post-publish | `cd /tmp && npx --yes @agenticapps/dashboard-agent@0.0.1-alpha.0` |
| Branch protection requires `ci` status check on `main` | BOOT-02 | GH UI configuration; not in repo files | Settings → Branches → main → Require status checks → select `ci` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (Vitest install, config files)
- [ ] No watch-mode flags (`--run` always)
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (planner sets after filling task map)

**Approval:** pending
