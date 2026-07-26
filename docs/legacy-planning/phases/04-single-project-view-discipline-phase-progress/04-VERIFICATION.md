---
phase: 04-single-project-view-discipline-phase-progress
verified: 2026-05-06T12:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Navigate from the home page to a project card and click it"
    expected: "Browser routes to /projects/{id} and renders the ProjectHeader breadcrumb, the two-column grid (Discipline left, Phase Progress center), and all 8 panel headings visible with data or empty-state copy — no phantom placeholder text"
    why_human: "Route navigation via TanStack Router + SPA render is fully client-side; the automated e2e test mocks fetch but a real daemon+browser interaction confirms the live render"
  - test: "Verify CommitmentBlock shows actual workflow commitment markdown from .planning/skill-observations/"
    expected: "Panel shows the most recent '## Workflow commitment' block content in a <pre> block; Source: filename line visible below"
    why_human: "Requires a real daemon with a live project that has skill-observation .md files; test fixtures mock this"
  - test: "Verify WR-03 disposition: observe HookFirings panel on a project WITHOUT meta-observer SKILL.md but WITH .jsonl files"
    expected: "Panel shows the install-hint (skillInstalled:false), NOT the entries list — per D-4-15 spec intent. Review flag WR-03 documents that the implementation returns JSONL entries even when skillInstalled:false, but the SPA correctly ignores entries in that state. The human should confirm no visible data leak occurs in the panel."
    why_human: "The code review (WR-03) found a test assertion mismatch. The SPA behavior is correct (install-hint shown), but the daemon returns populated entries unnecessarily. This is a latent API contract deviation that is invisible in normal use. Human should confirm the panel renders the install-hint and not entry rows."
---

# Phase 4: Single-project View — Discipline + Phase Progress Verification Report

