---
phase: 08-optional-integration-panels
plan: "06"
subsystem: spa-integration-panels
tags: [sentry, linear, panels, tdd, react, tanstack-query, schema-validation, link-out, stale-banner]
dependency_graph:
  requires:
    - 08-01 (SentryRecentResponseSchema, LinearIssuesResponseSchema from @agenticapps/dashboard-shared)
    - 08-03 (GET /api/projects/{id}/sentry/recent — daemon route now live)
    - 08-05 (GET /api/projects/{id}/linear/issues — daemon route now live)
  provides:
    - useSentryRecent (TanStack Query hook, 60s TTL, per-project keyed)
    - useLinearIssues (TanStack Query hook, 60s TTL, per-project keyed)
    - SentryPanel (4-state + issue list + link-out + stale banner)
    - LinearPanel (4-state + issue list + link-out + stale banner)
    - SingleProjectView wiring (both panels in Health column)
  affects:
    - packages/spa/src/lib/projectQueries.ts
    - packages/spa/src/components/SingleProjectView.tsx
tech_stack:
  added: []
  patterns:
    - 4-state guard block (schema_drift/loading/unreachable/happy) copied from ObservabilityHealth.tsx
    - static JSX literal configure-to-enable copy (T-05-05-Static-Copy-Trust)
    - defaultCollapsed on empty/not-configured state (D-6.1-02)
    - PanelContainer stale prop + verbatim stale banner (SENTRY-02 / Linear equivalent)
    - ExternalLink icon link-out with rel="noopener noreferrer" target="_blank" (T-08-26/D-08-04)
    - RTL mock pattern: vi.mock + mockReturnValue at hook level (no QueryClient wrapper needed)
key_files:
  created:
    - packages/spa/src/components/panels/SentryPanel.tsx
    - packages/spa/src/components/panels/SentryPanel.test.tsx
    - packages/spa/src/components/panels/LinearPanel.tsx
    - packages/spa/src/components/panels/LinearPanel.test.tsx
  modified:
    - packages/spa/src/lib/projectQueries.ts
    - packages/spa/src/components/SingleProjectView.tsx
    - packages/spa/src/components/SingleProjectView.test.tsx
    - packages/spa/src/__tests__/projects-detail-e2e.test.tsx
decisions:
  - "FIVE_ISSUES fixture removed from SentryPanel.test.tsx — no test exercised all 5 rows; SP6 uses ISSUE_ONE which covers happy-path rendering"
  - "LinearPanel renders identifier in the link only (not a separate span) — avoids duplicate text in DOM that breaks getByText in tests"
  - "E2E fixture responses for sentry/recent + linear/issues use empty issues arrays — validates INV-03 (dashboard functional with zero env vars)"
metrics:
  duration: "~12 min"
  completed: "2026-06-11"
  tasks: 3
  files: 8
---

# Phase 8 Plan 06: SPA Integration Panels (SentryPanel + LinearPanel) Summary

SPA frontend layer for the two optional integration panels: TanStack Query hooks with schema validation at the browser boundary (INV-04), 4-state PanelContainer panels with static configure-to-enable copy, issue list link-outs, and verbatim stale banners. Both panels wired into the single-project Health column. The pre-existing static Linear surface (IntegrationsHealth) stays API-free.

## What Was Built

### packages/spa/src/lib/projectQueries.ts (modified)

Added `useSentryRecent(id)` and `useLinearIssues(id)` modelled exactly on `useIntegrations`:

- `queryKey: ['sentry-recent', id] as const` / `['linear-issues', id] as const` — per-project keyed for cross-project cache safety (T-05-05-Cross-Project-Cache)
- `queryFn`: calls `apiFetch` against the shared schema; throws `new Error('schema_drift:' + drift.path)` on `!result.ok` (INV-04 at the browser boundary)
- `staleTime` / `refetchInterval` = `SKILLS_TTL_MS` (60_000) — matches the daemon's 60s cache TTL
- `refetchIntervalInBackground: false` — D-4-02
- `enabled: id !== null` — null-safe; hook is idle on transient route transitions

Imports added: `SentryRecentResponseSchema`, `type SentryRecentResponse`, `LinearIssuesResponseSchema`, `type LinearIssuesResponse` from `@agenticapps/dashboard-shared`.

### packages/spa/src/components/panels/SentryPanel.tsx

4-state panel consuming `useSentryRecent`:

