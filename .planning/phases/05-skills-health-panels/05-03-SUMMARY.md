---
phase: 05-skills-health-panels
plan: 03
subsystem: daemon-metadata-integrations
tags: [daemon, hono, path-safety, observability, secrets, integrations, tdd, wave-1]
dependency_graph:
  requires:
    - 05-01 (ObservabilityResponseSchema, SecretsResponseSchema, IntegrationsResponseSchema)
    - 05-02 (app.ts pattern — route mounting alongside existing routes)
  provides:
    - resolveAllowedNamed (D-5-13 name-restricted path allow-list variant)
    - computeIntegrationState (3-state truth table)
    - projectMetadataScan (9 scanner functions)
    - GET /api/projects/:id/observability
    - GET /api/projects/:id/secrets
    - GET /api/projects/:id/integrations
  affects:
    - plan 05-05 (SPA ObservabilityHealth, SecretsHealth, IntegrationsHealth panels call these routes)
    - app.ts (3 new route mounts added alongside 05-02's routes)
tech_stack:
  added: []
  patterns:
    - resolveAllowedNamed: roots[] + allowedNames XOR extension — name-restricted realpath defence
    - execa argv array 'which sentry-cli' with 5s timeout (no shell expansion)
    - DSN presence detection via substring match only — never value extraction
    - 5s per-projectId in-memory memo cache (same pattern as phases 3/4)
    - importOriginal in vi.mock for partial mocks preserving named exports
key_files:
  created:
    - packages/agent/src/lib/paths.ts (extended — resolveAllowedNamed appended)
    - packages/agent/src/lib/paths.test.ts (extended — 8 new resolveAllowedNamed tests)
    - packages/agent/src/lib/integrationsState.ts
    - packages/agent/src/lib/integrationsState.test.ts
    - packages/agent/src/lib/projectMetadataScan.ts
    - packages/agent/src/lib/projectMetadataScan.test.ts
    - packages/agent/src/routes/observability.ts
    - packages/agent/src/routes/observability.test.ts
    - packages/agent/src/routes/secrets.ts
    - packages/agent/src/routes/secrets.test.ts
    - packages/agent/src/routes/integrations.ts
    - packages/agent/src/routes/integrations.test.ts
  modified:
    - packages/agent/src/server/app.ts
decisions:
  - "resolveAllowedNamed: allowedNames and extension are mutually exclusive — providing both throws PathViolation (implementation choice locked by test)"
  - "detectSentryDsnEnv evidence string: '<filename>:<lineno>' only — never the matched line value (privacy invariant T-5-NoSecretRead)"
  - "parseSentryClirc: existence-only detection, no INI parsing (RESEARCH §Don't Hand-Roll)"
  - "parseCiWorkflowsForSentry: one signal per file (break after first sentry-cli line match)"
  - "Linear branch detection via runAllowedGit('branch') — reuses existing git allow-list; git failure treated as signalDetected=false (graceful fallback)"
  - "integrations.ts vi.mock('../lib/git.js') uses importOriginal to preserve GitNotAllowedError export (needed by errorHandler)"
  - "SPA timing flake in MultiProjectHome.test.tsx (< 50ms bound) is pre-existing and fails only under pnpm -r test parallel load; passes in isolation"
metrics:
  duration: "~80 minutes"
  completed: "2026-05-07"
  tasks: 3
  files_created: 12
  files_modified: 1
  tests_added: 78
---

# Phase 05 Plan 03: Metadata + Integrations Daemon Routes Summary

**One-liner:** `resolveAllowedNamed` path allow-list extension + 9 metadata scanners + `computeIntegrationState` truth table + 3 Hono routes (observability/secrets/integrations) with privacy invariants verified.

---

## What Was Built

### Task 1: `resolveAllowedNamed` + `computeIntegrationState` (TDD — 12 tests)

**`packages/agent/src/lib/paths.ts` extension (appended, existing code untouched):**

`resolveAllowedNamed(candidatePath, { roots[], allowedNames? | extension? })`:
- Realpaths the candidate; throws `PathViolation` if not accessible
- Realpaths each root; throws if realpath escapes all roots
- With `allowedNames`: rejects if `basename(real)` not in the list
- With `extension`: rejects if `basename(real)` doesn't end with it
- Both provided simultaneously → throws `PathViolation` (mutually exclusive)
- `ALLOWED_SUBDIRS` and `resolveAllowed` are **unchanged** — D-23 /read allow-list locked

8 test cases cover: accept-valid, root-escape, symlink-escape, allowedNames-reject, allowedNames-accept, extension-accept, extension-reject, mutually-exclusive-throws.

**`packages/agent/src/lib/integrationsState.ts`:**

```
computeIntegrationState({ envVarPresent, signalDetected }) → IntegrationState
  true  + any  → 'configured'
  false + true → 'present-but-not-configured'
  false + false → 'not-detected'
```

4 tests prove the full truth table.

### Task 2: `projectMetadataScan.ts` (TDD — 29 tests)

| Function | Signal / Behavior | Tests |
|----------|-------------------|-------|
| `parsePackageJsonForSentry` | `@sentry/*` deps → `sentry-sdk-dep`; script substring → `sentry-cli-script` | 5 |
| `parsePackageJsonForSpotlight` | `@spotlightjs/*` family (both packages) → `spotlight-dep` | 3 |
| `parsePackageJsonForSentryCli` | `@sentry/cli` dep + script substring | 2 |
| `parseSentryClirc` | Existence-only via `resolveAllowedNamed`; no content | 2 |
| `detectSpotlightDir` | `.spotlight/` directory presence (not file) | 3 |
| `detectSentryDsnEnv` | `SENTRY_DSN` substring match; evidence = `file:line` only | 3 |
| `detectSentryCliBinary` | execa mock: exit-0 → signal, non-zero → [], spawn error → [] | 3 |
| `parseCiWorkflowsForSentry` | `.github/workflows/*.yml` grep; wrong dir / wrong ext rejected | 4 |
| `parseInfisicalConfig` | absent / present-valid / present-invalid (missing key) / malformed JSON | 4 |

All 29 tests green. 12 `resolveAllowedNamed` call sites in the implementation.

### Task 3: 3 Daemon Routes + app.ts (TDD — 25 tests)

| Route | Mount | Tests |
|-------|-------|-------|
| `GET /api/projects/:id/observability` | `app.route('/api/projects', observabilityRoute)` | 6 |
| `GET /api/projects/:id/secrets` | `app.route('/api/projects', secretsRoute)` | 7 |
| `GET /api/projects/:id/integrations` | `app.route('/api/projects', integrationsRoute)` | 12 |

All 3 routes inherit bearer-auth + CORS from app.ts middleware — zero new auth code.

**app.ts file ownership:** Plan 02 and Plan 03 both modify `app.ts`. This plan ran sequentially after 02 on the same branch; the 3 new route imports + mounts were appended after plan 02's `agentlinterRoute` lines (simple additive merge, no conflict).

---

## Argv Assertion Test — `which sentry-cli`

`detectSentryCliBinary` calls:
```typescript
execa('which', ['sentry-cli'], { timeout: 5_000, reject: false, stdio: ['ignore', 'pipe', 'pipe'] })
```

Test mocks `execa` directly (no shell expansion). Argv form proven via:
- mock exit-0 → `sentry-cli-binary` signal with evidence = `stdout.trim()`
- mock exit-1 → `[]`
- mock throw (ENOENT) → `[]`

No shell interpretation possible — T-05-03-Subprocess-Inj mitigated.

---

## Privacy Invariant Proof — `detectSentryDsnEnv`

Test writes `.env` with `SENTRY_DSN=https://secret-123@io/1` and asserts:
1. Signal `sentry-dsn-env` IS emitted (detection works)
2. `signal.evidence` is `'.env:1'` (file:lineno format)
3. `signal.evidence` does NOT contain `'secret-123'` (DSN value never stored)
4. `signal.evidence` does NOT contain `'https://'`

T-05-03-NoSecretRead mitigated. The function matches the literal string `SENTRY_DSN` only — no value extraction, no regex capture groups, no line content stored.

---

## D-5-11 Invariant Proof — `/read` allow-list unchanged

```
grep ALLOWED_SUBDIRS packages/agent/src/lib/paths.ts
→ export const ALLOWED_SUBDIRS = ['.planning', '.claude'] as const
```

`resolveAllowedNamed` is a sibling function — it does not touch `ALLOWED_SUBDIRS` or `resolveAllowed`. The `/api/projects/:id/read` route continues to resolve only under `.planning` and `.claude`.

---

## 3-State Integration-State Truth-Table Coverage Matrix

| Test | envVarPresent | signalDetected | Expected State |
|------|--------------|----------------|----------------|
| I1 | false | false | `not-detected` |
| I2a (Sentry) | true | any | `configured` |
| I2b (Sentry) | false | true (.sentryclirc) | `present-but-not-configured` |
| I2c (Sentry) | false | false | `not-detected` |
| I3 (Infisical) | true (INFISICAL_TOKEN) | true (present-valid) | `configured` |
| I4 (Linear) | true (LINEAR_API_KEY) | true (ABC-123 branch) | `configured` |
| I5 (Linear) | false | false (main branch) | `not-detected` |

All 7 combinations proven by route-level integration tests (vi.stubEnv for env vars, vi.mock for runAllowedGit branch output).

---

## app.ts File Ownership Note

Plans 02 and 03 both modify `packages/agent/src/server/app.ts`. Both plans ran in Wave 1 sequentially on the same branch. The merge approach used was **(a) simple additive**: plan 03 ran after 02 was already committed; the 3 new import lines and 3 new `app.route(...)` lines were appended after plan 02's 2 lines. No merge conflict occurred.

---

## Linear Branch Detection

The Linear signal uses `runAllowedGit('branch', root)` which runs `git branch --show-current`. The regex `/[A-Z]{2,}-\d+/` matches the Linear ticket format anywhere in the branch name (e.g., `donald/ABC-123-fix-foo` matches). On `main`/`master`/`phase-05-xxx` branches the regex does not match → `signalDetected = false`. This is the expected empty-state behaviour: most dev branches don't carry a Linear ticket ID, so the default state is `not-detected` until either a matching branch is checked out OR `LINEAR_API_KEY` is set.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vi.mock partial mock missing GitNotAllowedError export**
- Found during: Task 3 (I6: 401 test failing with "No GitNotAllowedError export" error)
- Issue: `vi.mock('../lib/git.js', () => ({ runAllowedGit: vi.fn() }))` replaces the entire module, removing `GitNotAllowedError`. The errorHandler imports it directly, causing a vitest error when an unexpected error occurs.
- Fix: Changed to `vi.mock('../lib/git.js', async (importOriginal) => { const actual = await importOriginal(); return { ...actual, runAllowedGit: vi.fn() } })` to preserve all named exports while only mocking `runAllowedGit`.
- Files modified: `packages/agent/src/routes/integrations.test.ts`

**2. [Rule 3 - Blocking] SPA timing flake in pnpm -r test parallel run**
- Found during: full regression run
- Issue: `MultiProjectHome.test.tsx` test "UI render-tick: act() onSuccess → DOM card-visible delta < 50 ms" intermittently fails when run under `pnpm -r test` parallel load (jsdom render time spills above 50ms threshold)
- Status: pre-existing — test passes in isolation. Not introduced by plan 05-03 changes. Deferred to plan 05-03 notes; no fix applied (out of scope).

---

## Known Stubs

None — all 3 routes return fully computed values. No hardcoded empty arrays or placeholder values flowing to UI rendering.

---

## Threat Flags

None new beyond what the plan's threat model already covers. All T-05-03-* mitigations are implemented and verified:
- T-05-03-PathSafety: `resolveAllowedNamed` realpath check + 8 path tests
- T-05-03-NoSecretRead: privacy invariant test (evidence=file:line, no DSN value)
- T-05-03-NoCloudIO: 0 `fetch(http` calls in all 3 route files
- T-05-03-Symlink-Escape: symlink test plants `evil.yml → /etc/passwd`, asserts PathViolation
- T-05-03-CORS-Bypass: CORS reject tested per route
- T-05-03-Bearer-Bypass: 401 tested per route
- T-05-03-Schema-Drift: `outbound()` on every route response
- T-05-03-Subprocess-Timeout: 5s timeout in `detectSentryCliBinary`
- T-05-03-Subprocess-Inj: argv array `['which', 'sentry-cli']` (no shell)

---

## Self-Check: PASSED
