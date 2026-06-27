---
phase: 8
slug: optional-integration-panels
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-11
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 08-RESEARCH.md §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/agent/vitest.config.ts` (agent) · `packages/spa/vitest.config.ts` (spa) · `packages/shared` vitest |
| **Quick run command** | `pnpm --filter @agenticapps/dashboard-agent test` |
| **Full suite command** | `pnpm -r test` (run per-package if `-r` is unreliable: agent, then shared, then spa) |
| **Estimated runtime** | ~30 seconds (agent) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @agenticapps/dashboard-agent test` (or the package the task touched)
- **After every plan wave:** Run `pnpm -r test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Req / Decision | Behavior | Test Type | Automated Command | File (Wave 0 if ❌) | Status |
|----------------|----------|-----------|-------------------|---------------------|--------|
| SENTRY-01 | Returns top-5 unresolved issues when `SENTRY_AUTH_TOKEN` set | unit (mock fetch) | `pnpm --filter @agenticapps/dashboard-agent test` | ❌ `src/routes/sentry.test.ts` | ⬜ pending |
| SENTRY-02 | 60s cache hit skips fetch; stale last-good fallback on failure | unit | same | ❌ `src/routes/sentry.test.ts` | ⬜ pending |
| SENTRY-03 | 404 "not configured" body when `SENTRY_AUTH_TOKEN` unset | unit | same | ❌ `src/routes/sentry.test.ts` | ⬜ pending |
| LINEAR-01 | Returns title/status/assignee when `LINEAR_API_KEY` set | unit (mock fetch) | same | ❌ `src/routes/linear.test.ts` | ⬜ pending |
| LINEAR-02 | Issue IDs detected from branch name + git log (deduped, capped) | unit | same | ❌ `src/routes/linear.test.ts` | ⬜ pending |
| LINEAR-03 | 404 "not configured" body when `LINEAR_API_KEY` unset | unit | same | ❌ `src/routes/linear.test.ts` | ⬜ pending |
| INFI-01 / D-08-12 | `process.env` var wins; env.json only fills unset keys | unit | same | ❌ `src/lib/envFile.test.ts` | ⬜ pending |
| INFI-02 | `env set` writes env.json at mode `0600` | unit | same | ❌ `src/lib/envFile.test.ts` | ⬜ pending |
| INFI-03 | IntegrationsHealth shows read-only scope from `.infisical.json` | unit | same | ✅ extends `projectMetadataScan.test.ts` | ⬜ pending |
| INV-04 | New wire shapes validate against shared Zod schema (both ends) | unit | `pnpm --filter @agenticapps/dashboard-shared test` | ❌ `src/schemas/sentry.test.ts`, `src/schemas/linear.test.ts` | ⬜ pending |
| INV-05 | Token never appears in any SPA-facing JSON response | unit (assert no token in outbound) | `pnpm --filter @agenticapps/dashboard-agent test` | ❌ in `src/routes/sentry.test.ts` | ⬜ pending |
| D-08-08 | ~5s AbortController timeout; no retry; falls through on failure | unit | same | ❌ `src/lib/outboundFetch.test.ts` | ⬜ pending |
| D-08-09 | Last-good value served beyond TTL when upstream fails | unit | same | ❌ `src/lib/outboundFetch.test.ts` | ⬜ pending |
| D-08-11 | Error categories: abort/network→`unreachable`, 401/403→`unauthorized`, 429 (Sentry) / 400+RATELIMITED (Linear)→`rate-limited` | unit | same | ❌ `src/lib/outboundFetch.test.ts` | ⬜ pending |
| SENTRY-03 / LINEAR-03 (SPA) | Empty-state "Configure to enable" copy renders with no token | component (vitest + RTL) | `pnpm --filter @agenticapps/dashboard-spa test` | 🔵 Plan 08-06 TDD (RED-before-GREEN in-task) | ⬜ pending |
| INV-04 (SPA) | Both panels parse daemon payloads against shared schema; surface InlineDrift on mismatch | component (vitest + RTL) | `pnpm --filter @agenticapps/dashboard-spa test` | 🔵 Plan 08-06 TDD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/agent/src/routes/sentry.test.ts` — SENTRY-01..03, INV-05
- [ ] `packages/agent/src/routes/linear.test.ts` — LINEAR-01..03
- [ ] `packages/agent/src/lib/envFile.test.ts` — INFI-01, INFI-02, D-08-12
- [ ] `packages/agent/src/lib/outboundFetch.test.ts` — D-08-08, D-08-09, D-08-11
- [ ] `packages/shared/src/schemas/sentry.test.ts` — INV-04 (Sentry schema)
- [ ] `packages/shared/src/schemas/linear.test.ts` — INV-04 (Linear schema)

**Not Wave 0 — owned by Plan 08-06 (TDD, RED-before-GREEN in-task):** the SPA panel component tests (`SentryPanel.test.tsx`, `LinearPanel.test.tsx`) covering empty-state / cached-fallback / data render / schema-drift are authored test-first inside Plan 08-06's `tdd="true"` tasks, not as separate Wave 0 stubs. The agent/shared-side files above are the genuine pre-implementation Wave 0 set.

*Existing infrastructure (vitest) covers the framework; only new test files are missing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live Sentry data renders for a real token + project | SENTRY-01 | Needs a real `SENTRY_AUTH_TOKEN` + a project with issues; A1/A5 (org slug + `?project=` filter) confirmed only against live API | Set `SENTRY_AUTH_TOKEN`, register a Sentry-configured project, open its panel, confirm top-5 issues + working link-out |
| Live Linear data renders for a real key + issue | LINEAR-01 | Needs a real `LINEAR_API_KEY`; A3 (human-identifier `issue(id:)`) confirmed only against live API | Set `LINEAR_API_KEY`, open a project whose branch/commits reference an issue, confirm title/status/assignee |
| `infisical run` makes daemon Infisical-aware with no code change | INFI-01 | Requires Infisical CLI + a real vault | Run daemon under `infisical run -- agentic-dashboard start`; confirm injected env vars are honored |
| 08-IMPECCABLE.md composite ≥ 80 on the two new panels | CLAUDE.md UI constraint | Skill-driven visual critique at 1440×900 | Run `impeccable:critique` against the single-project view with both panels visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
