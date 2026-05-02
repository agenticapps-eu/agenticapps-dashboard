---
phase: 0
slug: bootstrap
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-02
last_updated: 2026-05-02
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled by `/gsd-plan-phase 0`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (D-02; configured in Plan 01 Wave 0) |
| **Config file** | `vitest.config.ts` (root, with `test.projects: ['packages/*']`) + per-package `vitest.config.ts` |
| **Quick run command** | `pnpm test --run` (non-watch, all projects) |
| **Filtered run** | `pnpm --filter @agenticapps/dashboard-{shared,agent,spa} test --run` |
| **Full suite command** | `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm test --run && pnpm build` |
| **Estimated runtime** | ~30 seconds (placeholder phase, minimal tests) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run` (or filtered project: `pnpm --filter <name> test --run`).
- **After every plan wave:** Run `pnpm lint && pnpm typecheck && pnpm test --run && pnpm build`.
- **Before `/gsd-verify-work`:** Full suite must be green.
- **Max feedback latency:** 30 seconds.

---

## Per-Task Verification Map

> One row per task that produces executable code or config. Plans without code-producing tasks (Plan 05 docs) are not represented here. Status is updated by execute-phase as each task completes.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 00-01-1 | 01 | 1 | BOOT-01, BOOT-02 | T-00-01, T-00-02 | Workspace skeleton + ESLint/Prettier installs from frozen lockfile; no runtime secrets | smoke | `pnpm install --frozen-lockfile && pnpm lint && pnpm typecheck && pnpm build` | will create | ⬜ pending |
| 00-01-2 | 01 | 1 | BOOT-01 | T-00-01 | HealthResponseSchema validates {ok,version,message?}; rejects malformed | unit (TDD) | `pnpm test --run` (covers shared/agent/spa workspace-resolution tests) | will create | ⬜ pending |
| 00-01-3 | 01 | 1 | BOOT-02 | T-00-02 | CI workflow YAML triggers on push+PR; runs five gates with least privilege; uses pinned action versions | YAML structure | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` + grep checks for `pnpm/action-setup@v6`, `actions/setup-node@v4`, `--frozen-lockfile`, `permissions: contents: read` | will create | ⬜ pending |
| 00-02-1 | 02 | 2 | BOOT-04 | T-00-04 | tsup bundle inlines workspace dep; published artifact has zero runtime workspace deps; shebang + ESM | smoke | `pnpm --filter @agenticapps/dashboard-agent build && head -1 packages/agent/dist/cli.js \| grep -qF '#!/usr/bin/env node' && node packages/agent/dist/cli.js --version \| grep -qF '0.0.1-alpha.0'` | will create | ⬜ pending |
| 00-02-2 | 02 | 2 | BOOT-04 | T-00-04, T-00-07 | CLI subprocess tests use spawnSync only (no shell exec); --version --json validates against HealthResponseSchema; bundle does not contain workspace import | unit (TDD) + smoke | `pnpm --filter @agenticapps/dashboard-agent test --run && cd packages/agent && pnpm publish --dry-run --no-git-checks` | will create | ⬜ pending |
| 00-03-1 | 03 | 2 | BOOT-01, BOOT-03 | T-00-08, T-00-09 | SPA imports HealthResponseSchema; Tailwind 4 utilities compile via @tailwindcss/vite plugin; no third-party JS beyond spec-locked stack | unit (TDD) + smoke | `pnpm --filter @agenticapps/dashboard-spa test --run && pnpm --filter @agenticapps/dashboard-spa build && test -f packages/spa/dist/index.html` | will create | ⬜ pending |
| 00-04-1 | 04 | 3 | BOOT-04 | T-00-04 | publishConfig.access=public, provenance=true; npm metadata fields populated; stub-first TDD on bootstrap config | JSON/package.json structure (TDD) | `node -p "require('./packages/agent/package.json').publishConfig.provenance" \| grep -qF "true" && node -p "require('./packages/agent/package.json').publishConfig.access" \| grep -qF "public" && node -p "require('./packages/agent/package.json').repository.directory" \| grep -qF "packages/agent" && cd packages/agent && pnpm publish --dry-run --no-git-checks` | will create | ⬜ pending |
| 00-04-2 | 04 | 3 | BOOT-04 | T-00-04, T-00-11 | release.yml has id-token:write + registry-url + NODE_AUTH_TOKEN mapping; gates run before publish; publint + attw validations precede publish; stub-first TDD on CI workflow | YAML structure (TDD) | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"` + grep for `id-token: write`, `registry-url`, `--provenance --access public`, `pnpm dlx publint`, `attw --pack`, `pnpm install --frozen-lockfile` | will create | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Notes:
- Plan 05 tasks have grep-based automated `<verify>` blocks but produce no executable code, so no Vitest test rows appear in the per-task verification map. (Their automated content checks are captured in each plan's `<acceptance_criteria>`.)
- Test type "smoke" = end-to-end command exits 0; "unit (TDD)" = Vitest tests with explicit RED → GREEN commits required; "YAML structure" = parser + grep for required keys; "YAML structure (TDD)" / "JSON/package.json structure (TDD)" = parser + grep matrix used as the test, with stub-first RED → GREEN commit pair (mirrors Plan 01 Task 3 / Plan 04 Tasks 1 & 2 pattern for bootstrap config under CLAUDE.md TDD discipline).

---

## Wave 0 Requirements

> Wave 0 = the bootstrap wave (Plan 01). For Phase 0, this means the very first plan installs Vitest and creates the test directory structure before any later task can register an `<automated>` verify command.

- [ ] `vitest.config.ts` at repo root with `test.projects: ['packages/*']` (Plan 01 Task 2)
- [ ] `packages/shared/vitest.config.ts` with `test: { name: 'shared', environment: 'node' }` (Plan 01 Task 2)
- [ ] `packages/agent/vitest.config.ts` with `test: { name: 'agent', environment: 'node' }` (Plan 01 Task 2)
- [ ] `packages/spa/vitest.config.ts` with `test: { name: 'spa', environment: 'jsdom' }` (Plan 01 Task 2; refined in Plan 03 Task 1 to add `setupFiles` for jest-dom)
- [ ] Vitest + `@vitest/coverage-v8` + `jsdom` installed via pnpm catalog (Plan 01 Task 1 + Plan 02/03 catalog entries)
- [ ] `pnpm-lock.yaml` committed to root (Plan 01 Task 1 — required for `--frozen-lockfile`)

`wave_0_complete` flips to `true` after Plan 01 lands and `pnpm test --run` reports tests for shared/agent/spa from the root.

---

## Manual-Only Verifications

> Performed at phase verify-work (`/gsd-verify-work 0`), NOT inside any task. These cannot be automated.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CF Pages preview URL responds 200 behind CF Access | BOOT-03 | Requires live Cloudflare infrastructure + browser to satisfy CF Access challenge | Push branch → wait for "Cloudflare Pages" bot PR comment → click preview URL → confirm Access email gate → confirm SPA loads with brand line + AgentVersion fallback |
| PR comment from Cloudflare bot contains preview URL | BOOT-03 | Cloudflare integration is external; cannot be unit-tested | Open the PR → confirm `agenticapps-dashboard.pages.dev` link in bot comment |
| `npm view @agenticapps/dashboard-agent@0.0.1-alpha.0` returns metadata | BOOT-04 | npm registry is external; happens AFTER `release.yml` runs on `v*` tag | After tag push: `npm view @agenticapps/dashboard-agent@0.0.1-alpha.0 version dist.tarball` |
| `npx @agenticapps/dashboard-agent@0.0.1-alpha.0` from clean machine prints alpha message + exit 0 | BOOT-04 | End-to-end install simulation; only meaningful post-publish | `cd /tmp && npx --yes @agenticapps/dashboard-agent@0.0.1-alpha.0 start` |
| Branch protection requires `ci` status check on `main` | BOOT-02 | GH UI configuration; not in repo files | Settings → Branches → main → Require status checks → select `ci` |
| Cloudflare Access policy on production URL is email-only | BOOT-03 | CF dashboard config; documented in `docs/deploy/cloudflare-pages-setup.md` | Visit `https://agenticapps-dashboard.pages.dev` from incognito browser → confirm CF Access email gate |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are docs-only (Plan 05). Plan 05 tasks have grep-based automated `<verify>` blocks but produce no executable code, so no Vitest test rows appear in the per-task verification map.
- [x] Sampling continuity: every wave produces at least one automated verify command; no 3 consecutive tasks without automated verify.
- [x] Wave 0 covers all MISSING references (Vitest install in Plan 01 Task 1; configs in Plan 01 Task 2).
- [x] No watch-mode flags (`--run` always — verified across plans).
- [x] Feedback latency < 30s (placeholder phase, simple tests).
- [x] `nyquist_compliant: true` set in frontmatter.
- [x] CLAUDE.md TDD discipline applied to every code-producing task AND every bootstrap-config task: Plan 01 Task 3 (`ci.yml`), Plan 04 Task 1 (`packages/agent/package.json` publish metadata), Plan 04 Task 2 (`release.yml`) all use the stub-first RED → GREEN protocol with structure-check matrices as the failing/passing assertions.

**Approval:** ready for `/gsd-execute-phase 0`.
