---
phase: 08-optional-integration-panels
verified: 2026-06-11T14:48:00Z
status: passed
status_updated: 2026-06-11T18:40:00Z
status_note: "All blocking gaps closed — see 'Phase-Close Update (2026-06-11)' at the end. Typecheck gap fixed (64922db); IMPECCABLE gate done (composite 78, WAIVED structural-debt — see 08-IMPECCABLE.md); the live IMPECCABLE gate caught + fixed an INV-03 contract regression (e820efa/4fcefa9/c2274f0). Remaining items are manual-only live-API checks (real tokens)."
score: 15/15 must-haves verified (post-fix)
overrides_applied: 0
gaps_resolved:
  - truth: "All new daemon artifacts pass typecheck (tsc --noEmit) with zero errors"
    status: resolved
    reason: "WR-05 test mocks missing 'version: 1' caused TS2352 — fixed in commit 64922db; `pnpm -r typecheck` clean as of 2026-06-11."
human_verification:
  - test: "Live Sentry panel with real SENTRY_AUTH_TOKEN"
    expected: "Top-5 unresolved issues render, each with a working permalink link-out"
    why_human: "Needs a real SENTRY_AUTH_TOKEN pointing at a project with issues; slug auto-resolution (tier-2 /api/0/projects/) can only be confirmed against the live Sentry API"
  - test: "Live Linear panel with real LINEAR_API_KEY"
    expected: "Issues detected from current branch / recent commits appear with title/status/assignee and working link-outs"
    why_human: "Needs a real LINEAR_API_KEY and a branch/commit referencing a live Linear issue; raw-key auth (no Bearer) confirmed only against live API"
  - test: "infisical run confirms INFI-01 (process.env-wins)"
    expected: "Running daemon under `infisical run -- agentic-dashboard start` injects secrets; env.json values are not overwritten"
    why_human: "Requires Infisical CLI + a real vault"
  - test: "08-IMPECCABLE.md composite score >= 80 for SentryPanel + LinearPanel"
    expected: "Run impeccable:critique against the single-project view at 1440x900; composite >= 80"
    status: done
    result: "DONE 2026-06-11 — composite 78 (Nielsen 29 pre-lift / 26 post-lift; deterministic scan clean). WAIVED under the per-phase structural-debt clause (D-10.5-03.calibration-2): ceiling is the ratified dual-surface integration design (D-08-03/06, locked by D-08-06), 78 within the 74/76/78 band. See 08-IMPECCABLE.md. The live gate caught the INV-03 not_configured→unreachable regression, fixed before sign-off."
---

# Phase 8: Optional Integration Panels — Verification Report

**Phase Goal:** Add read-only Sentry, Linear, and Infisical panels that surface live data when their env vars are configured and show graceful "configure to enable" empty states when they are not — without making the dashboard depend on any of them.

**Verified:** 2026-06-11T14:48:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Success Criteria from ROADMAP.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | With zero integration env vars set, all three panels render "configure to enable" copy and dashboard remains fully functional | VERIFIED | `SentryPanel.tsx:88-98` + `LinearPanel.tsx:87-97` — static JSX literals; `projects-detail-e2e.test.tsx` passes with empty fixture responses; 1252 SPA tests green |
| SC-2 | With tokens set, Sentry and Linear panels show live data; Infisical status reflects `.infisical.json` presence | VERIFIED (automated half) | Routes live in `app.ts:194-195`; integrations.ts INFI-03 scope spread at lines 99-104; SENTRY-01/02 + LINEAR-01 unit tests pass; live-token check routed to human_verification |
| SC-3 | API failures show "unreachable — using cached data from {time}" rather than crashing | VERIFIED | `SentryPanel.tsx:104-107`; `LinearPanel.tsx:103-106` verbatim stale banners; S-05 + WR-02 tests cover stale fallback; last-good sub-entry in `CacheEntry<T>` at `outboundFetch.ts:29-31` |
| SC-4 | No native dependencies added to packages/agent/; secrets handling honors 0600 constraint | VERIFIED | `packages/agent/package.json` unchanged (no new deps); `envFile.ts:75` uses `atomicWriteFile(..., 0o600)`; `envFile.ts:45` calls `assertSecurePermissions` |
| SC-5 | All new daemon-SPA wire shapes validate against shared Zod schemas (single source of truth, INV-04) | VERIFIED | `sentry.ts` + `linear.ts` in `packages/shared/src/schemas/`; re-exported from `index.ts:130-145`; `projectQueries.ts:297-301` and `316-321` parse against schemas; 376 shared tests green |

