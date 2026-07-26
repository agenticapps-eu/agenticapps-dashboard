# Phase 4: Single-project View — Discipline + Phase Progress — Research

**Researched:** 2026-05-06
**Domain:** Hono daemon routes (Node 20 + FS/git parsing) + React SPA panels (TanStack Query + Tailwind v4)
**Confidence:** HIGH — all key findings verified directly against codebase; no material unknowns remain

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-4-01 — Panel-split daemon endpoints:**
- `GET /api/projects/:id/commitment` → `{ markdown: string|null, sourceFile: string|null }`
- `GET /api/projects/:id/observations/recent?limit=20` → `{ entries: HookFiring[], skillInstalled: boolean }`
- `GET /api/projects/:id/phase-progress` → `{ phase, files, tdd: { greenPairs, totalTasks, timeline[] }, review, verification }`
- `GET /api/projects/:id/security` → `{ cso: CsoSummary|null, dbSentinel: DbSentinelSummary|null }`
- `GET /api/projects/:id/discipline` → `{ rationalization: { rows: { label, fires }[] } }`
- Each route has its own 5s daemon memo.

**D-4-02 — 5s polling + 5s daemon memo + `refetchIntervalInBackground: false`.** Inherits Phase 3 D-02/D-03 verbatim.

**D-4-03 — Reuse/extend `lib/projectOverview.ts`.** Phase 4 adds parsers in the same file or sibling `lib/phaseDetail.ts`. New functions: `parseCommitmentBlock`, `readSkillObservations`, `parseRationalizationRows`, `parsePhaseChecklist`, `parseExecutionTimeline`, `parseSecurityReports`.

**D-4-04 — Daemon cache key = `${projectId}:${route}`.** Lazy eviction on read. No background sweeper.

**D-4-05 — CommitmentBlock source = latest `.planning/skill-observations/*.md` by mtime.** Algorithm: readdir → filter `.md` → pick highest mtimeMs → find LAST `^## Workflow commitment\s*$` → return to next `^## ` or EOF.

**D-4-06 — `HookFiringSchema` = `z.object({ ts, skill, hook }).passthrough()`.** Unknown fields from future meta-observer releases are preserved but not rendered.

**D-4-07 — `RationalizationFires` row labels read at request time from `.claude/skills/agenticapps-workflow/skill/SKILL.md`.** Self-updating; no version coupling. Table heading confirmed: `## Rationalization Table — Check Before Skipping Anything`.

**D-4-08 — HookFirings recency = last 20 lines globally across all `.jsonl` by line `ts` desc.** Streaming read via `node:readline` per file; merge top-N with a small heap.

**D-4-09 — 2-column grid now.** `grid-template-columns: 1fr 1.5fr`. Phase 5 adds `1fr 1.5fr 1fr`.

**D-4-10 — Header = single line.** Format: `← All Projects · {name}({client?}) · {branch??'(no branch)'} · phase {paddedPhase} — {status}`. No Linear badge, no ADR line.

**D-4-11 — One component per panel** under `packages/spa/src/components/panels/`.

**D-4-12 — Replace `routes/projects.$projectId.lazy.tsx` body** with `<SingleProjectView projectId={projectId} />`.

**D-4-13 — Always-expanded panels.** No progressive disclosure, no max-height clamp, no animation.

**D-4-14 — Per-panel empty states render with explicit copy.** No skeletons, no hide-on-empty.

**D-4-15 — DISC-04 install hint.** `{ entries: [], skillInstalled: false }` triggers HookFirings install hint. Canonical install command: `claude skill install meta-observer` (from UI-SPEC copy contract).

**D-4-16 — ReviewStatus reads from latest phase only.** Reuses Phase 3 `parseReviewFile`.

### Claude's Discretion

- TanStack Query cache key shapes (suggested: `['commitment', id]`, `['observations', id]`, `['phase-progress', id]`, `['security', id]`, `['discipline', id]`).
- Daemon cache structure: single `Map<string, { value, expiresAt }>` keyed by `${projectId}:${route}` vs five separate maps.
- `parseExecutionTimeline` task grouping regex: task ID from commit subject like `test(03-03):` — group key `03-03`.
- PhaseProgress canonical file order (resolved in UI-SPEC: CONTEXT → RESEARCH → UI-SPEC → DISCUSSION-LOG → plan/summary pairs → REVIEW → REVIEW-FIX → SECURITY → IMPECCABLE → VERIFICATION → HUMAN-UAT).
- `PhaseFileStatusSchema` exact field names.
- `HookFiringSchema` payload field shape (stay tolerant / passthrough).
- `navigator.clipboard.writeText` fallback path.
- Test layout per package.

### Deferred Ideas (OUT OF SCOPE)

- Right column (HEALTH-01..05) — Phase 5.
- Header line 2 (Linear badge, ADR-touched, settings link) — Phase 5/6.
- `POST /api/projects/{id}/open` editor spawn — Phase 5/6.
- Sub-route `/projects/{id}/settings` — Phase 6.
- `impeccable:critique` ≥ 90 hard gate — Phase 6.
- Hover-expand on panels — explicitly rejected.
- Pagination/virtualisation for HookFirings — never needed (capped at 20).
- Persistence of UI state across sessions — Phase 6.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-01 | CommitmentBlock panel: last `## Workflow commitment` block from skill-observations | D-4-05; `parseCommitmentBlock` logic documented below |
| DISC-02 | HookFirings panel: last 20 entries from `.planning/skill-observations/` | D-4-06, D-4-08; streaming JSONL merge documented |
| DISC-03 | RationalizationFires panel: counter per SKILL.md rationalization row | D-4-07; table heading verified in SKILL.md |
| DISC-04 | Meta-observer install hint when skill absent | D-4-15; `skillInstalled: boolean` in observations response |
| PHASE-01 | PhaseProgress: file-by-file checklist of latest phase | D-4-03; `findLatestPhaseDir` already exists; canonical file order in UI-SPEC |
| PHASE-02 | ExecutionTimeline: TDD red/green commit pairs grouped per task | `parseTddPairs` extended; regex `(\d{2}-\d{2})` extracts task ID from `test(03-03):` subjects |
| PHASE-03 | ReviewStatus: Stage 1/2 status, finding counts by severity | `parseReviewFile` already exists; reuse confirmed |
| PHASE-04 | SecurityStatus: `/cso` + database-sentinel summary | `parseSecurityReports` new parser; reads `*-SECURITY.md` from latest phase dir |
| PHASE-05 | VerificationStatus: must_haves vs evidence count | `parseVerification` already exists; reuse confirmed |
</phase_requirements>

---

## Summary

Phase 4 adds the `/projects/{id}` detail view with Discipline (left) and Phase Progress (center) columns. All locked decisions from CONTEXT.md (D-4-01 through D-4-16) are fully researched and actionable. **No blockers found.**