1. **schema_drift** → `InlineDrift` (4-state guard block copied verbatim from ObservabilityHealth.tsx)
2. **isLoading** → `PanelContainer` with `Loading...`
3. **error / no data** → `PanelContainer unreachable`
4. **empty issues** → `PanelContainer defaultCollapsed` + static JSX literal: `"Set SENTRY_AUTH_TOKEN to enable the Sentry panel."` with `/help` link (T-05-05-Static-Copy-Trust / D-6.1-02)
5. **happy path** → `PanelContainer stale={data.stale}` + up to 5 issue rows: title, level badge (`LEVEL_CLASS` map), `Number(count).toLocaleString()` event count, `lastSeen`, `<a href={permalink} target="_blank" rel="noopener noreferrer">` with `shortId` + `ExternalLink` icon (T-08-26 / D-08-04)
6. **stale=true + staleFrom** → verbatim banner: `"Sentry API unreachable — using cached data from {staleFrom}"` (SENTRY-02)

### packages/spa/src/components/panels/LinearPanel.tsx

4-state panel consuming `useLinearIssues` — mirrors SentryPanel exactly:

1–3: same schema_drift / loading / unreachable states
4. **empty issues** → static `"Set LINEAR_API_KEY to enable the Linear panel."` (T-05-05 / D-6.1-02)
5. **happy path** → up to 3 issue rows: title, `identifier` as link text, `stateName`, `assigneeName ?? 'Unassigned'`, `<a href={issue.url} target="_blank" rel="noopener noreferrer">` + `ExternalLink` (T-08-26 / D-08-07)
6. **stale=true + staleFrom** → verbatim banner: `"Linear API unreachable — using cached data from {staleFrom}"`

LINEAR-02 clause (b) / D-08-06: `IntegrationsHealth.tsx` is unchanged, imports only `useIntegrations`, has no `useLinearIssues` or `/linear/issues` reference. Verified by LP13 test (reads source file, asserts absence).

### packages/spa/src/components/SingleProjectView.tsx (modified)

Added imports for `SentryPanel` and `LinearPanel`. Added both to the Health column after `IntegrationsHealth` and before `InstalledSkills`:

```tsx
<IntegrationsHealth projectId={projectId} />
<SentryPanel projectId={projectId} />
<LinearPanel projectId={projectId} />
<InstalledSkills projectId={projectId} />
```

`IntegrationsHealth` render is unchanged.

## TDD Gate Compliance

Strict RED → GREEN per plan `type: tdd`:

| Gate | Task | Commit |
|------|------|--------|
| RED (test) | Task 1 — query hooks | `test(08-06): add RED tests for useSentryRecent + useLinearIssues hooks` (bbe5219) |
| GREEN (feat) | Task 1 | `feat(08-06): implement useSentryRecent + useLinearIssues hooks (GREEN)` (c05c7ee) |
| RED (test) | Task 2 — SentryPanel | `test(08-06): add RED tests for SentryPanel (SP1-SP12)` (b6ed6ce) |
| GREEN (feat) | Task 2 | `feat(08-06): implement SentryPanel — 4-state + issue list + link-out + stale banner (GREEN)` (1a2c8ac) |
| RED (test) | Task 3 — LinearPanel | `test(08-06): add RED tests for LinearPanel (LP1-LP13)` (ec75849) |
| GREEN (feat) | Task 3 | `feat(08-06): implement LinearPanel + wire both panels into SingleProjectView (GREEN)` (8e6e4be) |

Tests added: SR1–SR6 (useSentryRecent), LI1–LI6 (useLinearIssues), SP1–SP12 (SentryPanel), LP1–LP13 (LinearPanel) = 37 new tests.

## Verification

- `pnpm --filter @agenticapps/dashboard-spa test`: 1250 tests, 127 files — all pass
- `pnpm --filter @agenticapps/dashboard-spa typecheck`: clean (0 errors)
- `pnpm lint`: 0 errors
- `grep -c "<SentryPanel" SingleProjectView.tsx` → 1
- `grep -c "<LinearPanel" SingleProjectView.tsx` → 1
- `grep -c "useLinearIssues\|linear/issues" IntegrationsHealth.tsx` → 0 (LINEAR-02 clause b)
- `git diff --quiet IntegrationsHealth.tsx` → exits 0 (file unchanged)
- INV-03: E2E test uses empty-issues responses for both panels — dashboard fully functional with no env vars set; panels render static configure copy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SingleProjectView.test.tsx mock missing new hooks**
- **Found during:** Task 3 GREEN test run — all 12 SingleProjectView tests failed because `useSentryRecent` and `useLinearIssues` were not in the `vi.mock('../lib/projectQueries.js')` factory
- **Fix:** Added `useSentryRecent` and `useLinearIssues` to the mock factory (both returning `isLoading: true` stub)
- **Files modified:** `packages/spa/src/components/SingleProjectView.test.tsx`
- **Commit:** 8e6e4be

