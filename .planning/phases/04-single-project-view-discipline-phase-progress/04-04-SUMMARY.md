---
phase: 04-single-project-view-discipline-phase-progress
plan: "04"
subsystem: spa-query-hooks-and-shell
tags:
  - tanstack-query
  - react-components
  - tdd
  - spa
  - phase-4
  - routing
dependency_graph:
  requires:
    - 04-01-schemas (CommitmentBlockResponseSchema, ObservationsRecentResponseSchema, DisciplineResponseSchema, PhaseProgressResponseSchema, SecurityResponseSchema)
    - 04-03-routes (GET /api/projects/:id/commitment, /observations/recent, /discipline, /phase-progress, /security)
    - packages/spa/src/lib/api.ts (apiFetch + parseOrDrift)
    - packages/spa/src/lib/registry.ts (useRegistryList, useProjectOverview — reused in ProjectHeader)
    - packages/spa/src/lib/appShellWidth.ts (setAppShellWidth — ProjectLayout uses it)
  provides:
    - useCommitment, useObservations, useDiscipline, usePhaseProgress, useSecurity (5 TanStack Query hooks in projectQueries.ts)
    - ProjectLayout (max-w-7xl width override)
    - ProjectHeader (single-line breadcrumb nav)
    - SingleProjectView (2-col grid shell with 8 panel slots)
    - /projects/{id} route mounts ProjectLayout > SingleProjectView (Phase 3 placeholder removed)
  affects:
    - Plan 05 (Discipline panels) — replaces data-slot="commitment", "hook-firings", "rationalization-fires" divs
    - Plan 06 (Phase Progress panels) — replaces data-slot="phase-progress", "execution-timeline", "review-status", "security-status", "verification-status" divs
tech_stack:
  added: []
  patterns:
    - TanStack Query useQuery with staleTime + refetchInterval + refetchIntervalInBackground:false (D-4-02)
    - enabled: id !== null gate on all 5 hooks (null-safe for transient route transitions)
    - schema drift throws Error('schema_drift:<path>') for panel-level SchemaDriftState surface
    - ProjectLayout mirrors HomeLayout pattern (useSyncExternalStore via setAppShellWidth useEffect)
    - SingleProjectView uses data-testid + data-slot attributes for test isolation and plan extensibility
key_files:
  created:
    - packages/spa/src/lib/projectQueries.ts
    - packages/spa/src/lib/projectQueries.test.ts
    - packages/spa/src/components/ProjectLayout.tsx
    - packages/spa/src/components/ProjectLayout.test.tsx
    - packages/spa/src/components/ProjectHeader.tsx
    - packages/spa/src/components/ProjectHeader.test.tsx
    - packages/spa/src/components/SingleProjectView.tsx
    - packages/spa/src/components/SingleProjectView.test.tsx
  modified:
    - packages/spa/src/routes/projects.$projectId.lazy.tsx (body replaced — placeholder → real view)
    - packages/spa/src/routes/projects.$projectId.test.tsx (assertions updated for new structure)
decisions:
  - "5 hooks share identical polling config (POLL_MS=5_000) — redundancy is intentional for grep'ability, mirrors Phase 3 registry.ts convention"
  - "observations queryKey includes limit: ['observations', id, limit] — prevents cross-limit cache collisions (T-04-04-01)"
  - "document.title set in SingleProjectView (not ProjectLayout) — layout is generic; title is per-page"
  - "ProjectLayout uses <>{children}</> (Fragment) — no wrapper DOM element, matches HomeLayout pattern"
  - "paddedPhase derived from first 2 chars of currentPhase dir name using /^\d{2}/ regex"
  - "eslint-disable-next-line @typescript-eslint/no-explicit-any used in Q10 test for QueryObserver options inspection"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-06T08:11:42Z"
  tasks_completed: 3
  files_created: 8
  files_modified: 2
---

# Phase 04 Plan 04: Wave 3 SPA Infrastructure — Summary