The codebase is well-prepared: `projectOverview.ts` already has `findLatestPhaseDir`, `parseReviewFile`, `parseVerification`, `parseTddPairs`, and `detectBranch`. The route/cache/outbound pattern is battle-tested from Phase 3. All SPA infrastructure (TanStack Query, `apiFetch`, `SchemaDriftState`, `CodeBlock`, `AppShell`, layout width override) is in place and verified.

The biggest previously open question — **meta-observer JSONL format and availability** — is resolved: the meta-observer skill does not yet exist on any registered project (confirmed: no `.jsonl` files in any `skill-observations` directory, and `~/.claude/skills` has no meta-observer entry). Phase 4 implements the CONSUMER side only, gracefully surfacing the `skillInstalled: false` empty state per D-4-15. The JSONL schema (`ts`, `skill`, `hook`, passthrough) is designed to tolerate future meta-observer releases.

**Primary recommendation:** Wave 0 (shared schemas + failing tests), then Wave 1 (daemon parsers + routes), then Wave 2 (SPA panels + query hooks), then Wave 3 (integration + pre-flight). Follows the established Phase 3 wave structure.

---

## Key Findings

### What is already in place [VERIFIED: codebase]

| Asset | Location | Status |
|-------|----------|--------|
| `findLatestPhaseDir()` | `packages/agent/src/lib/projectOverview.ts:41` | Exists — highest-numbered phase dir by leading integer |
| `parseReviewFile()` | `packages/agent/src/lib/projectOverview.ts:70` | Exists — frontmatter + `<finding severity>` fallback |
| `parseVerification()` | `packages/agent/src/lib/projectOverview.ts:127` | Exists — bold-bullet + `**Evidence` count |
| `parseTddPairs()` | `packages/agent/src/lib/projectOverview.ts:151` | Exists — scans `git log --format=%s` for RED/GREEN |
| `detectBranch()` | `packages/agent/src/lib/projectOverview.ts:175` | Exists — `git symbolic-ref --short HEAD` |
| `detectMarkers()` | `packages/agent/src/lib/projectOverview.ts:23` | Exists — `.git`, `.planning`, `.claude/skills` |
| `resolveAllowed()` | `packages/agent/src/lib/paths.ts:23` | Exists — ALLOWED_SUBDIRS = `['.planning', '.claude']` |
| `overviewCache.ts` | `packages/agent/src/lib/overviewCache.ts` | Exists — `Map<string, { value, expiresAt }>` pattern |
| `outbound()` | `packages/agent/src/server/middleware/errors.ts:22` | Exists — schema_drift defense pattern |
| `apiFetch()` + `parseOrDrift()` | `packages/spa/src/lib/api.ts` | Exists — full SPA fetch + drift surface |
| `SchemaDriftState` | `packages/spa/src/components/SchemaDriftState.tsx` | Exists — per-panel drift display component |
| `CodeBlock` | `packages/spa/src/components/CodeBlock.tsx` | Exists — used for D-4-15 install hint |
| `HomeLayout` + `setAppShellWidth` | `packages/spa/src/lib/appShellWidth.ts` | Exists — `useSyncExternalStore` pattern for max-w |
| `/projects/$projectId` route | `packages/spa/src/routes/projects.$projectId.lazy.tsx` | Exists as placeholder — replace body only |
| Phase 3 TanStack Query pattern | `packages/spa/src/lib/registry.ts` | Established — `queryKey`, `staleTime: 5_000`, `refetchInterval: 5_000`, `refetchIntervalInBackground: false` |
| Vitest + jsdom (SPA) | `packages/spa/vitest.config.ts` | Confirmed |
| Vitest + node (agent) | `packages/agent/vitest.config.ts` | Confirmed |
| Global CSS tokens | `packages/spa/src/styles/global.css` | Complete — `--bg`, `--surface`, `--surface-elevated`, `--border`, `--text`, `--text-muted`, `--text-subtle`, `--accent`, `--danger`, `--warning`, `--success`, `--ring` |

### What is new (Phase 4 adds) [VERIFIED: CONTEXT.md decisions]

- 5 new daemon routes (commitment, observations, phase-progress, security, discipline)
- 5 new shared schemas (commitment.ts, observations.ts, phaseDetail.ts, security.ts, discipline.ts)
- New parser functions in `lib/phaseDetail.ts` (or extend `projectOverview.ts`)
- A generalized phase cache (extend or duplicate overviewCache.ts pattern)
- `SingleProjectView.tsx` + 8 panel components + `lib/projectQueries.ts`
- `ProjectLayout.tsx` (mirrors HomeLayout for `max-w-7xl`)

### Meta-observer JSONL — the biggest unknown, resolved [VERIFIED: filesystem search]

Searched all Sourcecode directories for `*.jsonl` files in `skill-observations` paths and found zero results. Also checked `~/.claude/skills` — no `meta-observer` entry exists.

**Assessment:** The meta-observer skill does not exist yet. This matches spec Q5 (Phase 1 deferred item) and CONTEXT.md note that the skill is "packaged separately." Phase 4 implements the consumer side:
- Daemon checks for `<projectRoot>/.claude/skills/meta-observer/SKILL.md` → if absent, returns `{ entries: [], skillInstalled: false }`.
- Daemon checks for `.planning/skill-observations/*.jsonl` → if no files, returns `{ entries: [], skillInstalled: true }` (skill present, no events).
- SPA renders the appropriate empty state per D-4-14.

The `HookFiringSchema` uses `.passthrough()` to tolerate future meta-observer releases.

### Commit subject analysis — ExecutionTimeline task grouping [VERIFIED: git log]

Real commits use patterns like:
- `test(03-03): add failing tests for overview route RED (7 tests: ...)`
- `feat(03-03): implement overviewRoute + wire into app.ts (GREEN)`
- `test(03-02): add failing tests for appShellWidth and HomeLayout (RED)`

**Task ID extraction regex:** `^(?:test|feat|refactor|docs)\((\d{2}-\d{2})\):` — captures the `NN-NN` segment (e.g. `03-03`). Commits without this pattern are non-TDD commits (`fix:`, `chore:`, bare `docs:`) and are excluded from the timeline.

**RED detection:** subject contains word `RED` (case-insensitive).
**GREEN detection:** subject contains word `GREEN` (case-insensitive).
**Grouping:** commits sharing the same `NN-NN` task ID form one group, ordered by first-commit timestamp ascending.
**Phase scoping:** filter groups to those whose task ID starts with the current phase's two-digit prefix (e.g. `04` for Phase 4 commits).

This is a "Claude's Discretion" item — planner finalises the regex.

### Rationalization table heading — confirmed [VERIFIED: SKILL.md line 144]

The heading is `## Rationalization Table — Check Before Skipping Anything`. The table has 7 data rows (plus header row). First-column values (the labels) are quoted strings like `"This task is too small for the commitment ritual"`. The daemon parser strips surrounding `"` chars when building the row label list, then matches JSONL event `payload` fields against these labels.

### `parseReviewFile` finding severity mapping — mismatch identified [VERIFIED: projectOverview.ts]

