---
phase: 14-understand-anything-integration-daemon-hosted-knowledge-grap
plan: "04"
subsystem: spa-code-intelligence
tags: [spa, sidebar, routing, code-intelligence, tdd, phase-14, understand-anything]
dependency_graph:
  requires:
    - 14-01 (CoverageRowSchema.understand + HealthResponseSchema.understand)
  provides:
    - /code-intelligence route (knowledge graph discoverability surface)
    - Code Intelligence sidebar section (D-14-06)
    - CodeIntelligencePage component with viewer links + install/update hints
  affects:
    - Sidebar: new "Code Intelligence" section between Observability and ACCOUNT
    - router.tsx: codeIntelligenceRoute added to route tree
    - 14-05-PLAN.md: CoverageRow.understand column will complement this page
tech_stack:
  added: []
  patterns:
    - SkillDriftPage anatomy (PageHeader + loading/error/empty states)
    - TanStack lazy route (createLazyRoute) following observability.skill-drift.lazy.tsx precedent
    - useCoverage + useHealth query composition
    - SidebarSection peer primitive (not SidebarSubItem) per sidebar-architecture preference
    - Network lucide-react icon for Code Intelligence section
key_files:
  created:
    - packages/spa/src/components/panels/code-intelligence/CodeIntelligencePage.tsx
    - packages/spa/src/components/panels/code-intelligence/CodeIntelligencePage.test.tsx
    - packages/spa/src/routes/code-intelligence.lazy.tsx
  modified:
    - packages/spa/src/router.tsx
    - packages/spa/src/components/ui/Sidebar.tsx
    - packages/spa/src/components/ui/Sidebar.test.tsx
decisions:
  - "Code Intelligence as a new top-level sidebar section (not sub-item under Observability) per user sidebar-architecture preference (feedback_sidebar_section_architecture.md)"
  - "Network lucide-react icon for Knowledge graphs entry — visually distinct from Activity/Layers/TrendingUp"
  - "getAllByText used for /understand mention test (Test 5) — multiple elements match due to PageHeader subtitle also containing /understand"
  - "Bearer token (Pairing.token) excluded from all viewer hrefs — confirmed by negative assertion in test"
  - "viewerToken travels in CoverageRow.understand.viewerToken (D-14-03) not in health response (T-14-01-01)"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-07T09:50:00Z"
  tasks_completed: 2
  files_modified: 6
---

# Phase 14 Plan 04: Code Intelligence Sidebar Section and /code-intelligence Page Summary

**One-liner:** Added Knowledge Graphs page at /code-intelligence listing analyzed projects with viewer links, install/update hints from /health, and a new Code Intelligence sidebar section (D-14-06, D-14-07, D-14-02).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | Failing tests for CodeIntelligencePage | 2661978 | CodeIntelligencePage.test.tsx |
| 1 (GREEN) | CodeIntelligencePage component | 789d9dc | CodeIntelligencePage.tsx, CodeIntelligencePage.test.tsx (fix) |
| 2 (RED) | Failing Sidebar tests for Code Intelligence section | ef59072 | Sidebar.test.tsx |
| 2 (GREEN) | Lazy route + router + Sidebar section | b90fc56 | code-intelligence.lazy.tsx, router.tsx, Sidebar.tsx, Sidebar.test.tsx |

## What Was Built

### CodeIntelligencePage (D-14-06, D-14-07, D-14-02)

Full page at `/code-intelligence`:

- **Filtered project listing:** `useCoverage` rows filtered to `understand.state === 'fresh' || 'stale'`; rows with `missing`, `not-applicable`, or undefined understand column are excluded
- **Viewer links (D-14-07):** Each fresh/stale row with a `viewerToken` gets an "Open viewer" link: `{agentUrl}/understand/{family}/{repo}/?token={encodeURIComponent(viewerToken)}`, `target="_blank"`, `rel="noopener noreferrer"`. Links suppressed when viewer not installed.
- **Install hint (D-14-02):** `health.understand.viewerInstalled === false` → banner with `agentic-dashboard install-understand-viewer`
- **Update hint (D-14-02):** `health.understand.updateAvailable === true` → banner showing both `viewerVersion` and `pluginVersion` with `agentic-dashboard install-understand-viewer`
- **Empty state:** When no repos have been analyzed (zero fresh/stale rows), EmptyState references `/understand` skill with instructions
- **Loading/error states:** Mirrors SkillDriftPage anatomy with EmptyState placeholders
- **Security:** Bearer token (Pairing.token) never appears in viewer hrefs — asserted by negative test; viewer URL only uses per-repo `viewerToken` from CoverageRow.understand

### Lazy route (code-intelligence.lazy.tsx)

Follows exact pattern from `observability.skill-drift.lazy.tsx`:

```ts
export const Route = createLazyRoute('/code-intelligence')({
  component: CodeIntelligencePage,
})
```

