---
phase: 10
plan: "01"
subsystem: shared-schemas
tags:
  - coverage-matrix
  - zod-schemas
  - tdd-scaffold
  - codex-fixes
dependency_graph:
  requires: []
  provides:
    - CoverageResponseSchema
    - CoverageRowSchema
    - CoverageWorkflowColumnSchema (discriminated union)
    - CoverageRefreshRequestSchema
    - CoverageRefreshResponseSchema
    - clipboard builders (shared)
    - 21 test scaffold files (18 daemon todos + 3 RED, 8 SPA todos)
  affects:
    - packages/shared/src/index.ts
    - packages/agent (consumes schemas in Plans 02-04)
    - packages/spa (consumes schemas in Plans 05-06)
tech_stack:
  added:
    - "CoverageStateSchema: z.enum(['fresh','stale','missing','not-applicable'])"
    - "CoverageFamilySchema: z.enum(['agenticapps','factiv','neuroflash'])"
    - "CoverageBasicColumnSchema: z.object({kind:'basic',...})"
    - "CoverageWorkflowColumnSchema: z.object({kind:'workflow',installedVersion,headVersion,detail,...})"
    - "CoverageColumnStateSchema: z.discriminatedUnion('kind',[basic,workflow])"
    - "CoverageRowSchema: z.object (NO absPath — CODEX HIGH-1)"
    - "CoverageResponseSchema: z.object({schemaVersion:z.literal(1),...})"
    - "CoverageRefreshActionSchema: z.enum(['gitnexus-analyze']) only"
    - "CoverageRefreshRequestSchema: z.object({family,repo,action})"
    - "CoverageRefreshResponseSchema: z.discriminatedUnion('ok',[ok,fail])"
    - "clipboard.ts: 4 pure string builder functions"
  patterns:
    - "Discriminated union on 'kind' for column type narrowing"
    - "Discriminated union on 'ok' for required updatedRow on success"
    - "Zod literal(1) for schemaVersion lock"
    - "it.todo() scaffolding pattern for Wave 0 test pyramid"
key_files:
  created:
    - packages/shared/src/schemas/coverage.ts
    - packages/shared/src/schemas/coverage.test.ts
    - packages/shared/src/clipboard.ts
    - packages/shared/src/clipboard.test.ts
    - packages/agent/src/lib/scanners/claudeMdScanner.test.ts
    - packages/agent/src/lib/scanners/gitNexusScanner.test.ts
    - packages/agent/src/lib/scanners/wikiScanner.test.ts
    - packages/agent/src/lib/scanners/workflowVersionScanner.test.ts
    - packages/agent/src/lib/scanners/overrideSentinelScanner.test.ts
    - packages/agent/src/lib/repoDiscovery.test.ts
    - packages/agent/src/lib/coverageCache.test.ts
    - packages/agent/src/lib/coverageScan.test.ts
    - packages/agent/src/lib/coverageSpawn.test.ts
    - packages/agent/src/routes/coverage.test.ts
    - packages/spa/src/lib/coverageQueries.test.ts
    - packages/spa/src/components/panels/coverage/CoveragePage.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageToolbar.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageFamilySection.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageRow.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageCell.test.tsx
    - packages/spa/src/components/panels/coverage/OverrideChip.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageEmptyState.test.tsx
  modified:
    - packages/shared/src/index.ts
decisions:
  - "CoverageRefreshActionSchema locked to 'gitnexus-analyze' only (D-10-09 + CODEX HIGH-5); wiki/CLAUDE.md/workflow-update are SPA-side clipboard only — rejected at Zod parse"
  - "CoverageWorkflowColumnSchema is a discriminated union carrying installedVersion + headVersion + detail for 5 sub-states (CODEX HIGH-4)"
  - "Public CoverageRowSchema has NO absPath field; internal daemon type InternalCoverageRow (Plan 03) carries it and strips before emission (CODEX HIGH-1)"
  - "updatedRow is REQUIRED on CoverageRefreshResponseSchema when ok=true, via discriminated union (CODEX HIGH-5)"
  - "Clipboard builders in shared/clipboard.ts imported by both SPA and daemon tests; no duplication (CODEX MED-13)"
  - "CoverageGitNexusBanner.test.tsx NOT created; per-family install hint moves into CoverageFamilySection header (CODEX HIGH-6 Option A)"
metrics:
  duration: "~20min"
  completed: "2026-05-13"
  tasks: 3
  files: 23
---

# Phase 10 Plan 01: Coverage Matrix — Shared Schemas + Test Scaffold Summary

Wire contract for Phase 10 locked: 4 Zod schemas with discriminated unions (CODEX HIGH-1/4/5 fixes), 4 clipboard builders centralized in shared (CODEX MED-13), and 21 test scaffold files spanning daemon scanners/orchestrator/route and SPA query hooks/panels.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | coverage.ts + clipboard.ts + tests GREEN | cee69fd | coverage.ts, coverage.test.ts, clipboard.ts, clipboard.test.ts, index.ts |
| 2 | Daemon test scaffold (10 files, 56 todos, 3 RED) | d16d160 | 10 agent test files |
| 3 | SPA test scaffold (8 files, 49 todos) | 9898bd7 | 8 spa test files |