The existing function maps `critical → red`, `warning → yellow`, `info → green` returning a three-bucket schema (`{ red, yellow, green }`). However, Phase 4 `ReviewStatusPayloadSchema` needs four buckets: `{ critical, high, medium, low }` (per CONTEXT.md D-4-16 and UI-SPEC).

**Resolution:** Phase 4 adds `parseReviewFindings4()` in `phaseDetail.ts` that counts `<finding severity="critical">`, `<finding severity="high">`, `<finding severity="medium">`, `<finding severity="low">` as four separate buckets. The existing `parseReviewFile` in `projectOverview.ts` is left untouched (Phase 3 overview card uses it). [ASSUMED — see Assumptions Log A1]

---

## Standard Stack

No new packages. All dependencies already present.

| Package | Purpose | Package location |
|---------|---------|---------|
| `hono` | Daemon route framework | `packages/agent` |
| `zod` | Schema validation | both |
| `@tanstack/react-query` | SPA polling | `packages/spa` |
| `@tanstack/react-router` | SPA routing | `packages/spa` |
| `execa` | git subprocess | `packages/agent` |
| `lucide-react` | Icons | `packages/spa` |
| `vitest` | Tests | both |
| `@testing-library/react` | Component tests | `packages/spa` |
| `node:readline` | JSONL streaming (built-in) | `packages/agent` |
| `node:fs/promises` | mtime sort (built-in) | `packages/agent` |

**Installation:** None required. [VERIFIED: codebase]

---

## Architecture Patterns

### Daemon route pattern (established, replicate exactly) [VERIFIED: routes/overview.ts]

```typescript
// Replicates packages/agent/src/routes/overview.ts (Phase 3 pattern)
import { Hono } from 'hono'
import { CommitmentBlockResponseSchema } from '@agenticapps/dashboard-shared'
import { readRegistry } from '../lib/registry.js'
import { parseCommitmentBlock } from '../lib/phaseDetail.js'
import { getPhaseCache, setPhaseCache } from '../lib/phaseCache.js'
import { outbound } from '../server/middleware/errors.js'
import type { Env } from '../server/app.js'

export const commitmentRoute = new Hono<Env>()

commitmentRoute.get('/:id/commitment', async (c) => {
  const id = c.req.param('id')
  const reg = readRegistry(c.get('registryFile') as string | undefined)
  const entry = reg.projects.find((p) => p.id === id)
  if (!entry) {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    return c.json({ ok: false, error: 'project_not_found', requestId }, 404)
  }
  const cacheKey = `${id}:commitment`
  const cached = getPhaseCache(cacheKey)
  if (cached) {
    return outbound(c, CommitmentBlockResponseSchema.parse.bind(CommitmentBlockResponseSchema), cached)
  }
  const value = await parseCommitmentBlock(entry.root)
  setPhaseCache(cacheKey, value)
  return outbound(c, CommitmentBlockResponseSchema.parse.bind(CommitmentBlockResponseSchema), value)
})
```

### Phase cache pattern (generalize overviewCache.ts) [VERIFIED: overviewCache.ts]

```typescript
// Generalize packages/agent/src/lib/overviewCache.ts for multi-route use
// Key format: "${projectId}:${routeName}" e.g. "acme-app:commitment"
const CACHE_TTL_MS = 5_000
const store = new Map<string, { value: unknown; expiresAt: number }>()

export function getPhaseCache(key: string): unknown | null {
  const entry = store.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) { store.delete(key); return null }
  return entry.value
}

export function setPhaseCache(key: string, value: unknown): void {
  store.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

export function evictProject(projectId: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(`${projectId}:`)) store.delete(key)
  }
}
```

The planner decides whether to generalize `overviewCache.ts` or create a sibling `phaseCache.ts`. Generalizing is preferred (single `evictProject` call on unregister).

### SPA query hook pattern (established, replicate) [VERIFIED: lib/registry.ts]

```typescript
// Replicates packages/spa/src/lib/registry.ts (Phase 3 pattern)
export function useCommitment(id: string | null) {
  return useQuery({
    queryKey: ['commitment', id] as const,
    queryFn: async (): Promise<CommitmentBlockResponse> => {
      const result = await apiFetch(`/api/projects/${id}/commitment`, CommitmentBlockResponseSchema)
      if (!result.ok) throw new Error(`schema_drift:${result.drift.path}`)
      return result.data
    },
    enabled: id !== null,
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  })
}
```

### Panel container pattern [VERIFIED: 04-UI-SPEC.md]

```tsx
// From 04-UI-SPEC.md — Panel container spec
<section aria-labelledby={`${panelId}-title`}
  className="rounded-md border border-[--border] bg-[--surface] p-6 flex flex-col gap-4">
  <h2 id={`${panelId}-title`}
    className="text-xl font-semibold leading-snug text-[--text]">
    {Panel Title}
  </h2>
  {/* panel content */}
</section>
```

### ProjectLayout (max-w override — mirrors HomeLayout) [VERIFIED: HomeLayout.tsx]

```typescript
// Mirrors packages/spa/src/components/HomeLayout.tsx with max-w-7xl
// instead of max-w-5xl (D-4-09 requires more horizontal width)
export function ProjectLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  useEffect(() => {
    setAppShellWidth('max-w-7xl')
    return () => { setAppShellWidth('max-w-3xl') }
  }, [])
  return <>{children}</>
}
```

### `resolveAllowed` usage for new paths [VERIFIED: paths.ts]

All new daemon parsers that read from the project filesystem use one of two patterns:

1. **Internal paths (no user input):** `join(root, '.planning', 'skill-observations')` — no `resolveAllowed` needed; path is constructed, not supplied by user.
2. **User-supplied paths:** always call `resolveAllowed(root, relativePath)` — throws `PathViolation` on traversal.

Both `.planning` and `.claude` are in `ALLOWED_SUBDIRS`, so all Phase 4 reads are within the allow-list.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONL streaming | Custom line reader | `node:readline` createInterface | Edge cases: partial lines, large files, encoding |
| File existence check | try/catch readFile | `existsSync` or `promises.stat` | Already pattern from `projectOverview.ts` |
| Schema validation outbound | bare `c.json(value)` | `outbound(c, Schema.parse.bind, value)` | Schema drift caught at boundary (D-16) |
| Per-panel Zod parse | Custom try/catch | `parseOrDrift()` in `apiFetch` | Already handles all drift cases |
| Clipboard copy | Custom copy logic | `navigator.clipboard.writeText` (already in CodeBlock) | Cross-browser handled by existing CodeBlock |
| TanStack Query options | Ad-hoc options | Use `staleTime: 5_000, refetchInterval: 5_000, refetchIntervalInBackground: false` verbatim | D-4-02 locked; deviation causes UX inconsistency |
| git subprocess | direct `child_process` | `execa` with argv array (no shell) | Already used; prevents shell injection; timeout built-in |

---

