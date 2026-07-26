---
phase: 05-skills-health-panels
plan: 04
subsystem: spa-panels
tags: [spa, react, tanstack-query, panels, skills, agentlinter, tdd, wave-2]
dependency_graph:
  requires:
    - 05-01 (GlobalSkillsResponseSchema, LocalSkillsResponseSchema, AgentLinterResponseSchema)
    - 05-02 (GET /api/skills/global, GET /api/projects/:id/skills/local, GET /api/projects/:id/agentlinter)
  provides:
    - useGlobalSkills() hook
    - useLocalSkills(id) hook
    - useAgentLinter(id) hook
    - InstalledSkills panel (HEALTH-01)
    - SkillHealth panel (HEALTH-02)
  affects:
    - plan 05-05 (can extend projectQueries.ts with useObservability/useSecrets/useIntegrations)
    - plan 05-06 (SingleProjectView.tsx wires the panels into the health column)
tech_stack:
  added: []
  patterns:
    - TanStack Query useQuery with per-project id in queryKey (cross-project cache safety)
    - apiFetch + parseOrDrift pattern (schema-drift throws Error('schema_drift:path'))
    - React useState<Set<string>> for multi-row expand (no accordion constraint)
    - Direct apiFetch + queryClient.setQueryData for bypassCache=1 retry (outside TanStack Query)
    - vi.mock for panel component tests isolating hooks
key_files:
  created:
    - packages/spa/src/components/panels/InstalledSkills.tsx
    - packages/spa/src/components/panels/InstalledSkills.test.tsx
    - packages/spa/src/components/panels/SkillHealth.tsx
    - packages/spa/src/components/panels/SkillHealth.test.tsx
  modified:
    - packages/spa/src/lib/projectQueries.ts
    - packages/spa/src/lib/projectQueries.test.ts
decisions:
  - "Cross-project cache test: useLocalSkills('acme') + useLocalSkills('beta') produce distinct queryClient entries (T-05-04-Cross-Project-Cache proven by test)"
  - "Severity glyph asymmetry: SkillHealth uses 3-of-4 glyphs (error->red, warning->orange, info->white-circle); yellow-circle unused — honest reflection of AgentLinter 3-value severity vocabulary"
  - "Retry bypassCache wiring: direct apiFetch with bypassCache=1 query param + queryClient.setQueryData — not via TanStack Query meta; avoids query key mutation and keeps cache update explicit"
  - "report.score is project-level (single badge above per-file rows) — AgentLinter scores the whole project, not per-file; per-file rows show diagnostics count only"
metrics:
  duration: "~9 minutes"
  completed: "2026-05-07"
  tasks: 3
  files_created: 4
  files_modified: 2
  tests_added: 56
---

# Phase 05 Plan 04: InstalledSkills + SkillHealth Panels Summary

**One-liner:** 3 TanStack Query hooks (useGlobalSkills/useLocalSkills/useAgentLinter) plus InstalledSkills and SkillHealth panels with full state coverage — loading, schema-drift, unreachable, empty, and all 5 AgentLinter outcome kinds.

---

## What Was Built

### Task 1: 3 New Query Hooks (TDD — 13 new tests, 31 total in file)

Three hooks appended to `packages/spa/src/lib/projectQueries.ts` (existing 5 hooks unchanged):

| Hook | Query Key | staleTime | refetchInterval | Notes |
|------|-----------|-----------|-----------------|-------|
| `useGlobalSkills()` | `['skills', 'global']` | 60s | 60s | Singleton — no projectId (D-5-12) |
| `useLocalSkills(id)` | `['skills', 'local', id]` | 60s | 60s | Per-project; id in key (T-05-04) |
| `useAgentLinter(id)` | `['agentlinter', id]` | 1h | none | Manual retry only (D-5-14/D-5-15) |

Cross-project cache isolation test: renders `useLocalSkills('acme')` and `useLocalSkills('beta')` in same QueryClient; asserts the two cache entries are distinct. Threat T-05-04-Cross-Project-Cache proven by tests.

### Task 2: InstalledSkills Panel (TDD — 11 tests)

`packages/spa/src/components/panels/InstalledSkills.tsx`:

- Calls `useGlobalSkills()` + `useLocalSkills(projectId)` in parallel
- Merge + sort: globals first (alphabetical by `dir`), then locals (alphabetical by `dir`)
- Scope pills: `inline-flex rounded bg-[--surface-elevated] px-1.5 py-0.5 text-xs uppercase tracking-wide text-[--text-muted]`
- Multi-line description: renders only first non-empty line via `.split('\n').find(l => l.trim().length > 0)`
- Empty state copy verbatim (UI-SPEC §Copywriting line 395):
  > No skills installed. Install with `claude skill install <name>` or place a SKILL.md under `~/.claude/skills/`.
- 4 states: loading, schema-drift (InlineDrift), unreachable, happy-path/empty

### Task 3: SkillHealth Panel (TDD — 14 tests)

`packages/spa/src/components/panels/SkillHealth.tsx`:

- All 5 `kind` branches handled explicitly
- Happy path: project-level `{score}/100` badge above per-file rows, color-coded by threshold (>=90 success, 60-89 text, <60 warning)
- Row expansion: `useState<Set<string>>` — multiple rows expand simultaneously (no accordion)
- Accessibility: `aria-expanded`, `aria-controls`, `role="region"` on detail block, Esc to collapse
- Retry button: 44x44 touch target, calls `apiFetch` with `?bypassCache=1` directly + `queryClient.setQueryData`

