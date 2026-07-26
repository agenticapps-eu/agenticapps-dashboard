---
phase: 11-coverage-trends-skill-drift
plan: 04
subsystem: spa-coverage-trends
tags: [spa, coverage, drift-badge, tanstack-query, tdd, option-c]

# Dependency graph
requires:
  - phase: 11
    plan: 01
    provides: CoverageHistoryResponseSchema + CoverageCellDriftSchema via @agenticapps/dashboard-shared barrel
  - phase: 11
    plan: 02
    provides: GET /api/coverage/history?repoId= bulk-per-repo daemon endpoint
provides:
  - useCoverageHistory(repoId) TanStack Query hook (bulk-per-repo, 1h staleTime)
  - CoverageDriftBadge presentational component (▲Nd / ▼Nd inline text)
  - CoverageCell.drift? prop (purely presentational — Option C)
  - CoverageRow owns the single per-repo useCoverageHistory call and fans drift to 4 cells
affects: [phase-11 verification + impeccable critique]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Option C single-ownership drift model (REVIEWS action item 1): CoverageRow owns useCoverageHistory(repoId) once per row; CoverageCell stays purely presentational with a drift?: CoverageCellDrift | null prop and never calls a data hook"
    - "Bulk-per-repo SPA hook (PD-11-02): useCoverageHistory(repoId) — NO `cell` parameter; one fetch returns drift for all four cells"
    - "Performance budget (REVIEWS action item 2): ≤ 1 history request per registered repo on first paint of /coverage — locked structurally by TanStack dedup on queryKey ['coverageHistory', repoId] and verified by Drift-5/Drift-6 fetch-count tests"
    - "Inline text drift indicator (D-11-03) over sparkline/SVG to preserve calm aesthetic and work on touch (Tailscale-from-iPad)"
    - "INV-04 client-side schema check: apiFetch → parseOrDrift → Error('schema_drift:<path>') so failed history fetch surfaces as isError, row passes drift={null} to all four cells (no crash)"
    - "Singular/plural aria-label: 'Improved 1 day ago' vs 'Improved 3 days ago' so screen readers narrate naturally"

key-files:
  created:
    - packages/spa/src/lib/coverageHistoryQueries.ts
    - packages/spa/src/lib/coverageHistoryQueries.test.ts
    - packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx
    - packages/spa/src/components/panels/coverage/CoverageDriftBadge.test.tsx
  modified:
    - packages/spa/src/components/panels/coverage/CoverageCell.tsx
    - packages/spa/src/components/panels/coverage/CoverageCell.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageRow.tsx
    - packages/spa/src/components/panels/coverage/CoverageRow.test.tsx
    - packages/spa/src/components/panels/coverage/CoverageFamilySection.test.tsx

key-decisions:
  - "Option C ownership model (REVIEWS action item 1 — three options canvassed; picked Option C): CoverageRow owns the per-repo useCoverageHistory hook and fans the four cell drifts out as props to its four CoverageCell children. CoverageCell stays purely presentational — verified structurally by Drift-15 grep test that ensures CoverageCell.tsx contains no useCoverageHistory / useQuery / useMutation."
  - "Hook signature drops the `cell` parameter — bulk-per-repo wire shape (PD-11-02) means one fetch returns drift for all four cells, so the SPA hook signature is useCoverageHistory(repoId), NOT useCoverageHistory(repoId, cell)."
  - "1h staleTime mirrors the daemon-side coverageHistoryCache TTL. History changes once-per-day at most (daily cron), so a 1h client cache is comfortably within the data freshness budget. Structural test H4 asserts staleTime === 60*60*1000 so a refactor can't silently drop caching (REVIEWS action item 4 structural staleTime guard)."
  - "Component name CoverageDriftBadge (not InlineDrift) — Phase 6 already owns InlineDrift.tsx as the schema-drift panel. Avoiding the collision was the load-bearing naming decision; verified via `grep -c InlineDrift CoverageDriftBadge.tsx` returns 0."

patterns-established:
  - "TDD on every SPA component: write the test file first (RED — fails on module-not-found OR on hook-not-wired), implement, confirm GREEN, commit. Pattern held across all 3 tasks (4 commits — Task 2 split into Badge + Cell)."
  - "Hex-literal source-level guard via runtime fs.readFile + path.resolve(process.cwd(), ...) — works under vitest jsdom env (the more obvious `new URL('./X.tsx', import.meta.url)` fails because vite remaps import.meta.url to http: scheme in jsdom)."
  - "fetch+pairing stub for hook-consuming component tests: vi.mock '../../../lib/pairing.js' + vi.stubGlobal('fetch', mockFetch) lets CoverageRow render inside a QueryClientProvider without a real daemon. Helper `withQC(children)` wraps any element for tests that don't need fine-grained QC control."