## Wire Schemas (Zod — Phase 4 additions to `packages/shared/src/schemas/`)

### `commitment.ts`

```typescript
import { z } from 'zod'

export const CommitmentBlockResponseSchema = z.object({
  markdown: z.string().nullable(),
  sourceFile: z.string().nullable(),
})
export type CommitmentBlockResponse = z.infer<typeof CommitmentBlockResponseSchema>
```

### `observations.ts`

```typescript
import { z } from 'zod'

// D-4-06: passthrough so unknown future meta-observer fields are preserved
export const HookFiringSchema = z.object({
  ts: z.string(), // ISO8601
  skill: z.string(),
  hook: z.string(),
}).passthrough()
export type HookFiring = z.infer<typeof HookFiringSchema>

// D-4-15: skillInstalled distinguishes "skill absent" from "skill present, no events"
export const ObservationsRecentResponseSchema = z.object({
  entries: z.array(HookFiringSchema),
  skillInstalled: z.boolean(),
})
export type ObservationsRecentResponse = z.infer<typeof ObservationsRecentResponseSchema>
```

### `phaseDetail.ts`

```typescript
import { z } from 'zod'

export const PhaseFileStatusSchema = z.object({
  name: z.string(),
  present: z.boolean(),
  mtimeIso: z.string().nullable(),
})
export type PhaseFileStatus = z.infer<typeof PhaseFileStatusSchema>

export const ExecutionTimelineEntrySchema = z.object({
  taskId: z.string(),           // e.g. "04-01"
  redCommit: z.object({
    sha: z.string(),
    subject: z.string(),
    isoDate: z.string(),
  }).nullable(),
  greenCommit: z.object({
    sha: z.string(),
    subject: z.string(),
    isoDate: z.string(),
  }).nullable(),
})
export type ExecutionTimelineEntry = z.infer<typeof ExecutionTimelineEntrySchema>

// Phase 4 uses four-bucket severity (distinct from Phase 3 FindingCounts red/yellow/green)
export const ReviewFindingCountsSchema = z.object({
  critical: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  low: z.number().int().nonnegative(),
})
export type ReviewFindingCounts = z.infer<typeof ReviewFindingCountsSchema>

export const ReviewStatusPayloadSchema = z.object({
  stage1: z.object({
    present: z.boolean(),
    findings: ReviewFindingCountsSchema,
  }).nullable(),
  stage2: z.object({
    present: z.boolean(),
    findings: ReviewFindingCountsSchema,
  }).nullable(),
})
export type ReviewStatusPayload = z.infer<typeof ReviewStatusPayloadSchema>

export const VerificationStatusPayloadSchema = z.object({
  mustHavesTotal: z.number().int().nonnegative(),
  mustHavesEvidenced: z.number().int().nonnegative(),
  items: z.array(z.object({
    text: z.string(),
    evidenced: z.boolean(),
  })),
})
export type VerificationStatusPayload = z.infer<typeof VerificationStatusPayloadSchema>

export const PhaseProgressResponseSchema = z.object({
  phase: z.string().nullable(),       // e.g. "04-single-project-view-discipline-phase-progress"
  paddedPhase: z.string().nullable(), // e.g. "04"
  files: z.array(PhaseFileStatusSchema),
  tdd: z.object({
    greenPairs: z.number().int().nonnegative(),
    totalTasks: z.number().int().nonnegative(),
    timeline: z.array(ExecutionTimelineEntrySchema),
  }),
  review: ReviewStatusPayloadSchema,
  verification: VerificationStatusPayloadSchema,
})
export type PhaseProgressResponse = z.infer<typeof PhaseProgressResponseSchema>
```

### `discipline.ts`

```typescript
import { z } from 'zod'

export const RationalizationRowSchema = z.object({
  label: z.string(),
  fires: z.number().int().nonnegative(),
})
export type RationalizationRow = z.infer<typeof RationalizationRowSchema>

export const DisciplineResponseSchema = z.object({
  rationalization: z.object({
    rows: z.array(RationalizationRowSchema),
    skillInstalled: z.boolean(),
  }),
})
export type DisciplineResponse = z.infer<typeof DisciplineResponseSchema>
```

### `security.ts`

```typescript
import { z } from 'zod'

export const CsoSummarySchema = z.object({
  fileName: z.string(),    // e.g. "04-SECURITY.md"
  content: z.string(),     // first N bytes of the file for display (capped)
})
export type CsoSummary = z.infer<typeof CsoSummarySchema>

export const DbSentinelSummarySchema = z.object({
  fileName: z.string(),
  content: z.string(),
})
export type DbSentinelSummary = z.infer<typeof DbSentinelSummarySchema>

export const SecurityResponseSchema = z.object({
  cso: CsoSummarySchema.nullable(),
  dbSentinel: DbSentinelSummarySchema.nullable(),
})
export type SecurityResponse = z.infer<typeof SecurityResponseSchema>
```

---

## File Inventory

### New files — `packages/shared/src/schemas/`

| File | Purpose |
|------|---------|
| `commitment.ts` | `CommitmentBlockResponseSchema` |
| `observations.ts` | `HookFiringSchema`, `ObservationsRecentResponseSchema` |
| `phaseDetail.ts` | `PhaseFileStatusSchema`, `ExecutionTimelineEntrySchema`, `ReviewFindingCountsSchema`, `ReviewStatusPayloadSchema`, `VerificationStatusPayloadSchema`, `PhaseProgressResponseSchema` |
| `discipline.ts` | `RationalizationRowSchema`, `DisciplineResponseSchema` |
| `security.ts` | `CsoSummarySchema`, `DbSentinelSummarySchema`, `SecurityResponseSchema` |

### Modified files — `packages/shared/src/`

| File | Change |
|------|--------|
| `index.ts` | Re-export all new schemas and types (5 new schema files) |

### New files — `packages/agent/src/lib/`

| File | Purpose |
|------|---------|
| `phaseDetail.ts` | `parseCommitmentBlock`, `parsePhaseChecklist`, `parseExecutionTimeline`, `parseSecurityReports`, `parseRationalizationRows`, `readSkillObservations`, `parseReviewFindings4` |
| `phaseCache.ts` | Generalized 5s memo cache keyed by `${projectId}:${route}` |

### Modified files — `packages/agent/src/lib/`

| File | Change |
|------|--------|
| `overviewCache.ts` | If generalizing: add `evictProject(id)` that removes all `${id}:*` keys. If keeping separate: no change. |

### New files — `packages/agent/src/routes/`

| File | Route |
|------|-------|
| `commitment.ts` | `GET /api/projects/:id/commitment` |
| `observations.ts` | `GET /api/projects/:id/observations/recent?limit=20` |
| `phaseProgress.ts` | `GET /api/projects/:id/phase-progress` |
| `security.ts` | `GET /api/projects/:id/security` |
| `discipline.ts` | `GET /api/projects/:id/discipline` |

### Modified files — `packages/agent/src/server/`

