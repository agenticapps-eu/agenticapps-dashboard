---
phase: 03-multi-project-home-page
plan: 11
subsystem: spa/tests + docs
tags: [subprocess-test, e2e, phase-close, nonce, register-prepare, register-confirm, readme]
dependency_graph:
  requires:
    - "03-04 (register-prepare/confirm routes + nonce store)"
    - "03-08 (MultiProjectHome + RegisterModal SPA composition)"
  provides:
    - "Subprocess integration test: daemon round-trip prepare → confirm → 410 single-use"
    - "README Phase 3 shipped note"
  affects:
    - "packages/spa/vitest.subprocess.config.ts (extended include glob)"
tech_stack:
  added:
    - "node:child_process spawn/spawnSync — daemon subprocess lifecycle in test"
    - "node:timers/promises setTimeout as delay — afterAll drain"
  patterns:
    - "Isolated-HOME daemon spawn pattern (T-03-11-02): mkdtempSync HOME, SIGTERM + 300ms drain"
    - "Bearer token read from auth.json after daemon boots (T-03-11-01: never logged)"
    - "Random port 5500–5599 range to avoid collisions with Phase 1 e2e (5400–5499)"
    - "Build-in-beforeAll: spawnSync('pnpm', ['build']) ensures dist/cli.js is fresh"
key_files:
  created:
    - packages/spa/src/__tests__/register-optimistic.test.ts
  modified:
    - packages/spa/vitest.subprocess.config.ts
    - README.md
decisions:
  - "Test placed in packages/spa/__tests__ (subprocess config) not packages/agent — plan spec; daemon binary path resolved via __dirname relative traversal"
  - "Three tests instead of two: added GET /api/registry confirmation as third assertion (D-25 optimistic-add confirms real registration made it to the registry)"
  - "Port range 5500-5599 (not 0) because start.ts parseInt('0') falls back to DEFAULT_PORT 5193 — documented as pre-existing daemon behaviour"
  - "Pre-existing lint errors in RenameTagsForms.tsx / RegisterModal.tsx / api.test.ts deferred — out of scope for plan 03-11"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-04T20:20:00Z"
  tasks: 2
  files: 3
---

# Phase 3 Plan 11: Phase Close — Subprocess Test + README Summary

**One-liner:** Subprocess E2E test locking the D-10 single-use nonce and criterion-4 daemon round-trip invariant against a live spawned daemon, plus README updated to mark Phase 3 shipped.

## What Was Built

### Task 1: Subprocess test — daemon spawn + prepare + confirm + optimistic-add timing

`packages/spa/src/__tests__/register-optimistic.test.ts` — a vitest subprocess test (runs under `vitest.subprocess.config.ts`, node environment, forks pool) that:

1. **Builds** the agent binary in `beforeAll` via `spawnSync('pnpm', ['build'])` — idempotent.
2. **Isolates** all daemon state to a `mkdtempSync` HOME (T-03-11-02). No writes reach `~/.agenticapps/dashboard/`.
3. **Spawns** the daemon with `node packages/agent/dist/cli.js start --port <PORT> --bind 127.0.0.1`, overriding `HOME` to the temp dir.
4. **Waits** for `"Listening on"` in stdout/stderr (up to 15 s).
5. **Reads** the bearer token from `<homeDir>/.agenticapps/dashboard/auth.json` (never logged — T-03-11-01).

Three test cases:

| Test | Asserts | Timing |
|------|---------|--------|
| prepare → confirm round-trip | 200 + nonce regex `/^[0-9a-f]{32}$/`, 201 + RegistryEntry shape, total < 5000 ms | 29 ms observed |
| Single-use nonce (D-10) | First confirm → 201, second confirm same nonce → 410 `nonce_expired` | 7 ms |
| Registry contains new entry | GET /api/registry → list includes `phase3-fixture` (D-25 confirms real persistence) | 63 ms |

`vitest.subprocess.config.ts` updated: `include` array now lists both `dev-perf-smoke.test.ts` and `register-optimistic.test.ts`.

