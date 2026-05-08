---
phase: 05-skills-health-panels
plan: 05
subsystem: spa-panels
tags: [spa, react, tanstack-query, panels, observability, secrets, integrations, tdd, wave-2]
dependency_graph:
  requires:
    - 05-01 (ObservabilityResponseSchema, SecretsResponseSchema, IntegrationsResponseSchema)
    - 05-03 (GET /api/projects/:id/observability, /secrets, /integrations daemon routes)
    - 05-04 (projectQueries.ts hook pattern, PanelContainer, InlineDrift reuse)
  provides:
    - useObservability(id) hook
    - useSecrets(id) hook
    - useIntegrations(id) hook
    - ObservabilityHealth panel (HEALTH-03)
    - SecretsHealth panel (HEALTH-04)
    - IntegrationsHealth panel (HEALTH-05)
  affects:
    - plan 05-06 (SingleProjectView.tsx wires health column — can now mount all 5 panels)
tech_stack:
  added: []
  patterns:
    - TanStack Query 5s poll with POLL_MS staleTime + refetchInterval
    - apiFetch + parseOrDrift → schema_drift: prefix error
    - JSX literal tables for verbatim configure-to-enable copy (no daemon interpolation)
    - container.textContent assertions for split-text elements (code inside span)
    - exact:false matcher for trailing-space normalized text
key_files:
  created:
    - packages/spa/src/components/panels/ObservabilityHealth.tsx
    - packages/spa/src/components/panels/ObservabilityHealth.test.tsx
    - packages/spa/src/components/panels/SecretsHealth.tsx
    - packages/spa/src/components/panels/SecretsHealth.test.tsx
    - packages/spa/src/components/panels/IntegrationsHealth.tsx
    - packages/spa/src/components/panels/IntegrationsHealth.test.tsx
  modified:
    - packages/spa/src/lib/projectQueries.ts (3 hooks appended)
    - packages/spa/src/lib/projectQueries.test.ts (9 new tests appended)
decisions:
  - "SecretsHealth renders only { state } from query.data — workspaceId and defaultEnvironment are deliberately not destructured (T-05-05-NoSecretRead-SPA privacy invariant)"
  - "INTEGRATIONS table stores nudges+paragraphs as React JSX literals — no daemon string interpolation (T-05-05-Static-Copy-Trust)"
  - "Test matchers: container.textContent for split-text spans (code inside span); exact:false for trailing-whitespace normalized by Testing Library"
  - "IntegrationsHealth is 172 lines (plan said ≤130) — verbatim JSX paragraphs with code-tagged env vars require space; content is complete and correct"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-07"
  tasks: 3
  files_created: 6
  files_modified: 2
  tests_added: 50
---

# Phase 05 Plan 05: ObservabilityHealth + SecretsHealth + IntegrationsHealth Panels Summary

**One-liner:** 3 TanStack Query hooks (useObservability/useSecrets/useIntegrations) plus ObservabilityHealth, SecretsHealth, and IntegrationsHealth panels with full state coverage — loading, schema-drift, unreachable, happy-path, and empty — all tested with verbatim UI-SPEC copy assertions.

---

## What Was Built

### Task 1: 3 New Query Hooks (TDD — 9 new tests, 40 total in file)

Three hooks appended to `packages/spa/src/lib/projectQueries.ts` (existing 8 hooks unchanged):

| Hook | Query Key | staleTime | refetchInterval | Notes |
|------|-----------|-----------|-----------------|-------|
| `useObservability(id)` | `['observability', id]` | 5s | 5s | Per-project; id in key (T-05-05) |
| `useSecrets(id)` | `['secrets', id]` | 5s | 5s | Per-project; id in key (T-05-05) |
| `useIntegrations(id)` | `['integrations', id]` | 5s | 5s | Per-project; id in key (T-05-05) |

All 3 follow the POLL_MS constant (5000ms). Cross-project cache isolation proven by O2/SC2/I2 tests. Schema drift path proven by O3/SC3/I3 tests.

### Task 2: ObservabilityHealth + SecretsHealth Panels (TDD — 19 tests)

**`packages/spa/src/components/panels/ObservabilityHealth.tsx`:**

- Calls `useObservability(projectId)`.
- 4 states: schema-drift → InlineDrift; loading → Loading...; error/no-data → unreachable; happy path.
- Happy path: `grid grid-cols-[8rem_1fr] gap-3` with 3 tool rows (Sentry / Spotlight / sentry-cli).
- Per-tool: detected → `"detected via "` prefix + evidence strings joined with `" + "`; not-detected → italic muted `"not detected"`.
- Empty state (all 3 not-detected): `"No observability tooling detected. (Configure to enable.)"` verbatim.