| File | Change |
|------|--------|
| `app.ts` | Wire 5 new routes: `app.route('/api/projects', commitmentRoute)` etc. |

### New test files — `packages/agent/src/`

| File | Tests |
|------|-------|
| `lib/phaseDetail.test.ts` | Unit tests for each new parser function (RED stubs first) |
| `lib/phaseCache.test.ts` | Cache hit/miss/stale/evict (mirrors overviewCache pattern) |
| `server/__tests__/commitment.test.ts` | Route: 200/404/cache-hit/schema_drift |
| `server/__tests__/observations.test.ts` | Route: 200/404/skillInstalled-flag |
| `server/__tests__/phaseProgress.test.ts` | Route: 200/404/TDD-grouping/review/verification |
| `server/__tests__/security.test.ts` | Route: 200/404/null-when-absent |
| `server/__tests__/discipline.test.ts` | Route: 200/404/rationalization-row-parsing |

### New files — `packages/spa/src/`

| File | Purpose |
|------|---------|
| `components/SingleProjectView.tsx` | 2-col grid shell + ProjectHeader + column composition |
| `components/ProjectLayout.tsx` | max-w-7xl width override (mirrors HomeLayout) |
| `components/panels/CommitmentBlock.tsx` | DISC-01 panel |
| `components/panels/HookFirings.tsx` | DISC-02 + DISC-04 install hint |
| `components/panels/RationalizationFires.tsx` | DISC-03 panel |
| `components/panels/PhaseProgress.tsx` | PHASE-01 panel |
| `components/panels/ExecutionTimeline.tsx` | PHASE-02 panel |
| `components/panels/ReviewStatus.tsx` | PHASE-03 panel |
| `components/panels/SecurityStatus.tsx` | PHASE-04 panel |
| `components/panels/VerificationStatus.tsx` | PHASE-05 panel |
| `lib/projectQueries.ts` | 5 TanStack Query hooks (`useCommitment`, `useObservations`, `usePhaseProgress`, `useSecurity`, `useDiscipline`) |

### Modified files — `packages/spa/src/`

| File | Change |
|------|--------|
| `routes/projects.$projectId.lazy.tsx` | Replace placeholder body with `<SingleProjectView projectId={projectId} />` |

### New test files — `packages/spa/src/`

| File | Tests |
|------|-------|
| `components/SingleProjectView.test.tsx` | Header render, 2-col grid, panel composition |
| `components/panels/CommitmentBlock.test.tsx` | Happy path + both empty states |
| `components/panels/HookFirings.test.tsx` | Happy + skill-not-installed + no-events |
| `components/panels/RationalizationFires.test.tsx` | Happy + skill-missing + all-zero rows |
| `components/panels/PhaseProgress.test.tsx` | Happy + no-phase-dir |
| `components/panels/ExecutionTimeline.test.tsx` | Happy + no-commits + incomplete pairs |
| `components/panels/ReviewStatus.test.tsx` | Happy + no-review |
| `components/panels/SecurityStatus.test.tsx` | Happy + no-audit |
| `components/panels/VerificationStatus.test.tsx` | Happy + no-verification + all-satisfied |
| `lib/projectQueries.test.ts` | Query key shape, enabled flag, drift throw |

---

## Parser Implementation Notes

### `parseCommitmentBlock(root: string)` [VERIFIED: D-4-05 algorithm]

```
Algorithm:
1. readdir(root/.planning/skill-observations, { withFileTypes: true })
   → if ENOENT: return { markdown: null, sourceFile: null } (triggers DISC-04 hint)
2. Filter entries: isFile() && name.endsWith('.md')
   → if empty: return { markdown: null, sourceFile: null }
3. Stat each .md file to get mtimeMs; sort desc; pick first (latest)
4. readFile(latest.path, 'utf8')
5. Find LAST occurrence of /^## Workflow commitment\s*$/gm using exec loop
   → if no match: return { markdown: null, sourceFile: null }
6. Slice content from that index; find next /\n^## /m → extract block
7. Return { markdown: block.trim() || null, sourceFile: latest.name }
```

### `parseExecutionTimeline(root: string, phasePrefix: string)` [VERIFIED: git log analysis]

```
Algorithm:
1. execa('git', ['log', '--format=%H\t%s\t%aI', '--no-merges'], { cwd: root, timeout: 5000 })
2. Split stdout by newline; parse each line as { sha, subject, isoDate }
3. Task ID extraction regex: /^(?:test|feat|refactor|docs)\((\d{2}-\d{2})\):/
4. RED flag: subject.match(/\bRED\b/i)
5. GREEN flag: subject.match(/\bGREEN\b/i)
6. Filter commits to those matching task regex AND whose taskId starts with phasePrefix
7. Group by taskId: first RED commit = redCommit, first GREEN commit = greenCommit
8. Sort groups by first-commit isoDate ascending
9. Return { greenPairs, totalTasks, timeline: ExecutionTimelineEntry[] }
```

### `readSkillObservations(root: string, limit: number)` [VERIFIED: D-4-08 algorithm]

```
Algorithm:
1. skillInstalled = existsSync(join(root, '.claude', 'skills', 'meta-observer', 'SKILL.md'))
2. readdir(root/.planning/skill-observations) for *.jsonl (and *.ndjson) files
   → if ENOENT or no files: return { entries: [], skillInstalled }
3. For each file:
   - Create readline interface from createReadStream
   - Parse each line as JSON (try/catch; skip invalid lines)
   - Filter to lines with { ts, skill, hook } minimum fields
4. Collect all valid lines across files into one array
5. Sort by ts descending; slice to limit (20)
6. Return { entries: top-N lines, skillInstalled }
```

### `parseRationalizationRows(root: string, entries: HookFiring[])` [VERIFIED: SKILL.md table]

```
Algorithm:
1. skillPath = join(root, '.claude', 'skills', 'agenticapps-workflow', 'skill', 'SKILL.md')
   → if ENOENT: return { rows: [], skillInstalled: false }
2. readFileSync(skillPath, 'utf8')
3. Find heading "## Rationalization Table — Check Before Skipping Anything"
4. Parse markdown table after that heading:
   - Split rows by newline; filter lines starting with |
   - Skip header row (first |) and separator row (contains |---)
   - For each data row: split by |, trim cells, take first cell as label
   - Strip leading/trailing " from label
5. For each label: count entries whose payload fields contain that label string
6. Return { rows: [{ label, fires }], skillInstalled: true }
```

### `parsePhaseChecklist(phaseDir: string)` [VERIFIED: UI-SPEC PhaseProgress spec]

```
Canonical file order:
  CONTEXT.md, RESEARCH.md, UI-SPEC.md, DISCUSSION-LOG.md,
  [plan-summary pairs sorted numerically: NN-NN-PLAN.md, NN-NN-SUMMARY.md],
  REVIEW.md, REVIEW-FIX.md, SECURITY.md, IMPECCABLE.md, VERIFICATION.md, HUMAN-UAT.md

Algorithm:
1. Read phaseDir to discover plan/summary pairs (files matching /\d{2}-\d{2}-PLAN\.md/)
2. Build ordered list inserting plan pairs between DISCUSSION-LOG.md and REVIEW.md
3. For each file name: stat to get mtime; check existence
4. Return PhaseFileStatus[]: { name, present, mtimeIso }
```

