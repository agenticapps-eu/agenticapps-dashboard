---
phase: 12
plan: 01
subsystem: daemon-conformance-primitives
tags:
  - conformance
  - scoring
  - snapshots
  - ndjson
  - daemon
  - pure-functions
  - tdd
dependency_graph:
  requires:
    - "@agenticapps/dashboard-shared (CoverageResponse, CoverageRow, CoverageFamily, CoverageState)"
    - packages/agent/src/lib/snapshots/snapshotPaths.ts (resolveSnapshotDir, isSnapshotFilename, RETENTION_DAYS)
  provides:
    - "computeConformanceScores(coverage, driftedRepoIds) → Record<CoverageFamily|'fleet', FamilyScore>"
    - "readDailySeriesForFleet(opts) → Promise<DailySeriesEntry[]>"
    - "_scoreRowsForTests (helper export for discriminator tests)"
  affects:
    - Wave 2 `conformanceScan` aggregator (composes both primitives)
    - Wave 2 `GET /api/observability/conformance` route (returns today + series)
tech_stack:
  added: []
  patterns:
    - Pure-function score primitive (zero I/O — fixture-driven tests)
    - NDJSON walker mirrors snapshotReader.ts bulk-pattern with last-record-wins
    - Defence-in-depth filename + JSON.parse + ENOENT bounded skip (T-11-02-08)
key_files:
  created:
    - packages/agent/src/lib/conformanceScore.ts
    - packages/agent/src/lib/conformanceScore.test.ts
    - packages/agent/src/lib/snapshots/snapshotFleetReader.ts
    - packages/agent/src/lib/snapshots/snapshotFleetReader.test.ts
  modified: []
decisions:
  - D-12-03 / D-12-05 / D-12-06 / D-12-07 implemented in pure form
  - Pitfall 2 (not-applicable exclusion) pinned by 2 discriminator tests
  - Pitfall 3 / A8 (mean-of-3 fleet aggregation) pinned by the 30/5/5 discriminator
  - CoverageFamily schema confirmed as 3-family (no 'other') — matches RESEARCH §620-684
metrics:
  duration: "~10 min"
  completed: "2026-05-20T05:38:03Z"
requirements_addressed:
  - REQ-12-CON-02
  - REQ-12-CON-03
  - REQ-12-CON-05
---

# Phase 12 Plan 01: Wave 1 daemon primitives Summary

Pure daemon-side conformance scoring primitives — `computeConformanceScores` and `readDailySeriesForFleet` — landed with full TDD coverage of the Pitfall 2 (not-applicable exclusion) and Pitfall 3 (mean-of-3 fleet aggregation) load-bearing correctness invariants.

## Files Created

| File | Purpose | LOC |
|---|---|---|
| `packages/agent/src/lib/conformanceScore.ts` | Pure `computeConformanceScores(coverage, driftedRepoIds) → Record<CoverageFamily \| 'fleet', FamilyScore>` + `_scoreRowsForTests` helper export | 118 |
| `packages/agent/src/lib/conformanceScore.test.ts` | 17 test cases — scoreRows helper (8) + computeConformanceScores fleet aggregation (9) | 486 |
| `packages/agent/src/lib/snapshots/snapshotFleetReader.ts` | Async `readDailySeriesForFleet(opts) → Promise<DailySeriesEntry[]>` — walks NDJSON snapshot dir for `windowDays` (defaults to `RETENTION_DAYS`) emitting per-day per-family scores | 207 |
| `packages/agent/src/lib/snapshots/snapshotFleetReader.test.ts` | 15 test cases — cold-start, multi-day chronology, drift exclusion, same-day collapse, malformed-JSON skip, filename filter, integer-score assertion, mean-of-3 daily discriminator | 389 |

## Test Counts

| Suite | Tests | Result |
|---|---|---|
| `conformanceScore` | 17 | green |
| `snapshotFleetReader` | 15 | green |
| Full `@agenticapps/dashboard-agent` suite (post-impl) | 778 across 85 files | green (no regression) |
| `tsc --noEmit` | — | clean |

## Pitfall 2 confirmation (not-applicable exclusion)

Two tests pin this contract:

- `scoreRows — internal helper › not-applicable cells excluded from numerator AND denominator (Pitfall 2)`
  — fixture: 2 cells `not-applicable` + 2 cells `fresh` → score must be `100` (denominator 2), NOT `50` (which is the bug if denominator includes NA).
- `scoreRows — internal helper › GitNexus column all not-applicable + others all fresh → score 100 (Pitfall 2 fleet case)`
  — simulates the `gitNexusInstallState='not-installed'` real-world case (10.6) where every row's `gitNexus` cell is NA. Score must be `100` (6/6 of applicable cells), NOT `75` (which would make the ≥90% green tier structurally unreachable).

The mirror invariant is pinned on the daily-series path by `snapshotFleetReader › not-applicable cells excluded from numerator AND denominator (Pitfall 2 — daily)`.

## Pitfall 3 / A8 confirmation (mean-of-3 fleet aggregation)

The 30/5/5 discriminator fixture appears verbatim in both test files. With per-family scores `100 / 0 / 100`, the test asserts:

```
expect(result.fleet.score).toBe(67)        // Math.round((100 + 0 + 100) / 3) — mean-of-3 (A8)
expect(result.fleet.score).not.toBe(88)    // 140/160 cells green — sum-over-rows formula (BUG)
```