---

## Cross-Project Cache Test Outcome

Two `useLocalSkills` hook renders with distinct ids produce distinct cache entries:

```typescript
qc.getQueryData(['skills', 'local', 'acme']) === acme skills data
qc.getQueryData(['skills', 'local', 'beta']) === beta skills data
// confirmed not equal — no cross-project leakage
```

Same pattern proven for `useAgentLinter`. `useGlobalSkills` has no projectId by design (singleton).

---

## Severity Glyph Asymmetry Note

SkillHealth uses 3 of Phase 4 D-4-16's 4 glyphs:

| AgentLinter severity | Glyph | Phase 4 D-4-16 bucket |
|---------------------|-------|-----------------------|
| `error` | red circle | critical |
| `warning` | orange circle | high |
| `info` | white circle | low |
| (none) | yellow circle | **unused — AgentLinter emits only 3 severities** |

This is the correct resolution for UI-SPEC §Open Question 3: keep 3-of-4 mapping, do NOT introduce a synthetic 4th AgentLinter signal source.

---

## Retry-Button bypassCache Wiring

Pattern: direct `apiFetch` call (outside TanStack Query) with `?bypassCache=1` in the URL, then `queryClient.setQueryData` to update the cache.

```typescript
const result = await apiFetch(
  `/api/projects/${projectId}/agentlinter?bypassCache=1`,
  AgentLinterResponseSchema,
)
if (result.ok) {
  queryClient.setQueryData(['agentlinter', projectId], result.data)
}
```

Avoids query key mutation; keeps cache update explicit. The daemon's `bypassCache=1` handler skips both read and write of the cache (one-call skip per D-5-15 — confirmed in plan 02 task 3).

---

## Score Rendering: Project-Level (Single Badge)

`report.score` is rendered once as a project-level badge above the per-file rows. AgentLinter scores the whole project — per-file rows only show per-file diagnostics count. This matches the `AgentLinterReportSchema` which has one top-level `score` field.

---

## UI-SPEC Copy Verification

All 4 failure-class copy strings match UI-SPEC §Copywriting verbatim:
- `not-installed`: "AgentLinter not installed. Install with..."
- `timeout`: "Lint scan timed out after 30 seconds."
- `error`: "Lint scan failed." + stderr + "Exit code: {N}"
- `unparseable`: "Lint scan failed (exit {N}) — see daemon log."

Minor layout deviation in `not-installed`: copy split into 3 separate `<p>` elements around the `CodeBlock` rather than one inline paragraph — cleaner visual separation.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test SH11/SH12: getByRole button query using wrong name**
- Found during: Task 3 GREEN run (2 tests failing of 14)
- Issue: `getByRole('button', { name: /Retry scan/i })` does not match. The button's accessible name (from `aria-label`) is the full string "Retry agentlinter scan, bypassing cache", not "Retry scan"
- Fix: Updated tests SH11 and SH12 to use `{ name: /Retry agentlinter scan/i }` matching the aria-label, plus `getByText('Retry scan')` for the visible label assertion
- Files modified: `packages/spa/src/components/panels/SkillHealth.test.tsx`

---

## Known Stubs

None — both panels are fully wired to real hooks consuming real daemon endpoints (shipped in plan 02). No hardcoded empty values in rendering paths.

---

## Threat Flags

None new beyond the plan's threat model. All T-05-04 mitigations implemented and proven:

| Threat | Mitigation | Proof |
|--------|-----------|-------|
| T-05-04-Cross-Project-Cache | projectId in queryKey for per-project hooks | Cross-project cache test |
| T-05-04-Schema-Drift | apiFetch throws schema_drift: prefix, panel renders InlineDrift | Dedicated test per hook + per panel |
| T-05-04-Markdown-Injection | All daemon strings rendered as React text children — no raw HTML injection | Code review + all tests use text assertions |
| T-05-04-Cache-Bypass-Privacy | bypassCache=1 bypasses cache only, not --local flag | Documented; daemon invariant proven in plan 02 |

---

## Self-Check: PASSED

Files on disk:
- FOUND: packages/spa/src/components/panels/InstalledSkills.tsx
- FOUND: packages/spa/src/components/panels/InstalledSkills.test.tsx
- FOUND: packages/spa/src/components/panels/SkillHealth.tsx
- FOUND: packages/spa/src/components/panels/SkillHealth.test.tsx
- FOUND: packages/spa/src/lib/projectQueries.ts (3 new exports appended)
- FOUND: packages/spa/src/lib/projectQueries.test.ts (13 new tests appended)

Commits:
- `4854dd7` feat(05-04): add useGlobalSkills + useLocalSkills + useAgentLinter hooks
- `111aa8e` feat(05-04): InstalledSkills panel — global+local merge, scope pills, sort, empty state
- `e032a99` feat(05-04): SkillHealth panel — 5 kind states, row-expand interaction, retry button

Tests: 56 new tests (31 projectQueries + 11 InstalledSkills + 14 SkillHealth), all green.
pnpm -r typecheck: passes across all 4 packages.