### `parseSecurityReports(phaseDir: string)` [VERIFIED: projectOverview.ts dbAudit pattern]

```
Algorithm:
1. readdir(phaseDir) → find files ending in '-SECURITY.md' (exclude '-IMPECCABLE.md')
   - cso file: typical pattern 'NN-SECURITY.md' or '*-SECURITY.md' (not 'DB-SENTINEL' prefix)
   - dbSentinel file: look for '*-DB-SENTINEL.md' or similar (per spec mention)
2. Read each file; return first 4096 chars as content (cap for UI display)
3. Return { cso: { fileName, content } | null, dbSentinel: ... | null }
```

---

## Common Pitfalls

### Pitfall 1: New route not wired into `app.ts`
**What goes wrong:** Route is implemented and tested in isolation, but `app.ts` never adds it. The SPA gets 404.
**How to avoid:** Each route plan must include wiring `app.ts` as a mandatory task step.
**Warning signs:** `app.request` test passes in isolation, SPA gets 404.

### Pitfall 2: `parseReviewFile` returns three-bucket schema; Phase 4 needs four
**What goes wrong:** Using `parseReviewFile` directly for `ReviewStatusPayload` produces `{ red, yellow, green }` not `{ critical, high, medium, low }`.
**How to avoid:** Add `parseReviewFindings4()` in `phaseDetail.ts`. Leave `parseReviewFile` untouched.
**Warning signs:** TypeScript error when assigning `parseReviewFile` result to `ReviewStatusPayloadSchema` shape.

### Pitfall 3: Cache eviction on unregister misses Phase 4 keys
**What goes wrong:** When a project is unregistered, `evict(id)` clears the overview entry but the Phase 4 cache retains stale data. Re-registering the same ID with a different root shows stale panels.
**How to avoid:** Generalize to a single cache store; call `evictProject(id)` on unregister to clear all `${id}:*` keys.
**Warning signs:** Panel shows stale data after project is unregistered and re-registered.

### Pitfall 4: JSONL absence vs skill not installed — wrong empty state
**What goes wrong:** Returning `{ skillInstalled: false }` when the skill IS installed but no `.jsonl` files exist shows the install hint instead of "no events yet."
**How to avoid:** Check `SKILL.md` existence separately from checking for `.jsonl` files.
**Warning signs:** Install hint shown on a project that already has `meta-observer` skill.

### Pitfall 5: ExecutionTimeline processes all git history, not just current phase
**What goes wrong:** Phase 3 commits appear in Phase 4 timeline (wrong context).
**How to avoid:** Filter groups by task ID prefix matching the current phase number (`04-` for Phase 4).
**Warning signs:** Timeline shows `03-NN` task groups alongside `04-NN` groups.

### Pitfall 6: Right-column DOM stub violates D-4-13 / anti-slop rules
**What goes wrong:** Developer adds a placeholder `<div>` "for Phase 5," creating phantom structure.
**How to avoid:** D-4-09 explicitly: no right-column DOM element in Phase 4. The CSS grid `grid-cols-[1fr_1.5fr]` handles this naturally.
**Warning signs:** Empty `<div>` in the DOM visible in DevTools.

### Pitfall 7: `resolveAllowed` throws PathViolation for internal parser paths
**What goes wrong:** Calling `resolveAllowed` on paths constructed internally (not from user input) throws `PathViolation` when the directory doesn't exist yet.
**How to avoid:** Only call `resolveAllowed` for user-supplied paths. Internal parsers use `existsSync`/`readdir` with try/catch.
**Warning signs:** Route returns 422 `path_not_allowed` for valid internal reads.

---

## Test Strategy

### TDD Red-Green Pattern (mandatory per global CLAUDE.md)

Every plan that creates parser functions or route files must follow the established pattern:
1. `test(04-NN): add failing tests for [feature] RED` commit
2. `feat(04-NN): implement [feature] GREEN` commit
3. Optional: `refactor(04-NN): [cleanup]` commit

Established pattern from git log: `test(03-03): add failing tests for overview route RED (7 tests: ...)` followed by `feat(03-03): implement overviewRoute + wire into app.ts (GREEN)`.

### Daemon route tests (in-process Hono pattern) [VERIFIED: server/__tests__/overview.test.ts]

```typescript
// Pattern: createApp({ registryFile }) + app.request() — no real HTTP server
// Fixtures: makeTmpHome() + makeTmpProject() from lib/__fixtures__/tmpHome.ts
// Parser isolation: vi.spyOn(lib, 'parseCommitmentBlock').mockResolvedValue(...)
// Cache isolation: _resetForTests() in beforeEach/afterEach
// Time control: vi.useFakeTimers() for cache TTL tests
```

Mandatory test cases per route (mirrors Phase 3 overview.test.ts pattern):
1. 200 + valid payload for known registered project
2. Cache hit — second call within 5s does NOT invoke parser again
3. Cache miss after 5s — second call invokes parser again
4. 404 project_not_found for unknown id
5. Graceful empty response when project root is unreachable
6. Schema drift — parser returning invalid data causes 500 schema_drift
7. Cache eviction — evict then call again invokes parser

### SPA component tests (Vitest + jsdom + React Testing Library) [VERIFIED: spa/vitest.config.ts]

```typescript
// Pattern: render component with MSW or manual fetch mock
// For per-panel tests: mock the specific query hook return value
// For schema drift: mock query to return error state → verify SchemaDriftState renders
// For empty states: mock query to return empty/null data → verify empty-state copy
// Avoid snapshot tests — test behavior (what renders) not structure (how it renders)
```

### Integration tests

The existing `packages/spa/src/__tests__/register-optimistic.test.ts` and `end-to-end` subprocess test provide the integration test reference. Phase 4 adds:
- Route-level: daemon route tests that exercise parser + cache + outbound together (Hono in-process)
- Component-level: `SingleProjectView.test.tsx` with MSW mocking all 5 endpoints

---

## Validation Architecture

`workflow.nyquist_validation: true` — include full section.

### Test Framework