Five TanStack Query hooks, ProjectLayout (max-w-7xl), ProjectHeader (single-line breadcrumb), and SingleProjectView (2-col grid shell) implemented with full TDD coverage. The `/projects/{id}` route now renders a real page header and scaffolded columns — the Phase 3 placeholder text is completely removed.

## Query Hook Signatures + queryKey Shapes

| Hook | Path | queryKey | Default |
|------|------|----------|---------|
| `useCommitment(id)` | `GET /api/projects/{id}/commitment` | `['commitment', id]` | — |
| `useObservations(id, limit?)` | `GET /api/projects/{id}/observations/recent?limit=N` | `['observations', id, limit]` | limit=20 |
| `useDiscipline(id)` | `GET /api/projects/{id}/discipline` | `['discipline', id]` | — |
| `usePhaseProgress(id)` | `GET /api/projects/{id}/phase-progress` | `['phase-progress', id]` | — |
| `useSecurity(id)` | `GET /api/projects/{id}/security` | `['security', id]` | — |

All hooks: `staleTime: 5_000`, `refetchInterval: 5_000`, `refetchIntervalInBackground: false`, `enabled: id !== null`.

Schema drift: each hook throws `Error('schema_drift:<path>')` which the QueryCache.onError (Phase 2 D-09) surfaces as a per-panel `<SchemaDriftState>`.

Cross-project isolation (T-04-04-01): every queryKey includes `projectId`. `useObservations` also includes `limit` in the key, so distinct limit values produce distinct cache entries. Verified by test Q11.

## ProjectLayout vs HomeLayout

| Component | Width | Mount | Unmount |
|-----------|-------|-------|---------|
| `HomeLayout` | `max-w-5xl` | `setAppShellWidth('max-w-5xl')` | `setAppShellWidth('max-w-3xl')` |
| `ProjectLayout` | `max-w-7xl` | `setAppShellWidth('max-w-7xl')` | `setAppShellWidth('max-w-3xl')` |

Both use the same `useSyncExternalStore` external-store bus via `appShellWidth.ts`. Both wrap children in `<>{children}</>` (Fragment — no extra DOM wrapper). The only difference is the width string.

## ProjectHeader Rendering Format

```
← All Projects · {name}{(client) if client} · {branch ?? '(no branch)'} · phase {paddedPhase} — {status}
```

Conditional segments:
- `({client})` — rendered only when `client !== null`
- `phase {paddedPhase}` — rendered only when `currentPhase` starts with `\d{2}` (slices first 2 chars)
- `— {status}` — rendered only when `phaseStatus !== null`

Fallback when registry loading: shows `projectId` as name; back link always reachable.

Data sources:
- `name`, `client`, `currentPhase` — from `useRegistryList().data.find(p => p.id === projectId)`
- `branch`, `phaseStatus` — from `useProjectOverview(projectId).data`

Accessibility: `aria-label="Project breadcrumb"` on `<nav>`, separator `·` spans are `aria-hidden="true"`, back link has `focus-visible:ring-[--ring]`.

## SingleProjectView Grid + Slot Layout

```
<div>
  <ProjectHeader projectId={projectId} />
  <div data-testid="single-project-grid" class="grid grid-cols-[1fr_1.5fr] items-start gap-6">
    <section data-testid="discipline-column" aria-label="Discipline" class="flex flex-col gap-4">
      <div data-slot="commitment" />            ← Plan 05 replaces with CommitmentBlock
      <div data-slot="hook-firings" />          ← Plan 05 replaces with HookFirings
      <div data-slot="rationalization-fires" /> ← Plan 05 replaces with RationalizationFires
    </section>
    <section data-testid="phase-progress-column" aria-label="Phase Progress" class="flex flex-col gap-4">
      <div data-slot="phase-progress" />        ← Plan 06 replaces with PhaseProgress
      <div data-slot="execution-timeline" />    ← Plan 06 replaces with ExecutionTimeline
      <div data-slot="review-status" />         ← Plan 06 replaces with ReviewStatus
      <div data-slot="security-status" />       ← Plan 06 replaces with SecurityStatus
      <div data-slot="verification-status" />   ← Plan 06 replaces with VerificationStatus
    </section>
    <!-- NO health-column element (D-4-09, D-4-13 anti-skeleton) -->
  </div>
</div>
```