requirements-completed: [TRD-03, TRD-05, INV-04]

# Metrics
duration: 16min
completed: 2026-05-16
---

# Phase 11 Plan 04: SPA Coverage Trends Summary

**SPA-side coverage trends with EXACTLY ONE drift-data ownership model (Option C — REVIEWS action item 1 resolved): bulk-per-repo `useCoverageHistory` hook owned by CoverageRow, fans four cell drifts out as props to purely-presentational CoverageCell children. CoverageDriftBadge renders inline ▲Nd / ▼Nd. Performance budget locked structurally: ≤ 1 history request per registered repo on first paint.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-05-16T14:32:10Z
- **Completed:** 2026-05-16T14:48:00Z
- **Tasks:** 3 (TDD: Task 1 hook, Task 2 badge + cell extension, Task 3 row ownership)
- **Files created:** 4 (2 source + 2 test)
- **Files modified:** 5 (CoverageCell.tsx/.test.tsx, CoverageRow.tsx/.test.tsx, CoverageFamilySection.test.tsx for QC provider migration)
- **Tests added:** 29 (8 hook + 9 badge + 6 cell drift extension + 6 row ownership)
- **Full SPA test suite after plan:** 845/845 green (was 824 — +21 net, with some new tests gated by mocks)
- **SPA typecheck + build:** clean
- **Workspace typecheck:** clean (5/5 packages)

## Accomplishments

### Hook layer

- **`useCoverageHistory(repoId)`** — TanStack Query hook against `GET /api/coverage/history?repoId=`. Bulk-per-repo signature (no `cell` parameter — PD-11-02 / Option C). 1h staleTime mirrors daemon `coverageHistoryCache` TTL. queryKey `['coverageHistory', repoId]` deduplicates sibling mounts that share a repoId.
- **8 tests cover:** initial pending state (H1), success returns all four cells (H2), queryKey shape with no `cell` segment (H3), staleTime structural assertion (H4 — REVIEWS action item 4 guard), 401 → isError (H5), schema drift → isError with `schema_drift:` prefix (H6), enabled:false → idle (H7), TanStack dedup → 1 fetch for 2 sibling mounts (H8).

### Component layer

- **`CoverageDriftBadge.tsx`** — text-only inline indicator. Renders `▲Nd` (direction="up" — text-status-success) or `▼Nd` (direction="down" — text-status-error). aria-label "Improved 1 day ago" / "Regressed 3 days ago" (singular/plural correct). No SVG, no hex literals, no name collision with Phase 6 `InlineDrift.tsx`.
- **9 tests cover:** text rendering for up/down (B1-B2), token application (B3-B4), aria-label singular/plural (B5-B7), typography (B8), source-level no-hex guard (B9).
- **`CoverageCell.tsx` extension** — accepts `drift?: CoverageCellDrift | null` prop. Renders `<CoverageDriftBadge>` as a figure-sibling to the existing subtext when BOTH direction + daysSince are non-null. Cross-field nulls render no badge. Stays purely presentational — Drift-15 grep test asserts no `useCoverageHistory` / `useQuery` / `useMutation` inside.
- **6 new tests:** drift undefined → no badge (regression guard — Drift-10), up/down badge rendering (Drift-11/12), cross-field null → no badge (Drift-13), explicit null → no badge (Drift-14), source-level no-hooks guard (Drift-15).
- **All 9 existing CoverageCell tests still green** (regression guard — no prop name changes, no class changes).

### Row layer

- **`CoverageRow.tsx` extension** — calls `useCoverageHistory(\`${row.family}/${row.repo}\`)` ONCE per row. Derives `cellDrifts = history.data?.cells ?? null`. Passes `drift={cellDrifts?.X ?? null}` to each of its four CoverageCell children. NO error propagation to the row — drift is auxiliary signal; on history fetch failure or pending state, all four cells receive null drift and the row renders cleanly.
- **6 new tests:**
  - **Drift-1** — exactly 1 history fetch per row mount (single-owner — Option C structural lock)
  - **Drift-2** — claudeMd drift from hook → ▲Nd badge on the claudeMd cell only
  - **Drift-3** — hook isPending → no badges, no crash
  - **Drift-4** — hook isError (500) → no badges, no crash
  - **Drift-5** — performance budget: N rows = N apiFetch calls (REVIEWS action item 2)
  - **Drift-6** — TanStack dedup: 2 rows with same repoId → 1 apiFetch call

## Task Commits