| Property | Value |
|----------|-------|
| Framework (agent) | Vitest (node environment) |
| Framework (SPA) | Vitest (jsdom) + React Testing Library |
| Config (agent) | `packages/agent/vitest.config.ts` |
| Config (SPA) | `packages/spa/vitest.config.ts` |
| Quick run (agent) | `pnpm --filter @agenticapps/dashboard-agent test` |
| Quick run (SPA) | `pnpm --filter @agenticapps/dashboard-spa test` |
| Full suite | `pnpm -r test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-01 | CommitmentBlock parser extracts last `## Workflow commitment` block | unit | `pnpm --filter @agenticapps/dashboard-agent test lib/phaseDetail` | Wave 0 |
| DISC-01 | Daemon commitment route returns `{ markdown, sourceFile }` | integration | `pnpm --filter @agenticapps/dashboard-agent test server/__tests__/commitment` | Wave 0 |
| DISC-01 | CommitmentBlock panel renders content and empty states | component | `pnpm --filter @agenticapps/dashboard-spa test panels/CommitmentBlock` | Wave 0 |
| DISC-02 | `readSkillObservations` merges/sorts JSONL across files | unit | `pnpm --filter @agenticapps/dashboard-agent test lib/phaseDetail` | Wave 0 |
| DISC-02 | Observations route returns top-20 sorted entries | integration | `pnpm --filter @agenticapps/dashboard-agent test server/__tests__/observations` | Wave 0 |
| DISC-02 | HookFirings renders rows | component | `pnpm --filter @agenticapps/dashboard-spa test panels/HookFirings` | Wave 0 |
| DISC-03 | `parseRationalizationRows` extracts SKILL.md table + counts | unit | `pnpm --filter @agenticapps/dashboard-agent test lib/phaseDetail` | Wave 0 |
| DISC-03 | Discipline route returns `{ rationalization: { rows } }` | integration | `pnpm --filter @agenticapps/dashboard-agent test server/__tests__/discipline` | Wave 0 |
| DISC-04 | `skillInstalled: false` when meta-observer SKILL.md absent | unit+integration | Covered in DISC-02 tests | Wave 0 |
| DISC-04 | HookFirings renders install hint with CodeBlock | component | `pnpm --filter @agenticapps/dashboard-spa test panels/HookFirings` | Wave 0 |
| PHASE-01 | `parsePhaseChecklist` returns file presence + mtime in canonical order | unit | `pnpm --filter @agenticapps/dashboard-agent test lib/phaseDetail` | Wave 0 |
| PHASE-01 | PhaseProgress panel renders checklist | component | `pnpm --filter @agenticapps/dashboard-spa test panels/PhaseProgress` | Wave 0 |
| PHASE-02 | `parseExecutionTimeline` groups RED/GREEN pairs by task ID | unit | `pnpm --filter @agenticapps/dashboard-agent test lib/phaseDetail` | Wave 0 |
| PHASE-02 | ExecutionTimeline panel renders groups and incomplete pairs | component | `pnpm --filter @agenticapps/dashboard-spa test panels/ExecutionTimeline` | Wave 0 |
| PHASE-03 | `parseReviewFindings4` returns four-bucket counts | unit | `pnpm --filter @agenticapps/dashboard-agent test lib/phaseDetail` | Wave 0 |
| PHASE-03 | ReviewStatus panel renders Stage 1/2 severity counts | component | `pnpm --filter @agenticapps/dashboard-spa test panels/ReviewStatus` | Wave 0 |
| PHASE-04 | `parseSecurityReports` finds `*-SECURITY.md` | unit | `pnpm --filter @agenticapps/dashboard-agent test lib/phaseDetail` | Wave 0 |
| PHASE-04 | SecurityStatus panel renders content or empty state | component | `pnpm --filter @agenticapps/dashboard-spa test panels/SecurityStatus` | Wave 0 |
| PHASE-05 | `parseVerification` (existing) wired into `VerificationStatusPayload` | unit extend | `pnpm --filter @agenticapps/dashboard-agent test lib/phaseDetail` | reuse |
| PHASE-05 | VerificationStatus panel renders progress + items | component | `pnpm --filter @agenticapps/dashboard-spa test panels/VerificationStatus` | Wave 0 |
| All | `/projects/{id}` route renders SingleProjectView with header + columns | integration | `pnpm --filter @agenticapps/dashboard-spa test components/SingleProjectView` | Wave 0 |
| INV-01 | No Phase 4 daemon route writes to project filesystem | manual | Code review — all parsers read-only | manual only |
| INV-04 | Schema drift on one panel does NOT cascade to others | component | Per-panel SchemaDriftState renders in isolation test | Wave 0 |

### UAT Items (Human-Required Validation)

| # | Validation Item | Why Manual |
|---|-----------------|-----------|
| 1 | Click home-page card → `/projects/{id}` renders header + two columns | Browser navigation |
| 2 | CommitmentBlock shows actual commitment text from real session | Requires real project with skill-observations data |
| 3 | DISC-04 install hint visible on project without meta-observer | Requires project fixture without the skill |
| 4 | ExecutionTimeline shows correct RED/GREEN groups for Phase 4 TDD commits | Requires real git history with 04-NN commits |
| 5 | Per-panel inline warning on daemon unreachable (not full-page blank) | Requires killing daemon while on page |
| 6 | 5s polling visible: mutate a planning file, wait 10s, panel refreshes | Requires real FS mutation during session |
| 7 | `← All Projects` link returns to home; page title updates | Can be partially tested in routing unit test |

### Sampling Rate

- **Per task commit:** `pnpm -r typecheck && pnpm --filter @agenticapps/dashboard-agent test`
- **Per wave merge:** `pnpm -r test && pnpm -r build`
- **Phase gate:** Full suite green + `pnpm lint` + human UAT items 1-6 before `/gsd-verify-work`

### Wave 0 Gaps (all new — none exist yet)

- [ ] `packages/shared/src/schemas/commitment.ts`
- [ ] `packages/shared/src/schemas/observations.ts`
- [ ] `packages/shared/src/schemas/phaseDetail.ts`
- [ ] `packages/shared/src/schemas/discipline.ts`
- [ ] `packages/shared/src/schemas/security.ts`
- [ ] `packages/agent/src/lib/phaseDetail.test.ts` — RED stubs for all new parsers
- [ ] `packages/agent/src/lib/phaseCache.test.ts` — RED stubs for cache
- [ ] `packages/agent/src/server/__tests__/commitment.test.ts` — RED route stubs
- [ ] `packages/agent/src/server/__tests__/observations.test.ts` — RED route stubs
- [ ] `packages/agent/src/server/__tests__/phaseProgress.test.ts` — RED route stubs
- [ ] `packages/agent/src/server/__tests__/security.test.ts` — RED route stubs
- [ ] `packages/agent/src/server/__tests__/discipline.test.ts` — RED route stubs
- [ ] `packages/spa/src/components/SingleProjectView.test.tsx` — RED stub
- [ ] `packages/spa/src/components/panels/CommitmentBlock.test.tsx` — RED stub
- [ ] `packages/spa/src/components/panels/HookFirings.test.tsx` — RED stub
- [ ] `packages/spa/src/components/panels/RationalizationFires.test.tsx` — RED stub
- [ ] `packages/spa/src/components/panels/PhaseProgress.test.tsx` — RED stub
- [ ] `packages/spa/src/components/panels/ExecutionTimeline.test.tsx` — RED stub
- [ ] `packages/spa/src/components/panels/ReviewStatus.test.tsx` — RED stub
- [ ] `packages/spa/src/components/panels/SecurityStatus.test.tsx` — RED stub
- [ ] `packages/spa/src/components/panels/VerificationStatus.test.tsx` — RED stub
- [ ] `packages/spa/src/lib/projectQueries.test.ts` — RED stub