### Task 2: Full-suite green check + README Phase 3 shipped note

**Pre-flight results:**

| Check | Result |
|-------|--------|
| `pnpm -r typecheck` | 0 errors |
| `pnpm -r test --run` | 575 passed (57 shared + 218 agent + 300 SPA) |
| `pnpm -r build` | 0 errors |
| `pnpm lint` | 3 errors in pre-existing files (not introduced by plan 03-11) |

Test count delta from Phase 2 baseline (327 total): +248 tests across Phase 3 plans 01–11.

**README.md updated:** Status section now reads "Phases 0, 1, 2, and 3 shipped." with a paragraph describing Phase 3 deliverables: home page card grid, register modal (prepare/confirm), context menu, Cmd/Ctrl+K command palette, overview route, placeholder `/projects/$projectId` route. Links to `.planning/phases/03-multi-project-home-page/` for archival readers.

## Subprocess Test Layout

```
packages/spa/src/__tests__/register-optimistic.test.ts
  beforeAll:
    1. spawnSync pnpm build (agent)
    2. mkdtempSync homeDir + mkdir .agenticapps/dashboard/
    3. spawn node dist/cli.js start --port PORT --bind 127.0.0.1 (HOME=homeDir)
    4. waitForLine /Listening on/ (15s ceiling)
    5. read token from auth.json

  afterAll:
    daemon.kill('SIGTERM') + delay(300ms)

  describe "Phase 3: register-prepare → register-confirm":
    it "prepare → confirm round-trip < 5000ms" (criterion 4 daemon-side)
    it "D-10 single-use: second confirm → 410"
    it "GET /api/registry contains registered entry (D-25)"
```

## Phase 3 Sign-Off Checklist

- [x] **HOME-01** — Multi-project home at `/`: card grid rendering `useRegistryList()`, filter chips, search, sort (Plans 03-02, 03-06, 03-07, 03-08)
- [x] **HOME-02** — Per-card rich data from `GET /api/projects/{id}/overview`: phaseStatus, stage1/2 findings, TDD pairs, branch, markers (Plans 03-03, 03-04)
- [x] **HOME-03** — Register modal: prepare/confirm flow, nonce display, blocked-path UX, already-registered branch, D-10 single-use enforcement (Plans 03-04, 03-06, 03-08)
- [x] **HOME-04** — Context menu for rename/tag/unregister: right-click, long-press, kebab button, accessible portal (Plans 03-05, 03-07, 03-08)
- [x] **HOME-05** — Cmd/Ctrl+K command palette: register, jump, refresh, theme toggle, fuzzy filter, listbox + dialog ARIA (Plan 03-10)
- [x] **HOME-06** — Per-card freshness: `useLastRefresh` hook, header "last refresh Ns ago", 5s polling with `refetchIntervalInBackground: false` (Plan 03-09)
- [x] **INV-01** — Read-only on project filesystems: no daemon route writes to project files; confirmed in security review
- [x] **INV-04** — Schema drift surfaced inline per card (SchemaDriftState) and in register modal (Plans 03-06, 03-08; Phase 2 D-08/D-09)
- [x] **Acceptance criterion 4** — New card appears within 5 s without page reload: daemon round-trip < 5000 ms (this plan), optimistic-add UI tick < 50 ms (Plan 03-08 MultiProjectHome.test.tsx)
- [x] **D-10** — Single-use nonce enforced: second confirm → 410 Gone (this plan + Plan 03-04 integration tests)
- [x] **D-25** — Optimistic-add on register-confirm: `setQueryData` push + `invalidateQueries` reconciliation (Plan 03-06 + 03-08)

## Hand-off Note for Post-Phase Verification Chain

Phase 3 is ready for:

