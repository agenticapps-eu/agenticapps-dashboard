---
phase: 12
plan: 03
subsystem: spa-conformance-primitives
tags:
  - conformance
  - spa
  - tanstack-query
  - pure-svg
  - tdd
  - threat-model
  - accessibility
  - phase-11.2-pattern
dependency_graph:
  requires:
    - "Wave 0 (12-00): ConformanceResponseSchema, ConformanceDayPoint, PathDriftEntry, RegistryFixPathRequest, tierOf from @agenticapps/dashboard-shared"
    - "Wave 2 (12-02): GET /api/observability/conformance + POST /api/admin/registry/fix-path daemon routes"
    - "Phase 5.1 tokens: status-success/-warning/-error/-info, accent, text-{primary|secondary|tertiary}, border-subtle, card-bg, card-bg-hover, app-bg"
    - "Phase 11.1: useToast (Toast.tsx), ToastProvider"
    - "Phase 11.2: inFlightRefreshes ReadonlySet pattern (CoveragePage.tsx) + mutateAsync+try/finally for concurrent-row isolation"
  provides:
    - "useConformance() — TanStack Query hook (30s staleTime, parseOrDrift defence)"
    - "useRegistryFixPath() — mutation hook with dual cache invalidation (['conformance'] + ['coverage'])"
    - "CONFORMANCE_STALE_TIME_MS = 30_000 — locked to daemon cache TTL (Pitfall 11)"
    - "FleetTrendChart — pure-SVG 90-day fleet trend primitive (≤120 LOC budget; 101 actual)"
    - "FamilyCard — per-family conformance card (score + 14d delta + tier pill)"
    - "PathDriftPanel — collapsible drift-entries list with Fix-path mutation affordance"
  affects:
    - "Wave 4 (12-04): ConformancePage composes useConformance + FleetTrendChart + 3× FamilyCard + PathDriftPanel"
tech-stack:
  added: []
  patterns:
    - "Sibling-file query hook (coverageQueries.ts pattern) — conformanceQueries.ts mirrors verbatim, swaps the schema + adds the dual-cache invalidation step"
    - "Pure-SVG chart primitive (CoverageDriftBadge.tsx precedent; D-12-08 zero-third-party-JS stance) — no recharts/d3/chart imports"
    - "Touch-compatible disclosure (Pitfall 5) — 4 input paths (mouse+focus+pointerdown+Escape) wired to a single per-day invisible <rect tabIndex=0> overlay"
    - "SR-only mirror table (Pitfall 8) — visually-hidden <table className='sr-only'> with one row per data point; sighted users get the SVG, SR users get the table"
    - "mutateAsync + try/finally for concurrent-row isolation (Phase 11.2 CoveragePage.tsx pattern) — the shared useMutation isPending is ignored; the per-row Set is the source of truth for disabled state"
    - "Source-level grep test for dangerous-inner-html prop absence (T-12-XSS regression class)"

key-files:
  created:
    - "packages/spa/src/lib/conformanceQueries.ts (124 LOC) — useConformance + useRegistryFixPath hooks"
    - "packages/spa/src/lib/conformanceQueries.test.ts (302 LOC) — 10 tests"
    - "packages/spa/src/components/panels/conformance/FleetTrendChart.tsx (114 LOC raw; 101 non-comment per LOC test) — pure-SVG 90-day chart"
    - "packages/spa/src/components/panels/conformance/FleetTrendChart.test.tsx (214 LOC) — 16 tests"
    - "packages/spa/src/components/panels/conformance/FamilyCard.tsx (65 LOC) — tier-coloured card"
    - "packages/spa/src/components/panels/conformance/FamilyCard.test.tsx (105 LOC) — 10 tests"
    - "packages/spa/src/components/panels/conformance/PathDriftPanel.tsx (185 LOC) — drift entries + Fix-path"
    - "packages/spa/src/components/panels/conformance/PathDriftPanel.test.tsx (336 LOC) — 15 tests"
  modified: []