---

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (inherited) | Bearer token on every new route — same `bearerAuth` middleware in `app.ts`; no per-route auth code needed |
| V3 Session Management | No | Daemon is stateless; session state in browser localStorage (unchanged) |
| V4 Access Control | Yes | Path allow-list: internal paths use `join(root, '.planning', ...)` with no user input; user-supplied paths use `resolveAllowed()` |
| V5 Input Validation | Yes | Zod schemas on every outbound response via `outbound()` pattern |
| V6 Cryptography | No | No new crypto in Phase 4 |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed JSONL line crashing readline | DoS | `JSON.parse` per line in try/catch; skip invalid lines; readline already per-file |
| Large SECURITY.md file filling response | DoS | Cap content at 4096 bytes in `parseSecurityReports`; UI already clamps with `max-h-32 overflow-y-auto` |
| Schema drift cascading across panels | Information disclosure | Per-panel `outbound()` catches drift; each of the 5 routes is independent (D-4-01) |
| git log subprocess blocking indefinitely | DoS | `GIT_SUBPROCESS_TIMEOUT_MS = 5_000` already enforced in all `execa` calls |
| Skill path traversal via SKILL.md path | Tampering | Path is hardcoded: `join(root, '.claude', 'skills', 'agenticapps-workflow', 'skill', 'SKILL.md')` — no user input |
| skill-observations path traversal | Tampering | Path constructed as `join(root, '.planning', 'skill-observations')` — no user input |

**CSO gate:** Phase 4 adds 5 new HTTP read routes → `/cso` audit is mandatory post-phase.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A separate `parseReviewFindings4()` function is needed for the four-bucket schema rather than adapting `parseReviewFile` | Key Findings + File Inventory | If wrong: planner could adapt existing function and update shared schema; low-impact change, TypeScript will catch mismatches |
| A2 | Task IDs follow exactly `NN-NN` format in commit subjects (e.g. `04-01`) | Key Findings — ExecutionTimeline | If wrong: alternative formats like `04-1` or no plan ID at all would not be captured; planner finalises regex |
| A3 | The JSONL payload field that identifies which rationalization row fired is `payload.row` | Parser Notes — `parseRationalizationRows` | If wrong: passthrough schema still preserves the field; the matching logic would need adjustment once real events exist; zero-risk for Phase 4 empty state (all rows show `0 fires`) |

**If this table is empty:** N/A — three assumptions flagged above.

---

## Open Questions

1. **Should `parseReviewFile` be extended (breaking existing tests) or should Phase 4 add `parseReviewFindings4()` separately?**
   - What we know: Existing function returns `{ red, yellow, green }`; Phase 4 needs `{ critical, high, medium, low }`.
   - Recommendation: Add `parseReviewFindings4()` in `phaseDetail.ts`. Keep `parseReviewFile` untouched. Both are tested independently.

2. **What is the exact payload field name in meta-observer JSONL for rationalization events?**
   - What we know: No real JSONL files exist yet.
   - Recommendation: Ship `RationalizationFires` with `payload.row` matching attempt; the `0 fires` empty state is correct until real events arrive. Phase 5/6 tightens the matching once real events are observed.

3. **Should `parseExecutionTimeline` scope to the current phase by task ID prefix or by commit date?**
   - Recommendation: Filter by task ID prefix (e.g. `04`) — deterministic, no dependency on phase start timestamp. The phase number is derivable from the phase directory name (first two characters).

---

## Environment Availability

Phase 4 adds no external dependencies beyond `node:readline` (Node 20 built-in).

| Dependency | Required By | Available | Fallback |
|------------|------------|-----------|---------|
| Node 20+ `node:readline` | JSONL streaming | ✓ (Darwin 25.3) | — |
| `git` | ExecutionTimeline subprocess | ✓ (repo is a git repo) | Empty timeline gracefully |
| `execa` | git subprocess | ✓ catalog | — |
| `pnpm` | workspace test run | ✓ | — |

No missing dependencies. [VERIFIED: environment]

---

## Sources

### Primary (HIGH confidence)
- `packages/agent/src/lib/projectOverview.ts` — all existing parsers verified line-by-line [VERIFIED]
- `packages/agent/src/lib/overviewCache.ts` — cache pattern verified [VERIFIED]
- `packages/agent/src/server/app.ts` — route wiring pattern verified [VERIFIED]
- `packages/agent/src/server/middleware/errors.ts` — `outbound()` pattern verified [VERIFIED]
- `packages/agent/src/lib/paths.ts` — `resolveAllowed` and `ALLOWED_SUBDIRS` verified [VERIFIED]
- `packages/spa/src/lib/registry.ts` — TanStack Query hook pattern verified [VERIFIED]
- `packages/spa/src/lib/api.ts` — `apiFetch` + `parseOrDrift` verified [VERIFIED]
- `packages/spa/src/lib/appShellWidth.ts` — width override pattern verified [VERIFIED]
- `packages/spa/src/routes/projects.$projectId.lazy.tsx` — placeholder confirmed [VERIFIED]
- `.planning/phases/04-single-project-view-discipline-phase-progress/04-CONTEXT.md` — all D-4-XX locked decisions [VERIFIED]
- `.planning/phases/04-single-project-view-discipline-phase-progress/04-UI-SPEC.md` — full visual + copy contract [VERIFIED]
- `~/.claude/skills/agenticapps-workflow/skill/SKILL.md` — rationalization table heading + 7 row labels [VERIFIED]
- `packages/spa/src/styles/global.css` — all CSS custom property tokens [VERIFIED]
- `git log --format='%s %H %ai'` — commit subject patterns for task ID regex design [VERIFIED]

### Secondary (MEDIUM confidence)
- `docs/spec/dashboard-prompt.md` — authoritative spec consulted for Phase 4 scope and API surface [CITED]
- `.planning/REQUIREMENTS.md` — DISC-01..04, PHASE-01..05 confirmed as Phase 4 scope [CITED]

### Tertiary (LOW confidence)
- Assumptions A1, A2, A3 in Assumptions Log above — flagged for planner confirmation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing packages verified in codebase
- Architecture patterns: HIGH — all patterns verified from Phase 2/3 codebase
- Wire schemas: HIGH — derived directly from D-4-XX locked decisions
- Parser logic: HIGH (CommitmentBlock, PhaseChecklist, SecurityReports) / MEDIUM (ExecutionTimeline task regex, RationalizationFires JSONL field name)
- Pitfalls: HIGH (pitfalls 1-5 verified against code) / MEDIUM (pitfalls 6-7 from CONTEXT.md decisions)

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (30 days — stable stack, no external dependencies)

---

## RESEARCH COMPLETE