The two formulas give different numbers (67 vs 88) precisely because of the unequal repo counts. This is the test that proves the daemon implements the mean-of-3 contract intent of D-12-06 / A8, not the math-instinct sum-over-rows formula.

The same discriminator runs on the daily-series path (`snapshotFleetReader › fleet score = mean-of-3 (Pitfall 3 daily case — discriminator)`), ensuring the "Today" card and the rightmost trend-chart point can never silently diverge.

## Atomic Commits

| Hash | Type | Description |
|---|---|---|
| `9151575` | test | add failing tests for conformanceScore (RED) |
| `c0d4ad9` | feat | conformanceScore pure primitive (GREEN) |
| `708c179` | test | add failing tests for snapshotFleetReader (RED) |
| `190d338` | feat | snapshotFleetReader — 90-day NDJSON walk → per-day fleet scores (GREEN) |

Four atomic commits — exactly two per TDD task. Each `feat` commit had its `test` predecessor confirmed RED before implementation landed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `RowSpec.family` could be `undefined` under `exactOptionalPropertyTypes: true`**
- **Found during:** Task 1 typecheck after RED test was committed.
- **Issue:** The `allFresh`/`allMissing` test helpers were typed with `RowSpec['family']` which under `exactOptionalPropertyTypes: true` includes `undefined`; the underlying `CoverageRow.family` field does not accept `undefined`. `tsc --noEmit` failed with 2 TS2379 errors.
- **Fix:** Extracted a non-optional `Family` type alias (`'agenticapps' | 'factiv' | 'neuroflash'`) and typed the helper parameters with it directly, removing the `undefined` path while preserving the `RowSpec.family` optionality on the fixture builder.
- **Files modified:** `packages/agent/src/lib/conformanceScore.test.ts`
- **Commit:** rolled into the Task 1 GREEN commit `c0d4ad9`.

**2. [Rule 2 - Defence] Unknown family enum values silently skipped in `snapshotFleetReader`**
- **Found during:** Task 2 implementation.
- **Issue:** A snapshot record with a bogus `family` string (drift from a future schema, or corruption) would index into `byFamily` and throw at runtime if not guarded. The plan didn't list this as a test case but it matches the T-11-02-08 bounded-defence pattern already used by `snapshotReader.ts`.
- **Fix:** Added an explicit `FAMILY_SET.has(rec.family)` check before bucketing. Also added a test (`unknown family enum values are skipped`) asserting no NaN / no throw on bogus input.
- **Files modified:** `packages/agent/src/lib/snapshots/snapshotFleetReader.ts`, `packages/agent/src/lib/snapshots/snapshotFleetReader.test.ts`.
- **Commit:** rolled into the Task 2 RED + GREEN commit pair.

### Interface clarification (not a deviation — documentation gap)

The plan's `<interfaces>` block shows `CoverageFamily` including `'other'`, but the actual shared schema (`packages/shared/src/schemas/coverage.ts:19-20`) defines it as a 3-value enum (`'agenticapps' | 'factiv' | 'neuroflash'`). The RESEARCH §620-684 source code already uses the 3-value form. The implementation follows the actual schema, not the plan's interface comment. No `'other'` key appears in the returned `Record<CoverageFamily | 'fleet', FamilyScore>` — typecheck would have rejected it.

## What Wave 2 Unblocks

Wave 2's `conformanceScan` aggregator can now compose:

```ts
const coverage = await scanCoverageInternal()           // Phase 10
const today = computeConformanceScores(coverage, driftedSet)   // Plan 12-01 — this plan
const series = await readDailySeriesForFleet({ driftedRepoIds: driftedSet })  // Plan 12-01 — this plan
return { today: today.fleet, perFamily: { ... }, series, drifted: [...] }
```

The `/api/observability/conformance` route returns this composed shape with `outbound(ConformanceResponseSchema.parse)` per Pattern 4 — the route itself is a single `Hono` handler with the 30s `conformanceCache` singleton.

## Self-Check: PASSED

- `packages/agent/src/lib/conformanceScore.ts` FOUND.
- `packages/agent/src/lib/conformanceScore.test.ts` FOUND.
- `packages/agent/src/lib/snapshots/snapshotFleetReader.ts` FOUND.
- `packages/agent/src/lib/snapshots/snapshotFleetReader.test.ts` FOUND.
- Commit `9151575` (test conformanceScore RED) FOUND.
- Commit `c0d4ad9` (feat conformanceScore GREEN) FOUND.
- Commit `708c179` (test snapshotFleetReader RED) FOUND.
- Commit `190d338` (feat snapshotFleetReader GREEN) FOUND.
- Discriminator fixture `100, 0, 100 → 67` present in both test files (line `expect(result.fleet.score).toBe(67)`).
- `grep -c "Math.round" conformanceScore.ts` = 5 (≥2 required — per-family + fleet + helper score).
- `grep -c "Math.round" snapshotFleetReader.ts` = 2 (per-family helper + fleet).
- `grep -c "isSnapshotFilename" snapshotFleetReader.ts` = 4 (≥1 required — import + filter usage + comment refs).
- `grep -c "if (cell.state === 'not-applicable') continue"` in `conformanceScore.ts` = 1.
- `pnpm --filter @agenticapps/dashboard-agent test --run` → 778/778 green.
- `pnpm --filter @agenticapps/dashboard-agent typecheck` → 0 errors.