`grid-cols-[1fr_1.5fr]` — Phase 5 changes to `grid-cols-[1fr_1.5fr_1fr]` by adding one class + inserting the third column. No phantom placeholder element exists.

## Route Swap: Before vs After

Before (Phase 3 placeholder):
```tsx
function ProjectIdPlaceholder(): React.JSX.Element {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  useEffect(() => { document.title = `${projectId} — AgenticApps Dashboard` }, [projectId])
  return (
    <section className="rounded-md border ...">
      <Link to="/">← Back to all projects</Link>
      <h2>Three-column view</h2>
      <p>Phase 4 work — this view lands in the next phase ...</p>
    </section>
  )
}
```

After (Phase 4 real view):
```tsx
function ProjectIdPage(): React.JSX.Element {
  const { projectId } = useParams({ from: '/projects/$projectId' })
  return (
    <ProjectLayout>
      <SingleProjectView projectId={projectId} />
    </ProjectLayout>
  )
}
```

`document.title` moved into `SingleProjectView.tsx` (not the route wrapper — layout is generic; title is per-page).

## TDD Commit Pairs

| Task | RED commit | GREEN commit |
|------|-----------|-------------|
| Task 1 (projectQueries hooks) | `fd8e424` test(04-04): add failing tests for projectQueries hooks (RED) | `c84e90a` feat(04-04): implement projectQueries hooks (GREEN) |
| Task 2 (ProjectLayout + ProjectHeader) | `2dc8799` test(04-04): add failing tests for ProjectLayout + ProjectHeader (RED) | `c8302ab` feat(04-04): implement ProjectLayout + ProjectHeader (GREEN) |
| Task 3 (SingleProjectView + route swap) | `b94564f` test(04-04): add failing tests for SingleProjectView shell + route swap (RED) | `cf703f9` feat(04-04): mount SingleProjectView at /projects/{id} (GREEN) |

Additional fix commit: `229d64a` fix(04-04): narrow RouteComponent type in route test to satisfy strict TS control flow

## Route Confirmation

The `/projects/{id}` route now renders:
- A `<nav aria-label="Project breadcrumb">` with the single-line breadcrumb format
- A `<div data-testid="single-project-grid" class="grid grid-cols-[1fr_1.5fr] ...">` layout
- Left `discipline-column` (3 slots) and center `phase-progress-column` (5 slots)
- NO "Three-column view" heading, NO "Phase 4 work — this view lands..." paragraph

Test count: 340 total SPA tests (was 302 before this plan — 38 new tests across 5 new/updated test files).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DISCIPLINE_BODY fixture used wrong schema shape**
- **Found during:** `pnpm lint` run after GREEN implementation
- **Issue:** Test fixture had `{ rows: [...], skillInstalled: true }` but `DisciplineResponseSchema` wraps in `{ rationalization: { rows: [...], skillInstalled: bool } }`
- **Fix:** Updated fixture to match actual schema shape
- **Files modified:** `packages/spa/src/lib/projectQueries.test.ts`

**2. [Rule 1 - Bug] Q10 test used non-typed options access**
- **Found during:** `pnpm -r typecheck`
- **Issue:** `q?.options.staleTime` — TypeScript doesn't expose these on `QueryOptions` type
- **Fix:** Cast to `any` with eslint-disable comment for the options inspection block
- **Files modified:** `packages/spa/src/lib/projectQueries.test.ts`