**Score: 5/5 roadmap success criteria verified**

---

### Requirement Coverage

| Requirement | Plan | Status | File:Line Evidence |
|-------------|------|--------|---------------------|
| SENTRY-01 | 08-03, 08-06 | VERIFIED | `sentry.ts:388-403` (issue mapper); `SentryPanel.tsx:109-142` (issue list render); S-03 test |
| SENTRY-02 | 08-03, 08-06 | VERIFIED | `sentry.ts:58-62` (TTL_MS=60_000); `outboundFetch.ts:26-31` (lastGood); `SentryPanel.tsx:104-107` (stale banner); S-04/S-05 tests |
| SENTRY-03 | 08-03, 08-06 | VERIFIED | `sentry.ts` env-gate check (SENTRY_AUTH_TOKEN unset → 404 not_configured); S-01 test; `SentryPanel.tsx:88-98` static configure copy |
| LINEAR-01 | 08-05, 08-06 | VERIFIED | `linear.ts:152-203` (fetchLinearIssue); `LinearPanel.tsx:108-137`; L-03 test |
| LINEAR-02 | 08-05, 08-06 | VERIFIED | `linear.ts:88-126` (detectIssueIds branch+log, dedup, cap 3); D-01..D-06 tests; `IntegrationsHealth.tsx` has 0 references to useLinearIssues/linear/issues (grep confirms) |
| LINEAR-03 | 08-05, 08-06 | VERIFIED | `linear.ts:213-219` (env-gate → 404 not_configured); L-01 test; `LinearPanel.tsx:87-97` static configure copy |
| INFI-01 | 08-02, 08-04 | VERIFIED | `envFile.ts:51` (`!(key in process.env)` guard, D-08-12); envFile E-02 test |
| INFI-02 | 08-02, 08-04 | VERIFIED | `envFile.ts:72-76` (writeEnvFile — EnvFileSchema.parse + atomicWriteFile at 0o600); envCmd.ts E-02 mode test |
| INFI-03 | 08-01, 08-04 | VERIFIED | `integrations.ts:99-104` (conditional spread of infisicalWorkspaceId + infisicalEnvironment); `integrations.ts` IntegrationsResponseSchema extended in `shared/schemas/integrations.ts:26-28`; I11/I12/I13 tests |
| INV-04 (shared schema SoT) | 08-01 | VERIFIED | `packages/shared/src/schemas/sentry.ts` + `linear.ts` + `env.ts` + extended `integrations.ts`; re-exported from `index.ts`; `daemon.ts` subpath for env schema; 376 shared tests green |
| INV-05 (token never serialized) | 08-03, 08-05 | VERIFIED | `sentry.ts` agentError logs only `status`+`category`; S-07 test: `expect(text).not.toContain(SECRET_TOKEN)` across 3 code paths; `linear.ts` line 286-287 agentError same pattern; L-10 test same assertion |
| INV-01 (read-only FS) | 08-03, 08-05 | VERIFIED | Neither sentry.ts nor linear.ts writes to project filesystem; both only read registry via `readRegistry()` |
| INV-02 (no native deps) | 08-02 | VERIFIED | `outboundFetch.ts:51-63` uses `fetch` + `AbortController` as Node 22 globals; no new import; `packages/agent/package.json` unchanged |
| INV-03 (optional stays optional) | 08-06 | VERIFIED | SPA panels render static configure copy when env unset; E2E test uses empty-issues fixtures; dashboard fully functional |
| D-08-08 (5s timeout, no retry) | 08-02 | VERIFIED | `outboundFetch.ts:54-63` AbortController+clearTimeout-in-finally; test asserts fetch called exactly once |
| D-08-09 (last-good survives TTL) | 08-02, 08-03, 08-05 | VERIFIED | `CacheEntry<T>.lastGood` at `outboundFetch.ts:29-31`; `sentry.ts:405-410` (newEntry.lastGood populated); S-05 test uses Date.now() mock to confirm last-good serves after TTL expiry |
| D-08-11 (error classification) | 08-02 | VERIFIED | `outboundFetch.ts:101-116` covers AbortError, TypeError, 401/403, 429, Linear-400-RATELIMITED; outboundFetch tests confirm all 9 mapping rows |
| D-08-12 (process.env wins) | 08-02, 08-04 | VERIFIED | `envFile.ts:51` |
| D-08-13 (allow-list) | 08-01, 08-02 | VERIFIED | `env.ts:12-14` AllowedEnvKeySchema; `envCmd.ts:39` safeParse; env.test.ts confirms AWS_SECRET rejected |
| D-08-14 (redacted output) | 08-04 | VERIFIED | `envCmd.ts:138` (`value.length > 8 ? value.slice(-4) : ''`); WR-04 fix confirmed at line 138; test E-04 asserts `!output.includes(fullValue)` |
| D-08-15 (corrupt env never blocks start) | 08-04 | VERIFIED | `start.ts:51-58` try/catch around loadEnvFile; agentError logs and continues |
| WR-05 (cache eviction on unregister) | 08-REVIEW-FIX | VERIFIED | `register.ts:7-9` imports; `register.ts:121-123` eviction calls after successful removal |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/schemas/sentry.ts` | SentryIssueSchema + SentryRecentResponseSchema + HttpUrl refine | VERIFIED | CR-01 HttpUrl present at line 8-11; permalink uses HttpUrl at line 25 |
| `packages/shared/src/schemas/linear.ts` | LinearIssueSchema + LinearIssuesResponseSchema + HttpUrl refine | VERIFIED | CR-01 HttpUrl present at line 8-11; url uses HttpUrl at line 22 |
| `packages/shared/src/schemas/env.ts` | ALLOWED_ENV_KEYS + AllowedEnvKeySchema + EnvFileSchema | VERIFIED | All present; daemon-only via daemon.ts subpath |
| `packages/shared/src/schemas/integrations.ts` | INFI-03 optional scope fields | VERIFIED | infisicalWorkspaceId + infisicalEnvironment at lines 26-28 |
| `packages/shared/src/daemon.ts` | daemon-only barrel for env schemas | VERIFIED | Exports ALLOWED_ENV_KEYS, AllowedEnvKeySchema, EnvFileSchema |
| `packages/agent/src/lib/outboundFetch.ts` | fetchWithTimeout, classifyError, CacheEntry | VERIFIED | All exported; substantive implementation |
| `packages/agent/src/lib/envFile.ts` | loadEnvFile, writeEnvFile, readEnvFile (0600) | VERIFIED | All exported; reuses auth.ts primitives |
| `packages/agent/src/constants.ts` | ENV_FILE constant | VERIFIED | Line 11: `export const ENV_FILE = join(CONFIG_DIR, 'env.json')` |
| `packages/agent/src/routes/sentry.ts` | sentryRoute + evictSentryCacheProject | VERIFIED | Route exported; WR-01/WR-03 fixes applied |
| `packages/agent/src/routes/linear.ts` | linearRoute + evictLinearCacheProject | VERIFIED | Route exported; WR-02 fix applied |
| `packages/agent/src/cli/envCmd.ts` | runEnvSet, runEnvUnset, runEnvList | VERIFIED | All exported; WR-04 fix applied |
| `packages/spa/src/lib/projectQueries.ts` | useSentryRecent + useLinearIssues | VERIFIED | Lines 293-327 |
| `packages/spa/src/components/panels/SentryPanel.tsx` | 4-state panel + CR-01 render guard | VERIFIED | CR-01 guard at lines 122-138 |
| `packages/spa/src/components/panels/LinearPanel.tsx` | 4-state panel + CR-01 render guard | VERIFIED | CR-01 guard at lines 115-132 |
| `packages/spa/src/components/SingleProjectView.tsx` | SentryPanel + LinearPanel in Health column | VERIFIED | Lines 78-80 |
| **08-IMPECCABLE.md (composite >= 80)** | **Required by CLAUDE.md for every frontend-touching phase** | **MISSING** | **File does not exist in .planning/phases/DASH-08-optional-integration-panels/. Must be produced by running impeccable:critique against the single-project view with both panels visible at 1440x900.** |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `packages/shared/src/index.ts` | `schemas/sentry.ts` | named re-export | VERIFIED | Lines 130-137 |
| `packages/shared/src/index.ts` | `schemas/linear.ts` | named re-export | VERIFIED | Lines 138-145 |
| `packages/shared/src/index.ts` | `schemas/env.ts` | NOT re-exported | VERIFIED | Comment at line 129 confirms intentional absence; daemon-only via daemon.ts |
| `packages/agent/src/lib/envFile.ts` | `lib/auth.ts` | assertSecurePermissions + ensureConfigDir | VERIFIED | `envFile.ts:23` imports both |
| `packages/agent/src/lib/envFile.ts` | `lib/atomicWrite.ts` | atomicWriteFile at 0o600 | VERIFIED | `envFile.ts:75` |
| `packages/agent/src/cli/start.ts` | `lib/envFile.ts` | loadEnvFile at boot under try/catch | VERIFIED | `start.ts:15` import; `start.ts:51-58` call |
| `packages/agent/src/cli.ts` | `cli/envCmd.ts` | commander 'env' + set/list/unset | VERIFIED | `cli.ts:103-126` |
| `packages/agent/src/server/app.ts` | `routes/sentry.ts` | app.route after bearerAuth | VERIFIED | `app.ts:194` — after bearerAuth block at lines 163-174 |
| `packages/agent/src/server/app.ts` | `routes/linear.ts` | app.route after bearerAuth | VERIFIED | `app.ts:195` — after bearerAuth block |
| `packages/spa/src/lib/projectQueries.ts` | `/api/projects/{id}/sentry/recent` | apiFetch + SentryRecentResponseSchema | VERIFIED | `projectQueries.ts:297-301` |
| `packages/spa/src/lib/projectQueries.ts` | `/api/projects/{id}/linear/issues` | apiFetch + LinearIssuesResponseSchema | VERIFIED | `projectQueries.ts:316-321` |
| `packages/spa/src/components/SingleProjectView.tsx` | `SentryPanel` + `LinearPanel` | rendered in Health column | VERIFIED | Lines 78-80 |
| `packages/agent/src/cli/register.ts` | evictSentryCache + evictLinearCache + evictIntegrationsCache | on runUnregister | VERIFIED | `register.ts:7-9` imports; `register.ts:121-123` calls (WR-05 fix) |
| `IntegrationsHealth.tsx` (Phase 5) | NOT using useLinearIssues or /linear/issues | API-free constraint | VERIFIED | `grep -c` returns 0 (LINEAR-02 clause b / D-08-06) |

---

### Hard Architectural Constraints (CLAUDE.md)

| Constraint | Status | Evidence |
|-----------|--------|----------|
| Read-only on project FS | VERIFIED | Neither sentry.ts nor linear.ts writes to project root; only registry reads via readRegistry() |
| Path allow-list + 0600 + symlink-reject | VERIFIED | envFile.ts reuses assertSecurePermissions (lstat symlink reject) + atomicWriteFile 0600 |
| No native deps in packages/agent/ | VERIFIED | fetch + AbortController are Node 22 built-ins; package.json unchanged |
| Bearer-token auth on every route | VERIFIED | sentry/linear routes mounted at app.ts:194-195, after bearerAuth middleware at lines 163-174 |
| Token never serialized (INV-05) | VERIFIED | classifyError collapses to 3 categories; agentError logs status+category only; S-07 + L-10 tests assert token string never in response body |
| Optional integrations return 404 not_configured when env unset | VERIFIED | sentry.ts and linear.ts env-gate returns 404 not_configured |
| SPA holds no user data | VERIFIED | No local storage, no SPA-side data persistence; panels purely query daemon |
| env.json at 0600; daemon writes confined to ~/.agenticapps/dashboard/ | VERIFIED | writeEnvFile uses atomicWriteFile at 0o600; ensureConfigDir(dirname(ENV_FILE)) |
| Daemon writes confined to CONFIG_DIR | VERIFIED | ENV_FILE = join(CONFIG_DIR, 'env.json'); CONFIG_DIR = ~/.agenticapps/dashboard/ |

---

### CR-01 Fix Verification (XSS-class URL injection)

**Finding:** Code review identified that `z.string().url()` accepts `javascript:` and `data:` schemes, making Sentry permalink and Linear url fields potential XSS vectors on click.

**Fix applied (commit 549774a):**

1. `packages/shared/src/schemas/sentry.ts:8-11` — `HttpUrl` refine `(u) => /^https?:\/\//i.test(u)` constrains permalink to http(s) only
2. `packages/shared/src/schemas/linear.ts:8-11` — identical HttpUrl refine on url field
3. `SentryPanel.tsx:122-138` — defense-in-depth render guard: `if (/^https?:/i.test(issue.permalink)) <a href> else <span>`
4. `LinearPanel.tsx:115-132` — identical guard on issue.url
5. Schema tests in sentry.test.ts and linear.test.ts assert `javascript:` and `data:` schemes fail parse (schema-drift)
6. Panel tests assert bypassed-schema scenario renders no live link

