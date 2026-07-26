---
phase: 5
slug: skills-health-panels
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sources: `05-RESEARCH.md` §Validation Architecture (lines 944–1015) + §Security Domain (lines 1017–1058).
> Task IDs (`05-XX-YY`) are filled by `gsd-planner` once `PLAN.md` files are written.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 (catalog) — already wired across `packages/agent`, `packages/spa`, `packages/shared`. Phase 5 adds `packages/meta-observer/` with the same vitest setup. |
| **Config file** | `vitest.config.ts` per package (existing pattern from Phase 1). |
| **Quick run command** | `pnpm --filter @agenticapps/dashboard-<pkg> test --run path/to/file.test.ts` |
| **Full suite command** | `pnpm -r test` |
| **Estimated runtime** | ~30 s for full suite at Phase 4 close (822 tests). Phase 5 adds ~50–80 tests; expect ~45 s full suite. |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <pkg> test --run path/to/just-edited.test.ts` (target < 5 s feedback).
- **After every plan wave:** Run `pnpm -r test` (target < 60 s).
- **Before `/gsd-verify-work`:** `pnpm -r typecheck && pnpm -r test && pnpm -r build && pnpm lint` all green.
- **Phase closure gate (D-5-10):** Manual end-to-end — install meta-observer in this repo, run a real `claude` session, verify CommitmentBlock + HookFirings populate, capture screenshot in `05-HUMAN-UAT.md`.
- **Max feedback latency:** 5 s per task; 60 s per wave.

---

## Per-Task Verification Map

Plans do not exist yet — task IDs (`05-XX-YY`) are filled by the planner. The mapping below is **requirement → test file → command**, which the planner pins to specific tasks.

| Plan | Wave | Requirement | Threat Ref | Secure Behaviour | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|------------|------------------|-----------|-------------------|-------------|--------|
| skills/lib | 1 | HEALTH-01 | T-5-PathSafety | Reads `~/.claude/skills/*/SKILL.md` frontmatter only; rejects symlink escape | unit | `pnpm --filter @agenticapps/dashboard-agent test --run src/lib/skillsScan.test.ts` | ❌ W0 | ⬜ pending |
| skills/lib | 1 | HEALTH-01 | T-5-PathSafety | `readLocalSkills(projectRoot)` resolves canonical + bundle layouts (Phase 4 D-4-07/D-4-15 reuse) | unit | same file | ❌ W0 | ⬜ pending |
| skills/route | 1 | HEALTH-01 | T-5-CORS / T-5-Bearer | `GET /api/skills/global` returns valid `GlobalSkillsResponseSchema`; rejects without bearer; rejects non-allowed origin | integration | `pnpm --filter @agenticapps/dashboard-agent test --run src/routes/skills.test.ts` | ❌ W0 | ⬜ pending |
| skills/spa | 2 | HEALTH-01 | — | `<InstalledSkills />` renders global + local with scope tags; merges client-side | component | `pnpm --filter @agenticapps/dashboard-spa test --run src/components/panels/InstalledSkills.test.tsx` | ❌ W0 | ⬜ pending |
| agentlinter/runner | 1 | HEALTH-02 | T-5-AgentLinter-Local / T-5-Subprocess-Inj | Argv array `['--yes', 'agentlinter', '--local', '--json', root]`; `--local` ALWAYS present; 30 s timeout | unit (mock execa) | `pnpm --filter @agenticapps/dashboard-agent test --run src/lib/agentLinterRunner.test.ts` | ❌ W0 | ⬜ pending |
| agentlinter/runner | 1 | HEALTH-02 | T-5-AgentLinter-Failures | Discriminated union: `kind: 'ok' \| 'not-installed' \| 'timeout' \| 'error' \| 'unparseable'` (D-5-15) | unit | same file | ❌ W0 | ⬜ pending |
| agentlinter/runner | 1 | HEALTH-02 | T-5-AgentLinter-Real | One integration test runs real `npx agentlinter` if installed (skipped otherwise) | integration | same file (gated by `process.env.AGENTLINTER_REAL`) | ❌ W0 | ⬜ pending |
| agentlinter/cache | 1 | HEALTH-02 | T-5-Cache-Cross | Cache key = `(projectId, max-mtime across all SKILL.md files)`; hit when both unchanged AND age < 1 h (D-5-14) | unit | `pnpm --filter @agenticapps/dashboard-agent test --run src/lib/agentLinterCache.test.ts` | ❌ W0 | ⬜ pending |
| agentlinter/route | 1 | HEALTH-02 | T-5-Bearer | `POST /api/projects/:id/agentlinter/scan` returns cached or fresh result | integration | `pnpm --filter @agenticapps/dashboard-agent test --run src/routes/agentlinter.test.ts` | ❌ W0 | ⬜ pending |
| agentlinter/spa | 2 | HEALTH-02 | — | `<SkillHealth />` row click toggles inline detail; severity glyph mapping `info → ⚪`, `warning → 🟠`, `error → 🔴` (D-5-16 + RESEARCH §Open Question 1) | component | `pnpm --filter @agenticapps/dashboard-spa test --run src/components/panels/SkillHealth.test.tsx` | ❌ W0 | ⬜ pending |
| metadata/scan | 1 | HEALTH-03 | T-5-PathSafety | `parsePackageJsonForSentry(root)` finds `@sentry/*` deps + `sentry-cli` script refs (multi-signal D-5) | unit | `pnpm --filter @agenticapps/dashboard-agent test --run src/lib/projectMetadataScan.test.ts` | ❌ W0 | ⬜ pending |
| metadata/scan | 1 | HEALTH-03 | T-5-PathSafety | `.sentryclirc` presence; `<root>/.spotlight/` presence | unit | same file | ❌ W0 | ⬜ pending |
| metadata/scan | 1 | HEALTH-03 | T-5-PathSafety | CI YAML grep restricted to `<root>/.github/workflows/*.yml`; rejects `.github/no-workflows/` | unit | same file | ❌ W0 | ⬜ pending |
| observability/route | 1 | HEALTH-03 | T-5-Bearer | `GET /api/projects/:id/observability` returns multi-signal payload | integration | `pnpm --filter @agenticapps/dashboard-agent test --run src/routes/observability.test.ts` | ❌ W0 | ⬜ pending |
| observability/spa | 2 | HEALTH-03 | — | Panel renders "detected via @sentry/node + .sentryclirc" copy with provenance | component | `pnpm --filter @agenticapps/dashboard-spa test --run src/components/panels/ObservabilityHealth.test.tsx` | ❌ W0 | ⬜ pending |
| metadata/scan | 1 | HEALTH-04 | T-5-NoSecretRead | `parseInfisicalConfig(root)` returns `present-valid \| present-invalid \| absent`; never reads `.env` | unit | `pnpm --filter @agenticapps/dashboard-agent test --run src/lib/projectMetadataScan.test.ts` | ❌ W0 | ⬜ pending |
| secrets/route | 1 | HEALTH-04 | T-5-Bearer | `GET /api/projects/:id/secrets` returns three-state | integration | `pnpm --filter @agenticapps/dashboard-agent test --run src/routes/secrets.test.ts` | ❌ W0 | ⬜ pending |
| secrets/spa | 2 | HEALTH-04 | — | `<SecretsHealth />` renders 3 distinct UI states | component | `pnpm --filter @agenticapps/dashboard-spa test --run src/components/panels/SecretsHealth.test.tsx` | ❌ W0 | ⬜ pending |
| integrations/lib | 1 | HEALTH-05 | T-5-NoCloudIO | `computeIntegrationState({ envVarPresent, signalDetected })` truth table; never calls Sentry/Linear/Infisical APIs | unit | `pnpm --filter @agenticapps/dashboard-agent test --run src/lib/integrationsState.test.ts` | ❌ W0 | ⬜ pending |
| integrations/route | 1 | HEALTH-05 | T-5-Bearer | `GET /api/projects/:id/integrations` returns three-state per integration (D-5-19) | integration | `pnpm --filter @agenticapps/dashboard-agent test --run src/routes/integrations.test.ts` | ❌ W0 | ⬜ pending |
| integrations/spa | 2 | HEALTH-05 | — | One-paragraph copy for each `not-detected` integration; install hint for `present-but-not-configured` (spec line 504 verbatim) | component | `pnpm --filter @agenticapps/dashboard-spa test --run src/components/panels/IntegrationsHealth.test.tsx` | ❌ W0 | ⬜ pending |
| layout/spa | 2 | INV-03 | — | Grid widens from `1fr 1.5fr` to `1fr 1.5fr 1fr` (D-5-01 / D-4-09 staged); `[data-testid='single-project-grid']` className change asserted | component | `pnpm --filter @agenticapps/dashboard-spa test --run src/components/SingleProjectView.test.tsx` | ❌ W0 | ⬜ pending |
| panels/all | 2 | INV-03 | — | All 5 panels render gracefully on empty / missing / error daemon responses (D-5-15 + D-5-19 + D-4-14) | component | each panel test asserts the empty/error states | ❌ W0 | ⬜ pending |
| meta-observer/lib | 1 | DISC-01 closure | T-5-Meta-Write-Path | `extractCommitment(transcript)` reads last `## Workflow commitment` block; tolerates partial transcripts | unit | `pnpm --filter @agenticapps/dashboard-meta-observer test --run lib/extractCommitment.test.ts` | ❌ W0 | ⬜ pending |
| meta-observer/lib | 1 | DISC-01 closure | T-5-Meta-Write-Path | `resolveProjectRoot()` prefers `CLAUDE_PROJECT_DIR`, falls back to CWD walk-up looking for `.planning` or `.claude`; returns null if neither found (D-5-07) | unit | `pnpm --filter @agenticapps/dashboard-meta-observer test --run lib/projectRoot.test.ts` | ❌ W0 | ⬜ pending |
| meta-observer/lib | 1 | DISC-01 closure | T-5-Meta-AtomicWrite | Atomic write — `.tmp` + rename — race test asserts no partial file visible to concurrent reader; refuses paths outside `<root>/.planning/skill-observations/` | unit (race test) | `pnpm --filter @agenticapps/dashboard-meta-observer test --run lib/atomicWrite.test.ts` | ❌ W0 | ⬜ pending |
| meta-observer/lib | 1 | DISC-02 closure | T-5-Meta-Write-Path | `extractFirings(transcript)` emits JSONL conforming to `HookFiringSchema` (Phase 4 D-4-06 reuse) | unit | `pnpm --filter @agenticapps/dashboard-meta-observer test --run lib/extractFirings.test.ts` | ❌ W0 | ⬜ pending |
| meta-observer/e2e | 3 | D-5-10 | T-5-Meta-EndToEnd | Install skill in fixture project, simulate SessionEnd payload, verify file written + parseable by `phaseDetail.ts` | scripted integration | `node packages/meta-observer/test/end-to-end.mjs` | ❌ W0 | ⬜ pending |
| meta-observer/manual | 4 | D-5-10 | — | Run real `claude` session against this repo; verify `<CommitmentBlock />` populates with non-null markdown; capture screenshot | manual (HUMAN-UAT) | scripted probe + SPA screenshot in `05-HUMAN-UAT.md` | ❌ W0 | ⬜ pending |
| schemas/shared | 1 | (Schema drift) | T-5-Drift | Each new daemon route uses `outbound(c, Schema.parse, value)`; schema drift returns 500 with parse error in dev | integration | each route test calls `outbound` with bad value and asserts 500 | ❌ W0 | ⬜ pending |
| paths/lib | 1 | (Path safety) | T-5-PathSafety | `resolveAllowedNamed(<root>/../etc/passwd, ...)` rejects via realpath check; symlink escape rejected | unit | `pnpm --filter @agenticapps/dashboard-agent test --run src/lib/paths.test.ts` (extends existing) | ❌ W0 (extension of Phase 1 file) | ⬜ pending |
| paths/lib | 1 | (Path safety) | T-5-PathSafety | `resolveAllowedNamed(<root>/.github/workflows/x.yml, ...)` accepts; `<root>/.github/no-workflows/x.yml` rejects | unit | same file | ❌ W0 | ⬜ pending |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 in this phase = "create the test stubs + fixtures the planner's tasks attach to". Every test file below MUST exist and contain failing-but-shaped stubs before any implementation task starts. The planner pins each stub to a `[BLOCKING]` Wave-0 task.

### New test files (planner pins to specific Wave 0 tasks)

- [ ] `packages/agent/src/lib/skillsScan.test.ts` — covers HEALTH-01 (global + local + dual-layout)
- [ ] `packages/agent/src/lib/projectMetadataScan.test.ts` — covers HEALTH-03 + HEALTH-04 (multi-signal + .infisical.json)
- [ ] `packages/agent/src/lib/agentLinterRunner.test.ts` — covers HEALTH-02 5-class discriminated union + `--local` privacy invariant
- [ ] `packages/agent/src/lib/agentLinterCache.test.ts` — covers cache key + 1 h ceiling + mtime invalidation (D-5-14)
- [ ] `packages/agent/src/lib/integrationsState.test.ts` — covers HEALTH-05 truth table
- [ ] `packages/agent/src/routes/skills.test.ts` — global + local skills routes
- [ ] `packages/agent/src/routes/agentlinter.test.ts` — caching + failure classes + bearer + CORS
- [ ] `packages/agent/src/routes/observability.test.ts` — signal detection wiring
- [ ] `packages/agent/src/routes/secrets.test.ts` — `.infisical.json` route
- [ ] `packages/agent/src/routes/integrations.test.ts` — three-state route
- [ ] `packages/spa/src/components/panels/InstalledSkills.test.tsx`
- [ ] `packages/spa/src/components/panels/SkillHealth.test.tsx`
- [ ] `packages/spa/src/components/panels/ObservabilityHealth.test.tsx`
- [ ] `packages/spa/src/components/panels/SecretsHealth.test.tsx`
- [ ] `packages/spa/src/components/panels/IntegrationsHealth.test.tsx`
- [ ] `packages/shared/src/schemas/skills.ts` (+ `.test.ts`)
- [ ] `packages/shared/src/schemas/agentlinter.ts` (+ `.test.ts`)
- [ ] `packages/shared/src/schemas/observability.ts` (+ `.test.ts`)
- [ ] `packages/shared/src/schemas/secrets.ts` (+ `.test.ts`)
- [ ] `packages/shared/src/schemas/integrations.ts` (+ `.test.ts`)
- [ ] `packages/meta-observer/test/projectRoot.test.ts`
- [ ] `packages/meta-observer/test/extractCommitment.test.ts`
- [ ] `packages/meta-observer/test/extractFirings.test.ts`
- [ ] `packages/meta-observer/test/atomicWrite.test.ts`
- [ ] `packages/meta-observer/test/end-to-end.mjs`

### Wave 0 probes (block planning of dependent tasks until evidence captured)

- [ ] **Transcript shape probe** — read one real `~/.claude/projects/.../<session>.jsonl` and emit a fixture `packages/meta-observer/test/__fixtures__/sample-transcript.jsonl`. Resolves Open Question 3 / Assumption A3 in RESEARCH.md.
- [ ] **Skill-scoped hook activation probe** — install a skeleton meta-observer skill that `echo`s "fired" to a tmp file; run a one-shot Claude session; verify the file appears. Resolves Open Question 2 / Assumption A2. Fallback if it doesn't fire: declare hook in `.claude/settings.json` directly instead of `SKILL.md` frontmatter.

### Existing infrastructure reused

- `packages/agent/src/lib/__fixtures__/phase4-fixture.ts` — `writeWorkflowSkillCanonical` + `writeMetaObserverSkillBundle` already exist; reuse without duplicating.
- `packages/agent/src/lib/phaseDetail.ts:findSkillPath()` — Phase 4 dual-layout probe; the `readLocalSkills` test must replicate this behaviour.
- `packages/agent/src/lib/paths.ts:resolveAllowed()` — Phase 1 D-23 prior art that `resolveAllowedNamed` extends, not replaces.
- `packages/shared/src/schemas/observations.ts:HookFiringSchema` — JSONL contract the meta-observer must emit.

---

## Manual-Only Verifications

| Behaviour | Requirement | Why Manual | Test Instructions |
|-----------|-------------|------------|-------------------|
| Real Claude session writes commitment markdown + JSONL firings to `.planning/skill-observations/` | D-5-10 (Phase 5 closure gate) | Requires actual Claude Code runtime — cannot be automated without re-implementing the agent. | 1. `pnpm --filter @agenticapps/dashboard-meta-observer build && claude skill install <local path>` in this repo. 2. Run a one-shot `claude` session that includes the workflow commitment block. 3. Verify `<CommitmentBlock />` populates in the SPA + `<HookFirings />` shows non-empty events. 4. Capture screenshot in `05-HUMAN-UAT.md`. |
| `IntegrationsHealth` "Configure to enable" copy reads as one paragraph (spec line 504) | INV-03 | Editorial / impeccable critique judgement. | Read the rendered panel; confirm one-paragraph copy per integration (Sentry, Linear, Infisical). |
| AgentLinter `--local` enforcement under cache hit + cache miss + retry-after-timeout | T-5-AgentLinter-Local (V8 Data Protection) | Subprocess argv is asserted in unit tests, but cross-cutting paths are easier to confirm by hand. | Unit tests cover argv assertion automatically; manual confirmation = code review of every spawn site. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (every new test file above + 2 probes)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5 s per task; < 60 s per wave
- [ ] D-5-10 manual closure gate complete with screenshot before phase ships
- [ ] `nyquist_compliant: true` set in frontmatter (after planner pins task IDs + executor passes Wave 0)

**Approval:** pending