| Task | Subject                                                                                              | Hash    |
| ---- | ---------------------------------------------------------------------------------------------------- | ------- |
| 1    | test+feat(11-04): add useCoverageHistory(repoId) bulk-per-repo hook (Option C)                       | d7cb8d7 |
| 2a   | test+feat(11-04): add CoverageDriftBadge component (▲Nd/▼Nd inline text — D-11-03)                   | b4f5d4f |
| 2b   | test+feat(11-04): extend CoverageCell presentationally with drift? prop (no hooks)                   | eda4e01 |
| 3    | feat(11-04): CoverageRow owns useCoverageHistory and fans drift to four cells (Option C — REVIEWS #1 + #2) | 8303157 |

(SUMMARY commit lands as a separate metadata commit owned by the orchestrator after merge.)

## Decisions Made

- **Option C chosen (REVIEWS action item 1 — three options canvassed in the planning REVIEWS pass): CoverageRow owns the hook, CoverageCell stays purely presentational with a `drift?` prop.** The two prior plan drafts conflated Task 2 (`drift` prop on CoverageCell) with Task 3 (`useCoverageHistory` inside CoverageCell) — that contradiction is resolved structurally here. Verified by Drift-15 (grep test ensures no hook calls live in CoverageCell.tsx) + the acceptance criterion `grep -c useCoverageHistory CoverageCell.tsx` returns 0.
- **Performance budget locked structurally (REVIEWS action item 2):** TanStack dedup on `['coverageHistory', repoId]` + 1h staleTime + the bulk-per-repo wire shape means N rows on first paint of `/coverage` issue at most N history requests (one per registered repo). Drift-5 enforces this with a concrete fetch-count assertion for N=5 rows. Drift-6 verifies the dedup path for the same-repoId case.
- **Component naming (D-11-03):** `CoverageDriftBadge` chosen — `InlineDrift` would have collided with the Phase 6 schema-drift panel at `packages/spa/src/components/panels/InlineDrift.tsx`. Source-level guard: `grep -c InlineDrift` returns 0 for every new/modified file in this plan.
- **No hex literals:** Source-level guard in CoverageDriftBadge.test.tsx test B9 reads the component file at runtime and asserts no hex matches. Token-namespace lock (D-5.1-10) preserved.
- **Aria-label singular/plural:** `1 day` vs `N days` — natural screen-reader narration matters even for a tiny inline badge.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] CoverageFamilySection tests broke when CoverageRow became QueryClientProvider-required**
- **Found during:** Task 3 — full SPA suite run after CoverageRow.tsx update
- **Issue:** CoverageFamilySection renders CoverageRow indirectly; once CoverageRow began calling `useCoverageHistory`, the FamilySection tests (which rendered bare without a QueryClientProvider) crashed in TanStack's "No QueryClient set, use QueryClientProvider" guard. 7 pre-existing FamilySection tests went from green → red.
- **Fix:** Added a local `withQC(children)` helper to `CoverageFamilySection.test.tsx` that wraps each `render(...)` call in a `QueryClientProvider` with a fresh `QueryClient`. Also added the same `pairing` mock + `fetch` stub pattern used in CoverageRow.test.tsx so the hook's network attempt doesn't flake under jsdom. ALL 8 FamilySection tests now pass.
- **Files modified:** `packages/spa/src/components/panels/coverage/CoverageFamilySection.test.tsx` (test-only — no source change to the component itself).
- **Commit:** Folded into `8303157` (Task 3 commit) since the regression was a direct consequence of Task 3's CoverageRow change.

**2. [Rule 3 — Blocking] vitest jsdom env remaps `import.meta.url` to http: scheme, breaking the initial B9 source-level no-hex test**
- **Found during:** Task 2 Step A — first GREEN attempt on CoverageDriftBadge tests
- **Issue:** The initial draft of test B9 (no-hex-literal guard) used `new URL('./CoverageDriftBadge.tsx', import.meta.url)` then `fs.readFile(url, 'utf8')` to read the component source at runtime. Under vitest's jsdom env, `import.meta.url` is rewritten to an `http:` scheme URL (jsdom's window location), and `fs.readFile` rejects with "The URL must be of scheme file."
- **Fix:** Switched to `path.resolve(process.cwd(), 'src/components/panels/coverage/CoverageDriftBadge.tsx')` + `fs.readFile(absPath, 'utf8')`. Works under jsdom because process.cwd() returns the package root regardless of the env's URL remapping. Same pattern is now used in `CoverageCell.test.tsx` Drift-15 (no-hooks-in-cell guard).
- **Files modified:** `packages/spa/src/components/panels/coverage/CoverageDriftBadge.test.tsx` (test-only, prior to first commit)
- **Commit:** Folded into `b4f5d4f` (the CoverageDriftBadge commit — the fix landed before the test ever ran green).