**2. [Rule 1 - Bug] projects-detail-e2e.test.tsx missing route handlers → crash in SentryPanel**
- **Found during:** Task 3 GREEN test run — E2E2 timed out; SentryPanel threw `TypeError: Cannot read properties of undefined (reading 'length')` because the default `{ ok: true, data: {} }` fallback in `buildMockApiFetch` bypassed schema validation, delivering `{}` as `SentryRecentResponse` with `issues` undefined
- **Fix:** Added `SENTRY_RECENT_RESPONSE` and `LINEAR_ISSUES_RESPONSE` minimal fixtures; added route handlers for `/sentry/recent` and `/linear/issues` in `buildMockApiFetch`
- **Files modified:** `packages/spa/src/__tests__/projects-detail-e2e.test.tsx`
- **Commit:** 8e6e4be

**3. [Rule 1 - Bug] FIVE_ISSUES fixture unused → lint error**
- **Found during:** lint run after GREEN implementation — `@typescript-eslint/no-unused-vars` error on `FIVE_ISSUES` in `SentryPanel.test.tsx` (defined for a multi-issue render test that was covered by the count-format test instead)
- **Fix:** Removed the unused fixture
- **Files modified:** `packages/spa/src/components/panels/SentryPanel.test.tsx`
- **Commit:** 8e6e4be

**4. [Rule 1 - Bug] LinearPanel: duplicate identifier text in DOM broke getByText**
- **Found during:** LP6 and LP8 RED→GREEN — initial implementation rendered `<span>{identifier}</span>` + `<a>{identifier}</a>`, causing `getByText('ACME-123')` to throw "found multiple elements"
- **Fix:** Removed the standalone `<span>` identifier; the link `<a>{identifier}</a>` is the sole text node — serves as both the label and the link-out
- **Files modified:** `packages/spa/src/components/panels/LinearPanel.tsx`
- **Commit:** 8e6e4be

## Known Stubs

None. Both panels render real data from the live daemon routes (Plans 03/05). The "not configured" state is intentional static UI per the spec (INV-03), not a stub.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes at trust boundaries beyond what the plan's threat model covers. All surfaces confirmed:

| Flag | File | Description |
|------|------|-------------|
| T-08-24 covered | SentryPanel.tsx, LinearPanel.tsx | Configure copy is static JSX literal — no daemon string interpolation |
| T-08-25 accepted | SentryPanel.tsx, LinearPanel.tsx | Issue metadata only (title/level/count/url/state/assignee); React auto-escapes |
| T-08-26 covered | SentryPanel.tsx, LinearPanel.tsx | All link-outs: `rel="noopener noreferrer" target="_blank"` |
| T-08-27 covered | projectQueries.ts | `apiFetch` parseOrDrift → `schema_drift:` throw → InlineDrift guard (INV-04) |
| T-08-28 covered | IntegrationsHealth.tsx | Unchanged; no useLinearIssues, no /linear/issues (LINEAR-02 clause b / D-08-06) |

## Self-Check

**Files created/exist:**
- `packages/spa/src/components/panels/SentryPanel.tsx` — FOUND
- `packages/spa/src/components/panels/SentryPanel.test.tsx` — FOUND
- `packages/spa/src/components/panels/LinearPanel.tsx` — FOUND
- `packages/spa/src/components/panels/LinearPanel.test.tsx` — FOUND

**Files modified:**
- `packages/spa/src/lib/projectQueries.ts` — FOUND, exports useSentryRecent + useLinearIssues
- `packages/spa/src/components/SingleProjectView.tsx` — FOUND, both panels in Health column

**Commits (all on gsd/phase-08-optional-integration-panels):**
- bbe5219 — test: RED query hook tests
- c05c7ee — feat: GREEN query hooks
- b6ed6ce — test: RED SentryPanel tests
- 1a2c8ac — feat: GREEN SentryPanel
- ec75849 — test: RED LinearPanel tests
- 8e6e4be — feat: GREEN LinearPanel + SingleProjectView wiring

## Self-Check: PASSED
