---
phase: 11-coverage-trends-skill-drift
plan: 01
subsystem: shared-schemas
tags: [zod, schemas, wire-contract, coverage-trends, skill-drift, tdd]

# Dependency graph
requires:
  - phase: 10-coverage-matrix-page
    provides: CoverageStateSchema column vocabulary (claudeMd/gitNexus/wiki/workflowVersion)
  - phase: 05-skills-health
    provides: AgentLinterResponseSchema shape (referenced by Plan 11-05 — not duplicated here)
provides:
  - CoverageHistoryResponseSchema (bulk-per-repo per PD-11-02)
  - CoverageDriftDirectionSchema + CoverageCellDriftSchema sub-schemas
  - SkillDriftResponseSchema + SkillDriftRowSchema + SkillDriftCellSchema
  - Barrel re-exports through @agenticapps/dashboard-shared (no deep imports needed downstream)
affects: [11-02-coverage-history-daemon, 11-03-skill-drift-daemon, 11-04-coverage-trends-spa, 11-05-skill-drift-spa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling schema files (D-11-12): coverageHistory.ts and skillDrift.ts live next to coverage.ts; do NOT widen existing coverage.ts"
    - "Bulk-per-repo wire shape (PD-11-02): one response carries drift for ALL FOUR cells of one repo; CoverageRow owns useCoverageHistory(repoId), fans drift props out; CoverageCell stays purely presentational"
    - "Literal-versioned schemas: z.literal(1) on schemaVersion + z.literal(14) on windowDays force deliberate schema bump before silent contract drift"
    - "Strict inner cells object: .strict() rejects extra cell keys so typos/smuggled columns surface as 400/parse-error"

key-files:
  created:
    - packages/shared/src/schemas/coverageHistory.ts
    - packages/shared/src/schemas/coverageHistory.test.ts
    - packages/shared/src/schemas/skillDrift.ts
    - packages/shared/src/schemas/skillDrift.test.ts
  modified:
    - packages/shared/src/index.ts

key-decisions:
  - "Bulk-per-repo CoverageHistoryResponseSchema: one response with all four cells (PD-11-02), not per-(repo, cell) — cuts first-paint fan-out from ~168 to ~42 requests on /coverage and keeps CoverageCell presentational"
  - "Family enum locked to ['agenticapps','factiv','neuroflash','other']: derived from path-prefix match against ~/Sourcecode/, not from registry.client which is null for every entry"
  - "windowDays: z.literal(14) — D-11-01 retention window enforced at the wire-contract layer; cannot widen the window without a deliberate schemaVersion: 2 bump"
  - "CoverageCellDriftSchema is its own barrel export so Plan 11-04 can type CoverageCell's drift prop without deep-importing from './schemas/coverageHistory.js'"

patterns-established:
  - "TDD per schema: write the test file first (RED — fails on module-not-found), implement the schema (GREEN), no refactor needed for pure Zod schema declarations"
  - "Schema-level cross-field permissiveness: schema permits the { direction: 'up', daysSince: null } combination because the runtime invariant (both null or both non-null) is enforced by the daemon-side reader (snapshotReader.ts), not the wire schema. This keeps the schema the single CONTRACT enforcement point and the reader the single RUNTIME enforcement point."

requirements-completed: [TRD-03, TRD-05, SKD-01, SKD-02, SKD-04, INV-04]

# Metrics
duration: 4min
completed: 2026-05-16
---

# Phase 11 Plan 01: Coverage trends + skill drift schemas Summary

**Two new shared Zod schema files (coverageHistory.ts bulk-per-repo, skillDrift.ts per-skill matrix) + barrel re-exports — the single wire contract every downstream Phase 11 plan compiles against.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-16T13:36:57Z
- **Completed:** 2026-05-16T13:40:55Z
- **Tasks:** 3 (TDD, RED→GREEN per schema file)
- **Files created:** 4
- **Files modified:** 1
- **Tests added:** 36 (17 for coverageHistory, 19 for skillDrift incl. 3 barrel re-export checks)
- **Total shared package tests after plan:** 234/234 green (was 198)

## Accomplishments

- `CoverageHistoryResponseSchema` locked to the bulk-per-repo shape (PD-11-02) — single response carries drift for `{ claudeMd, gitNexus, wiki, workflowVersion }` of one repo, with `.strict()` on the inner cells object so contract drift surfaces loudly
- `SkillDriftResponseSchema` locked with the four-value family enum (`agenticapps`/`factiv`/`neuroflash`/`other`) and optional `degraded` per-project field for `Promise.allSettled` partial-failure isolation
- Both new schemas (and the new `CoverageCellDriftSchema` sub-schema) are barrel-exported through `@agenticapps/dashboard-shared` so downstream plans (02/03/04/05) consume the single wire contract without deep imports
- `.strict()` + literal `schemaVersion: 1` + literal `windowDays: 14` provide three independent guardrails against silent contract drift — STRIDE T-11-01-01 mitigation is structural, not just documented

## Task Commits

Each task was committed atomically (TDD discipline preserved across all three tasks):

1. **Task 1 (RED): failing tests for CoverageHistoryResponseSchema (bulk-per-repo)** — `52dc5ce` (test)
2. **Task 2 (GREEN): CoverageHistoryResponseSchema implementation** — `5604e56` (feat)
3. **Task 3 Step A (RED): failing tests for SkillDriftResponseSchema** — `aadaff3` (test)
4. **Task 3 Step B (GREEN): SkillDriftResponseSchema implementation** — `33e9465` (feat)
5. **Task 3 Step C (GREEN): barrel re-exports** — `8d54b8f` (feat)

(Plan metadata commit + STATE.md/ROADMAP.md commit lands after this SUMMARY.)

## Files Created/Modified

### Created

- `packages/shared/src/schemas/coverageHistory.ts` — exports `CoverageDriftDirectionSchema` (enum `'up'|'down'`), `CoverageCellDriftSchema` (`{ direction: nullable; daysSince: int|null }`), `CoverageHistoryResponseSchema` (bulk-per-repo with all four cells in a `.strict()` inner object) + 3 inferred types
- `packages/shared/src/schemas/coverageHistory.test.ts` — 17 vitest cases; covers enum acceptance/rejection, cell schema cross-field combinations, response-level required-fields, literal-version drift rejection, `.strict()` extra-key rejection
- `packages/shared/src/schemas/skillDrift.ts` — exports `SkillDriftCellSchema` (presence + version + ISO mtime), `SkillDriftRowSchema` (skillId + byProject record), `SkillDriftResponseSchema` (projects + rows top-level shape, family enum, optional degraded) + 3 inferred types
- `packages/shared/src/schemas/skillDrift.test.ts` — 19 vitest cases (16 schema-shape + 3 barrel re-export checks)

### Modified

- `packages/shared/src/index.ts` — APPEND-ONLY: added two re-export blocks for `./schemas/coverageHistory.js` and `./schemas/skillDrift.js` (3 schemas + 3 types each). Zero modifications to pre-existing exports (verified via `git diff`)

## Decisions Made

- **Bulk-per-repo over per-(repo, cell):** PD-11-02 was already locked at planning time; this plan operationalizes it at the schema layer. The `cells` inner object is `.strict()` so an extra cell key (typo or smuggled column) becomes a 400/parse-error rather than silent acceptance.
- **CoverageCellDriftSchema barrel-exported:** Not strictly required by the wire contract (the only top-level response is `CoverageHistoryResponseSchema`), but Plan 11-04's CoverageRow → CoverageCell prop typing needs it directly. Exporting it through the barrel keeps Plan 11-04 free of deep imports from `./schemas/coverageHistory.js`.
- **Schema permits cross-field nulls:** `{ direction: 'up', daysSince: null }` parses successfully. The runtime invariant (both null or both non-null) is enforced by the daemon-side `snapshotReader.ts` (Plan 11-02). This keeps the schema the single CONTRACT enforcement point and the reader the single RUNTIME enforcement point — easier to test in isolation and a clearer separation of concerns.
- **Family enum includes `'other'` fallback:** Research finding: live registry has `client: null` for every entry; family must be derived from path-prefix match against `~/Sourcecode/{agenticapps,factiv,neuroflash}/`. `'other'` is the fallback for off-family registrations.

## Deviations from Plan

None — plan executed exactly as written. TDD RED→GREEN cycles ran clean for both schema files; all 36 new tests pass on first GREEN cycle; barrel was append-only with no edits to pre-existing exports.

## Issues Encountered

None.

## User Setup Required

None — pure schema work, no external services touched, no daemon write paths added, no SPA routes added. Schemas are dormant until Plans 11-02 and 11-03 land the daemon endpoints that emit them.

## Next Phase Readiness

- **Plan 11-02 (coverage trends daemon)** ready: `CoverageHistoryResponseSchema` and `CoverageCellDriftSchema` available via `@agenticapps/dashboard-shared`. `snapshotReader.ts`'s `readDriftForRepo(repoId)` helper returns the 4-cell record matching `CoverageHistoryResponseSchema['cells']`.
- **Plan 11-03 (skill drift daemon)** ready: `SkillDriftResponseSchema` available via the barrel. Plan 11-03's AgentLinter mutation route should reuse the existing shared `AgentLinterResponseSchema` (already exported via the barrel at line 111-112 of `index.ts`) — no schema duplication needed (REVIEWS.md item 10).
- **Plans 11-04 / 11-05 (SPA consumers)** ready: barrel exposes everything they need. `useCoverageHistory(repoId)` hook (Plan 11-04) consumes `CoverageHistoryResponseSchema` directly; `useSkillDrift({ scope })` (Plan 11-05) consumes `SkillDriftResponseSchema`.

**Import path for all downstream plans:** `@agenticapps/dashboard-shared` (the barrel) — do NOT deep-import from `./schemas/coverageHistory.js` or `./schemas/skillDrift.js` directly.

## Self-Check: PASSED

Verification:
- `[FOUND]` `packages/shared/src/schemas/coverageHistory.ts` exists
- `[FOUND]` `packages/shared/src/schemas/coverageHistory.test.ts` exists
- `[FOUND]` `packages/shared/src/schemas/skillDrift.ts` exists
- `[FOUND]` `packages/shared/src/schemas/skillDrift.test.ts` exists
- `[FOUND]` `packages/shared/src/index.ts` modified (additions only)
- `[FOUND]` commit `52dc5ce` (test: CoverageHistoryResponseSchema RED)
- `[FOUND]` commit `5604e56` (feat: CoverageHistoryResponseSchema GREEN)
- `[FOUND]` commit `aadaff3` (test: SkillDriftResponseSchema RED)
- `[FOUND]` commit `33e9465` (feat: SkillDriftResponseSchema GREEN)
- `[FOUND]` commit `8d54b8f` (feat: barrel re-exports GREEN)
- `[PASS]` 234/234 shared package tests green (`pnpm --filter @agenticapps/dashboard-shared test --run`)
- `[PASS]` shared package typecheck clean (`pnpm --filter @agenticapps/dashboard-shared typecheck`)
- `[PASS]` workspace typecheck clean (`pnpm -r typecheck` — all 5 packages clean)
- `[PASS]` workspace build clean (`pnpm -r build`)
- `[PASS]` `grep -c "InlineDrift" packages/shared/src/schemas/coverageHistory.ts` returns 0 (no Phase 6 schema-drift component name collision)
- `[PASS]` `grep -c "cell: z\.enum" packages/shared/src/schemas/coverageHistory.ts` returns 0 (no per-(repo, cell) discriminator — bulk-per-repo shape locked)

---
*Phase: 11-coverage-trends-skill-drift*
*Completed: 2026-05-16*