### Router entry (router.tsx)

`codeIntelligenceRoute` added between `conformanceRoute` and `_helpLayout`:

```ts
const codeIntelligenceRoute = createRoute({
  getParentRoute: () => appShellLayoutRoute,
  path: '/code-intelligence',
}).lazy(() => import('./routes/code-intelligence.lazy.js').then((m) => m.Route))
```

Appended to `routeTree.addChildren` with comment `Phase 14 D-14-06`.

### Sidebar Code Intelligence section (Sidebar.tsx)

New `Network` icon imported. `<SidebarSection label="Code Intelligence">` inserted between Observability and ACCOUNT, following user sidebar-architecture preference (new section with growth room for future GitNexus explorer entries). Single `SidebarItem` peer primitive (NOT SidebarSubItem):

```tsx
<SidebarSection label="Code Intelligence">
  <SidebarItem
    to="/code-intelligence"
    icon={<Network size={16} aria-hidden="true" />}
    label="Knowledge graphs"
  />
</SidebarSection>
```

## Verification Results

- `pnpm --filter @agenticapps/dashboard-spa test`: **1155 tests pass** (122 test files pass; 1 pre-existing failure — `register-optimistic.test.ts` requires `tsup` binary not available in worktree)
- `pnpm --filter @agenticapps/dashboard-spa typecheck`: **clean** (0 errors)
- `pnpm --filter @agenticapps/dashboard-spa build` (run from main repo with worktree source): **succeeds** (`built in 707ms`)
- `grep -c "code-intelligence" packages/spa/src/router.tsx` returns 4 (≥2 required)
- `grep -c "install-understand-viewer" CodeIntelligencePage.tsx` returns 2 (≥1 required)
- Sidebar S1-S21 all pass (S18-S21 are new Phase 14 tests)

## TDD Gate Compliance

RED/GREEN gate sequence verified in git log:

1. `test(14-04): add failing tests for CodeIntelligencePage (RED)` — 2661978
2. `feat(14-04): implement CodeIntelligencePage (GREEN)` — 789d9dc
3. `test(14-04): add failing tests for Code Intelligence sidebar section (RED)` — ef59072
4. `feat(14-04): add lazy route, router entry, and Code Intelligence sidebar section (GREEN)` — b90fc56

No REFACTOR commits needed — implementations were clean on first pass (TypeScript error in test fixture fixed as Rule 1 deviation during GREEN commit).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed missing pairedAt in Pairing mock fixture**
- **Found during:** Task 2 GREEN typecheck
- **Issue:** `mockGetPairing.mockReturnValue({ agentUrl, token })` was missing `pairedAt` field required by `Pairing` type. TypeScript caught this during `pnpm typecheck`.
- **Fix:** Added `pairedAt: '2026-06-07T09:00:00.000Z'` to the mock return value in `CodeIntelligencePage.test.tsx`
- **Files modified:** `CodeIntelligencePage.test.tsx`
- **Commit:** b90fc56

**2. [Rule 1 - Bug] Fixed Test 5 multiple-element text matcher**
- **Found during:** Task 1 GREEN test run
- **Issue:** `screen.getByText(/\/understand/)` matched both the PageHeader subtitle and the EmptyState body, causing `Found multiple elements` error
- **Fix:** Changed to `screen.getAllByText(/\/understand/)` with `toBeGreaterThanOrEqual(1)` assertion
- **Files modified:** `CodeIntelligencePage.test.tsx`
- **Commit:** 789d9dc (GREEN commit)

## Known Stubs

None — page fully wired to live data from `useCoverage` and `useHealth` hooks. Viewer URLs constructed from real `getPairing().agentUrl`. All data flows are connected.

## Threat Surface Scan

No new network endpoints introduced (page is read-only SPA, uses existing /api/coverage and /health). Viewer link pattern matches T-14-04-01/T-14-04-02 threat model:

- T-14-04-01 (token in URL): viewerToken is scoped repo-bound read-only, not the bearer token; bearer token negative-asserted in tests
- T-14-04-02 (reverse tabnabbing): `rel="noopener noreferrer"` asserted by Test 2

## Self-Check: PASSED

Files confirmed to exist:
- `packages/spa/src/components/panels/code-intelligence/CodeIntelligencePage.tsx`: 269 lines (≥60 required)
- `packages/spa/src/routes/code-intelligence.lazy.tsx`: contains `createLazyRoute`
- `packages/spa/src/router.tsx`: 4 occurrences of `code-intelligence` (≥2 required)
- `packages/spa/src/components/ui/Sidebar.tsx`: contains `Network` import + `Code Intelligence` section

Commits confirmed (git log):
- 2661978 test: CodeIntelligencePage RED
- 789d9dc feat: CodeIntelligencePage GREEN
- ef59072 test: Sidebar Code Intelligence RED
- b90fc56 feat: Sidebar + route + router GREEN