decisions:
  - "Switched PathDriftPanel from mutation.mutate(vars,{onSuccess,onError,onSettled}) to mutateAsync + try/finally — adopted from Phase 11.2 CoveragePage. With multiple concurrent rows, useMutation's shared isPending state has only one in-flight tracking slot; the second .mutate() call abandons the first. mutateAsync + per-call await + finally lets each row keep its own promise alive AND its own Set entry. The per-row Set is the source of truth for disabled state; mutation.isPending is ignored."
  - "FleetTrendChart emit BOTH baseline gridlines AND dedicated dashed threshold rules at y(70)+y(90). The verbatim RESEARCH sketch combined the two: baseline lines had isThreshold ? 'stroke-border-subtle' : 'stroke-border-subtle/50' and only the threshold ones got strokeDasharray. But 70 and 90 are NOT in the [0,25,50,75,100] gridline set, so dashing in that branch was unreachable. Implementation emits 5 baseline gridlines AT [0,25,50,75,100] + 2 dashed threshold rules AT [70, 90]. This is a divergence from the verbatim sketch but matches the intended behaviour (D-12-12 spec). LOC budget still under 120 (101 actual)."
  - "errorCodeToMessage in PathDriftPanel extracts only HTTP-status-derived codes from the ApiError message (`HTTP 429` → rate_limited, `HTTP 404` → project_not_found). Full daemon error-code body parsing is deferred — apiFetch throws ApiError with status code only, not the parsed body. The toast falls back to the generic 'Fix failed' string for 422 cases (newPath_blocked, newPath_unresolvable, newPath_outside_family_roots, invalid_request), which is the T-12-TOAST-LEAK-safe default. If finer-grained 422 messages are needed, Wave 4 can extend apiFetch to surface the daemon error body — but for v1.2.0 the user gets actionable guidance via the daemon's own error response JSON in the network panel."
metrics:
  duration: "~12 min"
  completed: "2026-05-20T08:30:00Z"
requirements_completed:
  - REQ-12-FCH-01
  - REQ-12-FCH-02
  - REQ-12-FCH-03
  - REQ-12-FCH-04
  - REQ-12-FCH-05
  - REQ-12-RPD-04
  - REQ-12-CON-04
---

# Phase 12 Plan 03: Wave 3 SPA presentation primitives Summary

**Four new SPA files (3 components + 1 query hook) + 4 test files — useConformance/useRegistryFixPath TanStack hooks, FleetTrendChart pure-SVG 90-day chart (≤120 LOC budget held at 101), FamilyCard tier-coloured card, PathDriftPanel with Fix-path affordance + concurrent-row isolation. 51 atomic tests added, all green; SPA suite 1015 → 1066. T-12-XSS mitigated (dangerous-inner-html prop absent from all three component files; verified by source-level grep tests).**

## Files Created

| File | Purpose | LOC |
|---|---|---|
| `packages/spa/src/lib/conformanceQueries.ts` | `useConformance` (30s staleTime, parseOrDrift) + `useRegistryFixPath` (dual cache invalidation) + `CONFORMANCE_STALE_TIME_MS` | 124 |
| `packages/spa/src/lib/conformanceQueries.test.ts` | 10 tests — staleTime, refetchOnWindowFocus, schema-drift defence, POST body shape, dual cache invalidation, 422 error surfacing | 302 |
| `packages/spa/src/components/panels/conformance/FleetTrendChart.tsx` | Pure-SVG 90-day trend chart (4 polylines + gridlines + threshold rules + per-day reveal + sr-only mirror) | 114 raw / 101 non-comment |
| `packages/spa/src/components/panels/conformance/FleetTrendChart.test.tsx` | 16 tests — empty/building states, 4 polylines, 5 gridlines, dashed rules, 90 ticks, ≤7 labels, hover/focus/pointerdown/Escape reveal, sr-only mirror, role+aria-label, LOC ≤120 budget, dangerous-inner-html absence | 214 |
| `packages/spa/src/components/panels/conformance/FamilyCard.tsx` | tier pill via tierOf (single source of truth for D-12-04 90/70 mapping) + delta14d glyph | 65 |
| `packages/spa/src/components/panels/conformance/FamilyCard.test.tsx` | 10 tests — name, score, all 3 tier boundaries, delta glyph + colour for positive/negative/zero, no hex literals, no dangerous-inner-html | 105 |
| `packages/spa/src/components/panels/conformance/PathDriftPanel.tsx` | collapsible panel; per-row suggested-path OR manual-paste input (maxLength=4096); Fix-path button; mutateAsync + try/finally for concurrent-row isolation; errorCodeToMessage maps daemon codes | 185 |
| `packages/spa/src/components/panels/conformance/PathDriftPanel.test.tsx` | 15 tests — null when empty, count + collapse, name+path as text, button enable/disable, POST shape, success toast, error toast (mapped, no leak), in-flight aria-busy, concurrent two-row isolation, maxLength=4096, no dangerous-inner-html, no hex literals, inFlightRefreshes ≥2 use sites | 336 |

## Test Counts

| Suite | Tests | Result |
|---|---|---|
| `conformanceQueries` | 10 | green |
| `FleetTrendChart` | 16 | green |
| `FamilyCard` | 10 | green |
| `PathDriftPanel` | 15 | green |
| **Plan 12-03 new** | **51** | **green** |
| Full `@agenticapps/dashboard-spa` suite (post-impl) | 1066 / 119 files | green (baseline 1015 + 51 new — exact delta match) |
| `tsc --noEmit` (workspace) | — | clean |

## LOC budget verdict — FleetTrendChart