**Phase Goal:** Per-project three-column view's left (Discipline) and center (Phase Progress) columns, driven by .planning/phases/<current>/ and meta-observer JSONL.
**Verified:** 2026-05-06T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking a card on `/` navigates to `/projects/{id}` and renders header + left + center columns | ✓ VERIFIED | `projects.$projectId.lazy.tsx` mounts `<ProjectLayout><SingleProjectView projectId={projectId} /></ProjectLayout>`. E2E test E2E1 asserts `findByRole('navigation', { name: 'Project breadcrumb' })`. Placeholder text (`"Three-column view"`, `"Phase 4 work"`) confirmed absent via grep. `SingleProjectView.tsx` renders `grid-cols-[1fr_1.5fr]` with `discipline-column` and `phase-progress-column` sections. All 8 real panel components mounted. |
| 2 | CommitmentBlock surfaces the most recent `## Workflow commitment` block from the project's session output | ✓ VERIFIED | `parseCommitmentBlock()` in `phaseDetail.ts` reads highest-mtime `.md` in `.planning/skill-observations/`, finds last `^## Workflow commitment` heading, slices to next H2 or EOF. `CommitmentBlock.tsx` calls `useCommitment(projectId)` and renders the `markdown` field in a `<pre>` block with `Source: {sourceFile}` footer. E2E3 asserts `getByText(/Follow TDD discipline/)`. Empty state copy verbatim from UI-SPEC. |
| 3 | ExecutionTimeline parses `test(RED)` and `feat(GREEN)` commit pairs from `git log` and groups them per task | ✓ VERIFIED | `parseExecutionTimeline()` in `phaseDetail.ts` runs `git log --format=%H\t%s\t%aI` via execa argv-array, matches `TASK_ID_RE = /^(?:test|feat|refactor|docs)\((\d{2}-\d{2})\):/`, detects `\bRED\b` / `\bGREEN\b`, groups by taskId. Phase prefix scoping prevents Phase 3 commits leaking in. `ExecutionTimeline.tsx` calls `usePhaseProgress(projectId)` and reads `.tdd.timeline`. E2E4 asserts `getByText(/Task 04-01/)` and commit subject text. |
| 4 | ReviewStatus parses `<finding severity="...">` blocks per spec and renders by severity | ✓ VERIFIED | `parseReviewFindings4()` in `phaseDetail.ts` counts `<finding severity="critical|high|medium|low">` via regex. `ReviewStatus.tsx` calls `usePhaseProgress(projectId)`, reads `.review.stage1/stage2`, renders 🔴🟠🟡⚪ glyphs with `aria-label` for screen readers. E2E5 asserts `getByText('Stage 1')` and `🟡` glyph presence. Four-bucket schema (`ReviewFindingCountsSchema`) is distinct from Phase 3's three-bucket `FindingCountsSchema`. |
| 5 | VerificationStatus shows must_haves count vs evidence count from VERIFICATION.md | ✓ VERIFIED | `parseVerificationDetail()` in `phaseDetail.ts` reads `- **Text**:` bullets, detects `**Evidence` annotation, returns `{mustHavesTotal, mustHavesEvidenced, items}`. `VerificationStatus.tsx` calls `usePhaseProgress(projectId)`, reads `.verification`, renders `{evidenced} / {total} must-haves evidenced` summary + per-item CheckCircle2/Minus rows. E2E6 asserts `getByText('7 / 9 must-haves evidenced')`. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/shared/src/schemas/commitment.ts` | CommitmentBlockResponseSchema | ✓ VERIFIED | 498 bytes, exports schema and type |
| `packages/shared/src/schemas/observations.ts` | HookFiringSchema (.passthrough()), ObservationsRecentResponseSchema with skillInstalled | ✓ VERIFIED | 845 bytes, .passthrough() confirmed, skillInstalled: z.boolean() confirmed |
| `packages/shared/src/schemas/phaseDetail.ts` | PhaseFileStatus, ExecutionTimelineEntry, ReviewFindingCounts (4-bucket), ReviewStatusPayload, VerificationStatusPayload, PhaseProgressResponse | ✓ VERIFIED | 2.3KB, all 6 schemas exported |
| `packages/shared/src/schemas/discipline.ts` | RationalizationRowSchema, DisciplineResponseSchema with skillInstalled | ✓ VERIFIED | 823 bytes, skillInstalled: z.boolean() confirmed |
| `packages/shared/src/schemas/security.ts` | CsoSummary, DbSentinelSummary, SecurityResponse | ✓ VERIFIED | 846 bytes, all 3 schemas exported |
| `packages/shared/src/index.ts` | Barrel re-exports for all new schemas | ✓ VERIFIED | All 5 schema groups re-exported (10 export lines: 2 per group) |
| `packages/agent/src/lib/phaseDetail.ts` | 8 parser functions | ✓ VERIFIED | 16KB, 8 exported functions confirmed (grep count = 8) |
| `packages/agent/src/lib/phaseCache.ts` | generalized 5s memo keyed by `${projectId}:${routeName}` | ✓ VERIFIED | 2.2KB, getPhaseCache/setPhaseCache/evictPhaseCacheProject/_resetForTests confirmed |
| `packages/agent/src/routes/commitment.ts` | GET /api/projects/:id/commitment | ✓ VERIFIED | Route wired in app.ts, uses phaseCache, returns 404 on unknown id, outbound() schema validation |
| `packages/agent/src/routes/observations.ts` | GET /api/projects/:id/observations/recent | ✓ VERIFIED | Route wired, DEFAULT_LIMIT=20, MAX_LIMIT=100, skillInstalled in response |
| `packages/agent/src/routes/phaseProgress.ts` | GET /api/projects/:id/phase-progress (bulk) | ✓ VERIFIED | Route wired, composes parsePhaseChecklist + parseExecutionTimeline + parseReviewFindings4 + parseVerificationDetail + parseTddPairs |
| `packages/agent/src/routes/discipline.ts` | GET /api/projects/:id/discipline | ✓ VERIFIED | Route wired, FIRE_COUNT_LIMIT=200 for fire counting vs 20 for display |
| `packages/agent/src/routes/security.ts` | GET /api/projects/:id/security | ✓ VERIFIED | Route wired, composes findLatestPhaseDir + parseSecurityReports |
| `packages/spa/src/lib/projectQueries.ts` | 5 TanStack Query hooks | ✓ VERIFIED | All 5 hooks present: useCommitment, useObservations, useDiscipline, usePhaseProgress, useSecurity |
| `packages/spa/src/components/ProjectLayout.tsx` | max-w-7xl width override | ✓ VERIFIED | setAppShellWidth('max-w-7xl') on mount, setAppShellWidth('max-w-3xl') on unmount |
| `packages/spa/src/components/ProjectHeader.tsx` | Single-line breadcrumb | ✓ VERIFIED | Renders "← All Projects · {name}({client?}) · {branch ?? '(no branch)'} · phase {paddedPhase} — {status}" |
| `packages/spa/src/components/SingleProjectView.tsx` | 2-col grid + all 8 panels | ✓ VERIFIED | grid-cols-[1fr_1.5fr], no data-slot placeholders remain, all 8 panel imports and usages confirmed |
| `packages/spa/src/routes/projects.$projectId.lazy.tsx` | Route mounts ProjectLayout > SingleProjectView | ✓ VERIFIED | Placeholder text gone, mounts `<ProjectLayout><SingleProjectView projectId={projectId} /></ProjectLayout>` |
| `packages/spa/src/components/panels/CommitmentBlock.tsx` | DISC-01 | ✓ VERIFIED | useCommitment(projectId), pre block, empty-state copy verbatim |
| `packages/spa/src/components/panels/HookFirings.tsx` | DISC-02 + DISC-04 | ✓ VERIFIED | useObservations(projectId, 20), install-hint with CodeBlock |
| `packages/spa/src/components/panels/RationalizationFires.tsx` | DISC-03 | ✓ VERIFIED | useDiscipline(projectId), rows table or install-hint |
| `packages/spa/src/components/panels/PanelContainer.tsx` | Shared panel wrapper | ✓ VERIFIED | aria-labelledby, unreachable prop, stale prop |
| `packages/spa/src/components/panels/InlineDrift.tsx` | Shared inline drift | ✓ VERIFIED | Extracted from 3 Plan 05 copies; used by all 8 panels; no local InlineDrift functions remain in Plan 05 panels |
| `packages/spa/src/components/panels/PhaseProgress.tsx` | PHASE-01 | ✓ VERIFIED | usePhaseProgress(projectId), file checklist with CheckCircle2/Minus icons |
| `packages/spa/src/components/panels/ExecutionTimeline.tsx` | PHASE-02 | ✓ VERIFIED | usePhaseProgress(projectId), reads .tdd.timeline, RED/GREEN dots with sr-only text |
| `packages/spa/src/components/panels/ReviewStatus.tsx` | PHASE-03 | ✓ VERIFIED | usePhaseProgress(projectId), reads .review, 🔴🟠🟡⚪ glyphs with aria-label |
| `packages/spa/src/components/panels/SecurityStatus.tsx` | PHASE-04 | ✓ VERIFIED | useSecurity(projectId) (separate route per D-4-01), max-h-32 content clamp |
| `packages/spa/src/components/panels/VerificationStatus.tsx` | PHASE-05 | ✓ VERIFIED | usePhaseProgress(projectId), reads .verification, summary + item rows |
| `packages/spa/src/__tests__/projects-detail-e2e.test.tsx` | E2E route test asserting ROADMAP criteria 1-5 | ✓ VERIFIED | 7 tests (E2E1–E2E7), all 5 ROADMAP criteria explicitly covered, cross-project leakage guard |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `packages/shared/src/index.ts` | each of 5 schema files | `export ... from './schemas/X.js'` | ✓ WIRED | 10 re-export lines (2 per schema group) confirmed |
| `packages/agent/src/server/app.ts` | 5 route files | `app.route('/api/projects', Xroute)` | ✓ WIRED | All 5 routes wired on lines 117-121; all imports confirmed |
| `packages/agent/src/routes/registry.ts` | `packages/agent/src/lib/phaseCache.ts` | `evictPhaseCacheProject(id)` in unregister | ✓ WIRED | 2 occurrences (import + call) confirmed |
| `packages/spa/src/routes/projects.$projectId.lazy.tsx` | `ProjectLayout`, `SingleProjectView` | `<ProjectLayout><SingleProjectView /></ProjectLayout>` | ✓ WIRED | Both imports and JSX usage confirmed; old placeholder removed |
| `packages/spa/src/components/SingleProjectView.tsx` | all 8 panel components | `<Panel projectId={projectId} />` | ✓ WIRED | All 8 panel imports (lines 15-22) and JSX usages (lines 43-56) confirmed |
| each Discipline panel | `packages/spa/src/lib/projectQueries.ts` | `useCommitment/useObservations/useDiscipline` | ✓ WIRED | Import and call-site confirmed in all 3 panels |
| each Phase Progress panel | `packages/spa/src/lib/projectQueries.ts` | `usePhaseProgress/useSecurity` | ✓ WIRED | 4 panels use usePhaseProgress, SecurityStatus uses useSecurity — all imports and call-sites confirmed |
| `packages/agent/src/lib/phaseDetail.ts` | `@agenticapps/dashboard-shared` | type imports for all response types | ✓ WIRED | `from '@agenticapps/dashboard-shared'` import confirmed |
| `packages/spa/src/components/panels/CommitmentBlock.tsx` | `panels/InlineDrift.tsx` | `import { InlineDrift } from './InlineDrift.js'` | ✓ WIRED | Local InlineDrift definition gone, shared import confirmed for all 3 Plan 05 panels |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| CommitmentBlock.tsx | `query.data.markdown` | `useCommitment(id)` → `apiFetch('/api/projects/{id}/commitment')` → `parseCommitmentBlock(root)` → reads `.planning/skill-observations/*.md` | Real filesystem read with mtime sort and regex extraction | ✓ FLOWING |
| HookFirings.tsx | `query.data.entries` + `query.data.skillInstalled` | `useObservations(id, 20)` → `readSkillObservations(root, 20)` → streams `.planning/skill-observations/*.jsonl` | Real filesystem streaming via node:readline | ✓ FLOWING |
| RationalizationFires.tsx | `query.data.rationalization.rows` | `useDiscipline(id)` → `parseRationalizationRows(root, entries)` → reads `.claude/skills/agenticapps-workflow/skill/SKILL.md` | Real file read + JSONL entry cross-reference | ✓ FLOWING |
| PhaseProgress.tsx | `query.data.files` | `usePhaseProgress(id)` → `parsePhaseChecklist(phaseDir)` → `readdirSync + statSync` | Real filesystem reads in canonical order | ✓ FLOWING |
| ExecutionTimeline.tsx | `query.data.tdd.timeline` | `usePhaseProgress(id)` → `parseExecutionTimeline(root, phasePrefix)` → execa `git log` | Real git subprocess with timeout | ✓ FLOWING |
| ReviewStatus.tsx | `query.data.review` | `usePhaseProgress(id)` → `parseReviewFindings4(filePath)` → regex on file content | Real file read + finding severity regex | ✓ FLOWING |
| SecurityStatus.tsx | `query.data.cso` + `query.data.dbSentinel` | `useSecurity(id)` → `parseSecurityReports(phaseDir)` → `readFileSync` capped at 4096 | Real filesystem reads with content cap | ✓ FLOWING |
| VerificationStatus.tsx | `query.data.verification` | `usePhaseProgress(id)` → `parseVerificationDetail(filePath)` → parses `- **Text**:` bullets | Real file read + evidence annotation detection | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — no live daemon running during verification. The 5 daemon routes require bearer-token auth and a registered project. Moved to Human Verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DISC-01 | Plans 01-03, 05 | CommitmentBlock — last `## Workflow commitment` block | ✓ SATISFIED | Parser + route + panel + e2e test all wired end-to-end |
| DISC-02 | Plans 01-03, 05 | HookFirings — last 20 entries from skill-observations | ✓ SATISFIED | readSkillObservations (limit 20 at panel, 200 at discipline route) + route + panel |
| DISC-03 | Plans 01-03, 05 | RationalizationFires — counter per row that fired | ✓ SATISFIED | parseRationalizationRows reads SKILL.md at runtime + discipline route + panel |
| DISC-04 | Plans 01, 03, 05 | Meta-observer install hint when skill missing | ✓ SATISFIED | skillInstalled boolean in schema + observations route + HookFirings install-hint block with CodeBlock |
| PHASE-01 | Plans 01-04, 06 | PhaseProgress — file-by-file checklist | ✓ SATISFIED | parsePhaseChecklist in canonical order + phase-progress route + PhaseProgress panel |
| PHASE-02 | Plans 01-04, 06 | ExecutionTimeline — TDD red/green commit pairs | ✓ SATISFIED | parseExecutionTimeline + TASK_ID_RE + RED/GREEN detection + panel with dots + E2E4 |
| PHASE-03 | Plans 01-04, 06 | ReviewStatus — Stage 1/2 finding counts by severity | ✓ SATISFIED | parseReviewFindings4 (4-bucket) + phase-progress route + ReviewStatus panel with 🔴🟠🟡⚪ glyphs + E2E5 |
| PHASE-04 | Plans 01-04, 06 | SecurityStatus — /cso + database-sentinel summary | ✓ SATISFIED | parseSecurityReports (4096 cap) + security route + SecurityStatus panel |
| PHASE-05 | Plans 01-04, 06 | VerificationStatus — must_haves vs evidence count | ✓ SATISFIED | parseVerificationDetail + phase-progress route + VerificationStatus panel + E2E6 |

All 9 Phase 4 requirement IDs (DISC-01–04, PHASE-01–05) are satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/agent/src/lib/phaseDetail.ts` | ~211-215 | Full JSON-blob substring match for rationalization fire counting (`JSON.stringify(e).includes(label)`) | ⚠️ Warning | Could false-positive count fires when unrelated field values happen to contain a label substring (WR-02 from code review). SPA displays potentially inflated fire counts. Not a stub — data flows, but accuracy is imperfect. No observable UI breakage today. |
| `packages/agent/src/lib/phaseDetail.ts` | ~163 | Returns JSONL entries even when `skillInstalled: false` | ⚠️ Warning | WR-03: spec D-4-15 says entries should be empty when skill is absent. SPA correctly ignores entries in that state (shows install-hint only), so no visible UI bug. API contract deviates from spec intent. Test O3 assertion contradicts its own title. |
| `packages/agent/src/lib/phaseDetail.ts` | ~258-262 | Orphan SUMMARY files silently omitted from phase checklist | ⚠️ Warning | WR-01: if a PLAN file is deleted after work completed, the paired SUMMARY disappears from the PhaseProgress panel. Cosmetic issue — no crash, but the phase checklist is incomplete in that edge case. |

All 3 warnings are non-blocking for the phase goal. Each was documented in 04-REVIEW.md. No critical or blocking anti-patterns found.

### Human Verification Required

### 1. Live navigation from home page to project detail

**Test:** Start daemon (`agentic-dashboard start`) + dev server (`pnpm --filter @agenticapps/dashboard-spa dev`). Pair via the printed URL. Click any project card on `/`.
**Expected:** Browser routes to `/projects/{id}`. Renders: (a) the `← All Projects` breadcrumb header with project name, branch, and phase info; (b) the Discipline column (left) with Commitment, Hook Firings, Rationalization Fires panels; (c) the Phase Progress column (center) with Phase Progress, Execution Timeline, Review Status, Security Status, Verification Status panels. No placeholder text visible. Document title updates.
**Why human:** Route navigation + live daemon data requires a browser + running services. The e2e test mocks fetch; real rendering requires an actual daemon.

### 2. CommitmentBlock live data (ROADMAP success criterion 2)

**Test:** Register a project that has `.planning/skill-observations/*.md` files containing `## Workflow commitment` headings. Navigate to its detail page.
**Expected:** CommitmentBlock panel shows the markdown content of the most recent commitment block (not an empty state). Source filename is shown below. The content matches what is in the highest-mtime .md file.
**Why human:** Requires a real project with skill-observation files. Test fixtures mock this; human confirms real daemon parsing works correctly.

### 3. WR-03 install-hint visual verification

**Test:** Navigate to a project detail page for a project WITHOUT `.claude/skills/meta-observer/SKILL.md` but WITH `.planning/skill-observations/*.jsonl` files.
**Expected:** Hook Firings panel shows the install-hint (meta-observer not installed message + `claude skill install meta-observer` CodeBlock), NOT entry rows. No data from the JSONL files leaks into the panel display.
**Why human:** The code review found that the daemon returns populated entries even when skillInstalled:false (WR-03). The SPA correctly ignores entries in this state, but human visual confirmation is needed to verify no unexpected data appears in the UI. This distinguishes "technically correct behavior" from "visible regression."

---

## Gaps Summary

No gaps were found that block phase goal achievement. All 5 ROADMAP success criteria are verified by automated tests (E2E1–E2E6) and confirmed by direct code inspection. The 3 warnings from the code review (WR-01, WR-02, WR-03) are known edge cases documented during the review cycle — none prevent the observable truths from being true.

The status is `human_needed` because 3 items require browser + daemon interaction to fully confirm live behavior. All automated checks pass.

---

_Verified: 2026-05-06T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