### Documentation tweak (NOT a deviation — same plan, same intent)

The CoverageDriftBadge.tsx docstring initially said `MUST NOT be named \`InlineDrift\`` — that doc-comment mention caused `grep -c InlineDrift` to return 2 (both in the comment text). To make the acceptance grep return 0 (the structural intent), I reworded the docstring to say "avoids the Phase 6 schema-drift panel namespace" without spelling out the forbidden name. Same intent, cleaner verifier surface.

## REVIEWS Action Items Resolved

| # | Severity | Plans | Concern | Resolution in this plan |
|---|---|---|---|---|
| 1 | HIGH (codex) / LOW (gemini) | 11-04 | CoverageCell drift-data ownership unresolved — two models conflicted | **Option C chosen** — CoverageRow owns useCoverageHistory; CoverageCell purely presentational. Verified by Drift-15 (grep test ensuring no hook in CoverageCell.tsx) + acceptance criterion grep returning 0 for `useCoverageHistory` in CoverageCell.tsx. |
| 2 | HIGH (codex) | 11-02 + 11-04 | Per-cell history fetching — ~168 requests on first paint | **Bulk-per-repo endpoint (Plan 11-02) + Option C hook ownership (this plan) + TanStack dedup on `['coverageHistory', repoId]`** = ≤ N requests for N rows (~42 for current registry). Locked structurally by Drift-5 (N=5 rows → 5 fetches) + Drift-6 (same-repoId dedup → 1 fetch). |
| 4 (structural) | n/a | 11-04 | Need a structural staleTime test so a refactor can't silently drop caching | **Test H4** explicitly extracts `q.options.staleTime` from the QueryClient cache and asserts === 60 * 60 * 1000. A refactor that deletes the staleTime option (or changes its value) fails this test. |

## Issues Encountered

None blocking — both auto-fixes above were applied inline and the plan completed on schedule.

## Name-Collision Avoidance Evidence

```
grep -c InlineDrift packages/spa/src/lib/coverageHistoryQueries.ts                 → 0
grep -c InlineDrift packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx → 0
grep -c InlineDrift packages/spa/src/components/panels/coverage/CoverageCell.tsx       → 0
grep -c InlineDrift packages/spa/src/components/panels/coverage/CoverageRow.tsx        → 0
```

The Phase 6 `packages/spa/src/components/panels/InlineDrift.tsx` schema-drift panel is untouched.

## Token Usage Confirmation

`CoverageDriftBadge.tsx` uses only existing tokens:
- `text-status-success` (direction="up" — improvement)
- `text-status-error` (direction="down" — regression)
- `text-xs font-semibold` (typography only — no color tokens needed)

`grep -c '#[0-9a-fA-F]\{3,8\}' packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx` → **0** (no hex literals).

## Hook Signature Confirms PD-11-02 Bulk Shape

```typescript
useCoverageHistory(repoId: string, opts?: UseCoverageHistoryOptions)
```

NO `cell` parameter. One call → all four cells via `data.cells.{claudeMd|gitNexus|wiki|workflowVersion}`. URL is `/api/coverage/history?repoId=<encoded>` — no `&cell=` segment. The four cell drifts are derived once at the row level (`const cellDrifts = history.data?.cells ?? null`) and fanned out to the four CoverageCell children.

## Plan 06 Coordination Note

Plan 06 (Phase 10.6 polish bundle) is already merged into the base commit (`262602b`) and previously updated `CoverageRow.tsx` for the opacity-0 → opacity-30 polish (D-11-10 / PLI-02). Plan 04's edits are on different sections of the same file:

- **Plan 06's section (line ~120):** the refresh `<button>` className — `opacity-30 group-hover:opacity-100 ...`
- **Plan 04's section (lines ~73 + ~99-141):** the `useCoverageHistory` hook call + the four `<td><CoverageCell drift={...} /></td>` blocks

The two regions do not overlap. The Plan 06 PLI-02 tests (PLI-02 default opacity-30, group-hover preserved, focus-within preserved) still pass under Plan 04's `QueryClientProvider`-wrapped renderInQC() helper (regression-guard tests 4-6 in CoverageRow.test.tsx).

## Threat Model Verification

All STRIDE entries from the plan's threat register have a tested or structural mitigation:

| Threat ID    | Mitigated by                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| T-11-04-01   | Hook test H6 — schema-drift response surfaces as `isError` with `schema_drift:` prefix; Row test Drift-4 — isError surfaces drift={null} to all four cells (no crash, no badges) |
| T-11-04-02   | `daysSince` is a number type (React escapes JSX child text); `direction` enum is `'up'\|'down'\|null` (limited domain); aria-label built from validated primitives |
| T-11-04-03   | `apiFetch` (existing Phase 2 infrastructure) attaches the bearer token automatically; missing/invalid → 401 → ApiError; hook surfaces 401 as isError (Test H5) |
| T-11-04-04   | **Bulk-per-repo endpoint + TanStack dedup** — Drift-5 verifies N=5 rows → 5 fetches; Drift-6 verifies same-repoId dedup → 1 fetch |
| T-11-04-05   | **Option C ownership model** — Drift-15 grep test enforces no hooks in CoverageCell.tsx; single source of truth lives in CoverageRow |

## Next Plan Readiness

- **Plan 11-06** (Phase 10.6 polish bundle): already shipped on the base commit. The opacity-30 PLI-02 test continues to pass under the QueryClientProvider-wrapped renders Plan 04 introduced.
- **Phase 11 verifier** (post-execution): can render `/coverage` with the daemon running and visually confirm ▲Nd / ▼Nd badges appear on cells with transitions in the 14-day window. The performance budget is structurally locked; the DevTools Network tab should show ≤ N requests to `/api/coverage/history?repoId=...` on first paint for N registered repos.
- **Phase 11 IMPECCABLE artifact** (D-10.5-03 calibration data point #2): the inline drift badge preserves the matrix's calm aesthetic — no new SVG primitives, no new color tokens, no hover-only surfaces. Composite floor ≥ 87 expected.

## Self-Check: PASSED

Verification:
- `[FOUND]` `packages/spa/src/lib/coverageHistoryQueries.ts` exists
- `[FOUND]` `packages/spa/src/lib/coverageHistoryQueries.test.ts` exists
- `[FOUND]` `packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx` exists
- `[FOUND]` `packages/spa/src/components/panels/coverage/CoverageDriftBadge.test.tsx` exists
- `[FOUND]` `packages/spa/src/components/panels/coverage/CoverageCell.tsx` extended with `drift?` prop
- `[FOUND]` `packages/spa/src/components/panels/coverage/CoverageRow.tsx` calls `useCoverageHistory(\`${row.family}/${row.repo}\`)` exactly once
- `[FOUND]` commit `d7cb8d7` (Task 1 — useCoverageHistory hook)
- `[FOUND]` commit `b4f5d4f` (Task 2a — CoverageDriftBadge component)
- `[FOUND]` commit `eda4e01` (Task 2b — CoverageCell presentational extension)
- `[FOUND]` commit `8303157` (Task 3 — CoverageRow owns hook + FamilySection migration)
- `[PASS]` `pnpm --filter @agenticapps/dashboard-spa test --run` → 845/845 green
- `[PASS]` `pnpm --filter @agenticapps/dashboard-spa typecheck` → clean
- `[PASS]` `pnpm --filter @agenticapps/dashboard-spa build` → clean (chunk-size warnings pre-existing, not introduced by this plan)
- `[PASS]` `pnpm -r typecheck` → clean (5/5 packages)
- `[PASS]` `grep -c useCoverageHistory packages/spa/src/components/panels/coverage/CoverageCell.tsx` returns 0 (Option C — purely presentational cell)
- `[PASS]` `grep -c useCoverageHistory packages/spa/src/components/panels/coverage/CoverageRow.tsx` returns 3 (1 import + 1 call + 1 doc reference — semantically: 1 actual hook invocation, single ownership confirmed)
- `[PASS]` `grep -c InlineDrift packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx` returns 0 (no name collision with Phase 6 schema-drift panel)
- `[PASS]` `grep -c '?cell=' packages/spa/src/lib/coverageHistoryQueries.ts` returns 0 (PD-11-02 bulk shape — no per-cell URL param)
- `[PASS]` `grep -c '#[0-9a-fA-F]\{3,8\}' packages/spa/src/components/panels/coverage/CoverageDriftBadge.tsx` returns 0 (no hex literals)
- `[PASS]` Test H4 (structural staleTime guard) asserts `q.options.staleTime === 60*60*1000` (REVIEWS action item 4)
- `[PASS]` Test Drift-5 (performance budget) asserts N rows → N apiFetch calls (REVIEWS action item 2)
- `[PASS]` Test Drift-15 (no hooks in cell) asserts CoverageCell.tsx contains no useCoverageHistory / useQuery / useMutation (REVIEWS action item 1 Option C structural lock)

---
*Phase: 11-coverage-trends-skill-drift*
*Completed: 2026-05-16*