- **`wc -l` raw lines:** 114
- **Non-blank non-comment lines (per LOC test S15):** 101
- **D-12-08 budget:** ≤ 120
- **Verdict:** PASSED with 19-LOC margin. Extraction of breakdown panel NOT needed.

## T-12-XSS verification

Grep assertion tests confirm the dangerous-inner-html prop name is absent from all three component files:

- `FleetTrendChart.test.tsx` S16 — green
- `FamilyCard.test.tsx` F10 — green
- `PathDriftPanel.test.tsx` P13 — green

All PathDriftEntry strings (`storedPath`, `suggestedPath`, `id`) rendered via JSX expression interpolation — React's default escaping is the load-bearing defence. Tests verify both render-correctness (P4 shows text content escaped into DOM) AND structural absence (P13 grep).

## Phase 11.1 verify-contrast.test.ts — no regression

`FamilyCard.tsx` and `PathDriftPanel.tsx` contain zero hex literals (verified by F9 + P14 grep tests). Phase 11.1's global `tokenSourceOfTruth.test.ts` invariant continues to pass post-merge — only `tokens.css` introduces hex.

## Atomic Commits

| Hash | Type | Description |
|---|---|---|
| `33af14d` | test | failing tests for conformanceQueries (RED) |
| `bcaf106` | feat | useConformance + useRegistryFixPath hooks (GREEN) |
| `fc74e40` | test | failing tests for FleetTrendChart incl. LOC + a11y + touch (RED) |
| `dcce450` | feat | FleetTrendChart pure-SVG primitive (GREEN) |
| `58729ce` | test | failing tests for FamilyCard + PathDriftPanel (RED) |
| `871df7e` | feat | FamilyCard + PathDriftPanel components (GREEN) |

Six atomic commits — two per TDD task. Each `feat` commit had its `test` predecessor confirmed RED before implementation landed.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] FleetTrendChart threshold rules unreachable in verbatim sketch**
- **Found during:** Task 2 GREEN implementation review.
- **Issue:** The RESEARCH §FleetTrendChart sketch combined gridlines + threshold rules into one .map: `[0, 25, 50, 75, 100].map(v => <line ... strokeDasharray={v === 70 || v === 90 ? '4 4' : undefined} />)`. But 70 and 90 are NOT in [0, 25, 50, 75, 100], so the threshold-dashing branch was unreachable. The S6 test (`threshold rules at y(70) and y(90) use strokeDasharray`) would have failed.
- **Fix:** Emit baseline gridlines at [0, 25, 50, 75, 100] AND dedicated dashed rules at [70, 90] as a second .map. Adds 4 LOC; budget still under 120 (101 actual).
- **Files modified:** `packages/spa/src/components/panels/conformance/FleetTrendChart.tsx`.
- **Commit:** rolled into Task 2 GREEN commit `dcce450`.

**2. [Rule 1 — Bug] PathDriftPanel mutation.mutate with concurrent rows raced**
- **Found during:** Task 3 GREEN — P11 concurrent-row test failed (both buttons re-enabled after resolving only the first promise).
- **Issue:** `useMutation` has only one in-flight tracking slot; calling `.mutate()` twice in a row makes the second call abandon the first. When the test resolved only the first deferred promise, both `onSettled` callbacks fired because they shared the mutation's pending-resolution chain.
- **Fix:** Switched to `mutateAsync` + try/finally pattern (Phase 11.2 CoveragePage.tsx). Each row's click triggers its own awaited promise; per-row Set is the source of truth for disabled state. The shared mutation's isPending is ignored.
- **Files modified:** `packages/spa/src/components/panels/conformance/PathDriftPanel.tsx`.
- **Commit:** rolled into Task 3 GREEN commit `871df7e`.