**`packages/spa/src/components/panels/SecretsHealth.tsx`:**

- Calls `useSecrets(projectId)`.
- 4 states: schema-drift; loading; error/no-data; happy path.
- Happy path: 3-state branch on `data.state`:
  - `present-valid`: CheckCircle2 (success) + body + `valid` pill.
  - `present-invalid`: AlertTriangle (danger) + body + `invalid` pill.
  - `absent`: Minus (text-subtle) + body + no pill.
- **PRIVACY INVARIANT enforced**: only `state` destructured from `query.data` — `workspaceId` and `defaultEnvironment` never extracted or rendered. Test SH8 proves this.

### Task 3: IntegrationsHealth Panel (TDD — 12 tests)

**`packages/spa/src/components/panels/IntegrationsHealth.tsx`:**

- Calls `useIntegrations(projectId)`.
- 4 states: schema-drift; loading; error/no-data; happy path.
- Happy path: `grid grid-cols-[7rem_1fr] gap-3` with 3 integration rows (Sentry / Linear / Infisical).
- Per-integration state renders:
  - `configured`: pill `configured` (success-colored) only.
  - `present-but-not-configured`: pill `set up needed` (warning) + env-var nudge.
  - `not-detected`: pill `not detected` (muted) + inline one-paragraph guide.
- `INTEGRATIONS` table stores nudges + paragraphs as React JSX literals — no daemon content interpolated (T-05-05-Static-Copy-Trust).
- No `<a href>` anchors anywhere (D-5-20: inline copy IS the documentation).

---

## Verbatim-Copy Proof

### ObservabilityHealth empty state (UI-SPEC line 412)

Rendered: `No observability tooling detected. (Configure to enable.)`

Test OH6 asserts this verbatim string.

### SecretsHealth state bodies (UI-SPEC lines 414–416)

| State | Rendered text | Test |
|-------|--------------|------|
| `present-valid` | `.infisical.json present and valid.` | SH4 |
| `present-invalid` | `.infisical.json found but not parseable.` | SH5 |
| `absent` | `No .infisical.json detected.` | SH6 |

### IntegrationsHealth env-var nudges (UI-SPEC lines 422–424)

| Integration | Nudge (verbatim) | Test |
|-------------|-----------------|------|
| Sentry | `Sentry SDK detected. Set SENTRY_AUTH_TOKEN to enable the panel.` | IH5 |
| Linear | `Linear branch references detected. Set LINEAR_API_KEY to enable the panel.` | IH5 |
| Infisical | `.infisical.json detected. Run the daemon under infisical run to load secrets.` | IH5 |

### IntegrationsHealth not-detected paragraphs (UI-SPEC lines 425–427, D-5-20)

| Integration | Opening sentence | Test |
|-------------|-----------------|------|
| Sentry | `Sentry surfaces recent errors and unhandled rejections inline.` | IH6 |
| Linear | `Linear links commits and PRs to issue IDs.` | IH6 |
| Infisical | `Infisical loads secrets from a Universal Auth project at runtime.` | IH6 |

All paragraphs contain their env-var names in `<code>` elements (IH9/IH10/IH11).

---

## SecretsHealth Privacy Invariant Proof

Test SH8 renders with `{ state: 'present-valid', workspaceId: 'my-workspace-123', defaultEnvironment: 'staging' }` and asserts:

```
container.textContent does NOT contain 'my-workspace-123'   ✓
container.textContent does NOT contain 'staging'            ✓
```

Implementation enforces this structurally: only `const { state } = query.data` is destructured in `SecretsHealth.tsx`. `workspaceId` and `defaultEnvironment` are never extracted, assigned, or referenced in JSX.

---

## Cross-Project Cache Test Outcome

Three cross-project isolation tests (O2, SC2, I2):

```typescript
qc.getQueryData(['observability', 'acme']) !== qc.getQueryData(['observability', 'beta'])
qc.getQueryData(['secrets', 'acme']) !== qc.getQueryData(['secrets', 'beta'])
qc.getQueryData(['integrations', 'acme']) !== qc.getQueryData(['integrations', 'beta'])
```

All 3 confirmed by test assertions. T-05-05-Cross-Project-Cache mitigated.

---

## Test Count Summary (Plans 04 + 05)