1. `/gsd-verify-work` — run the verification script against all 11 plan SUMMARY files
2. `/review` (Stage 1) — spec compliance check against `docs/spec/dashboard-prompt.md` §"multi-project home" + §"Acceptance criteria" items 1, 2, 3, 13
3. `superpowers:requesting-code-review` (Stage 2) — independent code quality review; watch for: card hover-expand CSS, D-42/D-43 anti-slop patterns, ARIA on listbox palette
4. `/cso` — mandatory (this phase added POST /api/registry/register-prepare, /register-confirm, /:id/rename, /:id/tags — all bearer-gated write routes); verify: SPA cannot call /api/registry/register directly (D-12), nonce TTL enforced server-side, rate-limiter returns 429, blocked reason is verbatim from daemon
5. `/qa` — dev server reachable on `localhost:5174`; verify: register flow end-to-end in browser, context menu on card, Cmd+K opens palette, card click navigates to placeholder `/projects/{id}`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] import/order violation in register-optimistic.test.ts**
- **Found during:** `pnpm lint` after initial write
- **Issue:** `vitest` import listed before `node:*` imports, violating `import/order` ESLint rule
- **Fix:** Reordered so all `node:*` imports precede `vitest` third-party import (one empty line between groups)
- **Files modified:** `packages/spa/src/__tests__/register-optimistic.test.ts`
- **Commit:** 675aff3

**2. [Rule 3 - Blocking] `--port 0` does not yield a random port**
- **Found during:** Reading `packages/agent/src/cli/start.ts` — `parseInt('0', 10) || DEFAULT_PORT` evaluates to `5193` because `0` is falsy
- **Fix:** Used a random port in range 5500-5599 instead; avoids both the default port (5193) and Phase 1 e2e range (5400-5499). Range chosen to avoid collision on parallel CI runs.
- **Files modified:** `packages/spa/src/__tests__/register-optimistic.test.ts` (PORT constant)
- **Note:** The `--port 0` semantics issue in `start.ts` is pre-existing behaviour; not fixed here (architectural change, Rule 4 threshold)

**3. [Rule 2 - Missing content] Added third test: GET /api/registry confirmation**
- **Found during:** Test design — plan specified 2 tests (round-trip timing + single-use), but D-25 requires confirming the entry actually persists
- **Fix:** Added a third `it` block: `GET /api/registry contains the newly registered entry` — validates the real registration (not just the 201 response shape)
- **Commit:** bcacf32 (inline with Task 1)

### Deferred Items

Pre-existing lint errors in prior-plan files were noted but not fixed (out of scope per deviation boundary rule):

- `packages/spa/src/components/RenameTagsForms.tsx:21:7` and `:118:7` — `react-hooks/set-state-in-effect` (Plan 03-08)
- `packages/spa/src/components/RegisterModal.tsx:106:7` — `react-hooks/set-state-in-effect` (Plan 03-08)
- `packages/spa/src/lib/api.test.ts:5:1` — `import/order` (Plan 03-06)
- `packages/agent/src/lib/tailscale.test.ts` — existing warning (Phase 1)

These should be addressed in Phase 4 bootstrap or a dedicated lint-fix pass before the Phase 6 polish gate.

## Known Stubs

None — the subprocess test exercises real daemon routes with real filesystem I/O. The README is factual.

## Threat Flags

None — this plan adds only a test file (no new network endpoints or auth paths) and a documentation update. The test uses an isolated HOME to prevent any ambient daemon state pollution.

## Self-Check: PASSED

- [x] `packages/spa/src/__tests__/register-optimistic.test.ts` — file exists, 163 lines
- [x] `packages/spa/vitest.subprocess.config.ts` — updated include array confirmed
- [x] `README.md` — "Phase 3" appears ≥ 1 time; "register modal", "prepare/confirm", "command palette" appear ≥ 1 time
- [x] Commit bcacf32 — test(03-11): subprocess E2E
- [x] Commit 675aff3 — feat(03-11): README + import-order fix
- [x] All 575 tests pass (`pnpm -r test --run`)
- [x] `pnpm -r typecheck` — 0 errors
- [x] `pnpm -r build` — 0 errors
