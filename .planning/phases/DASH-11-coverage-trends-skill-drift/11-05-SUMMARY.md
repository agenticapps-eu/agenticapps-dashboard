---
phase: 11-coverage-trends-skill-drift
plan: 05
subsystem: spa-skill-drift
tags: [spa, skill-drift, new-route, sidebar, tanstack-query, matrix, tdd]

# Dependency graph
requires:
  - phase: 11
    plan: 01
    provides: SkillDriftResponseSchema barrel-exported via @agenticapps/dashboard-shared
  - phase: 11
    plan: 03
    provides: GET /api/skills/drift + POST /api/skills/drift/agentlinter daemon endpoints
  - phase: 5
    provides: AgentLinterResponseSchema barrel-exported (reused — REVIEWS #10)
provides:
  - useSkillDrift({scope}) + useAgentLinterDrift TanStack Query hooks
  - SkillDriftCell presentational component
  - SkillDriftToolbar single-select scope chip (PD-11-03)
  - SkillDriftMatrix scope-driven rendering (family sections vs flat block)
  - SkillDriftPage composing PageHeader + Toolbar + Matrix
  - /observability/skill-drift route mounted under _appshell
  - Skill drift peer entry under Observability sidebar section (D-11-08)
affects: [11-06-polish-bundle-IMPECCABLE-critique]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single source of truth for scope (PD-11-03): URL → useSkillDriftScopeFromUrl() → scope → useSkillDrift({scope}) AND <SkillDriftMatrix scope={...} />"
    - "queryKey discrimination on scope: ['skillDrift', scope] so cross-scope URL navigation is cache-aware; daemon endpoint shape does NOT change"
    - "Single-select scope chip (PD-11-03) mirroring Phase 10's CoverageToolbar 200ms debounce + URL sync; 'family' default elides ?scope param"
    - "Four-family lock (D-11-04/D-11-06): FAMILIES = ['agenticapps','factiv','neuroflash','other']; empty families hidden in family scope (not shown as empty-state placeholders)"
    - "D-11-14 single-project-per-request enforced structurally via TS type (UseAgentLinterDriftVariables = { projectId: string }); body shape is EXACTLY {projectId}"
    - "REVIEWS #10 honoured: useAgentLinterDrift parses through SHARED AgentLinterResponseSchema from @agenticapps/dashboard-shared (no local copy; one place to drift)"
    - "REVIEWS #9 honoured: observabilitySkillDriftRoute mounts under _appshell via the existing parent route pattern (no inline if-branch extension)"
    - "D-11-08 honoured: Skill drift is the SECOND peer SidebarItem under Observability (not SidebarSubItem); matches user-memory feedback_sidebar_section_architecture"
    - "Defensive URL handling (T-11-05-07): useSkillDriftScopeFromUrl() validates against VALID_SCOPES and falls back to 'family' on missing/invalid values"

key-files:
  created:
    - packages/spa/src/lib/skillDriftQueries.ts
    - packages/spa/src/lib/skillDriftQueries.test.ts
    - packages/spa/src/components/panels/skill-drift/SkillDriftCell.tsx
    - packages/spa/src/components/panels/skill-drift/SkillDriftCell.test.tsx
    - packages/spa/src/components/panels/skill-drift/SkillDriftToolbar.tsx
    - packages/spa/src/components/panels/skill-drift/SkillDriftToolbar.test.tsx
    - packages/spa/src/components/panels/skill-drift/SkillDriftMatrix.tsx
    - packages/spa/src/components/panels/skill-drift/SkillDriftMatrix.test.tsx
    - packages/spa/src/components/panels/skill-drift/SkillDriftPage.tsx
    - packages/spa/src/components/panels/skill-drift/SkillDriftPage.test.tsx
    - packages/spa/src/routes/observability.skill-drift.lazy.tsx
  modified:
    - packages/spa/src/router.tsx
    - packages/spa/src/router.test.tsx
    - packages/spa/src/components/ui/Sidebar.tsx
    - packages/spa/src/components/ui/Sidebar.test.tsx

key-decisions:
  - "Scope model locked at PD-11-03: family sections (default) + cross-family flat view via single-select chip; daemon endpoint shape stays constant (one payload regardless of scope)"
  - "Skill drift sidebar icon: Layers (lucide-react) — distinguishable from Activity (Coverage) and visually evokes the per-skill stack across projects"
  - "Plan 05 page does NOT use the sticky PageHeader prop. Plan 06's PLI-03 opts /coverage in; the skill-drift route remains opt-out and Plan 06 may opt it in once the sticky-with-matrix-scroll behaviour has been verified"
  - "Page reads scope via useSkillDriftScopeFromUrl() and passes it to BOTH useSkillDrift({scope}) AND <SkillDriftMatrix scope=.../> — single source of truth eliminates the class of bugs where the hook and the matrix render disagree on which scope is active"
  - "Defensive scope normalization at the boundary (useSkillDriftScopeFromUrl): invalid URL values fall back silently to 'family' so the queryKey can never carry a malformed value (T-11-05-07 mitigation)"
  - "Matrix exposes per-cell 'Run AgentLinter' button (Play icon) rather than per-row — D-11-14 single-project-per-request is honoured by ONE projectId per mutation invocation"

patterns-established:
  - "TDD per component: write the test file first (RED — module-not-found), implement (GREEN); each component landed as its own commit pair where the test/code were authored in lockstep"
  - "Real TanStack Router harness in component tests (renderWithRouter): createRouter + createRoute + RouterProvider so URL sync paths are exercised end-to-end inside tests"
  - "Hoisted vi.mock for useAgentLinterDrift in SkillDriftMatrix.test.tsx and SkillDriftPage.test.tsx: factories run in module-init phase so SUT imports the mocked module"
  - "Component test scope: a presentational unit (SkillDriftCell) tests rendering output; an interactive unit (SkillDriftToolbar) tests router-integration end-to-end; a composite (SkillDriftMatrix) tests scope-driven branches"

requirements-completed: [SKD-01, SKD-02, SKD-03, SKD-04, SKD-05, INV-04]

# Metrics
duration: 14min
completed: 2026-05-16
---

# Phase 11 Plan 05: SPA Skill Drift Page Summary

**Lands the entire SPA-side Skill drift surface — `useSkillDrift({scope})` + `useAgentLinterDrift` hooks (REVIEWS #10 shared schema; PD-11-03 scope), `SkillDriftCell` / `SkillDriftToolbar` / `SkillDriftMatrix` / `SkillDriftPage` components, `/observability/skill-drift` route mount under `_appshell`, and the second peer SidebarItem under Observability (D-11-08). Closes SKD-01..05.**

## Performance

- **Duration:** ~14 min (2026-05-16T14:33:17Z → 2026-05-16T14:47:35Z)
- **Tasks:** 3 (TDD across 5 component pairs + 1 hook pair + 1 route + 1 sidebar extension)
- **Files created:** 11 (5 source components + 5 test files + 1 lazy route)
- **Files modified:** 4 (router.tsx, router.test.tsx, Sidebar.tsx, Sidebar.test.tsx)
- **Tests added:** 46 (15 hooks + 6 cell + 9 toolbar + 9 matrix + 6 page + 3 sidebar extension + 1 router extension)
- **Full SPA test suite after plan:** 865/865 green
- **SPA typecheck:** clean
- **Workspace typecheck:** clean (all 5 packages)
- **SPA build:** clean

## Accomplishments

### Hooks — `packages/spa/src/lib/skillDriftQueries.ts`

- **`useSkillDrift({scope})`** — TanStack Query hook. queryKey `['skillDrift', scope]` discriminates cross-scope cache entries; staleTime 30s (matches daemon memo); refetchInterval 5s (matches Phase 10 matrix surface); schema-drift surfaces as `isError` with `schema_drift:<path>` prefix via the `parseOrDrift` discriminator. Default `scope='family'` when no opts passed.
- **`useAgentLinterDrift()`** — TanStack Query mutation. Body is EXACTLY `{ projectId }` (D-11-14); parses response through the SHARED `AgentLinterResponseSchema` from `@agenticapps/dashboard-shared` (REVIEWS #10 — same import as Phase 5's `routes/agentlinter.ts`); `onSuccess` invalidates the `['skillDrift']` root queryKey so BOTH scope cache entries refetch.
- **`SkillDriftScope`** type exported (`'family' | 'cross'`).
- Positional `apiFetch(path, schema, init?)` call shape verified at every call site (per `c31951c` REVIEWS correction).

### Cell — `packages/spa/src/components/panels/skill-drift/SkillDriftCell.tsx`

Pure presentational. Three visual states:

- `present && version` → ✓ + version string
- `present && version === null` → ✓ + "version unknown" (dim `text-text-tertiary`)
- `!present` → dim ✕ (`text-text-tertiary`)

Aria-labels surface the full state for keyboard / screen-reader users navigating the dense matrix.

### Toolbar — `packages/spa/src/components/panels/skill-drift/SkillDriftToolbar.tsx`

- **`useSkillDriftScopeFromUrl()`** — single source of truth for scope. Reads `?scope=`, validates against `VALID_SCOPES = ['family','cross']`, falls back to `'family'` on missing/invalid values (T-11-05-07 mitigation).
- **`<SkillDriftToolbar />`** — single-select chip group `[ Per family ] [ Cross family ]` (PD-11-03); aria-pressed reflects active scope; click flips the URL `?scope=` param (elided when `family` is selected — `family` is the default). 200ms debounced search input mirroring Phase 10 `CoverageToolbar`.

### Matrix — `packages/spa/src/components/panels/skill-drift/SkillDriftMatrix.tsx`

Scope-driven rendering (PD-11-03):

- **`scope='family'`** — four-family fixed iteration order (`agenticapps / factiv / neuroflash / other`); empty families HIDDEN, not shown as empty placeholders.
- **`scope='cross'`** — single flat block, all projects flattened, columns sorted alphabetical by `projectId` (no family dividers).

Each (skill, project) cell renders `<SkillDriftCell />` + a per-cell "Run AgentLinter" button (Play icon) wired to `useAgentLinterDrift().mutate({ projectId })` — D-11-14 enforced structurally by the per-cell button being keyed off a single `projectId`.

Empty `rows: []` → "No skills detected" empty-state in BOTH scope modes.

### Page — `packages/spa/src/components/panels/skill-drift/SkillDriftPage.tsx`

Composes `PageHeader` + `SkillDriftToolbar` + `SkillDriftMatrix` plus loading/error/empty states. Scope flows in one place: `useSkillDriftScopeFromUrl() → scope` then `scope` is passed to BOTH `useSkillDrift({ scope })` and `<SkillDriftMatrix scope={scope} />`. Plan 05 deliberately does NOT enable the sticky `PageHeader` prop — Plan 06 owns route opt-ins for sticky.

### Route — `packages/spa/src/routes/observability.skill-drift.lazy.tsx` + `router.tsx`

- Lazy route mirrors `coverage.lazy.tsx` exactly: `createLazyRoute('/observability/skill-drift')({ component: SkillDriftPage })`.
- `router.tsx` adds `observabilitySkillDriftRoute` as a peer of `coverageRoute` under the `_appshell` parent route (REVIEWS #9 — uses the existing pattern; no inline if-branch extension).
- Registered in `appShellLayoutRoute.addChildren([...])` so the route inherits `AppShellV2` chrome.

### Sidebar — `packages/spa/src/components/ui/Sidebar.tsx`

The Observability section graduates from 1 entry (Coverage) to 2 peer entries (Coverage + Skill drift). Both use `SidebarItem` peer primitive (NOT `SidebarSubItem`). Icon for Skill drift is `Layers` from `lucide-react`. New Sidebar tests (S10/S11/S12) assert both items render, the ordering (Coverage first, Skill drift second), and that the Skill drift link carries the SidebarItem class signature.

## Task Commits

| Task | Subject | Hash |
| ---- | ------- | ---- |
| 1 RED   | `test(11-05): add failing tests for useSkillDrift({scope}) + useAgentLinterDrift (RED)` | `6703376` |
| 1 GREEN | `feat(11-05): implement useSkillDrift({scope}) + useAgentLinterDrift hooks (GREEN)` | `9f32281` |
| 2 Step A | `test+feat(11-05): add SkillDriftCell presentational component` | `656e694` |
| 2 Step B | `test+feat(11-05): add SkillDriftToolbar single-select scope chip + URL sync (PD-11-03)` | `5692edd` |
| 2 Step C | `test+feat(11-05): add SkillDriftMatrix with scope-driven rendering (PD-11-03)` | `aea6ce5` |
| 3 | `test+feat(11-05): add SkillDriftPage + mount /observability/skill-drift + Sidebar peer entry` | `0e79d3a` |

(Plan metadata commit + STATE.md/ROADMAP.md commit lands AFTER this SUMMARY at the orchestrator level — this worktree does NOT update STATE.md or ROADMAP.md.)

## REVIEWS.md Action Items Resolved

| # | Severity | Item | Resolution |
| --- | --- | --- | --- |
| 8 / PD-11-03 | LOW (gemini) / MEDIUM (codex) | Skill-drift scope model — pick one and propagate through hook, toolbar, matrix | LOCKED at planning time as PD-11-03: family sections (default) + cross-family flat view via single-select chip. Propagated through: `useSkillDrift({ scope })` signature (queryKey discrimination), `SkillDriftToolbar` single-select chip + `useSkillDriftScopeFromUrl()` URL helper, `SkillDriftMatrix` scope-driven branch (`scope === 'family'` vs `scope === 'cross'`), `SkillDriftPage` single source of truth (reads scope once, passes to both hook and matrix). |
| 9 | LOW | Route registration — no inline if-branch extension | `observabilitySkillDriftRoute` mounts under `_appshell` via the existing parent route pattern (`getParentRoute: () => appShellLayoutRoute`); registered as a peer of `coverageRoute` in `appShellLayoutRoute.addChildren([...])`. No conditional/if-branch extension required. RT5 test verifies the route ID is `/_appshell/observability/skill-drift`. |
| 10 | LOW | Reuse SHARED AgentLinterResponseSchema | `useAgentLinterDrift` imports `AgentLinterResponseSchema` from `@agenticapps/dashboard-shared` — same shared schema Phase 5's daemon-side `routes/agentlinter.ts` uses. T13 verifies a non-'ok' response (`kind: 'not-installed'`) parses successfully — a local hard-coded `{ ok: literal(true) }` schema would have rejected it. `grep -c "z.object.*ok: z.literal(true)|const AgentLinterDriftResponseSchema" packages/spa/src/lib/skillDriftQueries.ts` returns 0. |
| apiFetch shape (c31951c) | LOW | Positional `apiFetch(path, schema, init?)` | Verified at `packages/spa/src/lib/api.ts:61-65`. `useSkillDrift` calls `apiFetch('/api/skills/drift', SkillDriftResponseSchema)` (path, schema). `useAgentLinterDrift` calls `apiFetch('/api/skills/drift/agentlinter', AgentLinterResponseSchema, { method: 'POST', ... })` (path, schema, init). T14 spies on `fetch` and asserts string path + RequestInit body. |

## Decisions Made

- **PD-11-03 scope model — single source of truth.** Page reads scope via `useSkillDriftScopeFromUrl()` ONCE and passes it to BOTH `useSkillDrift({ scope })` and `<SkillDriftMatrix scope={scope} />`. The hook and the matrix can NEVER disagree on the active scope. Defensive normalization at the boundary means invalid URL values silently fall back to `'family'`.
- **D-11-14 enforced structurally — per-cell button.** Each (skill, project) cell exposes ONE "Run AgentLinter" button that fires `mutate({ projectId })` for THAT cell's project. There is no batch button. TypeScript prevents `projectIds: string[]` smuggling at the source; daemon route `.strict()` defense-in-depth on the receiving side.
- **D-11-08 honoured — Skill drift as SECOND peer SidebarItem under Observability.** Matches user-memory `feedback_sidebar_section_architecture` (peer entries under a growing section). Sidebar tests S10/S11/S12 lock the position and primitive choice.
- **Family enum surfaces all four values.** `FAMILIES = ['agenticapps','factiv','neuroflash','other']`. SDM7 explicitly verifies all four families render when populated; SDM8 verifies empty families are hidden in scope=`'family'`. The `'other'` bucket is a real runtime path on off-`~/Sourcecode/` registrations.
- **Icon choice for Skill drift sidebar entry.** `Layers` (lucide-react). Rationale captured in the comment block in `Sidebar.tsx`: visually evokes the per-skill stack across projects, and is distinguishable from `Activity` (Coverage's icon). Alternative candidates considered: `Boxes` (too object-y), `Network` (too topology-y), `GitCompare` (implies bidirectional comparison, misleads).
- **Sticky PageHeader opt-in deferred to Plan 06.** Plan 05's `SkillDriftPage` deliberately does NOT pass `sticky={true}` — the matrix has its own scroll behaviour and Plan 06 owns route opt-ins for sticky once the interaction has been validated for the skill-drift route specifically.

## Deviations from Plan

None — plan executed exactly as written.

One small typecheck adjustment landed silently: the `renderWithRouter` test harness in `SkillDriftToolbar.test.tsx` casts `Component: React.ComponentType` to `() => React.JSX.Element` before passing to `createRoute({ component: ... })` because TanStack Router's `RouteComponent` is stricter than `ComponentType`. This is test-only and confined to the harness (no public API surface).

## Issues Encountered

- **Initial `getByText(/agenticapps/i)` ambiguity in SkillDriftMatrix.test.tsx SDM1.** First draft used a regex match for the family-section header, but `'agenticapps'` appears in BOTH the family header AND project names like `'agenticapps-dashboard'`. Tightened the assertion to use the family section's `aria-label="<family> family skill drift"` selector — disambiguates the section header from project-name text content. Both `getByText` for exact strings (`'agenticapps'` as standalone span text) and `container.querySelector('[aria-label=...]')` work; the aria-label approach is more robust against future label changes.

## User Setup Required

None — pure SPA work; no daemon writes, no new external services. Reuses the Plan 11-03 daemon endpoints and the Phase 5 AgentLinter spawn surface (no new spawn surface introduced at the SPA layer).

## Threat Model Verification

| Threat ID | Mitigated by |
| --- | --- |
| T-11-05-01 | `parseOrDrift` discriminator in `useSkillDrift` queryFn — schema drift surfaces as `isError` with `schema_drift:<path>` (T6) |
| T-11-05-02 | TS type `UseAgentLinterDriftVariables = { projectId: string }` prevents arrays at compile time; T11 verifies body keys are EXACTLY `['projectId']`; daemon `.strict()` Zod defense-in-depth (Plan 11-03) |
| T-11-05-03 | Version strings rendered as JSX children inside SkillDriftCell — React text-escapes |
| T-11-05-04 | Per-cell "Run AgentLinter" button fires ONE mutation per click for ONE project. Server-side 30s timeout + cache absorbs repeat clicks. Bearer-auth at the route. |
| T-11-05-05 | RT5 verifies the route ID is `/_appshell/observability/skill-drift`; S10/S11 verify the Sidebar link `href` matches. TanStack Router validates the path literal at registration time. |
| T-11-05-06 | `AgentLinterResponseSchema` imported from `@agenticapps/dashboard-shared` — SAME schema the daemon uses. T13 exercises a non-'ok' response to ensure a hard-coded local schema would fail. `grep -c "z.object.*ok: z.literal(true)\|const AgentLinterDriftResponseSchema" packages/spa/src/lib/skillDriftQueries.ts` returns 0. |
| T-11-05-07 | `useSkillDriftScopeFromUrl()` validates against `VALID_SCOPES` and falls back to `'family'` for missing/invalid values. SDT9 explicitly seeds URL `?scope=bogus` and asserts the resolved scope is `'family'`. Invalid scope values never reach the hook's queryKey. |

## Notes for Plan 06 + IMPECCABLE critique

- **Plan 06 sticky-PageHeader opt-in.** `/observability/skill-drift` does NOT use the sticky `PageHeader` prop in Plan 05. Plan 06's PLI-03 currently opts `/coverage` into sticky at every render path; Plan 06 may optionally extend the same opt-in to `SkillDriftPage` once the sticky behaviour has been visually validated against the matrix's own scroll affordances.
- **IMPECCABLE critique (post-fix gate).** Two routes are now critique-worthy in Phase 11:
  - `/coverage` — with the new drift badge (Plan 11-04), opacity-30 row-refresh polish (PLI-02 D-11-10), and sticky PageHeader (PLI-03 D-11-09).
  - `/observability/skill-drift` — first critique (entirely new surface from this plan).

  Both should be captured in `11-IMPECCABLE.md` at the post-fix gate. The composite floor ≥ 87 (D-10.5-03) applies; Phase 11 is calibration data point #2.

## Next Plan Readiness

- **Plan 11-06 (polish bundle):** unaffected by this plan; Plan 06's PLI-03 sticky opt-in already landed before this plan's branch. Plan 06 may optionally extend sticky opt-in to `SkillDriftPage` post-merge if visual validation passes.
- **Plan 11 IMPECCABLE critique:** ready. Both `/coverage` and `/observability/skill-drift` are critique-ready; daemon endpoints are live; UI surface is complete.

## Threat Flags

(none — Plan 05 does not introduce any new trust surface beyond what Plan 03 already mitigates; all routes already require bearer auth via `apiFetch`)

## Self-Check: PASSED

Verification (commands run from this worktree's repo root):

- `[FOUND]` `packages/spa/src/lib/skillDriftQueries.ts` exists
- `[FOUND]` `packages/spa/src/lib/skillDriftQueries.test.ts` exists
- `[FOUND]` `packages/spa/src/components/panels/skill-drift/SkillDriftCell.tsx` exists
- `[FOUND]` `packages/spa/src/components/panels/skill-drift/SkillDriftCell.test.tsx` exists
- `[FOUND]` `packages/spa/src/components/panels/skill-drift/SkillDriftToolbar.tsx` exists
- `[FOUND]` `packages/spa/src/components/panels/skill-drift/SkillDriftToolbar.test.tsx` exists
- `[FOUND]` `packages/spa/src/components/panels/skill-drift/SkillDriftMatrix.tsx` exists
- `[FOUND]` `packages/spa/src/components/panels/skill-drift/SkillDriftMatrix.test.tsx` exists
- `[FOUND]` `packages/spa/src/components/panels/skill-drift/SkillDriftPage.tsx` exists
- `[FOUND]` `packages/spa/src/components/panels/skill-drift/SkillDriftPage.test.tsx` exists
- `[FOUND]` `packages/spa/src/routes/observability.skill-drift.lazy.tsx` exists
- `[FOUND]` `packages/spa/src/router.tsx` extended (observabilitySkillDriftRoute + addChildren entry)
- `[FOUND]` `packages/spa/src/router.test.tsx` extended (RT5)
- `[FOUND]` `packages/spa/src/components/ui/Sidebar.tsx` extended (Layers import + Skill drift SidebarItem)
- `[FOUND]` `packages/spa/src/components/ui/Sidebar.test.tsx` extended (S10/S11/S12)
- `[FOUND]` commit `6703376` (Task 1 RED)
- `[FOUND]` commit `9f32281` (Task 1 GREEN)
- `[FOUND]` commit `656e694` (Task 2 Step A — SkillDriftCell)
- `[FOUND]` commit `5692edd` (Task 2 Step B — SkillDriftToolbar)
- `[FOUND]` commit `aea6ce5` (Task 2 Step C — SkillDriftMatrix)
- `[FOUND]` commit `0e79d3a` (Task 3 — Page + route + Sidebar)
- `[PASS]` 865/865 SPA vitest cases green (`pnpm --filter @agenticapps/dashboard-spa test --run`)
- `[PASS]` SPA typecheck clean (`pnpm --filter @agenticapps/dashboard-spa typecheck`)
- `[PASS]` workspace-wide typecheck clean (`pnpm -r typecheck` — all 5 packages)
- `[PASS]` SPA build clean (`pnpm --filter @agenticapps/dashboard-spa build`)
- `[PASS]` `grep -c "queryKey: \[.skillDrift., scope" packages/spa/src/lib/skillDriftQueries.ts` returns 1 (PD-11-03 scope-discriminated queryKey)
- `[PASS]` `grep -cE "z\.object.*ok: z\.literal\(true\)|const AgentLinterDriftResponseSchema" packages/spa/src/lib/skillDriftQueries.ts` returns 0 (REVIEWS #10 — no local schema)
- `[PASS]` `grep -c "30 \* 1000" packages/spa/src/lib/skillDriftQueries.ts` returns 1 (30s staleTime constant)
- `[PASS]` `grep -c "projectIds" packages/spa/src/lib/skillDriftQueries.ts` returns 0 (D-11-14)
- `[PASS]` `grep -c "invalidateQueries" packages/spa/src/lib/skillDriftQueries.ts` returns 2
- `[PASS]` `grep -cE "apiFetch\(" packages/spa/src/lib/skillDriftQueries.ts` returns 3 (1 jsdoc/sig ref + 2 call sites)
- `[PASS]` `grep -c "export type SkillDriftScope" packages/spa/src/lib/skillDriftQueries.ts` returns 1
- `[PASS]` `grep -c "to=\"/observability/skill-drift\"" packages/spa/src/components/ui/Sidebar.tsx` returns 1
- `[PASS]` `awk '/label="Observability"/,/<\/SidebarSection>/' packages/spa/src/components/ui/Sidebar.tsx | grep -c "<SidebarSubItem"` returns 0 (SidebarItem peer primitive correctness)
- `[PASS]` `grep -cE "#[0-9a-fA-F]{3,8}" packages/spa/src/components/panels/skill-drift/*.tsx` returns 0 across all 5 files (no hex literals — D-5.1-10)
- `[PASS]` `grep -c "useSkillDriftScopeFromUrl" packages/spa/src/components/panels/skill-drift/SkillDriftPage.tsx` returns 3 (page reads scope from URL — PD-11-03)

---
*Phase: 11-coverage-trends-skill-drift*
*Completed: 2026-05-16*