**Status: VERIFIED** — both schema-level and render-time guards confirmed in source code.

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `SentryPanel.tsx` | `query.data` (useSentryRecent) | `GET /api/projects/{id}/sentry/recent` → daemon → Sentry API | Yes (when SENTRY_AUTH_TOKEN set); static copy when unset | FLOWING (automated) / HUMAN for live token |
| `LinearPanel.tsx` | `query.data` (useLinearIssues) | `GET /api/projects/{id}/linear/issues` → daemon → Linear GraphQL | Yes (when LINEAR_API_KEY set); static copy when unset | FLOWING (automated) / HUMAN for live key |
| `integrations.ts` route | `infisicalWorkspaceId` | `parseInfisicalConfig(root)` → .infisical.json filesystem read | Yes (when file present) | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Shared tests pass (schemas valid) | `pnpm --filter @agenticapps/dashboard-shared test` | 376 tests, 25 files — all pass | PASS |
| Agent tests pass (routes + libs) | `pnpm --filter @agenticapps/dashboard-agent test` | 1205 passed, 1 skipped (pre-existing) — 111 files | PASS |
| SPA tests pass (panels + hooks) | `pnpm --filter @agenticapps/dashboard-spa test` | 1252 tests, 127 files — all pass | PASS |
| Lint 0 errors | `pnpm lint` | 0 errors, 239 warnings (all pre-existing) | PASS |
| Full workspace typecheck | `pnpm -r typecheck` | **FAIL — 2 TS2352 errors in packages/agent/src/cli/cliLockTimeout.test.ts lines 150-161 and 178** | **FAIL** |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/agent/src/cli/cliLockTimeout.test.ts` | 150-161 | Mock object cast `as ReturnType<typeof readRegistry>` missing `version: 1` field — TS2352 compile error | BLOCKER | Breaks `pnpm -r typecheck`; CLAUDE.md and per-plan success criteria both require clean typecheck |
| `packages/agent/src/cli/cliLockTimeout.test.ts` | 178 | `{ projects: [] } as ReturnType<typeof readRegistry>` missing `version: 1` — second TS2352 | BLOCKER | Same impact |

No `TBD`, `FIXME`, or `XXX` debt markers found in Phase 8 files.

---

### Gaps Summary

One gap blocks phase sign-off:

**TypeCheck failure in WR-05 test code** (`cliLockTimeout.test.ts` lines 150-161 and 178): The mock objects passed to `vi.mocked(readRegistry).mockReturnValue(...)` are missing the `version: 1` field required by `RegistryFile`. TypeScript's `tsc --noEmit` reports TS2352. Tests pass at runtime (vitest does not type-check mock arguments by default), but the workspace-level typecheck gate fails. The fix is minimal: add `version: 1 as const` to both mock objects.

---

### Outstanding Before Phase Close

1. **BLOCKER — typecheck failure in cliLockTimeout.test.ts**: Fix the two mock objects in the WR-05 test block (missing `version: 1 as const`). One-line fix per mock.

2. **MUST-CLOSE GATE — 08-IMPECCABLE.md missing**: CLAUDE.md mandates an `<N>-IMPECCABLE.md` artifact for every frontend-touching phase, with composite score >= 80. This file does not exist. SentryPanel and LinearPanel are new frontend surfaces that have not been through `impeccable:critique` at 1440x900. This must be completed and the artifact committed before the phase can be marked closed. If the composite is below 80, per-phase structural-debt waiver clause applies (with documented findings).

3. **HUMAN — Live API verification**: Real Sentry + Linear tokens needed to confirm slug auto-resolution and raw-key GraphQL auth against live APIs (items in human_verification frontmatter).

---

### Human Verification Required

#### 1. Live Sentry Panel (SENTRY-01 live)

**Test:** Set `SENTRY_AUTH_TOKEN` in env.json (`agentic-dashboard env set SENTRY_AUTH_TOKEN <token>`), start the daemon, open a project with Sentry configured, view the Sentry panel.
**Expected:** Up to 5 recent unresolved issues render; each has a working link-out to the Sentry permalink; stale banner absent on first load.
**Why human:** Needs a real Sentry auth token + a project with issues. Tier-2 slug resolution (GET /api/0/projects/ list-and-match) and the ?project= numeric filter can only be validated against the live Sentry API.

#### 2. Live Linear Panel (LINEAR-01 live)

**Test:** Set `LINEAR_API_KEY` (`agentic-dashboard env set LINEAR_API_KEY <key>`), start the daemon, open a project whose current branch or recent commits reference a Linear issue identifier (e.g. `ACME-123`).
**Expected:** Detected issue(s) render with title/stateName/assigneeName; identifier is the link text; link-out goes to the correct Linear URL; raw-key auth (no "Bearer " prefix) confirmed.
**Why human:** Needs a real Linear API key and a live Linear issue.

#### 3. Infisical INFI-01 live

**Test:** Run daemon under `infisical run -- agentic-dashboard start`. Confirm that `SENTRY_AUTH_TOKEN` injected by Infisical is honored and env.json does not overwrite it.
**Expected:** process.env-wins merge: token from `infisical run` is used; env.json value for the same key is ignored.
**Why human:** Requires Infisical CLI + a real secrets vault.

#### 4. 08-IMPECCABLE.md (must-close gate)

**Test:** Run `impeccable:critique` against the single-project view with both SentryPanel and LinearPanel visible, at 1440x900.
**Expected:** Composite score >= 80. Record findings + per-heuristic scores in `08-IMPECCABLE.md` committed to `.planning/phases/DASH-08-optional-integration-panels/`.
**Why human:** Skill-driven visual critique is not automatable. This is a mandatory CLAUDE.md gate — the artifact does not exist yet.

---

## Phase-Close Update (2026-06-11, post-verification)

The two gates this report flagged as outstanding are now closed; one of them surfaced a real
spec-violating regression that the static/mocked tests had missed.

### IMPECCABLE gate — DONE (composite 78, WAIVED)

Ran `impeccable:critique` live at 1440×900 (light/warm-paper) against the single-project view with
both panels paired to a real daemon. Two isolated LLM design reviews + the deterministic detector:

- Deterministic scan (`npx impeccable --json` on both panels + host): **clean** (`[]`, exit 0).
- Both LLM assessments: **composite 78** (Nielsen 29 pre-lift / 26 post-lift), converging on the same
  ceiling — integration-status redundancy across `IntegrationsHealth` + the dedicated panels.
- **WAIVED at 78** under the per-phase structural-debt clause (D-10.5-03.calibration-2): the ceiling is
  the ratified dual-surface design (D-08-03/07 standalone panels; D-08-06 forbids touching
  `IntegrationsHealth`), and 78 is dead-center in the established 74/76/78 band. Full record + Nielsen
  table + persona red flags + deferred polish in **08-IMPECCABLE.md**.

### INV-03 / SC-1 — corrected (the gate caught a live regression)

The live critique found that with no `SENTRY_AUTH_TOKEN` / `LINEAR_API_KEY` set (the default for every
user today), both new panels rendered **"Agent unreachable — retrying…"** instead of the
configure-to-enable empty state. SC-1 and INV-03 had been marked VERIFIED on the strength of e2e
mocks that returned `200 {issues:[]}` while the **real daemon returns `404 not_configured`** — the
panel and daemon contracts were verified in isolation and never exercised together. **This means the
original SC-1/INV-03 "VERIFIED" rows above were a false pass at the time of writing.**

Fixed (TDD, 3 commits): `e820efa` maps the daemon `not_configured` (404) to a sentinel so the panels
render configure-to-enable on unset (and a genuine "No recent issues" on configured-but-empty);
`4fcefa9` adds the collapsed "— not configured" glance hint; `c2274f0` aligns the configure-copy type
scale. Post-fix: SC-1/INV-03 are now genuinely satisfied **live** (verified in-browser), SPA suite
1263 green, typecheck + lint clean.

### Typecheck gap — resolved

The TS2352 gap (WR-05 mocks missing `version: 1`) was fixed in commit `64922db`; `pnpm -r typecheck`
is clean.

### Remaining (manual-only, non-blocking)

Live-API checks with real `SENTRY_AUTH_TOKEN` / `LINEAR_API_KEY` / Infisical vault (human_verification
items 1–3) — the env-gated and empty/configure/stale/unreachable paths are fully covered without
tokens; only the happy-path live data render requires real credentials.

---

_Verified: 2026-06-11T14:48:00Z_
_Verifier: Claude (gsd-verifier)_
_Phase-close update: 2026-06-11 — IMPECCABLE gate closed (waived 78) + INV-03 live regression fixed._