**3. [Rule 1 — Bug] FamilyCard F6/F7 test value collision with "14d trend" label**
- **Found during:** Task 3 GREEN — F6 `screen.getByText(/4/)` found multiple matches (delta="4" AND "14" inside "14d trend").
- **Issue:** Test fixtures used delta=4 (positive) and delta=-3 (negative). Score 88 doesn't contain 4 or 3, but the "14d trend" caption contains digit 4.
- **Fix:** Swapped F6 to delta=5 (score 88 + "14d trend" don't contain 5). F7's "3" was actually unique too (88 has no 3, "14" has no 3) — kept as is. Re-running confirmed all 10 FamilyCard tests pass.
- **Files modified:** `packages/spa/src/components/panels/conformance/FamilyCard.test.tsx`.
- **Commit:** rolled into Task 3 GREEN commit `871df7e`.

**4. [Rule 1 — Bug] PathDriftPanel.test.tsx P10 `resolveFetch` narrowed to `never` under strict TS**
- **Found during:** Task 3 GREEN typecheck.
- **Issue:** `let resolveFetch: ((v: unknown) => void) | null = null` then assignment inside a Promise constructor callback — TS strict-mode control-flow analysis narrowed the variable to `never` at the call site `resolveFetch?.(…)` because it could not prove the assignment had occurred.
- **Fix:** Wrapped in an object: `const resolverHolder: { fn: ((v: unknown) => void) | null } = { fn: null }`. Object-property assignments survive control-flow narrowing.
- **Files modified:** `packages/spa/src/components/panels/conformance/PathDriftPanel.test.tsx`.
- **Commit:** rolled into Task 3 GREEN commit `871df7e`.

## Issues Encountered

None blocking. The four auto-fixes above were anticipated boundary cases — the FleetTrendChart deviation was a verbatim-sketch typo, the PathDriftPanel concurrency race is a documented TanStack semantics ambiguity (Phase 11.2 already chose the mutateAsync pattern), and the two test fixes were standard TS strictness + text-collision boundary tweaks.

Full workspace verification at plan close:

- `pnpm --filter @agenticapps/dashboard-spa test --run` → 1066/1066 green (119 files; baseline 1015 + 51 new — exact delta match)
- `pnpm --filter @agenticapps/dashboard-spa typecheck` → clean
- No new TS errors introduced in pre-existing-stale files (confirmed by baseline+post comparison)

## What Wave 4 Unblocks

Wave 4 (Plan 12-04 — ConformancePage composition) can now:

```tsx
import { useConformance } from '@/lib/conformanceQueries'
import { FleetTrendChart } from '@/components/panels/conformance/FleetTrendChart'
import { FamilyCard } from '@/components/panels/conformance/FamilyCard'
import { PathDriftPanel } from '@/components/panels/conformance/PathDriftPanel'

function ConformancePage() {
  const { data, isLoading, error } = useConformance()
  if (error?.message.startsWith('schema_drift:')) return <SchemaDriftState ... />
  if (isLoading || !data) return <Spinner />
  return (
    <>
      <PathDriftPanel drifted={data.drifted} />
      <div className="grid grid-cols-3 gap-4">
        {(['agenticapps', 'factiv', 'neuroflash'] as const).map(fam => (
          <FamilyCard key={fam} family={fam} score={data.today[fam]} delta14d={data.delta14d[fam]} />
        ))}
      </div>
      <FleetTrendChart series={data.series} ariaLabel="Fleet conformance trend last 90 days" />
    </>
  )
}
```

All four imports are stable, typed, and individually tested. No further primitive work needed in Wave 4 beyond composition + route mount.

## Self-Check: PASSED

- `packages/spa/src/lib/conformanceQueries.ts` FOUND
- `packages/spa/src/lib/conformanceQueries.test.ts` FOUND
- `packages/spa/src/components/panels/conformance/FleetTrendChart.tsx` FOUND
- `packages/spa/src/components/panels/conformance/FleetTrendChart.test.tsx` FOUND
- `packages/spa/src/components/panels/conformance/FamilyCard.tsx` FOUND
- `packages/spa/src/components/panels/conformance/FamilyCard.test.tsx` FOUND
- `packages/spa/src/components/panels/conformance/PathDriftPanel.tsx` FOUND
- `packages/spa/src/components/panels/conformance/PathDriftPanel.test.tsx` FOUND
- Commit `33af14d` (test conformanceQueries RED) FOUND
- Commit `bcaf106` (feat conformanceQueries GREEN) FOUND
- Commit `fc74e40` (test FleetTrendChart RED) FOUND
- Commit `dcce450` (feat FleetTrendChart GREEN) FOUND
- Commit `58729ce` (test FamilyCard + PathDriftPanel RED) FOUND
- Commit `871df7e` (feat FamilyCard + PathDriftPanel GREEN) FOUND
- `wc -l packages/spa/src/components/panels/conformance/FleetTrendChart.tsx` = 114 (≤130 ✓)
- LOC test (non-comment): 101 (≤120 ✓; D-12-08 budget passed)
- `grep -cE "polyline|<line|<rect|<text" FleetTrendChart.tsx` = 9 (≥8 ✓)
- `grep -c "staleTime: 30_000\|staleTime: CONFORMANCE_STALE_TIME_MS" conformanceQueries.ts` = 1
- `grep -cE "#[0-9a-fA-F]{3,}" FamilyCard.tsx PathDriftPanel.tsx` = 0 (no hex literals)
- `grep -c "inFlightRefreshes" PathDriftPanel.tsx` = 4 (≥2 required)
- `grep -c "tierOf" FamilyCard.tsx` = 3 (≥1 required)
- Full SPA suite green (1066/1066)
- Workspace typecheck clean

---

*Phase: 12-observability-conformance-surface*
*Plan: 03 — Wave 3 SPA presentation primitives*
*Completed: 2026-05-20*