## Schema Shape Summary

### CoverageResponseSchema (top-level)
```
{
  schemaVersion: z.literal(1),        // literal lock for drift detection
  generatedAtIso: string,
  gitNexusInstalled: boolean,         // per-family install hint signal
  workflowHeadVersion: string | null,
  rows: CoverageRow[]
}
```

### CoverageRowSchema (PUBLIC — NO absPath)
```
{
  family: 'agenticapps' | 'factiv' | 'neuroflash',
  repo: string,
  claudeMd: CoverageBasicColumnSchema,   // kind: 'basic'
  gitNexus: CoverageBasicColumnSchema,   // kind: 'basic'
  wiki: CoverageBasicColumnSchema,       // kind: 'basic'
  workflowVersion: CoverageWorkflowColumnSchema,  // kind: 'workflow'
  overrideCount: number,
  overrides: OverrideEntry[],
  degraded?: { reason: string }          // AGREED-2 partial-failure
}
```

### CoverageWorkflowColumnSchema (CODEX HIGH-4 — 5 sub-states)
```
{
  kind: 'workflow',
  state: 'fresh' | 'stale' | 'missing' | 'not-applicable',
  installedVersion: string | null,
  headVersion: string | null,
  detail: 'equal' | 'behind' | 'ahead' | 'version-unknown' | 'skill-missing',
  degraded?: boolean,
  degradedReason?: string
}
```

### CoverageRefreshActionSchema (CODEX HIGH-5 lock)
```
z.enum(['gitnexus-analyze'])   // ONLY value; wiki-compile/workflow-update are SPA clipboard only
```

### CoverageRefreshResponseSchema (CODEX HIGH-5 required updatedRow)
```
Discriminated union on 'ok':
  ok=true: { ok: true, kind: 'ok', updatedRow: CoverageRow }   // updatedRow REQUIRED
  ok=false: { ok: false, kind: 'not-installed'|'timeout'|'error', exitCode?, stderr? }
```

## Test Summary

| Package | Files | Tests | State |
|---------|-------|-------|-------|
| shared | 2 | 32 schema + 6 clipboard = 38 | All GREEN |
| agent | 10 | 56 todos + 3 genuinely-failing RED | RED (expected — Plans 02-04 resolve) |
| spa | 8 | 49 todos | All pending (Plans 05-06 resolve) |

### 3 Genuinely-Failing RED Tests (CODEX LOW-20 fix)

1. `coverageSpawn.test.ts — NEVER includes npx in spawnGitNexusAnalyze argv (D-5-21)` — fails at import until Plan 03 creates `coverageSpawn.ts`
2. `coverage.route.test.ts — GET /api/coverage response NEVER contains absPath (CODEX HIGH-1)` — fails at import until Plans 03+04 implement the route
3. `coverage.route.test.ts — POST /api/coverage/refresh with action=wiki-compile returns 400 (CODEX HIGH-5 + D-10-09)` — fails at import until Plan 04 implements schema rejection

## Deviations from Plan

None — plan executed exactly as written.

CODEX amendments from 10-REVIEWS.md all encoded:
- CODEX HIGH-1: absPath absent from coverage.ts (0 grep hits confirmed)
- CODEX HIGH-4: discriminatedUnion('kind') in CoverageColumnStateSchema
- CODEX HIGH-5: discriminatedUnion('ok') for required updatedRow; wiki-compile enum rejection
- CODEX HIGH-6 Option A: CoverageGitNexusBanner.test.tsx NOT created
- AGREED-1: wikiScanner predicate verbatim in test description
- AGREED-2: degraded markers on both rows and columns
- AGREED-3: discoverRepos() TOCTOU todo in coverage.route.test.ts
- AGREED-4: batch-progress state for RefreshAllStaleButton in CoveragePage.test.tsx
- CODEX MED-12: frontmatter name check todo in workflowVersionScanner.test.ts
- CODEX MED-13: clipboard builders in shared/clipboard.ts (no duplication)
- CODEX MED-15: TanStack Router integration test todo in CoverageToolbar.test.tsx
- CODEX LOW-19: performance todo in coverageScan.test.ts
- CODEX LOW-20: 3 genuinely-failing RED tests (not it.todo)

## Known Stubs

None — this plan creates schemas and test scaffolds only. No UI rendering, no data wiring.

## Threat Flags

No new threat surface introduced. Schema layer only; no new network endpoints, auth paths, or file access patterns.

## Self-Check: PASSED

- packages/shared/src/schemas/coverage.ts: EXISTS
- packages/shared/src/clipboard.ts: EXISTS
- packages/shared/src/schemas/coverage.test.ts: EXISTS (32 it() tests GREEN)
- packages/shared/src/clipboard.test.ts: EXISTS (6 it() tests GREEN)
- All 10 daemon scaffold files: EXISTS
- All 8 SPA scaffold files: EXISTS
- CoverageGitNexusBanner.test.tsx: CORRECTLY ABSENT

Commits verified:
- cee69fd: feat(10-01) schemas + clipboard
- d16d160: test(10-01) daemon scaffold
- 9898bd7: test(10-01) SPA scaffold