**3. [Rule 1 - Bug] RouteComponent undefined narrowing failure in route test**
- **Found during:** `pnpm -r typecheck`
- **Issue:** TypeScript control flow doesn't narrow `Component` inside a nested function body even after `if (!Component) throw`
- **Fix:** Reassigned to `RouteComponent` const before defining `WrappedComponent`
- **Files modified:** `packages/spa/src/routes/projects.$projectId.test.tsx`

**4. [Rule 1 - Bug] Lint errors: react/display-name (anonymous wrapper components) + no-unused-vars (callCount, makeQCWrapper)**
- **Found during:** `pnpm lint`
- **Fix:** Named all wrapper components (`Wrapper`, `WrappedComponent`), removed unused variables, removed unused `makeQCWrapper` function
- **Files modified:** `packages/spa/src/components/SingleProjectView.test.tsx`, `packages/spa/src/routes/projects.$projectId.test.tsx`, `packages/spa/src/lib/projectQueries.test.ts`

**5. [Rule 2 - Missing critical functionality] L3 test assertion was incorrect**
- **Found during:** Initial test run (GREEN phase)
- **Issue:** Test checked `child.parentElement?.tagName !== 'DIV'` but React renders within a div container, so all elements have a DIV parent
- **Fix:** Changed L3 to assert both children share the same parent (proving no individual wrappers), which correctly validates the Fragment pattern
- **Files modified:** `packages/spa/src/components/ProjectLayout.test.tsx`

**6. [Rule 2 - Missing critical functionality] makeOverview fixture in ProjectHeader.test.tsx used wrong ProjectOverview shape**
- **Found during:** First GREEN test run for ProjectHeader
- **Issue:** Fixture had `lastCommitAt, lastCommitMessage, gsdVersion, findings, dbAuditFindings` but actual schema has `stage1, stage2, dbAudit, tdd, verification, markers`
- **Fix:** Updated `makeOverview` to match the actual `ProjectOverview` type
- **Files modified:** `packages/spa/src/components/ProjectHeader.test.tsx`

## Known Stubs

The 8 `data-slot` elements in `SingleProjectView.tsx` are intentional scaffolding slots — not stubs in the problematic sense. Plans 05 and 06 explicitly own their replacement. The current plan's goal (route renders a real page with header + scaffolded columns) is achieved.

## Threat Flags

None. All 7 threats in the plan's threat model are mitigated:
- T-04-04-01: queryKey includes projectId + limit → cross-project isolation verified by Q11
- T-04-04-05: React text interpolation only in ProjectHeader → no raw HTML sinks
- All other threats inherit from daemon-side mitigations (Plans 02/03) and are not affected by this SPA plan.

## Self-Check: PASSED

- `packages/spa/src/lib/projectQueries.ts` — FOUND
- `packages/spa/src/lib/projectQueries.test.ts` — FOUND (18 tests)
- `packages/spa/src/components/ProjectLayout.tsx` — FOUND
- `packages/spa/src/components/ProjectLayout.test.tsx` — FOUND (3 tests)
- `packages/spa/src/components/ProjectHeader.tsx` — FOUND
- `packages/spa/src/components/ProjectHeader.test.tsx` — FOUND (9 tests)
- `packages/spa/src/components/SingleProjectView.tsx` — FOUND
- `packages/spa/src/components/SingleProjectView.test.tsx` — FOUND (7 tests)
- `packages/spa/src/routes/projects.$projectId.lazy.tsx` updated — FOUND
- `packages/spa/src/routes/projects.$projectId.test.tsx` updated — FOUND (4 tests)
- Commits fd8e424, c84e90a, 2dc8799, c8302ab, b94564f, cf703f9, 229d64a — all confirmed in git log
- `pnpm --filter @agenticapps/dashboard-spa test --run` exits 0 (340 tests)
- `pnpm -r typecheck` exits 0
- `pnpm -r build` exits 0
- `pnpm lint` exits 0 errors (4 warnings — all pre-existing or in test import order)
- `git diff packages/spa/src/components/Header.tsx` returns no output (global Header untouched)