| Plan | Component | Tests Added |
|------|-----------|-------------|
| 05-04 | projectQueries.ts (hooks 6–8) | 13 |
| 05-04 | InstalledSkills panel | 11 |
| 05-04 | SkillHealth panel | 14 |
| 05-04 | Subtotal | **38** |
| 05-05 | projectQueries.ts (hooks 9–11) | 9 |
| 05-05 | ObservabilityHealth panel | 10 |
| 05-05 | SecretsHealth panel | 9 |
| 05-05 | IntegrationsHealth panel | 12 |
| 05-05 | Subtotal | **40** |
| **Total plans 04+05** | | **~78 new SPA tests** |

Total SPA test suite at plan 05-05 close: **511 tests** (56 test files).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Testing Library text normalization for trailing-space spans**
- Found during: Task 2 GREEN run (OH4/OH5/OH9 failing, SH6 failing)
- Issue: `getByText('detected via ')` and `getByText(/No .infisical.json detected\./)` fail because Testing Library normalizes trailing spaces and `.infisical.json` is split across `<span>` and `<code>` child elements.
- Fix: Updated tests to use `getAllByText('detected via', { exact: false })` for OH4/OH5; `container.querySelectorAll('span')` for OH9; `container.textContent.toContain(...)` for SH4/SH5/SH6/SH8.
- Files modified: `ObservabilityHealth.test.tsx`, `SecretsHealth.test.tsx`

### Minor Adjustments

**1. IntegrationsHealth file length (172 vs ≤130 lines)**
- Plan said "File length ≤ 130 lines (state-table is the bulk)".
- Actual: 172 lines. The verbatim JSX paragraphs with multiple `<code>` elements per paragraph, the PILL_LABEL + PILL_CLASS tables, and the render loop naturally exceed the estimate.
- The content is complete, correct, and well-structured. Not shortened at the cost of readability or correctness.

### Pre-existing Issues (not introduced by this plan)

- `ET6: result sorted by firstDate ascending` in `phaseDetail.test.ts` times out under `pnpm -r test` parallel load. Passes in isolation. Same pattern as MultiProjectHome timing flake documented in plan 05-03 SUMMARY.

---

## Known Stubs

None — all 3 panels are fully wired to real hooks consuming real daemon endpoints (shipped in plan 05-03). No hardcoded empty values in rendering paths.

---

## Threat Flags

None new beyond the plan's threat model. All T-05-05-* mitigations are implemented and verified:

| Threat | Mitigation | Proof |
|--------|-----------|-------|
| T-05-05-Cross-Project-Cache | projectId in queryKey for all 3 hooks | O2/SC2/I2 cross-project tests |
| T-05-05-Schema-Drift | apiFetch throws schema_drift: prefix, panels render InlineDrift | O3/SC3/I3 + OH2/SH2/IH2 |
| T-05-05-NoSecretRead-SPA | Only `state` destructured from SecretsResponse; workspaceId never rendered | SH8 privacy invariant test |
| T-05-05-Static-Copy-Trust | INTEGRATIONS table JSX literals — no daemon content in paragraphs | Code structure + IH6 |
| T-05-05-Empty-State-Coverage | All 3 panels have explicit empty/all-absent states | OH6, SH6, IH4 |
| T-05-05-No-Read-More-Link | No `<a href>` in IntegrationsHealth source or DOM | IH12 + grep confirms |

---

## Self-Check: PASSED

Files on disk:
- FOUND: packages/spa/src/components/panels/ObservabilityHealth.tsx
- FOUND: packages/spa/src/components/panels/ObservabilityHealth.test.tsx
- FOUND: packages/spa/src/components/panels/SecretsHealth.tsx
- FOUND: packages/spa/src/components/panels/SecretsHealth.test.tsx
- FOUND: packages/spa/src/components/panels/IntegrationsHealth.tsx
- FOUND: packages/spa/src/components/panels/IntegrationsHealth.test.tsx
- FOUND: packages/spa/src/lib/projectQueries.ts (3 new exports appended)
- FOUND: packages/spa/src/lib/projectQueries.test.ts (9 new tests appended)

Commits:
- `07ee082` feat(05-05): add useObservability + useSecrets + useIntegrations hooks
- `6678375` feat(05-05): ObservabilityHealth + SecretsHealth panels
- `db83038` feat(05-05): IntegrationsHealth panel — 3-state per integration with inline guides

Tests: 40 new tests (9 projectQueries + 10 ObservabilityHealth + 9 SecretsHealth + 12 IntegrationsHealth), all green.
pnpm --filter @agenticapps/dashboard-spa test: 511 tests, 56 files, all passed.
pnpm -r typecheck: passes across all 4 packages.
